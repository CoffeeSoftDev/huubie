// -- CSS --

function posTicketCSS() {
    if (document.getElementById('pos-ticket-css')) return;

    const css = ''
        + '.pos-tk-host,.pos-tk,.pos-tk-launch{--po-surface:#FFF;--po-sunken:#F9FAFB;--po-line:#E5E7EB;--po-line-hi:#D1D5DB;--po-ink:#111827;--po-ink-2:#374151;--po-muted:#6B7280;--po-hover:#F3F4F6;'
        + '--po-brand:rgb(var(--brand-600,192 90 64));--po-brand-ink:rgb(var(--brand-700,160 72 51));--po-brand-soft:rgb(var(--brand-50,253 243 240));--po-brand-line:rgb(var(--brand-200,243 199 186));'
        + '--po-ring:rgb(var(--brand-600,192 90 64) / .18);--po-warm:#C2410C}'
        + 'body.dark-mode .pos-tk-host,body.dark-mode .pos-tk,body.dark-mode .pos-tk-launch{--po-surface:var(--dk-card,#1F2A37);--po-sunken:var(--dk-sunken,#1a2332);--po-line:var(--dk-line,#374151);--po-line-hi:var(--dk-line-hi,#4B5563);--po-ink:var(--dk-text,#f5f5f5);--po-ink-2:#D1D5DB;'
        + '--po-muted:var(--dk-muted,#9CA3AF);--po-hover:var(--dk-row-hover,#334155);--po-brand-ink:rgb(var(--brand-200,243 199 186));--po-brand-soft:rgb(var(--brand-600,192 90 64) / .16);--po-brand-line:rgb(var(--brand-600,192 90 64) / .45);--po-warm:#fdba74}'

        + '.pos-tk{display:flex;flex-direction:column;flex:1 1 0%;min-width:0;min-height:0;border:1px solid var(--po-line);border-radius:14px;background:var(--po-surface);color:var(--po-ink);overflow:hidden}'
        + '.pos-tk p{margin:0}'
        + '.pos-tk-head{display:flex;align-items:center;gap:10px;flex-shrink:0;padding:12px 14px;border-bottom:1px solid var(--po-line)}'
        + '.pos-tk-ico{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;flex-shrink:0;border-radius:9px;background:var(--po-brand-soft);color:var(--po-brand-ink)}'
        + '.pos-tk-ico svg{width:18px;height:18px}'
        + '.pos-tk-titles{flex:1;min-width:0}'
        + '.pos-tk-title{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;line-height:1.25;color:var(--po-ink)}'
        + '.pos-tk-title > span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.pos-tk-tag{display:inline-flex;align-items:center;height:20px;flex-shrink:0;padding:0 8px;border-radius:999px;background:var(--po-brand-soft);color:var(--po-brand-ink);font-size:10.5px;font-weight:700;letter-spacing:.02em;text-transform:uppercase}'
        + '.pos-tk-sub{font-size:12px;line-height:1.35;color:var(--po-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + 'button.pos-tk-close{display:none;align-items:center;justify-content:center;width:34px;height:34px;flex-shrink:0;padding:0;border:1px solid var(--po-line-hi);border-radius:9px;background:var(--po-surface);color:var(--po-ink-2);cursor:pointer}'
        + 'button.pos-tk-close:hover{background:var(--po-hover);color:var(--po-ink)}'
        + 'button.pos-tk-close svg{width:16px;height:16px}'

        + '.pos-tk-body{flex:1 1 0%;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}'
        + '.pos-tk-sec{border-bottom:1px solid var(--po-line);background:color-mix(in srgb,#ea580c 5%,var(--po-surface))}'
        + 'button.pos-tk-sec-btn{display:flex;align-items:center;gap:8px;width:100%;min-height:42px;padding:8px 14px;border:0;background:transparent;color:var(--po-ink);text-align:left;cursor:pointer}'
        + 'button.pos-tk-sec-btn:hover{background:color-mix(in srgb,#ea580c 5%,transparent)}'
        + 'button.pos-tk-sec-btn:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--po-ring)}'
        + 'button.pos-tk-sec-btn svg{width:16px;height:16px;flex-shrink:0;color:var(--po-warm)}'
        + 'button.pos-tk-sec-btn b{flex-shrink:0;font-size:12.5px;font-weight:700}'
        + '.pos-tk-sec-sum{flex:1;min-width:0;font-size:11.5px;color:var(--po-muted);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + 'button.pos-tk-sec-btn svg.pos-tk-chev{color:var(--po-muted);transition:transform .15s}'
        + '.pos-tk-sec.is-open svg.pos-tk-chev{transform:rotate(180deg)}'
        + '.pos-tk-sec.is-open .pos-tk-sec-sum{visibility:hidden}'
        + '.pos-tk-sec-body{display:none;padding:0 14px 12px}'
        + '.pos-tk-sec.is-open .pos-tk-sec-body{display:block}'
        + '.pos-tk-lines-head{display:flex;align-items:center;gap:8px;min-height:42px;padding:8px 14px;border-bottom:1px solid var(--po-line);background:var(--po-sunken);color:var(--po-ink)}'
        + '.pos-tk-lines-head svg{width:16px;height:16px;flex-shrink:0;color:var(--po-brand-ink)}'
        + '.pos-tk-lines-head b{flex-shrink:0;font-size:12.5px;font-weight:700}'
        + '.pos-tk-lines-count{flex:1;min-width:0;font-size:11.5px;color:var(--po-muted);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + 'button.pos-tk-lines-head{width:100%;border:0;border-bottom:1px solid var(--po-line);background:var(--po-sunken);text-align:left;cursor:pointer}'
        + 'button.pos-tk-lines-head:hover{background:var(--po-hover)}'
        + 'button.pos-tk-lines-head:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--po-ring)}'
        + 'button.pos-tk-lines-head svg.pos-tk-chev{color:var(--po-muted);transform:rotate(180deg);transition:transform .15s}'
        + '.pos-tk-acc.is-sec-open button.pos-tk-lines-head svg.pos-tk-chev{transform:none}'
        + '.pos-tk-acc.is-sec-open .pos-tk-lines{display:none}'
        + '.pos-tk-foot{flex-shrink:0;border-top:1px solid var(--po-line);background:var(--po-sunken)}'

        // Pestañas (tabs: true): datos y lista, una a la vez; el pie (totales y cobro) solo con la lista.
        + '.pos-tk-tabbar{display:flex;gap:4px;flex-shrink:0;padding:6px 8px 0;border-bottom:1px solid var(--po-line)}'
        + 'button.pos-tk-tab{position:relative;display:flex;align-items:center;gap:8px;flex:1 1 0%;min-width:0;margin:0;padding:8px 10px 10px;border:0;border-radius:9px 9px 0 0;background:transparent;color:var(--po-muted);text-align:left;cursor:pointer;transition:background-color .15s,color .15s}'
        + 'button.pos-tk-tab::after{content:"";position:absolute;left:8px;right:8px;bottom:-1px;height:2px;border-radius:2px;background:transparent}'
        + 'button.pos-tk-tab.is-on{color:var(--po-ink)}'
        + 'button.pos-tk-tab.is-on::after{background:var(--po-brand)}'
        + 'button.pos-tk-tab:not(:disabled):not(.is-on):hover{background:var(--po-hover);color:var(--po-ink)}'
        + 'button.pos-tk-tab:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--po-ring)}'
        + 'button.pos-tk-tab:disabled{cursor:not-allowed}'
        + 'button.pos-tk-tab svg{width:16px;height:16px;flex-shrink:0}'
        + 'button.pos-tk-tab.is-on svg.pos-tk-tab-ico{color:var(--po-brand-ink)}'
        + '.pos-tk-tab-text{display:flex;flex-direction:column;flex:1;min-width:0}'
        + '.pos-tk-tab-text b{font-size:12.5px;font-weight:700;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.pos-tk-tab-text span{font-size:11px;line-height:1.3;color:var(--po-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + 'button.pos-tk-tab svg.pos-tk-tab-lock{display:none;width:14px;height:14px}'
        + 'button.pos-tk-tab.is-locked{opacity:.6}'
        + 'button.pos-tk-tab.is-locked svg.pos-tk-tab-lock{display:block}'
        + '.pos-tk-pane{display:none}'
        + '.pos-tk-pane.is-on{display:block}'
        + '.pos-tk-tabbed.is-tab-data .pos-tk-foot{display:none}'

        + '.pos-tkl{display:flex;flex-direction:column;gap:8px;padding:12px 14px}'
        + '.pos-tkl-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:36px 16px;text-align:center;color:var(--po-muted)}'
        + '.pos-tkl-empty svg{width:28px;height:28px;margin-bottom:6px;opacity:.7}'
        + '.pos-tkl-empty-title{font-size:14px;font-weight:600;color:var(--po-ink-2)}'
        + '.pos-tkl-empty-text{font-size:12.5px}'
        + '.pos-tkl-item{display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--po-line);border-radius:11px;background:var(--po-surface);transition:border-color .15s}'
        + '.pos-tkl-item:hover{border-color:var(--po-line-hi)}'
        + '.pos-tkl-item.is-new{animation:posTkNew .9s ease-out}'
        + '@keyframes posTkNew{0%{background:var(--po-brand-soft);box-shadow:0 0 0 2px var(--po-brand-line)}100%{background:var(--po-surface);box-shadow:0 0 0 0 transparent}}'
        + 'button.pos-tkl-ico{position:relative;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;flex-shrink:0;padding:0;border:0;border-radius:9px;background:color-mix(in srgb,var(--tone,#9CA3AF) 12%,var(--po-surface));color:var(--tone,#6B7280);overflow:hidden;cursor:pointer}'
        + 'button.pos-tkl-ico img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .2s}'
        + 'button.pos-tkl-ico img.is-ready{opacity:1}'
        + 'body.dark-mode button.pos-tkl-ico{background:color-mix(in srgb,var(--tone,#9CA3AF) 18%,var(--po-surface));color:color-mix(in srgb,var(--tone,#9CA3AF) 60%,#fff)}'
        + 'button.pos-tkl-ico svg{width:17px;height:17px}'
        + '.pos-tkl-main{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}'
        + '.pos-tkl-top{display:flex;align-items:flex-start;gap:8px}'
        + 'button.pos-tkl-name{flex:1;min-width:0;padding:0;border:0;background:transparent;color:var(--po-ink);font-size:13px;font-weight:600;line-height:1.3;text-align:left;overflow-wrap:anywhere;cursor:pointer}'
        + 'button.pos-tkl-name:hover{color:var(--po-brand-ink)}'
        + '.pos-tkl-amount{flex-shrink:0;font-size:13.5px;font-weight:700;line-height:1.3;font-variant-numeric:tabular-nums;color:var(--po-ink)}'
        + '.pos-tkl-subs{display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px}'
        + '.pos-tkl-chip{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:999px;font-size:10.5px;font-weight:700;line-height:1;white-space:nowrap}'
        + '.pos-tkl-chip.t-purple{background:#F5F3FF;color:#6D28D9}'
        + '.pos-tkl-chip.t-gray{background:#F3F4F6;color:#4B5563}'
        + 'body.dark-mode .pos-tkl-chip.t-purple{background:rgba(196,181,253,.16);color:#c4b5fd}'
        + 'body.dark-mode .pos-tkl-chip.t-gray{background:rgba(209,213,219,.16);color:#D1D5DB}'
        + '.pos-tkl-sub{display:inline-flex;align-items:center;gap:4px;min-width:0;font-size:11.5px;line-height:1.35;color:var(--po-muted)}'
        + '.pos-tkl-sub svg{width:12px;height:12px;flex-shrink:0}'
        + '.pos-tkl-sub.is-mods,.pos-tkl-sub.is-dedication,.pos-tkl-sub.is-note{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;width:100%;overflow:hidden;overflow-wrap:anywhere}'
        + '.pos-tkl-sub.is-mods{color:var(--po-ink-2)}'
        + '.pos-tkl-sub.is-dedication{font-style:italic;color:var(--po-ink-2)}'
        + 'button.pos-tkl-sub.is-link{margin:0;padding:0;border:0;border-radius:4px;background:transparent;color:var(--po-brand-ink);font-weight:600;cursor:pointer}'
        + 'button.pos-tkl-sub.is-link:hover{text-decoration:underline}'
        + 'button.pos-tkl-sub.is-link:focus-visible{outline:none;box-shadow:0 0 0 3px var(--po-ring)}'
        + '.pos-tkl-bottom{display:flex;align-items:center;gap:8px;margin-top:2px}'
        + '.pos-tkl-qty{display:inline-flex;align-items:center;gap:2px;height:28px;flex-shrink:0;padding:2px;border:1px solid var(--po-line-hi);border-radius:8px;background:var(--po-surface)}'
        + '.pos-tkl-qty b{min-width:24px;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;text-align:center;color:var(--po-ink)}'
        + 'button.pos-tkl-step{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--po-muted);cursor:pointer}'
        + 'button.pos-tkl-step:not(:disabled):hover{background:var(--po-hover);color:var(--po-ink)}'
        + 'button.pos-tkl-step:disabled{opacity:.4;cursor:not-allowed}'
        + 'button.pos-tkl-step svg{width:14px;height:14px}'
        + '.pos-tkl-unit{flex:1;min-width:0;font-size:11.5px;font-variant-numeric:tabular-nums;color:var(--po-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.pos-tkl-acts{display:flex;gap:2px;flex-shrink:0}'
        + 'button.pos-tkl-act{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--po-muted);cursor:pointer}'
        + 'button.pos-tkl-act:hover{background:var(--po-hover);color:var(--po-ink)}'
        + 'button.pos-tkl-act svg{width:15px;height:15px}'
        + 'button.pos-tkl-step.is-del:hover,button.pos-tkl-act.is-del:hover{background:#FEF2F2;color:#DC2626}'
        + 'body.dark-mode button.pos-tkl-step.is-del:hover,body.dark-mode button.pos-tkl-act.is-del:hover{background:rgba(248,113,113,.16);color:#fca5a5}'
        + 'button.pos-tkl-ico:focus-visible,button.pos-tkl-name:focus-visible,button.pos-tkl-step:focus-visible,button.pos-tkl-act:focus-visible{outline:none;box-shadow:0 0 0 3px var(--po-ring)}'
        + 'button.pos-tkl-act.is-on{background:#FEF3C7;color:#B45309}'
        + 'body.dark-mode button.pos-tkl-act.is-on{background:rgba(251,191,36,.16);color:#fbbf24}'
        + '.pos-tkl-sub.is-discount{font-weight:600;color:#B45309}'
        + 'body.dark-mode .pos-tkl-sub.is-discount{color:#fbbf24}'
        + 'input.pos-tkl-num{width:34px;height:22px !important;padding:0 !important;border:0;border-radius:6px;background:transparent;color:var(--po-ink);font-size:13px !important;font-weight:700;font-variant-numeric:tabular-nums;text-align:center;box-shadow:none}'
        + 'input.pos-tkl-num:focus{outline:none;background:var(--po-hover);box-shadow:0 0 0 2px var(--po-ring)}'

        + '.pos-tkt{display:flex;flex-direction:column;gap:8px;padding:12px 14px 14px}'
        + '.pos-tkt-rows{display:flex;flex-direction:column;gap:3px}'
        + '.pos-tkt-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:12.5px;line-height:1.4;color:var(--po-ink-2)}'
        + '.pos-tkt-row b{font-weight:600;font-variant-numeric:tabular-nums}'
        + '.pos-tkt-row.is-muted{color:var(--po-muted)}'
        + '.pos-tkt-row.is-discount{color:#B45309}'
        + '.pos-tkt-row.is-paid{color:#059669}'
        + '.pos-tkt-row.is-due{color:#C2410C}'
        + '.pos-tkt-row.is-due b{font-weight:700}'
        + 'body.dark-mode .pos-tkt-row.is-discount{color:#fbbf24}'
        + 'body.dark-mode .pos-tkt-row.is-paid{color:#34d399}'
        + 'body.dark-mode .pos-tkt-row.is-due{color:#fb923c}'
        + '.pos-tkt-total{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}'
        + '.pos-tkt-total-label{font-size:14px;font-weight:700;line-height:1.3;color:var(--po-ink)}'
        + '.pos-tkt-total-caption{font-size:11.5px;line-height:1.3;color:var(--po-muted)}'
        + '.pos-tkt-total b{font-size:22px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;color:var(--po-ink)}'
        + '.pos-tkt-actions{display:flex;gap:8px;margin-top:2px}'
        + 'button.pos-tkt-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:44px;padding:0 16px;border:1px solid transparent;border-radius:10px;font-size:14px;font-weight:600;line-height:1;white-space:nowrap;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s,box-shadow .15s}'
        + 'button.pos-tkt-btn svg{width:16px;height:16px;flex-shrink:0}'
        + 'button.pos-tkt-btn:disabled{opacity:.45;cursor:not-allowed}'
        + 'button.pos-tkt-btn:focus-visible{outline:none;box-shadow:0 0 0 3px var(--po-ring)}'
        + 'button.pos-tkt-btn.is-ghost{border-color:var(--po-line-hi);background:var(--po-surface);color:var(--po-ink-2)}'
        + 'button.pos-tkt-btn.is-ghost:not(:disabled):hover{background:var(--po-hover);color:var(--po-ink)}'
        + 'button.pos-tkt-btn.is-ok{flex:1;min-width:0;background:#059669;color:#fff}'
        + 'button.pos-tkt-btn.is-ok:not(:disabled):hover{background:#047857}'

        + 'button.pos-tk-launch{display:none;align-items:center;gap:12px;width:100%;height:52px;padding:0 16px;border:0;border-radius:12px;background:var(--po-brand);color:#fff;font-size:14px;font-weight:600;line-height:1;cursor:pointer}'
        + 'button.pos-tk-launch svg{width:19px;height:19px}'
        + '.pos-tk-launch-ico{position:relative;display:inline-flex;flex-shrink:0}'
        + '.pos-tk-launch-count{position:absolute;top:-9px;right:-11px;display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#fff;color:rgb(var(--brand-700,160 72 51));font-size:10.5px;font-weight:700}'
        + '.pos-tk-launch-text{flex:1;min-width:0;padding-left:4px;text-align:left}'
        + 'button.pos-tk-launch b{flex-shrink:0;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}'

        + '@media (max-width:767px){'
        + '.pos-tk-host{display:none !important}'
        + 'body.pos-tk-open .pos-tk-host{display:flex !important;position:fixed;inset:64px 0 0 0;z-index:45;width:auto;padding:10px;background:var(--po-sunken)}'
        + 'button.pos-tk-close{display:inline-flex}'
        + 'button.pos-tk-launch{display:flex}'
        + '}'
        + 'body.pos-tk-open > .select2-container--open{z-index:46 !important}';

    const style = document.createElement('style');

    style.id          = 'pos-ticket-css';
    style.textContent = css;

    document.head.appendChild(style);
}

