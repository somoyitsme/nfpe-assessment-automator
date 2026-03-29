// background.js — Full Assessment Auto-Filler
// Workflow: Select student → Click icon → Bangla/English/Mathematics/BGS × Cycles 1-4 × All Units

const SUBJECTS = ['Bangla', 'English', 'Mathematics', 'BGS'];
const MAX_CYCLES = 4;

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  setBadge(tab.id, '...', '#a855f7');

  try {
    for (let si = 0; si < SUBJECTS.length; si++) {
      const subject = SUBJECTS[si];
      const abbr = subject.slice(0, 2).toUpperCase();

      // Click the subject tab
      const subOk = await exec(tab.id, injected_clickByText, [subject]);
      if (!subOk?.[0]?.result) continue;
      await sleep(1200);

      // First 4 cycles
      for (let ci = 0; ci < MAX_CYCLES; ci++) {

        // Check cycle BEFORE clicking — skip immediately if already complete (green tick)
        const cycleDone = await exec(tab.id, injected_isCycleComplete, [ci]);
        if (cycleDone?.[0]?.result) continue;

        setBadge(tab.id, `${abbr}C${ci + 1}`, '#6366f1');

        // Click cycle
        const cycleOk = await exec(tab.id, injected_clickCycle, [ci]);
        if (!cycleOk?.[0]?.result) continue;
        await sleep(1000); // wait for units to load

        // Get total unit count
        const uc = await exec(tab.id, injected_getUnitCount);
        const unitCount = uc?.[0]?.result ?? 0;
        if (unitCount === 0) continue;

        // Process each unit
        for (let ui = 0; ui < unitCount; ui++) {
          // Skip already-completed units
          const unitDone = await exec(tab.id, injected_isUnitComplete, [ui]);
          if (unitDone?.[0]?.result) continue;

          // Click unit
          const uOk = await exec(tab.id, injected_clickUnit, [ui]);
          if (!uOk?.[0]?.result) continue;

          // Wait for questions to appear
          const loaded = await pollForGradeButtons(tab.id, 8000);
          if (!loaded) continue;

          // Snapshot unit button HTML (to detect green tick after submit)
          const snap = await exec(tab.id, injected_getUnitHTML, [ui]);
          const htmlBefore = snap?.[0]?.result ?? '';

          // Fill grades + future steps
          await exec(tab.id, injected_fill);
          await sleep(1000);

          // Submit
          await exec(tab.id, injected_submit);

          // Wait for green tick (unit HTML changes) — max 5s
          setBadge(tab.id, `U${ui + 1}/${unitCount}`, '#f59e0b');
          await pollForUnitChange(tab.id, ui, htmlBefore, 5000);
          await sleep(300);
        }
      }
    }

    setBadge(tab.id, 'DONE', '#22c55e');

  } catch {
    setBadge(tab.id, '✗', '#f87171');
  }
  setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 5000);
});

// ── Helpers ──────────────────────────────────────────────────────────
function exec(tabId, func, args = []) {
  return chrome.scripting.executeScript({ target: { tabId }, func, args });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function setBadge(tabId, text, color) {
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
}
async function pollForGradeButtons(tabId, maxMs) {
  const GRADE = /Fully\s+Achieved|Mostly\s+Achieved|Partially\s+Achieved|Partially\s+deficits|Mostly\s+deficits|Not\s+achieved/i;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await exec(tabId, () => {
      const GRADE = /Fully\s+Achieved|Mostly\s+Achieved|Partially\s+Achieved|Partially\s+deficits|Mostly\s+deficits|Not\s+achieved/i;
      return [...document.querySelectorAll('label.btn')].some(el => GRADE.test(el.textContent));
    });
    if (r?.[0]?.result) return true;
    await sleep(500);
  }
  return false;
}
async function pollForUnitChange(tabId, idx, htmlBefore, maxMs) {
  if (!htmlBefore) { await sleep(3000); return; }
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await exec(tabId, injected_hasUnitChanged, [idx, htmlBefore]);
    if (r?.[0]?.result) return;
    await sleep(500);
  }
}

// ═══════════════════════════════════════════════════════════════════
// INJECTED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// ── Shared helpers (inlined in each function) ────────────────────
// sidebarRight, inMain, visible, absTop, vueClick, getUnitBtns, getCycleBtns

