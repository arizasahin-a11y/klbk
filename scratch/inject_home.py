import os

files = [
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

btn = '''
<!-- Floating Home Button -->
<a href="enter.html" style="position: fixed; bottom: 20px; left: 20px; background: #2563eb; color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.2); z-index: 9999; text-decoration: none; font-size: 1.2rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'" title="Ana Sayfaya Dön (Portal)">
    <i class="fa-solid fa-home"></i>
</a>
'''

for f in files:
    filepath = os.path.join(r"a:\TOOLS\kodlama\km\KLBK FRVR", f)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as file:
            content = file.read()
        
        if '<!-- Floating Home Button -->' not in content:
            if '</body>' in content:
                content = content.replace('</body>', btn + '\n</body>')
                with open(filepath, 'w', encoding='utf-8') as file:
                    file.write(content)
                print('Updated', f)
            else:
                print('Warning: no </body> tag in', f)
        else:
            print('Already updated', f)
    else:
        print('File not found', f)
print('Done!')
