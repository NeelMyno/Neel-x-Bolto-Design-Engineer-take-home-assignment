/* Bolto hi-fi shared controllers (v1 and v2). No framework; plain DOM. Needs icons/icons.js first.

   API (window.Hifi)
   - $(sel, root), $$(sel, root), esc(str)
   - Motion.reduced() -> bool            prefers-reduced-motion, read live
     Motion.ms('--d-slow') -> number     a duration token in ms (0 under reduced motion unless {raw:true})
     Motion.after(el, ms) -> Promise     resolves on transitionend of el itself, or after ms (safety)
     Motion.swapText(el, html)           M5: old text out up, new text in from below
     Motion.enter(els)                   M1/M15: rise + fade in reading order, once
     Motion.reveal(el, show) -> Promise  M2 open/close for any block (rows 0fr/1fr, content fade, hidden+inert when closed)
   - say(msg)                            polite live region (#hx-live), batched
   - Ring.html() / Ring.set(el, {state:'todo'|'progress'|'done'|'error'|'wait', frac:0..1}, {animate})
   - Accordion: const acc = new Hifi.Accordion({sections:[{id, el, title, isDone(), summary()}], onToggle(id, open, how)})
       markup per section: section.acc[data-sec] > .acc-head > h2 > button.acc-btn[aria-expanded][aria-controls]
         (.ring[data-ring-for], .acc-title > .acc-name + .acc-sum, .acc-left, .acc-chev) + .acc-aside (slot: toggletips,
         and v2's source badge) ; then .acc-panel#id > .acc-clip > .acc-inner
       acc.init(id => startOpen)         no animation; records each section's done state
       acc.update()                      call after every state change: runs rules 3-5 (collapse once on not-done -> done,
                                         only when focus has left, never over a person's own reopen) and refreshes summaries
       acc.open(id, {how:'user'|'auto', animate}) / acc.close(id, {how, anchor, animate}) -> Promise
       acc.isOpen(id), acc.collapseDone({stagger:'--stagger-close'}) (v2 fill cascade: closes every done, unpinned section
                                         whose focus is elsewhere, --stagger-close apart)
       Rule 6 (the field you're in never moves) is ScrollKeeper.track(anchor) during every close/auto-open.
   - Checklist: new Hifi.Checklist({items:[{id,label}], rail, chips, onJump(id)}); .set(id, {state, frac, left, label})
       updates the rail row, its chip, every .ring[data-ring-for=id] and .acc-left[data-left-for=id]
   - Toggletip.init(root)                delegated; markup: span.tip > button.tip-btn[aria-expanded][data-text] + span.tip-pop
   - Segmented.init(root) / Segmented.sync(seg, animate)   markup: .seg[role=radiogroup] > .seg-thumb + label.seg-opt > input[type=radio]
   - busy(btn, on)                       M10: label fades, spinner after --d-busy-delay, width held
   - Demo.mount({groups:[{label, items:[{id,label}]}], toggles:[{id,label,checked}], onPick(id), onToggle(id, on)})
   - Fill.cascade(items, fn, {stagger:'--stagger-fill'}) -> Promise   v2 M20: fn(item, i) in reading order, reduced = at once
     Fill.sweep(el)                      v2 M20: left-to-right tint sweep (clip-path)
   - SaveMark(el, {sizes:[html...]}): .set(key, html, {draw}) -> false when key unchanged (no-op)
                                         save indicator: old + new layers crossfade in one grid cell, right-aligned;
                                         sizes = invisible layers that hold the width; draw = icon strokes draw in (hx-draw)
                                         .layer() = the live layer; SaveMark.saving(label) = held-space spinner (after --d-busy-delay) + label
   - StatusLine(el): .busy(text) / .done(text)   v2 status line; spinner after --d-busy-delay, held >= --d-busy-hold
   - shell()                             header hairline on scroll; ScrollKeeper bookkeeping
   - Keeper.pause() / Keeper.resume()   suspend every track/hold correction (nested; balanced calls)
   - Keeper.hold(el, top, ms)            keep el's screen top at `top` through opens/closes for ms (the Edit/Preview return)
   - focusQuiet(el, {preventScroll})     programmatic focus that draws no keyboard ring after a touch tap
   - Checklist.set(id, {meta, flag})     meta overrides "N left"; flag (e.g. 'conflict') lands as data-flag on rail, chip, header slot
*/
(function(){
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
const raf = () => new Promise(r => requestAnimationFrame(() => r()));

/* ---------------- motion ---------------- */
const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
const Motion = {
  reduced: () => RM.matches,
  ms(name, o = {}){
    if(!o.raw && RM.matches) return 0;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(v); if(isNaN(n)) return 0;
    return /ms$/.test(v) ? n : n * 1000;
  },
  after(el, ms){
    return new Promise(res => {
      if(!ms){ res(); return; }
      let done = false; const fin = () => { if(done) return; done = true; el.removeEventListener('transitionend', on); res(); };
      const on = e => { if(e.target === el) fin(); };
      el.addEventListener('transitionend', on); setTimeout(fin, ms + 60);
    });
  },
  swapText(el, html){
    if(el.dataset.html === html) return; el.dataset.html = html;
    const out = Motion.ms('--d-micro');
    if(!out){ el.innerHTML = html; return; }
    el.classList.remove('in'); el.classList.add('out');
    setTimeout(() => { el.innerHTML = html; el.classList.remove('out'); el.classList.add('pre'); void el.offsetWidth; el.classList.remove('pre'); el.classList.add('in'); }, out);
  },
  /* M2 open/close for any block: rows 0fr<->1fr, content fades (out first on close, in after --d-delay on open);
     closed = hidden + inert. Children are wrapped once in .hx-reveal-in. Reduced motion: instant. -> Promise */
  reveal(el, show){
    if(!el) return Promise.resolve();
    show = !!show;
    if(!el.classList.contains('hx-reveal')){
      const wasShown = !el.hidden;
      let inner = el.children.length === 1 && el.firstElementChild.classList.contains('hx-reveal-in') ? el.firstElementChild : null;
      if(!inner){ inner = document.createElement('div'); inner.className = 'hx-reveal-in'; while(el.firstChild) inner.appendChild(el.firstChild); el.appendChild(inner); }
      el.classList.add('hx-reveal'); el.dataset.shown = String(wasShown); if(!wasShown) el.inert = true; else el.classList.add('is-settled');
    }
    const tok = (el.__rv = (el.__rv || 0) + 1);
    if(show){
      if(el.dataset.shown === 'true' && !el.hidden) return Promise.resolve();
      el.hidden = false; el.inert = false; el.dataset.shown = 'false'; void el.offsetHeight;
      el.dataset.shown = 'true';
      return Motion.after(el, Motion.ms('--d-slow')).then(() => { if(el.__rv === tok) el.classList.add('is-settled'); });
    }
    if(el.dataset.shown === 'false' || el.hidden){ el.dataset.shown = 'false'; el.hidden = true; el.inert = true; return Promise.resolve(); }
    el.classList.remove('is-settled'); el.inert = true; el.dataset.shown = 'false';
    return Motion.after(el, Motion.ms('--d-close')).then(() => { if(el.__rv === tok) el.hidden = true; });
  },
  enter(els){
    if(RM.matches) return;
    els.filter(Boolean).forEach((el, i) => { el.style.setProperty('--i', i); el.classList.remove('hx-enter'); void el.offsetWidth; el.classList.add('hx-enter');
      el.addEventListener('animationend', () => el.classList.remove('hx-enter'), {once:true}); });
  }
};

/* ---------------- live region ---------------- */
let sayBuf = [], sayT;
function say(m){
  if(!m) return; let l = $('#hx-live');
  if(!l){ l = document.createElement('div'); l.id = 'hx-live'; l.className = 'sr'; l.setAttribute('aria-live', 'polite'); document.body.appendChild(l); }
  sayBuf.push(m); clearTimeout(sayT);
  sayT = setTimeout(() => { l.textContent = ''; setTimeout(() => { l.textContent = sayBuf.join(' '); sayBuf = []; }, 40); }, 60);
}

/* ---------------- ring ---------------- */
const C = 2 * Math.PI * 8;
const Ring = {
  html(id){
    return `<span class="ring no-anim" data-state="todo"${id ? ` data-ring-for="${id}"` : ''} aria-hidden="true"><svg viewBox="0 0 20 20">
      <circle class="r-track" cx="10" cy="10" r="8"/><circle class="r-arc" cx="10" cy="10" r="8" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}"/>
      <circle class="r-fill" cx="10" cy="10" r="9"/><path class="r-check" d="M7.5 10l1.67 1.67 3.33-3.33"/></svg>${Icons.svg('circle-alert', 'r-alert')}${Icons.svg('circle-dashed', 'r-wait')}</span>`;
  },
  set(el, {state, frac = 0}, o = {}){
    if(!el) return;
    if(o.animate === false) el.classList.add('no-anim');
    el.dataset.state = state;
    const arc = el.querySelector('.r-arc');
    if(arc) arc.setAttribute('stroke-dashoffset', (C * (1 - Math.max(0, Math.min(1, state === 'done' ? 1 : frac)))).toFixed(2));
    if(el.classList.contains('no-anim')) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('no-anim')));
  }
};

