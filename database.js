// Lightweight JSON file database — drop-in replacement for SQLite during development.
// To migrate to PostgreSQL or SQLite, swap the read/write helpers below.
const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'kingdom.json');

const DEFAULT = {
  users:       [],
  sessions:    [],
  newsletter:  [],
  attendance:  [],
  _seq: { users: 1, sessions: 1, newsletter: 1, attendance: 1 }
};

function load() {
  if (!fs.existsSync(FILE)) return JSON.parse(JSON.stringify(DEFAULT));
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return JSON.parse(JSON.stringify(DEFAULT)); }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function nextId(data, table) {
  const id = data._seq[table]++;
  save(data);
  return id;
}

// ── Bootstrap seed data once ──
let _data = load();
if (_data.sessions.length === 0) {
  const seed = [
    { title: 'The Stillness Within the Storm',  description: 'A guided exploration of inner peace when the world feels overwhelming.', summary: null, meet_link: 'https://meet.google.com/placeholder', recording_link: null, session_date: '2025-06-14 10:00', tier_access: 'Inner Circle', status: 'upcoming', duration: 60 },
    { title: 'Open Community Gathering',          description: 'Monthly open gathering for all members — bring your presence.',        summary: null, meet_link: 'https://meet.google.com/placeholder', recording_link: null, session_date: '2025-06-21 14:00', tier_access: 'All Members',  status: 'upcoming', duration: 90 },
    { title: 'Returning to the Present Moment',  description: 'Embodying presence rather than merely practising it.',                  summary: 'We explored what it means to not just practice presence but to embody it — releasing the habit of living in anticipation and learning to trust the now.', meet_link: '#', recording_link: '#', session_date: '2025-06-07 10:00', tier_access: 'Inner Circle', status: 'past', duration: 60 },
    { title: 'The Language of the Inner Kingdom', description: 'How self-talk shapes the inner world.',                                summary: 'This session uncovered how our self-talk shapes our inner world. We learned to identify critical inner voices and replace them with sovereign, compassionate ones.', meet_link: '#', recording_link: '#', session_date: '2025-05-31 10:00', tier_access: 'Inner Circle', status: 'past', duration: 60 },
    { title: 'Stillness as a Practice, Not a State', description: 'Relating to stillness as a companion, not an achievement.',        summary: 'We moved beyond the idea of stillness as something achieved and began relating to it as a companion — always available, always patient.', meet_link: '#', recording_link: '#', session_date: '2025-05-24 10:00', tier_access: 'All Members', status: 'past', duration: 60 },
  ];
  seed.forEach(s => {
    s.id = nextId(_data, 'sessions');
    s.created_at = new Date().toISOString();
    _data.sessions.push(s);
  });
  save(_data);
}

module.exports = {
  // ── users ──
  findUserByEmail: (email) => load().users.find(u => u.email === email),
  findUserById: (id) => load().users.find(u => u.id === id),
  createUser: ({ name, email, password, tier }) => {
    const data = load();
    const user = { id: nextId(data, 'users'), name, email, password, tier, created_at: new Date().toISOString(), preferences: { sessionReminders: true, membershipUpdates: true } };
    data.users.push(user);
    save(data);
    return user;
  },
  updateUser: (id, fields) => {
    const data = load();
    const idx = data.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    Object.assign(data.users[idx], fields);
    save(data);
    return data.users[idx];
  },

  // ── sessions ──
  getSessions: () => load().sessions,
  getSessionById: (id) => load().sessions.find(s => s.id === id),
  createSession: (fields) => {
    const data = load();
    const session = { id: nextId(data, 'sessions'), ...fields, created_at: new Date().toISOString() };
    data.sessions.push(session);
    save(data);
    return session;
  },
  updateSession: (id, fields) => {
    const data = load();
    const idx = data.sessions.findIndex(s => s.id === id);
    if (idx === -1) return null;
    Object.assign(data.sessions[idx], fields);
    save(data);
    return data.sessions[idx];
  },

  getAllUsers: () => load().users,
  findUserByStripeSubscription: (subId) => load().users.find(u => u.stripeSubscriptionId === subId),

  // ── newsletter ──
  subscribeEmail: (email) => {
    const data = load();
    if (data.newsletter.find(n => n.email === email)) return false;
    data.newsletter.push({ id: nextId(data, 'newsletter'), email, subscribed_at: new Date().toISOString() });
    save(data);
    return true;
  },

  // ── attendance ──
  registerAttendance: (userId, sessionId) => {
    const data = load();
    // Check if already registered
    if (data.attendance.find(a => a.userId === userId && a.sessionId === sessionId)) {
      return data.attendance.find(a => a.userId === userId && a.sessionId === sessionId);
    }
    const att = { id: nextId(data, 'attendance'), userId, sessionId, registered_at: new Date().toISOString() };
    data.attendance.push(att);
    save(data);
    return att;
  },
  getUserAttendance: (userId) => load().attendance.filter(a => a.userId === userId),
  getSessionAttendance: (sessionId) => load().attendance.filter(a => a.sessionId === sessionId),
};
