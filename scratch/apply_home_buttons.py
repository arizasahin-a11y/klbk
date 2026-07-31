import os
import re

all_files = [
    'dashboard.html', 
    'listeci.html', 
    'oeovvb.html', 
    'oeyp.html', 
    'ogrencitakip.html', 
    'faaliyet_liderleri.html', 
    'yoklama_idareci.html', 
    'yoklama_ogretmen.html', 
    'zumreci.html', 
    'ogrenci.html', 
    'ogretmen.html'
]

files_to_have = [
    'dashboard.html', 
    'listeci.html', 
    'oeovvb.html', 
    'oeyp.html', 
    'ogrencitakip.html', 
    'yoklama_idareci.html', 
    'yoklama_ogretmen.html', 
    'ogrenci.html', 
    'ogretmen.html'
]

btn = '''
<!-- Floating Home Button -->
<a href="enter.html" style="position: fixed; bottom: 20px; left: 20px; background: #2563eb; color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.2); z-index: 9999; text-decoration: none; font-size: 1.2rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'" title="Ana Sayfaya Dön (Portal)">
    <i class="fa-solid fa-home"></i>
</a>
'''

for f in all_files:
    filepath = os.path.join(r"a:\TOOLS\kodlama\km\KLBK FRVR", f)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as file:
            content = file.read()
            
        # First, strip out any existing button
        content = re.sub(r'<!-- Floating Home Button -->.*?</a>\n?', '', content, flags=re.DOTALL)
        
        # Then add it if it's in the list
        if f in files_to_have:
            if '</body>' in content:
                content = content.replace('</body>', btn + '\n</body>')
            else:
                print('Warning: no body tag in', f)
                
        with open(filepath, 'w', encoding='utf-8') as file:
            file.write(content)
        print('Processed', f)

print('Done!')
