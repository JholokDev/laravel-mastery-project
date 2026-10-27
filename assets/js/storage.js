/* ============================================================================
 * storage.js — Centralised, versioned localStorage service
 * ----------------------------------------------------------------------------
 * Every read/write of persistent state goes through this module. Nothing else
 * in the app touches window.localStorage directly.
 *
 * Keys are namespaced + versioned:  lmx.v1.state
 * A schema version lives inside the payload so migrations can run on load.
 *
 * Safety rules implemented here:
 *  - Corrupt / unparsable JSON never crashes the app (falls back to defaults).
 *  - Unknown shapes are normalised against the default state.
 *  - Writes are debounced (150ms) and coalesced.
 *  - QuotaExceededError surfaces a recoverable event instead of throwing.
 *  - No credentials or secrets are ever stored (only local paths + repo URLs).
 * ========================================================================== */

(function (global) {
  'use strict';

  const NS = 'lmx';
  const STORE_VERSION = 1;              // bump when the *key* changes
  const SCHEMA_VERSION = 3;             // bump when the *payload shape* changes
  const KEY = NS + '.v' + STORE_VERSION + '.state';
  const LEGACY_KEYS = [NS + '.state', 'laravel-tracker-state'];

  /* ---------------------------------------------------------------------- */
  /* Default state                                                           */
  /* ---------------------------------------------------------------------- */

  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      /* itemId -> progress record */
      progress: {},
      /*  {
            status: 'not-started' | 'in-progress' | 'completed',
            checklist: { [checklistItemId]: true },
            notes, learned, problems, solutions,
            repoUrl, localPath,
            startedAt, completedAt, updatedAt,
            overrideComplete: bool
          } */

      /* Custom user-authored curriculum items (same shape as built-ins) */
      customItems: [],

      /* 'YYYY-MM-DD' -> day plan */
      days: {},
      /*  {
            primaryItemId, extraItemIds: [], goal, plannedMinutes,
            status: 'planned'|'in-progress'|'paused'|'completed'|'skipped',
            notes, tasks: [{id,text,done}], rescheduledTo, updatedAt
          } */

      /* Free-form journal entries */
      journal: [],  // {id, date, title, body, tags:[], itemId}

      /* Append-only-ish activity log (capped) */
      activity: [], // {id, ts, type, itemId, text}

      preferences: {
        theme: 'dark',
        pageSize: 20,
        lastView: 'dashboard',
        lastItemId: null,
        sidebarCollapsed: false,
        dailyTargetMinutes: 60,
        countOptionalInProgress: false,
        filters: {
          q: '', category: '', subcategory: '', level: '', status: '', type: '',
          duration: '', prereq: '', incompleteChecklist: false, sort: 'default'
        }
      },

      backup: {
        lastExportAt: null,
        lastImportAt: null,
        exportCount: 0,
        remindAfterDays: 7
      }
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Migrations                                                              */
  /* ---------------------------------------------------------------------- */

  const MIGRATIONS = {
    // v1 -> v2 : journal + activity introduced
    1(s) {
      if (!Array.isArray(s.journal)) s.journal = [];
      if (!Array.isArray(s.activity)) s.activity = [];
      s.schemaVersion = 2;
      return s;
    },
    // v2 -> v3 : preferences.filters expanded, backup metadata added
    2(s) {
      const d = defaultState();
      s.preferences = Object.assign({}, d.preferences, s.preferences || {});
      s.preferences.filters = Object.assign({}, d.preferences.filters, (s.preferences && s.preferences.filters) || {});
      s.backup = Object.assign({}, d.backup, s.backup || {});
      s.schemaVersion = 3;
      return s;
    }
  };

  function migrate(state) {
    let s = state;
    let guard = 0;
    while (typeof s.schemaVersion === 'number' && s.schemaVersion < SCHEMA_VERSION && guard++ < 20) {
      const fn = MIGRATIONS[s.schemaVersion];
      if (!fn) { s.schemaVersion = SCHEMA_VERSION; break; }
      s = fn(s);
    }
    return s;
  }

  /* ---------------------------------------------------------------------- */
  /* Normalisation / validation                                              */
  /* ---------------------------------------------------------------------- */

  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function normalise(raw) {
    const d = defaultState();
    if (!isPlainObject(raw)) return d;

    const s = {
      schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : d.createdAt,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : d.updatedAt,
      progress: isPlainObject(raw.progress) ? raw.progress : {},
      customItems: Array.isArray(raw.customItems) ? raw.customItems.filter(isPlainObject) : [],
      days: isPlainObject(raw.days) ? raw.days : {},
      journal: Array.isArray(raw.journal) ? raw.journal.filter(isPlainObject) : [],
      activity: Array.isArray(raw.activity) ? raw.activity.filter(isPlainObject) : [],
      preferences: Object.assign({}, d.preferences, isPlainObject(raw.preferences) ? raw.preferences : {}),
      backup: Object.assign({}, d.backup, isPlainObject(raw.backup) ? raw.backup : {})
    };
    s.preferences.filters = Object.assign({}, d.preferences.filters,
      isPlainObject(raw.preferences && raw.preferences.filters) ? raw.preferences.filters : {});

    // Sanitise progress records
    const clean = {};
    Object.keys(s.progress).forEach((id) => {
      const p = s.progress[id];
      if (!isPlainObject(p)) return;
      clean[id] = {
        status: ['not-started', 'in-progress', 'completed'].includes(p.status) ? p.status : 'not-started',
        checklist: isPlainObject(p.checklist) ? p.checklist : {},
        notes: typeof p.notes === 'string' ? p.notes : '',
        learned: typeof p.learned === 'string' ? p.learned : '',
        problems: typeof p.problems === 'string' ? p.problems : '',
        solutions: typeof p.solutions === 'string' ? p.solutions : '',
        repoUrl: typeof p.repoUrl === 'string' ? p.repoUrl : '',
        localPath: typeof p.localPath === 'string' ? p.localPath : '',
        startedAt: typeof p.startedAt === 'string' ? p.startedAt : null,
        completedAt: typeof p.completedAt === 'string' ? p.completedAt : null,
        updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : null,
        overrideComplete: p.overrideComplete === true,
        minutesSpent: Number(p.minutesSpent) || 0
      };
    });
    s.progress = clean;

    if (s.activity.length > 500) s.activity = s.activity.slice(0, 500);
    return migrate(s);
  }

  /* ---------------------------------------------------------------------- */
  /* Service                                                                 */
  /* ---------------------------------------------------------------------- */

  const listeners = new Set();
  let state = null;
  let writeTimer = null;
  let quotaWarned = false;

  function readRaw() {
    let text = null;
    try { text = global.localStorage.getItem(KEY); } catch (e) { return null; }
    if (text == null) {
      // Attempt legacy pickup (one-time, non-destructive)
      for (const k of LEGACY_KEYS) {
        try {
          const legacy = global.localStorage.getItem(k);
          if (legacy) { text = legacy; break; }
        } catch (e) { /* ignore */ }
      }
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      // Corrupted JSON — preserve it for manual recovery, then start fresh.
      try { global.localStorage.setItem(KEY + '.corrupt.' + Date.now(), text.slice(0, 200000)); } catch (_) {}
      console.warn('[storage] Corrupted state detected; a backup copy was kept and defaults loaded.');
      return null;
    }
  }

  function load() {
    const raw = readRaw();
    state = normalise(raw);
    return state;
  }

  function emit(reason) {
    listeners.forEach((fn) => {
      try { fn(state, reason); } catch (e) { console.error('[storage] listener error', e); }
    });
  }

  function persistNow() {
    if (!state) return;
    state.updatedAt = new Date().toISOString();
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
      quotaWarned = false;
    } catch (e) {
      const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
      if (isQuota && !quotaWarned) {
        quotaWarned = true;
        global.dispatchEvent(new CustomEvent('lmx:quota-exceeded', { detail: { error: String(e) } }));
      } else if (!isQuota) {
        console.error('[storage] write failed', e);
      }
    }
  }

  function scheduleWrite() {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => { writeTimer = null; persistNow(); }, 150);
  }

  const Storage = {
    KEY,
    SCHEMA_VERSION,

    init() {
      if (!state) load();
      return state;
    },

    get() {
      if (!state) load();
      return state;
    },

    /** Mutate state through a function; persists (debounced) and notifies. */
    update(mutator, reason) {
      if (!state) load();
      try {
        mutator(state);
      } catch (e) {
        console.error('[storage] mutation failed', e);
        return state;
      }
      scheduleWrite();
      emit(reason || 'update');
      return state;
    },

    /** Mutate without notifying subscribers (for high-frequency typing). */
    updateQuiet(mutator) {
      if (!state) load();
      try { mutator(state); } catch (e) { console.error(e); }
      scheduleWrite();
      return state;
    },

    flush() {
      if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
      persistNow();
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    notify(reason) { emit(reason || 'manual'); },

    /* ---- progress helpers ------------------------------------------------ */

    progressFor(itemId) {
      const s = this.get();
      return s.progress[itemId] || null;
    },

    ensureProgress(itemId) {
      const s = this.get();
      if (!s.progress[itemId]) {
        s.progress[itemId] = {
          status: 'not-started', checklist: {}, notes: '', learned: '',
          problems: '', solutions: '', repoUrl: '', localPath: '',
          startedAt: null, completedAt: null, updatedAt: new Date().toISOString(),
          overrideComplete: false, minutesSpent: 0
        };
      }
      return s.progress[itemId];
    },

    logActivity(type, text, itemId) {
      const s = this.get();
      s.activity.unshift({
        id: 'act.' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        ts: new Date().toISOString(), type, text: String(text), itemId: itemId || null
      });
      if (s.activity.length > 300) s.activity.length = 300;
    },

    /* ---- wholesale replace (import) -------------------------------------- */

    replaceAll(nextState) {
      state = normalise(nextState);
      state.updatedAt = new Date().toISOString();
      this.flush();
      emit('replace');
      return state;
    },

    reset() {
      state = defaultState();
      this.flush();
      emit('reset');
      return state;
    },

    clearProgressOnly() {
      const s = this.get();
      s.progress = {};
      s.days = {};
      s.activity = [];
      this.flush();
      emit('reset-progress');
    },

    /** Approximate bytes used by this app's key. */
    usage() {
      let bytes = 0;
      try { bytes = (global.localStorage.getItem(KEY) || '').length * 2; } catch (e) {}
      return { bytes, kb: Math.round(bytes / 1024), approxLimitKb: 5120 };
    },

    defaultState,
    normalise
  };

  global.Storage = Storage;

  // Make sure in-flight debounced writes are not lost on unload.
  global.addEventListener('beforeunload', () => Storage.flush());
})(window);
