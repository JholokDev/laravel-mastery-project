/* ============================================================================
 * app.js — Application shell: routing, chrome, theme, keyboard, boot
 * ----------------------------------------------------------------------------
 * Resilience rules
 *  - Before anything else we verify every required module actually loaded.
 *  - If a screen's view file is missing, it is loaded on demand (with a cache
 *    buster) and, if that fails, a diagnostics card explains exactly why.
 *    "Unknown screen" can no longer appear for a valid route.
 * ========================================================================== */

(function (global) {
  'use strict';

  /* ---------------------------------------------------- module self-check -- */

  // window.Storage exists natively (the Web Storage interface), so check for our own API.
  const CHECKS = {
    Curriculum: function () { return !!(global.Curriculum && global.Curriculum.categories); },
    Roadmap: function () { return !!(global.Roadmap && global.Roadmap.summary); },
    Storage: function () { return !!(global.Storage && global.Storage.KEY && global.Storage.get); },
    Progress: function () { return !!(global.Progress && global.Progress.computeStats); },
    Search: function () { return !!(global.Search && global.Search.query); },
    Backup: function () { return !!(global.Backup && global.Backup.exportJSON); },
    UI: function () { return !!(global.UI && global.UI.el); }
  };
  const missingModules = Object.keys(CHECKS).filter(function (k) { return !CHECKS[k](); });

  function report(title, intro) {
    if (global.__lmx && global.__lmx.report) global.__lmx.report(document.getElementById('view'), title, intro);
  }

  if (missingModules.length) {
    const msg = 'These modules did not load: ' + missingModules.join(', ') + '.';
    const show = function () { report('The app could not start', msg); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
    return;
  }

  global.Views = global.Views || {};

  const { el, clear, toast, modal, icon } = global.UI;
  const Storage = global.Storage;
  const Progress = global.Progress;
  const Curriculum = global.Curriculum;
  const Search = global.Search;
  const Backup = global.Backup;
  const Views = global.Views;

  const ROUTES = {
    dashboard: { title: 'Dashboard', icon: 'dashboard', nav: 'main', file: 'views-core' },
    roadmap: { title: 'Zero to Expert Roadmap', short: 'Roadmap', icon: 'roadmap', nav: 'main', file: 'views-roadmap' },
    categories: { title: 'All Categories', icon: 'categories', nav: 'main', file: 'views-core' },
    explorer: { title: 'Curriculum Explorer', icon: 'explorer', nav: 'main', file: 'views-core' },
    category: { title: 'Category Details', file: 'views-core' },
    project: { title: 'Project Workspace', file: 'views-project' },
    planner: { title: 'Daily Planner', icon: 'planner', nav: 'plan', file: 'views-planner' },
    calendar: { title: 'Calendar', icon: 'calendar', nav: 'plan', file: 'views-planner' },
    analytics: { title: 'Progress Analytics', icon: 'analytics', nav: 'plan', file: 'views-planner' },
    journal: { title: 'Notes and Journal', icon: 'journal', nav: 'plan', file: 'views-planner' },
    create: { title: 'Custom Project Creator', short: 'Custom Projects', icon: 'plus', nav: 'data', file: 'views-project' },
    backup: { title: 'Backup and Restore', icon: 'backup', nav: 'data', file: 'views-data' },
    settings: { title: 'Settings', icon: 'settings', nav: 'data', file: 'views-data' },
    help: { title: 'Help and Getting Started', short: 'Help', icon: 'help', nav: 'data', file: 'views-data' }
  };

  const NAV_GROUPS = [['Learn', 'main'], ['Plan and Review', 'plan'], ['Data', 'data']];

  let current = { route: 'dashboard', params: {} };
  const navHistory = [];            // our own stack (never shadows window.history)
  let lastNavKey = null;

  /* ------------------------------------------------------------- hash -- */

  function parseHash() {
    const raw = String(location.hash || '').replace(/^#\/?/, '');
    if (!raw) return { route: 'dashboard', params: {} };
    const idx = raw.indexOf('?');
    let path = idx === -1 ? raw : raw.slice(0, idx);
    path = path.replace(/\/+$/, '');
    const qs = idx === -1 ? '' : raw.slice(idx + 1);
    const route = Object.prototype.hasOwnProperty.call(ROUTES, path) ? path : 'dashboard';
    const params = {};
    if (qs) {
      qs.split('&').forEach((pair) => {
        if (!pair) return;
        const eq = pair.indexOf('=');
        let key, val;
        try {
          key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq));
          val = decodeURIComponent(eq === -1 ? '' : pair.slice(eq + 1));
        } catch (e) { return; }
        params[key] = val === 'true' ? true : val === 'false' ? false : val;
      });
    }
    return { route, params };
  }

  function buildHash(route, params) {
    const p = params || {};
    const qs = Object.keys(p)
      .filter((k) => p[k] !== '' && p[k] != null && p[k] !== false)
      .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(p[k])))
      .join('&');
    return '#/' + route + (qs ? '?' + qs : '');
  }

  function go(route, params) {
    const next = buildHash(route, params);
    if (location.hash === next) { render(); return; }
    location.hash = next;
  }

  function back() {
    if (navHistory.length > 1) {
      navHistory.pop();
      const prev = navHistory[navHistory.length - 1];
      location.hash = buildHash(prev.route, prev.params);
    } else {
      go('roadmap');
    }
  }

  /* ------------------------------------------------------------ theme -- */

  function applyTheme() {
    const theme = Storage.get().preferences.theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      clear(btn);
      btn.appendChild(icon(theme === 'dark' ? 'sun' : 'moon', 18));
      const label = 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme';
      btn.setAttribute('aria-label', label);
      btn.title = label;
    }
  }

  function toggleTheme() {
    Storage.update((s) => { s.preferences.theme = s.preferences.theme === 'dark' ? 'light' : 'dark'; }, 'prefs');
    applyTheme();
  }

  /* -------------------------------------------------------------- ctx -- */

  const ctx = {
    go, back, applyTheme,
    pendingFocus: null,
    refresh() { render(); },
    refreshChrome() { renderSidebar(); },
    /** Open the explorer with a clean filter set plus the given patch. */
    openExplorer(patch) {
      const next = Object.assign({}, Views.EMPTY_FILTERS || {}, patch || {});
      Storage.update((s) => { Object.assign(s.preferences.filters, next); }, 'filters');
      go('explorer', next);
    },
    itemClickHandler(e) {
      const card = e.target.closest('[data-action="open-item"]');
      if (!card) return;
      go('project', { id: card.dataset.itemId });
    }
  };

  /* ---------------------------------------------------------- sidebar -- */

  function renderSidebar() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    clear(nav);
    const st = Progress.computeStats();
    const rm = global.Roadmap.summary();
    const s = Storage.get();

    NAV_GROUPS.forEach(([label, key]) => {
      nav.appendChild(el('div', { class: 'nav-group-label', text: label }));
      Object.keys(ROUTES).forEach((r) => {
        const def = ROUTES[r];
        if (def.nav !== key) return;
        let count = null;
        if (r === 'roadmap') count = rm.done + '/' + rm.total;
        if (r === 'explorer') count = st.totalItems.toLocaleString();
        if (r === 'categories') count = String(st.totalCategories);
        if (r === 'planner' && st.todayItemIds.length) count = String(st.todayItemIds.length);
        if (r === 'journal' && s.journal.length) count = String(s.journal.length);
        if (r === 'create' && st.customCount) count = String(st.customCount);

        const active = current.route === r || (r === 'categories' && current.route === 'category') ||
                       (r === 'explorer' && current.route === 'project');
        nav.appendChild(el('button', {
          class: 'nav-item', type: 'button', 'aria-current': active ? 'page' : null,
          onclick: () => { go(r); closeMobileNav(); }
        }, [
          icon(def.icon, 18),
          el('span', { text: def.short || def.title }),
          count ? el('span', { class: 'count', text: count }) : null
        ]));
      });
    });

    const foot = document.getElementById('sidebar-foot');
    if (foot) {
      clear(foot);
      foot.appendChild(el('div', { class: 'streak-chip' }, [
        el('span', { class: 'l' }, [icon('flame', 15, 'flame'), document.createTextNode('Streak')]),
        el('strong', { text: st.currentStreak + ' day' + (st.currentStreak === 1 ? '' : 's') })
      ]));
      foot.appendChild(el('div', { class: 'streak-chip', style: 'margin-top:6px' }, [
        el('span', { text: 'Completed' }),
        el('strong', { text: st.completed + ' / ' + st.totalItems })
      ]));
      foot.appendChild(el('div', { style: 'margin-top:10px' }, global.UI.bar(st.overall, st.overall === 100 ? 'ok' : '')));
    }
  }

  /* ----------------------------------------------------------- search -- */

  function setupGlobalSearch() {
    const input = document.getElementById('global-search');
    const box = document.getElementById('suggestions');
    if (!input || !box) return;

    const run = global.UI.debounce(() => {
      clear(box);
      const q = input.value.trim();
      if (q.length < 2) return;
      const results = Search.suggest(q, 8);
      if (!results.length) {
        box.appendChild(el('div', { class: 'suggestion faint', text: 'No matches for "' + q + '"' }));
        return;
      }
      results.forEach((i) => {
        const cat = Curriculum.categoriesById.get(i.categoryId);
        box.appendChild(el('button', { class: 'suggestion', type: 'button', onclick: () => {
          clear(box); input.value = '';
          go('project', { id: i.id });
        } }, [
          el('span', { text: i.title }),
          el('small', { text: (cat ? cat.name : '') + ' · ' + global.UI.titleCase(i.level) + ' · ' + global.UI.minutes(i.estMinutes) })
        ]));
      });
      box.appendChild(el('button', { class: 'suggestion', type: 'button', onclick: () => {
        clear(box);
        ctx.openExplorer({ q });
      } }, el('strong', { text: 'See all results for "' + q + '"' })));
    }, 200);

    input.addEventListener('input', run);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        clear(box);
        if (q) ctx.openExplorer({ q });
      } else if (e.key === 'Escape') { clear(box); input.blur(); }
      else if (e.key === 'ArrowDown') {
        const first = box.querySelector('.suggestion');
        if (first) { e.preventDefault(); first.focus(); }
      }
    });
    box.addEventListener('keydown', (e) => {
      const items = Array.from(box.querySelectorAll('.suggestion'));
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (i > 0) items[i - 1].focus(); else input.focus(); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrap')) clear(box); });
  }

  /* ------------------------------------------------------ mobile nav -- */

  function closeMobileNav() { document.body.classList.remove('nav-open'); }

  /* --------------------------------------------------------- keyboard -- */

  let gPressed = false;
  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

      if (e.key === 'Escape') { closeMobileNav(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/') {
        e.preventDefault();
        const s = document.getElementById('global-search');
        if (s) s.focus();
        return;
      }
      if (gPressed) {
        const map = { d: 'dashboard', r: 'roadmap', e: 'explorer', p: 'planner', c: 'calendar', a: 'analytics', j: 'journal', b: 'backup', s: 'settings', h: 'help', l: 'categories' };
        if (map[e.key]) { e.preventDefault(); go(map[e.key]); }
        gPressed = false;
        return;
      }
      if (e.key === 'g') { gPressed = true; setTimeout(() => { gPressed = false; }, 1200); return; }
      if (e.key === 'n') {
        const next = Progress.recommendNext();
        if (next) go('project', { id: next.id });
      }
    });
  }

  /* ------------------------------------------- on-demand view loading -- */

  const loadState = {};   // route -> 'loading' | 'failed'

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src + '?r=' + Date.now();
      s.onload = () => resolve();
      s.onerror = () => {
        if (global.__lmx) global.__lmx.loadFailures.push(src);
        reject(new Error('Could not load ' + src));
      };
      document.head.appendChild(s);
    });
  }

  /** Returns a placeholder node while a missing view file is fetched, or a
      diagnostics card if it cannot be provided. Never says "Unknown screen". */
  function missingView(route) {
    const def = ROUTES[route] || {};
    const file = def.file ? 'assets/js/' + def.file + '.js' : null;

    if (file && !loadState[route]) {
      loadState[route] = 'loading';
      loadScript(file)
        .then(() => { loadState[route] = Views[route] ? null : 'failed'; render(); })
        .catch(() => { loadState[route] = 'failed'; render(); });
    }

    if (loadState[route] === 'loading') {
      return el('div', { class: 'card' }, [
        el('h2', { text: 'Loading ' + (def.title || route) }),
        el('p', { class: 'muted small mb-0', text: 'Fetching ' + file + ' …' })
      ]);
    }

    const holder = el('div', { class: 'card' });
    setTimeout(() => {
      if (global.__lmx && global.__lmx.report && holder.parentNode) {
        // Re-use the shared diagnostics renderer inside the view host.
        global.__lmx.report(holder.parentNode, 'This screen could not be loaded',
          'The screen "' + (def.title || route) + '" needs ' + (file || 'a view file') + ', which did not load or failed while starting.');
      }
    }, 0);
    return holder;
  }

  /* ------------------------------------------------------------ render -- */

  let rendering = false;

  function render() {
    if (rendering) return;
    rendering = true;
    try {
      current = parseHash();
      const last = navHistory[navHistory.length - 1];
      if (!last || last.route !== current.route || JSON.stringify(last.params) !== JSON.stringify(current.params)) {
        navHistory.push(current);
        if (navHistory.length > 40) navHistory.shift();
      }

      Storage.updateQuiet((s) => { s.preferences.lastView = current.route; });

      const def = ROUTES[current.route] || {};
      const titleEl = document.getElementById('page-title');
      if (titleEl) titleEl.textContent = def.title || 'Laravel Mastery';
      document.title = (def.title || 'Dashboard') + ' — Laravel Mastery';

      const host = document.getElementById('view');
      clear(host);

      const viewFn = Views[current.route];
      let node;
      try {
        node = typeof viewFn === 'function' ? viewFn(ctx, current.params) : missingView(current.route);
      } catch (err) {
        console.error('[render] view error', err);
        node = el('div', { class: 'card' }, [
          el('h2', { text: 'Something went wrong rendering this screen' }),
          el('p', { class: 'muted small mono', text: String((err && err.message) || err) }),
          el('p', { class: 'muted small', text: 'Your saved data is untouched. Try another screen, or export a backup from Backup and Restore.' }),
          global.UI.button('Go to dashboard', { onClick: () => go('dashboard') })
        ]);
      }
      host.appendChild(node);

      // Jump to the top only when navigating somewhere new; keep scroll position
      // for in-place refreshes (checklist ticks, status changes, etc).
      const navKey = current.route + '|' + (current.params.id || '') + '|' + (current.params.date || '') + '|' + (current.params.ym || '') + '|' + (current.params.page || '');
      if (navKey !== lastNavKey) { window.scrollTo(0, 0); lastNavKey = navKey; }

      renderSidebar();
    } finally {
      rendering = false;
    }
  }

  /* -------------------------------------------------------------- boot -- */

  function boot() {
    try {
      bootInner();
    } catch (err) {
      console.error('[boot] failed', err);
      if (global.__lmx) global.__lmx.errors.push({ message: String((err && err.message) || err), file: 'app.js', line: 0 });
      report('The app hit an error while starting', String((err && err.message) || err));
    }
  }

  function bootInner() {
    Storage.init();
    applyTheme();

    const menuBtn = document.getElementById('menu-btn');
    clear(menuBtn); menuBtn.appendChild(icon('menu', 20));
    menuBtn.addEventListener('click', () => document.body.classList.toggle('nav-open'));

    const exportBtn = document.getElementById('export-quick');
    clear(exportBtn);
    exportBtn.appendChild(icon('backup', 15));
    exportBtn.appendChild(el('span', { text: 'Backup' }));
    exportBtn.addEventListener('click', () => { Backup.exportJSON(); toast('Backup downloaded.'); });

    const mag = document.getElementById('search-mag');
    if (mag) mag.appendChild(icon('explorer', 16));
    const hint = document.getElementById('search-hint');
    if (hint) hint.appendChild(el('kbd', { text: '/' }));

    const brand = document.getElementById('brand-mark');
    if (brand) brand.appendChild(icon('code', 18));

    document.getElementById('scrim').addEventListener('click', closeMobileNav);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    setupGlobalSearch();
    setupKeyboard();
    window.addEventListener('hashchange', render);

    window.addEventListener('lmx:quota-exceeded', () => {
      modal({
        title: 'Browser storage is full',
        body: [
          el('div', { class: 'callout danger' }, el('strong', { text: 'Your most recent change could not be saved.' })),
          el('p', { class: 'muted small', style: 'margin-top:12px', text: 'localStorage for this site has reached its quota (usually about 5 MB). Export a backup now, then free space by trimming journal entries or removing unused custom items.' })
        ],
        actions: [
          { label: 'Not now' },
          { label: 'Export backup', variant: 'primary', onClick: () => { Backup.exportJSON(); } },
          { label: 'Open Backup and Restore', onClick: () => { go('backup'); } }
        ]
      });
    });

    const s = Storage.get();
    const firstRun = !Object.keys(s.progress).length && !s.journal.length && !Object.keys(s.days).length;

    if (!location.hash) {
      const lv = s.preferences.lastView;
      const start = firstRun ? 'roadmap'
        : (ROUTES[lv] && lv !== 'project' && lv !== 'category' ? lv : 'dashboard');
      try { global.history.replaceState(null, '', buildHash(start, {})); }
      catch (e) { location.hash = buildHash(start, {}); }
    }
    render();

    if (firstRun) {
      setTimeout(() => toast('Welcome. Start with the roadmap, one project a day. Press / to search.', '', 6000), 500);
    } else {
      const reminder = Backup.backupReminder();
      if (reminder.due) setTimeout(() => toast('Backup reminder: ' + reminder.message, 'warn', 6000), 800);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.App = { go, back, render, ctx, routes: ROUTES };
})(window);
