const https = require('https');
const fs = require('fs');
const path = require('path');

const newFonts = ["Tinos", "Cousine"];

const destDir = path.join(__dirname, '..', 'fonts');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir);

async function downloadWoff(fName) {
    const id = fName.toLowerCase().replace(/\s+/g, '-');
    const destPath = path.join(destDir, `${id}-regular.woff`);
    const url = `https://cdn.jsdelivr.net/npm/@fontsource/${id}/files/${id}-latin-400-normal.woff`;
    
    return new Promise((resolve) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) return resolve(false);
            const file = fs.createWriteStream(destPath);
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(true); });
        }).on('error', () => resolve(false));
    });
}

async function run() {
    for (const f of newFonts) {
        process.stdout.write(`Downloading ${f}... `);
        const success = await downloadWoff(f);
        console.log(success ? "OK" : "FAILED");
    }
}

run();
