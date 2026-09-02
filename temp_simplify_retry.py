from pathlib import Path
import re
p=Path('app.js')
s=p.read_text()
state=re.compile(r'''        for \(\n          let attempt = 1;\n          attempt <= 2;\n          attempt\+\+\n        \) \{\n          response = await fetchWithRetry\(\n            GAS_URL \+\n              "\?t=" \+ Date\.now\(\) \+\n              "&stateAttempt=" \+ attempt,\n(?P<body>.*?)\n          \);\n\n          responseText =\n            await response\.text\(\);\n\n          if \(response\.ok\) break;\n\n          if \(attempt === 1\) \{\n            await new Promise\(\n              function\(resolve\) \{\n                setTimeout\(resolve, 700\);\n              \}\n            \);\n          \}\n        \}''',re.S)
full=re.compile(r'''        for \(\n          let attempt = 1;\n          attempt <= 2;\n          attempt\+\+\n        \) \{\n          response = await fetchWithRetry\(\n            GAS_URL \+\n              "\?t=" \+ Date\.now\(\) \+\n              "&attempt=" \+ attempt,\n(?P<body>.*?)\n          \);\n\n          responseText =\n            await response\.text\(\);\n\n          if \(response\.ok\) break;\n\n          if \(attempt === 1\) \{\n            await new Promise\(\n              function\(resolve\) \{\n                setTimeout\(resolve, 1000\);\n              \}\n            \);\n          \}\n        \}''',re.S)
sm=state.search(s); fm=full.search(s)
if not sm: raise SystemExit('current-state block not found')
if not fm: raise SystemExit('full-sync block not found')
state_new='        response = await fetchWithRetry(\n          GAS_URL +\n            "?t=" + Date.now() +\n            "&stateRequest=1",\n'+sm.group('body').replace('            {','          {',1)+'\n        );\n\n        responseText =\n          await response.text();'
full_new='        response = await fetchWithRetry(\n          GAS_URL +\n            "?t=" + Date.now() +\n            "&fullRequest=1",\n'+fm.group('body').replace('            {','          {',1)+'\n        );\n\n        responseText =\n          await response.text();'
s,n1=state.subn(lambda m:state_new,s,count=1)
s,n2=full.subn(lambda m:full_new,s,count=1)
if (n1,n2)!=(1,1): raise SystemExit(f'replacement mismatch {n1},{n2}')
if 'attempt <= 2;' in s: raise SystemExit('outer retry remains')
p.write_text(s)
i=Path('index.html'); h=i.read_text(); old='<script src="./app.js?v=85"></script>'; new='<script src="./app.js?v=86"></script>'
if h.count(old)!=1: raise SystemExit(f'loader mismatch {h.count(old)}')
i.write_text(h.replace(old,new,1))