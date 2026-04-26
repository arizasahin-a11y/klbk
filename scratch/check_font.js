const https = require('https');

https.get('https://gwfh.mranftl.com/api/fonts/roboto', (res) => {
    let data = '';
    res.on('data', c => data+=c);
    res.on('end', () => {
        const json = JSON.parse(data);
        const variant = json.variants.find(v => v.id === 'regular');
        console.log(variant.ttf);
    });
});
