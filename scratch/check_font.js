const https = require('https');

const fontsList20 = [
    "Roboto", "Open Sans", "Montserrat", "Lato", "Oswald",
    "Source Sans Pro", "Raleway", "PT Sans", "Merriweather", "Nunito",
    "Work Sans", "Fira Sans", "Rubik", "Mukta", "Quicksand",
    "Inter", "Ubuntu", "Karla", "Arimo", "Noto Sans"
];

let pending = fontsList20.length;

fontsList20.forEach(f => {
    const folder = f.toLowerCase().replace(/\s+/g, '-');
    const url = `https://cdn.jsdelivr.net/npm/@fontsource/${folder}/files/${folder}-latin-400-normal.woff`;
    
    https.get(url, (res) => {
        console.log(`${f}:`, res.statusCode);
        pending--;
        if (pending === 0) console.log("Done");
    }).on('error', (e) => {
        console.log(`${f}: ERROR ${e.message}`);
        pending--;
        if (pending === 0) console.log("Done");
    });
});