// -- Ícono --

function posTicketIcon(name, className) {
    const el = $('<i>', { 'data-lucide': name, 'aria-hidden': 'true' });

    return className ? el.addClass(className) : el;
}

// -- Ticket --

Templates.prototype.posTicket = function (options) {
    const defaults = {
        parent:   'root',
        id:       'posTicket',
        class:    '',
        title:    'Ticket',
        subtitle: '',
        tag:      '',
        icon:     'receipt-text',
        section:  { title: 'Datos', icon: 'calendar-days', open: true },
        // Con título, las partidas llevan su propio encabezado (segunda sección).
        // Vacío: las partidas van sin encabezado, como siempre.
        // accordion: solo una de las dos abierta. Con los datos abiertos la lista
        // se pliega a su encabezado; al cerrar los datos, la lista ocupa todo el ticket.
        lines:    { title: '', icon: 'shopping-cart', accordion: false, locked: false, lockText: 'Primero completa los datos' },
        // true: datos y lista en dos pestañas (necesita lines.title). El pie solo se ve
        // con la lista. lines.locked apaga la de la lista (lock). beforeTab(name) en false
        // detiene el cambio que pide un clic.
        tabs:      false,
        beforeTab: null,
        launcher: { parent: '', text: 'Ver ticket' }
    };

    const opts     = Object.assign({}, defaults, options);
    const section  = Object.assign({}, defaults.section, opts.section);
    const list     = Object.assign({}, defaults.lines, opts.lines);
    const launcher = Object.assign({}, defaults.launcher, opts.launcher);
    const tabbed   = Boolean(opts.tabs && list.title);

    posTicketCSS();

    const host   = $(`#${opts.parent}`);
    const root   = $('<aside>', { id: opts.id, class: `pos-tk ${opts.class}`.trim(), 'aria-label': opts.title });
    const head   = $('<div>', { class: 'pos-tk-head' });
    const titles = $('<div>', { class: 'pos-tk-titles' });
    const name   = $('<p>', { class: 'pos-tk-title' }).append($('<span>', { text: opts.title }));
    const shut   = $('<button>', { type: 'button', class: 'pos-tk-close', 'aria-label': 'Cerrar' }).append(posTicketIcon('x'));
    const body   = $('<div>', { class: 'pos-tk-body' });
    const sec    = $('<div>', { class: 'pos-tk-sec' });
    const toggle = $('<button>', { type: 'button', class: 'pos-tk-sec-btn', 'aria-controls': `${opts.id}Form` });
    const form   = $('<div>', { id: `${opts.id}Form`, class: tabbed ? 'pos-tk-pane' : 'pos-tk-sec-body' });
    const lines  = $('<div>', { id: `${opts.id}Lines`, class: 'pos-tk-lines' });
    const foot   = $('<div>', { id: `${opts.id}Foot`, class: 'pos-tk-foot' });
    const accordion = Boolean(list.title && list.accordion && !tabbed);
    const listHead  = accordion
        ? $('<button>', { type: 'button', class: 'pos-tk-lines-head', 'aria-controls': `${opts.id}Lines` })
        : $('<div>', { class: 'pos-tk-lines-head' });

    // -- Pestañas --

    // Cada una: ícono, título y debajo su resumen (#{id}Summary / #{id}LinesCount, los escribe quien pinta).
    const tabOf = (key, conf, caption, pane) => $('<button>', { type: 'button', class: 'pos-tk-tab', role: 'tab', 'data-tab': key, 'aria-controls': pane }).append(
        posTicketIcon(conf.icon, 'pos-tk-tab-ico'),
        $('<span>', { class: 'pos-tk-tab-text' }).append($('<b>', { text: conf.title }), $('<span>', { id: caption })),
        key === 'lines' ? posTicketIcon('lock', 'pos-tk-tab-lock') : ''
    );

    const tabData  = tabbed ? tabOf('data', section, `${opts.id}Summary`, `${opts.id}Form`) : $();
    const tabLines = tabbed ? tabOf('lines', list, `${opts.id}LinesCount`, `${opts.id}Lines`) : $();
    let locked     = false;

    const setTab = (key) => {
        if (!tabbed || (key === 'lines' && locked)) return;

        const onLines = key === 'lines';

        root.toggleClass('is-tab-data', !onLines).toggleClass('is-tab-lines', onLines);
        tabData.toggleClass('is-on', !onLines).attr('aria-selected', String(!onLines));
        tabLines.toggleClass('is-on', onLines).attr('aria-selected', String(onLines));
        form.toggleClass('is-on', !onLines);
        lines.toggleClass('is-on', onLines);
        body.scrollTop(0);
    };

    // Lista apagada: con candado y sin clic. Si estaba a la vista, vuelven los datos.
    const setLock = (on) => {
        if (!tabbed) return;

        locked = !!on;

        tabLines.prop('disabled', locked).toggleClass('is-locked', locked).attr('title', locked ? list.lockText : null);

        if (locked && tabLines.hasClass('is-on')) setTab('data');
    };

    const askTab = (key) => {
        if (opts.beforeTab && opts.beforeTab(key) === false) return;

        setTab(key);
    };

    const setSection = (open) => {
        if (tabbed) return setTab(open ? 'data' : 'lines');

        sec.toggleClass('is-open', !!open);
        toggle.attr('aria-expanded', open ? 'true' : 'false');

        if (!accordion) return;

        root.toggleClass('is-sec-open', !!open);
        listHead.attr('aria-expanded', open ? 'false' : 'true');
        body.scrollTop(0);
    };

    const setOverlay = (open) => {
        $('body').toggleClass('pos-tk-open', !!open);
    };

    if (opts.tag) name.append($('<span>', { class: 'pos-tk-tag', text: opts.tag }));

    titles.append(name);

    if (opts.subtitle) titles.append($('<p>', { class: 'pos-tk-sub', text: opts.subtitle }));

    head.append($('<span>', { class: 'pos-tk-ico' }).append(posTicketIcon(opts.icon)), titles, shut);

    if (tabbed) {
        // Pestañas: la barra bajo el encabezado y una sola parte a la vista.
        lines.addClass('pos-tk-pane');
        body.append(form, lines);
        root.addClass('pos-tk-tabbed').append(head, $('<div>', { class: 'pos-tk-tabbar', role: 'tablist' }).append(tabData, tabLines), body, foot);

        setLock(list.locked);
        setTab(section.open || locked ? 'data' : 'lines');

        tabData.on('click', () => askTab('data'));
        tabLines.on('click', () => askTab('lines'));
    } else {
        toggle.append(
            posTicketIcon(section.icon),
            $('<b>', { text: section.title }),
            $('<span>', { id: `${opts.id}Summary`, class: 'pos-tk-sec-sum' }),
            posTicketIcon('chevron-down', 'pos-tk-chev')
        );

        sec.append(toggle, form);
        body.append(sec);

        // Encabezado de las partidas: ícono, título y, a la derecha, el conteo
        // (lo escribe quien pinta los totales en #{id}LinesCount).
        if (list.title) {
            listHead.append(
                posTicketIcon(list.icon),
                $('<b>', { text: list.title }),
                $('<span>', { id: `${opts.id}LinesCount`, class: 'pos-tk-lines-count' })
            );

            if (accordion) listHead.append(posTicketIcon('chevron-down', 'pos-tk-chev'));

            body.append(listHead);
        }

        body.append(lines);
        root.toggleClass('pos-tk-acc', accordion).append(head, body, foot);

        setSection(section.open);

        toggle.on('click', () => setSection(!sec.hasClass('is-open')));

        // En acordeón, tocar la lista pliega los datos (y al revés).
        if (accordion) listHead.on('click', () => setSection(!sec.hasClass('is-open')));
    }

    shut.on('click', () => setOverlay(false));

    host.addClass('pos-tk-host').html(root);

    if (window.lucide) lucide.createIcons({ root: root[0] });

    if (launcher.parent) {
        const launch = $('<button>', { type: 'button', id: `${opts.id}Launcher`, class: 'pos-tk-launch' });

        launch.append(
            $('<span>', { class: 'pos-tk-launch-ico' }).append(posTicketIcon('shopping-cart'), $('<span>', { id: `${opts.id}LauncherCount`, class: 'pos-tk-launch-count', text: '0' })),
            $('<span>', { class: 'pos-tk-launch-text', text: launcher.text }),
            $('<b>', { id: `${opts.id}LauncherTotal` })
        );

        launch.on('click', () => setOverlay(true));

        $(`#${launcher.parent}`).html(launch);

        if (window.lucide) lucide.createIcons({ root: launch[0] });
    }

    return { section: setSection, overlay: setOverlay, tab: setTab, lock: setLock };
};

