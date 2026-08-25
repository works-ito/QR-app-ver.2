/*
 * 手動更新UI v103
 *
 * 責務：
 * - index.html に固定配置された在庫データ表示と［更新］ボタンへ動作を接続する。
 * - inventorydata:* イベントを受け、更新中・成功・失敗の表示を一元管理する。
 * - 通常時は在庫キャッシュの updatedAt を yyyy/MM/dd HH:mm 形式で表示する。
 * - 更新ボタンはホーム画面追加版でも使えるよう、ページ全体を
 *   キャッシュバスター付きURLで再読込する。
 *
 * 受付ボタンについて：
 * - app.js が受付ボタンへイベントを束ねる前に、マスタ選択受付を同じグリッドへ配置する。
 * - 販売品入庫受付は index.html に固定配置済み。
 */
(function() {
  "use strict";

  const STATUS_ID = "inventoryDataStatus";
  const BUTTON_ID = "manualAppRefreshButtonDev";
  const MASTER_ENTRY_BUTTON_ID = "masterSelectionReceptionButton";
  const DOT_INTERVAL_MS = 400;

  let renderingFromCache = false;
  let dotsTimer = null;

  function prepareReceptionButtons() {
    const receptionStep = document.getElementById("receptionStep");
    if (!receptionStep) return;

    const grid = receptionStep.querySelector(".buttonGrid.singleColumn");
    const normalButton = receptionStep.querySelector(
      '[data-reception-type="normal"]'
    );
    const irregularButton = receptionStep.querySelector(
      '[data-reception-type="irregular"]'
    );

    if (!grid || !normalButton || !irregularButton) return;

    let masterButton = document.getElementById(MASTER_ENTRY_BUTTON_ID);

    if (!masterButton) {
      masterButton = document.createElement("button");
      masterButton.id = MASTER_ENTRY_BUTTON_ID;
      masterButton.className = "choiceButton";
      masterButton.type = "button";
      masterButton.dataset.receptionType = "master";
      masterButton.innerHTML =
        'マスタ選択受付' +
        '<span class="choiceSubText">QRを使わずマスタから対象を選ぶ</span>';

      grid.insertBefore(masterButton, irregularButton);
    }
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatAbsoluteMinute(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";

    return (
      date.getFullYear() + "/" +
      pad2(date.getMonth() + 1) + "/" +
      pad2(date.getDate()) + " " +
      pad2(date.getHours()) + ":" +
      pad2(date.getMinutes())
    );
  }

  function getStatus() {
    return document.getElementById(STATUS_ID);
  }

  function stopLoadingAnimation() {
    if (dotsTimer) {
      clearInterval(dotsTimer);
      dotsTimer = null;
    }
  }

  function showLoadingStatus() {
    const status = getStatus();
    if (!status) return;

    stopLoadingAnimation();
    status.className = "inventoryDataStatus isLoading";

    let dots = 0;
    const update = function() {
      status.textContent =
        "在庫データ：更新中" + ".".repeat(dots);
      dots = (dots + 1) % 4;
    };

    update();
    dotsTimer = setInterval(update, DOT_INTERVAL_MS);
  }

  function showReadyStatus(updatedAt) {
    const status = getStatus();
    if (!status) return false;

    const formatted = formatAbsoluteMinute(updatedAt);
    if (!formatted) return false;

    stopLoadingAnimation();
    status.className = "inventoryDataStatus isReady";
    status.textContent = "在庫データ：" + formatted;
    return true;
  }

  async function renderLatestCacheTimestamp() {
    const status = getStatus();
    if (!status || renderingFromCache) return;
    if (typeof loadInventoryCache !== "function") return;

    renderingFromCache = true;

    try {
      const cache = await loadInventoryCache();
      if (cache && cache.updatedAt) {
        showReadyStatus(cache.updatedAt);
      }
    } catch (error) {
      console.warn("在庫データ更新時刻の表示に失敗しました", error);
    } finally {
      renderingFromCache = false;
    }
  }

  function showErrorStatus(detail) {
    const status = getStatus();
    if (!status) return;

    stopLoadingAnimation();

    const info = detail || {};
    const prefix = info.hasCachedData
      ? "在庫データ：更新失敗・前回データを使用"
      : "在庫データ：取得失敗";
    const message = String(info.message || "").trim();

    status.className = "inventoryDataStatus isError";
    status.textContent = message
      ? prefix + " " + message
      : prefix;
  }

  function runFullRefresh(button) {
    if (button.disabled) return;

    button.disabled = true;
    button.textContent = "更新中…";
    showLoadingStatus();

    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("appRefresh", String(Date.now()));
    window.location.replace(url.toString());
  }

  function install() {
    prepareReceptionButtons();

    const status = getStatus();
    const button = document.getElementById(BUTTON_ID);

    if (!status || !button) {
      console.warn("手動更新UI：固定DOMが見つかりません");
      return;
    }

    if (button.dataset.manualRefreshBound !== "true") {
      button.dataset.manualRefreshBound = "true";
      button.addEventListener("click", function() {
        runFullRefresh(button);
      });
    }

    window.addEventListener("inventorydata:loading", function() {
      showLoadingStatus();
    });

    window.addEventListener("inventorydata:ready", function(event) {
      const updatedAt = event && event.detail
        ? event.detail.updatedAt
        : "";

      if (!showReadyStatus(updatedAt)) {
        void renderLatestCacheTimestamp();
      }
    });

    window.addEventListener("inventorydata:error", function(event) {
      showErrorStatus(event ? event.detail : null);
    });

    if (
      typeof appInitialDataLoading !== "undefined" &&
      appInitialDataLoading
    ) {
      showLoadingStatus();
    } else {
      void renderLatestCacheTimestamp();
    }

    console.info("開発版：手動更新UI v103 読込完了");
  }

  if (
    document.getElementById(STATUS_ID) &&
    document.getElementById(BUTTON_ID)
  ) {
    install();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {once:true});
  } else {
    install();
  }
})();
