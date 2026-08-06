# نسخه اصلاح‌شده v5

برای اجرای مستقیم، روی `START-CBAI.cmd` دوبار کلیک کنید. راهنمای اصلاح ذخیره کلید API در `API-KEY-FIX.fa.md` قرار دارد.

# بازنویسی کنترل‌شده دستیار باکتریولوژی بالینی

این مخزن جایگزین کامل MVP ضمیمه‌شده است. داده حافظه‌ای، نقش انتخابی در مرورگر،
نتیجه ساختگی AI، مسیر فایل جعلی و endpointهای مخرب عمومی حذف شده‌اند.

## آنچه واقعاً پیاده‌سازی شده است

- ورود و session واقعی سمت سرور
- نقش و مجوز سمت سرور
- PostgreSQL و migration
- آپلود واقعی `multipart/form-data`
- تشخیص MIME از بایت فایل و رد MIME جعلی
- decode و کنترل ابعاد تصویر
- حذف metadata و ذخیره خصوصی در MinIO/S3
- hash محتوای تصویر
- ارسال بایت واقعی تصویر به Gemini یا API سازگار با OpenAI
- خروجی ساختاریافته و Zod fail-closed
- کلید BYOK رمزنگاری‌شده و سازمان‌محور
- آزمون واقعی تفاوت تصویر قرمز و آبی
- workflow غیرقابل دورزدن در backend
- تأیید اجباری میکروبیولوژیست
- audit پایدار در database
- تست‌های unit و integration

## اجرای محلی

```bash
npm install
cp .env.example .env
node scripts/generate-master-key.mjs
docker compose up -d
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

مقدار تولیدشده را در `AI_CONFIG_MASTER_KEY` قرار دهید.

رابط در `http://localhost:5173` و API در `http://localhost:3000` اجرا می‌شود.

## مرز صادقانه

این پروژه از نظر نرم‌افزاری بازسازی شده است، اما هنوز اعتبار بالینی، مجوز پزشکی،
دقت تشخیصی یا انطباق قانونی را اثبات نمی‌کند. خروجی AI صرفاً مشاهده کمکی است و
نباید بدون بررسی متخصص وارد گزارش نهایی شود.


## تست مرورگر آپلود

یک تست Playwright مسیر واقعی زیر را اجرا می‌کند:

```text
ورود تکنسین → ایجاد پرونده → انتخاب فایل PNG → ارسال multipart
→ ذخیره در MinIO → ثبت metadata در PostgreSQL → نمایش موفقیت در رابط
```

اجرا:

```bash
npx playwright install chromium
npm run test:e2e
```

هر حساب کاربری در نسخه فعلی به یک سازمان تعلق دارد تا انتخاب مبهم tenant در
session رخ ندهد.


## اجرای ویندوز با PowerShell و پورت جایگزین

نسخه محلی پورت API را از `.env` می‌خواند و به‌طور پیش‌فرض از `3001` استفاده
می‌کند؛ بنابراین اشغال‌بودن پورت `3000` مانع اجرا نیست. اسکریپت زیر پورت‌های
آزاد را پیدا می‌کند، `.env` را می‌سازد، PostgreSQL و MinIO را با Docker بالا
می‌آورد، migration و seed را اجرا می‌کند و سپس سرورهای توسعه را شروع می‌کند:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Start-CBAI-Local.ps1
```

برای آماده‌سازی بدون اجرای سرورهای Node:

```powershell
.\Start-CBAI-Local.ps1 -PrepareOnly
```

برای انتخاب دستی پورت‌ها:

```powershell
.\Start-CBAI-Local.ps1 -ApiPort 3001 -WebPort 5173
```

### محل ثبت کلید Gemini

روش توصیه‌شده:

1. با `admin@example.test` و رمز توسعه `ChangeMe-123!` وارد شوید.
2. از سربرگ، `AI provider settings` را باز کنید.
3. `Google Gemini native` را انتخاب کنید.
4. کلید را در `API key` قرار دهید.
5. مدل را انتخاب، `Save securely` و سپس `Test real vision` را اجرا کنید.

کلید در این مسیر با `AI_CONFIG_MASTER_KEY` رمزنگاری و در PostgreSQL برای همان
سازمان ذخیره می‌شود و مقدار خام آن به مرورگر بازگردانده نمی‌شود.

برای اجرای محلی موقت، می‌توان مقدار زیر را نیز در `.env` قرار داد:

```dotenv
GOOGLE_GEMINI_API_KEY=YOUR_KEY_HERE
GOOGLE_GEMINI_MODEL=gemini-3.6-flash
```

این fallback فقط زمانی استفاده می‌شود که provider فعال ذخیره‌شده در database
وجود نداشته باشد. فایل `.env` نباید commit یا منتشر شود.
