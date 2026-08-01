import re

with open('faaliyet_liderleri.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove anti-flicker script
content = re.sub(r'<script>\s*\(function\(\)\s*\{\s*try\s*\{\s*var isLogged.*?\}\)\(\);\s*</script>', '', content, flags=re.MULTILINE|re.DOTALL)

# Remove login-overlay div completely
content = re.sub(r'<!-- MANDATORY LOGIN OVERLAY FOR FAALİYET LİDERLERİ PORTALI -->[\s\S]*?<div class="wrap">', '<div class="wrap">', content)

# Remove loadSchoolNameForLogin call
content = content.replace('loadSchoolNameForLogin(); ', '')

# Remove loadSchoolNameForLogin function definition
content = re.sub(r'function loadSchoolNameForLogin\(\)[\s\S]*?\}\n', '', content)

with open('faaliyet_liderleri.html', 'w', encoding='utf-8') as f:
    f.write(content)
