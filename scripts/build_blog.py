# -*- coding: utf-8 -*-
"""
노션 데이터베이스에서 '발행' 체크된 글을 가져와
사이트 디자인 그대로 blog/index.html, blog/<슬러그>/index.html 을 생성합니다.

실행: python scripts/build_blog.py
"""
import os
import sys
import shutil
from pathlib import Path
from html import escape
from notion_client import Client

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.local"
BLOG_DIR = ROOT / "blog"


def load_env():
    # 네틀리파이 빌드 환경에는 .env.local이 없고 대신 사이트 환경변수로 주입되므로
    # os.environ을 기본값으로 삼고, 로컬에 .env.local이 있으면 그 값으로 덮어쓴다.
    env = dict(os.environ)
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def rich_text_to_html(rich_text):
    out = []
    for t in rich_text:
        content = escape(t.get("plain_text", ""))
        ann = t.get("annotations", {})
        if ann.get("bold"):
            content = f"<b>{content}</b>"
        if ann.get("italic"):
            content = f"<em>{content}</em>"
        if ann.get("code"):
            content = f"<code>{content}</code>"
        href = t.get("href")
        if href:
            content = f'<a href="{escape(href)}" target="_blank" rel="noopener">{content}</a>'
        out.append(content)
    return "".join(out)


def plain_text(rich_text):
    return "".join(t.get("plain_text", "") for t in rich_text)


NON_BLOG_MARKER_EMOJIS = ("📱", "🗂️", "🖼️")
NON_BLOG_MARKER_EXACT = ("카드뉴스", "카드 뉴스", "릴스 대본")


def is_non_blog_section_heading(text):
    # 노션 페이지 안에 함께 적어둔 릴스 대본·카드뉴스 문구·SNS용 이미지 등은
    # 이런 이모지/문구가 붙은 제목이나 "카드뉴스" 같은 일반 문단으로 시작한다
    # (노션에서 헤딩이 아니라 그냥 문단으로 적혀 있는 경우가 많다). 홈페이지
    # 블로그 글에는 필요 없는 내용이라, 이 지점을 만나면 그 아래는 더 이상
    # 가져오지 않는다.
    stripped = text.strip()
    if not stripped:
        return False
    if stripped.startswith(NON_BLOG_MARKER_EMOJIS):
        return True
    if "자동 생성" in stripped:
        return True
    if stripped in NON_BLOG_MARKER_EXACT:
        return True
    if stripped.lower().startswith("tarjetas de konecta"):
        return True
    return False


