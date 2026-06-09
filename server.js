require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const db      = require('./database');
const mailer  = require('./mailer');

const app    = express();
const PORT   = process.env.PORT   || 3000;
const SECRET = process.env.JWT_SECRET || 'kingdom-within-secret-change-in-production';
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// Stripe — only initialised when keys are present
const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

const PRICE_IDS = {
  'inner-circle': process.env.STRIPE_PRICE_INNER_CIRCLE,
  luminary:       process.env.STRIPE_PRICE_LUMINARY,
};

const TIER_MAP = {
  'inner-circle': 'Inner Circle',
  luminary:       'Luminary',
};

// ── Stripe webhook must receive raw body ──
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth middleware ──
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

const TIER_LEVEL = { Seeker: 0, 'Inner Circle': 1, Luminary: 2 };

// ─────────────────────────────────────
// AUTH
// ─────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, plan } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (db.findUserByEmail(email)) return res.status(409).json({ error: 'Email already registered' });

  const tier = TIER_MAP[plan] || 'Seeker';
  const hash = await bcrypt.hash(password, 10);
  const user = db.createUser({ name, email, password: hash, tier });

  const token = jwt.sign({ id: user.id, name, email, tier }, SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, name, email, tier } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, tier: user.tier }, SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, tier: user.tier } });
});

// ─────────────────────────────────────
// MEMBER
// ─────────────────────────────────────

app.get('/api/me', auth, (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { password: _, ...safe } = user;
  res.json(safe);
});

app.patch('/api/me', auth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  db.updateUser(req.user.id, { name });
  res.json({ success: true });
});

// ─────────────────────────────────────
// STRIPE CHECKOUT
// ─────────────────────────────────────

// Create a Stripe Checkout session and return the URL to redirect to
app.post('/api/checkout', auth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payment processing not configured yet. Add Stripe keys to .env' });

  const { plan } = req.body; // 'inner-circle' | 'luminary'
  const priceId = PRICE_IDS[plan];
  if (!priceId) return res.status(400).json({ error: 'Invalid plan' });

  const user = db.findUserById(req.user.id);

  try {
    const session = await stripe.checkout.sessions.create({
      mode:                 'subscription',
      payment_method_types: ['card'],
      customer_email:       user.email,
      metadata:             { userId: String(user.id), plan },
      line_items: [{
        price:    priceId,
        quantity: 1,
      }],
      subscription_data: {
        metadata: { userId: String(user.id), plan },
      },
      success_url: `${APP_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${APP_URL}/index.html#membership`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Redirect shortcut: GET /checkout?plan=inner-circle (for use from landing page)
app.get('/checkout', auth, async (req, res) => {
  const { plan } = req.query;
  if (!stripe) return res.redirect(`/signup.html?plan=${plan}`);
  const priceId = PRICE_IDS[plan];
  if (!priceId) return res.redirect('/index.html#membership');

  const user = db.findUserById(req.user.id);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', payment_method_types: ['card'],
      customer_email: user.email,
      metadata: { userId: String(user.id), plan },
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { userId: String(user.id), plan } },
      success_url: `${APP_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${APP_URL}/index.html#membership`,
    });
    res.redirect(303, session.url);
  } catch (err) {
    res.redirect('/index.html#membership');
  }
});

// ─────────────────────────────────────
// STRIPE WEBHOOK
// ─────────────────────────────────────

app.post('/api/stripe/webhook', (req, res) => {
  if (!stripe) return res.sendStatus(200);

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  const data = event.data.object;

  switch (event.type) {
    // Payment succeeded → activate / renew membership
    case 'invoice.payment_succeeded': {
      const meta = data.subscription_details?.metadata || {};
      const userId = Number(meta.userId);
      const plan   = meta.plan;
      if (!userId || !plan) break;

      const tier    = TIER_MAP[plan] || 'Inner Circle';
      const expires = new Date();
      expires.setDate(expires.getDate() + 32); // 30 days + 2 buffer

      db.updateUser(userId, {
        tier,
        membershipActive:    true,
        membershipExpiresAt: expires.toISOString(),
        stripeSubscriptionId: data.subscription,
      });
      console.log(`✦ Membership renewed for user ${userId} (${tier}) until ${expires.toDateString()}`);
      break;
    }

    // First successful checkout
    case 'checkout.session.completed': {
      const userId = Number(data.metadata?.userId);
      const plan   = data.metadata?.plan;
      if (!userId || !plan) break;

      const tier    = TIER_MAP[plan] || 'Inner Circle';
      const expires = new Date();
      expires.setDate(expires.getDate() + 32);

      db.updateUser(userId, {
        tier,
        membershipActive:    true,
        membershipExpiresAt: expires.toISOString(),
        stripeCustomerId:    data.customer,
        stripeSubscriptionId: data.subscription,
      });
      console.log(`✦ New ${tier} member: user ${userId}`);
      break;
    }

    // Subscription cancelled or payment definitively failed → lock access
    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      const subId = data.id || data.subscription;
      const user  = db.findUserByStripeSubscription(subId);
      if (user) {
        db.updateUser(user.id, { membershipActive: false });
        console.log(`✦ Membership deactivated for user ${user.id}`);
      }
      break;
    }
  }

  res.sendStatus(200);
});

