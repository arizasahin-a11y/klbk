import re
import json

file_path = 'js/ui.js'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

output = []
for i, line in enumerate(lines):
    line = line.rstrip()
    if re.match(r'^\s*// ===+', line) or re.match(r'^\s*// ---+', line) or re.match(r'^\s*(async )?function \w+\(', line) or re.match(r'^\s*window\.\w+\s*=\s*(async )?function', line):
        output.append({"line": i + 1, "content": line.strip()})

with open('scratch/ui_structure.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)
