# اصلاح ذخیره کلید API — نسخه v5

این نسخه مسیر ذخیره کلید AI را بازطراحی می‌کند:

- دکمه `Save securely` اکنون داخل خود فرم قرار دارد و مستقیم submit می‌شود.
- کلید در سرور با AES-256-GCM رمزگذاری و در PostgreSQL ذخیره می‌شود.
- پاسخ ذخیره باید `saved: true` و `hasApiKey: true` برگرداند.
- کلید خام هرگز در پاسخ API برگردانده نمی‌شود.
- پیام خطا کد خطا و Request ID را در رابط کاربری نشان می‌دهد.
- تغییر Provider، تنظیمات ذخیره‌شده همان Provider را بارگذاری می‌کند.
- تست Vision برای کاهش burst rate به‌صورت ترتیبی اجرا می‌شود.
- خطاهای قبلی build، migration و Pino نیز در همین بسته اصلاح شده‌اند.

## اجرای نسخه

1. ZIP را Extract کنید.
2. Docker Desktop را باز نگه دارید.
3. داخل پوشه استخراج‌شده `START-CBAI.cmd` را اجرا کنید.

یا در PowerShell:

```powershell
Set-Location "$env:USERPROFILE\Downloads\clinical-bacteriology-ai-assistant-docker-only-fixed-v5"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File ".\Start-Docker.ps1"
```

اسکریپت در صورت وجود، فایل `.env` نسخه v4 را از پوشه مجاور کپی می‌کند تا کلید رمزگذاری و رمزهای دیتابیس قبلی حفظ شوند. داده‌های Docker به‌طور پیش‌فرض پاک نمی‌شوند.

## ورود و ذخیره کلید

- Email: `admin@example.test`
- Password: `ChangeMe-123!`
- مسیر: `AI provider`
- Provider: `Google Gemini native`
- Model: `gemini-3.6-flash`
- کلید را Paste کنید.
- `Provider enabled` و `Vision enabled` روشن باشند.
- `Save securely` را بزنید.
- باید پیام `Saved securely` و ماسک انتهای کلید نمایش داده شود.
- سپس `Test real vision` را بزنید.

## بازنشانی کامل اختیاری

این فرمان داده‌های PostgreSQL و MinIO را حذف می‌کند:

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File ".\Start-Docker.ps1" -ResetData
```
