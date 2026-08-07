import json

selectedClasses = ['9A', '9B', '9C']
studentsByClass = {
    '9A': [{'class':'9A', 'number':'1', 'name':'A1'}, {'class':'9A', 'number':'2', 'name':'A2'}],
    '9B': [{'class':'9B', 'number':'1', 'name':'B1'}, {'class':'9B', 'number':'2', 'name':'B2'}],
    '9C': [{'class':'9C', 'number':'1', 'name':'C1'}, {'class':'9C', 'number':'2', 'name':'C2'}]
}

dutyLocations = [{'id': '1', 'name': 'Kat 1', 'count': 1, 'gender': 'Farketmez'}]
globalRule = 'sirayla'

studentStats = {}
for c in selectedClasses:
    for s in studentsByClass[c]:
        sid = f"{c}-{s.get('number', '-')}"
        studentStats[sid] = 0

workingDays = [f"2026-08-{str(i).zfill(2)}" for i in range(1, 31)]
generatedPlan = []

for dateStr in workingDays:
    assignedToday = set()
    for loc in dutyLocations:
        for i in range(loc['count']):
            candidateStudents = []
            for c in selectedClasses:
                for s in studentsByClass[c]:
                    sid = f"{c}-{s.get('number', '-')}"
                    if sid not in assignedToday:
                        candidateStudents.append({
                            'student': s,
                            'id': sid,
                            'class': c,
                            'count': studentStats[sid],
                            'classOrder': selectedClasses.index(c),
                            'number': int(s.get('number', '9999'))
                        })
            
            if not candidateStudents:
                continue

            def sort_key(c):
                return (c['count'], c['classOrder'], c['number'])
            
            candidateStudents.sort(key=sort_key)
            
            bestCandidate = candidateStudents[0]
            assignedToday.add(bestCandidate['id'])
            studentStats[bestCandidate['id']] += 1
            
            generatedPlan.append({
                'date': dateStr,
                'className': bestCandidate['student']['class'],
                'name': bestCandidate['student']['name']
            })

print(f"Total: {len(generatedPlan)}")
for p in generatedPlan:
    print(p['date'], p['className'], p['name'])
