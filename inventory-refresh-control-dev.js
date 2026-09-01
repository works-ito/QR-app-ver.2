/*
 * 在庫データ自動更新制御 v96
 *
 * 方針：
 * - アプリが前面へ戻ったら、hidden記録の有無に依存せず現在状態を再取得する。
 * - visibilitychange / pageshow の重複発火は短時間ガードで1回にまとめる。
 * - iOS復帰直後の通信層が安定するまで、ごく短時間だけ待ってから現在状態を取得する。
 * - 復帰時は現在状態更新と全体同期を同時発射せず、現在状態を先に完了させる。
 * - 復帰時の現在状態更新中は、画面上にも「在庫データ：更新中」を表示する。
 * - 受付途中でも現在状態の軽量更新は許可する。
 * - 全体同期は受付UIを壊さない安全なタイミングだけ実行する。
 * - 全体同期が保留された場合は受付終了後に消化する。
 * - 全体同期完了後は現在状態をもう一度取得し、状態の巻き戻りを防ぐ。
 * - hidden時刻を取得できていて30分以上経過した場合だけ app.js の完全リロード処理へ任せる。
 *
 * GASは変更しない。既存関数のwrapper/monkey-patchは行わない。
 */
(function() {
  "use strict";

  const PENDING_CHECK_MS = 2000;
  const FOREGROUND_DEDUP_MS = 1000;
  const FOREGROUND_STABILIZE_MS = 500;

  let refreshHiddenAt = null;
  let pendingCheckTimer = null;
  let resumeRefreshRunning = false;
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
    ) {
      return false;
    }

    if (
      typeof pendingWizardQuantityRecord !== "undefined" &&
      pendingWizardQuantityRecord
    ) {
      return false;
    }

    if (isIrregularMasterPickerOpen()) {
      return false;
    }

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

  async function requestFullInventoryRefresh(reason) {
    if (!isVisible()) {
      pendingInventoryRefresh = true;
      return false;
    }

    if (!isReceptionIdle()) {
      pendingInventoryRefresh = true;
      console.log("全体同期を保留：受付処理中", reason || "");
      return false;
    }

    if (typeof loadAppInitialData !== "function") {
      pendingInventoryRefresh = true;
      console.warn("全体同期関数を確認できません");
      return false;
    }

    console.log("全体同期開始", reason || "");
    const success = await loadAppInitialData(false);

    if (!success) {
      pendingInventoryRefresh = true;
      console.warn("全体同期失敗", reason || "");
      return false;
    }

    pendingInventoryRefresh = false;
    console.log("全体同期完了", reason || "", new Date().toLocaleString());
    await refreshCurrentState("全体同期後の最終状態更新");
    return true;
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
        pendingInventoryRefresh = true;
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
    ) {
      return;
    }

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

    window.addEventListener("pageshow", function() {
      if (document.visibilityState === "visible") {
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
      void requestFullInventoryRefresh("保留更新の再確認");
    }, PENDING_CHECK_MS);
  }

  function install() {
    installVisibilityControl();
    startPendingChecker();

    window.runPendingInventoryRefreshAfterSession = runPendingInventoryRefreshAfterSession;
    window.requestInventoryRefreshDev = requestFullInventoryRefresh;

    console.info("開発版：在庫データ自動更新制御 v96 読込完了");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {once:true});
  } else {
    install();
  }
})();
