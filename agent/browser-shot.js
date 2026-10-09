// A picture of what an agent filled in, for James to look at before he says yes: the whole page of the
// tab that's showing in a worker's browser (Claude's agent browser, or Qwen's on the mini PC via the SSH
// tunnel). Run with the system's Node (it has WebSocket; Electron's built-in Node doesn't); main.js
// copies this file next to the browser tool.
// Usage: node browser-shot.js <port> <out.jpg> [site,site…]   → prints {"ok": true, "url": "…"} or {"ok": false, "why": "…"}
const fs = require('fs');
const [port, out, sites] = process.argv.slice(2);
// with sites: only a tab on one of them (a run can have several forms open; never show the wrong one)
const hosts = String(sites || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
const onSite = (u) => { try { const h = new URL(u).hostname.toLowerCase(); return hosts.some((a) => h === a || h.endsWith('.' + a)); } catch (e) { return false; } };

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = {};
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
    ws.onopen = () => resolve({
      send: (method, params = {}, ms = 15000) => new Promise((res) => {
        const n = ++id; pending[n] = res;
        ws.send(JSON.stringify({ id: n, method, params }));
        setTimeout(() => { if (pending[n]) { delete pending[n]; res({}); } }, ms);
      }),
      close: () => ws.close(),
    });
    ws.onerror = () => reject(new Error('cannot connect'));
  });
}
const value = (r) => r && r.result && r.result.result && r.result.result.value;

async function main() {
  const tabs = (await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(3000) })).json())
    .filter((t) => t.type === 'page' && /^https?:/.test(t.url) && (!hosts.length || onSite(t.url)));
  if (!tabs.length) return { ok: false, why: hosts.length ? 'no tab on ' + hosts.join(', ') : 'no web page open' };
  // the tab in front is the one the worker used (the launcher brings its tab forward before each action)
  let pick = null;
  for (const t of tabs) {
    let c = null;
    try {
      c = await connect(t.webSocketDebuggerUrl);
      if (value(await c.send('Runtime.evaluate', { expression: 'document.visibilityState', returnByValue: true })) === 'visible') { pick = t; break; }
    } catch (e) {} finally { if (c) c.close(); }
  }
  pick = pick || tabs[0];
  const c = await connect(pick.webSocketDebuggerUrl);
  try {
    // a tab that isn't showing isn't drawn, and its picture never comes: make it the browser's current tab
    await c.send('Page.bringToFront');
    const size = value(await c.send('Runtime.evaluate', { returnByValue: true,
      expression: 'JSON.stringify([document.documentElement.clientWidth || innerWidth, Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)])' }));
    const [w, h] = JSON.parse(size || '[1280, 900]');
    // the whole form, but not an endless page: 4000 px tall at most
    const r = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 70, captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: Math.min(w || 1280, 1600), height: Math.min(h || 900, 4000), scale: 1 } }, 30000);
    const data = r.result && r.result.data;
    if (!data) return { ok: false, why: 'the browser gave no picture' };
    fs.writeFileSync(out, Buffer.from(data, 'base64'));
    return { ok: true, url: pick.url };
  } finally { c.close(); }
}

main().then((r) => { process.stdout.write(JSON.stringify(r)); process.exit(0); },
  (e) => { process.stdout.write(JSON.stringify({ ok: false, why: String(e && e.message || e) })); process.exit(0); });
