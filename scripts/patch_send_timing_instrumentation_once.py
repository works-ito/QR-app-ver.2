from pathlib import Path
import json

app_path = Path("app.js")
app = app_path.read_text(encoding="utf-8")

# 1) sendBatchRecords の開始時刻
marker = '    function sendBatchRecords(records, options) {\n      const batchId = createBatchId();'
replacement = '    function sendBatchRecords(records, options) {\n      const clientTimingStartedAt = performance.now();\n      const batchId = createBatchId();'
if marker not in app:
    raise SystemExit("sendBatchRecords start marker not found")
app = app.replace(marker, replacement, 1)

# 2) fetch開始時刻
marker = '''      /*
       * 在庫送信は自動再送しない。
       * GASで登録済みなのに応答だけ失われた場合の
       * 二重登録を避けるため、結果不明として止める。
       */
      return fetch(GAS_URL, {'''
replacement = '''      /*
       * 在庫送信は自動再送しない。
       * GASで登録済みなのに応答だけ失われた場合の
       * 二重登録を避けるため、結果不明として止める。
       */
      const clientFetchStartedAt = performance.now();

      return fetch(GAS_URL, {'''
if marker not in app:
    raise SystemExit("fetch start marker not found")
app = app.replace(marker, replacement, 1)

# 3) response headers / body read 時刻
marker = '''      }).then(async function(response) {
        const responseText = await response.text();
        let result;

        try {
          result = JSON.parse(responseText);'''
replacement = '''      }).then(async function(response) {
        const clientHeadersReceivedAt = performance.now();
        const responseText = await response.text();
        const clientResponseTextReadAt = performance.now();
        let result;

        try {
          result = JSON.parse(responseText);'''
if marker not in app:
    raise SystemExit("response timing marker not found")
app = app.replace(marker, replacement, 1)

# 4) 正常JSON解析後に計測値を result へ付与
marker = '''        if (!result.sendId) {
          result.sendId = batchId;
        }

        return result;
      });
    }

    function setWizardSendStatus(message, state) {'''
replacement = '''        if (!result.sendId) {
          result.sendId = batchId;
        }

        const clientCompletedAt = performance.now();
        result.clientSendTiming = {
          prepareMs:Math.round(
            clientFetchStartedAt - clientTimingStartedAt
          ),
          fetchWaitMs:Math.round(
            clientHeadersReceivedAt - clientFetchStartedAt
          ),
          responseReadMs:Math.round(
            clientResponseTextReadAt - clientHeadersReceivedAt
          ),
          afterReadMs:Math.round(
            clientCompletedAt - clientResponseTextReadAt
          ),
          totalMs:Math.round(
            clientCompletedAt - clientTimingStartedAt
          )
        };

        return result;
      });
    }

    function formatClientSendTiming(result) {
      const timing = result && result.clientSendTiming;
      if (!timing) return "";

      return (
        "\\n送信計測：準備 " + timing.prepareMs + "ms" +
        " / 通信 " + timing.fetchWaitMs + "ms" +
        " / 読込 " + timing.responseReadMs + "ms" +
        " / 後処理 " + timing.afterReadMs + "ms" +
        " / 合計 " + timing.totalMs + "ms"
      );
    }

    function setWizardSendStatus(message, state) {'''
if marker not in app:
    raise SystemExit("result timing marker not found")
app = app.replace(marker, replacement, 1)

# 5) 成功・一部失敗カードに計測結果を付加
needle = '(result.sendId || lastPendingSendId),'
if app.count(needle) != 2:
    raise SystemExit(f"unexpected sendId status count: {app.count(needle)}")
app = app.replace(
    needle,
    '(result.sendId || lastPendingSendId) +\n            formatClientSendTiming(result),',
    2
)

app_path.write_text(app, encoding="utf-8")

index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8")
old = './app.js?v=79'
new = './app.js?v=80'
if old not in index:
    raise SystemExit("app cache marker not found")
index = index.replace(old, new, 1)
index_path.write_text(index, encoding="utf-8")

Path("version.json").write_text(
    json.dumps(
        {"version":"2.2-20260830-send-timing1"},
        ensure_ascii=False
    ) + "\n",
    encoding="utf-8"
)

print("client send timing instrumentation applied")
