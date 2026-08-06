> **روش پیشنهادی اجرا در ویندوز:** فایل `START-CBAI.cmd` را دوبارکلیک کنید. این launcher پنجره را باز نگه می‌دارد و در پوشه `logs` گزارش خطا می‌سازد.

# Clinical Bacteriology AI Assistant — اجرای Docker-only

این نسخه برای اجرای محلی MVP طراحی شده است و روی ویندوز فقط به **Docker Desktop** نیاز دارد.

نیازی به نصب این موارد روی ویندوز نیست:

- Node.js
- npm
- PostgreSQL
- MinIO
- Prisma

تمام آن‌ها داخل Docker اجرا می‌شوند.

## اجرای سریع

1. ZIP را Extract کنید.
2. Docker Desktop را اجرا کنید و صبر کنید Engine آماده شود.
3. PowerShell را داخل پوشه پروژه باز کنید.
4. اجرا کنید:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Start-Docker.ps1
```

اسکریپت:

- یک پورت آزاد از 8080 به بعد انتخاب می‌کند؛
- فایل `.env` و کلید رمزنگاری محلی می‌سازد؛
- image برنامه را داخل Docker build می‌کند؛
- PostgreSQL و MinIO را داخل شبکه خصوصی Docker اجرا می‌کند؛
- migration و seed را اجرا می‌کند؛
- برنامه را در مرورگر باز می‌کند.

آدرس معمول:

```text
http://localhost:8080
```

اشغال بودن پورت 3000 هیچ اثری ندارد.

## ورود محلی

```text
Email: admin@example.test
Password: ChangeMe-123!
```

## وارد کردن کلید Google Gemini

روش پیشنهادی:

1. با حساب Administrator وارد شوید.
2. `AI Provider Settings` را باز کنید.
3. Provider را `Google Gemini Native` انتخاب کنید.
4. API key را وارد کنید.
5. Model را `gemini-3.6-flash` قرار دهید.
6. Provider و Vision را فعال کنید.
7. `Save securely` و سپس `Test Vision` را بزنید.

کلید در مرورگر نگهداری نمی‌شود. مقدار آن در PostgreSQL داخل Docker و با
`AI_CONFIG_MASTER_KEY` رمزنگاری می‌شود.

روش جایگزین برای توسعه محلی: کلید را در فایل `.env` بگذارید:

```dotenv
GOOGLE_GEMINI_API_KEY=YOUR_REAL_KEY
GOOGLE_GEMINI_MODEL=gemini-3.6-flash
```

سپس اجرا کنید:

```powershell
.\Start-Docker.ps1 -Rebuild
```

فایل `.env` را منتشر یا commit نکنید.

## توقف

```powershell
.\Stop-Docker.ps1
```

توقف همراه با حذف تمام داده‌های محلی:

```powershell
.\Stop-Docker.ps1 -RemoveData
```

هشدار: گزینه `-RemoveData` کاربران، پرونده‌ها، تصاویر و تنظیمات ذخیره‌شده را حذف می‌کند.

## مشاهده لاگ‌ها

```powershell
docker compose --env-file .env logs -f app
```

لاگ همه سرویس‌ها:

```powershell
docker compose --env-file .env logs -f
```

## سرویس‌ها

- `app`: React build + Node.js API در یک container
- `postgres`: پایگاه داده داخلی
- `minio`: ذخیره خصوصی تصاویر
- `create-bucket`: ساخت bucket خصوصی هنگام راه‌اندازی

فقط پورت برنامه روی `localhost` منتشر می‌شود. PostgreSQL و MinIO از میزبان
قابل دسترسی نیستند و فقط از شبکه داخلی Docker استفاده می‌کنند.

## نکته MVP

PostgreSQL و MinIO برای این MVP الزامی مطلق نبودند، اما چون همه سرویس‌ها داخل
Docker مدیریت می‌شوند، پیچیدگی نصب روی ویندوز ایجاد نمی‌کنند و مسیر ارتقا به
پایلوت چندکاربره را ساده‌تر نگه می‌دارند.
