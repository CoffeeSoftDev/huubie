/*  Pedidos › Tablero: los pedidos que se entregan en el periodo, en una
    columna por estado (sale_status): Cotización, Pendiente, Pagado y
    Cancelado, con los colores de la lista y del calendario. La entrega y el
    palomeo de Producción no son estados: van como etiquetas en la tarjeta
    («Debe $X», «Sin entregar», «Entregado», «Elaborado»).

    Cada tarjeta trae su siguiente paso (step, lo decide ctrl-pedidos › lsBoard
    con los permisos y bloqueos de la lista) y abre las ventanas de siempre:
      pay      «Cobrar anticipo» / «Cobrar saldo»  → orderPay.open(id)
      settle   «Cobrar y entregar»                 → orderPay.open(id, false, { deliver: true })
      deliver  «Entregar»                          → orderDetail.deliver(id)
    Arrastrar la tarjeta a la columna que sigue (Cotización → Pendiente →
    Pagado) abre el cobro. La tarjeta solo cambia de columna cuando el cobro
    o la entrega se guardan: esas ventanas llaman orders.lsOrders() y el
    tablero se vuelve a pedir. A Cancelado se llega desde el detalle.

    Vive en pedidos.php como la vista «Tablero» (pedidos.js › showBoard). */

// -- OrderBoard --

