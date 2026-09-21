// 클라우드플레어 Pages Function: 피부진단 퀴즈(quiz.html) 제출을 받아
// 노션 "Konecta 뷰티 진단 설문 응답" 데이터베이스에 기록한다.
// 노션 토큰은 서버(이 함수) 안에만 있고 브라우저로는 절대 전달되지 않는다.

const NOTION_VERSION = "2025-09-03";

const FIELD_MAP = {
  name: "이름",
  skinType: "피부 타입",
  routineStyle: "스킨케어 루틴 스타일",
  routineTime: "하루 스킨케어 소요 시간",
  kbeautyExperience: "한국 화장품 사용 경험",
  country: "거주 국가",
  ageGroup: "연령대",
  awarenessChannel: "브랜드 인지 경로",
  firstPurchasePref: "첫 구매 방식 선호",
  budget: "한 번 구매 예상 지출",
  contactMethod: "선호 연락 방법",
  contact: "연락처",
};

const REQUIRED = ["name", "contact", "contactMethod"];

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  const token = env.NOTION_TOKEN;
  const dataSourceId = env.NOTION_QUIZ_DATA_SOURCE_ID;
  if (!token || !dataSourceId) {
    return json(500, { error: "서버 설정 오류입니다. 잠시 후 다시 시도해주세요." });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json(400, { error: "잘못된 요청입니다." });
  }

  for (const field of REQUIRED) {
    if (!data[field] || String(data[field]).trim() === "") {
      return json(400, { error: "필수 항목이 비어 있습니다." });
    }
  }

  const properties = {};
  for (const [key, notionName] of Object.entries(FIELD_MAP)) {
    const value = data[key];
    if (!value) continue;
    if (key === "name") {
      properties[notionName] = { title: [{ text: { content: String(value).slice(0, 200) } }] };
    } else if (key === "contact") {
      properties[notionName] = { rich_text: [{ text: { content: String(value).slice(0, 200) } }] };
    } else {
      properties[notionName] = { select: { name: String(value).slice(0, 100) } };
    }
  }
  properties["진행 상태"] = { select: { name: "신규 문의" } };

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: dataSourceId },
        properties,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Notion API error:", errText);
      return json(502, { error: "저장 중 문제가 발생했습니다." });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error(err);
    return json(500, { error: "서버 오류가 발생했습니다." });
  }
}

export async function onRequestGet() {
  return new Response("Method Not Allowed", { status: 405 });
}
