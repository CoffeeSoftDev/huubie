/*  Maqueta: Gestión de pagos tipo Soft (templates/pagos-soft-propuesta.html).
    Las cuentas son las de hoy, copiadas de src/js/pedido-cobro.js: calc(),
    discountCalc(), summary(), saveLabel(), rowHint() y bills(). Lo que cambia
    es la ventana: display, una fila por forma de pago, teclado y billetes.
    Datos de mentira: no llama a ningún ctrl. */

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

    const TODAY = '15/11/2026';
    const USER  = 'Andrea M.';

    const METHODS = [
        { id: 1, name: 'Efectivo',           cash: true, icon: 'banknote',         tone: 'cash',     hint: 'Pago en efectivo' },
        { id: 2, name: 'Tarjeta de débito',              icon: 'credit-card',      tone: 'debit',    hint: 'Débito o crédito' },
        { id: 3, name: 'Tarjeta de crédito',             icon: 'credit-card',      tone: 'credit',   hint: 'Débito o crédito' },
        { id: 4, name: 'Transferencia',                  icon: 'arrow-left-right', tone: 'transfer', hint: 'Depósito o SPEI' }
    ];

    const CASH = METHODS.find((m) => m.cash);

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
        product:  'Pastel de tres leches · 20 personas',
        subtotal: 1850,
        delivery: '16/11/2026 · 13:00',
        turn:     'Turno 12 · abierto'
    };

    const PAY = {
        p1: { date: '10/11/2026', time: '10:12', method: 1, concept: 'Anticipo',    who: USER, amount: 500,  tendered: 500,  open: false },
        p2: { date: TODAY,        time: '09:40', method: 4, concept: 'Abono',       who: USER, amount: 320,  tendered: 320,  open: true },
        p3: { date: TODAY,        time: '11:05', method: 2, concept: 'Liquidación', who: USER, amount: 1030, tendered: 1030, open: true }
    };

    const CASES = {
        first:  { payments: [],                       turn: true },
        abono:  { payments: [PAY.p1, PAY.p2],         turn: true },
        paid:   { payments: [PAY.p1, PAY.p2, PAY.p3], turn: true },
        noturn: { payments: [PAY.p1, PAY.p2],         turn: false }
    };

    // Los demás pedidos de la lista de atrás (solo adorno).
    const OTHERS = [
        { folio: 'P-2113', client: 'Grupo Aurora', delivery: '15/11/2026 · 17:30', total: 3200, balance: 0 },
        { folio: 'P-2115', client: 'Luis Ortega',  delivery: '17/11/2026 · 10:00', total: 980,  balance: 980 },
        { folio: 'P-2116', client: 'Café Central', delivery: '18/11/2026 · 09:00', total: 2450, balance: 1225 }
    ];

    // -- Estado --

    const pg = {
        case:        'abono',
        view:        'pay',      // pay | history
        open:        true,       // la ventana encima de la lista
        turn:        true,
        payments:    [],
        discApplied: 0,
        auto:        CASH.id,    // la fila que cubre lo que falta
        active:      String(CASH.id),   // donde escribe el teclado: id del método, 'received' o 'disc'
        fresh:       true,       // la siguiente tecla reemplaza lo escrito
        discOpen:    false,
        discMode:    'percent',
        touch:       window.matchMedia('(any-pointer: coarse)').matches,   // el teclado solo sale en pantalla táctil
        tone:        'light'     // light | brand: cómo se pinta «Por cobrar»
    };

    function order() {
        const total = round(ORDER.subtotal - pg.discApplied);
        const paid  = round(pg.payments.reduce((s, p) => s + p.amount, 0));

        return { subtotal: ORDER.subtotal, total, paid, balance: Math.max(0, round(total - paid)) };
    }

    const canPay = () => pg.turn && order().balance > 0.005;

    function resetForm() {
        pg.auto     = CASH.id;
        pg.active   = String(CASH.id);
        pg.fresh    = true;
        pg.discOpen = false;
        pg.discMode = 'percent';
    }

    function fieldInput(f) {
        if (f === 'received') return $('#pgRecv');
        if (f === 'disc')     return $('#pgDiscValue');

        return $(`#pgAmt${f}`);
    }

    // -- Cuentas (las de pedido-cobro.js) --

    function calc() {
        const o       = order();
        const d       = discountCalc(o);
        const total   = round(o.total - d.amount);
        const balance = Math.max(0, round(total - o.paid));

        let bad = null;

        const rows = METHODS.map((m) => {
            if (m.id === pg.auto) return { m, amount: 0 };

            const raw   = String(fieldInput(m.id).value || '').trim();
            const value = raw === '' ? 0 : amount(raw);

            if (value === null && !bad) bad = m;

            return { m, amount: value || 0 };
        });

        const fixed = round(rows.reduce((s, r) => s + r.amount, 0));
        const auto  = rows.find((r) => r.m.id === pg.auto);

        if (auto) auto.amount = Math.max(0, round(balance - fixed));

        // Efectivo: lo escrito es «hasta cuánto»; se aplica lo que cabe y lo demás es cambio.
        const cashRow   = rows.find((r) => r.m.id === CASH.id);
        const cashTyped = cashRow.amount;
        const others    = round(rows.reduce((s, r) => s + (r === cashRow ? 0 : r.amount), 0));
        const room      = Math.max(0, round(balance - others));
        const cashPaid  = round(Math.min(cashTyped, room));
        const rawRec    = String($('#pgRecv').value || '').trim();
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

        const raw    = String($('#pgDiscValue').value || '').trim();
        const reason = REASONS.find((r) => String(r.id) === $('#pgReason').value);
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
    function bills(remaining) {
        if (remaining <= 0) return '<span>Billetes</span><p class="pg-bills-empty">Salen cuando Efectivo lleva monto.</p>';

        const next = [];

        [50, 100, 200, 500, 1000].forEach((step) => {
            const value = Math.ceil(remaining / step) * step;

            if (value > remaining && !next.some((b) => b.value === value)) next.push({ value, step });
        });

        const list = next.sort((a, b) => a.value - b.value).slice(0, 3);

        return '<span>Billetes · lo que entrega</span><div class="pg-bills-list">'
            + `<button type="button" class="pg-bill is-exact" data-act="bill" data-amount="${remaining}">Exacto<small>${money(remaining)}</small></button>`
            + list.map((b) => `<button type="button" class="pg-bill b-${b.step}" data-act="bill" data-amount="${b.value}">$${b.value.toLocaleString('es-MX')}<small>Cambio ${money(round(b.value - remaining))}</small></button>`).join('')
            + '</div>';
    }

    // -- Piezas de la ventana --

    function headHtml() {
        const tab = (view, icon, label, extra = '') => {
            const on = pg.view === view;

            return `<button type="button" class="pg-tab${on ? ' is-active' : ''}" role="tab" aria-selected="${on}" data-act="view" data-value="${view}">${ico(icon)}${label}${extra}</button>`;
        };

        return '<div class="pg-head">'
            +   `<div class="pg-head-ico">${ico('hand-coins')}</div>`
            +   `<div class="pg-head-text"><h2 id="pgTitle">Gestión de pagos</h2><p>${ORDER.folio} · ${esc(ORDER.client)} · ${esc(ORDER.product)}</p></div>`
            +   `<div class="pg-tabs" role="tablist">${tab('pay', 'wallet', 'Registrar pago')}${tab('history', 'history', 'Historial', `<span class="pg-count">${pg.payments.length}</span>`)}</div>`
            +   `<button type="button" class="pg-x" data-act="close" aria-label="Cerrar">${ico('x')}</button>`
            + '</div>';
    }

    // La franja de los cortes (.ord-cut-head): datos del pedido a la vista.
    function stripHtml() {
        const field = (label, value, cls = '') => `<div class="ord-cut-field"><span>${label}</span><b${cls ? ` class="${cls}"` : ''}>${value}</b></div>`;

        return '<div class="pg-strip"><div class="ord-cut-head">'
            + field('Pedido', ORDER.folio)
            + field('Cliente', esc(ORDER.client))
            + field('Entrega', ORDER.delivery)
            + field('Atiende', USER)
            + (pg.turn ? field('Turno', ORDER.turn) : field('Turno', 'Sin turno', 'is-off'))
            + '</div></div>';
    }

    function displayHtml() {
        return '<div class="pg-display">'
            +   '<div class="pg-disp-cell"><span>Total</span><b id="pgDispTotal"></b><small id="pgDispTotalNote"></small></div>'
            +   '<div class="pg-disp-cell"><span>Pagado</span><b id="pgDispPaid"></b><small id="pgDispPaidNote"></small></div>'
            +   '<div class="pg-disp-cell is-hero" id="pgDispHero"><span>Por cobrar</span><b id="pgDispDue"></b><small id="pgDispDueNote"></small></div>'
            +   '<div class="pg-disp-bar"><div class="pg-bar"><i class="is-paid" id="pgBarPaid"></i><i class="is-now" id="pgBarNow"></i></div><span id="pgBarText"></span></div>'
            + '</div>';
    }

    function rowHtml(m) {
        return `<div class="pg-mrow" data-field="${m.id}">`
            +   `<button type="button" class="pg-mname" data-act="rest" data-id="${m.id}" title="Que ${m.name} cubra lo que falta">`
            +     `<span class="pg-mico tone-${m.tone}">${ico(m.icon)}</span>`
            +     `<span class="pg-mtext"><b>${m.name}</b><small data-hint>${m.hint}</small></span>`
            +   '</button>'
            +   `<span class="pg-mtag" data-tag hidden>${ico('calculator')}Lo que falta</span>`
            +   `<div class="pg-amt"><span>$</span><input id="pgAmt${m.id}" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" data-field="${m.id}" aria-label="Importe en ${m.name}"></div>`
            + '</div>';
    }

    function recvHtml() {
        return '<div class="pg-mrow is-recv" id="pgRecvRow" data-field="received" hidden>'
            +   `<span class="pg-recv-label">${ico('arrow-down-to-line')}Recibe en efectivo <small>· el billete que entrega</small></span>`
            +   '<div class="pg-amt"><span>$</span><input id="pgRecv" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" data-field="received" aria-label="Recibe en efectivo"></div>'
            + '</div>';
    }

    function discHtml() {
        const seg = (mode, label) => `<button type="button" class="pg-seg-btn${pg.discMode === mode ? ' is-active' : ''}" data-act="mode" data-value="${mode}">${label}</button>`;
        const opt = (r) => `<option value="${r.id}">${esc(r.name)} · ${r.auth ? 'la autoriza Dueño o Supervisor' : `hasta ${r.max} %`}</option>`;

        return `<div class="pg-disc" id="pgDisc"${pg.discOpen ? '' : ' hidden'}>`
            +   `<p class="pg-disc-title">${ico('percent')}Descuento al pedido</p>`
            +   `<div class="pg-field"><label for="pgReason">Motivo</label><select id="pgReason"><option value="">Elige el motivo</option>${REASONS.map(opt).join('')}</select></div>`
            +   '<div class="pg-field" id="pgDiscField"><label for="pgDiscValue">Descuento</label><div class="pg-disc-value">'
            +     '<input id="pgDiscValue" type="text" inputmode="decimal" autocomplete="off" placeholder="0" data-field="disc">'
            +     `<div class="pg-seg">${seg('percent', '%')}${seg('amount', '$')}</div>`
            +   '</div></div>'
            +   '<div class="pg-field is-wide"><label for="pgDiscNote">Nota del descuento</label><input id="pgDiscNote" type="text" autocomplete="off" placeholder="Opcional"></div>'
            +   '<p class="pg-disc-msg" id="pgDiscMsg"></p>'
            + '</div>';
    }

    // Teclado de caja: 7-8-9 arriba, como Soft. La tecla alta pasa de campo, no cobra.
    // Con mouse no hay teclado: la columna queda solo para los billetes.
    function sideHtml(off) {
        if (!pg.touch) return off ? '' : `<aside class="pg-side is-mouse" aria-label="Billetes"><div class="pg-bills" id="pgBills">${bills(0)}</div></aside>`;

        const key = (k, label, cls = '', aria = '') => `<button type="button" class="pg-key${cls ? ` ${cls}` : ''}" data-act="key" data-key="${k}"${aria ? ` aria-label="${aria}"` : ''}${off ? ' tabindex="-1"' : ''}>${label}</button>`;

        return `<aside class="pg-side${off ? ' is-off' : ''}" aria-label="Teclado">`
            +   `<div class="pg-pad-disp"><span>${ico('keyboard')}<span id="pgPadLabel">${off ? 'Sin cobro' : 'Teclado'}</span></span><b id="pgPadValue">${off ? '—' : money(0)}</b></div>`
            +   '<div class="pg-pad">'
            +     key('7', '7') + key('8', '8') + key('9', '9') + key('back', ico('delete'), 'is-fn', 'Borrar')
            +     key('4', '4') + key('5', '5') + key('6', '6') + key('clear', 'C', 'is-clear', 'Limpiar')
            +     key('1', '1') + key('2', '2') + key('3', '3') + key('next', `${ico('corner-down-left')}Siguiente`, 'is-next')
            +     key('0', '0') + key('00', '00') + key('.', '.')
            +   '</div>'
            +   `<div class="pg-bills" id="pgBills">${bills(0)}</div>`
            + '</aside>';
    }

    function payHtml() {
        return '<div class="pg-pay" id="pgPayForm">'
            +   '<div class="pg-main">'
            +     displayHtml()
            +     '<div class="pg-grid">'
            +       '<div class="pg-grid-head"><span>Forma de pago</span><span>Importe</span></div>'
            +       METHODS.map(rowHtml).join('')
            +       recvHtml()
            +     '</div>'
            +     discHtml()
            +     '<div class="pg-field"><label for="pgNote">Nota del pago</label><input id="pgNote" type="text" autocomplete="off" placeholder="Opcional · sale en el historial"></div>'
            +   '</div>'
            +   sideHtml(false)
            + '</div>';
    }

    // Sin cobro: el pedido ya se pagó o no hay turno abierto.
    function blockHtml() {
        const o = order();
        const n = pg.payments.length;

        if (!pg.turn) {
            return '<div class="pg-block is-warn">'
                +   `<div class="pg-block-ico">${ico('lock')}</div>`
                +   '<div class="pg-block-text"><b>Abre tu turno para cobrar</b>'
                +     '<p>Sin turno abierto no se registran ni se quitan pagos. Lo ya cobrado se ve en el historial.</p>'
                +     `<button type="button" class="pg-block-go" data-act="open-turn">${ico('clock')}Abrir turno</button>`
                +   '</div>'
                + '</div>';
        }

        return '<div class="pg-block is-ok">'
            +   `<div class="pg-block-ico">${ico('circle-check')}</div>`
            +   '<div class="pg-block-text"><b>Este pedido ya está pagado</b>'
            +     `<p>Se cobraron ${money(o.paid)} en ${n} ${n === 1 ? 'pago' : 'pagos'}. Para quitar uno, ve al historial.</p>`
            +     `<button type="button" class="pg-block-go is-ok" data-act="view" data-value="history">${ico('history')}Ver historial</button>`
            +   '</div>'
            + '</div>';
    }

    function historyHtml() {
        const o = order();

        const rows = pg.payments.map((p, i) => {
            const m      = METHODS.find((x) => x.id === p.method);
            const change = round((p.tendered || p.amount) - p.amount);

            let act = `<span class="pg-lock">${ico('lock')}Turno cerrado</span>`;

            if (!pg.turn)    act = `<span class="pg-lock">${ico('lock')}Sin turno</span>`;
            else if (p.open) act = `<button type="button" class="pg-del" data-act="del" data-idx="${i}">${ico('trash-2')}Quitar</button>`;

            return `<tr${p.fresh ? ' class="is-new"' : ''}>`
                +   `<td>${p.date}<small>${p.time}</small></td>`
                +   `<td><span class="pg-hist-method"><span class="pg-mico tone-${m.tone}">${ico(m.icon)}</span>${m.name}</span>${change > 0.005 ? `<small>Recibió ${money(p.tendered)} · cambio ${money(change)}</small>` : ''}</td>`
                +   `<td>${esc(p.concept)}${p.fresh ? ' <span class="ord-cut-pill is-ok">Nuevo</span>' : ''}</td>`
                +   `<td>${esc(p.who)}</td>`
                +   `<td class="r"><b>${money(p.amount)}</b></td>`
                +   `<td class="c">${act}</td>`
                + '</tr>';
        }).join('') || '<tr><td colspan="6" class="ord-cut-empty">Aún no hay pagos en este pedido.</td></tr>';

        const foot = (label, value) => `<tr><td colspan="4">${label}</td><td class="r">${value}</td><td></td></tr>`;

        return '<div class="pg-hist">'
            +   displayHtml()
            +   '<div class="ord-cut-grid"><table>'
            +     '<thead><tr><th>Fecha</th><th>Forma de pago</th><th>Concepto</th><th>Cobró</th><th class="r">Importe</th><th class="c">Acción</th></tr></thead>'
            +     `<tbody>${rows}</tbody>`
            +     '<tfoot>'
            +       (pg.discApplied > 0 ? foot('Descuento', `−${money(pg.discApplied)}`) : '')
            +       foot('Pagado', money(o.paid))
            +       foot('Por cobrar', money(o.balance))
            +     '</tfoot>'
            +   '</table></div>'
            + '</div>';
    }

    function footHtml(payMode, toPay) {
        // Cobrando, el pie lleva el resultado (cambio, faltan, sobran): siempre a la vista.
        const left = payMode
            ? '<div class="pg-res-state" id="pgResState" aria-live="polite"></div>'
            : `<div class="pg-foot-info">${ico('info')}<span>Quitar un pago pide el motivo y solo se puede con el turno abierto</span></div>`;

        return '<div class="pg-foot">'
            +   left
            +   `<button type="button" class="pg-btn${pg.discOpen ? ' is-on' : ''}" id="pgDiscBtn" data-act="disc"${payMode ? '' : ' hidden'}>${ico('percent')}<span id="pgDiscLabel">${pg.discOpen ? 'Quitar descuento' : 'Descuento'}</span><kbd class="pg-kbd">F4</kbd></button>`
            +   `<button type="button" class="pg-btn" data-act="close">${ico('arrow-left')}Volver<kbd class="pg-kbd">Esc</kbd></button>`
            +   `<button type="button" class="pg-btn is-primary" id="pgSave" data-act="save"${payMode || toPay ? '' : ' hidden'}><span id="pgSaveLabel">Registrar pago</span><kbd class="pg-kbd">F2</kbd></button>`
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

        const rows = [{ folio: ORDER.folio, client: ORDER.client, delivery: ORDER.delivery, total: o.total, balance: o.balance }].concat(OTHERS);

        $('#root').innerHTML = ''
            + `<div class="pg-page-head"><div><h1>Pedidos</h1><p>Kafeto · ${TODAY} · el cobro se abre con «Cobrar»</p></div></div>`
            + '<div class="tp-card"><div class="tp-table-wrap"><table class="tp-table">'
            +   '<thead><tr><th>Folio</th><th>Cliente</th><th>Entrega</th><th>Estado</th><th class="num">Total</th><th class="num">Saldo</th><th></th></tr></thead>'
            +   '<tbody>' + rows.map((r) => '<tr>'
            +     `<td><b>${r.folio}</b></td><td>${esc(r.client)}</td><td>${r.delivery}</td><td>${pill(r.balance, r.total)}</td>`
            +     `<td class="num">${money(r.total)}</td><td class="num"><b>${money(r.balance)}</b></td>`
            +     `<td class="num"><button type="button" class="pg-row-pay" data-act="open" data-folio="${r.folio}">${ico('hand-coins')}Cobrar</button></td>`
            +   '</tr>').join('') + '</tbody>'
            + '</table></div></div>';
    }

    function renderWin() {
        const overlay = $('#pgOverlay');

        overlay.hidden = !pg.open;

        if (!pg.open) {
            overlay.innerHTML = '';
            return;
        }

        const pay = pg.view === 'pay';
        const can = canPay();

        let body = historyHtml();

        if (pay && can) body = payHtml();
        else if (pay)   body = `<div class="pg-pay${pg.touch ? '' : ' is-solo'}"><div class="pg-main">${displayHtml()}${blockHtml()}</div>${sideHtml(true)}</div>`;

        overlay.innerHTML = `<div class="pg-win" data-tone="${pg.tone}" role="dialog" aria-modal="true" aria-labelledby="pgTitle">`
            + headHtml()
            + stripHtml()
            + `<div class="pg-body">${body}</div>`
            + footHtml(pay && can, !pay && can)
            + '</div>';
    }

    // La tira de la maqueta marca lo que está puesto.
    function paintDemo() {
        const now = { case: pg.case, view: pg.view, screen: pg.touch ? 'touch' : 'mouse', tone: pg.tone };

        $$('.tp-demo-seg button').forEach((el) => el.classList.toggle('is-active', now[el.dataset.act] === el.dataset.value));
    }

    function render() {
        renderPage();
        renderWin();

        paintDemo();
        icons();

        if (!pg.open) return;

        if ($('#pgPayForm')) {
            paintCalc();
            focusField(pg.active);
        } else {
            paintStatic();
        }
    }

    function totalNote(o, cut) {
        if (cut > 0)            return `Antes ${money(o.total)} · −${money(cut)}`;
        if (pg.discApplied > 0) return `Con descuento de −${money(pg.discApplied)}`;

        return 'Sin descuento';
    }

    function paintDisplay(v) {
        const base    = v.total > 0 ? v.total : 1;
        const paidPct = Math.min(100, v.paid / base * 100);
        const nowPct  = Math.min(100 - paidPct, (v.now || 0) / base * 100);

        $('#pgDispTotal').textContent     = money(v.total);
        $('#pgDispTotalNote').textContent = v.totalNote;
        $('#pgDispTotalNote').classList.toggle('is-disc', v.disc);
        $('#pgDispPaid').textContent      = money(v.paid);
        $('#pgDispPaidNote').textContent  = v.count ? `${v.count} ${v.count === 1 ? 'pago' : 'pagos'}` : 'Sin pagos';
        $('#pgDispDue').textContent       = money(v.due);
        $('#pgDispDueNote').textContent   = v.dueNote;
        $('#pgDispHero').classList.toggle('is-done', v.due <= 0.005);

        $('#pgBarPaid').style.width = `${paidPct}%`;
        $('#pgBarNow').style.width  = `${nowPct}%`;
        $('#pgBarText').textContent = `${Math.round(paidPct)} % pagado` + (nowPct > 0.5 ? ` · +${Math.round(nowPct)} % con este cobro` : '');
    }

    // Pagado, sin turno o historial: el display sin cobro en curso.
    function paintStatic() {
        const o = order();

        paintDisplay({
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

    /*  Como paintRows() de hoy: las filas no se vuelven a pintar (se perdería
        el foco al teclear); solo cambian su marca, su pista y, la que cubre lo
        que falta, su monto. */
    function paintCalc() {
        if (!$('#pgPayForm')) return;

        const c = calc();
        const o = order();

        c.rows.forEach((r) => {
            const input = fieldInput(r.m.id);
            const row   = input.closest('.pg-mrow');
            const auto  = r.m.id === pg.auto;

            if (auto) input.value = r.amount > 0 ? r.amount.toFixed(2) : '';

            row.classList.toggle('is-on', r.amount > 0);
            row.classList.toggle('is-auto', auto);
            row.querySelector('[data-hint]').textContent = rowHint(r, c);
            row.querySelector('[data-tag]').hidden = !auto;
            input.parentElement.classList.toggle('is-bad', c.bad === r.m);
        });

        // «Recibe» y los billetes acompañan a Efectivo solo cuando lleva monto.
        const recvRow = $('#pgRecvRow');
        const recv    = $('#pgRecv');

        if (c.cashPaid <= 0 && recv.value !== '') recv.value = '';

        recvRow.hidden   = c.cashPaid <= 0;
        recv.placeholder = c.cashPaid > 0 ? `Exacto: ${money(c.cashPaid)}` : '0.00';
        recv.parentElement.classList.toggle('is-bad', c.badRec);

        if (recvRow.hidden && pg.active === 'received') pg.active = String(CASH.id);

        $('#pgBills').innerHTML = bills(c.cashPaid);

        const after = Math.max(0, round(c.balance - c.applied));
        const stuck = c.bad || c.badRec || c.over > 0.005 || c.missing > 0.005;

        let dueNote = 'Saldo del pedido';

        if (!stuck && c.applied > 0) dueNote = after <= 0.005 ? 'Con este cobro queda pagado' : `Después de cobrar: ${money(after)}`;

        paintDisplay({
            total:     c.total,
            totalNote: totalNote(o, c.d.amount),
            disc:      c.d.amount > 0 || pg.discApplied > 0,
            paid:      o.paid,
            count:     pg.payments.length,
            due:       c.balance,
            dueNote:   dueNote,
            now:       stuck ? 0 : c.applied
        });

        paintResult(c);
        paintDiscount(c);
        paintActive();
        paintPad();

        $('#pgSaveLabel').textContent = saveLabel(c);
        $('#pgSave').classList.toggle('is-off', problem(c) !== '');
    }

    // Los estados de summary(), en el mismo orden. El desglose ya se ve en las filas.
    function paintResult(c) {
        const after = Math.max(0, round(c.balance - c.applied));
        const names = c.payments.map((p) => METHODS.find((m) => m.id === p.method_id).name).join(' + ');
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

        const state = $('#pgResState');

        state.className = `pg-res-state${st[0] ? ` ${st[0]}` : ''}`;
        state.innerHTML = `<div class="pg-res-main"><span>${esc(st[1])}</span><b>${st[2]}</b></div><small>${esc(st[3])}</small>`;
    }

    function paintDiscount(c) {
        const d   = c.d;
        const msg = $('#pgDiscMsg');

        msg.className = `pg-disc-msg${d.error ? ' is-bad' : (d.amount ? ' is-ok' : '')}`;
        msg.innerHTML = d.error
            ? esc(d.error)
            : (d.amount ? `Descuento de <b>${money(d.amount)}</b> (${d.percent} % del subtotal). El total queda en ${money(c.total)}.` : 'Elige el motivo y escribe el descuento.');

        $('#pgDiscBtn').classList.toggle('is-on', pg.discOpen);
        $$('button.pg-seg-btn').forEach((el) => el.classList.toggle('is-active', el.dataset.value === pg.discMode));
    }

    // La fila (o el campo) donde escribe el teclado lleva la barra de color.
    function paintActive() {
        $$('.pg-mrow').forEach((row) => row.classList.toggle('is-active', row.dataset.field === pg.active));

        const disc = $('#pgDiscField');

        if (disc) disc.classList.toggle('is-active', pg.active === 'disc');
    }

    function paintPad() {
        if (!$('#pgPadLabel')) return;   // con mouse no hay teclado

        const f     = pg.active;
        const input = fieldInput(f);
        const m     = METHODS.find((x) => String(x.id) === f);

        let label = 'Teclado';

        if (f === 'received')  label = 'Recibe en efectivo';
        else if (f === 'disc') label = pg.discMode === 'percent' ? 'Descuento en %' : 'Descuento en $';
        else if (m)            label = m.id === pg.auto ? `${m.name} · lo que falta` : m.name;

        const raw   = input ? input.value.trim() : '';
        const value = raw === '' ? 0 : amount(raw);

        let text = value === null ? raw : money(value);

        if (value !== null && f === 'disc' && pg.discMode === 'percent') text = `${value} %`;

        $('#pgPadLabel').textContent = label;
        $('#pgPadValue').textContent = text;
    }

    // -- Teclado --

    function focusField(f) {
        const input = fieldInput(f);

        if (!input) return;

        input.focus({ preventScroll: true });
        input.select();
    }

    function visibleFields() {
        const list = METHODS.map((m) => String(m.id));

        if (!$('#pgRecvRow').hidden) list.push('received');
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

    // Tocar el nombre de una forma de pago: esa fila cubre lo que falta.
    function takeRest(id) {
        const old = fieldInput(pg.auto);

        if (old && pg.auto !== id) old.value = '';

        pg.auto = id;
        paintCalc();
        focusField(String(id));
    }

    function toggleDisc() {
        if (!$('#pgPayForm')) return;

        pg.discOpen = !pg.discOpen;

        $('#pgDisc').hidden = !pg.discOpen;
        $('#pgDiscLabel').textContent = pg.discOpen ? 'Quitar descuento' : 'Descuento';

        if (pg.discOpen) {
            $('#pgReason').focus();
        } else {
            $('#pgReason').value    = '';
            $('#pgDiscValue').value = '';

            if (pg.active === 'disc') focusField(String(CASH.id));
        }

        paintCalc();
    }

    // -- Cobrar --

    function save() {
        if (!pg.open) return;

        // En el historial, F2 lleva a registrar.
        if (!$('#pgPayForm')) {
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

        const o     = order();
        const after = Math.max(0, round(c.balance - c.applied));
        const note  = $('#pgNote').value.trim();
        const time  = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

        let concept = o.paid <= 0 ? 'Anticipo' : 'Abono';

        if (after <= 0.005) concept = o.paid <= 0 ? 'Pago completo' : 'Liquidación';
        if (note) concept = note;

        pg.payments.forEach((p) => { p.fresh = false; });

        c.payments.forEach((p) => {
            pg.payments.push({ date: TODAY, time, method: p.method_id, concept, who: USER, amount: p.amount, tendered: p.tendered, open: true, fresh: true });
        });

        if (c.d.amount > 0) pg.discApplied = round(pg.discApplied + c.d.amount);

        const msg = c.applied > 0
            ? `Pago registrado · ${money(c.applied)}${c.change > 0.005 ? ` · Cambio ${money(c.change)}` : ''}`
            : `Descuento aplicado · ${money(c.d.amount)}. El total queda en ${money(c.total)}.`;

        resetForm();
        pg.view = 'history';
        render();
        toast(msg);
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

    function setCase(value) {
        const c = CASES[value] || CASES.abono;

        pg.case        = CASES[value] ? value : 'abono';
        pg.turn        = c.turn;
        pg.payments    = c.payments.map((p) => Object.assign({}, p));
        pg.discApplied = 0;
        pg.open        = true;

        resetForm();
        render();
    }

    const ACTIONS = {
        case(el) {
            setCase(el.dataset.value);
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
            pg.open = false;
            render();
        },

        rest(el) {
            takeRest(Number(el.dataset.id));
        },

        key(el) {
            press(el.dataset.key);
        },

        // El billete llena «Recibe»; la siguiente tecla lo reemplaza.
        bill(el) {
            const input = $('#pgRecv');

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

        del(el) {
            const at = Number(el.dataset.idx);
            const p  = pg.payments[at];

            if (!p) return;

            pg.payments.splice(at, 1);
            render();
            toast(`Pago quitado · ${money(p.amount)}. Hoy primero pide el motivo; eso no cambia.`);
        },

        'open-turn'() {
            pg.turn = true;
            resetForm();
            render();
            toast('Turno 12 abierto (pantalla de hoy, sin cambios). Sigue el cobro.');
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
        },

        tone(el) {
            const win = $('.pg-win');

            pg.tone = el.dataset.value;
            if (win) win.dataset.tone = pg.tone;
            paintDemo();
        }
    };

    // -- Eventos --

    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-act]');

        if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el);
    });

    // El teclado y los billetes no le quitan el foco al campo.
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('button.pg-key, button.pg-bill')) e.preventDefault();
    });

    document.addEventListener('input', (e) => {
        if (!e.target.closest('#pgPayForm')) return;

        if (e.target.dataset.field) typed(e.target);
        else paintCalc();
    });

    document.addEventListener('change', (e) => {
        if (e.target.id === 'pgReason') paintCalc();
    });

    document.addEventListener('focusin', (e) => {
        const f = e.target.dataset ? e.target.dataset.field : '';

        if (!f || !e.target.closest('#pgPayForm')) return;

        pg.active = f;
        pg.fresh  = true;
        paintActive();
        paintPad();
    });

    document.addEventListener('keydown', (e) => {
        if ($('#pgOverlay').hidden) return;

        if (e.key === 'F2') {
            e.preventDefault();
            save();
        } else if (e.key === 'F4') {
            e.preventDefault();
            toggleDisc();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            ACTIONS.close();
        } else if (e.key === 'Enter' && e.target.matches('#pgPayForm input')) {
            e.preventDefault();
            save();
        }
    });

    // -- Arranque --

    // La tira de la maqueta crece al envolverse: la ventana le deja su hueco.
    const fitDemo = () => document.documentElement.style.setProperty('--pg-demo', `${$('.tp-demo').offsetHeight}px`);

    fitDemo();
    window.addEventListener('resize', fitDemo);

    const dark = document.documentElement.classList.contains('dark');

    document.body.classList.toggle('dark-mode', dark);
    $('.navbar-main').classList.toggle('nav-dark', dark);

    setCase('abono');
})();
