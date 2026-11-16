/*  Franja de caja: el estado del turno a lo ancho, bajo la barra de arriba.
    Es la misma en todas las pantallas de order/ (pedidos, ventas, historial,
    calendario, cortes y clientes). La pinta OrderTurn cada vez que cambia el turno.

    Cinco estados, en este orden: turno de otro día, turno abierto, día cerrado,
    día pendiente de cierre y sin turno.

    Con la captura de Pedidos abierta, «Volver a pedidos» va a la izquierda,
    junto al estado del turno.

    A la derecha, los botones de Soft Restaurant: recuadro con la tecla arriba,
    el ícono al centro y el nombre abajo. Abrir turno (F2) y Cerrar turno (F3)
    están siempre; el que no aplica al estado se ve apagado.
    Con el día pendiente se suma «Ir a Cortes»: ahí se cierra el día.
    En Ventas se suma «Cierre del día»: se enciende cuando hoy ya se abrió más
    de un turno. En las demás pantallas se queda en su encabezado.
    También en Ventas, al final, va «Ir a Pedidos»: cambia a pedidos.php.
    Lo ve quien ve esa sección, tenga o no create.

    Quien no tiene create (Consulta) no ve Abrir, Cerrar, «Cierre del día» ni «Ir a Cortes». */

// -- Franja de caja --

