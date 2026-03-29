// popup.js — Assessment Filler

const fillBtn   = document.getElementById('fill-btn');
const resetBtn  = document.getElementById('reset-btn');
const resultMsg = document.getElementById('result-msg');
const scanDot   = document.getElementById('scan-dot');
const scanText  = document.getElementById('scan-text');
const qCount    = document.getElementById('q-count');

scanPage();

async function scanPage() {
  setScan('working', 'Scanning page…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injected_scan });
    const data = results?.[0]?.result;
    if (data?.gradeGroups > 0) {
      qCount.textContent = data.gradeGroups;
      setScan('ok', `Found ${data.gradeGroups} questions · ${data.radioGroups} future-step groups`);
      fillBtn.disabled = false;
    } else {
      qCount.textContent = '0';
      setScan('error', data?.error || 'No assessment questions found');
    }
  } catch { setScan('error', 'Cannot access this page'); }
}

fillBtn.addEventListener('click', async () => {
  fillBtn.disabled = true;
  fillBtn.classList.add('running');
  document.getElementById('btn-text').textContent = 'Filling…';
  setScan('working', 'Filling assessment…');
  setResult('', '');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injected_fill });
    const r = results?.[0]?.result;
    if (r?.error) { setScan('error', r.error); setResult('✗ ' + r.error, 'error'); }
    else if (r) {
      setScan('ok', `Done — ${r.grades} grades · ${r.futureSteps} future steps`);
      setResult(`✓ ${r.grades} grade${r.grades !== 1 ? 's' : ''} · ${r.futureSteps} future step${r.futureSteps !== 1 ? 's' : ''} filled`, 'success');
    }
  } catch { setScan('error', 'Cannot access this page'); setResult('✗ Could not access page', 'error'); }
  finally {
    fillBtn.classList.remove('running');
    fillBtn.disabled = false;
    document.getElementById('btn-text').textContent = 'Fill Assessment';
  }
});

resetBtn.addEventListener('click', async () => {
  resetBtn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injected_reset });
    setScan('ok', 'All selections cleared'); setResult('✓ Reset done', 'success');
  } catch { setScan('error', 'Cannot access this page'); }
  finally { resetBtn.disabled = false; }
});

function setScan(state, text) { scanDot.className = 'scan-dot ' + state; scanText.textContent = text; }
function setResult(msg, type) { resultMsg.textContent = msg; resultMsg.className = 'result-msg ' + type; }

// ═══════════════════════════════════════════════════════════
// INJECTED into the webpage
// ═══════════════════════════════════════════════════════════

function injected_scan() {
  const GRADE = /Fully\s+Achieved|Mostly\s+Achieved|Partially\s+Achieved|Partially\s+deficits|Mostly\s+deficits|Not\s+achieved/i;
  const sidebar = getSidebarRight();
  function inMain(el) { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sidebar + 30; }
  function visible(el) {
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }

  // Target Vue Bootstrap labels first (label.btn), then fall back
  let gradeEls = [...document.querySelectorAll('label.btn')].filter(el => {
    const t = el.textContent.trim();
    return GRADE.test(t) && t.length < 200 && inMain(el) && visible(el);
  });
  if (gradeEls.length === 0) {
    gradeEls = [...document.querySelectorAll('div,span,button,a,p,li')].filter(el => {
      const t = el.textContent.trim();
      if (!GRADE.test(t) || t.length > 200) return false;
      if ([...el.children].some(c => GRADE.test(c.textContent))) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && inMain(el) && visible(el);
    });
  }

  const gradeGroups = findGroups(gradeEls);
  const radios = [...document.querySelectorAll('input[type="radio"]')].filter(r => !r.disabled && inMain(r));
  const rGroups = groupByPosition(radios);

  if (gradeGroups.length === 0) return { gradeGroups: 0, radioGroups: 0, error: 'No grade buttons found. Navigate to an Assessment page.' };
  return { gradeGroups: gradeGroups.length, radioGroups: rGroups.length };

  function findGroups(els) {
    for (let lv = 1; lv <= 4; lv++) {
      const map = new Map();
      els.forEach(el => {
        let p = el; for (let i = 0; i < lv; i++) p = p?.parentElement;
        if (!p) return;
        if (!map.has(p)) map.set(p, []); map.get(p).push(el);
      });
      const g = [...map.values()].filter(g => g.length >= 2 && g.length <= 12);
      if (g.length > 0) return g;
    }
    return [];
  }
  function groupByPosition(radios) {
    if (!radios.length) return [];
    radios.sort((a, b) => absTop(a) - absTop(b));
    const groups = []; let cur = [radios[0]], topY = absTop(radios[0]);
    for (let i = 1; i < radios.length; i++) {
      const t = absTop(radios[i]);
      if (t - topY < 160) cur.push(radios[i]); else { groups.push(cur); cur = [radios[i]]; topY = t; }
    }
    groups.push(cur); return groups.filter(g => g.length >= 1);
  }
  function absTop(el) { let t = 0, n = el; while (n) { t += n.offsetTop || 0; n = n.offsetParent; } return t; }
  function getSidebarRight() {
    let max = 0;
    document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) max = Math.max(max, r.right);
    });
    return max || 170;
  }
}

