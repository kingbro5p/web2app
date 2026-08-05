// POST /api/build
// Body: { appName, packageName, siteUrl, themeColor }
// Triggers a GitHub Actions workflow (repository_dispatch) that builds an
// Android APK wrapping the given website URL, then returns a buildId the
// client can poll via /api/status.

function isValidPackageName(name) {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(name);
}

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "শুধুমাত্র POST মেথড সমর্থিত।" });
    return;
  }

  const { GH_PAT, GH_OWNER, GH_REPO } = process.env;
  if (!GH_PAT || !GH_OWNER || !GH_REPO) {
    res.status(500).json({
      error:
        "সার্ভার কনফিগার করা হয়নি। Vercel প্রজেক্টে GH_PAT, GH_OWNER ও GH_REPO এনভায়রনমেন্ট ভ্যারিয়েবল সেট করুন (README দেখুন)।",
    });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const { appName, packageName, siteUrl, themeColor } = body || {};

  if (!appName || !appName.trim()) {
    res.status(400).json({ error: "অ্যাপের নাম দিন।" });
    return;
  }
  if (!isValidPackageName(packageName || "")) {
    res.status(400).json({
      error: "প্যাকেজ নাম সঠিক ফরম্যাটে দিন, যেমন: com.example.myapp",
    });
    return;
  }
  if (!isValidUrl(siteUrl || "")) {
    res.status(400).json({ error: "সঠিক একটি ওয়েবসাইট URL দিন (https:// সহ)।" });
    return;
  }

  const buildId = `build-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const dispatchRes = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GH_PAT}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "build-apk",
        client_payload: {
          appName: appName.trim(),
          packageName: packageName.trim(),
          siteUrl: siteUrl.trim(),
          themeColor: themeColor || "#00c896",
          buildId,
        },
      }),
    }
  );

  if (!dispatchRes.ok) {
    const text = await dispatchRes.text();
    res.status(502).json({
      error: "GitHub Actions বিল্ড শুরু করা যায়নি। GH_PAT টোকেন ও রিপো নাম যাচাই করুন।",
      detail: text,
    });
    return;
  }

  res.status(200).json({ buildId });
};
