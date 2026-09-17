# GlowScan — AI K-뷰티 얼굴 분석 도구

2026-09-16에 추가, 2026-09-17에 Claude Artifact에서 이 저장소의 자체 페이지 +
Cloudflare Pages Function으로 전환. 남미 고객이 사진이나 짧은 동영상을 올리면
AI가 피부톤·얼굴형을 분석해서 한국식 스킨케어 루틴과 메이크업 팁을
추천해주는 기능입니다.

## 지금 상태 (2026-09-17 기준)

- Cloudflare Pages 배포(`3da5e17`, 이 GlowScan 기능 커밋)가 처음엔 실패했는데,
  원인은 GlowScan 코드가 아니라 블로그 자동 생성 스크립트(`build-blog.mjs`)가
  노션 API 호출 중 504(게이트웨이 타임아웃)를 받은 것 — 노션 쪽 일시 장애였습니다.
  재배포로 성공했고, 지금은 `코넥타.co.kr` / `www.konecta.co.kr`에 GlowScan
  페이지·API가 정상 반영되어 있습니다.
- `ANTHROPIC_API_KEY`를 Cloudflare Pages 프로젝트의 **Production**과
  **Preview** 환경 양쪽에 "비밀(암호화)" 타입으로 등록 완료했습니다.
- **아직 남은 것**: Claude Console(console.anthropic.com) 계정의 사용 크레딧이
  $0이라, 실제로 "분석하기"를 누르면 크레딧 부족 오류가 날 수 있습니다. 실제
  테스트 전에 Claude Console에서 크레딧을 충전해야 합니다.
- 아래 "알려진 제한사항"의 속도 제한(rate limiting) 설정은 여전히 미완료
  상태입니다.

## 왜 전환했나

처음에는 Claude Artifact(`sample` 캡ability, 즉 방문자 본인의 Claude 계정을
빌려 쓰는 방식)로 만들었는데, 이 방식은 **방문자 본인이 Claude 계정에
로그인되어 있고, 그 계정/클라이언트가 AI 캡ability를 지원할 때만** 동작한다는
근본적 한계가 있었습니다. 실제 홈페이지 방문자(페루·칠레 일반 고객)는 대부분
Claude 계정이 없거나 로그인이 안 되어 있어서, 데모로는 괜찮지만 실서비스로는
불안정했습니다. 그래서 Konecta 자체 Anthropic API 키로 서버(Cloudflare Pages
Function)에서 직접 호출하는 방식으로 옮겼습니다 — 이제 방문자의 Claude 계정
여부와 무관하게 항상 동작합니다.

## 위치

- **페이지**: `glowscan.html` (예: `https://konecta.co.kr/glowscan`)
- **API**: `functions/api/glowscan.js` (Cloudflare Pages Function)
- 완전히 이 저장소 안에 있고, 사이트의 다른 페이지와 같은 방식(Cloudflare
  Pages)으로 배포됩니다. 더 이상 Claude Artifact나 별도 공유 링크에
  의존하지 않습니다.

### 꼭 필요한 설정 — Anthropic API 키

Cloudflare Pages 프로젝트 설정 → **Settings → Environment variables**에서
아래 값을 **Secret(암호화)** 로 등록해야 실제로 작동합니다. 이 키가 없으면
`glowscan.html`은 정상적으로 뜨지만 "분석하기"를 눌렀을 때 서버 설정
오류 메시지가 표시됩니다.

