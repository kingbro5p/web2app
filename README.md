# web2apk

ওয়েবসাইট URL দিলে সত্যিকারের **Android APK** বিল্ড করে দেয় এমন একটি টুল।
ফ্রন্টএন্ড হোস্ট হয় **Vercel**-এ, আর আসল APK বিল্ড হয় **GitHub Actions**-এ
(Cordova ব্যবহার করে) — তাই এটি ভুয়া/মকআপ নয়, সত্যিকারের বিল্ড পাইপলাইন।

## কীভাবে কাজ করে

1. ব্যবহারকারী ফর্মে অ্যাপের নাম, প্যাকেজ নাম, ওয়েবসাইট URL দেয়।
2. Vercel-এর `/api/build` ফাংশন GitHub-এ একটি `repository_dispatch`
   ইভেন্ট পাঠায়।
3. `.github/workflows/build-apk.yml` ওয়ার্কফ্লো চালু হয়ে Cordova দিয়ে
   Android প্রজেক্ট তৈরি করে, ওয়েবসাইট URL-কে WebView-এর কনটেন্ট হিসেবে
   সেট করে, এবং APK বিল্ড করে।
4. বিল্ড শেষে APK একটি GitHub Release-এ আপলোড হয়।
5. Vercel-এর `/api/status` ফাংশন পোল করে বিল্ডের অবস্থা জানায় এবং
   শেষে ডাউনলোড লিংক দেয়।

## ধাপে ধাপে সেটআপ

### ১. GitHub-এ পুশ করুন

```bash
git init
git add .
git commit -m "web2apk"
git branch -M main
git remote add origin https://github.com/<আপনার-ইউজারনেম>/<রিপো-নাম>.git
git push -u origin main
```

### ২. GitHub Personal Access Token তৈরি করুন

GitHub → Settings → Developer settings → Personal access tokens →
Fine-grained tokens → **Generate new token**

- Repository access: শুধু আপনার এই রিপো নির্বাচন করুন
- Permissions:
  - **Contents**: Read and write
  - **Actions**: Read and write

টোকেনটি কপি করে রাখুন — এটিই `GH_PAT`।

### ৩. Vercel-এ ডিপ্লয় করুন

- [vercel.com](https://vercel.com)-এ গিয়ে GitHub রিপোটি ইমপোর্ট করুন।
- Project Settings → Environment Variables-এ যোগ করুন:

| Name       | Value                          |
|------------|--------------------------------|
| `GH_PAT`   | ধাপ ২-এ তৈরি করা টোকেন          |
| `GH_OWNER` | আপনার GitHub ইউজারনেম          |
| `GH_REPO`  | রিপোজিটরির নাম                  |

- Redeploy করুন যাতে এনভায়রনমেন্ট ভ্যারিয়েবলগুলো কার্যকর হয়।

### ৪. টেস্ট করুন

সাইটে গিয়ে একটি ওয়েবসাইট URL দিয়ে "APK বিল্ড করুন" চাপুন। GitHub রিপোর
**Actions** ট্যাবে গিয়ে বিল্ড চলতে দেখতে পাবেন। সফল হলে **Releases**
সেকশনে APK পাওয়া যাবে, এবং সাইটেও ডাউনলোড বাটন চলে আসবে।

## গুরুত্বপূর্ণ সীমাবদ্ধতা

- তৈরি APK একটি **unsigned debug বিল্ড** — সাইডলোড/টেস্টিংয়ের জন্য ঠিক
  আছে, কিন্তু Play Store-এ দিতে হলে নিজের রিলিজ কী দিয়ে সাইন করে নিতে হবে।
- অনেক ওয়েবসাইটে থাকা ফিচার (push notification, ফাইল আপলোড ইত্যাদি)
  একটি সাধারণ WebView-তে সরাসরি কাজ নাও করতে পারে — সেক্ষেত্রে Cordova
  প্লাগইন যোগ করা লাগতে পারে।
- Android বিল্ড টুলচেইন মাঝে মাঝে আপডেট হয়; ওয়ার্কফ্লো ফেইল করলে
  Actions লগ দেখে Gradle/Android SDK ভার্সন সমস্যা ঠিক করতে হতে পারে।
- অ্যাপ আইকন/স্প্ল্যাশ স্ক্রিন কাস্টমাইজেশন এখনো যোগ করা হয়নি — এটি
  ভবিষ্যতে যোগ করার একটি ভালো জায়গা (`config.xml`-এ `<icon>`/`<splash>`)।

## প্রজেক্ট স্ট্রাকচার

```
web2apk/
├── public/              ← স্ট্যাটিক ফ্রন্টএন্ড (Vercel সরাসরি সার্ভ করে)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── api/                 ← Vercel সার্ভারলেস ফাংশন
│   ├── build.js         ← বিল্ড ট্রিগার করে
│   └── status.js        ← বিল্ডের অবস্থা চেক করে
├── .github/workflows/
│   └── build-apk.yml    ← আসল Cordova/APK বিল্ড
├── vercel.json
├── package.json
└── .env.example
```
