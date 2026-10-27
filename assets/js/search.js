/* ============================================================================
 * search.js — Curriculum search, filtering, sorting and pagination
 * ----------------------------------------------------------------------------
 * Operates over the FULL dataset (built-in + custom items), never only the
 * visible page. Returns a page slice plus metadata so the UI can render a
 * bounded number of DOM nodes.
 * ========================================================================== */

(function (global) {
  'use strict';

  const Curriculum = global.Curriculum;
  const Progress = global.Progress;
  const Storage = global.Storage;

  /* Lightweight inverted-ish index: one lowercase haystack per item, built
     lazily and cached by dataset size. */
  let _hay = null;
  let _hayToken = null;

  function haystacks() {
    const items = Progress.allItems();
    const token = items.length;
    if (_hay && _hayToken === token) return _hay;
    _hay = new Map();
    items.forEach((i) => {
      const cat = Curriculum.categoriesById.get(i.categoryId);
      const sub = Curriculum.subcategoriesById.get(i.subcategoryId);
      const parts = [
        i.title, i.description, i.level, i.type,
        cat ? cat.name : '', sub ? sub.name : '',
        (i.objectives || []).join(' '),
        (i.useCases || []).join(' '),
        (i.tags || []).join(' '),
        (i.steps || []).join(' ')
      ];
      _hay.set(i.id, parts.join(' \u0001 ').toLowerCase());
    });
    _hayToken = token;
    return _hay;
  }

  function invalidate() { _hay = null; _hayToken = null; }

  const DURATION_BUCKETS = {
    short: [0, 60],
    medium: [61, 180],
    long: [181, 480],
    epic: [481, Infinity]
  };

  function matchesDuration(item, bucket) {
    const b = DURATION_BUCKETS[bucket];
    if (!b) return true;
    const m = item.estMinutes || 0;
    return m >= b[0] && m <= b[1];
  }

  const SORTS = {
    default: null,
    'title-asc': (a, b) => a.title.localeCompare(b.title),
    'title-desc': (a, b) => b.title.localeCompare(a.title),
    'difficulty-asc': (a, b) => Progress.LEVEL_ORDER[a.level] - Progress.LEVEL_ORDER[b.level] || a.title.localeCompare(b.title),
    'difficulty-desc': (a, b) => Progress.LEVEL_ORDER[b.level] - Progress.LEVEL_ORDER[a.level] || a.title.localeCompare(b.title),
    'duration-asc': (a, b) => (a.estMinutes || 0) - (b.estMinutes || 0),
    'duration-desc': (a, b) => (b.estMinutes || 0) - (a.estMinutes || 0),
    status: (a, b) => {
      const order = { 'in-progress': 0, 'not-started': 1, completed: 2 };
      const sa = (Storage.progressFor(a.id) || {}).status || 'not-started';
      const sb = (Storage.progressFor(b.id) || {}).status || 'not-started';
      return order[sa] - order[sb] || a.title.localeCompare(b.title);
    },
    updated: (a, b) => {
      const ta = (Storage.progressFor(a.id) || {}).updatedAt || '';
      const tb = (Storage.progressFor(b.id) || {}).updatedAt || '';
      return tb.localeCompare(ta);
    },
    progress: (a, b) => Progress.itemProgress(b).percent - Progress.itemProgress(a).percent
  };

  /**
   * @param {object} f filters
   *   q, category, subcategory, level, status, type, duration,
   *   prereq ('none'|'has'|'locked'|'available'), incompleteChecklist (bool),
   *   sort, page, pageSize
   */
  function query(f) {
    const filters = f || {};
    const items = Progress.allItems();
    const hay = haystacks();
    const terms = String(filters.q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);

    const out = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (filters.category && item.categoryId !== filters.category) continue;
      if (filters.subcategory && item.subcategoryId !== filters.subcategory) continue;
      if (filters.level && item.level !== filters.level) continue;
      if (filters.type && item.type !== filters.type) continue;
      if (filters.duration && !matchesDuration(item, filters.duration)) continue;

      const rec = Storage.progressFor(item.id);
      const status = (rec && rec.status) || 'not-started';
      if (filters.status && status !== filters.status) continue;

      if (filters.prereq) {
        const has = (item.prerequisites || []).length > 0;
        if (filters.prereq === 'none' && has) continue;
        if (filters.prereq === 'has' && !has) continue;
        if (filters.prereq === 'locked' || filters.prereq === 'available') {
          const ls = Progress.lockState(item).state;
          if (ls !== filters.prereq) continue;
        }
      }

      if (filters.incompleteChecklist) {
        const ip = Progress.itemProgress(item, rec);
        if (ip.totalRequired === 0 || ip.doneRequired === 0 || ip.doneRequired === ip.totalRequired) continue;
      }

      if (terms.length) {
        const h = hay.get(item.id) || '';
        let ok = true;
        for (let t = 0; t < terms.length; t++) {
          if (h.indexOf(terms[t]) === -1) { ok = false; break; }
        }
        if (!ok) continue;
      }

      out.push(item);
    }

    const sortFn = SORTS[filters.sort] || null;
    if (sortFn) out.sort(sortFn);

    const pageSize = Math.max(1, Number(filters.pageSize) || 20);
    const totalPages = Math.max(1, Math.ceil(out.length / pageSize));
    const page = Math.min(Math.max(1, Number(filters.page) || 1), totalPages);
    const start = (page - 1) * pageSize;

    return {
      total: out.length,
      page, pageSize, totalPages,
      items: out.slice(start, start + pageSize),
      allIds: out.map((i) => i.id)
    };
  }

  /** Quick suggestion list for the global search box (max n). */
  function suggest(q, n) {
    if (!q || q.trim().length < 2) return [];
    const res = query({ q, pageSize: n || 8, page: 1, sort: 'title-asc' });
    return res.items;
  }

  global.Search = { query, suggest, invalidate, DURATION_BUCKETS, SORTS };
})(window);
