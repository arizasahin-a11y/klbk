import os
import re
import json

directory = r"a:\TOOLS\kodlama\km\KLBK FRVR"
html_files = [f for f in os.listdir(directory) if f.endswith('.html')]

themes = [
    # (gradient, primary)
    ("linear-gradient(135deg, #eff6ff 0%, #e0e7ff 50%, #ede9fe 100%)", "#4f46e5"), # Indigo
    ("linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #cffafe 100%)", "#0284c7"), # Sky
    ("linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #d1fae5 100%)", "#0d9488"), # Teal
    ("linear-gradient(135deg, #fff1f2 0%, #ffe4e6 50%, #fce7f3 100%)", "#e11d48"), # Rose
    ("linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #ffedd5 100%)", "#d97706"), # Amber
    ("linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #fae8ff 100%)", "#7c3aed"), # Violet
    ("linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)", "#475569"), # Slate
    ("linear-gradient(135deg, #f7fee7 0%, #ecfccb 50%, #dcfce7 100%)", "#65a30d"), # Lime
    ("linear-gradient(135deg, #fef2f2 0%, #fee2e2 50%, #ffedd5 100%)", "#dc2626"), # Red
    ("linear-gradient(135deg, #fafafa 0%, #f4f4f5 50%, #e4e4e7 100%)", "#52525b"), # Zinc
    ("linear-gradient(135deg, #ecfeff 0%, #cffafe 50%, #dbeafe 100%)", "#0891b2"), # Cyan
    ("linear-gradient(135deg, #fdf4ff 0%, #fae8ff 50%, #ffe4e6 100%)", "#d946ef"), # Fuchsia
    ("linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #ccfbf1 100%)", "#10b981"), # Emerald
    ("linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #ffe4e6 100%)", "#db2777"), # Pink
    ("linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fef3c7 100%)", "#ea580c"), # Orange
    ("linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #e0e7ff 100%)", "#9333ea"), # Purple
    ("linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #e0e7ff 100%)", "#2563eb"), # Blue
    ("linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #cffafe 100%)", "#14b8a6"), # Teal-Cyan
    ("linear-gradient(135deg, #fff1f2 0%, #ffe4e6 50%, #ffedd5 100%)", "#f43f5e"), # Rose-Orange
    ("linear-gradient(135deg, #eef2ff 0%, #e0e7ff 50%, #e0f2fe 100%)", "#6366f1"), # Indigo-Sky
    ("linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #cffafe 100%)", "#059669"), # Emerald-Cyan
    ("linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #f3e8ff 100%)", "#8b5cf6"), # Violet-Purple
    ("linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fef08a 100%)", "#f97316"), # Orange-Yellow
    ("linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #f3e8ff 100%)", "#ec4899"), # Pink-Purple
    ("linear-gradient(135deg, #ecfeff 0%, #cffafe 50%, #ccfbf1 100%)", "#06b6d4"), # Cyan-Teal
]

# Exclude some files that might just be modals or prints
exclude = ['listeci_print.html', '404.html', 'security_error.html', 'master.html', 'tutanak_yazdir.html', 'srh_report.html']

files_to_process = [f for f in html_files if f not in exclude]

for i, f in enumerate(files_to_process):
    if i >= len(themes):
        grad, prim = themes[i % len(themes)]
    else:
        grad, prim = themes[i]
        
    path = os.path.join(directory, f)
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
        
    original = content
    
    # Replace body gradient if it exists in style
    content = re.sub(r'background:\s*linear-gradient\([^)]+\);(?=\s*/\*.*?\*/)?', f'background: {grad};', content, count=1)
    
    # If file doesn't have a background style in the main body rule, and it's a login-body
    if 'class="login-body"' in content or 'class="dashboard-body"' in content:
        # Check if style attr exists on body
        if re.search(r'<body[^>]*class="(?:login-body|dashboard-body)"[^>]*style="[^"]*"', content):
            content = re.sub(r'(<body[^>]*class="(?:login-body|dashboard-body)"[^>]*style=")([^"]*)(")',
                             lambda m: f'{m.group(1)}{m.group(2)}; background: {grad} !important;{m.group(3)}' if 'background:' not in m.group(2) else m.group(0),
                             content)
            # if background already exists in style, replace it
            content = re.sub(r'(<body[^>]*class="(?:login-body|dashboard-body)"[^>]*style="[^"]*background:\s*)linear-gradient\([^)]+\)([^"]*")',
                             r'\g<1>' + grad + r' !important\g<2>',
                             content)
        else:
            # Add style attribute
            content = re.sub(r'(<body[^>]*class="(?:login-body|dashboard-body)"[^>]*)>',
                             r'\1 style="background: ' + grad + r' !important;">',
                             content)

    # For --primary, --secondary in style tag
    content = re.sub(r'--primary:\s*(#[a-fA-F0-9]{3,6}|rgba?\([^)]+\));', f'--primary: {prim};', content)
    # let's not touch secondary unless we have to, it usually complements primary
    
    # Exception for faaliyet_liderleri.html which has a login-overlay
    if f == 'faaliyet_liderleri.html':
        content = re.sub(r'(<div id="login-overlay"[^>]*background:\s*)linear-gradient\([^)]+\)', r'\g<1>' + grad, content)

    if content != original:
        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Updated {f} -> Primary: {prim}, Gradient: {grad}")
    else:
        print(f"No changes made to {f} (maybe no body gradient or primary var found)")

