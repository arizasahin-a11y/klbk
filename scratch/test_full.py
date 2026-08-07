import json

selectedClasses = ['9A', '9B']
studentsByClass = {'9A': [], '9B': []}
for i in range(1, 31):
    studentsByClass['9A'].append({'class': '9A', 'number': str(i), 'name': f'A{i}', 'cinsiyet': 'Kız' if i%2==0 else 'Erkek'})
    studentsByClass['9B'].append({'class': '9B', 'number': str(i), 'name': f'B{i}', 'cinsiyet': 'Kız' if i%2==0 else 'Erkek'})

dutyLocations = [
    {'id': '1', 'name': '1. Kat', 'count': 1, 'gender': 'Farketmez'},
    {'id': '2', 'name': '2. Kat', 'count': 1, 'gender': 'Farketmez'}
]
globalRule = 'sirayla'

studentStats = {}
for c in selectedClasses:
    for s in studentsByClass[c]:
        sid = f"{c}-{s['number']}"
        studentStats[sid] = 0

workingDays = []
for m in range(8, 11):
    for d in range(1, 23):
        workingDays.append(f"2026-{m:02d}-{d:02d}")

generatedPlan = []

for dateStr in workingDays:
    assignedToday = set()
    classAssignmentsToday = {c: 0 for c in selectedClasses}

    for loc in dutyLocations:
        for i in range(loc['count']):
            candidateStudents = []
            for c in selectedClasses:
                for s in studentsByClass[c]:
                    sid = f"{c}-{s['number']}"
                    if sid not in assignedToday:
                        candidateStudents.append({
                            'student': s,
                            'id': sid,
                            'class': c,
                            'count': studentStats.get(sid, 0),
                            'classOrder': selectedClasses.index(c),
                            'number': int(s['number'])
                        })
            
            if not candidateStudents:
                print("NO CANDIDATES", dateStr, loc['name'])
                continue

            def sort_key(c):
                if globalRule == 'sirayla':
                    return (c['count'], c['classOrder'], c['number'])
                else:
                    return (c['count'], classAssignmentsToday[c['class']], c['classOrder'], c['number'])
            
            candidateStudents.sort(key=sort_key)
            
            bestCandidate = candidateStudents[0]
            assignedToday.add(bestCandidate['id'])
            studentStats[bestCandidate['id']] += 1
            classAssignmentsToday[bestCandidate['class']] += 1
            
            generatedPlan.append({
                'date': dateStr,
                'locName': loc['name'],
                'className': bestCandidate['class'],
                'number': bestCandidate['number'],
                'name': bestCandidate['student']['name']
            })

print("Total generated:", len(generatedPlan))
counts = {}
for p in generatedPlan:
    counts[p['date']] = counts.get(p['date'], 0) + 1

broken = [k for k, v in counts.items() if v < 2]
print("Broken dates:", broken)
print("Last 5 generated:")
for p in generatedPlan[-5:]:
    print(p)
