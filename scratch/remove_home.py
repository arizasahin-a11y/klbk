import os
import re

files = ['ogrenci.html', 'ogretmen.html', 'dashboard.html']

for f in files:
    filepath = os.path.join(r"a:\TOOLS\kodlama\km\KLBK FRVR", f)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as file:
            content = file.read()
        
        if '<!-- Floating Home Button -->' in content:
            content = re.sub(r'<!-- Floating Home Button -->.*?</a>\n', '', content, flags=re.DOTALL)
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(content)
            print('Removed from', f)
        else:
            print('Not found in', f)
    else:
        print('File not found', f)
print('Done!')