/* ---------------- scroll keeper: rule 6, the focused field never moves ----------------
   No spacer, no body hold. An auto-close that would move the focused field does not run (Keeper.fits says no);
   the Accordion keeps it pending and retries when scrolling stops (Keeper.onScroll) and on the next focus change.
   While a panel animates, track() puts the anchor back in the same frame the layout changes (ResizeObserver on
   body, which fires after layout and before paint, plus a per-frame check). */
const Keeper = {
  retries: new Set(), scrollT: null, paused: 0,
  /* pause()/resume(): every track/hold stops correcting scroll (and retries wait) until the matching resume */
  pause(){ this.paused++; },
  resume(){ this.paused = Math.max(0, this.paused - 1); if(!this.paused) this.onScroll(); },
  /* can panel shrink to 0 without moving anchor? (section above: scroll must absorb it; below: page must not clamp) */
  fits(anchor, panel){
    if(!anchor || !anchor.isConnected || anchor === document.body || !panel) return true;
    const p = panel.getBoundingClientRect(), a = anchor.getBoundingClientRect(), h = p.height;
    if(h < 0.5) return true;
    const se = document.scrollingElement || document.documentElement;
    if(p.bottom <= a.top + 0.5) return window.scrollY >= h - 0.5;
    if(p.top >= a.bottom - 0.5) return se.scrollHeight - h >= window.scrollY + window.innerHeight - 0.5;
    return false;
  },
  onScroll(){ clearTimeout(this.scrollT); this.scrollT = setTimeout(() => this.retry(), 140); },
  retry(){ if(this.paused) return; this.retries.forEach(fn => { try { fn(); } catch(e){ console.warn(e); } }); },
  /* follow the anchor until stop(); returns {stop} */
  track(anchor){
    if(!anchor || !anchor.isConnected || anchor === document.body) return {stop(){}};
    const start = anchor.getBoundingClientRect().top; let live = true;
    const correct = () => { if(!live || Keeper.paused || !anchor.isConnected) return; const d = anchor.getBoundingClientRect().top - start; if(Math.abs(d) >= 0.5) window.scrollBy(0, d); };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(correct) : null;
    if(ro) ro.observe(document.body);
    const step = () => { if(!live) return; correct(); requestAnimationFrame(step); };
    requestAnimationFrame(step);
    return {stop: () => { if(!live) return; correct(); live = false; if(ro) ro.disconnect(); }};
  },
  /* put anchor's screen top back at `top` and keep it there while sections open or close, for `ms`; a person's own
     scroll (wheel, touch, keys) ends the hold at once, so it never fights them. Returns {stop} */
  hold(anchor, top, ms){
    if(!anchor || !anchor.isConnected) return {stop(){}};
    let live = true;
    const correct = () => { if(!live || Keeper.paused || !anchor.isConnected) return; const d = anchor.getBoundingClientRect().top - top; if(Math.abs(d) >= 0.5) window.scrollBy(0, d); };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(correct) : null;
    const quit = () => stop();
    const evs = ['wheel', 'touchstart', 'keydown'];
    function stop(){ if(!live) return; live = false; if(ro) ro.disconnect(); evs.forEach(e => window.removeEventListener(e, quit, true)); }
    if(ro) ro.observe(document.body);
    correct();
    const step = () => { if(!live) return; correct(); requestAnimationFrame(step); };
    requestAnimationFrame(step);
    setTimeout(() => evs.forEach(e => window.addEventListener(e, quit, {capture:true, passive:true})), 0);
    setTimeout(stop, ms);
    return {stop};
  }
};

