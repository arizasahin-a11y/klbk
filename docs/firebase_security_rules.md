# Firebase Security Rules - Güvenlik Yapılandırması

## Mevcut Durum
Şu anda Firebase Realtime Database'iniz **açık erişim** modunda çalışıyor. Bu, herhangi birinin Firebase URL'inizi bilerek verilerinize okuma/yazma yapabileceği anlamına gelir.

## Önerilen Security Rules

Firebase Console'a giriş yapın ve Realtime Database > Rules bölümüne aşağıdaki kuralları ekleyin:

### Seviye 1: Temel Koruma (Hemen Uygulanabilir)

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

**Açıklama:**
- Herkes okuyabilir (mevcut yapıyı bozmaz)
- `klbk_users` (kullanıcı veritabanı) yazma korumalı
- Diğer veriler sadece Firebase Auth ile yazılabilir

---

### Seviye 2: Okul Bazlı Koruma (Önerilen)

```json
{
  "rules": {
    "app_store": {
      "klbk_users": {
        ".read": true,
        ".write": false
      },
      "$storeKey": {
        ".read": "auth != null",
        ".write": "auth != null && 
                   root.child('app_store/klbk_users/' + auth.uid).child('storeKey').val() == $storeKey"
      }
    }
  }
}
```

**Açıklama:**
- Kullanıcılar sadece kendi okullarının verilerini görebilir
- Yazma yetkisi sadece o okula ait kullanıcılara

---

### Seviye 3: Tam Güvenlik (İdeal - Firebase Auth Gerektirir)

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
                   root.child('app_store/klbk_users/' + auth.uid).child('storeKey').val() == $storeKey &&
                   (root.child('app_store/klbk_users/' + auth.uid).child('role').val() == 'admin' ||
                    root.child('app_store/klbk_users/' + auth.uid).child('role').val() == 'master')"
      }
    }
  }
}
```

**Açıklama:**
- Tam rol bazlı erişim kontrolü
- Master sadece kullanıcı yönetebilir
- Admin/Master kendi okulunu yönetebilir
- Öğretmenler sadece okuyabilir

---

## Firebase Auth Kurulumu (Seviye 2 ve 3 için gerekli)

### 1. Firebase Console'da Email/Password Auth'u Etkinleştirin
1. Firebase Console > Authentication > Sign-in method
2. Email/Password'u enable edin

### 2. Kodda Firebase Auth Ekleyin

`auth.js` dosyasına eklenecek kod:

```javascript
// Firebase Auth SDK
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const auth = getAuth();

// Login fonksiyonunda
async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Session'a Firebase UID ekle
        sessionStorage.setItem('firebase_uid', user.uid);
        
        return user;
    } catch (error) {
        console.error('Firebase auth error:', error);
        throw error;
    }
}
```

---

## Geçiş Planı

### Faz 1: Şifre Hashleme ✅ TAMAMLANDI
- Web Crypto API ile SHA-256 hash
- Geriye dönük uyumlu migration
- Tüm password save/update noktaları güncellendi

### Faz 2: Temel Koruma (Bu Adım)
- `.gitignore` ile hassas dosyalar korundu
- Firebase Security Rules Seviye 1 uygulanmalı

### Faz 3: Firebase Auth Entegrasyonu (İsteğe Bağlı)
- Email/Password Auth kurulumu
- Security Rules Seviye 2 veya 3

---

## Hızlı Başlangıç

1. Firebase Console'a gidin: https://console.firebase.google.com
2. Projenizi seçin (klbk-620b0)
3. Realtime Database > Rules
4. **Seviye 1** kurallarını kopyalayıp yapıştırın
5. "Yayınla" butonuna tıklayın

⚠️ **Dikkat:** Rules değişikliği anında aktif olur. Test ettiğinizden emin olun!

---

## Şifre Sıfırlama Önerisi

Güvenlik için tüm kullanıcıların şifrelerini sıfırlatmanız önerilir:

1. Master panel'den her kullanıcının şifresini rastgele bir değere ayarlayın
2. Kullanıcılara yeni şifrelerini e-posta ile gönderin
3. İlk giriş sonrası şifre değiştirmeyi zorunlu kılın

---

## Destek ve Sorun Giderme

**Hata: "Permission Denied"**
- Rules'u kontrol edin
- Firebase Auth oturumu açık mı kontrol edin
- Browser console'da hata mesajını okuyun

**Firebase Auth test etmek için:**
```javascript
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log('Logged in as:', user.email);
    } else {
        console.log('Not logged in');
    }
});
```
