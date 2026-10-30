/**
 * 預かり品 入庫専用GASモジュール（本番doPost未接続）
 * 接続時: action === 'azukariDeposit' の場合に azukariDeposit_(ss, data) を呼び、
 * 既存の jsonOutput_ で結果を返す。通常在庫処理には触れない。
 * 写真は base64 JPEG/PNG/WebP を送る。保存成功まで入庫行を作らない。
 * ScriptLock と送信ID照合で再送の二重登録を防止する。
 */
const AZ_CUSTOMERS_ = Object.freeze([
  'ＴＡＮＡＫＥＮ 株式会社', '株式会社 大岩', '三貴 株式会社'
]);
const AZ_DATA_HEADERS_ = [
  '内部キー','顧客名','現場名','品名','保管区分','単位','現在残数',
  '状態','初回入庫日時','最終更新日時','写真URL','備考','送信ID'
];
const AZ_LOG_HEADERS_ = [
  '履歴キー','内部キー','操作','数量','前残数','後残数',
  '日時','送信ID','写真URL','顧客名','現場名'
];
function azukariSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); }
  else if (sh.getLastRow() < 1) sh.appendRow(headers);
  else {
    const existing = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    if (headers.some((h,i)=>existing[i] !== h)) throw new Error(name+' の列構成が一致しません');
  }
  return sh;
}
function azukariDeposit_(ss, data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return {ok:false,code:'BUSY',message:'処理中です。同じ送信IDで再試行してください'};
  try {
    const sendId = String(data && data.sendId || '').trim();
    const customer = String(data && data.customer || '').trim();
    const site = String(data && data.site || '').trim();
    const kind = String(data && data.kind || '').trim();
    const item = String(data && data.item || '').trim();
    const unit = kind === 'box' ? '台' : String(data && data.unit || '').trim();
    const qty = Number(data && data.qty);
    const memo = String(data && data.memo || '').trim();
    const photo = data && data.photo;
    if (!/^[a-zA-Z0-9_-]{12,120}$/.test(sendId)) throw new Error('送信IDが不正です');
    if (!AZ_CUSTOMERS_.includes(customer)) throw new Error('顧客名が不正です');
    if (!['box','other'].includes(kind) || !Number.isInteger(qty) || qty<1 || qty>9999)
      throw new Error('保管区分または数量が不正です');
    if (site.length>150 || memo.length>500 || item.length>120 || unit.length>12 ||
      (kind==='other' && (!item || !unit))) throw new Error('入力内容を確認してください');
    const dataSheet = azukariSheet_(ss,'預かり品データ',AZ_DATA_HEADERS_);
    const logSheet = azukariSheet_(ss,'預かり品履歴',AZ_LOG_HEADERS_);
    // 送信IDは必ず先に検索。通信失敗後の再送でも写真を重複作成しない。
    const last = dataSheet.getLastRow();
    if (last>1) {
      const found = dataSheet.getRange(2,13,last-1,1).createTextFinder(sendId).matchEntireCell(true).findNext();
      if (found) {
        const row = dataSheet.getRange(found.getRow(),1,1,13).getValues()[0];
        return {ok:true,duplicate:true,internalId:row[0],photoUrl:row[10],message:'登録済みの送信です'};
      }
    }
    if (!photo || !/^image\/(jpeg|png|webp)$/.test(String(photo.mimeType||'')) ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(String(photo.base64||'')))
      throw new Error('入庫写真が必要です');
    const bytes = Utilities.base64Decode(photo.base64);
    if (bytes.length===0 || bytes.length>8*1024*1024) throw new Error('写真サイズが大きすぎます（上限8MB）');
    const folderId = PropertiesService.getScriptProperties().getProperty('AZUKARI_PHOTO_FOLDER_ID');
    if (!folderId) throw new Error('写真保存先が未設定です');
    const folder = DriveApp.getFolderById(folderId);
    const internalId = Utilities.getUuid(), historyId = Utilities.getUuid();
    const ext = photo.mimeType==='image/png'?'png':photo.mimeType==='image/webp'?'webp':'jpg';
    const file = folder.createFile(Utilities.newBlob(bytes,photo.mimeType,internalId+'.'+ext));
    const now = new Date(), photoUrl = file.getUrl();
    try {
      dataSheet.appendRow([internalId,customer,site,kind==='box'?'BOXパレット':item,
        kind,unit,qty,'保管中',now,now,photoUrl,memo,sendId]);
      logSheet.appendRow([historyId,internalId,'入庫',qty,0,qty,now,sendId,photoUrl,customer,site]);
    } catch (e) {
      // データ行の書込みが成功し履歴だけ失敗した可能性があるため、
      // 自動削除や別ID再送は行わず、管理者が送信IDで突合する。
      throw new Error('保存結果の確認が必要です。送信ID='+sendId+' / '+e.message);
    }
    return {ok:true,duplicate:false,internalId,photoUrl,message:'入庫登録完了'};
  } catch(e) {
    return {ok:false,code:'DEPOSIT_ERROR',message:String(e.message||e)};
  } finally { lock.releaseLock(); }
}
