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

## 노션 블로그 자동 업로드 (네틀리파이)

노션 "블로그 글 목록" 데이터베이스에서 **발행 체크박스를 켠 글**이 매시간 자동으로
네틀리파이 사이트에 반영됩니다. 더 이상 `python scripts/build_blog.py`를 로컬에서
돌려 커밋·푸시할 필요가 없습니다.

동작 방식:
1. `netlify/functions/scheduled-blog-rebuild.js`가 1시간마다 실행되어 네틀리파이
   빌드훅(Build Hook)을 호출합니다. (`netlify.toml`의 `functions."scheduled-blog-rebuild".schedule`)
2. 빌드훅이 새 배포를 시작하면, `netlify.toml`의 빌드 명령이 `scripts/build_blog.py`를
   실행해 노션에서 발행된 글을 가져와 `blog/` 폴더를 다시 만듭니다.
3. 새로 생성된 페이지가 그대로 배포됩니다.

**최초 1회, 네틀리파이 대시보드에서 아래 설정을 해주셔야 합니다** (코드만으로는 할 수 없는 부분):

1. **환경변수 등록** — Site settings → Environment variables 에서 추가:
   - `NOTION_TOKEN` — 노션 통합(integration) 토큰
   - `NOTION_DATA_SOURCE_ID` — `scripts/setup_notion.py` 실행 후 `.env.local`에 저장된 값
2. **빌드훅 생성** — Site settings → Build & deploy → Build hooks 에서
   "notion-blog-sync" 같은 이름으로 훅을 하나 만들고, 생성된 URL을 복사합니다.
3. 그 URL을 다시 환경변수로 등록: `NETLIFY_BUILD_HOOK_URL` = (복사한 빌드훅 URL)
4. 저장 후 아무 커밋이나 한 번 푸시하거나 "Trigger deploy"를 눌러 첫 배포를 실행하면
   그 다음부터는 매시간 자동으로 노션 내용을 확인해 갱신됩니다.

더 자주(예: 30분마다) 갱신하고 싶다면 `netlify.toml`의 `schedule = "@hourly"`를
크론 표현식(`"*/30 * * * *"` 등)으로 바꿔주세요.

## GitHub Pages로 배포하기

저장소 Settings → Pages에서 브랜치를 `main`, 폴더를 `/ (root)`로 설정하면
`https://<사용자명>.github.io/<저장소명>/` 주소로 바로 공개됩니다.

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
