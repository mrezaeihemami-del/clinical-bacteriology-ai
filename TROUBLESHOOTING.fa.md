# رفع اشکال اجرای Docker

برای اجرا روی ویندوز، فایل `START-CBAI.cmd` را دوبارکلیک کنید. این فایل PowerShell را با ExecutionPolicy موقت مناسب اجرا می‌کند و پنجره را پس از موفقیت یا شکست باز نگه می‌دارد.

در صورت شکست:

1. خط قرمز آخر پنجره را بخوانید.
2. جدیدترین فایل داخل پوشه `logs` را باز کنید.
3. برای مشاهده وضعیت دستی:

```powershell
docker compose --env-file .env ps -a
docker compose --env-file .env logs --no-color --tail=400 app postgres minio create-bucket
```

دلایل رایج:

- Docker Desktop هنوز کاملاً راه نیفتاده است.
- دسترسی Docker به اینترنت برای دریافت imageها یا packageهای npm قطع است.
- proxy یا VPN دسترسی Docker را محدود کرده است.
- فضای دیسک Docker کم است.
- آنتی‌ویروس یا فایروال build یا bind شدن پورت را مسدود کرده است.

برای بازسازی کامل بدون حذف داده:

```powershell
.\Start-Docker.ps1
```

برای حذف داده‌های محلی و شروع پاک:

```powershell
.\Start-Docker.ps1 -ResetData
```
