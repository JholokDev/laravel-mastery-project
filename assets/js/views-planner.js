/* ============================================================================
 * views-planner.js — Daily Planner, Calendar, Analytics, Journal
 * ========================================================================== */

(function (global) {
  'use strict';

  const { el, bar, badge, stat, emptyState, field, select, minutes, titleCase,
          toast, confirmDialog, modal, progressRow, timeAgo, dateLabel, autoTextarea } = global.UI;
  const Curriculum = global.Curriculum;
  const Progress = global.Progress;
  const Storage = global.Storage;
  const Search = global.Search;

  const Views = global.Views || (global.Views = {});

  const DAY_STATUSES = [
    { value: 'planned', label: 'Planned' },
    { value: 'in-progress', label: 'In progress' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
    { value: 'skipped', label: 'Skipped' }
  ];

  /* ========================================================== PLANNER === */

  Views.planner = function (ctx, params) {
    const todayK = Progress.todayKey();
    const key = (params && params.date) || todayK;
    const s = Storage.get();
    const root = el('div', { class: 'stack' });

    const existing = Progress.getDay(key);
    const day = existing || {
      primaryItemId: null, extraItemIds: [], goal: '',
      plannedMinutes: s.preferences.dailyTargetMinutes || 60,
      status: 'planned', notes: '', tasks: [], rescheduledTo: null
    };

    function mutate(fn, reason) {
      Storage.update(() => { const d = Progress.ensureDay(key); fn(d); d.updatedAt = new Date().toISOString(); }, reason || 'plan');
    }

    /* --- date bar --- */
    const dateInput = el('input', { type: 'date', value: key });
    dateInput.addEventListener('change', () => ctx.go('planner', { date: dateInput.value || todayK }));

    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'row' }, [
        el('div', { style: 'flex:1;min-width:200px' }, [
          el('h1', { text: 'Daily planner' }),
          el('p', { class: 'muted small mb-0', text: 'Pick one primary project per day. Skipping days never deletes progress — your streak simply pauses.' })
        ]),
        el('button', { class: 'btn btn-sm', type: 'button', text: '‹ Prev day', onclick: () => ctx.go('planner', { date: Progress.addDays(key, -1) }) }),
        el('div', { style: 'width:160px' }, dateInput),
        el('button', { class: 'btn btn-sm', type: 'button', text: 'Next day ›', onclick: () => ctx.go('planner', { date: Progress.addDays(key, 1) }) }),
        el('button', { class: 'btn btn-sm', type: 'button', text: 'Today', onclick: () => ctx.go('planner', { date: todayK }) }),
        el('button', { class: 'btn btn-sm', type: 'button', text: '🗓 Calendar', onclick: () => ctx.go('calendar') })
      ])
    ]));

    if (key > todayK) {
      root.appendChild(el('div', { class: 'callout info', text: 'You are planning a future day (' + dateLabel(key) + '). Nothing is counted until you actually do the work.' }));
    } else if (key < todayK && existing && existing.status !== 'completed' && existing.status !== 'skipped') {
      root.appendChild(el('div', { class: 'callout warn' }, [
        el('strong', { text: 'Missed day. ' }),
        document.createTextNode('This plan from ' + dateLabel(key) + ' was never finished. Reschedule it or mark it skipped so your statistics stay honest.'),
        el('div', { class: 'row', style: 'margin-top:10px' }, [
          el('button', { class: 'btn btn-sm', type: 'button', text: 'Reschedule to today', onclick: () => {
            Storage.update(() => {
              const src = Progress.ensureDay(key);
              const dst = Progress.ensureDay(todayK);
              dst.primaryItemId = dst.primaryItemId || src.primaryItemId;
              src.extraItemIds.forEach((id) => { if (dst.extraItemIds.indexOf(id) === -1) dst.extraItemIds.push(id); });
              dst.goal = dst.goal || src.goal;
              dst.status = 'planned';
              src.rescheduledTo = todayK;
              src.status = 'skipped';
              Storage.logActivity('plan', 'Rescheduled plan from ' + key + ' to ' + todayK);
            }, 'plan');
            toast('Rescheduled to today.');
            ctx.go('planner', { date: todayK });
          } }),
          el('button', { class: 'btn btn-sm', type: 'button', text: 'Mark as skipped', onclick: () => {
            mutate((d) => { d.status = 'skipped'; });
            toast('Day marked as skipped.');
            ctx.refresh();
          } })
        ])
      ]));
    }

    /* --- primary project --- */
    const dp = Progress.dayProgress(key);
    const primary = day.primaryItemId ? Progress.getItem(day.primaryItemId) : null;

    const primaryCard = el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('h2', { text: 'Primary project for ' + dateLabel(key) }),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn btn-sm', type: 'button', text: primary ? 'Change' : 'Choose project', onclick: () => pickItem((id) => {
          mutate((d) => { d.primaryItemId = id; });
          toast('Primary project set.');
          ctx.refresh();
        }) }),
        el('button', { class: 'btn btn-sm btn-primary', type: 'button', text: '✨ Recommend one', onclick: () => {
          const rec = Progress.recommendNext();
          if (!rec) { toast('No available item to recommend.', 'warn'); return; }
          mutate((d) => { d.primaryItemId = rec.id; });
          toast('Recommended: ' + rec.title);
          ctx.refresh();
        } })
      ])
    ]);

    if (!primary) {
      primaryCard.appendChild(emptyState('🎯', 'No primary project chosen',
        'Pick exactly one project to focus on. One meaningful project per day beats five half-finished ones.'));
    } else {
      const pip = Progress.itemProgress(primary);
      primaryCard.appendChild(el('div', {}, [
        el('div', { class: 'tag-row', style: 'margin-bottom:8px' }, [
          badge((Curriculum.TYPES[primary.type] || {}).label || primary.type),
          badge(titleCase(primary.level), primary.level),
          badge('⏱ ' + minutes(primary.estMinutes)),
          badge(global.UI.statusLabel(pip.status), pip.status !== 'not-started' ? pip.status : '')
        ]),
        el('h3', { text: primary.title }),
        el('p', { class: 'muted small', text: primary.description }),
        bar(pip.percent, pip.percent === 100 ? 'ok' : ''),
        el('div', { class: 'row', style: 'margin-top:12px' }, [
          el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Open workspace →', onclick: () => ctx.go('project', { id: primary.id }) }),
          el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Remove', onclick: () => { mutate((d) => { d.primaryItemId = null; }); ctx.refresh(); } })
        ])
      ]));
    }
    root.appendChild(primaryCard);

    /* --- goal / time / status --- */
    const goalInput = el('input', { type: 'text', placeholder: 'e.g. Ship product CRUD with validation and 3 tests', value: day.goal || '' });
    goalInput.addEventListener('input', global.UI.debounce(() => Storage.updateQuiet(() => { Progress.ensureDay(key).goal = goalInput.value; }), 400));

    const timeInput = el('input', { type: 'number', min: '0', step: '15', value: String(day.plannedMinutes || 60) });
    timeInput.addEventListener('change', () => mutate((d) => { d.plannedMinutes = Number(timeInput.value) || 0; }));

    const statusSel = select(DAY_STATUSES, day.status, (v) => {
      mutate((d) => {
        d.status = v;
        if (v === 'completed') Storage.logActivity('day', 'Completed the plan for ' + key);
      });
      toast('Day status: ' + v);
      ctx.refresh();
    });

    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'toolbar' }, [
        field("Today's goal", goalInput),
        field('Planned study minutes', timeInput),
        field('Day status', statusSel)
      ]),
      el('div', { class: 'row', style: 'margin-top:14px' }, [
        el('button', { class: 'btn btn-sm', type: 'button', text: '▶ Start', onclick: () => { mutate((d) => { d.status = 'in-progress'; }); ctx.refresh(); } }),
        el('button', { class: 'btn btn-sm', type: 'button', text: '⏸ Pause', onclick: () => { mutate((d) => { d.status = 'paused'; }); ctx.refresh(); } }),
        el('button', { class: 'btn btn-sm', type: 'button', text: '↻ Resume', onclick: () => { mutate((d) => { d.status = 'in-progress'; }); ctx.refresh(); } }),
        el('button', { class: 'btn btn-sm btn-primary', type: 'button', text: '✔ Complete day', onclick: () => {
          confirmDialog('Mark this day complete?',
            'Day completion is recorded separately from project completion. Marking a day complete does not mark any project complete.',
            'Complete day', () => { mutate((d) => { d.status = 'completed'; }); toast('Day completed.'); ctx.refresh(); });
        } }),
        el('div', { style: 'flex:1' }),
        el('div', { class: 'row tight' }, [
          el('span', { class: 'muted small', text: dp.done + '/' + dp.total + ' done' }),
          el('div', { style: 'width:140px' }, bar(dp.percent, dp.percent === 100 ? 'ok' : '')),
          el('span', { class: 'faint small', text: dp.percent + '%' })
        ])
      ])
    ]));

    /* --- extra items + ad-hoc tasks --- */
    const extras = el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('h2', { text: 'Additional tasks (optional)' }),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn btn-sm', type: 'button', text: '＋ Add curriculum item', onclick: () => pickItem((id) => {
          mutate((d) => { if (d.extraItemIds.indexOf(id) === -1) d.extraItemIds.push(id); });
          ctx.refresh();
        }) }),
        el('button', { class: 'btn btn-sm', type: 'button', text: '＋ Add free task', onclick: () => {
          const input = el('input', { type: 'text', placeholder: 'e.g. Read the Laravel queues docs' });
          modal({
            title: 'Add a free-form task', body: field('Task', input),
            actions: [{ label: 'Cancel' }, { label: 'Add task', variant: 'primary', onClick: () => {
              if (!input.value.trim()) { toast('Task is empty.', 'warn'); return true; }
              mutate((d) => { d.tasks.push({ id: 't.' + Date.now().toString(36), text: input.value.trim(), done: false }); });
              ctx.refresh();
            } }]
          });
        } })
      ])
    ]);

    const anyExtra = (day.extraItemIds || []).length + (day.tasks || []).length;
    if (!anyExtra) {
      extras.appendChild(el('p', { class: 'faint', text: 'Nothing extra planned. Optional tasks are tracked separately and never lower your main curriculum percentage.' }));
    } else {
      const ul = el('ul', { class: 'checklist' });
      (day.extraItemIds || []).forEach((id) => {
        const it = Progress.getItem(id);
        const done = Progress.isCompleted(id);
        ul.appendChild(el('li', {}, el('div', { class: 'check' + (done ? ' done' : '') }, [
          el('span', { text: done ? '✔' : '○', style: 'width:16px' }),
          el('span', { class: 'txt', text: it ? it.title : id, style: 'flex:1' }),
          el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Open', onclick: () => it && ctx.go('project', { id }) }),
          el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: '✕', 'aria-label': 'Remove', onclick: () => {
            mutate((d) => { d.extraItemIds = d.extraItemIds.filter((x) => x !== id); }); ctx.refresh();
          } })
        ])));
      });
      (day.tasks || []).forEach((t) => {
        const cb = el('input', { type: 'checkbox' });
        cb.checked = !!t.done;
        cb.addEventListener('change', () => { mutate((d) => { const x = d.tasks.find((y) => y.id === t.id); if (x) x.done = cb.checked; }); ctx.refresh(); });
        ul.appendChild(el('li', {}, el('div', { class: 'check' + (t.done ? ' done' : '') }, [
          cb,
          el('span', { class: 'txt', text: t.text, style: 'flex:1' }),
          el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: '✕', 'aria-label': 'Remove', onclick: () => {
            mutate((d) => { d.tasks = d.tasks.filter((y) => y.id !== t.id); }); ctx.refresh();
          } })
        ])));
      });
      extras.appendChild(ul);
    }
    root.appendChild(extras);

    /* --- notes --- */
    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Daily notes' }),
      el('div', { style: 'height:10px' }),
      autoTextarea(day.notes, 'What happened today? What blocked you? What will you do tomorrow?',
        (v) => Storage.updateQuiet(() => { Progress.ensureDay(key).notes = v; }), 5)
    ]));

    /* item picker */
    function pickItem(onPick) {
      const q = el('input', { type: 'search', placeholder: 'Search the full curriculum…' });
      const list = el('div', { style: 'margin-top:12px;max-height:46vh;overflow-y:auto' });
      function renderList() {
        global.UI.clear(list);
        const res = Search.query({ q: q.value, pageSize: 25, page: 1, sort: q.value ? 'title-asc' : 'default' });
        if (!res.total) { list.appendChild(el('p', { class: 'faint', text: 'No matches.' })); return; }
        res.items.forEach((i) => {
          list.appendChild(el('button', {
            class: 'suggestion', type: 'button',
            onclick: () => { global.UI.closeModal(); onPick(i.id); }
          }, [
            el('span', { text: i.title }),
            el('small', { text: (Curriculum.categoriesById.get(i.categoryId) || {}).name + ' · ' + titleCase(i.level) + ' · ' + minutes(i.estMinutes) })
          ]));
        });
        if (res.total > res.items.length) list.appendChild(el('p', { class: 'faint small', style: 'margin-top:8px', text: 'Showing 25 of ' + res.total + ' matches — refine your search.' }));
      }
      q.addEventListener('input', global.UI.debounce(renderList, 200));
      modal({ title: 'Choose a curriculum item', body: [q, list], actions: [{ label: 'Cancel' }] });
      renderList();
    }

    return root;
  };

  /* ========================================================= CALENDAR === */

  Views.calendar = function (ctx, params) {
    const s = Storage.get();
    const today = new Date();
    const ym = (params && params.ym) || (today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0'));
    const [year, month] = ym.split('-').map(Number);
    const root = el('div', { class: 'stack' });

    const first = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDow = (first.getDay() + 6) % 7; // Monday-first

    function shiftMonth(n) {
      const d = new Date(year, month - 1 + n, 1);
      ctx.go('calendar', { ym: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') });
    }

    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'row' }, [
        el('div', { style: 'flex:1;min-width:160px' }, [
          el('h1', { text: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }),
          el('p', { class: 'muted small mb-0', text: 'Green = day completed · amber = in progress or paused · red = skipped · grey dot = plan exists' })
        ]),
        el('button', { class: 'btn btn-sm', type: 'button', text: '‹', 'aria-label': 'Previous month', onclick: () => shiftMonth(-1) }),
        el('button', { class: 'btn btn-sm', type: 'button', text: 'This month', onclick: () => ctx.go('calendar', {}) }),
        el('button', { class: 'btn btn-sm', type: 'button', text: '›', 'aria-label': 'Next month', onclick: () => shiftMonth(1) })
      ])
    ]));

    const grid = el('div', { class: 'cal-grid' });
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d) => grid.appendChild(el('div', { class: 'cal-dow', text: d })));
    for (let i = 0; i < startDow; i++) grid.appendChild(el('div', { class: 'cal-day blank' }));

    const todayK = Progress.todayKey();
    let completedDays = 0, plannedDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const k = year + '-' + String(month).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const plan = s.days[k];
      if (plan) plannedDays++;
      if (plan && plan.status === 'completed') completedDays++;
      const btn = el('button', {
        class: 'cal-day' + (k === todayK ? ' today' : '') + (plan ? ' has-plan' : '') + (k > todayK ? ' out' : ''),
        type: 'button', 'aria-label': k + (plan ? ' — ' + plan.status : ' — no plan'),
        onclick: () => ctx.go('planner', { date: k })
      }, [
        el('span', { text: String(d) }),
        plan ? el('span', { class: 'dot ' + plan.status }) : el('span', { class: 'dot', style: 'opacity:.15' })
      ]);
      grid.appendChild(btn);
    }

    root.appendChild(el('div', { class: 'card' }, [grid]));

    const st = Progress.computeStats();
    root.appendChild(el('div', { class: 'grid grid-stats' }, [
      stat('Plans this month', plannedDays, 'days with a plan'),
      stat('Completed this month', completedDays, 'days marked complete', completedDays ? 'ok' : ''),
      stat('Items done (30d)', st.monthlyCompleted, 'curriculum items'),
      stat('Items done (7d)', st.weeklyCompleted, 'curriculum items'),
      stat('Current streak', st.currentStreak + 'd', 'study days in a row', 'accent'),
      stat('Study days total', st.totalStudyDays, 'of ' + st.calendarDays + ' calendar days')
    ]));

    return root;
  };

  /* ======================================================== ANALYTICS === */

  Views.analytics = function (ctx) {
    const st = Progress.computeStats();
    const s = Storage.get();
    const root = el('div', { class: 'stack' });

    root.appendChild(el('div', { class: 'card' }, [
      el('h1', { text: 'Progress analytics' }),
      el('p', { class: 'muted small mb-0', text: 'Every number here is derived from your saved data. Nothing is simulated or estimated beyond the clearly-labelled pace projection.' })
    ]));

    root.appendChild(el('div', { class: 'grid grid-stats' }, [
      stat('Overall', st.overall + '%', st.completed + '/' + st.totalItems + ' items', 'accent'),
      stat('This week', st.weeklyCompleted, 'items completed (7d)'),
      stat('This month', st.monthlyCompleted, 'items completed (30d)'),
      stat('Per study day', st.perDay, 'average items'),
      stat('Effort done', minutes(st.totalMinutes - st.remainingMinutes), 'estimated'),
      stat('Effort left', minutes(st.remainingMinutes), 'estimated'),
      stat('Study days', st.totalStudyDays, 'days with activity'),
      stat('Calendar days', st.calendarDays, 'since first activity')
    ]));

    /* last 30 days bar list (real data, no fake chart) */
    const histCard = el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('h2', { text: 'Last 14 days — items completed' })])]);
    const counts = {};
    Object.keys(s.progress).forEach((id) => {
      const p = s.progress[id];
      if (p.status === 'completed' && p.completedAt) {
        const k = Progress.todayKey(p.completedAt);
        counts[k] = (counts[k] || 0) + 1;
      }
    });
    const max = Math.max(1, ...Object.values(counts));
    let any = false;
    for (let i = 13; i >= 0; i--) {
      const k = Progress.addDays(Progress.todayKey(), -i);
      const c = counts[k] || 0;
      if (c) any = true;
      histCard.appendChild(el('div', { class: 'progress-row' }, [
        el('div', { class: 'name mono', text: k, style: 'flex:0 0 100px' }),
        bar((c / max) * 100, c ? 'ok' : ''),
        el('div', { class: 'pct', text: String(c) })
      ]));
    }
    if (!any) histCard.appendChild(el('p', { class: 'faint small', style: 'margin-top:10px', text: 'No completions in the last 14 days yet.' }));

    /* level + type */
    const levelCard = el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('h2', { text: 'By difficulty level' })])]);
    Curriculum.LEVELS.forEach((lv) => {
      const d = st.byLevel.get(lv) || { total: 0, completed: 0 };
      levelCard.appendChild(progressRow(titleCase(lv), d.completed, d.total));
    });
    levelCard.appendChild(el('div', { class: 'section-title', text: 'By item type' }));
    Object.keys(Curriculum.TYPES).forEach((t) => {
      const d = st.byType.get(t);
      if (d) levelCard.appendChild(progressRow(Curriculum.TYPES[t].label, d.completed, d.total));
    });

    root.appendChild(el('div', { class: 'grid grid-2' }, [histCard, levelCard]));

    /* full category table */
    const catCard = el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('h2', { text: 'All categories' })])]);
    const tbody = el('tbody');
    Curriculum.categories.forEach((c) => {
      const d = st.byCategory.get(c.id) || { total: 0, completed: 0, inProgress: 0 };
      const pct = d.total ? Math.round((d.completed / d.total) * 100) : 0;
      tbody.appendChild(el('tr', {}, [
        el('td', {}, el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: c.name, onclick: () => ctx.go('category', { id: c.id }) })),
        el('td', {}, badge(titleCase(c.level), c.level)),
        el('td', { text: String(d.total) }),
        el('td', { text: String(d.completed) }),
        el('td', { text: String(d.inProgress) }),
        el('td', { style: 'width:160px' }, bar(pct, pct === 100 ? 'ok' : '')),
        el('td', { text: pct + '%', class: 'nowrap' })
      ]));
    });
    catCard.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, ['Category', 'Level', 'Items', 'Done', 'WIP', 'Progress', '%'].map((h) => el('th', { text: h })))),
      tbody
    ]));
    root.appendChild(catCard);

    return root;
  };

  /* ========================================================== JOURNAL === */

  Views.journal = function (ctx) {
    const s = Storage.get();
    const root = el('div', { class: 'stack' });

    const titleIn = el('input', { type: 'text', placeholder: 'Entry title' });
    const bodyIn = el('textarea', { rows: '5', placeholder: 'What did you learn today? What mistakes did you make and how did you fix them?' });
    const dateIn = el('input', { type: 'date', value: Progress.todayKey() });

    root.appendChild(el('div', { class: 'card' }, [
      el('h1', { text: 'Notes & learning journal' }),
      el('p', { class: 'muted small', text: 'A dated log of lessons, mistakes and solutions. Entries are stored locally and included in exports.' }),
      el('div', { class: 'toolbar' }, [field('Date', dateIn), field('Title', titleIn)]),
      field('Entry', bodyIn),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Save entry', onclick: () => {
        if (!bodyIn.value.trim()) { toast('Write something first.', 'warn'); return; }
        Storage.update((state) => {
          state.journal.unshift({
            id: 'jr.' + Date.now().toString(36), date: dateIn.value || Progress.todayKey(),
            title: titleIn.value.trim() || 'Untitled entry', body: bodyIn.value, tags: [], itemId: null
          });
          Storage.logActivity('journal', 'Journal entry: ' + (titleIn.value.trim() || 'Untitled entry'));
        }, 'journal');
        toast('Entry saved.');
        ctx.refresh();
      } })
    ]));

    /* aggregated project notes */
    const noteItems = Object.keys(s.progress)
      .map((id) => ({ id, p: s.progress[id], item: Progress.getItem(id) }))
      .filter((x) => x.item && (x.p.notes || x.p.learned || x.p.problems || x.p.solutions));

    const card = el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [
      el('h2', { text: 'Journal entries' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'faint small', text: s.journal.length + ' entries · ' + noteItems.length + ' projects with notes' })
    ])]);

    if (!s.journal.length) {
      card.appendChild(emptyState('📓', 'No journal entries yet', 'Write your first entry above. Future-you will thank present-you.'));
    } else {
      const ul = el('ul', { class: 'list' });
      s.journal.forEach((j) => {
        const linked = j.itemId ? Progress.getItem(j.itemId) : null;
        ul.appendChild(el('li', {}, [
          el('div', { class: 'row', style: 'justify-content:space-between' }, [
            el('strong', { text: j.title }),
            el('span', { class: 'faint small', text: j.date })
          ]),
          el('p', { class: 'muted small', style: 'white-space:pre-wrap;margin:6px 0', text: j.body }),
          el('div', { class: 'row tight' }, [
            linked ? el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: '↗ ' + linked.title, onclick: () => ctx.go('project', { id: linked.id }) }) : null,
            el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Delete', onclick: () => {
              confirmDialog('Delete this entry?', 'This cannot be undone.', 'Delete', () => {
                Storage.update((state) => { state.journal = state.journal.filter((x) => x.id !== j.id); }, 'journal');
                ctx.refresh();
              }, 'danger');
            } })
          ])
        ]));
      });
      card.appendChild(ul);
    }
    root.appendChild(card);

    if (noteItems.length) {
      const pc = el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('h2', { text: 'Notes attached to projects' })])]);
      const ul = el('ul', { class: 'list' });
      noteItems.slice(0, 50).forEach((x) => {
        const parts = [];
        if (x.p.learned) parts.push('Learned: ' + x.p.learned);
        if (x.p.problems) parts.push('Problems: ' + x.p.problems);
        if (x.p.solutions) parts.push('Solutions: ' + x.p.solutions);
        if (x.p.notes) parts.push('Notes: ' + x.p.notes);
        ul.appendChild(el('li', {}, [
          el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: x.item.title, onclick: () => ctx.go('project', { id: x.id }) }),
          el('p', { class: 'muted small', style: 'white-space:pre-wrap;margin:6px 0 0', text: parts.join('\n').slice(0, 600) })
        ]));
      });
      pc.appendChild(ul);
      root.appendChild(pc);
    }

    return root;
  };
})(window);
