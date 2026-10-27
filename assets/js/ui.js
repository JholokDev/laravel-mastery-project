/* ============================================================================
 * ui.js — Safe DOM helpers, SVG icons, reusable components, toasts, modals
 * ----------------------------------------------------------------------------
 * All text from user data goes through textContent (never innerHTML).
 * Icon markup comes only from the static ICONS table below.
 * ========================================================================== */

(function (global) {
  'use strict';

  const Curriculum = global.Curriculum;
  const Progress = global.Progress;

  /* ------------------------------------------------------------- icons -- */

  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    roadmap: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    categories: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    explorer: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    planner: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18m-11 5 2 2 4-4"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    analytics: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
    journal: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M20 17v4H6.5A2.5 2.5 0 0 1 4 18.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    backup: '<path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    upload: '<path d="M12 15V3m0 0-4 4m4-4 4 4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2 0-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.4 1-3 0 1.4 1 2.5 2.5 2.5z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    arrowRight: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    flag: '<path d="M4 22V4m0 0h13l-2 4 2 4H4"/>',
    book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5M2 17l10 5 10-5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    done: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    hourglass: '<path d="M6 2h12M6 22h12M7 2v5l5 5-5 5v5M17 2v5l-5 5 5 5v5"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'
  };

  function icon(name, size, cls) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const s = String(size || 16);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', s);
    svg.setAttribute('height', s);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.9');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
    svg.innerHTML = ICONS[name] || '';
    return svg;
  }

  /** Circular progress ring built from real data. */
  function ring(percent, size, stroke, labelText, subText) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    const sz = size || 140, sw = stroke || 10;
    const r = (sz - sw) / 2, c = 2 * Math.PI * r;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', sz); svg.setAttribute('height', sz);
    svg.setAttribute('viewBox', '0 0 ' + sz + ' ' + sz);
    svg.setAttribute('aria-hidden', 'true');
    const mk = (cls) => {
      const ci = document.createElementNS(ns, 'circle');
      ci.setAttribute('cx', sz / 2); ci.setAttribute('cy', sz / 2); ci.setAttribute('r', r);
      ci.setAttribute('fill', 'none'); ci.setAttribute('stroke-width', sw);
      ci.setAttribute('class', cls);
      return ci;
    };
    svg.appendChild(mk('ring-bg'));
    const fg = mk('ring-fg');
    fg.setAttribute('stroke-linecap', 'round');
    fg.setAttribute('stroke-dasharray', c);
    fg.setAttribute('stroke-dashoffset', c * (1 - p / 100));
    svg.appendChild(fg);

    const label = el('div', { class: 'ring-label', style: 'font-size:' + Math.round(sz / 4.4) + 'px' }, [
      document.createTextNode(labelText != null ? labelText : Math.round(p) + '%'),
      subText ? el('small', { text: subText }) : null
    ]);
    return el('div', {
      class: 'ring' + (p >= 100 ? ' ok' : ''), role: 'img',
      'aria-label': (labelText != null ? labelText : Math.round(p) + '%') + (subText ? ' ' + subText : ''),
      style: 'width:' + sz + 'px;height:' + sz + 'px'
    }, [svg, label]);
  }

  /* ----------------------------------------------------------- element -- */

  // Decorative pictographs are stripped from button and badge labels only, so the
  // UI keeps one consistent icon style. User-authored text elsewhere is untouched.
  // Built at runtime inside try/catch: a regex literal using \p{...} is a hard
  // SyntaxError in older engines and would stop this whole file from loading.
  let PICTO = null;
  try { PICTO = new RegExp('\\p{Extended_Pictographic}\\uFE0F?\\s*', 'gu'); } catch (e) { PICTO = null; }
  function plainLabel(v) {
    const s = String(v);
    if (!PICTO) return s;
    const out = s.replace(PICTO, '');
    return out.trim() ? out : s;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    const labelOnly = tag === 'button' || (attrs && typeof attrs.class === 'string' && attrs.class.indexOf('badge') !== -1);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = labelOnly ? plainLabel(v) : v;
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      });
    }
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children == null) return;
    const list = Array.isArray(children) ? children : [children];
    list.forEach((c) => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
  }

  function frag(children) { const f = document.createDocumentFragment(); appendChildren(f, children); return f; }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /** Button with an optional leading icon. */
  function button(label, opts) {
    const o = opts || {};
    const b = el('button', { class: 'btn' + (o.variant ? ' btn-' + o.variant : '') + (o.size ? ' btn-' + o.size : ''), type: o.type || 'button', disabled: o.disabled, 'aria-label': o.aria });
    if (o.icon) b.appendChild(icon(o.icon, o.size === 'sm' ? 14 : 16));
    if (label) b.appendChild(document.createTextNode(label));
    if (o.onClick) b.addEventListener('click', o.onClick);
    return b;
  }

  /* ------------------------------------------------------------ format -- */

  function minutes(m) {
    const n = Number(m) || 0;
    if (n < 60) return n + ' min';
    const h = Math.floor(n / 60), r = n % 60;
    return r ? h + 'h ' + r + 'm' : h + 'h';
  }

  function dateLabel(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function timeAgo(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff)) return '—';
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24); if (d < 30) return d + 'd ago';
    return dateLabel(iso);
  }

  function titleCase(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
  function statusLabel(s) { return s === 'completed' ? 'Completed' : s === 'in-progress' ? 'In progress' : 'Not started'; }

  /* -------------------------------------------------------- components -- */

  function bar(percent, cls) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    return el('div', { class: 'bar' + (cls ? ' ' + cls : ''), role: 'progressbar',
      'aria-valuenow': String(Math.round(p)), 'aria-valuemin': '0', 'aria-valuemax': '100' },
      el('span', { style: 'width:' + p + '%' }));
  }

  function stat(label, value, sub, tone, iconName) {
    return el('div', { class: 'stat' + (tone ? ' ' + tone : '') }, [
      el('div', { class: 'top' }, [
        el('div', { class: 'label', text: label }),
        iconName ? el('span', { class: 'chip' }, icon(iconName, 15)) : null
      ]),
      el('div', { class: 'value', text: String(value) }),
      sub ? el('div', { class: 'sub', text: sub }) : null
    ]);
  }

  function badge(text, cls) { return el('span', { class: 'badge' + (cls ? ' ' + cls : ''), text }); }

  function progressRow(name, done, total, onClick) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const row = el('div', { class: 'progress-row' }, [
      el('div', { class: 'name', text: name, title: name }),
      bar(pct, pct === 100 ? 'ok' : ''),
      el('div', { class: 'pct', text: pct + '%' }),
      el('div', { class: 'faint small nowrap', text: done + '/' + total })
    ]);
    if (onClick) {
      row.style.cursor = 'pointer';
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.addEventListener('click', onClick);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } });
    }
    return row;
  }

  function emptyState(iconName, title, message, action) {
    return el('div', { class: 'empty' }, [
      el('div', { class: 'icon-wrap' }, icon(ICONS[iconName] ? iconName : 'box', 24)),
      el('h3', { text: title }),
      el('p', { class: 'muted', text: message }),
      action || null
    ]);
  }

  function bulletList(items, cls) {
    if (!items || !items.length) return el('p', { class: 'faint small', text: 'Nothing recorded for this section.' });
    return el('ul', { class: cls || '' }, items.map((t) => el('li', { text: String(t) })));
  }

  function section(title, body) { return frag([el('div', { class: 'section-title', text: title }), body]); }

  function field(labelText, control, hint) {
    const id = control.id || ('f' + Math.random().toString(36).slice(2, 8));
    control.id = id;
    return el('div', { class: 'field' }, [
      el('label', { for: id, text: labelText }),
      control,
      hint ? el('div', { class: 'faint small', style: 'margin-top:4px', text: hint }) : null
    ]);
  }

  function select(options, value, onChange, attrs) {
    const s = el('select', attrs || {});
    options.forEach((o) => {
      const opt = el('option', { value: o.value, text: o.label });
      if (String(o.value) === String(value)) opt.selected = true;
      s.appendChild(opt);
    });
    if (onChange) s.addEventListener('change', () => onChange(s.value));
    return s;
  }

  /** Curriculum item card used in explorer / lists. */
  function itemCard(item) {
    const ip = Progress.itemProgress(item);
    const lock = Progress.lockState(item);
    const cat = Curriculum.categoriesById.get(item.categoryId);
    const type = Curriculum.TYPES[item.type] || { label: item.type };

    return el('button', {
      class: 'item-card' + (lock.state === 'locked' ? ' locked' : '') +
             (ip.status === 'completed' ? ' is-completed' : ip.status === 'in-progress' ? ' is-in-progress' : ''),
      type: 'button',
      dataset: { itemId: item.id, action: 'open-item' }
    }, [
      el('div', { class: 'tag-row', style: 'margin-bottom:8px' }, [
        badge(type.label, 'type-' + item.type),
        badge(titleCase(item.level), item.level),
        lock.state === 'locked' ? badge('Locked', 'locked') : null,
        ip.status !== 'not-started' ? badge(statusLabel(ip.status), ip.status) : null
      ]),
      el('div', { class: 't', text: item.title }),
      el('div', { class: 'meta', text: (cat ? cat.name : '') + ' · ' + minutes(item.estMinutes) }),
      el('div', { class: 'desc', text: item.description || '' }),
      bar(ip.percent, ip.percent === 100 ? 'ok' : ''),
      el('div', { class: 'faint small', style: 'margin-top:7px',
        text: ip.totalRequired ? ip.doneRequired + '/' + ip.totalRequired + ' required steps' : 'No checklist — mark complete manually' })
    ]);
  }

  /* ------------------------------------------------------------- toast -- */

  let toastHost = null;
  function toast(message, type, ms) {
    if (!toastHost) {
      toastHost = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(toastHost);
    }
    const t = el('div', { class: 'toast' + (type ? ' ' + type : ''), text: message });
    toastHost.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 220); }, ms || 3200);
  }

  /* ------------------------------------------------------------- modal -- */

  let openModal = null;

  function modal(opts) {
    closeModal();
    const body = el('div', { class: 'modal-body' });
    appendChildren(body, opts.body);

    const footer = el('div', { class: 'modal-foot' });
    let backdrop = null;
    (opts.actions || []).forEach((a) => {
      footer.appendChild(el('button', {
        class: 'btn ' + (a.variant ? 'btn-' + a.variant : ''), type: 'button', text: a.label,
        onclick: () => {
          const keep = a.onClick && a.onClick();
          // Only close if THIS dialog is still the open one. If the handler opened
          // a follow-up dialog (e.g. a confirmation), leave that one alone.
          if (!keep && openModal === backdrop) closeModal();
        }
      }));
    });
    if (!opts.actions) {
      footer.appendChild(el('button', { class: 'btn', type: 'button', text: 'Close', onclick: closeModal }));
    }

    const dialog = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Dialog' }, [
      el('div', { class: 'modal-head' }, [
        el('h2', { text: opts.title || '' }),
        el('div', { style: 'flex:1' }),
        el('button', { class: 'btn btn-ghost btn-sm btn-icon', type: 'button', 'aria-label': 'Close dialog', onclick: closeModal }, icon('x', 16))
      ]),
      body, footer
    ]);

    backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) closeModal(); } }, dialog);
    document.body.appendChild(backdrop);
    openModal = backdrop;

    const focusable = dialog.querySelectorAll('button, input, select, textarea, a[href]');
    if (focusable.length) focusable[Math.min(1, focusable.length - 1)].focus();

    backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeModal(); }
      if (e.key === 'Tab' && focusable.length) {
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    return { close: closeModal, dialog };
  }

  function closeModal() { if (openModal) { openModal.remove(); openModal = null; } }

  function confirmDialog(title, message, confirmLabel, onConfirm, variant) {
    modal({
      title,
      body: typeof message === 'string' ? el('p', { text: message }) : message,
      actions: [
        { label: 'Cancel' },
        { label: confirmLabel || 'Confirm', variant: variant || 'primary', onClick: onConfirm }
      ]
    });
  }

  /* ------------------------------------------------------------ inputs -- */

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms);
    };
  }

  function autoTextarea(value, placeholder, onInput, rows) {
    const ta = el('textarea', { placeholder: placeholder || '', rows: String(rows || 4) });
    ta.value = value || '';
    ta.addEventListener('input', debounce(() => onInput(ta.value), 400));
    ta.addEventListener('blur', () => onInput(ta.value));
    return ta;
  }

  global.UI = {
    el, frag, clear, appendChildren, icon, ring, button, ICONS,
    minutes, dateLabel, timeAgo, titleCase, statusLabel,
    bar, stat, badge, progressRow, emptyState, bulletList, section, field, select, itemCard,
    toast, modal, closeModal, confirmDialog, debounce, autoTextarea
  };
})(window);
