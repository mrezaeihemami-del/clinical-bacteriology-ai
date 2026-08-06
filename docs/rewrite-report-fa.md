# گزارش بازنویسی کامل فایل ضمیمه

## نتیجه

فایل ضمیمه صرفاً patch نشده است. یک مخزن جدید با معماری واحد ساخته شده و
backendهای حافظه‌ای و رفتارهای نمایشی نسخه قبلی مبنای اجرای محصول نیستند.

## مشکل قطعی نسخه ضمیمه

در نسخه ضمیمه‌شده، ادعای آپلود واقعی درست نبود:

- `multer` در `package.json` وجود نداشت؛
- `server.ts` فایل multipart دریافت نمی‌کرد؛
- endpoint تصویر فقط JSON شامل نام و مسیر ظاهری می‌گرفت؛
- بایت تصویر وارد backend، storage یا مدل نمی‌شد.

## جایگزینی‌های اصلی

| بخش قبلی | وضعیت بازنویسی |
|---|---|
| role انتخابی در مرورگر | session و RBAC واقعی سمت سرور |
| داده حافظه‌ای | PostgreSQL و migration |
| دو backend متناقض | یک backend TypeScript |
| آپلود نام/مسیر جعلی | FormData، Multer و بایت واقعی |
| اعتماد به MIME مرورگر | magic bytes، decode و کنترل ابعاد |
| Base64 در record | object storage خصوصی |
| AI براساس filename/notes | تصویر واقعی در `inlineData` |
| JSON آزاد مدل | JSON Schema و Zod fail-closed |
| کلید global در حافظه | BYOK رمزنگاری‌شده و سازمان‌محور |
| approval قابل دورزدن | permission و transition سمت سرور |
| audit حافظه‌ای/resettable | audit پایدار و append-only |
| تست محدود rules | unit، integration و Playwright |

## مسیر واقعی آپلود

```text
انتخاب فایل در مرورگر
→ FormData
→ POST /api/cases/:caseId/images
→ احراز هویت و مجوز
→ rate limit
→ Multer با محدودیت حجم
→ تشخیص MIME از بایت
→ decode با Sharp
→ کنترل ابعاد و pixel
→ حذف metadata
→ SHA-256
→ ذخیره خصوصی MinIO/S3
→ transaction در PostgreSQL
→ transition workflow
→ audit
→ refresh و feedback رابط
```

## مسیر واقعی AI

```text
تصویر خصوصی
→ دریافت بایت از storage
→ تطبیق SHA-256
→ رد تصویر فاقد جزئیات
→ ارسال Base64 واقعی با inlineData
→ structured output
→ Zod validation
→ کنترل ادعاهای خارج از محدوده
→ ذخیره نتیجه با model/prompt/schema/hash
→ review انسانی اجباری
```

## نکته صادقانه

سورس کامل بازنویسی شده است، اما در این محیط نصب dependencyها از registry
تکمیل نشد. بنابراین build، typecheck کامل، integration runtime و Playwright
در این محیط اجراشده اعلام نمی‌شوند. ۶۶ فایل TypeScript/TSX با parser رسمی
TypeScript بررسی شدند و خطای نحوی نداشتند. CI تمام فرمان‌های لازم را تعریف
می‌کند و باید قبل از استقرار سبز شود.

همچنین هیچ تماس زنده Gemini بدون کلید کاربر انجام نشده و هیچ ادعای اعتبار
بالینی، دقت تشخیصی یا آمادگی regulatory وجود ندارد.