function injected_clickByText(text) {
  // Find and click a button/label whose trimmed text matches exactly
  function sbRight() {
    let m = 0;
    document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) m = Math.max(m, r.right);
    });
    return m || 170;
  }
  const sb = sbRight();
  const inMain = el => { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sb + 30; };

  const target = [...document.querySelectorAll('button,label,div,span,a')].find(el => {
    if (!inMain(el)) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    return el.textContent.trim() === text;
  });
  if (!target) return false;

  const prev = target.getAttribute('disabled');
  if (prev !== null) target.removeAttribute('disabled');
  target.click();
  ['mousedown', 'mouseup', 'click'].forEach(t => target.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
  function tryVue3(node) {
    if (!node?._vei) return false;
    const inv = node._vei.onClick || node._vei.click;
    if (!inv) return false;
    const fn = inv.value || inv;
    if (typeof fn !== 'function') return false;
    try { fn(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; } catch { return false; }
  }
  let node = target;
  for (let i = 0; i < 5; i++) { if (!node) break; if (tryVue3(node)) break; node = node.parentElement; }
  if (prev !== null) target.setAttribute('disabled', prev);
  return true;
}

function injected_clickCycle(index) {
  function sbRight() {
    let m = 0;
    document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) m = Math.max(m, r.right);
    });
    return m || 170;
  }
  const sb = sbRight();
  const inMain = el => { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sb + 30; };

  const all = [...document.querySelectorAll('button,label,div,span,a,li')].filter(el => {
    if (!inMain(el)) return false;
    const t = el.textContent.trim();
    if (!/^Cycle\s*\d+/i.test(t) || t.length > 60) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const deduped = all.filter(el => !all.some(o => o !== el && el.contains(o)));
  deduped.sort((a, b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return Math.abs(ra.top - rb.top) > 10 ? ra.top - rb.top : ra.left - rb.left;
  });
  const target = deduped[index];
  if (!target) return false;

  const prev = target.getAttribute('disabled');
  if (prev !== null) target.removeAttribute('disabled');
  target.click();
  ['mousedown', 'mouseup', 'click'].forEach(t => target.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
  function tryVue3(node) {
    if (!node?._vei) return false;
    const inv = node._vei.onClick || node._vei.click;
    if (!inv) return false;
    const fn = inv.value || inv;
    if (typeof fn !== 'function') return false;
    try { fn(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; } catch { return false; }
  }
  let node = target;
  for (let i = 0; i < 5; i++) { if (!node) break; if (tryVue3(node)) break; node = node.parentElement; }
  if (prev !== null) target.setAttribute('disabled', prev);
  return true;
}

function injected_isCycleComplete(index) {
  function sbRight() {
    let m = 0;
    document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) m = Math.max(m, r.right);
    });
    return m || 170;
  }
  const sb = sbRight();
  const inMain = el => { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sb + 30; };
  const all = [...document.querySelectorAll('button,label,div,span,a,li')].filter(el => {
    if (!inMain(el)) return false;
    const t = el.textContent.trim();
    if (!/^Cycle\s*\d+/i.test(t) || t.length > 60) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const cycles = all.filter(el => !all.some(o => o !== el && el.contains(o)));
  cycles.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(ra.top - rb.top) > 10 ? ra.top - rb.top : ra.left - rb.left; });
  const el = cycles[index];
  if (!el) return false;
  const t = el.textContent, h = el.innerHTML;
  return t.includes('\u2713') || t.includes('\u2714') || h.includes('fa-check') || h.includes('icon-check') ||
    (el.className.includes('success') && !el.className.includes('outline'));
}

