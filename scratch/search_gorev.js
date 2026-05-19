const fs = require('fs');
const path = require('path');

const dir = 'js';
const files = fs.readdirSync(dir);

files.forEach(file => {
    if (file === 'teachers.js') return;
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    const lines = content.split('\n');
    let matches = [];
    lines.forEach((line, i) => {
        if (line.toLowerCase().includes('görev') || line.toLowerCase().includes('gorev') || line.toLowerCase().includes('teacher')) {
            matches.push(`Line ${i + 1}: ${line.trim()}`);
        }
    });
    
    if (matches.length > 0) {
        console.log(`\nFile: ${filePath} (${matches.length} matches)`);
        matches.slice(0, 15).forEach(m => console.log('  ' + m));
    }
});
