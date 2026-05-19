const fs = require('fs');

function readJsonFile(path) {
    let content = fs.readFileSync(path);
    if (content[0] === 0xFF && content[1] === 0xFE) {
        content = content.subarray(2).toString('utf16le');
    } else if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
        content = content.subarray(3).toString('utf8');
    } else {
        content = content.toString('utf8');
    }
    return JSON.parse(content);
}

const data = readJsonFile('temp_users.json');

for (let username in data) {
    const userStore = data[username];
    if (userStore && userStore.students && Array.isArray(userStore.students)) {
        const stds11C = userStore.students.filter(s => s.class && s.class.includes('11C'));
        if (stds11C.length > 0) {
            console.log(`\nUser: ${username} has 11C students:`);
            const byAlan = {};
            stds11C.forEach(s => {
                const alan = s.alan || 'Genel';
                if (!byAlan[alan]) byAlan[alan] = [];
                byAlan[alan].push(s);
            });
            Object.entries(byAlan).forEach(([alan, list]) => {
                console.log(`  Alan: ${alan} (${list.length} students)`);
                const courses = new Set();
                list.forEach(s => {
                    if (s.dersler) s.dersler.forEach(d => courses.add(d));
                });
                console.log(`    Courses: ${Array.from(courses).join(', ')}`);
            });
        }
    }
}
