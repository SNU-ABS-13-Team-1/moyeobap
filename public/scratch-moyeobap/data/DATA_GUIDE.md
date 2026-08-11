# 모여밥(moyeobap) 데이터 검수 및 입력 가이드

## 데이터 구조 안내

팀원들이 수집한 서울대학교 시흥캠퍼스 주변 음식점 및 카페 데이터는 `restaurants.csv`와 `menus.csv`로 분리하여 관리합니다.

### 1. `restaurants.csv` (음식점/카페 매장 데이터)
- `restaurant_id`: 매장 고유 식별자 (`rest_001`, `rest_002` ...)
- `name`: 매장명 (예: `메가MGC커피 배곧한라비발디점`)
- `type`: `restaurant` (음식점) 또는 `cafe` (카페)
- `category`: 한식, 중식, 일식, 분식, 샐러드, 카페 등
- `address`: 매장 위치 주소
- `min_order_amount`: 최소 주문금액 (숫자)
- `delivery_fee`: 확인 시점의 기본 배달비 (숫자)
- `estimated_delivery_min`: 예상 배달 소요시간 (분)
- `order_url`: 배달 앱/주문 URL (확인 시 작성, 없을 경우 빈값)
- `last_verified_at`: 데이터 검수 확인 일자 (`YYYY-MM-DD`)

### 2. `menus.csv` (메뉴/가격 데이터)
- `menu_id`: 메뉴 고유 식별자 (`menu_001`, `menu_002` ...)
- `restaurant_id`: 매장 고유 ID (`restaurants.csv`의 `restaurant_id`와 1:1 연결)
- `name`: 메뉴명
- `price`: 메뉴 가격 (숫자)
- `description`: 메뉴 간단 설명
- `is_available`: 판매 가능 여부 (`true` / `false`)
- `last_verified_at`: 검수일 (`YYYY-MM-DD`)

## 주의사항
1. 모든 CSV 파일은 **UTF-8** 인코딩으로 저장해야 한글이 깨지지 않습니다.
2. 비밀번호, API 키, 계좌번호 등 민감정보는 포함하지 않습니다.
