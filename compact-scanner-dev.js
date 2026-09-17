/* 開発版 v54：10:9カメラ幅レスポンシブ + 管理ID重複ガード */
(function() {
  "use strict";

  /*
   * iPhone SE 375px幅ではv52とほぼ同じ大きさを維持。
   * 画面幅が広い端末ではカメラだけ少しずつ広げ、最大430pxで止める。
   * 常に画面中央配置。読取ロジック・ズーム・入力解像度は変更しない。
   */
  const style = document.createElement("style");
  style.id = "compactScannerV54Style";
  style.textContent = `
    .scannerViewport {
      width: clamp(351px, 94vw, 430px) !important;
      max-width: none !important;
      left: 50%;
      transform: translateX(-50%);
      margin-left: 0 !important;
      margin-right: 0 !important;
    }

    .scannerVideo {
      aspect-ratio: 10 / 9 !important;
      object-fit: cover !important;
    }

    .scannerFrame {
      left: 30% !important;
      top: 27.5% !important;
      width: 40% !important;
      height: 45% !important;
      border-width: 3px !important;
      border-radius: 12px !important;
    }

    @media (max-width: 374px) {
      .scannerViewport {
        width: calc(100vw - 18px) !important;
      }
    }
  `;
  document.head.appendChild(style);

  /*
   * QR読取・マスタ選択など入口に関係なく、
   * scannedEntries へ追加する最終地点で同一管理IDを拒否する。
   * 数量管理品は品目単位で複数登録する運用があるため対象外。
   */
  if (typeof commitWizardScanRecord === "function") {
    const originalCommitWizardScanRecord =
      commitWizardScanRecord;

    function normalizeDuplicateManagedId(value) {
      if (typeof normalizeManagedIdKey === "function") {
        return normalizeManagedIdKey(value || "");
      }

      return String(value || "")
        .normalize("NFKC")
        .replace(/\s+/g, "")
        .toUpperCase()
        .trim();
    }

    commitWizardScanRecord = function(record) {
      const sourceRecord = record || {};

      if (sourceRecord.recordType !== "quantity") {
        const incomingKey =
          normalizeDuplicateManagedId(
            sourceRecord.qrText ||
            sourceRecord.qr ||
            sourceRecord.itemCode ||
            ""
          );

        if (incomingKey) {
          const entries =
            typeof scannedEntries !== "undefined" &&
            Array.isArray(scannedEntries)
              ? scannedEntries
              : [];

          const alreadyExists =
            entries.some(function(entry) {
              const existing = entry || {};
              const existingKey =
                normalizeDuplicateManagedId(
                  existing.qrText ||
                  existing.qr ||
                  existing.itemCode ||
                  ""
                );

              return (
                existingKey &&
                existingKey === incomingKey
              );
            });

          if (alreadyExists) {
            const message =
              "この機械はすでに読み取り済みです";

            if (
              typeof notifyWizardScanError ===
              "function"
            ) {
              notifyWizardScanError(
                message,
                1500
              );
            } else {
              alert(message);
            }

            if (
              typeof scannerBusy !==
              "undefined"
            ) {
              scannerBusy = false;
            }

            return;
          }
        }
      }

      return originalCommitWizardScanRecord(
        record
      );
    };
  } else {
    console.warn(
      "開発版 v54：commitWizardScanRecord が見つからず、管理ID重複ガードを適用できませんでした"
    );
  }

  console.info(
    "開発版 v54：10:9カメラ幅レスポンシブ + 管理ID重複ガード 有効"
  );
})();