/* ---------------- quiet focus: a programmatic focus after a fill, a collapse or a jump draws no keyboard ring on touch ----------------
   The last input decides: a touch (or pen) tap -> no ring; a key or a mouse -> the browser's own :focus-visible rule.
   focus({focusVisible:false}) where the browser supports it, plus [data-quiet-focus] (cleared on blur or the next key)
   for the ring rules that sit on a wrapper (.affix, .seg-opt, .chk, .rcard) and for browsers that ignore the option. */
let modality = 'key';
window.addEventListener('pointerdown', e => { modality = e.pointerType === 'mouse' ? 'mouse' : 'touch'; }, {capture:true, passive:true});
window.addEventListener('keydown', e => { modality = 'key'; const a = document.activeElement; if(a && a.dataset && 'quietFocus' in a.dataset && !e.metaKey && !e.ctrlKey) delete a.dataset.quietFocus; }, true);
/* checkbox pop (M11): only on a real user change, never on first paint or a re-render */
document.addEventListener('change', e => { const t = e.target; if(!t || t.type !== 'checkbox' || !t.checked) return;
  const b = t.nextElementSibling; if(!b || !b.classList.contains('box')) return;
  b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop');
  b.addEventListener('animationend', () => b.classList.remove('is-pop'), {once:true}); });
