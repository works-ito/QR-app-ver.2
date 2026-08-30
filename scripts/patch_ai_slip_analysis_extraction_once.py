from pathlib import Path
import json

app_path = Path("app.js")
app = app_path.read_text(encoding="utf-8")

image_start_marker = "    async function makeWizardSlipAnalysisImage(file, options) {"
fetch_retry_marker = "    async function fetchWithRetry(url, options, retryCount = 1, retryDelayMs = 1200) {"
analyze_start_marker = "    async function analyzeWizardSlipPhoto(file, photoType) {"
draw_marker = "    function drawWizardImageCover(context, image, x, y, width, height) {"

image_start = app.find(image_start_marker)
fetch_retry_start = app.find(fetch_retry_marker, image_start)
if image_start < 0 or fetch_retry_start < 0:
    raise SystemExit("AI image preparation block not found")

analyze_start = app.find(analyze_start_marker)
draw_start = app.find(draw_marker, analyze_start)
if analyze_start < 0 or draw_start < 0:
    raise SystemExit("AI analysis block not found")

if app.count(image_start_marker) != 1 or app.count(analyze_start_marker) != 1:
    raise SystemExit("AI blocks are not unique")

app = app[:image_start] + app[fetch_retry_start:analyze_start] + app[draw_start:]

if "makeWizardSlipAnalysisImage" in app:
    raise SystemExit("makeWizardSlipAnalysisImage still remains in app.js")
if "async function analyzeWizardSlipPhoto" in app:
    raise SystemExit("analyzeWizardSlipPhoto definition still remains in app.js")

app_path.write_text(app, encoding="utf-8")

ai = r'''/*
 * AI伝票解析
 *
 * 責務：
 * - AI解析用画像の縮小・JPEG化
 * - GAS analyzeSlipPhoto 呼び出し
 * - 失敗時の1回retry
 * - 顧客名・現場名の解析結果整形
 *
 * app.js の後に読み込む。
 */
(function() {
  "use strict";

  window.makeWizardSlipAnalysisImage =
    async function(file, options) {
      const settings = options || {};
      const image = await loadWizardPhotoImage(file);
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      const cropRatio = Math.max(
        0.1,
        Math.min(1, Number(settings.cropRatio) || 1)
      );
      const sourceHeight = Math.max(
        1,
        Math.round(height * cropRatio)
      );
      const maxSide = Number(settings.maxSide) || 1600;
      const quality = Number(settings.quality) || 0.85;
      const scale = Math.min(
        1,
        maxSide / Math.max(width, sourceHeight)
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        0, 0, width, sourceHeight,
        0, 0, canvas.width, canvas.height
      );
      return canvas.toDataURL("image/jpeg", quality);
    };

  window.analyzeWizardSlipPhoto =
    async function(file, photoType) {
      startAnimatedDots(
        "wizardPhotoPreview",
        "伝票情報を確認しています"
      );

      const profile = {
        label:"全体1回",
        cropRatio:1,
        maxSide:1024,
        quality:0.75
      };

      try {
        const photoBase64 =
          await window.makeWizardSlipAnalysisImage(
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
    };
})();
'''
Path("ai-slip-analysis.js").write_text(ai, encoding="utf-8")

index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8")
old = '  <script src="./app.js?v=78"></script>\n  <script src="./sales-stockin.js?v=148"></script>'
new = '  <script src="./app.js?v=79"></script>\n  <script src="./ai-slip-analysis.js?v=1"></script>\n  <script src="./sales-stockin.js?v=148"></script>'
if old not in index:
    raise SystemExit("index load order marker not found")
index = index.replace(old, new, 1)
index_path.write_text(index, encoding="utf-8")

Path("version.json").write_text(
    json.dumps(
        {"version":"2.2-20260830-ai-module1"},
        ensure_ascii=False
    ) + "\n",
    encoding="utf-8"
)

print("AI slip analysis extracted to ai-slip-analysis.js")
