import json
import urllib.request

url = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/klbk_data_admin.json"
print("Downloading DB...")
with urllib.request.urlopen(url) as response:
    data = json.loads(response.read().decode())
print("Download complete.")

students = data.get('students', [])
print(f"Total students: {len(students)}")
targetNo = "2822"

found = False
for s in students:
    s_no = str(s.get('no', '')).strip().lstrip('0')
    if s_no == targetNo:
        found = True
        print("Found student 2822 in klbk_data_admin")
        print(s)

if not found:
    print("Student 2822 NOT FOUND in klbk_data_admin")

print("Checking other schools...")
# How do I know other schools? I can't easily list them in Firebase.