function injected_allUnitsComplete() {
  // Returns true if every visible unit button already shows a checkmark
  function sbRight() {
    let m = 0;
    document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) m = Math.max(m, r.right);
    });
    return m || 170;
  }
  const sb = sbRight();
  const inMain = el => { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sb + 30; };

  const all = [...document.querySelectorAll('button,label,div,span,a,li')].filter(el => {
    if (!inMain(el)) return false;
    const t = el.textContent.trim();
    if (!/^Unit\s*\d+/i.test(t) || t.length > 60) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const units = all.filter(el => !all.some(o => o !== el && el.contains(o)));
  if (units.length === 0) return false;

  function isComplete(el) {
    const t = el.textContent, h = el.innerHTML;
    return t.includes('✓') || t.includes('✔') || h.includes('fa-check') || h.includes('icon-check') ||
      (el.className.includes('success') && !el.className.includes('outline'));
  }
  return units.every(isComplete);
}

function injected_isUnitComplete(index) {
  function sbRight() {
    let m = 0;
    document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) m = Math.max(m, r.right);
    });
    return m || 170;
  }
  const sb = sbRight();
  const inMain = el => { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sb + 30; };

  const all = [...document.querySelectorAll('button,label,div,span,a,li')].filter(el => {
    if (!inMain(el)) return false;
    const t = el.textContent.trim();
    if (!/^Unit\s*\d+/i.test(t) || t.length > 60) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const units = all.filter(el => !all.some(o => o !== el && el.contains(o)));
  units.sort((a, b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return Math.abs(ra.top - rb.top) > 10 ? ra.top - rb.top : ra.left - rb.left;
  });
  const el = units[index];
  if (!el) return false;
  const t = el.textContent, h = el.innerHTML;
  return t.includes('✓') || t.includes('✔') || h.includes('fa-check') || h.includes('icon-check') ||
    (el.className.includes('success') && !el.className.includes('outline'));
}

function injected_getUnitCount() {
  function sbRight() {
    let m = 0;
    document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) m = Math.max(m, r.right);
    });
    return m || 170;
  }
  const sb = sbRight();
  const inMain = el => { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sb + 30; };
  const all = [...document.querySelectorAll('button,label,div,span,a,li')].filter(el => {
    if (!inMain(el)) return false;
    const t = el.textContent.trim();
    if (!/^Unit\s*\d+/i.test(t) || t.length > 60) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  return all.filter(el => !all.some(o => o !== el && el.contains(o))).length;
}

function injected_getUnitHTML(index) {
  function sbRight() {
    let m = 0;
    document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => {
      const r = el.getBoundingClientRect(); if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) m = Math.max(m, r.right);
    }); return m || 170;
  }
  const sb = sbRight();
  const inMain = el => { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sb + 30; };
  const all = [...document.querySelectorAll('button,label,div,span,a,li')].filter(el => {
    if (!inMain(el)) return false;
    const t = el.textContent.trim();
    if (!/^Unit\s*\d+/i.test(t) || t.length > 60) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  });
  const units = all.filter(el => !all.some(o => o !== el && el.contains(o)));
  units.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(ra.top - rb.top) > 10 ? ra.top - rb.top : ra.left - rb.left; });
  return units[index]?.innerHTML ?? '';
}

function injected_hasUnitChanged(index, htmlBefore) {
  function sbRight() {
    let m = 0;
    document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => {
      const r = el.getBoundingClientRect(); if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) m = Math.max(m, r.right);
    }); return m || 170;
  }
  const sb = sbRight();
  const inMain = el => { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sb + 30; };
  const all = [...document.querySelectorAll('button,label,div,span,a,li')].filter(el => {
    if (!inMain(el)) return false;
    const t = el.textContent.trim();
    if (!/^Unit\s*\d+/i.test(t) || t.length > 60) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  });
  const units = all.filter(el => !all.some(o => o !== el && el.contains(o)));
  units.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(ra.top - rb.top) > 10 ? ra.top - rb.top : ra.left - rb.left; });
  return (units[index]?.innerHTML ?? '') !== htmlBefore;
}

