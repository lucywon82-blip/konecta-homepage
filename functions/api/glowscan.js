// 클라우드플레어 Pages Function: GlowScan(피부 진단) 페이지의 AI 분석 요청을
// 처리한다. Google Gemini API(무료 티어, 신용카드 불필요)를 서버에서
// 직접 호출한다.
//
// 필요한 환경변수(Cloudflare Pages 프로젝트 Settings → Variables and
// secrets에 Secret 타입으로 등록):
//   GEMINI_API_KEY - aistudio.google.com에서 발급한 API 키 (필수)

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Gemini가 일부 Cloudflare 서버 위치에서 "지역 미지원"으로 거절되므로,
// 실패하면 Cloudflare Workers AI(무료)로 영어 생성 후 화면 언어로 번역한다.
const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const TEXT_MODEL = "@cf/qwen/qwen3.8-27b";
const LANG_NAMES = { ko: "Korean", es: "Spanish" };

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

function extractText(result) {
  if (typeof result?.response === "string") return result.response;
  if (typeof result?.choices?.[0]?.message?.content === "string") return result.choices[0].message.content;
  return "";
}

async function translateFields(env, fields, langName) {
  const prompt =
    `Translate every string value in this JSON object to ${langName}. ` +
    "Keep the exact same JSON keys and array structure. Reply with ONLY the JSON object:\n" +
    JSON.stringify(fields);
  try {
    const r = await env.AI.run(TEXT_MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 2000 });
    return extractJson(extractText(r));
  } catch {
    return null;
  }
}

async function workersAiFallback(env, { mode, promptEn, imageBase64, type, lang }) {
  if (!env.AI || !promptEn) return null;
  let result;
  if (mode === "vision") {
    result = await env.AI.run(VISION_MODEL, {
      messages: [{ role: "user", content: [
        { type: "text", text: promptEn },
        { type: "image_url", image_url: { url: `data:${type};base64,${imageBase64}` } },
      ] }],
      max_tokens: 1200,
    });
  } else {
    result = await env.AI.run(TEXT_MODEL, { messages: [{ role: "user", content: promptEn }], max_tokens: 1200 });
  }
  let parsed = extractJson(extractText(result));
  if (parsed && !parsed.routine && !parsed.skinToneHex && parsed.response && typeof parsed.response === "object") {
    parsed = parsed.response;
  }
  const langName = LANG_NAMES[lang];
  if (parsed && langName) {
    const fields = mode === "vision"
      ? { skinToneLabel: parsed.skinToneLabel, concerns: parsed.concerns, routine: parsed.routine, tips: parsed.tips }
      : { routine: parsed.routine, tips: parsed.tips };
    const t = await translateFields(env, fields, langName);
    if (t) Object.assign(parsed, t);
  }
  return parsed;
}

export async function onRequestPost({ request, env }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey && !env.AI) {
    return json(500, { error: "server_config" });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json(400, { error: "bad_request" });
  }

  const { mode, prompt, imageBase64, mediaType, promptEn, lang } = data || {};
  if ((mode !== "vision" && mode !== "quiz") || typeof prompt !== "string" || !prompt.trim()) {
    return json(400, { error: "bad_request" });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return json(400, { error: "prompt_too_large" });
  }

  const parts = [{ text: prompt }];
  let imgType = "image/jpeg";

  if (mode === "vision") {
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return json(400, { error: "image_required" });
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
      return json(413, { error: "image_too_large" });
    }
    const type = ALLOWED_IMAGE_TYPES.includes(mediaType) ? mediaType : "image/jpeg";
    imgType = type;
    parts.push({ inline_data: { mime_type: type, data: imageBase64 } });
  }

  const fallback = async () => {
    try {
      const out = await workersAiFallback(env, { mode, promptEn, imageBase64, type: imgType, lang });
      if (out) return json(200, out);
    } catch (err) {
      console.error("Workers AI fallback error:", err);
    }
    return json(500, { error: "upstream_error" });
  };

  if (!apiKey) return fallback();

  try {
    const res = await fetch(`${GEMINI_API}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { maxOutputTokens: 2048, responseMimeType: "application/json" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini API error, using fallback:", res.status, errText.slice(0, 200));
      return fallback();
    }

    const result = await res.json();
    const text = result?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const parsed = extractJson(text);
    if (!parsed) {
      console.error("Gemini reply not parseable, using fallback");
      return fallback();
    }
    return json(200, parsed);
  } catch (err) {
    console.error("GlowScan Gemini error:", err);
    return fallback();
  }
}

export async function onRequestGet() {
  return new Response("Method Not Allowed", { status: 405 });
}
