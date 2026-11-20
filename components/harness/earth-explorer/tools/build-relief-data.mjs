import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(toolsDirectory, '../app');
const sourceDirectory = path.resolve(process.argv[2] || path.join(appDirectory, '.geodata-source-10m'));
const landSource = path.join(sourceDirectory, 'land', 'ne_10m_land.shp');
const bathymetrySource = path.join(sourceDirectory, 'bathymetry');
const landTolerance = 0.012;
const bathymetryTolerance = 0.035;

function simplify(points, tolerance) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  const last = points.length - 1;
  keep[0] = 1;
  keep[last] = 1;
  const stack = [[0, last]];
  const toleranceSquared = tolerance * tolerance;

  while (stack.length) {
    const [first, end] = stack.pop();
    const [x1, y1] = points[first];
    const [x2, y2] = points[end];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    let bestIndex = -1;
    let bestDistance = toleranceSquared;

    for (let index = first + 1; index < end; index += 1) {
      const [x, y] = points[index];
      const ratio = lengthSquared
        ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared))
        : 0;
      const distanceX = x - (x1 + ratio * dx);
      const distanceY = y - (y1 + ratio * dy);
      const distance = distanceX * distanceX + distanceY * distanceY;
      if (distance > bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    }

    if (bestIndex >= 0) {
      keep[bestIndex] = 1;
      stack.push([first, bestIndex], [bestIndex, end]);
    }
  }

  const result = points.filter((_, index) => keep[index]);
  return result.length >= 4 ? result : points;
}

function readPolygonShapefile(filePath, tolerance) {
  const bytes = fs.readFileSync(filePath);
  const polygons = [];
  let pointCount = 0;
  let simplifiedPointCount = 0;
  let offset = 100;

  while (offset + 8 <= bytes.length) {
    const contentLength = bytes.readInt32BE(offset + 4) * 2;
    const recordStart = offset + 8;
    const recordEnd = recordStart + contentLength;
    if (recordEnd > bytes.length) throw new Error(`Invalid shapefile record in ${path.basename(filePath)}`);

    const shapeType = bytes.readInt32LE(recordStart);
    if (shapeType === 5) {
      const partCount = bytes.readInt32LE(recordStart + 36);
      const vertexCount = bytes.readInt32LE(recordStart + 40);
      const partIndexOffset = recordStart + 44;
      const pointsOffset = partIndexOffset + partCount * 4;
      const boundaries = Array.from({ length: partCount + 1 }, (_, index) =>
        index === partCount ? vertexCount : bytes.readInt32LE(partIndexOffset + index * 4),
      );
      const rings = [];

      for (let part = 0; part < partCount; part += 1) {
        const first = boundaries[part];
        const end = boundaries[part + 1];
        if (end - first < 4) continue;
        const points = [];
        for (let index = first; index < end; index += 1) {
          const pointOffset = pointsOffset + index * 16;
          points.push([bytes.readDoubleLE(pointOffset), bytes.readDoubleLE(pointOffset + 8)]);
        }
        pointCount += points.length;
        const reduced = simplify(points, tolerance).map(([lon, lat]) => [
          Math.round(lon * 100000) / 100000,
          Math.round(lat * 100000) / 100000,
        ]);
        simplifiedPointCount += reduced.length;
        rings.push(reduced);
      }

      if (rings.length) polygons.push(rings);
    } else if (shapeType !== 0) {
      throw new Error(`Expected polygon geometry in ${path.basename(filePath)}, got shape type ${shapeType}`);
    }
    offset = recordEnd;
  }

  return { polygons, pointCount, simplifiedPointCount };
}

function writeJson(name, value) {
  const filePath = path.join(appDirectory, name);
  const contents = JSON.stringify(value);
  fs.writeFileSync(filePath, contents, 'utf8');
  console.log(`Wrote ${name}: ${(contents.length / 1_000_000).toFixed(2)} MB`);
}

if (!fs.existsSync(landSource)) {
  throw new Error(`Missing ${landSource}. Extract Natural Earth 10m land into <source>/land.`);
}
if (!fs.existsSync(bathymetrySource)) {
  throw new Error(`Missing ${bathymetrySource}. Extract Natural Earth 10m bathymetry into <source>/bathymetry.`);
}

const land = readPolygonShapefile(landSource, landTolerance);
writeJson('world-land.json', {
  source: 'Natural Earth 1:10m land polygons',
  polygons: land.polygons,
});
console.log(`  coastline vertices: ${land.pointCount.toLocaleString()} → ${land.simplifiedPointCount.toLocaleString()}`);

const bathymetryFiles = fs.readdirSync(bathymetrySource)
  .filter(file => /^ne_10m_bathymetry_[A-L]_\d+\.shp$/i.test(file))
  .sort((left, right) => Number(left.match(/_(\d+)\.shp$/)[1]) - Number(right.match(/_(\d+)\.shp$/)[1]));
if (!bathymetryFiles.length) throw new Error(`No Natural Earth 10m bathymetry shapefiles found in ${bathymetrySource}`);

const bathymetryLayers = [];
let bathymetryPointCount = 0;
let reducedBathymetryPointCount = 0;
for (const file of bathymetryFiles) {
  const depth = Number(file.match(/_(\d+)\.shp$/)[1]);
  const data = readPolygonShapefile(path.join(bathymetrySource, file), bathymetryTolerance);
  bathymetryLayers.push({ depth, polygons: data.polygons });
  bathymetryPointCount += data.pointCount;
  reducedBathymetryPointCount += data.simplifiedPointCount;
}

writeJson('world-bathymetry.json', {
  source: 'Natural Earth 1:10m bathymetry, SRTM Plus depth bands',
  layers: bathymetryLayers,
});
console.log(`  bathymetry vertices: ${bathymetryPointCount.toLocaleString()} → ${reducedBathymetryPointCount.toLocaleString()}`);
