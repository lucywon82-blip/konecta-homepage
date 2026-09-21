# Konecta 홈페이지

K-뷰티를 남미(페루·칠레) 시장과 연결하는 뷰티 플랫폼 Konecta의 정적 홈페이지입니다.
사업 내용은 Notion 사업계획서("K뷰티 라틴아메리카 전략")를 바탕으로 작성했습니다.

## 로컬에서 보기

`index.html` 파일을 브라우저로 열면 됩니다. 별도 설치나 빌드 과정이 필요 없습니다.

## 폴더 구조

- `index.html` — 홈 (제품 플로우, 테스트 키트 티저, 뉴스레터, 문의)
- `brand.html` — 브랜드/회사 소개 (USP, 로드맵, 창업자 스토리)
- `journal.html` — 창업일기 & 루틴·후기 (현재는 창업 과정 기록, 제품 출시 후 후기·루틴 콘텐츠 예정)
- `css/style.css` — 스타일 (Konecta 스타일가이드의 네이비·코랄 팔레트, Pretendard/IBM Plex Mono 폰트)
- `js/main.js` — 스크립트 (부드러운 스크롤 등)
- `reference/` — 이전 작업 참고 이미지 (현재 사이트 콘텐츠와는 무관)

개인 업무 프로그램(일정·예약·매출 대시보드)은 별도 저장소
[`konecta-work-app`](https://github.com/lucywon82-blip/konecta-work-app)로
분리되었습니다 (2026-09-16). `_redirects`의 `/app/*` 규칙은 그
저장소가 배포된 클라우드플레어 워커(`konecta-app.konecta.workers.dev`)로
요청을 그대로 전달하는 역할만 이 저장소에 남아 있습니다.

## 배포 — Cloudflare Pages

이 저장소는 Cloudflare Pages로 배포됩니다 (2026-09-21부로 Netlify는 완전히
정리했습니다 — 크레딧 소진으로 배포가 막히는 문제가 있었습니다). `main`
브랜치에 푸시하면 Cloudflare Pages가 자동으로 빌드·배포합니다.

- **빌드 명령**: `node scripts/build-blog.mjs` (Cloudflare Pages 프로젝트 설정에 등록됨)
- **빌드 출력 디렉터리**: `/` (저장소 루트)
- **Functions**: `functions/` 폴더 아래 파일이 자동으로 `/api/*` 서버리스 함수로 배포됨
  (`functions/api/submit-quiz.js`, `functions/api/glowscan.js`)
- **환경변수** (Cloudflare Pages → Settings → Environment variables에 Production/Preview 둘 다 등록):
  - `NOTION_TOKEN`, `NOTION_DATA_SOURCE_ID` — 블로그 빌드용
  - `NOTION_QUIZ_DATA_SOURCE_ID` — 퀴즈 제출 저장용
  - `ANTHROPIC_API_KEY` (그리고 선택적으로 `ANTHROPIC_MODEL_VISION`, `ANTHROPIC_MODEL_TEXT`) — GlowScan용, 자세한 내용은 [`docs/glowscan.md`](docs/glowscan.md) 참고

## 노션 블로그 자동 업로드

노션 "홈페이지 블로그" 데이터베이스에서 **발행 체크박스를 켠 글**이, Cloudflare Pages가
**배포할 때마다** 자동으로 홈페이지 블로그 페이지로 반영됩니다. 로컬에서 빌드 스크립트를
직접 돌려 커밋·푸시할 필요가 없습니다 — `main`에 아무 커밋이나 푸시되면(또는 Cloudflare
Pages 대시보드에서 "Retry deployment"를 누르면) 그 시점의 노션 발행 글로 `blog/` 폴더가
새로 생성되어 그대로 배포됩니다.

### 다음에 홈페이지를 발행(배포)할 때 해야 할 일

1. 노션 "홈페이지 블로그" 데이터베이스에 글을 쓰고 **"발행" 체크박스를 켠다** (커버 이미지도
   꼭 함께 넣어야 블로그 카드에 사진이 뜬다)
2. `main` 브랜치에 새 커밋을 푸시하거나, Cloudflare Pages(dash.cloudflare.com) →
   **코넥타 홈페이지 프로젝트** → 최근 배포 → **"Retry deployment"**를 누른다
3. 배포가 끝나면 노션에 쓴 글이 자동으로 `/blog` 페이지에 올라와 있다

## 다른 컴퓨터에서 이어 작업하기

```bash
git clone <이 저장소의 URL>
```

수정 후에는:

```bash
git add .
git commit -m "설명"
git push
```
