const https = require('https');

https.get('https://gwfh.mranftl.com/api/fonts/open-sans', (res) => {
    let data = '';
    res.on('data', c => data+=c);
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        console.log("Data:", data.substring(0, 100));
    });
});
