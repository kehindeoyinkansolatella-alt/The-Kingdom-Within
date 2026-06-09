// ── Navbar scroll effect ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// ── Mobile nav ──
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobileNav');
const mobileClose = document.getElementById('mobileClose');

hamburger?.addEventListener('click', () => mobileNav.classList.add('open'));
mobileClose?.addEventListener('click', closeMobile);

function closeMobile() {
  mobileNav?.classList.remove('open');
}

// ── Scroll reveal ──
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ── Newsletter ──
function subscribeNewsletter(e) {
  e.preventDefault();
  const email = document.getElementById('nlEmail').value;
  const form = document.getElementById('nlForm');
  const success = document.getElementById('nlSuccess');

  // Save to localStorage (replaced by API call once backend is live)
  const subscribers = JSON.parse(localStorage.getItem('kw_subscribers') || '[]');
  if (!subscribers.includes(email)) {
    subscribers.push(email);
    localStorage.setItem('kw_subscribers', JSON.stringify(subscribers));
  }

  form.style.display = 'none';
  success.style.display = 'block';
  showToast('You\'re on the list! Watch for your first letter soon.');
}

// ── Toast ──
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3800);
}

// ── Smooth scroll for anchor links ──
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      closeMobile();
    }
  });
});

// Pre-select plan from URL param on signup page redirect
window.addEventListener('DOMContentLoaded', () => {
  const planSelect = document.getElementById('plan');
  const url = new URLSearchParams(window.location.search);
  const plan = url.get('plan');
  if (planSelect && plan) planSelect.value = plan;
});

// ── Checkout ──
// Called by the paid tier buttons. If the user is logged in, hits the API
// to create a Stripe session and redirects to Stripe's hosted checkout page.
// If not logged in, sends them to sign up first (plan is preserved in the URL).
async function startCheckout(plan) {
  const session = JSON.parse(localStorage.getItem('kw_session') || 'null');

  if (!session) {
    window.location.href = `signup.html?plan=${plan}`;
    return;
  }

  const btn = event.currentTarget;
  const original = btn.textContent;
  btn.textContent = 'Loading…';
  btn.disabled = true;

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
      },
      body: JSON.stringify({ plan }),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      // Stripe not configured yet — fall back to signup flow
      window.location.href = `signup.html?plan=${plan}`;
    }
  } catch {
    window.location.href = `signup.html?plan=${plan}`;
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}
