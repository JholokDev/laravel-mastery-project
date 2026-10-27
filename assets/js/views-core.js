/* ============================================================================
 * views-core.js — Dashboard, Categories, Category Details, Curriculum Explorer
 * ========================================================================== */

(function (global) {
  'use strict';

  const { el, icon, ring, button, stat, bar, badge, progressRow, emptyState, itemCard, minutes,
          timeAgo, titleCase, select, field, toast } = global.UI;
  const Curriculum = global.Curriculum;
  const Progress = global.Progress;
  const Storage = global.Storage;
  const Search = global.Search;
  const Roadmap = global.Roadmap;

  const Views = global.Views || (global.Views = {});

  const EMPTY_FILTERS = {
    q: '', category: '', subcategory: '', level: '', status: '', type: '',
    duration: '', prereq: '', incompleteChecklist: false, sort: 'default', page: 1
  };

  /* ======================================================= DASHBOARD ==== */

  Views.dashboard = function (ctx) {
    const s = Storage.get();
    const st = Progress.computeStats();
    const rm = Roadmap.summary();
    const rmCur = Roadmap.current();
    const rmNext = Roadmap.nextItem();
    const root = el('div', { class: 'stack' });

    const next = Progress.recommendNext();
    const lastItem = s.preferences.lastItemId ? Progress.getItem(s.preferences.lastItemId) : null;
    const resume = lastItem && !Progress.isCompleted(lastItem.id) ? lastItem : null;
    const todayPlan = st.todayPlan;
    const todayPrimary = todayPlan && todayPlan.primaryItemId ? Progress.getItem(todayPlan.primaryItemId) : null;

    const hour = new Date().getHours();
    const greeting = hour < 5 ? 'Late night session' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const headline = st.totalStudyDays === 0 ? 'Your Laravel journey starts here.'
      : st.currentStreak > 0 ? st.currentStreak + '-day streak. Keep it going.'
      : 'Welcome back. Pick up where you left off.';

    /* ---------- hero ---------- */
    root.appendChild(el('section', { class: 'card hero' }, [
      el('div', { class: 'hero-main' }, [
        el('div', { class: 'eyebrow', text: greeting + '  ·  ' + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) }),
        el('h1', { text: headline }),
        el('p', { class: 'muted', style: 'max-width:58ch', text:
          st.estRemainingDays != null
            ? 'At your pace of ' + st.perDay + ' items per study day, roughly ' + st.estRemainingDays + ' study days remain across the whole curriculum. One finished project a day is enough.'
            : 'Complete your first project to unlock a real pace estimate. Start with the roadmap: it is ordered from zero to expert.' }),
        el('div', { class: 'row' }, [
          button(resume ? 'Continue learning' : 'Start next project', { variant: 'primary', size: 'lg', icon: 'play', onClick: () => {
            const target = resume || next;
            if (target) ctx.go('project', { id: target.id });
            else toast('Everything is complete. Add a custom project to keep going.', 'warn');
          } }),
          button("Start today's project", { size: 'lg', icon: 'target', onClick: () => {
            if (todayPrimary) { ctx.go('project', { id: todayPrimary.id }); return; }
            const pick = next;
            if (!pick) { toast('No available item found.', 'warn'); return; }
            Storage.update(() => {
              const day = Progress.ensureDay(st.todayKey);
              day.primaryItemId = pick.id;
              day.status = 'in-progress';
              day.updatedAt = new Date().toISOString();
              Storage.logActivity('plan', "Set today's primary project: " + pick.title, pick.id);
            }, 'plan');
            toast("Today's project: " + pick.title);
            ctx.go('project', { id: pick.id });
          } })
        ])
      ]),
      el('div', { class: 'hero-ring' }, [
        ring(st.overall, 156, 12, Math.round(st.overall) + '%', 'complete'),
        el('div', { class: 'ring-caption', text: st.completed.toLocaleString() + ' of ' + st.totalItems.toLocaleString() + ' items' })
      ])
    ]));

    /* ---------- roadmap + today ---------- */
    const rmCard = el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('h2', { text: 'Zero to Expert roadmap' }),
        el('div', { class: 'spacer' }),
        button('Open roadmap', { size: 'sm', icon: 'roadmap', onClick: () => ctx.go('roadmap') })
      ]),
      el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:8px' }, [
        el('span', { class: 'muted small', text: rm.done + ' of ' + rm.total + ' guided projects' }),
        el('strong', { text: rm.percent + '%' })
      ]),
      bar(rm.percent, rm.percent === 100 ? 'ok' : ''),
      el('div', { class: 'phase-dots', 'aria-label': 'Phase progress' }, Roadmap.phases().map((ph) => {
        const pct = ph.total ? (ph.done / ph.total) * 100 : 0;
        return el('span', { class: 'phase-dot' + (rmCur && ph.index === rmCur.index ? ' cur' : ''), title: 'Phase ' + (ph.index + 1) + ': ' + ph.name + ' (' + ph.done + '/' + ph.total + ')' },
          el('span', { style: 'width:' + pct + '%' }));
      })),
      rmCur ? el('p', { class: 'muted small', style: 'margin:14px 0 4px', text: 'Current phase ' + (rmCur.index + 1) + ': ' + rmCur.name }) : null,
      rmNext ? el('div', { class: 'row', style: 'margin-top:8px' }, [
        el('span', { style: 'flex:1;min-width:160px;font-weight:600', text: rmNext.title }),
        button('Open', { size: 'sm', variant: 'primary', icon: 'arrowRight', onClick: () => ctx.go('project', { id: rmNext.id }) })
      ]) : el('p', { class: 'faint small', text: 'You have completed the full roadmap.' })
    ]);

    const todayCard = el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('h2', { text: 'Today' }),
        el('div', { class: 'spacer' }),
        button('Planner', { size: 'sm', icon: 'planner', onClick: () => ctx.go('planner') })
      ])
    ]);
    if (todayPrimary) {
      const tip = Progress.itemProgress(todayPrimary);
      const dp = Progress.dayProgress(st.todayKey);
      todayCard.appendChild(el('div', {}, [
        el('div', { class: 'tag-row', style: 'margin-bottom:8px' }, [badge(titleCase(todayPrimary.level), todayPrimary.level), badge(minutes(todayPrimary.estMinutes))]),
        el('h3', { text: todayPrimary.title }),
        el('p', { class: 'muted small', style: 'margin:6px 0 12px', text: todayPlan.goal || todayPrimary.description }),
        bar(tip.percent, tip.percent === 100 ? 'ok' : ''),
        el('div', { class: 'row', style: 'margin-top:12px;justify-content:space-between' }, [
          el('span', { class: 'faint small', text: dp.done + '/' + dp.total + ' tasks done today' }),
          button('Open workspace', { size: 'sm', variant: 'primary', icon: 'arrowRight', onClick: () => ctx.go('project', { id: todayPrimary.id }) })
        ])
      ]));
    } else {
      todayCard.appendChild(emptyState('target', 'No project planned for today', 'One focused project per day beats five half-finished ones.',
        button('Plan today', { variant: 'primary', size: 'sm', onClick: () => ctx.go('planner') })));
    }
    root.appendChild(el('div', { class: 'grid grid-2' }, [rmCard, todayCard]));

    /* ---------- honest pace note ---------- */
    if (st.calendarDays > st.totalStudyDays && st.totalStudyDays > 0) {
      root.appendChild(el('div', { class: 'callout info' }, [
        el('strong', { text: 'Honest pace: ' }),
        document.createTextNode('you studied on ' + st.totalStudyDays + ' of ' + st.calendarDays +
          ' calendar days (' + Math.round((st.totalStudyDays / st.calendarDays) * 100) + '%). Skipped days never reduce your progress.')
      ]));
    }

    /* ---------- stats ---------- */
    root.appendChild(el('div', { class: 'group-title', text: 'Curriculum' }));
    root.appendChild(el('div', { class: 'grid grid-stats' }, [
      stat('Categories', st.totalCategories, st.totalSubcategories + ' subcategories', '', 'folder'),
      stat('Topics', st.totalTopics.toLocaleString(), 'lesson items', '', 'book'),
      stat('Projects', st.totalProjects.toLocaleString(), 'mini + capstone', '', 'code'),
      stat('Completed projects', st.completedProjects, 'finished and confirmed', 'ok', 'trophy'),
      stat('In progress', st.inProgress.toLocaleString(), 'started, unfinished', 'warn', 'hourglass'),
      stat('Not started', st.notStarted.toLocaleString(), 'remaining backlog', '', 'box'),
      stat('Overdue', st.overdue, 'stale plans or items', st.overdue ? 'danger' : '', 'alert'),
      stat('Overall', st.overall + '%', st.completed + '/' + st.totalItems + ' items', 'accent', 'done')
    ]));

    root.appendChild(el('div', { class: 'group-title', text: 'Activity' }));
    root.appendChild(el('div', { class: 'grid grid-stats' }, [
      stat("Today's tasks", st.todayItemIds.length, st.todayPlan ? 'planned today' : 'no plan yet', '', 'planner'),
      stat('Completed today', st.todayCompleted, 'items finished', st.todayCompleted ? 'ok' : '', 'check'),
      stat('Current streak', st.currentStreak + 'd', 'consecutive study days', 'accent', 'flame'),
      stat('Longest streak', st.longestStreak + 'd', 'personal best', '', 'star'),
      stat('Study days', st.totalStudyDays, 'days with real activity', '', 'calendar'),
      stat('Calendar days', st.calendarDays, st.firstDate ? 'since ' + st.firstDate : 'not started', '', 'clock'),
      stat('Est. remaining', st.estRemainingDays != null ? st.estRemainingDays + 'd' : '—', 'study days at your pace', '', 'flag'),
      stat('Remaining effort', minutes(st.remainingMinutes), 'estimated study time', '', 'hourglass')
    ]));

    /* ---------- category + level ---------- */
    root.appendChild(el('div', { class: 'group-title', text: 'Progress breakdown' }));
    const catCard = el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [
      el('h2', { text: 'Category progress' }),
      el('div', { class: 'spacer' }),
      button('All categories', { size: 'sm', onClick: () => ctx.go('categories') })
    ])]);
    const topCats = Curriculum.categories
      .map((c) => ({ c, d: st.byCategory.get(c.id) || { total: 0, completed: 0 } }))
      .filter((x) => x.d.total)
      .sort((a, b) => (b.d.completed / b.d.total) - (a.d.completed / a.d.total) || a.c.order - b.c.order)
      .slice(0, 10);
    topCats.forEach((x) => catCard.appendChild(progressRow(x.c.name, x.d.completed, x.d.total, () => ctx.go('category', { id: x.c.id }))));

    const levelCard = el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('h2', { text: 'Level progress' })])]);
    Curriculum.LEVELS.forEach((lv) => {
      const d = st.byLevel.get(lv) || { total: 0, completed: 0 };
      levelCard.appendChild(progressRow(titleCase(lv), d.completed, d.total));
    });
    levelCard.appendChild(el('div', { class: 'section-title', text: 'By item type' }));
    Object.keys(Curriculum.TYPES).forEach((t) => {
      const d = st.byType.get(t);
      if (d) levelCard.appendChild(progressRow(Curriculum.TYPES[t].label, d.completed, d.total));
    });
    root.appendChild(el('div', { class: 'grid grid-2' }, [catCard, levelCard]));

    /* ---------- activity + resume ---------- */
    const act = el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('h2', { text: 'Recent activity' })])]);
    if (!s.activity.length) {
      act.appendChild(el('p', { class: 'faint', text: 'No activity yet. Open a project and tick your first checklist item.' }));
    } else {
      const ul = el('ul', { class: 'list' });
      s.activity.slice(0, 10).forEach((a) => {
        ul.appendChild(el('li', {}, el('div', { class: 'row', style: 'justify-content:space-between;gap:8px;flex-wrap:nowrap' }, [
          el('span', { text: a.text, style: 'flex:1;min-width:0' }),
          el('span', { class: 'faint small nowrap', text: timeAgo(a.ts) })
        ])));
      });
      act.appendChild(ul);
    }

    const wip = el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('h2', { text: 'Resume where you left off' })])]);
    const wipItems = Object.keys(s.progress)
      .filter((id) => s.progress[id].status === 'in-progress')
      .map((id) => ({ id, p: s.progress[id], item: Progress.getItem(id) }))
      .filter((x) => x.item)
      .sort((a, b) => String(b.p.updatedAt).localeCompare(String(a.p.updatedAt)))
      .slice(0, 6);
    if (!wipItems.length) {
      wip.appendChild(emptyState('hourglass', 'Nothing in progress', 'Start from the roadmap or browse the curriculum.',
        button('Open roadmap', { size: 'sm', variant: 'primary', onClick: () => ctx.go('roadmap') })));
    } else {
      wipItems.forEach((x) => {
        const ip = Progress.itemProgress(x.item, x.p);
        wip.appendChild(el('div', { class: 'progress-row', role: 'button', tabindex: '0', style: 'cursor:pointer',
          onclick: () => ctx.go('project', { id: x.id }),
          onkeydown: (e) => { if (e.key === 'Enter') ctx.go('project', { id: x.id }); } }, [
          el('div', { class: 'name', text: x.item.title, title: x.item.title }),
          bar(ip.percent),
          el('div', { class: 'pct', text: ip.percent + '%' })
        ]));
      });
    }
    root.appendChild(el('div', { class: 'grid grid-2' }, [act, wip]));

    return root;
  };

  /* ====================================================== CATEGORIES ==== */

  Views.categories = function (ctx) {
    const st = Progress.computeStats();
    const root = el('div', { class: 'stack' });

    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'row' }, [
        el('div', { style: 'flex:1;min-width:220px' }, [
          el('h1', { text: 'All categories' }),
          el('p', { class: 'muted small mb-0', style: 'margin-top:4px', text: Curriculum.categories.length + ' categories · ' + st.totalItems.toLocaleString() + ' curriculum items. Expand a category to see its subcategories.' })
        ]),
        button('Expand all', { size: 'sm', onClick: () => toggleAll(true) }),
        button('Collapse all', { size: 'sm', onClick: () => toggleAll(false) })
      ])
    ]));

    const host = el('div');
    root.appendChild(host);

    Curriculum.categories.forEach((cat) => {
      const d = st.byCategory.get(cat.id) || { total: 0, completed: 0 };
      const pct = d.total ? Math.round((d.completed / d.total) * 100) : 0;

      const body = el('div', { class: 'tree-body', hidden: true });
      cat.subcategories.forEach((sub) => {
        const sd = st.bySub.get(sub.id) || { total: 0, completed: 0 };
        const spct = sd.total ? Math.round((sd.completed / sd.total) * 100) : 0;
        body.appendChild(el('div', { class: 'sub-row' }, [
          el('div', { class: 'name', text: sub.name }),
          el('span', { class: 'faint small nowrap', text: sd.completed + '/' + sd.total }),
          bar(spct, spct === 100 ? 'ok' : ''),
          button('Open', { size: 'sm', onClick: () => ctx.openExplorer({ category: cat.id, subcategory: sub.id }) })
        ]));
      });
      body.appendChild(el('div', { class: 'row', style: 'margin-top:12px' }, [
        button('View category details', { size: 'sm', variant: 'primary', onClick: () => ctx.go('category', { id: cat.id }) })
      ]));

      const head = el('button', { class: 'tree-head', type: 'button', 'aria-expanded': 'false' }, [
        el('span', { class: 'chev' }, icon('chevron', 14)),
        el('span', { class: 'name', text: cat.order + '. ' + cat.name }),
        badge(titleCase(cat.level), cat.level),
        el('span', { class: 'faint small nowrap', text: d.completed + '/' + d.total }),
        bar(pct, pct === 100 ? 'ok' : ''),
        el('span', { class: 'faint small nowrap', style: 'width:36px;text-align:right', text: pct + '%' })
      ]);
      head.addEventListener('click', () => {
        const open = head.getAttribute('aria-expanded') === 'true';
        head.setAttribute('aria-expanded', String(!open));
        body.hidden = open;
      });
      host.appendChild(el('section', { class: 'tree-cat' }, [head, body]));
    });

    function toggleAll(open) {
      host.querySelectorAll('.tree-head').forEach((h) => {
        h.setAttribute('aria-expanded', String(open));
        h.parentElement.querySelector('.tree-body').hidden = !open;
      });
    }
    return root;
  };

  /* ================================================ CATEGORY DETAILS ==== */

  Views.category = function (ctx, params) {
    const cat = Curriculum.categoriesById.get(params.id);
    if (!cat) return emptyState('folder', 'Category not found', 'The category "' + params.id + '" does not exist.',
      button('Back to categories', { onClick: () => ctx.go('categories') }));

    const st = Progress.computeStats();
    const d = st.byCategory.get(cat.id) || { total: 0, completed: 0, inProgress: 0 };
    const pct = d.total ? Math.round((d.completed / d.total) * 100) : 0;
    const items = Progress.allItems().filter((i) => i.categoryId === cat.id);
    const totalMin = items.reduce((a, i) => a + (i.estMinutes || 0), 0);
    const remainMin = items.filter((i) => !Progress.isCompleted(i.id)).reduce((a, i) => a + (i.estMinutes || 0), 0);

    const root = el('div', { class: 'stack' });

    root.appendChild(el('section', { class: 'card hero' }, [
      el('div', { class: 'hero-main' }, [
        button('Categories', { size: 'sm', variant: 'ghost', icon: 'arrowLeft', onClick: () => ctx.go('categories') }),
        el('h1', { style: 'margin-top:10px', text: cat.name }),
        el('div', { class: 'tag-row', style: 'margin:10px 0 14px' }, [
          badge(titleCase(cat.level), cat.level),
          badge(cat.subcategories.length + ' subcategories'),
          badge(d.total + ' items'),
          badge(minutes(totalMin) + ' total')
        ]),
        el('p', { class: 'muted small', style: 'margin:0', text:
          d.completed + ' completed · ' + d.inProgress + ' in progress · ' + (d.total - d.completed - d.inProgress) + ' not started · ' + minutes(remainMin) + ' remaining' })
      ]),
      el('div', { class: 'hero-ring' }, [ring(pct, 120, 10, pct + '%', 'complete')])
    ]));

    const subCard = el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('h2', { text: 'Subcategories' })])]);
    cat.subcategories.forEach((sub) => {
      const sd = st.bySub.get(sub.id) || { total: 0, completed: 0 };
      subCard.appendChild(progressRow(sub.name, sd.completed, sd.total, () => ctx.openExplorer({ category: cat.id, subcategory: sub.id })));
    });
    root.appendChild(subCard);

    const nextUp = items.filter((i) => !Progress.isCompleted(i.id) && Progress.lockState(i).state !== 'locked').slice(0, 9);
    const listCard = el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('h2', { text: 'Next available in this category' }),
        el('div', { class: 'spacer' }),
        button('Open in explorer', { size: 'sm', onClick: () => ctx.openExplorer({ category: cat.id }) })
      ])
    ]);
    if (!nextUp.length) {
      listCard.appendChild(emptyState('done', 'Category complete', 'Every available item in ' + cat.name + ' is finished. Nice work.'));
    } else {
      const g = el('div', { class: 'grid grid-3' });
      nextUp.forEach((i) => g.appendChild(itemCard(i)));
      g.addEventListener('click', ctx.itemClickHandler);
      listCard.appendChild(g);
    }
    root.appendChild(listCard);
    return root;
  };

  /* ======================================================== EXPLORER ==== */

  Views.explorer = function (ctx, params) {
    const s = Storage.get();
    const f = Object.assign({}, s.preferences.filters, params || {});
    const root = el('div', { class: 'stack' });

    function saveFilters(patch) {
      Storage.update((state) => { Object.assign(state.preferences.filters, patch); }, 'filters');
      ctx.go('explorer', Object.assign({}, f, patch));
    }

    /* --- toolbar --- */
    const qInput = el('input', { type: 'search', placeholder: 'Search titles, objectives, keywords…', value: f.q || '' });
    qInput.addEventListener('input', global.UI.debounce(() => {
      ctx.pendingFocus = 'explorer-q';
      saveFilters({ q: qInput.value, page: 1 });
    }, 320));
    if (ctx.pendingFocus === 'explorer-q') {
      ctx.pendingFocus = null;
      setTimeout(() => {
        qInput.focus();
        const n = qInput.value.length;
        try { qInput.setSelectionRange(n, n); } catch (e) { /* search inputs may not support it */ }
      }, 0);
    }

    const catOptions = [{ value: '', label: 'All categories' }].concat(Curriculum.categories.map((c) => ({ value: c.id, label: c.name })));
    const subOptions = [{ value: '', label: 'All subcategories' }].concat(
      (f.category ? (Curriculum.categoriesById.get(f.category) || { subcategories: [] }).subcategories : [])
        .map((x) => ({ value: x.id, label: x.name })));

    const toolbar = el('div', { class: 'toolbar' }, [
      el('div', { class: 'field wide' }, [el('label', { text: 'Search' }), qInput]),
      field('Category', select(catOptions, f.category, (v) => saveFilters({ category: v, subcategory: '', page: 1 }))),
      field('Subcategory', select(subOptions, f.subcategory, (v) => saveFilters({ subcategory: v, page: 1 }))),
      field('Difficulty', select([{ value: '', label: 'Any level' }].concat(
        Curriculum.LEVELS.map((l) => ({ value: l, label: titleCase(l) }))), f.level, (v) => saveFilters({ level: v, page: 1 }))),
      field('Type', select([{ value: '', label: 'Any type' }].concat(
        Object.keys(Curriculum.TYPES).map((t) => ({ value: t, label: Curriculum.TYPES[t].label }))), f.type, (v) => saveFilters({ type: v, page: 1 }))),
      field('Status', select([
        { value: '', label: 'Any status' }, { value: 'not-started', label: 'Not started' },
        { value: 'in-progress', label: 'In progress' }, { value: 'completed', label: 'Completed' }
      ], f.status, (v) => saveFilters({ status: v, page: 1 }))),
      field('Duration', select([
        { value: '', label: 'Any duration' }, { value: 'short', label: '1 hour or less' },
        { value: 'medium', label: '1 to 3 hours' }, { value: 'long', label: '3 to 8 hours' }, { value: 'epic', label: '8+ hours' }
      ], f.duration, (v) => saveFilters({ duration: v, page: 1 }))),
      field('Prerequisites', select([
        { value: '', label: 'Any' }, { value: 'none', label: 'No prerequisites' },
        { value: 'has', label: 'Has prerequisites' }, { value: 'available', label: 'Unlocked / available' },
        { value: 'locked', label: 'Locked' }
      ], f.prereq, (v) => saveFilters({ prereq: v, page: 1 }))),
      field('Sort by', select([
        { value: 'default', label: 'Curriculum order' },
        { value: 'title-asc', label: 'Title A to Z' }, { value: 'title-desc', label: 'Title Z to A' },
        { value: 'difficulty-asc', label: 'Difficulty, easiest first' }, { value: 'difficulty-desc', label: 'Difficulty, hardest first' },
        { value: 'duration-asc', label: 'Duration, shortest first' }, { value: 'duration-desc', label: 'Duration, longest first' },
        { value: 'status', label: 'Completion status' }, { value: 'progress', label: 'Progress %' },
        { value: 'updated', label: 'Recently updated' }
      ], f.sort, (v) => saveFilters({ sort: v, page: 1 }))),
      field('Page size', select([
        { value: '20', label: '20 per page' }, { value: '50', label: '50 per page' }, { value: '100', label: '100 per page' }
      ], String(s.preferences.pageSize), (v) => {
        Storage.update((state) => { state.preferences.pageSize = Number(v); }, 'prefs');
        ctx.go('explorer', Object.assign({}, f, { page: 1 }));
      }))
    ]);

    const incCb = el('input', { type: 'checkbox' });
    incCb.checked = !!f.incompleteChecklist;
    incCb.addEventListener('change', () => saveFilters({ incompleteChecklist: incCb.checked, page: 1 }));

    toolbar.appendChild(el('div', { style: 'flex:1 1 100%' }, el('div', { class: 'row' }, [
      el('label', { style: 'display:flex;align-items:center;gap:8px;margin:0;cursor:pointer;color:var(--text)' }, [
        incCb, el('span', { text: 'Only partially completed checklists' })
      ]),
      el('div', { style: 'flex:1' }),
      button('Clear filters', { size: 'sm', onClick: () => ctx.openExplorer({ q: f.q || '' }) }),
      button('Reset search', { size: 'sm', onClick: () => ctx.openExplorer({}) })
    ])));

    root.appendChild(el('div', { class: 'card' }, toolbar));

    /* --- results --- */
    const res = Search.query({
      q: f.q, category: f.category, subcategory: f.subcategory, level: f.level,
      status: f.status, type: f.type, duration: f.duration, prereq: f.prereq,
      incompleteChecklist: f.incompleteChecklist, sort: f.sort,
      page: Number(params && params.page) || 1, pageSize: s.preferences.pageSize
    });

    const resultsCard = el('div', { class: 'card' });
    resultsCard.appendChild(el('div', { class: 'card-head' }, [
      el('h2', { text: res.total.toLocaleString() + ' matching item' + (res.total === 1 ? '' : 's') }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'faint small', text: 'Searched across all ' + Progress.allItems().length.toLocaleString() + ' items' })
    ]));

    if (!res.total) {
      resultsCard.appendChild(emptyState('explorer', 'No items match these filters',
        'Try removing a filter or searching for a broader keyword such as "eloquent", "queue" or "testing".',
        button('Clear filters', { onClick: () => ctx.openExplorer({}) })));
    } else {
      const g = el('div', { class: 'grid grid-3' });
      res.items.forEach((i) => g.appendChild(itemCard(i)));
      g.addEventListener('click', ctx.itemClickHandler);
      resultsCard.appendChild(g);

      const pag = el('div', { class: 'pagination' });
      const from = (res.page - 1) * res.pageSize + 1;
      const to = Math.min(res.total, res.page * res.pageSize);
      pag.appendChild(el('span', { class: 'info', text: 'Showing ' + from + ' to ' + to + ' of ' + res.total.toLocaleString() }));
      const goPage = (p) => ctx.go('explorer', Object.assign({}, f, { page: p }));
      pag.appendChild(button('First', { size: 'sm', disabled: res.page === 1, onClick: () => goPage(1) }));
      pag.appendChild(button('Prev', { size: 'sm', disabled: res.page === 1, onClick: () => goPage(res.page - 1) }));
      for (let p = Math.max(1, res.page - 2); p <= Math.min(res.totalPages, res.page + 2); p++) {
        pag.appendChild(el('button', {
          class: 'btn btn-sm' + (p === res.page ? ' btn-primary' : ''), type: 'button', text: String(p),
          'aria-current': p === res.page ? 'page' : null, onclick: () => goPage(p)
        }));
      }
      pag.appendChild(button('Next', { size: 'sm', disabled: res.page === res.totalPages, onClick: () => goPage(res.page + 1) }));
      pag.appendChild(button('Last', { size: 'sm', disabled: res.page === res.totalPages, onClick: () => goPage(res.totalPages) }));
      resultsCard.appendChild(pag);
    }

    root.appendChild(resultsCard);
    return root;
  };

  Views.EMPTY_FILTERS = EMPTY_FILTERS;
})(window);
