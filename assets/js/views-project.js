/* ============================================================================
 * views-project.js — Project Detail workspace + Custom Project Creator
 * ========================================================================== */

(function (global) {
  'use strict';

  const { el, frag, bar, badge, emptyState, bulletList, section, field, select,
          minutes, titleCase, statusLabel, toast, confirmDialog, modal, autoTextarea, timeAgo } = global.UI;
  const Curriculum = global.Curriculum;
  const Progress = global.Progress;
  const Storage = global.Storage;

  const Views = global.Views || (global.Views = {});

  /* ================================================== PROJECT DETAIL ==== */

  Views.project = function (ctx, params) {
    const item = Progress.getItem(params.id);
    if (!item) {
      return emptyState('🧭', 'Project not found',
        'No curriculum item with ID "' + params.id + '". It may have come from a backup that used a different curriculum.',
        el('button', { class: 'btn', type: 'button', text: 'Open curriculum explorer', onclick: () => ctx.go('explorer') }));
    }

    Storage.update((s) => { s.preferences.lastItemId = item.id; }, 'silent-last');

    const ip = Progress.itemProgress(item);
    // Read-only snapshot: opening a project must NEVER create a progress record
    // or imply any progress. Records are only created when you actually act.
    const rec = Storage.progressFor(item.id) || {
      status: 'not-started', checklist: {}, notes: '', learned: '', problems: '',
      solutions: '', repoUrl: '', localPath: '', startedAt: null, completedAt: null,
      overrideComplete: false
    };
    const lock = Progress.lockState(item);
    const cat = Curriculum.categoriesById.get(item.categoryId);
    const sub = Curriculum.subcategoriesById.get(item.subcategoryId);
    const type = Curriculum.TYPES[item.type] || { label: item.type, icon: '•' };

    const root = el('div', { class: 'stack' });

    /* ---------- header ---------- */
    const pctText = el('span', { class: 'pct faint small', text: ip.percent + '%' });
    const pctBar = bar(ip.percent, ip.percent === 100 ? 'ok' : '');
    const checkSummary = el('span', { class: 'muted small', text: summaryText() });

    function summaryText() {
      const cur = Progress.itemProgress(item);
      return cur.totalRequired
        ? cur.doneRequired + ' of ' + cur.totalRequired + ' required steps complete' +
          (cur.totalOptional ? ' · ' + cur.doneOptional + '/' + cur.totalOptional + ' optional' : '')
        : 'This item has no checklist — mark it complete when you are done.';
    }

    const header = el('div', { class: 'card' }, [
      el('div', { class: 'row', style: 'margin-bottom:10px' }, [
        el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '← Back', onclick: () => ctx.back() }),
        el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: cat ? cat.name : '', onclick: () => cat && ctx.go('category', { id: cat.id }) })
      ]),
      el('h1', { text: item.title }),
      el('div', { class: 'tag-row', style: 'margin:10px 0 14px' }, [
        badge(type.icon + ' ' + type.label),
        badge(titleCase(item.level), item.level),
        badge('⏱ ' + minutes(item.estMinutes)),
        badge(sub ? sub.name : ''),
        badge(statusLabel(ip.status), ip.status !== 'not-started' ? ip.status : ''),
        lock.state === 'locked' ? badge('🔒 Prerequisites incomplete', 'locked') : null,
        !item.builtIn ? badge('Custom') : null
      ]),
      pctBar,
      el('div', { class: 'row', style: 'margin-top:8px;justify-content:space-between' }, [checkSummary, pctText]),
      el('p', { class: 'muted', style: 'margin-top:14px;margin-bottom:0', text: item.description })
    ]);
    root.appendChild(header);

    /* ---------- locked notice ---------- */
    if (lock.state === 'locked') {
      const ul = el('ul', { style: 'margin:8px 0 0' });
      lock.missing.forEach((id) => {
        const m = Progress.getItem(id);
        ul.appendChild(el('li', {}, [
          el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: m ? m.title : id, onclick: () => ctx.go('project', { id }) })
        ]));
      });
      root.appendChild(el('div', { class: 'callout warn' }, [
        el('strong', { text: 'Prerequisites not yet complete. ' }),
        document.createTextNode('You can still work on this item, but finishing these first will make it much easier:'),
        ul
      ]));
    }

    /* ---------- action bar ---------- */
    const actions = el('div', { class: 'card' });
    const actionRow = el('div', { class: 'row' });

    const completeBtn = el('button', { class: 'btn btn-primary', type: 'button', text: '✔ Mark as complete' });
    completeBtn.addEventListener('click', () => {
      const cur = Progress.itemProgress(item);
      if (cur.status === 'completed') { toast('Already marked complete.', 'warn'); return; }
      if (!cur.canComplete) {
        const remaining = cur.totalRequired - cur.doneRequired;
        confirmDialog('Required steps are incomplete',
          el('div', {}, [
            el('p', { text: remaining + ' required checklist item(s) are still unticked, and the completion criteria below have not been confirmed.' }),
            el('p', { class: 'muted small', text: 'You can override this if you genuinely finished the work outside this tracker. The override is recorded so your statistics stay honest.' })
          ]),
          'Override and mark complete',
          () => { Progress.setStatus(item.id, 'completed', { override: true }); toast('Marked complete (override recorded).'); ctx.refresh(); },
          'danger');
        return;
      }
      confirmDialog('Confirm completion',
        el('div', {}, [
          el('p', { text: 'Confirm that you have finished: ' + item.title }),
          el('p', { class: 'muted small', text: 'All required checklist items are ticked. This will be counted in your curriculum progress and streak.' })
        ]),
        'Yes, I completed it',
        () => { Progress.setStatus(item.id, 'completed'); toast('Completed: ' + item.title); ctx.refresh(); });
    });

    const reopenBtn = el('button', { class: 'btn', type: 'button', text: '↺ Reopen project' });
    reopenBtn.addEventListener('click', () => {
      Progress.setStatus(item.id, 'in-progress');
      toast('Project reopened.');
      ctx.refresh();
    });

    const startBtn = el('button', { class: 'btn', type: 'button', text: '▶ Start working' });
    startBtn.addEventListener('click', () => {
      Progress.setStatus(item.id, 'in-progress');
      toast('Marked as in progress.');
      ctx.refresh();
    });

    const nextBtn = el('button', { class: 'btn', type: 'button', text: 'Next project →' });
    nextBtn.addEventListener('click', () => {
      const n = Progress.nextAfter(item.id);
      if (n) ctx.go('project', { id: n.id });
      else toast('No further items available.', 'warn');
    });

    const planBtn = el('button', { class: 'btn btn-sm', type: 'button', text: "📅 Set as today's project" });
    planBtn.addEventListener('click', () => {
      const key = Progress.todayKey();
      Storage.update(() => {
        const d = Progress.ensureDay(key);
        d.primaryItemId = item.id;
        if (d.status === 'planned') d.status = 'in-progress';
        d.updatedAt = new Date().toISOString();
        Storage.logActivity('plan', "Set as today's primary project: " + item.title, item.id);
      }, 'plan');
      toast("Added to today's plan.");
    });

    if (ip.status === 'completed') actionRow.appendChild(reopenBtn);
    else actionRow.appendChild(completeBtn);
    if (ip.status === 'not-started') actionRow.appendChild(startBtn);
    actionRow.appendChild(planBtn);
    actionRow.appendChild(el('div', { style: 'flex:1' }));
    actionRow.appendChild(nextBtn);
    if (!item.builtIn) {
      actionRow.appendChild(el('button', { class: 'btn btn-sm', type: 'button', text: '✎ Edit', onclick: () => ctx.go('create', { edit: item.id }) }));
    }
    actions.appendChild(actionRow);
    if (rec.completedAt) {
      actions.appendChild(el('p', { class: 'faint small', style: 'margin:10px 0 0',
        text: 'Completed ' + timeAgo(rec.completedAt) + (rec.overrideComplete ? ' (manually overridden)' : '') }));
    }
    root.appendChild(actions);

    /* ---------- tabs ---------- */
    const tabDefs = [
      ['plan', 'Plan & Checklist'],
      ['context', 'Why & When'],
      ['quality', 'Tests & Edge Cases'],
      ['levels', 'Beginner → Production'],
      ['notes', 'My Notes & Journal']
    ];
    const panelHost = el('div');
    const tabs = el('div', { class: 'tabs', role: 'tablist' });
    let active = 'plan';

    tabDefs.forEach(([key, label]) => {
      const t = el('button', { class: 'tab', type: 'button', role: 'tab', text: label, 'aria-selected': String(key === active), dataset: { tab: key } });
      t.addEventListener('click', () => {
        active = key;
        tabs.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === key)));
        renderPanel();
      });
      tabs.appendChild(t);
    });

    function renderPanel() {
      global.UI.clear(panelHost);
      panelHost.appendChild(PANELS[active]());
    }

    const PANELS = {
      plan() {
        const wrap = el('div', { class: 'grid grid-2' });

        /* left: steps */
        const left = el('div', { class: 'card' }, [
          el('h2', { text: 'Step-by-step implementation plan' }),
          el('ol', { style: 'margin-top:12px' }, (item.steps || []).map((s) => el('li', { text: s }))),
          section('Prerequisites', (item.prerequisites || []).length
            ? el('ul', {}, item.prerequisites.map((id) => {
                const p = Progress.getItem(id);
                return el('li', {}, [
                  el('button', {
                    class: 'btn btn-sm btn-ghost', type: 'button',
                    text: (Progress.isCompleted(id) ? '✓ ' : '○ ') + (p ? p.title : id),
                    onclick: () => p && ctx.go('project', { id })
                  })
                ]);
              }))
            : el('p', { class: 'faint small', text: 'None — you can start this immediately.' })),
          section('Learning objectives', bulletList(item.objectives)),
          section('Completion criteria', bulletList(item.criteria))
        ]);

        /* right: checklist */
        const right = el('div', { class: 'card' });
        right.appendChild(el('div', { class: 'card-head' }, [
          el('h2', { text: 'Checklist' }),
          el('div', { class: 'spacer' }),
          el('button', { class: 'btn btn-sm btn-ghost', type: 'button', text: 'Clear all', onclick: () => {
            confirmDialog('Clear this checklist?', 'All ticked items for this project will be unticked. Your notes are not affected.',
              'Clear checklist', () => {
                Storage.update(() => { Storage.ensureProgress(item.id).checklist = {}; }, 'checklist');
                ctx.refresh();
              }, 'danger');
          } })
        ]));

        if (!(item.checklist || []).length) {
          right.appendChild(el('p', { class: 'faint', text: 'This item has no checklist. Use the Mark as complete button when you are genuinely done.' }));
        } else {
          const ul = el('ul', { class: 'checklist' });
          item.checklist.forEach((c) => {
            const cb = el('input', { type: 'checkbox' });
            cb.checked = !!rec.checklist[c.id];
            const label = el('label', { class: 'check' + (cb.checked ? ' done' : '') }, [
              cb,
              el('span', { class: 'txt', text: c.text }),
              c.required === false ? el('span', { class: 'opt', text: 'optional' }) : null
            ]);
            cb.addEventListener('change', () => {
              Progress.toggleChecklist(item.id, c.id, cb.checked);
              label.classList.toggle('done', cb.checked);
              const cur = Progress.itemProgress(item);
              pctBar.querySelector('span').style.width = cur.percent + '%';
              pctBar.setAttribute('aria-valuenow', String(cur.percent));
              pctText.textContent = cur.percent + '%';
              checkSummary.textContent = summaryText();
              ctx.refreshChrome();
            });
            ul.appendChild(el('li', {}, label));
          });
          right.appendChild(ul);
        }

        right.appendChild(el('div', { class: 'section-title', text: 'Advanced challenges (optional)' }));
        right.appendChild(bulletList(item.challenges));

        wrap.appendChild(left);
        wrap.appendChild(right);
        return wrap;
      },

      context() {
        return el('div', { class: 'grid grid-2' }, [
          el('div', { class: 'card' }, [
            el('h2', { text: 'Why this matters' }),
            el('p', { class: 'muted', style: 'margin-top:10px', text: item.description }),
            section('Real-world use cases', bulletList(item.useCases)),
            section('When to use it in production', el('p', { class: 'muted', text: item.production || '—' }))
          ]),
          el('div', { class: 'card' }, [
            el('h2', { text: 'Common mistakes' }),
            bulletList(item.mistakes),
            section('Security considerations', bulletList(item.security)),
            section('Performance considerations', bulletList(item.performance))
          ])
        ]);
      },

      quality() {
        return el('div', { class: 'grid grid-2' }, [
          el('div', { class: 'card' }, [
            el('h2', { text: 'Required test cases' }),
            bulletList(item.tests),
            section('Completion criteria', bulletList(item.criteria))
          ]),
          el('div', { class: 'card' }, [
            el('h2', { text: 'Edge cases to handle' }),
            bulletList(item.edgeCases),
            section('Advanced challenges', bulletList(item.challenges))
          ])
        ]);
      },

      levels() {
        return el('div', { class: 'stack' }, [
          el('div', { class: 'card' }, [el('h2', { text: '1. Beginner implementation' }), el('p', { class: 'muted', style: 'margin-top:10px;margin-bottom:0', text: item.beginner || '—' })]),
          el('div', { class: 'card' }, [el('h2', { text: '2. Advanced implementation' }), el('p', { class: 'muted', style: 'margin-top:10px;margin-bottom:0', text: item.advanced || '—' })]),
          el('div', { class: 'card' }, [el('h2', { text: '3. Production best practices' }), el('p', { class: 'muted', style: 'margin-top:10px;margin-bottom:0', text: item.production || '—' })])
        ]);
      },

      notes() {
        const mk = (labelText, fieldName, placeholder, rows) =>
          field(labelText, autoTextarea(rec[fieldName], placeholder, (v) => {
            Progress.saveField(item.id, fieldName, v);
            saveHint.textContent = 'Saved ' + new Date().toLocaleTimeString();
          }, rows));

        const saveHint = el('span', { class: 'faint small', text: 'Notes autosave as you type.' });

        const repo = el('input', { type: 'url', placeholder: 'https://github.com/you/project', value: rec.repoUrl || '' });
        repo.addEventListener('input', global.UI.debounce(() => Progress.saveField(item.id, 'repoUrl', repo.value), 400));
        const path = el('input', { type: 'text', placeholder: '~/code/laravel/my-project', value: rec.localPath || '' });
        path.addEventListener('input', global.UI.debounce(() => Progress.saveField(item.id, 'localPath', path.value), 400));

        const journalBtn = el('button', { class: 'btn btn-sm', type: 'button', text: '＋ Add journal entry for this project', onclick: () => {
          const title = el('input', { type: 'text', value: 'Session notes — ' + item.title });
          const body = el('textarea', { rows: '6', placeholder: 'What did you build today? What broke? What did you learn?' });
          modal({
            title: 'New journal entry',
            body: [field('Title', title), field('Entry', body)],
            actions: [
              { label: 'Cancel' },
              { label: 'Save entry', variant: 'primary', onClick: () => {
                if (!body.value.trim()) { toast('Entry body is empty.', 'warn'); return true; }
                Storage.update((s) => {
                  s.journal.unshift({
                    id: 'jr.' + Date.now().toString(36), date: Progress.todayKey(),
                    title: title.value.trim() || 'Untitled', body: body.value, tags: [], itemId: item.id
                  });
                  Storage.logActivity('journal', 'Journal entry: ' + (title.value.trim() || 'Untitled'), item.id);
                }, 'journal');
                toast('Journal entry saved.');
              } }
            ]
          });
        } });

        return el('div', { class: 'grid grid-2' }, [
          el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [el('h2', { text: 'Personal notes' }), el('div', { class: 'spacer' }), saveHint]),
            mk('Personal notes', 'notes', 'Anything worth remembering about this topic…', 5),
            mk('What I learned', 'learned', 'Key insights, in your own words…', 4)
          ]),
          el('div', { class: 'card' }, [
            el('h2', { text: 'Problems & solutions' }),
            el('div', { style: 'height:12px' }),
            mk('Problems encountered', 'problems', 'Errors, blockers, confusing behaviour…', 4),
            mk('Solutions discovered', 'solutions', 'How you solved them, with links…', 4),
            el('div', { class: 'section-title', text: 'Project links' }),
            field('GitHub repository URL', repo),
            field('Local project path', path),
            el('div', { style: 'height:12px' }),
            journalBtn,
            el('p', { class: 'faint small', style: 'margin-top:12px;margin-bottom:0',
              text: 'Nothing here is sent anywhere. Everything is stored in this browser\'s localStorage only — never store passwords, API keys or OAuth secrets.' })
          ])
        ]);
      }
    };

    root.appendChild(tabs);
    root.appendChild(panelHost);
    renderPanel();

    return root;
  };

  /* ============================================ CUSTOM PROJECT CREATOR == */

  Views.create = function (ctx, params) {
    const s = Storage.get();
    const editing = params && params.edit ? s.customItems.find((i) => i.id === params.edit) : null;
    const root = el('div', { class: 'stack' });

    const f = {
      title: el('input', { type: 'text', placeholder: 'e.g. Build a multi-tenant invoice module', value: editing ? editing.title : '' }),
      category: select(Curriculum.categories.map((c) => ({ value: c.id, label: c.name })), editing ? editing.categoryId : 'cat.capstone'),
      subcategory: select([], ''),
      type: select(Object.keys(Curriculum.TYPES).map((t) => ({ value: t, label: Curriculum.TYPES[t].label })), editing ? editing.type : 'mini'),
      level: select(Curriculum.LEVELS.map((l) => ({ value: l, label: titleCase(l) })), editing ? editing.level : 'intermediate'),
      est: el('input', { type: 'number', min: '5', step: '5', value: editing ? String(editing.estMinutes) : '120' }),
      description: el('textarea', { rows: '4', placeholder: 'What is this project and why are you building it?' }),
      objectives: el('textarea', { rows: '4', placeholder: 'One objective per line' }),
      useCases: el('textarea', { rows: '3', placeholder: 'One real-world use case per line' }),
      steps: el('textarea', { rows: '5', placeholder: 'One implementation step per line' }),
      checklist: el('textarea', { rows: '6', placeholder: 'One checklist item per line (all are required)' }),
      tests: el('textarea', { rows: '3', placeholder: 'One test case per line' }),
      criteria: el('textarea', { rows: '3', placeholder: 'One completion criterion per line' }),
      mistakes: el('textarea', { rows: '3', placeholder: 'One common mistake per line' }),
      security: el('textarea', { rows: '3', placeholder: 'One security consideration per line' }),
      performance: el('textarea', { rows: '3', placeholder: 'One performance consideration per line' })
    };

    if (editing) {
      f.description.value = editing.description || '';
      ['objectives', 'useCases', 'steps', 'tests', 'criteria', 'mistakes', 'security', 'performance'].forEach((k) => {
        f[k].value = (editing[k] || []).join('\n');
      });
      f.checklist.value = (editing.checklist || []).map((c) => c.text).join('\n');
    }

    function syncSubs() {
      const cat = Curriculum.categoriesById.get(f.category.value);
      global.UI.clear(f.subcategory);
      (cat ? cat.subcategories : []).forEach((sb) => {
        const o = el('option', { value: sb.id, text: sb.name });
        if (editing && editing.subcategoryId === sb.id) o.selected = true;
        f.subcategory.appendChild(o);
      });
    }
    f.category.addEventListener('change', syncSubs);
    syncSubs();

    const form = el('form', { class: 'card' }, [
      el('div', { class: 'card-head' }, [
        el('h2', { text: editing ? 'Edit custom project' : 'Create a custom project' }),
        el('div', { class: 'spacer' }),
        el('span', { class: 'faint small', text: s.customItems.length + ' custom item(s)' })
      ]),
      el('p', { class: 'muted small', text: 'Custom items behave exactly like built-in curriculum items: they are searchable, filterable, countable in progress, and included in exports.' }),
      el('div', { class: 'toolbar' }, [
        field('Title *', f.title),
        field('Category', f.category),
        field('Subcategory', f.subcategory),
        field('Type', f.type),
        field('Difficulty', f.level),
        field('Estimated minutes', f.est)
      ]),
      field('Description', f.description),
      el('div', { class: 'grid grid-2' }, [
        el('div', {}, [field('Learning objectives (one per line)', f.objectives), field('Real-world use cases', f.useCases), field('Implementation steps', f.steps), field('Security considerations', f.security)]),
        el('div', {}, [field('Checklist items (one per line)', f.checklist), field('Required test cases', f.tests), field('Completion criteria', f.criteria), field('Performance considerations', f.performance)])
      ]),
      el('div', { class: 'grid grid-2' }, [field('Common mistakes', f.mistakes)]),
      el('div', { class: 'row', style: 'margin-top:8px' }, [
        el('button', { class: 'btn btn-primary', type: 'submit', text: editing ? 'Save changes' : 'Create project' }),
        el('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: () => ctx.go(editing ? 'project' : 'explorer', editing ? { id: editing.id } : {}) }),
        editing ? el('button', { class: 'btn btn-danger', type: 'button', text: 'Delete project', onclick: () => {
          confirmDialog('Delete this custom project?',
            'The project and its saved progress will be permanently removed from this browser. Export a backup first if you are unsure.',
            'Delete permanently', () => {
              Storage.update((state) => {
                state.customItems = state.customItems.filter((i) => i.id !== editing.id);
                delete state.progress[editing.id];
                Storage.logActivity('delete', 'Deleted custom project: ' + editing.title);
              }, 'custom');
              Progress.invalidate(); global.Search.invalidate();
              toast('Custom project deleted.');
              ctx.go('explorer');
            }, 'danger');
        } }) : null
      ])
    ]);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!f.title.value.trim()) { toast('A title is required.', 'error'); f.title.focus(); return; }
      const data = {
        id: editing ? editing.id : undefined,
        title: f.title.value.trim(),
        categoryId: f.category.value,
        subcategoryId: f.subcategory.value,
        type: f.type.value,
        level: f.level.value,
        estMinutes: Number(f.est.value) || 60,
        description: f.description.value.trim(),
        objectives: f.objectives.value, useCases: f.useCases.value, steps: f.steps.value,
        checklist: f.checklist.value, tests: f.tests.value, criteria: f.criteria.value,
        mistakes: f.mistakes.value, security: f.security.value, performance: f.performance.value,
        beginner: 'Start with the simplest working version you can ship.',
        advanced: 'Refactor into services/actions, add tests, measure performance.',
        production: 'Add observability, authorization, indexes and a rollback plan.'
      };
      const built = Curriculum.makeCustomItem(data);
      Storage.update((state) => {
        if (editing) {
          const idx = state.customItems.findIndex((i) => i.id === editing.id);
          built.createdAt = editing.createdAt;
          if (idx >= 0) state.customItems[idx] = built;
          Storage.logActivity('edit', 'Updated custom project: ' + built.title, built.id);
        } else {
          state.customItems.push(built);
          Storage.logActivity('create', 'Created custom project: ' + built.title, built.id);
        }
      }, 'custom');
      Progress.invalidate(); global.Search.invalidate();
      toast(editing ? 'Project updated.' : 'Project created.');
      ctx.go('project', { id: built.id });
    });

    root.appendChild(form);

    /* existing custom items */
    if (s.customItems.length) {
      const listCard = el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('h2', { text: 'Your custom projects' })])]);
      const table = el('table', { class: 'table' }, [
        el('thead', {}, el('tr', {}, [
          el('th', { text: 'Title' }), el('th', { text: 'Type' }), el('th', { text: 'Level' }),
          el('th', { text: 'Status' }), el('th', { text: '' })
        ])),
        el('tbody', {}, s.customItems.slice().reverse().map((ci) => {
          const p = Progress.itemProgress(ci);
          return el('tr', {}, [
            el('td', { text: ci.title }),
            el('td', { text: (Curriculum.TYPES[ci.type] || {}).label || ci.type }),
            el('td', {}, badge(titleCase(ci.level), ci.level)),
            el('td', { text: statusLabel(p.status) + ' · ' + p.percent + '%' }),
            el('td', {}, el('div', { class: 'row tight' }, [
              el('button', { class: 'btn btn-sm', type: 'button', text: 'Open', onclick: () => ctx.go('project', { id: ci.id }) }),
              el('button', { class: 'btn btn-sm', type: 'button', text: 'Edit', onclick: () => ctx.go('create', { edit: ci.id }) })
            ]))
          ]);
        }))
      ]);
      listCard.appendChild(table);
      root.appendChild(listCard);
    }

    /* bulk import of curriculum */
    const ta = el('textarea', { rows: '6', placeholder: '[\n  { "title": "Build a webhook receiver", "level": "advanced", "estMinutes": 180, "checklist": ["Verify signature", "Store raw payload", "Process idempotently"] }\n]' });
    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'Bulk-add curriculum (JSON)' }),
      el('p', { class: 'muted small', text: 'Paste an array of objects to add many items at once. Only "title" is required; every other field falls back to a sensible default. This is how you grow the curriculum towards 10,000+ items.' }),
      field('JSON array', ta),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Add items', onclick: () => {
        let parsed;
        try { parsed = JSON.parse(ta.value); } catch (err) { toast('Invalid JSON: ' + err.message, 'error'); return; }
        if (!Array.isArray(parsed)) { toast('Expected a JSON array.', 'error'); return; }
        const valid = parsed.filter((o) => o && typeof o === 'object' && typeof o.title === 'string' && o.title.trim());
        if (!valid.length) { toast('No valid objects found (each needs a "title").', 'error'); return; }
        confirmDialog('Add ' + valid.length + ' custom item(s)?',
          'They will be appended to your curriculum. Existing progress is untouched.',
          'Add items', () => {
            Storage.update((state) => {
              valid.forEach((o) => state.customItems.push(Curriculum.makeCustomItem(o)));
              Storage.logActivity('create', 'Bulk-added ' + valid.length + ' custom curriculum items');
            }, 'custom');
            Progress.invalidate(); global.Search.invalidate();
            toast('Added ' + valid.length + ' items.');
            ctx.refresh();
          });
      } })
    ]));

    return root;
  };
})(window);
