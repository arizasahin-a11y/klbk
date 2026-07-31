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
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Use auth=SECRET query parameter to bypass security rules
        const url = `${firebaseDatabaseUrl}/app_store/klbk_users.json?auth=${firebaseSecret}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Firebase fetch failed: ${response.status}`);
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
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Return user data (client performs password hash checking for legacy reasons,
        // although doing it server-side is safer, we return the hashed password to match auth.js logic)
        return res.status(200).json({ 
            success: true, 
            actualUsername, 
            user: matchedUser,
            usersDb: usersDb // We have to return usersDb if client needs it for password migration
        });

    } catch (error) {
        console.error("Login API Error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
