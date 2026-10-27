# Laravel Mastery — Zero to Expert

A local-first, frontend-only **Laravel learning management and progress tracking system**.
It turns "learn Laravel" into thousands of concrete, individually trackable units of work —
topic lessons, exercises, mini projects, debug challenges and capstone projects — across
**70 curriculum categories**, from PHP fundamentals to multi-tenant SaaS and production deployment.

No backend. No database. No build step. No framework. Open `index.html` and start.

---

## 1. Running it

```bash
# Option A — just open the file
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux

# Option B — any static server (recommended, avoids file:// quirks)
python3 -m http.server 8080
# then visit http://localhost:8080
```

Everything is saved to your browser's `localStorage` under the key `lmx.v1.state`.

> **Honest warning:** localStorage is per-browser and per-origin. It is **not** cloud sync,
> **not** a backup, and **not** secure storage. Clearing site data, using a private window,
> or switching devices gives you an empty tracker. **Export a JSON backup weekly.**
> Never type passwords, API keys or OAuth secrets into any notes field.

---

## 2. Project structure

```
index.html                  App shell: sidebar, topbar, view host
README.md                   This file
assets/
  css/
    styles.css              Design tokens, components, dark/light themes, responsive rules
  js/
    curriculum.js           Curriculum CONTENT only (categories, subcategories, topic
                            blueprints, reusable item templates, deterministic builder)
    storage.js              The ONLY module that touches localStorage. Versioned keys,
                            schema version, migrations, debounced writes, quota handling
    progress.js             All progress + statistics maths (item, category, level, daily,
                            weekly, monthly, streaks, prerequisites, recommendations)
    search.js               Full-dataset search, combined filters, sorting, pagination
    backup.js               Export JSON/CSV, validate, preview, merge, replace, reminders
    ui.js                   Safe DOM helpers (textContent only), toasts, modals, components
    views-core.js           Dashboard, All Categories, Category Details, Curriculum Explorer
    views-project.js        Project Detail workspace, Custom Project Creator, bulk JSON add
    views-planner.js        Daily Planner, Calendar, Progress Analytics, Journal
    views-data.js           Backup & Restore, Settings, Help & Getting Started
    app.js                  Hash router, chrome rendering, theme, keyboard shortcuts, boot
```

**Separation of concerns is strict:** curriculum content never contains user progress, and
user progress is stored only as `{ itemId → record }` keyed by **stable string IDs**.
That is why you can grow, reorder or extend the curriculum without losing a single tick.

---

## 2b. The Zero to Expert Roadmap (new)

`assets/js/roadmap.js` contains **85 hand-written projects in 13 phases**, in learning order:

| # | Phase | Level | You build |
|---|---|---|---|
| 1 | Foundations | beginner | dev environment, PHP CLI tools, OOP, Composer, HTTP inspection |
| 2 | Laravel Core | beginner | routes, Blade portfolio, contact form, Student CRUD, task manager, middleware |
| 3 | Database and Eloquent | beginner | schema design, factories, relationships, scopes, Query Builder reports |
| 4 | Real Features | intermediate | search, filters, pagination, soft deletes, galleries, private PDFs, CSV, 10,000-record explorer |
| 5 | Authentication and Security | intermediate | login, verification, reset, throttling, sessions, login history, OTP, TOTP MFA |
| 6 | Social Login and Authorization | intermediate | Google, GitHub, Facebook OAuth, roles, policies, admin dashboard |
| 7 | APIs and Integrations | advanced | REST, Sanctum, versioning, API keys, webhooks, resilient API clients |
| 8 | Background Work | advanced | notifications, queues, events, scheduler, failed jobs, Artisan commands |
| 9 | Performance and Scale | advanced | N+1, EXPLAIN, Redis, 1M-row export, locking, Scout search |
| 10 | Testing and Quality | advanced | feature and Pest tests, security regression suite, Larastan in CI, debugging |
| 11 | Architecture and Design | expert | actions and services, DTOs, patterns, CQRS-lite, a published package |
| 12 | Business Systems | expert | e-commerce, orders, Stripe, SaaS billing, multi-tenant CRM, LMS, real-time chat, CMS |
| 13 | Production and Mastery | expert | Docker, CI/CD, VPS deploy, monitoring and restore drill, threat model, load test, final SaaS capstone |

