/*
 * 在庫通信診断 v2（一時調査用）
 *
 * - fetchWithRetry の通信だけを観測し、挙動は変更しない。
 * - 診断ログは localStorage に直近50件だけ保存する。
 * - 「在庫データ：日時」を3回タップするとログを表示する。
 * - 調査終了後はこのファイルと loader を削除する。
 */
(function() {
  "use strict";

  const STORAGE_KEY = "worksInventoryFetchDiagnosticsV1";
  const MAX_ENTRIES = 50;
  const TAP_COUNT = 3;
  const TAP_WINDOW_MS = 1200;

  let tapTimes = [];
  let lastForegroundAt = Date.now();

  function nowIso() {
    return new Date().toISOString();
  }

  function readEntries() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeEntry(entry) {
    try {
      const entries = readEntries();
      entries.push(entry);
      if (entries.length > MAX_ENTRIES) {
        entries.splice(0, entries.length - MAX_ENTRIES);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.warn("在庫通信診断ログの保存に失敗しました", error);
    }
  }

  function classifyRequest(url, options) {
    const body = options && options.body ? String(options.body) : "";
    if (body.includes('"action":"getCurrentStateData"')) return "current-state";
    if (body.includes('"action":"getAppInitialData"')) return "full-sync";
    return "other";
  }

  function detectCallerSource() {
    try {
      const stack = String(new Error().stack || "");
      if (stack.includes("initializeInventoryDataFoundation")) return "startup";
      if (stack.includes("refreshInventoryInBackground")) return "post-send-refresh";
      if (stack.includes("requestFullInventoryRefresh")) return "controller-full-sync";
      if (stack.includes("refreshCurrentState")) return "controller-current-state";
      if (stack.includes("loadCurrentStateData")) return "current-state-direct";
      if (stack.includes("loadAppInitialData")) return "full-sync-direct";
      return "unknown";
    } catch (error) {
      return "unknown";
    }
  }

  function installFetchObserver() {
    if (typeof window.fetch !== "function" || window.fetch.__inventoryDiagnosticsWrapped) return;

    const originalFetch = window.fetch.bind(window);

    async function observedFetch(url, options) {
      const type = classifyRequest(url, options);
      if (type === "other") {
        return originalFetch(url, options);
      }

      const startedAt = performance.now();
      const startedWall = Date.now();
      const base = {
        time: nowIso(),
        type:type,
        visibility:document.visibilityState,
        sinceForegroundMs:Math.max(0, startedWall - lastForegroundAt),
        source:detectCallerSource()
      };

      writeEntry(Object.assign({}, base, {event:"start"}));

      try {
        const response = await originalFetch(url, options);
        writeEntry(Object.assign({}, base, {
          event:response.ok ? "ok" : "http-error",
          status:response.status,
          durationMs:Math.round(performance.now() - startedAt)
        }));
        return response;
      } catch (error) {
        writeEntry(Object.assign({}, base, {
          event:"fetch-error",
          message:error && error.message ? error.message : String(error),
          durationMs:Math.round(performance.now() - startedAt)
        }));
        throw error;
      }
    }

    observedFetch.__inventoryDiagnosticsWrapped = true;
    window.fetch = observedFetch;
  }

  function markForeground(reason) {
    lastForegroundAt = Date.now();
    writeEntry({
      time:nowIso(),
      type:"lifecycle",
      event:"foreground",
      reason:reason,
      visibility:document.visibilityState
    });
  }

  function formatEntry(entry) {
    if (entry.type === "lifecycle") {
      return entry.time + " foreground " + (entry.reason || "");
    }

    let text = entry.time + " " + entry.type + " " + entry.event;
    if (Number.isFinite(entry.durationMs)) text += " " + entry.durationMs + "ms";
    if (Number.isFinite(entry.status)) text += " HTTP " + entry.status;
    if (entry.message) text += " " + entry.message;
    if (Number.isFinite(entry.sinceForegroundMs)) text += " foreground+" + entry.sinceForegroundMs + "ms";
    if (entry.source) text += " source=" + entry.source;
    text += " " + (entry.visibility || "");
    return text;
  }

  function showDiagnostics() {
    const entries = readEntries();
    const text = entries.length
      ? entries.map(formatEntry).join("\n")
      : "診断ログはまだありません";
    alert("在庫通信診断（直近50件）\n\n" + text);
  }

  function installTripleTap() {
    const status = document.getElementById("inventoryDataStatus");
    if (!status || status.dataset.inventoryDiagnosticsBound === "true") return;

    status.dataset.inventoryDiagnosticsBound = "true";
    status.addEventListener("click", function() {
      const now = Date.now();
      tapTimes = tapTimes.filter(function(value) {
        return now - value <= TAP_WINDOW_MS;
      });
      tapTimes.push(now);

      if (tapTimes.length >= TAP_COUNT) {
        tapTimes = [];
        showDiagnostics();
      }
    });
  }

  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible") {
      markForeground("visibilitychange");
    }
  });

  window.addEventListener("pageshow", function() {
    markForeground("pageshow");
  });

  installFetchObserver();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installTripleTap, {once:true});
  } else {
    installTripleTap();
  }

  console.info("在庫通信診断 v2 読込完了（日時3回タップで表示）");
})();
