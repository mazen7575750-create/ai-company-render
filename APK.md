# بناء تطبيق APK — مرة واحدة فقط ثم التحديث تلقائيًا للأبد 📱

## الفكرة
الـ APK مجرد "نافذة" تفتح رابط التطبيق المباشر على GitHub Pages.
أي تحديث ترفعه للمستودع يظهر لجميع مستخدمي التطبيق فورًا — **بدون إعادة إرسال أي رابط وبدون إعادة بناء APK**.

- رابط التطبيق المباشر:
  **https://mazen7575750-create.github.io/ai-company-render/mohfaz.html**

## المتطلبات (مجانية)
- [Node.js](https://nodejs.org)
- [Android Studio](https://developer.android.com/studio) (مجاني)

## خطوات البناء (مرة واحدة)

```bash
# 1) استنسخ المستودع
git clone https://github.com/mazen7575750-create/ai-company-render.git
cd ai-company-render

# 2) ثبّت حزم Capacitor (مجانية ومفتوحة المصدر)
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/app

# 3) أضف مشروع أندرويد (يُنشأ مرة واحدة فقط)
npx cap add android

# 4) زامن الملفات
npx cap sync android

# 5) افتح المشروع في Android Studio
npx cap open android
```

داخل Android Studio:
1. **Build → Build APK(s)**
2. الملف الناتج:
   `android/app/build/outputs/apk/debug/app-debug.apk`
3. للنشر النهائي: **Build → Generate Signed App Bundle / APK** (توقيع رقمي — يُبنى مرة واحدة).

> ملاحظة: `capacitor.config.json` مضبوط مسبقًا على رابط GitHub Pages —
> **لا تغيّره**، ولهذا يحصل كل من يثبّت التطبيق على أحدث نسخة تلقائيًا.

## بعد البناء — كيف تحدّث التطبيق للمستخدمين (خطوتان)

1. عدّل `mohfaz.html` وارفعه.
2. حدّث الرقم في **مكانين بنفس القيمة**:
   - `mohfaz.html` → السطر: `const APP_VERSION = "..."`
   - `version.json` → حقل `"version"`
   ثم ارفع الملفين. **ينتهي الأمر** — الأجهزة تتحدث تلقائيًا عند الفتح،
   وزر 🔄 داخل التطبيق يعرض التحديث يدويًا أيضًا.

## مشكلات محتملة وحلولها
| المشكلة | الحل |
|---|---|
| التطبيق يُظهر نسخة قديمة (كاش) | زر 🔄 يكسر الكاش تلقائيًا، والفحص الصامت عند الفتح يُحدِّث فورًا |
| النت مقطوع | التطبيق يعمل من المخزَّن — التحديث ينتظر عودة النت |
| iOS | لا يعمل APK — استخدم Safari → مشاركة → إضافة إلى الشاشة الرئيسية |
| `window.open` معطّل داخل الـ WebView | الكود يكتشف Capacitor تلقائيًا ويفتح متصفح النظام عبر `App.openUrl` |
| نسيت تحديث `version.json` | التطبيق لن يتحدث (أو سيعرض زر التحديث فقط) — التزم بمطابقة الرقمين |
