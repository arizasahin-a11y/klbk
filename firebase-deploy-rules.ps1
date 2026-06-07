# Firebase Rules Deployment Script
# Bu script Firebase CLI kullanarak rules'u otomatik deploy eder

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   FIREBASE SECURITY RULES DEPLOYMENT" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Firebase CLI kontrolü
Write-Host "1. Firebase CLI kontrol ediliyor..." -ForegroundColor Yellow
$firebaseInstalled = $null
try {
    $firebaseInstalled = firebase --version
    Write-Host "   ✓ Firebase CLI yüklü: $firebaseInstalled" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Firebase CLI yüklü değil!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Firebase CLI'yi yüklemek için:" -ForegroundColor Yellow
    Write-Host "   npm install -g firebase-tools" -ForegroundColor White
    Write-Host ""
    Write-Host "Alternatif olarak Manuel yöntem kullanın:" -ForegroundColor Yellow
    Write-Host "   1. https://console.firebase.google.com adresine gidin" -ForegroundColor White
    Write-Host "   2. klbk-620b0 projesini seçin" -ForegroundColor White
    Write-Host "   3. Realtime Database > Rules" -ForegroundColor White
    Write-Host "   4. firebase.rules.json içeriğini kopyalayın" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "2. Firebase login kontrol ediliyor..." -ForegroundColor Yellow
$loginCheck = firebase login:list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ⚠ Firebase'e giriş yapmanız gerekiyor" -ForegroundColor Yellow
    Write-Host ""
    firebase login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ✗ Login başarısız!" -ForegroundColor Red
        exit 1
    }
}
Write-Host "   ✓ Firebase login OK" -ForegroundColor Green

Write-Host ""
Write-Host "3. Firebase projesi başlatılıyor..." -ForegroundColor Yellow

# firebase.json yoksa oluştur
if (-not (Test-Path "firebase.json")) {
    Write-Host "   → firebase.json oluşturuluyor..." -ForegroundColor Gray
    
    $firebaseConfig = @{
        database = @{
            rules = "firebase.rules.json"
        }
    } | ConvertTo-Json -Depth 10
    
    Set-Content -Path "firebase.json" -Value $firebaseConfig
    Write-Host "   ✓ firebase.json oluşturuldu" -ForegroundColor Green
} else {
    Write-Host "   ✓ firebase.json mevcut" -ForegroundColor Green
}

Write-Host ""
Write-Host "4. Firebase rules deploy ediliyor..." -ForegroundColor Yellow
Write-Host "   → Proje: klbk-620b0" -ForegroundColor Gray
Write-Host ""

# Rules'u göster
Write-Host "   Uygulanacak kurallar:" -ForegroundColor Cyan
Get-Content "firebase.rules.json" | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
Write-Host ""

# Onay iste
$confirmation = Read-Host "Bu kuralları deploy etmek istediğinize emin misiniz? (E/H)"
if ($confirmation -ne 'E' -and $confirmation -ne 'e') {
    Write-Host ""
    Write-Host "   ✗ İşlem iptal edildi" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "   → Deploy başlatılıyor..." -ForegroundColor Gray

# Deploy
firebase deploy --only database --project klbk-620b0

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "   ✓ FIREBASE RULES BAŞARIYLA DEPLOY EDİLDİ!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Kontrol için:" -ForegroundColor Yellow
    Write-Host "   https://console.firebase.google.com/project/klbk-620b0/database/rules" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Red
    Write-Host "   ✗ DEPLOY HATASI!" -ForegroundColor Red
    Write-Host "================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manuel yöntem kullanın:" -ForegroundColor Yellow
    Write-Host "   1. https://console.firebase.google.com" -ForegroundColor White
    Write-Host "   2. Realtime Database > Rules" -ForegroundColor White
    Write-Host "   3. firebase.rules.json içeriğini kopyalayın" -ForegroundColor White
    Write-Host ""
}
