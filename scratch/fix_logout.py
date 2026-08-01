import os
import glob
import re

def update_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # We want to catch instances of:
    # sessionStorage.clear();
    # [optional other removes]
    # window.location.href = '...' OR window.location.reload()
    
    pattern = r"sessionStorage\.clear\(\);\s*(?:localStorage\.removeItem\([^)]+\);\s*)*window\.location\.(?:href\s*=\s*['\"].*?['\"]|reload\(\));?"
    replacement = "sessionStorage.clear();\n            localStorage.removeItem('klbk_currentUser');\n            localStorage.removeItem('klbk_isLoggedIn');\n            localStorage.removeItem('klbk_persistent_session');\n            localStorage.removeItem('klbk_storeKey');\n            window.location.href = 'enter.html';"
    
    content = re.sub(pattern, replacement, content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

if __name__ == "__main__":
    files = glob.glob("*.html") + glob.glob("js/*.js")
    for f in files:
        if "faaliyet_liderleri.html" in f:
            continue
        update_file(f)
