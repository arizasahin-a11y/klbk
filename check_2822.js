const fs = require('fs');

const data = JSON.parse(fs.readFileSync('db.json', 'utf8'));
const acts = data.activities || [];
const targetNo = "2822";

console.log("Total activities:", acts.length);
acts.forEach(act => {
    if (act.students) {
        const enrolled = act.students.find(s => String(s.no || '').trim().replace(/^0+/, '') === targetNo);
        if (enrolled) {
            console.log("\nFound Student 2822 in Activity:", act.name);
            console.log("Schedules:", act.schedules);
            console.log("Status History:", act.statusHistory);
            console.log("Attendance History:", act.attendanceHistory ? "Yes" : "No");
            if (act.attendanceHistory && act.attendanceHistory['2026-07-14']) {
                console.log("Attendance Today:", act.attendanceHistory['2026-07-14'][targetNo]);
            }
        }
    }
});
