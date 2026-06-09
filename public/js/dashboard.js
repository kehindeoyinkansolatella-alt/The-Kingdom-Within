// ── Utilities ──
const API_BASE = '/api';
const get = (id) => document.getElementById(id);
const set = (id, val) => { const el = get(id); if (el) el.textContent = val; };

function getToken() {
  const session = JSON.parse(localStorage.getItem('kw_session') || '{}');
  return session.token || localStorage.getItem('kw_token');
}

function apiCall(endpoint, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(API_BASE + endpoint, { ...opts, headers });
}

// ── Parse session date from API format "2025-06-14 10:00" ──
function parseSessionDate(dateStr) {
  const [date, time] = dateStr.split(' ');
  const [year, month, day] = date.split('-');
  const [hour, min] = time.split(':');

  const d = new Date(year, Number(month) - 1, day, hour, min);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = months[d.getMonth()];
  const ampm = d.getHours() < 12 ? 'AM' : 'PM';
  const displayHour = d.getHours() % 12 || 12;
  
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: monthStr,
    date: `${d.getDate()} ${monthStr} ${year}`,
    time: `${String(displayHour).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${ampm} GMT`,
    epoch: d.getTime()
  };
}

// ── Session card builder ──
const MEET_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`;

function isMembershipActive(user) {
  if (user.tier === 'Seeker') return true;
  if (!user.membershipExpiresAt) return true;
  return new Date() <= new Date(user.membershipExpiresAt);
}

function sessionCard(s, user, showRecording = false) {
  const active = isMembershipActive(user);
  const isSeeker = user.tier === 'Seeker';
  const parsed = parseSessionDate(s.session_date);

  const meetBtn = () => {
    if (s.status !== 'upcoming' || !s.meet_link) return '';
    if (!active) return lockedBtn('Renew to join live');
    if (isSeeker && s.tier_access !== 'All Members') return lockedBtn('Inner Circle & above');
    return `<a href="${s.meet_link}" class="meet-btn" target="_blank" rel="noopener">${MEET_ICON} Join on Google Meet</a>`;
  };

  const recBtn = () => {
    if (!showRecording && s.status !== 'past') return '';
    if (!s.recording_link || s.recording_link === '#') return '';
    if (!active) return lockedBtn('Renew to watch recording');
    if (isSeeker && s.tier_access !== 'All Members') return lockedBtn('Inner Circle & above');
    return `<a href="${s.recording_link}" class="meet-btn" style="background:linear-gradient(135deg,var(--gold-400),var(--gold-500))" target="_blank" rel="noopener">▶ Watch Recording</a>`;
  };

  return `
    <div class="session-item">
      <div class="date-badge">
        <div class="day">${parsed.day}</div>
        <div class="month">${parsed.month}</div>
      </div>
      <div class="session-info">
        <h4>${s.title}</h4>
        <p class="sdesc">${parsed.time} · ${s.duration || 60} min · ${s.tier_access}</p>
        <div class="session-tags">
          ${s.status === 'upcoming' ? '<span class="tag tag-live">● Live</span>' : '<span class="tag tag-rec">Recorded</span>'}
          ${s.summary ? '<span class="tag tag-sum">📝 Summary</span>' : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${meetBtn()}
          ${recBtn()}
        </div>
      </div>
    </div>`;
}

function lockedBtn(label) {
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:7px 13px;background:var(--bg2);border-radius:var(--rfull);font-size:.76rem;font-weight:700;color:var(--textmuted);cursor:not-allowed;border:1px solid var(--border)">🔒 ${label}</span>`;
}

