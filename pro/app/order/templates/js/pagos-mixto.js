/*  Maqueta: Gestión de pagos · alpha + Soft (templates/pagos-mixto-propuesta.html).
    Las cuentas son las de hoy, copiadas de src/js/pedido-cobro.js: calc(),
    discountCalc(), saveLabel(), rowHint() y bills(). De alpha vienen la
    sucursal que cobra (con su turno y sus formas de pago), el resumen en
    recuadros, los mosaicos y la confirmación antes de guardar.
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
        sel:         [],         // formas elegidas en los mosaicos
        auto:        0,          // la fila que cubre lo que falta
        active:      '',         // donde escribe el teclado: id del método, 'received' o 'disc'
        fresh:       true,       // la siguiente tecla reemplaza lo escrito
        discOpen:    false,
        discMode:    'percent',
        confirm:     null,       // el cobro que espera el «Sí, registrar»
        busy:        false,      // candado contra el doble cobro
        touch:       window.matchMedia('(any-pointer: coarse)').matches   // el teclado solo sale en pantalla táctil
    };

    const methods  = () => METHODS[pg.cobro];
    const cashOf   = () => methods().find((m) => m.cash);
    const turn     = (b) => pg.turns[b];
    const isCross  = () => pg.cobro !== pg.origin;
    const selected = () => methods().filter((m) => pg.sel.includes(m.id));

    function order() {
        const total = round(ORDER.subtotal - pg.discApplied);
        const paid  = round(pg.payments.reduce((s, p) => s + p.amount, 0));

        return { subtotal: ORDER.subtotal, total, paid, balance: Math.max(0, round(total - paid)) };
    }

    // El candado es el turno de la sucursal que cobra, no el del pedido.
    const canPay = () => turn(pg.cobro).state === 'open' && order().balance > 0.005;

    function resetForm() {
        const first = cashOf() || methods()[0];

        pg.sel      = [first.id];
        pg.auto     = first.id;
        pg.active   = String(first.id);
        pg.fresh    = true;
        pg.discOpen = false;
        pg.discMode = 'percent';
        pg.confirm  = null;
        pg.busy     = false;
    }

    function fieldInput(f) {
        if (f === 'received') return $('#pmRecv');
        if (f === 'disc')     return $('#pmDiscValue');

        return $(`#pmAmt${f}`);
    }

    // -- Cuentas (las de pedido-cobro.js) --

    function calc() {
        const o       = order();
        const d       = discountCalc(o);
        const total   = round(o.total - d.amount);
        const balance = Math.max(0, round(total - o.paid));

        let bad = null;

        const rows = selected().map((m) => {
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
        // Puede no estar elegido: entonces no hay cambio ni «Recibe».
        const cashRow   = rows.find((r) => r.m.cash);
        const cashTyped = cashRow ? cashRow.amount : 0;
        const others    = round(rows.reduce((s, r) => s + (r === cashRow ? 0 : r.amount), 0));
        const room      = Math.max(0, round(balance - others));
        const cashPaid  = round(Math.min(cashTyped, room));
        const recvEl    = $('#pmRecv');
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

        const raw    = String($('#pmDiscValue').value || '').trim();
        const reason = REASONS.find((r) => String(r.id) === $('#pmReason').value);
        const value  = amount(raw);
        const fail   = (error) => ({ amount: 0, error });

        if (raw === '' && !reason) return off;
        if (!reason)               return fail('Elige el motivo del descuento.');
        if (raw === '')            return fail('Escribe el descuento.');
        if (value === null || value <= 0)            return fail('El descuento tiene que ser mayor a 0.');
        if (pg.discMode === 'percent' && value > 100) return fail('El descuento no puede pasar de 100 %.');

        const cut = pg.discMode === 'percent' ? round(o.subtotal * value / 100) : value;
        const cap = round(o.subtotal * reason.max / 100);

        if (cut <= 0)                                return fail('El descuento tiene que ser mayor a $0.');
        if (cut > cap + 0.005)                       return fail(`«${reason.name}» permite hasta ${reason.max} % (${money(cap)}).`);
        if (cut > o.total + 0.005)                   return fail('El descuento no puede ser mayor que el total.');
        if (round(o.total - cut) + 0.005 < o.paid)   return fail(`Con ese descuento el total queda debajo de lo ya abonado (${money(o.paid)}).`);
        if (reason.auth === 1 && !CAN_AUTHORIZE)     return fail(`«${reason.name}» lo autoriza un Dueño o Supervisor.`);

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

    function saveLabel(c) {
        if (c.bad || c.over > 0.005)          return 'Registrar pago';
        if (c.applied <= 0 && c.d.amount > 0) return 'Aplicar descuento';

        return c.applied > 0 ? `Registrar pago · ${money(c.applied)}` : 'Registrar pago';
    }

    // Exacto y los 3 billetes redondos siguientes; cada uno dice el cambio que deja.
    function bills(remaining, hasCash) {
        if (remaining <= 0) {
            const why = hasCash ? 'Salen cuando Efectivo lleva monto.' : 'Elige Efectivo para usar billetes.';

            return `<span>Billetes</span><p class="pm-bills-empty">${why}</p>`;
        }

        const next = [];

        [50, 100, 200, 500, 1000].forEach((step) => {
            const value = Math.ceil(remaining / step) * step;

            if (value > remaining && !next.some((b) => b.value === value)) next.push({ value, step });
        });

        const list = next.sort((a, b) => a.value - b.value).slice(0, 3);

        return '<span>Billetes · lo que entrega</span><div class="pm-bills-list">'
            + `<button type="button" class="pm-bill is-exact" data-act="bill" data-amount="${remaining}">Exacto<small>${money(remaining)}</small></button>`
            + list.map((b) => `<button type="button" class="pm-bill b-${b.step}" data-act="bill" data-amount="${b.value}">$${b.value.toLocaleString('es-MX')}<small>Cambio ${money(round(b.value - remaining))}</small></button>`).join('')
            + '</div>';
    }

    // -- Piezas de la ventana --

    function headHtml() {
        const tab = (view, icon, label, extra = '') => {
            const on = pg.view === view;

            return `<button type="button" class="pm-tab${on ? ' is-active' : ''}" role="tab" aria-selected="${on}" data-act="view" data-value="${view}">${ico(icon)}${label}${extra}</button>`;
        };

        return '<div class="pm-head">'
            +   `<div class="pm-head-ico">${ico('wallet')}</div>`
            +   `<div class="pm-head-text"><h2 id="pmTitle">Gestión de pagos</h2><p>Folio <b>${ORDER.folio}</b> · ${esc(ORDER.client)} · Entrega ${ORDER.delivery}</p></div>`
            +   `<div class="pm-tabs" role="tablist">${tab('pay', 'hand-coins', 'Registrar pago')}${tab('history', 'history', 'Historial', `<span class="pm-count">${pg.payments.length}</span>`)}</div>`
            +   `<button type="button" class="pm-x" data-act="close" aria-label="Cerrar">${ico('x')}</button>`
            + '</div>';
    }

    function turnChip(t) {
        if (t.state === 'open') return `<span class="pm-turn is-open"><i></i>${t.name} abierto · ${esc(t.who)}</span>`;
        if (t.state === 'old')  return `<span class="pm-turn is-old"><i></i>${t.name} sin cerrar · desde ${t.since}</span>`;

        return '<span class="pm-turn is-none"><i></i>Sin turno abierto</span>';
    }

    // Las dos tarjetas de alpha: de dónde es el pedido → quién cobra.
    function branchesHtml() {
        const cross = isCross();
        const paid  = order().balance <= 0.005;
        const opts  = Object.keys(BRANCHES).map((id) => {
            const n = Number(id);

            return `<option value="${n}"${n === pg.cobro ? ' selected' : ''}>${BRANCHES[n]}${n === SESSION ? ' · tu sesión' : ''}</option>`;
        }).join('');

        return '<div class="pm-branches">'
            +   '<div class="pm-branch">'
            +     `<span class="pm-branch-ico">${ico('store')}</span>`
            +     `<span class="pm-branch-text"><span>Origen del pedido</span><b>${BRANCHES[pg.origin]}</b><small>Ahí se levantó ${ORDER.folio}</small></span>`
            +   '</div>'
            +   `<div class="pm-branch-arrow">${ico('arrow-right')}</div>`
            +   `<div class="pm-branch is-cobro${cross ? ' is-cross' : ''}">`
            +     (cross ? `<span class="pm-cross">${ico('arrow-right-left')}Otra sucursal</span>` : '')
            +     `<span class="pm-branch-ico">${ico('landmark')}</span>`
            +     '<div class="pm-branch-text">'
            +       '<label for="pmCobro">Sucursal que cobra</label>'
            +       `<div class="pm-branch-row"><select id="pmCobro"${paid ? ' disabled' : ''}>${opts}</select>${turnChip(turn(pg.cobro))}</div>`
            +     '</div>'
            +   '</div>'
            + '</div>';
    }

    // Los recuadros de alpha: Total en azul, Pagado en verde, Por cobrar en rojo (verde al saldar).
    function summaryHtml() {
        return '<div class="pm-sum">'
            +   `<div class="pm-stat is-total"><span>${ico('receipt-text')}Total</span><b id="pmSumTotal"></b><small id="pmSumTotalNote"></small></div>`
            +   `<div class="pm-stat is-paid"><span>${ico('circle-check')}Pagado</span><b id="pmSumPaid"></b><small id="pmSumPaidNote"></small></div>`
            +   `<div class="pm-stat is-due" id="pmSumDueBox"><span>${ico('hand-coins')}Por cobrar</span><b id="pmSumDue"></b><small id="pmSumDueNote"></small></div>`
            +   '<div class="pm-progress"><div class="pm-bar"><i class="is-paid" id="pmBarPaid"></i><i class="is-now" id="pmBarNow"></i></div><span id="pmBarText"></span></div>'
            + '</div>';
    }

    // Los mosaicos: el catálogo de la sucursal que cobra.
    function tilesHtml() {
        const tile = (m) => `<button type="button" class="pm-tile" data-act="pick" data-id="${m.id}" style="--m:${m.color}" aria-pressed="false">`
            + `<span class="pm-tile-ico">${ico(m.icon)}</span>`
            + `<span class="pm-tile-text"><b>${esc(m.name)}</b><small></small></span>`
            + `<span class="pm-tile-check">${ico('check')}</span>`
            + '</button>';

        return '<div>'
            +   `<div class="pm-sec-head"><span>Forma de pago · <b>${BRANCHES[pg.cobro]}</b></span><small>Toca otra para cambiar · escribe un monto para dividir</small></div>`
            +   `<div class="pm-tiles" role="group" aria-label="Formas de pago">${methods().map(tile).join('')}</div>`
            + '</div>';
    }

    function rowHtml(m, canDrop) {
        return `<div class="pm-mrow" data-field="${m.id}" style="--m:${m.color}">`
            +   `<button type="button" class="pm-mname" data-act="rest" data-id="${m.id}" title="Que ${esc(m.name)} cubra lo que falta">`
            +     `<span class="pm-mico">${ico(m.icon)}</span>`
            +     `<span class="pm-mtext"><b>${esc(m.name)}</b><small data-hint>${m.hint}</small></span>`
            +   '</button>'
            +   `<span class="pm-mtag" data-tag hidden>${ico('calculator')}Lo que falta</span>`
            +   `<div class="pm-amt"><span>$</span><input id="pmAmt${m.id}" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" data-field="${m.id}" aria-label="Importe en ${esc(m.name)}"></div>`
            +   `<button type="button" class="pm-drop" data-act="drop" data-id="${m.id}" title="Quitar ${esc(m.name)}" aria-label="Quitar ${esc(m.name)}"${canDrop ? '' : ' hidden'}>${ico('x')}</button>`
            + '</div>';
    }

    function recvHtml() {
        return '<div class="pm-mrow is-recv" id="pmRecvRow" data-field="received" hidden>'
            +   `<span class="pm-recv-label">${ico('arrow-down-to-line')}Recibe en efectivo <small>· el billete que entrega</small></span>`
            +   '<div class="pm-amt"><span>$</span><input id="pmRecv" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" data-field="received" aria-label="Recibe en efectivo"></div>'
            + '</div>';
    }

    // Solo las formas elegidas; «Recibe» cuelga de Efectivo.
    function rowsHtml() {
        const list = selected();

        return list.map((m) => rowHtml(m, list.length > 1) + (m.cash ? recvHtml() : '')).join('');
    }

    function discHtml() {
        const seg = (mode, label) => `<button type="button" class="pm-seg-btn${pg.discMode === mode ? ' is-active' : ''}" data-act="mode" data-value="${mode}">${label}</button>`;
        const opt = (r) => `<option value="${r.id}">${esc(r.name)} · ${r.auth ? 'la autoriza Dueño o Supervisor' : `hasta ${r.max} %`}</option>`;

        return `<div class="pm-disc" id="pmDisc"${pg.discOpen ? '' : ' hidden'}>`
            +   `<p class="pm-disc-title">${ico('percent')}Descuento al pedido</p>`
            +   `<div class="pm-field"><label for="pmReason">Motivo</label><select id="pmReason"><option value="">Elige el motivo</option>${REASONS.map(opt).join('')}</select></div>`
            +   '<div class="pm-field" id="pmDiscField"><label for="pmDiscValue">Descuento</label><div class="pm-disc-value">'
            +     '<input id="pmDiscValue" type="text" inputmode="decimal" autocomplete="off" placeholder="0" data-field="disc">'
            +     `<div class="pm-seg">${seg('percent', '%')}${seg('amount', '$')}</div>`
            +   '</div></div>'
            +   '<div class="pm-field is-wide"><label for="pmDiscNote">Nota del descuento</label><input id="pmDiscNote" type="text" autocomplete="off" placeholder="Opcional"></div>'
            +   '<p class="pm-disc-msg" id="pmDiscMsg"></p>'
            + '</div>';
    }

    // Teclado de caja: 7-8-9 arriba, como Soft. La tecla alta pasa de campo, no cobra.
    // Con mouse no hay teclado: la columna queda solo para los billetes.
    function sideHtml() {
        if (!pg.touch) return '<aside class="pm-side is-mouse" aria-label="Billetes"><div class="pm-bills" id="pmBills"></div></aside>';

        const key = (k, label, cls = '', aria = '') => `<button type="button" class="pm-key${cls ? ` ${cls}` : ''}" data-act="key" data-key="${k}"${aria ? ` aria-label="${aria}"` : ''}>${label}</button>`;

        return '<aside class="pm-side" aria-label="Teclado">'
            +   `<div class="pm-pad-disp"><span>${ico('keyboard')}<span id="pmPadLabel">Teclado</span></span><b id="pmPadValue">${money(0)}</b></div>`
            +   '<div class="pm-pad">'
            +     key('7', '7') + key('8', '8') + key('9', '9') + key('back', ico('delete'), 'is-fn', 'Borrar')
            +     key('4', '4') + key('5', '5') + key('6', '6') + key('clear', 'C', 'is-clear', 'Limpiar')
            +     key('1', '1') + key('2', '2') + key('3', '3') + key('next', `${ico('corner-down-left')}Siguiente`, 'is-next')
            +     key('0', '0') + key('00', '00') + key('.', '.')
            +   '</div>'
            +   '<div class="pm-bills" id="pmBills"></div>'
            + '</aside>';
    }

    function payHtml() {
        return '<div class="pm-pay" id="pmPayForm">'
            +   '<div class="pm-main">'
            +     branchesHtml()
            +     summaryHtml()
            +     tilesHtml()
            +     '<div class="pm-grid">'
            +       '<div class="pm-grid-head"><span>Reparto del cobro</span><span>Importe</span></div>'
            +       `<div class="pm-rows" id="pmRows">${rowsHtml()}</div>`
            +     '</div>'
            +     discHtml()
            +     '<div class="pm-field"><label for="pmNote">Observación</label><input id="pmNote" type="text" autocomplete="off" placeholder="Opcional · sale en el historial"></div>'
            +   '</div>'
            +   sideHtml()
            + '</div>';
    }

    // Sin cobro: el pedido ya se pagó, o la sucursal que cobra no tiene turno abierto.
    function blockHtml() {
        const o    = order();
        const n    = pg.payments.length;
        const t    = turn(pg.cobro);
        const name = BRANCHES[pg.cobro];
        const home = pg.cobro !== SESSION && turn(SESSION).state === 'open'
            ? `<button type="button" class="pm-block-go is-ok" data-act="cobro-here">${ico('landmark')}Cobrar en ${BRANCHES[SESSION]}</button>`
            : '';

        const box = (cls, icon, title, text, buttons) => `<div class="pm-block ${cls}">`
            + `<div class="pm-block-ico">${ico(icon)}</div>`
            + `<div class="pm-block-text"><b>${title}</b><p>${text}</p>${buttons ? `<div class="pm-block-go-row">${buttons}</div>` : ''}</div>`
            + '</div>';

        if (o.balance <= 0.005) {
            return box('is-ok', 'circle-check', 'Este pedido ya está pagado',
                `Se cobraron ${money(o.paid)} en ${n} ${n === 1 ? 'pago' : 'pagos'}. Para quitar uno, ve al historial.`,
                `<button type="button" class="pm-block-go is-ok" data-act="view" data-value="history">${ico('history')}Ver historial</button>`);
        }

        if (t.state === 'old') {
            return box('is-warn', 'lock', `${name} tiene un turno sin cerrar`,
                `El ${t.name} de ${esc(t.who)} sigue abierto desde el ${t.since}. Hasta que se cierre, en ${name} no se cobra ni se quitan pagos.`,
                `<button type="button" class="pm-block-go" data-act="go-cortes">${ico('receipt-text')}Ir a Cortes</button>${home}`);
        }

        const open = pg.cobro === SESSION
            ? `<button type="button" class="pm-block-go" data-act="open-turn">${ico('clock')}Abrir turno</button>`
            : '';

        return box('is-warn', 'lock', `${name} no tiene turno abierto`,
            `Sin turno abierto no se registran ni se quitan pagos en ${name}. Lo ya cobrado se ve en el historial.`,
            open + home);
    }

    function historyHtml() {
        const o = order();

        const rows = pg.payments.map((p, i) => {
            const change = round((p.tendered || p.amount) - p.amount);
            const t      = turn(p.branch);

            // En el celular solo queda el ícono: el texto va también en title.
            const lock = (text) => `<span class="pm-lock" title="${text}">${ico('lock')}<span>${text}</span></span>`;

            let act = lock('Turno cerrado');

            if (p.open && t.state !== 'open') act = lock(`Sin turno en ${BRANCHES[p.branch]}`);
            else if (p.open)                  act = `<button type="button" class="pm-del" data-act="del" data-idx="${i}" title="Quitar pago" aria-label="Quitar pago">${ico('trash-2')}<span>Quitar</span></button>`;

            const other = p.branch !== pg.origin ? `<span class="pm-chip" title="Otra sucursal">${ico('arrow-right-left')}<span>Otra sucursal</span></span>` : '';

            return `<tr${p.fresh ? ' class="is-new"' : ''}>`
                +   `<td>${p.date}<small>${p.time}</small></td>`
                +   `<td><span class="pm-hist-method" title="${esc(p.m.name)}"><span class="pm-mico" style="--m:${p.m.color}">${ico(p.m.icon)}</span><span class="pm-hist-name">${esc(p.m.name)}</span></span>${change > 0.005 ? `<small>Recibió ${money(p.tendered)} · cambio ${money(change)}</small>` : ''}</td>`
                +   `<td>${esc(p.concept)}${p.fresh ? ' <span class="ord-cut-pill is-ok">Nuevo</span>' : ''}</td>`
                +   `<td><span class="pm-hist-branch">${BRANCHES[p.branch]}${other}</span><small>${p.turn}</small></td>`
                +   `<td>${esc(p.who)}</td>`
                +   `<td class="r"><b>${money(p.amount)}</b></td>`
                +   `<td class="c">${act}</td>`
                + '</tr>';
        }).join('') || '<tr><td colspan="7" class="ord-cut-empty">Aún no se ha realizado ningún abono.</td></tr>';

        // Una celda por columna: así las que se esconden en el celular no descuadran el pie.
        const foot = (label, value) => `<tr><td>${label}</td><td></td><td></td><td></td><td></td><td class="r">${value}</td><td></td></tr>`;

        return '<div class="pm-hist">'
            +   summaryHtml()
            +   '<div class="ord-cut-grid"><table>'
            +     '<thead><tr><th>Fecha</th><th>Forma de pago</th><th>Concepto</th><th>Cobró en</th><th>Cobró</th><th class="r">Importe</th><th class="c">Acción</th></tr></thead>'
            +     `<tbody>${rows}</tbody>`
            +     '<tfoot>'
            +       (pg.discApplied > 0 ? foot('Descuento', `−${money(pg.discApplied)}`) : '')
            +       foot('Pagado', money(o.paid))
            +       foot('Por cobrar', money(o.balance))
            +     '</tfoot>'
            +   '</table></div>'
            + '</div>';
    }

    // mode: pay (cobrando) | history | block (pagado o sin turno).
    function footHtml(mode, toPay) {
        const info = mode === 'history'
            ? 'Quitar un pago pide el motivo y solo se puede con el turno abierto de la sucursal que lo cobró'
            : 'El cobro entra al turno de la sucursal que cobra';

        // Cobrando, el pie lleva el resultado (cambio, faltan, sobran): siempre a la vista.
        const left = mode === 'pay'
            ? '<div class="pm-res-state" id="pmResState" aria-live="polite"></div>'
            : `<div class="pm-foot-info">${ico('info')}<span>${info}</span></div>`;

        return '<div class="pm-foot">'
            +   left
            +   (mode === 'pay' ? `<button type="button" class="pm-btn${pg.discOpen ? ' is-on' : ''}" id="pmDiscBtn" data-act="disc">${ico('percent')}<span id="pmDiscLabel">${pg.discOpen ? 'Quitar descuento' : 'Descuento'}</span><kbd class="pm-kbd">F4</kbd></button>` : '')
            +   `<button type="button" class="pm-btn" data-act="close">${ico('arrow-left')}Volver<kbd class="pm-kbd">Esc</kbd></button>`
            +   (mode === 'pay' || toPay ? `<button type="button" class="pm-btn is-primary" id="pmSave" data-act="save"><span id="pmSaveLabel">Registrar pago</span><kbd class="pm-kbd">F2</kbd></button>` : '')
            + '</div>';
    }

    // La confirmación de alpha: importe, formas, sucursal que cobra y su turno.
    function confirmHtml(c) {
        const t     = turn(pg.cobro);
        const after = Math.max(0, round(c.balance - c.applied));
        const disc  = c.applied <= 0;
        const row   = (dt, dd) => `<dt>${dt}</dt><dd>${dd}</dd>`;

        const list = c.payments.map((p) => {
            const m = methods().find((x) => x.id === p.method_id);

            return `<li><span class="pm-mico" style="--m:${m.color}">${ico(m.icon)}</span>${esc(m.name)}<b>${money(p.amount)}</b></li>`;
        }).join('');

        const cross = isCross()
            ? `<p class="pm-confirm-warn">${ico('triangle-alert')}<span>Cobro cruzado: el pedido es de <b>${BRANCHES[pg.origin]}</b>, pero el cobro entra al ${t.name} de <b>${BRANCHES[pg.cobro]}</b>.</span></p>`
            : '';

        return '<div class="pm-confirm" id="pmConfirm" role="alertdialog" aria-modal="true" aria-labelledby="pmConfirmTitle">'
            +   '<div class="pm-confirm-card">'
            +     `<div class="pm-confirm-head"><div class="pm-head-ico">${ico(disc ? 'percent' : 'hand-coins')}</div><div><h3 id="pmConfirmTitle">${disc ? '¿Aplicar descuento?' : '¿Registrar pago?'}</h3><p>${ORDER.folio} · ${esc(ORDER.client)}</p></div></div>`
            +     `<div class="pm-confirm-amt"><span>${disc ? 'Descuento' : 'Importe'}</span><b>${money(disc ? c.d.amount : c.applied)}</b></div>`
            +     (list ? `<ul class="pm-confirm-list">${list}</ul>` : '')
            +     '<dl class="pm-confirm-rows">'
            +       (c.change > 0.005 ? row('Recibe', `${money(c.cashGiven)} · cambio <b>${money(c.change)}</b>`) : '')
            +       (c.d.amount > 0 && !disc ? row('Descuento', `−${money(c.d.amount)} · ${esc(c.d.reason.name)}`) : '')
            +       row('Sucursal que cobra', `<b>${BRANCHES[pg.cobro]}</b> · ${t.name}`)
            +       row('Saldo después', after <= 0.005 ? 'Queda pagado' : money(after))
            +     '</dl>'
            +     cross
            +     '<div class="pm-confirm-foot">'
            +       '<button type="button" class="pm-btn" data-act="confirm-no">Revisar<kbd class="pm-kbd">Esc</kbd></button>'
            +       `<button type="button" class="pm-btn is-primary" id="pmConfirmYes" data-act="confirm-yes"><span data-label>${disc ? 'Sí, aplicar' : 'Sí, registrar'}</span><kbd class="pm-kbd">Enter</kbd></button>`
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
            + `<div class="pm-page-head"><div><h1>Pedidos</h1><p>Las 3 sucursales · ${TODAY} · el cobro se abre con «Cobrar»</p></div></div>`
            + '<div class="tp-card"><div class="tp-table-wrap"><table class="tp-table">'
            +   '<thead><tr><th>Folio</th><th>Cliente</th><th>Sucursal</th><th>Entrega</th><th>Estado</th><th class="num">Total</th><th class="num">Saldo</th><th></th></tr></thead>'
            +   '<tbody>' + rows.map((r) => '<tr>'
            +     `<td><b>${r.folio}</b></td><td>${esc(r.client)}</td><td>${BRANCHES[r.branch]}</td><td>${r.delivery}</td><td>${pill(r.balance, r.total)}</td>`
            +     `<td class="num">${money(r.total)}</td><td class="num"><b>${money(r.balance)}</b></td>`
            +     `<td class="num"><button type="button" class="pm-row-pay" data-act="open" data-folio="${r.folio}">${ico('hand-coins')}Cobrar</button></td>`
            +   '</tr>').join('') + '</tbody>'
            + '</table></div></div>';
    }

    function renderWin() {
        const overlay = $('#pmOverlay');

        overlay.hidden = !pg.open;

        if (!pg.open) {
            overlay.innerHTML = '';
            return;
        }

        const pay = pg.view === 'pay';
        const can = canPay();

        let body = historyHtml();
        let mode = 'history';

        if (pay && can) {
            body = payHtml();
            mode = 'pay';
        } else if (pay) {
            body = `<div class="pm-pay is-solo"><div class="pm-main">${branchesHtml()}${summaryHtml()}${blockHtml()}</div></div>`;
            mode = 'block';
        }

        overlay.innerHTML = '<div class="pm-win" role="dialog" aria-modal="true" aria-labelledby="pmTitle">'
            + headHtml()
            + `<div class="pm-body">${body}</div>`
            + footHtml(mode, mode === 'history' && can)
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

        if ($('#pmPayForm')) {
            paintCalc();
            focusField(pg.active);
        } else {
            paintStatic();
        }
    }

    // Con descuento, el total de antes sale tachado (como en alpha).
    function totalNote(o, cut) {
        if (cut > 0)            return `<s>${money(o.total)}</s> · −${money(cut)}`;
        if (pg.discApplied > 0) return `<s>${money(ORDER.subtotal)}</s> · −${money(pg.discApplied)}`;

        return 'Sin descuento';
    }

    function paintSummary(v) {
        const base    = v.total > 0 ? v.total : 1;
        const paidPct = Math.min(100, v.paid / base * 100);
        const nowPct  = Math.min(100 - paidPct, (v.now || 0) / base * 100);

        $('#pmSumTotal').textContent     = money(v.total);
        $('#pmSumTotalNote').innerHTML   = v.totalNote;
        $('#pmSumTotalNote').classList.toggle('is-disc', v.disc);
        $('#pmSumPaid').textContent      = money(v.paid);
        $('#pmSumPaidNote').textContent  = v.count ? `${v.count} ${v.count === 1 ? 'pago' : 'pagos'}` : 'Sin pagos';
        $('#pmSumDue').textContent       = money(v.due);
        $('#pmSumDueNote').textContent   = v.dueNote;
        $('#pmSumDueBox').classList.toggle('is-done', v.due <= 0.005);

        $('#pmBarPaid').style.width = `${paidPct}%`;
        $('#pmBarNow').style.width  = `${nowPct}%`;
        $('#pmBarText').textContent = `${Math.round(paidPct)} % pagado` + (nowPct > 0.5 ? ` · +${Math.round(nowPct)} % con este cobro` : '');
    }

    // Pagado, sin turno o historial: el resumen sin cobro en curso.
    function paintStatic() {
        const o = order();

        paintSummary({
            total:     o.total,
            totalNote: totalNote(o, 0),
            disc:      pg.discApplied > 0,
            paid:      o.paid,
            count:     pg.payments.length,
            due:       o.balance,
            dueNote:   o.balance <= 0.005 ? 'Pagado completo' : 'Saldo del pedido',
            now:       0
        });
    }

    // Los mosaicos encendidos dicen cuánto lleva cada forma.
    function paintTiles(c) {
        $$('button.pm-tile').forEach((el) => {
            const id    = Number(el.dataset.id);
            const on    = pg.sel.includes(id);
            const r     = c.rows.find((x) => x.m.id === id);
            const value = r ? (r.m.cash ? c.cashPaid : r.amount) : 0;

            el.classList.toggle('is-on', on);
            el.setAttribute('aria-pressed', String(on));
            el.querySelector('small').textContent = on ? (value > 0 ? money(value) : 'Sin monto') : '';
        });
    }

    /*  Como paintRows() de hoy: las filas no se vuelven a pintar al teclear (se
        perdería el foco); solo cambian su marca, su pista y, la que cubre lo
        que falta, su monto. */
    function paintCalc() {
        if (!$('#pmPayForm')) return;

        const c = calc();
        const o = order();

        c.rows.forEach((r) => {
            const input = fieldInput(r.m.id);
            const row   = input.closest('.pm-mrow');
            const auto  = r.m.id === pg.auto;

            if (auto) input.value = r.amount > 0 ? r.amount.toFixed(2) : '';

            row.classList.toggle('is-auto', auto);
            row.querySelector('[data-hint]').textContent = rowHint(r, c);
            row.querySelector('[data-tag]').hidden = !auto;
            input.parentElement.classList.toggle('is-bad', c.bad === r.m);
        });

        // «Recibe» y los billetes acompañan a Efectivo solo cuando lleva monto.
        const recvRow = $('#pmRecvRow');
        const recv    = $('#pmRecv');
        const cash    = selected().find((m) => m.cash);

        if (recv) {
            if (c.cashPaid <= 0 && recv.value !== '') recv.value = '';

            recvRow.hidden   = c.cashPaid <= 0;
            recv.placeholder = c.cashPaid > 0 ? `Exacto: ${money(c.cashPaid)}` : '0.00';
            recv.parentElement.classList.toggle('is-bad', c.badRec);
        }

        if ((!recvRow || recvRow.hidden) && pg.active === 'received') pg.active = String(cash ? cash.id : pg.sel[0]);

        $('#pmBills').innerHTML = bills(c.cashPaid, Boolean(cash));
        $('#pmRows').classList.toggle('is-single', pg.sel.length === 1);

        const after = Math.max(0, round(c.balance - c.applied));
        const stuck = c.bad || c.badRec || c.over > 0.005 || c.missing > 0.005;

        let dueNote = 'Saldo del pedido';

        if (!stuck && c.applied > 0) dueNote = after <= 0.005 ? 'Con este cobro queda pagado' : `Después de cobrar: ${money(after)}`;

        paintSummary({
            total:     c.total,
            totalNote: totalNote(o, c.d.amount),
            disc:      c.d.amount > 0 || pg.discApplied > 0,
            paid:      o.paid,
            count:     pg.payments.length,
            due:       c.balance,
            dueNote:   dueNote,
            now:       stuck ? 0 : c.applied
        });

        paintTiles(c);
        paintResult(c);
        paintDiscount(c);
        paintActive();
        paintPad();

        $('#pmSaveLabel').textContent = saveLabel(c);
        $('#pmSave').classList.toggle('is-off', problem(c) !== '');
    }

    // Los estados de summary(), en el mismo orden. El desglose ya se ve en las filas.
    function paintResult(c) {
        const after = Math.max(0, round(c.balance - c.applied));
        const names = c.payments.map((p) => methods().find((m) => m.id === p.method_id).name).join(' + ');
        const tail  = after <= 0.005 ? 'Queda pagado.' : `Saldo después: ${money(after)}.`;

        let st;   // [clase, etiqueta, grande, nota]

        if (c.bad)                                   st = ['is-bad', 'Corrige', 'Monto no válido', `Revisa lo escrito en ${c.bad.name}.`];
        else if (c.badRec)                           st = ['is-bad', 'Corrige', 'Monto no válido', 'Revisa lo que entrega en efectivo.'];
        else if (c.over > 0.005)                     st = ['is-bad', 'Sobran', money(c.over), `No se cobra de más: baja algún monto. Saldo: ${money(c.balance)}.`];
        else if (c.applied <= 0 && c.d.amount > 0)   st = ['is-info', 'Solo descuento', money(c.d.amount), `El total queda en ${money(c.total)}.`];
        else if (c.applied <= 0)                     st = ['', 'Sin monto', money(0), 'Escribe cuánto paga el cliente.'];
        else if (c.missing > 0.005)                  st = ['is-bad', 'Faltan', money(c.missing), 'El efectivo recibido no alcanza.'];
        else if (c.change > 0.005)                   st = ['is-ok', 'Cambio', money(c.change), `Recibe ${money(c.cashGiven)}, se aplican ${money(c.cashPaid)}. ${tail}`];
        else if (c.payments.length === 1 && c.cashPaid > 0) st = ['is-ok', 'Efectivo', 'Exacto', `Sin cambio. ${tail}`];
        else                                         st = ['is-ok', 'Cobra', money(c.applied), `${names}. ${tail}`];

        const state = $('#pmResState');

        state.className = `pm-res-state${st[0] ? ` ${st[0]}` : ''}`;
        state.innerHTML = `<div class="pm-res-main"><span>${esc(st[1])}</span><b>${st[2]}</b></div><small>${esc(st[3])}</small>`;
    }

    function paintDiscount(c) {
        const d   = c.d;
        const msg = $('#pmDiscMsg');

        msg.className = `pm-disc-msg${d.error ? ' is-bad' : (d.amount ? ' is-ok' : '')}`;
        msg.innerHTML = d.error
            ? esc(d.error)
            : (d.amount ? `Descuento de <b>${money(d.amount)}</b> (${d.percent} % del subtotal). El total queda en ${money(c.total)}.` : 'Elige el motivo y escribe el descuento.');

        $('#pmDiscBtn').classList.toggle('is-on', pg.discOpen);
        $$('button.pm-seg-btn').forEach((el) => el.classList.toggle('is-active', el.dataset.value === pg.discMode));
    }

    // La fila (o el campo) donde escribe el teclado lleva la barra de color.
    function paintActive() {
        $$('.pm-mrow').forEach((row) => row.classList.toggle('is-active', row.dataset.field === pg.active));

        const disc = $('#pmDiscField');

        if (disc) disc.classList.toggle('is-active', pg.active === 'disc');
    }

    function paintPad() {
        if (!$('#pmPadLabel')) return;   // con mouse no hay teclado

        const f     = pg.active;
        const input = fieldInput(f);
        const m     = methods().find((x) => String(x.id) === f);

        let label = 'Teclado';

        if (f === 'received')  label = 'Recibe en efectivo';
        else if (f === 'disc') label = pg.discMode === 'percent' ? 'Descuento en %' : 'Descuento en $';
        else if (m)            label = m.id === pg.auto ? `${m.name} · lo que falta` : m.name;

        const raw   = input ? input.value.trim() : '';
        const value = raw === '' ? 0 : amount(raw);

        let text = value === null ? raw : money(value);

        if (value !== null && f === 'disc' && pg.discMode === 'percent') text = `${value} %`;

        $('#pmPadLabel').textContent = label;
        $('#pmPadValue').textContent = text;
    }

    // -- Formas de pago --

    // Vuelve a pintar solo las filas (al elegir o quitar una forma) sin perder lo escrito.
    function paintRows() {
        const keep = {};

        $$('#pmRows input[data-field]').forEach((el) => { keep[el.dataset.field] = el.value; });

        $('#pmRows').innerHTML = rowsHtml();

        Object.keys(keep).forEach((f) => {
            const el = fieldInput(f);

            if (el && f !== String(pg.auto)) el.value = keep[f];
        });

        icons();
        paintCalc();
        focusField(pg.active);
    }

    /*  Tocar un mosaico apagado cambia la forma que cubre lo que falta.
        Si ya escribiste un monto fijo en otra, la nueva se suma y cubre el resto. */
    function pick(id) {
        if (pg.sel.includes(id)) return takeRest(id);
        if (pg.sel.length >= 6)  return toast('Un cobro admite hasta 6 métodos de pago.', 'warn');

        if (pg.auto && pg.sel.includes(pg.auto)) pg.sel = pg.sel.filter((x) => x !== pg.auto);

        pg.sel.push(id);
        pg.auto   = id;
        pg.active = String(id);
        pg.fresh  = true;

        paintRows();
    }

    // La × de la fila; siempre queda al menos una forma.
    function drop(id) {
        if (pg.sel.length <= 1) return;

        pg.sel = pg.sel.filter((x) => x !== id);

        if (pg.sel.length === 1)  pg.auto = pg.sel[0];
        else if (pg.auto === id)  pg.auto = 0;

        if (pg.active === String(id) || pg.active === 'received') pg.active = String(pg.auto || pg.sel[0]);

        paintRows();
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
        const recv = $('#pmRecvRow');

        selected().forEach((m) => {
            list.push(String(m.id));

            if (m.cash && recv && !recv.hidden) list.push('received');
        });

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

    // Tocar el nombre de una forma (o su mosaico encendido): esa cubre lo que falta.
    function takeRest(id) {
        const old = fieldInput(pg.auto);

        if (old && pg.auto !== id) old.value = '';

        pg.auto = id;
        paintCalc();
        focusField(String(id));
    }

    function toggleDisc() {
        if (!$('#pmPayForm')) return;

        pg.discOpen = !pg.discOpen;

        $('#pmDisc').hidden = !pg.discOpen;
        $('#pmDiscLabel').textContent = pg.discOpen ? 'Quitar descuento' : 'Descuento';

        if (pg.discOpen) {
            $('#pmReason').focus();
        } else {
            $('#pmReason').value    = '';
            $('#pmDiscValue').value = '';

            if (pg.active === 'disc') focusField(String(pg.sel[0]));
        }

        paintCalc();
    }

    // -- Cobrar --

    // F2 / Enter: revisa y pide la confirmación. Nada se guarda todavía.
    function save() {
        if (!pg.open || pg.confirm) return;

        // En el historial, F2 lleva a registrar.
        if (!$('#pmPayForm')) {
            if (pg.view === 'history' && canPay()) {
                pg.view = 'pay';
                resetForm();
                render();
            }
            return;
        }

        const c   = calc();
        const why = problem(c);

        if (why) return toast(why, 'warn');

        c.note     = $('#pmNote').value.trim();
        pg.confirm = c;

        $('.pm-win').insertAdjacentHTML('beforeend', confirmHtml(c));
        icons();
        $('#pmConfirmYes').focus();
    }

    function closeConfirm() {
        if (pg.busy) return;

        pg.confirm = null;

        const el = $('#pmConfirm');

        if (el) el.remove();

        focusField(pg.active);
    }

    // «Sí, registrar»: el candado (busy) impide un segundo cobro con doble clic o doble Enter.
    function commit() {
        if (pg.busy || !pg.confirm) return;

        const c   = pg.confirm;
        const yes = $('#pmConfirmYes');

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

        pick(el) {
            pick(Number(el.dataset.id));
        },

        drop(el) {
            drop(Number(el.dataset.id));
        },

        rest(el) {
            takeRest(Number(el.dataset.id));
        },

        key(el) {
            press(el.dataset.key);
        },

        // El billete llena «Recibe»; la siguiente tecla lo reemplaza.
        bill(el) {
            const input = $('#pmRecv');

            if (!input) return;

            input.value = Number(el.dataset.amount).toFixed(2);
            pg.active   = 'received';
            typed(input);
            focusField('received');
            pg.fresh = true;
            paintActive();
            paintPad();
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

            if (!p || turn(p.branch).state !== 'open') return;

            pg.payments.splice(at, 1);
            render();
            toast(`Pago quitado · ${money(p.amount)}. Hoy primero pide el motivo; eso no cambia.`);
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

    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-act]');

        if (el && !el.disabled && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el);
    });

    // El teclado, los billetes y los mosaicos no le quitan el foco al campo.
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('button.pm-key, button.pm-bill, button.pm-tile')) e.preventDefault();
    });

    document.addEventListener('input', (e) => {
        if (!e.target.closest('#pmPayForm') || e.target.id === 'pmCobro') return;

        if (e.target.dataset.field) typed(e.target);
        else paintCalc();
    });

    document.addEventListener('change', (e) => {
        if (e.target.id === 'pmReason') paintCalc();

        // Otra sucursal que cobra: otro turno y otro catálogo de formas de pago.
        if (e.target.id === 'pmCobro') {
            pg.cobro = Number(e.target.value);
            resetForm();
            render();
        }
    });

    document.addEventListener('focusin', (e) => {
        const f = e.target.dataset ? e.target.dataset.field : '';

        if (!f || !e.target.closest('#pmPayForm')) return;

        pg.active = f;
        pg.fresh  = true;
        paintActive();
        paintPad();
    });

    document.addEventListener('keydown', (e) => {
        if ($('#pmOverlay').hidden) return;

        // Con la confirmación abierta solo cuentan Esc (revisar) y Enter / F2 (registrar).
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
        } else if (e.key === 'Enter' && e.target.matches('#pmPayForm input')) {
            e.preventDefault();
            save();
        }
    });

    // -- Arranque --

    // La tira de la maqueta crece al envolverse: la ventana le deja su hueco.
    const fitDemo = () => document.documentElement.style.setProperty('--pm-demo', `${$('.tp-demo').offsetHeight}px`);

    fitDemo();
    window.addEventListener('resize', fitDemo);

    const dark = document.documentElement.classList.contains('dark');

    document.body.classList.toggle('dark-mode', dark);
    $('.navbar-main').classList.toggle('nav-dark', dark);

    setCase('abono');
})();
