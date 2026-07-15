import json
import urllib.request

url = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store/klbk_data_admin.json"
with urllib.request.urlopen(url) as response:
    data = json.loads(response.read().decode())

activities = data.get('school', {}).get('activities', None)
print("Type of activities in Firebase:", type(activities))
if isinstance(activities, dict):
    print("It is a dictionary! Keys:", list(activities.keys()))
elif isinstance(activities, list):
    print("It is a list! Length:", len(activities))