// ── Apply user info ──
function applyUser(user) {
  const initial = (user.name || 'M')[0].toUpperCase();
  ['sidebarAvatar', 'profileAvatar'].forEach(id => { 
    const el = get(id); 
    if (el) el.textContent = initial; 
  });
  set('sidebarName', user.name);
  set('sidebarTier', user.tier);
  set('profileName', user.name);
  set('profileTier', user.tier);

  const nameInput = get('profileNameInput');
  const emailInput = get('profileEmailInput');
  const joinedInput = get('profileJoined');
  if (nameInput) nameInput.value = user.name || '';
  if (emailInput) emailInput.value = user.email || '';
  if (joinedInput) {
    const joined = user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Recently';
    joinedInput.value = joined;
    set('profileJoinedShort', `Joined ${joined}`);
  }

  // Account activity
  const now = new Date();
  const created = user.created_at ? new Date(user.created_at) : new Date();
  const daysActive = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  set('profileDaysActive', `${daysActive} day${daysActive === 1 ? '' : 's'} active`);
  set('lastSignIn', `Just now`);

  // Member status
  let status = 'Active';
  let statusColor = 'var(--gold-400)';
  if (user.tier === 'Seeker') {
    status = 'Seeker (Free)';
    statusColor = 'var(--text2)';
  }
  const memberStatusEl = get('memberStatus');
  if (memberStatusEl) {
    memberStatusEl.textContent = status;
    memberStatusEl.style.color = statusColor;
  }

  // Membership info
  const priceMap = { Seeker: 'Free', 'Inner Circle': '£29 / month', Luminary: '£79 / month' };
  set('membershipTierDisplay', user.tier);
  set('membershipPriceDisplay', priceMap[user.tier] || 'Free');

  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user.name?.split(' ')[0] || 'there';
  set('panelTitle', `${greet} ${firstName} ☽`);
}

// ── Render panels ──
async function renderSessions(sessions, user) {
  const sesContainer = get('allSessions');
  if (!sesContainer) return;

  const upcoming = sessions.filter(s => s.status === 'upcoming').sort((a, b) => parseSessionDate(a.session_date).epoch - parseSessionDate(b.session_date).epoch);
  const past = sessions.filter(s => s.status === 'past').sort((a, b) => parseSessionDate(b.session_date).epoch - parseSessionDate(a.session_date).epoch);

  let html = '';
  if (upcoming.length) {
    html += `<p style="font-size:.78rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--gold-400);margin-bottom:12px">Upcoming</p>`;
    html += upcoming.map(s => sessionCard(s, user)).join('');
  }
  if (past.length) {
    html += `<p style="font-size:.78rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--textmuted);margin:24px 0 12px">Past Sessions</p>`;
    html += past.map(s => sessionCard(s, user, true)).join('');
  }
  sesContainer.innerHTML = html || '<p style="color:var(--textmuted);font-size:.88rem">No sessions scheduled yet.</p>';
}

async function renderLibrary(sessions, user) {
  const libContainer = get('libraryItems');
  if (!libContainer) return;

  const withRecordings = sessions.filter(s => s.status === 'past' && s.recording_link && s.recording_link !== '#')
    .sort((a, b) => parseSessionDate(b.session_date).epoch - parseSessionDate(a.session_date).epoch);

  libContainer.innerHTML = withRecordings.length
    ? withRecordings.map(s => {
        const parsed = parseSessionDate(s.session_date);
        return `
          <div class="session-item">
            <div class="date-badge">
              <div class="day">${parsed.day}</div>
              <div class="month">${parsed.month}</div>
            </div>
            <div class="session-info">
              <h4>${s.title}</h4>
              <p class="sdesc">${parsed.date} · ${s.duration || 60} min · ${s.tier_access}</p>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
                ${isMembershipActive(user) && (user.tier !== 'Seeker' || s.tier_access === 'All Members')
                  ? `<a href="${s.recording_link}" class="meet-btn" style="background:linear-gradient(135deg,var(--gold-400),var(--gold-500))" target="_blank" rel="noopener">▶ Watch Recording</a>`
                  : lockedBtn(user.tier === 'Seeker' ? 'Inner Circle & above' : 'Renew to access')}
                ${s.summary ? `<span class="tag tag-sum" style="cursor:pointer" onclick="showPanel('summaries')">📝 Read Summary</span>` : ''}
              </div>
            </div>
          </div>`;
      }).join('')
    : '<p style="color:var(--textmuted);font-size:.88rem">No archived sessions yet.</p>';
}

