/*  Maqueta: Tablero de pedidos por estado (templates/embudo-propuesta.html).

    Las columnas son los estados que ya usan Pedidos y el Calendario
    (sale_status): Cotización, Pendiente, Pagado y Cancelado, con los mismos
    colores (statusPill de ctrl-pedidos y color() del calendario). La entrega
    y el palomeo de Producción NO son estados: van como etiquetas en la
    tarjeta, con las palabras de hoy: «Debe $X», «Sin entregar», «Entregado»
    y «Elaborado».

    Forma de las columnas y tarjetas: el pipeline de Vambe. El botón del paso,
    o arrastrar la tarjeta a la columna que sigue, la mueve.
    Datos de ejemplo: no llama a ningún ctrl. */

(() => {
    'use strict';

    // -- Utilidades --

    const $     = (sel) => document.querySelector(sel);
    const $$    = (sel) => Array.from(document.querySelectorAll(sel));
    const money = (n) => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const ico   = (name) => `<i data-lucide="${name}"></i>`;
    const icons = () => { if (window.lucide) lucide.createIcons(); };
    const esc   = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const calm  = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // -- Estados (sale_status). c = color del calendario; soft, body e ink = sus tonos suaves --

    const STAGES = [
        { key: 'quote',     id: 1, title: 'Cotización', icon: 'file-text',        rule: 'Sin anticipo todavía',                           c: '#2A55A3', soft: '#E3EBF8', body: '#F2F6FC', ink: '#2A55A3', hidden: 10 },
        { key: 'pending',   id: 2, title: 'Pendiente',  icon: 'clock',            rule: 'Dejó anticipo o se guardó sin pago; falta liquidar', c: '#B45309', soft: '#FCEFD6', body: '#FEF8EC', ink: '#B45309', hidden: 31 },
        { key: 'paid',      id: 3, title: 'Pagado',     icon: 'circle-check-big', rule: 'Liquidado; se entrega o ya se entregó',           c: '#047857', soft: '#D9F2E6', body: '#EFFAF4', ink: '#047857', hidden: 9 },
        { key: 'cancelled', id: 4, title: 'Cancelado',  icon: 'circle-x',         rule: 'Lo abonado queda a favor del cliente',            c: '#DC2626', soft: '#FBE3E3', body: '#FDF4F4', ink: '#B91C1C', hidden: 4 }
    ];

    // Lo que se puede arrastrar: solo un paso adelante. A Cancelado se llega desde el detalle.
    const NEXT = { quote: 'pending', pending: 'paid' };

    // -- Pedidos de ejemplo --
    // due: 'today' | 'late' | '' · home: a domicilio · made: Producción lo palomeó · delivered: entregado

    const cards = {
        quote: [
            { folio: 'P1702', who: 'Sofía Torres',    what: 'Pastel 3 leches',            when: '22/11 4:00 PM',   total: 850,  paid: 0 },
            { folio: 'P1708', who: 'Lucía Fernández', what: 'Cupcakes ×36',               when: '27/11 10:00 AM',  total: 720,  paid: 0 },
            { folio: 'P1705', who: 'Ricardo Peña',    what: 'Mesa de postres',            when: '29/11 1:00 PM',   total: 3400, paid: 0, home: true },
            { folio: 'P1712', who: 'Andrés Molina',   what: 'Pastel de cumpleaños',       when: '30/11 2:00 PM',   total: 980,  paid: 0 },
            { folio: 'P1709', who: 'Gabriela Soto',   what: 'Pastel de bodas · 3 pisos',  when: '06/12 5:00 PM',   total: 5800, paid: 0, home: true }
        ],
        pending: [
            { folio: 'P1650', who: 'Mariana López',   what: 'Pastel de zanahoria',        when: 'Era el 14/11',    due: 'late',  total: 1100, paid: 600, made: true },
            { folio: 'P1691', who: 'Daniel Ortiz',    what: 'Pastel de chocolate · 20 personas', when: 'Hoy 4:00 PM', due: 'today', total: 950, paid: 500, home: true },
            { folio: 'P1689', who: 'Jorge Ruiz',      what: 'Pastel de fresas',           when: 'Hoy 6:00 PM',     due: 'today', total: 900,  paid: 550, made: true },
            { folio: 'P1697', who: 'Patricia León',   what: 'Pastel de zarzamora',        when: 'Hoy 7:30 PM',     due: 'today', total: 1350, paid: 700 },
            { folio: 'P1714', who: 'Laura Méndez',    what: 'Cupcakes ×24',               when: 'Mañana 11:00 AM', total: 480,  paid: 0 },
            { folio: 'P1698', who: 'Valeria Cruz',    what: 'Pastel personalizado',       when: '21/11 1:00 PM',   total: 1200, paid: 500, home: true },
            { folio: 'P1716', who: 'Tomás Rivera',    what: 'Cheesecake',                 when: '23/11 12:00 PM',  total: 650,  paid: 300 }
        ],
        paid: [
            { folio: 'P1690', who: 'Beatriz Campos',  what: 'Gelatina mosaico',           when: 'Hoy 5:30 PM',     due: 'today', total: 260, paid: 260, made: true },
            { folio: 'P1687', who: 'Paola Ibarra',    what: 'Rosca de reyes',             when: 'Hoy 7:00 PM',     due: 'today', total: 380, paid: 380, made: true, home: true },
            { folio: 'P1694', who: 'Elena Ramos',     what: 'Pay de queso',               when: 'Mañana 10:00 AM', total: 420, paid: 420 },
            { folio: 'P1718', who: 'Carmen Vega',     what: 'Brownies ×30',               when: '22/11 9:00 AM',   total: 540, paid: 540 },
            { folio: 'P1686', who: 'Hugo Salas',      what: 'Pastel de vainilla',         when: 'Hoy 11:20 AM',    total: 780, paid: 780, made: true, delivered: true },
            { folio: 'P1685', who: 'Natalia Ríos',    what: 'Donas ×24',                  when: 'Hoy 10:40 AM',    total: 420, paid: 420, made: true, delivered: true, home: true }
        ],
        cancelled: [
            { folio: 'P1641', who: 'Iván Castro',     what: 'Pastel de chocolate',        when: '10/11 2:00 PM',   total: 700, paid: 300, reason: 'Cambió de fecha' },
            { folio: 'P1662', who: 'Rosa Díaz',       what: 'Cupcakes ×12',               when: '16/11 11:00 AM',  total: 240, paid: 0,   reason: 'No confirmó' }
        ]
    };

    const today = { done: 4, of: 9 };

    const state = { first: true, arriving: '', bump: '', drag: null };

    // -- El siguiente paso de cada tarjeta (las palabras de hoy) --

    function step(stage, c) {
        const due  = c.total - c.paid > 0.005;
        const soon = c.due === 'today' || c.due === 'late';

        if (stage === 'quote')   return { label: 'Cobrar anticipo', move: true };
        if (stage === 'pending') return c.paid > 0
            ? { label: soon ? 'Cobrar y entregar' : 'Cobrar saldo', move: true }
            : { label: 'Cobrar anticipo', move: false };
        if (stage === 'paid')    return c.delivered ? null : { label: 'Entregar', move: false };

        return null;
    }

    // -- Pintar --

    function render() {
        $('#efView').innerHTML = `
            <section class="ord-card ef-card${state.first && !calm() ? ' is-first' : ''}">
                <div class="ef-top">
                    <button type="button" class="ef-icon-btn" data-act="filter" title="Filtros">${ico('list-filter')}</button>
                    <span class="tp-fake ef-search">Buscar pedido, cliente o teléfono ${ico('search')}</span>
                    <span class="tp-fake ef-filter">${ico('calendar')}Entrega: esta semana ${ico('chevron-down')}</span>
                    <p class="ef-hint">${ico('grip-vertical')}Arrastra la tarjeta a la siguiente columna o usa su botón.</p>
                </div>
                <div class="ef-board" id="efBoard">${STAGES.map(columnHtml).join('')}</div>
            </section>`;

        $('#efToday').innerHTML = todayHtml();

        state.first    = false;
        state.arriving = '';
        state.bump     = '';

        icons();
    }

    function columnHtml(s) {
        const list = cards[s.key];

        return `
            <div class="ef-col${s.key === 'cancelled' ? ' is-off' : ''}" data-col="${s.key}" style="--c:${s.c};--soft:${s.soft};--body:${s.body};--ink-s:${s.ink}">
                <header class="ef-head">
                    <span class="ef-head-icon">${ico(s.icon)}</span>
                    <div class="ef-head-text">
                        <p class="ef-head-name">${s.title}</p>
                        <p class="ef-head-count"><span>Pedidos (<b class="${state.bump === s.key ? 'is-bump' : ''}">${list.length + s.hidden}</b>)</span><span class="ef-info" title="${esc(s.rule)}">${ico('info')}</span></p>
                    </div>
                    <button type="button" class="ef-head-btn" data-act="col" data-value="${s.title}" title="Opciones de la columna">${ico('ellipsis')}</button>
                </header>
                <div class="ef-col-body">
                    <div class="ef-drop">${ico('arrow-down-to-line')}Suelta aquí</div>
                    ${list.map((c, n) => cardHtml(s, c, n)).join('')}
                    <button type="button" class="ef-more" data-act="more" data-value="${s.title}">Ver ${s.hidden} más</button>
                </div>
            </div>`;
    }

    function cardHtml(s, c, n) {
        const next = step(s.key, c);
        const due  = Math.max(c.total - c.paid, 0);
        const dot  = c.due === 'late' ? '<span class="ef-dot is-late" title="Atrasado"></span>' : c.due === 'today' ? '<span class="ef-dot is-today" title="Se entrega hoy"></span>' : '';

        // Las etiquetas de hoy: dinero, entrega y la marca de Producción.
        const tags = [];

        if (s.key === 'quote')     tags.push(`<span class="ef-tag">${money(c.total)}</span>`);
        if (s.key === 'pending')   tags.push(c.paid > 0 ? `<span class="ef-tag is-debt">Debe ${money(due)}</span>` : '<span class="ef-tag is-debt">Sin anticipo</span>');
        if (s.key === 'paid')      tags.push(c.delivered ? '<span class="ef-tag is-done">Entregado</span>' : '<span class="ef-tag is-out">Sin entregar</span>');
        if (s.key === 'cancelled') tags.push(`<span class="ef-tag">${esc(c.reason)}</span>`, c.paid > 0 ? `<span class="ef-tag">A favor ${money(c.paid)}</span>` : '');
        if (c.made && !c.delivered) tags.push(`<span class="ef-tag is-made">${ico('check')}Elaborado</span>`);

        const go = next
            ? `<button type="button" class="ef-go" data-act="go" data-stage="${s.key}" data-folio="${c.folio}">${next.label}${ico('chevron-right')}</button>`
            : '';

        return `
            <article class="ef-tile${state.arriving === c.folio ? ' is-arriving' : ''}" style="--i:${n}" data-folio="${c.folio}" data-stage="${s.key}"${next && next.move ? ' draggable="true"' : ''} tabindex="0">
                ${next && next.move ? `<span class="ef-grip" aria-hidden="true">${ico('grip-vertical')}</span>` : ''}
                <p class="ef-name"><span class="ef-kind" title="${c.home ? 'Envío a domicilio' : 'Recoge en tienda'}">${ico(c.home ? 'truck' : 'store')}</span><span class="ef-who">${esc(c.who)}</span>${dot}</p>
                <p class="ef-text"><span class="ef-folio">#${c.folio}</span> ${esc(c.what)}</p>
                <div class="ef-tags">${tags.join('')}</div>
                <div class="ef-meta">
                    <span class="ef-when${c.due ? ` is-${c.due}` : ''}">${c.when}</span>
                    ${go}
                </div>
            </article>`;
    }

    // El recuadro flotante de abajo, como el «Prueba tu embudo» de Vambe.
    function todayHtml() {
        const pct = Math.round(today.done / today.of * 100);

        return `
            <span class="ef-today-icon">${ico('truck')}</span>
            <div class="ef-today-body">
                <p>Entregas de hoy</p>
                <div class="ef-today-row"><b>${today.done} de ${today.of}</b><span class="ef-today-bar"><span style="width:${pct}%"></span></span></div>
            </div>`;
    }

    // -- Mover --

    function find(stage, folio) {
        const list = cards[stage];
        const at   = list.findIndex((c) => c.folio === folio);

        return at < 0 ? null : { list, at, card: list[at] };
    }

    // dragged = vino de arrastrar: a Pagado solo liquida; entregar sigue siendo su botón.
    function advance(stage, folio, dragged = false) {
        const hit = find(stage, folio);
        if (!hit) return;

        const c    = hit.card;
        const next = step(stage, c);
        if (!next) return;

        // Sin mover de columna: el anticipo de un Pendiente en $0, o entregar un Pagado.
        if (!next.move) {
            if (stage === 'pending') { c.paid = Math.round(c.total / 2); toast(`${c.folio}: anticipo cobrado. Sigue en Pendiente.`); }
            if (stage === 'paid')    { c.delivered = true; c.when = 'Ahora'; c.due = ''; today.done = Math.min(today.of, today.done + 1); toast(`${c.folio}: entregado.`); }

            state.arriving = c.folio;
            return render();
        }

        const to = NEXT[stage];

        leave(folio, () => {
            hit.list.splice(hit.at, 1);

            // Cobrar anticipo: Pendiente con la mitad. Cobrar saldo: Pagado. Cobrar y entregar: Pagado y entregado.
            if (stage === 'quote')   c.paid = Math.round(c.total / 2);
            if (stage === 'pending') {
                c.paid = c.total;

                if (next.label === 'Cobrar y entregar' && !dragged) {
                    c.delivered = true;
                    c.when      = 'Ahora';
                    c.due       = '';
                    today.done  = Math.min(today.of, today.done + 1);
                }
            }

            cards[to].unshift(c);

            state.arriving = c.folio;
            state.bump     = to;

            toast(`${c.folio} pasó a «${STAGES.find((s) => s.key === to).title}»${c.delivered && stage === 'pending' ? ' y quedó entregado' : ''}.`);
            render();
        });
    }

    function leave(folio, done) {
        const el = $(`.ef-tile[data-folio="${folio}"]`);

        if (!el || calm()) return done();

        el.classList.add('is-leaving');
        setTimeout(done, 220);
    }

    // -- Arrastrar: solo a la columna que sigue --

    document.addEventListener('dragstart', (e) => {
        const tile = e.target.closest && e.target.closest('.ef-tile[draggable="true"]');
        if (!tile) return;

        state.drag = { folio: tile.dataset.folio, from: tile.dataset.stage };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tile.dataset.folio);

        tile.classList.add('is-dragging');
        $('#efBoard').classList.add('is-dragging');
        $$('.ef-col').forEach((col) => col.classList.toggle('is-target', col.dataset.col === NEXT[state.drag.from]));
    });

    // Todas las columnas aceptan soltar: así una equivocada explica a dónde va.
    document.addEventListener('dragover', (e) => {
        const col = e.target.closest && e.target.closest('.ef-col');
        if (!col || !state.drag) return;

        e.preventDefault();
        $$('.ef-col.is-over').forEach((c) => c !== col && c.classList.remove('is-over'));
        col.classList.toggle('is-over', col.classList.contains('is-target'));
    });

    document.addEventListener('drop', (e) => {
        if (!state.drag) return;

        e.preventDefault();

        const col  = e.target.closest && e.target.closest('.ef-col');
        const drag = state.drag;

        cleanDrag();

        if (col && col.dataset.col === NEXT[drag.from]) return advance(drag.from, drag.folio, true);
        if (col && col.dataset.col === drag.from) return;
        if (col && col.dataset.col === 'cancelled') return toast('Para cancelar abre el pedido: pide el motivo y tu contraseña.');

        toast(`Solo avanza un paso: a «${STAGES.find((s) => s.key === NEXT[drag.from]).title}».`);
    });

    document.addEventListener('dragend', cleanDrag);

    function cleanDrag() {
        state.drag = null;

        const board = $('#efBoard');
        if (board) board.classList.remove('is-dragging');

        $$('.ef-col').forEach((col) => col.classList.remove('is-target', 'is-over'));
        $$('.ef-tile.is-dragging').forEach((t) => t.classList.remove('is-dragging'));
    }

    // -- Avisos --

    let toastTimer = null;

    function toast(text) {
        const box = $('#tpToast');

        box.innerHTML = `${ico('circle-check')}<span>${esc(text)}</span>`;
        box.hidden = false;
        icons();

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { box.hidden = true; }, 2600);
    }

    // -- Clics --

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');

        if (btn) {
            const act = btn.dataset.act;

            if (act === 'go')     return advance(btn.dataset.stage, btn.dataset.folio);
            if (act === 'note')   { $('#tpNote').hidden = !$('#tpNote').hidden; return; }
            if (act === 'more')   return toast(`Mostraría el resto de «${btn.dataset.value}».`);
            if (act === 'col')    return toast(`Opciones de «${btn.dataset.value}»: ordenar por hora de entrega o por cliente.`);
            if (act === 'filter') return toast('Filtros: tipo de entrega, sucursal y quién lo capturó.');
            if (act === 'tab' && btn.dataset.value !== 'board') return toast(btn.dataset.value === 'list' ? 'La lista de Pedidos se queda como está.' : 'El calendario se queda como está.');

            return;
        }

        const tile = e.target.closest('.ef-tile');
        if (tile) toast(`Abriría el detalle del pedido ${tile.dataset.folio}.`);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('ef-tile')) e.target.click();
    });

    render();
})();
