// ── Auth API calls ──
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;
  const errEl    = document.getElementById('loginError');

  if (!email || !password) {
    if (errEl) { errEl.textContent = 'Please fill in all fields.'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const data = await res.json();
      if (errEl) { errEl.textContent = data.error || 'Login failed. Try again.'; errEl.style.display = 'block'; }
      return;
    }

    const data = await res.json();
    // Store token and session
    localStorage.setItem('kw_token', data.token);
    localStorage.setItem('kw_session', JSON.stringify({ ...data.user, token: data.token }));
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error('Login error:', err);
    if (errEl) { errEl.textContent = 'Connection error. Please try again.'; errEl.style.display = 'block'; }
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const name     = document.getElementById('name')?.value.trim();
  const email    = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;
  const plan     = document.getElementById('plan')?.value;
  const errEl    = document.getElementById('signupError');

  if (!name || !email || !password) {
    if (errEl) { errEl.textContent = 'Please fill in all fields.'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, plan: plan || 'seeker' })
    });

    if (!res.ok) {
      const data = await res.json();
      if (errEl) { errEl.textContent = data.error || 'Signup failed. Try again.'; errEl.style.display = 'block'; }
      return;
    }

    const data = await res.json();
    // Store token and session
    localStorage.setItem('kw_token', data.token);
    localStorage.setItem('kw_session', JSON.stringify({ ...data.user, token: data.token }));
    
    // If paid plan selected, redirect to checkout, else go to dashboard
    if (plan && plan !== 'seeker') {
      window.location.href = `/checkout?plan=${plan}`;
    } else {
      window.location.href = 'dashboard.html';
    }
  } catch (err) {
    console.error('Signup error:', err);
    if (errEl) { errEl.textContent = 'Connection error. Please try again.'; errEl.style.display = 'block'; }
  }
}

function logout() {
  localStorage.removeItem('kw_session');
  localStorage.removeItem('kw_token');
  window.location.href = 'index.html';
}
