# Konecta 일일 릴스대본 + 카드뉴스 제작 워크플로우

매일 아침 Konecta(K뷰티 남미 수출 브랜드, 구 Noriter Beauty Center)의 "K뷰티 남미 도전기" 콘텐츠(릴스 대본 1개 + 인스타 캡션 한/스/영 3버전 + 카드뉴스 스페인어 5장)를 만들어 노션에 정리하고 채팅으로 전달하는 고정 워크플로우입니다. "오늘자 릴스/카드뉴스 만들어줘", "K뷰티 남미도전기 콘텐츠" 관련 요청이나 이 목적의 일일 자동 실행 트리거에서 항상 이 스킬을 먼저 읽고 그대로 따르세요.

노션 원본: https://app.notion.com/p/3e36f13048af81608ae3fff096b9a092

## 0. 오늘 날짜 확정 (가장 먼저, 매번)
이 루틴은 한국시간(KST) 기준으로 "오늘"을 판단합니다. 세션이 기본 표시하는 날짜는 UTC 기준이라 실제 KST보다 하루 이전일 수 있으므로 절대 그대로 믿지 말고, Bash로 `TZ=Asia/Seoul date +%Y-%m-%d` 를 실행해 나온 값을 이후 모든 "오늘 날짜"로 확정해서 사용하세요.

## 1. 브랜드 사실관계 확인
`mcp__memory__memory_read` 로 `/areas/noriter-beauty.md` 를 읽으세요 (브랜드명 Konecta=Korea+Conecta, 타겟 페루·칠레, 기획 단계, 테스트키트 우선검증 후 단건판매, 예산 50만원 이하, 동대문 소량사입+무재고위탁 병행 등). 이 파일에 없는 구체적 매출·방문자 수 등은 절대 지어내지 마세요 — 릴스/카드뉴스/캡션 모두 동일 원칙.