def blocks_to_html(notion, block_id, depth=0):
    html_parts = []
    list_buffer = []  # (tag, items)

    def flush_list():
        if list_buffer:
            tag = list_buffer[0][0]
            items = "".join(f"<li>{item}</li>" for _, item in list_buffer)
            html_parts.append(f"<{tag}>{items}</{tag}>")
            list_buffer.clear()

    cursor = None
    stop = False
    while True:
        resp = notion.blocks.children.list(block_id=block_id, start_cursor=cursor, page_size=100)
        for block in resp["results"]:
            btype = block["type"]
            data = block.get(btype, {})

            if btype in ("heading_1", "heading_2", "heading_3", "paragraph") and is_non_blog_section_heading(
                plain_text(data.get("rich_text", []))
            ):
                stop = True
                break

            if btype == "paragraph":
                flush_list()
                plain = plain_text(data.get("rich_text", []))
                if plain.strip().startswith("미리보기:"):
                    continue  # drop leftover artifact-preview links from an earlier workflow
                text = rich_text_to_html(data.get("rich_text", []))
                html_parts.append(f"<p>{text}</p>" if text else "")
            elif btype == "heading_1":
                flush_list()
                html_parts.append(f"<h2>{rich_text_to_html(data.get('rich_text', []))}</h2>")
            elif btype == "heading_2":
                flush_list()
                html_parts.append(f"<h3>{rich_text_to_html(data.get('rich_text', []))}</h3>")
            elif btype == "heading_3":
                flush_list()
                html_parts.append(f"<h4>{rich_text_to_html(data.get('rich_text', []))}</h4>")
            elif btype == "bulleted_list_item":
                list_buffer.append(("ul", rich_text_to_html(data.get("rich_text", []))))
            elif btype == "numbered_list_item":
                list_buffer.append(("ol", rich_text_to_html(data.get("rich_text", []))))
            elif btype == "quote":
                flush_list()
                html_parts.append(f"<blockquote>{rich_text_to_html(data.get('rich_text', []))}</blockquote>")
            elif btype == "divider":
                flush_list()
                html_parts.append("<hr>")
            elif btype == "code":
                flush_list()
                code_text = escape(plain_text(data.get("rich_text", [])))
                html_parts.append(f"<pre><code>{code_text}</code></pre>")
            elif btype == "image":
                flush_list()
                img = data
                if img.get("type") == "external":
                    src = img["external"]["url"]
                    caption = plain_text(img.get("caption", []))
                    html_parts.append(
                        f'<figure class="post-image"><img src="{escape(src)}" alt="{escape(caption)}">' +
                        (f'<figcaption>{escape(caption)}</figcaption>' if caption else '') +
                        '</figure>'
                    )
                else:
                    html_parts.append(
                        '<p class="post-image-warning">(업로드된 이미지는 표시되지 않습니다 — '
                        '노션 이미지 주소는 1시간 뒤 만료되니 외부 이미지 URL을 사용해주세요.)</p>'
                    )
            else:
                pass

            if block.get("has_children") and btype not in ("bulleted_list_item", "numbered_list_item"):
                html_parts.append(blocks_to_html(notion, block["id"], depth + 1))

        if stop or not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")

    flush_list()
    return "\n".join(p for p in html_parts if p)


def get_prop_text(props, name):
    p = props.get(name)
    if not p:
        return ""
    t = p.get("type")
    if t == "title":
        return plain_text(p["title"])
    if t == "rich_text":
        return plain_text(p["rich_text"])
    if t == "select":
        return p["select"]["name"] if p["select"] else ""
    if t == "date":
        return p["date"]["start"] if p["date"] else ""
    if t == "checkbox":
        return p["checkbox"]
    return ""


HEADER = """<header class="header">
  <div class="wrap">
    <a class="logo" href="{root}index.html">konecta</a>
    <nav>
      <a href="{root}brand.html" data-i18n="common.nav.brand">브랜드 소개</a>
      <a href="{root}journal.html" data-i18n="common.nav.journal">창업일기</a>
      <a href="{root}blog/index.html" class="active" data-i18n="common.nav.blog">블로그</a>
      <a href="{root}quiz.html" data-i18n="common.nav.quiz">피부진단</a>
      <a href="{root}index.html#contact" data-i18n="common.nav.contact">문의</a>
      <div class="lang-switch">
        <button data-lang="ko">KO</button>
        <button data-lang="es">ES</button>
        <button data-lang="en">EN</button>
      </div>
    </nav>
  </div>
</header>"""

FOOTER = """<section class="footer-contact">
  <div class="wrap">
    <span class="pill-badge light">CONTACT</span>
    <h2 data-i18n="contact.title">협업 · 투자 · 파트너 문의를 환영합니다</h2>
    <div class="contact-buttons">
      <a class="btn" href="https://www.instagram.com/konecta.co.kr/" target="_blank" rel="noopener">
        <span class="btn-title" data-i18n="contact.ig_t">인스타그램 DM</span>
        <span class="btn-desc" data-i18n="contact.ig_d">고객·일반 문의는 이쪽으로 편하게 남겨주세요</span>
      </a>
      <a class="btn" href="mailto:lucywon82@gmail.com">
        <span class="btn-title" data-i18n="contact.mail_t">이메일 문의</span>
        <span class="btn-desc" data-i18n="contact.mail_d">브랜드 협업 · 파트너십 문의는 이메일로</span>
      </a>
    </div>
    <p class="copyright" data-i18n="common.footer.copyright">&copy; 2026 Konecta. All rights reserved.</p>
  </div>
</section>

<script src="{root}js/i18n.js"></script>
<script src="{root}js/main.js"></script>"""

PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link rel="stylesheet" href="{root}css/style.css">
</head>
<body>

{header}

{body}

{footer}
</body>
</html>
"""


def render_list_page(posts):
    cards = []
    for p in posts:
        cover = p.get("cover_html", "")
        slug = escape(p["slug"])
        cards.append(f"""
      <a class="card card-photo reveal" href="{p['slug']}/index.html" style="text-decoration:none; color:inherit;">
        {cover}
        <div class="card-body">
          <span class="journal-tag" data-i18n="posts.{slug}.category">{escape(p['category'] or '글')}</span>
          <h3 data-i18n="posts.{slug}.title">{escape(p['title'])}</h3>
          <p data-i18n="posts.{slug}.summary">{escape(p['summary'])}</p>
        </div>
      </a>""")
    # New posts pulled from Notion only exist in Korean until someone adds a
    # matching "posts.<slug>" entry to i18n/en.json and i18n/es.json by hand —
    # until then, switching language just leaves that card's text in Korean.

    body = f"""<section class="page-hero">
  <div class="hero-media">
    <img src="https://images.unsplash.com/photo-1709551264845-e9dddd775388?w=1600&q=80&auto=format&fit=crop" alt="K-뷰티 에디토리얼">
  </div>
  <div class="wrap">
    <span class="pill-badge">BLOG</span>
    <h1 style="margin-top:14px;" data-i18n="blog.title">Konecta 블로그</h1>
    <p class="page-hero-sub" data-i18n="blog.sub">노션에 쓴 글이 자동으로 이 페이지에 올라옵니다.</p>
  </div>
</section>

<section class="about-block" style="text-align:center;">
  <div class="wrap">
    <span class="pill-badge light reveal">WHY THIS BLOG</span>
    <p class="about-lead reveal" style="margin-top:16px;" data-i18n="blog.why_title">궁금했던 남미 창업 이야기,<br>여기서 다 정리합니다</p>
    <p class="about-body reveal" data-i18n="blog.why_desc">소싱부터 통관, 현지 시장 조사까지 — 직접 부딪히며 배운 것들을 남미 진출을 고민하는 분들과 나눕니다.</p>
  </div>
</section>

<section style="background:var(--surface-alt); border-top:1px solid var(--border); border-bottom:1px solid var(--border); text-align:center;">
  <div class="wrap">
    <h2 class="reveal">혼자 알아보면 오래 걸립니다</h2>
    <div class="stat-compare reveal">
      <div class="stat">
        <div class="value" data-i18n="blog.time1">3시간+</div>
        <div class="label" data-i18n="blog.time1_label">혼자 검색해서 정리하면</div>
      </div>
      <div class="op">&gt;</div>
      <div class="stat win">
        <div class="value" data-i18n="blog.time2">5분</div>
        <div class="label" data-i18n="blog.time2_label">정리된 글 하나로</div>
      </div>
    </div>
  </div>
</section>

<section style="text-align:center;">
  <div class="wrap">
    <h2 class="reveal" data-i18n="blog.topics_title">이 블로그에서 다루는 3가지</h2>
    <div class="grid-3">
      <div class="list-block reveal reveal-1">
        <span class="num-badge">1</span>
        <div><h3 data-i18n="blog.t1_t">현지 시장 조사</h3><p data-i18n="blog.t1_d">페루·칠레를 비롯한 남미 각국의 소비자와 유통 구조를 정리합니다.</p></div>
      </div>
      <div class="list-block reveal reveal-2">
        <span class="num-badge">2</span>
        <div><h3 data-i18n="blog.t2_t">소싱·물류 실무</h3><p data-i18n="blog.t2_d">동대문 소싱부터 포워더 견적, 통관까지 실제 겪은 과정을 기록합니다.</p></div>
      </div>
      <div class="list-block reveal reveal-3">
        <span class="num-badge">3</span>
        <div><h3 data-i18n="blog.t3_t">창업 진행 상황</h3><p data-i18n="blog.t3_d">Konecta가 만들어지는 과정을 꾸미지 않고 그대로 공유합니다.</p></div>
      </div>
    </div>
  </div>
