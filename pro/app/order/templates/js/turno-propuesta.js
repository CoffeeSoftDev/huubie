// Maquetas del turno de caja. A: caja en la barra. B: portada de inicio de día.
// C: franja de caja bajo la barra (C1 a C4 cambian solo sus botones). D: caja en el menú lateral.
// C3 y C4 dejan una sola acción de turno: «Cierre del día» se queda en Cortes.
// Todo es simulado: no hay ctrl ni base de datos. El estado vive en `tp` y la
// tira del pie lo cambia para ver cada caso.

(function () {

    const variant = document.body.dataset.variant || 'a';   // a | b | c | d
    const buttons = document.body.dataset.buttons || '';    // C: '' sueltos | '1' grupo | '2' acción + menú | '3' botón de la app | '4' franja que se toca
    const solo    = buttons === '3' || buttons === '4';     // una sola acción: el turno

    const tp = {
        state: 'none',                                  // none | open | old | pending | closed
        role:  'cajera',                                // cajera | consulta
        view:  variant === 'b' ? 'inicio' : 'pedidos',  // inicio | vender | pedidos | calendario | clientes | cortes
        fund:  500,
        after: null,                                    // lo que quedó esperando el turno
        goto:  null                                     // a dónde ir al abrir (portada)
    };

    const USERS = {
        cajera:   { name: 'Andrea M.', rol: 'Cajera',   color: '#C05A40' },
        consulta: { name: 'Luis R.',   rol: 'Consulta', color: '#57534E' }
    };

    const SCOPE = 'Reginas · Matriz';
    const TODAY = '14/11/2026';

    const ORDERS = [
        ['2114', '14/11/2026 · 13:00', 'Mariana Solís',     1850, 900,  'Pendiente',  'amber', 'Recoge en tienda'],
        ['2113', '14/11/2026 · 16:30', 'Despacho Aranda',   3200, 3200, 'Pagado',     'green', 'A domicilio'],
        ['2112', '15/11/2026 · 10:00', 'Karla Ibarra',       980, 300,  'Pendiente',  'amber', 'Recoge en tienda'],
        ['2110', '15/11/2026 · 12:00', 'Hotel Casa Real',   5400, 2700, 'Pendiente',  'amber', 'A domicilio'],
        ['2108', '16/11/2026 · 09:30', 'Jorge Mendoza',      640, 0,    'Cotización', 'gray',  'Recoge en tienda'],
        ['2105', '17/11/2026 · 18:00', 'Fernanda Luna',     2250, 2250, 'Pagado',     'green', 'Recoge en tienda']
    ];

    const PRODUCTS = [
        ['Pastel de chocolate',     420, '#8B5E3C', 'cake'],
        ['Rebanada tres leches',     65, '#D9A066', 'cake-slice'],
        ['Cheesecake frutos rojos', 480, '#B4475A', 'cake'],
        ['Galleta de nuez',          28, '#B08A5B', 'cookie'],
        ['Café americano',           45, '#5B4636', 'coffee'],
        ['Capuchino',                58, '#7A5C45', 'coffee'],
        ['Pay de limón',            320, '#9BB04A', 'pie-chart'],
        ['Brownie',                  38, '#6B4A3A', 'cookie']
    ];

    const EVENTS = { 14: [['13:00 Mariana S.', ''], ['16:30 Despacho A.', 'green']], 15: [['10:00 Karla I.', ''], ['12:00 Hotel Casa R.', '']], 16: [['09:30 Jorge M.', '']], 17: [['18:00 Fernanda L.', 'green']], 20: [['11:00 Boda Ruiz', '']] };

    // -- Ayudantes --

    const $     = (sel) => document.querySelector(sel);
    const money = (n) => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const ico   = (name) => `<i data-lucide="${name}"></i>`;
    const icons = () => { if (window.lucide) lucide.createIcons(); };
    const can   = () => tp.role === 'cajera';

    // Chip del turno: los mismos textos y tonos que paintTurn() de pedidos.js.
    function turn() {
        if (tp.state === 'open')   return { tone: 'is-open',   text: 'Turno 12 · desde 08:05' };
        if (tp.state === 'old')    return { tone: 'is-old',    text: 'Turno 11 de otro día', cta: can() ? { label: 'Cerrar turno 11', act: 'close-old', kind: 'warn', icon: 'lock' } : null };
        if (tp.state === 'closed') return { tone: 'is-closed', text: 'Día cerrado' };

        // Sin turno y con un día anterior sin cerrar: el «Falta cerrar el dd/mm» de paintTurn().
        if (tp.state === 'pending') return { tone: 'is-old', text: 'Falta cerrar el 13/11', cta: can() ? { label: 'Cerrar el 13/11', act: 'close-pending', kind: 'warn', icon: 'calendar-check' } : null };

        return { tone: 'is-none', text: 'Sin turno abierto', cta: can() ? { label: 'Abrir turno', act: 'open-turn', kind: 'ok', icon: 'lock-open' } : null };
    }

    const chip = () => {
        const t = turn();
        return `<span class="ord-turn-chip ${t.tone}"><span class="ord-turn-dot"></span>${t.text}</span>`;
    };

    // -- Barra: la caja (solo propuesta A) --

    function cajaPanel() {
        const item = (act, icon, text, small) => `<button type="button" class="caja-dd-item" data-act="${act}">${ico(icon)}<span>${text}</span>${small ? `<small>${small}</small>` : ''}</button>`;
        const head = (title, text) => `<div class="caja-dd-head"><p class="caja-dd-label">Caja de Matriz</p><p class="caja-dd-title">${title}</p>${text ? `<p class="caja-dd-text">${text}</p>` : ''}</div>`;
        const main = (act, kind, icon, text) => `<button type="button" class="caja-dd-main is-${kind}" data-act="${act}">${ico(icon)}${text}</button>`;

        if (tp.state === 'open') {
            return head('Turno 12 abierto', 'Abrió Andrea M. a las 08:05. Aquí caen las ventas y los pedidos de hoy.')
                + `<div class="caja-dd-stats"><div class="caja-dd-stat"><span>Fondo</span><b>${money(tp.fund)}</b></div><div class="caja-dd-stat"><span>Vendido</span><b>$4,350.00</b></div><div class="caja-dd-stat"><span>Movs.</span><b>9</b></div></div>`
                + `<div class="caja-dd-body">${item('turn-cut', 'clock', 'Turno y corte')}${item('day-close', 'calendar-check', 'Cierre del día')}${item('cuts', 'receipt-text', 'Cortes anteriores')}</div>`;
        }

        if (tp.state === 'old') {
            return head('Turno 11 de otro día', can() ? 'Quedó abierto el 13/11/2026. Ciérralo para poder abrir el de hoy.' : 'Quedó abierto el 13/11/2026. Lo cierra quien cobra, en caja.')
                + `<div class="caja-dd-body">${can() ? main('close-old', 'warn', 'lock', 'Cerrar turno 11') : ''}${item('cuts', 'receipt-text', 'Cortes anteriores')}</div>`;
        }

        if (tp.state === 'pending') {
            return head('Falta cerrar el 13/11', can() ? 'El turno se cerró, pero el día no. Ciérralo para poder abrir el de hoy.' : 'El cierre lo hace quien cobra, en caja.')
                + `<div class="caja-dd-body">${can() ? main('close-pending', 'warn', 'calendar-check', 'Cerrar el 13/11') : ''}${item('cuts', 'receipt-text', 'Cortes anteriores')}</div>`;
        }

        if (tp.state === 'closed') {
            return head('Día cerrado', `El ${TODAY} ya se cerró. Hoy no se abre otro turno.`)
                + `<div class="caja-dd-body">${item('day-close', 'calendar-check', 'Ver cierre del día')}${item('cuts', 'receipt-text', 'Cortes anteriores')}</div>`;
        }

        return head('Sin turno abierto', can() ? 'Sin turno no se puede vender, capturar pedidos ni cobrar.' : 'El turno se abre en caja. Pídeselo a quien cobra.')
            + `<div class="caja-dd-body">${can() ? main('open-turn', 'ok', 'lock-open', 'Abrir turno') : ''}${item('day-close', 'calendar-check', 'Cierre del día')}${item('cuts', 'receipt-text', 'Cortes anteriores')}</div>`;
    }

    function paintCaja() {
        const host = $('#navCaja');

        if (!host) return;

        const t = turn();

        host.innerHTML = ''
            + `<button type="button" class="caja-pill ${t.tone}" data-act="caja-toggle" aria-haspopup="true" aria-expanded="false">`
            +   `<span class="caja-pill-icon">${ico('wallet')}</span>`
            +   `<span class="caja-pill-text"><span class="caja-pill-label">Caja</span><span class="caja-pill-name"><span class="ord-turn-dot"></span>${t.text}</span></span>`
            +   `<i data-lucide="chevron-down" class="caja-pill-chev"></i>`
            + '</button>'
            + (t.cta ? `<button type="button" class="caja-cta is-${t.cta.kind}" data-act="${t.cta.act}">${ico(t.cta.icon)}<span>${t.cta.label}</span></button>` : '')
            + `<div class="caja-dd" id="cajaDropdown" hidden>${cajaPanel()}</div>`;
    }

    function toggleCaja(force) {
        const dd   = $('#cajaDropdown');
        const pill = $('[data-act="caja-toggle"]');

        if (!dd || !pill) return;

        const show = force === undefined ? dd.hidden : force;

        dd.hidden = !show;
        pill.setAttribute('aria-expanded', show ? 'true' : 'false');
    }

    // -- Franja de caja (propuesta C, C1 y C2) --
    // Lo mismo que la pastilla de A, pero a lo ancho y con todo a la vista.
    // stripModel() dice QUÉ acciones hay; stripButtons() decide CÓMO se ven:
    //   C  (''):  botones sueltos, blancos con borde, y el urgente de color.
    //   C1 ('1'): un solo grupo con el color de la franja; el urgente va relleno al inicio.
    //   C2 ('2'): un botón con la acción que toca y una flecha con el resto.
    // main.kind: ok / warn = urgente (abrir, cerrar lo pendiente); tone = la de siempre.

    function stripModel() {
        const cut  = { act: 'turn-cut',  icon: 'clock',          label: 'Turno y corte' };
        const day  = { act: 'day-close', icon: 'calendar-check', label: 'Cierre del día' };
        const cuts = { act: 'cuts',      icon: 'receipt-text',   label: 'Cortes' };

        if (tp.state === 'open') return {
            title: 'Turno 12 abierto',
            text:  'Desde las 08:05 · abrió Andrea M.',
            stats: true,
            main:  { ...cut, kind: 'tone' },
            rest:  [day, cuts]
        };

        if (tp.state === 'old') return {
            title: 'Turno 11 de otro día',
            text:  can() ? 'Quedó abierto el 13/11/2026. Ciérralo para poder abrir el de hoy.' : 'Quedó abierto el 13/11/2026. Lo cierra quien cobra, en caja.',
            main:  can() ? { act: 'close-old', icon: 'lock', label: 'Cerrar turno 11', kind: 'warn' } : null,
            rest:  [cuts]
        };

        if (tp.state === 'pending') return {
            title: 'Falta cerrar el 13/11',
            text:  can() ? 'El turno se cerró, pero el día no. Ciérralo para poder abrir el de hoy.' : 'El cierre lo hace quien cobra, en caja.',
            main:  can() ? { act: 'close-pending', icon: 'calendar-check', label: 'Cerrar el 13/11', kind: 'warn' } : null,
            rest:  [cuts]
        };

        if (tp.state === 'closed') return {
            title: 'Día cerrado',
            text:  `El ${TODAY} ya se cerró. Hoy no se abre otro turno.`,
            main:  { act: 'day-close', icon: 'calendar-check', label: 'Ver cierre del día', kind: 'tone' },
            rest:  [cuts]
        };

        // Sin turno: también es el momento del cierre del día (el turno ya se cortó).
        return {
            title: 'Sin turno abierto',
            text:  can() ? 'Sin turno no se puede vender, capturar pedidos ni cobrar.' : 'El turno se abre en caja. Pídeselo a quien cobra.',
            main:  can() ? { act: 'open-turn', icon: 'lock-open', label: 'Abrir turno', kind: 'ok' } : null,
            rest:  can() ? [day, cuts] : [cuts]
        };
    }

    // C3 y C4: la franja solo maneja el turno. «Cierre del día» vive en Cortes (cortes.js, btnDayCuts)
    // y Cortes ya está en el menú lateral, así que ninguno de los dos se repite aquí.
    function stripSolo() {
        if (tp.state === 'open') return {
            title: 'Turno 12 abierto',
            text:  'Desde las 08:05 · abrió Andrea M.',
            stats: true,
            main:  { act: 'turn-cut', icon: 'clock', label: 'Turno y corte', kind: 'tone' }
        };

        if (tp.state === 'old') return {
            title: 'Turno 11 de otro día',
            text:  can() ? 'Quedó abierto el 13/11/2026. Ciérralo para poder abrir el de hoy.' : 'Quedó abierto el 13/11/2026. Lo cierra quien cobra, en caja.',
            main:  can() ? { act: 'close-old', icon: 'lock', label: 'Cerrar turno 11', kind: 'warn' } : null
        };

        // El día se cierra en Cortes: la franja avisa y lleva ahí, no lo cierra.
        if (tp.state === 'pending') return {
            title: 'Falta cerrar el 13/11',
            text:  can() ? 'El turno se cerró, pero el día no. Se cierra en Cortes; luego abres el de hoy.' : 'El cierre lo hace quien cobra, en Cortes.',
            main:  can() ? { act: 'cuts', icon: 'receipt-text', label: 'Ir a Cortes', kind: 'warn' } : null
        };

        if (tp.state === 'closed') return {
            title: 'Día cerrado',
            text:  `El ${TODAY} ya se cerró. Hoy no se abre otro turno.`,
            main:  null
        };

        return {
            title: 'Sin turno abierto',
            text:  can() ? 'Sin turno no se puede vender, capturar pedidos ni cobrar.' : 'El turno se abre en caja. Pídeselo a quien cobra.',
            main:  can() ? { act: 'open-turn', icon: 'lock-open', label: 'Abrir turno', kind: 'ok' } : null
        };
    }

    function soloButton(m) {
        if (!m.main) return '';

        // -- C3: botón de contorno, sin relleno: borde y letra del color de la acción --
        if (buttons === '3') {
            const kinds = { ok: 'ok', warn: 'warn', tone: 'ok' };

            return `<button type="button" class="caja-out is-${kinds[m.main.kind]}" data-act="${m.main.act}">${ico(m.main.icon)}${m.main.label}</button>`;
        }

        // -- C4: sin botón; el nombre de la acción y una flecha. Toda la franja se toca --
        return `<span class="caja-go is-${m.main.kind}">${m.main.label}<span class="caja-go-arrow">${ico('arrow-right')}</span></span>`;
    }

    function stripButtons(m) {
        const all = (m.main ? [m.main] : []).concat(m.rest);

        // -- C1: grupo integrado --
        if (buttons === '1') {
            const seg = (a) => {
                const fill = a.kind === 'ok' || a.kind === 'warn';
                return `<button type="button" class="caja-seg-item${fill ? ` is-fill is-${a.kind}` : ''}" data-act="${a.act}" title="${a.label}">${ico(a.icon)}<span>${a.label}</span></button>`;
            };

            return `<div class="caja-seg" role="group" aria-label="Acciones de caja">${all.map(seg).join('')}</div>`;
        }

        // -- C2: acción principal + menú --
        // Sin acción propia (quien solo consulta), el primer botón es neutro.
        if (buttons === '2') {
            const first = m.main || { ...m.rest[0], kind: 'plain' };
            const more  = m.main ? m.rest : m.rest.slice(1);
            const item  = (a) => `<button type="button" class="caja-dd-item" data-act="${a.act}">${ico(a.icon)}<span>${a.label}</span></button>`;

            return `<div class="caja-split is-${first.kind}">`
                + `<button type="button" class="caja-split-main${more.length ? ' is-joined' : ''}" data-act="${first.act}">${ico(first.icon)}<span>${first.label}</span></button>`
                + (more.length
                    ? '<button type="button" class="caja-split-more" data-act="split-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Más acciones de caja" title="Más acciones de caja"><i data-lucide="chevron-down"></i></button>'
                      + `<div class="caja-split-menu" hidden>${more.map(item).join('')}</div>`
                    : '')
                + '</div>';
        }

        // -- C: botones sueltos (la versión que no convenció) --
        const kinds = { ok: 'success', warn: 'warn' };

        return all.map((a) => `<button type="button" class="tp-btn tp-btn-${kinds[a.kind] || 'secondary'} sm" data-act="${a.act}">${ico(a.icon)}${a.label}</button>`).join('');
    }

    function paintStrip() {
        const host = $('#cajaStrip');

        if (!host) return;

        const m     = solo ? stripSolo() : stripModel();
        const stats = m.stats ? `<div class="caja-strip-stats"><span>Fondo<b>${money(tp.fund)}</b></span><span>Vendido<b>$4,350.00</b></span><span>Movs.<b>9</b></span></div>` : '';
        const go    = buttons === '4' && m.main;

        // C4: la franja misma lleva la acción; sin acción (Consulta, día cerrado) solo informa.
        host.className = `caja-strip ${turn().tone}${go ? ' is-go' : ''}`;

        if (go) {
            host.dataset.act = m.main.act;
            host.setAttribute('role', 'button');
            host.setAttribute('tabindex', '0');
            host.setAttribute('aria-label', `${m.title}. ${m.main.label}`);
        } else {
            delete host.dataset.act;
            ['role', 'tabindex', 'aria-label'].forEach((a) => host.removeAttribute(a));
        }

        host.innerHTML = ''
            + '<div class="caja-strip-main">'
            +   `<span class="caja-strip-icon">${ico('wallet')}</span>`
            +   `<span class="caja-strip-title"><span class="ord-turn-dot"></span>${m.title}</span>`
            +   `<span class="caja-strip-text">${m.text}</span>`
            + '</div>'
            + stats
            + `<div class="caja-strip-actions">${solo ? soloButton(m) : stripButtons(m)}</div>`;
    }

    function toggleSplit(force) {
        const menu = $('.caja-split-menu');
        const more = $('[data-act="split-toggle"]');

        if (!menu || !more) return;

        const show = force === undefined ? menu.hidden : force;

        menu.hidden = !show;
        more.setAttribute('aria-expanded', show ? 'true' : 'false');
    }

    // -- Caja en el menú lateral (solo propuesta D) --
    // El primer botón del rail es la caja; el panel es el mismo de A, pero sale al lado.

    function paintRail() {
        const host = $('#railCaja');

        if (!host) return;

        const t     = turn();
        const short = { none: 'Sin turno', open: 'Turno 12', old: 'Turno 11', pending: 'Pendiente', closed: 'Cerrado' }[tp.state];

        host.innerHTML = ''
            + `<button type="button" class="menu-rail-item rail-caja ${t.tone}" data-act="caja-toggle" title="Caja · ${t.text}" aria-haspopup="true" aria-expanded="false">`
            +   `${ico('wallet')}<span class="menu-rail-label">Caja</span><span class="rail-caja-state">${short}</span>`
            + '</button>';

        $('#cajaDropdown').innerHTML = cajaPanel();
        $('#cajaDropdown').hidden    = true;
    }

    // -- Encabezado de cada pantalla --
    // A: la caja ya está en la barra, aquí queda solo la acción de la pantalla.
    // B: se queda como hoy (chip y botones de turno dentro de la pantalla).

    function head(title, own) {
        let turnChip = '';
        let turnBtns = '';

        if (variant === 'b') {
            const opens = tp.state === 'none' && can();

            turnChip = chip();
            turnBtns = tp.view === 'pedidos'
                ? `<button type="button" class="tp-btn tp-btn-secondary" data-act="${opens ? 'open-turn' : 'turn-cut'}">${ico(opens ? 'lock-open' : 'clock')}${opens ? 'Abrir turno' : 'Turno y corte'}</button>`
                  + `<button type="button" class="tp-btn tp-btn-success" data-act="day-close">${ico('calendar-check')}Cierre del día</button>`
                : `<button type="button" class="tp-btn tp-btn-secondary" data-act="turn-cut">${ico('clock')}Turno actual</button>`;
        }

        return ''
            + '<div class="tp-head">'
            +   `<div><h1 class="cp-pagina-titulo">${title}</h1><p class="cp-pagina-subtitulo">${SCOPE}</p></div>`
            +   `<div class="tp-head-actions">${turnChip}<div class="tp-btns">${turnBtns}${own || ''}</div></div>`
            + '</div>';
    }

    // -- Pantallas --

    function viewPedidos() {
        const own  = can() ? `<button type="button" class="tp-btn tp-btn-primary" data-act="need" data-label="Nuevo pedido">${ico('plus')}Nuevo pedido</button>` : '';
        const rows = ORDERS.map((o) => ''
            + '<tr>'
            +   `<td><b>${o[0]}</b></td><td>${o[1]}</td><td>${o[2]}</td>`
            +   `<td class="num"><b>${money(o[3])}</b></td><td class="num">${money(o[4])}</td><td class="num">${money(o[3] - o[4])}</td>`
            +   `<td><span class="tp-pill ${o[6]}">${o[5]}</span></td><td>${o[7]}</td>`
            + '</tr>').join('');

        return head('Pedidos', own)
            + '<div class="tp-card">'
            +   '<div class="tp-filters">'
            +     `<div class="tp-field"><span>Periodo</span><div class="tp-fake">14/11/2026 - 20/11/2026${ico('calendar')}</div></div>`
            +     `<div class="tp-field"><span>Estado</span><div class="tp-fake">Todos${ico('chevron-down')}</div></div>`
            +     `<div class="tp-field"><span>Tipo</span><div class="tp-fake">Todos${ico('chevron-down')}</div></div>`
            +     `<div class="tp-field grow"><span>&nbsp;</span><div class="tp-fake is-placeholder">${ico('search')}Buscar folio, cliente o teléfono</div></div>`
            +   '</div>'
            +   '<div class="tp-table-wrap"><table class="tp-table">'
            +     '<thead><tr><th>Folio</th><th>Entrega</th><th>Cliente</th><th class="num">Total</th><th class="num">Abono</th><th class="num">Saldo</th><th>Estado</th><th>Forma de entrega</th></tr></thead>'
            +     `<tbody>${rows}</tbody>`
            +   '</table></div>'
            +   '<div class="tp-table-foot"><span>Mostrando 1 a 6 de 6 pedidos</span><span>‹ 1 ›</span></div>'
            + '</div>';
    }

    function viewVender() {
        const prods = PRODUCTS.map((p) => ''
            + '<div class="tp-prod">'
            +   `<div class="tp-prod-thumb" style="background:${p[2]}">${ico(p[3])}</div>`
            +   `<div class="tp-prod-body"><p class="tp-prod-name">${p[0]}</p><p class="tp-prod-price">${money(p[1])}</p></div>`
            + '</div>').join('');

        return head('Vender')
            + '<div class="tp-sale">'
            +   '<div class="tp-card">'
            +     `<div class="tp-fake is-placeholder">${ico('search')}Buscar producto o código</div>`
            +     '<div class="tp-cats"><span class="tp-cat is-active">Todo</span><span class="tp-cat">Pasteles</span><span class="tp-cat">Rebanadas</span><span class="tp-cat">Galletas</span><span class="tp-cat">Bebidas</span></div>'
            +     `<div class="tp-prods">${prods}</div>`
            +   '</div>'
            +   '<div class="tp-card tp-ticket">'
            +     '<p class="tp-ticket-title">Ticket <small>Público en general</small></p>'
            +     '<div>'
            +       `<div class="tp-line"><span>2 × Rebanada tres leches</span><b>${money(130)}</b></div>`
            +       `<div class="tp-line"><span>1 × Capuchino</span><b>${money(58)}</b></div>`
            +       `<div class="tp-line"><span>3 × Galleta de nuez</span><b>${money(84)}</b></div>`
            +     '</div>'
            +     `<div class="tp-total"><span>Total</span><b>${money(272)}</b></div>`
            +     `<button type="button" class="tp-btn tp-btn-brand lg is-wide" data-act="need" data-label="Cobrar">${ico('banknote')}Cobrar</button>`
            +   '</div>'
            + '</div>';
    }

    function viewCalendario() {
        const dows  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => `<div class="tp-cal-dow">${d}</div>`).join('');
        let   cells = '';

        // Noviembre de 2026 empieza en domingo: la primera fila trae 6 días de octubre.
        for (let i = 0; i < 42; i++) {
            const n   = i - 5;
            const out = n < 1 || n > 30;
            const day = n < 1 ? 31 + n : (n > 30 ? n - 30 : n);
            const evs = !out && EVENTS[n] ? EVENTS[n].map((e) => `<span class="tp-cal-ev ${e[1]}">${e[0]}</span>`).join('') : '';

            cells += `<div class="tp-cal-day${out ? ' is-out' : ''}${!out && n === 14 ? ' is-today' : ''}"><span>${day}</span>${evs}</div>`;
        }

        return head('Calendario')
            + '<div class="tp-card">'
            +   `<div class="tp-cal-head"><p class="tp-cal-month">Noviembre de 2026</p><div class="tp-btns"><button type="button" class="tp-btn tp-btn-secondary">${ico('chevron-left')}</button><button type="button" class="tp-btn tp-btn-secondary">Hoy</button><button type="button" class="tp-btn tp-btn-secondary">${ico('chevron-right')}</button></div></div>`
            +   `<div class="tp-cal">${dows}${cells}</div>`
            + '</div>';
    }

    function viewPlain(title, icon) {
        const where = { a: ' La caja se ve igual arriba, en la barra.', c: ' La franja de caja se ve igual arriba.', d: ' La caja se ve igual en el menú lateral.' }[variant] || '';
        const text  = 'Esta pantalla no cambia con la propuesta.' + where;

        return head(title) + `<div class="tp-card"><div class="tp-empty">${ico(icon)}<b>${title}</b><span>${text}</span></div></div>`;
    }

    // C3 y C4: «Cierre del día» vive solo aquí, como hoy en cortes.js (btnDayCuts).
    // Con un día pendiente, el botón cierra ese día.
    function viewCortes() {
        if (!solo) return viewPlain('Cortes', 'receipt-text');

        const own = tp.state === 'pending' && can()
            ? `<button type="button" class="tp-btn tp-btn-warn" data-act="close-pending">${ico('calendar-check')}Cerrar el 13/11</button>`
            : `<button type="button" class="tp-btn tp-btn-secondary" data-act="day-close">${ico('calendar-check')}${tp.state === 'closed' ? 'Ver cierre del día' : 'Cierre del día'}</button>`;

        return head('Cortes', own)
            + `<div class="tp-card"><div class="tp-empty">${ico('receipt-text')}<b>Cortes</b><span>«Cierre del día» vive aquí, como hoy. Ya no se repite en la franja, en Pedidos ni en Vender.</span></div></div>`;
    }

    // -- Portada (solo propuesta B) --

    function viewInicio() {
        const hello = ''
            + '<p class="tp-date">Sábado 14 de noviembre de 2026 · ' + SCOPE + '</p>'
            + `<div class="tp-hello"><h1 class="cp-pagina-titulo">Buenos días, ${USERS[tp.role].name.split(' ')[0]}</h1>${chip()}</div>`;

        const today = ''
            + '<div class="tp-today">'
            +   '<div class="tp-today-item"><span>Entregas de hoy</span><b>5</b><small>la primera a las 13:00</small></div>'
            +   '<div class="tp-today-item"><span>Pedidos con saldo</span><b>2</b><small>$1,750.00 por cobrar</small></div>'
            +   '<div class="tp-today-item"><span>Cotizaciones por confirmar</span><b>3</b><small>la más antigua del 10/11/2026</small></div>'
            + '</div>';

        const consult = (text) => ''
            + '<div class="tp-consult">'
            +   `<button type="button" class="tp-link" data-act="view" data-view="pedidos">Solo consultar${ico('arrow-right')}</button>`
            +   `<span>${text}</span>`
            + '</div>';

        const box = (tone, icon, title, text, extra) => ''
            + '<div class="tp-card"><div class="tp-box">'
            +   `<div class="tp-box-icon ${tone}">${ico(icon)}</div>`
            +   `<div class="tp-box-body"><p class="tp-box-title">${title}</p><p class="tp-box-text">${text}</p>${extra}</div>`
            + '</div></div>';

        const start = (view, icon, title, sub) => ''
            + `<button type="button" class="tp-start" data-act="start" data-view="${view}">`
            +   `<span class="tp-start-icon">${ico(icon)}</span>`
            +   `<span class="tp-start-text"><b>${title}</b><small>${sub}</small></span>`
            +   ico('arrow-right')
            + '</button>';

        let body = '';

        if (tp.state === 'open') {
            body = box('', 'circle-check', 'Turno 12 abierto desde las 08:05', `Fondo de ${money(tp.fund)}. Las ventas y los pedidos de hoy caen en este turno.`,
                '<p class="tp-ask">¿A dónde vas?</p>'
                + `<div class="tp-starts">${start('vender', 'shopping-cart', 'Vender', 'Venta de mostrador')}${start('pedidos', 'cake', 'Pedidos', 'Capturar, cobrar y entregar')}</div>`
                + `<div class="tp-row"><button type="button" class="tp-btn tp-btn-secondary" data-act="turn-cut">${ico('clock')}Turno y corte</button><button type="button" class="tp-btn tp-btn-success" data-act="day-close">${ico('calendar-check')}Cierre del día</button></div>`);
        } else if (tp.state === 'old') {
            body = box('warn', 'triangle-alert', 'Quedó abierto el turno 11 del 13/11/2026',
                can() ? 'Antes de empezar hoy hay que cerrarlo: su corte es de otro día.' : 'Lo cierra quien cobra, en caja. Mientras tanto solo puedes consultar.',
                (can() ? `<div class="tp-row"><button type="button" class="tp-btn tp-btn-warn lg" data-act="close-old">${ico('lock')}Cerrar turno 11</button></div>` : '')
                + consult('Entra sin turno: ves pedidos, calendario y clientes; no capturas ni cobras.'));
        } else if (tp.state === 'closed') {
            body = box('blue', 'calendar-check', `El día ${TODAY} ya está cerrado`, 'Hoy no se abre otro turno. Lo que sigue es para mañana.',
                `<div class="tp-row"><button type="button" class="tp-btn tp-btn-secondary lg" data-act="day-close">${ico('calendar-check')}Ver cierre del día</button></div>`
                + consult('Puedes revisar pedidos, calendario y clientes.'));
        } else if (!can()) {
            body = box('gray', 'lock', 'Todavía no hay turno abierto', 'El turno se abre en caja. Pídeselo a quien cobra.',
                consult('Entra sin turno: ves pedidos, calendario y clientes.'));
        } else {
            body = box('', 'lock-open', 'Abrir turno de caja', 'Un solo turno para todo el día: ahí caen las ventas de mostrador y los pedidos.',
                '<div class="tp-fund">'
                +   `<div><label for="tpFund">Fondo inicial de caja</label><div class="tp-money"><span>$</span><input id="tpFund" type="number" min="0" step="0.01" value="${tp.fund.toFixed(2)}"></div></div>`
                +   `<span class="tp-fund-hint">${ico('settings')}Propuesto desde Configuración. Puedes cambiarlo.</span>`
                + '</div>'
                + '<p class="tp-ask">¿Con qué empiezas?</p>'
                + `<div class="tp-starts">${start('vender', 'shopping-cart', 'Empezar a vender', 'Abre el turno y va a Vender')}${start('pedidos', 'cake', 'Empezar con pedidos', 'Abre el turno y va a Pedidos')}</div>`
                + consult('Entra sin abrir turno: ves pedidos, calendario y clientes; no capturas ni cobras.'));
        }

        return `<div class="tp-portada">${hello}${body}${today}</div>`;
    }

    const VIEWS = {
        inicio:     viewInicio,
        vender:     viewVender,
        pedidos:    viewPedidos,
        calendario: viewCalendario,
        clientes:   () => viewPlain('Clientes', 'users'),
        cortes:     viewCortes
    };

    // -- Pintado --

    function paint() {
        const user = USERS[tp.role];

        $('#navUser').textContent      = user.name;
        $('#navRol').textContent       = user.rol;
        $('#navAvatar').style.background = user.color;

        paintCaja();
        paintStrip();
        paintRail();

        $('#root').innerHTML = VIEWS[tp.view]();

        document.querySelectorAll('.menu-rail-item').forEach((el) => {
            const on = el.dataset.view === tp.view;

            el.classList.toggle('is-active', on);

            if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
        });

        document.querySelectorAll('.tp-demo-seg button').forEach((el) => {
            const on = (el.dataset.act === 'state' && el.dataset.value === tp.state)
                    || (el.dataset.act === 'role' && el.dataset.value === tp.role);

            el.classList.toggle('is-active', on);
        });

        icons();
    }

    // -- Avisos y modal --

    let toastTimer = 0;

    function toast(text) {
        const el = $('#tpToast');

        el.innerHTML = `${ico('circle-check')}<span>${text}</span>`;
        el.hidden    = false;
        icons();

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
    }

    function closeOverlay() {
        $('#tpOverlay').hidden    = true;
        $('#tpOverlay').innerHTML = '';
    }

    // El aviso de hoy cuando el ctrl contesta 423 (orderTurn.locked): se conserva en las dos propuestas.
    function locked(label) {
        tp.after = label;

        let title = 'Sin turno abierto';
        let text  = can() ? `Abre un turno de caja para seguir con «${label}».` : 'El turno se abre en caja. Pídeselo a quien cobra.';
        let main  = can() ? ['open-turn', 'Abrir turno'] : null;

        if (tp.state === 'old') {
            title = 'Turno pendiente de otro día';
            text  = 'El turno 11 quedó abierto el 13/11/2026. Ciérralo para seguir.';
            main  = can() ? ['close-old', 'Cerrar turno 11'] : null;
        } else if (tp.state === 'pending') {
            title = 'Día pendiente de cierre';
            text  = can() ? 'El 13/11/2026 no se cerró. Ciérralo para seguir.' : 'El 13/11/2026 no se cerró. Lo cierra quien cobra, en caja.';
            main  = can() ? ['close-pending', 'Cerrar el 13/11'] : null;
        } else if (tp.state === 'closed') {
            title = 'Día cerrado';
            text  = `El ${TODAY} ya se cerró: hoy no se captura ni se cobra.`;
            main  = ['day-close', 'Ver cierre del día'];
        }

        $('#tpOverlay').innerHTML = ''
            + '<div class="tp-alert" role="alertdialog" aria-modal="true">'
            +   `<div class="tp-alert-icon">${ico('lock')}</div>`
            +   `<p class="tp-alert-title">${title}</p>`
            +   `<p class="tp-alert-text">${text}</p>`
            +   '<div class="tp-alert-foot">'
            +     `<button type="button" class="tp-btn tp-btn-secondary" data-act="overlay-close">${main ? 'Ahora no' : 'Entendido'}</button>`
            +     (main ? `<button type="button" class="tp-btn ${main[0].startsWith('close-') ? 'tp-btn-warn' : 'tp-btn-success'}" data-act="${main[0]}">${main[1]}</button>` : '')
            +   '</div>'
            + '</div>';

        $('#tpOverlay').hidden = false;
        icons();
    }

    // El modal de hoy (orderTurn.openForm): sucursal, responsable y fondo. Lo nuevo es el fondo propuesto.
    function openModal() {
        $('#tpOverlay').innerHTML = ''
            + '<div class="tp-modal" role="dialog" aria-modal="true" aria-label="Abrir turno">'
            +   `<div class="tp-modal-head"><div class="tp-modal-icon">${ico('clock')}</div><span class="tp-modal-title">Abrir turno</span><button type="button" class="tp-modal-close" data-act="overlay-close" aria-label="Cerrar">${ico('x')}</button></div>`
            +   `<div class="tp-modal-field"><label>Sucursal</label><div class="tp-display">${ico('house')}<span>Matriz</span></div></div>`
            +   `<div class="tp-modal-field"><label>Responsable</label><div class="tp-display">${ico('user')}<span>${USERS[tp.role].name}</span></div></div>`
            +   `<div class="tp-modal-field"><label for="tpModalFund">Fondo inicial de caja</label><div class="tp-money"><span>$</span><input id="tpModalFund" type="number" min="0" step="0.01" value="${tp.fund.toFixed(2)}"></div><p class="tp-modal-hint">${ico('settings')}Propuesto desde Configuración. Puedes cambiarlo.</p></div>`
            +   '<div class="tp-modal-foot"><button type="button" class="tp-modal-cancel" data-act="overlay-close">Cancelar</button><button type="button" class="tp-modal-ok" data-act="confirm-open">Confirmar apertura</button></div>'
            +   '<p class="tp-modal-note">Último: turno 11, cerrado 13/11/2026 21:10 · <u>Ver corte</u></p>'
            + '</div>';

        $('#tpOverlay').hidden = false;
        icons();

        const input = $('#tpModalFund');

        input.focus();
        input.select();
    }

    // Abre el turno y regresa a lo que se estaba haciendo (el afterOpen de hoy).
    function openTurn(fund) {
        tp.fund  = Math.max(0, Number(fund) || 0);
        tp.state = 'open';

        if (tp.goto) tp.view = tp.goto;

        const next = tp.after ? ` Sigue «${tp.after}», donde te quedaste.` : (tp.goto ? ` Ya estás en ${tp.goto === 'vender' ? 'Vender' : 'Pedidos'}.` : '');

        tp.after = null;
        tp.goto  = null;

        closeOverlay();
        paint();
        toast(`Turno 12 abierto con fondo de ${money(tp.fund)}.${next}`);
    }

    // -- Acciones --

    const ACTIONS = {
        // La nota se ve al entrar; al moverse de pantalla se guarda para no tapar botones.
        view(el) {
            tp.view = el.dataset.view;
            $('#tpNote').hidden = true;
            paint();
        },

        state(el) {
            tp.state = el.dataset.value;
            tp.after = null;
            closeOverlay();
            paint();
        },

        role(el) {
            tp.role = el.dataset.value;
            closeOverlay();
            paint();
        },

        dark() {
            const on = !document.body.classList.contains('dark-mode');

            document.body.classList.toggle('dark-mode', on);
            document.documentElement.classList.toggle('dark', on);
            $('.navbar-main').classList.toggle('nav-dark', on);
        },

        note() {
            $('#tpNote').hidden = !$('#tpNote').hidden;
        },

        'caja-toggle'() {
            toggleCaja();
        },

        'overlay-close'() {
            tp.after = null;
            closeOverlay();
        },

        'open-turn'() {
            toggleCaja(false);
            openModal();
        },

        'confirm-open'() {
            openTurn($('#tpModalFund').value);
        },

        // Portada: el fondo ya está a la vista, así que el botón abre y lleva a la pantalla elegida.
        start(el) {
            $('#tpNote').hidden = true;

            if (tp.state === 'open') {
                tp.view = el.dataset.view;
                paint();
                return;
            }

            tp.goto = el.dataset.view;
            openTurn($('#tpFund').value);
        },

        need(el) {
            const label = el.dataset.label;

            if (tp.state === 'open') return toast(`«${label}» se abre como hoy, sin cambios.`);

            locked(label);
        },

        'close-old'() {
            tp.state = 'none';
            closeOverlay();
            paint();
            toast('Turno 11 cerrado con su corte (pantalla de hoy, sin cambios). Ya se puede abrir el de hoy.');
        },

        'close-pending'() {
            tp.state = 'none';
            closeOverlay();
            paint();
            toast('Cierre del 13/11/2026 hecho (pantalla de hoy, sin cambios). Ya se puede abrir el turno de hoy.');
        },

        'split-toggle'() {
            toggleSplit();
        },

        'turn-cut'() {
            toggleCaja(false);
            toast('Aquí se abre «Turno y corte», la pantalla de hoy, sin cambios.');
        },

        'day-close'() {
            toggleCaja(false);
            closeOverlay();
            toast('Aquí se abre «Cierre del día», la pantalla de hoy, sin cambios.');
        },

        cuts() {
            toggleCaja(false);
            tp.view = 'cortes';
            paint();
        }
    };

    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-act]');

        if (!el) {
            if (!e.target.closest('#navCaja, #cajaDropdown')) toggleCaja(false);
            if (!e.target.closest('.caja-split')) toggleSplit(false);
            return;
        }

        if (el.dataset.act !== 'caja-toggle' && !el.closest('#cajaDropdown')) toggleCaja(false);
        if (el.dataset.act !== 'split-toggle') toggleSplit(false);

        const run = ACTIONS[el.dataset.act];

        if (run) run(el);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            tp.after = null;
            closeOverlay();
            toggleCaja(false);
            toggleSplit(false);
        }

        if (e.key === 'Enter' && e.target.id === 'tpModalFund') ACTIONS['confirm-open']();

        // C4: la franja se activa con teclado como cualquier botón.
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.caja-strip.is-go')) {
            e.preventDefault();
            e.target.click();
        }
    });

    paint();

})();
