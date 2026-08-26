from pathlib import Path

app = Path('app.js')
text = app.read_text(encoding='utf-8')

old = '''      if (\n        settings.mode === "検品"\n      ) {\n        stopReadOnlyScanner();\n      } else if (\n        settings.receptionType ===\n        "normal"\n      ) {\n        startReadOnlyScanner();\n      } else {\n        stopReadOnlyScanner();\n        openWizardIrregularArea();\n      }\n'''
new = '''      if (\n        settings.mode === "検品"\n      ) {\n        stopReadOnlyScanner();\n      } else if (\n        settings.receptionType ===\n        "normal"\n      ) {\n        startReadOnlyScanner();\n      } else if (\n        settings.receptionType ===\n        "irregular"\n      ) {\n        stopReadOnlyScanner();\n        openWizardIrregularArea();\n      } else {\n        stopReadOnlyScanner();\n      }\n'''

count = text.count(old)
if count != 1:
    raise SystemExit(f'Expected exactly one completion route block; found {count}. Aborting.')

text = text.replace(old, new, 1)
app.write_text(text, encoding='utf-8')

index = Path('index.html')
html = index.read_text(encoding='utf-8')
old_key = './app.js?v=71'
new_key = './app.js?v=72'
count_key = html.count(old_key)
if count_key != 1:
    raise SystemExit(f'Expected exactly one {old_key}; found {count_key}. Aborting.')
html = html.replace(old_key, new_key, 1)
index.write_text(html, encoding='utf-8')