Each project has objectives, steps, a checklist (with optional items), required tests, common
mistakes, security and performance notes and an advanced challenge. Projects inside a phase
list the previous one as a prerequisite (advice, not a wall). "Recommend one", "Continue" and
the `n` shortcut all follow the roadmap order.

**Add your own roadmap project:** append one row to a phase in `roadmap.js`. IDs come from the
title slug (`itm.road.<slug>`), so existing progress is never disturbed.

---

## 3. The 14 screens (Roadmap added)

| Screen | What it is for |
|---|---|
| **Dashboard** | Every headline statistic, category/level progress, recent activity, Continue Learning and Start Today's Project |
| **All Categories** | Expandable category → subcategory tree with per-node progress |
| **Category Details** | Deep dive into one category, its subcategories and next available items |
| **Curriculum Explorer** | Search + 8 combined filters + 10 sorts + pagination (20/50/100) |
| **Project Details** | The learning workspace: plan, checklist, tests, edge cases, security, beginner→production, notes |
| **Daily Planner** | One primary project per day, extra tasks, goal, timer target, status, notes, reschedule |
| **Calendar** | Month grid of planned/completed/skipped days |
| **Progress Analytics** | Real derived numbers: 14-day completion history, level/type/category breakdown |
| **Notes & Journal** | Dated learning journal plus every note attached to a project |
| **Custom Project Creator** | Add/edit/delete your own curriculum items, or bulk-add via JSON |
| **Backup & Restore** | Export JSON/CSV, validated import with preview, merge or replace, danger zone |
| **Settings** | Theme, page size, daily target, backup reminder interval, storage inspector |
| **Help & Getting Started** | How to use it, how progress is calculated, how to scale the curriculum |

---

## 4. How to actually use it (the daily loop)

1. **Daily Planner → "Recommend one."** It picks the next *unlocked* item at your current level
   (in-progress items first, then lowest difficulty, then curriculum order).
2. **Open the project workspace.** Read the implementation plan, the security notes and the
   common mistakes *before* writing code.
3. **Build it in a real Laravel app** on your machine. Paste the GitHub URL and local path
   into the workspace so six-months-from-now you can find it.
4. **Tick required checklist items** as you genuinely finish them. Each tick saves individually
   and immediately.
5. **Write what you learned, what broke, and how you fixed it.** Autosaved.
6. **Mark as Complete → confirm.** Then export a backup.

---

## 5. Progress rules (no fake numbers)

- **Project progress** = `completed required checklist items ÷ total required checklist items × 100`.
- **Optional checklist items** are tracked and displayed, but excluded from the percentage,
  so extra credit never drags your score down.
- **Items with no checklist** show `0%` until explicitly completed, then `100%`. No ambiguity.
- **Curriculum progress** counts **items only**. Categories and subcategories are containers,
  so there is no double counting of parents and children.
- **Opening a project never completes it.** **Completing a day never completes a project.**
  **A new calendar day never auto-completes anything.**
- You may **override** completion when the checklist is unfinished — but you must confirm, and
  the override is recorded in your data (`overrideComplete: true`) so your stats stay honest.
- **Prerequisites** produce `locked` / `available` / `completed` states. Locked is advice, not
  a wall — you can still open and do any item.
- **Study days vs calendar days** are reported separately. Skipping days pauses your streak;
  it never deletes progress.

---

## 6. Search, filters and pagination

Search runs over a prebuilt lowercase index covering title, description, category,
subcategory, level, type, objectives, use cases, steps and tags — across the **entire**
dataset, never just the visible page. All filters combine:

