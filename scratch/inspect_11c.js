const fs = require('fs');

function readJsonFile(path) {
    try {
        let content = fs.readFileSync(path);
        if (content[0] === 0xFF && content[1] === 0xFE) {
            content = content.subarray(2).toString('utf16le');
        } else if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
            content = content.subarray(3).toString('utf8');
        } else {
            content = content.toString('utf8');
        }
        return JSON.parse(content);
    } catch (e) {
        return null;
    }
}

// Let's find where the active school data or student data is.
// Since DataManager reads it from localStorage or firebase, let's see if we have master backups or users files.
const files = ['temp_users.json', 'users_final.json', 'users_final_clean.json', 'klbk_users_cloud.json'];
files.forEach(file => {
    const data = readJsonFile(file);
    if (!data) return;
    console.log(`\n--- File: ${file} ---`);
    const students = Array.isArray(data) ? data : Object.values(data);
    
    // Let's filter students of class 11C
    const students11C = students.filter(s => s && s.class && s.class.toUpperCase().includes('11C'));
    console.log(`Total 11C students found: ${students11C.length}`);
    
    // Group by alan
    const byAlan = {};
    students11C.forEach(s => {
        const alan = s.alan || 'Genel';
        if (!byAlan[alan]) byAlan[alan] = [];
        byAlan[alan].push(s);
    });
    
    Object.entries(byAlan).forEach(([alan, stds]) => {
        console.log(`  Alan: ${alan} (${stds.length} students)`);
        // Let's see some courses they take
        const courses = new Set();
        stds.forEach(s => {
            if (s.dersler) {
                s.dersler.forEach(d => courses.add(d));
            }
        });
        console.log(`    Courses: ${Array.from(courses).join(', ')}`);
    });
});
