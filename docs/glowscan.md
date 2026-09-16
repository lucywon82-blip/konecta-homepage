# GlowScan — AI K-뷰티 얼굴 분석 도구

2026-09-16에 추가한 기능. 남미 고객이 사진이나 짧은 동영상을 올리면 AI가
피부톤·얼굴형을 분석해서 한국식 스킨케어 루틴과 메이크업 팁을 추천해주는
독립형 웹 도구입니다.

## 위치

- **실행 링크**: https://claude.ai/artifact/9qJzKb1WofkJim1YBs1fT3
- Claude Artifact(단일 HTML 파일)로 만들어졌고, 이 저장소 코드와는 별도로
  Claude 플랫폼에 게시되어 있습니다. 공유 설정은 "Anyone with the link"(링크
  가진 누구나 열람 가능)으로 되어 있어야 홈페이지 방문자가 볼 수 있습니다.
- 원본 소스 파일은 이 저장소에는 없고, Claude Code 세션에서 관리합니다.
  (수정하려면 해당 세션을 이어가거나, artifact를 읽어와 새로 편집해야 합니다.)

## 홈페이지 연동 지점

`quiz.html`의 설문 제출 완료 화면("제출해주셔서 감사합니다!" 화면) 하단에
GlowScan으로 연결되는 배너 + 버튼이 추가되어 있습니다.

- `quiz.html` — `GLOWSCAN_URL` 상수 + 완료 화면(`state.step > CONTACT_STEP`)
  렌더링 부분에 배너 HTML 추가
- `i18n/ko.json`, `i18n/es.json`, `i18n/en.json` — `quiz.finalStep` 안에
  `glowScanTitle` / `glowScanDesc` / `glowScanButton` 키 추가

버튼은 새 탭으로 GlowScan을 엽니다 (`target="_blank"`).

## 동작 방식

두 가지 모드로 동작하며, 접속한 기기/뷰어가 이미지 전송을 지원하는지에 따라
자동으로 전환됩니다 (Claude의 `sample` 캡ability, `sample.limits().images`로
판단).

1. **비전 모드 (이미지 전송 지원 시)**
   - 사용자가 올린 사진, 또는 동영상에서 자동 캡처한 프레임 한 장을
     Claude Vision에 직접 전달
   - 피부톤(HEX), 언더톤, 얼굴형, 피부 고민, 스킨케어 루틴 6~8단계,
     메이크업 팁 3개를 JSON으로 받아 화면에 표시

2. **설문 모드 (이미지 전송 미지원 시 — 예: Claude 데스크톱 앱 일부 화면)**
   - 사진은 참고용 미리보기로만 쓰이고 분석에는 사용되지 않음
   - 대신 피부톤(스와치 8종) · 서브톤 · 얼굴형(아이콘 6종) · 피부 고민(최대 3개)을
     직접 선택
   - 선택한 정보를 텍스트로 Claude에 보내 루틴·팁만 생성 (이미지 전송 없이도
     항상 동작)

두 모드 모두 결과는 실시간으로 Claude API를 호출해서 생성되며, 정적으로
하드코딩된 추천 문구가 아닙니다.

## 다국어 지원 (한/영/스)

우측 상단에 KO/ES/EN 전환 버튼이 있습니다.

- 첫 방문 시 브라우저 언어(`navigator.language`)를 감지해 기본 언어를 정함
  (지원하지 않는 언어면 스페인어 기본값)
- 선택한 언어는 `localStorage`(`glowscan_lang`)에 저장되어 다음 방문에도 유지
- 화면 UI 문구뿐 아니라, Claude에게 보내는 프롬프트 자체도 선택한 언어로
  응답하도록 요청함 (`skinToneLabel`/`concerns`/`routine`/`tips`가 실제로
  해당 언어로 생성됨)
- 얼굴형(`oval/round/square/heart/long/diamond`)과 서브톤(`cool/warm/neutral`)은
  AI 응답에서 언어와 무관한 영어 코드로만 받고, 화면 표시는 코드별로 3개
  언어 라벨을 별도로 매핑해서 보여줌 — 언어를 바꿔도 매칭이 깨지지 않음

## 디자인

Konecta 공식 브랜드 컬러/타이포를 그대로 사용:

- 코랄 `#ED7B5D` (포인트), 네이비 `#2B3648` (텍스트), 그 외 스타일 가이드
  팔레트
- 폰트: Sora(제목) + Plus Jakarta Sans(본문) + IBM Plex Mono(수치 표기),
  Pretendard 폴백 체인 유지
- 라이트/다크 모드 모두 대응

## 알려진 제한사항 / 다음에 할 일

- GlowScan은 Claude Artifact로 존재하기 때문에, 실제 서비스로 정식 출시하려면
  자체 백엔드(또는 별도 웹앱)로 다시 만드는 게 안전합니다. 지금은 데모/MVP
  성격이 강합니다.
- 사진은 저장되지 않고 그 자리에서만 분석됩니다(로그·DB 없음).
- 실제 방문자 트래픽이 늘어나면 Claude 쪽 사용량 정책(속도 제한 등)에 걸릴 수
  있습니다 — `rate_limited` 에러 문구가 이미 준비되어 있음.
- 얼굴형 자동 판별(비전 모드)은 AI의 주관적 판단이라 100% 정확하지 않을 수
  있습니다.
