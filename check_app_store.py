import json
import urllib.request

url = "https://klbk-620b0-default-rtdb.europe-west1.firebasedatabase.app/app_store.json?shallow=true"
print("Downloading DB index...")
with urllib.request.urlopen(url) as response:
    data = json.loads(response.read().decode())
print("Keys in app_store:")
print(list(data.keys()))
