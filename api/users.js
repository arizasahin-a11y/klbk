export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing session token' });
    }

    const sessionToken = authHeader.split(' ')[1];
    
    const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
    const firebaseSecret = process.env.FIREBASE_SECRET;

    if (!firebaseSecret) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // First verify the session token
        const sessionUrl = `${firebaseDatabaseUrl}/app_store/active_sessions/${sessionToken}.json?auth=${firebaseSecret}`;
        const sessionRes = await fetch(sessionUrl);
        if (!sessionRes.ok) throw new Error('Session verification failed');
        
        const sessionData = await sessionRes.json();
        
        if (!sessionData) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
        
        if (sessionData.expiresAt && sessionData.expiresAt < Date.now()) {
            return res.status(401).json({ error: 'Session expired' });
        }

        // Only allow master, admin, idareci, mudur, mudur_yardimcisi to fetch full user list
        // Or if they just need to load it for dashboard... Wait, teachers.js also loads it.
        // For simplicity and backwards compatibility, if they have a valid session, let them read it.
        
        const usersUrl = `${firebaseDatabaseUrl}/app_store/klbk_users.json?auth=${firebaseSecret}`;
        const usersRes = await fetch(usersUrl);
        if (!usersRes.ok) throw new Error('Failed to fetch users');
        
        const usersDb = await usersRes.json();
        
        // SECURITY: Strip out all passwords before returning to the client
        if (usersDb) {
            const stripPasswords = (obj) => {
                for (let key in obj) {
                    if (obj[key] && typeof obj[key] === 'object') {
                        if ('password' in obj[key]) {
                            delete obj[key].password;
                        }
                        stripPasswords(obj[key]);
                    }
                }
            };
            stripPasswords(usersDb);
        }

        return res.status(200).json(usersDb);

    } catch (error) {
        console.error("Users API Error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
