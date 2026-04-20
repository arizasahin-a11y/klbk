const https = require('https');

const options = {
    hostname: 'klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app',
    path: '/app_store/klbk_users/mimeversion10.json',
    method: 'DELETE',
    headers: {
        'Content-Type': 'application/json',
    }
};

const req = https.request(options, (res) => {
    console.log('Firebase Response Status:', res.statusCode);
});

req.on('error', (e) => {
    console.error('Problem with request:', e.message);
});

req.end();
