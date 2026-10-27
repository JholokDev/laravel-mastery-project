/* ============================================================================
 * views-roadmap.js — The guided Zero-to-Expert Roadmap screen
 * ========================================================================== */

(function (global) {
  'use strict';

  const { el, icon, ring, bar, badge, button, titleCase, minutes, toast } = global.UI;
  const Progress = global.Progress;
  const Roadmap = global.Roadmap;
  const Views = global.Views || (global.Views = {});

  Views.roadmap = function (ctx) {
    const phases = Roadmap.phases();
    const sum = Roadmap.summary();
    const cur = Roadmap.current();
    const next = Roadmap.nextItem();
    const totalMin = phases.reduce((a, p) => a + p.items.reduce((x, i) => x + i.estMinutes, 0), 0);
    const doneMin = phases.reduce((a, p) => a + p.items.filter((i) => Progress.isCompleted(i.id)).reduce((x, i) => x + i.estMinutes, 0), 0);

    const root = el('div', { class: 'stack' });

    /* ---- header ---- */
    root.appendChild(el('section', { class: 'card hero' }, [
      el('div', { class: 'hero-main' }, [
        el('div', { class: 'eyebrow', text: 'Guided learning path' }),
        el('h1', { text: 'Zero to Expert Roadmap' }),
        el('p', { class: 'muted', style: 'max-width:60ch', text:
          sum.total + ' hand-written projects in ' + phases.length + ' phases. Each one builds on the last: setup and PHP, Laravel core, databases, real features, security, OAuth, APIs, queues, performance, testing, architecture, business systems and production. ' +
          'Do one project per day and you finish in about ' + Math.ceil(sum.total / 5 * 7) + ' calendar days at five study days a week.' }),
        el('div', { class: 'row', style: 'margin-top:6px' }, [
          next ? button('Continue: ' + next.title, { variant: 'primary', icon: 'play', onClick: () => ctx.go('project', { id: next.id }) })
               : el('span', { class: 'badge completed', text: 'Roadmap complete' }),
          button('Open planner', { icon: 'planner', onClick: () => ctx.go('planner') })
        ]),
        el('p', { class: 'faint small', style: 'margin:14px 0 0', text:
          doneMin ? Math.round(doneMin / 60) + 'h of ' + Math.round(totalMin / 60) + 'h estimated effort completed.' : Math.round(totalMin / 60) + ' hours of estimated effort in total.' })
      ]),
      el('div', { class: 'hero-ring' }, [
        ring(sum.percent, 150, 12, sum.percent + '%', 'of roadmap'),
        el('div', { class: 'ring-caption', text: sum.done + ' of ' + sum.total + ' projects' })
      ])
    ]));

    /* ---- phases ---- */
    const host = el('div');
    phases.forEach((ph) => {
      const pct = ph.total ? Math.round((ph.done / ph.total) * 100) : 0;
      const isCur = cur && ph.index === cur.index && pct < 100;
      const details = el('details', { class: 'phase' + (isCur ? ' current' : '') + (pct === 100 ? ' done' : '') });
      if (isCur || ph.wip) details.open = true;

      details.appendChild(el('summary', {}, [
        el('span', { class: 'num' }, pct === 100 ? icon('check', 16) : String(ph.index + 1)),
        el('span', { class: 'ph-title' }, [
          el('strong', { text: ph.name }),
          el('span', { text: ph.goal })
        ]),
        el('span', { class: 'ph-meta' }, [
          badge(titleCase(ph.level), ph.level),
          el('span', { class: 'faint small nowrap', text: ph.done + '/' + ph.total }),
          bar(pct, pct === 100 ? 'ok' : '')
        ]),
        el('span', { class: 'chev' }, icon('chevron', 16))
      ]));

      const body = el('div', { class: 'phase-body' });
      ph.items.forEach((item, idx) => {
        const ip = Progress.itemProgress(item);
        const lock = Progress.lockState(item);
        const isNext = next && next.id === item.id;
        const cls = ip.status === 'completed' ? 'completed' : ip.status === 'in-progress' ? 'in-progress' : (isNext ? 'next' : '');
        const st = ip.status === 'completed' ? icon('check', 14)
          : ip.status === 'in-progress' ? icon('play', 11)
          : lock.state === 'locked' ? icon('lock', 12)
          : isNext ? icon('arrowRight', 13) : null;

        body.appendChild(el('button', { class: 'road-item ' + cls, type: 'button', onclick: () => ctx.go('project', { id: item.id }) }, [
          el('span', { class: 'num-sm', text: String(idx + 1) }),
          el('span', { class: 'st' }, st),
          el('span', { class: 'ri-title', text: item.title }),
          el('span', { class: 'ri-meta' }, [
            badge(titleCase(item.level), item.level),
            el('span', { class: 'nowrap', text: minutes(item.estMinutes) }),
            ip.totalRequired ? el('span', { class: 'nowrap', text: ip.doneRequired + '/' + ip.totalRequired }) : null
          ])
        ]));
      });
      details.appendChild(body);
      host.appendChild(details);
    });
    root.appendChild(host);

    root.appendChild(el('div', { class: 'callout info' }, [
      el('strong', { text: 'Order is advice, not a wall. ' }),
      document.createTextNode('Inside a phase each project lists the previous one as a prerequisite. You can open any project at any time; completion is only recorded when you confirm it.')
    ]));

    return root;
  };
})(window);