class OrderBoard extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Board';
        this.rangeKey     = 'pro:pedidos:tablero:range:v1';
        this.ranges       = { today: 'Hoy', tomorrow: 'Mañana', week: 'Esta semana', nextWeek: 'Próxima semana', month: 'Este mes' };
        this.cards        = [];
        this.today        = null;
        this.term         = '';
        this.open         = {};      // columnas con «Ver más» abierto
        this.focus        = 0;       // el pedido que se acaba de mover desde el tablero
        this.before       = {};      // id → estado antes de volver a pedir, para animar el que cambió
        this.drag         = null;
        this.request      = 0;
        this.all          = false;
        this.limit        = 20;      // tarjetas por columna antes de «Ver más»

        // c = color de la lista y el calendario; soft, body e ink = sus tonos suaves.
        this.stages = [
            { id: 1, icon: 'file-text',        rule: 'Sin anticipo todavía.',                                     c: '#2A55A3', soft: '#E3EBF8', body: '#F2F6FC', ink: '#2A55A3' },
            { id: 2, icon: 'clock',            rule: 'Dejó anticipo o se guardó sin pago; falta liquidar.',       c: '#B45309', soft: '#FCEFD6', body: '#FEF8EC', ink: '#B45309' },
            { id: 3, icon: 'circle-check-big', rule: 'Liquidado: se entrega o ya se entregó.',                    c: '#047857', soft: '#D9F2E6', body: '#EFFAF4', ink: '#047857' },
            { id: 4, icon: 'circle-x',         rule: 'Cancelado desde el detalle. Lo abonado queda a favor del cliente.', c: '#DC2626', soft: '#FBE3E3', body: '#FDF4F4', ink: '#B91C1C' }
        ];

        this.next = { 1: 2, 2: 3 };
    }

    get range() {
        return getDataRangePicker('brd_calendar');
    }

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        this.lsBoard();
    }

    // -- Interface --

    layout() {
        this.createLayout({
            parent: this._div_modulo,
            design: false,
            data: {
                id:    `page${this.PROJECT_NAME}`,
                class: 'flex flex-1 flex-col',
                container: [
                    { type: 'div', id: `body${this.PROJECT_NAME}`, class: 'w-full flex flex-1 flex-col' },
                    { type: 'div', id: `today${this.PROJECT_NAME}`, class: 'ord-board-today hidden' }
                ]
            }
        });

        this.primaryLayout({
            parent: `body${this.PROJECT_NAME}`,
            id:     this.PROJECT_NAME,
            class:  'ord-card flex flex-1 flex-col',
            card: {
                name:      `card${this.PROJECT_NAME}`,
                class:     'flex flex-1 flex-col',
                filterBar: { class: 'w-full mb-[12px]' },
                container: { class: 'w-full flex flex-1 flex-col' }
            }
        });

        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `wrap${this.PROJECT_NAME}`,
                class: 'w-full flex flex-1 flex-col',
                container: [
                    { type: 'div', id: `board${this.PROJECT_NAME}`, class: 'ord-board' }
                ]
            }
        });
    }

    // Entrega (periodo) y buscador a la izquierda; cómo se usa, a la derecha.
    filterBar() {
        const saved = this.savedRange();

        this.createLayout({
            parent: `filterBar${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `bar${this.PROJECT_NAME}`,
                class: 'ord-board-bar',
                container: [
                    { type: 'div', id: `filters${this.PROJECT_NAME}`, class: 'ord-board-filters' },
                    { type: 'p', class: 'ord-board-hint', html: '<i data-lucide="grip-vertical"></i>Arrastra la tarjeta a la siguiente columna o usa su botón.' }
                ]
            }
        });

        this.createfilterBar({
            parent:     `filters${this.PROJECT_NAME}`,
            id:         `fb${this.PROJECT_NAME}`,
            prefijo:    'brd_',
            coffeesoft: true,
            data: [
                { opc: 'input-calendar', id: 'calendar', lbl: 'Entrega', required: false, readonly: true, class: 'col-12 col-sm-6' },
                { opc: 'input', id: 'q', lbl: 'Buscar', type: 'search', placeholder: 'Folio, cliente o teléfono', required: false, class: 'col-12 col-sm-6' }
            ]
        });

        dataPicker({
            parent: 'brd_calendar',
            type:   'all',
            rangepicker: {
                startDate:     saved[0],
                endDate:       saved[1],
                showDropdowns: true,
                autoApply:     true,
                locale: {
                    format:           'DD/MM/YYYY',
                    separator:        ' - ',
                    firstDay:         1,
                    customRangeLabel: 'Personalizado',
                    daysOfWeek:       ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
                    monthNames:       ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                },
                ranges: Object.fromEntries(Object.entries(this.ranges).map(([key, label]) => [label, this.rangeDates(key)]))
            },
            onSelect: () => this.onRangeChange()
        });

        $('#brd_q')
            .attr({ maxlength: 60, autocomplete: 'off' })
            .on('input', () => {
                this.term = this.normalize($('#brd_q').val());
                this.paint();
            });

        if (window.lucide) lucide.createIcons({ root: document.getElementById(`bar${this.PROJECT_NAME}`) });

        this.bindBoard();
    }

    // -- CRUD --

    async lsBoard() {
        const request = ++this.request;
        const range   = this.range;

        $(`#board${this.PROJECT_NAME}`).addClass('is-loading');

        const data = await useFetch({ url: this._link, data: { opc: 'lsBoard', fi: range.fi, ff: range.ff, all: this.all ? 1 : 0 } });

        if (request !== this.request) return;

        $(`#board${this.PROJECT_NAME}`).removeClass('is-loading');

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se pudo cargar el tablero', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        this.before = Object.fromEntries(this.cards.map((c) => [c.id, c.status + (c.delivered ? 'e' : '')]));
        this.cards  = data.cards || [];
        this.today  = data.today || null;

        this.paint();
    }

    // Las ventanas de cobro, entrega y edición llaman orders.lsOrders() al guardar.
    lsOrders() {
        this.lsBoard();
    }

    // -- Tablero --

    paint() {
        const visible = this.term ? this.cards.filter((c) => this.matches(c)) : this.cards;

        $(`#board${this.PROJECT_NAME}`).html(this.stages.map((s) => this.columnHtml(s, visible.filter((c) => c.status === s.id))).join(''));

        this.paintToday();

        if (window.lucide) lucide.createIcons({ root: document.getElementById(`board${this.PROJECT_NAME}`) });

        this.focus = 0;
    }

    columnHtml(s, list) {
        // En Pagado lo que falta entregar va primero.
        if (s.id === 3) list = list.slice().sort((a, b) => a.delivered - b.delivered);

        const shown = this.open[s.id] ? list : list.slice(0, this.limit);
        const more  = list.length - shown.length;
        const moved = this.focus && list.some((c) => c.id === this.focus && this.changed(c));

        const foot = more > 0
            ? `<button type="button" class="ord-board-more" data-more="${s.id}">Ver ${more} más</button>`
            : this.open[s.id] && list.length > this.limit ? `<button type="button" class="ord-board-more" data-more="${s.id}">Ver menos</button>` : '';

        const empty = list.length ? '' : `<p class="ord-board-empty">${this.term ? 'Nada coincide con la búsqueda.' : 'Sin pedidos en este periodo.'}</p>`;

        return `
            <div class="ord-board-col${s.id === 4 ? ' is-off' : ''}" data-col="${s.id}" style="--c:${s.c};--soft:${s.soft};--body:${s.body};--ink-s:${s.ink}">
                <header class="ord-board-head">
                    <span class="ord-board-head-icon"><i data-lucide="${s.icon}"></i></span>
                    <div class="ord-board-head-text">
                        <p class="ord-board-head-name">${esc(this.statusName(s.id))}</p>
                        <p class="ord-board-head-count"><span>Pedidos (<b class="${moved ? 'is-bump' : ''}">${list.length}</b>)</span><span class="ord-board-info" title="${esc(s.rule)}"><i data-lucide="info"></i></span></p>
                    </div>
                </header>
                <div class="ord-board-body">
                    <div class="ord-board-drop"><i data-lucide="arrow-down-to-line"></i>Suelta aquí</div>
                    ${shown.map((c) => this.cardHtml(c)).join('')}
                    ${empty}${foot}
                </div>
            </div>`;
    }

    cardHtml(c) {
        const step  = this.stepOf(c);
        const due   = this.dueOf(c);
        const drag  = step && this.next[c.status] && step.key !== 'deliver';
        const dot   = due === 'late' ? '<span class="ord-board-dot is-late" title="Atrasado"></span>' : due === 'today' ? '<span class="ord-board-dot is-today" title="Se entrega hoy"></span>' : '';
        const fresh = this.focus === c.id && this.changed(c);

        const go = step
            ? `<button type="button" class="ord-board-go" data-step="${step.key}" data-id="${c.id}">${step.label}<i data-lucide="chevron-right"></i></button>`
            : '';

        return `
            <article class="ord-board-card${fresh ? ' is-arriving' : ''}" data-id="${c.id}" data-status="${c.status}"${drag ? ' draggable="true"' : ''} tabindex="0" aria-label="${esc(`Pedido ${c.folio} de ${c.customer}`)}">
                ${drag ? '<span class="ord-board-grip" aria-hidden="true"><i data-lucide="grip-vertical"></i></span>' : ''}
                <p class="ord-board-name">
                    <span class="ord-board-kind" title="${c.home ? 'Envío a domicilio' : 'Recoge en tienda'}"><i data-lucide="${c.home ? 'truck' : 'store'}"></i></span>
                    <span class="ord-board-who">${esc(c.customer)}</span>${dot}
                </p>
                <p class="ord-board-text"><span class="ord-board-folio">#${esc(c.folio)}</span> ${esc(c.what)}</p>
                <div class="ord-board-tags">${this.tagsHtml(c)}</div>
                <div class="ord-board-meta">
                    <span class="ord-board-when${due ? ` is-${due}` : ''}">${this.whenText(c, due)}</span>
                    ${go}
                </div>
            </article>`;
    }

    // Las etiquetas de hoy: dinero, entrega, la marca de Producción y, con «Todas», la sucursal.
    tagsHtml(c) {
        const tags = [];

        if (c.status === 1) tags.push(`<span class="ord-board-tag">${money(c.total)}</span>`);
        if (c.status === 2) tags.push(c.paid > 0.005 ? `<span class="ord-board-tag is-debt">Debe ${money(c.balance)}</span>` : '<span class="ord-board-tag is-debt">Sin anticipo</span>');
        if (c.status === 3) tags.push(c.delivered ? '<span class="ord-board-tag is-done">Entregado</span>' : '<span class="ord-board-tag is-out">Sin entregar</span>');

        if (c.status === 4) {
            if (c.reason) tags.push(`<span class="ord-board-tag">${esc(c.reason)}</span>`);
            if (c.paid > 0.005) tags.push(`<span class="ord-board-tag">A favor ${money(c.paid)}</span>`);
        }

        if (c.produced && !c.delivered && c.status !== 4) tags.push('<span class="ord-board-tag is-made"><i data-lucide="check"></i>Elaborado</span>');
        if (this.all && c.branch) tags.push(`<span class="ord-board-tag"><i data-lucide="house"></i>${esc(c.branch)}</span>`);

        return tags.join('');
    }

    // «Hoy 4:00 PM», «Mañana 10:00 AM», «Era el 14/11» o «22/11 4:00 PM».
    whenText(c, due) {
        if (!c.date) return 'Sin fecha';

        const hour = c.hour ? ' ' + ordHour(c.hour) : '';
        const day  = ordDate(c.date).slice(0, 5);

        if (due === 'late') return `Era el ${day}`;
        if (c.date === this.todayDate()) return `Hoy${hour}`;
        if (c.date === moment(this.todayDate()).add(1, 'day').format('YYYY-MM-DD')) return `Mañana${hour}`;

        return day + hour;
    }

    // Atrasado u hoy: solo lo que ya está confirmado y falta entregar.
    dueOf(c) {
        if (c.delivered || ![2, 3].includes(c.status) || !c.date) return '';

        const today = this.todayDate();

        return c.date < today ? 'late' : c.date === today ? 'today' : '';
    }

    stepOf(c) {
        if (c.step === 'pay')     return { key: 'pay', label: c.paid > 0.005 ? 'Cobrar saldo' : 'Cobrar anticipo' };
        if (c.step === 'settle')  return { key: 'settle', label: 'Cobrar y entregar' };
        if (c.step === 'deliver') return { key: 'deliver', label: 'Entregar' };

        return null;
    }

    // Las entregas de hoy: recuadro abajo a la derecha (como el «Prueba tu embudo» de Vambe).
    paintToday() {
        const box = $(`#today${this.PROJECT_NAME}`);
        const t   = this.today;

        if (!t || !t.total) {
            box.addClass('hidden').empty();
            return;
        }

        const pct = Math.round(t.done / t.total * 100);

        box.removeClass('hidden').html(`
            <span class="ord-board-today-icon"><i data-lucide="truck"></i></span>
            <div>
                <p>Entregas de hoy</p>
                <div class="ord-board-today-row"><b>${t.done} de ${t.total}</b><span class="ord-board-today-bar"><span style="width:${pct}%"></span></span></div>
            </div>`);

        if (window.lucide) lucide.createIcons({ root: box[0] });
    }

    // -- Acciones --

    bindBoard() {
        const board = $(`#board${this.PROJECT_NAME}`);

        board
            .off('.ordBoard')
            .on('click.ordBoard', 'button.ord-board-go', (e) => {
                e.stopPropagation();
                this.act(Number(e.currentTarget.dataset.id), e.currentTarget.dataset.step);
            })
            .on('click.ordBoard', 'button.ord-board-more', (e) => {
                const id = Number(e.currentTarget.dataset.more);

                this.open[id] = !this.open[id];
                this.paint();
            })
            .on('click.ordBoard', 'article.ord-board-card', (e) => orderDetail.show(Number(e.currentTarget.dataset.id)))
            .on('keydown.ordBoard', 'article.ord-board-card', (e) => {
                if (e.key === 'Enter' && e.target === e.currentTarget) orderDetail.show(Number(e.currentTarget.dataset.id));
            })
            .on('dragstart.ordBoard', 'article.ord-board-card[draggable="true"]', (e) => this.onDragStart(e))
            .on('dragover.ordBoard', '.ord-board-col', (e) => this.onDragOver(e))
            .on('drop.ordBoard', '.ord-board-col', (e) => this.onDrop(e))
            .on('dragend.ordBoard', () => this.cleanDrag());
    }

    // Abre la ventana de siempre. La tarjeta se mueve cuando esa ventana guarda.
    act(id, step) {
        this.focus = id;

        if (step === 'pay')     return orderPay.open(id);
        if (step === 'settle')  return orderPay.open(id, false, { deliver: true });
        if (step === 'deliver') return orderDetail.deliver(id);
    }

    // -- Arrastrar: solo a la columna que sigue --

    onDragStart(e) {
        const card = e.currentTarget;

        this.drag = { id: Number(card.dataset.id), from: Number(card.dataset.status) };

        e.originalEvent.dataTransfer.effectAllowed = 'move';
        e.originalEvent.dataTransfer.setData('text/plain', String(this.drag.id));

        $(card).addClass('is-dragging');
        $(`#board${this.PROJECT_NAME}`).addClass('is-dragging');
        $(`#board${this.PROJECT_NAME} .ord-board-col`).each((i, col) => $(col).toggleClass('is-target', Number(col.dataset.col) === this.next[this.drag.from]));
    }

    // Todas las columnas aceptan soltar: así una equivocada explica a dónde va.
    onDragOver(e) {
        if (!this.drag) return;

        e.preventDefault();

        const col = $(e.currentTarget);

        $(`#board${this.PROJECT_NAME} .ord-board-col.is-over`).not(col).removeClass('is-over');
        col.toggleClass('is-over', col.hasClass('is-target'));
    }

    // Arrastrar a la columna que sigue cobra (sin entregar): entregar es su propio botón.
    onDrop(e) {
        if (!this.drag) return;

        e.preventDefault();

        const to   = Number(e.currentTarget.dataset.col);
        const drag = this.drag;

        this.cleanDrag();

        if (to === this.next[drag.from]) return this.act(drag.id, 'pay');
        if (to === drag.from) return;
        if (to === 4) return this.notice('Para cancelar abre el pedido: pide el motivo y tu contraseña.');

        this.notice(`Solo avanza un paso: a «${this.statusName(this.next[drag.from])}».`);
    }

    cleanDrag() {
        this.drag = null;

        $(`#board${this.PROJECT_NAME}`).removeClass('is-dragging');
        $(`#board${this.PROJECT_NAME} .ord-board-col`).removeClass('is-target is-over');
        $(`#board${this.PROJECT_NAME} .ord-board-card.is-dragging`).removeClass('is-dragging');
    }

    // -- Complements --

    // Aviso corto abajo, sin botones (toast de SweetAlert).
    notice(text) {
        Swal.fire({ toast: true, position: 'bottom', icon: 'info', title: text, showConfirmButton: false, timer: 2600, timerProgressBar: false });
    }

    changed(c) {
        return this.before[c.id] !== undefined && this.before[c.id] !== c.status + (c.delivered ? 'e' : '');
    }

    matches(c) {
        return [c.folio, c.customer, c.phone, c.what].some((v) => this.normalize(v).includes(this.term));
    }

    normalize(value) {
        return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
    }

    statusName(id) {
        const row = (dataInit.statuses || []).find((s) => Number(s.id) === Number(id));

        return row ? row.valor : ({ 1: 'Cotización', 2: 'Pendiente', 3: 'Pagado', 4: 'Cancelado' }[id] || 'Sin estado');
    }

    todayDate() {
        return (this.today && this.today.date) || dataInit.today || moment().format('YYYY-MM-DD');
    }

    onRangeChange() {
        this.saveRange();
        this.open = {};
        this.lsBoard();
    }

    rangeDates(key) {
        const server = moment(dataInit.today, 'YYYY-MM-DD', true);
        const today  = server.isValid() ? server : moment();

        switch (key) {
            case 'today':    return [today.clone(), today.clone()];
            case 'tomorrow': return [today.clone().add(1, 'days'), today.clone().add(1, 'days')];
            case 'nextWeek': return [today.clone().add(1, 'weeks').startOf('isoWeek'), today.clone().add(1, 'weeks').endOf('isoWeek')];
            case 'month':    return [today.clone().startOf('month'), today.clone().endOf('month')];
            default:         return [today.clone().startOf('isoWeek'), today.clone().endOf('isoWeek')];
        }
    }

    // El periodo que se usó la última vez; uno con nombre («Esta semana») se recalcula.
    savedRange() {
        try {
            const raw = JSON.parse(localStorage.getItem(this.rangeKey) || '{}') || {};
            const fi  = moment(raw.fi, 'YYYY-MM-DD', true);
            const ff  = moment(raw.ff, 'YYYY-MM-DD', true);

            if (Object.keys(this.ranges).includes(raw.range)) return this.rangeDates(raw.range);
            if (raw.range === 'custom' && fi.isValid() && ff.isValid() && !ff.isBefore(fi)) return [fi, ff];
        } catch (e) {
            // Sin almacenamiento: esta semana.
        }

        return this.rangeDates('week');
    }

    saveRange() {
        const { fi, ff } = this.range;
        const named      = Object.keys(this.ranges).find((key) => {
            const [a, b] = this.rangeDates(key);

            return a.format('YYYY-MM-DD') === fi && b.format('YYYY-MM-DD') === ff;
        });

        try {
            localStorage.setItem(this.rangeKey, JSON.stringify({ range: named || 'custom', fi, ff }));
        } catch (e) {
            // Sin almacenamiento el periodo dura lo que dure la página.
        }
    }
}
