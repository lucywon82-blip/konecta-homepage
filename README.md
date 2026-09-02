# AM:ME 홈페이지

정적 HTML/CSS/JS로 만든 원페이지 홈페이지입니다.

## 로컬에서 보기

`index.html` 파일을 브라우저로 열면 됩니다. 별도 설치나 빌드 과정이 필요 없습니다.

## 폴더 구조

- `index.html` — 페이지 본문
- `css/style.css` — 스타일
- `js/main.js` — 스크립트 (부드러운 스크롤 등)
- `reference/` — 디자인 참고 이미지 (폰트 가이드, 버튼 시안)

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