## 2. 오늘의 주제 결정
Notion 블로그 콘텐츠 캘린더 데이터소스 `collection://b7b82e4e-33ea-41f1-8ffc-19b4265c1a8e` 에서 발행일이 [0]에서 확정한 오늘 날짜(KST)인 행을 SQL로 조회하세요 (상태 무관, 발행일만 기준). 그 행의 "필라" 값도 함께 확인해두세요 (3단계 스타일 분기에 사용).
- **찾았으면**: 제목·필라·핵심메시지를 오늘의 릴스/카드뉴스 주제로 그대로 사용 (블로그와 통일).
- **못 찾았으면**: 블로그 글은 새로 쓰지 말고, 아래 소재 목록에서 최근에 안 쓴 각도를 골라 스스로 정합니다. 이 경우 필라는 "창업일기"로 간주.
  - 소재 목록: ①동대문 소싱 여정 ②브랜드 네이밍(Konecta) 비하인드 ③50만원 예산으로 시작하는 이유 ④현지(페루·칠레) 피부 리서치 과정 ⑤배송·물류 파트너 찾기 ⑥테스트키트 검증 전략 ⑦오늘까지의 시행착오/솔직한 고민 ⑧남미 K뷰티 시장에 대한 생각
  - 최근 사용 각도 확인: notion-fetch로 "SNS 콘텐츠 아카이브" 페이지(https://app.notion.com/p/3d26f13048af81838795f9ba0d36adf2)의 하위 페이지 제목을 보고 최근 5개와 안 겹치는 각도를 고르세요.
  - 이 경우 사실이 필요한 부분은 1단계 메모리 범위 안에서만 쓰고, 확인 안 되는 수치·진행상황은 "~할 예정입니다" 같은 계획형 문장으로 처리하세요.

## 3. 릴스 대본 작성 (1개)
오늘 주제의 필라가 **"제품소개"**(마스크팩 등 구체 제품)면 GRWM 스타일, **그 외**(남미진출/브랜드소개/창업일기/시장정보)면 오매생이 병맛 스타일. 두 스타일 모두 얼굴·몸 노출 절대 금지 (사용자가 카메라 등장을 원치 않음).
공통: 표 형식(구간(초)/화면(Visual)/자막·사운드/소품·비고)으로 작성하고 훅 카피 A/B 두 가지를 제안하세요. 눈알 스티커는 쓰지 않습니다(반응 저조로 폐기) — 대신 편집 단계에서 소품/마네킹 위에 큰 리액션 이모지(😭😤🤔✨ 등, 오늘 감정에 맞게 매번 다르게)를 얹는다고 명시하세요.

### GRWM 스타일 (필라="제품소개")
2026년 유행하는 GRWM(Get Ready With Me) 포맷을 얼굴 노출 없이 구현: 저렴한 뷰티 연습용 마네킹 헤드를 "캐릭터"로 세우고, 손으로 오늘 제품을 마네킹에 실제 적용하는 과정을 촬영. 내레이션은 사용자 본인 목소리로 친한 친구에게 고백하듯 편안한 톤 권장하되, 부담스러우면 자막(말풍선) 대체 가능하다고 안내.
- 0~3초: 마네킹 헤드 클로즈업 + 손이 포장 뜯는 장면. 훅 카피(자막)
- 3~15초: 손이 제품을 마네킹에 적용. 내레이션/자막으로 짧은 일상 언급(친밀한 톤) + 오늘 주제의 실제 정보(1·2단계에서 확인한 것만)를 자연스럽게 녹이기
- 15~25초: 사용 후 마네킹 클로즈업, 유행 표현(예: "글로우")으로 자막
- 25~30초: 고정 카드 (@konecta.co.kr, 팔로우 유도)
그 주 유행 트렌드 오디오를 쓰도록 안내(곡 지정 없이 "그 주 유행 챌린지/트렌드 오디오 아무거나"). 대본 끝에 준비물 체크리스트(마네킹 헤드, 오늘 제품, 트렌드 오디오 등) 포함 — 리액션 이모지는 촬영 후 편집 단계 추가물이므로 준비물에 넣지 않습니다.

### 오매생이 병맛 스타일 (그 외 필라)
얼굴 노출 절대 금지. 오늘 주제와 어울리는 소품(화장품 용기/지구본/택배박스/여권/서류/동전/도장 등) 하나를 골라 의인화 — 최근 며칠 쓴 소품과 겹치지 않게 다양화(아카이브에서 최근 3일치 확인 권장).
- 0~2초: 소품 클로즈업, 손으로 살짝 까닥까닥 + 편집 단계 리액션 이모지 얹기. 그 주 유행 릴스 챌린지 음원(곡 지정 없이)
- 2~6초: 오늘 주제 관련 하소연/걱정 자막 (병맛 톤)
- 6~7초: 화면 뚝 끊기는 전환(스와이프 효과), 음원 정지
- 7~9초: 정색 자막 ("그래서 준비했습니다" 류)
- 9~16초: 오늘 주제의 실제 정보 2~3줄 자막 (사실 기반, 1·2단계 확인분만)
- 16~20초: 소품이 다시 인사하듯 병맛 엔딩
- 20~22초: 고정 카드 (@konecta.co.kr, 팔로우 유도)

## 4. 인스타그램 캡션 (한/스/영 3버전)
오늘 릴스를 인스타에 올릴 때 바로 붙여넣을 캡션(설명글 2~4줄 + 해시태그 5~10개)을 한국어/스페인어/영어로 각각 작성. 세 버전은 같은 내용을 옮긴 것이면 충분(언어별로 새 메시지 만들 필요 없음). 확인 안 되는 수치는 넣지 말고 1·2단계 확인분만 사용. 자연스러운 현지어로(특히 스페인어는 직역투 금지, 원어민이 쓸 법한 표현으로). 릴스 대본 md 파일에 별도 섹션으로, 노션 페이지에도 텍스트로 포함(코드블록/구분선으로 언어별 명확히 구분).

## 5. 카드뉴스 5장 제작 (스페인어 고정)
한국어 카드뉴스는 만들지 않습니다. 색상·폰트·레이아웃(브랜드 템플릿 구조)은 절대 바꾸지 마세요. `mkdir -p /home/claude/daily_card` 후 아래 HTML 템플릿을 5장 모두 동일하게 쓰고 `{{...}}` 부분만 카드별 스페인어 내용으로 채워 `card_es_01.html`~`card_es_05.html` 로 저장:

```html
<!doctype html>
<html lang="es"><head><meta charset="UTF-8">
<style>
  @font-face { font-family:'Pretendard'; src:url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/variable/PretendardVariable.woff2') format('woff2-variations'); font-weight:45 920; }
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Pretendard',-apple-system,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;}
  body{background:#eee;}
  .card{width:1080px;height:1350px;position:relative;background:#F7F8FA;padding:100px 64px 0 64px;display:flex;flex-direction:column;}
  .badge{display:inline-flex;align-items:center;padding:14px 32px;border-radius:999px;background:#FCEEE8;color:#D9633F;font-size:28px;font-weight:700;letter-spacing:-0.5px;width:fit-content;}
  .date-tag{position:absolute;top:64px;right:64px;font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:600;color:#B8BFCB;letter-spacing:1px;}
  .headline{color:#2B3648;font-size:78px;font-weight:800;line-height:1.28;letter-spacing:-1.5px;white-space:pre-line;margin-top:48px;}
  .headline .accent{color:#ED7B5D;}
  .body-text{font-size:34px;line-height:1.65;font-weight:500;letter-spacing:-0.3px;color:#5B6472;margin-top:44px;white-space:pre-line;}
  .quote-box{margin-top:auto;margin-bottom:110px;background:#FFFFFF;border:2px solid #E4E7EC;border-radius:24px;padding:26px 32px;}
  .quote-box .q{font-size:30px;font-weight:700;color:#2B3648;line-height:1.4;}
  .quote-box .q .mark{color:#ED7B5D;}
  .footer{position:absolute;bottom:56px;left:64px;right:64px;display:flex;justify-content:space-between;align-items:center;font-size:26px;font-weight:700;color:#5B6472;letter-spacing:-0.3px;}
</style></head>
<body>
<div class="card" id="card">
  <span class="badge">{{BADGE_TEXT}}</span>
  <div class="date-tag">{{DATE_TAG}}</div>
  <div class="headline">{{HEADLINE_LINE1}}<br><span class="accent">{{HEADLINE_ACCENT}}</span>{{HEADLINE_LINE2}}</div>
  <div class="body-text">{{BODY_TEXT}}</div>
  <div class="quote-box"><div class="q"><span class="mark">"</span>{{QUOTE}}<span class="mark">"</span></div></div>
  <div class="footer"><span>K-BEAUTY LATAM</span><span>@konecta.co.kr</span></div>
</div>
</body></html>
```

채우기 규칙 (모두 스페인어, 기계번역투 지양):
- BADGE_TEXT: 오늘 주제의 짧은 카테고리명(스페인어)
- DATE_TAG: "2026.09.05" 형식 (0단계 KST 오늘 날짜 기준)
- HEADLINE_LINE1/ACCENT/LINE2: 헤드라인을 의미 단위 3부분으로 쪼개고 강조 단어를 ACCENT에 (총 2줄 이내)
- BODY_TEXT: 2~4줄, 담백한 문장(\n으로 줄바꿈, 자동줄바꿈 안 될 만큼 짧게)
- QUOTE: 카드 메시지를 한 줄로 압축한 인용구

5장 스토리 흐름(기본 틀, 매번 자연스럽게 구성): 1번 훅 헤드라인(문제제기) → 2번 배경 설명 → 3번 사실 기반 정보1(지어내지 않음) → 4번 사실 기반 정보2 또는 압축 인용구 → 5번 CTA("K-BEAUTY LATAM, síguenos @konecta.co.kr" 류).

PNG 렌더링 (5번 반복, 파일명만 변경):
```python
from playwright.sync_api import sync_playwright
import pathlib
html_path = pathlib.Path("/home/claude/daily_card/card_es_01.html").resolve()
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width":1200,"height":1400}, device_scale_factor=2)
    page.goto(f"file://{html_path}")
    page.wait_for_timeout(500)
    page.locator("#card").screenshot(path="/home/claude/daily_card/card_es_01.png")
    browser.close()
```
생성 후 Read로 5장 모두 확인해 텍스트 잘림/겹침 없는지 검수하고, 문제 있으면 BODY_TEXT 길이를 줄여 재생성하세요.

## 6. Notion에 정리
**네트워크 제약**: 이 클라우드 환경은 api.notion.com으로의 직접 바이너리 파일 업로드(`notion-create-file-upload`가 반환하는 upload_url에 PNG를 curl 등으로 POST)를 네트워크 정책으로 차단합니다. 이 방법은 시도하지 말고(재시도 금지), 아래 SVG 우회 방식을 쓰세요 — 실제로 성공하는 방식입니다.

1. 5개의 card_es_0N.html과 완전히 동일한 배지/헤드라인(2줄, 강조 단어 코랄 #ED7B5D)/본문/인용구/푸터 내용을 카드마다 SVG(`<svg width="1080" height="1350">...`)로 다시 그리세요(총 5개). 배경 #F7F8FA, 헤드라인 네이비 #2B3648 굵게, 본문 회색 #5B6472, 인용구 박스 흰배경+회색테두리, `font-family="'Pretendard','Malgun Gothic','Apple SD Gothic Neo',sans-serif"`(임베드 불필요, 폴백 폰트로 충분). 긴 텍스트는 `<tspan x="64" dy="56">` 로 줄바꿈.
   - **인용구 박스는 절대 크게 만들지 말 것** — 텍스트 한 줄에 딱 맞게 타이트하게. 기준값: y≈1140 부근 시작, `rect height="108"`(1~2줄 기준, `rx="24"`), 텍스트는 rect 시작 y+66 위치, `font-size="30"`. height 190 이상으로 만들지 마세요.
   - 스페인어 특수문자(á é í ó ú ñ ¿ ¡)나 한글을 유니코드 이스케이프(\uXXXX)로 손으로 변환하지 말고, 도구 파라미터에 리터럴 UTF-8 문자로 그대로 입력하세요(수동 변환 시 글자 깨짐 사고 있었음).
2. `mcp__Notion__notion-create-attachment` 를 filename "card_es_01.svg"~"card_es_05.svg", content_type "image/svg+xml", content=SVG 텍스트 전체 로 5번 호출하세요(source_file_id가 아니라 content 파라미터 — 텍스트라 API 콜 안에서 바로 전송되어 네트워크 차단 영향 없음). 각 결과의 markdown_source(`<image src="file-upload://...">`)를 순서대로 기억하세요.
   - (선택) 검증하려면 같은 SVG를 로컬 저장 후 Playwright 스크린샷 → Read로 확인, 문제 있으면 텍스트를 줄여 재생성.

`mcp__Notion__notion-create-pages` 로 새 페이지 생성. parent: `{"type":"page_id","page_id":"3d26f130-48af-8183-8795-f9ba0d36adf2"}` (SNS 콘텐츠 아카이브).
- title: "YYYY-MM-DD · <오늘 주제 제목>" (YYYY-MM-DD는 0단계 KST 날짜, 제목은 한국어). 한글/스페인어/영어 모두 유니코드 이스케이프 없이 리터럴로 입력.
- content 순서: 1) 5장 SVG markdown_source를 순서대로 나열 2) 릴스 대본 전체(표 포함) 3) "## 인스타그램 캡션" 섹션에 ### 한국어 / ### Español / ### English 소제목으로 3버전 텍스트
- 생성 직후 notion-fetch로 재조회해 제목/본문(3개 언어 모두)에 깨진 글자 없는지 확인. 있으면 notion-update-page(update_properties/replace_content)로 즉시 수정.

