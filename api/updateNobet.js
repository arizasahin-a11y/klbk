export default async function handler(req, res) {
    if (req.method !== 'PUT' && req.method !== 'PATCH' && req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { path, data } = req.body;
    
    if (!path || (req.method !== 'DELETE' && data === undefined)) {
        return res.status(400).json({ error: 'Missing path or data' });
    }

    const firebaseDatabaseUrl = 'https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app';
    const firebaseSecret = process.env.FIREBASE_SECRET;

    if (!firebaseSecret) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const updateUrl = `${firebaseDatabaseUrl}/app_store/klbk_nobet/${path}.json?auth=${firebaseSecret}`;
        
        let fetchOptions = {
            method: req.method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (req.method !== 'DELETE') {
            fetchOptions.body = JSON.stringify(data);
        }
        
        const updateRes = await fetch(updateUrl, fetchOptions);
        
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
