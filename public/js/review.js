function animateCounts(container) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  container.querySelectorAll('.num[data-count]').forEach(el => {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;
    const start = performance.now();
    const dur = 650;
    function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

async function loadSummary() {
  const res = await fetch('/api/review/summary');
  const s = await res.json();
  const box = document.getElementById('summaryCards');
  box.innerHTML = `
    <div class="summary-card"><div class="num" data-count="${s.total}">0</div><div class="lbl">Total sent</div></div>
    <div class="summary-card"><div class="num" data-count="${s.completed}">0</div><div class="lbl">Completed</div></div>
    <div class="summary-card"><div class="num" data-count="${s.awaiting}">0</div><div class="lbl">Awaiting response</div></div>
  `;
  animateCounts(box);
}

async function loadReviewList() {
  const res = await fetch('/api/review?limit=50');
  const rows = await res.json();
  const list = document.getElementById('reviewList');

  if (!rows.length) {
    list.innerHTML = '<p class="empty">No feedback requests yet — send one from the Send tab.</p>';
    return;
  }

  list.innerHTML = rows.map(r => `
    <div class="review-row" data-id="${r.id}" data-loaded="0">
      <div class="review-row-top">
        <span class="who">${r.name}</span>
        <span class="badge ${r.status}">${r.status}</span>
      </div>
      <div class="review-row-sub">${r.template_name} · ${r.company || ''} · ${new Date(r.created_at).toLocaleString()}</div>
      <div class="review-detail"></div>
    </div>
  `).join('');

  list.querySelectorAll('.review-row').forEach(row => {
    row.addEventListener('click', () => toggleRow(row));
  });
}

async function toggleRow(row) {
  const open = row.classList.toggle('open');
  if (!open || row.dataset.loaded === '1') return;

  const id = row.dataset.id;
  const res = await fetch(`/api/review/${id}/answers`);
  const answers = await res.json();
  const detail = row.querySelector('.review-detail');

  detail.innerHTML = answers.length
    ? answers.map(a => `
        <div class="qa">
          <p class="qq">${a.label}</p>
          <p class="aa">${formatAnswer(a.answer_value, a.field_type)}</p>
        </div>
      `).join('')
    : '<p class="empty">No answers submitted yet.</p>';

  row.dataset.loaded = '1';
}

function formatAnswer(value, type) {
  if (type === 'rating') {
    const n = Number(value);
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(', ');
  } catch { /* not JSON, plain string */ }
  return value;
}

loadSummary();
loadReviewList();
