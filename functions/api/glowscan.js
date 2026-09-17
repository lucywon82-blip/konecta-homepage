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

const SYSTEM_PROMPT =
  "You are a K-beauty skincare and makeup advisor. Always reply with valid JSON only — no markdown code fences, no extra commentary before or after the JSON.";

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
  if (!env.AI) {
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

  const messages = [{ role: "user", content: prompt }];

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
      result = await env.AI.run(TEXT_MODEL, { messages, max_tokens: 1200 });
    }

    // Workers AI 모델에 따라 { response: "..." } 형태이거나, OpenAI 호환
    // { choices: [{ message: { content: "..." } }] } 형태로 응답한다.
    let text = "";
    if (typeof result?.response === "string") {
      text = result.response;
    } else if (typeof result?.choices?.[0]?.message?.content === "string") {
      text = result.choices[0].message.content;
    }
    let parsed = extractJson(text);
    if (!parsed) {
      console.error("GlowScan: could not parse JSON from model reply:", text.slice(0, 500));
      // 502/504 등은 Cloudflare 엣지가 자체 오류 페이지로 본문을 덮어써서
      // 클라이언트가 우리 JSON을 못 받으므로, 여기서는 일반 5xx만 쓴다.
      return json(500, { error: "invalid_json" });
    }
    // 일부 모델이 { response: {...} } 처럼 한 번 더 감싸서 줄 때가 있어 풀어준다.
    if (parsed && !parsed.routine && !parsed.skinToneHex && parsed.response && typeof parsed.response === "object") {
      parsed = parsed.response;
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
