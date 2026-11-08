import nodemailer from "nodemailer";

// Sends transactional email over SMTP (any provider: Brevo, SendGrid, Gmail app
// password, Mailgun...). Configure with SMTP_HOST / SMTP_PORT / SMTP_USER /
// SMTP_PASS and MAIL_FROM. Without SMTP_HOST nothing is sent: in development the
// link is printed to the server console so the flow can still be tested; in
// production a warning is logged and the token is NEVER written to the logs.

let transport;
const smtpConfigured = () => !!process.env.SMTP_HOST;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** @returns {Promise<{ sent: boolean }>} */
export async function sendMail({ to, subject, text, html, devNote }) {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error(`[Mailer] SMTP is not configured: could not send "${subject}" to ${to}`);
    } else {
      console.log(`[Mailer] SMTP not configured (dev). "${subject}" for ${to}${devNote ? `\n${devNote}` : ""}`);
    }
    return { sent: false };
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || "KayaCampus <no-reply@kayacampus.com>",
    to, subject, text, html,
  });
  return { sent: true };
}

/** The "reset your password" email. The link is single-use and expires. */
export function passwordResetEmail({ name, url, expiresInMinutes = 60 }) {
  const who = name ? ` ${name.split(" ")[0]}` : "";
  const subject = "Reset your KayaCampus password";
  const text =
    `Hi${who},\n\nWe got a request to reset your KayaCampus password. Open this link to choose a new one ` +
    `(it expires in ${expiresInMinutes} minutes and works once):\n\n${url}\n\n` +
    `If you didn't ask for this, you can ignore this email. Your password stays the same.\n`;
  const html = `<!doctype html><html><body style="margin:0;background:#F8F6F3;font-family:Arial,Helvetica,sans-serif;color:#463C38">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:16px;padding:32px">
<tr><td><h1 style="margin:0 0 16px;font-size:22px;color:#3D261B">Reset your password</h1>
<p style="font-size:15px;line-height:1.5">Hi${escapeHtml(who)},</p>
<p style="font-size:15px;line-height:1.5">We got a request to reset your KayaCampus password. The link below expires in ${expiresInMinutes} minutes and works once.</p>
<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#C56A30;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:999px;display:inline-block">Choose a new password</a></p>
<p style="font-size:13px;color:#8C8279;line-height:1.5">If the button doesn't work, paste this into your browser:<br><span style="word-break:break-all">${escapeHtml(url)}</span></p>
<p style="font-size:13px;color:#8C8279;line-height:1.5">If you didn't ask for this, ignore this email. Your password stays the same.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
