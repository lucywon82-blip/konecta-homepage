// 클라우드플레어 Pages Function: GlowScan(피부 진단) 페이지의 AI 분석 요청을
// 처리한다. 비용이 드는 외부 API(Anthropic) 대신 Cloudflare Workers AI의
// 무료 티어(하루 10,000 뉴런)를 쓴다. 별도 API 키가 필요 없고, env.AI
// 바인딩만 있으면 동작한다 (Cloudflare 대시보드 Settings → Bindings에서
// "Workers AI" 바인딩을 변수명 AI로 등록해뒀다).

const MAX_PROMPT_CHARS = 4000;
const MAX_IMAGE_BASE64_CHARS = 4_000_000; // base64 기준 약 3MB 원본 이미지
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const TEXT_MODEL = "@cf/qwen/qwen3.8-27b";

// 무료 모델들이 한국어/스페인어로 직접 JSON 문장을 생성하면 반복되거나
// 빈 응답이 되는 경우가 많아서, 항상 영어로 생성한 뒤 이 표로 번역한다.
const LANG_NAMES = { ko: "Korean", es: "Spanish", en: "English" };

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

// Workers AI 모델마다 { response: "..." } 또는 OpenAI 호환
// { choices: [{ message: { content: "..." } }] } 형태로 응답해서 둘 다 처리한다.
function extractText(result) {
  if (typeof result?.response === "string") return result.response;
  if (typeof result?.choices?.[0]?.message?.content === "string") return result.choices[0].message.content;
  return "";
}

async function runTextModel(env, prompt) {
  const result = await env.AI.run(TEXT_MODEL, {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1200,
  });
  return extractJson(extractText(result));
}

// 영어로 생성된 결과의 문장 필드만 번역한다. hex코드/undertone/faceShape
// 같은 고정 영어 코드값은 건드리지 않는다.
async function translateFields(env, fields, langName) {
  const prompt =
    `Translate every string value in this JSON object to ${langName}. ` +
    "Keep the exact same JSON keys and array structure, do not add or remove keys. " +
    "Reply with ONLY the JSON object, no other text:\n" +
    JSON.stringify(fields);
  try {
    return await runTextModel(env, prompt);
  } catch {
    return null;
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) {
    return json(500, { error: "server_config" });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json(400, { error: "bad_request" });
  }

  const { mode, prompt, imageBase64, mediaType, lang } = data || {};
  if ((mode !== "vision" && mode !== "quiz") || typeof prompt !== "string" || !prompt.trim()) {
    return json(400, { error: "bad_request" });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return json(400, { error: "prompt_too_large" });
  }
  const langName = lang && lang !== "en" ? LANG_NAMES[lang] : null; // null이면 영어 그대로 반환

  try {
    let result;

    if (mode === "vision") {
      if (!imageBase64 || typeof imageBase64 !== "string") {
        return json(400, { error: "image_required" });
      }
      if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
        return json(413, { error: "image_too_large" });
      }
      const type = ALLOWED_IMAGE_TYPES.includes(mediaType) ? mediaType : "image/jpeg";
      const visionMessages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${type};base64,${imageBase64}` } },
          ],
        },
      ];
      result = await env.AI.run(VISION_MODEL, { messages: visionMessages, max_tokens: 1200 });
    } else {
      result = await env.AI.run(TEXT_MODEL, { messages: [{ role: "user", content: prompt }], max_tokens: 1200 });
    }

    let parsed = extractJson(extractText(result));
    if (!parsed) {
      console.error("GlowScan: could not parse JSON from model reply.");
      // 502/504 등은 Cloudflare 엣지가 자체 오류 페이지로 본문을 덮어써서
      // 클라이언트가 우리 JSON을 못 받으므로, 여기서는 일반 5xx만 쓴다.
      return json(500, { error: "invalid_json" });
    }
    // 일부 모델이 { response: {...} } 처럼 한 번 더 감싸서 줄 때가 있어 풀어준다.
    if (parsed && !parsed.routine && !parsed.skinToneHex && parsed.response && typeof parsed.response === "object") {
      parsed = parsed.response;
    }

    // 여기까지는 항상 영어로 생성된 결과. 화면 언어가 영어가 아니면
    // 문장 필드만 번역한다(hex코드·undertone·faceShape 코드는 그대로 유지).
    if (langName) {
      const translatable =
        mode === "vision"
          ? { skinToneLabel: parsed.skinToneLabel, concerns: parsed.concerns, routine: parsed.routine, tips: parsed.tips }
          : { routine: parsed.routine, tips: parsed.tips };
      const translated = await translateFields(env, translatable, langName);
      if (translated) {
        Object.assign(parsed, translated);
      } else {
        console.error("GlowScan: translation to", langName, "failed, returning English fallback.");
      }
    }

    return json(200, parsed);
  } catch (err) {
    console.error("GlowScan Workers AI error:", err);
    return json(500, { error: "server_error" });
  }
}

export async function onRequestGet() {
  return new Response("Method Not Allowed", { status: 405 });
}
