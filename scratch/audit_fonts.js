const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit'); // Assuming it's available or can be required if node_modules exists

const fontsDir = path.join(__dirname, '..', 'fonts');
const files = fs.readdirSync(fontsDir);

const TR_CHARS = ['İ', 'ı', 'Ğ', 'ğ', 'Ş', 'ş', 'Ç', 'ç', 'Ö', 'ö', 'Ü', 'ü'];

files.forEach(file => {
    if (!file.endsWith('.woff') && !file.endsWith('.ttf')) return;
    
    try {
        const fontPath = path.join(fontsDir, file);
        const font = fontkit.openSync(fontPath);
        
        const missing = TR_CHARS.filter(char => {
            const glyph = font.glyphForCodePoint(char.codePointAt(0));
            return !glyph || glyph.id === 0; // 0 is usually .notdef
        });
        
        if (missing.length > 0) {
            console.log(`DELETE: ${file} (Missing: ${missing.join('')})`);
            // fs.unlinkSync(fontPath); // Uncomment to actually delete
        } else {
            console.log(`KEEP: ${file} (Full TR Support)`);
        }
    } catch (e) {
        console.log(`ERROR: ${file} (${e.message})`);
    }
});
