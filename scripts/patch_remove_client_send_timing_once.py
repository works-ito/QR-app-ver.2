from pathlib import Path

app_path = Path('app.js')
app = app_path.read_text(encoding='utf-8')

app = app.replace('      const clientTimingStartedAt = performance.now();\n', '', 1)
app = app.replace('      const clientFetchStartedAt = performance.now();\n\n', '', 1)
app = app.replace('        const clientHeadersReceivedAt = performance.now();\n', '', 1)
app = app.replace('        const clientResponseTextReadAt = performance.now();\n', '', 1)

start = app.find('        const clientCompletedAt = performance.now();\n        result.clientSendTiming = {')
if start < 0:
    raise SystemExit('client timing result block not found')
end_marker = '        };\n\n        return result;'
end = app.find(end_marker, start)
if end < 0:
    raise SystemExit('client timing result block end not found')
app = app[:start] + '        return result;' + app[end + len(end_marker):]

fmt_start = app.find('    function formatClientSendTiming(result) {')
if fmt_start < 0:
    raise SystemExit('formatClientSendTiming not found')
fmt_end_marker = '    function setWizardSendStatus(message, state) {'
fmt_end = app.find(fmt_end_marker, fmt_start)
if fmt_end < 0:
    raise SystemExit('setWizardSendStatus marker not found')
app = app[:fmt_start] + fmt_end_marker + app[fmt_end + len(fmt_end_marker):]

app = app.replace(' +\n            formatClientSendTiming(result)', '', 10)
app = app.replace(' + formatClientSendTiming(result)', '', 10)

if 'clientSendTiming' in app or 'formatClientSendTiming' in app or 'clientTimingStartedAt' in app or 'clientFetchStartedAt' in app:
    raise SystemExit('client timing instrumentation still remains')

app_path.write_text(app, encoding='utf-8')

index_path = Path('index.html')
index = index_path.read_text(encoding='utf-8')
old = '<script src="./app.js?v=80"></script>'
new = '<script src="./app.js?v=81"></script>'
if old not in index:
    raise SystemExit('app v80 marker not found')
index = index.replace(old, new, 1)
index_path.write_text(index, encoding='utf-8')

print('removed client send timing instrumentation')
