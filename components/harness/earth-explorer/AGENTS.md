# 모아 지구 탐험

- `app/`가 이 프로젝트의 원본이다. `world-land.json`은 Natural Earth 1:10m 해안선이고, `world-bathymetry.json`은 SRTM Plus 기반 1:10m 해저 수심 구역이다. `terrain-relief.jpg`는 Natural Earth의 SRTM Plus 기반 음영 기복도를 축소한 오프라인 텍스처다. `world-features.json`은 국가 경계·국가명·강·산맥의 1:50m 자료를 담는다.
- `npm start`는 기본 `http://127.0.0.1:4178`에서 공유 하네스 서버를 사용한다.
- 3D 구체와 지형 텍스처는 `globe.mjs`, 목적지 목록과 확대 단계별 지명 표시·겹침 조정은 `app.js`, 스타일은 `style.css`에 둔다. `tools/build-map-data.py`는 1:50m 지명·국경 자료를 생성하고, `tools/build-relief-data.mjs`는 추출된 1:10m land 및 bathymetry shapefile에서 `world-land.json`과 `world-bathymetry.json`을 생성한다. `tools/build-relief-image.ps1`은 1:10m shaded relief TIFF를 지구본 텍스처 크기로 변환한다.
- 모든 지형 데이터는 로컬 파일에 포함한다. 앱 실행 중 외부 지도 API나 계정 키를 사용하지 않는다.
- 출처: [Natural Earth 1:10m Physical Vectors](https://www.naturalearthdata.com/downloads/10m-physical-vectors/), [Natural Earth 1:10m Shaded Relief](https://www.naturalearthdata.com/downloads/10m-raster-data/10m-shaded-relief/), [Natural Earth 1:50m Cultural Vectors](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/), [Natural Earth 1:50m Physical Vectors](https://www.naturalearthdata.com/downloads/50m-physical-vectors/). 실제 위성 사진이나 건물 단위 지도는 포함하지 않는다.
- 화면 모드는 부모의 `moa:theme` 메시지로 전달되어 `html[data-moa-theme]` 속성에 반영된다.
