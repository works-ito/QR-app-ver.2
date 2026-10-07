/*
 * AI伝票解析
 *
 * 責務：
 * - AI解析用画像の縮小・JPEG化
 * - GAS analyzeSlipPhoto 呼び出し
 * - 1回だけ解析。失敗・30秒タイムアウト時は手入力へ
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

        const controller = new AbortController();
        const timeout = setTimeout(function() { controller.abort(); }, 30000);
        try {
          const response = await fetch(GAS_URL, {
            method:"POST", headers:{"Content-Type":"text/plain"},
            signal:controller.signal,
            body:JSON.stringify({
              action:"analyzeSlipPhoto", photoBase64:photoBase64,
              photoType:photoType, requestedFields:["customerName", "siteName"],
              analysisRegion:profile.label
            })
          });
          const text = await response.text();
          let result;
          try { result = JSON.parse(text); } catch (parseError) {
            throw new Error("伝票解析結果を読み取れませんでした");
          }
          if (!response.ok || !result || result.ok !== true) {
            throw new Error(result && result.message ? result.message : "伝票情報を取得できませんでした");
          }
          const customerName = sanitizeWizardPhotoTitlePart(result.customerName);
          const siteName = sanitizeWizardPhotoTitlePart(result.siteName);
          if (!customerName && !siteName) throw new Error("顧客名・現場名を判定できませんでした");
          wizardCurrentSlipInfo = {
            customerName:customerName, siteName:siteName, originalSiteName:siteName,
            acquisitionMethod:result.acquisitionMethod || "ai_ocr", siteNameEdited:false,
            confirmedTitle:buildWizardPhotoTitle(customerName, siteName),
            acquiredAt:new Date().toISOString(), analysisRegion:profile.label,
            analysisModel:result.analysisModel || "", geminiFetchMs:Number(result.geminiFetchMs || 0)
          };
          return wizardCurrentSlipInfo;
        } finally {
          clearTimeout(timeout);
        }

      } catch (error) {
        console.warn(
          "伝票情報取得失敗（AI解析）",
          error
        );

        wizardCurrentSlipInfo = null;
        return null;

      } finally {
        stopAnimatedDots("wizardPhotoPreview");
      }
    };
})();

