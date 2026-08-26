from pathlib import Path

index = Path("index.html")
text = index.read_text(encoding="utf-8")

picker_start_marker = '      <!-- イレギュラー受付：マスタ選択 -->\n      <div id="irregularMasterPickerDev">'
picker_end_marker = '      <label for="wizardIrregularNote">状況・理由</label>'
picker_start = text.find(picker_start_marker)
picker_end = text.find(picker_end_marker, picker_start)

if picker_start == -1 or picker_end == -1 or picker_end <= picker_start:
    raise SystemExit("Master picker block markers not found; aborting without changes.")
if text.find(picker_start_marker, picker_start + 1) != -1:
    raise SystemExit("Multiple master picker blocks found; aborting.")

picker_block = text[picker_start:picker_end]
text_without_picker = text[:picker_start] + text[picker_end:]

host_marker = '      <div id="cameraPreview" class="scannerArea">'
host_pos = text_without_picker.find(host_marker)
if host_pos == -1:
    raise SystemExit("cameraPreview insertion marker not found; aborting.")
if text_without_picker.find(host_marker, host_pos + 1) != -1:
    raise SystemExit("Multiple cameraPreview markers found; aborting.")
if 'id="normalMasterEntryTestHost"' in text_without_picker:
    raise SystemExit("Static master host already exists; aborting.")

picker_content = picker_block.replace(
    '      <!-- イレギュラー受付：マスタ選択 -->\n',
    '',
    1,
)
picker_content = ''.join(
    ('  ' + line if line.strip() else line)
    for line in picker_content.splitlines(True)
)

host_block = (
    '      <div id="normalMasterEntryTestHost" hidden>\n'
    + picker_content
    + '      </div>\n\n'
)

new_text = text_without_picker[:host_pos] + host_block + text_without_picker[host_pos:]
if new_text == text:
    raise SystemExit("No index.html change produced; aborting.")
index.write_text(new_text, encoding="utf-8")

normal = Path("normal-master-entry-test-dev.js")
normal_text = normal.read_text(encoding="utf-8")

if normal_text.count(" * マスタ選択受付入口テスト v8") != 1:
    raise SystemExit("Expected v8 header exactly once; aborting.")
normal_text = normal_text.replace(
    " * マスタ選択受付入口テスト v8",
    " * マスタ選択受付入口テスト v9",
    1,
)

for old in [
    '  const IRREGULAR_HOST_ID = "wizardIrregularArea";\n',
    '  function irregularHost() { return document.getElementById(IRREGULAR_HOST_ID); }\n',
    '    const irregular = irregularHost();\n',
    '    if (irregular) irregular.hidden = true;\n',
    '    target.appendChild(root);\n',
]:
    if normal_text.count(old) != 1:
        raise SystemExit(f"Expected exactly one marker: {old!r}")
    normal_text = normal_text.replace(old, "", 1)

old_ensure = '''  function ensureMasterHost() {
    let host = document.getElementById(MASTER_HOST_ID);
    if (host) return host;
    const completeStep = document.getElementById("completeStep");
    const area = scannerArea();
    if (!completeStep || !area) return null;
    host = document.createElement("div");
    host.id = MASTER_HOST_ID;
    host.hidden = true;
    completeStep.insertBefore(host, area);
    return host;
  }
'''
new_ensure = '''  function ensureMasterHost() {
    return document.getElementById(MASTER_HOST_ID);
  }
'''
if normal_text.count(old_ensure) != 1:
    raise SystemExit("ensureMasterHost block mismatch; aborting.")
normal_text = normal_text.replace(old_ensure, new_ensure, 1)

move_start_marker = "  function movePickerToIrregular() {"
move_end_marker = '  window.addEventListener("entrywizard:complete", function(event) {'
move_start = normal_text.find(move_start_marker)
move_end = normal_text.find(move_end_marker, move_start)
if move_start == -1 or move_end == -1 or move_end <= move_start:
    raise SystemExit("movePickerToIrregular markers not found; aborting.")
if normal_text.find(move_start_marker, move_start + 1) != -1:
    raise SystemExit("Multiple movePickerToIrregular functions found; aborting.")
replacement_move = '''  function hideMasterReceptionUi() {
    const host = ensureMasterHost();
    const root = picker();
    if (host) host.hidden = true;
    if (root) root.hidden = true;
  }

'''
normal_text = normal_text[:move_start] + replacement_move + normal_text[move_end:]

old_event = '''    if (settings.receptionType === "irregular") {
      setTimeout(movePickerToIrregular, 0);
      return;
    }
    restoreScannerVisuals();
'''
new_event = '''    if (settings.receptionType === "irregular") {
      hideMasterReceptionUi();
      return;
    }
    restoreScannerVisuals();
'''
if normal_text.count(old_event) != 1:
    raise SystemExit("Irregular event branch mismatch; aborting.")
normal_text = normal_text.replace(old_event, new_event, 1)

if normal_text.count("マスタ選択受付入口テスト v8 読込完了") != 1:
    raise SystemExit("v8 console marker mismatch; aborting.")
normal_text = normal_text.replace(
    "マスタ選択受付入口テスト v8 読込完了",
    "マスタ選択受付入口テスト v9 読込完了",
    1,
)
normal.write_text(normal_text, encoding="utf-8")

sales = Path("sales-stockin.js")
sales_text = sales.read_text(encoding="utf-8")
if sales_text.count("/* 販売品入庫受付 v143 bootstrap */") != 1:
    raise SystemExit("sales-stockin bootstrap version mismatch; aborting.")
sales_text = sales_text.replace(
    "/* 販売品入庫受付 v143 bootstrap */",
    "/* 販売品入庫受付 v144 bootstrap */",
    1,
)
if sales_text.count("./normal-master-entry-test-dev.js?v=8") != 1:
    raise SystemExit("normal-master-entry v8 loader mismatch; aborting.")
sales_text = sales_text.replace(
    "./normal-master-entry-test-dev.js?v=8",
    "./normal-master-entry-test-dev.js?v=9",
    1,
)
sales.write_text(sales_text, encoding="utf-8")
