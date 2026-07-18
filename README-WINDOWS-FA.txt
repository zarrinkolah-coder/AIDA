راهنمای ساخت نسخه نصب ویندوز 64 بیتی برنامه موجودی کالا

این فایل‌ها برنامه شما را به نسخه قابل نصب روی Windows 64-bit تبدیل می‌کند.
خروجی نهایی یک فایل Setup.exe خواهد بود.

روش ساخت روی کامپیوتر ویندوز:
1) Node.js نسخه LTS را نصب کنید.
2) این ZIP را Extract کنید.
3) روی فایل build-win64.bat دوبار کلیک کنید.
4) بعد از پایان ساخت، فایل نصب در پوشه dist ساخته می‌شود:
   dist\AIDA-Inventory-Setup-1.0.0-x64.exe
5) همین فایل Setup را روی ویندوز 64 بیتی نصب کنید.

نکته مهم درباره بروزرسانی روزانه:
برنامه نصب‌شده فایل روزانه را از این آدرس می‌خواند:
https://zarrinkolah-coder.github.io/AIDA/data/latest.json

پس برای بروزرسانی روزانه فقط همین فایل را در GitHub جایگزین کنید:
AIDA/data/latest.json

اگر آدرس GitHub Pages شما فرق دارد:
فایل desktop-config.json را باز کنید و مقدار dataUrl را به آدرس درست latest.json تغییر دهید.

روش ساخت با GitHub Actions:
1) محتوای این ZIP را داخل Repository آپلود کنید.
2) وارد تب Actions شوید.
3) workflow با نام Build Windows 64-bit Installer را اجرا کنید.
4) بعد از پایان، Artifact با نام AIDA-Inventory-Setup-Windows-x64 را دانلود کنید.
5) داخل آن فایل Setup.exe قرار دارد.

یادآوری:
برای اجرای فایل Setup در بعضی ویندوزها ممکن است هشدار Windows SmartScreen ظاهر شود، چون برنامه هنوز امضای دیجیتال رسمی ندارد. این موضوع برای برنامه‌های ساخته‌شده بدون گواهی Code Signing طبیعی است.
