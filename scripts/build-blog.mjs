// 노션 데이터베이스에서 '발행' 체크된 글을 가져와
// 사이트 디자인 그대로 blog/index.html, blog/<슬러그>/index.html 을 생성합니다.
//
// build_blog.py(넷리파이용)와 동일한 로직의 Node 버전 — 클라우드플레어 Pages 빌드 환경(Python 미지원)용.
//
// 실행: node scripts/build-blog.mjs

import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const BLOG_DIR = path.join(ROOT, "blog");
const NOTION_VERSION = "2025-09-03";

function loadEnv() {
  const env = { ...process.env };
  if (existsSync(ENV_FILE)) {
    for (const rawLine of readFileSync(ENV_FILE, "utf-8").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const idx = line.indexOf("=");
      env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return env;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function plainText(richText) {
  return (richText || []).map((t) => t.plain_text || "").join("");
}

function richTextToHtml(richText) {
  return (richText || [])
    .map((t) => {
      let content = escapeHtml(t.plain_text || "");
      const ann = t.annotations || {};
      if (ann.bold) content = `<b>${content}</b>`;
      if (ann.italic) content = `<em>${content}</em>`;
      if (ann.code) content = `<code>${content}</code>`;
      if (t.href) content = `<a href="${escapeHtml(t.href)}" target="_blank" rel="noopener">${content}</a>`;
      return content;
    })
    .join("");
}

async function notionFetch(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Notion API ${res.status}: ${errText}`);
  }
  return res.json();
}

const NON_BLOG_MARKER_EMOJIS = ["📱", "🗂️", "🖼️"];

function isNonBlogSectionHeading(text) {
  // 노션 페이지 안에 함께 적어둔 릴스 대본·카드뉴스 문구·SNS용 이미지 등은
  // 이런 이모지/문구가 붙은 제목으로 시작한다. 홈페이지 블로그 글에는
  // 필요 없는 내용이라, 이 제목을 만나면 그 아래는 더 이상 가져오지 않는다.
  const stripped = (text || "").trim();
  if (!stripped) return false;
  if (NON_BLOG_MARKER_EMOJIS.some((e) => stripped.startsWith(e))) return true;
  if (stripped.includes("자동 생성")) return true;
  return false;
}

async function blocksToHtml(token, blockId) {
  const htmlParts = [];
  let listBuffer = []; // [{tag, item}]

  function flushList() {
    if (listBuffer.length) {
      const tag = listBuffer[0].tag;
      const items = listBuffer.map((l) => `<li>${l.item}</li>`).join("");
      htmlParts.push(`<${tag}>${items}</${tag}>`);
      listBuffer = [];
    }
  }

  let cursor;
  let stop = false;
  for (;;) {
    const qs = new URLSearchParams({ page_size: "100" });
    if (cursor) qs.set("start_cursor", cursor);
    const resp = await notionFetch(token, `https://api.notion.com/v1/blocks/${blockId}/children?${qs}`);

    for (const block of resp.results) {
      const btype = block.type;
      const data = block[btype] || {};

      if (["heading_1", "heading_2", "heading_3"].includes(btype) && isNonBlogSectionHeading(plainText(data.rich_text))) {
        stop = true;
        break;
      }

      if (btype === "paragraph") {
        flushList();
        const plain = plainText(data.rich_text);
        if (plain.trim().startsWith("미리보기:")) continue;
        const text = richTextToHtml(data.rich_text);
        htmlParts.push(text ? `<p>${text}</p>` : "");
      } else if (btype === "heading_1") {
        flushList();
        htmlParts.push(`<h2>${richTextToHtml(data.rich_text)}</h2>`);
      } else if (btype === "heading_2") {
        flushList();
        htmlParts.push(`<h3>${richTextToHtml(data.rich_text)}</h3>`);
      } else if (btype === "heading_3") {
        flushList();
        htmlParts.push(`<h4>${richTextToHtml(data.rich_text)}</h4>`);
      } else if (btype === "bulleted_list_item") {
        listBuffer.push({ tag: "ul", item: richTextToHtml(data.rich_text) });
      } else if (btype === "numbered_list_item") {
        listBuffer.push({ tag: "ol", item: richTextToHtml(data.rich_text) });
      } else if (btype === "quote") {
        flushList();
        htmlParts.push(`<blockquote>${richTextToHtml(data.rich_text)}</blockquote>`);
      } else if (btype === "divider") {
        flushList();
        htmlParts.push("<hr>");
      } else if (btype === "code") {
        flushList();
        htmlParts.push(`<pre><code>${escapeHtml(plainText(data.rich_text))}</code></pre>`);
      } else if (btype === "image") {
        flushList();
        if (data.type === "external") {
          const src = data.external.url;
          const caption = plainText(data.caption);
          htmlParts.push(
            `<figure class="post-image"><img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}">` +
              (caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "") +
              "</figure>"
          );
        } else {
          htmlParts.push(
            '<p class="post-image-warning">(업로드된 이미지는 표시되지 않습니다 — ' +
              "노션 이미지 주소는 1시간 뒤 만료되니 외부 이미지 URL을 사용해주세요.)</p>"
          );
        }
      }

      if (block.has_children && !["bulleted_list_item", "numbered_list_item"].includes(btype)) {
        htmlParts.push(await blocksToHtml(token, block.id));
      }
    }

    if (stop || !resp.has_more) break;
    cursor = resp.next_cursor;
  }

  flushList();
  return htmlParts.filter(Boolean).join("\n");
}

function getPropText(props, name) {
  const p = props[name];
  if (!p) return "";
  switch (p.type) {
    case "title":
      return plainText(p.title);
    case "rich_text":
      return plainText(p.rich_text);
    case "select":
      return p.select ? p.select.name : "";
    case "date":
      return p.date ? p.date.start : "";
    case "checkbox":
      return p.checkbox;
    default:
      return "";
  }
}

const HEADER = (root) => `<header class="header">
  <div class="wrap">
    <a class="logo" href="${root}index.html">konecta</a>
    <nav>
      <a href="${root}brand.html" data-i18n="common.nav.brand">브랜드 소개</a>
      <a href="${root}journal.html" data-i18n="common.nav.journal">창업일기</a>
      <a href="${root}blog/index.html" class="active" data-i18n="common.nav.blog">블로그</a>
      <a href="${root}quiz.html" data-i18n="common.nav.quiz">피부진단</a>
      <a href="${root}index.html#contact" data-i18n="common.nav.contact">문의</a>
      <div class="lang-switch">
        <button data-lang="ko">KO</button>
        <button data-lang="es">ES</button>
        <button data-lang="en">EN</button>
      </div>
    </nav>
  </div>
</header>`;

const FOOTER = (root) => `<section class="footer-contact">
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

<script src="${root}js/i18n.js"></script>
<script src="${root}js/main.js"></script>`;

function pageTemplate({ title, root, body }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="${root}css/style.css">
</head>
<body>

${HEADER(root)}

${body}

${FOOTER(root)}
</body>
</html>
`;
}

function renderListPage(posts) {
  // New posts pulled from Notion only exist in Korean until someone adds a
  // matching "posts.<slug>" entry to i18n/en.json and i18n/es.json by hand —
  // until then, switching language just leaves that card's text in Korean.
  const cards = posts
    .map(
      (p) => `
      <a class="card card-photo reveal" href="${p.slug}/index.html" style="text-decoration:none; color:inherit;">
        ${p.cover_html}
        <div class="card-body">
          <span class="journal-tag" data-i18n="posts.${p.slug}.category">${escapeHtml(p.category || "글")}</span>
          <h3 data-i18n="posts.${p.slug}.title">${escapeHtml(p.title)}</h3>
          <p data-i18n="posts.${p.slug}.summary">${escapeHtml(p.summary)}</p>
        </div>
      </a>`
    )
    .join("");

  const body = `<section class="page-hero">
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
    <div class="journal-grid">${cards || '<p style="text-align:center;">아직 발행된 글이 없습니다.</p>'}
    </div>
  </div>
</section>

<section class="closing-cta">
  <div class="wrap">
    <h2 class="reveal" data-i18n="blog.next_title">다음 글은 인스타그램에서 먼저 알려드려요</h2>
    <p class="reveal" data-i18n="blog.next_desc">새 글이 올라오면 인스타그램에도 소식을 남깁니다.</p>
    <a class="btn-pill reveal" href="https://www.instagram.com/konecta.co.kr/" target="_blank" rel="noopener" data-i18n="blog.next_btn">인스타그램 팔로우하기</a>
  </div>
</section>`;

  const html = pageTemplate({ title: "블로그 | Konecta", root: "../", body });
  writeFileSync(path.join(BLOG_DIR, "index.html"), html, "utf-8");
}

function renderPostPage(post) {
  const cover = post.cover_html_full || "";
  let heroStyle = "min-height:auto; padding:110px 0 60px;";
  if (!cover) heroStyle += " color: var(--navy); background: var(--surface-alt); border-bottom: 1px solid var(--border);";
  const subStyle = cover ? "" : ' style="color: var(--text-soft);"';
  const badgeClass = cover ? "pill-badge" : "pill-badge light";

  // A brand-new post's content_html is Korean-only from Notion. To make this
  // post switch language too, add a matching "posts.<slug>" entry (category,
  // title, content as HTML) to i18n/en.json and i18n/es.json by hand — Notion
  // doesn't give us translated text, so this step can't be automated here.
  const body = `<section class="page-hero" style="${heroStyle}">
  ${cover}
  <div class="wrap">
    <span class="${badgeClass}" data-i18n="posts.${post.slug}.category">${escapeHtml(post.category || "글")}</span>
    <h1 style="margin-top:14px;" data-i18n="posts.${post.slug}.title">${escapeHtml(post.title)}</h1>
    <p class="page-hero-sub"${subStyle}>${escapeHtml(post.date)}</p>
  </div>
</section>

<section class="about-block" style="text-align:left; border-bottom:none;">
  <div class="wrap" style="max-width:720px;">
    <div class="post-content" data-i18n-html="posts.${post.slug}.content">
${post.content_html}
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
</section>`;

  const html = pageTemplate({ title: `${post.title} | Konecta 블로그`, root: "../../", body });
  const postDir = path.join(BLOG_DIR, post.slug);
  mkdirSync(postDir, { recursive: true });
  writeFileSync(path.join(postDir, "index.html"), html, "utf-8");
}

async function main() {
  const env = loadEnv();
  const token = env.NOTION_TOKEN;
  const dataSourceId = env.NOTION_DATA_SOURCE_ID;
  if (!token || !dataSourceId) {
    console.error("오류: NOTION_TOKEN 또는 NOTION_DATA_SOURCE_ID 환경변수가 없습니다.");
    process.exit(1);
  }

  console.log("노션에서 발행된 글을 가져오는 중...");
  const resp = await notionFetch(token, `https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: { property: "발행", checkbox: { equals: true } },
      sorts: [{ property: "발행일", direction: "descending" }],
    }),
  });
  const pages = resp.results;
  console.log(`발행된 글 ${pages.length}개를 찾았습니다.`);

  if (existsSync(BLOG_DIR)) rmSync(BLOG_DIR, { recursive: true, force: true });
  mkdirSync(BLOG_DIR, { recursive: true });

  const posts = [];
  for (const page of pages) {
    const props = page.properties;
    const slug = getPropText(props, "슬러그") || page.id;
    const title = getPropText(props, "제목") || "(제목 없음)";
    const summary = getPropText(props, "요약");
    const category = getPropText(props, "카테고리");
    const date = getPropText(props, "발행일");

    let coverHtml = "";
    let coverHtmlFull = "";
    const cover = page.cover;
    if (cover && cover.type === "external") {
      const url = cover.external.url;
      coverHtml = `<img src="${escapeHtml(url)}" alt="${escapeHtml(title)}">`;
      coverHtmlFull = `<div class="hero-media"><img src="${escapeHtml(url)}" alt="${escapeHtml(title)}"></div>`;
    }

    console.log(`  - ${title} (${slug})`);
    const contentHtml = await blocksToHtml(token, page.id);

    const post = { slug, title, summary, category, date, cover_html: coverHtml, cover_html_full: coverHtmlFull, content_html: contentHtml };
    posts.push(post);
    renderPostPage(post);
  }

  renderListPage(posts);
  console.log(`\n완료! blog/index.html 과 글 ${posts.length}개 페이지를 만들었습니다.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
