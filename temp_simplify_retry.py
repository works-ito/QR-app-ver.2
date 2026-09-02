from pathlib import Path
p=Path('app.js')
s=p.read_text()

def replace_loop(text, marker, delay):
    marker_pos=text.index(marker)
    start=text.rfind('        for (\n',0,marker_pos)
    if start<0: raise SystemExit('loop start not found for '+marker)
    tail='''          if (attempt === 1) {
            await new Promise(
              function(resolve) {
                setTimeout(resolve, DELAY);
              }
            );
          }
        }'''.replace('DELAY',str(delay))
    end=text.index(tail,marker_pos)+len(tail)
    block=text[start:end]
    fetch_start=block.index('          response = await fetchWithRetry(')
    fetch_end=block.index('          );',fetch_start)+len('          );')
    fetch_block=block[fetch_start:fetch_end]
    fetch_block=fetch_block.replace('          response =','        response =',1)
    fetch_block=fetch_block.replace('            GAS_URL +','          GAS_URL +',1)
    if marker=='"&stateAttempt=" + attempt':
        fetch_block=fetch_block.replace('              "&stateAttempt=" + attempt','            "&stateRequest=1"',1)
    else:
        fetch_block=fetch_block.replace('              "&attempt=" + attempt','            "&fullRequest=1"',1)
    fetch_block=fetch_block.replace('\n            {','\n          {',1)
    fetch_block=fetch_block.replace('\n          );','\n        );',1)
    replacement=fetch_block+'\n\n        responseText =\n          await response.text();'
    return text[:start]+replacement+text[end:]

s=replace_loop(s,'"&stateAttempt=" + attempt',700)
s=replace_loop(s,'"&attempt=" + attempt',1000)
if 'attempt <= 2;' in s: raise SystemExit('outer retry remains')
if s.count('&stateRequest=1')!=1 or s.count('&fullRequest=1')!=1: raise SystemExit('request markers mismatch')
p.write_text(s)

i=Path('index.html'); h=i.read_text(); old='<script src="./app.js?v=85"></script>'; new='<script src="./app.js?v=86"></script>'
if h.count(old)!=1: raise SystemExit('loader mismatch '+str(h.count(old)))
i.write_text(h.replace(old,new,1))