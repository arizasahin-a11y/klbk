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
console.log('Keys in temp_users:', Object.keys(data));

// If it has a school or students array inside the store:
// Let's find any nested 'students' arrays.
function findStudents(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj.students)) {
        console.log(`Found students array at: ${path}students, count: ${obj.students.length}`);
        
        // Let's inspect 11C students here
        const stds11C = obj.students.filter(s => s.class && s.class.includes('11C'));
        console.log(`  11C students count: ${stds11C.length}`);
        const byAlan = {};
        stds11C.forEach(s => {
            const alan = s.alan || 'Genel';
            if (!byAlan[alan]) byAlan[alan] = [];
            byAlan[alan].push(s);
        });
        Object.entries(byAlan).forEach(([alan, list]) => {
            console.log(`    Alan: ${alan} (${list.length} students)`);
            const courses = new Set();
            list.forEach(s => {
                if (s.dersler) s.dersler.forEach(d => courses.add(d));
            });
            console.log(`      Courses: ${Array.from(courses).join(', ')}`);
        });
    }
    for (let k in obj) {
        if (obj[k] && typeof obj[k] === 'object') {
            findStudents(obj[k], `${path}${k} -> `);
        }
    }
}

findStudents(data);
