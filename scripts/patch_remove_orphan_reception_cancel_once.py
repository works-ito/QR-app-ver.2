from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')

block = '''      <button
        id="receptionLastSendCancelButton"
        class="wizardCancelSendButton"
        type="button"
      >
        直前送信を取消（5分間有効）
      </button>
'''

if block not in text:
    raise SystemExit('target orphan reception cancel block not found')

text = text.replace(block, '', 1)

if 'receptionLastSendCancelButton' in text:
    raise SystemExit('receptionLastSendCancelButton still remains')

path.write_text(text, encoding='utf-8')
