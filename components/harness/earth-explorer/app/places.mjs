export const places = [
  { id: 'seoul', name: '서울', region: '대한민국 · 동아시아', lat: 37.5665, lon: 126.978, summary: '산과 강, 오래된 골목과 높은 빌딩이 함께 이어지는 도시.' },
  { id: 'tokyo', name: '도쿄', region: '일본 · 동아시아', lat: 35.6762, lon: 139.6503, summary: '바다 가까이 넓게 펼쳐진 일본의 수도.' },
  { id: 'singapore', name: '싱가포르', region: '싱가포르 · 동남아시아', lat: 1.3521, lon: 103.8198, summary: '적도 바로 아래, 여러 문화가 모이는 항구 도시.' },
  { id: 'delhi', name: '델리', region: '인도 · 남아시아', lat: 28.6139, lon: 77.209, summary: '오랜 왕조의 흔적과 오늘의 대도시가 만나는 곳.' },
  { id: 'cairo', name: '카이로', region: '이집트 · 북아프리카', lat: 30.0444, lon: 31.2357, summary: '나일강을 따라 이어지는 사막의 큰 도시.' },
  { id: 'paris', name: '파리', region: '프랑스 · 서유럽', lat: 48.8566, lon: 2.3522, summary: '센강과 방사형 대로가 만드는 유럽의 풍경.' },
  { id: 'reykjavik', name: '레이캬비크', region: '아이슬란드 · 북대서양', lat: 64.1466, lon: -21.9426, summary: '화산과 빙하가 가까운 북대서양의 섬 도시.' },
  { id: 'new-york', name: '뉴욕', region: '미국 · 북아메리카', lat: 40.7128, lon: -74.006, summary: '강과 항구 사이에 자리한 세계적인 대도시.' },
  { id: 'mexico-city', name: '멕시코시티', region: '멕시코 · 북아메리카', lat: 19.4326, lon: -99.1332, summary: '높은 고원 위에 세워진 거대한 도시.' },
  { id: 'rio', name: '리우데자네이루', region: '브라질 · 남아메리카', lat: -22.9068, lon: -43.1729, summary: '산과 해안선이 만나는 브라질의 항구 도시.' },
  { id: 'cape-town', name: '케이프타운', region: '남아프리카공화국 · 남아프리카', lat: -33.9249, lon: 18.4241, summary: '대서양과 인도양 사이, 테이블산 아래의 도시.' },
  { id: 'sydney', name: '시드니', region: '호주 · 오세아니아', lat: -33.8688, lon: 151.2093, summary: '굽이진 항구와 태평양 해변을 품은 도시.' },
];

export function findPlace(query) {
  const value = query.trim().toLocaleLowerCase('ko-KR');
  if (!value) return null;
  return places.find(place => place.name.toLocaleLowerCase('ko-KR') === value || place.id === value || place.region.toLocaleLowerCase('ko-KR').includes(value)) ||
    places.find(place => place.name.toLocaleLowerCase('ko-KR').includes(value));
}
