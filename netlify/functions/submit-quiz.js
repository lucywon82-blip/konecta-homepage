// Netlify Function: receives the skin-diagnosis quiz submission from quiz.html
// and writes it into the Notion "Konecta 뷰티 진단 설문 응답" database.
// The Notion token stays server-side only (NOTION_TOKEN env var) — never sent to the browser.

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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const token = process.env.NOTION_TOKEN;
  const dataSourceId = process.env.NOTION_QUIZ_DATA_SOURCE_ID;
  if (!token || !dataSourceId) {
    return { statusCode: 500, body: JSON.stringify({ error: "서버 설정 오류입니다. 잠시 후 다시 시도해주세요." }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "잘못된 요청입니다." }) };
  }

  for (const field of REQUIRED) {
    if (!data[field] || String(data[field]).trim() === "") {
      return { statusCode: 400, body: JSON.stringify({ error: "필수 항목이 비어 있습니다." }) };
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
      return { statusCode: 502, body: JSON.stringify({ error: "저장 중 문제가 발생했습니다." }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "서버 오류가 발생했습니다." }) };
  }
};
