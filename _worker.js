/**
 * Cloudflare Pages – "advanced mode" worker.
 * Obsluhuje jediný koncový bod POST /api/contact (kontaktní formulář).
 * Vše ostatní se předá statickým souborům webu (env.ASSETS).
 *
 * Nastavení (Pages → Settings → Variables and Secrets):
 *   RESEND_API_KEY     (Secret)   API klíč z https://resend.com
 *   MAIL_FROM          (Text)     odesílatel ověřený v Resend, např. "Umění komunikace <web@umenikomunikace.com>"
 *   TURNSTILE_SECRET   (Secret)   tajný klíč Cloudflare Turnstile (volitelné, doporučeno)
 *   ALLOWED_ORIGINS    (Text)     volitelné, čárkou oddělené adresy webu
 */

const RECIPIENTS = [
  'severa.adam@gmail.com',
  'm.severa56@gmail.com',
  'm.severa@seznam.cz',
];

const DEFAULT_ORIGINS = ['https://www.umenikomunikace.com', 'https://umenikomunikace.com'];
const MAX_BODY = 20000;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const oneLine = (s) => String(s).replace(/[\r\n\t]+/g, ' ').trim();

/** Odeslání e-mailu. Funkci lze vyměnit za jiného poskytovatele, zbytek kódu se nemění. */
async function sendMail(env, { subject, text, html, replyTo }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Umění komunikace <web@umenikomunikace.com>',
      to: RECIPIENTS,
      reply_to: replyTo,
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, (await res.text()).slice(0, 500));
    return false;
  }
  return true;
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // ochrana vypnutá
  if (!token) return false;
  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (ip) form.set('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const j = await r.json();
    return j.success === true;
  } catch (e) {
    console.error('Turnstile error', e);
    return false;
  }
}

async function handleContact(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((x) => x.trim()) : DEFAULT_ORIGINS).concat(url.origin);
  if (origin && !allowed.includes(origin)) return json({ ok: false, error: 'origin' }, 403);

  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) return json({ ok: false, error: 'size' }, 413);

  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ ok: false, error: 'size' }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'invalid' }, 400);
  }

  // Past pro roboty: skryté pole musí zůstat prázdné. Robotovi odpovíme "úspěch", aby to nezkoušel dál.
  if (body.website) return json({ ok: true });

  const name = oneLine(body.name || '');
  const email = oneLine(body.email || '');
  const message = String(body.message || '').trim();
  if (!name || name.length > 120) return json({ ok: false, error: 'name' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) return json({ ok: false, error: 'email' }, 400);
  if (message.length > 4000) return json({ ok: false, error: 'message' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!(await verifyTurnstile(env, body.turnstile, ip))) return json({ ok: false, error: 'captcha' }, 400);

  if (!env.RESEND_API_KEY) {
    console.error('Chybí RESEND_API_KEY');
    return json({ ok: false, error: 'config' }, 500);
  }

  const text = `Nová zpráva z webu umenikomunikace.com\n\nJméno: ${name}\nE-mail: ${email}\n\nZpráva:\n${message || '(bez zprávy)'}\n`;
  const html =
    `<p><strong>Nová zpráva z webu umenikomunikace.com</strong></p>` +
    `<p><strong>Jméno:</strong> ${esc(name)}<br><strong>E-mail:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></p>` +
    `<p style="white-space:pre-wrap">${esc(message || '(bez zprávy)')}</p>` +
    `<p style="color:#888;font-size:12px">Odpovědí na tento e-mail odpovíte přímo odesílateli.</p>`;

  const ok = await sendMail(env, { subject: `Nová poptávka z webu: ${name.slice(0, 80)}`, text, html, replyTo: email });
  return ok ? json({ ok: true }) : json({ ok: false, error: 'mail' }, 502);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/contact') {
      if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
      return handleContact(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
