import json
import urllib.request

url = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/srh_data.json"
try:
    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode())
        print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error: {e}")
