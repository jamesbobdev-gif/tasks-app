import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Emails James the link to something he chose in the Tasks app: a product to buy ("Choose this"), a
// 3D model to print ("Print this"), or anything else, like a job posting or booking page ("Send me
// link"). Sends via Resend from a neutral address TO his own inbox, so his personal email grants nothing.
// Never places an order or starts a print. Auth = the ?token in the URL
// (the app holds it in its local config). The token and the Resend API key live in the app_secrets
// table (row-level security, service role only), never in the app or this source.

const FROM = "Tasks <onboarding@resend.dev>"; // Resend's shared sender; works for sending to your own account with no domain

const BASE = Deno.env.get("SUPABASE_URL")!;
const SKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function esc(s: unknown): string {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

async function secrets(): Promise<Record<string, string>> {
  const r = await fetch(`${BASE}/rest/v1/app_secrets?name=in.(buy_email_token,resend_api_key,buy_email_to)&select=name,value`, {
    headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` },
  });
  if (!r.ok) return {};
  return Object.fromEntries((await r.json()).map((s: { name: string; value: string }) => [s.name, s.value]));
}
const SECRETS = await secrets();
const FN_TOKEN = SECRETS.buy_email_token || "";
// Optional: his own address (app_secrets row buy_email_to). When it's set, mail only ever goes there,
// whatever the request says, so the token alone can't be used to email anyone else.
const ONLY_TO = (SECRETS.buy_email_to || "").trim().toLowerCase();

// deno-lint-ignore no-explicit-any
function html(b: any): string {
  let site = "the site";
  try { site = new URL(b.url).hostname.replace(/^www\./, ""); } catch (_e) { /* keep default */ }
  const print = b.kind === "print", link = b.kind === "link";
  const meta = [b.price, b.rating].filter(Boolean).map(esc).join(" &middot; ");
  return '<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#161616">' +
    '<h2 style="font-size:18px;margin:0 0 12px">' + esc(b.label) + '</h2>' +
    (b.image && /^https:\/\//i.test(String(b.image)) ? '<img src="' + esc(b.image) + '" alt="" style="max-width:260px;border-radius:10px;border:1px solid #e9e9e5;margin-bottom:12px"><br>' : "") +
    (meta ? '<div style="color:#71716c;margin-bottom:14px">' + meta + '</div>' : "") +
    '<a href="' + esc(b.url) + '" style="display:inline-block;background:#2742c8;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">' +
    (print ? 'Open the model on ' : link ? 'Open on ' : 'Buy on ') + esc(site) + ' &rarr;</a>' +
    (print ? '<p style="color:#5f5f5a;font-size:14px;margin-top:16px">On the page, use <b>Open in Bambu Studio</b> or <b>Print</b> to send it to your printer. On your phone the link opens in Bambu Handy if you have it.</p>' : "") +
    '<p style="color:#9a9a94;font-size:12px;margin-top:20px">' +
    (print ? 'Sent by your Tasks app because you picked this model to print. It never starts a print by itself.'
      : link ? 'Sent by your Tasks app because you asked for this link.'
      : 'Sent by your Tasks app because you chose this item. It never places orders — the purchase is up to you.') +
    '</p></div>';
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (!FN_TOKEN) return new Response("Not configured", { status: 503 });
  if (url.searchParams.get("token") !== FN_TOKEN) return new Response("Not found", { status: 404 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch (_e) { return new Response(JSON.stringify({ error: "bad json" }), { status: 400 }); }
  if (!b || !b.to || !b.url || !b.label) {
    return new Response(JSON.stringify({ error: "need to, label, url" }), { status: 400 });
  }
  if (ONLY_TO && String(b.to).trim().toLowerCase() !== ONLY_TO) {
    return new Response(JSON.stringify({ error: "recipient not allowed" }), { status: 403 });
  }
  if (!/^https?:\/\//i.test(String(b.url))) { // the button's link: web pages only
    return new Response(JSON.stringify({ error: "url must be http(s)" }), { status: 400 });
  }

  const key = Deno.env.get("RESEND_API_KEY") || SECRETS.resend_api_key;
  if (!key) return new Response(JSON.stringify({ error: "no Resend key configured yet" }), { status: 503 });

  const subject = (b.kind === "print" ? "Print: " : b.kind === "link" ? "Link: " : "Buy: ") + String(b.label).slice(0, 180);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: b.to, subject, html: html(b) }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return new Response(JSON.stringify({ error: (data && (data.message || data.name)) || `HTTP ${res.status}` }), { status: 502 });
  }
  return new Response(JSON.stringify({ ok: true, id: data && data.id }), { headers: { "Content-Type": "application/json" } });
});
