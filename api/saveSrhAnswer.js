// Saves a student's SRH (Rehberlik Sosyal Uygulamalar) answers to Firebase.
// No session token required — students are not logged in via the admin system.
// Rate limiting / abuse protection is left to Firebase rules (or can be added later).
export default async function handler(req, res) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { appId, studentNo, payload } = req.body;

    if (!appId || !studentNo || !payload) {
        return res.status(400).json({ error: 'Missing appId, studentNo, or payload' });
    }

    const firebaseDatabaseUrl = 'https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app';
    const firebaseSecret = process.env.FIREBASE_SECRET;

    if (!firebaseSecret) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const url = `${firebaseDatabaseUrl}/app_store/srh_answers/${appId}/${studentNo}.json?auth=${firebaseSecret}`;
        const firebaseRes = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!firebaseRes.ok) {
            const errText = await firebaseRes.text();
            throw new Error('Firebase write failed: ' + errText);
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('saveSrhAnswer API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
