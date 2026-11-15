/*  Maqueta: Gestión de pagos · horizontal (templates/pagos-alpha-propuesta.html).
    Ventana horizontal de dos columnas: sucursales a la izquierda; a la derecha
    las formas de pago como Soft (todas en una tabla, cada una con su importe).
    Las cuentas son las de hoy, copiadas de src/js/pedido-cobro.js: calc(),
    discountCalc(), saveLabel() y rowHint(). Sin montos sugeridos de billetes.
    Datos de mentira (formas de pago reales de fayxzvov_pos.payment_method en
    local, sin Monedero): no llama a ningún ctrl. */

(() => {
    'use strict';

    // -- Utilidades --

    const $     = (sel) => document.querySelector(sel);
    const $$    = (sel) => Array.from(document.querySelectorAll(sel));
    const money = (n) => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const ico   = (name) => `<i data-lucide="${name}"></i>`;
    const icons = () => { if (window.lucide) lucide.createIcons(); };
    const esc   = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // Lo mismo que ordAmount(): acepta $ y comas; null si no es un monto.
    function amount(raw) {
        const s = String(raw).replace(/[$,\s]/g, '');

        if (s === '' || s === '.' || !/^\d*(\.\d*)?$/.test(s)) return null;

        return round(Number(s));
    }

    // -- Datos de la maqueta --

    const TODAY   = '15/11/2026';
    const USER    = 'Andrea M.';
    const SESSION = 3;   // la sucursal de la sesión (la de la barra)

    const BRANCHES = { 2: 'Guadalupe', 3: 'Kafeto', 4: 'Cuarta' };

    const HINT = { cash: 'Pago en efectivo', card: 'Débito o crédito', transfer: 'Depósito o SPEI', mp: 'Terminal o QR' };

    const mk = (id, name, key, color, icon) => ({ id, name, key, color, icon: icon || 'wallet', cash: key === 'cash', hint: HINT[key] });

    // Cada sucursal tiene su catálogo (payment_method.branch_id).
    const METHODS = {
        2: [mk(1, 'Efectivo', 'cash', '#16A34A', 'banknote'), mk(2, 'Tarjeta', 'card', '#2563EB', 'credit-card'), mk(3, 'Transferencia', 'transfer', '#7C3AED', 'arrow-left-right'), mk(12, 'MercadoPago', 'mp', '#0891B2', null)],
        3: [mk(5, 'Efectivo', 'cash', '#16A34A', 'banknote'), mk(6, 'Tarjeta', 'card', '#2563EB', 'credit-card'), mk(7, 'Transferencia', 'transfer', '#7C3AED', 'arrow-left-right')],
        4: [mk(8, 'Efectivo', 'cash', '#16A34A', 'banknote'), mk(9, 'Tarjeta', 'card', '#2563EB', 'credit-card'), mk(10, 'Transferencia', 'transfer', '#7C3AED', 'arrow-left-right'), mk(16, 'Mercado Pago', 'mp', '#CA8A04', null)]
    };

    // El turno de cada sucursal. Cuarta dejó uno abierto de ayer: ahí no se cobra.
    const TURNS = {
        2: { state: 'open', name: 'Turno 7',  who: 'Luis P.' },
        3: { state: 'open', name: 'Turno 12', who: USER },
        4: { state: 'old',  name: 'Turno 5',  who: 'Sofía R.', since: '14/11/2026' }
    };

    const REASONS = [
        { id: 1, name: 'Cliente frecuente',  max: 10,  auth: 0 },
        { id: 2, name: 'Pastel con detalle', max: 15,  auth: 0 },
        { id: 3, name: 'Cortesía',           max: 100, auth: 1 }
    ];

    // Entra una cajera: lo que pide Dueño o Supervisor no pasa.
    const CAN_AUTHORIZE = false;

    const ORDER = {
        folio:    'P-2114',
        client:   'Mariana Solís',
        subtotal: 1850,
        day:      '16/11/2026',
        delivery: '16/11/2026 · 13:00'
    };

    // branch 'origin': el anticipo se cobró donde se levantó el pedido.
    const PAY = {
        p1: { date: '10/11/2026', time: '10:12', key: 'cash',     branch: 'origin', turn: 'Turno 6',  concept: 'Anticipo',    amount: 500,  tendered: 500,  open: false },
        p2: { date: TODAY,        time: '09:40', key: 'transfer', branch: 3,        turn: 'Turno 12', concept: 'Abono',       amount: 320,  tendered: 320,  open: true },
        p3: { date: TODAY,        time: '11:05', key: 'card',     branch: 3,        turn: 'Turno 12', concept: 'Liquidación', amount: 1030, tendered: 1030, open: true }
    };

    const CASES = {
        first:  [],
        abono:  [PAY.p1, PAY.p2],
        paid:   [PAY.p1, PAY.p2, PAY.p3],
        noturn: [PAY.p1, PAY.p2]
    };

    // Los demás pedidos de la lista de atrás (solo adorno).
    const OTHERS = [
        { folio: 'P-2113', client: 'Grupo Aurora', branch: 3, delivery: '15/11/2026 · 17:30', total: 3200, balance: 0 },
        { folio: 'P-2115', client: 'Luis Ortega',  branch: 4, delivery: '17/11/2026 · 10:00', total: 980,  balance: 980 },
        { folio: 'P-2116', client: 'Café Central', branch: 3, delivery: '18/11/2026 · 09:00', total: 2450, balance: 1225 }
    ];

    // -- Estado --

    const pg = {
        case:        'abono',
        view:        'pay',      // pay | history
        open:        true,       // la ventana encima de la lista
        origin:      2,          // dónde se levantó el pedido
        cobro:       SESSION,    // dónde entra el dinero (su turno y sus formas de pago)
        turns:       {},
        payments:    [],
        discApplied: 0,
        auto:        0,          // la fila que cubre lo que falta
        active:      '',         // donde escribe el teclado: id del método, 'received' o 'disc'
        fresh:       true,       // la siguiente tecla reemplaza lo escrito
        discOpen:    false,
        discMode:    'percent',
        confirm:     null,       // el cobro que espera el «Sí, registrar»
        del:         null,       // el pago (índice) que espera su motivo para quitarse
        busy:        false,      // candado contra el doble cobro
        touch:       window.matchMedia('(any-pointer: coarse)').matches   // el teclado solo sale en pantalla táctil
    };

    const methods  = () => METHODS[pg.cobro];
    const cashOf   = () => methods().find((m) => m.cash);
    const turn     = (b) => pg.turns[b];
    const isCross  = () => pg.cobro !== pg.origin;
    // A donde vuelve el teclado: Efectivo, o la primera forma si la sucursal no tiene.
    const homeId   = () => String((cashOf() || methods()[0]).id);

    function order() {
        const total = round(ORDER.subtotal - pg.discApplied);
        const paid  = round(pg.payments.reduce((s, p) => s + p.amount, 0));

        return { subtotal: ORDER.subtotal, total, paid, balance: Math.max(0, round(total - paid)) };
    }

    /*  Por qué no se cobra: 'paid' (ya se pagó), 'old' / 'none' (la sucursal que cobra
        no tiene turno de hoy) o '' (se cobra). El candado es el turno de la
        sucursal que cobra, no el del pedido. */
    function lockState() {
        if (order().balance <= 0.005) return 'paid';

        const t = turn(pg.cobro);

        return t.state === 'open' ? '' : t.state;
    }

    const canPay = () => lockState() === '';

    function resetForm() {
        pg.auto     = Number(homeId());
        pg.active   = homeId();
        pg.fresh    = true;
        pg.discOpen = false;
        pg.discMode = 'percent';
        pg.confirm  = null;
        pg.del      = null;
        pg.busy     = false;
    }

    function fieldInput(f) {
        if (f === 'received') return $('#paRecv');
        if (f === 'disc')     return $('#paDiscValue');

        return $(`#paAmt${f}`);
    }

    // -- Cuentas (las de pedido-cobro.js) --

    function calc() {
        const o       = order();
        const d       = discountCalc(o);
        const total   = round(o.total - d.amount);
        const balance = Math.max(0, round(total - o.paid));

        let bad = null;

        // Como Soft: todas las formas de la sucursal; las que quedan en 0 no se cobran.
        const rows = methods().map((m) => {
            if (m.id === pg.auto) return { m, amount: 0 };

            const input = fieldInput(m.id);
            const raw   = String(input ? input.value : '').trim();
            const value = raw === '' ? 0 : amount(raw);

            if (value === null && !bad) bad = m;

            return { m, amount: value || 0 };
        });

        const fixed = round(rows.reduce((s, r) => s + r.amount, 0));
        const auto  = rows.find((r) => r.m.id === pg.auto);

        if (auto) auto.amount = Math.max(0, round(balance - fixed));

        // Efectivo: lo escrito es «hasta cuánto»; se aplica lo que cabe y lo demás es cambio.
        // En 0 (o si la sucursal no lo tiene) no hay cambio ni «Recibe».
        const cashRow   = rows.find((r) => r.m.cash);
        const cashTyped = cashRow ? cashRow.amount : 0;
        const others    = round(rows.reduce((s, r) => s + (r === cashRow ? 0 : r.amount), 0));
        const room      = Math.max(0, round(balance - others));
        const cashPaid  = round(Math.min(cashTyped, room));
        const recvEl    = $('#paRecv');
        const rawRec    = String(recvEl ? recvEl.value : '').trim();
        const rec       = rawRec === '' || cashPaid <= 0 ? null : amount(rawRec);
        const badRec    = rawRec !== '' && cashPaid > 0 && rec === null;
        const cashGiven = rec === null ? cashTyped : rec;

        const payments = [];

        rows.forEach((r) => {
            const value = r === cashRow ? cashPaid : r.amount;

            if (value <= 0) return;

            payments.push({ method_id: r.m.id, amount: value, tendered: r === cashRow ? cashGiven : value });
        });

        const over    = round(Math.max(0, others - balance) + (cashTyped > 0 && cashPaid <= 0 ? cashTyped : 0));
        const applied = round(payments.reduce((s, p) => s + p.amount, 0));
        const missing = cashPaid > 0 ? Math.max(0, round(cashPaid - cashGiven)) : 0;
        const change  = cashPaid > 0 ? Math.max(0, round(cashGiven - cashPaid)) : 0;

        return { d, total, balance, rows, bad, badRec, cashTyped, cashPaid, cashGiven, payments, applied, over, missing, change };
    }

    function discountCalc(o) {
        const off = { amount: 0, error: '' };

        if (!pg.discOpen) return off;

        const raw    = String($('#paDiscValue').value || '').trim();
        const reason = REASONS.find((r) => String(r.id) === $('#paReason').value);
        const value  = amount(raw);
        const fail   = (error) => ({ amount: 0, error });

        if (raw === '' && !reason) return off;
        if (!reason)               return fail('Elige el motivo del descuento.');
        if (raw === '')            return fail('Escribe el descuento.');
        if (value === null || value <= 0)             return fail('El descuento tiene que ser mayor a 0.');
        if (pg.discMode === 'percent' && value > 100) return fail('El descuento no puede pasar de 100 %.');

        const cut = pg.discMode === 'percent' ? round(o.subtotal * value / 100) : value;
        const cap = round(o.subtotal * reason.max / 100);

        if (cut <= 0)                              return fail('El descuento tiene que ser mayor a $0.');
        if (cut > cap + 0.005)                     return fail(`«${reason.name}» permite hasta ${reason.max} % (${money(cap)}).`);
        if (cut > o.total + 0.005)                 return fail('El descuento no puede ser mayor que el total.');
        if (round(o.total - cut) + 0.005 < o.paid) return fail(`Con ese descuento el total queda debajo de lo ya abonado (${money(o.paid)}).`);
        if (reason.auth === 1 && !CAN_AUTHORIZE)   return fail(`«${reason.name}» lo autoriza un Dueño o Supervisor.`);

        return { amount: cut, error: '', reason, value, percent: o.subtotal > 0 ? round(cut / o.subtotal * 100) : 0 };
    }

    // Lo que hoy frena el guardado, en el mismo orden que save().
    function problem(c) {
        if (c.d.error)                     return c.d.error;
        if (c.bad)                         return `El monto de ${c.bad.name} no es válido.`;
        if (c.badRec)                      return 'El monto recibido en efectivo no es válido.';
        if (c.over > 0.005)                return `Los pagos pasan del saldo por ${money(c.over)}. El saldo es ${money(c.balance)}: no se cobra de más.`;
        if (c.applied <= 0 && !c.d.amount) return 'Escribe cuánto paga el cliente.';
        if (c.payments.length > 6)         return 'Un cobro admite hasta 6 métodos de pago.';
        if (c.missing > 0.005)             return `Faltan ${money(c.missing)} por recibir en efectivo.`;

        return '';
    }

    function rowHint(r, c) {
        if (r.m.cash && c.cashPaid > 0 && c.cashTyped > c.cashPaid + 0.005) return `Se aplican ${money(c.cashPaid)}; lo demás es cambio`;
        if (r.m.id === pg.auto) return 'Cubre lo que falta del saldo';

        return r.m.hint;
    }

    // Como refreshPayButton() de alpha: «Registrar $X en {forma}», con el ícono de la forma.
    function saveLabel(c) {
        if (c.bad || c.over > 0.005 || c.applied <= 0) {
            return c.applied <= 0 && c.d.amount > 0 && !c.bad ? ['Aplicar descuento', 'percent'] : ['Registrar pago', 'check'];
        }

        if (c.payments.length > 1) return [`Registrar ${money(c.applied)} en ${c.payments.length} formas`, 'layers'];

        const m = methods().find((x) => x.id === c.payments[0].method_id);

        return [`Registrar ${money(c.applied)} en ${m.name}`, m.icon];
    }

    // -- Piezas de la ventana --

    function headHtml() {
        const tab = (view, icon, label, extra = '') => {
            const on = pg.view === view;

            return `<button type="button" class="pa-tab${on ? ' is-active' : ''}" role="tab" aria-selected="${on}" data-act="view" data-value="${view}">${ico(icon)}${label}${extra}</button>`;
        };

        return '<div class="pa-head">'
            +   '<div class="pa-head-top">'
            +     `<div class="pa-head-ico">${ico('wallet')}</div>`
            +     '<div class="pa-head-text"><h2 id="paTitle">Gestión de pagos</h2>'
            +       '<p class="pa-head-meta">'
            +         `<span>${ico('file-text')}Folio <b>${ORDER.folio}</b></span>`
            +         `<span class="is-client">${ico('user')}<em>${esc(ORDER.client)}</em></span>`
            +         `<span>${ico('calendar')}Entrega ${ORDER.day}</span>`
            +       '</p>'
            +     '</div>'
            +     `<button type="button" class="pa-x" data-act="close" aria-label="Cerrar">${ico('x')}</button>`
            +   '</div>'
            +   `<div class="pa-tabs" role="tablist">${tab('pay', 'hand-coins', 'Registrar pago')}${tab('history', 'history', 'Historial', `<span class="pa-count">${pg.payments.length}</span>`)}</div>`
            + '</div>';
    }

    /*  Los recuadros de alpha: Total en azul, Pagado en verde, Restante en rojo (verde al saldar).
        Al cobrar, Restante baja con lo que se escribe (updateTotal de alpha). */
    function summaryHtml() {
        const done = order().balance <= 0.005;

        return '<div class="pa-sum">'
            +   `<div class="pa-stat is-total"><span>${ico('wallet')}Total</span><b id="paSumTotal"></b><small id="paSumTotalNote"></small></div>`
            +   `<div class="pa-stat is-paid"><span>${ico('circle-check')}Pagado</span><b id="paSumPaid"></b></div>`
            +   `<div class="pa-stat is-due" id="paSumDueBox"><span>${ico(done ? 'circle-check' : 'clock')}${done ? 'Pagado completo' : 'Restante'}</span><b id="paSumDue"></b><small id="paSumDueNote"></small></div>`
            + '</div>';
    }

    // El subtítulo de alpha (misma sucursal u otra) y el punto del turno; el detalle queda en title.
    function turnLine(t) {
        const where = isCross() ? 'Cobro en otra sucursal' : 'Misma sucursal de origen';

        if (t.state === 'open') return `<span class="pa-dot pa-turn-open"></span>${where} · ${t.name}`;
        if (t.state === 'old')  return `<span class="pa-dot pa-turn-old"></span>${t.name} sin cerrar`;

        return '<span class="pa-dot pa-turn-none"></span>Sin turno abierto';
    }

    function turnTitle(t) {
        if (t.state === 'open') return `${t.name} abierto · ${t.who}`;
        if (t.state === 'old')  return `${t.name} de ${t.who} sin cerrar desde el ${t.since}`;

        return 'Sin turno abierto';
    }

    // Cada bloque lleva su rótulo encima, como los lbl del formulario de alpha.
    const label = (text, aside = '') => `<div class="pa-label"><span>${text}</span>${aside ? `<small>${aside}</small>` : ''}</div>`;

    // Las dos tarjetas de alpha: de dónde es el pedido y quién cobra.
    function branchesHtml(lock) {
        const cross = isCross();
        const paid  = lock === 'paid';
        const t     = turn(pg.cobro);
        const opts  = Object.keys(BRANCHES).map((id) => {
            const n = Number(id);

            return `<option value="${n}"${n === pg.cobro ? ' selected' : ''}>${BRANCHES[n]}${n === SESSION ? ' · tu sesión' : ''}</option>`;
        }).join('');

        return '<div class="pa-field">'
            +   label('Origen del pedido')
            +   '<div class="pa-branch">'
            +     `<span class="pa-branch-ico">${ico('house')}</span>`
            +     `<span class="pa-branch-text"><b>${BRANCHES[pg.origin]}</b><small>Sucursal donde se generó la venta</small></span>`
            +   '</div>'
            + '</div>'
            + '<div class="pa-field">'
            +   label('Sucursal que cobrará')
            +   `<div class="pa-branch is-cobro${cross ? ' is-cross' : ''}${paid ? ' is-off' : ''}" title="${esc(turnTitle(t))}">`
            +     `<span class="pa-branch-ico">${ico('landmark')}</span>`
            +     `<span class="pa-branch-text"><b>${BRANCHES[pg.cobro]}</b><small>${turnLine(t)}</small></span>`
            +     `<span class="pa-branch-chev">${ico('chevron-down')}</span>`
            +     `<select id="paCobro" aria-label="Sucursal que cobrará"${paid ? ' disabled' : ''}>${opts}</select>`
            +   '</div>'
            +   shiftAlertHtml(lock)
            + '</div>';
    }

    /*  El aviso de alpha (#cobroShiftAlert) bajo la sucursal que cobra: la forma
        sigue a la vista, apagada, y se puede elegir otra sucursal sin cerrar la ventana. */
    function shiftAlertHtml(lock) {
        if (lock !== 'old' && lock !== 'none') return '';

        const t    = turn(pg.cobro);
        const name = BRANCHES[pg.cobro];
        const go   = (act, icon, text) => `<button type="button" class="pa-alert-go" data-act="${act}">${ico(icon)}${text}</button>`;
        const home = pg.cobro !== SESSION && turn(SESSION).state === 'open' ? go('cobro-here', 'landmark', `Cobrar en ${BRANCHES[SESSION]}`) : '';

        let title = `${name} no tiene turno abierto`;
        let text  = 'Abre el turno para registrar este pago.';
        let btns  = (pg.cobro === SESSION ? go('open-turn', 'clock', 'Abrir turno') : '') + home;

        if (lock === 'old') {
            title = 'Turno sin cerrar';
            text  = `El ${t.name} de ${esc(t.who)} sigue abierto desde el ${t.since}. Hasta que se cierre, ahí no se cobra.`;
            btns  = go('go-cortes', 'receipt-text', 'Ir a Cortes') + home;
        }

        return `<div class="pa-alert" role="alert">${ico('lock')}`
            +   `<div class="pa-alert-text"><b>${title}</b><p>${text}</p>${btns ? `<div class="pa-alert-row">${btns}</div>` : ''}</div>`
            + '</div>';
    }

    // Con el teclado de la maqueta no hace falta el del sistema.
    const inputMode = () => (pg.touch ? 'none' : 'decimal');

    function rowHtml(m) {
        return `<div class="pa-row" data-field="${m.id}" style="--m:${m.color}">`
            +   `<button type="button" class="pa-row-name" data-act="rest" data-id="${m.id}" title="Que ${esc(m.name)} cubra lo que falta">`
            +     `<span class="pa-row-ico">${ico(m.icon)}</span>`
            +     `<span class="pa-row-text"><b>${esc(m.name)}</b><small data-hint>${m.hint}</small></span>`
            +   '</button>'
            +   `<div class="pa-amt"><span>$</span><input id="paAmt${m.id}" type="text" inputmode="${inputMode()}" autocomplete="off" placeholder="0.00" data-field="${m.id}" aria-label="Importe en ${esc(m.name)}"></div>`
            + '</div>';
    }

    function recvHtml() {
        return '<div class="pa-row is-recv" id="paRecvRow" data-field="received" hidden>'
            +   '<span class="pa-recv-label">Recibe en efectivo</span>'
            +   `<div class="pa-amt"><span>$</span><input id="paRecv" type="text" inputmode="${inputMode()}" autocomplete="off" placeholder="0.00" data-field="received" aria-label="Recibe en efectivo"></div>`
            + '</div>';
    }

    // La tabla de Soft: encabezado, una fila por forma de pago en orden y «Recibe» al final.
    function rowsHtml() {
        return `<div class="pa-grid-head"><span>Forma de pago · ${BRANCHES[pg.cobro]}</span><span>Importe</span></div>`
            + methods().map(rowHtml).join('')
            + (cashOf() ? recvHtml() : '');
    }

    // Teclado de caja: 7-8-9 arriba. La tecla alta pasa de campo, no cobra.
    function padHtml() {
        if (!pg.touch) return '';

        const key = (k, label, cls = '', aria = '') => `<button type="button" class="pa-key${cls ? ` ${cls}` : ''}" data-act="key" data-key="${k}"${aria ? ` aria-label="${aria}"` : ''}>${label}</button>`;

        return '<div class="pa-pad" aria-label="Teclado">'
            +   key('7', '7') + key('8', '8') + key('9', '9') + key('back', ico('delete'), 'is-fn', 'Borrar')
            +   key('4', '4') + key('5', '5') + key('6', '6') + key('clear', 'C', 'is-clear', 'Limpiar')
            +   key('1', '1') + key('2', '2') + key('3', '3') + key('next', `${ico('corner-down-left')}Siguiente`, 'is-next')
            +   key('0', '0') + key('00', '00') + key('.', '.')
            + '</div>';
    }

    function discHtml() {
        const seg = (mode, label) => `<button type="button" class="pa-seg-btn${pg.discMode === mode ? ' is-active' : ''}" data-act="mode" data-value="${mode}">${label}</button>`;
        const opt = (r) => `<option value="${r.id}">${esc(r.name)} · ${r.auth ? 'pide autorización' : `hasta ${r.max} %`}</option>`;

        return `<div class="pa-disc" id="paDisc"${pg.discOpen ? '' : ' hidden'}>`
            +   `<select id="paReason" class="pa-input" aria-label="Motivo del descuento"><option value="">Motivo del descuento</option>${REASONS.map(opt).join('')}</select>`
            +   '<div class="pa-disc-value" id="paDiscField">'
            +     `<input id="paDiscValue" class="pa-input" type="text" inputmode="${inputMode()}" autocomplete="off" placeholder="0" data-field="disc" aria-label="Descuento">`
            +     `<div class="pa-seg">${seg('percent', '%')}${seg('amount', '$')}</div>`
            +   '</div>'
            +   '<p class="pa-disc-msg" id="paDiscMsg"></p>'
            + '</div>';
    }

    /*  Horizontal: el saldo arriba a lo ancho; a la izquierda de dónde es el pedido,
        quién cobra, la observación y el descuento; a la derecha las formas de pago
        y, en táctil, el teclado. Pagado o sin turno: la misma forma, apagada (como
        alpha), y la ventana no cambia de tamaño. El fieldset apaga todo lo de adentro;
        la sucursal que cobra queda fuera para poder elegir otra. */
    function payHtml(lock) {
        const off = lock ? ' disabled' : '';

        return '<div class="pa-form" id="paPayForm">'
            +   summaryHtml()
            +   '<div class="pa-cols">'
            +     '<div class="pa-col pa-col-info">'
            +       branchesHtml(lock)
            +       `<fieldset class="pa-set${lock ? ' is-locked' : ''}"${off}>`
            +         '<div class="pa-field">'
            +           label('Observación', 'Opcional')
            +           '<textarea id="paNote" class="pa-input pa-textarea" rows="2" placeholder="Ej. paga la mamá de la festejada" aria-label="Observación"></textarea>'
            +         '</div>'
            +         `<button type="button" class="pa-extra-btn" id="paDiscBtn" data-act="disc" aria-pressed="false">${ico('percent')}<span>Descuento</span></button>`
            +         discHtml()
            +       '</fieldset>'
            +     '</div>'
            +     `<fieldset class="pa-col pa-col-pay${lock ? ' is-locked' : ''}"${off}>`
            +       label('Importe', 'Toca una forma para que cubra lo que falta')
            +       `<div class="pa-rows" id="paRows" role="group" aria-label="Formas de pago">${rowsHtml()}</div>`
            +       padHtml()
            +     '</fieldset>'
            +   '</div>'
            + '</div>';
    }

    // Lo que dice el aviso si se pulsa el botón apagado (requireCobroShift de alpha).
    function lockText(lock) {
        const t = turn(pg.cobro);

        if (lock === 'paid') return 'El pedido ya está pagado completamente.';
        if (lock === 'old')  return `${BRANCHES[pg.cobro]} tiene el ${t.name} sin cerrar desde el ${t.since}: ahí no se registran pagos.`;

        return `${BRANCHES[pg.cobro]} debe abrir su turno para registrar este pago.`;
    }

    function historyHtml() {
        const delTitle = isSettled() ? 'Quitar pago (pide contraseña: pedido liquidado)' : 'Quitar pago';
        const rows     = pg.payments.map((p, i) => {
            const change = round((p.tendered || p.amount) - p.amount);
            const t      = turn(p.branch);
            const lock   = (text) => `<span class="pa-lock" title="${text}">${ico('lock')}</span>`;

            let act = lock('Turno cerrado');

            if (p.open && t.state !== 'open') act = lock(`Sin turno en ${BRANCHES[p.branch]}`);
            else if (p.open)                  act = `<button type="button" class="pa-del" data-act="del" data-idx="${i}" title="${delTitle}" aria-label="${delTitle}">${ico('trash-2')}</button>`;

            const other = p.branch !== pg.origin ? `<span class="pa-chip" title="Otra sucursal">${ico('arrow-right-left')}<span>Otra sucursal</span></span>` : '';
            const sub   = (change > 0.005 ? `Cambio ${money(change)}` : '') + (p.fresh ? `${change > 0.005 ? ' · ' : ''}<span class="pa-new">Nuevo</span>` : '');

            // En el celular la fecha va sin año y se esconden el turno y la observación.
            return `<tr${p.fresh ? ' class="is-new"' : ''}>`
                +   `<td>${p.date.slice(0, 5)}<span class="pa-hide-sm">${p.date.slice(5)}</span><small>${p.time}</small></td>`
                +   `<td><span class="pa-hist-method"><span class="pa-row-ico" style="--m:${p.m.color}">${ico(p.m.icon)}</span><span><b>${esc(p.m.name)}</b>${sub ? `<small>${sub}</small>` : ''}</span></span></td>`
                +   `<td><span class="pa-hist-branch">${BRANCHES[p.branch]}${other}</span><small class="pa-hide-sm">${p.turn} · ${esc(p.who)}</small></td>`
                +   `<td class="pa-hist-note pa-hide-sm" title="${esc(p.concept)}">${esc(p.concept)}</td>`
                +   `<td class="r"><b>${money(p.amount)}</b></td>`
                +   `<td class="c">${act}</td>`
                + '</tr>';
        }).join('');

        // Sin pagos: el aviso vacío de lsPay() en alpha, en lugar de la tabla.
        if (!rows) {
            return summaryHtml()
                + '<div class="pa-empty">'
                +   `<span class="pa-empty-ico">${ico('history')}</span>`
                +   '<b>Aún no se ha realizado ningún abono</b>'
                +   '<p>Los pagos registrados aparecerán aquí.</p>'
                + '</div>';
        }

        return summaryHtml()
            + '<div class="pa-hist-wrap"><table class="pa-hist">'
            +   '<thead><tr><th>Fecha</th><th>Forma de pago</th><th>Cobró en</th><th class="pa-hide-sm">Observación</th><th class="r">Importe</th><th class="c"></th></tr></thead>'
            +   `<tbody>${rows}</tbody>`
            + '</table></div>'
            + `<p class="pa-hint">Un pago se quita solo con el turno abierto de la sucursal que lo cobró, y pide el motivo${isSettled() ? '; con el pedido liquidado, también tu contraseña' : ''}.</p>`;
    }

    // Pedido liquidado: como alpha (deletePayWithKey), quitar un abono pide la contraseña.
    const isSettled = () => order().balance <= 0.005;

    // El motivo de alpha (askDeleteReason): sin motivo no se quita; queda en la bitácora del pedido.
    function delHtml(p) {
        const liq  = isSettled();
        const text = liq
            ? `Ingresa tu contraseña para quitar el pago de <b>${money(p.amount)}</b> en ${esc(p.m.name)} del ${p.date.slice(0, 5)}. El pedido regresa a pendiente.`
            : `Se quita el pago de <b>${money(p.amount)}</b> en ${esc(p.m.name)} del ${p.date.slice(0, 5)} de forma permanente.`;
        const key  = liq
            ? '<div class="pa-field pa-del-field">'
            +   label('Contraseña')
            +   '<input type="password" id="paDelKey" class="pa-input" placeholder="••••••••" autocomplete="off" aria-label="Contraseña">'
            +   '<p class="pa-del-msg" id="paDelKeyMsg" hidden>Escribe tu contraseña.</p>'
            + '</div>'
            : '';

        return '<div class="pa-confirm" id="paDel" role="alertdialog" aria-modal="true" aria-labelledby="paDelTitle">'
            +   '<div class="pa-confirm-card">'
            +     `<div class="pa-confirm-head"><div class="pa-head-ico is-bad">${ico(liq ? 'lock' : 'trash-2')}</div><h3 id="paDelTitle">${liq ? 'Pedido liquidado' : '¿Quitar pago?'}</h3>`
            +       `<p>${text}</p></div>`
            +     key
            +     '<div class="pa-field pa-del-field">'
            +       label('Motivo')
            +       '<textarea id="paDelReason" class="pa-input pa-textarea" rows="2" placeholder="Ej. el pago se registró dos veces" aria-label="Motivo"></textarea>'
            +       '<p class="pa-del-msg" id="paDelMsg" hidden>Escribe el motivo.</p>'
            +     '</div>'
            +     '<div class="pa-confirm-foot">'
            +       '<button type="button" class="pa-btn" data-act="del-no">Cancelar</button>'
            +       '<button type="button" class="pa-btn is-danger" data-act="del-yes">Quitar pago</button>'
            +     '</div>'
            +   '</div>'
            + '</div>';
    }

    // Como alpha: el resultado en una línea y un solo botón. El historial no lleva pie.
    function footHtml(lock) {
        if (lock === 'paid') {
            const n = pg.payments.length;

            return '<div class="pa-foot">'
                +   `<div class="pa-res is-ok"><span>Pedido pagado completamente</span><small>· ${money(order().paid)} en ${n} ${n === 1 ? 'pago' : 'pagos'}</small></div>`
                +   `<button type="button" class="pa-save is-quiet" data-act="view" data-value="history">${ico('history')}<span>Ver historial</span></button>`
                + '</div>';
        }

        const res = lock
            ? `<div class="pa-res is-bad"><span>${lock === 'old' ? 'Turno sin cerrar' : 'Sin turno'}</span><small>· En ${BRANCHES[pg.cobro]} no se registran pagos</small></div>`
            : '<div class="pa-res" id="paRes" aria-live="polite"></div>';

        return '<div class="pa-foot">'
            +   res
            +   `<button type="button" class="pa-save${lock ? ' is-off' : ''}" id="paSave" data-act="save"><span class="pa-save-ico" id="paSaveIco" data-icon="check">${ico('check')}</span><span id="paSaveLabel">Registrar pago</span></button>`
            + '</div>';
    }

    // La confirmación de alpha: importe, forma, sucursal que cobra y el aviso de cobro cruzado.
    function confirmHtml(c) {
        const t     = turn(pg.cobro);
        const after = Math.max(0, round(c.balance - c.applied));
        const disc  = c.applied <= 0;
        const name  = (id) => methods().find((m) => m.id === id).name;
        const row   = (dt, dd, rowCls = '', ddCls = '') => `<div${rowCls ? ` class="${rowCls}"` : ''}><dt>${dt}</dt><dd${ddCls ? ` class="${ddCls}"` : ''}>${dd}</dd></div>`;

        const how = c.payments.length === 1
            ? row('Forma de pago', esc(name(c.payments[0].method_id)))
            : c.payments.map((p) => row(esc(name(p.method_id)), money(p.amount))).join('');

        const cross = isCross()
            ? `<p class="pa-confirm-warn">${ico('triangle-alert')}<span>Cobro cruzado: el pedido es de <b>${BRANCHES[pg.origin]}</b>, pero el cobro entra al ${t.name} de <b>${BRANCHES[pg.cobro]}</b>.</span></p>`
            : '';

        return '<div class="pa-confirm" id="paConfirm" role="alertdialog" aria-modal="true" aria-labelledby="paConfirmTitle">'
            +   '<div class="pa-confirm-card">'
            +     `<div class="pa-confirm-head"><div class="pa-head-ico">${ico(disc ? 'percent' : 'hand-coins')}</div><h3 id="paConfirmTitle">${disc ? '¿Aplicar descuento?' : '¿Registrar pago?'}</h3><p>${ORDER.folio} · ${esc(ORDER.client)}</p></div>`
            +     '<dl class="pa-confirm-rows">'
            +       row(disc ? 'Descuento' : 'Importe', money(disc ? c.d.amount : c.applied), 'is-big')
            +       how
            +       (c.change > 0.005 ? row('Recibe', `${money(c.cashGiven)} · cambio ${money(c.change)}`) : '')
            +       (c.d.amount > 0 && !disc ? row('Descuento', `−${money(c.d.amount)} · ${esc(c.d.reason.name)}`) : '')
            +       (c.note ? row('Observación', esc(c.note)) : '')
            +       row('Sucursal que cobra', `${BRANCHES[pg.cobro]} · ${t.name}`, '', 'is-brand')
            +       row('Saldo después', after <= 0.005 ? 'Queda pagado' : money(after))
            +     '</dl>'
            +     cross
            +     '<div class="pa-confirm-foot">'
            +       '<button type="button" class="pa-btn" data-act="confirm-no">Cancelar</button>'
            +       `<button type="button" class="pa-btn is-primary" id="paConfirmYes" data-act="confirm-yes"><span data-label>${disc ? 'Sí, aplicar' : 'Sí, registrar'}</span></button>`
            +     '</div>'
            +   '</div>'
            + '</div>';
    }

    // -- Pintar --

    function renderPage() {
        const o    = order();
        const pill = (bal, tot) => {
            if (bal <= 0.005)       return '<span class="tp-pill green">Pagado</span>';
            if (bal + 0.005 >= tot) return '<span class="tp-pill blue">Sin pagos</span>';

            return '<span class="tp-pill amber">Con saldo</span>';
        };

        const rows = [{ folio: ORDER.folio, client: ORDER.client, branch: pg.origin, delivery: ORDER.delivery, total: o.total, balance: o.balance }].concat(OTHERS);

        $('#root').innerHTML = ''
            + `<div class="pa-page-head"><h1>Pedidos</h1><p>Las 3 sucursales · ${TODAY} · el cobro se abre con «Cobrar»</p></div>`
            + '<div class="tp-card"><div class="tp-table-wrap"><table class="tp-table">'
            +   '<thead><tr><th>Folio</th><th>Cliente</th><th>Sucursal</th><th>Entrega</th><th>Estado</th><th class="num">Total</th><th class="num">Saldo</th><th></th></tr></thead>'
            +   '<tbody>' + rows.map((r) => '<tr>'
            +     `<td><b>${r.folio}</b></td><td>${esc(r.client)}</td><td>${BRANCHES[r.branch]}</td><td>${r.delivery}</td><td>${pill(r.balance, r.total)}</td>`
            +     `<td class="num">${money(r.total)}</td><td class="num"><b>${money(r.balance)}</b></td>`
            +     `<td class="num"><button type="button" class="pa-row-pay" data-act="open" data-folio="${r.folio}">${ico('hand-coins')}Cobrar</button></td>`
            +   '</tr>').join('') + '</tbody>'
            + '</table></div></div>';
    }

    function renderWin() {
        const overlay = $('#paOverlay');

        overlay.hidden = !pg.open;

        if (!pg.open) {
            overlay.innerHTML = '';
            return;
        }

        const pay  = pg.view === 'pay';
        const lock = lockState();

        overlay.innerHTML = '<div class="pa-win" role="dialog" aria-modal="true" aria-labelledby="paTitle">'
            + headHtml()
            + `<div class="pa-body">${pay ? payHtml(lock) : historyHtml()}</div>`
            + (pay ? footHtml(lock) : '')
            + '</div>';
    }

    // La tira de la maqueta marca lo que está puesto.
    function paintDemo() {
        const now = { case: pg.case, origin: String(pg.origin), screen: pg.touch ? 'touch' : 'mouse' };

        $$('.tp-demo-seg button').forEach((el) => el.classList.toggle('is-active', now[el.dataset.act] === el.dataset.value));
    }

    function render() {
        renderPage();
        renderWin();

        paintDemo();
        icons();

        if (!pg.open) return;

        if ($('#paPayForm') && canPay()) {
            paintCalc();
            focusField(pg.active);
        } else {
            paintStatic();
        }
    }

    // Con descuento, el total de antes sale tachado (como en alpha).
    function totalNote(o, cut) {
        if (cut > 0)            return `<s>${money(o.total)}</s>`;
        if (pg.discApplied > 0) return `<s>${money(ORDER.subtotal)}</s>`;

        return '';
    }

    // dueNote: el saldo de antes, tachado, mientras se escribe un cobro.
    function paintSummary(v) {
        $('#paSumTotal').textContent    = money(v.total);
        $('#paSumTotalNote').innerHTML  = v.totalNote;
        $('#paSumPaid').textContent     = money(v.paid);
        $('#paSumDue').textContent      = money(v.due);
        $('#paSumDueNote').innerHTML    = v.dueNote || '';
        $('#paSumDueBox').classList.toggle('is-done', v.due <= 0.005);
    }

    // Pagado, sin turno o historial: el resumen sin cobro en curso.
    function paintStatic() {
        const o = order();

        paintSummary({ total: o.total, totalNote: totalNote(o, 0), paid: o.paid, due: o.balance });
    }

    /*  Las filas no se vuelven a pintar al teclear (se perdería el foco); solo
        cambian su marca, su pista y, la que cubre lo que falta, su monto. */
    function paintCalc() {
        if (!$('#paPayForm') || !canPay()) return;

        const c = calc();
        const o = order();

        c.rows.forEach((r) => {
            const input = fieldInput(r.m.id);
            const row   = input.closest('.pa-row');
            const auto  = r.m.id === pg.auto;

            if (auto) input.value = r.amount > 0 ? r.amount.toFixed(2) : '';

            row.classList.toggle('is-auto', auto);
            row.querySelector('[data-hint]').textContent = rowHint(r, c);
            input.parentElement.classList.toggle('is-bad', c.bad === r.m);
        });

        // «Recibe» sale solo cuando Efectivo lleva monto.
        const recvRow = $('#paRecvRow');
        const recv    = $('#paRecv');

        if (recv) {
            if (c.cashPaid <= 0 && recv.value !== '') recv.value = '';

            recvRow.hidden   = c.cashPaid <= 0;
            recv.placeholder = c.cashPaid > 0 ? c.cashPaid.toFixed(2) : '0.00';
            recv.parentElement.classList.toggle('is-bad', c.badRec);
        }

        if ((!recvRow || recvRow.hidden) && pg.active === 'received') pg.active = homeId();

        // Restante baja con lo que se escribe; el saldo de antes queda tachado debajo.
        const after = Math.max(0, round(c.balance - c.applied));

        paintSummary({
            total: c.total, totalNote: totalNote(o, c.d.amount), paid: o.paid,
            due: after, dueNote: c.applied > 0 ? `<s>${money(c.balance)}</s>` : ''
        });

        paintResult(c);
        paintDiscount(c);
        paintActive();
        paintSave(c);
    }

    // El ícono solo se cambia cuando cambia la forma (lucide reemplaza el <i> por un <svg>).
    function paintSave(c) {
        const [text, icon] = saveLabel(c);
        const box          = $('#paSaveIco');

        $('#paSaveLabel').textContent = text;
        $('#paSave').classList.toggle('is-off', problem(c) !== '');

        if (box.dataset.icon === icon) return;

        box.dataset.icon = icon;
        box.innerHTML    = ico(icon);
        icons();
    }

    // Los estados de summary(), en el mismo orden, en una sola línea.
    function paintResult(c) {
        // El saldo que queda ya lo dice Restante arriba.
        const after = Math.max(0, round(c.balance - c.applied));
        const tail  = after <= 0.005 ? 'Queda pagado' : 'Queda como abono';

        let st;   // [clase, etiqueta, monto, nota]

        if (c.d.error)                               st = ['is-bad', 'Corrige', '', 'El descuento no es válido'];
        else if (c.bad)                              st = ['is-bad', 'Corrige', '', `El monto de ${c.bad.name} no es válido`];
        else if (c.badRec)                           st = ['is-bad', 'Corrige', '', 'Lo recibido en efectivo no es válido'];
        else if (c.over > 0.005)                     st = ['is-bad', 'Sobran', money(c.over), 'No se cobra de más: baja algún monto'];
        else if (c.applied <= 0 && c.d.amount > 0)   st = ['is-info', 'Solo descuento', money(c.d.amount), `El total queda en ${money(c.total)}`];
        else if (c.applied <= 0)                     st = ['', 'Sin monto', '', 'Escribe cuánto paga el cliente'];
        else if (c.missing > 0.005)                  st = ['is-bad', 'Faltan', money(c.missing), 'El efectivo recibido no alcanza'];
        else if (c.change > 0.005)                   st = ['is-ok', 'Cambio', money(c.change), tail];
        else if (c.payments.length === 1 && c.cashPaid > 0) st = ['is-ok', 'Efectivo exacto', '', tail];
        else                                         st = ['is-ok', 'Cobra', money(c.applied), tail];

        const res = $('#paRes');

        res.className = `pa-res${st[0] ? ` ${st[0]}` : ''}`;
        res.innerHTML = `<span>${esc(st[1])}</span>${st[2] ? `<b>${st[2]}</b>` : ''}<small>· ${esc(st[3])}</small>`;
    }

    function paintDiscount(c) {
        const d   = c.d;
        const msg = $('#paDiscMsg');
        const btn = $('#paDiscBtn');

        msg.className = `pa-disc-msg${d.error ? ' is-bad' : (d.amount ? ' is-ok' : '')}`;
        msg.innerHTML = d.error
            ? esc(d.error)
            : (d.amount ? `Descuento de <b>${money(d.amount)}</b> (${d.percent} %). El total queda en ${money(c.total)}.` : 'Elige el motivo y escribe el descuento.');

        btn.classList.toggle('is-on', pg.discOpen);
        btn.setAttribute('aria-pressed', String(pg.discOpen));

        $$('button.pa-seg-btn').forEach((el) => el.classList.toggle('is-active', el.dataset.value === pg.discMode));
    }

    // La fila (o el campo) donde escribe el teclado lleva la barra de color.
    function paintActive() {
        $$('.pa-row').forEach((row) => row.classList.toggle('is-active', row.dataset.field === pg.active));

        const disc = $('#paDiscField');

        if (disc) disc.classList.toggle('is-active', pg.active === 'disc');
    }

    // -- Teclado --

    function focusField(f) {
        const input = fieldInput(f);

        if (!input) return;

        input.focus({ preventScroll: true });
        input.select();
    }

    function visibleFields() {
        const list = [];
        const recv = $('#paRecvRow');

        // Mismo orden que la tabla: las formas y luego «Recibe».
        methods().forEach((m) => list.push(String(m.id)));

        if (recv && !recv.hidden) list.push('received');

        if (pg.discOpen) list.push('disc');

        return list;
    }

    function nextField() {
        const list = visibleFields();
        const at   = list.indexOf(pg.active);

        focusField(list[(at + 1) % list.length]);
    }

    // Escribir en la fila que cubre lo que falta la vuelve fija (como hoy al teclear).
    function typed(input) {
        pg.fresh = false;

        if (String(pg.auto) === input.dataset.field) pg.auto = 0;

        paintCalc();
    }

    function press(k) {
        if (k === 'next') return nextField();

        const input = fieldInput(pg.active);

        if (!input) return;

        let v = pg.fresh && k !== 'back' ? '' : input.value;

        if (k === 'back') {
            v = v.slice(0, -1);
        } else if (k === 'clear') {
            v = '';
        } else if (k === '.') {
            if (v.includes('.')) return;
            v = `${v || '0'}.`;
        } else {
            const dot = v.indexOf('.');
            const dec = dot < 0 ? -1 : v.length - dot - 1;

            if (dec >= 2) return;

            v = (v === '0' ? '' : v) + (k === '00' && dec === 1 ? '0' : k);

            if (/^0+$/.test(v)) v = '0';
        }

        input.value = v;
        typed(input);
    }

    // Tocar el nombre de una forma: esa cubre lo que falta (la anterior se limpia).
    function takeRest(id) {
        const old = fieldInput(pg.auto);

        if (old && pg.auto !== id) old.value = '';

        pg.auto = id;
        paintCalc();
        focusField(String(id));
    }

    function toggleDisc() {
        if (!$('#paPayForm') || !canPay()) return;

        pg.discOpen = !pg.discOpen;

        $('#paDisc').hidden = !pg.discOpen;

        if (pg.discOpen) {
            $('#paDisc').scrollIntoView({ block: 'nearest' });
            $('#paReason').focus({ preventScroll: true });
        } else {
            $('#paReason').value    = '';
            $('#paDiscValue').value = '';

            if (pg.active === 'disc') pg.active = homeId();

            focusField(pg.active);
        }

        paintCalc();
    }

    // -- Cobrar --

    // El botón o Enter: revisa y pide la confirmación. Nada se guarda todavía.
    function save() {
        if (!pg.open || pg.confirm) return;

        // En el historial, F2 lleva a registrar.
        if (!$('#paPayForm')) {
            if (pg.view === 'history' && canPay()) {
                pg.view = 'pay';
                resetForm();
                render();
            }
            return;
        }

        // El botón apagado avisa por qué, como requireCobroShift() de alpha.
        const lock = lockState();

        if (lock) return toast(lockText(lock), 'warn');

        const c   = calc();
        const why = problem(c);

        if (why) return toast(why, 'warn');

        c.note     = $('#paNote').value.trim();
        pg.confirm = c;

        $('.pa-win').insertAdjacentHTML('beforeend', confirmHtml(c));
        icons();
        $('#paConfirmYes').focus();
    }

    function closeConfirm() {
        if (pg.busy) return;

        pg.confirm = null;

        const el = $('#paConfirm');

        if (el) el.remove();

        focusField(pg.active);
    }

    // «Sí, registrar»: el candado (busy) impide un segundo cobro con doble clic o doble Enter.
    function commit() {
        if (pg.busy || !pg.confirm) return;

        const c   = pg.confirm;
        const yes = $('#paConfirmYes');

        pg.busy = true;

        if (yes) {
            yes.disabled = true;
            yes.querySelector('[data-label]').textContent = 'Registrando…';
        }

        setTimeout(() => {
            const o     = order();
            const t     = turn(pg.cobro);
            const after = Math.max(0, round(c.balance - c.applied));
            const time  = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

            let concept = o.paid <= 0 ? 'Anticipo' : 'Abono';

            if (after <= 0.005) concept = o.paid <= 0 ? 'Pago completo' : 'Liquidación';
            if (c.note) concept = c.note;

            pg.payments.forEach((p) => { p.fresh = false; });

            c.payments.forEach((p) => {
                pg.payments.push({
                    date: TODAY, time, m: methods().find((m) => m.id === p.method_id), branch: pg.cobro, turn: t.name,
                    concept, who: USER, amount: p.amount, tendered: p.tendered, open: true, fresh: true
                });
            });

            if (c.d.amount > 0) pg.discApplied = round(pg.discApplied + c.d.amount);

            const where = isCross() ? ` · entra al ${t.name} de ${BRANCHES[pg.cobro]}` : '';
            const msg   = c.applied > 0
                ? `Pago registrado · ${money(c.applied)}${c.change > 0.005 ? ` · Cambio ${money(c.change)}` : ''}${where}`
                : `Descuento aplicado · ${money(c.d.amount)}. El total queda en ${money(c.total)}.`;

            resetForm();
            pg.view = 'history';
            render();
            toast(msg);
        }, 350);
    }

    // -- Quitar un pago --

    function closeDel() {
        pg.del = null;

        const el = $('#paDel');

        if (el) el.remove();
    }

    // Marca el campo que falta y lo enfoca.
    function delMissing(field, msg) {
        $(msg).hidden = false;
        $(field).classList.add('is-bad');
        $(field).focus();
    }

    // Sin motivo no se quita (el ctrl lo exige y lo deja en la bitácora); liquidado, tampoco sin contraseña.
    function removePay() {
        const p      = pg.payments[pg.del];
        const keyEl  = $('#paDelKey');
        const reason = $('#paDelReason').value.trim();

        if (!p) return closeDel();

        if (keyEl && !keyEl.value) return delMissing('#paDelKey', '#paDelKeyMsg');
        if (!reason)               return delMissing('#paDelReason', '#paDelMsg');

        const reopened = !!keyEl;

        pg.payments.splice(pg.del, 1);
        closeDel();
        render();
        toast(`Pago quitado · ${money(p.amount)} · Motivo: ${reason}${reopened ? ' · El pedido regresó a pendiente' : ''}`);
    }

    // -- Avisos --

    let toastTimer = 0;

    function toast(text, kind) {
        const el = $('#tpToast');

        el.classList.toggle('is-warn', kind === 'warn');
        el.innerHTML = `${ico(kind === 'warn' ? 'circle-alert' : 'circle-check')}<span>${esc(text)}</span>`;
        el.hidden    = false;
        icons();

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
    }

    // -- Acciones --

    // Cada caso arranca cobrando en la sucursal de la sesión.
    function setCase(value) {
        pg.case  = CASES[value] ? value : 'abono';
        pg.turns = JSON.parse(JSON.stringify(TURNS));
        pg.cobro = SESSION;

        if (pg.case === 'noturn') pg.turns[SESSION] = { state: 'none', name: '', who: '' };

        pg.payments = CASES[pg.case].map((p) => {
            const branch = p.branch === 'origin' ? pg.origin : p.branch;

            return Object.assign({}, p, { branch, m: METHODS[branch].find((m) => m.key === p.key), who: TURNS[branch].who });
        });

        pg.discApplied = 0;
        pg.open        = true;
        pg.view        = 'pay';

        resetForm();
        render();
    }

    const ACTIONS = {
        case(el) {
            setCase(el.dataset.value);
        },

        origin(el) {
            pg.origin = Number(el.dataset.value);
            setCase(pg.case);
        },

        view(el) {
            pg.view = el.dataset.value;
            pg.open = true;
            resetForm();
            render();
        },

        open(el) {
            if (el.dataset.folio !== ORDER.folio) return toast(`En la maqueta solo ${ORDER.folio} abre el cobro.`, 'warn');

            pg.open = true;
            pg.view = 'pay';
            resetForm();
            render();
        },

        close() {
            if (pg.busy) return;

            pg.open = false;
            resetForm();
            render();
        },

        rest(el) {
            takeRest(Number(el.dataset.id));
        },

        key(el) {
            press(el.dataset.key);
        },

        mode(el) {
            pg.discMode = el.dataset.value;
            paintCalc();
        },

        disc() {
            toggleDisc();
        },

        save() {
            save();
        },

        'confirm-no'() {
            closeConfirm();
        },

        'confirm-yes'() {
            commit();
        },

        del(el) {
            const at = Number(el.dataset.idx);
            const p  = pg.payments[at];

            if (!p || turn(p.branch).state !== 'open' || pg.del !== null) return;

            pg.del = at;
            $('.pa-win').insertAdjacentHTML('beforeend', delHtml(p));
            icons();
            ($('#paDelKey') || $('#paDelReason')).focus();
        },

        'del-no'() {
            closeDel();
        },

        'del-yes'() {
            removePay();
        },

        'open-turn'() {
            pg.turns[SESSION] = { state: 'open', name: 'Turno 13', who: USER };
            resetForm();
            render();
            toast(`Turno 13 abierto en ${BRANCHES[SESSION]} (pantalla de hoy, sin cambios). Sigue el cobro.`);
        },

        'go-cortes'() {
            const t = turn(pg.cobro);

            toast(`Te lleva a Cortes de ${BRANCHES[pg.cobro]} para cerrar el ${t.name} de ${t.who}.`);
        },

        'cobro-here'() {
            pg.cobro = SESSION;
            resetForm();
            render();
        },

        // Modo oscuro de pro (paleta incluida) sin tocar lo que guardó la app real.
        dark() {
            const on      = !document.documentElement.classList.contains('dark');
            const palette = window.InventoryPalette;

            let before = null;

            try { before = localStorage.getItem('huubie:pro:dark'); } catch (e) { /* modo privado */ }

            if (palette) palette.apply(on ? palette.MODES.dark : palette.MODES.light);

            try {
                if (before === null) localStorage.removeItem('huubie:pro:dark');
                else localStorage.setItem('huubie:pro:dark', before);
            } catch (e) { /* modo privado */ }

            document.body.classList.toggle('dark-mode', on);
            document.documentElement.classList.toggle('dark', on);
            $('.navbar-main').classList.toggle('nav-dark', on);
        },

        note() {
            $('#tpNote').hidden = !$('#tpNote').hidden;
        },

        // Simula la caja: táctil saca el teclado; mouse lo quita.
        screen(el) {
            pg.touch = el.dataset.value === 'touch';
            resetForm();
            render();
        }
    };

    // -- Eventos --

    // :disabled también cubre los botones dentro de un fieldset apagado.
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-act]');

        if (el && !el.matches(':disabled') && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el);
    });

    // El teclado no le quita el foco al campo.
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('button.pa-key')) e.preventDefault();
    });

    document.addEventListener('input', (e) => {
        if (e.target.id === 'paDelReason' || e.target.id === 'paDelKey') {
            $(e.target.id === 'paDelKey' ? '#paDelKeyMsg' : '#paDelMsg').hidden = true;
            e.target.classList.remove('is-bad');
            return;
        }

        if (!e.target.closest('#paPayForm') || e.target.id === 'paCobro') return;

        if (e.target.dataset.field) typed(e.target);
        else paintCalc();
    });

    document.addEventListener('change', (e) => {
        if (e.target.id === 'paReason') paintCalc();

        // Otra sucursal que cobra: otro turno y otro catálogo de formas de pago.
        if (e.target.id === 'paCobro') {
            pg.cobro = Number(e.target.value);
            resetForm();
            render();
        }
    });

    document.addEventListener('focusin', (e) => {
        const f = e.target.dataset ? e.target.dataset.field : '';

        if (!f || !e.target.closest('#paPayForm')) return;

        pg.active = f;
        pg.fresh  = true;
        paintActive();
    });

    document.addEventListener('keydown', (e) => {
        if ($('#paOverlay').hidden) return;

        // Quitar un pago: Esc cancela; Enter quita (Shift+Enter hace otra línea en el motivo).
        if (pg.del !== null) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeDel();
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                removePay();
            }
            return;
        }

        // Con la confirmación abierta solo cuentan Esc (cancelar) y Enter / F2 (registrar).
        if (pg.confirm) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeConfirm();
            } else if (e.key === 'Enter' || e.key === 'F2') {
                e.preventDefault();
                commit();
            }
            return;
        }

        if (e.key === 'F2') {
            e.preventDefault();
            save();
        } else if (e.key === 'F4') {
            e.preventDefault();
            toggleDisc();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            ACTIONS.close();
        } else if (e.key === 'Enter' && e.target.matches('#paPayForm input')) {
            e.preventDefault();
            save();
        }
    });

    // -- Arranque --

    // La tira de la maqueta crece al envolverse: la ventana le deja su hueco.
    const fitDemo = () => document.documentElement.style.setProperty('--pa-demo', `${$('.tp-demo').offsetHeight}px`);

    fitDemo();
    window.addEventListener('resize', fitDemo);

    const dark = document.documentElement.classList.contains('dark');

    document.body.classList.toggle('dark-mode', dark);
    $('.navbar-main').classList.toggle('nav-dark', dark);

    setCase('abono');
})();
