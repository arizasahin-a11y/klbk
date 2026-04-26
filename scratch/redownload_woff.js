const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsListTurkish = [
    "Roboto", "Open Sans", "Inter", "Montserrat", "Poppins", "Lato", "Roboto Condensed", "Arimo",
    "Roboto Mono", "Oswald", "Noto Sans", "Raleway", "Nunito", "Playfair Display", "DM Sans", "Nunito Sans", "Rubik", "Roboto Slab",
    "Ubuntu", "Merriweather", "Archivo Black", "Work Sans", "PT Sans", "Outfit", "Manrope", "Kanit", "Fjalla One",
    "Mulish", "Lora", "Figtree", "Bebas Neue", "Quicksand", "Prompt", "Barlow", "Saira", "IBM Plex Sans",
    "Fira Sans", "Source Sans 3", "Titillium Web", "Karla", "Jost", "Heebo", "Bricolage Grotesque", "Smooch Sans", "Plus Jakarta Sans", "Noto Serif",
    "Archivo", "PT Serif", "Inconsolata", "Source Code Pro", "Libre Baskerville", "Dancing Script", "Josefin Sans", "Cairo", "Libre Franklin",
    "EB Garamond", "Barlow Condensed", "Anton", "Dosis", "Assistant", "Cabin", "Public Sans", "Space Grotesk", "Cormorant Garamond",
    "Schibsted Grotesk", "Roboto Flex", "Instrument Serif", "Bungee", "Bitter", "Alfa Slab One", "Pacifico",
    "Exo 2", "Inter Tight", "Red Hat Display", "Sora", "Oxygen", "Hind", "Slabo 27px", "Lobster", "Lexend",
    "Mukta", "Caveat", "Fredoka", "Rajdhani", "Crimson Text", "PT Sans Narrow", "Comfortaa", "JetBrains Mono", "Urbanist", "Merriweather Sans"
];

const destDir = path.join(__dirname, '..', 'fonts');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir);

async function downloadWoff(fName) {
    const id = fName.toLowerCase().replace(/\s+/g, '-');
    const destPath = path.join(destDir, `${id}-regular.woff`);
    
    // Even if exists, let's overwrite to ensure validity (WOFF is safer)
    // if (fs.existsSync(destPath)) return true;

    const url = `https://cdn.jsdelivr.net/npm/@fontsource/${id}/files/${id}-latin-400-normal.woff`;
    
    return new Promise((resolve) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                console.error(`Error ${res.statusCode} for ${id}`);
                return resolve(false);
            }
            const file = fs.createWriteStream(destPath);
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(true);
            });
        }).on('error', (err) => {
            console.error(`Request error ${id}: ${err.message}`);
            resolve(false);
        });
    });
}

async function run() {
    console.log("Downloading WOFF fonts...");
    for (let i = 0; i < fontsListTurkish.length; i++) {
        const f = fontsListTurkish[i];
        process.stdout.write(`[${i+1}/${fontsListTurkish.length}] ${f}... `);
        const success = await downloadWoff(f);
        if (success) {
            console.log("OK");
        } else {
            console.log("FAILED");
        }
    }
    console.log("\nFinished downloading all WOFF fonts.");
}

run();
