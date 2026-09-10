# 코넥타 업무 프로그램 (/app)

개인 일정, konecta.co.kr 예약, 매출(담당자 E 등)을 한 화면에서 보는 개인용 업무
프로그램. `konecta-homepage` 레포 안 `/app` 하위 폴더에 있다.

## 현재 상태 (2026-09-10 기준)

- **클라우드플레어 워커스에 배포 완료.** 실제 접속 주소:
  `https://konecta-app.konecta.workers.dev`
- 로컬 PC·모바일 브라우저에서 노션 데이터 연동까지 실제로 확인됨 (일정 표시,
  매출 대시보드 모두 정상).
- 코드는 PR [#6](https://github.com/lucywon82-blip/konecta-homepage/pull/6)로
  `main`에 이미 병합됨.
- **`konecta.co.kr/app`로 연결하는 넷리파이 리다이렉트(`netlify.toml`)는 코드에
  이미 있지만, 아직 실제 홈페이지에는 반영 안 됨.** 이유: 넷리파이 팀이
  "운영 크레딧" 상태라 새 배포(production deploy)가 막혀 있음. 결제 주기가
  9월 27일에 갱신되므로, 그날 이후에 app.netlify.com에서 "Trigger deploy"를
  한 번 눌러줘야 `konecta.co.kr/app`이 실제로 연결된다 (9/27 리마인더를 이미
  예약해둠 — 이 세션이 살아있으면 그날 먼저 알려줄 예정).
- 그때까지는 위 workers.dev 주소를 그대로 폰 홈 화면에 설치해서 쓰면 된다.

## 큰 그림

- **데이터는 전부 노션에 있음.** 이 프로그램은 자체 DB가 없다.
- **화면**은 순수 HTML/CSS/JS (`app/public/`) — 프레임워크·빌드 과정 없음.
- **노션 API 키는 클라우드플레어 워커 안에만 있고 화면 코드에는 절대 없음**
  (`app/src/worker.js`가 대신 노션에 요청해서 화면에 결과만 돌려줌).
- **PWA**: `manifest.json` + `sw.js`로 폰/PC에 앱처럼 설치 가능.
- **배포 대상**: 클라우드플레어 워커스 (Workers, `[assets]` 기능으로 정적 파일 +
  API를 워커 하나로 같이 서빙).

## 폴더 구조

```
app/
  wrangler.toml       # 클라우드플레어 설정 (정적 파일 폴더 + 워커 진입점)
  package.json        # wrangler CLI만 있음
  .dev.vars           # (gitignore됨) 로컬 테스트용 노션 시크릿 — 본인이 직접 생성
  src/
    worker.js         # API: /api/events, /api/sales, /api/reservations
  public/             # 정적 화면 (그대로 배포됨)
    index.html
    css/app.css
    js/app.js
    manifest.json
    sw.js
    icons/icon-192.png, icon-512.png   # 임시 아이콘(네이비 배경 + 코랄 K) — 실제 로고로 교체 권장
```

홈페이지 쪽(`/index.html`)에는 "1:1 피부 상담 예약" 폼(`#booking` 섹션)을
새로 추가했다. 제출하면 `/app/api/reservations`로 POST해서 노션 "예약" 표에
새 줄이 생긴다. ko/es/en 3개 언어 문구는 `i18n/*.json`의 `home.booking.*`에 있다.

## 노션 구조 (이미 생성 완료)

상위 페이지: [코넥타 업무 관리](https://app.notion.com/p/3d76f13048af81d49d49eca9dc59b711)

| 표 | 링크 | database_id (워커 코드에서 사용) |
|---|---|---|
| 개인 일정 | https://app.notion.com/p/668993c891f34611ae8c772b4753655d | `668993c891f34611ae8c772b4753655d` |
| 예약 | https://app.notion.com/p/ff32c93e4361455dae8ac660581a8f24 | `ff32c93e4361455dae8ac660581a8f24` |
| 매출 | https://app.notion.com/p/f2bb764de7d744779e0827253ea36388 | `f2bb764de7d744779e0827253ea36388` |

컬럼 구조는 각 표를 열어보면 바로 보임 (제목/종류/시작일시/종료일시/종일여부/
장소/메모/완료여부 — 개인일정 기준). 담당자 select 옵션은 지금 "E" 하나만
있음 — 직원이 늘면 노션에서 옵션만 추가하면 워커 코드 수정 없이 바로 반영됨.

## API (app/src/worker.js)

- `GET /api/events?start=YYYY-MM-DD&end=YYYY-MM-DD`
  → 개인 일정 + 예약을 합쳐서 `{ events: [...] }` 반환.
  각 이벤트: `{ id, source: 'personal'|'reservation', title, category, start, end, allDay, ... }`
- `GET /api/sales?start=&end=`
  → `{ rows: [...], total, totalByStaff: { E: 1234000, ... } }`
- `POST /api/reservations`
  → body `{ name, phone, datetime, service, memo }` → 노션 "예약" 표에 새 페이지 생성
  (상태=신청됨, 접수경로=홈페이지 고정)

## 로컬에서 실행하는 법 (사장님 컴퓨터에서, 터미널 필요)

⚠️ 이 부분은 지금 이 대화(클로드 코드 원격 세션)가 아니라, **사장님의 실제
컴퓨터**에서 해야 합니다. 이 세션은 보안 정책 때문에 `api.notion.com`으로
직접 나가는 요청이 막혀 있어서, 실제 노션 데이터를 불러오는 건 여기서는
확인할 수 없었습니다 (화면·워커 코드 자체는 정상 동작 확인 완료).

1. 노션 연동키 발급 + 3개 표에 연결 권한 주기 (이미 안내받은 절차 — 안 하셨다면 먼저 하기)
2. 터미널(맥이면 "터미널" 앱)을 열고:
   ```
   cd (레포를 내려받은 위치)/konecta-homepage/app
   npm install
   ```
3. `app` 폴더 안에 `.dev.vars`라는 새 파일을 만들고 아래처럼 한 줄만 적기
   (메모장이 아니라 반드시 `app` 폴더 바로 안, 확장자 없이 `.dev.vars`라는
   이름 그대로):
   ```
   NOTION_TOKEN=여기에_1단계에서_복사한_연동키_붙여넣기
   ```
4. 다시 터미널에서:
   ```
   npm run dev
   ```
5. 브라우저에서 `http://localhost:8787` 접속 → 캘린더/매출 화면이 실제
   노션 데이터로 뜨는지 확인. 안 뜨면 3번 파일의 키 값이나 2단계(연동
   공유)를 다시 확인.

## 아직 안 한 것 / 다음에 할 것

- [ ] 넷리파이 "Trigger deploy" (9/27 결제 주기 갱신 이후) → `konecta.co.kr/app`
      실제 연결 마무리. 배포되면 워커의 `public/js/app.js`가 상대경로
      (`api/events` 등)로 API를 호출하고, 넷리파이 `netlify.toml`의
      `/app/*` 리다이렉트가 `https://konecta-app.konecta.workers.dev`로
      그대로 전달해주는 구조라 코드 추가 수정은 필요 없음.
- [ ] 아이콘 임시본 → 실제 로고로 교체
- [ ] 지금은 로그인/비밀번호 없이 누구나 URL을 알면 볼 수 있음 — 필요하면
      간단한 암호 잠금(클라우드플레어 Access 등) 추가 검토
- [ ] 여러 날에 걸친 일정(예: 종일 2박 3일)은 시작일에만 표시됨 (단순화된 부분)
