export const fingerNames = ['拇指', '食指', '中指', '无名指', '小指'];
export const fingerColors = ['#c56a46', '#dca24b', '#4f886d', '#6797b6', '#a280ac'];
export function normalizeHost(value, native = false) {
  let text = String(value || '').trim();
  if (!text) throw Error('请填写电脑工作台的局域网地址');
  if (!/^https?:\/\//i.test(text)) text = 'http://' + text;
  let url; try { url = new URL(text); } catch { throw Error('地址格式不正确，例如 192.168.1.20:4180'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw Error('请只填写电脑的 HTTP 或 HTTPS 地址和端口');
  if (native && ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname)) throw Error('手机上不能使用 localhost，请填写电脑的局域网 IP');
  if (!url.port) url.port = '4180';
  return url.origin;
}
export function validateState(s) {
  if (!s || !Array.isArray(s.reports) || !Array.isArray(s.templates) || !s.device || typeof s.device.connected !== 'boolean' || !s.settings || typeof s.settings.learner !== 'string' || !s.feedback || !Array.isArray(s.samples)) throw Error('这个地址没有返回非遗之手工作台数据，请检查地址和端口');
  return s;
}
export const fmt = (seconds = 0) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
export const date = t => new Date(t).toLocaleString('zh-CN', {month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
export function snapshot(state, host, now = Date.now()) {
  return {host, savedAt:now, learner:state.settings.learner, reports:state.reports.slice(0, 50), templates:state.templates, calibration:state.calibration};
}
export function isLive(connected, lastSync, now = Date.now()) { return !!connected && lastSync > 0 && now - lastSync < 3500; }
export function reportText(r) {
  return `非遗之手 · ${r.lesson}\n${date(r.startedAt)}\n练习时长：${fmt(r.duration)}\n采集帧数：${r.sampleCount}\n姿态匹配：${r.matches} 次\n${r.notes || ''}\n匹配来自五指传感器与参考姿态的比较，不代表陶艺专业评分。`;
}
// Writes are never retried: a timed-out command may have reached the computer.
export function makeClient(transport, host) {
  return async (path, body) => {
    let r;
    try { r = await transport(host + path, body); }
    catch (e) { throw Error(body ? '未收到操作结果，操作可能已生效。请恢复连接并查看当前状态，不要重复提交。' : '无法连接电脑，请确认同一 Wi-Fi、工作台已启动，且防火墙允许局域网访问'); }
    if (r.status < 200 || r.status >= 300) throw Error(r.data?.error || '电脑工作台拒绝了请求');
    return r.data;
  };
}
