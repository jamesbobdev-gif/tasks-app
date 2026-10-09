/* How the mini PC's model (a small Qwen) sees and works web pages. Playwright's page snapshots are
   long accessibility trees full of wrapper boxes and repeated labels; a small model loses track in
   them. This turns them into a short, form-first view, fixes the usual small-model slips in browser
   tool calls, and does the bookkeeping a big model would do on its own:
   - outline(snapshot): a popup warning, error messages on the page, which form fields are still empty
     (required ones first), then the page itself with each field's current value
   - fixArgs(name, args, state): `ref` → `target`, refs written without their frame prefix, a field's
     label instead of its ref, select values as a string, fill_form fields without type/name, radios
     "filled" with the option's label, addresses without https://
   - step(browser, name, args, state): one browser tool call; after anything that can change the page
     it looks again by itself (so a step is never spent on browser_snapshot, and refs are never stale),
     and it says when the model repeats itself
   Used by main.js; no Electron here, so it can be tested on its own. */

const REF = /^(?:f\d+)?e\d+$/;
const FIELD_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'listbox', 'spinbutton', 'checkbox', 'radio', 'switch', 'slider']);
const CLICKABLE = new Set(['button', 'link', 'menuitem', 'tab', 'option', 'menuitemcheckbox', 'menuitemradio', 'treeitem']);
const WRAPPERS = new Set(['generic', 'none', 'presentation', 'group', 'list', 'listitem', 'form', 'region', 'article', 'section',
  'table', 'rowgroup', 'row', 'cell', 'gridcell', 'figure', 'blockquote', 'document', 'Iframe', 'iframe', 'separator', 'toolbar', 'search']);
const SITE_CHROME = new Set(['navigation', 'banner', 'contentinfo', 'complementary']);
const POPUPS = new Set(['dialog', 'alertdialog']);
// same words the browser lock refuses until he says yes (agent/browser-proxy.js)
const FINAL = /\b(submit|send|place (your )?order|buy|purchase|pay|check ?out|confirm|book|reserve|apply|sign ?up|register|enroll|delete|remove|unsubscribe|cancel|post|publish|transfer|donate)\b/i;
const PROBLEM = /\b(error|invalid|is required|are required|required field|must be|must contain|try again|not valid|incorrect|failed|too (short|long))\b/i;
// "Please enter…" is a complaint next to a field, but only an instruction at the top of a form
const PLEASE = /\bplease (enter|select|provide|choose|fill|complete|correct)\b/i;
const nextToField = (n) => (n.parent && n.parent.children || []).some((c) => c !== n && FIELD_ROLES.has(c.role));

const unq = (s) => String(s).replace(/\\"/g, '"');
// "Headphone model 7 Headphone model 7" (a picture's alt text + the link's words) → once
const once = (s) => { const t = String(s).trim(), h = t.length / 2; return t.length > 3 && t.length % 2 === 1 && t.slice(0, h - 0.5) === t.slice(h + 0.5) ? t.slice(0, h - 0.5) : t; };
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const bare = (s) => String(s || '').replace(/[*:]/g, '').replace(/\(required\)/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
const isRequired = (name) => /\*|\(required\)/i.test(String(name || ''));

// ---------- snapshot text → tree ----------
function parse(text) {
  const s = String(text || '');
  const page = {
    url: ((s.match(/- Page URL: (.*)/) || [])[1] || '').trim(),
    title: ((s.match(/- Page Title: (.*)/) || [])[1] || '').trim(),
  };
  const root = { role: 'root', children: [], depth: -1 };
  const stack = [root];
  for (const line of s.split('\n')) {
    const m = line.match(/^(\s*)- (.*)$/);
    if (!m || /^- Page (URL|Title)|^- Console:|^- New console/.test(line.trim())) continue;
    const depth = m[1].length / 2;
    const n = node(m[2]);
    if (!n) continue;
    n.depth = depth; n.children = [];
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
    n.parent = stack[stack.length - 1];
    n.parent.children.push(n);
    stack.push(n);
  }
  return { page, root };
}
function node(c) {
  if (c.startsWith('/url:')) return { role: '/url', value: c.slice(5).trim() };
  const m = c.match(/^([\w-]+)(?: "((?:[^"\\]|\\.)*)")?((?: \[[^\]]*\])*)(?::(?: (.*))?)?$/);
  if (!m) return { role: 'text', value: c.replace(/^text:\s*/, '') };
  const attrs = {};
  for (const a of (m[3] || '').matchAll(/\[([^\]=]+)(?:=([^\]]*))?\]/g)) attrs[a[1]] = a[2] == null ? true : a[2];
  let value = m[4] == null ? '' : m[4].trim();
  if (/^".*"$/.test(value)) value = unq(value.slice(1, -1));
  return { role: m[1], name: m[2] == null ? '' : unq(m[2]), attrs, ref: attrs.ref || '', value };
}
function walk(n, fn) { for (const c of n.children || []) { fn(c); walk(c, fn); } }
function textOf(n) { // a node's own words: its name, or its text value
  return n.role === 'text' ? n.value : (n.name || (n.role !== '/url' ? n.value : '') || '');
}
function allText(n, out = []) { const t = textOf(n); if (t) out.push(t); for (const c of n.children || []) allText(c, out); return out; }

