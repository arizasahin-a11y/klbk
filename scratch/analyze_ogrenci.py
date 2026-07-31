import re

with open('ogrenci.html', 'r', encoding='utf-8') as f:
    content = f.read()

print('Size:', len(content), 'bytes')
print('Lines:', len(content.splitlines()))

scripts = re.findall(r'<script.*?>.*?</script>', content, flags=re.DOTALL)
print('Script tags:', len(scripts))

for i, s in enumerate(scripts):
    print(f'Script {i} length:', len(s))
    if len(s) > 1000:
        print('First 100 chars:', s[:100].replace('\n', ' '))
