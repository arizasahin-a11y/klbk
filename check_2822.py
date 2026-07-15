import json
import urllib.request

url = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/klbk_data_admin.json"
print("Downloading DB...")
with urllib.request.urlopen(url) as response:
    data = json.loads(response.read().decode())
print("Download complete.")

acts = data.get('school', {}).get('activities', [])
targetNo = "2822"

print(f"Total activities: {len(acts)}")
for act in acts:
    students = act.get('students', [])
    enrolled = False
    for s in students:
        s_no = str(s.get('no', '')).strip().lstrip('0')
        if s_no == targetNo:
            enrolled = True
            break
    
    print(f"\nActivity: {act.get('name')}")
    print("Schedules:", act.get('schedules'))
    print("Status History:", act.get('statusHistory'))
    print(f"Student 2822 enrolled: {enrolled}")
    
    if enrolled:
        has_att = 'Yes' if act.get('attendanceHistory') else 'No'
        print("Attendance History:", has_att)
        if has_att and '2026-07-14' in act['attendanceHistory']:
            att_today = act['attendanceHistory']['2026-07-14'].get(targetNo, 'N/A')
            print("Attendance Today:", att_today)
