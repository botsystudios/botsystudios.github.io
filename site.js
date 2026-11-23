// ===== EDIT THIS =====
// Paste the permanent Discord invite (Server Settings → Invites → never expires).
const DISCORD_INVITE = 'https://discord.gg/ZaNMwpXmxh';
// =====================

document.querySelectorAll('[data-invite]').forEach((a) => {
  a.href = DISCORD_INVITE;
  a.target = '_blank';
  a.rel = 'noopener';
});

// Active nav link
const here = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.links a[href]').forEach((a) => {
  if (a.getAttribute('href') === here) a.classList.add('active');
});

// Mobile menu
const btn = document.querySelector('.menu-btn');
const links = document.querySelector('.links');
btn?.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(open));
});

// Footer year
document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

// Animated top progress line
const scrollProgress = document.getElementById('scroll-progress');
if (scrollProgress) {
  const updateScrollProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
  };
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', updateScrollProgress, { passive: true });
  updateScrollProgress();
}

// Reveal on scroll
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { threshold: 0.12 })
  : null;
document.querySelectorAll('.reveal').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));

// Reviews (only on reviews.html). Data comes from the bot: /reviews export → reviews.json
const list = document.getElementById('reviews');
if (list && !window.BOTSY_SUPABASE_CONFIG) loadReviews();

async function loadReviews() {
  let reviews = [];
  try {
    const res = await fetch('reviews.json', { cache: 'no-store' });
    if (res.ok) reviews = await res.json();
  } catch {
    reviews = [];
  }
  reviews = Array.isArray(reviews) ? reviews.filter((r) => r && r.text && r.rating) : [];

  if (!reviews.length) {
    list.outerHTML = `
      <div class="card empty reveal in">
        <div class="icon">⭐</div>
        <h3>No reviews yet — be the first!</h3>
        <p>Share honest feedback with <code>/review</code> in the Botsy Studios Discord.</p>
        <a class="btn btn-primary" href="${DISCORD_INVITE}" target="_blank" rel="noopener">Join the Discord</a>
      </div>`;
    return;
  }

  const avg = reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length;
  const summary = document.getElementById('summary');
  if (summary) {
    summary.hidden = false;
    summary.innerHTML = `<b>${avg.toFixed(1)}</b><div><div class="stars">${stars(Math.round(avg))}</div><small>${reviews.length} review${reviews.length === 1 ? '' : 's'} from real members</small></div>`;
  }

  list.innerHTML = reviews
    .map((r) => {
      const name = esc(r.name || 'Member');
      const avatar = r.avatar && /^https:\/\//.test(r.avatar)
        ? `<img src="${esc(r.avatar)}" alt="" loading="lazy">`
        : `<div class="avatar" style="background:var(--blue-600)">${name.charAt(0)}</div>`;
      const date = r.date ? new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      return `
        <article class="card review">
          <div class="review-head">${avatar}<div><strong>${name}</strong><small>${date}</small></div></div>
          <div class="stars">${stars(Number(r.rating))}</div>
          <p>${esc(r.text)}</p>
        </article>`;
    })
    .join('');
}

function stars(n) {
  n = Math.max(0, Math.min(5, n));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Short brand mark entrance; content remains available immediately beneath it.
document.querySelector('.loader')?.classList.add('done');