// a field's label and current state, as one short line
function fieldValue(n) {
  if (n.role === 'checkbox' || n.role === 'switch') return n.attrs.checked === true || n.attrs.checked === 'true' ? 'checked' : n.attrs.checked === 'mixed' ? 'partly checked' : 'not checked';
  if (n.role === 'radio') return n.attrs.checked === true || n.attrs.checked === 'true' ? 'chosen' : 'not chosen';
  if (n.role === 'combobox' || n.role === 'listbox') {
    const opts = n.children.filter((c) => c.role === 'option');
    if (opts.length) { const sel = opts.filter((o) => o.attrs.selected); return sel.length ? sel.map((o) => '"' + o.name + '"').join(', ') : '(nothing chosen)'; }
  }
  return n.value ? '"' + clip(n.value, 120) + '"' : '(empty)';
}
function isEmpty(n) {
  if (n.role === 'checkbox' || n.role === 'switch' || n.role === 'radio') return false; // judged as a group below
  const v = fieldValue(n);
  if (v === '(empty)' || v === '(nothing chosen)') return true;
  // a dropdown still on its placeholder ("Choose…", "Select one", "--")
  return (n.role === 'combobox' || n.role === 'listbox') && /^"(choose|select|please|pick|--|—|-)/i.test(v);
}
const tag = (n) => '[' + n.ref + ']';

