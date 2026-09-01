/*
 * 在庫データ自動更新制御 v92
 *
 * 方針：
 * - 15分定期更新は停止する。
 * - バックグラウンドからの復帰時は、経過時間に関係なく現在状態を再取得する。
 * - 復帰時は現在状態更新と全体同期を同時発射せず、現在状態を先に完了させる。
 * - 受付途中でも現在状態の軽量更新は許可する。
 * - 全体同期は受付UIを壊さない安全なタイミングだけ実行する。
 * - 全体同期が保留された場合は受付終了後に消化する。
 * - 全体同期完了後は現在状態をもう一度取得し、状態の巻き戻りを防ぐ。
 * - 30分以上の復帰は app.js の完全リロード処理へ任せる。
 *
 * GASは変更しない。
 */
(function() {
  "use strict";

  const PENDING_CHECK_MS = 2000;

  let refreshHiddenAt = null;
  let pendingCheckTimer = null;
  let resumeRefreshRunning = false;

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

    console.log(
      success ? "現在状態更新完了" : "現在状態更新失敗",
      reason || ""
    );

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

    /*
     * 全体同期で個体・簡易個体の配列が置き換わるため、
     * 最後に軽量な現在状態を重ねて状態を最新化する。
     */
    await refreshCurrentState("全体同期後の最終状態更新");
    return true;
  }

  async function runResumeRefresh() {
    if (resumeRefreshRunning || !isVisible()) return false;

    resumeRefreshRunning = true;

    try {
      /*
       * 復帰直後はまず現在状態だけ更新する。
       * iPhone Safari からGASへ複数通信を同時発射しないため、
       * 全体同期は現在状態更新が終わってから開始する。
       */
      await refreshCurrentState("バックグラウンド復帰");

      if (!isVisible()) {
        return false;
      }

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

  function handleVisibleReturn() {
    if (!refreshHiddenAt) return;

    const awayMs = Date.now() - refreshHiddenAt;
    refreshHiddenAt = null;

    /* 30分以上は既存 app.js の完全リロード処理を優先する */
    if (
      typeof AUTO_RELOAD_MINUTES !== "undefined" &&
      awayMs >= AUTO_RELOAD_MINUTES * 60 * 1000
    ) {
      return;
    }

    void runResumeRefresh();
  }

  function installVisibilityControl() {
    document.addEventListener("visibilitychange", function() {
      if (document.visibilityState === "hidden") {
        refreshHiddenAt = Date.now();
        return;
      }

      if (document.visibilityState === "visible") {
        handleVisibleReturn();
      }
    });

    window.addEventListener("pageshow", function() {
      if (document.visibilityState === "visible") {
        handleVisibleReturn();
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

  function stopLegacyScheduledRefresh() {
    if (
      typeof inventoryRefreshTimer !== "undefined" &&
      inventoryRefreshTimer
    ) {
      clearInterval(inventoryRefreshTimer);
      inventoryRefreshTimer = null;
    }
  }

  function install() {
    stopLegacyScheduledRefresh();
    installVisibilityControl();
    startPendingChecker();

    window.runPendingInventoryRefreshAfterSession =
      runPendingInventoryRefreshAfterSession;
    window.requestInventoryRefreshDev =
      requestFullInventoryRefresh;

    console.info("開発版：在庫データ自動更新制御 v92 読込完了");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {once:true});
  } else {
    install();
  }
})();
