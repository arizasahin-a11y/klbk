const fs = require('fs');

let selectedClasses = ['9A', '9B'];
let studentsByClass = {
    '9A': [],
    '9B': []
};
for(let i=1; i<=30; i++) studentsByClass['9A'].push({class:'9A', number:i.toString(), name:'A'+i, cinsiyet: (i%2===0?'Kız':'Erkek')});
for(let i=1; i<=30; i++) studentsByClass['9B'].push({class:'9B', number:i.toString(), name:'B'+i, cinsiyet: (i%2===0?'Kız':'Erkek')});

let dutyLocations = [
    {id: '1', name: '1. Kat', count: 1, gender: 'Farketmez'},
    {id: '2', name: '2. Kat', count: 1, gender: 'Farketmez'}
];
let globalRule = 'sirayla';

let studentStats = {}; 
selectedClasses.forEach(c => {
    studentsByClass[c].forEach(s => {
        let id = c + '-' + s.number;
        studentStats[id] = 0;
    });
});

let workingDays = [];
for(let m=8; m<=10; m++) {
    for(let d=1; d<=22; d++) { // 22 working days per month
        workingDays.push(`2026-${m.toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`);
    }
}

let generatedPlan = [];

function isValidGender(student, genderPref) {
    if (genderPref === 'Farketmez') return true;
    let sg = student.cinsiyet.toLowerCase();
    if (genderPref === 'Kız') return sg === 'kız';
    return sg === 'erkek';
}

workingDays.forEach(dateStr => {
    let assignedToday = new Set();
    let classAssignmentsToday = {};
    selectedClasses.forEach(c => classAssignmentsToday[c] = 0);

    dutyLocations.forEach(loc => {
        for (let i = 0; i < loc.count; i++) {
            let candidateStudents = [];
            selectedClasses.forEach(c => {
                if(studentsByClass[c]) {
                    studentsByClass[c].forEach(s => {
                        let id = c + '-' + s.number;
                        if (!assignedToday.has(id) && isValidGender(s, loc.gender)) {
                            candidateStudents.push({
                                student: s,
                                id: id,
                                class: c,
                                count: studentStats[id] || 0,
                                classOrder: selectedClasses.indexOf(c),
                                number: parseInt(s.number || '9999')
                            });
                        }
                    });
                }
            });

            if (candidateStudents.length === 0) {
                console.log("NO CANDIDATES FOR", dateStr, loc.name);
                continue;
            }

            candidateStudents.sort((a, b) => {
                if (a.count !== b.count) return a.count - b.count;
                if (globalRule === 'sirayla') {
                    if (a.classOrder !== b.classOrder) return a.classOrder - b.classOrder;
                    return a.number - b.number;
                } else {
                    let aClassCount = classAssignmentsToday[a.class] || 0;
                    let bClassCount = classAssignmentsToday[b.class] || 0;
                    if (aClassCount !== bClassCount) return aClassCount - bClassCount;
                    if (a.classOrder !== b.classOrder) return a.classOrder - b.classOrder;
                    return a.number - b.number;
                }
            });

            let bestCandidate = candidateStudents[0];
            assignedToday.add(bestCandidate.id);
            studentStats[bestCandidate.id]++;
            classAssignmentsToday[bestCandidate.class]++;

            generatedPlan.push({
                date: dateStr,
                locName: loc.name,
                className: bestCandidate.class,
                number: bestCandidate.number,
                name: bestCandidate.student.name
            });
        }
    });
});

console.log("Total generated:", generatedPlan.length);
let counts = {};
generatedPlan.forEach(p => counts[p.date] = (counts[p.date]||0)+1);
let brokenDates = Object.keys(counts).filter(k => counts[k] < 2);
console.log("Broken dates:", brokenDates);
console.log("Sample of last 5 generated:");
console.log(generatedPlan.slice(-5));