// ---------- tree → the outline the model reads ----------
function outline(snapshot, opts = {}) {
  const max = opts.max || 6000;
  const { page, root } = parse(snapshot);
  const refs = {};
  walk(root, (n) => { if (n.ref) refs[n.ref] = n; });

  const head = [];
  if (page.title || page.url) head.push('Page: ' + (page.title || '(no title)') + (page.url ? '\nURL: ' + page.url : ''));

  // popups sit on top of the page and swallow clicks: name them first, with their buttons
  const popups = [];
  walk(root, (n) => { if (POPUPS.has(n.role) || n.attrs && n.attrs.modal) popups.push(n); });
  for (const p of popups.slice(0, 2)) {
    const btns = []; walk(p, (c) => { if (c.ref && (c.role === 'button' || c.role === 'link') && c.name) btns.push('"' + clip(c.name, 40) + '" ' + tag(c)); });
    head.push('⚠ A popup is open' + (p.name ? ' ("' + clip(p.name, 60) + '")' : '') + ': deal with it before anything else' +
      (btns.length ? '. Its buttons: ' + btns.slice(0, 5).join(', ') : '') + '. Prefer "Reject"/"Close"/"No thanks" for cookie and ad popups.');
  }

  // messages the page is showing (alerts, "this field is required", "invalid email")
  const msgs = [];
  walk(root, (n) => {
    const t = textOf(n);
    if ((n.role === 'alert' || n.role === 'status') && allText(n).join(' ').trim()) msgs.push(allText(n).join(' '));
    else if (t && (PROBLEM.test(t) || (PLEASE.test(t) && nextToField(n))) && !FIELD_ROLES.has(n.role) && !CLICKABLE.has(n.role) && t.length < 200) msgs.push(t);
  });
  const uniq = [...new Set(msgs.map((m) => clip(m.replace(/\s+/g, ' ').trim(), 160)))].filter(Boolean);
  if (uniq.length) head.push('⚠ The page says: ' + uniq.slice(0, 5).map((m) => '"' + m + '"').join(' · '));

  // the form at a glance: filled vs still empty, required first; radios count once per group
  const fields = [];
  const radioGroups = new Map();
  walk(root, (n) => {
    if (!n.ref || !FIELD_ROLES.has(n.role) || n.attrs.disabled) return;
    if (n.role === 'radio') {
      let g = n.parent; while (g && g.role !== 'radiogroup' && !(g.role === 'group' && g.name) && g.role !== 'root') g = g.parent;
      const key = g && g.role !== 'root' ? g : n.parent;
      if (!radioGroups.has(key)) radioGroups.set(key, []);
      radioGroups.get(key).push(n);
      return;
    }
    if (n.role === 'checkbox' || n.role === 'switch') return;
    fields.push({ label: n.name || n.role, ref: n.ref, empty: isEmpty(n), req: isRequired(n.name) });
  });
  for (const [g, radios] of radioGroups) {
    const chosen = radios.some((r) => fieldValue(r) === 'chosen');
    fields.push({ label: g.name || radios.map((r) => r.name).join(' / '), ref: radios[0].ref, empty: !chosen, req: isRequired(g.name) });
  }
  if (fields.length) {
    const empty = fields.filter((f) => f.empty).sort((a, b) => b.req - a.req);
    head.push('Form: ' + fields.length + ' field(s), ' + (fields.length - empty.length) + ' filled.' + (empty.length
      ? ' Still empty: ' + empty.slice(0, 12).map((f) => (f.req ? '⚠' : '') + '"' + clip(f.label, 50) + '" [' + f.ref + ']').join(', ') + (empty.length > 12 ? ', …' : '') +
        (empty.some((f) => f.req) ? '  (⚠ = required)' : '')
      : ' Nothing left empty.'));
  }

  // the page, wrappers removed, labels said once, site menus folded into one line each
  const body = [];
  const render = (n, depth) => {
    const pad = '  '.repeat(Math.min(depth, 6));
    const kids = (n.children || []).filter((c) => c.role !== '/url');
    if (n.role === '/url') return;
    if (SITE_CHROME.has(n.role)) {
      const links = []; walk(n, (c) => { if (c.ref && CLICKABLE.has(c.role) && c.name) links.push(clip(c.name, 30) + ' ' + tag(c)); });
      const fieldsIn = []; walk(n, (c) => { if (c.ref && FIELD_ROLES.has(c.role)) fieldsIn.push(c); });
      const label = { navigation: 'Menu', banner: 'Top bar', contentinfo: 'Footer', complementary: 'Side panel' }[n.role];
      if (links.length) body.push(pad + label + (n.name ? ' "' + clip(n.name, 30) + '"' : '') + ': ' + links.slice(0, 15).join(' · ') + (links.length > 15 ? ' · …' : ''));
      for (const f of fieldsIn) render(f, depth); // e.g. a site search box
      return;
    }
    if (n.role === 'text' || n.role === 'paragraph' || n.role === 'strong' || n.role === 'emphasis' || n.role === 'code' || n.role === 'time' || n.role === 'caption' || n.role === 'term' || n.role === 'definition') {
      const t = textOf(n);
      // a label repeating the field next to it ("First name *" above textbox "First name *")
      const sib = (n.parent && n.parent.children) || [];
      if (t && !sib.some((s) => s !== n && s.name && bare(s.name) === bare(t))) body.push(pad + clip(t.replace(/\s+/g, ' '), 300));
      for (const c of kids) render(c, depth);
      return;
    }
    if (n.role === 'heading') { body.push(pad + '#'.repeat(Math.min(Number(n.attrs.level) || 2, 4)) + ' ' + clip(n.name || allText(n).join(' '), 150)); return; }
    if (n.role === 'img' || n.role === 'image') { if (n.name && n.ref && n.parent && CLICKABLE.has(n.parent.role)) return; if (n.name && n.name.length > 3) body.push(pad + '(image: ' + clip(n.name, 80) + ')'); return; }
    if (FIELD_ROLES.has(n.role)) {
      let line = pad + n.role + ' "' + clip(n.name || '', 80) + '" ' + tag(n) + ' = ' + fieldValue(n);
      const opts = kids.filter((c) => c.role === 'option');
      if (opts.length) line += '  choices: ' + opts.slice(0, 15).map((o) => clip(o.name, 40)).join(' | ') + (opts.length > 15 ? ' | …(' + (opts.length - 15) + ' more)' : '');
      if (n.attrs.disabled) line += ' (disabled)';
      if (isRequired(n.name) && isEmpty(n)) line += '  ⚠ required';
      body.push(line);
      for (const c of kids) if (c.role !== 'option') render(c, depth + 1);
      return;
    }
    if (CLICKABLE.has(n.role) && n.ref) {
      const name = once(n.name || clip(allText(n).join(' '), 80));
      const url = (kids.find((c) => c.role === '/url') || (n.children || []).find((c) => c.role === '/url') || {}).value;
      let line = pad + n.role + ' "' + clip(name, 100) + '" ' + tag(n);
      if (n.role === 'link' && url && !/^(#|javascript:)/.test(url)) line += ' → ' + clip(url, 90);
      if (n.attrs.disabled) line += ' (disabled)';
      if (n.attrs.selected || n.attrs.pressed === true || n.attrs.expanded === true) line += ' (on)';
      if (n.role === 'button' && FINAL.test(name)) line += '  🔒 final step';
      body.push(line);
      return; // a button's or link's insides are its name
    }
    if ((n.role === 'alert' || n.role === 'main' || n.role === 'region') && !allText(n).join('').trim()) return;
    if (POPUPS.has(n.role) || n.role === 'alert' || n.role === 'main' || n.role === 'tabpanel' || n.role === 'menu' || n.role === 'tablist' || ((n.role === 'group' || n.role === 'radiogroup' || n.role === 'form' || n.role === 'region') && n.name)) {
      body.push(pad + (POPUPS.has(n.role) ? 'POPUP ' : '') + n.role + (n.name ? ' "' + clip(n.name, 100) + '"' : '') + ':' + (n.value ? ' ' + clip(n.value.replace(/\s+/g, ' '), 300) : ''));
      for (const c of kids) render(c, depth + 1);
      return;
    }
    if (!WRAPPERS.has(n.role) && n.ref && (n.name || n.value)) body.push(pad + n.role + ' "' + clip(n.name || n.value, 120) + '"');
    else if (n.value && !n.name && !/^\s*$/.test(n.value) && WRAPPERS.has(n.role)) body.push(pad + clip(n.value.replace(/\s+/g, ' '), 300));
    for (const c of kids) render(c, WRAPPERS.has(n.role) ? depth : depth + 1);
  };
  for (const c of root.children) render(c, 0);

  // drop lines that are the same text twice in a row (cards repeat titles in image alt + link)
  const lines = body.filter((l, i) => i === 0 || l.trim() !== body[i - 1].trim());
  let out = head.join('\n') + (head.length ? '\n\n' : '') + lines.join('\n');
  if (out.length > max) {
    const cut = out.slice(0, max);
    out = cut.slice(0, cut.lastIndexOf('\n')) + '\n… (rest of the page cut. Use browser_find with a word to see a part further down)';
  }
  return { text: out || String(snapshot || '').slice(0, 3000), refs, page };
}

// ---------- tidy up a browser tool call before it goes out ----------
function resolveRef(t, state) {
  if (t == null) return t;
  let s = String(t).trim().replace(/^\[|\]$/g, '').replace(/^ref\s*=\s*/i, '');
  const refs = (state && state.refs) || {};
  if (refs[s] || !Object.keys(refs).length) return s;
  if (REF.test(s)) { // "e15" when the page's refs are "f1e15"
    const hit = Object.keys(refs).filter((r) => r.replace(/^f\d+/, '') === s.replace(/^f\d+/, ''));
    if (hit.length === 1) return hit[0];
    return s;
  }
  // a field's label or a button's text instead of its ref
  const want = bare(s.replace(/^(the\s+)?/i, '').replace(/\s+(field|box|button|link|dropdown|checkbox|radio)$/i, ''));
  const nodes = Object.values(refs).filter((n) => n.name);
  const exact = nodes.filter((n) => bare(n.name) === want);
  const pick = exact.length ? exact : nodes.filter((n) => want.length > 2 && bare(n.name).startsWith(want));
  const usable = pick.filter((n) => FIELD_ROLES.has(n.role) || CLICKABLE.has(n.role));
  return (usable.length === 1 ? usable[0] : pick.length === 1 ? pick[0] : null)?.ref || s;
}
function fixArgs(name, args, state) {
  const a = Object.assign({}, args && typeof args === 'object' ? args : {});
  delete a.filename; // never save page output to files
  const refs = (state && state.refs) || {};
  const tgt = (x) => { const t = x.target != null ? x.target : x.ref != null ? x.ref : x.element_ref != null ? x.element_ref : x.id; delete x.ref; delete x.element_ref; if (t != null) x.target = resolveRef(t, state); else if (x.element) x.target = resolveRef(x.element, state); return x; };
  if (name === 'browser_navigate' || (name === 'browser_tabs' && a.url)) {
    if (a.url && !/^[a-z]+:/i.test(String(a.url))) a.url = 'https://' + String(a.url).replace(/^\/+/, '');
    return a;
  }
  if (['browser_click', 'browser_type', 'browser_select_option', 'browser_hover'].includes(name)) {
    tgt(a);
    const n = refs[a.target];
    if (!a.element && n) a.element = (n.role + ' ' + (n.name || '')).trim();
    if (name === 'browser_type') {
      if (a.text == null) a.text = a.value != null ? a.value : a.content != null ? a.content : '';
      delete a.value; delete a.content; a.text = String(a.text);
    }
    if (name === 'browser_select_option') {
      let v = a.values != null ? a.values : a.value != null ? a.value : a.option != null ? a.option : a.label;
      delete a.value; delete a.option; delete a.label;
      v = (Array.isArray(v) ? v : [v]).filter((x) => x != null).map(String);
      // match the page's own spelling of the choice
      const opts = n ? n.children.filter((c) => c.role === 'option').map((o) => o.name) : [];
      a.values = v.map((x) => opts.find((o) => o === x) || opts.find((o) => bare(o) === bare(x)) || opts.find((o) => bare(o).startsWith(bare(x)) && bare(x).length > 1) || x);
    }
    return a;
  }
  if (name === 'browser_fill_form') {
    let fields = a.fields;
    if (fields && !Array.isArray(fields) && typeof fields === 'object') fields = Object.entries(fields).map(([k, v]) => ({ target: k, value: v })); // {label: value}
    a.fields = (Array.isArray(fields) ? fields : []).map((f0) => {
      const f = tgt(Object.assign({}, f0));
      if (f.target == null && f.name) f.target = resolveRef(f.name, state);
      let n = refs[f.target];
      let value = f.value == null ? '' : f.value;
      // a radio "filled" with the choice's text: tick that choice instead
      if ((f.type === 'radio' || (n && (n.role === 'radio' || n.role === 'radiogroup' || n.role === 'group'))) && !/^(true|false)$/i.test(String(value))) {
        const scope = n && (n.role === 'radio' ? n.parent && n.parent.parent || n.parent : n);
        const radios = []; walk(scope || { children: Object.values(refs).filter((r) => !r.parent || r.parent.role === 'root') }, (c) => { if (c.role === 'radio') radios.push(c); });
        const pool = radios.length ? radios : Object.values(refs).filter((r) => r.role === 'radio');
        const hit = pool.find((r) => bare(r.name) === bare(value)) || pool.find((r) => bare(r.name).startsWith(bare(value)) && bare(value).length > 0);
        if (hit) { f.target = hit.ref; n = hit; value = 'true'; f.type = 'radio'; }
      }
      if (typeof value === 'boolean') value = String(value);
      if (n && (n.role === 'checkbox' || n.role === 'switch' || n.role === 'radio')) value = /^(true|yes|y|on|checked|1|x)$/i.test(String(value)) ? 'true' : /^(false|no|n|off|unchecked|0)$/i.test(String(value)) ? 'false' : String(value);
      if (n && (n.role === 'combobox' || n.role === 'listbox')) {
        const opts = n.children.filter((c) => c.role === 'option').map((o) => o.name);
        value = opts.find((o) => o === value) || opts.find((o) => bare(o) === bare(value)) || opts.find((o) => bare(o).startsWith(bare(value)) && bare(value).length > 1) || value;
      }
      const role = n ? n.role : '';
      const type = ['textbox', 'checkbox', 'radio', 'combobox', 'slider'].includes(f.type) ? f.type
        : role === 'searchbox' || role === 'spinbutton' ? 'textbox' : role === 'switch' ? 'checkbox' : role === 'listbox' ? 'combobox'
          : ['textbox', 'checkbox', 'radio', 'combobox', 'slider'].includes(role) ? role : 'textbox';
      return { target: String(f.target || ''), name: String(f.name || f.element || (n && n.name) || f.target || ''), type, value: String(value) };
    });
    return a;
  }
  if (name === 'browser_find') {
    if (a.text == null && a.regex == null) a.text = a.query != null ? a.query : a.word != null ? a.word : '';
    delete a.query; delete a.word;
    return a;
  }
  return a;
}

// ---------- one browser step ----------
// tools after which the page may look different, so we look again for the model
const CHANGES_PAGE = new Set(['browser_navigate', 'browser_navigate_back', 'browser_click', 'browser_type', 'browser_fill_form', 'browser_select_option', 'browser_press_key']);
const firstLines = (s, n) => String(s).split('\n').filter((l) => l.trim() && !/^```|^### (Ran Playwright code|Page|Events)$|^await |^- Page (URL|Title)|^- Console|^- New console|^Call log:|^\s*(\x1b\[\d+m)?\s*- (waiting for|navigating to)/.test(l)).slice(0, n).join('\n');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function look(browser, state, max) {
  let snap = await browser.call('browser_snapshot', {});
  if (/^Refused or failed|^Browser error/.test(snap)) return snap;
  let o = outline(snap, { max });
  // a page still loading shows almost nothing: give it a moment once
  if (Object.keys(o.refs).length < 4) { await wait(1500); snap = await browser.call('browser_snapshot', {}); o = outline(snap, { max }); }
  const moved = state.url && o.page.url && o.page.url !== state.url;
  state.refs = o.refs; state.url = o.page.url || state.url;
  return (moved ? '(now on a different page)\n' : '') + o.text;
}

async function step(browser, name, args0, state, opts = {}) {
  const max = opts.max || 5000;
  // labels and short refs can only be matched against a page we've seen: look once, quietly
  if (!state.refs && name !== 'browser_navigate' && name !== 'browser_snapshot') await look(browser, state, max);
  const args = fixArgs(name, args0, state);
  // the same call again, right after it, never helps a small model
  const sig = name + ' ' + JSON.stringify(args);
  state.recent = (state.recent || []).concat(sig).slice(-3);
  const repeats = state.recent.filter((x) => x === sig).length;

  if (name === 'browser_snapshot') return { args, text: await look(browser, state, max) + (repeats >= 2 ? '\n\n(You already looked at this page and nothing changed. Act on it, or answer.)' : '') };
  let res;
  if (name === 'browser_fill_form' && args.fields.length > 1) {
    // one field at a time: a wrong ref in one field doesn't lose all the others
    const out = [];
    for (const f of args.fields) {
      const r = await browser.call(name, { fields: [f] });
      out.push((/^Refused or failed|^Browser error/.test(r) ? '✗ ' : '✓ ') + '"' + clip(f.name, 50) + '" [' + f.target + ']' +
        (/^Refused or failed|^Browser error/.test(r) ? ': ' + clip(firstLines(r, 3).replace(/^Refused or failed: |### Error\n|Error: (browserBackend\.callTool: )?(Error: )?/g, ''), 160) : ''));
    }
    const bad = out.filter((l) => l.startsWith('✗')).length;
    res = (bad === out.length ? 'Refused or failed: ' : '') + (bad && bad < out.length ? 'Partly done, ' + bad + ' of ' + out.length + ' fields didn\'t work:\n' : '') + out.join('\n');
  } else res = await browser.call(name, args);
  if (name === 'browser_find') {
    if (/^Refused or failed|^Browser error/.test(res)) return { args, text: res.slice(0, 1500) };
    const o = outline(res, { max: 3000 });
    Object.assign(state.refs = state.refs || {}, o.refs);
    return { args, text: o.text.replace(/^Page:[^\n]*\n(URL:[^\n]*\n)?\n?/, '') || 'Not on this page.' };
  }
  const failed = /^Refused or failed|^Browser error/.test(res);
  const locked = /^Refused or failed: (This browser is locked|Locked:)/.test(res);
  const stale = failed && /Ref \S+ not found|not found in the current page snapshot|Invalid arguments/.test(res);
  let text = failed || /^Partly done/.test(res) ? firstLines(res, name === 'browser_fill_form' ? 30 : 4).replace(/### Error\n?|(browserBackend\.callTool: )?Error: /g, '').replace(/\x1b\[\d+m/g, '').slice(0, 1200) : ('Done: ' + (firstLines(res.replace(/^### Result\n/, ''), name === 'browser_fill_form' ? 30 : 3) || name.replace('browser_', '')).slice(0, 400));
  if (stale) text += '\nThat ref isn\'t on the page as it is now. Here is the page now; use only refs shown below.';
  else if (failed && !locked) text += '\nLook at the page below and try another way.';
  if (repeats >= 3) text += '\n(You have done exactly this 3 times. It isn\'t working: try another way, or answer "needs-you" saying what\'s stuck.)';
  if (CHANGES_PAGE.has(name) && !locked) text += '\n\nThe page now:\n' + await look(browser, state, max);
  return { args, text, failed, locked };
}

module.exports = { outline, fixArgs, step, parse, FINAL };
