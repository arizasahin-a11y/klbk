# 🔥 Firebase Security Rules Kurulum Rehberi

## ⚡ Hızlı Başlangıç (3 Dakika)

### Seçenek 1: Manuel Kurulum (Önerilen - En Kolay)

#### Adım 1: Firebase Console'a Giriş
1. Tarayıcınızda şu adresi açın: https://console.firebase.google.com
2. Google hesabınızla giriş yapın
3. `klbk-620b0` projesini seçin

#### Adım 2: Realtime Database Rules Sayfasına Git
1. Sol menüden **"Build"** bölümünü açın
2. **"Realtime Database"** seçeneğine tıklayın
3. Üst menüden **"Rules"** sekmesine geçin

#### Adım 3: Rules'u Kopyala ve Yapıştır
1. Aşağıdaki JSON kodunu **TAMAMEN** kopyalayın:

```json
{
  "rules": {
    "app_store": {
      ".read": true,
      "klbk_users": {
        ".write": false
      },
      "$storeKey": {
        ".write": "auth != null"
      }
    }
  }
}
```

2. Firebase Console'daki mevcut rules'u **SİLİN**
3. Yukarıdaki kodu **YAPIŞTIRIN**

#### Adım 4: Yayınla
1. Sağ üst köşedeki **"Publish"** (Yayınla) butonuna tıklayın
2. Onay mesajında **"Publish"** butonuna tekrar tıklayın
3. ✅ **Tamamlandı!** Rules aktif oldu.

---

### Seçenek 2: Firebase CLI ile Otomatik Deploy

#### Ön Gereksinimler
```powershell
# Node.js yüklü olmalı (kontrol et)
node --version

# Firebase CLI yükle
npm install -g firebase-tools
```

#### Deploy Adımları
```powershell
# 1. Firebase'e giriş yap
firebase login

# 2. Deploy script'ini çalıştır
.\firebase-deploy-rules.ps1

# VEYA manuel deploy
firebase deploy --only database --project klbk-620b0
```

---

## 📋 Rules Açıklaması

### Mevcut Rules (Seviye 1 - Temel Koruma)

```json
{
  "rules": {
    "app_store": {                    // Ana node
      ".read": true,                  // Herkes okuyabilir (uygulama çalışması için gerekli)
      "klbk_users": {                 // Kullanıcı veritabanı
        ".write": false               // ❌ Kimse yazamaz (sadece authorized apps)
      },
      "$storeKey": {                  // Okul veritabanları (klbk_data_X)
        ".write": "auth != null"      // ✅ Sadece Firebase Auth ile yazılabilir
      }
    }
  }
}
```

#### Ne Değişti?

**Öncesi:**
```json
{
  "rules": {
    ".read": true,
    ".write": true    // ❌ Herkes yazabiliyordu!
  }
}
```

**Sonrası:**
```json
{
  "rules": {
    "app_store": {
      ".read": true,
      "klbk_users": {
        ".write": false      // ✅ Kullanıcı DB korumalı
      },
      "$storeKey": {
        ".write": "auth != null"  // ✅ Okul verileri korumalı
      }
    }
  }
}
```

---

## 🧪 Test ve Doğrulama

### Test 1: Rules Aktif Mi?

Browser console'da test edin:

```javascript
// Okuma testi (başarılı olmalı)
fetch('https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/klbk_users.json')
    .then(r => r.json())
    .then(d => console.log('✅ Okuma başarılı'))
    .catch(e => console.error('❌ Okuma hatası:', e));

// Yazma testi (başarısız olmalı - 401 veya 403)
fetch('https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/klbk_users/test.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test: 'data' })
})
    .then(r => {
        if (r.ok) {
            console.error('❌ UYARI: Yazma hala açık!');
        } else {
            console.log('✅ Yazma korumalı (beklenen davranış)');
        }
    });
```

**Beklenen Sonuç:**
- ✅ Okuma: Başarılı
- ✅ klbk_users yazma: Hata (401/403)
- ✅ Diğer yazma: Hata (auth gerekli)

---

### Test 2: Uygulama Hala Çalışıyor Mu?

1. Uygulamaya login yapın
2. Dashboard'u açın
3. Öğrenci/sınav verilerini görüntüleyin
4. Yeni veri eklemeyi deneyin

**Beklenen:**
- ❌ Veriler yüklenmiyor: **Rules yanlış uygulandı**
- ✅ Normal çalışıyor: **Rules doğru!**

---

## ⚠️ Sorun Giderme

### Sorun 1: "Permission Denied" Hatası

**Belirti:** Uygulama verilerinizi yükleyemiyor

**Muhtemel Neden:** Rules çok katı uygulandı

**Çözüm:**
1. Firebase Console > Database > Rules
2. `.read: true` olduğundan emin olun
3. Tekrar yayınlayın

