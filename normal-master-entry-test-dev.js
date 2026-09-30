/*
 * マスタ選択受付入口テスト v15
 *
 * START画面の「マスタ選択受付」は receptionType=master として進める。
 * QRカメラは起動しない。
 * 設定完了後、completeStep 直下の専用ホストに常設したマスタ選択UIを表示し、
 * 通常送信ブリッジへ接続する。
 *
 * 重要：専用ホストは cameraPreview の外に置く。
 * cameraPreview を非表示にしてもマスタ選択UIまで消えない構造にする。
 * イレギュラー受付UIの表示制御は app.js 側に分離済み。
 *
 * GAS / sendWizardBatch() は変更しない。
 */
(function() {
  "use strict";

  const PICKER_ID = "irregularMasterPickerDev";
  const MASTER_HOST_ID = "normalMasterEntryTestHost";

  function picker() { return document.getElementById(PICKER_ID); }
  function scannerArea() { return document.getElementById("cameraPreview"); }
  function scannerStatus() { return document.getElementById("scannerStatus"); }
  function scannerViewport() { return document.getElementById("scannerViewport"); }
  function connectionNote() { return document.getElementById("connectionNote"); }

  function ensureMasterHost() {
    return document.getElementById(MASTER_HOST_ID);
  }

  function restoreScannerVisuals() {
    const area = scannerArea();
    const status = scannerStatus();
    const viewport = scannerViewport();
    const note = connectionNote();
    const host = document.getElementById(MASTER_HOST_ID);
    if (area) {
      area.hidden = false;
      area.classList.toggle(
        "isActive",
        wizardState.receptionType === "normal" && wizardState.mode !== "検品"
      );
    }
    if (status) status.hidden = false;
    if (viewport) viewport.hidden = false;
    if (note) note.hidden = false;
    if (host) host.hidden = true;
  }

  function setButtonMainText(button, text) {
    if (!button) return;
    button.childNodes.forEach(function(node) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        node.textContent = "\n          " + text + "\n          ";
      }
    });
  }

  function movePickerToMasterReception() {
    const target = ensureMasterHost();
    const root = picker();
    const area = scannerArea();
    const note = connectionNote();
    if (!target || !root) {
      console.error("マスタ選択受付：マスタ選択UIを確認できません");
      return false;
    }
    if (typeof window.stopReadOnlyScanner === "function") window.stopReadOnlyScanner();
    if (area) { area.classList.remove("isActive"); area.hidden = true; }
    if (note) note.hidden = true;
    target.hidden = false;
    root.hidden = false;

    const lead = root.querySelector(".irregularMasterLead");
    if (lead) lead.textContent = "QRのない機械を、大分類 → 機種・品目 → 管理番号／数量の順に選択してください。";

    const openButton = document.getElementById("irregularMasterPickerOpenButton");
    if (openButton) {
      setButtonMainText(openButton, "商品選択へ進む");
      const small = openButton.querySelector("small");
      if (small) small.textContent = "大分類 → 機種・品目 → 管理番号／数量";
    }

    const closeButton = document.getElementById("irregularMasterPickerCloseButton");
    if (closeButton) closeButton.textContent = "商品選択画面を閉じる";

    target.scrollIntoView({behavior:"smooth", block:"start"});
    return true;
  }

  function openMasterReceptionWithRetry(attempt) {
    const count = Number(attempt || 0);
    if (movePickerToMasterReception()) return;
    if (count >= 10) return;
    setTimeout(function() { openMasterReceptionWithRetry(count + 1); }, 100);
  }

  function hideMasterReceptionUi() {
    const host = ensureMasterHost();
    const root = picker();
    if (host) host.hidden = true;
    if (root) root.hidden = true;
  }

  const switchArea = document.getElementById("receptionInputSwitch");
  const switchButton = document.getElementById("switchReceptionInputButton");
  const switchStatus = document.getElementById("receptionInputSwitchStatus");
  let switching = false;

  function syncReceptionDisplay() {
    wizardState.receptionLabel = wizardState.receptionType === "master"
      ? "マスタ選択受付" : "通常受付";
    updateReceptionStatus();
    renderCompleteSettings(buildWizardSettings());
  }

  function updateInputSwitch() {
    const active = wizardState.currentStep === "complete" &&
      wizardState.mode !== "検品" && !wizardPostSendContext &&
      !wizardSendResultUnknown &&
      (wizardState.receptionType === "normal" || wizardState.receptionType === "master");
    if (switchArea) switchArea.hidden = !active;
    if (switchButton) switchButton.textContent =
      wizardState.receptionType === "master"
        ? "QR読取に切り替える"
        : "QRのない機械をマスタから追加";
    if (switchStatus) switchStatus.textContent =
      "選択内容を保持して切り替えます。切替時には送信しません。";
  }

  if (switchButton) switchButton.addEventListener("click", async function() {
    if (switching || wizardSendBusy || wizardSendResultUnknown || scannerBusy || wizardPostSendContext) return;
    const memoArea = document.getElementById("wizardReturnMemoArea");
    if (memoArea && !memoArea.hidden) return;
    if (wizardState.currentStep !== "complete" || wizardState.mode === "検品") return;
    if (pendingWizardQuantityRecord) {
      alert("入力中の数量を一覧へ追加するか、取消してから切り替えてください。");
      return;
    }
    switching = true;
    switchButton.disabled = true;
    try {
      if (wizardState.receptionType === "normal") {
        await stopReadOnlyScanner();
        if (!movePickerToMasterReception()) {
          restoreScannerVisuals();
          await startReadOnlyScanner();
          return;
        }
        wizardState.receptionType = "master";
        syncReceptionDisplay();
      } else if (wizardState.receptionType === "master") {
        if (typeof window.stageIrregularMasterPickerSelections !== "function" ||
            !await window.stageIrregularMasterPickerSelections()) return;
        wizardState.receptionType = "normal";
        syncReceptionDisplay();
        restoreScannerVisuals();
        renderScannerResults();
        await startReadOnlyScanner();
      }
      updateInputSwitch();
    } finally {
      switching = false;
      switchButton.disabled = false;
    }
  });

  // 設定画面に戻った場合は切替ボタンを隠す。
  const completePanel = document.getElementById("completeStep");
  if (completePanel) new MutationObserver(updateInputSwitch).observe(
    completePanel, {attributes:true, attributeFilter:["class", "hidden"]}
  );

  const resultCount = document.getElementById("scannerResultCount");
  if (resultCount) new MutationObserver(updateInputSwitch).observe(
    resultCount, {childList:true, characterData:true, subtree:true}
  );
  const postSendArea = document.getElementById("wizardPostSendArea");
  if (postSendArea) new MutationObserver(updateInputSwitch).observe(
    postSendArea, {attributes:true, attributeFilter:["hidden"]}
  );

  window.addEventListener("entrywizard:complete", function(event) {
    updateInputSwitch();
    const settings = event && event.detail ? event.detail : null;
    if (!settings) return;
    if (settings.receptionType === "master" && settings.mode !== "検品") {
      setTimeout(function() { openMasterReceptionWithRetry(0); }, 30);
      return;
    }
    if (settings.receptionType === "irregular") {
      hideMasterReceptionUi();
      return;
    }
    restoreScannerVisuals();
  });

  ensureMasterHost();
  console.info("開発版：マスタ選択受付入口テスト v15 読込完了");
})();

