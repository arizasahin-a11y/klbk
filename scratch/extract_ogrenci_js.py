import os
import re

html_path = r"a:\TOOLS\kodlama\km\KLBK FRVR\ogrenci.html"
js_path = r"a:\TOOLS\kodlama\km\KLBK FRVR\js\ogrenci.js"

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the largest script block
scripts = re.findall(r'(<script.*?>)(.*?)(</script>)', content, flags=re.DOTALL | re.IGNORECASE)

largest_script = None
max_len = 0
for start_tag, inner_js, end_tag in scripts:
    if len(inner_js) > max_len:
        max_len = len(inner_js)
        largest_script = (start_tag, inner_js, end_tag)

if largest_script:
    start_tag, inner_js, end_tag = largest_script
    print("Found largest script, length:", max_len)
    
    # Write to js file
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(inner_js.strip())
        
    # Replace in html
    original_block = start_tag + inner_js + end_tag
    replacement = '<script src="js/ogrenci.js?v=11.6" defer></script>'
    new_content = content.replace(original_block, replacement)
    
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print("Extraction successful.")
else:
    print("No script found.")
