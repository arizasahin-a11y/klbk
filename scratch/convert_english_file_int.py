import os
import zipfile
import time
import shutil
import re

SRC_DIR = r"A:\TOOLS\kodlama\km\English File INT\dist\archives"
TARGET_DIR = r"A:\TOOLS\kodlama\km\English File INT Linux"
RUFFLE_SRC = r"A:\TOOLS\kodlama\km\eng pre\English File PREINT Linux\ruffle"
FLV_SRC = r"A:\TOOLS\kodlama\km\eng pre\English File PREINT Linux\javascripts\flv.min.js"
PLAYER_SRC = r"A:\TOOLS\kodlama\km\eng pre\English File PREINT Linux\javascripts\player.js"

print("==================================================")
print("Converting English File Intermediate (INT) to Linux")
print("==================================================")

os.makedirs(TARGET_DIR, exist_ok=True)
BOOKS_DIR = os.path.join(TARGET_DIR, "books")
ASSETS_DIR = os.path.join(TARGET_DIR, "assets")
os.makedirs(BOOKS_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

# 1. Extract content.zip
print("Extracting content.zip...")
with zipfile.ZipFile(os.path.join(SRC_DIR, "content.zip"), "r") as z:
    z.extractall(TARGET_DIR)

# 2. Extract books
for b in ["books0.zip", "books1.zip", "books2.zip"]:
    p = os.path.join(SRC_DIR, b)
    print(f"Extracting {b}...", flush=True)
    t0 = time.time()
    with zipfile.ZipFile(p, "r") as z:
        z.extractall(BOOKS_DIR)
    print(f"Done {b} in {time.time()-t0:.1f}s", flush=True)

# 3. Extract assets
for a in ["assets0.zip", "assets1.zip", "assets2.zip"]:
    p = os.path.join(SRC_DIR, a)
    print(f"Extracting {a}...", flush=True)
    t0 = time.time()
    with zipfile.ZipFile(p, "r") as z:
        z.extractall(ASSETS_DIR)
    print(f"Done {a} in {time.time()-t0:.1f}s", flush=True)

# 4. Copy Ruffle and flv.min.js
print("Copying Ruffle and flv.js...", flush=True)
ruffle_dest = os.path.join(TARGET_DIR, "ruffle")
os.makedirs(ruffle_dest, exist_ok=True)
for item in os.listdir(RUFFLE_SRC):
    s = os.path.join(RUFFLE_SRC, item)
    d = os.path.join(ruffle_dest, item)
    if os.path.isfile(s):
        shutil.copy2(s, d)

shutil.copy2(FLV_SRC, os.path.join(TARGET_DIR, "javascripts", "flv.min.js"))
shutil.copy2(PLAYER_SRC, os.path.join(TARGET_DIR, "javascripts", "player.js"))

# 5. Patch persistence.js
print("Patching persistence.js...", flush=True)
persistence_path = os.path.join(TARGET_DIR, "javascripts", "persistence.js")
with open(persistence_path, "r", encoding="utf-8") as f:
    text = f.read()

text = re.sub(
    r'init\s*:\s*function\s*\([^\)]*\)\s*\{[\s\S]*?ActiveRecord\.logging',
    '''init : function(path) {
      try {
        ActiveRecord.connect(ActiveRecord.Adapters.InMemory);
      } catch (e) {
        console.warn("ActiveRecord InMemory fallback:", e);
      }
      ActiveRecord.logging''',
    text
)
with open(persistence_path, "w", encoding="utf-8") as f:
    f.write(text)

# 6. Patch page.navigation.js
print("Patching page.navigation.js...", flush=True)
nav_path = os.path.join(TARGET_DIR, "javascripts", "page.navigation.js")
with open(nav_path, "r", encoding="utf-8") as f:
    text = f.read()

text = re.sub(
    r'loadURI\s*:\s*function\s*\(uri\)\s*\{\s*if\s*\(uri\)\s*location\.href\s*=\s*uri;\s*\}',
    '''loadURI: function (uri) {
    if (uri) {
      if (uri.indexOf("resource://") === 0) {
        uri = uri.replace("resource://", "assets/");
      }
      window.open(uri, '_blank');
    }
  }''',
    text
)
with open(nav_path, "w", encoding="utf-8") as f:
    f.write(text)

# 7. Patch shell.html
print("Patching shell.html...", flush=True)
shell_path = os.path.join(TARGET_DIR, "shell.html")
with open(shell_path, "r", encoding="utf-8") as f:
    html = f.read()

shim_code = '''<script type="text/javascript">
  window.netscape = window.netscape || {
    security: {
      PrivilegeManager: {
        enablePrivilege: function() {}
      }
    }
  };
  window.Components = window.Components || {
    classes: {},
    interfaces: {}
  };
</script>
<script src="ruffle/ruffle.js" type="text/javascript"></script>
<script src="javascripts/flv.min.js" type="text/javascript"></script>
<script src="javascripts/prototype.js" type="text/javascript"></script>'''

html = html.replace('<script src="javascripts/prototype.js" type="text/javascript"></script>', shim_code, 1)

html = re.sub(
    r'Shell\.resource_books_url\s*=\s*"resource://";',
    'Shell.resource_books_url = "";',
    html
)
html = re.sub(
    r'Shell\.resource_assets_url\s*=\s*"resource://";',
    'Shell.resource_assets_url = "assets/";',
    html
)

with open(shell_path, "w", encoding="utf-8") as f:
    f.write(html)

# 8. Create index.html
print("Creating index.html...", flush=True)
index_html = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=shell.html">
  <title>English File Intermediate</title>
  <style>
    body {
      margin: 0; padding: 0;
      background: #181b22; color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex; justify-content: center; align-items: center;
      height: 100vh; text-align: center;
    }
    .loader-box {
      background: #242936; padding: 40px 60px;
      border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    h1 { margin: 0 0 16px 0; font-size: 24px; color: #38bdf8; }
    p { margin: 0 0 20px 0; color: #94a3b8; }
    .spinner {
      width: 40px; height: 40px;
      border: 4px solid #334155; border-top-color: #38bdf8;
      border-radius: 50%; animation: spin 0.8s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    a { color: #38bdf8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="loader-box">
    <h1>English File Intermediate</h1>
    <p>Starting application, please wait...</p>
    <div class="spinner"></div>
    <p style="margin-top: 20px; font-size: 13px;">
      If you are not redirected automatically, <a href="shell.html">click here</a>.
    </p>
  </div>
  <script>window.location.replace("shell.html");</script>
</body>
</html>'''
with open(os.path.join(TARGET_DIR, "index.html"), "w", encoding="utf-8") as f:
    f.write(index_html)

# 9. Create server.py
print("Creating server.py...", flush=True)
server_py = '''import os
import sys
import http.server
import socketserver
import re

PORT = 8001

class RangeHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def send_head(self):
        if 'Range' not in self.headers:
            self.range = None
            return super().send_head()

        path = self.translate_path(self.path)
        f = None
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, "File not found")
            return None

        fs = os.fstat(f.fileno())
        total_len = fs.st_size
        range_header = self.headers['Range'].strip()
        match = re.match(r'bytes=(\\d+)-(\\d*)', range_header)

        if not match:
            f.close()
            self.send_error(400, "Bad Request")
            return None

        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else total_len - 1

        if start >= total_len:
            f.close()
            self.send_error(416, "Requested Range Not Satisfiable")
            return None

        end = min(end, total_len - 1)
        length = end - start + 1

        self.send_response(206)
        self.send_header("Content-type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{total_len}")
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

        f.seek(start)
        self.range = (start, end)
        return f

    def copyfile(self, source, outputfile):
        if not getattr(self, 'range', None):
            super().copyfile(source, outputfile)
            return

        start, end = self.range
        length = end - start + 1
        bufsize = 64 * 1024
        while length > 0:
            chunk = source.read(min(length, bufsize))
            if not chunk:
                break
            outputfile.write(chunk)
            length -= len(chunk)

def run(port=PORT):
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), RangeHTTPRequestHandler) as httpd:
        print(f"\\n=======================================================")
        print(f"  English File Intermediate Server running!")
        print(f"  URL: http://localhost:{port}/shell.html")
        print(f"=======================================================\\n", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\\nServer stopped.")

if __name__ == '__main__':
    p = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run(p)
'''
with open(os.path.join(TARGET_DIR, "server.py"), "w", encoding="utf-8") as f:
    f.write(server_py)

# 10. Create start-pardus.sh
print("Creating start-pardus.sh...", flush=True)
start_pardus_sh = '''#!/usr/bin/env bash
# English File Intermediate - Pardus / Linux Baslatici
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

PORT=8001
URL="http://localhost:$PORT/shell.html"

if ! command -v python3 &> /dev/null; then
    echo "Hata: python3 bulunamadi! Lutfen 'sudo apt install python3' komutu ile yukleyin."
    exit 1
fi

echo "Uygulama sunucusu baslatiliyor..."
python3 "$DIR/server.py" "$PORT" &
SERVER_PID=$!

trap "kill $SERVER_PID 2>/dev/null || true" EXIT
sleep 1

echo "Tarayici aciliyor: $URL"
if command -v chromium &> /dev/null; then
    chromium --app="$URL" --start-maximized &
elif command -v google-chrome &> /dev/null; then
    google-chrome --app="$URL" --start-maximized &
elif command -v chromium-browser &> /dev/null; then
    chromium-browser --app="$URL" --start-maximized &
elif command -v firefox &> /dev/null; then
    firefox "$URL" &
elif command -v xdg-open &> /dev/null; then
    xdg-open "$URL" &
else
    echo "Lutfen tarayicinizdan su adresi acin: $URL"
fi

echo "Uygulama calisiyor. Kapatmak icin bu terminal penceresinde Ctrl+C tusuna basin."
wait $SERVER_PID
'''
with open(os.path.join(TARGET_DIR, "start-pardus.sh"), "wb") as f:
    f.write(start_pardus_sh.replace("\r\n", "\n").encode("utf-8"))

# 11. Create start-windows.bat
print("Creating start-windows.bat...", flush=True)
start_windows_bat = '''@echo off
title English File Intermediate
cd /d "%~dp0"

echo English File Intermediate baslatiliyor...
start "" /b python server.py 8001

timeout /t 1 /nobreak >nul

start http://localhost:8001/shell.html
'''
with open(os.path.join(TARGET_DIR, "start-windows.bat"), "w", encoding="utf-8") as f:
    f.write(start_windows_bat)

print("\nCONVERSION COMPLETED SUCCESSFULLY FOR ENGLISH FILE INTERMEDIATE!")
