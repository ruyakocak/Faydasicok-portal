@echo off
echo === Faydasicok Vakfi - Bursiyer Yonetim Sistemi ===
echo.

set NODE=C:\Users\zekaz\AppData\Local\ms-playwright-go\1.57.0\node.exe
set NPM_CLI=C:\Users\zekaz\AppData\Local\ms-playwright-go\1.57.0\node_modules\npm\bin\npm-cli.js
set PATH=C:\Users\zekaz\AppData\Local\ms-playwright-go\1.57.0;%PATH%
if not exist "%NODE%" (
    echo HATA: Node.js bulunamadi. Lutfen Node.js yukleyin: https://nodejs.org
    pause
    exit /b 1
)

echo Node.js bulundu: %NODE%
echo.

if "%1"=="backend" goto :backend
if "%1"=="frontend" goto :frontend
if "%1"=="install" goto :install
if "%1"=="seed" goto :seed
if "%1"=="migrate" goto :migrate

echo Kullanim:
echo   start.bat install    - Bagimliliklari yukle
echo   start.bat migrate    - Veritabani migrate et
echo   start.bat seed       - Test verilerini ekle
echo   start.bat backend    - Backend sunucuyu baslat (port 3001)
echo   start.bat frontend   - Frontend sunucuyu baslat (port 5173)
echo.
goto :eof

:install
echo [1/2] Backend bagimliliklari yukleniyor...
cd backend
"%NODE%" "%NPM_CLI%" install
cd ..
echo [2/2] Frontend bagimliliklari yukleniyor...
cd frontend
"%NODE%" "%NPM_CLI%" install
cd ..
echo Tum bagimlilıklar yuklendi!
goto :eof

:migrate
echo Veritabani migrate ediliyor...
cd backend
"%NODE%" "%NPM_CLI%" run db:generate
"%NODE%" "%NPM_CLI%" run db:migrate
cd ..
echo Migrate tamamlandi!
goto :eof

:seed
echo Seed verileri ekleniyor...
cd backend
"%NODE%" "%NPM_CLI%" run db:seed
cd ..
echo Seed tamamlandi!
goto :eof

:backend
echo Backend baslatiliyor (http://localhost:3001)...
cd backend
powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:Path = 'C:\Users\zekaz\AppData\Local\ms-playwright-go\1.57.0;' + $env:Path; npm run dev"
goto :eof

:frontend
echo Frontend baslatiliyor (http://localhost:5173)...
cd frontend
powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:Path = 'C:\Users\zekaz\AppData\Local\ms-playwright-go\1.57.0;' + $env:Path; npm run dev"
goto :eof
