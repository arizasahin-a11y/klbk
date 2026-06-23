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
copy index.html "%folderName%\" >nul
copy ogrenci.html "%folderName%\" >nul
copy ogretmen.html "%folderName%\" >nul
copy dashboard.html "%folderName%\" >nul
copy yoklama_idareci.html "%folderName%\" >nul
copy yoklama_ogretmen.html "%folderName%\" >nul
copy 404.html "%folderName%\" >nul
copy security_error.html "%folderName%\" >nul

xcopy css "%folderName%\css\" /E /I /Q /Y >nul
xcopy js "%folderName%\js\" /E /I /Q /Y >nul
xcopy fonts "%folderName%\fonts\" /E /I /Q /Y >nul
xcopy img "%folderName%\img\" /E /I /Q /Y >nul

echo.
echo Islem basariyla tamamlandi.
echo Artik %folderName%\index.html adresinden giris yapabilirsiniz.
echo.
pause
