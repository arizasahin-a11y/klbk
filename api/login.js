export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, password } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username required' });
    }

    // Firebase REST API URL
    const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
    const firebaseSecret = process.env.FIREBASE_SECRET;

    if (!firebaseSecret) {
        console.error("FIREBASE_SECRET environment variable is not set.");
        return res.status(500).json({ error: 'FIREBASE_SECRET_MISSING', env_keys: Object.keys(process.env).join(',') });
    }

    try {
        // Use auth=SECRET query parameter to bypass security rules
        const url = `${firebaseDatabaseUrl}/app_store/klbk_users.json?auth=${firebaseSecret}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Firebase fetch failed: ${response.status} - ${errText}`);
        }
        
        const usersDb = await response.json();
        if (!usersDb) {
            return res.status(404).json({ error: 'No users found' });
        }

        // Helper to find a user in a potentially nested object
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
            return (current && typeof current === 'object' && 'password' in current) ? current : null;
        };

        let matchedUser = usersDb[username];
        let actualUsername = username;

        if (!matchedUser && username.includes('.')) {
            matchedUser = findDeepUser(usersDb, username);
        }

        if (!matchedUser) {
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

            const flatUsers = flattenUsers(usersDb);
            for (const [uname, data] of Object.entries(flatUsers)) {
                if (data.email && data.email.toLowerCase() === username.toLowerCase()) {
                    matchedUser = data;
                    actualUsername = uname;
                    break;
                }
            }
        }

        if (!matchedUser) {
            return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre.' });
        }

        // Security helpers
        const crypto = require('crypto');
        
        // Ensure secret is 32 bytes for AES-256
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

        const hashPasswordLegacy = (pass) => {
            return crypto.createHash('sha256').update(pass).digest('hex');
        };

        const isAesEncrypted = (pass) => pass && typeof pass === 'string' && pass.includes(':') && pass.split(':')[0].length === 32;
        const isHashedPassword = (pass) => pass && typeof pass === 'string' && /^[a-f0-9]{64}$/i.test(pass);

        const submittedPassword = password;
        let passwordIsValid = false;
        let needsAesMigration = false;

        if (matchedUser.password) {
            if (isAesEncrypted(matchedUser.password)) {
                // New AES encrypted password
                const decrypted = decryptPassword(matchedUser.password);
                if (decrypted === submittedPassword) {
                    passwordIsValid = true;
                }
            } else if (isHashedPassword(matchedUser.password)) {
                // Legacy SHA-256 password
                const hashedSubmitted = hashPasswordLegacy(submittedPassword);
                if (hashedSubmitted === matchedUser.password) {
                    passwordIsValid = true;
                    needsAesMigration = true;
                }
            } else {
                // Legacy Plaintext password
                if (submittedPassword === matchedUser.password) {
                    passwordIsValid = true;
                    needsAesMigration = true;
                }
            }
        }

        if (passwordIsValid && needsAesMigration) {
            const newAesHash = encryptPassword(submittedPassword);
            try {
                const patchUrl = `${firebaseDatabaseUrl}/app_store/klbk_users/${encodeURIComponent(actualUsername)}.json?auth=${firebaseSecret}`;
                await fetch(patchUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: newAesHash })
                });
                matchedUser.password = newAesHash;
                console.log(`✓ Password migrated to AES on server for: ${actualUsername}`);
            } catch (e) {
                console.error('Password migration to AES failed:', e);
            }
        }

        // If the user's password field is empty in DB (e.g. they never set one), we might want to allow login?
        // Let's assume passwords are required. If not, we fail.
        if (!passwordIsValid && matchedUser.password) {
             return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre.' });
        }
        
        // Generate a secure session token
        const sessionToken = crypto.randomUUID();
        const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours validity
        
        const sessionData = {
            username: actualUsername,
            role: matchedUser.role || 'user',
            storeKey: matchedUser.storeKey || `klbk_data_${actualUsername}`,
            expiresAt: expiresAt,
            createdAt: Date.now()
        };

        try {
            const sessionUrl = `${firebaseDatabaseUrl}/app_store/active_sessions/${sessionToken}.json?auth=${firebaseSecret}`;
            await fetch(sessionUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            });
        } catch (e) {
            console.error('Failed to store session token:', e);
        }

        // Return user data 
        return res.status(200).json({ 
            success: true, 
            actualUsername, 
            user: matchedUser,
            token: sessionToken
        });

    } catch (error) {
        console.error("Login API Error:", error);
        return res.status(500).json({ error: 'Firebase veya Sunucu Hatası: ' + error.message });
    }
}
