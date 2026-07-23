"""
네이버 지도 카페 메뉴 페이지(수동으로 복사한 HTML)를 CSV로 변환하는 스크립트.

설치:
    pip install beautifulsoup4

실행:
    python scripts/parse_naver_menu.py [원본HTML 경로] [카페명] [출력CSV 경로]

    예시:
    python scripts/parse_naver_menu.py data/raw/우지커피_배곧한라비발디점.html \
        "우지커피 배곧한라비발디점" data/raw/우지커피_배곧한라비발디점_parsed.csv

출력 CSV와 같은 폴더에 있는 다른 *_parsed.csv 파일들을 모아
전체_메뉴_통합.csv를 자동으로 다시 생성합니다.
"""

import sys
import csv
import glob
import os
import re
from urllib.parse import unquote, urlparse, parse_qs
from bs4 import BeautifulSoup

CSV_FIELDS = ["업소명", "카테고리", "메뉴명", "가격", "설명", "대표메뉴", "이미지URL"]

# 네이버 페이지가 인기 메뉴를 다시 한 번 보여주는 소개용 카테고리.
# 이 카테고리에 속한 항목이 원래 카테고리(커피, 티 등)에도 있으면 중복이므로 제거한다.
SHOWCASE_CATEGORIES = {"대표메뉴", "새로 나온 메뉴", "추천 메뉴"}


def parse_place_template(soup, cafe_name):
    """네이버 플레이스 '메뉴' 탭 템플릿 (place_section / _d0Hx)"""
    rows = []
    for section in soup.select("div.place_section"):
        title_el = section.select_one(".place_section_header_title")
        if not title_el:
            continue
        category = title_el.get_text(strip=True)
        category = re.sub(r"\d+$", "", category).strip()

        for li in section.select("ul._d0Hx > li"):
            name_el = li.select_one(".lPzHi")
            price_el = li.select_one(".p2H02 em")
            desc_el = li.select_one(".okI98")
            img_el = li.select_one("img.K0PDV")
            if not name_el or not price_el:
                continue

            name = name_el.get_text(strip=True)
            price = int(price_el.get_text(strip=True).replace(",", ""))
            desc = desc_el.get_text(strip=True) if desc_el else ""
            is_signature = li.select_one(".place_blind") is not None and \
                li.select_one(".place_blind").get_text(strip=True) == "대표"

            image_url = ""
            if img_el and img_el.get("src"):
                raw_src = img_el["src"]
                qs = parse_qs(urlparse(raw_src).query)
                image_url = unquote(qs.get("src", [""])[0]) or raw_src

            rows.append({
                "업소명": cafe_name,
                "카테고리": category,
                "메뉴명": name,
                "가격": price,
                "설명": desc,
                "대표메뉴": "O" if is_signature else "",
                "이미지URL": image_url,
            })
    return rows, 0


def parse_orderhome_template(soup, cafe_name):
    """네이버 스마트주문 위젯 템플릿 (OrderHome / MenuContent)"""
    rows = []
    unloaded_count = 0
    for section in soup.select("div.OrderHome__order_list_wrap__0eZSI"):
        title_el = section.select_one(".OrderHome__title__RUK79")
        if not title_el:
            continue
        category = title_el.get_text(strip=True)

        for li in section.select("ul.OrderHome__order_list_area__1QxlW > li"):
            if li.select_one(".lazyload-placeholder") is not None:
                unloaded_count += 1
                continue

            name_el = li.select_one(".MenuContent__tit__313LA")
            price_el = li.select_one(".MenuContent__price__lhCy9 strong")
            desc_el = li.select_one(".detail_txt")
            img_el = li.select_one("img.MenuContent__img__AfTXL")
            label_el = li.select_one(".MenuLabel__label__2rqvs")
            if not name_el or not price_el:
                continue

            name = name_el.get_text(strip=True)
            price_text = price_el.get_text(strip=True).replace(",", "").replace("원", "")
            price = int(price_text) if price_text.isdigit() else 0
            desc = desc_el.get_text(strip=True) if desc_el else ""
            label = label_el.get_text(strip=True) if label_el else ""
            image_url = img_el["src"] if img_el and img_el.get("src") else ""

            rows.append({
                "업소명": cafe_name,
                "카테고리": category,
                "메뉴명": name,
                "가격": price,
                "설명": desc,
                "대표메뉴": "O" if label == "대표" else "",
                "이미지URL": image_url,
            })
    return rows, unloaded_count


def parse_file(path, cafe_name):
    with open(path, encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    if soup.select_one("div.place_section"):
        return parse_place_template(soup, cafe_name)
    elif soup.select_one("div.OrderHome__order_list_wrap__0eZSI"):
        return parse_orderhome_template(soup, cafe_name)
    else:
        raise ValueError("알 수 없는 페이지 템플릿입니다. 파서에 새 템플릿을 추가해야 합니다.")


def remove_showcase_duplicates(rows):
    """대표메뉴/새로 나온 메뉴/추천 메뉴 카테고리에 중복 등장하는 항목을 제거한다.

    같은 메뉴명이 소개용 카테고리와 실제 카테고리(커피, 티 등) 양쪽에 있으면
    소개용 카테고리 쪽 행을 지우고 실제 카테고리 행만 남긴다.
    """
    by_name = {}
    for r in rows:
        by_name.setdefault(r["메뉴명"], []).append(r)

    drop_ids = set()
    for group in by_name.values():
        if len(group) < 2:
            continue
        showcase_rows = [r for r in group if r["카테고리"] in SHOWCASE_CATEGORIES]
        real_rows = [r for r in group if r["카테고리"] not in SHOWCASE_CATEGORIES]
        if showcase_rows and real_rows:
            for r in showcase_rows:
                drop_ids.add(id(r))

    return [r for r in rows if id(r) not in drop_ids]


def write_combined_csv(out_dir):
    """out_dir 안의 *_parsed.csv를 모두 모아 전체_메뉴_통합.csv를 다시 생성한다."""
    combined_path = os.path.join(out_dir, "전체_메뉴_통합.csv")
    all_rows = []
    for path in sorted(glob.glob(os.path.join(out_dir, "*_parsed.csv"))):
        with open(path, encoding="utf-8") as f:
            all_rows.extend(csv.DictReader(f))

    with open(combined_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(all_rows)

    return combined_path, len(all_rows)


if __name__ == "__main__":
    path = sys.argv[1]
    cafe_name = sys.argv[2]
    rows, unloaded_count = parse_file(path, cafe_name)
    rows = remove_showcase_duplicates(rows)

    print(f"추출된 메뉴 항목 수: {len(rows)}")
    if unloaded_count:
        print(f"경고: 아직 로딩되지 않은(lazyload-placeholder) 항목 {unloaded_count}개는 건너뛰었습니다. "
              f"전체 메뉴를 뽑으려면 스크롤을 끝까지 내린 뒤 다시 저장해주세요.")
    for r in rows:
        print(r)

    out_path = sys.argv[3] if len(sys.argv) > 3 else "parsed_menu.csv"
    if rows:
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            writer.writeheader()
            writer.writerows(rows)
        print(f"CSV 저장: {out_path}")

        combined_path, combined_count = write_combined_csv(os.path.dirname(out_path) or ".")
        print(f"통합 CSV 재생성: {combined_path} (총 {combined_count}개)")