`keyword` × `category` × `subcategory` × `difficulty` × `type` × `status` × `duration bucket`
× `prerequisite state` × `partially-completed checklist only`

Sorts: curriculum order, title A→Z/Z→A, difficulty ↑↓, duration ↑↓, completion status,
progress %, recently updated. Page sizes: 20 / 50 / 100. Only one page of cards is ever
rendered into the DOM, so the UI stays fast at 10,000+ items. Changing pages or filters
never touches your progress.

**Keyboard:** `/` focus search · `g` then `d e p c a j b s h l` jump between screens ·
`n` open the next recommended project · `Esc` close dialogs.

---

## 7. Backup, restore and data safety

- **Export JSON** — the complete, restorable backup (progress, custom items, plans, journal,
  preferences, activity).
- **Export CSV** — a human-readable per-item progress report for spreadsheets (not importable).
- **Import** — always validated first. Invalid files are rejected with a specific reason and
  **your existing data is left untouched**. Valid files show a side-by-side preview
  (current vs backup) before you choose:
  - **Merge** — keeps your data, unions checklists, appends non-duplicate notes, adds missing
    plans/journal/custom items, keeps the more advanced status per item.
  - **Replace** — requires a second explicit confirmation.
- **Backup reminder** appears on the dashboard and in Backup & Restore after N days (configurable).
- **Quota exceeded** raises a dialog offering immediate export and cleanup, instead of
  silently losing writes.
- **Corrupted JSON** in localStorage is preserved under a `…​.corrupt.<timestamp>` key and the
  app boots with defaults rather than crashing.
- **Schema migrations** run automatically on load (`storage.js → MIGRATIONS`), so bumping
  `SCHEMA_VERSION` upgrades existing users instead of wiping them.

---

## 8. Growing the curriculum to 10,000+ items

The shipped curriculum is **hand-authored and meaningful** — no padding with repetitive
placeholders. Three supported ways to grow it, in increasing order of scale:

### A. One at a time — Custom Project Creator
Fill in the form. Custom items are first-class: searchable, filterable, counted in progress,
included in exports.

### B. Hundreds at a time — bulk JSON paste
At the bottom of the **Custom Project Creator** screen, paste an array. Only `title` is required:

```json
[
  { "title": "Build an idempotent Stripe webhook receiver",
    "categoryId": "cat.webhooks", "subcategoryId": "sub.webhooks.core",
    "type": "mini", "level": "advanced", "estMinutes": 180,
    "objectives": ["Verify signatures", "Process exactly once"],
    "checklist": ["Verify signature", "Store raw payload", "Deduplicate by event ID", "Write a replay test"] },
  { "title": "Profile and fix an N+1 on the orders index" }
]
```

### C. Thousands at a time — edit `assets/js/curriculum.js`
Add topic strings to the `BLUEPRINT` array:

```js
['eloquent', 'Eloquent ORM', 'intermediate', [
  ['models', 'Models', [
    'Mass assignment and guarded attributes',
    'Accessors and mutators',
    'YOUR NEW TOPIC HERE'          // ← add here
  ]],
  ['new-sub', 'Your New Subcategory', ['Topic one', 'Topic two']]   // ← or a whole subcategory
]]
```

Each topic is automatically expanded by `templateMixFor()` into **2–4 unique items**
(lesson / exercise / mini project / debug challenge, plus a capstone for expert categories)
using the reusable `TEMPLATES` object. Each generated item receives full objectives,
use cases, steps, a checklist, tests, criteria, mistakes, challenges, edge cases, security
and performance notes.

**Roughly 2,500–3,500 topic strings produce 10,000+ unique curriculum items.**

IDs are derived deterministically:

```
itm.<categorySlug>.<subcategorySlug>.<topicSlug>.<templateType>
```

Because IDs come from slugs and **not array positions**, you can insert, reorder or remove
topics freely and every existing tick, note and completion stays attached to the right item.
To author a brand-new item *shape*, add a function to `TEMPLATES` and reference it from
`templateMixFor()`.

