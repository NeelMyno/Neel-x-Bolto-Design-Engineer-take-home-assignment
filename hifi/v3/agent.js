/* Bolto hi-fi v3: the agent. A static demo: deterministic matching, no model behind it.
   One offer state, S (v2's). The agent reads and writes S.f, S.src, S.conf, S.prop through v2's put, putPay, onCommit, refresh, missing. */
window.Agent = (function(){
const ic = (n, c) => Icons.svg(n, c);
/* the agent's avatar is Bolto's own brandmark, the same bolt as the logo */
const mark = c => `<svg class="ic ${c}" viewBox="0 0 39 40" aria-hidden="true"><path d="M23.0102 16.8088L37.9008 1.044C38.2734 0.6496 37.9942 0 37.4522 0H19.531C19.3654 0 19.2066 0.0665976 19.0906 0.184998L0.178423 19.4544C-0.205577 19.8458 0.0712226 20.507 0.618823 20.507H15.9848C16.667 20.507 17.22 21.061 17.22 21.7444V39.38C17.22 39.926 17.8746 40.2044 18.2666 39.8252L38.81 19.9608C39.2098 19.5744 38.9366 18.897 38.3812 18.897H23.9076C22.8234 18.897 22.2652 17.5978 23.0102 16.8088Z"/></svg>`;
const h = esc;

/* ===================== data: open roles. Marked invented except the brief's terms ===================== */
const job = (title, loc, office, type, unit, min, max, lines, duties, n) => ({title, loc, office, type, unit, min, max, lines, duties, n}); // invented
const ROLES = [
  {id:'alex', title:'Senior full-stack engineer', cand:'Alex Rivera', status:'approved', posting:POSTINGS.alex},
  {id:'marcus', title:'Customer support specialist', cand:'Marcus Bell', status:'approved', // invented
    posting:job('Customer support specialist', 'On-site', 'ny', 'Full-time', 'Hourly', 22, 26, ['Answer customer questions by phone and email', 'Keep customer records up to date'], '', 0), // invented
    offer:{first:'Marcus', last:'Bell', email:'marcus.bell@example.com', title:'Customer support specialist', startDate:'2026-06-08', amount:'24'}, reportsTo:'Sam Patel'}, // invented
  {id:'priya', title:'Product designer', cand:'Priya Shah', status:'chosen', posting:POSTINGS.priya},
  ...[['ae', 'Account executive', 'Remote', '', 'Salary', 90000, 120000, 6], ['data', 'Data analyst', 'Hybrid', 'ny', 'Salary', 85000, 110000, 4], ['mkt', 'Marketing manager', 'Hybrid', 'ny', 'Salary', 100000, 130000, 3], // invented
      ['office', 'Office manager', 'On-site', 'ny', 'Hourly', 28, 36, 5], ['qa', 'QA engineer', 'Remote', '', 'Salary', 95000, 125000, 2], ['rec', 'Recruiter', 'Remote', '', 'Salary', 80000, 105000, 7], ['pay', 'Payroll specialist', 'Hybrid', 'ny', 'Salary', 75000, 95000, 1]] // invented
    .map(([id, t, loc, of, u, a, b, n]) => ({id, title:t, cand:'', status:'none', n, posting:job(t, loc, of, 'Full-time', u, a, b, [`Own the day-to-day work of the ${t.toLowerCase()} role`], '', n)}))
];
const RANK = {approved:0, chosen:1, none:2};
const sorted = () => ROLES.slice().sort((a, b) => RANK[a.status] - RANK[b.status]);

/* ===================== Motion: the score A1-A21. Every duration and curve is a token; only transform, opacity and clip-path move ===================== */
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const px = n => parseFloat(cssv(n)) || 0;
const instant = () => Motion.reduced() || ag().fast;
function bezier(n){ const [a, b, c, d] = cssv(n).match(/[\d.]+/g).map(Number), B = (p, q, t) => 3 * (1 - t) * (1 - t) * t * p + 3 * (1 - t) * t * t * q + t * t * t;
  return x => { if(x <= 0) return 0; if(x >= 1) return 1; let lo = 0, hi = 1, t = x; for(let i = 0; i < 12; i++){ const v = B(a, c, t); if(v < x) lo = t; else hi = t; t = (lo + hi) / 2; } return B(b, d, t); }; }
const live = new Set();
const Mo = {
  wait: tok => new Promise(r => setTimeout(r, instant() ? 0 : Motion.ms(tok))),
  words: t => h(t).split(' ').map((w, i) => `<span class="ag-w" style="--i:${i}">${w}</span>`).join(' '),
  rise(el){ if(!el || instant()) return; const late = Math.max(0, ag().lateUntil - performance.now()); if(late) el.style.setProperty('--late', `${Math.round(late)}ms`); el.classList.add('ag-rise'); },
  /* a new agent turn: avatar pops once, words arrive, then the block's items rise in order (A1, A2, A18) */
  enter(el){ if(instant()) return; const late = Math.max(0, ag().lateUntil - performance.now()), n = el.querySelectorAll('.ag-text .ag-w').length, wd = Math.min(n * Motion.ms('--ag-word-step'), Motion.ms('--d-base'));
    el.style.setProperty('--late', `${Math.round(late)}ms`); el.style.setProperty('--wd', `${Math.round(wd)}ms`);
    el.querySelector('.ag-av').classList.add('ag-pop'); el.querySelector('.ag-name').classList.add('ag-fade'); el.querySelector('.ag-text').classList.add('is-words');
    $$('.ag-block > :not(.ag-rows):not(.ag-chips):not(.ag-review):not(.ag-roles), .ag-rows > *, .ag-chips > *, .ag-review > :not(.ag-sum), .ag-sum > tbody, .ag-roles > .ag-rw', el).filter(x => !(x.parentElement.closest('.ag-state'))).forEach((x, i) => { x.style.setProperty('--i', i); x.classList.add('ag-in'); }); },
  fold(el){ if(!el) return Promise.resolve(); el.classList.add('is-closing'); el.inert = true;
    return new Promise(r => setTimeout(() => { el.remove(); r(); }, instant() ? 0 : Motion.ms('--d-close'))); },
  toBottom(){ ag().toEnd = false; Mo.follow(); },
  el: () => wide() ? $('.ag-scroll') : document.scrollingElement,
  /* where the thread comes to rest once every fold now moving has landed. The bottom, or the top of the newest turn when that turn is taller than the view (under the sticky stack on phones) */
  target(e){ const A = ag(), pg = e === document.scrollingElement, last = A.thread.lastElementChild, isT = last && last.matches('.ag-turn'), folds = $$('.ag-fold.is-closing, .ag-tool.is-folded .ag-tool-body', A.thread), all = folds.reduce((a, x) => a + x.offsetHeight, 0), above = folds.filter(x => !(isT && last.contains(x))).reduce((a, x) => a + x.offsetHeight, 0),
      tw = $('#ag-trackw'), trk = $('#ag-track'), td = !tw ? 0 : tw.classList.contains('is-on') ? trk.offsetHeight - tw.offsetHeight : -tw.offsetHeight, hf = $('#ag-help-f'), chips = hf ? [...hf.firstElementChild.children] : [], hd2 = !hf ? 0 : (hf.classList.contains('is-on') && chips.length ? Math.max(...chips.map(x => x.offsetTop + x.offsetHeight)) - chips[0].offsetTop + px('--s2') : 0) - hf.offsetHeight, af = $('#ag-approve-f'), afc = af ? getComputedStyle(af.firstElementChild) : null, afm = af ? parseFloat(afc.marginTop) + parseFloat(afc.marginBottom) : 0, ad = !af ? 0 : (af.classList.contains('is-on') ? af.firstElementChild.scrollHeight : parseFloat(afc.paddingTop) + parseFloat(afc.paddingBottom)) + afm - af.offsetHeight, B = e.scrollHeight - e.clientHeight - all + hd2 + td + ad;
    let T = B; if(isT && !A.toEnd){ const pv = last.previousElementSibling, r = (pv && pv.matches('.ag-me') && !last.matches('.ag-turn-review') ? pv : last).getBoundingClientRect(), top = r.top + e.scrollTop - above, sw = $('.hx-switch'), hd = $('.hx-header'), head = pg ? (tw && tw.classList.contains('is-on') ? parseFloat(getComputedStyle(tw).top) + tw.offsetHeight + td + px('--s1') : (hd ? hd.offsetHeight : 0) + (sw ? sw.offsetHeight : 0) + px('--s4')) : e.getBoundingClientRect().top + px('--ag-fade'); T = Math.min(B, top - head); const L = A.landRow; if(L && L.isConnected){ const q = L.getBoundingClientRect(), y = q.top + e.scrollTop - above, foot = $('#ag-foot'), vb = (pg ? innerHeight - (foot ? foot.offsetHeight : 0) : e.getBoundingClientRect().bottom - Math.max(0, td)) - Math.max(0, ad + hd2); if(y + q.height - T > vb) T = Math.min(B, y - (head + vb - q.height) / 2); } }
    return Math.max(0, Math.round(T)); },
  /* A21: follow only while the person is at the bottom. Sets the end state at once */
  pin(){ const A = ag(), e = Mo.el(); if(!e || !A.stick || !A.thread.offsetParent) return 0; const y0 = e.scrollTop; e.scrollTop = Mo.target(e); A.lastSet = e.scrollTop; return e.scrollTop - y0; },
  /* one scroll per change: eased on the morph's curve toward where the layout will end, never toward where it is now */
  follow(){ const A = ag(), e = Mo.el(); if(!e || !A.stick || !A.thread.offsetParent) return; if(instant()){ Mo.pin(); return; } if(A.fl) return; if(Math.abs(Mo.target(e) - e.scrollTop) < 1) return;
    const ease = bezier('--ease-move'), D = Motion.ms('--ag-morph'); A.fl = {y0:e.scrollTop, t0:0, T:null};
    const step = n => { const G = A.fl, e2 = Mo.el(); if(!G || S.ag !== A || !e2 || !A.stick || !A.thread.offsetParent){ A.fl = null; return; } const T = Mo.target(e2); if(!G.t0) G.t0 = n; if(G.T === null || Math.abs(T - G.T) > 4){ G.y0 = e2.scrollTop; G.t0 = n; } G.T = T;
      const p = Math.min(1, (n - G.t0) / D), y = G.y0 + (T - G.y0) * ease(p), up = T >= G.y0; e2.scrollTop = up ? Math.max(e2.scrollTop, y) : Math.min(e2.scrollTop, y); A.lastSet = e2.scrollTop; if(p < 1){ requestAnimationFrame(step); return; } A.fl = null; if(Math.abs(Mo.target(e2) - e2.scrollTop) >= 1) Mo.follow(); Mo.latest(); };
    requestAnimationFrame(step); },
  grew(){ const A = ag(); if(!A.thread.offsetParent) return; Mo.follow(); Mo.latest(); },
  latest(){ const A = ag(), b = $('#ag-latest'), e = Mo.el(); if(!b || !e) return; const max = e.scrollHeight - e.clientHeight, quiet = A.sending || A.busy || performance.now() < Math.max(A.quietUntil || 0, A.lateUntil), on = max > 32 && !quiet && (!A.stick || (max - e.scrollTop > 32 && !A.fl)); if(quiet || A.fl){ clearTimeout(A.latT); A.latT = setTimeout(() => { if(S.ag === A) Mo.latest(); }, Motion.ms('--d-slow', {raw:true})); } const lab = $('#ag-latest-t'), w = A.open && A.open.id === 'review' ? 'More below' : 'Latest', fb = $('#ag-fade-b'); if(lab && on && lab.textContent !== w) lab.textContent = w; if(fb) fb.classList.toggle('is-on', on); b.classList.toggle('is-on', on); b.tabIndex = on ? 0 : -1; },
  bindScroll(){ const A = ag(); if(!A.ro && window.ResizeObserver){ A.ro = new ResizeObserver(() => { if(S.ag === A) Mo.grew(); }); A.ro.observe(A.thread); }
    const on = () => { const B = ag(), e = Mo.el(), now = performance.now(); if(!e || !B.thread.offsetParent || Math.abs(e.scrollTop - B.lastSet) < 2 || now < (B.quietUntil || 0)) return; if(now < (B.landUntil || 0)){ e.scrollTop = Mo.target(e); B.lastSet = e.scrollTop; return; } B.toEnd = e.scrollHeight - e.scrollTop - e.clientHeight < 2; B.stick = e.scrollHeight - e.scrollTop - e.clientHeight < 32 || Math.abs(Mo.target(e) - e.scrollTop) < 32; Mo.latest(); };
    const s = $('.ag-scroll'); if(s) s.addEventListener('scroll', on, {passive:true}); if(!window.__agScroll){ window.__agScroll = true; window.addEventListener('scroll', on, {passive:true}); }
    A.thread.addEventListener('animationend', Mo.settled); },
  settled(e){ const t = e.target; if(!e.animationName.startsWith('ag-') || !t.classList) return; t.classList.remove('ag-in', 'ag-rise', 'ag-pop', 'ag-fade', 'is-new'); if(t.matches('.ag-w:last-child')){ const p = t.parentElement; if(p) p.classList.remove('is-words'); } },
  /* finish everything that is in the air, at once. Used before a mode switch and a reset */
  flush(){ [...live].forEach(f => f()); $$('.ag-in, .ag-rise, .ag-pop, .ag-fade, .is-new', ag().thread).forEach(x => x.classList.remove('ag-in', 'ag-rise', 'ag-pop', 'ag-fade', 'is-new')); $$('.is-words', ag().thread).forEach(x => x.classList.remove('is-words')); $$('.ag-sent', ag().thread).forEach(x => x.classList.add('is-static')); },
  work(el, on){ const A = ag(); if(A.workEl){ A.workEl.classList.remove('is-working'); A.workEl = null; } if(on && el){ A.workEl = el.querySelector('.ag-av'); if(A.workEl && !instant()) A.workEl.classList.add('is-working'); } document.body.classList.toggle('ag-working', !!on); if(on) Mo.latest(); },
  /* the one flight primitive: transform only, re-reads its target every frame, so it lands true while the thread or the letter scrolls */
  fly(el, from, to, ms, o = {}){ return new Promise(res => { const ease = bezier('--ease-move'); let done = false, id = 0, t0 = 0, f = null;
      const fin = () => { if(done) return; done = true; cancelAnimationFrame(id); clearTimeout(g); live.delete(fin); res(); };
      const step = n => { if(done) return; if(!t0){ t0 = n + (o.delay || 0); } if(n < t0){ id = requestAnimationFrame(step); return; } if(!f){ f = from(); if(o.start) o.start(); }
        const p = Math.min(1, (n - t0) / ms), q = ease(p), T = to(), x = f.x + (T.x - f.x) * q, y = f.y + (T.y - f.y) * q - (o.arc || 0) * Math.sin(Math.PI * q); el.style.transform = `translate3d(${x}px, ${y}px, 0)`; if(p >= 1){ fin(); return; } id = requestAnimationFrame(step); };
      const g = setTimeout(fin, ms + (o.delay || 0) + Motion.ms('--ag-fly-guard', {raw:true})); live.add(fin); id = requestAnimationFrame(step); }); },
  dur(a, b){ const min = Motion.ms('--ag-fly-min'), max = Motion.ms('--ag-fly-max'); return min + (max - min) * Math.min(1, Math.hypot(a.x - b.x, a.y - b.y) / 1000); },
  /* A4: the pressed row stays in flow and becomes the reply. No second copy */
  morph(src, label){
    const A = ag(), r0 = src.getBoundingClientRect(), ph = document.createElement('div'); ph.className = 'ag-ph'; ph.style.height = `${r0.height}px`; ph.style.width = `${r0.width}px`; src.before(ph);
    src.removeAttribute('data-ag'); src.classList.add('is-pressed');
    const me = document.createElement('div'); me.className = 'ag-me is-morph'; me.innerHTML = `<div class="ag-bubble ag-morph-real">${h(label).replace(/\n/g, '<br>')}</div>`; const real = me.firstChild; A.thread.appendChild(me);
    const bw = real.offsetWidth, bh = real.offsetHeight, cs = getComputedStyle(real), pad = parseFloat(cs.paddingLeft), lh = parseFloat(cs.lineHeight), rEnd = cs.borderTopRightRadius, rStart = getComputedStyle(src).borderTopRightRadius;
    src.style.width = `${r0.width}px`; src.style.height = `${r0.height}px`; me.appendChild(src); const r1 = src.getBoundingClientRect(), dx = r0.left - r1.left, dy = r0.top - r1.top, clip = Math.max(0, r0.width - bw), vc = Math.max(0, (r0.height - bh) / 2), D = Motion.ms('--ag-morph'), E = cssv('--ease-move'), o = {duration:D, easing:E, fill:'both'};
    const lab = src.querySelector('.ag-row-l, .ag-role-l, .ag-chip-l'), keep = src.querySelector('.ag-keep'), said = lab ? (lab.firstChild ? lab.firstChild.textContent : '') + (keep ? ' ' + keep.textContent : '') : '';
    const slide = lab && said === label && lab.offsetHeight <= lh * 1.5 && bh <= lh * 1.5 + 2 * parseFloat(cs.paddingTop), a = [], fade = {duration:D * 0.6, delay:D * 0.25, easing:E, fill:'both'};
    a.push(src.animate([{transform:`translate(${dx}px, ${dy}px)`, clipPath:`inset(0 0 0 0 round ${rStart})`}, {transform:`translate(0, ${-vc}px)`, clipPath:`inset(${vc}px 0 ${vc}px ${clip}px round ${rEnd})`}], o));
    a.push(src.animate([{opacity:1, offset:0}, {opacity:1, offset:0.35}, {opacity:0, offset:1}], {duration:D, easing:'linear', fill:'both', pseudoElement:'::before'}));
    const fadeO = {duration:Motion.ms('--ag-out'), easing:cssv('--ease-exit'), fill:'both'}, others = [...src.children].filter(x => !(slide && (x === lab || x === keep)));
    if(slide){ const pair = keep ? [[lab, lab.firstChild.textContent], [keep, keep.textContent]] : [[lab, label]]; real.innerHTML = pair.map(p => `<span class="ag-part">${h(p[1])}</span>`).join(' '); real.classList.add('is-slide'); lab.style.flex = 'none'; const parts = [...real.children];
      pair.forEach(([x], i) => { const sr = x.getBoundingClientRect(), pr = parts[i].getBoundingClientRect(), off = pr.left - sr.left; a.push(x.animate([{transform:'translateX(0)'}, {transform:`translateX(${off}px)`}], o)); a.push(x.animate([{opacity:1}, {opacity:0}], fade)); a.push(parts[i].animate([{transform:`translate(${dx - off}px, ${dy + vc}px)`}, {transform:'translate(0, 0)'}], o)); a.push(parts[i].animate([{opacity:0}, {opacity:1}], fade)); }); }
    else { a.push(real.animate([{transform:`translate(${dx}px, ${dy}px)`}, {transform:'translate(0, 0)'}], o)); a.push(real.animate([{opacity:0}, {opacity:1}], {duration:D * 0.6, delay:D * 0.4, easing:cssv('--ease-enter'), fill:'both'})); }
    others.forEach(x => a.push(x.animate([{opacity:1}, {opacity:0}], fadeO)));
    let fin = false; const done = () => { if(fin) return; fin = true; live.delete(done); a.forEach(x => x.cancel()); src.remove(); real.classList.remove('ag-morph-real', 'is-slide'); real.innerHTML = h(label).replace(/\n/g, '<br>'); me.classList.remove('is-morph'); };
    live.add(done); Promise.all(a.map(x => x.finished)).then(done, () => {}); setTimeout(done, D * 1.5 + Motion.ms('--ag-fly-guard', {raw:true})); A.lateUntil = performance.now() + D * 0.5; A.stick = true; return me;
  },
  /* A5: the sent text lifts from the field to its bubble */
  lift(me, r){ const b = me.querySelector('.ag-bubble'), cs = getComputedStyle(b), rb = b.getBoundingClientRect(), f = document.createElement('div'); f.className = 'ag-flyer'; f.style.width = `${rb.width}px`; f.innerHTML = `<i></i>${b.innerHTML}`; b.style.visibility = 'hidden';
    document.body.appendChild(f); const from = () => ({x:r.left - parseFloat(cs.paddingLeft), y:r.top - parseFloat(cs.paddingTop)}), to = () => { const q = b.getBoundingClientRect(); return {x:q.left, y:q.top}; }, ms = Mo.dur(from(), to());
    f.style.transform = `translate3d(${from().x}px, ${from().y}px, 0)`; f.firstChild.animate([{opacity:0}, {opacity:1}], {duration:ms, easing:cssv('--ease-move'), fill:'both'});
    return Mo.fly(f, from, to, ms).then(() => { b.style.visibility = ''; f.remove(); }); },
  /* A11: the old letter fades out on top of the new one */
  letterFade(){ const L = $('#letter'), box = $('#ltScroll'); if(!L || !box || !L.offsetParent || instant()) return; if(getComputedStyle(box).position === 'static') box.style.position = 'relative'; const h0 = L.offsetHeight, old = L.cloneNode(true); old.removeAttribute('id'); old.setAttribute('aria-hidden', 'true'); old.classList.add('ag-letter-old'); old.style.cssText = `position:absolute;left:${L.offsetLeft}px;top:${L.offsetTop}px;width:${L.offsetWidth}px;margin:0;pointer-events:none`; box.appendChild(old);
    const D = Motion.ms('--ag-letter', {raw:true}), E = cssv('--ease-move'), off = () => old.remove(), bleed = px('--s8'), cl = x => `inset(${-bleed}px ${-bleed}px ${x}px ${-bleed}px)`; old.animate([{opacity:1}, {opacity:0}], {duration:D, easing:E, fill:'both'}).finished.then(off, off);
    queueMicrotask(() => { const N = $('#letter'); if(!N) return; const d = N.offsetHeight - h0; if(d > 0) N.animate([{clipPath:cl(d)}, {clipPath:cl(-bleed)}], {duration:D, easing:E}); else if(d < 0) old.animate([{clipPath:cl(-bleed)}, {clipPath:cl(-d)}], {duration:D, easing:E, fill:'both'}); }); },
  /* a value lands after its pill has gone, so the two never overlap */
  landValue(k){ if(instant()) return; const v = $(`#letter [data-v="${k}"]`); if(v) v.animate([{opacity:0}, {opacity:1}], {duration:Motion.ms('--d-fast'), delay:Motion.ms('--ag-out'), easing:cssv('--ease-enter'), fill:'backwards'}); },
  /* the gap the agent is asking about outlines once */
  outline(ks){ if(instant() || !ks.length) return; const go = n => { if(S.holdLetter && n){ setTimeout(() => go(n - 1), Motion.ms('--ag-fly-max')); return; } ks.forEach(k => $$(`#letter .gap[data-go="${k}"]`).forEach(x => { x.classList.remove('ag-gap-on'); void x.offsetWidth; x.classList.add('ag-gap-on'); setTimeout(() => x.classList.remove('ag-gap-on'), Motion.ms('--d-glow')); })); }; setTimeout(() => go(3), Motion.ms('--ag-fly-max')); },
  /* a value flies from the letter back to the line that made it */
  flyBack(r, text, to){ if(instant() || !to) return; const pill = document.createElement('div'); pill.className = 'ag-pill is-on'; pill.textContent = text; pill.setAttribute('aria-hidden', 'true'); document.body.appendChild(pill); const from = () => ({x:r.left, y:r.top + (r.height - pill.offsetHeight) / 2}), dest = () => { const q = to.getBoundingClientRect(); return {x:q.left, y:q.top + (q.height - pill.offsetHeight) / 2}; }; pill.style.transform = `translate3d(${from().x}px, ${from().y}px, 0)`; Mo.fly(pill, from, dest, Mo.dur(from(), dest())).then(() => { pill.classList.remove('is-on'); setTimeout(() => pill.remove(), Motion.ms('--ag-out')); }); }
};
const wide = () => matchMedia('(min-width: 1024px)').matches;

/* A10: shared-axis swap. Safe mid-animation: a new swap completes the old one first */
let SW = null;
function swapIn(st){ clearTimeout(st.t); st.outs.forEach(a => a.cancel()); st.apply(); if(SW !== st) return; st.phase = 'in'; const s = px('--ag-shift'), o = {duration:Motion.ms('--d-base'), easing:cssv('--ease-enter'), fill:'backwards'};
  st.ins = st.inEls().filter(e => e && e.getClientRects().length).map(e => e.animate([{opacity:0, transform:`translateX(${st.dir * s}px)`}, {opacity:1, transform:'translateX(0)'}], o)); Promise.all(st.ins.map(a => a.finished)).then(() => { if(SW === st) SW = null; }, () => {}); }
function finishSwap(){ if(!SW) return; const st = SW; SW = null; if(st.phase === 'in') st.ins.forEach(a => a.cancel()); else { clearTimeout(st.t); st.outs.forEach(a => a.cancel()); st.apply(); } }
function swapPanes(dir, outEls, apply, inEls){ finishSwap(); if(Motion.reduced()){ apply(); return; } const s = px('--ag-shift'), d = Motion.ms('--ag-out'), st = {dir, apply, inEls, ins:[], phase:'out'}; SW = st;
  st.outs = outEls.filter(e => e && e.getClientRects().length).map(e => e.animate([{opacity:1, transform:'translateX(0)'}, {opacity:0, transform:`translateX(${-dir * s}px)`}], {duration:d, easing:cssv('--ease-exit'), fill:'forwards'})); st.t = setTimeout(() => swapIn(st), d); }

/* A7: the answer travels to where it lands. The letter (and a tracker cell) hold their render until it does; the guard in fly() means state is never lost */
const NO_TRAVEL = new Set(['work', 'bonusOpen', 'equityOpen', 'bonusRepay', 'department', 'payrollGroup']);
const stepOf = k => (STEPS.find(s => s.keys.includes(k) || s.fields.includes(k)) || {}).id;
const seen = e => e && e.getClientRects().length > 0;
function letterSpot(k){ return $(`#letter [data-v="${k}"]`) || $(`#letter .gap[data-go="${k}"]`); }
function travel(fromEl, mutate){
  const A = ag(); if(instant() || !fromEl){ mutate(); return; }
  const before = {...S.f}; A.holds++; S.holdLetter = true; A.trackHold++;
  mutate();
  const keys = Object.keys(S.f).filter(k => S.f[k] !== before[k] && S.f[k] !== '' && S.f[k] !== false && !NO_TRAVEL.has(k)).slice(0, 3);
  const plan2 = keys.map(k => { const inL = seen(letterSpot(k)), id = stepOf(k), cell = id && $(`#ag-track [data-ag="step:${id}"] .ag-step-v`); return inL ? {k, where:'letter'} : seen(cell) ? {k, where:'track', id} : null; }).filter(Boolean);
  const toTrack = plan2.some(p => p.where === 'track');
  const relT = () => { A.trackHold--; if(S.ag === A) renderTrack(); }, relL = () => { if(S.ag !== A) return; A.holds--; S.holdLetter = false; keys.forEach(k => { if(typeof S.f[k] !== 'boolean') markFresh(k); }); if(A.fadeLetter){ A.fadeLetter = false; Mo.letterFade(); } updateLetter(); keys.filter(k => plan2.some(p => p.k === k && p.where === 'letter')).forEach(Mo.landValue); S.holdLetter = A.holds > 0; };
  if(!plan2.length){ relT(); relL(); return; }
  if(!toTrack) relT();
  const fl = plan2.find(p => p.where === 'letter'); if(fl) scrollLetterTo(fl.k);
  const delay = Math.max(Motion.ms('--ag-fly-delay'), A.lateUntil - performance.now()), gap = Motion.ms('--ag-land');
  Promise.all(plan2.map((p, i) => { const pill = document.createElement('div'); pill.className = 'ag-pill'; pill.textContent = p.k === 'duties' ? stepValue(STEPS[2], 0) || disp(p.k, S.f[p.k]) : disp(p.k, S.f[p.k]); pill.setAttribute('aria-hidden', 'true'); document.body.appendChild(pill);
    const from = () => { const r = fromEl.getBoundingClientRect(); return {x:r.right - pill.offsetWidth, y:r.top + (r.height - pill.offsetHeight) / 2}; };
    const to = () => { const t = p.where === 'letter' ? letterSpot(p.k) : $(`#ag-track [data-ag="step:${p.id}"] .ag-step-v`), r = t ? t.getBoundingClientRect() : pill.getBoundingClientRect(); return {x:r.left, y:r.top + (r.height - pill.offsetHeight) / 2}; };
    const f = from(), ms = Mo.dur(f, to()); return Mo.fly(pill, from, to, ms, {delay:delay + i * gap, arc:p.where === 'letter' ? px('--ag-arc') : 0, start:() => pill.classList.add('is-on')}).then(() => { pill.classList.remove('is-on'); setTimeout(() => pill.remove(), Motion.ms('--ag-out')); }); }))
    .then(() => { relL(); if(toTrack) relT(); });
}
function scrollLetterTo(k){ const box = $('#ltScroll'), t = letterSpot(k); if(!box || !t || box.scrollHeight <= box.clientHeight) return; const b = box.getBoundingClientRect(), r = t.getBoundingClientRect(), y0 = box.scrollTop, y1 = Math.max(0, Math.min(box.scrollHeight - box.clientHeight, y0 + r.top - b.top - b.height / 2)), ms = Motion.ms('--ag-fly-max'), ease = bezier('--ease-move'), t0 = performance.now();
  const step = n => { const p = Math.min(1, (n - t0) / ms); box.scrollTop = y0 + (y1 - y0) * ease(p); if(p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }

/* ===================== state helpers ===================== */
function ag(){
  if(!S.ag){
    const thread = document.createElement('div'); thread.className = 'ag-thread'; thread.setAttribute('role', 'log'); thread.setAttribute('aria-live', 'off'); thread.tabIndex = -1;
    S.ag = {thread, started:false, picked:false, role:null, open:null, skip:new Set(), extrasDone:false, undo:[], busy:false, queue:[], snap:null, scroll:{agent:0, form:0}, showAll:false, fast:false, autoSaid:'', how:'pointer', draft:'', greeted:false, formLeft:false, trackOn:false, trackArrived:false, stick:true, lastSet:0, holds:0, trackHold:0, lateUntil:0, echo:null, workEl:null, fadeLetter:false, helpers:'', helpT:0, ro:null};
  }
  return S.ag;
}
const scroller = () => wide() ? $('.ag-scroll') : null;
const snapshot = () => JSON.stringify({f:S.f, src:S.src, conf:S.conf, prop:S.prop, typed:S.typed, pg:S.pgOverride, ob:S.otBasis, om:S.otMode, cand:S.cand, posting:S.posting, style:S.style, picked:ag().picked, role:ag().role, extras:ag().extrasDone, skip:[...ag().skip]});
function restore(j){ const o = JSON.parse(j), A = ag(); Object.assign(S, {f:o.f, src:o.src, conf:o.conf, prop:o.prop, typed:o.typed, pgOverride:o.pg, otBasis:o.ob, otMode:o.om, cand:o.cand, posting:o.posting, style:o.style});
  if(!o.picked && S.bar) showBar(false); A.picked = o.picked; A.role = o.role; A.extrasDone = o.extras; A.skip = new Set(o.skip || []); syncStyle(); refresh(null, true); renderTrack(); }
/* the tabs above the letter are one more way to answer the same question, so the summary and an open question move with them */
function onStyle(v){ const A = ag(), o = A.open; if(v === S.style) return; pushUndo(snapshot()); S.style = v; updateLetter(); saveDraft(); if(!o) return; if(o.id === 'review') refreshReview(); else if(o.id === 'style'){ closeOpen(); next(); } else if(o.id === 'list'){ const r = o.el.querySelector('[data-ag="field:style"] .ag-row-r'); if(r) r.textContent = v; } }
function syncStyle(){ const r = $(`input[name=style][value="${S.style}"]`); if(r){ r.checked = true; const sg = r.closest('.seg'); if(sg) Segmented.sync(sg, true); } updateLetter(); }
function set(k, v){ const prev = S.f.empType; S.f[k] = v; if(!S.src[k]) S.typed[k] = true; S.lastField = k; if(typeof v !== 'boolean') markFresh(k); onCommit(k, prev); renderTrack(); }
/* no name yet: one set of words for every sentence that would have used it */
const name1 = () => who() || 'them';
const they = () => who() || 'they';
const theyGet = (one, many) => who() ? `${who()} ${one}` : `They ${many}`;
const doesThey = () => who() ? `Does ${who()}` : 'Do they';
const NOT_CON = "Overtime and payroll group don't apply to a contractor.";
const rangeText = p => `${money(p.min)} to ${money(p.max)} ${p.unit === 'Hourly' ? 'an hour' : 'a year'}`;
/* the one true answer to "has this draft saved?" (C7) */
const saved = () => !WF.saveFail && S.save !== 'failed' && !!S.savedAt;
const saveBroken = () => WF.saveFail || S.save === 'failed';
const unitWord = () => S.f.payType === 'Hourly' ? 'an hour' : S.f.payType === 'Salary' ? 'a year' : '';
/* one way to write an amount: the letter's. What was typed stays in S.f */
const cash = v => { const n = num(v); return n === null ? `$${String(v).trim().replace(/^\$/, '')}` : money(n); };
const payText = () => S.f.amount ? `${cash(S.f.amount)}${unitWord() ? ' ' + unitWord() : ''}` : '';
const sdt = d => { if(!d) return ''; const [y, m, a] = d.split('-').map(Number); return new Date(y, m - 1, a).toLocaleDateString('en-US', {month:'long', day:'numeric'}); };
const shortDt = d => { if(!d) return ''; const [y, m, a] = d.split('-').map(Number); return new Date(y, m - 1, a).toLocaleDateString('en-US', {month:'short', day:'numeric'}); };
const EMPW = {ft:'Full-time W-2', pt:'Part-time W-2', c:'Contractor 1099'};
function disp(k, v){ if(v === '' || v == null || v === false) return 'not set';
  if(['startDate', 'endDate', 'expiry'].includes(k)) return sdt(v);
  if(k === 'empType') return EMPW[v] || v; if(k === 'state') return stateName(v) || v; if(k === 'workplace') return (OFFICES.find(o => o.id === v) || {}).name || v;
  if(k === 'amount') return `${cash(v)}${unitWord() ? ' ' + unitWord() : ''}`; if(k === 'bonus') return cash(v);
  if(k === 'duties') return DUTIES[v] || v; if(k === 'sender') return sender().name; if(v === true) return 'Yes'; return String(v); }
const LABEL = k => ({empType:'Worker type', first:'First name', last:'Last name', email:'Email', title:'Job title', startDate:'Start date', endDate:'Contract end date', reportsTo:isCon() ? 'Point of contact' : 'Reports to', location:'Where they work', state:'Work state', workplace:'Workplace', payType:'Salary or hourly', amount:'Pay', bonus:'Signing bonus', equity:'Equity', expiry:'Offer expires', duties:'Overtime', payrollGroup:'Payroll group', invite:'Invite to Bolto', style:'Letter style', note:'Personal note', department:'Department', bonusMonths:'Repayment months', sender:'From'}[k] || k);

/* ===================== the planner: always derived fresh from S ===================== */
const BY = {who:['first', 'last', 'email'], job:['title', 'startDate', 'endDate', 'reportsTo'], pay:['payType', 'amount'], bonus:['bonus', 'bonusMonths'], equity:['equity'], expiry:['expiry']};
function plan(){
  const A = ag(), m = new Set(missing().map(x => x.k)), need = ks => ks.filter(k => m.has(k) && !A.skip.has(k));
  const c = Object.keys(S.conf).find(k => !A.skip.has(k)); if(c) return {id:'conf', k:c};
  if(S.prop.amount && !A.skip.has('amount')) return {id:'prop', k:'amount'};
  if(need(BY.who).length) return {id:'who', fields:need(BY.who)};
  if(need(['empType']).length) return {id:'type'};
  if(need(BY.job).length) return {id:'job', fields:need(BY.job)};
  if(need(['location']).length) return {id:'loc'};
  if(need(['state']).length) return {id:'state'};
  if(need(['workplace']).length) return {id:'office'};
  if(need(BY.pay).length) return {id:'pay', fields:BY.pay}; /* both, always: the amount's own error can say "choose Salary", so Salary has to be on the card */
  if(!A.extrasDone && !S.f.bonusOpen && !S.f.equityOpen) return {id:'extras'};
  if(need(BY.bonus).length) return {id:'bonus', fields:['bonus', 'bonusRepay', 'bonusMonths']};
  if(need(BY.equity).length) return {id:'equity', fields:['equity']};
  if(need(['duties']).length) return {id:'ot'};
  if(need(['expiry']).length) return {id:'expiry', fields:['expiry']};
  return null;
}
function qFor(k){
  if(k === 'name') return {id:'who', fields:['first', 'last'], change:true}; if(k === 'department') return {id:'job', fields:['department'], change:true};
  if(BY.who.includes(k)) return {id:'who', fields:[k], change:true}; if(k === 'empType') return {id:'type', change:true};
  if(BY.job.includes(k)) return {id:'job', fields:[k], change:true}; if(k === 'location') return {id:'loc', change:true}; if(k === 'state') return {id:'state', change:true};
  if(k === 'workplace') return {id:'office', change:true}; if(k === 'payType' || k === 'amount') return {id:'pay', fields:['payType', 'amount'], change:true};
  if(k === 'bonus' || k === 'bonusMonths' || k === 'bonusRepay') return {id:'bonus', fields:['bonus', 'bonusRepay', 'bonusMonths'], change:true}; if(k === 'equity') return {id:'equity', fields:['equity'], change:true};
  if(k === 'duties') return {id:'ot', change:true}; if(k === 'expiry') return {id:'expiry', fields:['expiry'], change:true}; if(k === 'payrollGroup') return {id:'pg', change:true};
  if(k === 'invite') return {id:'invite', change:true}; if(k === 'style') return {id:'style', change:true}; if(k === 'note') return {id:'note', fields:['note'], change:true};
  return null;
}

/* ===================== rendering turns ===================== */
function turn(text, block = '', o = {}){
  const A = ag(), el = document.createElement('div'); el.className = 'ag-turn' + (o.cls ? ' ' + o.cls : '');
  el.innerHTML = `<span class="ag-av">${mark('ag-bolt')}${mark('ag-bolt-f')}</span><div class="ag-body"><p class="ag-name">Bolto</p><p class="ag-text">${Mo.words(text)}</p>${block ? `<div class="ag-fold"><div class="ag-block">${block}</div></div>` : ''}</div>`;
  A.thread.appendChild(el); Mo.enter(el); Mo.toBottom();
  if(!o.quiet) say(text + (o.count ? ` ${o.count} options.` : ''));
  return el;
}
function bubble(text, extra = ''){ const A = ag(); if(A.echo && A.echoEl) return A.echoEl; const el = document.createElement('div'); el.className = 'ag-me'; el.innerHTML = `<div class="ag-bubble">${h(text).replace(/\n/g, '<br>')}${extra}</div>`; A.thread.appendChild(el); A.stick = true; if(A.echo) A.echoEl = el; else Mo.rise(el); Mo.toBottom(); return el; }
function line(html, cls = ''){ const A = ag(), el = document.createElement('div'); el.className = 'ag-line ' + cls; el.innerHTML = html; A.thread.appendChild(el); Mo.rise(el); Mo.toBottom(); return el; }
const row = (act, label, o = {}) => `<button type="button" class="ag-row" data-ag="${act}"${o.lab ? ` data-lab="${h(o.lab)}"` : ''}>${o.icon ? ic(o.icon) : ''}<span class="ag-row-l">${h(label)}${o.sub ? `<span class="ag-row-s">${h(o.sub)}</span>` : ''}</span>${o.cur ? `<span class="ag-row-r">${ic('check')}Current</span>` : o.right ? `<span class="ag-row-r${o.keep ? ' ag-keep' : ''}">${h(o.right)}</span>` : ''}${ic('arrow-right', 'ag-arrow')}</button>`;
const chip = (act, label, cur) => `<button type="button" class="ag-chip${cur ? ' is-cur' : ''}" data-ag="${act}">${cur ? ic('check') : ''}<span class="ag-chip-l">${h(label)}</span></button>`;

function fieldHTML(k, q){
  const f = S.f, id = 'ag-f-' + k, lab = t => `<label class="ag-lab" for="${id}">${t}</label>`, err = `<div class="ag-errw"><p class="ag-err" id="${id}-e"></p></div>`;
  if(k === 'payType') return `<fieldset class="ag-fs"><legend class="ag-lab">Salary or hourly</legend><div class="ag-radios">${['Salary', 'Hourly'].map(v => `<label class="ag-radio"><input type="radio" name="payType" value="${v}" ${f.payType === v ? 'checked' : ''}>${v}</label>`).join('')}</div><div class="ag-errw"><p class="ag-err" id="${id}-e"></p></div></fieldset>`;
  if(k === 'reportsTo') return `<div class="ag-field">${lab(isCon() ? 'Point of contact' : 'Reports to')}<select class="input" id="${id}" name="reportsTo"><option value="">Choose</option>${PEOPLE.map(p => `<option ${f.reportsTo === p ? 'selected' : ''}>${h(p)}</option>`).join('')}</select>${err}</div>`;
  if(['startDate', 'endDate', 'expiry'].includes(k)) return `<div class="ag-field">${lab(LABEL(k))}<input class="input" type="date" id="${id}" name="${k}" value="${f[k] || ''}">${err}</div>`;
  if(k === 'bonusRepay') return `<label class="ag-check"><input type="checkbox" id="${id}" name="bonusRepay" ${f.bonusRepay ? 'checked' : ''}>${isCon() ? 'Repaid if they end this engagement early' : 'Repaid if they leave early'}</label>`;
  if(k === 'note') return `<div class="ag-field">${lab('Personal note')}<textarea class="textarea ag-grow" rows="2" id="${id}" name="note">${h(f.note)}</textarea></div>`;
  if(k === 'amount') return `<div class="ag-field">${lab('Amount')}<div class="ag-affix"><span>$</span><input class="input" id="${id}" name="amount" inputmode="decimal" autocomplete="off" value="${h(f.amount)}"><span class="ag-unit">${h(unitWord())}</span></div>${err}</div>`;
  return `<div class="ag-field">${lab(LABEL(k))}<input class="input" id="${id}" name="${k}" autocomplete="off" ${k === 'email' ? 'type="email"' : ''} value="${h(f[k] || '')}">${err}</div>`;
}
const card = (q, extra = '') => `<form class="ag-card" data-card="${q.id}" novalidate>${extra}${q.fields.map(k => fieldHTML(k, q)).join('')}<div class="ag-card-ft"><button type="submit" class="btn btn-primary">Continue</button></div></form>`;

/* a Change asks about the one field it came from; first-time questions keep their section wording */
const NEW_WORD = {first:'first name', last:'last name', email:'email', title:'job title', startDate:'start date', endDate:'contract end date', department:'department', equity:'equity', expiry:'expiry date', note:'personal note'};
function changeText(q){ if(!q.change || !q.fields) return ''; if(q.fields.join() === 'first,last') return "What's the right name?"; if(q.fields.length !== 1) return ''; const k = q.fields[0]; if(k === 'reportsTo') return isCon() ? "What's the new point of contact?" : `Who will ${they()} report to?`; return NEW_WORD[k] ? `What's the new ${NEW_WORD[k]}?` : ''; }
function question(q){ const Q = question0(q), t = changeText(q); if(!Q) return Q; if(t) Q.text = t; if(q.change && Q.help) Q.help = Q.help.map(k => k === 'skip' ? 'keepit' : k); return Q; }
function question0(q){
  const w = name1(), f = S.f, cur = v => q.change && v;
  switch(q.id){
    case 'who': return {text:"Who's the offer for?", html:card(q), ph:'Or type a name and email', help:['skip']};
    case 'type': { const pt = S.posting && S.posting.type;
      return {text:`What kind of hire is ${who() || 'this'}?`, html:`${pt ? `<p class="ag-quiet">The posting says ${h(pt)}.</p>` : ''}<div class="ag-rows">${[['ft', 'Full-time', 'W-2', 'briefcase'], ['pt', 'Part-time', 'W-2', 'clock-3'], ['c', 'Contractor', '1099', 'file-pen-line']].map(([v, l, t, i]) => row('ans:type:' + v, l, {icon:i, right:t, keep:true, lab:`${l} ${t}`, cur:cur(f.empType === v)})).join('')}</div>`, ph:'Or type your answer', count:3, help:['w2', 'skip']}; }
    case 'job': return {text:"What's the job?", html:card(q), ph:q.fields.some(k => k === 'startDate' || k === 'endDate') ? 'Or type a date' : q.fields.join() === 'title' ? 'Or type the job title' : 'Or type your answer', help:['skip']};
    case 'loc': return {text:`Where will ${they()} work?`, html:`<div class="ag-chips">${['Remote', 'Hybrid', 'On-site'].map(v => chip('ans:loc:' + v, v, cur(f.location === v))).join('')}</div>`, ph:'Or type your answer', count:3, help:['skip']};
    case 'state': return {text:`Which state will ${they()} work from?`, html:`<div class="ag-state"><label class="ag-lab" for="ag-state-q">Work state</label><input class="input" id="ag-state-q" autocomplete="off" placeholder="Type to filter"><div class="ag-rows" id="ag-state-l">${stateRows('', q.change ? f.state : '')}</div></div>`, ph:'Or type the state', help:['why-state', 'skip']};
    case 'office': return {text:'Which office?', html:`<div class="ag-chips">${OFFICES.map(o => chip('ans:office:' + o.id, o.name, cur(f.workplace === o.id))).join('')}</div>`, ph:'Or type your answer', help:['skip']};
    case 'pay': { const p = S.posting;
      return {text:"What's the pay?", html:card(q, p && p.min ? `<p class="ag-quiet">Posted range: ${rangeText(p)}</p>` : ''), ph:f.payType === 'Hourly' || (p && p.unit === 'Hourly') ? 'Or type it, like $95 an hour' : 'Or type it, like 150k a year', help:['should-pay', 'skip']}; }
    case 'extras': { const now = f.bonusOpen && f.equityOpen ? 'both' : f.bonusOpen ? 'bonus' : f.equityOpen ? 'equity' : 'none'; return {text:'Is there a signing bonus or equity?', html:`<div class="ag-chips">${[['bonus', 'Signing bonus'], ['equity', 'Equity'], ['both', 'Both'], ['none', 'Neither']].map(([v, l]) => chip('ans:extras:' + v, l, cur(now === v))).join('')}</div>`, ph:'Or type your answer', count:4, help:q.change ? ['skip'] : []}; }
    case 'bonus': return {text:'Tell me about the signing bonus.', html:card(q), ph:'Or type the amount', help:['repay', 'skip']};
    case 'equity': return {text:'How should the equity read in the letter?', html:card(q), ph:'Or type your answer', help:['skip']};
    case 'expiry': return {text:'When should the offer expire?', html:card(q), ph:'Or type a date', help:['skip']};
    case 'note': return {text:'What note should the email carry?', html:card(q), ph:'Or type your answer', help:[]};
    case 'pg': return {text:'Which payroll group?', html:`<div class="ag-chips">${['US Salaried', 'US Hourly'].map(v => chip('ans:pg:' + v, v, cur(f.payrollGroup === v))).join('')}</div>`, ph:'', help:[]};
    case 'invite': return {text:`Invite ${w} to Bolto after they sign?`, html:`<div class="ag-chips">${[['yes', 'Yes', f.invite], ['no', 'No', !f.invite]].map(([v, l, c]) => chip('ans:invite:' + v, l, cur(c))).join('')}</div>`, ph:'', help:[]};
    case 'style': return {text:'Which letter style?', html:`<div class="ag-chips">${['Standard', 'Concise'].map(v => chip('ans:style:' + v, v, cur(S.style === v))).join('')}</div>`, ph:'', help:[]};
    case 'ot': { const o = ot(), hr = o.mode === 'hourly';
      if(o.mode === 'auto') return {text:`${theyGet('gets', 'get')} overtime pay.`, html:`<p class="ag-quiet">${h(o.short || o.why)}</p><div class="ag-chips">${chip('field:amount', 'Change the pay')}</div>`, ph:'Or ask what exempt means', count:1, help:['exempt', 'skip']};
      if(!q.walk){ const v = otFinal(); return {text:`${doesThey()} get overtime pay?`, html:`<div class="ag-chips">${chip('ans:ot:none', 'Yes', cur(v === false))}${chip('ans:ot:exempt', 'No', cur(v === true))}${chip('ans:ot:walk', "I'm not sure")}</div><p class="ag-quiet">Some jobs are exempt from overtime, and a job title or posting doesn't decide it.</p>`, ph:'Or ask what exempt means', count:3, help:['exempt', 'skip']}; }
      const opts = hr ? [['software', 'Yes'], ['none', 'No'], ['unsure', "I'm not sure"]] : (o.opts || []).map(v => [v, DUTIES[v]]);
      const postLine = S.posting && S.posting.duties ? `<p class="ag-quiet">The posting says: ${h(S.posting.duties)}</p>` : '';
      return {text:hr ? `${doesThey()} work as a software engineer, programmer or systems analyst?` : `What is ${poss()}main work?`, html:`${postLine}<div class="ag-rows">${opts.map(([v, l]) => row('ans:ot:' + v, l, {cur:cur(f.duties === v)})).join('')}</div><p class="ag-quiet">A job title or posting doesn't decide this.</p>${o.hint ? `<p class="ag-quiet">${h(o.hint)}</p>` : ''}`, ph:'Or ask what exempt means', count:opts.length, help:['exempt', 'skip']}; }
    case 'conf': { const c = S.conf[q.k], val = v => c.pair ? `$${v.amount} ${v.payType === 'Hourly' ? 'an hour' : 'a year'}` : disp(q.k, v);
      return {text:'These two disagree. Which is right?', html:`<div class="ag-rows">${c.opts.map((o, i) => row(`conf:${q.k}:${i}`, val(o.val), {sub:o.label + (o.quote ? `: "${o.quote}"` : '')})).join('')}</div>`, ph:'Or type the right value', count:2, help:[]}; }
    case 'prop': { const p = S.prop.amount;
      return {text:`Your notes give the pay as ${p.label}. Use it?`, html:`<div class="ag-chips">${chip('prop:use', 'Use ' + p.label)}${chip('prop:other', 'Enter a different amount')}</div><p class="ag-quiet">Quoted from your notes: "${h(p.quote)}"</p>`, ph:'Or type the amount', count:2, help:[]}; }
  }
}
function stateRows(qs, now = ''){ const t = qs.trim().toLowerCase(), m = STATES.filter(([c, n]) => !t || n.toLowerCase().includes(t) || c.toLowerCase() === t), show = m;
  return show.length ? show.map(([c, n]) => row('ans:state:' + c, n, {cur:c === now})).join('') : `<p class="ag-quiet">No state matches "${h(qs)}".</p>`; }

/* ===================== ask, close, continue ===================== */
const HELP = {w2:["What's W-2 and 1099?", 'say:what is w-2 and 1099'], skip:['Skip for now', 'skip'], keepit:['Keep as it is', 'keepit'], 'why-state':['Why do you need this?', 'say:why do you need the state'], 'should-pay':['What should I pay?', 'say:what should I pay'], repay:['What does repaid mean?', 'say:what is repayment'], exempt:['What does exempt mean?', 'say:what does exempt mean']};
function renderHelpers(keys){ helperItems(keys.map(k => HELP[k]).filter(Boolean).slice(0, 3)); }
/* A13: helpers leave, then the new ones arrive one stagger apart. Same-tick calls collapse, so closing a question and asking the next is one change */
function helperItems(items){ const A = ag(); A.helpNext = items; if(A.helpQ) return; A.helpQ = true; queueMicrotask(() => { A.helpQ = false; paintHelpers(A.helpNext); }); }
function paintHelpers(items){ const A = ag(), slot = $('#ag-help'), f = $('#ag-help-f'); if(!slot) return; const key = JSON.stringify(items); if(A.helpers === key && slot.children.length === items.length) return; A.helpers = key; clearTimeout(A.helpT);
  const put2 = () => { slot.innerHTML = items.map(([l, a], i) => `<button type="button" class="ag-help${instant() ? '' : ' is-new'}" style="--i:${i}" data-ag="${h(a)}">${h(l)}</button>`).join(''); f.classList.toggle('is-on', items.length > 0); };
  if(!slot.children.length || instant()){ put2(); return; } [...slot.children].forEach(c => c.classList.add('is-out')); if(!items.length) f.classList.remove('is-on'); A.helpT = setTimeout(put2, Motion.ms('--ag-out')); }
/* A12: the placeholder crossfades; the real attribute stays for assistive tech */
function setPh(t){ const i = $('#ag-input'), box = $('#ag-field-w'); t = t || 'Ask or change anything'; if(!i || !box) return; if(i.placeholder === t && box.querySelector('.ag-phs:not(.is-out)')) return; i.placeholder = t;
  box.querySelectorAll('.ag-phs').forEach(o => { if(instant()) o.remove(); else { o.classList.add('is-out'); setTimeout(() => o.remove(), Motion.ms('--ag-out')); } });
  const s = document.createElement('span'); s.className = 'ag-phs' + (instant() ? '' : ' is-new') + (i.value ? ' is-hidden' : ''); s.setAttribute('aria-hidden', 'true'); s.textContent = t; box.appendChild(s); }
function closeOpen(){ const A = ag(), o = A.open; A.open = null; A.landRow = null; if(o && o.el){ const b = $$('.ag-fold', o.el).pop(); if(b) Mo.fold(b); } if(o && o.id === 'review') queueMicrotask(() => { if(!(A.open && A.open.id === 'review')) slot(false); }); renderHelpers([]); }
function ask(q){
  const A = ag(), Q = question(q); if(!Q) return;
  closeOpen();
  const el = turn(Q.text, Q.html, {count:Q.count}); q.snap = snapshot(); A.open = {...q, el}; { const L = el.querySelector('#ag-state-l'), c = L && L.querySelector('.ag-row-r'); if(c) L.scrollTop = c.closest('.ag-row').offsetTop - L.offsetTop; }
  setPh(Q.ph); renderHelpers(Q.help || []); renderTrack(); Mo.outline(askKeys(q)); focusNext(el);
}
/* a question must never be left behind with live options: an aside retires them and the question is asked again at the bottom */
const askKeys = q => q.fields ? q.fields.filter(k => k !== 'bonusRepay') : ({type:['empType'], loc:['location'], state:['state'], office:['workplace'], ot:['duties'], conf:[q.k], prop:['amount']}[q.id] || []);
function reAsk(){ const A = ag(), o = A.open; if(A.thread.lastElementChild && A.thread.lastElementChild.matches('.is-undoline')) return; if(!o || !o.el || A.busy || S.sent || A.thread.lastElementChild === o.el) return; if((o.id === 'conf' && !S.conf[o.k]) || (o.id === 'prop' && !S.prop.amount)) return; const q = {...o}; delete q.el, delete q.snap; const Q = question(q); if(!Q) return; const last = A.thread.lastElementChild;
  if(!last.matches('.ag-turn') || last.querySelector('.ag-fold.is-q')){ ask(q); return; }
  closeOpen(); last.querySelector('.ag-body').insertAdjacentHTML('beforeend', `<p class="ag-text ag-after${instant() ? '' : ' is-words'}">${Mo.words(Q.text)}</p><div class="ag-fold is-q"><div class="ag-block">${Q.html}</div></div>`); if(!instant()) $$('.ag-fold.is-q .ag-block > :not(.ag-rows):not(.ag-chips), .ag-fold.is-q .ag-rows > *, .ag-fold.is-q .ag-chips > *', last).forEach((x, i) => { x.style.setProperty('--i', i); x.classList.add('ag-in'); });
  Mo.toBottom(); say(Q.text); q.snap = snapshot(); A.open = {...q, el:last}; setPh(Q.ph); renderHelpers(Q.help || []); renderTrack(); Mo.outline(askKeys(q)); focusNext(last); }
function focusNext(el){ const A = ag(), how = A.how, c = $('#ag-input'), foot = $('#ag-foot'), a = document.activeElement, lost = !a || a === document.body || !!a.closest('.is-closing, .is-morph') || (!!a.closest('#ag-approve-f') && !(A.open && A.open.id === 'review'));
  if(how === 'key'){ const t = el.querySelector('button:not([disabled]), a[href], input, select, textarea'); if(t){ t.focus({preventScroll:true}); return; } }
  if(how === 'typed' && c && !(foot && foot.classList.contains('is-gone'))){ c.focus({preventScroll:true}); return; }
  if(lost) Hifi.focusQuiet(A.thread, {preventScroll:true});
}
function next(){ const A = ag(); if(A.busy || S.sent || S.screen !== 'offer') return; autoLine(); const q = plan(); q ? ask(q) : wrapUp(); }
/* an open question that got answered elsewhere retires; the next one is computed */
function reconcile(){ const A = ag(); if(A.busy || S.sent || !A.picked) return; autoLine(); const q = plan(), o = A.open;
  if(o && o.id === 'review' && !q && !missing().length){ refreshReview(); return; }
  if(o && q && o.id === q.id && !o.change && JSON.stringify(o.fields) === JSON.stringify(q.fields)) return;
  q ? ask(q) : wrapUp(); }
function autoLine(){ const A = ag(), o = ot(); const key = o.mode === 'auto' ? basisKey() : ''; if(key && A.autoSaid !== key){ A.autoSaid = key; line(`${ic('info')}<span>${h(o.short || o.why)} ${h(o.short ? 'Gets overtime pay' : otWords(false))}.</span>`); } }
function retryText(){ return `Answered in the form`; }

/* Change under a reply: the same question comes back with its options, in place of retyping or hunting through the summary. One live link per question; it goes when the question stops applying */
const againKey = q => q.id === 'conf' ? `conf|${q.k}` : q.fields ? `${q.id}|${q.fields.join(',')}` : q.id;
function againOK(key){ const [id, fs] = key.split('|'), f = S.f; if(S.sent) return false; if(id === 'role') return true; if(id === 'conf') return !!S.conf[fs]; if(id === 'prop') return !!S.prop.amount; if(id === 'state') return isEmp() && f.location === 'Remote'; if(id === 'office') return !!f.location && f.location !== 'Remote'; if(id === 'ot') return isEmp() && ot().mode !== 'wait'; if(id === 'pg') return isEmp(); return fs ? fs.split(',').some(applies) : true; }
function canChange(me, q, label){ if(!me || !q || me.querySelector('.ag-again')) return; const A = ag(), key = q === 'role' ? 'role' : againKey(q); $$('.ag-again', A.thread).filter(b => b.dataset.key === key).forEach(b => b.remove()); me.insertAdjacentHTML('beforeend', `<button type="button" class="linkbtn quiet ag-again" data-ag="again:${key}" data-key="${key}" data-u="${A.undo.length}">Change<span class="sr"> your answer: ${h(label)}</span></button>`); }
function syncAgain(){ $$('.ag-again', ag().thread).forEach(b => b.classList.toggle('is-off', !againOK(b.dataset.key))); }
function again(key){ const A = ag(), [id, fs] = key.split('|'); if(A.busy || !againOK(key)) return; A.stick = true; if(id === 'role'){ confirmRestart(); return; } if(id === 'conf' || id === 'prop'){ const k = id === 'conf' ? fs : 'amount'; A.skip.delete(k); ask({id, k}); return; } const q = {id, change:true}; if(fs) q.fields = fs.split(',').filter(k => k === 'bonusRepay' || applies(k)); ask(q); }
function confirmRestart(){ const A = ag(); closeOpen(); const el = turn('Start over? This clears the offer.', `<div class="ag-chips">${chip('keep', 'Keep this offer')}${chip('restart', 'Start over')}</div>`); A.open = {id:'confirm', el}; focusNext(el); }
function answer(q, v, label, src){
  const A = ag(), me = src && !instant() ? Mo.morph(src, label) : bubble(label), from = me.querySelector('.ag-bubble, .ag-row, .ag-chip') || me;
  if(q.id === 'ot' && v === 'walk'){ closeOpen(); ask({id:'ot', change:q.change, walk:true}); return; }
  pushUndo(q.snap || snapshot());
  canChange(me, q, label); travel(from, () => applyAns(q.id, v));
  closeOpen();
  if(q.change){ q.change = false; }
  next();
}
function applyAns(id, v){
  const f = S.f, before = f.duties, A = ag();
  if(id === 'type') swapType(v);
  if(id === 'loc'){ set('location', v); if(v === 'Remote'){ S.f.workplace = ''; } else { S.f.state = ''; } refresh(null, true); }
  if(id === 'state') set('state', v); if(id === 'office') set('workplace', v);
  if(id === 'pg') set('payrollGroup', v);
  if(id === 'invite') set('invite', v === 'yes');
  if(id === 'style'){ S.style = v; syncStyle(); saveDraft(); }
  if(id === 'extras'){ A.extrasDone = true; const b = v === 'bonus' || v === 'both', e = v === 'equity' || v === 'both'; if(b !== !!f.bonusOpen){ Object.assign(f, b ? {bonusOpen:true} : {bonusOpen:false, bonus:'', bonusRepay:false, bonusMonths:''}); onCommit('bonusOpen'); } if(e !== !!f.equityOpen){ Object.assign(f, e ? {equityOpen:true} : {equityOpen:false, equity:''}); onCommit('equityOpen'); } }
  if(id === 'ot'){ A.skip.delete('duties'); set('duties', v); if(v === 'unsure'){ A.skip.add('duties'); turn(saved() ? 'Your draft is saved. Check with whoever runs payroll.' : 'Check with whoever runs payroll.'); } }
  otAgain(before);
  renderTrack();
}
/* only when the question really comes back: an automatic result, or a skip, asks nothing */
function otAgain(prev){ const m = ot().mode; if(prev && !S.f.duties && (m === 'hourly' || m === 'salary') && !ag().skip.has('duties')) turn('That changed the overtime rules for this offer, so I need to ask again.'); }
function swapType(v){ const was = S.f.empType, wasCon = was === 'c'; if(was && was !== v) A_letterFade(); set('empType', v);
  if(was && was !== v){ if(v === 'c') line(`${ic('info')}<span>Contractor offer: overtime, payroll group and I-9 don't apply and are hidden.</span>`); else if(wasCon) line(`${ic('info')}<span>Employee offer: the contract end date is hidden. Overtime, payroll group and I-9 now apply.</span>`); } }
function A_letterFade(){ const A = ag(); if(A.holds > 0) A.fadeLetter = true; else Mo.letterFade(); }

function submitCard(q, form){
  const A = ag(), ks = q.fields; form.querySelectorAll('.ag-err').forEach(e => { const w = e.parentElement; if(!w.classList.contains('ag-errw')) return; w.classList.remove('is-on'); setTimeout(() => { if(!w.classList.contains('is-on')) e.textContent = ''; }, instant() ? 0 : Motion.ms('--ag-out-slow')); });
  const f = S.f; let bad = missing().filter(m => ks.includes(m.k));
  const amtEl = ks.includes('amount') && f.amount.trim() && !bad.some(b => b.k === 'amount');
  if(amtEl){ const msg = payBad(num(f.amount), f.payType); if(msg) bad.push({k:'amount', msg}); }
  ks.forEach(k => { const i = form.querySelector(`#ag-f-${k}`), m = bad.find(b => b.k === k); if(!i) return; if(m){ i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', `ag-f-${k}-e`); } else { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby'); } });
  if(bad.length){ bad.forEach(b => { const e = form.querySelector(`#ag-f-${b.k}-e`); if(e){ e.textContent = b.msg; const w = e.parentElement; if(w.classList.contains('ag-errw')) w.classList.add('is-on'); } }); const t = form.querySelector(`#ag-f-${bad[0].k}`) || form.querySelector(`[name=${bad[0].k}]`); if(t) t.focus(); say(bad.map(b => b.msg).join('. ')); return; }
  const prev = f.empType; ks.forEach(k => { if(k !== 'bonusRepay' && !S.src[k]) S.typed[k] = true; onCommit(k, prev); });
  pushUndo(q.snap || snapshot());
  const both = ks.includes('startDate') && ks.includes('endDate') && f.startDate && f.endDate, lab = [...(both ? [`Starts ${disp('startDate', f.startDate)}`, `ends ${disp('endDate', f.endDate)}`] : []), ...ks.filter(k => k !== 'bonusRepay' && f[k] !== '' && !(k === 'payType' && ks.includes('amount')) && !(both && (k === 'startDate' || k === 'endDate'))).map(k => k === 'first' ? fullName() : k === 'last' ? '' : k === 'bonusMonths' ? (f.bonusRepay ? `repaid within ${f[k]} month${+f[k] === 1 ? '' : 's'}` : '') : disp(k, f[k]))].filter(Boolean).join(', ');
  closeOpen(); canChange(bubble(lab || 'Done'), q, lab || 'Done');
  if(ks.includes('amount')) rangeNote();
  next();
}

/* ===================== the pinned card ===================== */
const STEPS = [
  {id:'role', name:'Role', keys:['first', 'last', 'email', 'empType', 'title', 'startDate', 'endDate', 'reportsTo', 'location', 'state', 'workplace'], fields:['first', 'empType', 'title', 'startDate', 'reportsTo', 'location', 'state', 'workplace']},
  {id:'pay', name:'Pay', keys:['payType', 'amount', 'bonus', 'bonusMonths', 'equity'], fields:['amount', 'bonus', 'equity']},
  {id:'payroll', name:'Hire setup', keys:['duties', 'payrollGroup'], fields:['payrollGroup', 'duties', 'invite']},
  {id:'send', name:'Send', keys:['expiry'], fields:['sender', 'expiry', 'note', 'style']}
];
function stepValue(s, left){ const f = S.f;
  if(left) return `${left} left`;
  if(s.id === 'role') return (fullName() || S.cand || f.title || '').trim() || 'Done';
  if(s.id === 'pay') return payText();
  if(s.id === 'payroll'){ if(isCon()) return f.invite ? 'Invite on' : 'No invite'; if(ot().mode === 'wait') return 'After pay'; const v = otFinal(); return v === null ? '' : v ? 'No overtime pay' : 'Gets overtime pay'; }
  return f.expiry ? 'Expires ' + shortDt(f.expiry) : ''; }
/* the card's truth: one list (missing()) drives the count; Payroll waits honestly; Send is never done until it's sent */
function stepModel(){ const miss = missing(), f = S.f, o = ag().open, open = o && o.id === 'extras' ? 1 : 0, leftIn = s => miss.filter(m => s.keys.includes(m.k)).length + (s.id === 'pay' ? open : 0); let cur = STEPS.findIndex(s => leftIn(s)); if(cur < 0) cur = 3; if(S.sent) cur = -1;
  const cells = STEPS.map(s => { const left = leftIn(s), val = () => left ? `${left} left` : stepValue(s, 0) || 'Not set';
    if(s.id === 'payroll'){ const st = secStatus('hire', miss); if(st.state === 'wait') return {s, done:false, frac:0, val:!f.empType ? 'After worker type' : 'After pay'}; if(isCon()) return {s, done:true, frac:1, val:f.invite ? 'Invite on' : 'No invite'}; return {s, done:st.state === 'done', frac:st.frac, val:val()}; }
    if(s.id === 'send') return {s, done:!!S.sent, frac:S.sent ? 1 : 0, val:val()};
    const ks = s.keys.filter(applies); return {s, done:!left, frac:ks.length ? (ks.length - Math.min(left, ks.length)) / ks.length : 1, val:val()}; });
  if(matchMedia('(max-width: 600px)').matches) cells.forEach(c => { c.short = c.val.replace(/ (a year|an hour)$/, '').replace(/^Expires /, '').replace('No overtime pay', 'No overtime').replace('Gets overtime pay', 'Overtime').replace('After worker type', 'After type'); if(c.s.id === 'role' && who()) c.short = who(); }); return {miss, cur, cells, left:miss.length + open}; }
function swapText(box, text){ const cur = box.querySelector('.ag-v:not(.is-out)'); if(cur && cur.textContent === text) return false; const n = document.createElement('span'); n.className = 'ag-v'; n.textContent = text;
  if(cur){ if(instant()) cur.remove(); else { cur.classList.add('is-out'); n.classList.add('is-in'); setTimeout(() => cur.remove(), Motion.ms('--ag-out')); } } box.appendChild(n); return !!cur; }
function renderTrack(){
  const A = ag(), el = $('#ag-track'), w = $('#ag-trackw'); syncAgain(); if(!el) return; $$('.ag-tool-d dt[data-k]', A.thread).forEach(x => { x.textContent = LABEL(x.dataset.k); });
  if(!A.picked || (A.busy && !A.trackOn)){ A.trackOn = false; A.trackArrived = false; w.classList.remove('is-on'); delete el.dataset.built; return; }
  if(A.trackHold > 0 && el.dataset.built) return;
  A.trackOn = true; const first = !el.dataset.built;
  if(first){ el.dataset.built = '1'; el.innerHTML = `<div class="ag-track-h"><span class="ag-track-t ag-swapbox" id="ag-tt"></span><span class="ag-count-w"><span class="ag-st"><svg class="ag-prog" viewBox="0 0 16 16" aria-hidden="true"><circle class="t" cx="8" cy="8" r="6"/><circle class="f" id="ag-pf" cx="8" cy="8" r="6" pathLength="1" stroke-dashoffset="1"/></svg>${ic('circle-check', 'ag-sent-ck')}</span><span class="ag-count ag-swapbox" id="ag-count"></span></span></div><div class="ag-steps">${STEPS.map((s, i) => `<button type="button" class="ag-step" style="--i:${i}" data-ag="step:${s.id}"><span class="ag-seg"><i></i></span><span class="ag-step-n">${s.name}${ic('check', 'ag-ck')}${ic('pencil', 'ag-pen')}</span><span class="ag-step-v ag-swapbox"></span></button>`).join('')}</div>`; }
  const arrive = first && !A.trackArrived && !instant(), m = stepModel(), n = m.left;
  if(first && !arrive){ w.classList.add('no-anim'); requestAnimationFrame(() => requestAnimationFrame(() => w.classList.remove('no-anim'))); }
  w.classList.add('is-on'); A.trackArrived = true;
  if(arrive){ el.classList.add('is-arrive'); setTimeout(() => el.classList.remove('is-arrive'), Motion.ms('--d-slower') + 4 * Motion.ms('--ag-land')); }
  swapText($('#ag-tt'), fullName() || S.cand ? poss0() + ' offer' : 'New offer'); swapText($('#ag-count'), S.sent ? 'Sent' : !n ? 'Ready to review' : `${n} left`);
  const avg = m.cells.reduce((a, c) => a + c.frac, 0) / 4; el.classList.toggle('is-all', !!S.sent || !n); el.classList.toggle('is-sent', !!S.sent); const setFrac = () => { $('#ag-pf').style.strokeDashoffset = String(1 - (S.sent ? 1 : avg)); m.cells.forEach((c, i) => { el.querySelectorAll('.ag-step')[i].style.setProperty('--f', c.frac.toFixed(3)); }); }; if(arrive) requestAnimationFrame(() => requestAnimationFrame(setFrac)); else setFrac();
  m.cells.forEach((c, i) => { const b = el.querySelectorAll('.ag-step')[i], v = b.querySelector('.ag-step-v'), changed = swapText(v, c.short || c.val); b.classList.toggle('is-cur', i === m.cur); b.classList.toggle('is-done', c.done); b.setAttribute('aria-label', `${c.s.name}: ${c.val}. Change`); if(changed && !first && !instant()){ b.classList.remove('is-tint'); void b.offsetWidth; b.classList.add('is-tint'); b.addEventListener('animationend', function t(e){ if(e.animationName === 'ag-tint'){ b.classList.remove('is-tint'); b.removeEventListener('animationend', t); } }); } });
}
const poss0 = () => { const n = (fullName() || S.cand || '').trim().split(' ')[0]; return n ? n + "'s" : ''; };
function openStep(id){ const s = STEPS.find(x => x.id === id), f = S.f, A = ag(); if(!s) return; if(S.sent){ turn(sentLine()); return; }
  const ks = s.fields.filter(k => (k === 'state' ? f.location === 'Remote' && !isCon() : k === 'workplace' ? f.location && f.location !== 'Remote' : k === 'duties' || k === 'payrollGroup' ? isEmp() : k === 'bonus' ? true : true));
  const val = k => k === 'first' ? (fullName() || 'not set') : k === 'amount' ? (payText() || 'not set') : k === 'style' ? S.style : k === 'bonus' ? (f.bonusOpen ? disp('bonus', f.bonus) : 'None') : k === 'equity' ? (f.equityOpen ? f.equity || 'not set' : 'None') : k === 'duties' ? (otFinal() === null ? 'not set' : otFinal() ? 'No overtime pay' : 'Gets overtime pay') : disp(k, f[k]);
  closeOpen(); const el = turn(`Here's the ${s.name.toLowerCase()} part.`, `<div class="ag-rows">${ks.map(k => row('field:' + k, k === 'first' ? 'Name' : LABEL(k), {right:val(k)})).join('')}</div>`, {count:ks.length}); A.open = {id:'list', el}; focusNext(el); }
const sentLine = () => `This offer has been sent to ${who()}.`;
/* one sender is set up; the agent says so and offers nothing it can't do */
function senderTurn(inline){ const m = `${sender().name} is the only sender set up.`, n = inline && ag().open && ag().open.id === 'review' && $('#ag-sender-n'); if(n){ n.textContent = m; n.hidden = false; Mo.rise(n); say(m); return; } turn(m); }
function askField(k){ const A = ag(); if(A.busy) return; if(S.sent){ turn(sentLine()); return; } if(k === 'sender'){ senderTurn(A.how !== 'typed'); return; } if(isCon() && (k === 'duties' || k === 'payrollGroup')){ turn(NOT_CON); return; } if(k === 'duties' && ['wait', 'na'].includes(ot().mode)){ turn("I'll ask about overtime once the worker type, pay and work location are set."); reAsk(); return; } A.reopen = null; if((k === 'bonus' || k === 'equity') && !S.f[k + 'Open']){ pushUndo(snapshot()); S.f[k + 'Open'] = true; A.extrasDone = true; onCommit(k + 'Open'); A.reopen = k; } A.skip.delete(k); const q = qFor(k); if(q) ask(q); }

/* ===================== roles and the tool run ===================== */
function askRoles(){
  const A = ag(); A.picked = false; renderTrack(); closeOpen();
  if(WF.atsOff){ const el = turn("Bolto isn't connected to a hiring tool yet.", `<div class="ag-chips">${chip('blank', 'Start with a blank offer')}</div>`); A.open = {id:'roles', el}; return; }
  if(WF.ashbyDown){ const el = turn(`Couldn't reach ${ATS()}.`, `<div class="ag-chips">${chip('retry-roles', 'Try again')}${chip('blank', 'Start with a blank offer')}</div>`); A.open = {id:'roles', el}; return; }
  if(WF.noRoles){ const el = turn(`There are no open roles in ${ATS()}.`, `<div class="ag-chips">${chip('blank', 'Start with a blank offer')}</div>`); A.open = {id:'roles', el}; return; }
  const list = sorted(), el = turn('Who is this offer for?', rolesHTML(list), {count:list.length}); A.open = {id:'roles', el};
  setPh(matchMedia('(max-width: 480px)').matches ? 'Search roles or paste a link' : 'Search roles, paste a job link or notes'); helperItems([['Start with a blank offer', 'blank']]);
  focusNext(el);
}
function roleRow(r){
  const av = r.cand ? `<span class="ag-ini">${h(initials(r.cand))}</span>` : `<span class="ag-ini is-q">${ic('briefcase')}</span>`;
  const tag = r.status === 'approved' ? `<span class="ag-tag is-ok">${ic('check')}Offer approved</span>` : r.status === 'chosen' ? `<span class="ag-tag">Candidate chosen</span>` : '';
  return `<div class="ag-rw"><div><button type="button" class="ag-role" data-ag="role:${r.id}" data-search="${h((r.title + ' ' + r.cand).toLowerCase())}">${av}<span class="ag-role-l"><span class="ag-role-t">${h(r.title)}</span><span class="ag-role-c">${h(r.cand || `No one chosen yet · ${r.n} interviewing`)}</span></span>${tag}${ic('arrow-right', 'ag-arrow')}</button></div></div>`;
}
function rolesHTML(list){ const A = ag(), first = list.filter(r => r.status !== 'none'), rest = list.filter(r => r.status === 'none');
  return `<div class="ag-list-h"><span>Open roles in ${h(ATS())}</span><span>${list.length}</span></div><div class="ag-roles" id="ag-roles">${first.map(roleRow).join('')}<div class="ag-more${A.showAll ? ' is-open' : ''}" id="ag-more"><div class="ag-more-in">${rest.map(roleRow).join('')}</div></div></div><button type="button" class="ag-morebtn" data-ag="more">${A.showAll ? 'Show fewer roles' : `Show ${rest.length} more roles`}</button>`; }
function setMore(on){ const A = ag(), m = $('#ag-more'); if(!m) return; A.showAll = on; m.classList.toggle('is-open', on); const b = $('.ag-morebtn'), n = sorted().filter(r => r.status === 'none').length; if(b) b.textContent = on ? 'Show fewer roles' : `Show ${n} more roles`; if(on && !instant()) $$('.ag-rw', m).forEach((r, i) => { r.style.setProperty('--i', i); r.style.setProperty('--wd', 'var(--d-none)'); r.classList.remove('ag-in'); void r.offsetWidth; r.classList.add('ag-in'); r.addEventListener('animationend', () => r.classList.remove('ag-in'), {once:true}); }); }
function filterRoles(t){ const q = t.trim().toLowerCase().replace(/[.?!,;:\s]+$/, ''), box = $('#ag-roles'); if(!box) return; const rows = $$('.ag-role', box), hit = rows.filter(r => r.dataset.search.includes(q)), out = (r, x) => r.closest('.ag-rw').classList.toggle('is-out', x);
  if(q && hit.length){ if(!ag().showAll) setMore(true); rows.forEach(r => out(r, !hit.includes(r))); }
  else if(!q) rows.forEach(r => out(r, false)); }

function groupsFor(r){
  const p = r.posting, N = S.cand, A = ag(), off = {kind:'copied', from:'offer'}, team = {kind:'copied', from:'team'}, post = {kind:'copied', from:'posting'}, cand = {kind:'copied', from:'cand'}, g = [];
  const postGroup = {label:'Reading the job posting', fn(){ put('title', p.title, post); put('location', p.loc, post); if(p.office) put('workplace', p.office, post); put('work', p.lines.join('\n'), post); S.posting = p; if(!S.f.payType && r.status !== 'approved') putPay(null, p.unit, null, {...post, note:"From the posting's pay interval."}); }, res:() => p.loc};
  if(r.id === 'alex'){ const x = ASHBY_ALEX;
    g.push({label:`Reading ${r.cand}'s offer`, fn(){ S.cand = r.cand; S.posting = p; Object.entries(x.offer).forEach(([k, v]) => { if(k !== 'amount') put(k, v, off); }); putPay(x.offer.amount, p.unit, off, {...post, note:`A year, from the posting's pay interval. ${ATS()}'s offer has no unit.`}); if(!S.f.bonusOpen){ S.f.bonusOpen = true; S.fillOpened = true; } Object.entries(x.custom).forEach(([k, v]) => put(k, v, off)); }, res:() => payText()});
    g.push({label:'Reading the hiring team', fn(){ put('reportsTo', x.team.reportsTo, team); }, res:() => S.f.reportsTo});
    g.push({...postGroup, fn(){ put('location', p.loc, post); put('work', p.lines.join('\n'), post); }}); }
  else if(r.id === 'marcus'){ const o = r.offer;
    g.push({label:`Reading ${r.cand}'s offer`, fn(){ S.cand = r.cand; S.posting = p; Object.entries(o).forEach(([k, v]) => { if(k !== 'amount') put(k, v, off); }); putPay(o.amount, p.unit, off, {...post, note:"An hour, from the posting's pay interval."}); }, res:() => payText()});
    g.push({label:'Reading the hiring team', fn(){ put('reportsTo', r.reportsTo, team); }, res:() => S.f.reportsTo}); g.push(postGroup); }
  else if(r.id === 'priya'){
    g.push({label:`Reading ${r.cand}'s record`, fn(){ S.cand = r.cand; put('first', 'Priya', cand); put('last', 'Shah', cand); put('email', 'priya.shah@example.com', cand); S.f.expiry = '2026-06-20'; S.src.expiry = {...cand, val:'2026-06-20', pre:''}; }, res:() => 'priya.shah@example.com'});
    g.push({label:'Reading the hiring team', fn(){ put('reportsTo', 'Jordan Lee', team); }, res:() => 'Jordan Lee'}); g.push(postGroup); }
  else g.push(postGroup);
  g.push({label:'Checking company settings', fn(){ settingsSrc(); }, res:() => S.f.expiry ? 'Expires ' + shortDt(S.f.expiry) : ''});
  return g;
}
async function runTool(title, groups, A = ag(), source = ''){
  A.busy = true; const el = turn(title, `<div class="ag-tool"><button type="button" class="ag-tool-h" disabled data-ag="tool" aria-expanded="true"><span class="ag-tool-ic">${ic('loader-circle', 'spinner')}</span><span class="ag-tool-t">Working</span><span class="ag-tool-el">${0}s</span>${ic('chevron-down')}</button><div class="ag-tool-body"><div class="ag-tool-rows"></div></div></div>`, {quiet:true}); const tool = el.querySelector('.ag-tool'), box = tool.querySelector('.ag-tool-rows'), elEl = tool.querySelector('.ag-tool-el'), t0 = performance.now();
  Mo.work(el, true); const tick = setInterval(() => { elEl.textContent = Math.floor((performance.now() - t0) / 1000) + 's'; }, 250); const stop = () => { clearInterval(tick); };
  const gave = [];
  for(const [gi, g] of groups.entries()){
    if(S.ag !== A){ stop(); return false; }
    if(A.holdAt === gi){ A.holdAt = null; await Mo.wait('--ag-demo-hold'); if(S.ag !== A){ stop(); return false; } }
    const r = document.createElement('div'); r.className = 'ag-tool-row' + (instant() ? '' : ' is-new'); r.innerHTML = `<div class="ag-tool-m"><span class="ag-tool-ic">${ic('loader-circle', 'spinner')}</span><span class="ag-tool-l">${h(g.label)}</span><span class="ag-tool-r"></span></div>`; box.appendChild(r); Mo.toBottom();
    await Mo.wait('--ag-tool-step'); if(S.ag !== A){ stop(); return false; }
    const before = {...S.f}; g.fn(); const ks = Object.keys(S.f).filter(k => S.f[k] !== before[k] && S.f[k] !== '' && S.f[k] !== false); ks.forEach(k => markFresh(k)); gave.push(ks.filter(k => LABEL(k) !== k)); r.dataset.keys = ks.join(' '); refresh(null, true); renderTrack();
    r.querySelector('.ag-tool-ic').innerHTML = ic('check', 'ag-tool-ok is-draw'); r.querySelectorAll('.is-draw path').forEach(p => p.setAttribute('pathLength', '1')); r.querySelector('.ag-tool-r').textContent = g.res() || '';
  }
  A.busy = false; Mo.work(null, false); stop(); S.filled = true; S.draft = true; saveDraft();
  if(A.finishing){ A.finishing = false; A.fast = false; if(A.formLeft) A.snap = formSnap(); if(S.mode === 'form' && S.screen === 'offer'){ renderFields(); ACC.init(id => secStatus(id).state !== 'done'); } } if(source){ showBar(true, source); setFill({pre:`Filled from ${source}.`, undo:true}, false); }
  const n = groups.length, secs = Math.max(1, Math.round((performance.now() - t0) / 1000));
  tool.querySelector('.ag-tool-ic').innerHTML = ic('check', 'ag-tool-ok is-draw'); tool.querySelectorAll('.ag-tool-h .is-draw path').forEach(p => p.setAttribute('pathLength', '1')); tool.querySelector('.ag-tool-t').textContent = `Read ${n} source${n === 1 ? '' : 's'}`; elEl.textContent = `${secs}s`;
  renderTrack(); await Mo.wait('--ag-tool-hold'); if(S.ag !== A) return false;
  tool.classList.add('is-folded'); const head = tool.querySelector('.ag-tool-h'); head.setAttribute('aria-expanded', 'false');
  if(source){ const p = document.createElement('p'); p.className = 'ag-text ag-after' + (instant() ? '' : ' is-words'); p.innerHTML = Mo.words(`I filled in what I found in ${source}.`); el.querySelector('.ag-body').appendChild(p); }
  say(source ? `I filled in what I found in ${source}.` : 'Filled from what the hiring tool knows.');
  setTimeout(() => { if(S.ag !== A) return; [...box.children].forEach((r, i) => { if(gave[i] && gave[i].length) r.insertAdjacentHTML('beforeend', `<dl class="ag-tool-d">${gave[i].map(k => `<dt data-k="${k}">${h(LABEL(k))}</dt><dd>${h(disp(k, S.f[k]))}</dd>`).join('')}</dl>`); }); head.disabled = false; tool.classList.add('is-done'); }, instant() ? 0 : Motion.ms('--ag-out-slow'));
  return true;
}
async function pickRole(id, o = {}){
  const A = ag(), r = ROLES.find(x => x.id === id); if(!r || A.busy) return;
  if(o.how) A.how = o.how; pushUndo(snapshot()); const lab = r.cand ? `${r.cand}, ${r.title}` : r.title, b = o.src && !instant() ? Mo.morph(o.src, lab) : bubble(lab); canChange(b, 'role', lab); closeOpen();
  A.picked = true; A.role = id; A.extrasDone = r.status === 'approved'; A.showAll = false; S.newOffer = false;
  const ok = await runTool(r.status === 'none' ? `Reading the ${r.title} posting.` : `Reading what ${ATS()} has for ${r.cand}.`, groupsFor(r), A, r.status === 'none' ? 'the posting' : ATS());
  if(!ok || S.ag !== A) return; if(!o.stop) next(); drain();
}
function drain(){ const A = ag(); const q = A.queue.splice(0); q.forEach(t => understand(t)); }
function startBlank(){ const A = ag(); closeOpen(); A.picked = true; A.role = null; pushUndo(snapshot()); canChange(bubble('Start with a blank offer'), 'role', 'Start with a blank offer'); settingsSrc(); renderTrack(); next(); }
async function readLink(url){ const A = ag(); if(!/ashbyhq|greenhouse|lever|jobs/.test(url) || url !== PRIYA_LINK){ turn("I couldn't read that link. Paste the job details here, or start with a blank offer."); return; }
  pushUndo(snapshot()); closeOpen(); A.picked = true; A.viaFill = true; S.newOffer = false;
  const ok = await runTool('Reading the job posting.', [{label:'Reading the job posting', fn(){ applyPriya(true, null); }, res:() => S.posting ? S.posting.loc : ''}], A, 'the posting'); if(ok){ next(); drain(); } }
async function readNotes(text, label = 'your notes'){ const A = ag(), before = JSON.stringify([S.f, S.prop, S.conf]);
  if(WF.noMatch){ turn("I couldn't find any offer details in that."); return; }
  pushUndo(snapshot()); closeOpen(); A.picked = true; A.viaFill = true; S.newOffer = false;
  const ok = await runTool(`Reading ${label}.`, [{label:`Reading ${label}`, fn(){ applyPriya(false, text); }, res:() => ''}], A, label);
  if(!ok) return; if(before === JSON.stringify([S.f, S.prop, S.conf])){ turn("I couldn't find any offer details in that."); A.picked = false; askRoles(); return; } next(); drain(); }
function attachFile(){ const A = ag(); if(A.busy) return; bubble('jordan-notes.txt'); if(WF.fileBad){ turn("I couldn't read that file. Paste the text here instead."); return; } readNotes(PRIYA_NOTES, 'jordan-notes.txt'); }
function resolveConf(k, i){ const c = S.conf[k], A = ag(); if(!c) return; pushUndo(snapshot()); const o = c.opts[+i]; delete S.conf[k];
  if(c.pair){ Object.assign(S.f, o.val); if(o.src){ if(o.src.amount) S.src.amount = o.src.amount; if(o.src.payType) S.src.payType = o.src.payType; } onCommit('amount'); onCommit('payType'); }
  else { S.f[k] = o.val; if(o.src) S.src[k] = o.src; else S.typed[k] = true; onCommit(k, S.f.empType); }
  renderTrack(); closeOpen(); { const t = c.pair ? `$${o.val.amount} ${o.val.payType === 'Hourly' ? 'an hour' : 'a year'}` : disp(k, o.val); canChange(bubble(t), qFor(c.pair ? 'amount' : k), t); } next(); }
function useProp(){ const p = S.prop.amount, A = ag(); if(!p) return; pushUndo(snapshot()); delete S.prop.amount; const rd = {kind:'read', from:'notes', quote:p.quote};
  if(S.f.payType && !S.src.payType && S.f.payType !== p.unit){ putPay(p.val, p.unit, rd, rd); refresh(null, true); closeOpen(); next(); return; }
  S.src.amount = {...rd, val:p.val, pre:S.f.amount}; S.f.amount = p.val; if(S.f.payType !== p.unit){ S.src.payType = {...rd, val:p.unit, pre:S.f.payType}; S.f.payType = p.unit; } onCommit('amount'); renderTrack(); closeOpen(); canChange(bubble('Use ' + p.label), qFor('amount'), 'Use ' + p.label); next(); }

/* ===================== Review, Send ===================== */
function wrapUp(){
  const A = ag(), miss = missing();
  if(miss.length){ closeOpen(); const el = turn('These are still open.', `<div class="ag-rows">${miss.map(m => row('field:' + m.k, m.msg)).join('')}</div>`, {count:miss.length}); A.open = {id:'left', el}; setPh('Ask or change anything'); focusNext(el); return; }
  closeOpen(); const html = reviewHTML(), again = html.includes('is-chg');
  const el = turn(again ? "Here's the updated offer." : `That's everything for ${who()}.`, html, {cls:'ag-turn-review'}); A.open = {id:'review', el}; A.landRow = el.querySelector('.is-chg'); slot(true); setPh('Ask to change something'); renderTrack(); focusNext(el); A.landUntil = performance.now() + Motion.ms('--ag-fly-max') * 3;
  const land = () => { if(S.ag === A && A.open && A.open.el === el){ A.stick = true; Mo.follow(); Mo.latest(); } }; requestAnimationFrame(() => requestAnimationFrame(land)); if(document.readyState !== 'complete') window.addEventListener('load', () => setTimeout(() => { if(S.ag === A && A.open && A.open.el === el){ A.stick = true; Mo.pin(); Mo.latest(); } }, Motion.ms('--d-base')), {once:true});
}
/* the summary: one row per thing in the form, grouped by the tracker's four steps. v is the value alone, so a reworded reason never marks a row as changed */
function sumGroups(){ const f = S.f, s = sender(), emp = isEmp(), con = isCon(), why = t => t.split('<span class="why">'), R = (id, l, v, k, o = {}) => ({id, l, v:v || 'None', k, why:'', keys:k ? [k] : [], ...o});
  const m = +f.bonusMonths, otw = emp ? why(otReview()) : [];
  const role = [R('empType', 'Worker type', disp('empType', f.empType), 'empType'), R('name', 'Name', fullName(), 'name', {keys:['first', 'last']}), R('email', 'Email', f.email, 'email'), R('title', 'Job title', f.title, 'title'), R('startDate', 'Start date', f.startDate && fdate(f.startDate), 'startDate')];
  if(con) role.push(R('endDate', 'Contract ends', f.endDate && fdate(f.endDate), 'endDate'));
  role.push(R('reportsTo', LABEL('reportsTo'), f.reportsTo, 'reportsTo'), R('location', 'Where they work', f.location, 'location'));
  if(emp && f.location === 'Remote') role.push(R('state', 'Work state', stateName(f.state), 'state', {why:S.cand ? `You chose it. ${ATS()}’s offer has no state.` : 'You chose it'}));
  else if(f.location && f.location !== 'Remote') role.push(R('workplace', 'Workplace', disp('workplace', f.workplace), 'workplace'));
  if(f.department) role.push(R('department', 'Department', f.department, 'department'));
  const bonus = f.bonusOpen && f.bonus ? `${disp('bonus', f.bonus)}${f.bonusRepay ? `, repaid if ${who() || 'they'} ${con ? 'ends the engagement' : 'resigns or is let go for cause'} within ${m} month${m === 1 ? '' : 's'}` : ', not repaid'}` : '';
  const pay = [R('amount', 'Pay', payText(), 'amount', {keys:['amount', 'payType']}), R('bonus', 'Signing bonus', bonus, 'bonus', {keys:['bonus', 'bonusMonths']}), R('equity', 'Equity', f.equityOpen ? f.equity.trim() : '', 'equity')];
  const inv = R('invite', 'Invite to Bolto', f.invite ? 'Invited to Bolto after signing' : 'Not invited to Bolto automatically', 'invite', {why:f.invite ? 'On by default' : 'You turned it off'});
  const hire = con ? [R('nohire', 'Contractor: no payroll group, overtime or I-9', 'na', 'empType', {span:true, why:'You chose: contractor (1099)', n:'worker type'}), inv]
    : [R('payrollGroup', 'Payroll group', f.payrollGroup, 'payrollGroup', {why:S.pgOverride ? 'You chose it' : `Bolto rule: ${f.payType === 'Hourly' ? 'hourly' : 'salaried'} pay`}), R('duties', 'Overtime', otw[0], 'duties', {why:(otw[1] || '').replace('</span>', '')}), R('i9', 'I-9', 'Collected after signing', null, {why:'Bolto rule: every US employee needs one'}), inv];
  const send = [R('expiry', 'Offer expires', f.expiry && fdate(f.expiry), 'expiry'), R('sender', 'From', `${s.name} via Bolto`, 'sender', {after:'<span class="ag-quiet ag-sender-n" id="ag-sender-n" hidden></span>'}), R('style', 'Letter style', S.style, 'style'), R('note', 'Personal note', f.note.trim(), 'note')];
  return [{name:'Role', rows:role}, {name:'Pay', rows:pay}, {name:'Hire setup', nil:true, rows:hire}, {name:'Send', rows:send}]; }
function reviewHTML(){ const A = ag(), gs = sumGroups(), was = A.sumSeen, seen = {}; const cks = checks() || [];
  const rowH = r => { seen[r.id] = r.v; const chg = was && was[r.id] !== r.v, why = r.why ? `<span class="why">${r.why}</span>` : '', act = r.k ? `<button type="button" class="linkbtn" data-ag="field:${r.k}">Change<span class="sr"> ${h(r.n || r.l)}</span></button>` : '';
    return `<tr class="ag-sum-r${chg ? ' is-chg' : ''}" data-row="${r.id}" data-keys="${r.keys.join(' ')}">${r.span ? `<th scope="row" colspan="2">${h(r.l)}${why}</th>` : `<th scope="row">${h(r.l)}</th><td>${r.id === 'duties' ? r.v : h(r.v)}${why}${r.after || ''}</td>`}<td class="ag-sum-a">${act}</td></tr>`; };
  const body = gs.map(g => `<tbody><tr class="ag-sum-g"><th scope="rowgroup" colspan="3">${g.name}${g.nil ? ' <span class="ag-sum-nil">Not in the letter</span>' : ''}</th></tr>${g.rows.map(rowH).join('')}</tbody>`).join('');
  A.sumSeen = seen;
  return `<div class="ag-review">${cks.length ? `<ul class="ag-checks">${cks.map(c => `<li>${ic('triangle-alert')}<span>${h(c.msg || c.text || '')}</span></li>`).join('')}</ul>` : ''}<table class="ag-sum"><caption class="sr">Offer summary</caption><colgroup><col class="ag-sum-cl"><col><col class="ag-sum-ca"></colgroup>${body}</table></div>`; }
function refreshReview(){ const A = ag(), b = A.open && A.open.el.querySelector('.ag-block'); if(b) b.innerHTML = reviewHTML(); slot(true); renderTrack(); }
const approveHTML = () => `<p class="ag-ready">${ic('check')}Nothing missing</p><button type="button" class="btn btn-primary" id="ag-review-go" data-ag="open-review">Review offer</button>`;
function slot(on){ const A = ag(), f = $('#ag-approve-f'), c = $('#ag-approve'); if(!f) return; clearTimeout(A.slotT); if(on){ c.innerHTML = approveHTML(); f.classList.add('is-on'); f.inert = false; return; } if(!f.classList.contains('is-on')) return; f.classList.remove('is-on'); f.inert = true; A.slotT = setTimeout(() => { c.innerHTML = ''; }, instant() ? 0 : Motion.ms('--ag-morph')); }
/* the offer has gone: the thread folds, the Sent card rises, the composer leaves (A19, A29) */
function doSend(){ const A = ag(), f = S.f; S.sendErr = false; S.sent = true; if(!instant()){ const close = Motion.ms('--d-close'); A.stick = true; A.toEnd = false; A.lateUntil = performance.now() + close; A.quietUntil = performance.now() + close + Motion.ms('--ag-fly-max'); setTimeout(() => { if(S.ag === A) Mo.latest(); }, close + Motion.ms('--ag-fly-max') + Motion.ms('--d-micro')); Mo.latest(); } closeOpen(); retireUndo();
  const steps = ['Sent', 'Viewed', 'Signed'].concat(f.invite ? ['Invited'] : []);
  const sentEl = turn(`Offer sent to ${fullName()}.`, `<div class="ag-sent"><svg class="sent-mark" viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="32"/><path d="M23 37l9 9 17-19"/></svg><p>We've emailed ${h(who())} a link to read and e-sign the letter.</p><p>${h(who())} has until ${h(fdate(f.expiry))}, to sign.</p><ol class="track" aria-label="Offer status">${steps.map((t, i) => `<li class="${i === 0 ? 'on' : ''}"><span class="st">${i === 0 ? ic('check') : ''}</span><span>${t}</span></li>`).join('')}</ol><button type="button" class="btn btn-secondary" data-act="to-list">Back to offer letters</button></div>`);
  renderTrack(); const c = $('#ag-foot'); if(c) c.classList.add('is-gone'); renderHelpers([]); markSent(true); focusNext(sentEl);
}

/* ===================== Review modal: one review for both modes ===================== */
const RV = {open:false, dir:0, anims:null, opener:null, sending:false, then:null, ro:null, key:'', note:'', nudge:0};
const rvRoot = () => $('#rvm');
const rvS = () => $('#rvm-scroll');
function rvHTML(){ const w = h(who()), f = S.f, s = sender();
  return `<div class="rvm-scrim" data-rv="scrim"></div><div class="rvm-box" role="dialog" aria-modal="true" aria-labelledby="rvm-h"><header class="rvm-head"><h2 class="rvm-title" id="rvm-h">What ${w} will see</h2><button type="button" class="rvm-x" data-rv="close" aria-label="Close">${ic('x')}</button></header>
    <div class="rvm-scroll" id="rvm-scroll" tabindex="0" role="region" aria-label="Offer letter, scrolls"><div class="rvm-in"><div class="paper" id="rvm-paper">${letterHTML(true)}</div>
      <aside class="rvm-side" aria-label="What goes with the letter"><p class="attach">${ic('file-text')}<span>Sent with the letter: ${isCon() ? 'Contractor Confidentiality and IP Assignment Agreement' : 'Confidential Information and Invention Assignment Agreement'} (the company's own document, not shown here).</span></p>
      <section class="card rvm-mail" aria-labelledby="rvm-mail-h"><h3 class="card-h" id="rvm-mail-h">${ic('mail')}The email ${w} gets</h3><div class="email"><dl><dt>To</dt><dd>${h(f.email)}</dd><dd></dd><dt>From</dt><dd>${h(s.name)} via Bolto</dd><dd></dd><dt>Subject</dt><dd>Your offer from ${COMPANY}</dd><dd></dd></dl>
        <div class="b"><p>Hi ${w},</p><div><div class="lbl"><label for="rvm-note">Personal note <span class="opt">(optional)</span></label></div><textarea class="textarea" id="rvm-note">${h(f.note)}</textarea></div><p>Your offer letter is ready to review and sign.</p><p>Please sign by ${fdate(f.expiry)}.</p><span class="fakebtn" aria-hidden="true">Review and sign</span><span class="sr">A "Review and sign" button.</span></div></div></section></aside></div></div>
    <footer class="rvm-foot"><div class="rvm-prog" aria-hidden="true"><i id="rvm-bar"></i></div><p class="rvm-appr" id="rvm-appr">${h(approvalText())}</p><div class="ag-errw" id="rvm-err-w"><div class="ag-err" id="rvm-err"></div></div>
      <div class="rvm-acts"><p class="rvm-line" id="rvm-line"><span class="rvm-l rvm-l0">${ic('arrow-down')}<span>Scroll to the bottom to send the offer</span></span><span class="rvm-l rvm-l1">${ic('check')}<span>${RV.was ? "You've seen this letter to the end" : "You've reached the end"}</span></span></p><button type="button" class="btn btn-secondary" data-rv="change">Make a change</button><button type="button" class="btn btn-primary btn-send" id="rvm-send" data-rv="send"><span class="label">Send offer to ${w}${ic('send')}</span><span class="spin">${ic('loader-circle', 'spinner')}</span></button></div></footer></div>`; }
/* the gate. Reaching the end latches this exact letter; a letter that fits has no rule and no line */
function rvCheck(){ if(!RV.open) return; const e = rvS(), box = $('.rvm-box'), b = $('#rvm-send'); if(!e || !box || !b) return; const A = ag(), max = e.scrollHeight - e.clientHeight, fits = max <= 1; box.style.setProperty('--rvm-view', e.clientHeight + 'px'); if(fits || e.scrollTop >= max - 8) A.rvSeen = RV.key;
  const read = A.rvSeen === RV.key, gate = fits ? 'fits' : read ? 'read' : 'locked'; if(box.dataset.gate !== gate) box.dataset.gate = gate;
  b.classList.toggle('is-locked', !read); if(read) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true'); b.setAttribute('aria-describedby', fits ? 'rvm-appr' : 'rvm-appr rvm-line'); $('#rvm-line').hidden = fits; const bar = $('#rvm-bar'); bar.style.transform = `scaleX(${fits ? 1 : Math.min(1, e.scrollTop / max)})`; bar.parentElement.hidden = fits || RV.was; }
function rvInert(on){ $$('#hdr, #screen, #footer, .demo').forEach(x => { x.inert = on; }); }
function rvLock(on){ const d = document.documentElement, b = document.body, ft = $('#footer'); if(on){ const sb = innerWidth - d.clientWidth; d.style.overflow = 'hidden'; if(sb > 0){ b.style.paddingRight = sb + 'px'; if(ft) ft.style.right = sb + 'px'; } return; } d.style.overflow = ''; b.style.paddingRight = ''; if(ft) ft.style.right = ''; }
function rvBuild(){ const root = rvRoot(), box = $('.rvm-box', root), scrim = $('.rvm-scrim', root), opt = {duration:Motion.ms('--ag-rvm', {raw:true}), easing:cssv('--ease-move'), fill:'both'};
  if(Motion.reduced()) return [root.animate({opacity:[0, 1]}, {duration:Motion.ms('--d-fast', {raw:true}), easing:cssv('--ease-linear'), fill:'both'})];
  if(!wide()) return [scrim.animate({opacity:[0, 1]}, opt), box.animate({transform:['translateY(100%)', 'translateY(0)']}, {...opt, easing:cssv('--ease-enter')})];
  return [scrim.animate({opacity:[0, 1]}, opt), box.animate({opacity:[0, 1], transform:[`translateY(${px('--rise')}px)`, 'translateY(0)']}, opt)]; }
function rvClean(){ const R = RV; if(R.anims) R.anims.forEach(a => a.cancel()); R.anims = null; }
/* one function runs the enter either way, so a close during the open just turns the same animations around (A25, A28) */
function rvRun(dir, then){ const R = RV; R.dir = dir; R.then = then || null; if(ag().fast){ rvLanded(); return; }
  if(!R.anims){ R.anims = rvBuild(); if(dir < 0) R.anims.forEach(a => { a.currentTime = a.effect.getComputedTiming().endTime; }); }
  R.anims.forEach(a => { a.updatePlaybackRate(dir > 0 ? 1 : -1.25); a.play(); }); R.anims[0].onfinish = rvLanded; }
function rvLanded(){ const R = RV, dir = R.dir, then = R.then; rvClean(); R.then = null; if(dir > 0){ rvCheck(); R.dir = 0; if(then) then(); return; }
  const root = rvRoot(); if(R.ro){ R.ro.disconnect(); R.ro = null; } R.open = false; R.dir = 0; root.innerHTML = ''; root.hidden = true; root.classList.remove('is-closing'); rvLock(false); if(then) then(); }
function openReview(){ const R = RV, root = rvRoot(); if(!root || missing().length) return;
  if(R.open && R.dir < 0){ root.classList.remove('is-closing'); $('.rvm-box', root).inert = false; rvInert(true); rvRun(1); Hifi.focusQuiet(rvS(), {preventScroll:true}); return; }
  if(R.open) return; R.opener = document.activeElement; R.open = true; R.sending = false; R.note = S.f.note; R.key = letterHTML(true) + '|' + S.style; R.was = ag().rvSeen === R.key; root.innerHTML = rvHTML(); root.hidden = false; rvInert(true); rvLock(true);
  const e = rvS();
  e.scrollTop = 0; rvCheck(); e.addEventListener('scroll', rvCheck, {passive:true}); if(window.ResizeObserver){ R.ro = new ResizeObserver(rvCheck); R.ro.observe(e); } rvRun(1); Hifi.focusQuiet(e, {preventScroll:true}); }
function rvFocusBack(to){ const R = RV, t = [to, R.opener, $('#ag-review-go'), $('[data-act="review"]'), $('#ag-input')].find(x => x && x.isConnected && x.getClientRects().length); if(t) Hifi.focusQuiet(t, {preventScroll:true}); }
function rvClose(o = {}){ const R = RV, root = rvRoot(), A = ag(); if(!R.open || R.dir < 0 || (R.sending && !o.sent)) return; S.sendErr = false; if(typeof setTitle === 'function') setTitle(); rvInert(false); root.classList.add('is-closing'); $('.rvm-box', root).inert = true; if(!o.sent) rvFocusBack(o.to); const noted = !o.sent && S.f.note !== R.note; rvRun(-1); if(o.then) o.then(); if(noted && A.open && A.open.id === 'review') refreshReview(); }
function rvNudge(){ const l = $('#rvm-line'); if(!l) return; clearTimeout(RV.nudge); l.classList.add('is-nudge'); RV.nudge = setTimeout(() => { if(l.isConnected) l.classList.remove('is-nudge'); }, Motion.ms('--d-glow', {raw:true})); say('Scroll to the bottom to send the offer'); }
function rvSend(){ const R = RV, A = ag(), b = $('#rvm-send'), w = $('#rvm-err-w'); if(!b || R.sending || R.dir < 0) return; if(b.getAttribute('aria-disabled') === 'true'){ rvNudge(); return; } R.sending = true; A.sending = true; if(document.activeElement && document.activeElement.closest('#rvm-err')) b.focus({preventScroll:true}); w.classList.remove('is-on'); busy(b, true); if(S.mode === 'agent') Mo.work(A.open && A.open.el, true);
  setTimeout(() => { if(S.ag !== A || !R.open) return; R.sending = false; A.sending = false; Mo.work(null, false);
    if(WF.sendFail){ busy(b, false); const t = `Couldn't send. Nothing was sent to ${who()}.`; $('#rvm-err').innerHTML = `${h(t)} <button type="button" class="linkbtn" data-rv="send">Try again</button>`; w.classList.add('is-on'); say(t); S.sendErr = true; if(typeof setTitle === 'function') setTitle(); return; }
    S.sent = true; rvClose({sent:true, then:() => { if(S.mode === 'agent' && S.screen === 'offer') doSend(); else { S.sendErr = false; go('sent', {animate:true}); } }}); }, A.fast ? 0 : Motion.ms('--ag-send')); }
function rvReset(){ const R = RV, root = rvRoot(); if(!R.open) return; R.dir = -1; R.then = null; R.sending = false; rvInert(false); rvLanded(); }
function rvBindOnce(){ const root = rvRoot(); if(!root || root.__rv) return; root.__rv = true;
  root.addEventListener('click', e => { const t = e.target.closest('[data-rv]'); if(!t) return; const a = t.dataset.rv; if(a === 'send') rvSend(); else if(a === 'close' || a === 'scrim') rvClose(); else if(a === 'change') rvClose({to:$('#ag-review-go')}); });
  root.addEventListener('input', e => { if(e.target.id === 'rvm-note') S.f.note = e.target.value; });
  document.addEventListener('keydown', e => { const R = RV; if(!R.open || R.dir < 0) return; if(e.key === 'Escape'){ e.preventDefault(); rvClose(); return; } if(e.key !== 'Tab') return; const box = $('.rvm-box', root), list = $$('a[href], button:not([disabled]), textarea, input, select, [tabindex="0"]', box).filter(x => x.getClientRects().length && !x.inert), first = list[0], last = list[list.length - 1], a = document.activeElement; if(!box.contains(a)){ e.preventDefault(); first.focus(); return; } if(e.shiftKey && a === first){ e.preventDefault(); last.focus(); } else if(!e.shiftKey && a === last){ e.preventDefault(); first.focus(); } }, true); }
const typedReview = () => { line('<span>Opened the final letter.</span>', 'ag-quietline'); say('Opened the final letter.'); openReview(); };
function markSent(fade){ modeEl(fade); $$('input[name=style]').forEach(r => { r.disabled = true; }); const p = $('#letterPane'), head = p && $('.lt-head', p); if(head && !$('.ag-sent-tag', p)) $('h2', head).insertAdjacentHTML('afterend', `<span class="ag-sent-tag${instant() ? '' : ' ag-rise'}">${ic('check')}Sent</span>`); }

/* ===================== parsers ===================== */
const MON = {jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11};
function parseDate(t){ let m, y = 2026, mo, d;
  if((m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))){ y = +m[1]; mo = +m[2] - 1; d = +m[3]; }
  else if((m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i))){ mo = MON[m[1].toLowerCase().slice(0, 3)]; d = +m[2]; if(m[3]) y = +m[3]; }
  else if((m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s+(\d{4}))?/i))){ mo = MON[m[2].toLowerCase().slice(0, 3)]; d = +m[1]; if(m[3]) y = +m[3]; }
  else if((m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))){ mo = +m[1] - 1; d = +m[2]; if(m[3]) y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; }
  else return null;
  const D = new Date(y, mo, d); if(D.getMonth() !== mo) return null; return `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function parseMoney(t){ if(/(^|\s)-\s*\$?\d/.test(t)) return {val:'0', unit:''}; const m = t.match(/\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/i); if(!m) return null; let n = parseFloat(m[1].replace(/,/g, '')); if(m[2]) n *= 1000; const unit = /\b(hour|hr|hourly)\b/i.test(t) ? 'Hourly' : /\b(year|yr|annual|salary)\b/i.test(t) ? 'Salary' : ''; return {val:n.toLocaleString('en-US'), unit}; }
function parseState(t){ const s = t.trim().toLowerCase().replace(/[.?!]/g, ''); if(/\bwashington,?\s*dc\b/.test(s)) return STATES.filter(([c]) => c === 'DC'); const list = STATES.filter(([c, n]) => { const nm = n.toLowerCase(); return c.toLowerCase() === s || nm === s || s.includes(nm) || nm.startsWith(s + ' ') || (s.length > 1 && nm.split(' (')[0] === s); });
  if(!list.length && /\bnew york\b|\bny\b/.test(s)) return STATES.filter(([c]) => /^NY/.test(c)); if(!list.length && s.length >= 5) return STATES.filter(([c, n]) => lev(s, n.toLowerCase().split(' (')[0]) <= 2).slice(0, 1); return list; }
/* typing slips: a word close enough to a known option counts, only for short answers */
function lev(a, b){ const d = [...Array(b.length + 1).keys()]; for(let i = 1; i <= a.length; i++){ let p = d[0]; d[0] = i; for(let j = 1; j <= b.length; j++){ const q = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; } } return d[b.length]; }
const near = (l, w) => { const tol = w.length >= 6 ? 2 : w.length >= 4 ? 1 : 0; return l.split(/[\s-]+/).some(x => x === w || (tol && Math.abs(x.length - w.length) <= tol && lev(x, w) <= tol)); };
/* the one place that decides what typed text is. A command or a question comes first; anything else is an answer only if it looks like a value for the open field */
const COMMAND = /^(?:please\s+)?(?:change|set|make|move|update|edit|actually|add|remove|drop|undo|skip|save|switch to|use (?:the|our)\b|start over|different role|no (?:the )?(?:bonus|equity)\b)|^(?:start|pay|salary|expires?)\b.*\d/;
function fitsOpen(o, t, l){ const refuse = /^(?:none|no|nothing|remove(?: it)?|drop(?: it)?)$/.test(l); if(o.id === 'equity') return refuse || /\d|\b(?:percent|shares?|options?|rsus?|stock)\b/.test(l); if(o.id === 'bonus') return refuse || /\d/.test(l); if(o.id === 'who') return !!o.change || /@/.test(t) || /^[A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)+$/.test(t.trim()); return true; }
function typedKind(t, l, o){ if(isQuestion(t)) return 'question'; if(COMMAND.test(l)) return 'command'; return o && fitsOpen(o, t, l) ? 'answer' : 'other'; }
const isQuestion = t => /\?\s*$/.test(t) || /^(what|why|how|who|when|where|is|are|does|do|can|could|should|would|will|tell me|explain)\b/i.test(t.trim());
function parsePerson(t){ return PEOPLE.find(p => new RegExp(`\\b${p.split(' ')[0]}\\b`, 'i').test(t)); }

/* ===================== explanations ===================== */
const LINKS = {i9:['uscis.gov', 'Form I-9, Employment Eligibility Verification', 'https://www.uscis.gov/i-9'], w2:['irs.gov', 'About Form W-2', 'https://www.irs.gov/forms-pubs/about-form-w-2'], n1099:['irs.gov', 'About Form 1099-NEC', 'https://www.irs.gov/forms-pubs/about-form-1099-nec'], con:['irs.gov', 'Independent contractor, self-employed or employee?', 'https://www.irs.gov/businesses/small-businesses-self-employed/independent-contractor-self-employed-or-employee'], ot:['dol.gov', 'Fact Sheet 17A: Exemption for executive, administrative and other employees', 'https://www.dol.gov/agencies/whd/fact-sheets/17a-overtime']};
const CON_I9 = "A US form for employees. Contractors don't fill one in.";
const EXPLAIN = [
  [/\bi[\s-]?9\b/i, () => isCon() ? CON_I9 : TIP.i9, 'i9'], [/w[\s-]?2\s*(and|or|vs\.?|\/)\s*1099/i, () => TIP.type, 'con'], [/\bw[\s-]?2\b/i, () => TIP.type.split(' 1099:')[0], 'w2'], [/\b1099\b/i, () => '1099: an independent contractor. You generally don\'t withhold taxes for them.', 'n1099'],
  [/\bcontractor\b/i, () => "1099: an independent contractor. You generally don't withhold taxes for them.", 'con'], [/\bflsa\b/i, () => TIP.flsa, 'ot', 'emp'], [/\bnon[\s-]?exempt\b/i, () => TIP.flsa, 'ot', 'emp'], [/\bexempt\b/i, () => "Exempt means the job doesn't get overtime pay. Some jobs are exempt, depending on their pay and duties.", 'ot', 'emp'], [/\bovertime\b/i, () => TIP.flsa, 'ot', 'emp'],
  [/payroll group/i, () => TIP.pg, '', 'emp'], [/\binvite\b/i, () => TIP.invite], [/repay|repaid/i, () => isCon() ? TIP.repayC : TIP.repay], [/expir/i, () => `The last day ${they()} can sign the offer.`], [/letter style|\bstyle\b/i, () => 'You can choose Standard or Concise.'], [/e[\s-]?sign/i, () => `${theyGet('gets', 'get')} a link to read and e-sign the letter.`]
];
function explain(t){ const hit = EXPLAIN.find(e => e[0].test(t)); if(!hit) return false; if(hit[3] === 'emp' && isCon()){ turn(NOT_CON); return true; } turn(hit[1](), hit[2] ? sourceCard(hit[2]) : ''); return true; }
const sourceCard = k => { const [d, t, u] = LINKS[k]; return `<a class="ag-source" href="${u}" target="_blank" rel="noopener"><span class="ag-source-l"><span class="ag-quiet">${d}</span><span>${h(t)}</span></span>${ic('arrow-up-right')}<span class="sr"> (opens in a new tab)</span></a>`; };

const FIELD_WORDS = [[/sender/, 'sender'], [/worker type|employment type|\bw-?2\b|contractor/, 'empType'], [/start date|start/, 'startDate'], [/end date|contract end/, 'endDate'], [/bonus/, 'bonus'], [/equity/, 'equity'], [/\bstate\b/, 'state'], [/office|workplace/, 'workplace'], [/location|where|remote|hybrid|on-?site/, 'location'], [/report|manager|contact/, 'reportsTo'], [/email/, 'email'], [/first name/, 'first'], [/last name/, 'last'], [/\bname\b/, 'name'], [/department/, 'department'], [/title|job/, 'title'], [/expir/, 'expiry'], [/overtime|exempt|main work/, 'duties'], [/payroll group/, 'payrollGroup'], [/invite/, 'invite'], [/style/, 'style'], [/note/, 'note'], [/pay|salary|hourly|amount|wage/, 'amount']];
function change(k, v, o = {}){ const A = ag(), snap = snapshot(); pushUndo(snap); const was = k === 'style' ? S.style : disp(k, S.f[k]), prevD = S.f.duties;
  const nowFor = () => k === 'style' ? v : disp(k, S.f[k]); const el = line(`${ic('check')}<span>${h(LABEL(k))}: <span class="ag-chg"></span></span><button type="button" class="linkbtn" data-ag="undo">Undo</button>`, 'ag-change'); el.dataset.k = k;
  travel(el, () => { if(k === 'style'){ S.style = v; syncStyle(); saveDraft(); } else if(k === 'empType'){ if(S.src[k]) delete S.src[k]; swapType(v); } else { if(S.src[k]) delete S.src[k]; if(k === 'location'){ if(v === 'Remote') S.f.workplace = ''; else S.f.state = ''; } if(k === 'bonus' && !S.f.bonusOpen){ S.f.bonusOpen = true; A.extrasDone = true; onCommit('bonusOpen'); } if(k === 'equity' && !S.f.equityOpen){ S.f.equityOpen = true; A.extrasDone = true; onCommit('equityOpen'); } set(k, v); } if(o.unit && S.f.payType !== o.unit){ if(S.src.payType) delete S.src.payType; set('payType', o.unit); } });
  const now = nowFor(); el.querySelector('.ag-chg').innerHTML = `${was && was !== 'not set' ? `<span class="ag-old">${h(was)}</span> → ` : ''}<b>${h(now)}</b>`; say(`${LABEL(k)} changed to ${now}.`);
  otAgain(prevD); renderTrack(); return true; }
function toggleOff(which){ const A = ag(), snap = snapshot(); pushUndo(snap); if(which === 'bonus'){ Object.assign(S.f, {bonusOpen:false, bonus:'', bonusRepay:false, bonusMonths:''}); onCommit('bonusOpen'); } else { Object.assign(S.f, {equityOpen:false, equity:''}); onCommit('equityOpen'); }
  A.extrasDone = true; line(`${ic('check')}<span>${which === 'bonus' ? 'Signing bonus removed' : 'Equity removed'}</span><button type="button" class="linkbtn" data-ag="undo">Undo</button>`, 'ag-change'); say(which === 'bonus' ? 'Signing bonus removed.' : 'Equity removed.'); renderTrack(); }

/* ===================== what the agent understands ===================== */
function payBad(n, u){ if(n <= 0) return 'Enter a pay amount above 0.'; if(u === 'Hourly' && n >= 1000) return 'That looks like a yearly salary. Check the amount, or choose Salary.'; if(u === 'Salary' && n < 1000) return 'That looks like an hourly rate. Check the amount, or choose Hourly.'; return ''; }
function rangeNote(){ const p = S.posting, n = num(S.f.amount); if(p && p.min && p.unit === S.f.payType && n !== null && (n < p.min || n > p.max)) line(`${ic('info')}<span>That's outside the posted range of ${rangeText(p)}.</span>`); }
function setPay(text){ const m = parseMoney(text); if(!m) return false; const e = payBad(num(m.val), m.unit || S.f.payType); if(e){ turn(e); return true; } change('amount', m.val, {unit:m.unit}); rangeNote(); settle(); return true; }
/* an explicit "change X to Y": the value is checked the way the field's own question checks it, and a bad one says what to fix */
function setField(k, raw){ const v = raw.trim().replace(/[.!]+$/, ''), lc = v.toLowerCase(), bad = m => { turn(m); return true; }, done = x => { change(k, x); settle(); return true; };
  if(k === 'sender'){ senderTurn(); return true; }
  if(k === 'name'){ const p = v.split(/\s+/).filter(Boolean); if(!p.length) return false; change('first', p[0]); if(p.length > 1) change('last', p.slice(1).join(' ')); settle(); return true; }
  if(['startDate', 'endDate', 'expiry'].includes(k)){ const d = parseDate(v); if(!d) return bad('I need a real date for that, like June 15.'); if(k === 'expiry' && new Date(d + 'T00:00') < TODAY) return bad("The offer can't expire before today."); if(k === 'endDate' && S.f.startDate && d <= S.f.startDate) return bad('The contract must end after it starts.'); return done(d); }
  if(k === 'amount') return setPay(lc) || bad('I need a number for the pay, like 150,000.');
  if(k === 'bonus'){ const m = parseMoney(lc); if(!m) return bad('I need a number for the bonus, like 10,000.'); if(!(num(m.val) > 0)) return bad('Enter a bonus amount above 0.'); const mo = !/\bnot repaid\b/.test(lc) && lc.match(/(\d+)\s*months?\b/); if(mo){ S.f.bonusRepay = true; S.f.bonusMonths = mo[1]; } return done(m.val); }
  if(k === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? done(v) : bad('Enter an email address in the correct format, like name@example.com');
  if(k === 'reportsTo'){ const p = parsePerson(v); return p ? done(p) : bad(`I can only pick someone on the team: ${PEOPLE.join(' or ')}.`); }
  if(k === 'state'){ const s = parseState(v); if(s.length === 1) return done(s[0][0]); if(s.length > 1){ stateChoice(s); return true; } return bad(`I don't know a state called "${v.slice(0, 40)}".`); }
  if(k === 'location'){ const x = near(lc, 'remote') ? 'Remote' : near(lc, 'hybrid') ? 'Hybrid' : /on.?site|office/.test(lc) ? 'On-site' : ''; return x ? done(x) : bad('Remote, Hybrid or On-site?'); }
  if(k === 'empType'){ const x = /full/.test(lc) ? 'ft' : /part/.test(lc) ? 'pt' : /contract|1099/.test(lc) ? 'c' : ''; return x ? done(x) : false; }
  if(['title', 'first', 'last', 'equity', 'note', 'department'].includes(k)) return v ? done(v) : false;
  if(k === 'style'){ const x = /concise/.test(lc) ? 'Concise' : /standard/.test(lc) ? 'Standard' : ''; return x ? done(x) : bad('Standard or Concise?'); }
  return false; }
function fallback(){ turn("I can change details in this offer or explain a term. I can't help with that."); helperItems([["What's left", "say:what's left"], ["What's an I-9?", 'say:what is an I-9']]); }
/* one undo stack; a new entry means no older line can honestly offer Undo any more */
function pushUndo(s){ ag().undo.push(s); retireUndo(); }
function retireUndo(){ const A = ag(); $$('.ag-change [data-ag="undo"]', A.thread).forEach(b => { if(document.activeElement === b) Hifi.focusQuiet(A.thread, {preventScroll:true}); b.removeAttribute('data-ag'); b.classList.add('is-retired'); b.tabIndex = -1; b.disabled = true; setTimeout(() => b.remove(), instant() ? 0 : Motion.ms('--ag-out')); }); }
function undoLast(){ const A = ag(), s = A.undo.pop(); if(!s){ turn('Nothing to undo yet.'); return; } $$('.ag-again', A.thread).filter(b => +b.dataset.u > A.undo.length).forEach(b => b.remove()); const before = {...S.f}, spots = {}, chg = [...$$('.ag-change', A.thread)].reverse().find(x => x.querySelector('[data-ag="undo"]')), o = A.open; retireUndo(); $$('#letter [data-v]').forEach(x => { if(seen(x) && !spots[x.dataset.v]) spots[x.dataset.v] = {r:x.getBoundingClientRect(), t:x.textContent}; }); restore(s); saveDraft(); const ks = Object.keys(before).filter(x => before[x] !== S.f[x] && !NO_TRAVEL.has(x)); { const k = ks.find(x => spots[x]); if(k) Mo.flyBack(spots[k].r, spots[k].t, chg); } if(chg) chg.classList.add('is-undone');
  const k = (chg && chg.dataset.k) || (ks.length === 1 ? ks[0] : ''), msg = k === 'style' ? `Letter style back to ${S.style}` : k === 'duties' && otFinal() !== null ? `Overtime back to ${otFinal() ? 'no overtime pay' : 'gets overtime pay'}` : k && S.f[k] ? `${LABEL(k)} back to ${disp(k, S.f[k])}` : 'Undone'; line(`${ic('check')}<span>${h(msg)}</span>`, 'ag-change is-undoline'); say(msg + '.');
  const q = A.picked ? plan() : null; if(!A.picked){ closeOpen(); askRoles(); } else if(o && o.id === 'review' && !q && !missing().length) refreshReview(); else if(o && q && o.id === q.id && !o.change && JSON.stringify(o.fields) === JSON.stringify(q.fields)) renderTrack(); else { closeOpen(); next(); } }
/* a Change that ends with no change: the value stays. A bonus or equity row opened from None goes back to None */
function keepIt(){ const A = ag(), o = A.open; if(o && A.reopen === o.id){ const s = A.undo.pop(); if(s) restore(s); } else if(o && o.change && o.snap && o.snap !== snapshot()) restore(o.snap); A.reopen = null; closeOpen(); bubble('Keep as it is'); next(); }
function skip(){ const A = ag(), o = A.open; if(!o){ next(); return; } if(o.change){ keepIt(); return; }
  const ks = o.fields || ({type:['empType'], loc:['location'], state:['state'], office:['workplace'], ot:['duties'], conf:[o.k], prop:['amount'], extras:[]}[o.id] || []);
  if(o.id === 'extras') A.extrasDone = true; ks.forEach(k => A.skip.add(k)); closeOpen(); { const b = bubble('Skip for now'); if(!['review', 'left', 'list', 'confirm', 'roles'].includes(o.id)) { canChange(b, {id:o.id, fields:o.fields, k:o.k}, 'Skip for now'); const c = b.querySelector('.ag-again'); if(c) c.dataset.u = '-1'; } } next(); }
function understand(raw){ understand0(raw); reAsk(); }
function understand0(raw){
  const A = ag(), t = raw.trim(); if(!t) return; const l = t.toLowerCase().replace(/[.?!,;:\s]+$/, ''), o = A.open;
  if(A.busy){ A.queue.push(t); return; }
  if(/^https?:\/\/\S+$/i.test(t)){ readLink(t); return; }
  if(/ignore (all |your |previous )|system prompt|disregard|jailbreak|pretend you/.test(l)){ fallback(); return; }
  if(/\n/.test(t) || (t.length > 60 && /\$\d|contractor|starts?\b/i.test(t) && !isQuestion(t) && !/^(change|make)/i.test(t))){ readNotes(t); return; }
  if(S.sent){ turn(`This offer has been sent to ${who()}.`); return; }
  if(!A.picked && o && o.id === 'roles'){ const hit = $$('.ag-role').filter(r => !r.closest('.ag-rw').classList.contains('is-out') && r.dataset.search.includes(l)); if(hit.length === 1){ pickRole(hit[0].dataset.ag.split(':')[1]); return; } if(hit.length > 1 && hit.length < ROLES.length){ turn(`${hit.length} roles match. Pick one.`); return; } }
  if(/^(send( it| offer| the offer| this offer)?( now)?|review( offer)?)$/.test(l)){ if(o && o.id === 'review') typedReview(); else if(!missing().length){ wrapUp(); } else { showLeft(); } return; }
  if(/^(ok|okay|looks good|lgtm|yes|sounds good)$/.test(l) && o && o.id === 'review'){ typedReview(); return; }
  if(/^undo\b/.test(l)){ undoLast(); return; }
  if(/start over|different role/.test(l)){ confirmRestart(); return; }
  if(/use the form|switch to (the )?form|^form$/.test(l)){ setMode('form'); return; }
  if(/what'?s (left|missing)|what is (left|missing)/.test(l)){ showLeft(); return; }
  if(/^(skip|later|skip (it|this|for now))\.?$/.test(l) || /^i don'?t know\.?$/.test(l) || /^not sure\.?$/.test(l) || /^i'?m not sure\.?$/.test(l)){ if(o && o.id === 'ot' && /sure|know/.test(l)){ answer(o, o.walk ? 'unsure' : 'walk', "I'm not sure"); return; } skip(); return; }
  if(o && o.id === 'ot' && !/\?\s*$/.test(t) && !/^(?:what|why|how|explain|define|tell me|should|can|could|would|will|when|where|who)\b/.test(l) && !/^(?:is|are|does|do)\s+(?!not\b|exempt\b|non\b|get\b)/.test(l) && otSays(t, o.walk) && answerOpen(o, t, l)) return;
  if(/^(?:never\s?mind|nvm|cancel|go back)$/.test(l) && o && !['roles', 'review', 'left', 'list', 'confirm'].includes(o.id)){ if(o.change) keepIt(); else turn('Okay. This one is still open.'); return; }
  if(/should (this|it|he|she|they|i|we)\b.*(exempt|contractor|employee|pay|overtime)|is (she|he|they|this person) (a )?(contractor|exempt|employee)|what should i pay|how much should|which (one )?(is best|should)|recommend/.test(l)){
    turn("That's your call, so I won't pick one.", /exempt|overtime/.test(l) ? sourceCard('ot') : /contractor|employee/.test(l) ? sourceCard('con') : /pay|salary/.test(l) && S.posting && S.posting.min ? `<p class="ag-quiet">Posted range: ${rangeText(S.posting)}</p>` : ''); if(o && !['roles', 'review', 'left', 'list', 'confirm'].includes(o.id)){ const q = {...o}; delete q.el; ask(q); } return; }
  if(/^(what is|what's|whats|what are|what does|explain|define|meaning of|why is)\b/.test(l) && !/\b(the|my)\s+(salary|pay|start|title|email|bonus)\b/.test(l) && explain(t)) return;
  if(/\bwhy\b.*(need|ask)/.test(l)){ const k = /state/.test(l) || (o && o.id === 'state') ? 'state' : ''; turn(k === 'state' ? TIP.state : isCon() ? 'Bolto uses it to fill the letter.' : 'Bolto uses it to fill the letter or to set them up in payroll.'); return; }
  if(/^(what'?s|what is|whats) (the )?(salary|pay)\b/.test(l)){ valueTurn('Pay', payText() || 'not set', 'amount'); return; }
  if(/who('?s| is) (this|it) from|who('?s| is) send|who sends/.test(l)){ const s0 = sender(); valueTurn('From', `${s0.name}, ${s0.title}`, 'sender'); return; }
  if(/who is this (going )?to|who'?s this for|who is it for/.test(l)){ valueTurn('Going to', `${fullName() || 'not set'}${S.f.email ? ', ' + S.f.email : ''}`, 'first'); return; }
  if(/^(what'?s|what is|whats) the (start date|title|job title|email|bonus|state)\b/.test(l)){ const F = FIELD_WORDS.find(f => f[0].test(l)); valueTurn(LABEL(F[1]), disp(F[1], S.f[F[1]]), F[1]); return; }
  if(/^(?:please\s+)?(?:change|set|edit|update|remove|drop|skip)\b.*\bi[\s-]?9\b/.test(l)){ turn(isCon() ? CON_I9 : "The I-9 can't be changed. Every US employee needs one."); return; }
  if(/\btemplate\b/.test(l)){ turn("You can choose Standard or Concise. Company templates aren't here yet."); return; }
  if(/^save\b|\bsave (?:it |this )?as (?:a )?draft\b/.test(l)){ turn(saveBroken() ? "Couldn't save just now. Use Try again at the top of the page." : 'It saves as you go. You can leave and come back.'); return; }
  /* changes with a value */
  if(/make it (concise|standard)/.test(l)){ change('style', /concise/.test(l) ? 'Concise' : 'Standard'); settle(); return; }
  if(/^(remove|no|drop) (the )?bonus/.test(l)){ toggleOff('bonus'); settle(); return; }
  if(/^(remove|no|drop) (the )?equity/.test(l)){ toggleOff('equity'); settle(); return; }
  { const m = l.match(/add (?:an? )?(.*)bonus/); if(m){ const mo = parseMoney(m[1]); if(mo) change('bonus', mo.val); else { pushUndo(snapshot()); S.f.bonusOpen = true; A.extrasDone = true; onCommit('bonusOpen'); askField('bonus'); } settle(); return; } }
  { const m = l.match(/add equity\s*(.*)/); if(m){ if(m[1]){ change('equity', t.slice(t.toLowerCase().indexOf('equity') + 7).trim()); settle(); } else { pushUndo(snapshot()); S.f.equityOpen = true; A.extrasDone = true; onCommit('equityOpen'); askField('equity'); } return; } }
  { const m = l.match(/remote,?\s+(?:in|from)\s+(.+)/); if(m){ const s = parseState(m[1]); if(s.length === 1){ if(S.f.location !== 'Remote') change('location', 'Remote'); S.f.workplace = ''; change('state', s[0][0]); settle(); return; } if(s.length > 1){ stateChoice(s); return; } } }
  { const m = l.match(/reports? to (.+)/); const p = m && parsePerson(m[1]); if(p){ change('reportsTo', p); settle(); return; } }
  { const m = t.match(/^(?:please\s+)?(?:change|set|make|update|move)\s+(?:the\s+|my\s+|her\s+|his\s+|their\s+)?(.+?)\s+to\s+(.+)$/i); if(m){ const F = FIELD_WORDS.find(x => x[0].test(m[1].toLowerCase())); if(F && setField(F[1], m[2])) return; } }
  if(/^(change|set|make|move|update|actually)\b|^(start|pay|salary|expires?)\b/.test(l)){
    const d = parseDate(t);
    if(d && !/end/.test(l) && !/expir/.test(l) && (/start|actually/.test(l))){ if(o && o.id === 'job' && o.fields && o.fields[0] === 'endDate') change('endDate', d); else change('startDate', d); settle(); return; }
    if(d && /end/.test(l)){ change('endDate', d); settle(); return; }
    if(d && /expir/.test(l)){ if(new Date(d + 'T00:00') < TODAY){ turn("The offer can't expire before today."); return; } change('expiry', d); settle(); return; }
    if(/pay|salary|rate|amount/.test(l)){ if(setPay(l.replace(/^.*?(pay|salary|rate|amount)/, ''))) return; }
    const F = FIELD_WORDS.find(f => f[0].test(l)); if(F){ askField(F[1]); return; }
  }
  /* a free answer to the open question */
  if(o && typedKind(t, l, o) === 'answer' && answerOpen(o, t, l)) return;
  if(explain(t)) return;
  if(!A.picked && o && o.id === 'roles' && l.split(/\s+/).length <= 3){ turn(`No roles match "${t.slice(0, 40)}".`); return; }
  fallback();
}
function settle(){ const A = ag(), q = plan(); if(!A.open || (A.open.id === 'review') || !q || A.open.id !== q.id){ reconcile(); } else reAsk(); }
function showLeft(){ const miss = missing(), A = ag(); if(!miss.length){ wrapUp(); return; } closeOpen(); const el = turn('These are still open.', `<div class="ag-rows">${miss.map(m => row('field:' + m.k, m.msg)).join('')}</div>`, {count:miss.length}); A.open = {id:'left', el}; focusNext(el); }
function valueTurn(l, v, k){ turn(`${l}: ${v}.`, `<div class="ag-chips">${chip('field:' + k, 'Change')}</div>`); }
function stateChoice(list){ const A = ag(); closeOpen(); const el = turn('Which one?', `<div class="ag-rows">${list.map(([c, n]) => row('ans:state:' + c, n)).join('')}</div>`, {count:list.length}); A.open = {id:'state', el, change:true}; focusNext(el); }
/* what a typed overtime answer says: 'yes' gets overtime, 'no' doesn't, '' couldn't tell. Negation counts wherever it sits in the sentence */
function otSays(raw, walk){ const s = raw.toLowerCase().replace(/[.?!,;:]+/g, ' ').replace(/’/g, "'").replace(/over\s+time/g, 'overtime').replace(/\bot\b/g, 'overtime').replace(/\s+/g, ' ').trim(), neg = /\b(?:no|not|never|none|without|nope|nah)\b|n't\b/.test(s);
  if(/\bnon[\s-]?exempt\b/.test(s)) return 'yes'; if(/\bexempt\b/.test(s)) return neg ? 'yes' : 'no'; if(/\bineligible\b/.test(s)) return 'no';
  if(/\b(?:overtime|eligible)\b/.test(s)){ if(/^(?:no|nope|nah)\b/.test(s) && /\b(?:gets?|is|does|eligible)\b/.test(s) && !/n't\b|\bnot\b/.test(s)) return ''; return neg ? 'no' : 'yes'; }
  if(walk) return ''; if(/^(?:y|yes|yeah|yep|yup)\b|^(?:she|he|they) (?:does|do|gets?)$/.test(s)) return 'yes'; if(/^(?:n|no|nope|nah)\b|^(?:she|he|they) (?:doesn't|does not|don't|do not)$/.test(s)) return 'no'; return ''; }
function answerOpen(o, t, l){
  const A = ag(), id = o.id, go = (v, label) => { answer(o, v, label); return true; }, short = l.split(/\s+/).length <= 4, has = w => short && near(l, w);
  if(id === 'type'){ if(/\bfreelanc|\bconsult|\bindependent\b/.test(l)) return go('c', 'Contractor 1099'); if(/\bft\b/.test(l)) return go('ft', 'Full-time W-2'); if(/\bpt\b/.test(l)) return go('pt', 'Part-time W-2'); if((/\bw[\s-]?2\b|\bemployee\b|\bpermanent\b|\bstaff\b/.test(l)) && !/part|full/.test(l)){ closeOpen(); const el = turn('Full-time or part-time?', `<div class="ag-rows">${[['ft', 'Full-time', 'briefcase'], ['pt', 'Part-time', 'clock-3']].map(([v, n, i]) => row('ans:type:' + v, n, {icon:i, right:'W-2', keep:true, lab:`${n} W-2`})).join('')}</div>`, {count:2}); A.open = {...o, el}; renderHelpers(['skip']); focusNext(el); return true; } if(/full/.test(l) || has('full')) return go('ft', 'Full-time W-2'); if(/part/.test(l) || has('part')) return go('pt', 'Part-time W-2'); if(/contract|1099/.test(l) || has('contractor')) return go('c', 'Contractor 1099'); }
  if(id === 'loc'){ if(/remote/.test(l) || has('remote')) return go('Remote', 'Remote'); if(/hybrid/.test(l) || has('hybrid')) return go('Hybrid', 'Hybrid'); if(/on.?site|office|\bin[\s-]?person\b/.test(l) || has('onsite')) return go('On-site', 'On-site'); if(/\bwfh\b|from home/.test(l)) return go('Remote', 'Remote'); }
  if(id === 'state'){ const s = parseState(t); if(s.length === 1) return go(s[0][0], s[0][1]); if(s.length > 1){ stateChoice(s); return true; } if(l.split(/\s+/).length > 2) return false; turn(`I don't know a state called "${t.slice(0, 40)}".`); return true; }
  if(id === 'office'){ const hit = OFFICES.find(x => l.includes(x.name.toLowerCase().split(' ')[0]) || /new york|ny/.test(l)); if(hit) return go(hit.id, hit.name); if(/remote/.test(l)){ change('location', 'Remote'); settle(); return true; } if(short && OFFICES.length === 1){ turn(`${OFFICES[0].name} is the only office set up.`); return true; } }
  if(id === 'extras'){ if(/both/.test(l) || has('both')) return go('both', 'Both'); if(/neither|none|no\b/.test(l) || has('neither')) return go('none', 'Neither'); if(/bonus/.test(l) || has('bonus')) return go('bonus', 'Signing bonus'); if(/equity/.test(l) || has('equity')) return go('equity', 'Equity'); }
  if(id === 'invite'){ if(/^y/.test(l) || /\binvite\b/.test(l) && !/\b(no|not|don'?t)\b/.test(l)) return go('yes', 'Yes'); if(/^n/.test(l) || /\b(not|don'?t)\b/.test(l)) return go('no', 'No'); }
  if(id === 'pg'){ if(/salar/.test(l)) return go('US Salaried', 'US Salaried'); if(/hour/.test(l)) return go('US Hourly', 'US Hourly'); }
  if(id === 'style'){ if(/concise|short/.test(l)) return go('Concise', 'Concise'); if(/standard|full/.test(l)) return go('Standard', 'Standard'); }
  if(id === 'ot'){ const H = ot().mode === 'hourly', says = otSays(t, o.walk);
    if(ot().mode === 'auto'){ if(says || /^(?:y|n)/.test(l)){ turn(`${ot().short || ot().why} To change that, change the pay.`); return true; } return false; }
    if(says) return go(says === 'yes' ? 'none' : 'exempt', says === 'yes' ? 'Yes' : 'No');
    if(H){ if(/^y/.test(l)) return go('software', 'Yes'); if(/^n/.test(l)) return go('none', 'No'); } else if(/\b(?:law|medicine|accounting|advanced|study)\b/.test(l) && (ot().opts || []).includes('study')) return go('study', DUTIES.study); else if(/\boffice\b|\badmin/.test(l) && (ot().opts || []).includes('admin')) return go('admin', DUTIES.admin); else if(/^(?:y|yes|yeah|yep|yup|n|no|nope|nah)\b/.test(l)){ turn(`Pick one of these, or tell me if ${who() || 'this person'} gets overtime pay.`); return true; } else { const hit = (ot().opts || []).find(v => (l.length >= 4 && DUTIES[v].toLowerCase().includes(l)) || l.split(/\W+/).includes(v) || (v === 'software' && /engineer|software|programmer/.test(l)) || (v === 'manage' && /manag/.test(l)) || (v === 'none' && /none/.test(l))); if(hit) return go(hit, DUTIES[hit]); } }
  if(id === 'conf'){ const c = S.conf[o.k], d = parseDate(t), ws = l.split(/\W+/); let i = c.opts.findIndex(x => (d && x.val === d) || String(x.val).toLowerCase() === l); if(i < 0 && /\b(?:first|1st)\b/.test(l)) i = 0; if(i < 0 && /\b(?:second|2nd|other)\b/.test(l)) i = 1; if(i < 0) i = c.opts.findIndex(x => (x.label || '').toLowerCase().split(/\W+/).some(w => w.length > 3 && ws.includes(w))); if(i >= 0){ resolveConf(o.k, i); return true; }
    if(d && ['startDate', 'endDate', 'expiry'].includes(o.k)){ pushUndo(snapshot()); delete S.conf[o.k]; S.f[o.k] = d; delete S.src[o.k]; S.typed[o.k] = true; onCommit(o.k, S.f.empType); renderTrack(); closeOpen(); canChange(bubble(sdt(d)), qFor(o.k), sdt(d)); next(); return true; } }
  if(id === 'prop' && /use|yes/.test(l)){ useProp(); return true; }
  if(id === 'pay' || id === 'prop'){ const m = parseMoney(l); if(m){ const u = m.unit || S.f.payType; if(!u){ S.f.amount = m.val; turn('A year or an hour?', `<div class="ag-chips">${chip('unit:Salary', 'A year')}${chip('unit:Hourly', 'An hour')}</div>`); return true; }
      { const e = payBad(num(m.val), u); if(e){ turn(e); return true; } } if(S.prop.amount) delete S.prop.amount;
      pushUndo(o.snap || snapshot()); if(S.f.payType !== u) set('payType', u); set('amount', m.val); closeOpen(); canChange(bubble(payText()), qFor('amount'), payText()); rangeNote(); next(); return true; } }
  if(id === 'who'){ const em = t.match(/[^\s,<]+@[^\s,>]+/), nm = t.replace(em ? em[0] : '', '').replace(/[,<>]/g, ' ').trim().split(/\s+/).filter(Boolean), named = nm.length >= 2 && /^[A-Z]/.test(nm[0]);
    if(named || em){ pushUndo(o.snap || snapshot()); if(named){ set('first', nm[0]); set('last', nm.slice(1).join(' ')); } if(em) set('email', em[0]); if(em && !validEmail()){ turn('Enter an email address in the correct format, like name@example.com'); return true; } closeOpen(); canChange(bubble(t), {id:'who', fields:BY.who}, t); next(); return true; } }
  if(o.change && (id === 'note' || (id === 'job' && ['title', 'department'].includes((o.fields || []).join())))){ const k = id === 'note' ? 'note' : o.fields[0]; pushUndo(o.snap || snapshot()); set(k, t.trim()); closeOpen(); canChange(bubble(t.trim()), o, t.trim()); next(); return true; }
  if(id === 'who' && o.change && /^[\p{L}][\p{L}' -]*$/u.test(t.trim())){ const p = t.trim().split(/\s+/), ks = o.fields; pushUndo(o.snap || snapshot()); if(ks.includes('first')) set('first', p[0]); if(ks.includes('last')) set('last', ks.includes('first') ? (p.slice(1).join(' ') || S.f.last) : t.trim()); closeOpen(); canChange(bubble(t.trim()), o, t.trim()); next(); return true; }
  if(id === 'job' || id === 'expiry'){ const d = parseDate(t), ks = o.fields || []; const k = ks.find(x => ['startDate', 'endDate', 'expiry'].includes(x) && !S.f[x]) || ks.find(x => ['startDate', 'endDate', 'expiry'].includes(x)); if(d && k){ if(k === 'expiry' && new Date(d + 'T00:00') < TODAY){ turn("The offer can't expire before today."); return true; } if(k === 'endDate' && S.f.startDate && d <= S.f.startDate){ turn('The contract must end after it starts.'); return true; } pushUndo(o.snap || snapshot()); set(k, d); canChange(bubble(sdt(d)), qFor(k), sdt(d)); reconcile(); return true; } const p = parsePerson(t); if(p && ks.includes('reportsTo')){ pushUndo(o.snap || snapshot()); set('reportsTo', p); canChange(bubble(p), qFor('reportsTo'), p); reconcile(); return true; } if(k && /\d|date|year|month|week|today|tomorrow|next|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/.test(l)){ turn('I need a real date for that, like June 15.'); return true; } }
  if(id === 'pay' && !parseMoney(l) && (/\d/.test(l) || short)){ turn('I need a number for the pay, like 150,000.'); return true; }
  if((id === 'bonus' || id === 'equity') && /^(?:none|no|nothing|remove(?: it)?|drop(?: it)?)$/.test(l)){ toggleOff(id); closeOpen(); next(); return true; }
  if(id === 'bonus'){ const m = parseMoney(l); if(m && num(m.val) <= 0){ turn('Enter a bonus amount above 0.'); return true; } if(m){ pushUndo(o.snap || snapshot()); set('bonus', m.val); const mo = !/\bnot repaid\b/.test(l) && l.match(/(\d+)\s*months?\b/); if(mo){ S.f.bonusRepay = true; onCommit('bonusRepay'); set('bonusMonths', mo[1]); } const said = `${disp('bonus', S.f.bonus)}${mo ? `, repaid within ${mo[1]} month${+mo[1] === 1 ? '' : 's'}` : ''}`; canChange(bubble(said), qFor('bonus'), said); reconcile(); return true; } }
  if(id === 'equity'){ pushUndo(o.snap || snapshot()); set('equity', t); closeOpen(); canChange(bubble(t), qFor('equity'), t); next(); return true; }
  return false;
}

/* ===================== mode and sync ===================== */
function modeEl(fade){ const hx = $('#hxSwitch'); if(hx && S.sent && $('input[value=form]', hx)){ hx.innerHTML = Segmented.html('view', [['agent', 'Agent'], ['preview', 'Preview']], document.body.classList.contains('view-letter') ? 'preview' : 'agent', {label:'View'}); Segmented.init(hx); } const m = $('#modeSwitch'); if(!m) return; const show = S.screen === 'offer' && !S.sent; if(fade && !show && !m.hidden && !instant()){ m.inert = true; m.classList.add('is-gone'); setTimeout(() => { m.hidden = !(S.screen === 'offer' && !S.sent); m.inert = false; m.classList.remove('is-gone'); }, Motion.ms('--d-close')); return; } m.hidden = !show; if(show){ if(!$('.seg', m)){ m.innerHTML = Segmented.html('mode', [['agent', 'Agent'], ['form', 'Form']], S.mode === 'agent' && S.screen === 'offer' ? 'agent' : 'form', {label:'How to work on this offer'}); Segmented.init(m); m.onchange = e => { if(e.target.name === 'mode') setMode(e.target.value); }; } else syncSeg('mode'); } }
function syncSeg(n){ const v = n === 'mode' ? (S.mode === 'agent' && S.screen === 'offer' ? 'agent' : 'form') : (document.body.classList.contains('view-letter') ? 'preview' : S.mode); const r = $(`input[name=${n}][value=${v}]`); if(r && !r.checked){ r.checked = true; } if(r){ const sg = r.closest('.seg'); if(sg) Segmented.sync(sg, true); } }
function applyBody(){ const on = S.mode === 'agent' && S.screen === 'offer'; document.body.classList.toggle('ag-mode', on); const ft = $('#footer'); if(ft && S.screen === 'offer') ft.hidden = on; }
const ORDER = {agent:0, form:1, preview:2};
/* pressing the switch must not scroll the page: the browser's focus scroll on a sticky radio jumped the outgoing form (1a item 5) */
document.addEventListener('mousedown', e => { const l = e.target.closest && e.target.closest('#modeSwitch label, #hxSwitch label'), r = l && l.querySelector('input'); if(r){ e.preventDefault(); r.focus({preventScroll:true}); } });
/* last way the switch was used: arrows keep focus on it, a press moves on to the first gap */
let swKeyed = false; document.addEventListener('keydown', e => { if(e.target.closest && e.target.closest('#modeSwitch, #hxSwitch')) swKeyed = true; }, true); document.addEventListener('pointerdown', () => { swKeyed = false; }, true);
function setMode(m, o = {}){
  const A = ag(); if(m === 'form' && A.busy){ A.fast = true; A.finishing = true; } if(S.screen !== 'offer' && m === 'agent'){ S.mode = 'agent'; go('offer', {animate:true, noFocus:true, after:returnFromForm}); return; }
  if(S.screen !== 'offer' && m === 'form'){ return; }
  if(m === S.mode && !o.force) return;
  finishSwap(); Mo.flush();
  A.scroll[S.mode] = S.mode === 'agent' ? (scroller() ? scroller().scrollTop : window.scrollY) : window.scrollY;
  const from = S.mode, dir = ORDER[m] >= ORDER[from] ? 1 : -1; if(m === 'form'){ A.snap = formSnap(); A.formLeft = true; }
  S.mode = m; if(document.body.classList.contains('view-letter')) setLetterView(false, true);
  syncSeg('mode'); syncSeg('view');
  const formEls = () => [$('#rail'), $('#formPane'), $('#chips'), $('#footer')], agentEls = () => [$('#agentPane')];
  swapPanes(dir, m === 'form' ? agentEls() : formEls(), () => { applyBody();
    if(m === 'form'){ if(S.sent){ go('sent', {animate:true}); return; } renderFields(); ACC.init(id => secStatus(id).state !== 'done'); window.scrollTo(0, A.scroll.form || 0); focusGap(); }
    else { if(wide()) window.scrollTo(0, 0); returnFromForm(); A.stick = true; Mo.pin(); Mo.latest(); } }, m === 'form' ? formEls : agentEls);
}
/* landing on the form: the first gap gets focus, unless the switch itself was used by keyboard */
function focusGap(){ const miss = missing(); if(miss.length){ const rv = Hifi.reveal; Hifi.reveal = (el, o = {}) => { const a = o.anchor || el; if(o.focus !== false && !swKeyed) Hifi.focusQuiet(el, {preventScroll:true}); const gap = px('--s4'), top = Hifi.stickyTop() + gap, ra = a.getBoundingClientRect(), re = el.getBoundingClientRect(), bot = innerHeight - Hifi.stickyBottom() - gap, dy = o.block === 'nearest' ? (ra.top < top ? ra.top - top : re.bottom > bot ? Math.min(re.bottom - bot, ra.top - top) : 0) : ra.top - top; window.scrollTo(0, Math.max(0, window.scrollY + dy)); return Promise.resolve(); }; try { focusField(miss[0].k); } finally { Hifi.reveal = rv; } } else { const t = $('#pageH1'); if(t && !swKeyed) Hifi.focusQuiet(t, {preventScroll:true}); } }
const formSnap = () => JSON.stringify([S.f, S.conf, S.prop, S.style]);
function returnFromForm(){ const A = ag(); if(!A.formLeft) return; A.formLeft = false;
  if(A.picked && !S.filled && (A.role || A.viaFill)){ A.picked = false; A.role = null; A.viaFill = false; askRoles(); return; }
  if(A.snap === formSnap()){ renderTrack(); return; } /* nothing changed in the form: the thread is exactly as it was */
  const was = JSON.parse(A.snap)[0], f = S.f, diff = Object.keys(f).filter(k => was[k] !== f[k] && !['duties', 'payrollGroup', 'bonusOpen', 'equityOpen', 'work'].includes(k));
  if(!A.picked && diff.length) A.picked = true;
  renderTrack();
  const styled = JSON.parse(A.snap)[3] !== S.style; if(diff.length || styled){ const rows = [...diff.slice(0, 4).map(k => `${LABEL(k)}: ${disp(k, f[k])}`), ...(styled ? [`Letter style: ${S.style}`] : [])].join(', '); line(`${ic('check')}<span>Picked up your changes from the form. ${h(rows)}</span>`, 'ag-change'); say('Picked up your changes from the form.'); if(A.open && A.open.id !== 'roles'){ const q = plan(); if(!q || q.id !== A.open.id){ const b = A.open.el.querySelector('.ag-block'); if(b) line(`<span>Answered in the form</span>`, 'ag-quietline'); } } }
  if(A.picked) reconcile();
}
function onView(v){ const A = ag(), inPrev = document.body.classList.contains('view-letter'), paneEls = () => S.mode === 'agent' ? [$('#agentPane')] : [$('#formPane')], letterEls = () => [$('#letterPane')];
  if(v === 'preview'){ if(inPrev) return; finishSwap(); Mo.flush(); swapPanes(1, paneEls(), () => setLetterView(true, true, {fromSwitch:true}), letterEls); return; }
  if(inPrev){ const was = S.mode; finishSwap(); swapPanes(-1, letterEls(), () => { setLetterView(false, true, {fromSwitch:true}); if(v !== was) { S.mode = v; } applyBody(); syncSeg('view'); if(v === 'agent'){ A.stick = true; Mo.pin(); } else if(v !== was) { renderFields(); ACC.init(id => secStatus(id).state !== 'done'); } if(v === 'form') focusGap(); }, paneEls); return; }
  setMode(v, {force:false}); syncSeg('view'); }

/* ===================== the pane and events ===================== */
function paneHTML(){ return `<div class="ag-panel"><div class="ag-trackw" id="ag-trackw"><div class="ag-track-clip"><div class="ag-track" id="ag-track"></div></div></div><div class="ag-scroll"><div class="ag-col" id="ag-col"></div></div><div class="ag-foot" id="ag-foot"><div class="ag-fade-b" id="ag-fade-b" aria-hidden="true"></div><button type="button" class="ag-latest" id="ag-latest" tabindex="-1" data-ag="latest">${ic('arrow-down')}<span id="ag-latest-t">Latest</span></button><div class="ag-foot-in"><div class="ag-foot-pad"><div class="ag-approve-f" id="ag-approve-f" inert><div class="ag-approve-clip"><section class="ag-approve" id="ag-approve" aria-label="Ready to review"></section></div></div><div class="ag-helpers-f" id="ag-help-f"><div class="ag-helpers" id="ag-help"></div></div><form class="ag-composer" id="ag-composer"><button type="button" class="ag-clip" data-ag="file" aria-label="Attach a file">${ic('paperclip')}</button><div class="ag-field-w" id="ag-field-w"><textarea id="ag-input" rows="1" aria-label="Message Bolto"></textarea></div><button type="submit" class="ag-send" id="ag-go" aria-label="Send">${ic('arrow-up')}</button></form></div></div></div></div>`; }
function mount(){
  finishSwap(); const pane = $('#agentPane'); if(!pane) return; const A = ag(); if(A.thread.isConnected) Mo.flush(); pane.innerHTML = paneHTML(); $('#ag-col').appendChild(A.thread); A.helpers = ''; renderTrack(); applyBody();
  if(S.sent){ const c = $('#ag-foot'); if(c){ c.classList.add('no-anim', 'is-gone'); } markSent(); }
  setPh(''); bind(pane); Mo.bindScroll();
  if(!A.started){ A.started = true; askRoles(); }
  else if(A.open){ const o = A.open; if(o.id === 'review'){ const sf = $('#ag-approve-f'); sf.classList.add('no-anim'); slot(true); setPh('Ask to change something'); requestAnimationFrame(() => requestAnimationFrame(() => sf.classList.remove('no-anim'))); } const Q = o.id && question(o); if(Q){ setPh(Q.ph); renderHelpers(Q.help || []); } }
  A.stick = true; requestAnimationFrame(() => { Mo.pin(); Mo.latest(); });
}
function bind(pane){
  pane.addEventListener('click', e => {
    const t = e.target.closest('[data-ag]'); if(!t) return; if(e.detail > 1 && /^(ans|role|conf|prop|blank|send|skip|keepit|again|field)/.test(t.dataset.ag)) return; const A = ag(); A.how = e.detail === 0 ? 'key' : 'pointer'; const [a, ...rest] = t.dataset.ag.split(':'), arg = rest.join(':'), o = A.open;
    if(a === 'latest'){ A.stick = true; A.toEnd = true; const e2 = Mo.el(); if(e2){ const y0 = e2.scrollTop, y1 = e2.scrollHeight - e2.clientHeight, ms = instant() ? 0 : Motion.ms('--d-slower'), ease = bezier('--ease-move'), t0 = performance.now(); const step = n => { const p = ms ? Math.min(1, (n - t0) / ms) : 1; e2.scrollTop = y0 + (y1 - y0) * ease(p); A.lastSet = e2.scrollTop; if(p < 1) requestAnimationFrame(step); else { Mo.pin(); Mo.latest(); } }; requestAnimationFrame(step); } Mo.latest(); return; }
    if(a === 'role'){ pickRole(arg, {src:t}); return; }
    if(a === 'more'){ setMore(!A.showAll); return; }
    if(a === 'ans'){ const [q, v] = arg.split(':'); if(!o) return; const lb = t.querySelector('.ag-row-l'), ch = t.querySelector('.ag-chip-l'); answer(o.id === q ? o : {...o, id:q}, v, t.dataset.lab || (lb ? lb.firstChild.textContent : ch ? ch.textContent : t.textContent.trim()), t); return; }
    if(a === 'blank'){ startBlank(); return; } if(a === 'retry-roles'){ closeOpen(); askRoles(); return; }
    if(a === 'again'){ again(arg); return; }
    if(a === 'field'){ askField(arg); return; } if(a === 'step'){ if(!A.busy) openStep(arg); return; }
    if(a === 'undo'){ undoLast(); return; } if(a === 'skip'){ skip(); return; } if(a === 'keepit'){ keepIt(); return; }
    if(a === 'say'){ A.echo = true; A.echoEl = null; bubble(t.textContent.trim()); understand(arg); A.echo = false; A.echoEl = null; return; }
    if(a === 'file'){ attachFile(); return; } if(a === 'open-review'){ openReview(); return; }
    if(a === 'restart'){ const m = S.mode; fresh(); S.mode = m; go('offer', {noFocus:true, animate:false}); return; } if(a === 'keep'){ closeOpen(); bubble('Keep this offer'); next(); return; }
    if(a === 'conf'){ const [k, i] = arg.split(':'); resolveConf(k, i); return; } if(a === 'prop'){ if(arg === 'use') useProp(); else { delete S.prop.amount; refresh(null, true); closeOpen(); next(); } return; }
    if(a === 'unit'){ set('payType', arg); closeOpen(); canChange(bubble(payText()), qFor('amount'), payText()); next(); return; }
    if(a === 'tool'){ if(t.disabled) return; const w = t.parentElement, f = w.classList.toggle('is-folded'); t.setAttribute('aria-expanded', String(!f)); return; }
  });
  const lit = t => { $$('#letter .is-lit').forEach(x => x.classList.remove('is-lit')); if(!t || !matchMedia('(hover: hover)').matches) return; const st = t.dataset.ag && STEPS.find(s => 'step:' + s.id === t.dataset.ag), ks = st ? st.keys : (t.dataset.keys || '').split(' ').filter(Boolean); ks.forEach(k => $$(`#letter [data-v="${k}"]`).forEach(x => x.classList.add('is-lit'))); };
  pane.addEventListener('mouseover', e => { const t = e.target.closest('.ag-step, .ag-tool-row, .ag-sum-r'); if(t) lit(t); });
  pane.addEventListener('mouseout', e => { if(e.target.closest('.ag-step, .ag-tool-row, .ag-sum-r')) lit(null); });
  pane.addEventListener('focusin', e => { const t = e.target.closest('.ag-sum-r'); if(t) lit(t); });
  pane.addEventListener('focusout', e => { if(e.target.closest('.ag-sum-r')) lit(null); });
  pane.addEventListener('submit', e => { e.preventDefault(); const A = ag();
    if(e.target.id === 'ag-composer'){ sendComposer(); return; }
    const c = e.target.closest('[data-card]'); if(c && A.open && A.open.fields){ A.how = 'key'; submitCard(A.open, c); } });
  pane.addEventListener('input', e => { const t = e.target;
    if(t.id === 'ag-input'){ t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; $('#ag-go').classList.toggle('has-text', !!t.value.trim()); $$('.ag-phs').forEach(x => x.classList.toggle('is-hidden', !!t.value)); if(ag().open && ag().open.id === 'roles') filterRoles(t.value); }
    if(t.id === 'ag-state-q'){ const o = ag().open; $('#ag-state-l').innerHTML = stateRows(t.value, o && o.change ? S.f.state : ''); }
    if(t.classList && t.classList.contains('ag-grow')){ t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; }
    if(t.name === 'payType' && $('.ag-unit')) setTimeout(() => { const u = $('.ag-unit'); if(u) u.textContent = unitWord(); }, 0); });
  pane.addEventListener('change', e => { if(e.target.name === 'payType'){ const u = $('.ag-unit'); if(u) u.textContent = unitWord(); } });
  pane.addEventListener('keydown', e => { if(e.target.id === 'ag-input' && e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendComposer(); } });
}
function sendComposer(){ const i = $('#ag-input'), A = ag(); if(!i) return; const t = i.value; if(!t.trim()) return; const cs = getComputedStyle(i), rr = i.getBoundingClientRect(), r = {left:rr.left + parseFloat(cs.paddingLeft), top:rr.top + parseFloat(cs.paddingTop)};
  i.value = ''; i.style.height = ''; $('#ag-go').classList.remove('has-text'); $$('.ag-phs').forEach(x => x.classList.remove('is-hidden')); A.how = 'typed'; filterRoles(''); A.echo = true; A.echoEl = null; const me = bubble(t); if(!instant()){ const q = me.querySelector('.ag-bubble').getBoundingClientRect(); A.lateUntil = performance.now() + Mo.dur({x:r.left, y:r.top}, {x:q.left, y:q.top}) + Motion.ms('--ag-land'); } understand(t); A.echo = false; A.echoEl = null; if(!instant()) Mo.lift(me, r); }

function afterGo(screen){ applyBody(); modeEl(); if(screen === 'offer'){ mount(); } }

/* ===================== demo menu ===================== */
const DEMO_GROUPS = [{label:'States', items:[['start', 'Start'], ['filling', 'Filling'], ['filled', 'Filled with questions left'], ['conflict', 'Conflict'], ['invalid', 'Invalid answer'], ['explain', 'Explanation'], ['review', 'Summary'], ['letter', 'Final letter'], ['letter-end', 'Final letter, read'], ['sent', 'Sent']]}, {label:'People', items:[['priya', 'Priya'], ['marcus', 'Marcus'], ['nocand', 'Role with no candidate'], ['blank', 'Blank'], ['draft', 'Back to a draft']]}].map(g => ({label:g.label, items:g.items.map(([id, label]) => ({id, label}))}));
window.DEMO_GROUPS = DEMO_GROUPS;
function reset(){ const m = S && S.mode; rvReset(); finishSwap(); if(S && S.ag) Mo.flush(); document.body.classList.remove('ag-working'); fresh(); S.mode = 'agent'; go('offer', {noFocus:true, animate:false}); }
async function alexFast(){ const A = ag(); A.fast = true; await pickRole('alex', {stop:true}); A.fast = false; }
function alexReady(){ S.f.empType = 'ft'; S.typed.empType = true; S.f.state = 'CA'; S.typed.state = true; onCommit('state', ''); S.f.duties = 'software'; S.otBasis = basisKey(); S.otMode = ot().mode; refresh(null, true); renderTrack(); }
let DEMO;
let LAST = 'start';
async function preset(p){
  LAST = p; reset(); const A = ag();
  if(p === 'start'){ }
  else if(p === 'filling'){ A.holdAt = 2; pickRole('alex'); }
  else if(p === 'filled'){ await alexFast(); next(); }
  else if(p === 'conflict'){ await alexFast(); applyEmail(ALEX_EMAIL); refresh(null, true); renderTrack(); next(); }
  else if(p === 'invalid'){ await alexFast(); S.f.email = 'alex.rivera@example'; delete S.src.email; S.typed.email = true; refresh(null, true); renderTrack(); next(); const c = $('[data-card]'); if(c && ag().open && ag().open.fields) submitCard(ag().open, c); }
  else if(p === 'explain'){ await alexFast(); next(); bubble('what is an I-9'); understand('what is an I-9'); }
  else if(p === 'review'){ await alexFast(); alexReady(); next(); }
  else if(p === 'letter' || p === 'letter-end'){ await alexFast(); alexReady(); next(); A.fast = true; openReview(); A.fast = false; if(p === 'letter-end'){ const e = rvS(); e.scrollTop = e.scrollHeight; rvCheck(); } }
  else if(p === 'sent'){ await alexFast(); alexReady(); next(); A.fast = true; doSend(); A.fast = false; }
  else if(p === 'priya'){ A.fast = true; await pickRole('priya', {stop:true}); A.fast = false; next(); }
  else if(p === 'marcus'){ A.fast = true; await pickRole('marcus', {stop:true}); A.fast = false; next(); }
  else if(p === 'nocand'){ A.fast = true; await pickRole('ae', {stop:true}); A.fast = false; next(); }
  else if(p === 'blank') startBlank();
  else if(p === 'draft'){ await alexFast(); S.f.empType = 'ft'; S.typed.empType = true; onCommit('empType', ''); turn('You saved this on May 22.'); next(); }
  if(DEMO) DEMO.mark(p);
  /* a preset rebuilds the page in one task, which can clamp the scroll to 0 and read as the person scrolling up: come to rest on the open question, clear of the composer */
  const B = ag(); requestAnimationFrame(() => requestAnimationFrame(() => { if(S.ag === B){ B.stick = true; Mo.pin(); Mo.latest(); } }));
}
window.preset = preset;
Toggletip.init(document);
Hifi.shell();
setTimeout(() => {
  DEMO = Demo.mount({groups:DEMO_GROUPS, note:'Prototype controls: jump between states. The agent is simulated with demo data and has no model behind it.',
    toggles:[{id:'ashbyDown', label:'Hiring tool unreachable'}, {id:'atsOff', label:'Not connected'}, {id:'noRoles', label:'No open roles'}, {id:'saveFail', label:'Saving fails'}, {id:'sendFail', label:'Sending fails'}, {id:'boltoJobs', label:'Roles come from Bolto Recruiting'}],
    onPick:id => preset(id), onToggle:(id, on) => { WF[id] = on; if(['boltoJobs', 'ashbyDown', 'atsOff', 'noRoles'].includes(id)) preset(LAST); }});
  preset(new URLSearchParams(location.search).get('state') || 'start');
}, 0);
rvBindOnce();
return {mount, afterGo, setMode, onView, askField, openReview, onStyle};
})();