## 7. 채팅으로 파일 전달
- 릴스 대본+3개 언어 캡션을 합쳐 "릴스대본_YYYY-MM-DD.md" 로 저장 후 SendUserFile (YYYY-MM-DD는 KST 오늘 날짜). 캡션은 한/스/영 소제목으로 명확히 구분.
- card_es_01.png~05.png 를 각각 "카드뉴스_ES_YYYY-MM-DD_01.png"~"05.png" 로 이름 바꿔 SendUserFile 한 번의 호출에 5개 배열로 전달.

## 8. 최종 보고 (짧게, 이 형식만)
```
오늘 주제: <제목> (출처: 블로그 캘린더 / 자체 선정)
오늘 릴스 스타일: <GRWM(마네킹 헤드) / 오매생이 병맛>
노션 링크: <6단계에서 만든 페이지 URL>
```

## 항상 지키는 것
- 확인 안 되는 사실(수치/진행상황/고객반응 등)은 절대 지어내지 않는다 — 릴스·카드뉴스·캡션 모두 동일.
- 브랜드 컬러(#2B3648 네이비, #ED7B5D 코랄)·Pretendard 폰트·HTML 템플릿 구조를 임의로 바꾸지 않는다.
- 얼굴/몸 노출 연출 절대 금지 (GRWM도 마네킹 헤드로 대체, 사용자 실물 등장 안 함).
- 카드뉴스는 스페인어 5장 고정 (한국어 카드뉴스 없음).
- 인스타 캡션은 한/스/영 3버전 모두 만들어 릴스 파일과 노션 페이지에 텍스트로 포함.
- 릴스 대본은 필라="제품소개"면 GRWM, 그 외는 오매생이 병맛.
- 눈알 스티커는 쓰지 않는다 — 편집 단계 리액션 이모지(😭😤🤔✨ 등, 매번 다르게)로 표정 표현.
- "오늘 날짜"는 항상 0단계에서 확인한 KST 기준 — 세션 기본 날짜 표시를 믿지 않는다.

## 연결된 스케줄 트리거
- trig_01LxBsWQ21yD1ZNtQKNiP8VD — "K뷰티 남미도전기 릴스+카드뉴스 자동 생성", 매일 06:10 KST 실행