async function renderSummaries(sessions, user) {
  const sumContainer = get('allSummaries');
  if (!sumContainer) return;

  const withSummaries = sessions.filter(s => s.summary)
    .sort((a, b) => parseSessionDate(b.session_date).epoch - parseSessionDate(a.session_date).epoch);

  sumContainer.innerHTML = withSummaries.length
    ? withSummaries.map(s => {
        const parsed = parseSessionDate(s.session_date);
        return `
          <div class="summary-item">
            <h4>${s.title}</h4>
            <p>${s.summary}</p>
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:10px">
              <div class="summary-date">${parsed.date}</div>
              ${s.recording_link && isMembershipActive(user) && (user.tier !== 'Seeker' || s.tier_access === 'All Members')
                ? `<a href="${s.recording_link}" class="meet-btn" style="font-size:.76rem;background:linear-gradient(135deg,var(--gold-400),var(--gold-500))" target="_blank">▶ Watch Session</a>`
                : s.recording_link ? lockedBtn('Renew to watch') : ''}
            </div>
          </div>`;
      }).join('')
    : '<p style="color:var(--textmuted);font-size:.88rem">No session summaries yet.</p>';
}

async function renderHome(sessions, user) {
  const upcoming = sessions.filter(s => s.status === 'upcoming')
    .sort((a, b) => parseSessionDate(a.session_date).epoch - parseSessionDate(b.session_date).epoch)
    .slice(0, 3);
  const past = sessions.filter(s => s.status === 'past')
    .sort((a, b) => parseSessionDate(b.session_date).epoch - parseSessionDate(a.session_date).epoch);

  const uContainer = get('upcomingSessions');
  if (uContainer) {
    uContainer.innerHTML = upcoming.length
      ? upcoming.map(s => sessionCard(s, user)).join('')
      : `<p style="color:var(--textmuted);font-size:.88rem;padding:20px 0">No upcoming sessions scheduled yet. Check back soon.</p>`;
  }

  const sContainer = get('recentSummaries');
  if (sContainer) {
    const recent = past.filter(s => s.summary).slice(0, 3);
    sContainer.innerHTML = recent.map(s => {
        const parsed = parseSessionDate(s.session_date);
        return `
          <div class="summary-item">
            <h4>${s.title}</h4>
            <p>${s.summary}</p>
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:8px">
              <div class="summary-date">${parsed.date}</div>
              ${s.recording_link && isMembershipActive(user) && (user.tier !== 'Seeker' || s.tier_access === 'All Members')
                ? `<a href="${s.recording_link}" class="meet-btn" style="font-size:.72rem;padding:5px 11px;background:linear-gradient(135deg,var(--gold-400),var(--gold-500))" target="_blank">▶ Watch</a>`
                : s.recording_link ? lockedBtn('Renew to watch') : ''}
            </div>
          </div>`;
      }).join('');
  }

  // Stats
  set('statAttended', past.length);
  set('statSummaries', past.filter(s => s.summary).length);
  set('statTier', user.tier);
  if (upcoming.length) {
    const next = upcoming[0];
    const parsed = parseSessionDate(next.session_date);
    set('statNext', `${parsed.day} ${parsed.month}`);
    set('statNextSub', next.title);
  }

  // Membership expiry
  const banner = get('expiryBanner');
  if (banner && user.tier !== 'Seeker' && user.membershipExpiresAt) {
    const expiry = new Date(user.membershipExpiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    if (now > expiry) {
      banner.style.display = 'block';
      banner.innerHTML = `
        <div style="background:linear-gradient(135deg,#8B3A2E,#6B2A1E);border-radius:var(--r2);padding:18px 24px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <p style="color:#fff;font-weight:700;margin-bottom:4px">⚠ Your membership expired on ${expiry.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</p>
            <p style="color:rgba(255,255,255,.75);font-size:.85rem">Renew your membership to continue accessing live sessions and recordings.</p>
          </div>
          <a href="index.html#membership" class="btn btn-primary" style="padding:10px 22px;font-size:.8rem;flex-shrink:0">Renew Membership</a>
        </div>`;
    } else if (daysLeft <= 7) {
      banner.style.display = 'block';
      banner.innerHTML = `
        <div style="background:linear-gradient(135deg,var(--gold-400),var(--gold-500));border-radius:var(--r2);padding:16px 24px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <p style="color:#fff;font-size:.9rem">✦ Your membership renews in <strong>${daysLeft} day${daysLeft===1?'':'s'}</strong> — make sure your payment is up to date to keep your access.</p>
          <a href="index.html#membership" style="color:#fff;font-size:.82rem;font-weight:700;text-decoration:underline;white-space:nowrap">Manage →</a>
        </div>`;
    }
  }
}

// ── Panel navigation ──
function showPanel(name) {
  document.querySelectorAll('[id^="panel-"]').forEach(p => p.style.display = 'none');
  const el = get('panel-' + name);
  if (el) el.style.display = '';
  document.querySelectorAll('.slink').forEach(l => l.classList.remove('active'));
  document.querySelector(`.slink[data-panel="${name}"]`)?.classList.add('active');
  
  const titles = {
    home:       ['Your Dashboard',        'Welcome back to your sacred space.'],
    sessions:   ['Live Sessions',          'Upcoming gatherings and past recordings.'],
    library:    ['Session Library',        'Revisit every teaching at your own pace.'],
    summaries:  ['Session Summaries',      'Written wisdom from every gathering.'],
    book:       ['Book Your 1:1 Session',  'Schedule a personal coaching call.'],
    profile:    ['My Profile',             'Manage your account details.'],
    membership: ['My Membership',          'Your current plan and upgrade options.'],
  };
  const [title, sub] = titles[name] || ['Dashboard', ''];
  set('panelTitle', title);
  set('panelSub', sub);
  get('dashMain')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindSidebarLinks() {
  document.querySelectorAll('.slink[data-panel]').forEach(link => {
    link.addEventListener('click', () => {
      showPanel(link.dataset.panel);
      get('sidebar')?.classList.remove('open');
    });
  });
}

// ── Save profile ──
async function saveProfile() {
  const nameInput = get('profileNameInput');
  const newName = nameInput?.value.trim();
  if (!newName) {
    showDashToast('Please enter a name.');
    return;
  }

  const saveBtn = event?.target;
  if (saveBtn) saveBtn.textContent = 'Saving…';

  try {
    const res = await apiCall('/me', {
      method: 'PATCH',
      body: JSON.stringify({ name: newName })
    });
    if (res.ok) {
      const userRes = await apiCall('/me');
      if (userRes.ok) {
        const user = await userRes.json();
        localStorage.setItem('kw_session', JSON.stringify({ ...JSON.parse(localStorage.getItem('kw_session') || '{}'), ...user }));
        applyUser(user);
        showDashToast('✓ Profile updated successfully.');
      }
    } else {
      showDashToast('Error saving profile. Please try again.');
    }
  } catch (err) {
    console.error('Save profile error:', err);
    showDashToast('Connection error. Please try again.');
  } finally {
    if (saveBtn) saveBtn.textContent = 'Save Changes';
  }
}

function resetProfile() {
  const session = JSON.parse(localStorage.getItem('kw_session') || '{}');
  const nameInput = get('profileNameInput');
  if (nameInput) nameInput.value = session.name || '';
  showDashToast('Changes discarded.');
}

async function savePreferences() {
  const sessionReminders = get('prefSessionReminders')?.checked;
  const membershipUpdates = get('prefMembershipUpdates')?.checked;
  
  const prefs = {
    sessionReminders: sessionReminders ?? true,
    membershipUpdates: membershipUpdates ?? true,
  };
  
  localStorage.setItem('kw_preferences', JSON.stringify(prefs));
  showDashToast('✓ Preferences saved.');
}

function loadPreferences() {
  const prefs = JSON.parse(localStorage.getItem('kw_preferences') || '{"sessionReminders":true,"membershipUpdates":true}');
  const remEl = get('prefSessionReminders');
  const memEl = get('prefMembershipUpdates');
  if (remEl) remEl.checked = prefs.sessionReminders !== false;
  if (memEl) memEl.checked = prefs.membershipUpdates !== false;
}

function initiateAccountDeletion() {
  const session = JSON.parse(localStorage.getItem('kw_session') || '{}');
  if (!session.email) return;
  
  const confirmed = confirm(
    `You are about to permanently delete your ${session.tier} membership and all associated data.\n\n` +
    `This action CANNOT be undone.\n\n` +
    `If you are sure, please reply to this alert with your email: ${session.email}`
  );
  
  if (confirmed) {
    showDashToast('⚠ Please contact support@kingdomwithin.com to confirm account deletion.');
  }
}

// ── Booking tier gating ──
async function gateBookingByTier(user) {
  const bookLink = get('bookLink');
  const bookContent = get('bookingContent');
  if (!bookLink || !bookContent) return;

  if (user.tier === 'Seeker') {
    bookLink.style.display = 'none';
    return;
  }

  let calendlyUrl = 'https://calendly.com/your-username/1-1';
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    calendlyUrl = cfg.calendlyUrl || calendlyUrl;
  } catch (err) {
    console.log('Could not fetch Calendly URL, using default');
  }

  bookContent.innerHTML = `
    <p style="color:var(--textmuted);font-size:.92rem;margin-bottom:20px;line-height:1.7">
      Your personal 1:1 coaching session is a sacred space — 50 minutes to explore, refine, and deepen your inner practice. Sessions are scheduled via Calendly below.
    </p>
    <div style="height:700px;border-radius:12px;overflow:hidden;box-shadow:var(--s1);background:var(--bg2)">
      <iframe src="${calendlyUrl}?hide_event_type_details=1&hide_landing_page_details=1&hide_gdpr_banner=1" width="100%" height="100%" frameborder="0"></iframe>
    </div>
    <p style="color:var(--textmuted);font-size:.82rem;margin-top:20px;text-align:center;font-style:italic">
      💌 A confirmation email will be sent to ${user.email} when your session is confirmed.
    </p>
  `;
}

// ── Mobile sidebar ──
function toggleSidebar() { get('sidebar')?.classList.toggle('open'); }

function handleMobileMenu() {
  const btn = get('mobileMenuBtn');
  const update = () => { if (btn) btn.style.display = window.innerWidth <= 768 ? 'block' : 'none'; };
  update();
  window.addEventListener('resize', update);
}

// ── Logout ──
function logout() {
  localStorage.removeItem('kw_session');
  localStorage.removeItem('kw_token');
  window.location.href = 'index.html';
}

// ── Toast ──
function showDashToast(msg) {
  let t = get('dashToast');
  if (!t) { 
    t = document.createElement('div'); 
    t.id = 'dashToast'; 
    t.className = 'toast'; 
    document.body.appendChild(t); 
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', async () => {
  const session = JSON.parse(localStorage.getItem('kw_session') || 'null');
  const token = getToken();
  
  if (!session || !token) {
    window.location.href = 'login.html';
    return;
  }

  try {
    // Fetch fresh user data
    const userRes = await apiCall('/me');
    if (!userRes.ok) {
      localStorage.removeItem('kw_session');
      localStorage.removeItem('kw_token');
      window.location.href = 'login.html';
      return;
    }
    
    const user = await userRes.json();
    localStorage.setItem('kw_session', JSON.stringify({ ...user, token }));

    // Fetch sessions
    const sessRes = await apiCall('/sessions');
    if (!sessRes.ok) throw new Error('Could not fetch sessions');
    const sessions = await sessRes.json();

    // Fetch attendance
    const attRes = await apiCall('/attendance');
    let attended = 0;
    if (attRes.ok) {
      const records = await attRes.json();
      attended = records.length;
    }

    applyUser(user);
    
    // Set sessions attended count
    set('sessionsAttended', String(attended));

    await renderHome(sessions, user);
    await renderSessions(sessions, user);
    await renderLibrary(sessions, user);
    await renderSummaries(sessions, user);
    
    bindSidebarLinks();
    handleMobileMenu();
    loadPreferences();
    gateBookingByTier(user);

  } catch (err) {
    console.error('Dashboard load error:', err);
    showDashToast('Error loading dashboard. Please refresh.');
  }
});
