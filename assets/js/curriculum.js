/* ============================================================================
 * curriculum.js — Curriculum content (static knowledge base)
 * ----------------------------------------------------------------------------
 * This file contains ONLY curriculum content. No user progress lives here.
 * User progress is stored separately (see storage.js) and joined by stable IDs.
 *
 * Data model
 *   Category      { id, name, icon, level, subcategories: [Subcategory] }
 *   Subcategory   { id, name }
 *   Item          { id, title, categoryId, subcategoryId, type, level,
 *                   estMinutes, prerequisites[], objectives[], useCases[],
 *                   description, steps[], checklist[{id,text,required}],
 *                   tests[], criteria[], mistakes[], challenges[],
 *                   edgeCases[], security[], performance[],
 *                   beginner, advanced, production, tags[] }
 *
 * IDs are STABLE strings. Never reorder-dependent. Format:
 *   category:   "cat.php-fundamentals"
 *   subcategory "sub.php-fundamentals.syntax"
 *   item:       "itm.php-fundamentals.syntax.1"
 *
 * Scale strategy: the base curriculum below is hand-authored and meaningful.
 * A deterministic *expander* (buildCurriculum) composes authored "topic blueprints"
 * per subcategory into lesson / exercise / mini-project / debug / capstone items
 * using reusable TEMPLATES. This produces thousands of unique, non-repetitive
 * items without storing them all literally, and it stays 100% deterministic so
 * saved progress IDs remain valid across reloads.
 * ========================================================================== */

