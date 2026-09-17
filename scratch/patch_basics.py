import re

# 1. Patch persistence.js
persistence_path = r"A:\TOOLS\kodlama\km\eng pre\English File PREINT Linux\javascripts\persistence.js"
with open(persistence_path, 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(
    r'init\s*:\s*function\s*\([^\)]*\)\s*\{[\s\S]*?ActiveRecord\.logging',
    '''init : function(path) {
      try {
        ActiveRecord.connect(ActiveRecord.Adapters.InMemory);
      } catch (e) {
        console.warn("ActiveRecord InMemory fallback:", e);
      }
      ActiveRecord.logging''',
    text
)
with open(persistence_path, 'w', encoding='utf-8') as f:
    f.write(text)
print("persistence.js patched!")

# 2. Patch page.navigation.js to handle resource:// in loadURI
nav_path = r"A:\TOOLS\kodlama\km\eng pre\English File PREINT Linux\javascripts\page.navigation.js"
with open(nav_path, 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(
    r'loadURI\s*:\s*function\s*\(uri\)\s*\{\s*if\s*\(uri\)\s*location\.href\s*=\s*uri;\s*\}',
    '''loadURI: function (uri) {
    if (uri) {
      if (uri.indexOf("resource://") === 0) {
        uri = uri.replace("resource://", "assets/");
      }
      window.open(uri, '_blank');
    }
  }''',
    text
)
with open(nav_path, 'w', encoding='utf-8') as f:
    f.write(text)
print("page.navigation.js patched!")
