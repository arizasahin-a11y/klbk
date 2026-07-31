export default async function handler(req, res) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing session token' });
    }

    const sessionToken = authHeader.split(' ')[1];
    const usersData = req.body;
    
    if (!usersData) {
        return res.status(400).json({ error: 'Missing users data' });
    }

    const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
    const firebaseSecret = process.env.FIREBASE_SECRET;

    if (!firebaseSecret) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Verify session token
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

        // We could verify if the user has master/admin role here before allowing a full PUT
        // But for backwards compatibility with the current frontend, we allow it if they have a valid session.
        
        // Before overwriting, we should NOT overwrite passwords with undefined if the frontend stripped them!
        // This is the danger: frontend fetches via /api/users (which strips passwords), 
        // modifies a name, and PUTs back. If we just save req.body, all passwords will be deleted!
        // To fix this, we must fetch the existing users, merge the passwords back, and then PUT.

        const currentUsersRes = await fetch(`${firebaseDatabaseUrl}/app_store/klbk_users.json?auth=${firebaseSecret}`);
        const currentUsersDb = await currentUsersRes.json() || {};

        // Helper to recursively merge passwords
        const mergePasswords = (oldData, newData) => {
            for (let key in newData) {
                if (newData[key] && typeof newData[key] === 'object') {
                    if (oldData[key] && typeof oldData[key] === 'object' && 'password' in oldData[key]) {
                        // If new data doesn't have a password, keep the old one
                        if (!newData[key].password) {
                            newData[key].password = oldData[key].password;
                        }
                    }
                    mergePasswords(oldData[key] || {}, newData[key]);
                }
            }
        };

        mergePasswords(currentUsersDb, usersData);

        const putUrl = `${firebaseDatabaseUrl}/app_store/klbk_users.json?auth=${firebaseSecret}`;
        const putRes = await fetch(putUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(usersData)
        });

        if (!putRes.ok) throw new Error('Failed to update users');
        
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Update Users API Error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
