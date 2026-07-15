import json
import urllib.request

for key in ['klbk_data_qk', 'klbk_data_bk']:
    url = f"https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/{key}.json"
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
        
        acts = data.get('activities', [])
        print(f"\n{key} - Total activities: {len(acts)}")
        
        targetNo = "2822"
        for act in acts:
            students = act.get('students', [])
            enrolled = False
            for s in students:
                s_no = str(s.get('no', '')).strip().lstrip('0')
                if s_no == targetNo:
                    enrolled = True
                    break
            
            if enrolled:
                print(f"Found Student 2822 in Activity: {act.get('name')} (Date: {act.get('statusHistory')})")
    except Exception as e:
        print(f"Failed to fetch {key}: {e}")
