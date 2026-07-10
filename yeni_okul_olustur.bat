@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Kelebek Sistemi Yeni Okul Klasoru Olusturucu

echo ========================================================
echo   KELEBEK SISTEMI YENI OKUL KLASORU OLUSTURUCU (LOCAL)
echo ========================================================
echo.
echo Bu arac ana dizindeki dosyalari yeni bir okul klasorune kopyalar.
echo Lutfen sunucuda (cPanel vb.) calisiyorsaniz bu dosyaya ihtiyaciniz yoktur,
echo Master Panel (master.html) uzerinden otomatik olusacaktir.
echo.

set /p folderName="Olusturulacak Klasorun Adini Girin (Bosluk kullanmayin): "

if "%folderName%"=="" (
    echo Klasor adi bos birakilamaz.
    pause
    exit /b
)

if exist "%folderName%" (
    echo Bu isimde bir klasor zaten var.
    pause
    exit /b
)

echo.
echo %folderName% klasoru olusturuluyor...
mkdir "%folderName%"

echo Dosyalar kopyalaniyor...
copy iaal\index.html "%folderName%\" >nul
copy iaal\ogrenci.html "%folderName%\" >nul
copy iaal\ogretmen.html "%folderName%\" >nul
copy iaal\dashboard.html "%folderName%\" >nul
copy iaal\yoklama_idareci.html "%folderName%\" >nul
copy iaal\yoklama_ogretmen.html "%folderName%\" >nul
copy iaal\404.html "%folderName%\" >nul
copy iaal\security_error.html "%folderName%\" >nul

xcopy iaal\css "%folderName%\css\" /E /I /Q /Y >nul
xcopy iaal\js "%folderName%\js\" /E /I /Q /Y >nul
xcopy iaal\fonts "%folderName%\fonts\" /E /I /Q /Y >nul
xcopy iaal\img "%folderName%\img\" /E /I /Q /Y >nul

echo.
echo Islem basariyla tamamlandi.
echo Artik %folderName%\index.html adresinden giris yapabilirsiniz.
echo.
pause