</section>

<section style="background:var(--surface-alt); border-top:1px solid var(--border); text-align:center;">
  <div class="wrap">
    <h2 class="reveal" data-i18n="blog.why_read_title">왜 Konecta 블로그를 봐야 할까요</h2>
    <div class="grid-4">
      <div class="list-block reveal reveal-1" style="flex-direction:column;">
        <span class="num-badge">1</span>
        <div><h3 data-i18n="blog.r1_t">현직 창업자의 기록</h3><p data-i18n="blog.r1_d">이론이 아니라 실제 진행 중인 창업 과정입니다.</p></div>
      </div>
      <div class="list-block reveal reveal-2" style="flex-direction:column;">
        <span class="num-badge">2</span>
        <div><h3 data-i18n="blog.r2_t">남미 현지 경험</h3><p data-i18n="blog.r2_d">칠레 3년 거주 경험을 바탕으로 씁니다.</p></div>
      </div>
      <div class="list-block reveal reveal-3" style="flex-direction:column;">
        <span class="num-badge">3</span>
        <div><h3 data-i18n="blog.r3_t">실무 중심</h3><p data-i18n="blog.r3_d">추상적인 조언 대신 구체적인 절차와 숫자를 다룹니다.</p></div>
      </div>
      <div class="list-block reveal reveal-4" style="flex-direction:column;">
        <span class="num-badge">4</span>
        <div><h3 data-i18n="blog.r4_t">솔직한 시행착오</h3><p data-i18n="blog.r4_d">잘된 것만이 아니라 실수와 수정 과정도 그대로 씁니다.</p></div>
      </div>
    </div>
  </div>
</section>

<section class="journal-preview">
  <div class="wrap">
    <h2 class="reveal" data-i18n="blog.recent_title">최근 글</h2>
    <div class="journal-grid">{''.join(cards) if cards else '<p style="text-align:center;">아직 발행된 글이 없습니다.</p>'}
    </div>
  </div>
</section>

<section class="closing-cta">
  <div class="wrap">
    <h2 class="reveal" data-i18n="blog.next_title">다음 글은 인스타그램에서 먼저 알려드려요</h2>
    <p class="reveal" data-i18n="blog.next_desc">새 글이 올라오면 인스타그램에도 소식을 남깁니다.</p>
    <a class="btn-pill reveal" href="https://www.instagram.com/konecta.co.kr/" target="_blank" rel="noopener" data-i18n="blog.next_btn">인스타그램 팔로우하기</a>
  </div>
</section>"""

    html = PAGE_TEMPLATE.format(
        title="블로그 | Konecta",
        root="../",
        header=HEADER.format(root="../"),
        body=body,
        footer=FOOTER.format(root="../"),
    )
    (BLOG_DIR / "index.html").write_text(html, encoding="utf-8")


def render_post_page(post):
    cover = post.get("cover_html_full", "")
    hero_style = "min-height:auto; padding:110px 0 60px;"
    if not cover:
        hero_style += " color: var(--navy); background: var(--surface-alt); border-bottom: 1px solid var(--border);"
    sub_style = "" if cover else ' style="color: var(--text-soft);"'
    badge_class = "pill-badge" if cover else "pill-badge light"
    slug = escape(post["slug"])
    body = f"""<section class="page-hero" style="{hero_style}">
  {cover}
  <div class="wrap">
    <span class="{badge_class}" data-i18n="posts.{slug}.category">{escape(post['category'] or '글')}</span>
    <h1 style="margin-top:14px;" data-i18n="posts.{slug}.title">{escape(post['title'])}</h1>
    <p class="page-hero-sub"{sub_style}>{escape(post['date'])}</p>
  </div>
