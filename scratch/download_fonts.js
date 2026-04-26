const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsList20 = [
    "Roboto", "Open Sans", "Montserrat", "Lato", "Oswald",
    "Source Sans Pro", "Raleway", "PT Sans", "Merriweather", "Nunito",
    "Work Sans", "Fira Sans", "Rubik", "Mukta", "Quicksand",
    "Inter", "Ubuntu", "Karla", "Arimo", "Noto Sans"
];

const destDir = path.join(__dirname, '..', 'fonts');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir);

async function downloadFont(fName) {
    const id = fName.toLowerCase().replace(/\s+/g, '-');
    const destPath = path.join(destDir, `${id}-regular.ttf`);
    
    if (fs.existsSync(destPath)) {
        console.log(`Already exists: ${id}`);
        return;
    }

    return new Promise((resolve) => {
        // Use Google Webfonts Helper API to get the TTF link
        https.get(`https://gwfh.mranftl.com/api/fonts/${id}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const variant = json.variants.find(v => v.id === 'regular') || json.variants[0];
                    if (!variant || !variant.ttf) {
                        console.error(`No TTF for ${id}`);
                        return resolve();
                    }
                    
                    const file = fs.createWriteStream(destPath);
                    https.get(variant.ttf, (res2) => {
                        res2.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            console.log(`Downloaded: ${id}`);
                            resolve();
                        });
                    }).on('error', (err) => {
                        fs.unlink(destPath, () => {});
                        console.error(`Download error ${id}: ${err.message}`);
                        resolve();
                    });
                } catch(e) {
                    console.error(`Parse error ${id}`);
                    resolve();
                }
            });
        }).on('error', (err) => {
            console.error(`API error ${id}: ${err.message}`);
            resolve();
        });
    });
}

async function run() {
    for (const font of fontsList20) {
        await downloadFont(font);
    }
    console.log("All downloads finished.");
}

run();
