/*
 * マスタ選択受付入口テスト v6
 *
 * START画面の「マスタ選択受付」は receptionType=master として進める。
 * QRカメラは起動しない。
 * 設定完了後、既存のマスタ選択UIを completeStep 直下の専用ホストへ移し、
 * 通常送信ブリッジへ接続する。
 *
 * 重要：専用ホストは cameraPreview の外に置く。
 * cameraPreview を非表示にしてもマスタ選択UIまで消えない構造にする。
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

  function connectionNote() {
    return document.getElementById("connectionNote");
  }

  function ensureMasterHost() {
    let host = document.getElementById(MASTER_HOST_ID);
    if (host) return host;

    const completeStep = document.getElementById("completeStep");
    const area = scannerArea();

    if (!completeStep || !area) return null;

    host = document.createElement("div");
    host.id = MASTER_HOST_ID;
    host.hidden = true;

    /*
     * cameraPreview の外側に置く。
     * これで cameraPreview を非表示にしてもマスタUIは表示できる。
     */
    completeStep.insertBefore(host, area);
    return host;
  }

  function restoreScannerVisuals() {
    const area = scannerArea();
    const status = scannerStatus();
    const viewport = scannerViewport();
    const note = connectionNote();
    const host = document.getElementById(MASTER_HOST_ID);

    if (area) area.hidden = false;
    if (status) status.hidden = false;
    if (viewport) viewport.hidden = false;
    if (note) note.hidden = false;
    if (host) host.hidden = true;
  }

  function movePickerToMasterReception() {
    const target = ensureMasterHost();
    const root = picker();
    const area = scannerArea();
    const note = connectionNote();
    const irregular = irregularHost();

    if (!target || !root) {
      console.error("マスタ選択受付：マスタ選択UIを確認できません");
      return false;
    }

    if (typeof window.stopReadOnlyScanner === "function") {
      window.stopReadOnlyScanner();
    }

    /* カメラ領域そのものを隠し、専用ホストだけ表示する */
    if (area) {
      area.classList.remove("isActive");
      area.hidden = true;
    }
    if (note) note.hidden = true;
    if (irregular) irregular.hidden = true;

    target.hidden = false;
    target.appendChild(root);

    const lead = root.querySelector(".irregularMasterLead");
    if (lead) {
      lead.textContent =
        "QRは使用しません。大分類 → 機種・品目 → 管理番号／数量の順に選択してください。";
    }

    const openButton = document.getElementById("irregularMasterPickerOpenButton");
    if (openButton) {
      const small = openButton.querySelector("small");
      openButton.childNodes.forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          node.textContent = "\n          商品選択へ進む\n          ";
        }
      });
      if (small) {
        small.textContent = "大分類 → 機種・品目 → 管理番号／数量";
      }
    }

    target.scrollIntoView({behavior:"smooth", block:"start"});
    return true;
  }

  function openMasterReceptionWithRetry(attempt) {
    const count = Number(attempt || 0);
    if (movePickerToMasterReception()) return;

    if (count >= 10) return;
    setTimeout(function() {
      openMasterReceptionWithRetry(count + 1);
    }, 100);
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

    const openButton = document.getElementById("irregularMasterPickerOpenButton");
    if (openButton) {
      const small = openButton.querySelector("small");
      openButton.childNodes.forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          node.textContent = "\n          マスタから選ぶ\n          ";
        }
      });
      if (small) {
        small.textContent = "大分類 → 機種・品目 → 管理番号／数量";
      }
    }
  }

  window.addEventListener("entrywizard:complete", function(event) {
    const settings = event && event.detail ? event.detail : null;
    if (!settings) return;

    if (
      settings.receptionType === "master" &&
      settings.mode !== "検品"
    ) {
      /* app.js の完了後処理が終わってから確実に専用UIへ切り替える */
      setTimeout(function() {
        openMasterReceptionWithRetry(0);
      }, 30);
      return;
    }

    if (settings.receptionType === "irregular") {
      setTimeout(movePickerToIrregular, 0);
      return;
    }

    restoreScannerVisuals();
  });

  ensureMasterHost();

  console.info("開発版：マスタ選択受付入口テスト v6 読込完了");
})();
