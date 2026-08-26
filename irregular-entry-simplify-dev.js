/*
 * イレギュラー受付入口簡素化 v73
 *
 * 目的:
 * - イレギュラー受付を「対象を特定できない」専用にする。
 * - 対象を特定できる場合は START の「マスタ選択受付」を使用する。
 * - イレギュラー受付内の「マスタから選ぶ」「対象を特定できない」の二重入口をなくす。
 * - 既存GAS / buildWizardIrregularRecord() との互換性のため、旧radio/input自体はDOMに残す。
 *
 * 旧DOMを削除せず非表示化し、既存の番号不明イレギュラー送信・写真処理はそのまま利用する。
 */
(function() {
  "use strict";

  const ROOT_ID = "irregularEntrySimplifyDev";

  function getArea() {
    return document.getElementById("wizardIrregularArea");
  }

  function getNumberTypeGrid(area) {
    if (!area) return null;
    const radio = area.querySelector('input[name="wizardIrregularNumberType"]');
    return radio ? radio.closest(".wizardRadioGrid") : null;
  }

  function getLabelFor(id, area) {
    return area ? area.querySelector('label[for="' + id + '"]') : null;
  }

  function setNumberType(value) {
    const radio = document.querySelector(
      'input[name="wizardIrregularNumberType"][value="' + value + '"]'
    );
    if (!radio) return;
    radio.checked = true;
    radio.dispatchEvent(new Event("change", {bubbles:true}));
  }

  function hideMasterPicker() {
    const picker = document.getElementById("irregularMasterPickerDev");
    if (picker) picker.hidden = true;
  }

  function enterUnknownOnlyMode() {
    const area = getArea();
    if (!area) return;

    setNumberType("番号不明");
    hideMasterPicker();

    const root = document.getElementById(ROOT_ID);
    if (root) root.hidden = false;

    const hint = document.getElementById("irregularEntrySimplifyHint");
    if (hint) {
      hint.innerText =
        "対象を特定できない受付です。状況・理由と写真を残してください。伝票がある場合は、できるだけ写真を添付してください。";
    }
  }

  function injectUi() {
    const area = getArea();
    if (!area || document.getElementById(ROOT_ID)) return;

    const numberGrid = getNumberTypeGrid(area);
    const numberLabel = getLabelFor("wizardIrregularNumber", area);
    const numberInput = document.getElementById("wizardIrregularNumber");

    /* 内部互換のためDOMは残すが、現場UIからは完全に隠す。 */
    if (numberGrid) numberGrid.hidden = true;
    if (numberLabel) numberLabel.hidden = true;
    if (numberInput) numberInput.hidden = true;

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
    "開発版：イレギュラー受付入口簡素化 v73 読込完了"
  );
})();
