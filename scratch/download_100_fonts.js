const https = require('https');
const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, '..', 'fonts');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir);

async function getAllFonts() {
    return new Promise((resolve) => {
        https.get('https://gwfh.mranftl.com/api/fonts', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) { resolve([]); }
            });
        }).on('error', () => resolve([]));
    });
}

async function downloadFont(id) {
    const destPath = path.join(destDir, `${id}-regular.ttf`);
    if (fs.existsSync(destPath)) return true;

    return new Promise((resolve) => {
        https.get(`https://gwfh.mranftl.com/api/fonts/${id}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const variant = json.variants.find(v => v.id === 'regular') || json.variants[0];
                    if (!variant || !variant.ttf) return resolve(false);
                    
                    const file = fs.createWriteStream(destPath);
                    https.get(variant.ttf, (res2) => {
                        res2.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            resolve(true);
                        });
                    }).on('error', () => {
                        fs.unlink(destPath, () => {});
                        resolve(false);
                    });
                } catch(e) { resolve(false); }
            });
        }).on('error', () => resolve(false));
    });
}

async function run() {
    console.log("Fetching font list...");
    const allFonts = await getAllFonts();
    // Filter for fonts that support latin-ext (Turkish)
    const turkishFonts = allFonts.filter(f => f.subsets.includes('latin-ext'));
    
    console.log(`Found ${turkishFonts.length} Turkish compatible fonts.`);
    
    // Take the top 100 (they are usually sorted by popularity in the API)
    const top100 = turkishFonts.slice(0, 100);
    
    const names = [];
    for (let i = 0; i < top100.length; i++) {
        const f = top100[i];
        process.stdout.write(`Downloading ${i+1}/100: ${f.family}... `);
        const success = await downloadFont(f.id);
        if (success) {
            console.log("OK");
            names.push(f.family);
        } else {
            console.log("FAILED");
        }
    }
    
    // Write the list of names to a file so we can update the UI
    fs.writeFileSync(path.join(__dirname, 'turkish_fonts.json'), JSON.stringify(names, null, 2));
    console.log("\nFinished downloading 100 Turkish fonts.");
    console.log("Font list saved to turkish_fonts.json");
}

run();