function focusQuiet(el, o = {}){
  if(!el || typeof el.focus !== 'function') return;
  const preventScroll = o.preventScroll !== false;
  if(modality === 'key'){ el.focus({preventScroll}); return; }
  el.dataset.quietFocus = '';
  el.addEventListener('blur', () => { delete el.dataset.quietFocus; }, {once:true});
  el.focus({preventScroll, focusVisible:false});
}

/* ---------------- reveal (r4): a jump lands its target below the sticky stack and above the footer ----------------
   Waits for the open/close that the jump started to settle (the anchor's top stops moving), then scrolls once so the
   anchor sits just under the sticky bars (header, plus switch/chips on phones, measured live), and focuses el. */
const STICKY = '.hx-header, .hx-switch, .hx-chips';
function stickyTop(){
  let b = 0;
  $$(STICKY).forEach(s => { const cs = getComputedStyle(s); if(cs.display === 'none' || !/sticky|fixed/.test(cs.position)) return;
    const r = s.getBoundingClientRect(); if(r.height && r.top <= parseFloat(cs.top || 0) + 1) b = Math.max(b, r.bottom); });
  return Math.round(b);
}
function stickyBottom(){
  const f = $('.hx-footer'); if(!f) return 0; const cs = getComputedStyle(f);
  if(cs.display === 'none' || cs.position !== 'fixed') return 0;
  return Math.max(0, Math.round(window.innerHeight - f.getBoundingClientRect().top));
}
let revealTok = 0;
async function reveal(el, o = {}){
  if(!el) return; const tok = ++revealTok;
  const anchor = o.anchor || el, gap = o.gap ?? 16, t0 = performance.now(), cap = Motion.ms('--d-slow', {raw:true}) + 1200;
  if(o.focus !== false) focusQuiet(el);
  /* a person's own scroll ends the reveal at once, so it never fights them */
  let quit = false; const q = () => { quit = true; }, evs = ['wheel', 'touchstart'];
  evs.forEach(e => window.addEventListener(e, q, {capture:true, passive:true, once:true}));
  const se = document.scrollingElement || document.documentElement;
  const moving = () => document.getAnimations().some(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.acc-panel'));
  /* settled = no panel animating, and the anchor, el and the page height still for 3 frames */
  const settle = async (min = 0) => {
    let last = null, still = 0; const s0 = performance.now();
    while(performance.now() - t0 < cap){
      await raf(); if(tok !== revealTok || quit) return false;
      const k = `${Math.round(anchor.getBoundingClientRect().top)}|${Math.round(el.getBoundingClientRect().top)}|${se.scrollHeight}`;
      still = k === last && !moving() ? still + 1 : 0; last = k;
      if(still >= 3 && performance.now() - s0 >= min) return true;
    }
    return true;
  };
  const place = () => {
    const top = stickyTop() + gap, bottom = window.innerHeight - stickyBottom() - gap;
    const ra = anchor.getBoundingClientRect(), re = el.getBoundingClientRect();
    let dy = ra.top - top;
    if(o.block === 'nearest') dy = ra.top < top ? ra.top - top : (re.bottom > bottom ? Math.min(re.bottom - bottom, ra.top - top) : 0);
    if(Math.abs(dy) >= 1){ window.scrollBy({top: dy, behavior: 'instant'}); return true; }
    return false;
  };
  try {
    /* place, then re-check: a scroll can wake a pending auto-close (Keeper.onScroll), so settle and place again (twice at most) */
    for(let i = 0; i < 3; i++){
      if(!(await settle(i ? 220 : 0)) || !anchor.isConnected) return;
      if(!place() && i > 0) break;
    }
    if(o.focus !== false && document.activeElement !== el && !quit) focusQuiet(el);
  } finally { evs.forEach(e => window.removeEventListener(e, q, true)); }
}

/* ---------------- accordion ---------------- */
class Accordion {
  constructor({sections, onToggle, announce = true}){
    this.s = new Map(); this.onToggle = onToggle || (() => {}); this.announce = announce;
    sections.forEach(x => this.s.set(x.id, {...x, open:true, prevDone:false, pinned:false, pending:false, userClosed:false,
      btn: $('.acc-btn', x.el), panel: $('.acc-panel', x.el), sum: $('.acc-sum', x.el)}));
    this.s.forEach((x, id) => x.btn.addEventListener('click', () => this.isOpen(id) ? this.close(id, {how:'user'}) : this.open(id, {how:'user'})));
    document.addEventListener('focusin', e => this.leave(e.target));
    Keeper.retries.add(() => this.leave(document.activeElement));
    this.s.forEach((x, id) => x.el.addEventListener('focusout', e => {
      if(!e.relatedTarget) setTimeout(() => { const a = document.activeElement; if(!a || a === document.body) this.leave(null, id); }, 0);
    }));
  }
  init(startOpen){
    this.s.forEach((x, id) => { const o = !!startOpen(id); this.set(x, o); x.panel.hidden = !o; x.panel.inert = !o; if(o) x.el.classList.add('is-settled');
      x.prevDone = !!x.isDone(); x.pinned = false; x.pending = false; x.userClosed = false; this.paint(x); });
  }
  isOpen(id){ return this.s.get(id).open; }
  set(x, o){ x.open = o; x.el.dataset.open = String(o); x.btn.setAttribute('aria-expanded', String(o)); }
  paint(x){ if(x.sum){ const t = x.summary() || ''; if(x.sum.textContent !== t) x.sum.textContent = t; } }
  update(){
    this.s.forEach((x, id) => {
      const d = !!x.isDone();
      if(d && !x.prevDone){
        if(this.announce) say(`${x.title} done.`);
        if(x.open && !x.pinned){ x.pending = true; if(!x.el.contains(document.activeElement)) this.close(id, {how:'auto', anchor: this.anchorFor(x)}); }
      }
      if(!d){
        x.pending = false;
        /* rule 5b: done -> not done reopens on its own, unless the person closed it themselves */
        if(x.prevDone && (!x.open || x.closing) && !x.userClosed) this.open(id, {how:'auto', anchor: this.anchorFor(x)});
      }
      x.prevDone = d; this.paint(x);
    });
  }
  /* what rule 6 holds still: the focused field, else this section's own header */
  anchorFor(x){ const a = document.activeElement; return a && a !== document.body && a.isConnected ? a : x.btn; }
  leave(target, onlyId){
    this.s.forEach((x, id) => {
      if(!x.pending || !x.open) return;
      if(onlyId && id !== onlyId) return;
      if(target && x.el.contains(target)) return;
      this.close(id, {how:'auto', anchor: target && target !== document.body ? target : x.btn});
    });
  }
  async open(id, o = {}){
    const x = this.s.get(id); if(x.open && !x.closing) return;
    const how = o.how || 'auto'; if(how === 'user'){ x.pinned = true; x.userClosed = false; }
    x.pending = false; x.closing = false;
    const keep = how !== 'user' && o.anchor ? Keeper.track(o.anchor) : null;
    x.panel.hidden = false; x.panel.inert = false; void x.panel.offsetHeight;
    this.set(x, true); this.paint(x); this.onToggle(id, true, how);
    const ms = o.animate === false ? 0 : Motion.ms('--d-slow');
    await Motion.after(x.panel, ms);
    if(keep) keep.stop();
    if(x.open) x.el.classList.add('is-settled');
  }
  async close(id, o = {}){
    const x = this.s.get(id); if(!x.open || x.closing) return;
    const how = o.how || 'auto';
    if(how !== 'user'){
      /* rule 6: an auto-close runs only when it cannot move the field you're in; otherwise it stays pending */
      const anchor = o.anchor && o.anchor !== document.body ? o.anchor : x.btn;
      if(x.el.contains(document.activeElement) || !Keeper.fits(anchor, x.panel)){ x.pending = true; return; }
      o = {...o, anchor};
    } else { x.pinned = false; x.userClosed = true; }
    x.pending = false; x.closing = true;
    const keep = o.anchor ? Keeper.track(o.anchor) : null;
    x.el.classList.remove('is-settled'); x.panel.inert = true;
    this.set(x, false); this.paint(x); this.onToggle(id, false, how);
    const ms = o.animate === false ? 0 : Motion.ms('--d-close');
    await Motion.after(x.panel, ms);
    if(keep) keep.stop();
    if(!x.open){ x.panel.hidden = true; } x.closing = false;
  }
  async collapseDone(o = {}){
    const gap = Motion.ms(o.stagger || '--stagger-close');
    const ids = [...this.s.keys()].filter(id => { const x = this.s.get(id); return x.open && !x.pinned && x.isDone() && !x.el.contains(document.activeElement); });
    for(const id of ids){ this.close(id, {how:'auto', anchor: this.anchorFor(this.s.get(id))}); if(gap) await new Promise(r => setTimeout(r, gap)); }
  }
}

/* ---------------- checklist: rail + chips + header rings ---------------- */
class Checklist {
  constructor({items, rail, chips, onJump}){
    this.items = items; this.onJump = onJump; this.rail = rail; this.chips = chips;
    if(rail) rail.innerHTML = `<ul class="rail-list">${items.map(i => `<li><button type="button" class="rail-item" data-jump="${i.id}">${Ring.html()}<span class="nm">${esc(i.label)}</span><span class="meta"></span><span class="sr st"></span></button></li>`).join('')}</ul>`;
    if(chips) chips.innerHTML = `<div class="chips">${items.map(i => `<button type="button" class="chip" data-jump="${i.id}">${Ring.html()}<span class="nm">${esc(i.label)}</span><span class="meta"></span><span class="sr st"></span></button>`).join('')}</div>`;
    [rail, chips].forEach(r => r && r.addEventListener('click', e => { const b = e.target.closest('[data-jump]'); if(b) this.onJump(b.dataset.jump); }));
  }
  set(id, st){
    const meta = st.meta !== undefined ? st.meta : st.state === 'done' ? '' : (st.state === 'wait' ? '' : (st.left ? `${st.left} left` : ''));
    const label = (this.items.find(i => i.id === id) || {}).label;
    const sr = st.label || (st.state === 'done' ? 'done' : meta);
    $$(`[data-jump="${id}"]`).forEach(b => {
      Ring.set($('.ring', b), st, {animate: st.animate});
      const m = $('.meta', b); if(m.textContent !== meta) m.textContent = meta;
      const s = $('.st', b), t = `, ${sr}`; if(s.textContent !== t) s.textContent = t;
      b.setAttribute('aria-label', `${label}${sr ? ', ' + sr : ''}`);
      if(st.flag) b.dataset.flag = st.flag; else delete b.dataset.flag;
    });
    $$(`.ring[data-ring-for="${id}"]`).forEach(r => Ring.set(r, st, {animate: st.animate}));
    $$(`[data-left-for="${id}"]`).forEach(l => { if(l.textContent !== meta) l.textContent = meta; if(st.flag) l.dataset.flag = st.flag; else delete l.dataset.flag; });
  }
  current(id){ $$('[data-jump]').forEach(b => b.setAttribute('aria-current', String(b.dataset.jump === id))); }
}

/* ---------------- toggletip ---------------- */
const Toggletip = {
  openEl: null, hoverT: null,
  init(root = document){
    if(root.__tips) return; root.__tips = true;
    root.addEventListener('click', e => {
      const b = e.target.closest('.tip-btn');
      if(b){ e.preventDefault(); e.stopPropagation(); this.isOpen(b) && !b.dataset.hover ? this.close(b) : this.open(b); delete b.dataset.hover; return; }
      if(this.openEl && !e.target.closest('.tip-pop')) this.close(this.openEl);
    });
    root.addEventListener('keydown', e => { if(e.key !== 'Escape' || !this.openEl) return; const b = this.openEl, t = b.closest('.tip'), a = document.activeElement;
      this.close(b); if(a === b || (t && t.contains(a))) b.focus(); });
    /* a tip closes when focus leaves the tip and its button (arrowing on to the next card must not stay covered) */
    root.addEventListener('focusout', e => { const t = e.target.closest && e.target.closest('.tip'); if(!t) return;
      const b = $('.tip-btn', t); if(!b || !this.isOpen(b) || b.dataset.hover) return;
      if(e.relatedTarget && t.contains(e.relatedTarget)) return;
      setTimeout(() => { if(this.isOpen(b) && !t.contains(document.activeElement)) this.close(b); }, 0); });
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    root.addEventListener('mouseover', e => {
      if(!fine.matches) return; const t = e.target.closest('.tip'); if(!t) return;
      const b = $('.tip-btn', t); if(this.isOpen(b)) return; clearTimeout(this.hoverT);
      this.hoverT = setTimeout(() => { this.open(b); b.dataset.hover = '1'; }, Motion.ms('--d-hover-intent', {raw:true}));
    });
    root.addEventListener('mouseout', e => {
      const t = e.target.closest('.tip'); if(!t || t.contains(e.relatedTarget)) return; clearTimeout(this.hoverT);
      const b = $('.tip-btn', t); if(b.dataset.hover){ delete b.dataset.hover; this.close(b); }
    });
  },
  isOpen(b){ return b.getAttribute('aria-expanded') === 'true'; },
  open(b){
    if(this.openEl && this.openEl !== b) this.close(this.openEl);
    const p = b.nextElementSibling; p.style.left = ''; p.textContent = b.dataset.text;
    b.setAttribute('aria-expanded', 'true'); this.openEl = b;
    requestAnimationFrame(() => { p.classList.add('is-open'); const r = p.getBoundingClientRect(), vw = document.documentElement.clientWidth;
      if(r.right > vw - 16) p.style.left = (parseFloat(getComputedStyle(p).left) - (r.right - (vw - 16))) + 'px';
      const r2 = p.getBoundingClientRect(); if(r2.left < 16) p.style.left = (parseFloat(getComputedStyle(p).left) + (16 - r2.left)) + 'px'; });
  },
  close(b){
    const p = b.nextElementSibling; b.setAttribute('aria-expanded', 'false'); p.classList.remove('is-open');
    if(this.openEl === b) this.openEl = null;
    setTimeout(() => { if(b.getAttribute('aria-expanded') !== 'true') p.textContent = ''; }, Motion.ms('--d-tip-out'));
  },
  html(term, text){
    return `<span class="tip"><button type="button" class="tip-btn" aria-expanded="false" aria-label="About ${esc(term)}" data-text="${esc(text)}">${Icons.svg('info')}</button><span class="tip-pop" role="status"></span></span>`;
  }
};

/* ---------------- segmented control ---------------- */
const Segmented = {
  init(root = document){
    $$('.seg', root).forEach(s => { if(!$('.seg-thumb', s)) s.insertAdjacentHTML('afterbegin', '<span class="seg-thumb" aria-hidden="true"></span>'); Segmented.sync(s, false); });
    if(!root.__seg){ root.__seg = true; root.addEventListener('change', e => { const s = e.target.closest && e.target.closest('.seg'); if(s) Segmented.sync(s, true); }); }
  },
  sync(s, animate){
    const ins = $$('input[type=radio]', s), i = ins.findIndex(x => x.checked);
    if(!animate) s.classList.add('no-anim');
    s.style.setProperty('--n', ins.length); if(i >= 0) s.style.setProperty('--i', i);
    s.dataset.has = String(i >= 0);
    if(!animate) requestAnimationFrame(() => requestAnimationFrame(() => s.classList.remove('no-anim')));
  },
  html(name, opts, value, o = {}){
    return `<div class="seg${o.sm ? ' sm' : ''}" role="radiogroup" ${o.labelledby ? `aria-labelledby="${o.labelledby}"` : `aria-label="${esc(o.label)}"`} style="--n:${opts.length}">
      <span class="seg-thumb" aria-hidden="true"></span>${opts.map(([v, l], i) => `<label class="seg-opt"><input type="radio" name="${name}" value="${esc(v)}" id="${o.idp || name}-${i}"${value === v ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
  }
};

/* ---------------- busy button (M10) ---------------- */
function busy(btn, on){ btn.setAttribute('aria-busy', String(!!on)); }

/* ---------------- demo menu shell (prototype chrome) ---------------- */
const Demo = {
  mount({groups, toggles = [], onPick, onToggle, note}){
    const w = document.createElement('div'); w.className = 'demo'; w.setAttribute('role', 'region'); w.setAttribute('aria-label', 'Demo controls, not part of the product');
    w.innerHTML = `<button type="button" class="demo-btn" aria-expanded="false" aria-controls="demoPop">${Icons.svg('list-checks')}<span class="txt">Demo states</span><span class="sr"> (prototype controls, not part of the product)</span></button>
      <div class="demo-pop" id="demoPop" hidden role="group" aria-label="Demo states">${note ? `<p class="demo-note">${esc(note)}</p>` : ''}
      ${groups.map(g => `<p class="demo-grp">${esc(g.label)}</p>${g.items.map(i => `<button type="button" class="demo-item" data-pick="${i.id}">${esc(i.label)}</button>`).join('')}`).join('')}
      ${toggles.length ? `<p class="demo-grp">Switches</p>${toggles.map(t => `<label class="chk demo-tog"><input type="checkbox" data-tog="${t.id}"${t.checked ? ' checked' : ''}><span class="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>${esc(t.label)}</span></label>`).join('')}` : ''}</div>`;
    document.body.appendChild(w);
    const btn = $('.demo-btn', w), pop = $('.demo-pop', w);
    const set = on => { pop.hidden = !on; btn.setAttribute('aria-expanded', String(on)); if(on){ const c = $('[aria-current="true"]', pop) || $('.demo-item', pop); c && c.focus(); } };
    btn.addEventListener('click', () => set(pop.hidden));
    w.addEventListener('keydown', e => { if(e.key === 'Escape' && !pop.hidden){ e.stopPropagation(); set(false); btn.focus(); } });
    document.addEventListener('click', e => { if(!pop.hidden && !w.contains(e.target)) set(false); });
    pop.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if(!b) return; $$('[data-pick]', pop).forEach(x => x.setAttribute('aria-current', String(x === b))); set(false); onPick(b.dataset.pick); });
    pop.addEventListener('change', e => { const t = e.target.closest('[data-tog]'); if(t) onToggle(t.dataset.tog, t.checked); });
    /* dock: fixed in the left gutter only when the gutter is wider than the button; else in flow after the page,
       so its box never sits over product content */
    const place = () => {
      w.classList.remove('is-flow'); w.classList.add('is-gutter');
      const bw = btn.getBoundingClientRect().width;
      const cols = $$('[data-content], main, .hx-body > *, .rv > *, .hx-header-in > *').map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
      const left = cols.length ? Math.min(...cols.map(r => r.left)) : 0;
      if(16 + bw + 8 > left){ w.classList.remove('is-gutter'); w.classList.add('is-flow'); }
    };
    place(); window.addEventListener('resize', place);
    return {mark(id){ $$('[data-pick]', pop).forEach(x => x.setAttribute('aria-current', String(x.dataset.pick === id))); }, el: w};
  }
};

