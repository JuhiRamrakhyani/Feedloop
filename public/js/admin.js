// ============================== helpers ==============================
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function displayLink(url) { return String(url || '').replace(/^https?:\/\//, ''); }
function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('');
}
function infoRow(label, val) {
  if (!val) return '';
  return `<div class="preview-cell"><span class="preview-k">${esc(label)}</span><span>${esc(val)}</span></div>`;
}
const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  send: svg('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  trend: svg('<path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/>'),
  layers: svg('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>'),
  checkCircle: svg('<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><path d="M12 17h.01"/>'),
  users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6"/><path d="M10 11v6"/><path d="M14 11v6"/>')
};

// ============================== state ==============================
let activeTab = 'dashboard';
let selectedIdentity = null;
let selectedTemplateId = null;
let cachedTemplates = [];
let recentFilter = 'all';
let recipientMode = 'directory';
let appConfig = { appName: 'FeedLoop', provider: 'log' };

const tplDraft = {
  editId: null, name: '', description: '', questions: [], adding: false, editorOpen: false,
  newQ: { label: '', type: 'radio', options: [], required: true, editingIndex: null }
};

const FIELD_TYPES = [
  { v: 'rating',   label: 'Rating',   ic: '★' },
  { v: 'radio',    label: 'Radio',    ic: '◉' },
  { v: 'checkbox', label: 'Checkbox', ic: '☑' },
  { v: 'text',     label: 'Text box', ic: '✎' },
  { v: 'textarea', label: 'Textarea', ic: '☰' },
  { v: 'number',   label: 'Number',   ic: '#' }
];

const STATUS_BADGE = s => `<span class="badge ${s}">${s}</span>`;

function animateCounts(container) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  container.querySelectorAll('.num[data-count]').forEach(el => {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;
    const suffix = el.dataset.suffix || '';
    const start = performance.now();
    const dur = 650;
    function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// ============================== dialogs ==============================
function ensureDialog(id, className, html) {
  let d = $(id);
  if (!d) {
    d = document.createElement('dialog');
    d.id = id;
    d.className = className;
    d.innerHTML = html;
    document.body.appendChild(d);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  }
  return d;
}

function ensureTplDialog() {
  const d = ensureDialog('tplDialog', 'modal',
    `<div class="modal-head">
       <div><h3 id="tplModalTitle">New template</h3><p class="sub" id="tplModalSub"></p></div>
       <button type="button" class="modal-close" id="tplModalClose" aria-label="Close">&times;</button>
     </div>
     <div class="modal-body" id="tplModalBody"></div>
     <div class="modal-foot" id="tplModalFoot"></div>`);
  d.querySelector('#tplModalClose').onclick = () => d.close();
  d.addEventListener('close', () => resetTplDraft());
  return d;
}

function ensureConfirmDialog() {
  const d = ensureDialog('confirmDialog', 'modal',
    `<div class="modal-head">
       <div><h3 id="confirmTitle">Are you sure?</h3></div>
       <button type="button" class="modal-close" id="confirmClose" aria-label="Close">&times;</button>
     </div>
     <div class="modal-body"><p class="confirm-text" id="confirmText"></p></div>
     <div class="modal-foot">
       <button type="button" class="btn btn-ghost btn-sm" id="confirmCancel">Cancel</button>
       <button type="button" class="btn btn-danger btn-sm" id="confirmOk">Delete</button>
     </div>`);
  d.querySelector('#confirmClose').onclick = () => d.close();
  return d;
}

function openConfirm({ title = 'Are you sure?', text = '', okLabel = 'Delete' }) {
  const d = ensureConfirmDialog();
  d.querySelector('#confirmTitle').textContent = title;
  d.querySelector('#confirmText').textContent = text;
  d.querySelector('#confirmOk').textContent = okLabel;
  return new Promise((resolve) => {
    const okBtn = d.querySelector('#confirmOk');
    const cancelBtn = d.querySelector('#confirmCancel');
    function cleanup() {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      d.removeEventListener('close', onClose);
    }
    function onOk() { cleanup(); d.close(); resolve(true); }
    function onCancel() { cleanup(); d.close(); resolve(false); }
    function onClose() { cleanup(); resolve(false); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    d.addEventListener('close', onClose);
    d.showModal();
  });
}

// ============================== tabs ==============================
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  $('panel-' + tab).classList.add('active');
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'templates') renderTemplates();
  if (tab === 'send') renderSend();
  if (tab === 'review') renderReview();
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// ============================== DASHBOARD ==============================
const STAT_DEFS = [
  { key: 'total_requests',       label: 'Forms sent',          filter: 'all',       icon: ICON.send },
  { key: 'completed',            label: 'Completed',           filter: 'completed', icon: ICON.check },
  { key: 'awaiting',             label: 'Awaiting response',   filter: 'awaiting',  icon: ICON.clock },
  { key: 'response_rate',        label: 'Response rate',       filter: 'all',       icon: ICON.trend },
  { key: 'total_templates',      label: 'Templates',           filter: 'all',       icon: ICON.layers },
  { key: 'active_templates',     label: 'Active templates',    filter: 'all',       icon: ICON.checkCircle },
  { key: 'total_questions',      label: 'Questions',           filter: 'all',       icon: ICON.help },
  { key: 'identities_contacted', label: 'Recipients contacted', filter: 'all',      icon: ICON.users }
];

function matchesRecentFilter(r) {
  if (recentFilter === 'all') return true;
  if (recentFilter === 'awaiting') return r.status !== 'completed';
  return r.status === recentFilter;
}

function renderRecentList(recent) {
  const filtered = (recent || []).filter(matchesRecentFilter);
  const chips = recentFilter !== 'all'
    ? `<div class="filter-chips"><span class="filter-chip">Filtered: ${esc(recentFilter)}</span><button class="filter-clear" id="clearFilter">clear</button></div>`
    : '';
  const list = filtered.length
    ? filtered.map(r => `
        <div class="review-row">
          <div class="review-row-top">
            <span class="who">${esc(r.name)}</span>
            ${STATUS_BADGE(r.status)}
          </div>
          <div class="review-row-sub">${esc(r.template_name)} · ${esc(r.mobile_number)} · ${esc(r.city || '')}${r.city && r.state ? ', ' : ''}${esc(r.state || '')} · ${new Date(r.created_at).toLocaleString()}</div>
        </div>`).join('')
    : `<p class="empty">No sends match "${esc(recentFilter)}" right now.</p>`;
  return chips + list;
}

async function renderDashboard() {
  const box = $('dashboardBody');
  box.innerHTML = '<p class="empty">Loading dashboard…</p>';
  try {
    const res = await fetch('/api/review/dashboard');
    const d = await res.json();
    box.innerHTML = `
      <div class="stat-grid" id="statGrid">
        ${STAT_DEFS.map(s => `
          <button class="stat-card" data-filter="${s.filter}" data-key="${s.key}" title="Click to filter recent sends">
            <span class="stat-ic">${s.icon}</span>
            <span class="num" data-count="${d[s.key]}" ${s.key === 'response_rate' ? 'data-suffix="%"' : ''}>0</span>
            <span class="lbl">${s.label}</span>
          </button>`).join('')}
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h3>Recent sends</h3>
            <p class="desc" style="margin:4px 0 0;">Who each form was sent to and where it stands. Select a stat above to filter.</p>
          </div>
        </div>
        <div id="recentList"></div>
      </div>`;
    animateCounts(box);

    $('recentList').innerHTML = renderRecentList(d.recent);
    $('statGrid').querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('click', () => {
        const f = card.dataset.filter;
        recentFilter = (recentFilter === f) ? 'all' : f;
        $('statGrid').querySelectorAll('.stat-card').forEach(c =>
          c.classList.toggle('active', c === card && recentFilter === f && f !== 'all'));
        $('recentList').innerHTML = renderRecentList(d.recent);
        const clear = $('clearFilter');
        if (clear) clear.addEventListener('click', () => {
          recentFilter = 'all';
          $('statGrid').querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
          $('recentList').innerHTML = renderRecentList(d.recent);
        });
      });
    });
  } catch (err) {
    box.innerHTML = `<div class="error-box">Failed to load dashboard: ${esc(err.message)}</div>`;
  }
}

// ============================== TEMPLATES ==============================
function freshNewQ() { return { label: '', type: 'radio', options: [], required: true, editingIndex: null }; }
function resetTplDraft() {
  tplDraft.editId = null; tplDraft.name = ''; tplDraft.description = '';
  tplDraft.questions = []; tplDraft.adding = false; tplDraft.editorOpen = false; tplDraft.newQ = freshNewQ();
}

async function renderTemplates() {
  const box = $('templatesBody');
  box.innerHTML = '<p class="empty">Loading templates…</p>';
  let tpls = [];
  try {
    const res = await fetch('/api/templates?includeInactive=true');
    tpls = await res.json();
  } catch (err) {
    box.innerHTML = `<div class="error-box">Failed to load templates: ${esc(err.message)}</div>`;
    return;
  }

  box.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h3>Templates</h3>
          <p class="desc" style="margin:4px 0 0;">Reusable feedback forms. Create, edit, or remove one.</p>
        </div>
        <button class="btn btn-primary btn-inline" id="newTplBtn">New template</button>
      </div>
      <div class="tpl-grid" id="tplList">
        ${tpls.length ? tpls.map(t => `
          <div class="template-card" data-id="${t.id}">
            <div class="template-card-top">
              <span class="name">${esc(t.name)}</span>
              ${t.is_active ? '<span class="badge completed">active</span>' : '<span class="badge pending">inactive</span>'}
            </div>
            <p class="desc">${esc(t.description || 'No description')}</p>
            <div class="template-card-foot">
              <span class="meta">${t.question_count} question${t.question_count === 1 ? '' : 's'} · ${new Date(t.created_at).toLocaleDateString()}</span>
              <div class="template-card-actions">
                <button class="icon-btn" data-edit="${t.id}" title="Edit" aria-label="Edit">${ICON.edit}</button>
                <button class="icon-btn danger" data-del="${t.id}" title="Delete" aria-label="Delete">${ICON.trash}</button>
              </div>
            </div>
          </div>`).join('')
        : '<p class="empty" style="grid-column:1/-1;">No templates yet — create your first one.</p>'}
      </div>
    </div>`;

  $('newTplBtn').addEventListener('click', newTemplate);
  box.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    loadTemplateForEdit(b.dataset.edit);
  }));
  box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTemplate(b.dataset.del);
  }));
  box.querySelectorAll('.template-card').forEach(card => card.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    loadTemplateForEdit(card.dataset.id);
  }));
}

function newTemplate() {
  resetTplDraft();
  tplDraft.adding = true;
  openTplModal();
}

async function loadTemplateForEdit(id) {
  try {
    const res = await fetch(`/api/templates/${id}`);
    const t = await res.json();
    if (!res.ok) { alert(t.error || 'Could not load template'); return; }
    tplDraft.editId = t.id;
    tplDraft.name = t.name;
    tplDraft.description = t.description || '';
    tplDraft.questions = t.questions.map(q => ({
      label: q.label,
      type: q.field_type,
      options: (q.options || []).map(o => o.label ?? o.value ?? o),
      required: !!q.is_required
    }));
    tplDraft.adding = true;
    tplDraft.editorOpen = false;
    tplDraft.newQ = freshNewQ();
    openTplModal();
  } catch (err) {
    alert('Failed to load template: ' + err.message);
  }
}

function openTplModal() {
  const d = ensureTplDialog();
  renderTplModal();
  if (!d.open) d.showModal();
  const n = $('tplName');
  if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
}

function renderTplModal() {
  const editing = tplDraft.editId !== null;
  $('tplModalTitle').textContent = editing ? 'Edit template' : 'New template';
  $('tplModalSub').textContent = editing
    ? 'Update the details and questions, then save.'
    : 'Name it and add your questions.';

  $('tplModalBody').innerHTML = `
    <label>Template name</label>
    <input type="text" id="tplName" placeholder="e.g. Post-delivery feedback" value="${esc(tplDraft.name)}">
    <label>Description</label>
    <input type="text" id="tplDesc" placeholder="What is this template for?" value="${esc(tplDraft.description)}">

    <div class="section-label">
      <label>Questions</label>
      <span class="hint">${tplDraft.questions.length} added</span>
    </div>
    <div id="tplQList">
      ${tplDraft.questions.length ? tplDraft.questions.map((q, i) => `
        <div class="qitem">
          <div class="qitem-top">
            <div class="qtype-badge">${FIELD_TYPES.find(t => t.v === q.type).ic}</div>
            <div class="qitem-main">
              <p class="qitem-label">${esc(q.label)}</p>
              <p class="qitem-meta">${q.type}${q.required ? ' · <span class="req">required</span>' : ''}</p>
              ${q.options.length ? `<div class="qitem-opts">${q.options.map(o => `<span>${esc(o)}</span>`).join('')}</div>` : ''}
            </div>
            <div class="qitem-actions">
              <button data-editq="${i}" title="Edit question">✎</button>
              <button data-rmq="${i}" class="del" title="Remove">✕</button>
            </div>
          </div>
        </div>`).join('')
      : '<p class="empty" style="padding:10px 0;">No questions yet — add one below.</p>'}
    </div>

    <button class="add-q-btn" id="tplAddQ">Add question</button>
    <div id="tplQEditor"></div>`;

  $('tplModalFoot').innerHTML = `
    <button type="button" class="btn btn-ghost btn-sm" id="tplCancel">Cancel</button>
    ${editing ? '<button type="button" class="btn btn-danger btn-sm" id="tplDelete">Delete</button>' : ''}
    <button type="button" class="btn btn-primary btn-sm" id="tplSave">${editing ? 'Save changes' : 'Create template'}</button>`;

  $('tplName').addEventListener('input', e => tplDraft.name = e.target.value);
  $('tplDesc').addEventListener('input', e => tplDraft.description = e.target.value);
  $('tplQList').querySelectorAll('[data-rmq]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    tplDraft.questions.splice(+b.dataset.rmq, 1);
    renderTplModal();
  }));
  $('tplQList').querySelectorAll('[data-editq]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const i = +b.dataset.editq;
    const q = tplDraft.questions[i];
    tplDraft.newQ = { label: q.label, type: q.type, options: [...q.options], required: q.required, editingIndex: i };
    tplDraft.editorOpen = true;
    renderQEditor();
    const l = $('nqLabel'); if (l) { l.focus(); l.setSelectionRange(l.value.length, l.value.length); }
  }));
  $('tplAddQ').addEventListener('click', () => { tplDraft.newQ = freshNewQ(); tplDraft.editorOpen = true; renderQEditor(); });
  $('tplSave').addEventListener('click', saveTemplate);
  $('tplCancel').addEventListener('click', () => { const d = $('tplDialog'); if (d.open) d.close(); });
  if ($('tplDelete')) $('tplDelete').addEventListener('click', () => deleteTemplate(tplDraft.editId));

  renderQEditor();
}

function renderQEditor() {
  const box = $('tplQEditor');
  if (!box || !tplDraft.editorOpen) { if (box) box.innerHTML = ''; return; }
  const q = tplDraft.newQ;
  const editingQ = q.editingIndex !== null;
  const hasOptions = ['radio', 'checkbox'].includes(q.type);
  box.innerHTML = `
    <div class="add-q-form">
      <label>Question label</label>
      <input type="text" id="nqLabel" placeholder="e.g. How was the delivery timing?" value="${esc(q.label)}">

      <label>Field type</label>
      <div class="type-grid" id="nqTypeGrid">
        ${FIELD_TYPES.map(t => `<button type="button" data-t="${t.v}" class="${q.type === t.v ? 'on' : ''}"><span class="ic">${t.ic}</span>${t.label}</button>`).join('')}
      </div>

      <div id="nqOptionsWrap" style="display:${hasOptions ? 'block' : 'none'}">
        <label>Options</label>
        <div class="opt-editor" id="nqOptChips">
          ${q.options.map((o, i) => `<span class="opt-chip">${esc(o)}<button data-rmopt="${i}" type="button">&times;</button></span>`).join('')}
        </div>
        <div class="opt-add-row">
          <input type="text" id="nqOptInput" placeholder="Add an option and press Enter">
          <button id="nqOptAddBtn" type="button">Add</button>
        </div>
      </div>

      <div class="req-toggle">
        <input type="checkbox" id="nqRequired" ${q.required ? 'checked' : ''}>
        <span>Required field</span>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary btn-sm" id="nqSaveBtn" style="flex:1;">${editingQ ? 'Save question' : 'Add question'}</button>
        ${editingQ ? `<button class="btn btn-ghost btn-sm" id="nqCancelBtn" type="button">Cancel</button>` : ''}
      </div>
    </div>`;

  $('nqLabel').addEventListener('input', e => q.label = e.target.value);
  $('nqRequired').addEventListener('change', e => q.required = e.target.checked);
  $('nqTypeGrid').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    q.type = b.dataset.t;
    renderQEditor();
  }));

  const addOpt = () => {
    const v = $('nqOptInput').value.trim();
    if (v) { q.options.push(v); $('nqOptInput').value = ''; renderQEditor(); const i = $('nqOptInput'); if (i) i.focus(); }
  };
  $('nqOptAddBtn').addEventListener('click', addOpt);
  $('nqOptInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addOpt(); } });
  $('nqOptChips').querySelectorAll('[data-rmopt]').forEach(b => b.addEventListener('click', () => {
    q.options.splice(+b.dataset.rmopt, 1);
    renderQEditor();
  }));

  $('nqSaveBtn').addEventListener('click', () => {
    if (!q.label.trim()) { alert('Enter a question label.'); return; }
    const hasOpts = ['radio', 'checkbox'].includes(q.type);
    if (hasOpts && q.options.length < 2) { alert('Add at least 2 options for a radio/checkbox field.'); return; }
    const saved = { label: q.label.trim(), type: q.type, options: hasOpts ? [...q.options] : [], required: q.required };
    if (q.editingIndex !== null) tplDraft.questions[q.editingIndex] = saved;
    else tplDraft.questions.push(saved);
    tplDraft.newQ = freshNewQ();
    tplDraft.editorOpen = false;
    renderTplModal();
  });
  if ($('nqCancelBtn')) $('nqCancelBtn').addEventListener('click', () => { tplDraft.newQ = freshNewQ(); tplDraft.editorOpen = false; renderQEditor(); });
}

function payloadFromDraft() {
  return {
    name: tplDraft.name.trim(),
    description: tplDraft.description.trim() || null,
    questions: tplDraft.questions.map(q => ({
      label: q.label, fieldType: q.type, options: q.options, isRequired: q.required
    }))
  };
}

async function saveTemplate() {
  if (!tplDraft.name.trim()) { alert('Give the template a name.'); return; }
  if (!tplDraft.questions.length) { alert('Add at least one question.'); return; }
  const editing = tplDraft.editId !== null;
  try {
    const res = await fetch(editing ? `/api/templates/${tplDraft.editId}` : '/api/templates', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadFromDraft())
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    const d = $('tplDialog');
    if (d.open) d.close();
    renderTemplates();
  } catch (err) {
    alert(`Failed to save template: ${err.message}`);
  }
}

async function deleteTemplate(id) {
  const ok = await openConfirm({
    title: 'Delete template?',
    text: 'This removes the template. If it has already been used for feedback, existing responses are kept and the template is deactivated instead.',
    okLabel: 'Delete'
  });
  if (!ok) return;
  try {
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');
    const d = $('tplDialog');
    if (d && d.open) d.close();
    renderTemplates();
  } catch (err) {
    alert(`Failed to delete template: ${err.message}`);
  }
}

// ============================== SEND ==============================
let searchTimer;
let selectedNumber = null;

function hidePreview() {
  $('previewCard').style.display = 'none';
  $('sendCard').style.display = 'none';
  $('sendSummary').innerHTML = '';
}

function renderSend() {
  $('searchInput').value = '';
  $('identityResults').innerHTML = '';
  $('manualName').value = '';
  $('manualPhone').value = '';
  $('manualCompany').value = '';
  $('manualCity').value = '';
  $('sendResult').innerHTML = '';
  $('templateResults').innerHTML = '';
  $('numberPicker').innerHTML = '';
  selectedIdentity = null;
  selectedTemplateId = null;
  selectedNumber = null;
  setRecipientMode('directory');
  runSearch();
}

function setRecipientMode(mode) {
  recipientMode = mode;
  document.querySelectorAll('#recipientMode button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  $('directoryPane').style.display = mode === 'directory' ? 'block' : 'none';
  $('manualPane').style.display = mode === 'manual' ? 'block' : 'none';
  selectedIdentity = null;
  selectedNumber = null;
  hidePreview();
}

document.querySelectorAll('#recipientMode button').forEach(b =>
  b.addEventListener('click', () => setRecipientMode(b.dataset.mode)));

$('searchInput')?.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 250);
});

['manualName', 'manualPhone', 'manualCompany', 'manualCity'].forEach(id => {
  $(id)?.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(applyManualRecipient, 300); });
});

async function runSearch() {
  if (recipientMode !== 'directory') return;
  const q = $('searchInput').value;
  try {
    const res = await fetch(`/api/identities/search?q=${encodeURIComponent(q)}`);
    const identities = await res.json();
    const box = $('identityResults');
    box.innerHTML = identities.length ? identities.map(i => `
      <div class="identity-row" data-id="${i.identityId}">
        <div class="name">${esc(i.name)}</div>
        <div class="meta">ID ${i.identityId}${i.city ? ' · ' + esc(i.city) : ''}${i.city && i.state ? ', ' : ''}${esc(i.state || '')}${i.category ? ' · ' + esc(i.category) : ''}</div>
      </div>`).join('') : `<p class="empty">No matches. Use “Enter manually” to send to any number.</p>`;
    box.querySelectorAll('.identity-row').forEach(row => row.addEventListener('click', async () => {
      const res2 = await fetch(`/api/identities/${row.dataset.id}`);
      selectedIdentity = await res2.json();
      showIdentityPreview(selectedIdentity, true);
    }));
  } catch (err) {
    $('identityResults').innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  }
}

async function applyManualRecipient() {
  const name = $('manualName').value.trim();
  const phone = $('manualPhone').value.trim();
  if (!name || !phone) { hidePreview(); selectedIdentity = null; return; }
  selectedIdentity = {
    identityId: null,
    name,
    company: $('manualCompany').value.trim() || null,
    city: $('manualCity').value.trim() || null,
    state: null,
    mobileNumber: phone,
    numbers: [{ value: phone, type: 'mobile', label: null }]
  };
  await showIdentityPreview(selectedIdentity, false);
}

function renderNumberPicker(idn) {
  const box = $('numberPicker');
  const seen = new Set();
  const unique = [];
  (idn.numbers || []).forEach(n => {
    const v = String(n.value ?? n ?? '').trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    unique.push({ type: n.type === 'whatsapp' ? 'whatsapp' : (n.type || 'mobile'), value: v });
  });

  if (!unique.length && idn.mobileNumber) {
    const v = String(idn.mobileNumber).trim();
    if (v) unique.push({ type: 'mobile', value: v });
  }

  if (!unique.length) {
    box.innerHTML = '<p class="empty">No contact number for this recipient.</p>';
    selectedNumber = null;
    updateSendSummary();
    return;
  }

  selectedNumber = unique[0].value;
  box.innerHTML = unique.map(n => `
    <button type="button" class="num-chip${n.value === selectedNumber ? ' on' : ''}" data-num="${esc(n.value)}">
      <span class="num-type">${n.type === 'whatsapp' ? 'WA' : 'MOB'}</span>
      ${esc(n.value)}
    </button>`).join('');
  box.querySelectorAll('.num-chip').forEach(chip => chip.addEventListener('click', () => {
    selectedNumber = chip.dataset.num;
    box.querySelectorAll('.num-chip').forEach(c => c.classList.toggle('on', c === chip));
    updateSendSummary();
  }));
  updateSendSummary();
}

function updateSendSummary() {
  const box = $('sendSummary');
  if (!box || !selectedIdentity) return;
  const tpl = cachedTemplates.find(t => String(t.id) === String(selectedTemplateId));
  box.innerHTML = `
    <div class="send-summary">
      <div class="send-summary-row"><span>To</span><b>${esc(selectedIdentity.name)}</b></div>
      <div class="send-summary-row"><span>Number</span><b>${esc(selectedNumber || '—')}</b></div>
      <div class="send-summary-row"><span>Template</span><b>${esc(tpl ? tpl.name : '—')}</b></div>
      <div class="send-summary-row"><span>Channel</span><b>${esc(appConfig.provider)}</b></div>
    </div>`;
}

async function showIdentityPreview(idn, highlight) {
  if (recipientMode === 'directory') {
    document.querySelectorAll('.identity-row').forEach(r => r.classList.toggle('selected', r.dataset.id === String(idn.identityId)));
  }

  $('previewCard').style.display = 'block';
  $('previewBody').innerHTML = `
    <div class="preview-head">
      <span class="preview-avatar">${esc(initials(idn.name))}</span>
      <div class="preview-title">
        <p class="preview-name">${esc(idn.name)}</p>
        <p class="preview-sub">${idn.identityId ? 'ID ' + idn.identityId : 'Manual recipient'}${idn.category ? ' · ' + esc(idn.category) : ''}</p>
      </div>
    </div>
    <div class="preview-grid">
      ${infoRow('Location', idn.city ? (idn.city + (idn.state ? ', ' + idn.state : '')) : (idn.state || ''))}
      ${infoRow('Company', idn.company)}
    </div>`;

  renderNumberPicker(idn);

  await loadTemplates();
  $('sendCard').style.display = 'block';
  updateSendSummary();
  if (highlight) $('previewCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function loadTemplates() {
  const res = await fetch('/api/templates');
  const templates = await res.json();
  cachedTemplates = templates;
  const box = $('templateResults');
  if (!templates.length) {
    box.innerHTML = '<p class="empty">No templates yet — create one on the Templates tab first.</p>';
    updateSendSummary();
    return;
  }
  box.innerHTML = templates.map(t => `
    <div class="template-row" data-id="${t.id}">
      <div class="name">${esc(t.name)}</div>
      <div class="desc">${esc(t.description || '')} · ${t.question_count} question${t.question_count === 1 ? '' : 's'}</div>
    </div>`).join('');
  box.querySelectorAll('.template-row').forEach(row => row.addEventListener('click', () => {
    selectedTemplateId = row.dataset.id;
    box.querySelectorAll('.template-row').forEach(r => r.classList.toggle('selected', r === row));
    updateSendSummary();
  }));
  updateSendSummary();
}

$('sendBtn')?.addEventListener('click', async () => {
  const resEl = $('sendResult');
  if (!selectedIdentity || !selectedTemplateId || !selectedNumber) {
    resEl.innerHTML = '<div class="error-box">Pick a recipient, a template, and a number first.</div>';
    return;
  }
  const btn = $('sendBtn');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  const payload = { templateId: selectedTemplateId, mobileNumber: selectedNumber };
  if (recipientMode === 'directory') {
    payload.identityId = selectedIdentity.identityId;
  } else {
    payload.name = selectedIdentity.name;
    payload.company = selectedIdentity.company || null;
    payload.city = selectedIdentity.city || null;
  }

  try {
    const res = await fetch('/api/feedback/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Send failed');
    const via = data.simulated ? `${data.provider} (simulated)` : data.provider;
    const isLocalhost = /localhost|127\.0\.0\.1/.test(data.link || '');
    resEl.innerHTML = `
      <div class="toast">Feedback link created via ${esc(data.provider)}.</div>
      ${data.simulated ? `<div class="notice">Not delivered to WhatsApp. The <b>${esc(data.provider)}</b> provider only logs the message — nothing was sent. To send for real, set <b>DELIVERY_PROVIDER=baileys</b> (run <b>npm run whatsapp:login</b> once) or <b>webhook</b> in your <b>.env</b>, then restart.</div>` : ''}
      ${isLocalhost ? `<div class="notice">The link points to <b>localhost</b>, so a recipient's phone can't open it. Set <b>PUBLIC_BASE_URL</b> to a public HTTPS URL (e.g. an ngrok or cloudflared tunnel) before sending.</div>` : ''}
      <div class="msg-preview">
        <div class="msg-head">To ${esc(selectedNumber)} · via ${esc(via)}</div>
        <div class="msg-bubble">
          Hi ${esc(selectedIdentity.name)},<br><br>We'd love to hear your feedback — it takes about a minute:<br>
          <a class="msg-link" href="${esc(data.link)}" target="_blank" rel="noopener">${esc(displayLink(data.link))}</a>
        </div>
      </div>`;
  } catch (err) {
    resEl.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send feedback link';
  }
});

// ============================== REVIEW ==============================
async function renderReview() {
  const list = $('reviewList');
  list.innerHTML = '<p class="empty">Loading…</p>';
  try {
    const res = await fetch('/api/review?limit=50');
    const rows = await res.json();
    if (!rows.length) {
      list.innerHTML = '<p class="empty">No feedback requests yet — send one from the Send tab.</p>';
      return;
    }
    list.innerHTML = rows.map(r => `
      <div class="review-row" data-id="${r.id}" data-loaded="0">
        <div class="review-row-top">
          <span class="who">${esc(r.name)}</span>
          ${STATUS_BADGE(r.status)}
        </div>
        <div class="review-row-sub">${esc(r.template_name)}${r.company ? ' · ' + esc(r.company) : ''} · ${new Date(r.created_at).toLocaleString()}</div>
        <div class="review-detail"></div>
      </div>`).join('');
    list.querySelectorAll('.review-row').forEach(row => row.addEventListener('click', () => toggleRow(row)));
  } catch (err) {
    list.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  }
}

async function toggleRow(row) {
  const open = row.classList.toggle('open');
  if (!open || row.dataset.loaded === '1') return;
  try {
    const res = await fetch(`/api/review/${row.dataset.id}/answers`);
    const answers = await res.json();
    row.querySelector('.review-detail').innerHTML = answers.length
      ? answers.map(a => `
          <div class="qa">
            <p class="qq">${esc(a.label)}</p>
            <p class="aa">${formatAnswer(a.answer_value, a.field_type)}</p>
          </div>`).join('')
      : '<p class="empty">No answers submitted yet.</p>';
    row.dataset.loaded = '1';
  } catch (err) {
    row.querySelector('.review-detail').innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  }
}

function formatAnswer(value, type) {
  if (type === 'rating') {
    const n = Number(value);
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return esc(parsed.join(', '));
  } catch { /* not JSON, plain string */ }
  return esc(value);
}

// ============================== init ==============================
async function init() {
  try {
    const res = await fetch('/api/config');
    appConfig = await res.json();
    document.querySelectorAll('[data-app-name]').forEach(el => el.textContent = appConfig.appName);
    document.title = `${appConfig.appName} — Admin`;
    const badge = $('providerBadge');
    if (badge) badge.textContent = appConfig.provider;
  } catch { /* defaults are fine */ }
  renderDashboard();
}
init();