class CajaStrip extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'CajaStrip';

        // F2 abre y F3 cierra el turno desde cualquier pantalla, como en Soft.
        $(document).off('keydown.cajaStrip').on('keydown.cajaStrip', (e) => this.onKey(e));
    }

    paint() {
        if (!$('#cajaStrip').length) return;

        const s    = this.state();
        const back = this.onOrderForm();

        const container = [
            {
                type:  'div',
                id:    'cajaStripMain',
                class: 'caja-strip-main',
                children: [
                    ...(back ? [{ type: 'div', id: 'cajaStripBack', class: 'caja-strip-back' }] : []),
                    { type: 'span', class: 'caja-strip-icon', html: '<i class="icon-wallet"></i>' },
                    { type: 'span', class: 'caja-strip-title', html: `<span class="ord-turn-dot"></span>${esc(s.title)}` },
                    { type: 'span', class: 'caja-strip-text', text: s.text }
                ]
            }
        ];

        if (s.stats) {
            container.push({
                type:     'div',
                id:       'cajaStripStats',
                class:    'caja-strip-stats',
                children: s.stats.map(([label, value]) => ({ type: 'span', html: `${label}<b>${esc(value)}</b>` }))
            });
        }

        container.push({ type: 'div', id: 'cajaStripActions', class: 'caja-strip-actions' });

        this.createLayout({
            parent: 'cajaStrip',
            design: false,
            data:   { id: 'cajaStripBody', class: `caja-strip ${s.tone}`, container: container }
        });

        if (back) this.backButton();

        this.tiles(s);
    }

    // -- Volver a pedidos --

    // Mismo botón que tenía el encabezado de la captura; askClose() pregunta si hay cambios.
    backButton() {
        this.coffeeForm({
            parent:       'cajaStripBack',
            id:           'formOrderBack',
            class:        'flex',
            showRequired: false,
            json: [
                { opc: 'button', id: 'btnOrderBack', class: 'col-12', text: 'Volver a pedidos', icon: 'icon-left-open', color_btn: 'outline', onClick: () => orderForm.askClose() }
            ]
        });
    }

    // -- Estado --

    // Mismo orden que el chip de antes: otro día, abierto, día cerrado, pendiente, sin turno.
    // open, close y cuts dicen qué botón aplica; el permiso lo revisa tiles().
    state() {
        const turn    = dataInit.turn;
        const day     = dataInit.day || {};
        const pending = day.pending && day.pending.length ? day.pending[0] : '';
        const can     = this.canCreate();

        if (turn && turn.old) {
            return {
                tone:  'is-old',
                title: `Turno ${turn.folio} de otro día`,
                text:  `Quedó abierto el ${ordDate(turn.opened_at)}. ` + (can ? 'Ciérralo para poder abrir el de hoy.' : 'Lo cierra quien cobra, en caja.'),
                close: true
            };
        }

        if (turn) {
            return {
                tone:  'is-open',
                title: `Turno ${turn.folio} abierto`,
                text:  [`Desde las ${ordHour(String(turn.opened_at).slice(11, 16))}`, turn.opened_by ? `abrió ${turn.opened_by}` : ''].filter(Boolean).join(' · '),
                stats: this.stats(turn),
                close: true
            };
        }

        if (day.closed) {
            return {
                tone:  'is-closed',
                title: 'Día cerrado',
                text:  'El día de hoy ya se cerró. Hoy no se abre otro turno.'
            };
        }

        // El día se cierra en Cortes: la franja avisa y lleva ahí, no lo cierra.
        if (pending) {
            return {
                tone:  'is-old',
                title: `Falta cerrar el ${ordDate(pending).slice(0, 5)}`,
                text:  can ? 'El turno se cerró, pero el día no. Se cierra en Cortes; luego abres el de hoy.' : 'El cierre lo hace quien cobra, en Cortes.',
                cuts:  !this.onCuts()
            };
        }

        return {
            tone:  'is-none',
            title: 'Sin turno abierto',
            text:  can ? 'Sin turno no se puede vender, capturar pedidos ni cobrar.' : 'El turno se abre en caja. Pídeselo a quien cobra.',
            open:  true
        };
    }

    // Las cifras solo llegan con el turno de hoy (turnBrief no las manda si es de otro día).
    stats(turn) {
        if (turn.total_sales === undefined) return null;

        return [
            ['Fondo', money(turn.opening_cash)],
            ['Vendido', money(turn.total_sales)],
            ['Pedidos · Ventas', `${Number(turn.orders_count)} · ${Number(turn.sales_count)}`]
        ];
    }

    // -- Botones --

    // Botones de coffeeForm con caja-tile encima (order.css). Tecla, ícono Lucide y nombre
    // van en text: el icon de coffeeForm solo pinta Fontello.
    tiles(s) {
        const can  = this.canCreate();
        const list = [];

        if (can) {
            list.push({ id: 'btnCajaOpen', key: 'F2', icon: 'clock', text: 'Abrir turno', kind: 'is-open', on: s.open, onClick: () => orderTurn.open() });
            list.push({ id: 'btnCajaClose', key: 'F3', icon: 'alarm-clock-off', text: 'Cerrar turno', kind: 'is-close', on: s.close, onClick: () => orderTurn.open() });
        }

        if (can && this.onSale()) {
            list.push({ id: 'btnCajaDay', icon: 'calendar-check', text: 'Cierre del día', kind: 'is-day', on: this.dayReady(), onClick: () => orderClosure.open() });
        }

        if (can && s.cuts) {
            list.push({ id: 'btnCajaCuts', icon: 'file-text', text: 'Ir a Cortes', kind: 'is-cuts', on: true, onClick: () => { location.href = 'cortes.php'; } });
        }

        // Ventas › cambiar a Pedidos sin pasar por el menú. No depende de create ni del turno.
        // is-nav no tiene color propio en order.css: el ícono sale gris.
        if (this.onSale() && this.seesOrders()) {
            list.push({ id: 'btnCajaOrders', icon: 'clipboard-list', text: 'Ir a Pedidos', kind: 'is-nav', on: true, onClick: () => { location.href = 'pedidos.php'; } });
        }

        this.coffeeForm({
            parent:       'cajaStripActions',
            id:           'formCajaStrip',
            class:        'flex gap-2',
            showRequired: false,
            json: list.map((t) => ({
                opc:       'button',
                id:        t.id,
                class:     'col-auto',
                text:      this.tileHtml(t),
                color_btn: 'outline',
                className: `caja-tile ${t.kind}`,
                onClick:   t.onClick
            }))
        });

        list.forEach((t) => $(`#${t.id}`).prop('disabled', !t.on));

        if (window.lucide) lucide.createIcons({ root: document.getElementById('cajaStrip') });
    }

    tileHtml(t) {
        const key = t.key ? `<span class="caja-tile-key">${t.key}</span>` : '';

        return `${key}<i data-lucide="${t.icon}"></i><span class="caja-tile-text">${esc(t.text)}</span>`;
    }

    // -- Teclas --

    // Solo con la pantalla libre: con un modal o un aviso abierto la tecla es de ellos
    // (F2 guarda el corte y registra el cobro). Botón apagado = la tecla no hace nada.
    onKey(e) {
        const id = { F2: 'btnCajaOpen', F3: 'btnCajaClose' }[e.key];

        if (!id || e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
        if ($('.cs-modal-bg, .cf-overlay, .swal2-container').length) return;

        const btn = $(`#${id}`);

        if (!btn.length || btn.prop('disabled')) return;

        e.preventDefault();
        btn.trigger('click');
    }

    // -- Complements --

    canCreate() {
        return !!(orders && typeof orders.can === 'function' && orders.can('create'));
    }

    // En Cortes ya está «Cierre del día» en el encabezado: «Ir a Cortes» sobra.
    onCuts() {
        return typeof Cuts !== 'undefined' && orders instanceof Cuts;
    }

    // Ventas no tiene «Cierre del día» en el encabezado: va en la franja.
    onSale() {
        return typeof Sale !== 'undefined' && orders instanceof Sale;
    }

    // Ve Pedidos quien tiene al menos una acción en esa sección: la regla del menú.
    // En Ventas dataInit.actions son las de pos-pedidos (ctrl-ventas.php › init).
    seesOrders() {
        return ((dataInit && dataInit.actions) || []).length > 0;
    }

    // La captura de Pedidos está abierta (Ventas usa el mismo #posOrderHost, pero no vuelve a ningún lado).
    onOrderForm() {
        return typeof orderForm !== 'undefined' && !!orderForm && !this.onSale() && $('#posOrderHost').length > 0;
    }

    // Se enciende cuando hoy ya se abrió más de un turno y el día sigue sin cerrar.
    // Con un turno todavía abierto el modal enseña el parcial y no deja cerrar.
    dayReady() {
        const day = dataInit.day || {};

        return Number(day.turns || 0) > 1 && !day.closed;
    }
}
