const https = require('https');

const options = {
  hostname: 'gwfh.mranftl.com',
  port: 443,
  path: '/api/fonts/open-sans',
  method: 'GET',
  headers: {
    'Origin': 'http://localhost:3000'
  }
};

const req = https.request(options, res => {
  console.log('Headers:', res.headers);
});
req.end();
