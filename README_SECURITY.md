# KLBK FRVR - Güvenlik ve API Yapılandırması

Sistemin güvenliğini (İstemci tarafında veritabanının açık olması açığını) gidermek için projeye **Vercel Serverless API** entegrasyonu yapılmıştır.

## Yenilikler
1. **`api/login.js`**: Kullanıcıların şifre ve kullanıcı adları sunucu tarafında doğrulanır. İstemciye (tarayıcıya) tüm veritabanı indirilmez.
2. **`api/users.js`**: Uygulamanın diğer sayfalarında (öğretmenler listesi vb.) şifreler **temizlenerek** istemciye aktarılır.
3. **`api/updateUsers.js`**: Herhangi bir öğretmen / admin güncelleme yaptığında tüm veritabanının üzerine yazılması engellenmiş, güvenli bir "merge" (birleştirme) ve `PATCH` mimarisine geçilmiştir.
4. **`js/ui_modules/`**: `ui.js` içindeki 8000 satırlık dev yapıdan hesap ayarları gibi modüller ayrılarak `account_settings.js` içerisine alınmış ve modülerleştirme başlatılmıştır.

## ⚠️ DİKKAT: Vercel Üzerinde Yapılması Gerekenler

API dosyaları `process.env.FIREBASE_SECRET` adlı bir çevre değişkenine ihtiyaç duyar. Aksi takdirde API veritabanına erişemez.

Lütfen Vercel panelinizde şu adımları izleyin:
1. Projenize gidin -> **Settings** -> **Environment Variables**.
2. **Key** kısmına `FIREBASE_SECRET` yazın.
3. **Value** kısmına Firebase projenizin "Veritabanı Gizli Anahtarı"nı (Database Secret) yazıp kaydedin. (Firebase Konsolu -> Proje Ayarları -> Hizmet Hesapları -> Veritabanı Sırları yolundan bulabilirsiniz).
4. Değişkeni ekledikten sonra projeyi yeniden deploy edin (Redeploy).

## Firebase Kuralları
API'ler aktif olduktan sonra Firebase kurallarınızı (`firebase.rules.json`) şu şekilde güncelleyebilirsiniz:
```json
{
  "rules": {
    "app_store": {
      "klbk_users": {
        ".read": false,
        ".write": false
      }
    }
  }
}
```
*Not: Sistem API üzerinden erişeceği için, `.read: false` kuralına rağmen API'ler başarıyla çalışmaya devam edecektir.*
