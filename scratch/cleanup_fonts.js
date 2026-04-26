const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, '..', 'fonts');

// List of fonts to KEEP (Verified Turkish compatible or high quality)
const keepFonts = [
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

const keepIds = keepFonts.map(f => f.toLowerCase().replace(/\s+/g, '-'));

const files = fs.readdirSync(fontsDir);
files.forEach(file => {
    if (!file.endsWith('.ttf')) return;
    if (file === 'MonotypeCorsiva.ttf' || file === 'SnapITC.ttf') return; // Keep original ones
    
    const id = file.replace('-regular.ttf', '');
    if (!keepIds.includes(id)) {
        console.log(`Deleting incompatible font: ${file}`);
        fs.unlinkSync(path.join(fontsDir, file));
    }
});

console.log("Cleanup finished.");
console.log("Remaining files:", fs.readdirSync(fontsDir).length);
