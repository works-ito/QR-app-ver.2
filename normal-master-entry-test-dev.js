/*
 * マスタ選択受付入口テスト v3
 *
 * START画面の「マスタ選択受付」は、app.js が受付ボタンへ
 * イベントを束ねる前に同じグリッドへ配置される。
 * 内部処理は通常受付として進めるが、マスタ選択受付では
 * QRカメラを最初から起動しない。
 *
 * GAS / sendWizardBatch() は変更しない。
 * 通常受付・イレギュラー受付の既存ルートも残す。
 */
(function() {
  "use strict";

  const PICKER_ID = "irregularMasterPickerDev";
  const IRREGULAR_HOST_ID = "wizardIrregularArea";
  const MASTER_HOST_ID = "normalMasterEntryTestHost";
  const MASTER_ENTRY_BUTTON_ID = "masterSelectionReceptionButton";

  const originalStartReadOnlyScanner =
    typeof window.startReadOnlyScanner === "function"
      ? window.startReadOnlyScanner
      : null;

  function isMasterReception() {
    return window.__masterSelectionReception === true;
  }

  if (originalStartReadOnlyScanner) {
    window.startReadOnlyScanner = function() {
      if (isMasterReception()) {
        return Promise.resolve();
      }

      return originalStartReadOnlyScanner.apply(this, arguments);
    };
  }

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

    if (!target || !root) return;

    if (typeof window.stopReadOnlyScanner === "function") {
      window.stopReadOnlyScanner();
    }

    if (area) {
      area.classList.remove("isActive");
    }

    if (status) status.hidden = true;
    if (viewport) viewport.hidden = true;

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

  function bindReceptionButtons() {
    const masterButton = document.getElementById(MASTER_ENTRY_BUTTON_ID);
    const normalButton = document.querySelector(
      '#receptionStep [data-reception-type="normal"]:not(#' + MASTER_ENTRY_BUTTON_ID + ')'
    );
    const irregularButton = document.querySelector(
      '#receptionStep [data-reception-type="irregular"]'
    );

    if (masterButton && masterButton.dataset.masterReceptionBound !== "true") {
      masterButton.dataset.masterReceptionBound = "true";
      masterButton.addEventListener("click", function() {
        window.__masterSelectionReception = true;
      }, true);
    }

    if (normalButton && normalButton.dataset.masterReceptionResetBound !== "true") {
      normalButton.dataset.masterReceptionResetBound = "true";
      normalButton.addEventListener("click", function() {
        window.__masterSelectionReception = false;
        restoreScannerVisuals();
      }, true);
    }

    if (irregularButton && irregularButton.dataset.masterReceptionResetBound !== "true") {
      irregularButton.dataset.masterReceptionResetBound = "true";
      irregularButton.addEventListener("click", function() {
        window.__masterSelectionReception = false;
        movePickerToIrregular();
      }, true);
    }
  }

  window.addEventListener("entrywizard:complete", function(event) {
    const settings = event && event.detail ? event.detail : null;

    if (!settings) return;

    if (
      isMasterReception() &&
      settings.receptionType === "normal" &&
      settings.mode !== "検品"
    ) {
      movePickerToMasterReception();
      return;
    }

    if (settings.receptionType === "irregular") {
      movePickerToIrregular();
      return;
    }

    restoreScannerVisuals();
  });

  ensureMasterHost();
  bindReceptionButtons();

  console.info("開発版：マスタ選択受付入口テスト v3 読込完了");
})();
