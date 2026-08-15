export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const firebaseDatabaseUrl = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app";
    const firebaseSecret = process.env.FIREBASE_SECRET;

    if (!firebaseSecret) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const usersUrl = `${firebaseDatabaseUrl}/app_store/klbk_users.json?auth=${firebaseSecret}`;
        const usersRes = await fetch(usersUrl);
        if (!usersRes.ok) throw new Error('Failed to fetch users');
        
        const usersDb = await usersRes.json();
        if (!usersDb) return res.status(404).json({ error: 'No users found' });

        const crypto = require('crypto');
        const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(firebaseSecret)).digest('base64').substring(0, 32); 
        
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

        const isAesEncrypted = (pass) => pass && typeof pass === 'string' && pass.includes(':') && pass.split(':')[0].length === 32;

        let foundUser = null;
        for (const [uname, data] of Object.entries(usersDb)) {
            if (data.email && data.email.toLowerCase() === email.toLowerCase()) {
                foundUser = { username: uname, ...data };
                break;
            }
        }

        if (!foundUser) {
            // Return success even if not found to prevent email enumeration attacks
            return res.status(200).json({ success: true, message: 'If email exists, sent.' });
        }

        let plainPassword = foundUser.password;
        if (isAesEncrypted(foundUser.password)) {
            plainPassword = decryptPassword(foundUser.password);
        }

        // Send via EmailJS REST API
        const emailjsPayload = {
            service_id: "service_205ar93",
            template_id: "template_i0eo9o5",
            user_id: "0gioGMhJGYrohmvyz",
            template_params: {
                to_email: email,
                email: email,
                user_email: email,
                username: foundUser.username,
                password: plainPassword || '---',
                school_name: foundUser.schoolName || 'Kelebek Sistemi'
            }
        };

        const emailjsRes = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailjsPayload)
        });

        if (!emailjsRes.ok) {
            const errText = await emailjsRes.text();
            console.error("EmailJS API Error:", errText);
            return res.status(500).json({ error: 'Failed to send email' });
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Forgot Password API Error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
