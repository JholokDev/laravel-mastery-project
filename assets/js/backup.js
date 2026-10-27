/* ============================================================================
 * backup.js — Export / import / validate / merge / CSV report
 * ----------------------------------------------------------------------------
 * Never silently overwrites: import always produces a PREVIEW that the caller
 * must explicitly apply (replace or merge).
 * ========================================================================== */

(function (global) {
  'use strict';

  const Storage = global.Storage;
  const Progress = global.Progress;
  const Curriculum = global.Curriculum;

  const EXPORT_FORMAT = 'laravel-mastery-tracker';
  const EXPORT_VERSION = 1;

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: (mime || 'application/json') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildExport() {
    const s = Storage.get();
    return {
      format: EXPORT_FORMAT,
      exportVersion: EXPORT_VERSION,
      schemaVersion: s.schemaVersion,
      exportedAt: new Date().toISOString(),
      appUrl: location.href.split('#')[0],
      counts: {
        progress: Object.keys(s.progress).length,
        customItems: s.customItems.length,
        days: Object.keys(s.days).length,
        journal: s.journal.length
      },
      state: {
        schemaVersion: s.schemaVersion,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        progress: s.progress,
        customItems: s.customItems,
        days: s.days,
        journal: s.journal,
        activity: s.activity.slice(0, 200),
        preferences: s.preferences,
        backup: s.backup
      }
    };
  }

  function exportJSON() {
    const payload = buildExport();
    download('laravel-mastery-backup-' + stamp() + '.json', JSON.stringify(payload, null, 2));
    Storage.update((s) => {
      s.backup.lastExportAt = new Date().toISOString();
      s.backup.exportCount = (s.backup.exportCount || 0) + 1;
      Storage.logActivity('export', 'Exported a full JSON backup');
    }, 'backup');
    return payload;
  }

  function csvEscape(v) {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCSV() {
    const items = Progress.allItems();
    const rows = [[
      'Item ID', 'Title', 'Category', 'Subcategory', 'Type', 'Level',
      'Estimated Minutes', 'Status', 'Progress %', 'Required Done', 'Required Total',
      'Started At', 'Completed At', 'Repo URL', 'Local Path', 'Notes'
    ]];
    items.forEach((i) => {
      const ip = Progress.itemProgress(i);
      const p = ip.record || {};
      const cat = Curriculum.categoriesById.get(i.categoryId);
      const sub = Curriculum.subcategoriesById.get(i.subcategoryId);
      rows.push([
        i.id, i.title, cat ? cat.name : i.categoryId, sub ? sub.name : i.subcategoryId,
        (Curriculum.TYPES[i.type] || {}).label || i.type, i.level, i.estMinutes,
        ip.status, ip.percent, ip.doneRequired, ip.totalRequired,
        p.startedAt || '', p.completedAt || '', p.repoUrl || '', p.localPath || '',
        (p.notes || '').replace(/\s+/g, ' ').slice(0, 500)
      ]);
    });
    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
    download('laravel-mastery-report-' + stamp() + '.csv', csv, 'text/csv');
    Storage.update((s) => {
      s.backup.lastExportAt = new Date().toISOString();
      s.backup.exportCount = (s.backup.exportCount || 0) + 1;
      Storage.logActivity('export', 'Exported a CSV progress report');
    }, 'backup');
  }

  /* ---------------------------------------------------------------------- */
  /* Validation                                                              */
  /* ---------------------------------------------------------------------- */

  function validate(raw) {
    const errors = [];
    const warnings = [];

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return { ok: false, errors: ['File does not contain a JSON object.'], warnings, state: null };
    }

    // Accept both the wrapped export and a bare state object.
    let state = null;
    if (raw.format === EXPORT_FORMAT && raw.state) {
      state = raw.state;
      if (typeof raw.exportVersion === 'number' && raw.exportVersion > EXPORT_VERSION) {
        warnings.push('Backup was created by a newer app version (export v' + raw.exportVersion + '). Some fields may be ignored.');
      }
    } else if (raw.progress || raw.customItems || raw.days) {
      state = raw;
      warnings.push('File is a bare state object without the expected wrapper. Importing in compatibility mode.');
    } else {
      errors.push('Unrecognised file. Expected a "' + EXPORT_FORMAT + '" backup.');
      return { ok: false, errors, warnings, state: null };
    }

    if (state.progress && (typeof state.progress !== 'object' || Array.isArray(state.progress))) {
      errors.push('"progress" must be an object keyed by item ID.');
    }
    if (state.customItems && !Array.isArray(state.customItems)) errors.push('"customItems" must be an array.');
    if (state.days && (typeof state.days !== 'object' || Array.isArray(state.days))) errors.push('"days" must be an object keyed by date.');
    if (state.journal && !Array.isArray(state.journal)) errors.push('"journal" must be an array.');

    if (errors.length) return { ok: false, errors, warnings, state: null };

    const normalised = Storage.normalise(state);

    // Referential sanity: how many progress keys match known items?
    const known = new Set(Progress.allItems().map((i) => i.id));
    normalised.customItems.forEach((ci) => known.add(ci.id));
    const keys = Object.keys(normalised.progress);
    const unknown = keys.filter((k) => !known.has(k));
    if (unknown.length) {
      warnings.push(unknown.length + ' progress record(s) reference items not in this curriculum. They will be kept but hidden until those items exist.');
    }
    if (!keys.length && !normalised.customItems.length && !Object.keys(normalised.days).length) {
      warnings.push('This backup contains no progress, custom items or daily plans.');
    }

    return { ok: true, errors, warnings, state: normalised, meta: raw.exportedAt ? { exportedAt: raw.exportedAt } : {} };
  }

  function summarise(state) {
    const completed = Object.keys(state.progress).filter((k) => state.progress[k].status === 'completed').length;
    const inProgress = Object.keys(state.progress).filter((k) => state.progress[k].status === 'in-progress').length;
    return {
      progressRecords: Object.keys(state.progress).length,
      completed, inProgress,
      customItems: state.customItems.length,
      days: Object.keys(state.days).length,
      journal: state.journal.length,
      theme: state.preferences.theme,
      updatedAt: state.updatedAt
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Apply                                                                   */
  /* ---------------------------------------------------------------------- */

  function applyReplace(state) {
    Storage.replaceAll(state);
    Storage.update((s) => {
      s.backup.lastImportAt = new Date().toISOString();
      Storage.logActivity('import', 'Replaced all data from a backup file');
    }, 'import');
    Progress.invalidate();
    global.Search.invalidate();
  }

  /** Merge: keeps the "more advanced" record per item, unions checklists,
      concatenates non-duplicate notes, keeps existing days unless empty. */
  function applyMerge(incoming) {
    const rank = { 'not-started': 0, 'in-progress': 1, completed: 2 };
    Storage.update((s) => {
      // progress
      Object.keys(incoming.progress).forEach((id) => {
        const inc = incoming.progress[id];
        const cur = s.progress[id];
        if (!cur) { s.progress[id] = inc; return; }
        const merged = Object.assign({}, cur);
        merged.checklist = Object.assign({}, cur.checklist, inc.checklist);
        if (rank[inc.status] > rank[cur.status]) {
          merged.status = inc.status;
          merged.completedAt = inc.completedAt || cur.completedAt;
          merged.overrideComplete = inc.overrideComplete || cur.overrideComplete;
        }
        ['notes', 'learned', 'problems', 'solutions'].forEach((f) => {
          const a = cur[f] || '', b = inc[f] || '';
          if (b && a.indexOf(b) === -1) merged[f] = a ? (a + '\n\n--- merged from backup ---\n' + b) : b;
        });
        merged.repoUrl = cur.repoUrl || inc.repoUrl;
        merged.localPath = cur.localPath || inc.localPath;
        merged.startedAt = [cur.startedAt, inc.startedAt].filter(Boolean).sort()[0] || null;
        merged.updatedAt = new Date().toISOString();
        s.progress[id] = merged;
      });

      // custom items (by id)
      const haveIds = new Set(s.customItems.map((i) => i.id));
      incoming.customItems.forEach((ci) => { if (!haveIds.has(ci.id)) s.customItems.push(ci); });

      // days — keep existing, add missing
      Object.keys(incoming.days).forEach((k) => { if (!s.days[k]) s.days[k] = incoming.days[k]; });

      // journal — dedupe by id
      const haveJ = new Set(s.journal.map((j) => j.id));
      incoming.journal.forEach((j) => { if (j.id && !haveJ.has(j.id)) s.journal.push(j); });

      s.backup.lastImportAt = new Date().toISOString();
      Storage.logActivity('import', 'Merged data from a backup file');
    }, 'import');
    Progress.invalidate();
    global.Search.invalidate();
  }

  function backupReminder() {
    const s = Storage.get();
    const last = s.backup.lastExportAt;
    const days = s.backup.remindAfterDays || 7;
    if (!last) {
      const anyProgress = Object.keys(s.progress).length > 0;
      return anyProgress ? { due: true, message: 'You have unsaved progress and have never exported a backup.' } : { due: false };
    }
    const diff = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
    if (diff >= days) return { due: true, message: 'Your last backup was ' + diff + ' day(s) ago.' };
    return { due: false, daysAgo: diff };
  }

  global.Backup = {
    EXPORT_FORMAT, EXPORT_VERSION,
    exportJSON, exportCSV, buildExport, validate, summarise,
    applyReplace, applyMerge, backupReminder, download
  };
})(window);
