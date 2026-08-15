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

        // Server-side password validation
        const crypto = require('crypto');
        const hashPassword = (pass) => {
            return crypto.createHash('sha256').update(pass).digest('hex');
        };

        const isHashedPassword = (pass) => {
            return pass && /^[a-f0-9]{64}$/i.test(pass);
        };

        const submittedPassword = password;
        let passwordIsValid = false;

        if (matchedUser.password) {
            if (isHashedPassword(matchedUser.password)) {
                // Database has hashed password
                const hashedSubmitted = hashPassword(submittedPassword);
                if (hashedSubmitted === matchedUser.password) {
                    passwordIsValid = true;
                }
            } else {
                // Database has plaintext password (legacy)
                if (submittedPassword === matchedUser.password) {
                    passwordIsValid = true;
                    // Migrate password to hash server-side
                    const newHash = hashPassword(submittedPassword);
                    try {
                        const patchUrl = `${firebaseDatabaseUrl}/app_store/klbk_users/${encodeURIComponent(actualUsername)}.json?auth=${firebaseSecret}`;
                        await fetch(patchUrl, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ password: newHash })
                        });
                        matchedUser.password = newHash; // Update memory object returned to client
                        console.log(`✓ Password migrated to hash on server for: ${actualUsername}`);
                    } catch (e) {
                        console.error('Password migration failed on server:', e);
                    }
                }
            }
        }

        // If the user's password field is empty in DB (e.g. they never set one), we might want to allow login?
        // Let's assume passwords are required. If not, we fail.
        if (!passwordIsValid && matchedUser.password) {
             return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre.' });
        }
        
        // Return user data 
        return res.status(200).json({ 
            success: true, 
            actualUsername, 
            user: matchedUser
        });

    } catch (error) {
        console.error("Login API Error:", error);
        return res.status(500).json({ error: 'Firebase veya Sunucu Hatası: ' + error.message });
    }
}
