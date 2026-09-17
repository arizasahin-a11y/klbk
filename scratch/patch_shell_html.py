import re

shell_path = r"A:\TOOLS\kodlama\km\eng pre\English File PREINT Linux\shell.html"

with open(shell_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add XPCOM / Netscape shims and Ruffle / flv.js scripts right before prototype.js
shim_code = '''<script type="text/javascript">
  window.netscape = window.netscape || {
    security: {
      PrivilegeManager: {
        enablePrivilege: function() {}
      }
    }
  };
  window.Components = window.Components || {
    classes: {},
    interfaces: {}
  };
</script>
<script src="ruffle/ruffle.js" type="text/javascript"></script>
<script src="javascripts/flv.min.js" type="text/javascript"></script>
<script src="javascripts/prototype.js" type="text/javascript"></script>'''

html = html.replace('<script src="javascripts/prototype.js" type="text/javascript"></script>', shim_code, 1)

# 2. Update resource paths in dom:loaded
html = re.sub(
    r'Shell\.resource_books_url\s*=\s*"resource://";',
    'Shell.resource_books_url = "";',
    html
)
html = re.sub(
    r'Shell\.resource_assets_url\s*=\s*"resource://";',
    'Shell.resource_assets_url = "assets/";',
    html
)

with open(shell_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("shell.html successfully updated!")
