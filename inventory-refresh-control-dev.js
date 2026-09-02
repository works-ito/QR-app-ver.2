/*
 * 在庫データ自動更新制御 v97
 *
 * 方針：
 * - アプリが前面へ戻ったら、hidden記録の有無に依存せず現在状態を再取得する。
 * - visibilitychange / pageshow の重複発火は短時間ガードで1回にまとめる。
 * - iOS復帰直後の通信層が安定するまで、ごく短時間だけ待ってから現在状態を取得する。
 * - 復帰時は現在状態更新と全体同期を同時発射せず、現在状態を先に完了させる。
 * - 受付途中でも現在状態の軽量更新は許可する。
 * - 全体同期は受付UIを壊さない安全なタイミングだけ実行する。
 * - 「受付中/hidden/既存同期中による保留」と「通信失敗」を分離する。
 * - 同じ制御内からの全体同期要求は1本のPromiseへ集約し、重複発射しない。
 * - 通信失敗を2秒タイマーで無限に再試行しない。
 * - 全体同期完了後は現在状態をもう一度取得し、状態の巻き戻りを防ぐ。
 * - hidden時刻を取得できていて30分以上経過した場合だけ app.js の完全リロード処理へ任せる。
 *
 * GASとapp.jsのデータ取得関数は変更しない。
 * 既存関数のwrapper/monkey-patchは行わない。
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

  function deferFullRefresh(reason) {
    pendingInventoryRefresh = true;
    console.log("全体同期を保留", reason || "");
    return false;
  }

  async function runFullInventoryRefresh(reason) {
    console.log("全体同期開始", reason || "");
    const success = await loadAppInitialData(false);

    if (!success) {
      /*
       * app.js側の通信失敗は、ここでは保留扱いにしない。
       * 以前はpending=trueにして2秒ごとに再試行していたため、
       * 長時間のLoad failed後に別の全体同期が自動発射されていた。
       */
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

    /*
     * app.js側ですでに全体同期が走っている場合は「失敗」ではない。
     * その通信が終わった後に必要ならpending checkerが1回だけ拾えるよう、
     * 保留として扱う。
     */
    if (
      typeof appInitialDataLoading !== "undefined" &&
      appInitialDataLoading
    ) {
      return deferFullRefresh("既存の全体同期を待機：" + (reason || ""));
    }

    /*
     * このコントローラ自身から同時に要求された場合は、
     * 新しい通信を作らず既存Promiseを共有する。
     */
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
      if (fullRefreshPromise) return;
      if (
        typeof appInitialDataLoading !== "undefined" &&
        appInitialDataLoading
      ) {
        return;
      }

      /*
       * pendingは通信失敗ではなく「実行できるまで保留」の意味だけにする。
       * 実行開始前に消費し、失敗しても2秒ループへ戻さない。
       */
      pendingInventoryRefresh = false;
      void requestFullInventoryRefresh("保留更新の再確認");
    }, PENDING_CHECK_MS);
  }

  function install() {
    installVisibilityControl();
    startPendingChecker();

    window.runPendingInventoryRefreshAfterSession = runPendingInventoryRefreshAfterSession;
    window.requestInventoryRefreshDev = requestFullInventoryRefresh;

    console.info("開発版：在庫データ自動更新制御 v97 読込完了");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {once:true});
  } else {
    install();
  }
})();