/*
 * 通常受付：マスタ選択入口テスト v1
 *
 * 目的:
 * - 現行mainを壊さず、通常受付・返却から既存マスタ選択UIを試す。
 * - GAS / app.js / sendWizardBatch() は変更しない。
 * - 既存 irregularMasterPickerDev を通常返却時だけ scannerArea 内へ移動する。
 * - イレギュラー受付へ入った場合は元の wizardIrregularArea へ戻す。
 */
(function() {
  "use strict";

  const PICKER_ID = "irregularMasterPickerDev";
  const IRREGULAR_HOST_ID = "wizardIrregularArea";
  const NORMAL_HOST_ID = "normalMasterEntryTestHost";

  function picker() {
    return document.getElementById(PICKER_ID);
  }

  function irregularHost() {
    return document.getElementById(IRREGULAR_HOST_ID);
  }

  function ensureNormalHost() {
    let host = document.getElementById(NORMAL_HOST_ID);
    if (host) return host;

    const scannerArea = document.getElementById("cameraPreview");
    const scannerResult = document.getElementById("scannerResult");
    if (!scannerArea || !scannerResult) return null;

    host = document.createElement("div");
    host.id = NORMAL_HOST_ID;
    host.hidden = true;

    const heading = document.createElement("div");
    heading.className = "wizardPostSummary";
    heading.style.margin = "12px 0 8px";
    heading.textContent = "QRが読めない場合は、マスタから対象機械を選べます。";
    host.appendChild(heading);

    scannerArea.insertBefore(host, scannerResult);
    return host;
  }

  function movePickerToNormal() {
    const target = ensureNormalHost();
    const root = picker();
    if (!target || !root) return;

    target.hidden = false;
    target.appendChild(root);

    const lead = root.querySelector(".irregularMasterLead");
    if (lead) {
      lead.textContent =
        "QRを読み取れない場合は、マスタから対象を選択してください。選択後は通常返却として処理します。";
    }
  }

  function movePickerToIrregular() {
    const target = irregularHost();
    const root = picker();
    const normalHost = document.getElementById(NORMAL_HOST_ID);
    if (!target || !root) return;

    if (normalHost) normalHost.hidden = true;

    const heading = target.querySelector("h3");
    if (heading) heading.insertAdjacentElement("afterend", root);
    else target.prepend(root);

    const lead = root.querySelector(".irregularMasterLead");
    if (lead) {
      lead.textContent =
        "QRがない・読めない場合は、マスタから対象を選べます。既存の直接入力・番号不明もそのまま使用できます。";
    }
  }

  function applyForSettings(settings) {
    if (
      settings &&
      settings.receptionType === "normal" &&
      settings.mode === "返却"
    ) {
      movePickerToNormal();
      return;
    }

    movePickerToIrregular();
  }

  window.addEventListener("entrywizard:complete", function(event) {
    applyForSettings(event && event.detail ? event.detail : null);
  });

  ensureNormalHost();

  console.info("開発版：通常返却マスタ選択入口テスト v1 読込完了");
})();
