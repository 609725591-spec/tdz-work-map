/* 顶钻展作业地图 · 登记式登录 + 云端使用埋点（v1.2 决策#18）
 * 双身份：内部同事=花名+工号；服务商同事=公司名+姓名。无验证码（自报身份，仅用于使用统计，非安全鉴权）。
 * 埋点写 Supabase tdz_usage_logs（RLS：anon 仅 insert，不可读）；读汇总走 tdz_usage_read(访问码) RPC，仅内部持码者可读。
 * 离线兜底：发送失败进 localStorage 队列（上限100），下次进入/登录后补发。
 * 自动化验收（navigator.webdriver）自动以演示身份放行、不埋点、不显示徽章；localStorage.tdz_force_gate=1 可强制显示登记门（截教程图用）。
 */
(function () {
  'use strict';
  var SB = 'https://vtslvpfxjrflutorfryq.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c2x2cGZ4anJmbHV0b3JmcnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxOTkzMjEsImV4cCI6MjA5Nzc3NTMyMX0.SeW0gTgIAYEDCZawSU65XNbp--L3CJ3jw7XntymKzdQ';
  var LS_USER = 'tdz_user', LS_Q = 'tdz_logq';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  var SID = (function () { try { var s = sessionStorage.getItem('tdz_sid'); if (!s) { s = 's' + Date.now().toString(36); sessionStorage.setItem('tdz_sid', s); } return s; } catch (e) { return 's-anon'; } })();
  var forceGate = lsGet('tdz_force_gate') === '1';
  var isBot = navigator.webdriver === true && !forceGate;
  var user = null;
  try { user = JSON.parse(lsGet(LS_USER) || 'null'); } catch (e) { user = null; }
  if (user && !(user.kind === 'inner' || user.kind === 'sp') || (user && !user.name)) user = null;
  if (!user && isBot) user = { kind: 'inner', name: '演示', emp: '000000', demo: true };

  /* ---------- 云端发送 ---------- */
  function post(row) {
    return fetch(SB + '/rest/v1/tdz_usage_logs', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row)
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }
  function queue(row) {
    var q = []; try { q = JSON.parse(lsGet(LS_Q) || '[]'); } catch (e) { q = []; }
    q.push(row); while (q.length > 100) q.shift(); lsSet(LS_Q, JSON.stringify(q));
  }
  function flush() {
    var q = []; try { q = JSON.parse(lsGet(LS_Q) || '[]'); } catch (e) { q = []; }
    if (!q.length) return;
    lsSet(LS_Q, '[]');
    q.forEach(function (row) { post(row).then(function (ok) { if (!ok) queue(row); }); });
  }
  function tdzLog(event, detail) {
    if (!user || user.demo) return;
    var row = {
      kind: user.kind, name: user.name, emp: user.emp || null, company: user.company || null,
      event: event, view: (window.S && window.S.view) || null,
      detail: detail == null ? null : detail, sid: SID,
      ua: (navigator.userAgent || '').slice(0, 120), client_ts: new Date().toISOString()
    };
    post(row).then(function (ok) { if (!ok) queue(row); });
  }
  window.tdzLog = tdzLog;
  window.tdzUser = function () { return user && !user.demo ? user : null; };

  /* ---------- 头部身份徽章 ---------- */
  function mountBadge() {
    var host = document.querySelector('[data-tdz-user]');
    if (!host || !user || user.demo) return;
    host.style.display = '';
    host.textContent = user.kind === 'inner' ? user.name + '（' + user.emp + '）' : user.company + '·' + user.name;
    host.title = '登记身份 · 仅用于使用统计';
    var out = document.getElementById('tdzLogout');
    if (!out) {
      out = document.createElement('button');
      out.id = 'tdzLogout'; out.className = host.className || 'badge';
      out.textContent = '退出'; out.title = '清除本机登记身份';
      host.parentNode.insertBefore(out, host.nextSibling);
      out.onclick = function () { tdzLog('logout'); lsDel(LS_USER); user = null; host.style.display = 'none'; out.remove(); showGate(); };
    }
  }

  /* ---------- 登记门 ---------- */
  var gateEl = null;
  function showGate() {
    if (gateEl) { gateEl.style.display = 'flex'; return; }
    var st = document.createElement('style');
    st.textContent = '#tdzGate{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(6,10,20,.72);backdrop-filter:blur(6px);padding:16px}'
      + '#tdzGate .card{width:min(430px,100%);background:#0e1626;border:1px solid rgba(120,160,255,.25);border-radius:16px;padding:26px 24px;color:#e8eefc;font:14px/1.65 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;box-shadow:0 18px 60px rgba(0,0,0,.5)}'
      + 'body.light #tdzGate .card{background:#fff;color:#1c2434;border-color:rgba(30,60,160,.2)}'
      + '#tdzGate h2{margin:0 0 4px;font-size:19px}#tdzGate .sub{color:#8fa9; font-size:12px;margin-bottom:14px}'
      + 'body.light #tdzGate .sub{color:#667}'
      + '#tdzGate .tabs{display:flex;gap:8px;margin-bottom:14px}'
      + '#tdzGate .tabs button{flex:1;padding:8px 0;border-radius:9px;border:1px solid rgba(120,160,255,.35);background:transparent;color:inherit;cursor:pointer;font-size:13px}'
      + '#tdzGate .tabs button.on{background:#2563eb;border-color:#2563eb;color:#fff;font-weight:600}'
      + '#tdzGate label{display:block;font-size:12px;color:#9ab;margin:10px 0 4px}'
      + 'body.light #tdzGate label{color:#556}'
      + '#tdzGate input{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:9px;border:1px solid rgba(120,160,255,.35);background:rgba(255,255,255,.06);color:inherit;font-size:14px;outline:none}'
      + 'body.light #tdzGate input{background:#f4f6fb}'
      + '#tdzGate input:focus{border-color:#2563eb}'
      + '#tdzGate .err{color:#f5576c;font-size:12px;min-height:18px;margin-top:8px}'
      + '#tdzGate .go{width:100%;margin-top:6px;padding:11px 0;border:0;border-radius:10px;background:#2563eb;color:#fff;font-size:15px;font-weight:600;cursor:pointer}'
      + '#tdzGate .go:hover{background:#1d4ed8}'
      + '#tdzGate .note{margin-top:12px;font-size:11px;color:#78909c;line-height:1.6}'
      + 'body.light #tdzGate .note{color:#889}';
    document.head.appendChild(st);
    gateEl = document.createElement('div');
    gateEl.id = 'tdzGate';
    gateEl.innerHTML = '<div class="card"><h2>顶钻展 · 作业地图</h2><div class="sub">登记身份后进入 · 用于使用情况统计</div>'
      + '<div class="tabs"><button type="button" data-k="inner" class="on">内部同事</button><button type="button" data-k="sp">服务商同事</button></div>'
      + '<div id="tdzFInner"><label>花名</label><input id="tdzName" maxlength="20" placeholder="如：页城" autocomplete="off">'
      + '<label>工号</label><input id="tdzEmp" maxlength="12" placeholder="数字工号，外包 WB 开头" autocomplete="off"></div>'
      + '<div id="tdzFSp" style="display:none"><label>服务商公司名</label><input id="tdzCompany" maxlength="40" placeholder="营业执照全称或常用简称" autocomplete="off">'
      + '<label>您的姓名</label><input id="tdzSpName" maxlength="20" placeholder="真实姓名" autocomplete="off"></div>'
      + '<div class="err" id="tdzErr"></div><button type="button" class="go" id="tdzGo">进入工具</button>'
      + '<div class="note">登记式登录：身份为自报，仅用于使用统计与服务改进，不作安全鉴权；管理档另需访问码。身份保存在本机浏览器，点头部「退出」可清除。</div></div>';
    document.body.appendChild(gateEl);
    var kind = 'inner';
    gateEl.querySelectorAll('.tabs button').forEach(function (b) {
      b.onclick = function () {
        kind = b.dataset.k;
        gateEl.querySelectorAll('.tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
        document.getElementById('tdzFInner').style.display = kind === 'inner' ? '' : 'none';
        document.getElementById('tdzFSp').style.display = kind === 'sp' ? '' : 'none';
        document.getElementById('tdzErr').textContent = '';
      };
    });
    document.getElementById('tdzGo').onclick = function () {
      var err = document.getElementById('tdzErr');
      var v = function (id) { return (document.getElementById(id).value || '').trim(); };
      if (kind === 'inner') {
        var nm = v('tdzName'), emp = v('tdzEmp');
        if (!nm) { err.textContent = '请填写花名'; return; }
        if (!/^(WB)?\d{4,10}$/i.test(emp)) { err.textContent = '工号格式不对：4-10 位数字，外包 WB 开头'; return; }
        user = { kind: 'inner', name: nm, emp: emp.toUpperCase(), ts: Date.now() };
      } else {
        var co = v('tdzCompany'), sn = v('tdzSpName');
        if (co.length < 2) { err.textContent = '请填写服务商公司名（至少 2 字）'; return; }
        if (!sn) { err.textContent = '请填写您的姓名'; return; }
        user = { kind: 'sp', name: sn, company: co, ts: Date.now() };
      }
      lsSet(LS_USER, JSON.stringify(user));
      gateEl.style.display = 'none';
      mountBadge(); flush();
      tdzLog('login', { kind: user.kind });
    };
    gateEl.querySelectorAll('input').forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('tdzGo').click(); }); });
  }

  function init() {
    if (user && !user.demo) { mountBadge(); flush(); }
    else if (!user) showGate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();