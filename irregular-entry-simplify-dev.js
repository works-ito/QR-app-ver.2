/*
 * イレギュラー受付入口簡素化 v74
 *
 * 目的:
 * - イレギュラー受付を「対象を特定できない」専用にする。
 * - 対象を特定できる場合は START の「マスタ選択受付」を使用する。
 * - 旧「番号を入力する / 番号が読めない」UIを現場画面から隠す。
 * - 旧「伝票あり / 伝票なし」UIも現場画面から隠し、伝票は任意添付にする。
 * - 状況・理由は既存入力欄をそのまま必須利用する。
 * - 写真は既存イレギュラー写真フローをそのまま必須利用する。
 *
 * 既存GAS / buildWizardIrregularRecord() との互換性のため、
 * 旧radio/input自体はDOMに残し、内部値だけ
 * 「番号不明」「伝票なし」に固定する。
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

  function setRadioValue(name, value) {
    const radio = document.querySelector(
      'input[name="' + name + '"][value="' + value + '"]'
    );
    if (!radio) return;

    if (!radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change", {bubbles:true}));
    }
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

  function enterUnknownOnlyMode() {
    const area = getArea();
    if (!area) return;

    /*
     * 既存の change ハンドラが表示状態を戻す可能性があるため、
     * まず内部値を確定し、その後に旧UIを隠す。
     */
    setRadioValue("wizardIrregularNumberType", "番号不明");
    setRadioValue("wizardIrregularSlipStatus", "伝票なし");

    hideMasterPicker();
    hideLegacyChoiceUi();

    const root = document.getElementById(ROOT_ID);
    if (root) root.hidden = false;

    const hint = document.getElementById("irregularEntrySimplifyHint");
    if (hint) {
      hint.innerText =
        "対象を特定できない受付です。状況・理由と写真を残してください。伝票がある場合は、できるだけ写真を添付してください。";
    }

    /*
     * 旧 change ハンドラや受付初期化が遅れて走っても再表示されないよう、
     * 短い遅延でもう一度だけ表示制御を確定する。
     */
    setTimeout(hideLegacyChoiceUi, 50);
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

    enterUnknownOnlyMode();
  }

  function observeOpenState() {
    const area = getArea();
    if (!area || area.dataset.irregularSimplifyObserved === "true") return;

    area.dataset.irregularSimplifyObserved = "true";

    const observer = new MutationObserver(function() {
      if (!area.hidden) {
        /* 既存 openWizardIrregularArea() の初期化後に番号不明専用へ固定する。 */
        setTimeout(enterUnknownOnlyMode, 0);
      }
    });

    observer.observe(area, {
      attributes:true,
      attributeFilter:["hidden"]
    });
  }

  function init() {
    injectUi();
    observeOpenState();
  }

  init();

  console.info(
    "開発版：イレギュラー受付入口簡素化 v74 読込完了"
  );
})();
