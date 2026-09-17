// 클라우드플레어 Pages Function: GlowScan(피부 진단) 페이지의 AI 분석 요청을
// 처리한다. Google Gemini API(무료 티어, 신용카드 불필요)를 서버에서
// 직접 호출한다.
//
// 필요한 환경변수(Cloudflare Pages 프로젝트 Settings → Variables and
// secrets에 Secret 타입으로 등록):
//   GEMINI_API_KEY - aistudio.google.com에서 발급한 API 키 (필수)

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_PROMPT_CHARS = 4000;
const MAX_IMAGE_BASE64_CHARS = 4_000_000; // base64 기준 약 3MB 원본 이미지
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {}
  }
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }
  return null;
}

export async function onRequestPost({ request, env }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(500, { error: "server_config" });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json(400, { error: "bad_request" });
  }

  const { mode, prompt, imageBase64, mediaType } = data || {};
  if ((mode !== "vision" && mode !== "quiz") || typeof prompt !== "string" || !prompt.trim()) {
    return json(400, { error: "bad_request" });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return json(400, { error: "prompt_too_large" });
  }

  const parts = [{ text: prompt }];

  if (mode === "vision") {
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return json(400, { error: "image_required" });
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
      return json(413, { error: "image_too_large" });
    }
    const type = ALLOWED_IMAGE_TYPES.includes(mediaType) ? mediaType : "image/jpeg";
    parts.push({ inline_data: { mime_type: type, data: imageBase64 } });
  }

  try {
    const res = await fetch(`${GEMINI_API}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

    if (res.status === 429) {
      return json(429, { error: "rate_limited" });
    }
    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini API error:", res.status, errText.slice(0, 500));
      // 502/504는 Cloudflare 엣지가 본문을 자체 오류 페이지로 덮어써서
      // 클라이언트가 우리 JSON을 못 받으므로, 여기서는 일반 5xx만 쓴다.
      return json(500, { error: "upstream_error" });
    }

    const result = await res.json();
    const text = result?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const parsed = extractJson(text);
    if (!parsed) {
      console.error("GlowScan: could not parse JSON from Gemini reply:", text.slice(0, 500));
      return json(500, { error: "invalid_json" });
    }

    return json(200, parsed);
  } catch (err) {
    console.error("GlowScan Gemini error:", err);
    return json(500, { error: "server_error" });
  }
}

export async function onRequestGet() {
  return new Response("Method Not Allowed", { status: 405 });
}
