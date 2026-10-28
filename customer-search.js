/* 取引先検索：在庫の受付・送信処理とは独立した閲覧専用機能 */
(() => {
  'use strict';
  const URL = 'https://script.google.com/macros/s/AKfycbztguQj2mLmDPaddFF_upjvGOqlIUqXNcdvr3ILbORFbrJYQmm6Hopc_uPRNPEGofJ-0Q/exec';
  const entry = document.getElementById('customerSearchEntry');
  const home = document.getElementById('receptionStep');
  const panel = document.getElementById('customerSearchPanel');
  const back = document.getElementById('customerSearchBack');
  const input = document.getElementById('customerSearchInput');
  const kana = document.getElementById('customerSearchKana');
  const staff = document.getElementById('customerSearchStaff');
  const results = document.getElementById('customerSearchResults');
  const status = document.getElementById('customerSearchStatus');
  const tabs = [...panel.querySelectorAll('[data-customer-tab]')];
  if (!entry || !home || !panel || !back || !input || !kana || !staff || !results || !status) return;
  let rows = null, mode = 'kana', chosen = '', pending = null;
  const normalize = value => String(value ?? '').normalize('NFKC')
    .replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 96))
    .replace(/株式会社|有限会社|合同会社|\(株\)|\(有\)|[㈱㈲]/g, '')
    .replace(/[\s\u3000・･.．\-－ー]/g, '').toUpperCase();
  const groups = [
    ['あ行','アイウエオ'],['か行','カキクケコガギグゲゴ'],
    ['さ行','サシスセソザジズゼゾ'],['た行','タチツテトダヂヅデド'],
    ['な行','ナニヌネノ'],['は行','ハヒフヘホバビブベボパピプペポ'],
    ['ま行','マミムメモ'],['や行','ヤユヨ'],['ら行','ラリルレロ'],
    ['わ行','ワヰヱヲン'],['その他','']
  ];
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const groupFor = word => {
    const first = normalize(word).charAt(0);
    return (groups.find(g => g[1].includes(first)) || groups[groups.length - 1])[0];
  };
  const renderButtons = () => {
    const items = mode === 'kana' ? groups.map(g => g[0])
      : [...new Set((rows || []).map(r => r.staff || '担当未設定'))].sort((a,b)=>a.localeCompare(b,'ja'));
    const target = mode === 'kana' ? kana : staff;
    target.replaceChildren();
    for (const item of items) {
      const button = el('button','customerSearchChip' + (chosen === item ? ' isSelected' : ''),item);
      button.type = 'button';
      button.addEventListener('click',()=>{chosen = chosen === item ? '' : item; renderButtons(); render();});
      target.appendChild(button);
    }
    kana.hidden = mode !== 'kana';
    staff.hidden = mode !== 'staff';
    tabs.forEach(t => t.setAttribute('aria-pressed',String(t.dataset.customerTab === mode)));
  };
  const render = () => {
    const term = normalize(input.value);
    const matched = (rows || []).filter(r =>
      (!chosen || (mode === 'kana' ? groupFor(r.kana || r.name) === chosen : (r.staff || '担当未設定') === chosen))
      && (!term || [r.name,r.shortName,r.kana].some(v => normalize(v).includes(term)))
    );
    results.replaceChildren();
    status.textContent = rows ? matched.length + '件表示' : '';
    for (const r of matched) {
      const item = el('div','customerSearchResult');
      item.append(el('strong','',r.name),el('div','customerSearchPerson','担当者：' + (r.staff || '未設定')));
      results.appendChild(item);
    }
    if (rows && !matched.length) results.append(el('p','','該当する取引先はありません。'));
  };
  async function load() {
    if (rows) {renderButtons();render();return;}
    if (pending) return pending;
    status.textContent = '取引先データを読み込んでいます…';
    pending = (async()=>{
      try {
        const res = await fetch(URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
          body:JSON.stringify({action:'getCustomerSearchMaster'})});
        if (!res.ok) throw new Error('HTTP '+res.status);
        const data = await res.json();
        if (data.ok !== true || !Array.isArray(data.customers)) throw new Error(data.message || '検索APIが未設定です');
        rows = data.customers.map(x=>({
          name:String(x.name||''),shortName:String(x.shortName||''),kana:String(x.kana||''),staff:String(x.staff||'')
        })).filter(x=>x.name);
        renderButtons();render();
      } catch(e) {
        status.textContent = '読み込みに失敗しました。戻って再度開いてください。';
        results.replaceChildren(el('p','',String(e.message||e)));
      } finally {pending = null;}
    })();
    return pending;
  }
  entry.addEventListener('click',()=>{
    home.hidden = true;
    home.style.display = 'none';
    panel.hidden = false;
    panel.style.display = 'block';
    load();
  });
  const closeCustomerSearch = () => {
    panel.hidden = true;
    panel.style.display = 'none';
    home.hidden = false;
    home.style.display = '';
  };
  back.addEventListener('click', closeCustomerSearch);
  // 「最初から」は既存の resetWizard() を妨げず、検索画面だけ先に閉じる。
  // captureで既存app.jsのclick処理より先に実行する。
  document.getElementById('restartButton')?.addEventListener('click', () => {
    if (!panel.hidden) {
      closeCustomerSearch();
      input.value = '';
      chosen = '';
      mode = 'kana';
      renderButtons();
      render();
    }
  }, true);
  input.addEventListener('input',render);
  tabs.forEach(t=>t.addEventListener('click',()=>{
    mode=t.dataset.customerTab;chosen='';renderButtons();render();
  }));
  renderButtons();
})();
