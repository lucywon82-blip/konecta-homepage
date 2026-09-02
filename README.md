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
