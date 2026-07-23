import sys
import csv
import re
from urllib.parse import unquote, urlparse, parse_qs
from bs4 import BeautifulSoup


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


if __name__ == "__main__":
    path = sys.argv[1]
    cafe_name = sys.argv[2]
    rows, unloaded_count = parse_file(path, cafe_name)

    print(f"추출된 메뉴 항목 수: {len(rows)}")
    if unloaded_count:
        print(f"경고: 아직 로딩되지 않은(lazyload-placeholder) 항목 {unloaded_count}개는 건너뛰었습니다. "
              f"전체 메뉴를 뽑으려면 스크롤을 끝까지 내린 뒤 다시 저장해주세요.")
    for r in rows:
        print(r)

    out_path = sys.argv[3] if len(sys.argv) > 3 else "parsed_menu.csv"
    if rows:
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        print(f"CSV 저장: {out_path}")