// -- Partidas --

Templates.prototype.posTicketLines = function (options) {
    const defaults = {
        parent:   'root',
        id:       'posTicketLines',
        class:    '',
        json:     [],
        max:      9999,
        empty:    { title: 'Pedido vacío', text: 'Toca un producto o búscalo con Ctrl K.' },
        typing:   false,
        // true: con cantidad 1 el «−» se vuelve bote y quita la partida.
        // false: siempre «−», apagado en 1 (la partida se quita con el bote de la derecha).
        stepDelete: true,
        onUpdate: () => { },
        onEdit:   () => { },
        onDelete: () => { },
        onDiscount: null
    };

    const opts = Object.assign({}, defaults, options);
    const root = $('<div>', { id: opts.id, class: `pos-tkl ${opts.class}`.trim() });
    let fresh  = null;

    posTicketCSS();

    // Cantidad que se puede escribir (typing): Enter o salir del campo la aplica;
    // un número fuera de 1..max regresa al que tenía.
    const typed = (index, quantity) => {
        const input = $('<input>', {
            type: 'text', class: 'pos-tkl-num', inputmode: 'numeric', maxlength: String(opts.max).length,
            value: String(quantity), 'aria-label': 'Cantidad'
        });
        let done = false;

        const commit = () => {
            if (done) return;

            const raw = String(input.val()).trim();
            const n   = Number(raw);

            if (!/^\d+$/.test(raw) || n < 1 || n > opts.max) {
                input.val(String(quantity));
                return;
            }

            if (n === quantity) return;

            done = true;
            opts.onUpdate(index, n);
        };

        input.on('focus', () => input.select());
        input.on('change', commit);

        input.on('keydown', (e) => {
            if (e.key !== 'Enter') return;

            e.preventDefault();
            commit();
        });

        return input;
    };

    const row = (line, index) => {
        const quantity = Number(line.quantity) || 1;
        const single   = quantity <= 1;
        const trash    = single && opts.stepDelete;
        const el       = $('<div>', { class: 'pos-tkl-item', 'data-index': index });
        const main     = $('<div>', { class: 'pos-tkl-main' });
        const top      = $('<div>', { class: 'pos-tkl-top' });
        const subs     = $('<div>', { class: 'pos-tkl-subs' });
        const bottom   = $('<div>', { class: 'pos-tkl-bottom' });
        const qty      = $('<div>', { class: 'pos-tkl-qty' });
        const acts     = $('<div>', { class: 'pos-tkl-acts' });
        const thumb    = $('<button>', { type: 'button', class: 'pos-tkl-ico', 'aria-label': `Editar ${line.name}` }).append(posTicketIcon(line.icon || 'package'));
        const label    = $('<button>', { type: 'button', class: 'pos-tkl-name', text: line.name });
        const less     = $('<button>', { type: 'button', class: `pos-tkl-step${trash ? ' is-del' : ''}`, 'aria-label': trash ? 'Quitar' : 'Menos' }).append(posTicketIcon(trash ? 'trash-2' : 'minus'));
        const more     = $('<button>', { type: 'button', class: 'pos-tkl-step', 'aria-label': 'Más' }).append(posTicketIcon('plus'));
        const edit     = $('<button>', { type: 'button', class: 'pos-tkl-act', 'aria-label': 'Editar' }).append(posTicketIcon('pencil'));
        const remove   = $('<button>', { type: 'button', class: 'pos-tkl-act is-del', 'aria-label': 'Quitar' }).append(posTicketIcon('trash-2'));

        if (line.tone) el[0].style.setProperty('--tone', line.tone);

        // Foto opcional sobre el ícono: si no carga, prueba imageFallback y luego queda el ícono.
        if (line.image) {
            const img = $('<img>', { loading: 'lazy', alt: '', src: line.image });

            img.on('load', () => img.addClass('is-ready'));

            img.on('error', () => {
                if (line.imageFallback && img.attr('src') !== line.imageFallback) {
                    img.attr('src', line.imageFallback);
                    return;
                }

                img.remove();
            });

            thumb.append(img);
        }

        if (line.isNew) {
            el.addClass('is-new');
            fresh = el;
        }

        if (line.chip) subs.append($('<span>', { class: `pos-tkl-chip t-${line.chip.tone || 'gray'}`, text: line.chip.text }));

        // Con onClick el detalle se vuelve botón (ej. «3 fotos» abre el visor).
        (line.sub || []).forEach((sub) => {
            const tag  = sub.onClick ? '<button>' : '<span>';
            const part = $(tag, { class: `pos-tkl-sub${sub.tone ? ` is-${sub.tone}` : ''}${sub.onClick ? ' is-link' : ''}` });

            if (sub.onClick) part.attr('type', 'button').on('click', sub.onClick);
            if (sub.icon) part.append(posTicketIcon(sub.icon), ' ');

            part.append($('<span>', { text: sub.text }));
            subs.append(part);
        });

        if (quantity >= opts.max) more.prop('disabled', true);
        if (single && !trash)     less.prop('disabled', true);

        thumb.on('click', () => opts.onEdit(index));
        label.on('click', () => opts.onEdit(index));
        edit.on('click', () => opts.onEdit(index));
        remove.on('click', () => opts.onDelete(index));
        more.on('click', () => opts.onUpdate(index, quantity + 1));

        less.on('click', () => {
            if (trash) {
                opts.onDelete(index);
                return;
            }

            opts.onUpdate(index, quantity - 1);
        });

        qty.append(less, opts.typing ? typed(index, quantity) : $('<b>', { text: String(quantity) }), more);

        // Opcional: botón de descuento por partida (resaltado si la partida ya lo tiene).
        if (opts.onDiscount) {
            const off = $('<button>', { type: 'button', class: `pos-tkl-act${line.discounted ? ' is-on' : ''}`, 'aria-label': 'Descuento' }).append(posTicketIcon('tag'));

            off.on('click', () => opts.onDiscount(index));
            acts.append(off);
        }

        acts.append(edit, remove);
        top.append(label, $('<b>', { class: 'pos-tkl-amount', text: line.amount }));
        bottom.append(qty, $('<span>', { class: 'pos-tkl-unit', text: line.unit || '' }), acts);
        main.append(top);

        if (subs.children().length) main.append(subs);

        main.append(bottom);
        el.append(thumb, main);

        return el;
    };

    if (!opts.json.length) {
        root.append(
            $('<div>', { class: 'pos-tkl-empty' }).append(
                posTicketIcon('shopping-cart'),
                $('<p>', { class: 'pos-tkl-empty-title', text: opts.empty.title }),
                $('<p>', { class: 'pos-tkl-empty-text', text: opts.empty.text })
            )
        );
    }

    opts.json.forEach((line, index) => root.append(row(line, index)));

    $(`#${opts.parent}`).html(root);

    if (window.lucide) lucide.createIcons({ root: root[0] });

    const box = root.closest('.pos-tk-body')[0];

    if (fresh && box) {
        const itemRect = fresh[0].getBoundingClientRect();
        const boxRect  = box.getBoundingClientRect();
        const top      = itemRect.top - boxRect.top + box.scrollTop;
        const bottom   = top + itemRect.height;

        if (top < box.scrollTop) box.scrollTop = top - 8;
        else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 8;
    }
};