(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------- */
  /* Constants                                                               */
  /* ---------------------------------------------------------------------- */

  const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

  const TYPES = {
    lesson: { label: 'Topic Lesson', icon: '' },
    exercise: { label: 'Exercise', icon: '' },
    mini: { label: 'Mini Project', icon: '' },
    debug: { label: 'Debug Challenge', icon: '' },
    capstone: { label: 'Capstone Project', icon: '' }
  };

  /* ---------------------------------------------------------------------- */
  /* Category + subcategory + topic blueprints                               */
  /* ---------------------------------------------------------------------- */
  /* Each entry: [categoryId, Category Name, defaultLevel, [ [subId, Sub Name,
     [topic, topic, ...] ], ... ] ]  — topics are short noun-phrases that get
     expanded into multiple item types. */

  const BLUEPRINT = [
    ['php-fundamentals', 'PHP Fundamentals', 'beginner', [
      ['syntax', 'Syntax, Types & Operators', ['Variables and type juggling', 'Strict types declaration', 'String functions and interpolation', 'Arrays and array functions', 'Null coalescing and spaceship operators', 'Match expressions']],
      ['control', 'Control Flow & Functions', ['Loops and iteration patterns', 'Named arguments', 'Variadic functions', 'Closures and arrow functions', 'Recursion basics', 'First-class callable syntax']],
      ['errors', 'Errors & Exceptions', ['Exception hierarchy', 'Custom exception classes', 'try/catch/finally patterns', 'Error reporting configuration', 'Assertions and defensive coding']],
      ['stdlib', 'Standard Library & Files', ['File read/write streams', 'JSON encode/decode safety', 'Date and DateTimeImmutable', 'Regular expressions with preg', 'Hashing and random bytes']]
    ]],
    ['oop', 'Object-Oriented Programming', 'beginner', [
      ['classes', 'Classes & Objects', ['Constructor property promotion', 'Static properties and methods', 'Readonly properties', 'Magic methods', 'Enums (pure and backed)']],
      ['inheritance', 'Inheritance & Interfaces', ['Abstract classes', 'Interface segregation', 'Traits and conflict resolution', 'Late static binding', 'Covariance and contravariance']],
      ['principles', 'SOLID & Design Principles', ['Single responsibility in controllers', 'Dependency inversion with contracts', 'Open/closed with strategy', 'Composition over inheritance', 'Law of Demeter in Eloquent chains']]
    ]],
    ['composer', 'Composer and Dependency Management', 'beginner', [
      ['basics', 'Composer Basics', ['Installing and autoloading', 'composer.json anatomy', 'Semantic version constraints', 'Lock file and reproducible builds']],
      ['advanced', 'Advanced Composer', ['Private repositories and VCS packages', 'Scripts and lifecycle hooks', 'Platform requirements and --ignore-platform-reqs', 'Auditing dependencies for CVEs']]
    ]],
    ['http', 'HTTP, Requests and Responses', 'beginner', [
      ['protocol', 'HTTP Protocol', ['Methods and idempotency', 'Status codes done right', 'Headers, cookies and caching directives', 'Content negotiation']],
      ['laravel-http', 'Laravel HTTP Layer', ['Request object deep dive', 'Response macros', 'File and streamed downloads', 'Redirects with flash data']]
    ]],
    ['install', 'Laravel Installation and Configuration', 'beginner', [
      ['setup', 'Installation', ['Installing via Composer and the installer', 'Laravel Herd / Sail / Valet', 'Directory structure tour', 'Artisan basics']],
      ['config', 'Configuration', ['Environment files and casting', 'Config caching pitfalls', 'Service providers and bootstrapping', 'Per-environment overrides']]
    ]],
    ['routing', 'Routing and Controllers', 'beginner', [
      ['routes', 'Routes', ['Route parameters and constraints', 'Named routes and URL generation', 'Route model binding', 'Route groups and prefixes', 'Fallback routes and 404 handling']],
      ['controllers', 'Controllers', ['Resource controllers', 'Single action controllers', 'Dependency injection in controllers', 'Form requests in controllers', 'API vs web controller split']]
    ]],
    ['middleware', 'Middleware and Request Lifecycle', 'intermediate', [
      ['lifecycle', 'Request Lifecycle', ['Kernel bootstrapping', 'Service container resolution order', 'Terminable middleware', 'Pipeline pattern internals']],
      ['custom', 'Custom Middleware', ['Role-check middleware', 'Locale switching middleware', 'Request ID / correlation ID middleware', 'Maintenance bypass middleware']]
    ]],
    ['blade', 'Blade Templates and Components', 'beginner', [
      ['syntax', 'Blade Syntax', ['Directives and control structures', 'Layouts and sections', 'Escaping vs raw output', 'Including partials and stacks']],
      ['components', 'Components', ['Anonymous components', 'Class-based components', 'Slots and attribute bags', 'Reusable form component library']]
    ]],
    ['forms', 'Forms and Validation', 'beginner', [
      ['basics', 'Form Handling', ['CSRF protection', 'Old input and error bags', 'File inputs and enctype', 'Multi-step forms with session']],
      ['validation', 'Validation', ['Form request classes', 'Custom validation rules', 'Conditional and array validation', 'Unique and exists rules with scopes', 'Validating nested JSON payloads']]
    ]],
    ['crud', 'CRUD Operations', 'beginner', [
      ['basic', 'Basic CRUD', ['Student CRUD end to end', 'Product CRUD with validation', 'Flash messaging and redirects', 'Confirm-before-delete UX']],
      ['advanced', 'Advanced CRUD', ['Nested resource CRUD', 'Bulk actions', 'Inline editing endpoints', 'Optimistic UI with API CRUD']]
    ]],
    ['migrations', 'Database Migrations', 'beginner', [
      ['basics', 'Writing Migrations', ['Schema builder column types', 'Foreign keys and cascade rules', 'Indexes in migrations', 'Rollback safety']],
      ['ops', 'Migration Operations', ['Zero-downtime column changes', 'Squashing migrations', 'Data migrations vs schema migrations', 'Migrating across multiple connections']]
    ]],
    ['seeders', 'Seeders and Factories', 'beginner', [
      ['factories', 'Factories', ['Model factory definitions', 'Factory states and sequences', 'Relationship factories', 'Seeding 10,000 rows efficiently']],
      ['seeders', 'Seeders', ['Idempotent seeders', 'Environment-aware seeding', 'Seeding reference data', 'Seeder performance with chunked inserts']]
    ]],
    ['eloquent', 'Eloquent ORM', 'intermediate', [
      ['models', 'Models', ['Mass assignment and guarded attributes', 'Accessors and mutators', 'Attribute casting and custom casts', 'Model events and observers', 'Global and local scopes']],
      ['queries', 'Eloquent Queries', ['Eager loading and N+1 detection', 'Aggregates and withCount', 'Chunking and lazy collections', 'upsert and bulk writes']]
    ]],
    ['relationships', 'Database Relationships', 'intermediate', [
      ['core', 'Core Relationships', ['One-to-one', 'One-to-many', 'Many-to-many with pivot data', 'Has-many-through']],
      ['poly', 'Polymorphic & Advanced', ['Morph one/many', 'Morph to many tags', 'Self-referencing trees', 'Querying relationship existence']]
    ]],
    ['query-builder', 'Query Builder', 'intermediate', [
      ['core', 'Fluent Queries', ['Joins and subqueries', 'Conditional clauses with when()', 'Raw expressions safely', 'Unions and CTEs']],
      ['reporting', 'Reporting Queries', ['Group by with aggregates', 'Window functions', 'Date bucketing reports', 'Materialised summary tables']]
    ]],
    ['search', 'Search and Filtering', 'intermediate', [
      ['filters', 'Filtering', ['Reusable filter objects', 'Multi-field query string filters', 'Range and date filters', 'Saved filter presets']],
      ['fulltext', 'Full-Text Search', ['MySQL full-text indexes', 'Laravel Scout basics', 'Meilisearch driver integration', 'Relevance tuning and typo tolerance']]
    ]],
    ['pagination', 'Sorting and Pagination', 'intermediate', [
      ['sorting', 'Sorting', ['Whitelisted sortable columns', 'Multi-column sorting', 'Sorting by relation aggregates', 'Stable sort tie-breakers']],
      ['paging', 'Pagination', ['Length-aware vs simple pagination', 'Cursor pagination for big tables', 'Paginating API resources', 'Preserving filters across pages']]
    ]],
    ['auth', 'Authentication and Authorization', 'intermediate', [
      ['auth', 'Authentication', ['Manual login and registration', 'Laravel Breeze / Fortify', 'Remember me tokens', 'Guards and multiple user providers']],
      ['authz', 'Authorization', ['Gates', 'Policies', 'Blade authorization directives', 'Authorizing API endpoints']]
    ]],
    ['oauth-google', 'Google OAuth', 'intermediate', [
      ['socialite', 'Socialite with Google', ['Configuring Google credentials safely', 'Redirect and callback flow', 'Linking Google to existing accounts', 'Handling revoked tokens']]
    ]],
    ['oauth-facebook', 'Facebook OAuth', 'intermediate', [
      ['socialite', 'Socialite with Facebook', ['Facebook app setup and scopes', 'Graph API profile fetch', 'Email-less Facebook accounts', 'Deauthorisation callback']]
    ]],
    ['oauth-github', 'GitHub OAuth', 'intermediate', [
      ['socialite', 'Socialite with GitHub', ['GitHub OAuth app vs GitHub App', 'Scopes and least privilege', 'Fetching verified emails', 'Stateless OAuth for APIs']]
    ]],
    ['email-verify', 'Email Verification', 'intermediate', [
      ['core', 'Verification Flow', ['MustVerifyEmail contract', 'Signed verification URLs', 'Resend throttling', 'Blocking unverified access']]
    ]],
    ['password-reset', 'Password Reset', 'intermediate', [
      ['core', 'Reset Flow', ['Broker configuration', 'Token expiry and single use', 'Custom reset notification', 'Password rules and breach checks']]
    ]],
    ['otp-mfa', 'OTP and Multi-Factor Authentication', 'advanced', [
      ['otp', 'One-Time Passwords', ['Email OTP with expiry', 'SMS OTP provider abstraction', 'Rate limiting OTP requests', 'Replay protection']],
      ['mfa', 'MFA', ['TOTP authenticator apps', 'Recovery codes', 'Step-up authentication', 'Remembering trusted devices']]
    ]],
    ['throttle', 'Login Throttling and Account Lockout', 'advanced', [
      ['core', 'Throttling', ['RateLimiter facade', 'Per-user and per-IP keys', 'Progressive lockout delays', 'Unlock and notification flow']]
    ]],
    ['sessions', 'Session Management and Timeout', 'intermediate', [
      ['core', 'Sessions', ['Session drivers compared', 'Idle timeout middleware', 'Session fixation prevention', 'Logging out other devices']]
    ]],
    ['ip-abuse', 'IP Restrictions and Abuse Prevention', 'advanced', [
      ['core', 'Abuse Prevention', ['IP allow/deny lists', 'Honeypot and timing traps', 'Captcha integration', 'Detecting credential stuffing']]
    ]],
    ['rbac', 'Roles, Permissions and Policies', 'advanced', [
      ['core', 'RBAC', ['Role and permission schema', 'spatie/laravel-permission', 'Policy-driven admin panels', 'Permission caching']],
      ['abac', 'Attribute-Based Rules', ['Ownership checks', 'Team-scoped permissions', 'Temporary elevated access', 'Audit trail of authorization decisions']]
    ]],
    ['uploads', 'Single and Multiple File Uploads', 'intermediate', [
      ['core', 'Uploads', ['Single file upload with validation', 'Multiple file upload', 'Chunked large uploads', 'Direct-to-S3 uploads']]
    ]],
    ['gallery', 'Image Galleries and Optimization', 'intermediate', [
      ['core', 'Images', ['Multi-image gallery model', 'Thumbnail generation', 'Responsive images and WebP', 'Queued image optimisation']]
    ]],
    ['private-storage', 'Private Storage and Downloads', 'advanced', [
      ['core', 'Private Files', ['Private disk configuration', 'Signed temporary URLs', 'Authorised PDF download', 'Streaming large files']]
    ]],
    ['soft-deletes', 'Soft Deletes and Data Recovery', 'intermediate', [
      ['core', 'Soft Deletes', ['SoftDeletes trait', 'Restore and force delete', 'Trash UI with filters', 'Cascading soft deletes']]
    ]],
    ['rest-api', 'REST API Development', 'intermediate', [
      ['core', 'REST Design', ['Resourceful API routes', 'Consistent error envelopes', 'Pagination metadata', 'Idempotency keys']]
    ]],
    ['api-auth', 'API Authentication and Security', 'advanced', [
      ['core', 'API Auth', ['Sanctum token abilities', 'SPA cookie authentication', 'Passport / OAuth2 server', 'Token rotation and revocation']]
    ]],
    ['api-resources', 'API Resources and Versioning', 'advanced', [
      ['core', 'Resources', ['Eloquent API resources', 'Conditional attributes', 'URI vs header versioning', 'Deprecation policy and sunset headers']]
    ]],
    ['notifications', 'Notifications and Email', 'intermediate', [
      ['core', 'Notifications', ['Mailables and markdown mail', 'Database notifications', 'Broadcast and Slack channels', 'Localised notifications']]
    ]],
    ['queues', 'Queues, Jobs and Retries', 'advanced', [
      ['core', 'Queues', ['Dispatching and chaining jobs', 'Retries, backoff and timeouts', 'Failed jobs table and replay', 'Batching with progress tracking']],
      ['ops', 'Queue Operations', ['Horizon monitoring', 'Queue priorities and workers', 'Unique and rate-limited jobs', 'Graceful deploy restarts']]
    ]],
    ['events', 'Events and Listeners', 'intermediate', [
      ['core', 'Events', ['Event and listener wiring', 'Queued listeners', 'Model events vs domain events', 'Event subscribers']]
    ]],
    ['scheduling', 'Scheduling and Cron Jobs', 'intermediate', [
      ['core', 'Scheduling', ['Scheduler definition', 'Overlap prevention and single server', 'Scheduled command output and failures', 'Timezone-aware schedules']]
    ]],
    ['caching', 'Caching and Redis', 'advanced', [
      ['core', 'Caching', ['Cache drivers and tags', 'Cache-aside pattern', 'Atomic locks', 'Invalidation strategies']],
      ['redis', 'Redis', ['Redis data structures in Laravel', 'Rate limiting with Redis', 'Pub/Sub basics', 'Redis memory and eviction policy']]
    ]],
    ['db-optimization', 'Database Indexing and Optimization', 'advanced', [
      ['core', 'Indexing', ['Reading EXPLAIN output', 'Composite index column order', 'Covering indexes', 'Avoiding index-defeating queries']],
      ['tuning', 'Query Tuning', ['Slow query log analysis', 'Denormalisation trade-offs', 'Counting large tables cheaply', 'Connection pooling considerations']]
    ]],
    ['large-data', 'Large Dataset Processing', 'advanced', [
      ['core', 'Big Data Handling', ['Chunk vs cursor vs lazy', 'Streaming exports', '10,000-record explorer', 'Backfilling millions of rows safely']]
    ]],
    ['csv-excel', 'CSV and Excel Import/Export', 'intermediate', [
      ['core', 'Import/Export', ['CSV import with validation', 'Queued large imports', 'Excel export with formatting', 'Error reporting per row']]
    ]],
    ['transactions', 'Database Transactions and Concurrency', 'advanced', [
      ['core', 'Transactions', ['Transaction basics and nesting', 'Pessimistic vs optimistic locking', 'Deadlock retry strategies', 'Isolation levels in practice']]
    ]],
    ['testing', 'Unit, Feature and Integration Testing', 'advanced', [
      ['unit', 'Unit Testing', ['PHPUnit / Pest setup', 'Testing services in isolation', 'Mocks, spies and fakes', 'Data providers and datasets']],
      ['feature', 'Feature Testing', ['HTTP tests and assertions', 'Database testing with RefreshDatabase', 'Testing queues, mail and events', 'Browser tests with Dusk']]
    ]],
    ['security-testing', 'Security Testing', 'expert', [
      ['core', 'Security Tests', ['Mass assignment regression tests', 'Authorization bypass tests', 'IDOR test suite', 'Rate limit and lockout tests']]
    ]],
    ['admin', 'Admin Panels and Dashboards', 'advanced', [
      ['core', 'Admin Panels', ['Custom admin layout', 'Filament / Nova overview', 'Data tables with filters', 'Activity log and impersonation']]
    ]],
    ['ecommerce', 'E-commerce Systems', 'advanced', [
      ['catalog', 'Catalog & Cart', ['Product variants and options', 'Cart persistence', 'Coupons and discount rules', 'Inventory reservation']],
      ['orders', 'Orders & Fulfilment', ['Order state machine', 'Invoices and PDF receipts', 'Refunds and partial returns', 'Shipping and tax calculation']]
    ]],
    ['blog-cms', 'Blog and CMS Systems', 'intermediate', [
      ['core', 'CMS', ['Posts, categories and tags', 'Draft, scheduled and published states', 'Media library', 'SEO metadata and sitemaps']]
    ]],
    ['crm-erp', 'CRM and ERP Systems', 'expert', [
      ['core', 'CRM/ERP', ['Lead and pipeline modelling', 'Activity timeline', 'Quotation to invoice flow', 'Inventory and purchase orders']]
    ]],
    ['lms', 'Learning Management Systems', 'advanced', [
      ['core', 'LMS', ['Course, module and lesson model', 'Enrolment and progress tracking', 'Quizzes and grading', 'Certificates generation']]
    ]],
    ['saas', 'SaaS Applications', 'expert', [
      ['core', 'SaaS Foundations', ['Plans and feature gating', 'Subscription lifecycle with Cashier', 'Usage metering and quotas', 'Trials, dunning and churn emails']]
    ]],
    ['multitenancy', 'Multi-Tenancy', 'expert', [
      ['core', 'Tenancy', ['Single DB with tenant scoping', 'Database-per-tenant', 'Tenant-aware queues and cache', 'Tenant onboarding automation']]
    ]],
    ['realtime', 'Real-Time Features', 'advanced', [
      ['core', 'Realtime', ['Broadcasting with Reverb', 'Private and presence channels', 'Live notifications', 'Optimistic UI and reconnection']]
    ]],
    ['webhooks', 'Webhooks and Third-Party Integrations', 'advanced', [
      ['core', 'Webhooks', ['Receiving and verifying webhooks', 'Signature validation', 'Idempotent webhook processing', 'Outgoing webhooks with retries']]
    ]],
    ['payments', 'Payment Gateway Integration', 'advanced', [
      ['core', 'Payments', ['Stripe checkout integration', 'Webhook-driven order confirmation', 'Refunds and disputes', 'PCI scope and tokenisation']]
    ]],
    ['services', 'Service Classes and Action Classes', 'advanced', [
      ['core', 'Services & Actions', ['Extracting controller logic', 'Single-purpose action classes', 'Service container bindings', 'Transactional service boundaries']]
    ]],
    ['dto', 'DTOs and Domain Logic', 'expert', [
      ['core', 'DTO & Domain', ['Readonly DTOs from requests', 'Value objects', 'Domain events', 'Keeping Eloquent at the edge']]
    ]],
    ['patterns', 'Design Patterns and Refactoring', 'expert', [
      ['core', 'Patterns', ['Repository pattern trade-offs', 'Strategy and pipeline', 'Decorator for caching', 'Refactoring god controllers']]
    ]],
    ['packages', 'Laravel Package Development', 'expert', [
      ['core', 'Packages', ['Package skeleton and service provider', 'Publishing config, views and migrations', 'Package testing with Testbench', 'Releasing to Packagist']]
    ]],
    ['artisan', 'Custom Artisan Commands', 'intermediate', [
      ['core', 'Artisan', ['Command signature and options', 'Interactive prompts', 'Progress bars and output tables', 'Scheduling custom commands']]
    ]],
    ['apm', 'Application Performance Monitoring', 'expert', [
      ['core', 'APM', ['Laravel Telescope in dev', 'Request tracing and spans', 'Measuring N+1 in production', 'Error budgets and alerts']]
    ]],
    ['docker-ci', 'Docker and CI/CD', 'expert', [
      ['docker', 'Docker', ['Dockerfile for PHP-FPM', 'docker-compose dev stack', 'Multi-stage production images', 'Running queues in containers']],
      ['ci', 'CI/CD', ['GitHub Actions test pipeline', 'Static analysis in CI', 'Zero-downtime deploy job', 'Secrets management in pipelines']]
    ]],
    ['deployment', 'Production Deployment', 'expert', [
      ['core', 'Deployment', ['Server provisioning checklist', 'Nginx + PHP-FPM tuning', 'Deployer / Envoyer style releases', 'Rollback strategy']]
    ]],
    ['observability', 'Logging, Monitoring and Backups', 'expert', [
      ['core', 'Operations', ['Structured logging channels', 'Centralised log aggregation', 'Automated database backups', 'Restore drills']]
    ]],
    ['system-design', 'Advanced System Design', 'expert', [
      ['core', 'System Design', ['Read/write splitting', 'Event-driven architecture', 'CQRS-lite in Laravel', 'Designing for 1M users']]
    ]],
    ['scalability', 'Scalability and Reliability', 'expert', [
      ['core', 'Scaling', ['Horizontal scaling and sticky sessions', 'Queue backpressure', 'Circuit breakers and timeouts', 'Graceful degradation']]
    ]],
    ['threat-modeling', 'Advanced Security and Threat Modeling', 'expert', [
      ['core', 'Threat Modeling', ['STRIDE for a Laravel app', 'OWASP Top 10 mapped to Laravel', 'Secrets rotation', 'Supply chain security']]
    ]],
    ['code-quality', 'Code Quality and Static Analysis', 'advanced', [
      ['core', 'Quality', ['PHPStan / Larastan levels', 'Laravel Pint and code style', 'Architecture tests', 'Mutation testing with Infection']]
    ]],
    ['capstone', 'Complete Capstone Projects', 'expert', [
      ['core', 'Capstones', ['Multi-tenant CRM platform', 'Production e-commerce store', 'SaaS subscription platform', 'Learning management platform', 'Real-time collaboration tool']]
    ]]
  ];

  /* ---------------------------------------------------------------------- */
  /* Reusable item templates                                                 */
  /* ---------------------------------------------------------------------- */

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  }

  function ck(prefix, list) {
    return list.map((text, i) => ({ id: prefix + '.c' + (i + 1), text: text.text || text, required: text.required !== false }));
  }

  const TEMPLATES = {
    lesson(ctx) {
      const t = ctx.topic, c = ctx.catName;
      return {
        type: 'lesson',
        title: 'Learn: ' + t,
        estMinutes: 45,
        description:
          'A focused study session on "' + t + '" within ' + c + '. Read the official Laravel/PHP documentation, ' +
          'write a tiny scratch implementation, and record the mental model in your own words so you can explain it ' +
          'to another developer without looking anything up.',
        objectives: [
          'Explain what "' + t + '" is and the problem it solves',
          'Identify the Laravel/PHP APIs involved and their signatures',
          'Write a minimal working example from memory',
          'Recognise when NOT to use this technique'
        ],
        useCases: [
          'Reviewing a teammate\'s pull request that touches ' + t.toLowerCase(),
          'Debugging a production incident caused by misuse of this feature',
          'Choosing between this and an alternative approach during design'
        ],
        steps: [
          'Read the official documentation section for this topic end to end.',
          'Create a scratch route/command in a sandbox Laravel app.',
          'Implement the smallest possible working example.',
          'Break it deliberately and observe the error output.',
          'Write a 5-line summary in your notes, in your own words.'
        ],
        checklist: [
          'Read the official documentation',
          'Built a minimal working example',
          'Deliberately broke it and read the error',
          'Wrote a plain-language summary in notes',
          { text: 'Bookmarked a reference article or video', required: false }
        ],
        tests: ['Explain the topic out loud in under 2 minutes', 'Reproduce the minimal example from memory'],
        criteria: ['You can describe the topic without notes', 'A working snippet exists in your sandbox repo'],
        mistakes: ['Copy-pasting examples without running them', 'Skipping the failure case', 'Reading docs passively without writing code'],
        challenges: ['Find the relevant implementation inside the Laravel framework source', 'Write a blog-style explanation with a diagram'],
        edgeCases: ['Behaviour differences across PHP/Laravel versions', 'Interaction with config caching'],
        security: ['Check whether misuse of this feature can leak data or bypass validation'],
        performance: ['Note any hidden queries, allocations or I/O this feature performs']
      };
    },

    exercise(ctx) {
      const t = ctx.topic;
      return {
        type: 'exercise',
        title: 'Exercise: Apply ' + t,
        estMinutes: 60,
        description:
          'A hands-on drill. Implement "' + t + '" three different ways in a throwaway app, then keep the version you ' +
          'would actually ship and delete the rest. The goal is fluency, not a finished product.',
        objectives: [
          'Implement ' + t.toLowerCase() + ' without copying from documentation',
          'Compare at least two implementations and justify the better one',
          'Add a failing test first, then make it pass'
        ],
        useCases: ['Daily feature work where this pattern appears', 'Technical interview whiteboard questions'],
        steps: [
          'Write a failing test describing the desired behaviour.',
          'Implement the simplest version that passes.',
          'Refactor to the version you would ship.',
          'Document the trade-offs in your notes.'
        ],
        checklist: [
          'Failing test written first',
          'Simplest implementation passes the test',
          'Refactored version still passes',
          'Trade-offs documented',
          { text: 'Committed to a practice repository', required: false }
        ],
        tests: ['Automated test covering the happy path', 'Automated test covering one failure path'],
        criteria: ['All tests green', 'Implementation written without copy-paste'],
        mistakes: ['Writing the test after the code', 'Stopping at the first version that works'],
        challenges: ['Re-do the exercise with a 20-minute timer', 'Implement it again using a different Laravel API'],
        edgeCases: ['Empty input', 'Concurrent execution', 'Unicode / very large input'],
        security: ['Validate every external input used by the exercise'],
        performance: ['Measure the query count with Telescope or the debugbar']
      };
    },

    mini(ctx) {
      const t = ctx.topic, c = ctx.catName;
      return {
        type: 'mini',
        title: 'Mini Project: ' + t,
        estMinutes: 150,
        description:
          'Build a small but complete Laravel feature around "' + t + '". It must have routes, a controller, validation, ' +
          'persistence, a Blade or API surface, authorization and at least two automated tests. Treat it as something a ' +
          'reviewer would approve into a real ' + c.toLowerCase() + ' codebase.',
        objectives: [
          'Ship a vertical slice: route → controller → service → model → view/response',
          'Validate every input and authorize every action',
          'Cover the feature with feature tests',
          'Handle the unhappy paths explicitly'
        ],
        useCases: [
          'A real ticket in a client project',
          'A reusable module you can lift into future applications',
          'A portfolio artefact you can demo in an interview'
        ],
        steps: [
          'Write the user story and acceptance criteria.',
          'Design the database schema and write the migration.',
          'Create model, factory and seeder.',
          'Implement routes, form request validation and controller.',
          'Add a policy or gate for authorization.',
          'Build the Blade view or API resource.',
          'Write feature tests for success and failure paths.',
          'Handle errors, empty states and flash messaging.',
          'Review your own diff as if you were the reviewer.'
        ],
        checklist: [
          'Migration and schema designed',
          'Model, factory and seeder created',
          'Routes and controller implemented',
          'Form request validation in place',
          'Authorization (policy/gate) enforced',
          'UI or API response implemented',
          'Happy-path feature test passing',
          'Failure-path feature test passing',
          'Empty and error states handled',
          { text: 'README section written for the feature', required: false },
          { text: 'Pushed to GitHub', required: false }
        ],
        tests: [
          'Feature test: authorised user completes the flow',
          'Feature test: unauthorised user is rejected (403)',
          'Validation test: invalid payload returns 422 / redirects with errors'
        ],
        criteria: [
          'Feature works end to end in the browser or via HTTP client',
          'All required checklist items complete',
          'Tests pass locally',
          'No N+1 queries on the main screen'
        ],
        mistakes: [
          'Business logic stuffed into the controller',
          'Forgetting authorization because the UI hides the button',
          'Trusting request data without validation',
          'Only testing the happy path'
        ],
        challenges: [
          'Add pagination, filtering and sorting to the feature',
          'Expose the same feature through a versioned API',
          'Add a queued job for the slow part of the flow'
        ],
        edgeCases: ['Zero records', 'Concurrent updates by two users', 'Very large payloads', 'Soft-deleted parents'],
        security: ['Mass assignment protection', 'IDOR: verify ownership on every lookup', 'CSRF on state-changing routes', 'Escape all output'],
        performance: ['Eager load relationships', 'Index the columns you filter on', 'Paginate instead of loading everything']
      };
    },

    debug(ctx) {
      const t = ctx.topic;
      return {
        type: 'debug',
        title: 'Debug Challenge: Broken ' + t,
        estMinutes: 75,
        description:
          'Deliberately break "' + t + '" in your sandbox app (or ask a teammate/AI to inject a bug), then find and fix it ' +
          'using only logs, stack traces, Telescope, tinker and tests. Debugging speed is what separates seniors from juniors.',
        objectives: [
          'Reproduce a bug reliably before fixing it',
          'Use logs, stack traces and tinker to isolate root cause',
          'Write a regression test that fails before the fix',
          'Document the root cause, not just the symptom'
        ],
        useCases: ['Production incident response', 'Fixing a flaky test', 'Inheriting legacy code'],
        steps: [
          'Introduce or locate the defect.',
          'Write a failing test that reproduces it.',
          'Form a hypothesis and prove or disprove it with evidence.',
          'Fix the root cause.',
          'Confirm the regression test passes.',
          'Write a short post-mortem in your notes.'
        ],
        checklist: [
          'Bug reproduced deterministically',
          'Failing regression test written',
          'Root cause identified with evidence',
          'Fix applied',
          'Regression test passes',
          { text: 'Post-mortem note written', required: false }
        ],
        tests: ['Regression test that fails on the buggy code and passes after the fix'],
        criteria: ['Root cause explained in one sentence', 'Regression test committed'],
        mistakes: ['Fixing the symptom', 'Changing code randomly until it works', 'Not writing a regression test'],
        challenges: ['Fix it within 20 minutes', 'Find a second latent bug in the same area'],
        edgeCases: ['Bug only appears under load', 'Bug only appears with cached config'],
        security: ['Check whether the bug had a security impact (data exposure, bypassed check)'],
        performance: ['Check whether the fix introduced extra queries']
      };
    },

    capstone(ctx) {
      const t = ctx.topic;
      return {
        type: 'capstone',
        title: 'Capstone: ' + t,
        estMinutes: 900,
        description:
          'A multi-day, production-grade build of "' + t + '". This is a full application slice with authentication, ' +
          'authorization, background jobs, tests, monitoring and a deployment story. It should be something you are ' +
          'genuinely comfortable putting on your CV.',
        objectives: [
          'Design the domain model and document the decisions',
          'Implement the full stack with tests and CI',
          'Handle security, performance and failure modes',
          'Deploy it and prove it works in a production-like environment'
        ],
        useCases: ['Portfolio centrepiece', 'Template for real client work', 'Reference architecture for your team'],
        steps: [
          'Write a one-page specification and ERD.',
          'Scaffold the app, auth and CI pipeline.',
          'Implement the core domain with service/action classes.',
          'Add background jobs, notifications and caching where justified.',
          'Write unit, feature and at least one browser test.',
          'Add logging, error tracking and a backup strategy.',
          'Run static analysis and fix all reported issues.',
          'Containerise and deploy to a staging environment.',
          'Load test the critical path and tune it.',
          'Write documentation and a demo script.'
        ],
        checklist: [
          'Specification and ERD written',
          'Authentication and authorization implemented',
          'Core domain implemented with service/action classes',
          'Background jobs / queues used where appropriate',
          'Unit tests written',
          'Feature tests written',
          'Static analysis passing',
          'CI pipeline green',
          'Deployed to a staging or production environment',
          'Logging and error tracking configured',
          'Backup and restore tested',
          { text: 'Load test executed on the critical path', required: false },
          { text: 'Demo video or screenshots recorded', required: false },
          { text: 'Public GitHub repository with README', required: false }
        ],
        tests: [
          'Unit tests for domain services',
          'Feature tests for every critical user journey',
          'Authorization tests for every role',
          'A browser test for the primary happy path'
        ],
        criteria: [
          'Application deployed and reachable',
          'All required checklist items complete',
          'Test suite green in CI',
          'No critical static-analysis or security findings'
        ],
        mistakes: [
          'Starting to code before modelling the domain',
          'Leaving authorization until the end',
          'Skipping deployment because "it works locally"',
          'No seed data, so the app is undemoable'
        ],
        challenges: [
          'Add multi-tenancy',
          'Add real-time updates',
          'Support 10,000 concurrent records with sub-200ms list queries',
          'Write an architecture decision record for every major choice'
        ],
        edgeCases: ['Partial failures mid-transaction', 'Third-party API downtime', 'Clock skew and timezones', 'Data migration for existing users'],
        security: ['Threat model the application', 'Rate limit every public endpoint', 'Rotate and scope all secrets', 'Audit log sensitive actions'],
        performance: ['Index every filter column', 'Cache expensive aggregates', 'Queue every slow operation', 'Measure p95 latency']
      };
    }
  };

  /* Which templates are produced for each topic, by position. Keeps variety
     high and avoids 5 near-identical items for every single topic. */
  function templateMixFor(index, level) {
    const mixes = [
      ['lesson', 'mini'],
      ['lesson', 'exercise'],
      ['lesson', 'mini', 'debug'],
      ['lesson', 'exercise', 'mini'],
      ['lesson', 'mini']
    ];
    let mix = mixes[index % mixes.length].slice();
    if (level === 'expert' && index % 3 === 0) mix.push('capstone');
    return mix;
  }

  function levelFor(baseLevel, templateType) {
    const i = LEVELS.indexOf(baseLevel);
    if (templateType === 'lesson') return LEVELS[Math.max(0, i - 1)];
    if (templateType === 'capstone') return 'expert';
    if (templateType === 'debug') return LEVELS[Math.min(3, i + 1)];
    return baseLevel;
  }

  /* ---------------------------------------------------------------------- */
  /* Builder                                                                 */
  /* ---------------------------------------------------------------------- */

  function buildCurriculum() {
    const categories = [];
    const items = [];
    const now = '2024-01-01T00:00:00.000Z'; // stable creation stamp for built-ins

    BLUEPRINT.forEach((row, ci) => {
      const [cid, cname, clevel, subs] = row;
      const categoryId = 'cat.' + cid;
      const category = {
        id: categoryId,
        name: cname,
        order: ci + 1,
        level: clevel,
        subcategories: []
      };

      subs.forEach((sub) => {
        const [sid, sname, topics] = sub;
        const subcategoryId = 'sub.' + cid + '.' + sid;
        category.subcategories.push({ id: subcategoryId, name: sname, categoryId });

        topics.forEach((topic, ti) => {
          const mix = templateMixFor(ti, clevel);
          mix.forEach((tplName, mi) => {
            const tpl = TEMPLATES[tplName]({ topic, catName: cname, subName: sname });
            const itemId = 'itm.' + cid + '.' + sid + '.' + slug(topic) + '.' + tplName;
            const lvl = levelFor(clevel, tplName);
            const prereqs = [];
            // Lessons unlock their sibling practice items.
            if (tplName !== 'lesson') {
              prereqs.push('itm.' + cid + '.' + sid + '.' + slug(topic) + '.lesson');
            }
            items.push({
              id: itemId,
              title: tpl.title,
              categoryId,
              subcategoryId,
              type: tpl.type,
              level: lvl,
              estMinutes: tpl.estMinutes,
              prerequisites: prereqs,
              objectives: tpl.objectives,
              useCases: tpl.useCases,
              description: tpl.description,
              steps: tpl.steps,
              checklist: ck(itemId, tpl.checklist),
              tests: tpl.tests,
              criteria: tpl.criteria,
              mistakes: tpl.mistakes,
              challenges: tpl.challenges,
              edgeCases: tpl.edgeCases,
              security: tpl.security,
              performance: tpl.performance,
              beginner: 'Start with the most direct Laravel-idiomatic solution. Keep it in a controller if that is the clearest place, use built-in validation, and lean on the framework defaults. Correctness first.',
              advanced: 'Extract the logic into an action or service class, inject dependencies through the container, add caching or queueing where measurement justifies it, and cover the behaviour with unit tests that do not touch the database.',
              production: 'Add observability (structured logs + metrics), rate limiting, authorization at the policy layer, database indexes for every filter, graceful degradation when dependencies fail, and a rollback plan for the deployment.',
              tags: [cname, sname, topic, TYPES[tpl.type].label].map((x) => String(x).toLowerCase()),
              createdAt: now,
              builtIn: true
            });
          });
        });
      });

      categories.push(category);
    });

    return { categories, items };
  }

  const built = buildCurriculum();

  /* Indexes for O(1) lookups ------------------------------------------------ */
  const itemsById = new Map();
  built.items.forEach((i) => itemsById.set(i.id, i));
  const categoriesById = new Map();
  const subcategoriesById = new Map();
  built.categories.forEach((c) => {
    categoriesById.set(c.id, c);
    c.subcategories.forEach((s) => subcategoriesById.set(s.id, s));
  });

  global.Curriculum = {
    LEVELS,
    TYPES,
    categories: built.categories,
    items: built.items,
    itemsById,
    categoriesById,
    subcategoriesById,
    slug,
    /** Build a custom item that matches the built-in shape. */
    makeCustomItem(data) {
      const id = data.id || 'itm.custom.' + Date.now().toString(36) + '.' + Math.random().toString(36).slice(2, 7);
      const arr = (v) => (Array.isArray(v) ? v : String(v || '').split('\n').map((s) => s.trim()).filter(Boolean));
      return {
        id,
        title: data.title || 'Untitled project',
        categoryId: data.categoryId || 'cat.capstone',
        subcategoryId: data.subcategoryId || 'sub.capstone.core',
        type: data.type || 'mini',
        level: LEVELS.includes(data.level) ? data.level : 'intermediate',
        estMinutes: Number(data.estMinutes) || 60,
        prerequisites: Array.isArray(data.prerequisites) ? data.prerequisites : [],
        objectives: arr(data.objectives),
        useCases: arr(data.useCases),
        description: data.description || '',
        steps: arr(data.steps),
        checklist: arr(data.checklist).map((text, i) => ({ id: id + '.c' + (i + 1), text, required: true })),
        tests: arr(data.tests),
        criteria: arr(data.criteria),
        mistakes: arr(data.mistakes),
        challenges: arr(data.challenges),
        edgeCases: arr(data.edgeCases),
        security: arr(data.security),
        performance: arr(data.performance),
        beginner: data.beginner || '',
        advanced: data.advanced || '',
        production: data.production || '',
        tags: [data.title || '', 'custom'].map((s) => s.toLowerCase()),
        createdAt: new Date().toISOString(),
        builtIn: false
      };
    }
  };
})(window);
