# Konecta 설문 → 노션 자동 동기화 워크플로우

"Konecta 뷰티 진단 설문 폼"에 새로 들어온 응답을 노션 DB(Konecta 뷰티 진단 설문 응답)에 자동으로 동기화하는 고정 워크플로우입니다. 매시간 자동 실행되어 고객이 설문을 제출하면 늦어도 1시간 이내에 노션에 반영됩니다. "설문 응답 동기화해줘" 같은 요청이나 이 목적의 정기 자동 실행 트리거에서 항상 이 스킬을 먼저 읽고 그대로 따르세요.

노션 원본: https://app.notion.com/p/3e36f13048af81459145ee78cd0c3790

## 절차
1. Artifact 도구를 action: "read_db"로 호출. 파라미터: url = "https://claude.ai/code/artifact/89a564e7-ea5d-456b-bdff-e81119096d38", db_op = "list", collection = "submissions", query.limit = 200.
2. 반환된 문서 중 data에 "syncedToNotion": true 가 없는 문서만 골라낸다(이미 동기화된 건 건너뜀).
3. 동기화 필요한 문서가 없으면 아무 것도 하지 않고 조용히 종료(알림 불필요).
4. 각 문서에 대해 mcp__Notion__notion-create-pages로 페이지 생성.
   - parent: {"type": "data_source_id", "data_source_id": "a35f683e-b60b-41af-867c-42f3ffdb1d3f"}
   - properties 매핑(문서 필드 → 노션 속성, 값은 문서 문자열 그대로 사용 — select 옵션과 이미 일치하도록 맞춰져 있음): name→이름(title) / contact→연락처 / country→거주 국가 / age→연령대 / contact_method→선호 연락 방법 / source→브랜드 인지 경로 / kbeauty_exp→한국 화장품 사용 경험 / skin_type→피부 타입 / routine→스킨케어 루틴 스타일 / budget→한 번 구매 예상 지출 / first_purchase→첫 구매 방식 선호 / routine_time→하루 스킨케어 소요 시간
   - "진행 상태": "신규 문의"로 설정. 값 없는 필드는 생략(빈 값 넣지 않음).
5. 페이지 생성 성공하면 Artifact 도구 action: "write_db", db_op: "update"로 해당 제출 문서를 동기화 완료 표시. 파라미터: url = 1번과 동일, collection = "submissions", doc_id = 해당 문서 id, data = {"syncedToNotion": true, "notionPageId": "<생성된 노션 페이지 id>"}.
6. 모든 처리 끝나면 이번 실행에서 새로 동기화한 건수만 한 줄로 알린다(예: "신규 응답 2건을 노션에 동기화했습니다"). 동기화할 응답이 없었으면 4~6단계 건너뛰고 조용히 종료.

## 연결된 스케줄 트리거
- trig_01Uvj3JAXGkTDyJnZ36Hx1uJ — "Konecta 설문 → 노션 자동 동기화", 매시간 44분 실행