/* ---------------- v2 helpers ---------------- */
const Fill = {
  cascade(items, fn, o = {}){
    const gap = Motion.ms(o.stagger || '--stagger-fill');
    if(!gap){ items.forEach((it, i) => fn(it, i)); return Promise.resolve(); }
    return new Promise(res => items.forEach((it, i) => setTimeout(() => { fn(it, i); if(i === items.length - 1) res(); }, i * gap)));
  },
  sweep(el){ if(Motion.reduced() || !el) return; el.classList.remove('is-sweep'); void el.offsetWidth; el.classList.add('is-sweep');
    setTimeout(() => el.classList.remove('is-sweep'), Motion.ms('--d-sweep') + 60); }
};
function StatusLine(el){
  let shownAt = 0, t = null;
  return {
    busy(text){ clearTimeout(t); el.dataset.state = 'busy';
      el.innerHTML = `<span class="txt">${esc(text)}</span>`;
      t = setTimeout(() => { if(el.dataset.state === 'busy'){ el.insertAdjacentHTML('afterbegin', Icons.svg('loader-circle', 'spinner')); shownAt = performance.now(); } }, Motion.ms('--d-busy-delay', {raw:true})); },
    done(text){ clearTimeout(t); const hold = shownAt ? Math.max(0, Motion.ms('--d-busy-hold', {raw:true}) - (performance.now() - shownAt)) : 0;
      return new Promise(r => setTimeout(() => { el.dataset.state = 'done'; shownAt = 0; el.innerHTML = `<span class="txt">${esc(text)}</span>`; say(text); r(); }, hold)); }
  };
}

