import os
import re
import json

directory = r"a:\TOOLS\kodlama\km\KLBK FRVR"
html_files = [f for f in os.listdir(directory) if f.endswith('.html')]

colors_map = {}

def extract_colors(content):
    primary = re.search(r'--primary:\s*(#[a-fA-F0-9]{3,6}|rgba?\(.*?\)|hsl\(.*?\));', content)
    secondary = re.search(r'--secondary:\s*(#[a-fA-F0-9]{3,6}|rgba?\(.*?\)|hsl\(.*?\));', content)
    gradient = re.search(r'background:\s*linear-gradient\((.*?)\);', content)
    login_grad = re.search(r'background:\s*linear-gradient\([^)]*\)', content)
    
    return {
        'primary': primary.group(1) if primary else None,
        'secondary': secondary.group(1) if secondary else None,
        'gradient': gradient.group(1) if gradient else (login_grad.group(0) if login_grad else None)
    }

for f in html_files:
    path = os.path.join(directory, f)
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
        colors = extract_colors(content)
        colors_map[f] = colors

print(json.dumps(colors_map, indent=2, ensure_ascii=False))
