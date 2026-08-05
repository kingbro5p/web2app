// ---------- ambient phone mockup ----------
(function phoneLoop() {
  const urlEl = document.getElementById("phoneUrl");
  const iconEl = document.getElementById("phoneIcon");
  const letterEl = document.getElementById("phoneIconLetter");
  const captionEl = document.getElementById("phoneCaption");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!urlEl || reduceMotion) return;

  const sample = "yourbusiness.com";
  let cycle = 0;

  function run() {
    urlEl.textContent = sample;
    iconEl.classList.remove("is-ready");
    captionEl.textContent = "কম্পাইল হচ্ছে…";
    letterEl.textContent = sample[0].toUpperCase();

    setTimeout(() => {
      iconEl.classList.add("is-ready");
      captionEl.textContent = "APK প্রস্তুত ✓";
    }, 1400);

    cycle += 1;
    setTimeout(run, 3600);
  }
  run();
})();

// ---------- form + build flow ----------
const form = document.getElementById("buildForm");
const appNameInput = document.getElementById("appName");
const packageNameInput = document.getElementById("packageName");
const siteUrlInput = document.getElementById("siteUrl");
const themeColorInput = document.getElementById("themeColor");
const submitBtn = document.getElementById("submitBtn");
const formError = document.getElementById("formError");

const consoleWrap = document.getElementById("consoleWrap");
const led = document.getElementById("led");
const consoleMsg = document.getElementById("consoleMsg");
const runLink = document.getElementById("runLink");
const downloadBtn = document.getElementById("downloadBtn");
const stepEls = {
  queued: document.querySelector('[data-step="queued"]'),
  building: document.querySelector('[data-step="building"]'),
  ready: document.querySelector('[data-step="ready"]'),
};

let pollTimer = null;

// Auto-suggest a package name from the app name, e.g. "আমার দোকান" is
// non-latin so we fall back to a generic com.web2apk.appNNN pattern when
// nothing usable survives transliteration.
appNameInput.addEventListener("blur", () => {
  if (packageNameInput.value.trim()) return;
  const slug = appNameInput.value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 16);
  packageNameInput.value = slug
    ? `com.web2apk.${slug}`
    : `com.web2apk.app${Date.now().toString().slice(-5)}`;
});

function setStep(state) {
  Object.entries(stepEls).forEach(([key, el]) => {
    el.classList.remove("is-active", "is-done");
  });
  const order = ["queued", "building", "ready"];
  const idx = order.indexOf(state);
  order.forEach((key, i) => {
    if (i < idx) stepEls[key].classList.add("is-done");
    if (i === idx) stepEls[key].classList.add("is-active");
  });
}

function resetConsole() {
  led.className = "led";
  runLink.hidden = true;
  downloadBtn.hidden = true;
  consoleWrap.hidden = false;
  setStep("queued");
  consoleMsg.textContent = "রিকোয়েস্ট পাঠানো হচ্ছে…";
}

async function poll(buildId) {
  try {
    const res = await fetch(`/api/status?id=${encodeURIComponent(buildId)}`);
    const data = await res.json();

    if (data.runUrl) {
      runLink.href = data.runUrl;
      runLink.hidden = false;
    }

    if (data.state === "queued") {
      setStep("queued");
      consoleMsg.textContent = data.message || "সারিবদ্ধ হয়েছে…";
    } else if (data.state === "building") {
      setStep("building");
      consoleMsg.textContent = data.message || "বিল্ড চলছে…";
    } else if (data.state === "ready") {
      setStep("ready");
      led.classList.add("is-ready");
      consoleMsg.textContent = data.message || "প্রস্তুত!";
      downloadBtn.href = data.downloadUrl;
      downloadBtn.hidden = false;
      clearInterval(pollTimer);
      return;
    } else if (data.state === "failed") {
      led.classList.add("is-failed");
      consoleMsg.textContent = data.message || "বিল্ড ব্যর্থ হয়েছে।";
      clearInterval(pollTimer);
      return;
    } else if (data.error) {
      led.classList.add("is-failed");
      consoleMsg.textContent = data.error;
      clearInterval(pollTimer);
    }
  } catch (err) {
    consoleMsg.textContent = "স্ট্যাটাস চেক করতে সমস্যা হচ্ছে, পুনরায় চেষ্টা করা হচ্ছে…";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "শুরু হচ্ছে…";

  try {
    const res = await fetch("/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appName: appNameInput.value.trim(),
        packageName: packageNameInput.value.trim(),
        siteUrl: siteUrlInput.value.trim(),
        themeColor: themeColorInput.value,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      formError.textContent = data.error || "একটি সমস্যা হয়েছে।";
      return;
    }

    resetConsole();
    consoleWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    clearInterval(pollTimer);
    poll(data.buildId);
    pollTimer = setInterval(() => poll(data.buildId), 5000);
  } catch (err) {
    formError.textContent = "সার্ভারের সাথে সংযোগ করা যায়নি।";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "APK বিল্ড করুন";
  }
});
