/*
 * 在庫データ更新制御 v1
 *
 * 役割：在庫更新要求の交通整理。
 * - 復帰時は current-state → full-sync → 最終 current-state の安全順序を維持する。
 * - 受付中/hidden/既存同期中による保留と通信失敗を分離する。
 * - 同じ制御内の full-sync は1本のPromiseへ集約する。
 * - 通信失敗を2秒タイマーで自動再試行しない。
 * - GASとapp.jsのデータ取得関数は変更しない。
 * - 既存関数のwrapper/monkey-patchは行わない。
 */
(function() {
  "use strict";

  const PENDING_CHECK_MS = 2000;
  const FOREGROUND_DEDUP_MS = 1000;
  const FOREGROUND_STABILIZE_MS = 500;

  let refreshHiddenAt = null;
  let pendingCheckTimer = null;
  let resumeRefreshRunning = false;
  let fullRefreshPromise = null;
  let lastForegroundRefreshAt = 0;

  function isVisible() {
    return document.visibilityState === "visible";
  }

  function isIrregularMasterPickerOpen() {
    const panel = document.getElementById("irregularMasterPickerPanel");
    return Boolean(panel && panel.hidden === false);
  }

  function isReceptionIdle() {
    if (
      typeof wizardState !== "undefined" &&
      wizardState &&
      wizardState.currentStep !== "reception"
    ) return false;

    if (
      typeof pendingWizardQuantityRecord !== "undefined" &&
      pendingWizardQuantityRecord
    ) return false;

    if (isIrregularMasterPickerOpen()) return false;

    if (typeof canRefreshInventoryAutomatically === "function") {
      return canRefreshInventoryAutomatically();
    }

    return false;
  }

  async function refreshCurrentState(reason) {
    if (!isVisible()) return false;
    if (typeof loadCurrentStateData !== "function") {
      console.warn("現在状態更新関数を確認できません");
      return false;
    }

    console.log("現在状態更新開始", reason || "");
    const success = await loadCurrentStateData();
    console.log(success ? "現在状態更新完了" : "現在状態更新失敗", reason || "");
    return success;
  }

  function deferFullRefresh(reason) {
    pendingInventoryRefresh = true;
    console.log("全体同期を保留", reason || "");
    return false;
  }

  async function runFullInventoryRefresh(reason) {
    console.log("全体同期開始", reason || "");
    const success = await loadAppInitialData(false);

    if (!success) {
      console.warn("全体同期失敗", reason || "");
      return false;
    }

    pendingInventoryRefresh = false;
    console.log("全体同期完了", reason || "", new Date().toLocaleString());
    await refreshCurrentState("全体同期後の最終状態更新");
    return true;
  }

  async function requestFullInventoryRefresh(reason) {
    if (!isVisible()) {
      return deferFullRefresh("画面非表示：" + (reason || ""));
    }

    if (!isReceptionIdle()) {
      return deferFullRefresh("受付処理中：" + (reason || ""));
    }

    if (typeof loadAppInitialData !== "function") {
      console.warn("全体同期関数を確認できません");
      return false;
    }

    if (
      typeof appInitialDataLoading !== "undefined" &&
      appInitialDataLoading
    ) {
      return deferFullRefresh("既存の全体同期を待機：" + (reason || ""));
    }

    if (fullRefreshPromise) {
      console.log("既存の全体同期を共有", reason || "");
      return fullRefreshPromise;
    }

    fullRefreshPromise = runFullInventoryRefresh(reason)
      .finally(function() {
        fullRefreshPromise = null;
      });

    return fullRefreshPromise;
  }

  async function runResumeRefresh() {
    if (resumeRefreshRunning || !isVisible()) return false;
    resumeRefreshRunning = true;

    try {
      if (typeof emitInventoryDataStatusEvent === "function") {
        emitInventoryDataStatusEvent("loading");
      }

      await new Promise(function(resolve) {
        setTimeout(resolve, FOREGROUND_STABILIZE_MS);
      });

      if (!isVisible()) return false;

      await refreshCurrentState("バックグラウンド復帰");
      if (!isVisible()) return false;

      if (isReceptionIdle()) {
        void requestFullInventoryRefresh("バックグラウンド復帰");
      } else {
        deferFullRefresh("バックグラウンド復帰時に受付処理中");
      }

      return true;
    } finally {
      resumeRefreshRunning = false;
    }
  }

  function handleForegroundReturn() {
    if (!isVisible()) return;

    const now = Date.now();
    const hiddenAt = refreshHiddenAt;
    refreshHiddenAt = null;

    if (
      hiddenAt &&
      typeof AUTO_RELOAD_MINUTES !== "undefined" &&
      now - hiddenAt >= AUTO_RELOAD_MINUTES * 60 * 1000
    ) return;

    if (now - lastForegroundRefreshAt < FOREGROUND_DEDUP_MS) return;

    lastForegroundRefreshAt = now;
    void runResumeRefresh();
  }

  function installVisibilityControl() {
    document.addEventListener("visibilitychange", function() {
      if (document.visibilityState === "hidden") {
        refreshHiddenAt = Date.now();
        return;
      }

      if (document.visibilityState === "visible") {
        handleForegroundReturn();
      }
    });

    /*
     * 通常の初回pageshowはstartup直後なので更新要求を増やさない。
     * BFCacheから戻った場合、またはhidden記録が残る復帰だけ補完する。
     */
    window.addEventListener("pageshow", function(event) {
      if (
        document.visibilityState === "visible" &&
        (event.persisted === true || refreshHiddenAt !== null)
      ) {
        handleForegroundReturn();
      }
    });
  }

  function runPendingInventoryRefreshAfterSession() {
    if (!pendingInventoryRefresh) return;
    setTimeout(function() {
      void requestFullInventoryRefresh("受付終了後の保留更新");
    }, 0);
  }

  function startPendingChecker() {
    if (pendingCheckTimer) clearInterval(pendingCheckTimer);

    pendingCheckTimer = setInterval(function() {
      if (!pendingInventoryRefresh) return;
      if (!isVisible()) return;
      if (!isReceptionIdle()) return;
      if (fullRefreshPromise) return;
      if (
        typeof appInitialDataLoading !== "undefined" &&
        appInitialDataLoading
      ) return;

      pendingInventoryRefresh = false;
      void requestFullInventoryRefresh("保留更新の再確認");
    }, PENDING_CHECK_MS);
  }

  function install() {
    installVisibilityControl();
    startPendingChecker();

    window.runPendingInventoryRefreshAfterSession = runPendingInventoryRefreshAfterSession;
    window.requestInventoryRefresh = requestFullInventoryRefresh;
    /* 移行期間の互換名。呼び出し側を順次正式名へ寄せた後に削除する。 */
    window.requestInventoryRefreshDev = requestFullInventoryRefresh;

    console.info("在庫データ更新制御 v1 読込完了");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {once:true});
  } else {
    install();
  }
})();