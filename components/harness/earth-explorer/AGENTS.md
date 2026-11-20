# 모아 지구 탐험

- `app/`가 이 프로젝트의 원본이다. `world-land.json`과 `world-features.json`은 Natural Earth 1:50m 자료를 화면용으로 단순화해 앱에 포함한 파일이다. 국가 경계·국가명, 주요 강, 산맥 정보를 담고 외부 API에 연결하지 않는다.
- `npm start`는 기본 `http://127.0.0.1:4178`에서 공유 하네스 서버를 사용한다.
- 3D 구체와 지형 텍스처는 `globe.mjs`, 목적지 목록과 확대 단계별 지명 표시·겹침 조정은 `app.js`, 스타일은 `style.css`에 둔다. `tools/build-map-data.py`는 Natural Earth 원본 압축 자료에서 `world-features.json`을 재생성한다.
- 구체는 WebGL과 앱 안의 자체 지형 텍스처로 표시한다. 외부 지도 API나 계정 키는 사용하지 않는다.
- 출처: [Natural Earth 1:50m Cultural Vectors](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/) 및 [Natural Earth 1:50m Physical Vectors](https://www.naturalearthdata.com/downloads/50m-physical-vectors/). 실제 위성 사진이나 건물 단위 지도는 포함하지 않는다.
- 화면 모드는 부모의 `moa:theme` 메시지로 전달되어 `html[data-moa-theme]` 속성에 반영된다.
