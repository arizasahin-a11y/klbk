export default async function handler(req, res) {
    const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
    const firebaseSecret = process.env.FIREBASE_SECRET;

    if (!firebaseSecret) {
        return res.status(500).json({ error: 'Sunucu yapılandırma hatası: FIREBASE_SECRET eksik.' });
    }

    const crypto = require('crypto');
    const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(firebaseSecret)).digest('base64').substring(0, 32); 
    const IV_LENGTH = 16;
    
    const encryptPassword = (text) => {
        let iv = crypto.randomBytes(IV_LENGTH);
        let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    };

    const decryptPassword = (text) => {
        try {
            let textParts = text.split(':');
            if (textParts.length !== 2) return null;
            let iv = Buffer.from(textParts[0], 'hex');
            let encryptedText = Buffer.from(textParts[1], 'hex');
            let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (e) {
            return null;
        }
    };

    const isAesEncrypted = (pass) => pass && typeof pass === 'string' && pass.includes(':') && pass.split(':')[0].length === 32;
    const isHashedPassword = (pass) => pass && typeof pass === 'string' && /^[a-f0-9]{64}$/i.test(pass);
    const hashPasswordLegacy = (pass) => crypto.createHash('sha256').update(pass).digest('hex');

    const findDeepUser = (obj, targetPath) => {
        const parts = targetPath.split('.');
        let current = obj;
        for (const p of parts) {
            if (current && typeof current === 'object' && p in current) {
                current = current[p];
            } else {
                return null;
            }
        }
        return (current && typeof current === 'object' && ('password' in current || 'role' in current || 'name' in current)) ? current : null;
    };

    const flattenUsers = (obj, prefix = '') => {
        let results = {};
        for (const k in obj) {
            const newKey = prefix ? `${prefix}.${k}` : k;
            if (obj[k] && typeof obj[k] === 'object' && 'password' in obj[k]) {
                results[newKey] = obj[k];
            } else if (obj[k] && typeof obj[k] === 'object') {
                Object.assign(results, flattenUsers(obj[k], newKey));
            }
        }
        return results;
    };

    // --- GET METHOD: Retrieve user info for modal (without password) ---
    if (req.method === 'GET') {
        const username = req.query.username;
        if (!username) {
            return res.status(400).json({ error: 'Kullanıcı adı belirtilmedi.' });
        }

        try {
            const usersUrl = `${firebaseDatabaseUrl}/app_store/klbk_users.json?auth=${firebaseSecret}`;
            const usersRes = await fetch(usersUrl);
            if (!usersRes.ok) throw new Error('Kullanıcı veritabanına erişilemedi.');
            const usersDb = await usersRes.json() || {};

            let user = usersDb[username];
            let actualKey = username;

            if (!user && username.includes('.')) {
                user = findDeepUser(usersDb, username);
            }

            if (!user) {
                const flat = flattenUsers(usersDb);
                for (const [uname, u] of Object.entries(flat)) {
                    if (uname.toLowerCase() === username.toLowerCase() || (u && u.email && u.email.toLowerCase() === username.toLowerCase())) {
                        user = u;
                        actualKey = uname;
                        break;
                    }
                }
            }

            if (!user) {
                return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
            }

            return res.status(200).json({
                username: actualKey,
                name: user.name || actualKey,
                email: user.email || '',
                gender: user.gender || 'erkek',
                schoolName: user.schoolName || '',
                role: user.role || 'ogretmen'
            });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    // --- POST METHOD: Verify current password & update user profile ---
    if (req.method === 'POST') {
        const { currentUser, currentPassword, newUsername, email, gender, newPassword } = req.body;

        if (!currentUser) {
            return res.status(400).json({ error: 'Kullanıcı adı eksik.' });
        }
        if (!currentPassword) {
            return res.status(400).json({ error: 'İşlemi onaylamak için güncel şifrenizi girmelisiniz.' });
        }

        try {
            const usersUrl = `${firebaseDatabaseUrl}/app_store/klbk_users.json?auth=${firebaseSecret}`;
            const usersRes = await fetch(usersUrl);
            if (!usersRes.ok) throw new Error('Kullanıcı veritabanı okunamadı.');
            const usersDb = await usersRes.json() || {};

            let matchedUser = usersDb[currentUser];
            let actualKey = currentUser;

            if (!matchedUser && currentUser.includes('.')) {
                matchedUser = findDeepUser(usersDb, currentUser);
            }

            if (!matchedUser) {
                const flat = flattenUsers(usersDb);
                for (const [uname, u] of Object.entries(flat)) {
                    if (uname.toLowerCase() === currentUser.toLowerCase() || (u && u.email && u.email.toLowerCase() === currentUser.toLowerCase())) {
                        matchedUser = u;
                        actualKey = uname;
                        break;
                    }
                }
            }

            if (!matchedUser) {
                return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
            }

            // Doğrulama: Güncel şifre kontrolü (AES-256, legacy SHA-256 veya düz metin)
            let passwordIsValid = false;
            const storedPassword = matchedUser.password;

            if (storedPassword) {
                if (isAesEncrypted(storedPassword)) {
                    const decrypted = decryptPassword(storedPassword);
                    if (decrypted === currentPassword) {
                        passwordIsValid = true;
                    }
                } else if (isHashedPassword(storedPassword)) {
                    if (hashPasswordLegacy(currentPassword) === storedPassword) {
                        passwordIsValid = true;
                    }
                } else {
                    if (currentPassword === storedPassword) {
                        passwordIsValid = true;
                    }
                }
            }

            if (!passwordIsValid) {
                return res.status(401).json({ error: 'Güncel şifreniz hatalı!' });
            }

            // Kullanıcı adı değişikliği kontrolü
            const targetUsername = (newUsername && newUsername.trim()) ? newUsername.trim() : actualKey;
            if (targetUsername !== actualKey && usersDb[targetUsername]) {
                return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış!' });
            }

            // Profil alanlarını güncelle
            if (typeof email === 'string') matchedUser.email = email.trim();
            if (gender) matchedUser.gender = gender;

            // Yeni şifre belirlendiyse AES-256 ile şifrele
            if (newPassword && newPassword.trim() !== '') {
                matchedUser.password = encryptPassword(newPassword.trim());
            } else if (!isAesEncrypted(matchedUser.password)) {
                // Eski şifre plaintext veya sha-256 ise AES'e geçir
                matchedUser.password = encryptPassword(currentPassword);
            }

            // Kullanıcı adı değiştiyse anahtarı ve storeKey'i güncelle
            if (targetUsername !== actualKey) {
                if (matchedUser.storeKey === `klbk_data_${actualKey}`) {
                    matchedUser.storeKey = `klbk_data_${targetUsername}`;
                }
                usersDb[targetUsername] = matchedUser;
                delete usersDb[actualKey];
            } else {
                usersDb[actualKey] = matchedUser;
            }

            // Firebase'e kaydet
            const putRes = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json?auth=${firebaseSecret}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(usersDb)
            });

            if (!putRes.ok) {
                throw new Error('Veritabanına kaydedilirken hata oluştu.');
            }

            return res.status(200).json({
                success: true,
                username: targetUsername,
                email: matchedUser.email,
                gender: matchedUser.gender,
                storeKey: matchedUser.storeKey
            });

        } catch (error) {
            console.error("Update Profile Error:", error);
            return res.status(500).json({ error: error.message || 'Sunucu hatası oluştu.' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
