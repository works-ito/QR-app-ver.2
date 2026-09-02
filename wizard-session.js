/*
 * 受付セッション正常終了 v2
 *
 * 正常完了時だけ受付入口へ戻す正式処理。
 * app.js の resumeWizardContinuousScan() から呼び出す。
 * 取消完了・一部失敗で読取済みレコードが残る場合は false を返し、
 * app.js の従来継続読取処理へ委ねる。
 */
(function() {
  "use strict";

  function clearStaleWizardSendStatus() {
    const status = document.getElementById("wizardSendStatus");
    if (!status) return;

    if (
      typeof wizardSendResultUnknown !== "undefined" &&
      wizardSendResultUnknown === true
    ) return;

    if (typeof stopAnimatedDots === "function") {
      stopAnimatedDots("wizardSendStatus");
    }

    status.innerText = "";
    status.className = "wizardSendStatus";
  }

  async function finishWizardSessionAfterSend(message) {
    const text = String(message || "");

    if (text.includes("取消完了")) {
      return false;
    }

    if (
      typeof scannedEntries !== "undefined" &&
      Array.isArray(scannedEntries) &&
      scannedEntries.length > 0
    ) {
      return false;
    }

    if (typeof stopReadOnlyScanner === "function") {
      await stopReadOnlyScanner();
    }

    if (
      typeof window.resetIrregularMasterPickerSession ===
      "function"
    ) {
      window.resetIrregularMasterPickerSession();
    }

    if (typeof resetWizard === "function") {
      resetWizard();
    }

    const pickerPanel = document.getElementById("irregularMasterPickerPanel");
    if (pickerPanel) pickerPanel.hidden = true;

    const pickerRoot = document.getElementById("irregularMasterPickerDev");
    if (pickerRoot) {
      pickerRoot.querySelectorAll(".irregularMasterStep").forEach(function(step) {
        step.hidden = true;
      });
    }

    clearStaleWizardSendStatus();

    try {
      window.scrollTo({top:0, behavior:"smooth"});
    } catch (error) {}

    return true;
  }

  window.finishWizardSessionAfterSend = finishWizardSessionAfterSend;
  console.info("受付セッション正常終了 v2 読込完了");
})();
