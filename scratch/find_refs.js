const fs = require('fs');
const path = require('path');

const dir = 'a:\\TOOLS\\kodlama\\km\\KLBK FRVR';
const files = fs.readdirSync(dir);
const htmlFiles = files.filter(f => f.endsWith('.html'));

const referencedFiles = new Set();

const regex = /(?:src|href)=["']([^"']+)["']/g;

htmlFiles.forEach(file => {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    let match;
    while ((match = regex.exec(content)) !== null) {
        let refPath = match[1];
        if (!refPath.startsWith('http') && !refPath.startsWith('data:')) {
             // Remove query params or hashes
            refPath = refPath.split('?')[0].split('#')[0];
            referencedFiles.add(refPath);
        }
    }
});

console.log("Referenced files:");
Array.from(referencedFiles).sort().forEach(f => console.log(f));