### Scale characteristics
- Search uses a prebuilt index map (`Map<id, haystack>`), rebuilt only when the dataset size changes.
- The explorer renders **one page** (20–100 cards) at a time — never the full dataset.
- Category/level/type aggregates are computed in a single O(n) pass per render.
- Progress storage is sparse: only items you have actually touched consume space.

---

## 9. Starter curriculum highlights

Student CRUD · Product CRUD with validation · searchable & paginated product list ·
10,000-record explorer · multi-image upload & gallery · PDF upload with private signed
downloads · soft delete / restore / force delete · login & registration · email verification ·
password reset · Google / GitHub / Facebook OAuth · email OTP with expiry · TOTP MFA &
recovery codes · login rate limiting & progressive lockout · session timeout · device/session
revocation · roles, permissions & policies · advanced search filters · CSV & Excel import/export ·
queued image processing · index & query optimisation · Sanctum/Passport API auth · API resources
& versioning · notifications & background jobs · events & listeners · scheduling · Redis caching ·
transactions & deadlock retries · unit/feature/browser testing · security testing (IDOR, mass
assignment, authz bypass) · admin panels · e-commerce catalog, cart & order state machine ·
blog/CMS · CRM/ERP · LMS · SaaS subscriptions & metering · multi-tenancy · real-time with Reverb ·
webhooks · Stripe payments · service/action classes · DTOs & value objects · design patterns ·
package development · custom Artisan commands · APM & tracing · Docker & GitHub Actions ·
production deployment · logging, monitoring & restore drills · system design · scalability ·
threat modeling · static analysis · five full capstone platforms.

---

## 10. Technical rules this project follows

- Semantic HTML, ARIA roles, visible focus rings, skip link, full keyboard navigation.
- **All user-provided text is rendered with `textContent`.** No user HTML is ever inserted.
- No `eval`, no `new Function`, no `innerHTML` for dynamic data, no external dependencies, no CDN.
- All storage access is centralised in `storage.js`; writes are debounced and flushed on unload.
- All imported JSON is validated and normalised before it can touch your state.
- Stable string IDs everywhere; array indices are never used for identity.
- Event delegation for large card grids; bounded rendering for large lists.
- Statistics are recomputed after every relevant state change — nothing is hardcoded.
- Empty states, error states and render failures are handled without losing data.
- No fake charts, no invented statistics, no gradient soup.

---

## 11. Troubleshooting

**A screen says it could not be loaded, or the page is blank**

The app now diagnoses itself. A card lists exactly which file failed to load and the first
JavaScript errors. Then:

1. Keep the project together: `index.html` plus the `assets/css` and `assets/js` folders with
   every file inside (13 JS files, 1 CSS file). Missing one file breaks the screens that file owns.
2. Hard refresh to drop cached copies: `Ctrl+Shift+R` (`Cmd+Shift+R` on Mac).
3. Prefer a tiny static server over double-clicking: `python3 -m http.server 8080`.
4. Open **Settings → System check**. It lists every module and screen as OK or FAIL, checks the
   curriculum for duplicate IDs and broken references, and tests that localStorage is writable.

| File | Screens it provides |
|---|---|
| `views-core.js` | Dashboard, All Categories, Category Details, Explorer |
| `views-roadmap.js` | Roadmap |
| `views-project.js` | Project Details, Custom Project Creator |
| `views-planner.js` | Daily Planner, Calendar, Analytics, Journal |
| `views-data.js` | Backup and Restore, Settings, Help |

**Progress is not saving:** your browser is blocking localStorage (private window or blocked site
data). System check will show `localStorage writable: FAIL`.

---

## 12. Browser support

Any modern evergreen browser (Chrome, Edge, Firefox, Safari). Requires ES6+, `localStorage`,
`CSS custom properties` and `color-mix()` (with graceful visual degradation if absent).
# laravel-mastery-project
