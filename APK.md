# تطبيق APK — التحميل والبناء التلقائي 📱

## 🔗 حمّل APK جاهزاً (الأسهل)
من صفحة الإصدارات:
**https://github.com/mazen7575750-create/ai-company-render/releases**

- يُبنى **تلقائياً** على GitHub Actions عند كل تعديل مهم في التطبيق.
- ثبّته مرة واحدة فقط — بعدها كل تحديثات التطبيق تصل جهازه **تلقائياً عند الفتح** (بوجود إنترنت).

> ملاحظة: نفس توقيع الـ APK (`keystore.p12`) يُستخدم في كل البناءات،
> لذلك التحديثات تُثبَّت فوق القديمة بدون حذف التطبيق.

## الفكرة
الـ APK مجرد "نافذة" تفتح رابط التطبيق المباشر على GitHub Pages:

**https://mazen7575750-create.github.io/ai-company-render/mohfaz.html**

أي تحديث ترفعه للمستودع يظهر لجميع المستخدمين فورًا — بدون إعادة إرسال أي رابط.

## البناء التلقائي (معمل تلقائي GitHub Actions)
سير العمل `.github/workflows/build-apk.yml` يعمل عند:
- كل دمج في `main` يغيّر `mohfaz.html` أو ملفات أندرويد، أو
- تشغيل يدوي من تبويب **Actions → Build APK → Run workflow**

النتيجة: إصدار (Release) بنفس رقم `APP_VERSION` يحتوي ملف
`moallem-<الإصدار>.apk` جاهز للتحميل.

## بناء APK على جهازك (اختياري — لو أردت)
المتطلبات: [Node.js](https://nodejs.org) + [Android Studio](https://developer.android.com/studio) (مجاني)

```bash
git clone https://github.com/mazen7575750-create/ai-company-render.git
cd ai-company-render
npm ci
mkdir -p www && cp mohfaz.html www/
npx cap sync android
npx cap open android     # ثم في Android Studio: Build → Build APK(s)
```

الملف الناتج: `android/app/build/outputs/apk/release/app-release.apk`

## بعد البناء — كيف تحدّث التطبيق للمستخدمين (خطوتان)

1. عدّل `mohfaz.html` وارفعه على `main`.
2. حدّث الرقم في **مكانين بنفس القيمة**:
   - `mohfaz.html` → `const APP_VERSION = "..."`
   - `version.json` → حقل `"version"`
   ثم ارفع الملفين. **ينتهي الأمر** — الأجهزة تتحدث تلقائيًا عند الفتح،
   وزر 🔄 داخل التطبيق يعرض التحديث يدويًا أيضًا.
   (وسيُبنى APK جديد تلقائيًا للتحميل.)

## مشكلات محتملة وحلولها
| المشكلة | الحل |
|---|---|
| التطبيق يُظهر نسخة قديمة (كاش) | زر 🔄 يكسر الكاش تلقائيًا، والفحص الصامت عند الفتح يُحدِّث فورًا |
| النت مقطوع | التطبيق يعمل من المخزَّن — التحديث ينتظر عودة النت |
| iOS | لا يعمل APK — استخدم Safari → مشاركة → إضافة إلى الشاشة الرئيسية |
| `window.open` معطّل داخل الـ WebView | الكود يكتشف Capacitor تلقائيًا ويفتح متصفح النظام عبر `App.openUrl` |
| نسيت تحديث `version.json` | التطبيق لن يُحدِّث — التزم بمطابقة الرقمين معًا |
