/* Callforge — free power dialer. All data lives in this browser (localStorage). */
(() => {
  'use strict';

  const STORE_KEY = 'callforge.v1';

  const DISPOSITIONS = [
    { id: 'no_answer', label: 'No answer' },
    { id: 'voicemail', label: 'Voicemail' },
    { id: 'gatekeeper', label: 'Gatekeeper' },
    { id: 'not_interested', label: 'Not interested', cls: 'bad' },
    { id: 'callback', label: 'Callback' },
    { id: 'interested', label: 'Interested', cls: 'good' },
    { id: 'bad_number', label: 'Bad number', cls: 'bad' },
  ];
  const DISPO_LABEL = Object.fromEntries(DISPOSITIONS.map(d => [d.id, d.label]));

  const DEFAULT_SCRIPT = `## Opener
Hi, is this {first_name}? This is {my_name} with {my_company}. Quick heads up, this call may be transcribed for my notes. Did I catch you at a bad time?

## Reason for calling
The reason I'm calling is we help companies like {company} [solve specific problem]. Most teams I talk to are dealing with [pain point].

## Discovery questions
- How are you handling [problem] today?
- What's the biggest headache with that?
- If you could fix one thing about it, what would it be?

## Ask
Would it be crazy to grab 15 minutes later this week so I can show you how it works?

## Objections
- "Not interested": Totally fair. Out of curiosity, is that because you already have something in place, or it's just not a priority right now?
- "Send me an email": Happy to. So I send something useful, what's the main thing you'd want to see?
- "No budget": Makes sense. Most of our customers felt the same until they saw [result]. Worth a quick look for later?

## Voicemail
Hi {first_name}, {my_name} from {my_company}. I'll try you again, or reach me at [your number]. Thanks!`;

  const DEFAULT_STATE = {
    contacts: [],
    currentId: null,
    script: DEFAULT_SCRIPT,
    settings: { myName: '', myCompany: '', country: '+1', autoDial: true, delay: 3, autoRec: true },
  };

  // ---------- State ----------
  let state = load();
  let session = { active: false, inCall: false, callStart: null, countdown: null };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const s = JSON.parse(raw);
      return { ...structuredClone(DEFAULT_STATE), ...s, settings: { ...DEFAULT_STATE.settings, ...(s.settings || {}) } };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch { toast('Could not save. Export your data to be safe.'); }
  }

  const $ = id => document.getElementById(id);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const current = () => state.contacts.find(c => c.id === state.currentId) || null;
  const firstName = c => (c?.firstName || (c?.name || '').trim().split(/\s+/)[0] || '');

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600);
  }

  // ---------- Phone helpers ----------
  function normalizePhone(raw) {
    const s = String(raw || '').trim();
    const plus = s.startsWith('+');
    const digits = s.replace(/[^\d]/g, '');
    if (!digits) return '';
    if (plus) return '+' + digits;
    const cc = (state.settings.country || '').replace(/[^\d+]/g, '');
    if (digits.length === 10 && cc) return (cc.startsWith('+') ? cc : '+' + cc) + digits;
    if (digits.length === 11 && digits.startsWith('1') && cc === '+1') return '+' + digits;
    return digits;
  }
  function prettyPhone(p) {
    const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
    return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
  }
  const looksLikePhone = s => (String(s).replace(/[^\d]/g, '').length >= 7);

  // ---------- CSV ----------
  function parseCSV(text) {
    const rows = []; let row = []; let field = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',' || ch === '\t') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c));
  }

  function rowsToContacts(rows) {
    if (!rows.length) return [];
    const header = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
    const idx = names => header.findIndex(h => names.includes(h));
    const phoneCol = idx(['phone', 'phonenumber', 'mobile', 'mobilephone', 'cell', 'number', 'tel', 'telephone', 'directphone', 'workphone']);
    const out = [];

    if (phoneCol !== -1) {
      const nameCol = idx(['name', 'fullname', 'contact', 'contactname']);
      const fnCol = idx(['firstname', 'first']);
      const lnCol = idx(['lastname', 'last']);
      const coCol = idx(['company', 'companyname', 'organization', 'account', 'business']);
      const notesCol = idx(['notes', 'note', 'comments', 'title', 'jobtitle']);
      for (const r of rows.slice(1)) {
        const phone = normalizePhone(r[phoneCol]);
        if (!phone) continue;
        const fn = fnCol > -1 ? r[fnCol] : '';
        const ln = lnCol > -1 ? r[lnCol] : '';
        const name = (nameCol > -1 && r[nameCol]) || [fn, ln].filter(Boolean).join(' ');
        out.push(mkContact({ name, firstName: fn, phone, company: coCol > -1 ? r[coCol] : '', notes: notesCol > -1 ? r[notesCol] : '' }));
      }
      return out;
    }

    // Headerless: find the phone-looking cell; first other cell = name, next = company, rest = notes.
    for (const r of rows) {
      const pi = r.findIndex(looksLikePhone);
      if (pi === -1) continue;
      const others = r.filter((_, i) => i !== pi);
      out.push(mkContact({ name: others[0] || '', phone: normalizePhone(r[pi]), company: others[1] || '', notes: others.slice(2).join(', ') }));
    }
    return out;
  }

  function mkContact(c) {
    return {
      id: uid(), name: c.name || '', firstName: c.firstName || '', phone: c.phone, company: c.company || '',
      notes: c.notes || '', status: 'pending', calls: [],
    };
  }

  function toCSV(rows) {
    return rows.map(r => r.map(v => {
      let s = String(v ?? '');
      // Avoid spreadsheet formula injection, but leave phone numbers like +15551234567 alone.
      if (/^[=@]/.test(s) || (/^[+\-]/.test(s) && !/^\+?[\d\s().-]+$/.test(s))) s = "'" + s;
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
  }

  // ---------- Rendering ----------
  function render() {
    renderStats(); renderQueue(); renderContact(); renderControls();
  }

  function renderStats() {
    const total = state.contacts.length;
    const done = state.contacts.filter(c => c.status !== 'pending').length;
    const interested = state.contacts.filter(c => c.status === 'interested').length;
    const callbacks = state.contacts.filter(c => c.status === 'callback').length;
    $('stats').textContent = total ? `${done}/${total} called · ${interested} interested · ${callbacks} callbacks` : '';
  }

  function renderQueue() {
    const f = $('filter').value;
    const list = state.contacts.filter(c => f === 'all' || (f === 'pending' ? c.status === 'pending' : c.status !== 'pending'));
    $('queueEmpty').hidden = state.contacts.length > 0;
    $('queueList').innerHTML = list.map(c => `
      <li data-id="${c.id}" class="${c.id === state.currentId ? 'current' : ''}">
        <div class="q-main">
          <div class="q-name">${escapeHtml(c.name || prettyPhone(c.phone))}</div>
          <div class="q-phone">${escapeHtml(prettyPhone(c.phone))}${c.company ? ' · ' + escapeHtml(c.company) : ''}</div>
        </div>
        <span class="badge ${c.status}">${c.status === 'pending' ? 'Pending' : escapeHtml(DISPO_LABEL[c.status] || c.status)}</span>
      </li>`).join('');
    const cur = $('queueList').querySelector('.current');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function renderContact() {
    const c = current();
    $('cName').textContent = c ? (c.name || 'Unknown name') : (state.contacts.length ? 'Pick a contact or start dialing' : 'No contact selected');
    $('cMeta').textContent = c ? [c.company, c.status !== 'pending' ? 'Last: ' + (DISPO_LABEL[c.status] || c.status) : ''].filter(Boolean).join(' · ') : '';
    $('cPhone').textContent = c ? prettyPhone(c.phone) : '';
    $('cPhone').href = c ? 'tel:' + c.phone : '#';
    const prev = c?.calls?.filter(k => k.notes).map(k => `${new Date(k.at).toLocaleDateString()}: ${k.notes}`) || [];
    $('cNotes').textContent = c ? [c.notes, ...prev].filter(Boolean).join('\n') : '';
    renderScript();
  }

  function renderControls() {
    const dial = $('btnDial');
    if (session.countdown) dial.textContent = `Dialing in ${session.countdown.left}s… (click to dial now)`;
    else if (session.inCall) dial.textContent = 'Redial';
    else if (session.active) dial.textContent = 'Dial';
    else dial.textContent = 'Start dialing';
    dial.disabled = !state.contacts.length;
    $('btnPause').hidden = !session.active;
    $('btnPause').textContent = 'Stop session';
    const st = $('callStatus');
    st.className = 'call-status';
    if (session.countdown) { st.textContent = 'Next call coming up…'; st.classList.add('wait'); }
    else if (session.inCall) { st.textContent = 'On call (log a result when done)'; st.classList.add('live'); }
    else st.textContent = session.active ? 'Ready' : 'Idle';
    document.querySelectorAll('#dispoGrid button').forEach(b => (b.disabled = !current()));
  }

  function fillVars(text, c) {
    const s = state.settings;
    const vars = {
      first_name: firstName(c) || 'there', name: c?.name || '', company: c?.company || 'your company',
      my_name: s.myName || '[your name]', my_company: s.myCompany || '[your company]',
    };
    return escapeHtml(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? `<span class="var">${escapeHtml(vars[k])}</span>` : m));
  }

  function renderScript() {
    const c = current();
    const lines = state.script.split('\n');
    let html = ''; let inList = false;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('- ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${fillVars(t.slice(2), c)}</li>`;
        continue;
      }
      if (inList) { html += '</ul>'; inList = false; }
      if (t.startsWith('## ')) html += `<h4>${fillVars(t.slice(3), c)}</h4>`;
      else if (t) html += `<p>${fillVars(t, c)}</p>`;
    }
    if (inList) html += '</ul>';
    $('scriptView').innerHTML = html;
  }

  // ---------- Dialing ----------
  function nextPending(afterId) {
    const list = state.contacts;
    const start = Math.max(0, list.findIndex(c => c.id === afterId) + 1);
    for (let i = 0; i < list.length; i++) {
      const c = list[(start + i) % list.length];
      if (c.status === 'pending' && c.id !== afterId) return c;
    }
    return null;
  }

  function select(id) {
    if (session.inCall) finishCall(null);
    cancelCountdown();
    state.currentId = id; save();
    session.manual = true;
    $('callNotes').value = '';
    clearTranscript();
    render();
  }

  function dial() {
    cancelCountdown();
    let c = current();
    if (!c) {
      c = nextPending(null);
      if (!c) { toast('No pending numbers left'); return; }
      state.currentId = c.id;
    } else if (!session.active && !session.manual && c.status !== 'pending') {
      // Starting a session on an already-called contact: jump to the next pending one.
      const n = nextPending(c.id);
      if (n) { c = n; state.currentId = n.id; $('callNotes').value = ''; clearTranscript(); }
    }
    session.manual = false;
    session.active = true;
    session.inCall = true;
    session.callStart = Date.now();
    save(); render();
    // Hand the number to the OS: iPhone/Continuity, Phone Link, Google Voice, or the phone's dialer.
    const a = document.createElement('a');
    a.href = 'tel:' + c.phone;
    a.click();
    if (state.settings.autoRec && rec.supported && !rec.on) startRec();
  }

  function finishCall(dispo) {
    const c = current();
    if (!c) return;
    const transcript = transcriptText();
    if (dispo) {
      c.status = dispo;
      c.calls.push({
        at: new Date().toISOString(),
        result: dispo,
        durationSec: session.callStart ? Math.round((Date.now() - session.callStart) / 1000) : 0,
        notes: $('callNotes').value.trim(),
        transcript,
      });
    }
    session.inCall = false;
    session.callStart = null;
    stopRec();
    save();
  }

  function logResult(dispo) {
    const c = current();
    if (!c) return;
    cancelCountdown();
    finishCall(dispo);
    $('callNotes').value = '';
    clearTranscript();
    const n = nextPending(c.id);
    if (!n) { session.active = false; state.currentId = c.id; save(); render(); toast('List complete 🎉 Export your results.'); return; }
    state.currentId = n.id; save(); render();
    if (session.active && state.settings.autoDial) startCountdown();
  }

  function skip() {
    const c = current();
    if (session.inCall) finishCall(null);
    cancelCountdown();
    clearTranscript(); $('callNotes').value = '';
    const n = nextPending(c?.id);
    if (!n) { toast('No other pending numbers'); render(); return; }
    state.currentId = n.id; save(); render();
    if (session.active && state.settings.autoDial) startCountdown();
  }

  function stopSession() {
    if (session.inCall) finishCall(null);
    cancelCountdown();
    session.active = false;
    render();
  }

  function startCountdown() {
    const delay = Math.max(0, Number(state.settings.delay) || 0);
    if (delay === 0) return dial();
    session.countdown = { left: delay, timer: setInterval(() => {
      session.countdown.left--;
      if (session.countdown.left <= 0) dial(); else renderControls();
    }, 1000) };
    renderControls();
  }
  function cancelCountdown() {
    if (session.countdown) { clearInterval(session.countdown.timer); session.countdown = null; }
  }

  // ---------- Transcription (Web Speech API) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = { supported: !!SR, on: false, engine: null, finals: [], interim: '' };

  function startRec() {
    if (!rec.supported) { toast('Live transcription needs Chrome or Edge'); return; }
    if (rec.on) return;
    rec.on = true;
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = navigator.language || 'en-US';
    r.onresult = e => {
      rec.interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) rec.finals.push({ t: Date.now(), text: res[0].transcript.trim() });
        else rec.interim += res[0].transcript;
      }
      renderTranscript();
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { toast('Microphone permission denied'); rec.on = false; }
    };
    r.onend = () => { if (rec.on) { try { r.start(); } catch { /* restarting too fast */ } } else renderRecUI(); };
    rec.engine = r;
    try { r.start(); } catch { /* already started */ }
    renderRecUI();
  }
  function stopRec() {
    rec.on = false;
    if (rec.engine) { try { rec.engine.stop(); } catch { /* not running */ } }
    rec.interim = '';
    renderRecUI(); renderTranscript();
  }
  function clearTranscript() { rec.finals = []; rec.interim = ''; renderTranscript(); }
  function transcriptText() {
    return rec.finals.map(f => `[${new Date(f.t).toLocaleTimeString()}] ${f.text}`).join('\n');
  }
  function renderTranscript() {
    const el = $('transcript');
    if (!rec.finals.length && !rec.interim) {
      el.innerHTML = `<p class="hint">${rec.on ? 'Listening… put the call on speaker so both sides are picked up.' : 'Transcript appears here during a call.'}</p>`;
      return;
    }
    el.innerHTML = rec.finals.map(f => `<p><span class="ts">${new Date(f.t).toLocaleTimeString()}</span>${escapeHtml(f.text)}</p>`).join('')
      + (rec.interim ? `<p class="interim">${escapeHtml(rec.interim)}</p>` : '');
    el.scrollTop = el.scrollHeight;
  }
  function renderRecUI() {
    $('btnRec').textContent = rec.on ? 'Stop transcribing' : 'Start transcribing';
    $('recDot').hidden = !rec.on;
    $('recSupport').textContent = rec.supported ? '' : 'Not supported in this browser. Use Chrome or Edge.';
    $('btnRec').disabled = !rec.supported;
  }

  // ---------- Import / Export ----------
  function doImport() {
    const added = rowsToContacts(parseCSV($('importText').value));
    if (!added.length) { toast('No phone numbers found'); return; }
    if ($('importReplace').checked) { state.contacts = []; state.currentId = null; }
    const seen = new Set(state.contacts.map(c => c.phone));
    const fresh = added.filter(c => !seen.has(c.phone) && seen.add(c.phone));
    state.contacts.push(...fresh);
    if (!state.currentId && fresh.length) state.currentId = fresh[0].id;
    save(); render();
    $('importText').value = '';
    const dupes = added.length - fresh.length;
    toast(`Imported ${fresh.length} number${fresh.length === 1 ? '' : 's'}${dupes ? ` (${dupes} duplicate${dupes === 1 ? '' : 's'} skipped)` : ''}`);
  }

  function doExport() {
    if (!state.contacts.length) { toast('Nothing to export yet'); return; }
    const rows = [['name', 'phone', 'company', 'notes', 'status', 'call_count', 'last_called', 'last_duration_sec', 'last_call_notes', 'last_transcript']];
    for (const c of state.contacts) {
      const last = c.calls[c.calls.length - 1] || {};
      rows.push([c.name, c.phone, c.company, c.notes, c.status === 'pending' ? 'pending' : DISPO_LABEL[c.status] || c.status,
        c.calls.length, last.at || '', last.durationSec ?? '', last.notes || '', last.transcript || '']);
    }
    const blob = new Blob(['﻿' + toCSV(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `callforge-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Wiring ----------
  function init() {
    $('dispoGrid').innerHTML = DISPOSITIONS.map((d, i) =>
      `<button data-dispo="${d.id}" class="${d.cls || ''}">${i + 1} · ${d.label}</button>`).join('');
    $('dispoGrid').addEventListener('click', e => {
      const b = e.target.closest('button[data-dispo]'); if (b) logResult(b.dataset.dispo);
    });

    $('queueList').addEventListener('click', e => {
      const li = e.target.closest('li[data-id]'); if (li) select(li.dataset.id);
    });
    $('filter').addEventListener('change', renderQueue);
    $('btnDial').addEventListener('click', dial);
    $('btnSkip').addEventListener('click', skip);
    $('btnPause').addEventListener('click', stopSession);
    $('cPhone').addEventListener('click', e => { e.preventDefault(); if (current()) dial(); });

    // Tabs
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

    // Script editing
    $('btnEditScript').addEventListener('click', () => {
      const editing = $('scriptEdit').hidden;
      if (editing) { $('scriptEdit').value = state.script; }
      else { state.script = $('scriptEdit').value; save(); renderScript(); }
      $('scriptEdit').hidden = !editing; $('scriptView').hidden = editing;
      $('scriptHint').hidden = !editing; $('btnResetScript').hidden = !editing;
      $('btnEditScript').textContent = editing ? 'Save script' : 'Edit script';
    });
    $('btnResetScript').addEventListener('click', () => {
      if (confirm('Replace your script with the default template?')) $('scriptEdit').value = DEFAULT_SCRIPT;
    });

    // Transcript
    $('btnRec').addEventListener('click', () => (rec.on ? stopRec() : startRec()));

    // Import
    $('btnImport').addEventListener('click', () => $('importDlg').showModal());
    $('importGo').addEventListener('click', doImport);
    $('importFile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      $('importText').value = await f.text();
      e.target.value = '';
    });
    $('btnExport').addEventListener('click', doExport);

    // Settings
    $('btnSettings').addEventListener('click', () => {
      const s = state.settings;
      $('sMyName').value = s.myName; $('sMyCompany').value = s.myCompany; $('sCountry').value = s.country;
      $('sAutoDial').checked = s.autoDial; $('sDelay').value = s.delay; $('sAutoRec').checked = s.autoRec;
      $('settingsDlg').showModal();
    });
    $('settingsDlg').addEventListener('close', () => {
      if (session.cleared) { session.cleared = false; return; }
      const s = state.settings;
      s.myName = $('sMyName').value.trim(); s.myCompany = $('sMyCompany').value.trim();
      s.country = $('sCountry').value.trim(); s.autoDial = $('sAutoDial').checked;
      s.delay = Math.min(60, Math.max(0, Number($('sDelay').value) || 0)); s.autoRec = $('sAutoRec').checked;
      save(); render();
    });
    $('btnClearAll').addEventListener('click', () => {
      if (!confirm('Delete your whole list, results and script? Export first if you need them.')) return;
      stopSession(); state = structuredClone(DEFAULT_STATE); save();
      session.cleared = true;
      $('settingsDlg').close(); render(); clearTranscript();
    });

    // Keyboard shortcuts (ignored while typing)
    document.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      const k = e.key.toLowerCase();
      if (/^[1-7]$/.test(k)) { if (current()) logResult(DISPOSITIONS[Number(k) - 1].id); }
      else if (k === 'd') dial();
      else if (k === 's') skip();
      else if (k === 'p') stopSession();
      else if (k === 't') { rec.on ? stopRec() : startRec(); showTab('transcript'); }
      else return;
      e.preventDefault();
    });

    window.addEventListener('beforeunload', e => { if (session.inCall) { e.preventDefault(); e.returnValue = ''; } });

    renderRecUI(); renderTranscript(); render();
  }

  function showTab(name) {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === name));
    $('tab-script').hidden = name !== 'script';
    $('tab-transcript').hidden = name !== 'transcript';
  }

  init();
})();
