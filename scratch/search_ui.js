const fs = require('fs');

function searchFile(path, query) {
    let content = fs.readFileSync(path);
    if (content[0] === 0xFF && content[1] === 0xFE) {
        content = content.subarray(2).toString('utf16le');
    } else if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
        content = content.subarray(3).toString('utf8');
    } else {
        content = content.toString('utf8');
    }
    
    const lines = content.split('\n');
    let found = false;
    lines.forEach((line, i) => {
        if (line.toLowerCase().includes(query.toLowerCase())) {
            console.log(`Line ${i + 1}: ${line.trim()}`);
            found = true;
        }
    });
    if (!found) {
        console.log(`No matches found for "${query}"`);
    }
}

searchFile('js/ui.js', 'TDE');
searchFile('js/ui.js', 'Seçmeli');
