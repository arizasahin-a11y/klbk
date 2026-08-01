export default async function handler(req, res) {
    if (req.method !== 'PUT' && req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { path, data } = req.body;
    
    if (!path || data === undefined) {
        return res.status(400).json({ error: 'Missing path or data' });
    }

    const firebaseDatabaseUrl = 'https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app';
    const firebaseSecret = process.env.FIREBASE_SECRET;

    if (!firebaseSecret) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const updateUrl = \\/app_store/klbk_nobet/\.json?auth=\\;
        
        const updateRes = await fetch(updateUrl, {
            method: req.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!updateRes.ok) {
            const err = await updateRes.text();
            throw new Error('Firebase write failed: ' + err);
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Update Nobet API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
