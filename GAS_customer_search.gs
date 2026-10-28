/** 既存の doPost(e) の action 分岐へ追加：
 * if (data.action === 'getCustomerSearchMaster')
 *   return jsonOutput_(getCustomerSearchMaster_(ss));
 * ※ ss は既存 doPost で取得済みのスプレッドシート。
 * ※ jsonOutput_ は既存のJSONレスポンスヘルパー。
 * 在庫データ・ログへの書込みは行わない。
 */
function getCustomerSearchMaster_(ss) {
  const sh = ss.getSheetByName('取引先マスタ');
  if (!sh) return {ok:false,message:'取引先マスタが見つかりません'};
  const last = sh.getLastRow();
  if (last < 2) return {ok:true,customers:[]};
  const customers = sh.getRange(2,1,last-1,4).getDisplayValues()
    .filter(row => String(row[0]||'').trim())
    .map(row => ({
      name: String(row[0]||'').trim(),
      shortName: String(row[1]||'').trim(),
      kana: String(row[2]||'').trim(),
      staff: String(row[3]||'').trim()
    }));
  return {ok:true,customers:customers};
}
