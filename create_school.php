<?php
/**
 * Yeni Okul Klasörü Oluşturucu (Kelebek Sistemi)
 * Bu script, ana dizindeki dosyaları alıp yeni bir okul klasörüne kopyalar
 * ve o klasörün sadece o okula hizmet etmesini sağlar.
 */

header('Content-Type: application/json; charset=utf-8');

// Sadece POST isteklerini kabul et
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Geçersiz istek metodu.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$folderName = isset($data['folderName']) ? trim($data['folderName']) : '';
$storeKey = isset($data['storeKey']) ? trim($data['storeKey']) : '';

if (empty($folderName) || empty($storeKey)) {
    echo json_encode(['success' => false, 'error' => 'Klasör adı veya StoreKey eksik.']);
    exit;
}

// Güvenli klasör adı (sadece harf, rakam, tire, alt çizgi)
$folderName = preg_replace('/[^a-zA-Z0-9_\-]/', '', $folderName);
$targetDir = __DIR__ . DIRECTORY_SEPARATOR . $folderName;

if (file_exists($targetDir)) {
    echo json_encode(['success' => false, 'error' => 'Bu isimde bir klasör zaten mevcut.']);
    exit;
}

// Klasörü oluştur
if (!mkdir($targetDir, 0755, true)) {
    echo json_encode(['success' => false, 'error' => 'Klasör oluşturulamadı. Sunucu izinlerini kontrol edin.']);
    exit;
}

// Kopyalanacak temel dosya ve klasörler
$itemsToCopy = [
    'index.html', 'ogrenci.html', 'ogretmen.html', 'dashboard.html', 
    'yoklama_idareci.html', 'yoklama_ogretmen.html', '404.html', 'security_error.html',
    'css', 'js', 'fonts', 'img'
];

function xcopy($src, $dest) {
    if (is_dir($src)) {
        if (!is_dir($dest)) {
            mkdir($dest, 0755);
        }
        $files = scandir($src);
        foreach ($files as $file) {
            if ($file != "." && $file != "..") {
                xcopy("$src/$file", "$dest/$file");
            }
        }
    } else if (file_exists($src)) {
        copy($src, $dest);
    }
}

foreach ($itemsToCopy as $item) {
    $srcPath = __DIR__ . DIRECTORY_SEPARATOR . 'iaal' . DIRECTORY_SEPARATOR . $item;
    $destPath = $targetDir . DIRECTORY_SEPARATOR . $item;
    if (file_exists($srcPath)) {
        xcopy($srcPath, $destPath);
    }
}



// auth.js içindeki kullanıcı adlarına okul önkini (prefix) ekle ki benzersizlik sorunu ortadan kalksın
// (A okulundaki ahmet ile B okulundaki ahmet'i ayırmak için)
$authPath = $targetDir . DIRECTORY_SEPARATOR . 'js' . DIRECTORY_SEPARATOR . 'auth.js';
if (file_exists($authPath)) {
    $content = file_get_contents($authPath);
    
    // Login formundaki kullanıcı adının başına okul adını otomatik ekleme kodu enjekte ediyoruz
    $injection = "
        // SADECE BU KLASÖRE ÖZEL: Kullanıcı adını otomatik namespace içine al
        if (username !== 'admin') {
            const prefix = '$folderName' + '_';
            if (!username.startsWith(prefix)) {
                username = prefix + username;
            }
        }
    ";
    
    $pattern = '/let\s+username\s*=\s*usernameInput\.value\.trim\(\);/i';
    $replacement = "let username = usernameInput.value.trim();\n" . $injection;
    
    $content = preg_replace($pattern, $replacement, $content, 1);
    file_put_contents($authPath, $content);
}

echo json_encode([
    'success' => true, 
    'message' => 'Klasör başarıyla oluşturuldu ve ayarlandı.',
    'url' => '/' . $folderName . '/'
]);
?>