// -- Totales --

Templates.prototype.posTicketTotals = function (options) {
    const defaults = {
        parent:  'root',
        id:      'posTicketTotals',
        class:   '',
        json:    [],
        total:   { label: 'Total', caption: '', value: '' },
        after:   [],
        actions: []
    };

    const opts    = Object.assign({}, defaults, options);
    const total   = Object.assign({}, defaults.total, opts.total);
    const root    = $('<div>', { id: opts.id, class: `pos-tkt ${opts.class}`.trim() });
    const summary = $('<div>', { class: 'pos-tkt-total' });
    const caption = $('<div>').append($('<p>', { class: 'pos-tkt-total-label', text: total.label }));
    const actions = $('<div>', { class: 'pos-tkt-actions' });

    posTicketCSS();

    const rows = (list) => {
        const box = $('<div>', { class: 'pos-tkt-rows' });

        list.forEach((item) => {
            box.append(
                $('<div>', { class: `pos-tkt-row${item.tone ? ` is-${item.tone}` : ''}` }).append(
                    $('<span>', { text: item.text }),
                    $('<b>', { text: item.value })
                )
            );
        });

        return box;
    };

    if (total.caption) caption.append($('<p>', { class: 'pos-tkt-total-caption', text: total.caption }));

    summary.append(caption, $('<b>', { text: total.value }));

    opts.actions.forEach((action) => {
        const el = $('<button>', { type: 'button', class: `pos-tkt-btn is-${action.class || 'ghost'}` });

        if (action.id) el.attr('id', action.id);
        if (action.icon) el.append(posTicketIcon(action.icon));

        el.append($('<span>', { text: action.text }));
        el.prop('disabled', !!action.disabled);
        el.on('click', () => action.onClick && action.onClick());

        actions.append(el);
    });

    if (opts.json.length) root.append(rows(opts.json));

    root.append(summary);

    if (opts.after.length) root.append(rows(opts.after));
    if (opts.actions.length) root.append(actions);

    $(`#${opts.parent}`).html(root);

    if (window.lucide) lucide.createIcons({ root: root[0] });
};
