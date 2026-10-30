/* 預かり品管理：入庫画面プレビュー。GAS送信なし／通常画面では非表示。 */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('azukariPreview') !== '1') return;
  const entry = document.getElementById('azukariEntryButton');
  const home = document.getElementById('receptionStep');
  if (!entry || !home) return;
  const style = document.createElement('style');
  style.textContent = `
    #azukariPreviewPanel[hidden]{display:none!important}
    #azukariPreviewPanel{background:#fff;border:1px solid #d9e0ea;border-radius:14px;padding:16px;margin-top:12px}
    #azukariPreviewPanel .azField{display:block;margin:14px 0;font-weight:700}
    #azukariPreviewPanel input,#azukariPreviewPanel select,#azukariPreviewPanel textarea{display:block;width:100%;min-height:46px;margin-top:7px;padding:10px;border:1px solid #aab6c4;border-radius:9px;font:inherit;background:white}
    #azukariPreviewPanel .azActions{display:flex;gap:8px}
    #azukariPreviewPanel button{padding:12px;border-radius:9px;border:1px solid #1677ff;background:#eef6ff;color:#075fc9;font-weight:700}
    #azukariPreviewPanel .azNotice{color:#a34c00;background:#fff7e6;padding:10px;border-radius:8px}
    #azukariPreviewPanel .azImage{max-width:100%;max-height:220px;object-fit:contain}
  `;
  document.head.append(style);
  const panel = document.createElement('section');
  panel.id = 'azukariPreviewPanel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="stepLabel">預かり品管理／三郷</div>
    <h2>入庫受付</h2>
    <p class="azNotice">開発確認用画面です。送信・保存・印刷はできません。</p>
    <label class="azField">顧客名
      <select id="azCustomer" required>
        <option value="">選択してください</option>
        <option>ＴＡＮＡＫＥＮ 株式会社</option>
        <option>株式会社 大岩</option>
        <option>三貴 株式会社</option>
      </select>
    </label>
    <label class="azField">現場名（不明でも可）
      <input id="azSite" type="text" maxlength="150" placeholder="現場名／未確認">
    </label>
    <label class="azField">保管区分
      <select id="azKind"><option value="box">BOXパレット</option><option value="other">その他</option></select>
    </label>
    <label class="azField" id="azItemRow" hidden>品名
      <input id="azItem" type="text" maxlength="120" placeholder="預かり品の名称">
    </label>
    <label class="azField">数量（<span id="azUnit">台</span>）
      <input id="azQty" type="number" min="1" max="9999" step="1" value="1" required>
    </label>
    <label class="azField" id="azOtherUnitRow" hidden>単位
      <input id="azOtherUnit" type="text" maxlength="12" placeholder="個・本・箱など">
    </label>
    <label class="azField">備考
      <textarea id="azMemo" rows="2" maxlength="500" placeholder="必要に応じて入力"></textarea>
    </label>
    <label class="azField">入庫写真（必須）
      <input id="azPhoto" type="file" accept="image/*" capture="environment" required>
    </label>
    <img id="azImagePreview" class="azImage" alt="選択した入庫写真" hidden>
    <p id="azStatus" role="status"></p>
    <div class="azActions">
      <button id="azBack" type="button">戻る</button>
      <button id="azCheck" type="button">入力内容を確認</button>
    </div>
  `;
  home.insertAdjacentElement('afterend',panel);
  const get = id => document.getElementById(id);
  const kind = get('azKind');
  const updateKind = () => {
    const other = kind.value === 'other';
    get('azItemRow').hidden = !other;
    get('azOtherUnitRow').hidden = !other;
    get('azUnit').textContent = other ? '指定単位' : '台';
  };
  kind.addEventListener('change',updateKind);
  entry.disabled = false;
  entry.removeAttribute('aria-disabled');
  entry.classList.remove('salesComingSoon');
  entry.title = '開発確認用：預かり品入庫画面';
  entry.addEventListener('click',() => {
    home.hidden = true;home.style.display = 'none';
    panel.hidden = false;
    window.scrollTo(0,0);
  });
  get('azBack').addEventListener('click',() => {
    panel.hidden = true;home.hidden = false;home.style.display = '';
  });
  let objectUrl = null;
  get('azPhoto').addEventListener('change',() => {
    if(objectUrl) URL.revokeObjectURL(objectUrl);
    const f = get('azPhoto').files[0];
    const img = get('azImagePreview');
    img.hidden = !f;
    if(f){objectUrl = URL.createObjectURL(f);img.src = objectUrl;}
    else img.removeAttribute('src');
  });
  get('azCheck').addEventListener('click',() => {
    const customer=get('azCustomer').value,qty=Number(get('azQty').value);
    const other=kind.value==='other',file=get('azPhoto').files[0];
    const message=get('azStatus');
    if(!customer || !Number.isInteger(qty) || qty<1 || qty>9999 ||
      (other && (!get('azItem').value.trim() || !get('azOtherUnit').value.trim())) ||
      !file || !file.type.startsWith('image/')){
      message.textContent='顧客・数量・写真（その他の場合は品名と単位も）を確認してください。';
      return;
    }
    message.textContent='入力確認OK：'+customer+'／'+(other?get('azItem').value.trim():'BOXパレット')+
      '／'+qty+(other?get('azOtherUnit').value.trim():'台')+'。※未保存・未印刷です。';
  });
})();
