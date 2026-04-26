const fs = require('fs');
const fontkit = require('fontkit'); // Assuming fontkit is available in the environment

const fontPath = 'a:\\TOOLS\\kodlama\km\\KLBK FRVR\\fonts\\poppins-regular.ttf';

try {
    const buffer = fs.readFileSync(fontPath);
    console.log("Buffer size:", buffer.length);
    const font = fontkit.create(buffer);
    console.log("Font loaded:", font.familyName);
    console.log("Glyph count:", font.numGlyphs);
} catch (e) {
    console.error("Fontkit error:", e);
}
