/*
 * 手動更新UI v99
 *
 * 責務：
 * - index.html に固定配置された在庫データ表示と［更新］ボタンへ動作を接続する。
 * - 通常時の件数表示は隠し、在庫キャッシュの updatedAt を
 *   yyyy/MM/dd HH:mm 形式で表示する。
 * - 更新ボタンはホーム画面追加版でも使えるよう、ページ全体を
 *   キャッシュバスター付きURLで再読込する。
 *
 * DOM生成・style生成は行わない。
 * 固定UIは index.html、見た目は styles.css を正とする。
 */
(function() {
  "use strict";

  const STATUS_ID = "inventoryDataStatus";
  const BUTTON_ID = "manualAppRefreshButtonDev";
  const IDLE_CHECK_MS = 250;

  let renderingFromCache = false;
  let idleCheckTimer = null;

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

  function isInventoryLoading() {
    return (
      typeof appInitialDataLoading !== "undefined" &&
      appInitialDataLoading === true
    );
  }

  async function renderLatestCacheTimestamp(status) {
    if (!status || renderingFromCache) return;
    if (typeof loadInventoryCache !== "function") return;

    const text = String(status.textContent || "").trim();
    if (text.indexOf("更新失敗") >= 0) return;

    renderingFromCache = true;

    try {
      const cache = await loadInventoryCache();
      const updatedAt = cache && cache.updatedAt
        ? formatAbsoluteMinute(cache.updatedAt)
        : "";

      if (updatedAt) {
        const nextText = "在庫データ：" + updatedAt;
        if (status.textContent !== nextText) {
          status.textContent = nextText;
        }
      }
    } catch (error) {
      console.warn("在庫データ更新時刻の表示に失敗しました", error);
    } finally {
      renderingFromCache = false;
    }
  }

  function waitForInventoryIdle(status) {
    if (idleCheckTimer) {
      clearTimeout(idleCheckTimer);
      idleCheckTimer = null;
    }

    if (isInventoryLoading()) {
      idleCheckTimer = setTimeout(function() {
        waitForInventoryIdle(status);
      }, IDLE_CHECK_MS);
      return;
    }

    void renderLatestCacheTimestamp(status);
  }

  function runFullRefresh(button, status) {
    if (button.disabled) return;

    button.disabled = true;
    button.textContent = "更新中…";

    if (status) {
      status.textContent = "在庫データ：更新中…";
    }

    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("appRefresh", String(Date.now()));
    window.location.replace(url.toString());
  }

  function install() {
    const status = document.getElementById(STATUS_ID);
    const button = document.getElementById(BUTTON_ID);

    if (!status || !button) {
      console.warn("手動更新UI：固定DOMが見つかりません");
      return;
    }

    if (button.dataset.manualRefreshBound !== "true") {
      button.dataset.manualRefreshBound = "true";
      button.addEventListener("click", function() {
        runFullRefresh(button, status);
      });
    }

    waitForInventoryIdle(status);

    if (status.dataset.manualRefreshObserved !== "true") {
      status.dataset.manualRefreshObserved = "true";
      const observer = new MutationObserver(function() {
        waitForInventoryIdle(status);
      });
      observer.observe(status, {
        childList:true,
        characterData:true,
        subtree:true
      });
    }

    console.info("開発版：手動更新UI v99 読込完了");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {once:true});
  } else {
    install();
  }
})();