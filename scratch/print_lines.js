const fs = require('fs');
let content = fs.readFileSync('temp_users.json');
if (content[0] === 0xFF && content[1] === 0xFE) {
    content = content.subarray(2).toString('utf16le');
} else if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
    content = content.subarray(3).toString('utf8');
} else {
    content = content.toString('utf8');
}

const lines = content.split('\n');
for (let i = 20; i < 60; i++) {
    console.log(`${i+1}: ${lines[i]}`);
}