</section>

<section class="about-block" style="text-align:left; border-bottom:none;">
  <div class="wrap" style="max-width:720px;">
    <div class="post-content" data-i18n-html="posts.{slug}.content">
{post['content_html']}
    </div>
  </div>
</section>

<section style="padding-top:0; text-align:center;">
  <div class="wrap" style="max-width:720px;">
    <a class="btn-outline" href="../index.html" data-i18n="blog.back_to_list">&larr; 블로그 목록으로</a>
  </div>
</section>

<section class="closing-cta-soft">
  <div class="wrap">
    <h2 class="reveal" data-i18n="blog.post_next_title">Konecta의 다음 이야기가 궁금하다면</h2>
    <p class="reveal" data-i18n="blog.post_next_desc">새 글이 올라오면 인스타그램에서 가장 먼저 알려드려요.</p>
    <a class="btn-pill reveal" href="https://www.instagram.com/konecta.co.kr/" target="_blank" rel="noopener" data-i18n="blog.next_btn">인스타그램 팔로우하기</a>
  </div>
</section>"""
    # New posts from Notion only have Korean text in content_html above. To make
    # a post switch language too, add a matching "posts.<slug>" entry (category,
    # title, content as HTML) to i18n/en.json and i18n/es.json by hand — Notion
    # doesn't give us translated text, so this step can't be automated here.

    html = PAGE_TEMPLATE.format(
        title=f"{post['title']} | Konecta 블로그",
        root="../../",
        header=HEADER.format(root="../../"),
        body=body,
        footer=FOOTER.format(root="../../"),
    )
    post_dir = BLOG_DIR / post["slug"]
    post_dir.mkdir(parents=True, exist_ok=True)
    (post_dir / "index.html").write_text(html, encoding="utf-8")


def main():
    env = load_env()
    token = env.get("NOTION_TOKEN")
    data_source_id = env.get("NOTION_DATA_SOURCE_ID")
    if not token or not data_source_id:
        print("오류: .env.local 에 NOTION_TOKEN 또는 NOTION_DATA_SOURCE_ID 가 없습니다.")
        print("먼저 python scripts/setup_notion.py 를 실행해주세요.")
        sys.exit(1)

    notion = Client(auth=token)

    print("노션에서 발행된 글을 가져오는 중...")
    resp = notion.data_sources.query(
        data_source_id=data_source_id,
        filter={"property": "발행", "checkbox": {"equals": True}},
        sorts=[{"property": "발행일", "direction": "descending"}],
    )
    pages = resp["results"]
    print(f"발행된 글 {len(pages)}개를 찾았습니다.")

    if BLOG_DIR.exists():
        shutil.rmtree(BLOG_DIR)
    BLOG_DIR.mkdir(parents=True)

    posts = []
    for page in pages:
        props = page["properties"]
        slug = get_prop_text(props, "슬러그") or page["id"]
        title = get_prop_text(props, "제목") or "(제목 없음)"
        summary = get_prop_text(props, "요약")
        category = get_prop_text(props, "카테고리")
        date = get_prop_text(props, "발행일")

        cover_html = ""
        cover_html_full = ""
        cover = page.get("cover")
        if cover and cover.get("type") == "external":
            url = cover["external"]["url"]
            cover_html = f'<img src="{escape(url)}" alt="{escape(title)}">'
            cover_html_full = (
                f'<div class="hero-media"><img src="{escape(url)}" alt="{escape(title)}"></div>'
            )

        print(f"  - {title} ({slug})")
        content_html = blocks_to_html(notion, page["id"])

        post = {
            "slug": slug,
            "title": title,
            "summary": summary,
            "category": category,
            "date": date,
            "cover_html": cover_html,
            "cover_html_full": cover_html_full,
            "content_html": content_html,
        }
        posts.append(post)
        render_post_page(post)

    render_list_page(posts)
    print(f"\n완료! blog/index.html 과 글 {len(posts)}개 페이지를 만들었습니다.")


if __name__ == "__main__":
    main()
