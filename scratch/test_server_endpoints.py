import urllib.request
import subprocess
import time
import sys

target_dir = r"A:\TOOLS\kodlama\km\eng pre\English File PREINT Linux"

print("Starting test server on port 8089...")
proc = subprocess.Popen([sys.executable, "server.py", "8089"], cwd=target_dir)
time.sleep(1.5)

endpoints = [
    ("shell.html", "text/html"),
    ("books/BO-498b9af792fcc/pages/PA-015136f7fe1a4/index.json", "application/json"),
    ("books/BO-498b9af792fcc/pages/PA-015136f7fe1a4/3/7/4.png", "image/png"),
    ("assets/swf/SW-1a92eaaad7969/key.swf", "application/x-shockwave-flash"),
    ("assets/audio/AU-4bfc8e57e4dc4/audio.mp3", "audio/mpeg"),
    ("ruffle/ruffle.js", "application/javascript"),
    ("javascripts/flv.min.js", "application/javascript"),
]

all_passed = True
for ep, expected_mime in endpoints:
    url = f"http://localhost:8089/{ep}"
    try:
        req = urllib.request.Request(url, headers={'Range': 'bytes=0-1023'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.status
            size = len(resp.read())
            print(f"[PASS] {ep} -> Status: {status}, Bytes read: {size}")
    except Exception as e:
        print(f"[FAIL] {ep} -> Error: {e}")
        all_passed = False

proc.terminate()
proc.wait()

if all_passed:
    print("\nALL HTTP ENDPOINTS PASSED SUCCESSFULLY!")
else:
    print("\nSOME ENDPOINTS FAILED.")
