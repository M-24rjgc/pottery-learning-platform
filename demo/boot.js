// 非遗之手 · 在线演示引导脚本
// 作用：把工作台前端原本要访问的本机服务（默认 http://<host>:4180）替换为浏览器内的演示引擎，
// 用真实的 core 业务逻辑 + 团队真实练习记录运行，不需要安装、不需要手套、不需要后端。
import { Studio } from './engine.js';

(() => {
  // 站点根路径（兼容 GitHub Pages 子路径部署）
  const SITE = location.pathname.replace(/\/(demo\/.*)?$/, '/');
  const DEMO = SITE + 'demo/';
  const isMobile = location.pathname.includes('/demo/mobile/');

  // ---------- 演示硬件状态（对应 hardware/gateway.mjs 的 state()） ----------
  const hw = {
    connected: false, path: '', transport: '', baudRate: null,
    canControl: true, canReadTemplates: false, mode: 0,
    lastSampleAt: null, recognition: null, error: null, desynchronized: false,
    sampleFresh: false, busy: null, profile: 'pottery-v2.1',
    continuousSamplesInRecognition: false, logs: []
  };
  const hwState = () => ({
    ...hw,
    sampleFresh: hw.connected && hw.lastSampleAt !== null && Date.now() - hw.lastSampleAt < 3500,
    recognition: null,
    busy: null,
    logs: hw.logs.slice(-40)
  });

  // ---------- 演示数据：团队真实练习记录 + 两个参考模板 + 一次硬件校准 ----------
  let studio = null;
  const ready = fetch(DEMO + 'data.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(d => {
      studio = new Studio(d);
      // 演示用参考姿态：与真实记录同量纲（五路 500–2500 映射值）
      studio.data.templates = [
        { id: 'demo-press', name: '揉泥按压', lesson: '揉泥基础', kind: 'correct', tolerance: 100, values: [1249, 1437, 1567, 1370, 1099], at: Date.now() },
        { id: 'demo-open', name: '自然张开', lesson: '揉泥基础', kind: 'correct', tolerance: 300, values: [2400, 2380, 2420, 2390, 2410], at: Date.now() }
      ];
      studio.data.settings.learner = '在线演示';
      studio.device = { connected: true, name: 'Glove 蓝牙手套', source: 'ble', values: [1249, 1437, 1567, 1370, 1099], lastSeen: Date.now() };
      hw.connected = true;
      hw.path = 'BLE:DEMO:00:11:22:33:44';
      hw.transport = 'ble';
      hw.mode = 0;
      hw.logs = [
        { at: Date.now() - 4000, kind: 'state', text: '手套蓝牙已连接，等待实时数据' },
        { at: Date.now() - 3000, kind: 'info', text: '模式 0=采集，五路数据接收正常' }
      ];
    });

  // ---------- 合成采样：模拟学员揉泥时的五路手势变化 ----------
  const PRESS = [1249, 1437, 1567, 1370, 1099];
  const OPEN = [2400, 2380, 2420, 2390, 2410];
  function synth(t) {
    const phase = (t / 1000) % 16;
    let base, amp;
    if (phase < 4) { base = PRESS; amp = 22; }
    else if (phase < 8) { base = PRESS.map((v, i) => v + (i % 2 ? 1 : -1) * 210); amp = 45; }
    else if (phase < 12) { base = PRESS; amp = 18; }
    else { base = OPEN; amp = 30; }
    return base.map(v => Math.max(500, Math.min(2500, Math.round(v + (Math.random() - 0.5) * 2 * amp))));
  }
  setInterval(() => {
    if (!studio || !hw.connected) return;
    try {
      const v = synth(Date.now());
      studio.device = { connected: true, name: 'Glove 蓝牙手套', source: 'ble', values: v, lastSeen: Date.now() };
      hw.lastSampleAt = Date.now();
      studio.ingest(v, 'Glove 蓝牙手套', 'ble');
    } catch (e) { /* 演示态忽略 */ }
  }, 200);

  // 自动开始一场练习，让打开页面的人立刻看到曲线在动
  let autoStarted = false;
  setInterval(() => {
    if (!autoStarted && studio && !studio.session) {
      autoStarted = true;
      try { studio.action('start'); } catch (e) { }
    }
  }, 900);

  // ---------- 接口层 ----------
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

  async function handle(path, init) {
    await ready;
    const [route, query] = path.split('?');
    const params = new URLSearchParams(query || '');
    let body = {};
    if (init && init.body) { try { body = JSON.parse(init.body); } catch { } }

    if (route === '/api/state') { studio.touch(params.get('client')); return json({ ...studio.state(), hardware: hwState() }); }
    if (route === '/api/network') return json({ ips: ['192.168.1.20'], port: 4180 });

    if (route === '/api/hardware/ports') return json({ ports: [{ path: 'BLE:DEMO:00:11:22:33:44', transport: 'ble', manufacturer: 'HC-08', serialNumber: '', vendorId: '', productId: '' }] });
    if (route === '/api/hardware/connect') { hw.connected = true; hw.path = body.path || hw.path; hw.transport = 'ble'; hw.lastSampleAt = Date.now(); return json(hwState()); }
    if (route === '/api/hardware/disconnect') { hw.connected = false; hw.lastSampleAt = null; studio.action('disconnect'); return json(hwState()); }
    if (route === '/api/hardware/command') {
      const cmd = String(body.command || '').trim();
      const replies = { HELP: '命令: HELP STATUS MODE CALIB LIST SAVE LOAD RECORD', STATUS: '模式: 0=采集', MODE: 'OK', LIST: '（演示模式）模板列表只走 USB 通道' };
      const key = cmd.split(/\s+/)[0].toUpperCase();
      if (!(key in replies)) return json({ error: '未知命令: ' + cmd }, 400);
      return json({ command: key, reply: replies[key], at: Date.now(), capturedValues: [...studio.device.values] });
    }

    if (route === '/api/camera/devices') return json({ devices: [] });

    if (route === '/api/session-log') return json({ error: '在线演示不提供原始日志下载，请在本地工作台导出' }, 404);

    if (route === '/api/sample') {
      if (hw.connected) return json({ error: '演示模式正在接收演示手套数据，不能混入其他采样来源' }, 400);
      studio.ingest(body.values, body.name, body.source); return json({ ok: true });
    }

    if (route === '/api/action') {
      const result = studio.action(body.type, body.payload || {});
      return json(body.type === 'finish' ? result : { ...studio.state(), hardware: hwState() });
    }
    return json({ error: '在线演示未实现该接口：' + route }, 404);
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    const i = url.indexOf('/api/');
    if (i >= 0) return handle(url.slice(i), init);
    return realFetch(input, init);
  };

  // ---------- 把根绝对路径改成子路径（GitHub Pages 子目录部署） ----------
  const fix = v => (v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/api/')) ? SITE + v.slice(1) : v;
  function rewriteNode(el) {
    if (!el || el.nodeType !== 1) return;
    for (const attr of ['src', 'href', 'poster']) {
      const v = el.getAttribute && el.getAttribute(attr);
      if (v && v.startsWith('/') && !v.startsWith('/api/')) el.setAttribute(attr, SITE + v.slice(1));
    }
    if (el.querySelectorAll) el.querySelectorAll('[src],[href],[poster]').forEach(rewriteNode);
  }

  // ---------- 拦截指向本机 4180 服务与 /mobile/ 的链接 ----------
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.includes(':4180') || href === '/mobile/' || href.endsWith('/mobile/')) {
      e.preventDefault();
      location.href = href.includes('/mobile/') ? DEMO + 'mobile/' : SITE;
    }
    if (href.startsWith('/api/session-log')) { e.preventDefault(); alert('在线演示不提供原始日志下载。\n本地工作台运行时可从报告页直接导出本次会话的 jsonl 日志。'); }
  }, true);

  // ---------- 演示横幅 ----------
  function banner() {
    if (document.getElementById('demo-banner')) return;
    const b = document.createElement('div');
    b.id = 'demo-banner';
    b.innerHTML = '<b>在线演示</b><span>界面与业务逻辑为工作台真实代码；手套数据为合成演示数据，非实物采集。报告中 9 份练习记录为团队真实记录。</span><a href="' + SITE + '">返回项目首页</a>';
    document.body.appendChild(b);
  }

  function boot() {
    banner();
    rewriteNode(document.body);
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(rewriteNode))).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
