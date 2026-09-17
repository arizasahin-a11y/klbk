import os

target_dir = r"A:\TOOLS\kodlama\km\eng pre\English File PREINT Linux"

# 1. index.html
index_html = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=shell.html">
  <title>English File Pre-Intermediate</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #181b22;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      text-align: center;
    }
    .loader-box {
      background: #242936;
      padding: 40px 60px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    h1 {
      margin: 0 0 16px 0;
      font-size: 24px;
      color: #38bdf8;
    }
    p {
      margin: 0 0 20px 0;
      color: #94a3b8;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #334155;
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    a {
      color: #38bdf8;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="loader-box">
    <h1>English File Pre-Intermediate</h1>
    <p>Starting application, please wait...</p>
    <div class="spinner"></div>
    <p style="margin-top: 20px; font-size: 13px;">
      If you are not redirected automatically, <a href="shell.html">click here</a>.
    </p>
  </div>
  <script>
    window.location.replace("shell.html");
  </script>
</body>
</html>'''

with open(os.path.join(target_dir, "index.html"), "w", encoding="utf-8") as f:
    f.write(index_html)
print("index.html created!")

# 2. server.py (with Range request support for audio/video seeking)
server_py = '''import os
import sys
import http.server
import socketserver
import re

PORT = 8000

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
        print(f"  English File Pre-Intermediate Server running!")
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

with open(os.path.join(target_dir, "server.py"), "w", encoding="utf-8") as f:
    f.write(server_py)
print("server.py created!")

# 3. start-pardus.sh (bash launcher with CRLF normalized to LF)
start_pardus_sh = '''#!/usr/bin/env bash
# English File Pre-Intermediate - Pardus / Linux Baslatici
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

PORT=8000
URL="http://localhost:$PORT/shell.html"

# Python3 kontrolu
if ! command -v python3 &> /dev/null; then
    echo "Hata: python3 bulunamadi! Lutfen 'sudo apt install python3' komutu ile yukleyin."
    exit 1
fi

echo "Uygulama sunucusu baslatiliyor..."
python3 "$DIR/server.py" "$PORT" &
SERVER_PID=$!

# Cikis yapildiginda sunucuyu durdur
trap "kill $SERVER_PID 2>/dev/null || true" EXIT

# Sunucunun baslamasi icin 1 saniye bekle
sleep 1

echo "Tarayici aciliyor: $URL"

# Tarayici secimi (Oncelik: Chromium/Chrome App modu, sonra Firefox, sonra xdg-open)
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

# Write with LF newlines for Linux compatibility
with open(os.path.join(target_dir, "start-pardus.sh"), "wb") as f:
    f.write(start_pardus_sh.replace("\r\n", "\n").encode("utf-8"))
print("start-pardus.sh created!")

# 4. start-windows.bat (for Windows testing)
start_windows_bat = '''@echo off
title English File Pre-Intermediate
cd /d "%~dp0"

echo English File Pre-Intermediate baslatiliyor...
start "" /b python server.py 8000

timeout /t 1 /nobreak >nul

start http://localhost:8000/shell.html
'''

with open(os.path.join(target_dir, "start-windows.bat"), "w", encoding="utf-8") as f:
    f.write(start_windows_bat)
print("start-windows.bat created!")

# 5. package.json & main.js (Electron Option)
package_json = '''{
  "name": "english-file-preintermediate",
  "version": "1.0.0",
  "description": "Oxford English File Pre-Intermediate (Pardus / Linux)",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "keywords": ["english-file", "oxford", "pardus", "linux"],
  "author": "Antigravity",
  "license": "ISC",
  "devDependencies": {
    "electron": "^28.0.0"
  }
}'''

main_js = '''const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "English File third edition Pre-Intermediate",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'branding', 'icon64.png')
  });

  mainWindow.maximize();
  mainWindow.loadURL('http://localhost:8000/shell.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  serverProcess = spawn('python3', [path.join(__dirname, 'server.py'), '8000']);
  
  setTimeout(createWindow, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
'''

with open(os.path.join(target_dir, "package.json"), "w", encoding="utf-8") as f:
    f.write(package_json)
with open(os.path.join(target_dir, "main.js"), "w", encoding="utf-8") as f:
    f.write(main_js)
print("package.json and main.js created!")