// ─────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────

app.get('/api/sessions', auth, (req, res) => {
  const level = TIER_LEVEL[req.user.tier] ?? 0;
  const all   = db.getSessions().filter(s => {
    if (s.tier_access === 'All Members')  return true;
    if (s.tier_access === 'Inner Circle') return level >= 1;
    if (s.tier_access === 'Luminary')     return level >= 2;
    return false;
  });
  res.json(all.sort((a, b) => new Date(b.session_date) - new Date(a.session_date)));
});

app.post('/api/sessions', auth, async (req, res) => {
  const session = db.createSession({ ...req.body, tier_access: req.body.tier_access || 'All Members', status: req.body.status || 'upcoming' });

  // Notify all eligible members about the new session
  const tierLevel = { Seeker: 0, 'Inner Circle': 1, Luminary: 2 };
  const required  = tierLevel[session.tier_access] ?? 0;
  const eligible  = db.getSessions && db.getAllUsers
    ? db.getAllUsers().filter(u => (tierLevel[u.tier] ?? 0) >= required)
    : [];
  for (const user of eligible) {
    await mailer.sendNewSessionNotice(user, session);
  }

  res.json(session);
});

app.patch('/api/sessions/:id', auth, (req, res) => {
  const updated = db.updateSession(Number(req.params.id), req.body);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ─────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────

// Register attendance for a session
app.post('/api/attendance/:sessionId', auth, (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const session = db.getSessionById(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const attendance = db.registerAttendance(req.user.id, sessionId);
  res.json(attendance);
});

// Get user's attendance records
app.get('/api/attendance', auth, (req, res) => {
  const records = db.getUserAttendance(req.user.id);
  res.json(records);
});

// ─────────────────────────────────────
// NEWSLETTER
// ─────────────────────────────────────

app.post('/api/newsletter', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  db.subscribeEmail(email);
  res.json({ success: true });
});

// ─────────────────────────────────────
// PUBLIC CONFIG
// ─────────────────────────────────────

app.get('/api/config', (_req, res) => {
  res.json({
    calendlyUrl: process.env.CALENDLY_URL || 'https://calendly.com/your-username/1-1',
  });
});

// ─────────────────────────────────────
// Runs once per day at 08:00 — sends session reminders and renewal warnings
// ─────────────────────────────────────

function runDailyEmailJobs() {
  const users    = db.getAllUsers();
  const sessions = db.getSessions();
  const now      = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (const user of users) {
    // Session reminders — 24h before each upcoming session
    sessions
      .filter(s => s.status === 'upcoming' && s.meet_link)
      .forEach(s => {
        const sessionDate = new Date(s.session_date);
        const hoursUntil  = (sessionDate - now) / 36e5;
        if (hoursUntil >= 20 && hoursUntil <= 26) {
          const tierLevel = { Seeker: 0, 'Inner Circle': 1, Luminary: 2 };
          const required  = tierLevel[s.tier_access] ?? 0;
          if ((tierLevel[user.tier] ?? 0) >= required) {
            mailer.sendSessionReminder(user, s);
          }
        }
      });

    // Membership renewal reminders — 7 days and 1 day before expiry
    if (user.tier !== 'Seeker' && user.membershipExpiresAt) {
      const exp      = new Date(user.membershipExpiresAt);
      const daysLeft = Math.ceil((exp - now) / 864e5);
      if (daysLeft === 7 || daysLeft === 1) {
        mailer.sendRenewalReminder(user, daysLeft, user.membershipExpiresAt);
      }
      // Expired today — send expiry notice
      if (daysLeft === 0 && now.toDateString() === exp.toDateString()) {
        mailer.sendMembershipExpired(user);
      }
    }
  }
}

// Schedule daily job at 08:00
function scheduleDailyAt8() {
  const now     = new Date();
  const next8   = new Date(now);
  next8.setHours(8, 0, 0, 0);
  if (next8 <= now) next8.setDate(next8.getDate() + 1);
  const msUntil = next8 - now;
  setTimeout(() => {
    runDailyEmailJobs();
    setInterval(runDailyEmailJobs, 24 * 60 * 60 * 1000);
  }, msUntil);
  console.log(`  ✦ Email scheduler set — next run at ${next8.toLocaleTimeString()}`);
}

// ─────────────────────────────────────
// SPA FALLBACK
// ─────────────────────────────────────

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n  ✦ Kingdom Within running at ${APP_URL}\n`);
  scheduleDailyAt8();
});
