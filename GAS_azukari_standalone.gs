/**
 * 預かり品専用・独立GASプロジェクト用。
 * 既存のQR在庫管理GASには貼らないこと。
 * 1) 新規Apps Scriptプロジェクトを作り、このファイルと
 *    GAS_azukari_deposit.gs の内容を追加する
 * 2) スクリプトプロパティ:
 *    AZUKARI_SPREADSHEET_ID = 対象スプレッドシートID
 *    AZUKARI_PHOTO_FOLDER_ID = 写真保存先DriveフォルダID
 * 3) ウェブアプリとしてデプロイ（実行ユーザー: 自分）
 * ※ 既存のdoPostは一切変更しない
 */
function azukariSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('AZUKARI_SPREADSHEET_ID');
  if (!id) throw new Error('AZUKARI_SPREADSHEET_ID が未設定です');
  return SpreadsheetApp.openById(id);
}
function azukariJson_(result) {
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return azukariJson_({ok:false,code:'EMPTY_REQUEST',message:'送信データがありません'});
    }
    const data = JSON.parse(e.postData.contents);
    const action = String(data.action || '');
    if (action === 'azukariDeposit') return azukariJson_(azukariDeposit_(azukariSpreadsheet_(),data));
    if (action === 'azukariCheckout') return azukariJson_(azukariCheckout_(azukariSpreadsheet_(),data));
    return azukariJson_({ok:false,code:'UNKNOWN_ACTION',message:'未対応の操作です'});
  } catch (err) {
    return azukariJson_({ok:false,code:'SERVER_ERROR',message:String(err.message||err)});
  }
}
function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || '');
    if (action === 'azukariList') return azukariJson_(azukariList_(azukariSpreadsheet_()));
    return azukariJson_({ok:true,service:'azukari',message:'預かり品専用GAS'});
  } catch (err) {
    return azukariJson_({ok:false,code:'SERVER_ERROR',message:String(err.message||err)});
  }
}
function azukariList_(ss) {
  const sh = azukariSheet_(ss,'預かり品データ',AZ_DATA_HEADERS_);
  const last = sh.getLastRow();
  if (last<2) return {ok:true,items:[]};
  const rows=sh.getRange(2,1,last-1,13).getValues();
  return {ok:true,items:rows.filter(r=>r[0]).map(r=>({
    id:String(r[0]),customer:String(r[1]),site:String(r[2]),item:String(r[3]),
    kind:String(r[4]),unit:String(r[5]),remaining:Number(r[6]),
    status:String(r[7]),created:r[8] instanceof Date?r[8].toISOString():String(r[8]),
    updated:r[9] instanceof Date?r[9].toISOString():String(r[9]),
    photoUrl:String(r[10]),memo:String(r[11])
  }))};
}
function azukariCheckout_(ss,data) {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(25000))return {ok:false,code:'BUSY',message:'処理中です。同じ送信IDで再試行してください'};
  try {
    const id=String(data && data.internalId || '').trim();
    const sendId=String(data && data.sendId || '').trim();
    const qty=Number(data && data.qty);
    if(!/^[a-f0-9-]{36}$/i.test(id)||!/^[a-zA-Z0-9_-]{12,120}$/.test(sendId)||
       !Number.isInteger(qty)||qty<1||qty>9999)throw new Error('出庫内容が不正です');
    const ds=azukariSheet_(ss,'預かり品データ',AZ_DATA_HEADERS_);
    const hs=azukariSheet_(ss,'預かり品履歴',AZ_LOG_HEADERS_);
    const logLast=hs.getLastRow();
    if(logLast>1) {
      const existing=hs.getRange(2,8,logLast-1,1).createTextFinder(sendId).matchEntireCell(true).findNext();
      if(existing){
        const row=hs.getRange(existing.getRow(),1,1,11).getValues()[0];
        if(String(row[1])!==id||Number(row[3])!==qty)throw new Error('同じ送信IDで異なる出庫内容です');
        return {ok:true,duplicate:true,remaining:Number(row[5]),message:'登録済みの出庫です'};
      }
    }
    const last=ds.getLastRow();
    if(last<2)throw new Error('対象の預かり品がありません');
    const found=ds.getRange(2,1,last-1,1).createTextFinder(id).matchEntireCell(true).findNext();
    if(!found)throw new Error('対象の預かり品がありません');
    const rowNo=found.getRow(),r=ds.getRange(rowNo,1,1,13).getValues()[0];
    const before=Number(r[6]);
    if(!Number.isInteger(before)||before<qty)throw new Error('出庫数量が現在残数を超えています');
    const after=before-qty,now=new Date();
    // 履歴を先に確定。残数更新に失敗しても同じ送信IDで再送したときに
    // 履歴を元に残数を再計算・修復できるようにする。
    hs.appendRow([Utilities.getUuid(),id,'出庫',qty,before,after,now,sendId,
      String(r[10]),String(r[1]),String(r[2])]);
    try {
      ds.getRange(rowNo,7,1,3).setValues([[after,after===0?'出庫済み':'保管中',r[8]]]);
      ds.getRange(rowNo,10).setValue(now);
    } catch(err) {
      return {ok:false,code:'RECONCILE_REQUIRED',message:'履歴は記録されました。残数の確認が必要です。送信ID='+sendId};
    }
    return {ok:true,duplicate:false,remaining:after,message:'出庫登録完了'};
  }catch(err){return {ok:false,code:'CHECKOUT_ERROR',message:String(err.message||err)};}
  finally{lock.releaseLock();}
}