function injected_fill() {
  const GRADE = /Fully\s+Achieved|Mostly\s+Achieved|Partially\s+Achieved|Partially\s+deficits|Mostly\s+deficits|Not\s+achieved/i;

  const sidebar = (() => {
    let max = 0;
    document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) max = Math.max(max, r.right);
    });
    return max || 170;
  })();

  function inMain(el) { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sidebar + 30; }
  function visible(el) {
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }
  function absTop(el) { let t = 0, n = el; while (n) { t += n.offsetTop || 0; n = n.offsetParent; } return t; }

  // ── Vue-aware click ──────────────────────────────────────────────
  // This is a Vue.js app. Vue 3 stores event invokers in el._vei.
  // We also remove the `disabled` attribute temporarily, since Bootstrap
  // may block pointer events when [disabled] attribute is present.
  function fireClick(el) {
    // 1. Remove disabled attribute if present (Bootstrap pointer-events fix)
    const prevDisabled = el.getAttribute('disabled');
    if (prevDisabled !== null) el.removeAttribute('disabled');

    // 2. Native click (works for addEventListener-based handlers)
    el.click();

    // 3. Full mouse event sequence
    ['mousedown', 'mouseup', 'click'].forEach(type =>
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
    );

    // 4. Vue 3: invoke _vei (Vue Event Invokers) on element + parents
    function tryVue3(node) {
      if (!node?._vei) return false;
      const invoker = node._vei.onClick || node._vei.click;
      if (!invoker) return false;
      const fn = invoker.value || invoker;
      if (typeof fn !== 'function') return false;
      try { fn(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; } catch { return false; }
    }

    // 5. Vue 2: access __vue__ component listeners
    function tryVue2(node) {
      const vm = node?.__vue__;
      if (!vm) return false;
      if (typeof vm.$listeners?.click === 'function') {
        try { vm.$listeners.click(new MouseEvent('click', { bubbles: true })); return true; } catch {}
      }
      return false;
    }

    let node = el;
    for (let i = 0; i < 5; i++) {
      if (!node) break;
      if (tryVue3(node) || tryVue2(node)) break;
      node = node.parentElement;
    }

    // 6. Restore disabled
    if (prevDisabled !== null) el.setAttribute('disabled', prevDisabled);
  }

  // ── PASS 1: Grade Buttons ────────────────────────────────────────
  let gradeEls = [...document.querySelectorAll('label.btn')].filter(el => {
    const t = el.textContent.trim();
    return GRADE.test(t) && t.length < 200 && inMain(el) && visible(el);
  });
  if (gradeEls.length === 0) {
    gradeEls = [...document.querySelectorAll('div,span,button,a,p,li')].filter(el => {
      const t = el.textContent.trim();
      if (!GRADE.test(t) || t.length > 200) return false;
      if ([...el.children].some(c => GRADE.test(c.textContent))) return false;
      return inMain(el) && visible(el);
    });
  }

  if (gradeEls.length === 0) return { error: 'No grade buttons found. Are you on the Assessment page?' };

  // Group by ancestor (level 1–4) until valid groups found
  let gradeGroups = [];
  for (let lv = 1; lv <= 4; lv++) {
    const map = new Map();
    gradeEls.forEach(el => {
      let p = el; for (let i = 0; i < lv; i++) p = p?.parentElement;
      if (!p) return;
      if (!map.has(p)) map.set(p, []); map.get(p).push(el);
    });
    gradeGroups = [...map.values()].filter(g => g.length >= 2 && g.length <= 12);
    if (gradeGroups.length > 0) break;
  }

  if (gradeGroups.length === 0) return { error: 'Could not group grade buttons.' };

  // Sort each group left→right, top→bottom so index 0 = A+, index 1 = A
  gradeGroups.forEach(g => g.sort((a, b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return Math.abs(ra.top - rb.top) > 8 ? ra.top - rb.top : ra.left - rb.left;
  }));
  gradeGroups.sort((a, b) => absTop(a[0]) - absTop(b[0]));

  let gradesCount = 0;
  gradeGroups.forEach(group => {
    const pick = group[Math.floor(Math.random() * 2)] || group[0]; // A+ or A
    fireClick(pick);
    gradesCount++;
  });

  // ── PASS 2: Future Steps (working — unchanged) ───────────────────
  const allRadios = [...document.querySelectorAll('input[type="radio"]')]
    .filter(r => !r.disabled && inMain(r) && visible(r));

  allRadios.sort((a, b) => absTop(a) - absTop(b));
  const radioGroups = [];
  if (allRadios.length > 0) {
    let cur = [allRadios[0]], topY = absTop(allRadios[0]);
    for (let i = 1; i < allRadios.length; i++) {
      const t = absTop(allRadios[i]);
      if (t - topY < 160) cur.push(allRadios[i]); else { radioGroups.push(cur); cur = [allRadios[i]]; topY = t; }
    }
    radioGroups.push(cur);
  }

  let futureStepsCount = 0;
  radioGroups.forEach(group => {
    if (!group.length) return;
    const pick = group[Math.floor(Math.random() * Math.min(2, group.length))];
    group.forEach(r => { r.checked = false; });
    pick.checked = true;
    pick.dispatchEvent(new Event('change', { bubbles: true }));
    pick.click();
    futureStepsCount++;
  });

  return { grades: gradesCount, futureSteps: futureStepsCount };
}

function injected_reset() {
  const sidebar = (() => {
    let max = 0;
    document.querySelectorAll('nav,aside,[role="navigation"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.left < 60 && r.width < window.innerWidth * 0.45 && r.height > 200) max = Math.max(max, r.right);
    });
    return max || 170;
  })();
  function inMain(el) { const r = el.getBoundingClientRect(); return (r.left + r.width / 2) > sidebar + 30; }
  document.querySelectorAll('input[type="radio"]').forEach(r => {
    if (!inMain(r)) return;
    r.checked = false;
    r.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
