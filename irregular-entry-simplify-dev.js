/*
 * イレギュラー受付入口簡素化 v76
 *
 * 目的:
 * - イレギュラー受付を「対象を特定できない」専用にする。
 * - 対象を特定できる場合は START の「マスタ選択受付」を使用する。
 * - 旧「番号を入力する / 番号が読めない」UIを現場画面から隠す。
 * - 旧「伝票あり / 伝票なし」UIも現場画面から隠し、伝票は任意添付にする。
 * - 状況・理由は既存入力欄をそのまま必須利用する。
 * - 写真は既存イレギュラー写真フローをそのまま必須利用する。
 *
 * 重要:
 * - タイマー、MutationObserver、同名関数上書き、wrapperは使わない。
 * - 既存 openWizardIrregularArea() は旧仕様として
 *   「入力」「伝票あり」を初期値に戻すため、画面表示時の状態に依存しない。
 * - 送信確定ボタンの capture フェーズでだけ、既存 buildWizardIrregularRecord()
 *   が読む hidden radio を「番号不明」「伝票なし」に確定する。
 * - 既存 click ハンドラより先に1回だけ値を整えるため、競合や再強制を作らない。
 */
(function() {
  "use strict";

  const ROOT_ID = "irregularEntrySimplifyDev";

  function getArea() {
    return document.getElementById("wizardIrregularArea");
  }

  function getRadioGrid(name, area) {
    if (!area) return null;
    const radio = area.querySelector('input[name="' + name + '"]');
    return radio ? radio.closest(".wizardRadioGrid") : null;
  }

  function getLabelFor(id, area) {
    return area ? area.querySelector('label[for="' + id + '"]') : null;
  }

  function selectHiddenRadio(name, value) {
    const radios = document.querySelectorAll(
      'input[name="' + name + '"]'
    );

    radios.forEach(function(radio) {
      radio.checked = radio.value === value;
    });
  }

  function prepareUnknownIrregularForSubmit() {
    if (
      typeof wizardState !== "undefined" &&
      wizardState.receptionType !== "irregular"
    ) {
      return;
    }

    selectHiddenRadio("wizardIrregularNumberType", "番号不明");
    selectHiddenRadio("wizardIrregularSlipStatus", "伝票なし");

    const numberInput = document.getElementById("wizardIrregularNumber");
    if (numberInput) numberInput.value = "";
  }

  function hideMasterPicker() {
    const picker = document.getElementById("irregularMasterPickerDev");
    if (picker) picker.hidden = true;
  }

  function hideLegacyChoiceUi() {
    const area = getArea();
    if (!area) return;

    const numberGrid = getRadioGrid("wizardIrregularNumberType", area);
    const slipGrid = getRadioGrid("wizardIrregularSlipStatus", area);
    const numberLabel = getLabelFor("wizardIrregularNumber", area);
    const numberInput = document.getElementById("wizardIrregularNumber");
    const slipGuide = document.getElementById("wizardIrregularSlipGuide");

    if (numberGrid) numberGrid.hidden = true;
    if (numberLabel) numberLabel.hidden = true;
    if (numberInput) numberInput.hidden = true;
    if (slipGrid) slipGrid.hidden = true;
    if (slipGuide) slipGuide.hidden = true;
  }

  function injectUi() {
    const area = getArea();
    if (!area || document.getElementById(ROOT_ID)) return;

    const numberGrid = getRadioGrid("wizardIrregularNumberType", area);

    const box = document.createElement("div");
    box.id = ROOT_ID;
    box.style.margin = "12px 0 8px";
    box.innerHTML =
      '<div id="irregularEntrySimplifyHint" class="wizardPostSummary">' +
        '対象を特定できない受付です。状況・理由と写真を残してください。伝票がある場合は、できるだけ写真を添付してください。' +
      '</div>';

    const picker = document.getElementById("irregularMasterPickerDev");
    if (picker && picker.parentElement === area) {
      picker.insertAdjacentElement("afterend", box);
    } else if (numberGrid && numberGrid.parentElement === area) {
      area.insertBefore(box, numberGrid);
    } else {
      const heading = area.querySelector("h3");
      if (heading) heading.insertAdjacentElement("afterend", box);
      else area.prepend(box);
    }

    hideMasterPicker();
    hideLegacyChoiceUi();
  }

  function installSubmitPreparation() {
    const confirmButton = document.getElementById(
      "wizardConfirmIrregularButton"
    );

    if (!confirmButton) {
      console.error(
        "イレギュラー受付簡素化：確定ボタンを確認できません"
      );
      return;
    }

    confirmButton.addEventListener(
      "click",
      prepareUnknownIrregularForSubmit,
      true
    );
  }

  function init() {
    injectUi();
    installSubmitPreparation();
  }

  init();

  console.info(
    "開発版：イレギュラー受付入口簡素化 v76 読込完了"
  );
})();
