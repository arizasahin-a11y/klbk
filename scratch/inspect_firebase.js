const fs = require('fs');

async function main() {
    const url = 'https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/klbk_data_admin.json';
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.students) {
            console.log(`Successfully fetched from Firebase. Total students: ${data.students.length}`);
            const stds11C = data.students.filter(s => s && s.class && s.class.toUpperCase().includes('11C'));
            console.log(`Total 11C students: ${stds11C.length}`);
            
            // Group by alan
            const byAlan = {};
            stds11C.forEach(s => {
                const alan = s.alan || 'Genel';
                if (!byAlan[alan]) byAlan[alan] = [];
                byAlan[alan].push(s);
            });
            
            Object.entries(byAlan).forEach(([alan, list]) => {
                console.log(`\nAlan: ${alan} (${list.length} students)`);
                const courses = new Set();
                list.forEach(s => {
                    if (s.dersler) s.dersler.forEach(d => courses.add(d));
                });
                console.log(`  Courses: ${Array.from(courses).join(', ')}`);
                // Let's print some sample students
                console.log(`  Sample student:`, list[0]);
            });
        } else {
            console.log('No student data in klbk_data_admin or key missing');
        }
    } catch (e) {
        console.error('Error fetching:', e);
    }
}

main();
