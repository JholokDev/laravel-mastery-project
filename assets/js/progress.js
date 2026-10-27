/* ============================================================================
 * progress.js — All progress & statistics calculations
 * ----------------------------------------------------------------------------
 * Pure-ish functions over (curriculum items + stored progress). Nothing here
 * writes to localStorage directly; mutations go through Storage.
 *
 * Rules implemented
 *  - Project progress = completed REQUIRED checklist items / total required.
 *  - Items with no required checklist items are 0% until explicitly completed,
 *    then 100%.  (Clear rule, no silent completion.)
 *  - Curriculum progress counts ITEMS ONLY. Categories/subcategories are never
 *    counted as units, so there is no double counting.
 *  - Optional checklist items are tracked but excluded from the percentage.
 *  - Prerequisites produce locked / available / completed states.
 * ========================================================================== */

(function (global) {
  'use strict';

  const Curriculum = global.Curriculum;
  const Storage = global.Storage;

  function todayKey(d) {
    const dt = d ? new Date(d) : new Date();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return dt.getFullYear() + '-' + m + '-' + day;
  }

  function parseKey(key) {
    const [y, m, d] = String(key).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function addDays(key, n) {
    const d = parseKey(key);
    d.setDate(d.getDate() + n);
    return todayKey(d);
  }

  function daysBetween(a, b) {
    return Math.round((parseKey(b) - parseKey(a)) / 86400000);
  }

  /* ---------------------------------------------------------------------- */
  /* Item universe (built-in + custom)                                       */
  /* ---------------------------------------------------------------------- */

  let _cacheToken = null;
  let _allItems = null;
  let _allById = null;

  function allItems() {
    const s = Storage.get();
    const token = s.customItems.length + ':' + (s.customItems[s.customItems.length - 1] || {}).id;
    if (_allItems && _cacheToken === token) return _allItems;
    _allItems = Curriculum.items.concat(s.customItems);
    _allById = new Map();
    _allItems.forEach((i) => _allById.set(i.id, i));
    _cacheToken = token;
    return _allItems;
  }

  function invalidate() { _cacheToken = null; _allItems = null; _allById = null; }

  function getItem(id) {
    allItems();
    return _allById.get(id) || null;
  }

  /* ---------------------------------------------------------------------- */
  /* Per-item progress                                                       */
  /* ---------------------------------------------------------------------- */

  function requiredChecklist(item) {
    return (item.checklist || []).filter((c) => c.required !== false);
  }

  function itemProgress(item, prog) {
    const p = prog || Storage.progressFor(item.id);
    const req = requiredChecklist(item);
    const checked = p ? p.checklist : {};
    const doneReq = req.filter((c) => checked[c.id]).length;
    const optional = (item.checklist || []).filter((c) => c.required === false);
    const doneOpt = optional.filter((c) => checked[c.id]).length;

    let percent;
    if (req.length === 0) {
      percent = p && p.status === 'completed' ? 100 : 0;
    } else {
      percent = Math.round((doneReq / req.length) * 100);
    }
    if (p && p.status === 'completed') percent = 100;

    return {
      percent,
      doneRequired: doneReq,
      totalRequired: req.length,
      doneOptional: doneOpt,
      totalOptional: optional.length,
      status: (p && p.status) || 'not-started',
      canComplete: req.length === 0 ? true : doneReq === req.length,
      record: p
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Prerequisite state                                                      */
  /* ---------------------------------------------------------------------- */

  function isCompleted(itemId) {
    const p = Storage.progressFor(itemId);
    return !!(p && p.status === 'completed');
  }

  function lockState(item) {
    const prereqs = (item.prerequisites || []).filter((id) => !!getItem(id));
    if (isCompleted(item.id)) return { state: 'completed', missing: [] };
    const missing = prereqs.filter((id) => !isCompleted(id));
    if (missing.length) return { state: 'locked', missing };
    return { state: 'available', missing: [] };
  }

  /* ---------------------------------------------------------------------- */
  /* Aggregate statistics                                                    */
  /* ---------------------------------------------------------------------- */

  function computeStats() {
    const s = Storage.get();
    const items = allItems();

    let completed = 0, inProgress = 0, notStarted = 0;
    let totalMinutes = 0, remainingMinutes = 0;

    const byCategory = new Map();
    const bySub = new Map();
    const byLevel = new Map();
    const byType = new Map();

    Curriculum.LEVELS.forEach((l) => byLevel.set(l, { total: 0, completed: 0, inProgress: 0 }));

    items.forEach((item) => {
      const p = s.progress[item.id];
      const st = (p && p.status) || 'not-started';
      if (st === 'completed') completed++;
      else if (st === 'in-progress') inProgress++;
      else notStarted++;

      totalMinutes += item.estMinutes || 0;
      if (st !== 'completed') remainingMinutes += item.estMinutes || 0;

      const bump = (map, key) => {
        if (!map.has(key)) map.set(key, { total: 0, completed: 0, inProgress: 0 });
        const e = map.get(key);
        e.total++;
        if (st === 'completed') e.completed++;
        else if (st === 'in-progress') e.inProgress++;
      };
      bump(byCategory, item.categoryId);
      bump(bySub, item.subcategoryId);
      bump(byLevel, item.level);
      bump(byType, item.type);
    });

    const total = items.length;
    const overall = total ? Math.round((completed / total) * 1000) / 10 : 0;

    // Days / streaks -------------------------------------------------------
    const studyDates = new Set();
    Object.keys(s.progress).forEach((id) => {
      const p = s.progress[id];
      if (p.completedAt) studyDates.add(todayKey(p.completedAt));
      if (p.startedAt) studyDates.add(todayKey(p.startedAt));
    });
    Object.keys(s.days).forEach((k) => {
      const d = s.days[k];
      if (d && (d.status === 'completed' || d.status === 'in-progress' || (d.notes && d.notes.trim()))) studyDates.add(k);
    });
    s.journal.forEach((j) => { if (j.date) studyDates.add(j.date); });

    const sorted = Array.from(studyDates).sort();
    let longest = 0, run = 0, prev = null;
    sorted.forEach((k) => {
      if (prev && daysBetween(prev, k) === 1) run++; else run = 1;
      if (run > longest) longest = run;
      prev = k;
    });

    // Current streak: counts back from today (or yesterday if today unused)
    let current = 0;
    const t = todayKey();
    let cursor = studyDates.has(t) ? t : (studyDates.has(addDays(t, -1)) ? addDays(t, -1) : null);
    while (cursor && studyDates.has(cursor)) { current++; cursor = addDays(cursor, -1); }

    const firstDate = sorted[0] || null;
    const calendarDays = firstDate ? daysBetween(firstDate, t) + 1 : 0;

    // Velocity & estimate --------------------------------------------------
    const completionDates = [];
    Object.keys(s.progress).forEach((id) => {
      const p = s.progress[id];
      if (p.status === 'completed' && p.completedAt) completionDates.push(todayKey(p.completedAt));
    });
    const activeStudyDays = sorted.length || 0;
    const perDay = activeStudyDays ? completed / activeStudyDays : 0;
    const remainingItems = total - completed;
    const estRemainingDays = perDay > 0 ? Math.ceil(remainingItems / perDay) : null;

    // Today ---------------------------------------------------------------
    const plan = s.days[t] || null;
    const todayItemIds = plan ? [plan.primaryItemId].concat(plan.extraItemIds || []).filter(Boolean) : [];
    const todayCompleted = completionDates.filter((d) => d === t).length;

    // Overdue: planned days in the past not completed/skipped
    let overdue = 0;
    Object.keys(s.days).forEach((k) => {
      const d = s.days[k];
      if (!d) return;
      if (k < t && d.status !== 'completed' && d.status !== 'skipped') overdue++;
    });
    // plus checklist-started items never finished for > 14 days
    Object.keys(s.progress).forEach((id) => {
      const p = s.progress[id];
      if (p.status === 'in-progress' && p.startedAt && daysBetween(todayKey(p.startedAt), t) > 14) overdue++;
    });

    // Weekly / monthly -----------------------------------------------------
    const weekAgo = addDays(t, -6), monthAgo = addDays(t, -29);
    const weekly = completionDates.filter((d) => d >= weekAgo).length;
    const monthly = completionDates.filter((d) => d >= monthAgo).length;

    return {
      totalCategories: Curriculum.categories.length,
      totalSubcategories: Curriculum.subcategoriesById.size,
      totalItems: total,
      totalProjects: items.filter((i) => i.type === 'mini' || i.type === 'capstone').length,
      totalTopics: items.filter((i) => i.type === 'lesson').length,
      completedProjects: items.filter((i) => (i.type === 'mini' || i.type === 'capstone') && isCompleted(i.id)).length,
      completed, inProgress, notStarted, overdue,
      overall,
      byCategory, bySub, byLevel, byType,
      totalMinutes, remainingMinutes,
      currentStreak: current,
      longestStreak: longest,
      totalStudyDays: activeStudyDays,
      calendarDays,
      firstDate,
      estRemainingDays,
      perDay: Math.round(perDay * 100) / 100,
      todayKey: t,
      todayPlan: plan,
      todayItemIds,
      todayCompleted,
      weeklyCompleted: weekly,
      monthlyCompleted: monthly,
      customCount: s.customItems.length
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Mutations                                                               */
  /* ---------------------------------------------------------------------- */

  function toggleChecklist(itemId, checkId, value) {
    Storage.update((s) => {
      const p = Storage.ensureProgress(itemId);
      if (value) p.checklist[checkId] = true; else delete p.checklist[checkId];
      p.updatedAt = new Date().toISOString();
      if (p.status === 'not-started') {
        p.status = 'in-progress';
        p.startedAt = p.startedAt || new Date().toISOString();
        Storage.logActivity('start', 'Started: ' + (getItem(itemId) || {}).title, itemId);
      }
      // If it was complete and a required box got unticked, it stays complete
      // only if the user explicitly overrode. Otherwise reopen honestly.
      if (p.status === 'completed' && !value && !p.overrideComplete) {
        const ip = itemProgress(getItem(itemId), p);
        if (!ip.canComplete) {
          p.status = 'in-progress';
          p.completedAt = null;
          Storage.logActivity('reopen', 'Reopened (checklist changed): ' + (getItem(itemId) || {}).title, itemId);
        }
      }
    }, 'checklist');
  }

  function setStatus(itemId, status, opts) {
    const options = opts || {};
    Storage.update((s) => {
      const p = Storage.ensureProgress(itemId);
      const item = getItem(itemId);
      if (status === 'completed') {
        p.status = 'completed';
        p.completedAt = new Date().toISOString();
        p.startedAt = p.startedAt || p.completedAt;
        p.overrideComplete = !!options.override;
        Storage.logActivity('complete', 'Completed: ' + (item ? item.title : itemId) + (options.override ? ' (override)' : ''), itemId);
      } else if (status === 'in-progress') {
        p.status = 'in-progress';
        p.completedAt = null;
        p.overrideComplete = false;
        p.startedAt = p.startedAt || new Date().toISOString();
        Storage.logActivity('reopen', 'Reopened: ' + (item ? item.title : itemId), itemId);
      } else {
        p.status = 'not-started';
        p.completedAt = null;
        p.overrideComplete = false;
        Storage.logActivity('reset', 'Reset: ' + (item ? item.title : itemId), itemId);
      }
      p.updatedAt = new Date().toISOString();
      s.preferences.lastItemId = itemId;
    }, 'status');
  }

  function saveField(itemId, field, value) {
    Storage.updateQuiet((s) => {
      const p = Storage.ensureProgress(itemId);
      p[field] = value;
      p.updatedAt = new Date().toISOString();
      if (p.status === 'not-started' && String(value).trim()) {
        p.status = 'in-progress';
        p.startedAt = p.startedAt || new Date().toISOString();
      }
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Recommendations                                                         */
  /* ---------------------------------------------------------------------- */

  const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };

  /** Next best item: available (prereqs met), not completed, lowest level,
      earliest category order, prefer in-progress items first. */
  function recommendNext(excludeIds) {
    const skip = new Set(excludeIds || []);
    const items = allItems();
    const s = Storage.get();
    let best = null, bestScore = Infinity;
    for (const item of items) {
      if (skip.has(item.id)) continue;
      const p = s.progress[item.id];
      if (p && p.status === 'completed') continue;
      const ls = lockState(item);
      if (ls.state === 'locked') continue;
      const cat = Curriculum.categoriesById.get(item.categoryId);
      const catOrder = cat ? cat.order : 999;
      let score = (LEVEL_ORDER[item.level] || 0) * 10000 + catOrder * 10;
      // The guided Zero-to-Expert roadmap always wins, in its own order.
      if (item.roadmap) score = -1000000 + item.roadmap.phase * 1000 + item.roadmap.order;
      if (p && p.status === 'in-progress') score -= 5000000;
      if (item.type === 'lesson') score -= 2;
      if (score < bestScore) { bestScore = score; best = item; }
    }
    return best;
  }

  function nextAfter(itemId) {
    const items = allItems();
    const idx = items.findIndex((i) => i.id === itemId);
    for (let k = idx + 1; k < items.length; k++) {
      if (!isCompleted(items[k].id)) return items[k];
    }
    return recommendNext([itemId]);
  }

  /* ---------------------------------------------------------------------- */
  /* Daily plan helpers                                                      */
  /* ---------------------------------------------------------------------- */

  function getDay(key) {
    const s = Storage.get();
    return s.days[key] || null;
  }

  function ensureDay(key) {
    const s = Storage.get();
    if (!s.days[key]) {
      s.days[key] = {
        primaryItemId: null, extraItemIds: [], goal: '', plannedMinutes: s.preferences.dailyTargetMinutes || 60,
        status: 'planned', notes: '', tasks: [], rescheduledTo: null, updatedAt: new Date().toISOString()
      };
    }
    return s.days[key];
  }

  function dayProgress(key) {
    const d = getDay(key);
    if (!d) return { percent: 0, done: 0, total: 0 };
    const ids = [d.primaryItemId].concat(d.extraItemIds || []).filter(Boolean);
    const tasks = d.tasks || [];
    const total = ids.length + tasks.length;
    if (!total) return { percent: 0, done: 0, total: 0 };
    const done = ids.filter(isCompleted).length + tasks.filter((t) => t.done).length;
    return { percent: Math.round((done / total) * 100), done, total };
  }

  global.Progress = {
    todayKey, parseKey, addDays, daysBetween,
    allItems, getItem, invalidate,
    requiredChecklist, itemProgress, isCompleted, lockState,
    computeStats, toggleChecklist, setStatus, saveField,
    recommendNext, nextAfter,
    getDay, ensureDay, dayProgress,
    LEVEL_ORDER
  };
})(window);
