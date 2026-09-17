// 클라우드플레어 Pages Function: GlowScan(피부 진단) 페이지의 AI 분석 요청을
// Konecta 자체 Anthropic API 키로 대신 호출해준다.
// 방문자가 Claude 계정이 있는지와 무관하게 항상 동작하도록, 클라이언트가
// 만든 프롬프트(+선택적으로 이미지)를 그대로 Anthropic API에 전달하고
// 응답 텍스트에서 JSON만 뽑아 돌려준다.
//
// 필요한 환경변수(클라우드플레어 Pages 프로젝트 설정 → Settings → Environment
// variables에서 등록, "암호화" 옵션으로 저장):
//   ANTHROPIC_API_KEY        - console.anthropic.com에서 발급한 API 키 (필수)
//   ANTHROPIC_MODEL_VISION   - 사진 분석용 모델 (선택, 기본값 claude-sonnet-5)
//   ANTHROPIC_MODEL_TEXT     - 설문(텍스트) 분석용 모델 (선택, 기본값 claude-haiku-4-5-20251001)

const ANTHROPIC_VERSION = "2023-06-01";
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
  const apiKey = env.ANTHROPIC_API_KEY;
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

  const content = [{ type: "text", text: prompt }];

  if (mode === "vision") {
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return json(400, { error: "image_required" });
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
      return json(413, { error: "image_too_large" });
    }
    const type = ALLOWED_IMAGE_TYPES.includes(mediaType) ? mediaType : "image/jpeg";
    content.unshift({
      type: "image",
      source: { type: "base64", media_type: type, data: imageBase64 },
    });
  }

  const model =
    mode === "vision"
      ? env.ANTHROPIC_MODEL_VISION || "claude-sonnet-5"
      : env.ANTHROPIC_MODEL_TEXT || "claude-haiku-4-5-20251001";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        messages: [{ role: "user", content }],
      }),
    });

    if (res.status === 429) {
      return json(429, { error: "rate_limited" });
    }
    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic API error:", res.status, errText);
      return json(502, { error: "upstream_error" });
    }

    const result = await res.json();
    const text = (result.content || []).map((block) => block.text || "").join("");
    const parsed = extractJson(text);
    if (!parsed) {
      console.error("GlowScan: could not parse JSON from model reply:", text.slice(0, 500));
      return json(502, { error: "invalid_json" });
    }

    return json(200, parsed);
  } catch (err) {
    console.error(err);
    return json(500, { error: "server_error" });
  }
}

export async function onRequestGet() {
  return new Response("Method Not Allowed", { status: 405 });
}
