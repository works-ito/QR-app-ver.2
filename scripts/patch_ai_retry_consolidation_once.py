from pathlib import Path
import json

app = Path("app.js")
text = app.read_text(encoding="utf-8")
start_marker = '    async function analyzeWizardSlipPhoto(file, photoType) {'
end_marker = '    function drawWizardImageCover(context, image, x, y, width, height) {'
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0 or text.count(start_marker) != 1:
    raise SystemExit("analyzeWizardSlipPhoto block not found uniquely")
replacement = r'''    async function analyzeWizardSlipPhoto(file, photoType) {
      startAnimatedDots("wizardPhotoPreview", "伝票情報を確認しています");

      const profile = {
        label:"全体1回",
        cropRatio:1,
        maxSide:1024,
        quality:0.75
      };

      try {
        const photoBase64 =
          await makeWizardSlipAnalysisImage(
            file,
            profile
          );

        let lastError = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const response = await fetch(GAS_URL, {
              method:"POST",
              headers:{"Content-Type":"text/plain"},
              body:JSON.stringify({
                action:"analyzeSlipPhoto",
                photoBase64:photoBase64,
                photoType:photoType,
                requestedFields:["customerName", "siteName"],
                analysisRegion:profile.label
              })
            });

            const text = await response.text();
            let result;

            try {
              result = JSON.parse(text);
            } catch (parseError) {
              throw new Error(
                "伝票解析結果を読み取れませんでした\n" +
                text.slice(0, 200)
              );
            }

            if (!response.ok || !result || result.ok !== true) {
              throw new Error(
                result && result.message
                  ? result.message
                  : "伝票情報を取得できませんでした"
              );
            }

            const customerName =
              sanitizeWizardPhotoTitlePart(
                result.customerName
              );

            const siteName =
              sanitizeWizardPhotoTitlePart(
                result.siteName
              );

            if (!customerName && !siteName) {
              throw new Error(
                "顧客名・現場名を判定できませんでした"
              );
            }

            wizardCurrentSlipInfo = {
              customerName:customerName,
              siteName:siteName,
              originalSiteName:siteName,
              acquisitionMethod:
                result.acquisitionMethod || "ai_ocr",
              siteNameEdited:false,
              confirmedTitle:
                buildWizardPhotoTitle(
                  customerName,
                  siteName
                ),
              acquiredAt:new Date().toISOString(),
              analysisRegion:profile.label,
              analysisModel:
                result.analysisModel || "",
              geminiFetchMs:Number(
                result.geminiFetchMs || 0
              )
            };

            return wizardCurrentSlipInfo;

          } catch (error) {
            lastError = error;

            if (attempt >= 2) break;

            const preview = document.getElementById(
              "wizardPhotoPreview"
            );

            if (preview) {
              preview.innerText =
                "AI解析をもう一度試しています...\n" +
                "写真保存は失敗しても続行できます。";
            }

            console.warn(
              "伝票情報取得失敗。AI解析を再試行します。",
              error
            );

            await new Promise(function(resolve) {
              setTimeout(resolve, 1600);
            });
          }
        }

        throw lastError || new Error(
          "伝票情報を取得できませんでした"
        );

      } catch (error) {
        console.warn(
          "伝票情報取得失敗（AI解析）",
          error
        );

        alert(
          "伝票情報の解析に失敗しました\n\n" +
          (error.message || String(error)) +
          "\n\n写真保存はこのまま続行できます。"
        );

        wizardCurrentSlipInfo = null;
        return null;

      } finally {
        stopAnimatedDots("wizardPhotoPreview");
      }
    }

'''
text = text[:start] + replacement + text[end:]
app.write_text(text, encoding="utf-8")

scanner = Path("scanner-try-harder-dev.js")
scanner_text = scanner.read_text(encoding="utf-8")
scanner_text = scanner_text.replace(
    "/* 開発版：LINE内ブラウザ対策の途中作業復旧＋AI解析安定化 */",
    "/* 開発版：LINE内ブラウザ対策の途中作業復旧 */",
    1,
)
retry_start = scanner_text.find("  function installAiAnalysisRetry() {")
retry_end_marker = "\n  setTimeout(function() {"
retry_end = scanner_text.find(retry_end_marker, retry_start)
if retry_start < 0 or retry_end < 0:
    raise SystemExit("AI retry wrapper block not found")
scanner_text = scanner_text[:retry_start] + scanner_text[retry_end:]
scanner_text = scanner_text.replace(
    "    installDraftAutosave();\n    installAiAnalysisRetry();\n    offerDraftRestore();",
    "    installDraftAutosave();\n    offerDraftRestore();",
    1,
)
if "installAiAnalysisRetry" in scanner_text:
    raise SystemExit("AI retry wrapper reference remains")
scanner.write_text(scanner_text, encoding="utf-8")

index = Path("index.html")
index_text = index.read_text(encoding="utf-8")
for old, new in [
    ('./scanner-try-harder-dev.js?v=49', './scanner-try-harder-dev.js?v=50'),
    ('./app.js?v=77', './app.js?v=78'),
]:
    if old not in index_text:
        raise SystemExit(f"index marker missing: {old}")
    index_text = index_text.replace(old, new, 1)
index.write_text(index_text, encoding="utf-8")

Path("version.json").write_text(
    json.dumps({"version":"2.2-20260830-ai-retry-core"}, ensure_ascii=False) + "\n",
    encoding="utf-8",
)

print("AI retry consolidation patch completed")
