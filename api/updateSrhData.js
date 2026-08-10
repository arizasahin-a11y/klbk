export default async function handler(req, res) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing session token' });
    }

    const sessionToken = authHeader.split(' ')[1];
    const srhData = req.body;
    
    if (!srhData) {
        return res.status(400).json({ error: 'Missing srh data' });
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

        const putUrl = `${firebaseDatabaseUrl}/app_store/srh_data.json?auth=${firebaseSecret}`;
        const putRes = await fetch(putUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(srhData)
        });

        if (!putRes.ok) throw new Error('Failed to update SRH data');
        
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Update SRH Data API Error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
