// Shared look for every KayaCampus email: one table-based HTML shell (inline styles,
// no images, so it renders the same in Gmail, Outlook and phone clients) and a
// plain-text twin built from the same pieces.

const BRAND = "#C56A30";
const INK = "#463C38";
const HEADING = "#3D261B";
const MUTED = "#8C8279";

/** Escapes text for safe use inside HTML (names, replies and hostel names come from users). */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Collapses line breaks so user text can never add a header to the email. */
export const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

export const firstName = (name) => oneLine(name).split(" ")[0] || "";

/** Absolute link back into the app. */
export function appUrl(path = "/") {
  const base = (process.env.CLIENT_URL || (process.env.CORS_ORIGIN || "http://localhost:5173").split(",")[0]).trim().replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const formatMoney = (n) =>
  `GHS ${Number(n).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "12 Jan 2027" (dates are stored as midnight UTC, so format in UTC to avoid a day's shift). */
export function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * @param {object} o
 * @param {string} o.preheader   the grey preview line some inboxes show next to the subject
 * @param {string} o.heading
 * @param {string} [o.greeting]  e.g. "Hi Ama,"
 * @param {string[]} [o.paragraphs]
 * @param {[string, string][]} [o.details]  label / value rows shown in a box
 * @param {string} [o.quote]     the manager's reply, shown as a quote block
 * @param {string} [o.quoteLabel]
 * @param {string[]} [o.steps]   short numbered list ("what happens next")
 * @param {{label: string, url: string}} [o.cta]
 * @param {string} [o.reason]    why they're getting this email
 */
export function renderEmail({ preheader = "", heading, greeting, paragraphs = [], details = [], quote, quoteLabel, steps = [], cta, reason }) {
  const p = (t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK}">${esc(t)}</p>`;

  const detailsHtml = details.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;background:#FBF7F3;border:1px solid #EFE6DD;border-radius:12px"><tr><td style="padding:6px 18px">
${details.map(([k, v], i) => `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:11px 0;${i ? "border-top:1px solid #EFE6DD;" : ""}font-size:13px;color:${MUTED};width:42%;vertical-align:top">${esc(k)}</td><td style="padding:11px 0;${i ? "border-top:1px solid #EFE6DD;" : ""}font-size:14px;font-weight:bold;color:${HEADING};text-align:right;vertical-align:top">${esc(v)}</td></tr></table>`).join("\n")}
</td></tr></table>`
    : "";

  const quoteHtml = quote
    ? `<div style="margin:12px 0 20px">${quoteLabel ? `<p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:${MUTED}">${esc(quoteLabel)}</p>` : ""}<div style="border-left:4px solid ${BRAND};background:#FBF7F3;border-radius:0 12px 12px 0;padding:14px 18px;font-size:15px;line-height:1.6;color:${HEADING};white-space:pre-wrap">${esc(quote)}</div></div>`
    : "";

  const stepsHtml = steps.length
    ? `<p style="margin:6px 0 8px;font-size:13px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:${MUTED}">What happens next</p>
<table cellpadding="0" cellspacing="0" style="margin:0 0 20px">${steps.map((s, i) => `<tr><td style="vertical-align:top;padding:0 12px 10px 0"><div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:#F6E7DB;color:${BRAND};font-size:12px;font-weight:bold;text-align:center">${i + 1}</div></td><td style="padding:2px 0 10px;font-size:14px;line-height:1.55;color:${INK}">${esc(s)}</td></tr>`).join("")}</table>`
    : "";

  const ctaHtml = cta
    ? `<p style="margin:8px 0 22px"><a href="${esc(cta.url)}" style="background:${BRAND};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 28px;border-radius:999px;display:inline-block">${esc(cta.label)}</a></p>
<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${MUTED}">Button not working? Paste this link into your browser:<br><span style="word-break:break-all">${esc(cta.url)}</span></p>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#F8F6F3;font-family:Arial,Helvetica,sans-serif;color:${INK}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F8F6F3">${esc(preheader)}</div>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%">
<tr><td style="padding:0 6px 14px"><span style="font-size:18px;font-weight:bold;color:${BRAND};letter-spacing:-.01em">KayaCampus</span></td></tr>
<tr><td style="background:#ffffff;border-radius:18px;padding:32px 30px;border-top:4px solid ${BRAND}">
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${HEADING}">${esc(heading)}</h1>
${greeting ? p(greeting) : ""}${paragraphs.map(p).join("")}${detailsHtml}${quoteHtml}${stepsHtml}${ctaHtml}
</td></tr>
<tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:${MUTED};text-align:center">${reason ? `${esc(reason)}<br>` : ""}KayaCampus · student housing near campus</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    heading,
    "",
    greeting,
    ...paragraphs.flatMap((t) => [t, ""]),
    ...(details.length ? [...details.map(([k, v]) => `${k}: ${v}`), ""] : []),
    ...(quote ? [quoteLabel ? `${quoteLabel}:` : "", `"${quote}"`, ""] : []),
    ...(steps.length ? ["What happens next:", ...steps.map((s, i) => `${i + 1}. ${s}`), ""] : []),
    ...(cta ? [`${cta.label}: ${cta.url}`, ""] : []),
    reason ?? "",
    "KayaCampus",
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim() + "\n";

  return { html, text };
}
