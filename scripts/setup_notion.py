# -*- coding: utf-8 -*-
"""
노션에 블로그용 데이터베이스(표)와 샘플 글을 자동으로 만드는 스크립트.
node/npm 없이 파이썬으로 동일한 역할을 합니다.

실행: python scripts/setup_notion.py
"""
import os
import sys
from pathlib import Path
from notion_client import Client

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.local"


def load_env():
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def save_ids(db_id: str, data_source_id: str):
    lines = ENV_FILE.read_text(encoding="utf-8").splitlines() if ENV_FILE.exists() else []
    lines = [l for l in lines if not l.startswith("NOTION_DATABASE_ID=") and not l.startswith("NOTION_DATA_SOURCE_ID=")]
    lines.append(f"NOTION_DATABASE_ID={db_id}")
    lines.append(f"NOTION_DATA_SOURCE_ID={data_source_id}")
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    env = load_env()
    token = env.get("NOTION_TOKEN")
    parent_page_id = env.get("NOTION_PARENT_PAGE_ID")

    if not token or not parent_page_id:
        print("오류: .env.local 에 NOTION_TOKEN 또는 NOTION_PARENT_PAGE_ID 가 없습니다.")
        sys.exit(1)

    notion = Client(auth=token)

    print("노션 데이터베이스(표)를 만드는 중...")
    try:
        db = notion.databases.create(
            parent={"type": "page_id", "page_id": parent_page_id},
            title=[{"type": "text", "text": {"content": "블로그 글 목록"}}],
            initial_data_source={
                "properties": {
                    "제목": {"title": {}},
                    "슬러그": {"rich_text": {}},
                    "요약": {"rich_text": {}},
                    "카테고리": {"select": {"options": [
                        {"name": "소식", "color": "orange"},
                        {"name": "루틴", "color": "pink"},
                        {"name": "후기", "color": "green"},
                    ]}},
                    "발행일": {"date": {}},
                    "발행": {"checkbox": {}},
                }
            },
        )
    except Exception as e:
        msg = str(e)
        if "Could not find page" in msg or "restricted_resource" in msg or "404" in msg:
            print("오류: 페이지를 찾을 수 없습니다.")
            print("→ 그 노션 페이지에서 '연결(Connections)'로 이 통합을 연결했는지 다시 확인해 주세요.")
        else:
            print(f"오류: {msg}")
        sys.exit(1)

    db_id = db["id"]
    data_source_id = db["data_sources"][0]["id"]
    print(f"데이터베이스 생성 완료: {db_id}")

    print("샘플 글을 추가하는 중...")
    notion.pages.create(
        parent={"type": "data_source_id", "data_source_id": data_source_id},
        properties={
            "제목": {"title": [{"text": {"content": "블로그를 시작합니다"}}]},
            "슬러그": {"rich_text": [{"text": {"content": "welcome"}}]},
            "요약": {"rich_text": [{"text": {"content": "Konecta 블로그의 첫 번째 글입니다."}}]},
            "카테고리": {"select": {"name": "소식"}},
            "발행일": {"date": {"start": "2026-09-03"}},
            "발행": {"checkbox": True},
        },
        children=[
            {
                "object": "block",
                "type": "heading_2",
                "heading_2": {"rich_text": [{"type": "text", "text": {"content": "환영합니다"}}]},
            },
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {
                    "content": "이 글은 노션에서 자동으로 가져온 샘플 글입니다. "
                               "이 문단을 지우고 실제 글을 써보세요."
                }}]},
            },
        ],
    )
    print("샘플 글 추가 완료.")

    save_ids(db_id, data_source_id)
    print(f"\n완료! NOTION_DATABASE_ID / NOTION_DATA_SOURCE_ID 를 .env.local 에 저장했습니다.")


if __name__ == "__main__":
    main()