/* ---------------- save indicator (no hard swap) ---------------- */
function SaveMark(el, o = {}){
  el.classList.add('hx-sw');
  /* the indicator is visual only; a live role here re-read Saving/Saved on every edit and doubled a failure.
     Pages announce only a failure, once, through say(). */
  el.removeAttribute('role'); el.removeAttribute('aria-live');
  let key = null;
  const live = () => el.querySelector('.hx-sw-l:not(.is-ghost):not(.is-out)');
  const ghosts = () => { if(el.querySelector('.is-ghost') || !(o.sizes || []).length) return;
    el.insertAdjacentHTML('afterbegin', o.sizes.map(h => `<span class="hx-sw-l is-ghost" aria-hidden="true">${h}</span>`).join('')); };
  return {
    layer: live,
    set(k, html, opt = {}){
      if(k === key) return false;
      key = k; ghosts();
      const red = Motion.reduced(), old = [...el.querySelectorAll('.hx-sw-l:not(.is-ghost):not(.is-out)')], fade = old.length > 0 && !red;
      old.forEach(l => { l.classList.remove('is-in'); l.classList.add('is-out'); l.setAttribute('aria-hidden', 'true'); l.inert = true;
        if(fade) setTimeout(() => l.remove(), Motion.ms('--d-fast')); else l.remove(); });
      if(!html) return true;
      const n = document.createElement('span');
      n.className = 'hx-sw-l' + (fade ? ' is-in' : '') + (opt.draw && !red ? ' is-draw' : '');
      n.innerHTML = html;
      if(opt.draw) n.querySelectorAll('svg path, svg circle, svg line, svg polyline').forEach(p => p.setAttribute('pathLength', '1'));
      el.appendChild(n); return true;
    }
  };
}
SaveMark.saving = label => `<span class="hx-sw-spin" aria-hidden="true">${Icons.svg('loader-circle', 'spinner')}</span><span>${esc(label)}</span>`;

/* ---------------- shell ---------------- */
function shell(){
  const on = () => { document.documentElement.classList.toggle('is-scrolled', window.scrollY > 0); Keeper.onScroll(); };
  window.addEventListener('scroll', on, {passive:true}); on();
}

window.Hifi = {$, $$, esc, raf, Motion, say, Ring, Keeper, focusQuiet, reveal, stickyTop, stickyBottom, Accordion, Checklist, Toggletip, Segmented, busy, Demo, Fill, StatusLine, SaveMark, shell};
})();
