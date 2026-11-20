import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';

export async function loadHarnessProject(id, workspace = process.cwd()) {
  const definitions = JSON.parse(await readFile(resolve(workspace, 'harness-projects.json'), 'utf8'));
  if (!Object.hasOwn(definitions, id)) throw new Error('등록되지 않은 내부 프로젝트입니다.');
  const value = definitions[id];
  let localEnv = {};
  try { localEnv = parseEnv(await readFile(resolve(workspace, '.env.local'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const environment = { ...localEnv, ...process.env };
  const root = await realpath(resolve(workspace, value.root));
  const entry = await realpath(resolve(root, value.entry));
  const inside = relative(root, entry);
  if (inside.startsWith('..') || isAbsolute(inside)) throw new Error('프로젝트 시작 파일이 폴더 밖에 있습니다.');
  const configuredPort = environment[`MOA_${id.toUpperCase().replaceAll('-', '_')}_PORT`] || value.port;
  const port = Number(configuredPort);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('프로젝트 포트 설정을 확인해주세요.');
  return { ...value, root, entry, port,
    environment: environment.SIMILARITY_SERVICE_URL ? { SIMILARITY_SERVICE_URL: environment.SIMILARITY_SERVICE_URL } : {},
    sourceKey: createHash('sha256').update(root).digest('hex'),
    settleMs: Math.max(50, Math.min(2000, Number(value.settleMs) || 120)),
  };
}
