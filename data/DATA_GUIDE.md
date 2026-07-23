# 데이터 가이드

## 폴더 구조

```text
data/
├─ raw/                 팀원들이 수집한 원본 HTML과 파싱 결과 CSV
├─ restaurants.csv      앱에서 사용하는 카페 정보
├─ menus.csv            앱에서 사용하는 메뉴 정보
├─ sources.csv          출처와 확인 날짜
└─ DATA_GUIDE.md         이 문서
```

`data/raw/`는 원본 보관용이고, 앱 코드는 `restaurants.csv`, `menus.csv`,
`sources.csv` 세 파일만 읽으면 됩니다.

## 원본 수집 및 파싱 (`data/raw/`)

카페 메뉴는 네이버 지도 페이지에서 메뉴 목록 부분의 HTML을 직접 복사해
`data/raw/<카페명>.html`로 저장한 뒤, 파싱 스크립트로 CSV를 뽑습니다.

### 설치

```bash
pip install beautifulsoup4
```

### 실행

```bash
python scripts/parse_naver_menu.py [원본HTML 경로] [카페명] [출력CSV 경로]
```

예시:

```bash
python scripts/parse_naver_menu.py \
  data/raw/우지커피_배곧한라비발디점.html \
  "우지커피 배곧한라비발디점" \
  data/raw/우지커피_배곧한라비발디점_parsed.csv
```

실행하면:

- 네이버 페이지의 "대표메뉴"/"새로 나온 메뉴"/"추천 메뉴" 소개 카테고리로 인해
  같은 메뉴가 두 번 나오는 중복 행을 자동으로 제거합니다.
- 지정한 카페의 CSV를 저장합니다.
- 같은 폴더의 다른 `*_parsed.csv` 파일을 전부 모아 `data/raw/전체_메뉴_통합.csv`를
  자동으로 다시 만듭니다.

지원하는 네이버 페이지 템플릿은 두 가지입니다.

- **네이버 플레이스 메뉴 탭** (`place_section`)
- **네이버 스마트주문 위젯** (`OrderHome`) — 이 템플릿은 스크롤해야 항목이
  로딩되는 지연 로딩(lazyload) 구조이므로, 복사 전에 메뉴 목록 맨 아래까지
  스크롤해서 모든 항목이 로딩된 것을 확인해야 합니다. 로딩되지 않은 항목은
  파서가 자동으로 건너뛰고 개수를 경고로 알려줍니다.

## 앱용 데이터 (`restaurants.csv`, `menus.csv`, `sources.csv`)

`data/raw/전체_메뉴_통합.csv`를 기반으로 만들며, 아래 규칙을 따릅니다.

- 단품으로 주문할 수 없는 옵션(샷 추가, 시럽 추가, 원두 변경 등)은
  `menus.csv`에서 제외합니다.
- 가격은 숫자만 입력합니다 (`2,500원`이 아닌 `2500`).
- `menus.csv`에는 메뉴 설명을 넣지 않습니다 (앱은 이미지·이름·가격만 표시).
- HOT/ICE가 별도 상품이거나 가격이 다르면 별도 메뉴로 취급합니다.
- 이미지 사용 권한이 확인되지 않은 경우 `image_url`은 비워둡니다. 현재
  수집한 이미지는 모두 네이버/배달의민족 CDN에서 가져온 것이라 재사용 권한이
  확인되지 않아, `restaurants.csv`와 `menus.csv`의 `image_url`은 전부
  비어 있습니다. 권한이 확인되면 이후 채워 넣습니다.
- `sources.csv`의 `source_url`은 실제 네이버 지도 페이지 주소를 아직 따로
  기록해두지 않아 비어 있습니다. 확인되는 대로 채워야 합니다.
