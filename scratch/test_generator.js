const fs = require('fs');

let selectedClasses = ['9A', '9B', '9C'];
let studentsByClass = {
    '9A': [{class:'9A', number:'1', name:'A1'}, {class:'9A', number:'2', name:'A2'}],
    '9B': [{class:'9B', number:'1', name:'B1'}, {class:'9B', number:'2', name:'B2'}],
    '9C': [{class:'9C', number:'1', name:'C1'}, {class:'9C', number:'2', name:'C2'}]
};

let dutyLocations = [
    {id: '1', name: 'Kat 1', count: 1, gender: 'Farketmez'}
];
let globalRule = 'sirayla';

let studentStats = {}; 
selectedClasses.forEach(c => {
    studentsByClass[c].forEach(s => {
        let id = c + '-' + (s.number || s.no || Math.random());
        studentStats[id] = 0;
    });
});

let workingDays = [];
for(let i=1; i<=30; i++) workingDays.push('2026-08-' + (i<10?'0'+i:i));

let generatedPlan = [];

workingDays.forEach(dateStr => {
    let assignedToday = new Set();
    let classAssignmentsToday = {};
    selectedClasses.forEach(c => classAssignmentsToday[c] = 0);

    dutyLocations.forEach(loc => {
        for (let i = 0; i < loc.count; i++) {
            let candidateStudents = [];
            selectedClasses.forEach(c => {
                studentsByClass[c].forEach(s => {
                    let id = c + '-' + (s.number || s.no || '-');
                    if (!assignedToday.has(id)) {
                        candidateStudents.push({
                            student: s,
                            id: id,
                            class: c,
                            count: studentStats[id],
                            classOrder: selectedClasses.indexOf(c),
                            number: parseInt(s.number || s.no || '9999')
                        });
                    }
                });
            });

            if (candidateStudents.length === 0) continue;

            candidateStudents.sort((a, b) => {
                if (a.count !== b.count) return a.count - b.count;
                if (globalRule === 'sirayla') {
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
                className: bestCandidate.student.class,
                number: bestCandidate.student.number || '-',
                name: bestCandidate.student.name
            });
        }
    });
});

console.log("Total generated:", generatedPlan.length);
let counts = {};
generatedPlan.forEach(p => counts[p.className] = (counts[p.className]||0)+1);
console.log(counts);
console.log(generatedPlan.map(p => p.date + ' ' + p.className + ' ' + p.name));