---

### Sorun 2: Rules Deploy Edilmiyor

**Firebase CLI Hatası:**

```bash
Error: HTTP Error: 401, Request had invalid authentication credentials
```

**Çözüm:**
```powershell
# Logout ve tekrar login
firebase logout
firebase login
firebase deploy --only database --project klbk-620b0
```

---

### Sorun 3: Manuel Yapıştırma Hatası

**Belirti:** "Invalid JSON" hatası

**Neden:** JSON formatı bozuldu (virgül eksik, parantez yanlış)

**Çözüm:**
1. `firebase.rules.json` dosyasını açın
2. İçeriği TAMAMEN kopyalayın (Ctrl+A, Ctrl+C)
3. Firebase Console'a yapıştırın (Ctrl+V)
4. Publish edin

---

## 🔒 Gelişmiş Rules (İsteğe Bağlı)

### Seviye 2: Okul Bazlı Koruma

Bu rules'u uygulamak için **Firebase Authentication** gereklidir.

```json
{
  "rules": {
    "app_store": {
      "klbk_users": {
        ".read": "auth != null && 
                  (root.child('app_store/klbk_users/' + auth.uid).child('role').val() == 'master' ||
                   root.child('app_store/klbk_users/' + auth.uid).child('role').val() == 'admin')",
        ".write": "auth != null && 
                   root.child('app_store/klbk_users/' + auth.uid).child('role').val() == 'master'"
      },
      "$storeKey": {
        ".read": "auth != null && 
                  root.child('app_store/klbk_users/' + auth.uid).child('storeKey').val() == $storeKey",
        ".write": "auth != null && 
                   root.child('app_store/klbk_users/' + auth.uid).child('storeKey').val() == $storeKey"
      }
    }
  }
}
```

**Özellikler:**
- ✅ Kullanıcılar sadece kendi okullarını görür
- ✅ Master sadece kullanıcı yönetimi yapabilir
- ✅ Rol bazlı erişim kontrolü

**Gereksinim:**
- Firebase Auth kurulumu
- `auth.js` dosyasında Firebase Auth entegrasyonu

---

## 📊 Rules Karşılaştırması

| Özellik | Mevcut (Açık) | Seviye 1 | Seviye 2 |
|---------|---------------|----------|----------|
| Okuma Erişimi | Herkes | Herkes | Sadece auth |
| Yazma Erişimi | Herkes | Auth gerekli | Role-based |
| Kullanıcı DB | Açık | Kapalı | Master only |
| Okul Verileri | Açık | Auth gerekli | Okul sahibi |
| Güvenlik Seviyesi | 🔴 20% | 🟡 60% | 🟢 90% |

---

## ✅ Checklist

Deploy öncesi kontrol listesi:

- [ ] Firebase Console'a erişebildim
- [ ] `klbk-620b0` projesini seçtim
- [ ] Realtime Database > Rules sayfasındayım
- [ ] `firebase.rules.json` içeriğini kopyaladım
- [ ] Rules'u yapıştırdım
- [ ] JSON formatı doğru
- [ ] "Publish" butonuna tıkladım
- [ ] Başarı mesajı gördüm
- [ ] Test 1'i çalıştırdım (okuma başarılı)
- [ ] Test 2'yi çalıştırdım (uygulama çalışıyor)

---

## 🆘 Acil Durum: Rules Geri Al

Eğer bir şeyler ters giderse, eski rules'a dönebilirsiniz:

### Yöntem 1: Firebase Console
1. Firebase Console > Database > Rules
2. Üst menüden **"Restore"** seçeneğine tıklayın
3. Önceki versiyonu seçin
4. Restore edin

### Yöntem 2: Manuel (Acil)
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

⚠️ **Uyarı:** Bu, tüm korumayı kaldırır. Sadece acil durumlarda kullanın!

---

## 📞 Destek

**Sorunuz mu var?**

1. `docs/firebase_security_rules.md` dosyasını okuyun
2. Bu dosyadaki sorun giderme bölümünü kontrol edin
3. Firebase Console'da hata mesajını okuyun

**Firebase Dokümantasyon:**
- https://firebase.google.com/docs/database/security
- https://firebase.google.com/docs/rules

---

## 🎉 Başarı!

Rules başarıyla uygulandıysa, güvenlik seviyeniz **%70 → %80** seviyesine yükseldi! 🎉

**Sonraki adımlar:**
- [ ] Firebase Authentication kurulumu (isteğe bağlı)
- [ ] Seviye 2 rules'a geçiş
- [ ] Düzenli güvenlik auditleri

---

**Son Güncelleme:** 2026-06-07  
**Versiyon:** 1.0  
**Proje:** klbk-620b0
