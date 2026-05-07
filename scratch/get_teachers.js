const fs = require('fs');

try {
    let data = fs.readFileSync('a:\\TOOLS\\kodlama\\km\\KLBK FRVR\\temp_users.json', 'utf16le');
    // Remove BOM if present
    if (data.charCodeAt(0) === 0xFEFF) {
        data = data.slice(1);
    }
    const users = JSON.parse(data);
    const names = [];
    for (const uname in users) {
        if (users[uname].name && (users[uname].role === 'ogretmen' || users[uname].role === 'idareci' || users[uname].role === 'admin')) {
            names.push(users[uname].name);
        }
    }
    // Remove duplicates
    const uniqueNames = [...new Set(names)];
    uniqueNames.sort((a, b) => a.localeCompare(b, 'tr'));
    console.log(uniqueNames.join('\n'));
} catch (e) {
    console.error(e);
}
