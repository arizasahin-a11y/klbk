export default async function handler(req, res) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { permissions } = req.body;
    
    if (!permissions) {
        return res.status(400).json({ error: 'Missing permissions data' });
    }

    const firebaseDatabaseUrl = 'https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app';
    const firebaseSecret = process.env.FIREBASE_SECRET;

    if (!firebaseSecret) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const updateUrl = `${firebaseDatabaseUrl}/app_store/klbk_app_permissions.json?auth=${firebaseSecret}`;
        
        const updateRes = await fetch(updateUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(permissions)
        });

        if (!updateRes.ok) {
            const errText = await updateRes.text();
            throw new Error(`Firebase Error: ${updateRes.status} ${errText}`);
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Update Permissions Error:', error);
        return res.status(500).json({ error: 'Database error: ' + error.message });
    }
}