| 변수명 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ 필수 | [console.anthropic.com](https://console.anthropic.com)에서 발급. 유료(사용량 기반 과금) |
| `ANTHROPIC_MODEL_VISION` | 선택 | 사진 분석용 모델. 기본값 `claude-sonnet-5` |
| `ANTHROPIC_MODEL_TEXT` | 선택 | 선택형(설문) 분석용 모델. 기본값 `claude-haiku-4-5-20251001` |

Production과 Preview 환경 둘 다에 등록해야 프리뷰 배포에서도 테스트할 수
있습니다.

## 홈페이지 연동 지점

`quiz.html`의 설문 제출 완료 화면("제출해주셔서 감사합니다!" 화면) 하단에
GlowScan으로 연결되는 배너 + 버튼이 있습니다 (`GLOWSCAN_URL = "glowscan.html"`).

- `i18n/ko.json`, `i18n/es.json`, `i18n/en.json`
  - `quiz.finalStep.glowScanTitle` / `glowScanDesc` / `glowScanButton` — 퀴즈
    완료 화면의 배너 문구
  - `glowscan.*` — GlowScan 페이지 자체의 모든 UI 문구 (라벨, 버튼, 에러
    메시지, 피부톤/언더톤/얼굴형/피부고민 라벨 등)

GlowScan 페이지는 사이트 공통 `js/i18n.js`를 그대로 사용하므로, 다른
페이지에서 언어를 바꾸면(KO/ES/EN, `localStorage`의 `konecta_lang`) GlowScan도
같은 언어로 열립니다.

## 동작 방식

1. 사용자가 사진/짧은 동영상을 업로드하거나 (동영상은 자동으로 프레임 한 장을
   캡처), 또는 사진 없이 피부톤(스와치 8종) · 서브톤 · 얼굴형(아이콘 6종) ·
   피부 고민(최대 3개)을 직접 선택합니다. 둘 중 하나만 있어도 "분석하기"가
   활성화됩니다.
2. 브라우저에서 사진을 최대 1024px로 축소한 JPEG로 변환하고(용량/비용 절감),
   현재 화면 언어에 맞는 프롬프트 문자열과 함께 `POST /api/glowscan`으로
   전송합니다.
3. `functions/api/glowscan.js`가 Anthropic API(`/v1/messages`)를 서버에서
   직접 호출하고, 응답 텍스트에서 JSON만 뽑아 그대로 돌려줍니다. 프롬프트
   내용(문구, JSON 스키마 요구사항)은 전부 클라이언트(`glowscan.html`)에
   있고, 서버는 "그 프롬프트 그대로 Claude에 전달해서 결과를 돌려주는"
   역할만 합니다.
4. 사진이 있으면(`mode:"vision"`) 결과에 피부톤 HEX·언더톤·얼굴형까지 AI가
   직접 판단해서 돌려주고, 사진이 없으면(`mode:"quiz"`) 사용자가 고른
   톤/언더톤/얼굴형은 그대로 쓰고 루틴·팁만 AI가 생성합니다.

얼굴형(`oval/round/square/heart/long/diamond`)과 언더톤
(`cool/warm/neutral`)은 AI 응답에서 언어와 무관한 영어 코드로만 받고, 화면
표시는 현재 언어의 라벨 테이블에서 매핑합니다 — 언어를 바꿔도 매칭이
깨지지 않습니다.

## 보안/비용 관련 참고사항

- `/api/glowscan`은 별도 인증 없이 누구나 호출할 수 있는 공개 엔드포인트입니다
  (사이트 방문자가 로그인 없이 쓸 수 있어야 하므로). 모델/최대 토큰 수는
  서버에서 고정되어 있지만, 프롬프트 내용 자체는 클라이언트가 보내는 값을
  그대로 사용합니다.
- 악용(과도한 요청, 관련 없는 프롬프트 남용 등)을 막으려면 Cloudflare
  대시보드의 **Security → Rate limiting rules**에서 `/api/glowscan` 경로에
  대한 속도 제한 규칙을 추가하는 걸 권장합니다 (코드 배포와 무관하게 대시보드
  설정만으로 가능).
- 이미지 업로드는 base64 기준 약 3MB(원본 약 2MB대)로 서버에서 크기를
  제한합니다. 그 이상은 `image_too_large` 오류를 반환합니다.
- 업로드된 사진은 저장되지 않고, 분석 요청 한 번에만 쓰이고 버려집니다
  (로그/DB 없음).

## 디자인

Konecta 공식 브랜드 컬러(코랄 `#ED7B5D`, 네이비 `#2B3648` 등)와 사이트 공통
`css/style.css` 변수를 그대로 사용합니다. 헤더·푸터도 다른 페이지와 동일한
마크업을 재사용해서 사이트 안에서 이질감이 없습니다.

## 알려진 제한사항 / 다음에 할 일

- 위에서 언급한 **속도 제한(rate limiting) 대시보드 설정**은 아직 안 되어
  있습니다 — 실제 트래픽이 생기기 전에 설정 권장.
- 얼굴형 자동 판별(사진 모드)은 AI의 주관적 판단이라 100% 정확하지 않을 수
  있습니다.
- 지금은 분석 결과를 저장하거나 공유하는 기능이 없습니다 (한 번 보고 끝).
  필요해지면 캡처/공유 버튼이나 Notion 연동(퀴즈처럼 이메일 수집)을 추가할
  수 있습니다.
