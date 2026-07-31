import os

ui_path = r'a:\TOOLS\kodlama\km\KLBK FRVR\js\ui.js'
with open(ui_path, 'r', encoding='utf-8') as f:
    ui_content = f.read()

# 1. Globalize variables
ui_content = ui_content.replace('const sortByNum = ', 'window.sortByNum = ')

# 2. Extract block
start_marker = '// --- 10. Exam Session Wizard Logic ---'
end_marker = '// --- End Exam Session Wizard Logic ---'

start_idx = ui_content.find(start_marker)
end_idx = ui_content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    end_idx += len(end_marker)
    extracted_block = ui_content[start_idx:end_idx]
    
    # We must wrap extracted block in an IIFE or similar if it relies on DOMContentLoaded
    # Or just a simple script since dashboard.html loads scripts at the end of body.
    # Actually, many variables in extracted_block might be implicitly global. 
    # But wait! If we extract functions like `function resetWizard()`, they will be global in the new file.
    # Let's wrap it in DOMContentLoaded to match the old behavior and preserve scope?
    # NO, if we put it in DOMContentLoaded in a new file, it will have a separate scope from ui.js!
    # Inner functions of ui.js like `function resetWizard()` will not be visible to the rest of ui.js.
    # Are they used by the rest of ui.js?
    # Let's check if resetWizard is used anywhere else.
    
    module_content = """// Extracted from ui.js
document.addEventListener('DOMContentLoaded', async () => {
""" + extracted_block + """
});
"""
    with open(r'a:\TOOLS\kodlama\km\KLBK FRVR\js\ui_modules\ui_exam_management.js', 'w', encoding='utf-8') as f:
        f.write(module_content)

    new_ui_content = ui_content[:start_idx] + '\n    // --- 10. Exam Session Wizard Logic --- (MOVED TO ui_modules/ui_exam_management.js)\n' + ui_content[end_idx:]
    with open(ui_path, 'w', encoding='utf-8') as f:
        f.write(new_ui_content)
    print("Successfully extracted block!")
else:
    print("Markers not found.")
