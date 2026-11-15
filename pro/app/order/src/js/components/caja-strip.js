/*  Franja de caja: el estado del turno a lo ancho, bajo la barra de arriba.
    Es la misma en todas las pantallas de order/ (pedidos, ventas, historial,
    calendario, cortes y clientes). La pinta OrderTurn cada vez que cambia el turno.

    Cinco estados, en este orden: turno de otro día, turno abierto, día cerrado,
    día pendiente de cierre y sin turno.

    Un solo botón, de contorno como en Soft Restaurant, y solo maneja el turno.
    «Cierre del día» se queda en el encabezado de cada pantalla.

    Quien no tiene create (Consulta) ve el estado y «Turno y corte» en solo lectura;
    nunca Abrir, Cerrar ni «Ir a Cortes». */

// -- Franja de caja --

class CajaStrip extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'CajaStrip';
    }

    paint() {
        if (!$('#cajaStrip').length) return;

        const s = this.state();

        const container = [
            {
                type:  'div',
                id:    'cajaStripMain',
                class: 'caja-strip-main',
                children: [
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

        if (s.button) this.button(s.button);
    }

    // -- Estado --

    // Mismo orden que el chip de antes: otro día, abierto, día cerrado, pendiente, sin turno.
    state() {
        const turn    = dataInit.turn;
        const day     = dataInit.day || {};
        const pending = day.pending && day.pending.length ? day.pending[0] : '';
        const can     = this.canCreate();

        if (turn && turn.old) {
            return {
                tone:   'is-old',
                title:  `Turno ${turn.folio} de otro día`,
                text:   `Quedó abierto el ${ordDate(turn.opened_at)}. ` + (can ? 'Ciérralo para poder abrir el de hoy.' : 'Lo cierra quien cobra, en caja.'),
                button: can ? { text: `Cerrar turno ${turn.folio}`, icon: 'icon-lock', kind: 'is-warn', onClick: () => orderTurn.open() } : null
            };
        }

        if (turn) {
            return {
                tone:   'is-open',
                title:  `Turno ${turn.folio} abierto`,
                text:   [`Desde las ${ordHour(String(turn.opened_at).slice(11, 16))}`, turn.opened_by ? `abrió ${turn.opened_by}` : ''].filter(Boolean).join(' · '),
                stats:  this.stats(turn),
                button: { text: 'Turno y corte', icon: 'icon-clock', kind: 'is-ok', onClick: () => orderTurn.open() }
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
                tone:   'is-old',
                title:  `Falta cerrar el ${ordDate(pending).slice(0, 5)}`,
                text:   can ? 'El turno se cerró, pero el día no. Se cierra en Cortes; luego abres el de hoy.' : 'El cierre lo hace quien cobra, en Cortes.',
                button: can && !this.onCuts() ? { text: 'Ir a Cortes', icon: 'icon-doc-text', kind: 'is-warn', onClick: () => { location.href = 'cortes.php'; } } : null
            };
        }

        return {
            tone:   'is-none',
            title:  'Sin turno abierto',
            text:   can ? 'Sin turno no se puede vender, capturar pedidos ni cobrar.' : 'El turno se abre en caja. Pídeselo a quien cobra.',
            button: can ? { text: 'Abrir turno', icon: 'icon-lock-open', kind: 'is-ok', onClick: () => orderTurn.open() } : null
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

    // -- Botón --

    // Contorno: color_btn 'outline' de coffeeForm y caja-out encima (order.css).
    button(b) {
        this.coffeeForm({
            parent:       'cajaStripActions',
            id:           'formCajaStrip',
            class:        'flex',
            showRequired: false,
            json: [
                {
                    opc:       'button',
                    id:        'btnCajaStrip',
                    class:     'col-auto',
                    text:      esc(b.text),
                    icon:      b.icon,
                    color_btn: 'outline',
                    className: `caja-out ${b.kind}`,
                    onClick:   b.onClick
                }
            ]
        });
    }

    // -- Complements --

    canCreate() {
        return !!(orders && typeof orders.can === 'function' && orders.can('create'));
    }

    // En Cortes ya está «Cierre del día» en el encabezado: «Ir a Cortes» sobra.
    onCuts() {
        return typeof Cuts !== 'undefined' && orders instanceof Cuts;
    }
}
