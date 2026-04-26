const https = require('https');

const url = 'https://cdn.jsdelivr.net/npm/@fontsource/fira-sans/files/fira-sans-latin-400-normal.woff';

https.get(url, (res) => {
    res.once('data', (chunk) => {
        console.log("Signature:", chunk.slice(0, 4));
    });
});
