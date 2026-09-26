const token = location.pathname.split('/feedback/')[1];
const formCard = document.getElementById('formCard');
const draft = {};
let currentTemplate = null;

async function init() {
  try {
    const res = await fetch(`/api/public/feedback/${token}`);
    const data = await res.json();
    if (!res.ok) return renderError(data.error);
    currentTemplate = data.template;
    renderForm(data);
  } catch (err) {
    renderError('Something went wrong loading this form.');
  }
}

function renderError(message) {
  const track = document.querySelector('.form-progress-track');
  if (track) track.style.display = 'none';
  formCard.innerHTML = `<p style="text-align:center; color:var(--danger); padding:30px 0;">${message}</p>`;
}

function renderForm(data) {
  formCard.innerHTML = `
    <p style="font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin:0 0 8px;">${data.identity.company || ''}</p>
    <p style="font-weight:600; font-size:22px; color:var(--text); margin:0 0 4px;">${data.identity.name}</p>
    <p style="font-size:12.5px; color:var(--muted); margin:0 0 20px;">${data.identity.city || ''}${data.identity.city && data.identity.state ? ', ' : ''}${data.identity.state || ''}</p>
    <div style="height:1px; background:var(--border); margin:0 0 20px;"></div>
    <div id="fields"></div>
    <button class="btn btn-primary" id="submitBtn">Submit feedback</button>
    <div id="submitResult"></div>
  `;

  const fieldsBox = document.getElementById('fields');
  fieldsBox.innerHTML = data.template.questions.map(q => fieldHtml(q)).join('');
  wireFields(data.template.questions);
  document.getElementById('submitBtn').addEventListener('click', () => submit(data.requestId, data.template.questions));
  updateProgress(data.template.questions);
}

function updateProgress(questions) {
  const bar = document.getElementById('formProgress');
  if (!bar || !questions.length) return;
  const filled = questions.filter(q => {
    const v = draft[q.id];
    return !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));
  }).length;
  bar.style.width = Math.round((filled / questions.length) * 100) + '%';
}

function fieldHtml(q) {
  const req = q.is_required ? '<span class="req">*</span>' : '';
  let body = '';
  if (q.field_type === 'rating') {
    body = `<div class="stars" data-field="${q.id}">${[1,2,3,4,5].map(n=>`<button type="button" data-v="${n}">★</button>`).join('')}</div>`;
  } else if (q.field_type === 'radio') {
    body = `<div class="pill-row" data-field="${q.id}">${q.options.map(o=>`<button type="button" class="pill" data-v="${o.value}">${o.label}</button>`).join('')}</div>`;
  } else if (q.field_type === 'checkbox') {
    body = `<div class="pill-row" data-field="${q.id}" data-multi="1">${q.options.map(o=>`<button type="button" class="pill" data-v="${o.value}">${o.label}</button>`).join('')}</div>`;
  } else if (q.field_type === 'text') {
    body = `<input type="text" data-field="${q.id}">`;
  } else if (q.field_type === 'number') {
    body = `<input type="number" data-field="${q.id}">`;
  } else if (q.field_type === 'textarea') {
    body = `<textarea rows="3" data-field="${q.id}" maxlength="500"></textarea><div class="counter"><span data-count="${q.id}">0</span>/500</div>`;
  }
  return `<div class="field" data-fieldwrap="${q.id}"><p class="q">${q.label}${req}</p>${body}<p class="err">This field is required.</p></div>`;
}

function wireFields(questions) {
  questions.forEach(q => {
    const box = document.querySelector(`[data-field="${q.id}"]`);
    if (q.field_type === 'rating') {
      box.addEventListener('click', e => {
        const btn = e.target.closest('button'); if (!btn) return;
        draft[q.id] = Number(btn.dataset.v);
        box.querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) <= draft[q.id]));
        clearErr(q.id);
        updateProgress(questions);
      });
    } else if (q.field_type === 'radio') {
      box.addEventListener('click', e => {
        const btn = e.target.closest('button'); if (!btn) return;
        draft[q.id] = btn.dataset.v;
        box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
        clearErr(q.id);
        updateProgress(questions);
      });
    } else if (q.field_type === 'checkbox') {
      draft[q.id] = [];
      box.addEventListener('click', e => {
        const btn = e.target.closest('button'); if (!btn) return;
        const arr = draft[q.id];
        const idx = arr.indexOf(btn.dataset.v);
        if (idx > -1) arr.splice(idx, 1); else arr.push(btn.dataset.v);
        btn.classList.toggle('on');
        clearErr(q.id);
        updateProgress(questions);
      });
    } else if (q.field_type === 'text' || q.field_type === 'number') {
      box.addEventListener('input', e => { draft[q.id] = e.target.value; clearErr(q.id); updateProgress(questions); });
    } else if (q.field_type === 'textarea') {
      box.addEventListener('input', e => {
        draft[q.id] = e.target.value;
        document.querySelector(`[data-count="${q.id}"]`).textContent = e.target.value.length;
        clearErr(q.id);
        updateProgress(questions);
      });
    }
  });
}

function clearErr(id) { document.querySelector(`[data-fieldwrap="${id}"]`)?.classList.remove('invalid'); }
function setErr(id) { document.querySelector(`[data-fieldwrap="${id}"]`)?.classList.add('invalid'); }

async function submit(requestId, questions) {
  let ok = true;
  questions.forEach(q => {
    if (!q.is_required) return;
    const v = draft[q.id];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) { setErr(q.id); ok = false; }
  });
  if (!ok) return;

  const answers = Object.entries(draft).map(([questionId, value]) => ({ questionId: Number(questionId), value }));
  const res = await fetch(`/api/public/feedback/${token}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers })
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('submitResult').innerHTML = `<div class="error-box">${data.error}</div>`;
    return;
  }
  const bar = document.getElementById('formProgress');
  if (bar) bar.style.width = '100%';
  formCard.innerHTML = `
    <div style="text-align:center; padding:20px 4px;">
      <div style="width:56px;height:56px;margin:0 auto 12px;border-radius:50%;border:2px solid var(--success);display:flex;align-items:center;justify-content:center;color:var(--success);font-size:26px;">✓</div>
      <h3>Feedback received</h3>
      <p style="color:var(--muted); font-size:13px;">Thank you — your response has been recorded.</p>
    </div>`;
}

init();
