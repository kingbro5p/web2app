// GET /api/status?id=build-xxxxx
// Looks up the GitHub Actions run triggered by this build and, once it
// finishes successfully, the GitHub Release that holds the built APK.

module.exports = async (req, res) => {
  const { GH_PAT, GH_OWNER, GH_REPO } = process.env;
  if (!GH_PAT || !GH_OWNER || !GH_REPO) {
    res.status(500).json({ error: "সার্ভার কনফিগার করা হয়নি (README দেখুন)।" });
    return;
  }

  const buildId = req.query?.id;
  if (!buildId || !/^build-\d+-[a-z0-9]+$/.test(buildId)) {
    res.status(400).json({ error: "buildId প্রয়োজন।" });
    return;
  }

  const startedAtMs = Number(buildId.split("-")[1]);
  const headers = {
    Authorization: `Bearer ${GH_PAT}`,
    Accept: "application/vnd.github+json",
  };

  try {
    // 1) Find the workflow run this build triggered.
    const runsRes = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/build-apk.yml/runs?event=repository_dispatch&per_page=10`,
      { headers }
    );
    if (!runsRes.ok) {
      res.status(502).json({ error: "GitHub Actions রান তথ্য পাওয়া যায়নি।" });
      return;
    }
    const runsData = await runsRes.json();
    const candidate = (runsData.workflow_runs || [])
      .filter((r) => new Date(r.created_at).getTime() >= startedAtMs - 15000)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

    if (!candidate) {
      res.status(200).json({ state: "queued", message: "বিল্ড শুরু হচ্ছে..." });
      return;
    }

    if (candidate.status !== "completed") {
      res.status(200).json({
        state: "building",
        message: "APK বিল্ড হচ্ছে (GitHub Actions চলছে)...",
        runUrl: candidate.html_url,
      });
      return;
    }

    if (candidate.conclusion !== "success") {
      res.status(200).json({
        state: "failed",
        message: "বিল্ড ব্যর্থ হয়েছে। বিস্তারিত লগের জন্য নিচের লিংক দেখুন।",
        runUrl: candidate.html_url,
      });
      return;
    }

    // 2) Build succeeded — find the release + APK asset.
    const releaseRes = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/tags/${buildId}`,
      { headers }
    );
    if (!releaseRes.ok) {
      res.status(200).json({
        state: "building",
        message: "বিল্ড শেষ, রিলিজ তৈরি হচ্ছে...",
        runUrl: candidate.html_url,
      });
      return;
    }
    const release = await releaseRes.json();
    const apkAsset = (release.assets || []).find((a) => a.name.endsWith(".apk"));

    if (!apkAsset) {
      res.status(200).json({
        state: "failed",
        message: "রিলিজে কোনো APK ফাইল পাওয়া যায়নি।",
        runUrl: candidate.html_url,
      });
      return;
    }

    res.status(200).json({
      state: "ready",
      message: "APK তৈরি সম্পন্ন!",
      downloadUrl: apkAsset.browser_download_url,
      runUrl: candidate.html_url,
    });
  } catch (err) {
    res.status(500).json({ error: "স্ট্যাটাস চেক করতে সমস্যা হয়েছে।", detail: String(err) });
  }
};
