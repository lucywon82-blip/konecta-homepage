// Scheduled Netlify Function (see netlify.toml: functions."scheduled-blog-rebuild".schedule)
// Every hour, triggers a fresh site build so newly published Notion posts
// (checkbox "발행" = true) get pulled in by scripts/build_blog.py and deployed
// automatically — no manual git push needed.
//
// Requires a Netlify env var NETLIFY_BUILD_HOOK_URL pointing at a Build Hook
// created in Site settings → Build & deploy → Build hooks.

exports.handler = async () => {
  const hookUrl = process.env.NETLIFY_BUILD_HOOK_URL;

  if (!hookUrl) {
    console.error("NETLIFY_BUILD_HOOK_URL 환경변수가 설정되지 않았습니다. 빌드훅을 만들고 등록해주세요.");
    return { statusCode: 500, body: "NETLIFY_BUILD_HOOK_URL not set" };
  }

  try {
    const res = await fetch(hookUrl, { method: "POST" });
    console.log(`Build hook triggered: ${res.status}`);
    return { statusCode: 200, body: "triggered" };
  } catch (err) {
    console.error("Build hook 호출 실패:", err);
    return { statusCode: 500, body: "failed to trigger build hook" };
  }
};