function injected_clickUnit(index) {
  function sbRight() {
    let m = 0;
    document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => {
      const r = el.getBoundingClientRect(); if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) m = Math.max(m, r.right);
    }); return m || 170;
  }
  const sb = sbRight();
  const inMain = el => { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sb + 30; };
  const all = [...document.querySelectorAll('button,label,div,span,a,li')].filter(el => {
    if (!inMain(el)) return false;
    const t = el.textContent.trim();
    if (!/^Unit\s*\d+/i.test(t) || t.length > 60) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  });
  const deduped = all.filter(el => !all.some(o => o !== el && el.contains(o)));
  deduped.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(ra.top - rb.top) > 10 ? ra.top - rb.top : ra.left - rb.left; });
  const target = deduped[index];
  if (!target) return false;
  const prev = target.getAttribute('disabled');
  if (prev !== null) target.removeAttribute('disabled');
  target.click();
  ['mousedown', 'mouseup', 'click'].forEach(t => target.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
  function tryVue3(node) {
    if (!node?._vei) return false; const inv = node._vei.onClick || node._vei.click; if (!inv) return false;
    const fn = inv.value || inv; if (typeof fn !== 'function') return false;
    try { fn(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; } catch { return false; }
  }
  let node = target;
  for (let i = 0; i < 5; i++) { if (!node) break; if (tryVue3(node)) break; node = node.parentElement; }
  if (prev !== null) target.setAttribute('disabled', prev);
  return true;
}

function injected_fill() {
  const GRADE = /Fully\s+Achieved|Mostly\s+Achieved|Partially\s+Achieved|Partially\s+deficits|Mostly\s+deficits|Not\s+achieved/i;
  function sbRight() { let m = 0; document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => { const r = el.getBoundingClientRect(); if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) m = Math.max(m, r.right); }); return m || 170; }
  const sb = sbRight();
  const inMain = el => { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sb + 30; };
  const visible = el => { const s = window.getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const absTop = el => { let t = 0, n = el; while (n) { t += n.offsetTop || 0; n = n.offsetParent; } return t; };

  function fireClick(el) {
    const prev = el.getAttribute('disabled'); if (prev !== null) el.removeAttribute('disabled');
    el.click();
    ['mousedown', 'mouseup', 'click'].forEach(t => el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
    function tryVue3(node) { if (!node?._vei) return false; const inv = node._vei.onClick || node._vei.click; if (!inv) return false; const fn = inv.value || inv; if (typeof fn !== 'function') return false; try { fn(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; } catch { return false; } }
    function tryVue2(node) { const vm = node?.__vue__; if (!vm) return false; if (typeof vm.$listeners?.click === 'function') { try { vm.$listeners.click(new MouseEvent('click', { bubbles: true })); return true; } catch { } } return false; }
    let node = el; for (let i = 0; i < 5; i++) { if (!node) break; if (tryVue3(node) || tryVue2(node)) break; node = node.parentElement; }
    if (prev !== null) el.setAttribute('disabled', prev);
  }

  let gradeEls = [...document.querySelectorAll('label.btn')].filter(el => { const t = el.textContent.trim(); return GRADE.test(t) && t.length < 200 && inMain(el) && visible(el); });
  if (!gradeEls.length) { gradeEls = [...document.querySelectorAll('div,span,button,a,p,li')].filter(el => { const t = el.textContent.trim(); if (!GRADE.test(t) || t.length > 200) return false; if ([...el.children].some(c => GRADE.test(c.textContent))) return false; return inMain(el) && visible(el); }); }
  if (!gradeEls.length) return { error: 'No grade buttons.' };

  let gradeGroups = [];
  for (let lv = 1; lv <= 4; lv++) {
    const map = new Map();
    gradeEls.forEach(el => { let p = el; for (let i = 0; i < lv; i++) p = p?.parentElement; if (!p) return; if (!map.has(p)) map.set(p, []); map.get(p).push(el); });
    gradeGroups = [...map.values()].filter(g => g.length >= 2 && g.length <= 12);
    if (gradeGroups.length) break;
  }
  if (!gradeGroups.length) return { error: 'Cannot group grade buttons.' };

  gradeGroups.forEach(g => g.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(ra.top - rb.top) > 8 ? ra.top - rb.top : ra.left - rb.left; }));
  gradeGroups.sort((a, b) => absTop(a[0]) - absTop(b[0]));
  let gc = 0; gradeGroups.forEach(g => { fireClick(g[Math.floor(Math.random() * 2)] || g[0]); gc++; });

  const allRadios = [...document.querySelectorAll('input[type="radio"]')].filter(r => !r.disabled && inMain(r) && visible(r));
  allRadios.sort((a, b) => absTop(a) - absTop(b));
  const rGroups = []; if (allRadios.length) { let cur = [allRadios[0]], topY = absTop(allRadios[0]); for (let i = 1; i < allRadios.length; i++) { const t = absTop(allRadios[i]); if (t - topY < 160) cur.push(allRadios[i]); else { rGroups.push(cur); cur = [allRadios[i]]; topY = t; } } rGroups.push(cur); }
  let fc = 0; rGroups.forEach(g => { if (!g.length) return; const pick = g[Math.floor(Math.random() * Math.min(2, g.length))]; g.forEach(r => { r.checked = false; }); pick.checked = true; pick.dispatchEvent(new Event('change', { bubbles: true })); pick.click(); fc++; });
  return { grades: gc, futureSteps: fc };
}

function injected_submit() {
  function sbRight() { let m = 0; document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => { const r = el.getBoundingClientRect(); if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) m = Math.max(m, r.right); }); return m || 170; }
  const sb = sbRight();
  const inMain = el => { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sb + 30; };
  const btn = [...document.querySelectorAll('button,input[type="submit"],a.btn,label.btn,[role="button"]')].find(el => inMain(el) && el.textContent.trim().toLowerCase().includes('submit'));
  if (!btn) return { submitted: false };
  btn.click();
  ['mousedown', 'mouseup', 'click'].forEach(t => btn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
  function tryVue3(node) { if (!node?._vei) return false; const inv = node._vei.onClick || node._vei.click; if (!inv) return false; const fn = inv.value || inv; if (typeof fn !== 'function') return false; try { fn(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; } catch { return false; } }
  let node = btn; for (let i = 0; i < 4; i++) { if (!node) break; if (tryVue3(node)) break; node = node.parentElement; }
  return { submitted: true };
}
