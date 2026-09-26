// ============================================================
// FeedLoop — appearance: light/dark mode + multi-color accent themes,
// plus a subtle animated background (gradient orbs, dot grid, particles).
// State is saved per browser. Pages apply it pre-paint via an inline script.
// ============================================================
(function () {
  const THEME_KEY = 'feedloop-theme';
  const ACCENT_KEY = 'feedloop-accent';
  const root = document.documentElement;

  const ACCENTS = [
    { id: 'indigo',  name: 'Indigo',  c1: '#6366f1', c2: '#8b5cf6' },
    { id: 'violet',  name: 'Violet',  c1: '#8b5cf6', c2: '#d946ef' },
    { id: 'blue',    name: 'Blue',    c1: '#3b82f6', c2: '#06b6d4' },
    { id: 'emerald', name: 'Emerald', c1: '#10b981', c2: '#14b8a6' },
    { id: 'amber',   name: 'Amber',   c1: '#f59e0b', c2: '#f97316' },
    { id: 'rose',    name: 'Rose',    c1: '#f43f5e', c2: '#ec4899' },
    { id: 'cyan',    name: 'Cyan',    c1: '#06b6d4', c2: '#3b82f6' },
    { id: 'slate',   name: 'Slate',   c1: '#64748b', c2: '#334155' }
  ];
  const ACCENT_IDS = ACCENTS.map((a) => a.id);

  function currentTheme() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function currentAccent() {
    const a = root.getAttribute('data-accent');
    return ACCENT_IDS.includes(a) ? a : 'indigo';
  }

  function apply(theme, accent) {
    if (theme) root.setAttribute('data-theme', theme);
    if (accent) root.setAttribute('data-accent', accent);
    try {
      if (theme) localStorage.setItem(THEME_KEY, theme);
      if (accent) localStorage.setItem(ACCENT_KEY, accent);
    } catch { /* privacy mode */ }
    syncControl();
  }

  // ------------------------------------------------------------
  // Animated background: gradient orbs, drifting dot grid, particles
  // ------------------------------------------------------------
  function buildBackground() {
    if (document.getElementById('bgfx')) return;
    const layer = document.createElement('div');
    layer.id = 'bgfx';
    layer.className = 'bg-fx';
    layer.setAttribute('aria-hidden', 'true');

    const grid = document.createElement('div');
    grid.className = 'grid';
    layer.appendChild(grid);

    const orbs = [
      { t: '-12%', l: '-8%', s: 460, d: '22s', alt: false },
      { t: '58%',  l: '76%', s: 420, d: '26s', alt: true },
      { t: '70%',  l: '4%',  s: 320, d: '24s', alt: false },
      { t: '0%',   l: '58%', s: 360, d: '28s', alt: true }
    ];
    orbs.forEach((o) => {
      const el = document.createElement('span');
      el.className = 'orb ' + (o.alt ? 'ob' : 'oa');
      el.style.cssText = `top:${o.t};left:${o.l};width:${o.s}px;height:${o.s}px;--d:${o.d}`;
      layer.appendChild(el);
    });

    const count = window.innerWidth < 700 ? 14 : 26;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'particle ' + (i % 2 ? 'p2' : 'p1');
      const size = (3 + Math.random() * 5).toFixed(1);
      p.style.cssText =
        `left:${(Math.random() * 100).toFixed(1)}%;width:${size}px;height:${size}px;` +
        `--d:${(14 + Math.random() * 18).toFixed(1)}s;animation-delay:-${(Math.random() * 30).toFixed(1)}s;`;
      layer.appendChild(p);
    }

    document.body.insertBefore(layer, document.body.firstChild);
  }

  // ------------------------------------------------------------
  // Theme control (injected where #themeControl lives)
  // ------------------------------------------------------------
  function buildControl() {
    const mount = document.getElementById('themeControl');
    if (!mount || mount.dataset.built) return;
    mount.dataset.built = '1';
    mount.classList.add('theme-control');

    mount.innerHTML = `
      <button class="theme-trigger" type="button" aria-haspopup="true" aria-expanded="false">
        <span class="trigger-dots"><i></i><i></i></span> Theme
      </button>
      <div class="theme-pop" role="dialog" aria-label="Theme settings">
        <p class="tp-title">Mode</p>
        <div class="mode-seg">
          <button type="button" data-mode="light">Light</button>
          <button type="button" data-mode="dark">Dark</button>
        </div>
        <p class="tp-title">Accent color</p>
        <div class="accent-grid">
          ${ACCENTS.map((a) => `<button type="button" class="accent-dot" data-accent="${a.id}"
            title="${a.name}" aria-label="${a.name}" style="--c1:${a.c1};--c2:${a.c2}"></button>`).join('')}
        </div>
      </div>`;

    const trigger = mount.querySelector('.theme-trigger');
    const pop = mount.querySelector('.theme-pop');
    trigger.addEventListener('click', () => {
      const open = pop.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      if (!mount.contains(e.target)) { pop.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); }
    });
    mount.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => apply(b.dataset.mode, null)));
    mount.querySelectorAll('.accent-dot').forEach((b) => b.addEventListener('click', () => apply(null, b.dataset.accent)));

    syncControl();
  }

  function syncControl() {
    const mount = document.getElementById('themeControl');
    if (!mount || !mount.dataset.built) return;
    const t = currentTheme();
    const a = currentAccent();
    const acc = ACCENTS.find((x) => x.id === a) || ACCENTS[0];
    mount.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === t));
    mount.querySelectorAll('.accent-dot').forEach((b) => b.classList.toggle('on', b.dataset.accent === a));
    const dots = mount.querySelector('.trigger-dots');
    if (dots) dots.innerHTML = `<i style="--c1:${acc.c1};--c2:${acc.c2}"></i><i style="--c1:${acc.c2};--c2:${acc.c1}"></i>`;
  }

  function boot() {
    buildBackground();
    buildControl();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FeedLoopTheme = {
    apply,
    setMode: (m) => apply(m, null),
    setAccent: (a) => apply(null, a),
    currentTheme,
    currentAccent,
    ACCENTS
  };
})();
