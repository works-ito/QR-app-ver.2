/*
 * マスタ選択受付入口テスト v4
 *
 * START画面の「マスタ選択受付」は receptionType=master として進める。
 * app.js 側では normal ではないため QRカメラは起動しない。
 * 設定完了後、既存のイレギュラーマスタ選択UIだけを
 * マスタ受付用ホストへ移し、通常送信ブリッジへ接続する。
 *
 * GAS / sendWizardBatch() は変更しない。
 */
(function() {
  "use strict";

  const PICKER_ID = "irregularMasterPickerDev";
  const IRREGULAR_HOST_ID = "wizardIrregularArea";
  const MASTER_HOST_ID = "normalMasterEntryTestHost";

  function picker() {
    return document.getElementById(PICKER_ID);
  }

  function irregularHost() {
    return document.getElementById(IRREGULAR_HOST_ID);
  }

  function scannerArea() {
    return document.getElementById("cameraPreview");
  }

  function scannerStatus() {
    return document.getElementById("scannerStatus");
  }

  function scannerViewport() {
    return document.getElementById("scannerViewport");
  }

  function ensureMasterHost() {
    let host = document.getElementById(MASTER_HOST_ID);
    if (host) return host;

    const area = scannerArea();
    const result = document.getElementById("scannerResult");

    if (!area || !result) return null;

    host = document.createElement("div");
    host.id = MASTER_HOST_ID;
    host.hidden = true;

    area.insertBefore(host, result);
    return host;
  }

  function restoreScannerVisuals() {
    const status = scannerStatus();
    const viewport = scannerViewport();
    const host = document.getElementById(MASTER_HOST_ID);

    if (status) status.hidden = false;
    if (viewport) viewport.hidden = false;
    if (host) host.hidden = true;
  }

  function movePickerToMasterReception() {
    const target = ensureMasterHost();
    const root = picker();
    const status = scannerStatus();
    const viewport = scannerViewport();
    const area = scannerArea();
    const irregular = irregularHost();

    if (!target || !root) {
      console.error("マスタ選択受付：マスタ選択UIを確認できません");
      return;
    }

    if (typeof window.stopReadOnlyScanner === "function") {
      window.stopReadOnlyScanner();
    }

    if (area) area.classList.remove("isActive");
    if (status) status.hidden = true;
    if (viewport) viewport.hidden = true;
    if (irregular) irregular.hidden = true;

    target.hidden = false;
    target.appendChild(root);

    const lead = root.querySelector(".irregularMasterLead");
    if (lead) {
      lead.textContent =
        "QRは使用しません。大分類 → 機種・品目 → 管理番号／数量の順に選択してください。";
    }

    const openButton = document.getElementById("irregularMasterPickerOpenButton");
    const panel = document.getElementById("irregularMasterPickerPanel");

    if (openButton && panel && panel.hidden) {
      openButton.click();
    }

    target.scrollIntoView({behavior:"smooth", block:"start"});
  }

  function movePickerToIrregular() {
    const target = irregularHost();
    const root = picker();

    if (!target || !root) return;

    restoreScannerVisuals();

    const heading = target.querySelector("h3");
    if (heading) heading.insertAdjacentElement("afterend", root);
    else target.prepend(root);

    const lead = root.querySelector(".irregularMasterLead");
    if (lead) {
      lead.textContent =
        "QRがない・読めない場合は、マスタから対象を選べます。既存の直接入力・番号不明もそのまま使用できます。";
    }
  }

  window.addEventListener("entrywizard:complete", function(event) {
    const settings = event && event.detail ? event.detail : null;
    if (!settings) return;

    if (
      settings.receptionType === "master" &&
      settings.mode !== "検品"
    ) {
      setTimeout(movePickerToMasterReception, 0);
      return;
    }

    if (settings.receptionType === "irregular") {
      setTimeout(movePickerToIrregular, 0);
      return;
    }

    restoreScannerVisuals();
  });

  ensureMasterHost();

  console.info("開発版：マスタ選択受付入口テスト v4 読込完了");
})();
