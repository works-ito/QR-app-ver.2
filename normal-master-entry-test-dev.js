/*
 * マスタ選択受付入口テスト v2
 *
 * START画面に「マスタ選択受付」を追加する。
 * 内部処理は通常受付として進め、設定完了後だけカメラを止めて
 * 既存マスタ選択UIを表示する。
 *
 * GAS / app.js / sendWizardBatch() は変更しない。
 * 通常受付・イレギュラー受付の既存ルートも残す。
 */
(function() {
  "use strict";

  const PICKER_ID = "irregularMasterPickerDev";
  const IRREGULAR_HOST_ID = "wizardIrregularArea";
  const MASTER_HOST_ID = "normalMasterEntryTestHost";
  const MASTER_ENTRY_BUTTON_ID = "masterSelectionReceptionButton";

  let masterSelectionReception = false;

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

  function ensureMasterEntryButton() {
    if (document.getElementById(MASTER_ENTRY_BUTTON_ID)) return;

    const normalButton = document.querySelector(
      '#receptionStep [data-reception-type="normal"]'
    );

    const irregularButton = document.querySelector(
      '#receptionStep [data-reception-type="irregular"]'
    );

    if (!normalButton || !irregularButton || !irregularButton.parentElement) {
      return;
    }

    const button = document.createElement("button");
    button.id = MASTER_ENTRY_BUTTON_ID;
    button.className = "choiceButton";
    button.type = "button";
    button.innerHTML =
      'マスタ選択受付' +
      '<span class="choiceSubText">QRを使わずマスタから対象を選ぶ</span>';

    button.addEventListener("click", function() {
      masterSelectionReception = true;

      if (typeof window.selectReceptionType !== "function") {
        alert("受付画面の準備が完了していません。画面を再読み込みしてください。");
        return;
      }

      window.selectReceptionType("normal");
    });

    irregularButton.parentElement.insertBefore(button, irregularButton);
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

    if (!target || !root) return;

    if (typeof window.stopReadOnlyScanner === "function") {
      window.stopReadOnlyScanner();
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

  function markExistingReceptionButtons() {
    const normalButton = document.querySelector(
      '#receptionStep [data-reception-type="normal"]'
    );
    const irregularButton = document.querySelector(
      '#receptionStep [data-reception-type="irregular"]'
    );

    if (normalButton) {
      normalButton.addEventListener(
        "click",
        function() {
          masterSelectionReception = false;
          restoreScannerVisuals();
        },
        true
      );
    }

    if (irregularButton) {
      irregularButton.addEventListener(
        "click",
        function() {
          masterSelectionReception = false;
          movePickerToIrregular();
        },
        true
      );
    }
  }

  window.addEventListener("entrywizard:complete", function(event) {
    const settings = event && event.detail ? event.detail : null;

    if (!settings) return;

    if (
      masterSelectionReception &&
      settings.receptionType === "normal" &&
      settings.mode !== "検品"
    ) {
      setTimeout(movePickerToMasterReception, 0);
      return;
    }

    if (settings.receptionType === "irregular") {
      movePickerToIrregular();
      return;
    }

    restoreScannerVisuals();
  });

  ensureMasterHost();
  ensureMasterEntryButton();
  markExistingReceptionButtons();

  console.info("開発版：マスタ選択受付入口テスト v2 読込完了");
})();
