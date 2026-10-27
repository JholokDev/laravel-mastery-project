/* ============================================================================
 * views-data.js — Backup & Restore, Settings, Help / Getting Started
 * ========================================================================== */

(function (global) {
  'use strict';

  const { el, stat, badge, field, select, toast, confirmDialog, modal,
          dateLabel, timeAgo, minutes } = global.UI;
  const Storage = global.Storage;
  const Progress = global.Progress;
  const Backup = global.Backup;
  const Curriculum = global.Curriculum;

  const Views = global.Views || (global.Views = {});

  /* ========================================================== BACKUP ==== */

  Views.backup = function (ctx) {
    const s = Storage.get();
    const usage = Storage.usage();
    const reminder = Backup.backupReminder();
    const root = el('div', { class: 'stack' });

    root.appendChild(el('div', { class: 'card' }, [
      el('h1', { text: 'Backup & restore' }),
      el('p', { class: 'muted small mb-0', text: 'Your progress lives only in this browser. Clearing site data, using a different browser or a private window means a different (empty) dataset. Export regularly.' })
    ]));

    if (reminder.due) {
      root.appendChild(el('div', { class: 'callout warn' }, [
        el('strong', { text: 'Backup reminder: ' }),
        document.createTextNode(reminder.message + ' Export a JSON backup now to protect your work.')
      ]));
    }

    root.appendChild(el('div', { class: 'grid grid-stats' }, [
      stat('Progress records', Object.keys(s.progress).length),
      stat('Completed items', Object.keys(s.progress).filter((k) => s.progress[k].status === 'completed').length, '', 'ok'),
      stat('Custom items', s.customItems.length),
      stat('Daily plans', Object.keys(s.days).length),
      stat('Journal entries', s.journal.length),
      stat('Storage used', usage.kb + ' KB', 'of roughly ' + usage.approxLimitKb + ' KB', usage.kb > 4000 ? 'danger' : ''),
      stat('Last export', s.backup.lastExportAt ? timeAgo(s.backup.lastExportAt) : 'never', s.backup.lastExportAt ? dateLabel(s.backup.lastExportAt) : 'no backup yet', s.backup.lastExportAt ? '' : 'warn'),
      stat('Last import', s.backup.lastImportAt ? timeAgo(s.backup.lastImportAt) : 'never')
    ]));

    /* export */
    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Export' }),
      el('p', { class: 'muted small', text: 'JSON is the full, restorable backup. CSV is a human-readable progress report for spreadsheets — it cannot be imported back.' }),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn btn-primary', type: 'button', text: '⬇ Export full backup (JSON)', onclick: () => { Backup.exportJSON(); toast('Backup downloaded.'); ctx.refresh(); } }),
        el('button', { class: 'btn', type: 'button', text: '⬇ Export progress report (CSV)', onclick: () => { Backup.exportCSV(); toast('CSV report downloaded.'); ctx.refresh(); } }),
        el('button', { class: 'btn', type: 'button', text: '👁 Preview backup JSON', onclick: () => {
          const payload = Backup.buildExport();
          const pre = el('textarea', { rows: '16', readonly: true, class: 'mono' });
          pre.value = JSON.stringify(payload, null, 2).slice(0, 60000);
          modal({ title: 'Backup preview', body: pre });
        } })
      ])
    ]));

    /* import */
    const fileInput = el('input', { type: 'file', accept: 'application/json,.json' });
    const pasteArea = el('textarea', { rows: '5', placeholder: '…or paste backup JSON here', class: 'mono' });

    function handleJSON(text, sourceName) {
      let parsed;
      try { parsed = JSON.parse(text); }
      catch (err) { showRejection('The file is not valid JSON.', [String(err.message)]); return; }
      const result = Backup.validate(parsed);
      if (!result.ok) { showRejection('This backup was rejected.', result.errors); return; }
      showPreview(result, sourceName);
    }

    function showRejection(title, errors) {
      modal({
        title: 'Import rejected',
        body: [
          el('div', { class: 'callout danger' }, el('strong', { text: title })),
          el('p', { class: 'muted small', style: 'margin-top:12px', text: 'Your existing progress has NOT been changed.' }),
          el('ul', {}, (errors || []).map((e) => el('li', { text: e })))
        ]
      });
    }

    function showPreview(result, sourceName) {
      const sum = Backup.summarise(result.state);
      const cur = Backup.summarise(Storage.get());
      const headRow = el('tr');
      ['', 'Current', 'In backup'].forEach((h) => headRow.appendChild(el('th', { text: h })));
      const tbody = el('tbody');
      [
        ['Progress records', cur.progressRecords, sum.progressRecords],
        ['Completed', cur.completed, sum.completed],
        ['In progress', cur.inProgress, sum.inProgress],
        ['Custom items', cur.customItems, sum.customItems],
        ['Daily plans', cur.days, sum.days],
        ['Journal entries', cur.journal, sum.journal]
      ].forEach((r) => {
        const tr = el('tr');
        r.forEach((c, i) => tr.appendChild(el('td', { text: String(c), style: i === 0 ? 'color:var(--text-muted)' : '' })));
        tbody.appendChild(tr);
      });
      const table = el('table', { class: 'table' }, [el('thead', {}, headRow), tbody]);

      modal({
        title: 'Import preview',
        body: [
          el('p', { class: 'muted small', text: 'Source: ' + (sourceName || 'pasted JSON') +
            (result.meta && result.meta.exportedAt ? ' · exported ' + dateLabel(result.meta.exportedAt) : '') }),
          table,
          result.warnings.length ? el('div', { class: 'callout warn', style: 'margin-top:14px' }, [
            el('strong', { text: 'Warnings' }),
            el('ul', { style: 'margin:8px 0 0' }, result.warnings.map((w) => el('li', { text: w })))
          ]) : null,
          el('div', { class: 'callout info', style: 'margin-top:14px' }, [
            el('strong', { text: 'Merge' }),
            document.createTextNode(' keeps your current data and adds anything missing (checklists are unioned, notes appended). '),
            el('strong', { text: 'Replace' }),
            document.createTextNode(' discards everything currently stored in this browser.')
          ])
        ],
        actions: [
          { label: 'Cancel' },
          { label: 'Merge into current progress', onClick: () => {
            Backup.applyMerge(result.state);
            toast('Backup merged.');
            ctx.refresh();
          } },
          { label: 'Replace everything', variant: 'danger', onClick: () => {
            confirmDialog('Replace all local data?',
              'This permanently discards your current progress, plans, notes and custom items in this browser. Export a backup first if you are unsure.',
              'Yes, replace everything', () => {
                Backup.applyReplace(result.state);
                toast('Backup restored.');
                ctx.applyTheme();
                ctx.refresh();
              }, 'danger');
          } }
        ]
      });
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => handleJSON(String(reader.result), file.name);
      reader.onerror = () => showRejection('The file could not be read.', ['FileReader error']);
      reader.readAsText(file);
      fileInput.value = '';
    });

    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Import / restore' }),
      el('p', { class: 'muted small', text: 'Imports are always previewed first. Nothing is overwritten without an explicit confirmation.' }),
      field('Backup file (.json)', fileInput),
      field('Paste JSON', pasteArea),
      el('button', { class: 'btn', type: 'button', text: 'Validate pasted JSON', onclick: () => {
        if (!pasteArea.value.trim()) { toast('Paste a backup first.', 'warn'); return; }
        handleJSON(pasteArea.value, 'pasted JSON');
      } })
    ]));

    /* danger zone */
    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Danger zone' }),
      el('p', { class: 'muted small', text: 'These actions are irreversible. They only affect this browser.' }),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn btn-danger', type: 'button', text: 'Clear progress & plans (keep custom items)', onclick: () => {
          confirmDialog('Clear all progress?',
            'Checklists, statuses, daily plans and activity will be erased. Custom curriculum items, journal entries and preferences are kept.',
            'Clear progress', () => { Storage.clearProgressOnly(); toast('Progress cleared.'); ctx.refresh(); }, 'danger');
        } }),
        el('button', { class: 'btn btn-danger', type: 'button', text: 'Factory reset everything', onclick: () => {
          confirmDialog('Factory reset?',
            'Everything stored by this app in this browser will be deleted: progress, plans, notes, journal, custom items and preferences.',
            'Delete everything', () => { Storage.reset(); toast('Reset complete.'); ctx.applyTheme(); ctx.go('dashboard'); }, 'danger');
        } })
      ])
    ]));

    return root;
  };

  /* ==================================================== SYSTEM CHECK ==== */

  function systemCheckCard(ctx) {
    const rows = [];
    const add = (label, ok, detail) => rows.push({ label, ok, detail });

    // 1. Modules
    const mods = {
      Curriculum: () => !!(global.Curriculum && global.Curriculum.items),
      Roadmap: () => !!(global.Roadmap && global.Roadmap.summary),
      Storage: () => !!(global.Storage && global.Storage.KEY),
      Progress: () => !!(global.Progress && global.Progress.computeStats),
      Search: () => !!(global.Search && global.Search.query),
      Backup: () => !!(global.Backup && global.Backup.exportJSON),
      UI: () => !!(global.UI && global.UI.el)
    };
    Object.keys(mods).forEach((k) => add('Module: ' + k, mods[k](), mods[k]() ? 'loaded' : 'missing'));

    // 2. Every routed screen has a view function
    const routes = (global.App && global.App.routes) || {};
    Object.keys(routes).forEach((r) => {
      const ok = typeof Views[r] === 'function';
      add('Screen: ' + routes[r].title, ok, ok ? 'ready' : 'missing (' + (routes[r].file || '?') + '.js)');
    });

    // 3. Curriculum integrity
    const items = Progress.allItems();
    const ids = new Set();
    let dupes = 0, badRefs = 0, noChecklist = 0;
    items.forEach((i) => {
      if (ids.has(i.id)) dupes++; else ids.add(i.id);
      if (!Curriculum.categoriesById.get(i.categoryId) || !Curriculum.subcategoriesById.get(i.subcategoryId)) badRefs++;
      if (!i.checklist || !i.checklist.length) noChecklist++;
    });
    add('Curriculum items', items.length > 0, items.length.toLocaleString() + ' total');
    add('Roadmap projects', global.Roadmap.total > 0, global.Roadmap.total + ' guided projects');
    add('Duplicate item IDs', dupes === 0, dupes ? dupes + ' duplicate(s)' : 'none');
    add('Broken category references', badRefs === 0, badRefs ? badRefs + ' item(s)' : 'none');
    add('Items without a checklist', true, noChecklist + ' (they use manual completion)');

    // 4. localStorage
    let lsOk = false;
    try {
      const k = '__lmx_probe__';
      global.localStorage.setItem(k, '1');
      lsOk = global.localStorage.getItem(k) === '1';
      global.localStorage.removeItem(k);
    } catch (e) { lsOk = false; }
    add('localStorage writable', lsOk, lsOk ? 'yes' : 'blocked: progress will not persist (private mode or blocked storage)');

    // 5. Runtime errors captured since page load
    const errs = (global.__lmx && global.__lmx.errors) || [];
    add('JavaScript errors since load', errs.length === 0, errs.length ? errs.length + ' (see below)' : 'none');

    const failed = rows.filter((r) => !r.ok).length;
    const card = el('div', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('h2', { text: 'System check' }),
        el('div', { class: 'spacer' }),
        el('span', { class: 'badge ' + (failed ? 'in-progress' : 'completed'), text: failed ? failed + ' problem(s)' : 'All checks passed' }),
        global.UI.button('Re-run', { size: 'sm', onClick: () => ctx.refresh() })
      ]),
      el('div', { class: 'table-wrap' }, el('table', { class: 'table' }, [
        el('tbody', {}, rows.map((r) => el('tr', {}, [
          el('td', { text: r.label }),
          el('td', { class: r.ok ? 'muted' : '', style: r.ok ? '' : 'color:var(--danger);font-weight:600', text: (r.ok ? 'OK' : 'FAIL') + ' — ' + r.detail })
        ])))
      ]))
    ]);
    if (errs.length) {
      card.appendChild(el('div', { class: 'section-title', text: 'Captured JavaScript errors' }));
      card.appendChild(el('ul', {}, errs.slice(0, 8).map((e) => el('li', { class: 'mono', text: (e.file ? e.file + (e.line ? ':' + e.line : '') + '  ' : '') + e.message }))));
    }
    return card;
  }

  /* ======================================================== SETTINGS ==== */

  Views.settings = function (ctx) {
    const s = Storage.get();
    const root = el('div', { class: 'stack' });

    const themeSel = select([{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], s.preferences.theme, (v) => {
      Storage.update((state) => { state.preferences.theme = v; }, 'prefs');
      ctx.applyTheme();
      toast('Theme set to ' + v + '.');
    });

    const pageSel = select([{ value: '20', label: '20' }, { value: '50', label: '50' }, { value: '100', label: '100' }],
      String(s.preferences.pageSize), (v) => {
        Storage.update((state) => { state.preferences.pageSize = Number(v); }, 'prefs');
        toast('Page size: ' + v);
      });

    const targetIn = el('input', { type: 'number', min: '0', step: '15', value: String(s.preferences.dailyTargetMinutes) });
    targetIn.addEventListener('change', () => {
      Storage.update((state) => { state.preferences.dailyTargetMinutes = Number(targetIn.value) || 0; }, 'prefs');
      toast('Daily target updated.');
    });

    const remindIn = el('input', { type: 'number', min: '1', max: '90', value: String(s.backup.remindAfterDays) });
    remindIn.addEventListener('change', () => {
      Storage.update((state) => { state.backup.remindAfterDays = Math.max(1, Number(remindIn.value) || 7); }, 'prefs');
      toast('Backup reminder updated.');
    });

    root.appendChild(el('div', { class: 'card' }, [
      el('h1', { text: 'Settings' }),
      el('div', { class: 'toolbar', style: 'margin-top:16px' }, [
        field('Theme', themeSel),
        field('Default page size', pageSel),
        field('Daily study target (minutes)', targetIn),
        field('Backup reminder after (days)', remindIn)
      ])
    ]));

    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Storage' }),
      el('dl', { class: 'kv', style: 'margin-top:12px' }, [
        el('dt', { text: 'Storage key' }), el('dd', { class: 'mono', text: Storage.KEY }),
        el('dt', { text: 'Schema version' }), el('dd', { text: String(s.schemaVersion) }),
        el('dt', { text: 'Approx. size' }), el('dd', { text: Storage.usage().kb + ' KB' }),
        el('dt', { text: 'First created' }), el('dd', { text: dateLabel(s.createdAt) }),
        el('dt', { text: 'Last saved' }), el('dd', { text: timeAgo(s.updatedAt) }),
        el('dt', { text: 'Curriculum items' }), el('dd', { text: Progress.allItems().length.toLocaleString() + ' (' + s.customItems.length + ' custom)' })
      ]),
      el('div', { class: 'callout', style: 'margin-top:16px' }, [
        el('strong', { text: 'This is local-only storage. ' }),
        document.createTextNode('There is no account, no server, no cloud sync and no encryption. Do not store passwords, API keys or OAuth secrets in any notes field.')
      ])
    ]));

    root.appendChild(systemCheckCard(ctx));

    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Keyboard shortcuts' }),
      el('dl', { class: 'kv', style: 'margin-top:12px' }, [
        el('dt', {}, el('kbd', { text: '/' })), el('dd', { text: 'Focus the global search box' }),
        el('dt', {}, el('kbd', { text: 'g' })), el('dd', { text: 'then d/e/p/c/a/j/b/s — jump to Dashboard, Explorer, Planner, Calendar, Analytics, Journal, Backup, Settings' }),
        el('dt', {}, el('kbd', { text: 'n' })), el('dd', { text: 'Open the next recommended project' }),
        el('dt', {}, el('kbd', { text: 'Esc' })), el('dd', { text: 'Close dialogs and the mobile menu' })
      ])
    ]));

    return root;
  };

  /* ============================================================ HELP ==== */

  Views.help = function (ctx) {
    const st = Progress.computeStats();
    const root = el('div', { class: 'stack' });

    root.appendChild(el('div', { class: 'card' }, [
      el('h1', { text: 'Getting started' }),
      el('p', { class: 'muted', text: 'This tracker turns "learn Laravel" into ' + st.totalItems.toLocaleString() +
        ' concrete, individually trackable units of work across ' + st.totalCategories + ' categories. Do one per day and you will be dangerous within a year.' }),
      el('ol', {}, [
        el('li', { text: 'Open the Zero to Expert Roadmap. Phase 1, project 1 is your starting point. The Daily Planner "Recommend one" button follows the same order.' }),
        el('li', { text: 'Open the project workspace. Read the plan, the security notes and the common mistakes before writing code.' }),
        el('li', { text: 'Build it in a real Laravel app on your machine. Paste the repo URL and local path into the workspace so you can find it again in six months.' }),
        el('li', { text: 'Tick each required checklist item as you genuinely finish it. Progress is calculated from those ticks, not from page visits.' }),
        el('li', { text: 'Write what you learned, what broke and how you fixed it. This is the part most people skip and it is the part that compounds.' }),
        el('li', { text: 'Press "Mark as complete" and confirm. Then export a JSON backup every week.' })
      ])
    ]));

    root.appendChild(el('div', { class: 'grid grid-2' }, [
      el('div', { class: 'card' }, [
        el('h2', { text: 'How progress is calculated' }),
        el('ul', { style: 'margin-top:10px' }, [
          el('li', { text: 'Project progress = completed required checklist items ÷ total required checklist items × 100.' }),
          el('li', { text: 'Optional checklist items are tracked separately and never lower your percentage.' }),
          el('li', { text: 'Items with no checklist show 0% until you explicitly mark them complete, then 100%.' }),
          el('li', { text: 'Curriculum progress counts items only. Categories and subcategories are containers, so nothing is double-counted.' }),
          el('li', { text: 'Marking a day complete never marks a project complete, and opening a project never completes it.' }),
          el('li', { text: 'If you override completion without finishing the checklist, the override is recorded in your data.' })
        ])
      ]),
      el('div', { class: 'card' }, [
        el('h2', { text: 'Locked, available, completed' }),
        el('p', { class: 'muted small', style: 'margin-top:10px' }, 'Practice items list their matching lesson as a prerequisite.'),
        el('ul', {}, [
          el('li', {}, [badge('🔒 Locked'), document.createTextNode(' — a prerequisite is unfinished. You can still open and do it; it is advice, not a wall.')]),
          el('li', {}, [badge('Available'), document.createTextNode(' — all prerequisites are complete.')]),
          el('li', {}, [badge('Completed', 'completed'), document.createTextNode(' — explicitly confirmed by you.')])
        ]),
        el('div', { class: 'section-title', text: 'Streaks' }),
        el('p', { class: 'muted small mb-0', text: 'A study day is any day where you started or completed an item, wrote notes, or worked a plan. Calendar days and study days are reported separately so the numbers stay honest.' })
      ])
    ]));

    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Growing the curriculum past 10,000 items' }),
      el('p', { class: 'muted small', text: 'Three supported routes, in increasing order of scale:' }),
      el('ol', {}, [
        el('li', {}, [el('strong', { text: 'Custom Project Creator ' }), document.createTextNode('— add items one at a time through the form.')]),
        el('li', {}, [el('strong', { text: 'Bulk JSON paste ' }), document.createTextNode('— paste an array of objects at the bottom of the Custom Project page. Only "title" is required.')]),
        el('li', {}, [el('strong', { text: 'Edit assets/js/curriculum.js ' }), document.createTextNode('— add topics to the BLUEPRINT array. Each topic automatically expands into 2–4 items (lesson, exercise, mini project, debug challenge, capstone) via the reusable TEMPLATES. Adding ~2,500 topic strings yields 10,000+ unique items with stable IDs, and existing progress is preserved because IDs are derived from category/subcategory/topic slug, not array position.')])
      ]),
      el('div', { class: 'callout info' }, [
        el('strong', { text: 'Why not ship 10,000 rows? ' }),
        document.createTextNode('Padding the file with repetitive placeholders would make the tracker useless. The architecture scales (search is indexed, lists are paginated, nothing renders more than one page at a time) — the content grows with you.')
      ])
    ]));

    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Honest limitations' }),
      el('ul', { style: 'margin-top:10px' }, [
        el('li', { text: 'localStorage is per-browser and per-origin. It is not cloud sync and not a backup.' }),
        el('li', { text: 'Clearing site data, using incognito, or switching devices gives you an empty tracker. Export JSON regularly.' }),
        el('li', { text: 'There is no authentication. Anyone using this browser profile can read your notes.' }),
        el('li', { text: 'Estimated durations are informed guesses, not measurements.' })
      ]),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Go to the dashboard', onclick: () => ctx.go('dashboard') })
    ]));

    return root;
  };
})(window);
