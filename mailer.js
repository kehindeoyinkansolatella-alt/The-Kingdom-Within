const nodemailer = require('nodemailer');

// Uses Gmail with an App Password (not your main password).
// Steps to get one: Google Account → Security → 2-Step Verification → App passwords → generate one.
// Then put it in .env as GMAIL_APP_PASSWORD.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const FROM = `"Kingdom Within" <${process.env.GMAIL_USER}>`;
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

// Shared email wrapper — warm, branded HTML shell
function wrap(bodyHtml) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; background:#F5EAD8; font-family:'Georgia',serif; }
  .outer { padding: 40px 20px; }
  .card  { max-width: 560px; margin: 0 auto; background: #FDFAF5; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(61,35,20,.12); }
  .header { background: linear-gradient(160deg,#3D2314,#8B6134); padding: 40px 36px; text-align: center; }
  .header h1 { font-family: Georgia,serif; color: #fff; font-size: 1.6rem; margin: 0 0 6px; font-weight: 700; }
  .header p  { color: rgba(255,255,255,.72); font-style: italic; font-size: 1rem; margin: 0; }
  .body  { padding: 36px; color: #3D2314; line-height: 1.8; font-size: 0.95rem; }
  .body h2 { font-family: Georgia,serif; font-size: 1.25rem; color: #3D2314; margin: 0 0 12px; }
  .body p  { margin: 0 0 16px; }
  .btn   { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg,#C9A96E,#A67C4A); color: #fff !important; text-decoration: none; border-radius: 999px; font-family: Arial,sans-serif; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  .footer { background: #F0DFC4; padding: 24px 36px; text-align: center; }
  .footer p { color: #8C6344; font-size: 0.8rem; margin: 0; line-height: 1.7; }
  .footer a { color: #8C6344; }
  .divider { width: 50px; height: 2px; background: linear-gradient(90deg,#C9A96E,#C97B5A); margin: 20px auto; }
</style>
</head>
<body>
<div class="outer">
  <div class="card">
    <div class="header">
      <h1>Kingdom Within</h1>
      <p>A Sacred Community</p>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      <div class="divider"></div>
      <p>
        You are receiving this because you are a member of Kingdom Within.<br>
        <a href="${APP_URL}/dashboard.html">View your dashboard</a> &nbsp;·&nbsp;
        <a href="${APP_URL}">Visit the site</a>
      </p>
    </div>
  </div>
</div>
</body>
</html>`;
}

async function send(to, subject, bodyHtml) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`[Email skipped — no GMAIL credentials] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html: wrap(bodyHtml) });
    console.log(`✉ Email sent → ${to}: ${subject}`);
  } catch (err) {
    console.error(`✉ Email failed → ${to}:`, err.message);
  }
}

// ── Email templates ──

module.exports.sendSessionReminder = (user, session, daysUntil = 1) => {
  const subject = daysUntil === 1
    ? `✦ Reminder: "${session.title}" is tomorrow`
    : `✦ Reminder: "${session.title}" in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;

  const whenText = daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
  const intro = daysUntil === 1 ? '<h2>See you tomorrow ☽</h2>' : `<h2>Reminder — ${whenText}</h2>`;

  const body = `
    ${intro}
    <p>Dear ${user.name},</p>
    <p>This is a gentle reminder that your <strong>${session.tier_access}</strong> session is happening ${whenText}.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#F5EAD8;border-radius:12px;overflow:hidden">
      <tr><td style="padding:14px 18px;font-weight:700;color:#8B6134;width:40%">Session</td><td style="padding:14px 18px">${session.title}</td></tr>
      <tr style="background:#EDD5B0"><td style="padding:14px 18px;font-weight:700;color:#8B6134">Date & Time</td><td style="padding:14px 18px">${session.session_date}</td></tr>
      <tr><td style="padding:14px 18px;font-weight:700;color:#8B6134">Duration</td><td style="padding:14px 18px">${session.duration} minutes</td></tr>
    </table>
    <p style="text-align:center;margin:28px 0">
      <a href="${session.meet_link}" class="btn">${daysUntil === 1 ? 'Join on Google Meet' : 'View session details'}</a>
    </p>
    <p style="color:#9C7060;font-style:italic;font-size:.9rem;text-align:center">
      "Arrive as you are. The kingdom within needs no preparation."
    </p>`;

  return send(user.email, subject, body);
};

module.exports.sendRenewalReminder = (user, daysLeft, expiryDate) => send(
  user.email,
  `✦ Your Kingdom Within membership renews in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
  `<h2>A gentle reminder ✦</h2>
   <p>Dear ${user.name},</p>
   <p>Your <strong>${user.tier}</strong> membership renews on <strong>${new Date(expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong> — that's ${daysLeft} day${daysLeft === 1 ? '' : 's'} from now.</p>
   <p>To keep your access to live sessions, recordings, and session summaries, make sure your payment details are up to date.</p>
   <p style="text-align:center;margin:28px 0">
     <a href="${APP_URL}/dashboard.html" class="btn">Manage My Membership</a>
   </p>
   <p style="color:#9C7060;font-size:.88rem">If you have any questions, reply to this email and we will be with you shortly.</p>`
);

module.exports.sendMembershipExpired = (user) => send(
  user.email,
  `✦ Your Kingdom Within membership has ended`,
  `<h2>We miss you already ☽</h2>
   <p>Dear ${user.name},</p>
   <p>Your <strong>${user.tier}</strong> membership has come to an end. Your access to live sessions, recordings, and summaries has been paused.</p>
   <p>Whenever you feel called to return, we will be here.</p>
   <p style="text-align:center;margin:28px 0">
     <a href="${APP_URL}/index.html#membership" class="btn">Renew My Membership</a>
   </p>
   <p style="color:#9C7060;font-style:italic;font-size:.9rem;text-align:center">
     "The door to the kingdom within is always open."
   </p>`
);

module.exports.sendNewSessionNotice = (user, session) => send(
  user.email,
  `✦ New session added: "${session.title}"`,
  `<h2>A new gathering awaits ✦</h2>
   <p>Dear ${user.name},</p>
   <p>A new session has been added to your calendar. We would love to see you there.</p>
   <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#F5EAD8;border-radius:12px;overflow:hidden">
     <tr><td style="padding:14px 18px;font-weight:700;color:#8B6134;width:40%">Session</td><td style="padding:14px 18px">${session.title}</td></tr>
     <tr style="background:#EDD5B0"><td style="padding:14px 18px;font-weight:700;color:#8B6134">Date & Time</td><td style="padding:14px 18px">${session.session_date}</td></tr>
     <tr><td style="padding:14px 18px;font-weight:700;color:#8B6134">For</td><td style="padding:14px 18px">${session.tier_access}</td></tr>
   </table>
   <p style="text-align:center;margin:28px 0">
     <a href="${APP_URL}/dashboard.html" class="btn">View in Dashboard</a>
   </p>`
);

module.exports.sendBookingConfirmation = (user, slotDetails) => send(
  user.email,
  `✦ Your 1:1 session is confirmed`,
  `<h2>Your session is confirmed ✦</h2>
   <p>Dear ${user.name},</p>
   <p>Your personal 1:1 session has been booked. A calendar invite and Google Meet link will arrive from Calendly shortly.</p>
   <p style="background:#F5EAD8;border-radius:12px;padding:20px;margin:20px 0;font-style:italic;color:#5C3D2E">
     ${slotDetails || 'Check your Calendly confirmation email for the full details and Google Meet link.'}
   </p>
   <p>We look forward to meeting you in that sacred space.</p>
   <p style="text-align:center;margin:28px 0">
     <a href="${APP_URL}/dashboard.html" class="btn">Go to Dashboard</a>
   </p>`
);
