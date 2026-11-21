/*  Pedidos › captura (TPV), en su propia página: pedido.php abre un pedido
    nuevo y pedido.php?id=<id> edita ese pedido. Al recargar se vuelve a
    abrir. La lista vive en lista-pedidos.php.

    La captura es OrderForm (pedido-captura.js). Cuando se cierra (al guardar
    o con «Volver a pedidos») la página regresa sola a la lista en cuanto
    termina lo que siga: el aviso de guardado, la ventana de pagos, el turno o
    la impresión del ticket. Mientras, se ve «Regresando a la lista» con el
    botón para irse ya.

    OrderPage hace de `orders` para el turno, el cobro y la franja: can(),
    paintTurn(), lsOrders(), y fetchInit() y repaint() para el cambio de
    sucursal de la captura. ?from=ventas viaja con ella. */

let api = 'ctrl/ctrl-pedidos.php';
let orders, orderDetail, orderForm, orderTurn, orderPay, orderClosure;
let dataInit = {};

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    orderDetail  = new OrderDetail(api, 'root');
    orderForm    = new OrderForm(api, 'root');
    orderTurn    = new OrderTurn('ctrl/ctrl-turno.php', 'root');
    orderPay     = new OrderPay('ctrl/ctrl-cobro.php', 'root');
    orderClosure = new OrderClosure('ctrl/ctrl-cierre.php', 'root');
    orders       = new OrderPage(api, 'root');

    // Editar abre también el pedido de otra sucursal que se eligió en «Todas» (el ctrl decide si se puede).
    orderDetail.all = true;

    // El selector de sucursal de la barra dice cuál tiene turno (navbar.showTurns).
    if (dataInit.turns && window.navbar && typeof navbar.showTurns === 'function') navbar.showTurns(dataInit.turns);

    orders.init();
});

// -- OrderPage --

class OrderPage extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'OrderPage';
        this.leaveTimer   = null;
        this.calm         = 0;
    }

    init() {
        this.layout();

        if (dataInit.status != 200) return this.card('blocked', dataInit.message || 'No se pudo abrir la captura. Recarga la página.');

        const id = this.orderId();

        if (!this.can(id ? 'update' : 'create')) {
            return this.card('blocked', id ? 'Tu rol no puede editar pedidos en esta sucursal.' : 'Tu rol no puede capturar pedidos en esta sucursal.');
        }

        orderTurn.paintStrip(true);

        this.openForm();
    }

    // #pageOrders es lo que OrderForm esconde al abrir y enseña al cerrar: aquí, el aviso de la página.
    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:    'pageOrders',
                class: 'flex flex-1 flex-col items-center justify-center',
                container: [
                    { type: 'div', id: 'cardOrderPage', class: 'w-full max-w-[520px]' }
                ]
            }
        });
    }

    /*  Abre la captura que pide la dirección. Editar no repite el aviso de
        «ya está en un corte»: la lista lo dio antes de mandar aquí. Si no se
        abre (sin turno, ya no se puede editar), queda el aviso con «Intentar
        otra vez»; sin turno, «Abrir turno» la abre después sola. */
    async openForm() {
        const id = this.orderId();

        this.card('wait');

        if (id) await orderForm.edit(id, false);
        else await orderForm.add();

        if (!$('#posOrderHost').length) this.card('failed');
    }

    // -- La dirección y la lista --

    // El id de ?id=; 0 = pedido nuevo.
    orderId() {
        const id = Number(new URLSearchParams(location.search).get('id'));

        return Number.isInteger(id) && id > 0 ? id : 0;
    }

    url(page, id) {
        const params = new URLSearchParams();
        const from   = new URLSearchParams(location.search).get('from');

        if (id) params.set('id', String(id));
        if (from) params.set('from', from);

        const query = params.toString();

        return page + (query ? `?${query}` : '');
    }

    // OrderForm.open() avisa: la dirección y el título dicen qué pedido es (al recargar abre ese).
    formOpened(order) {
        this.stopLeave();

        document.title = order ? `Huubie · Pedido P${order.folio || order.id}` : 'Huubie · Nuevo pedido';

        history.replaceState(null, '', this.url('pedido.php', order ? order.id : 0));
    }

    // OrderForm.close() avisa: guardó o salió sin guardar. Se regresa a la lista al quedar libre.
    formClosed() {
        this.card('leaving');
        this.leaveWhenIdle();
    }

    // -- Regreso a la lista --

    /*  Cada 250 ms: con tres vueltas seguidas sin nada pendiente, a la lista.
        Así el aviso de guardado, el cobro (que puede abrir el turno o imprimir)
        y la impresión terminan antes de cambiar de página. */
    leaveWhenIdle() {
        this.stopLeave();

        this.leaveTimer = setInterval(() => {
            this.calm = this.idle() ? this.calm + 1 : 0;

            if (this.calm >= 3) this.leave();
        }, 250);
    }

    stopLeave() {
        clearInterval(this.leaveTimer);

        this.leaveTimer = null;
        this.calm       = 0;
    }

    // Nada abierto (avisos, ventanas, el cobro) ni en camino (peticiones de cobro, detalle o turno, impresión).
    idle() {
        if ($('#posOrderHost, .swal2-container, .cs-modal-bg, .cf-overlay, [data-ab-backdrop], #modalOrderPay').length) return false;
        if (orderPay.loading || orderPay.busy || orderPay.isOpen) return false;
        if (orderDetail.loading || orderTurn.loading || orderForm.saving) return false;
        if (typeof ordPrintDoc === 'function' && ordPrintDoc.pending) return false;

        return true;
    }

    leave() {
        this.stopLeave();

        location.href = this.url('lista-pedidos.php', 0);
    }

    // -- Aviso de la página --

    /*  wait: abriendo · failed: no se abrió (con «Intentar otra vez») ·
        blocked: sin permiso o sin datos · leaving: regresando a la lista. */
    card(mode, message = '') {
        const views = {
            wait:    { icon: 'loader-circle', title: 'Abriendo la captura…', text: '' },
            failed:  { icon: 'circle-alert', title: 'No se abrió la captura', text: 'Revisa el aviso: si falta el turno, ábrelo y vuelve a intentar.' },
            blocked: { icon: 'lock', title: message, text: 'Si crees que es un error, pide acceso a quien administra Huubie.' },
            leaving: { icon: 'arrow-left', title: 'Regresando a la lista de pedidos…', text: 'En cuanto termine lo que está abierto.' }
        };

        const v = views[mode] || views.wait;

        this.createLayout({
            parent: 'cardOrderPage',
            design: false,
            data: {
                id:    'cardOrderPageBody',
                class: 'ord-aviso',
                container: [
                    { type: 'i', class: 'w-[22px] h-[22px] shrink-0' },
                    {
                        type:  'div',
                        class: 'flex flex-col min-w-0',
                        children: [
                            { type: 'p', class: 'ord-aviso-titulo', text: v.title },
                            ...(v.text ? [{ type: 'p', class: 'ord-aviso-texto', text: v.text }] : []),
                            { type: 'div', id: 'cardOrderPageActions', class: 'flex mt-[10px]' }
                        ]
                    }
                ]
            }
        });

        const actions = [];

        if (mode === 'failed') {
            actions.push({ opc: 'button', id: 'btnOrderPageRetry', class: 'col-auto', text: 'Intentar otra vez', color_btn: 'primary', onClick: () => this.openForm() });
        }

        if (mode !== 'wait') {
            actions.push({ opc: 'button', id: 'btnOrderPageList', class: 'col-auto', text: mode === 'leaving' ? 'Ir ahora' : 'Ir a la lista', color_btn: 'outline', onClick: () => this.leave() });
        }

        if (actions.length) {
            this.coffeeForm({
                parent:       'cardOrderPageActions',
                id:           'formOrderPage',
                class:        'flex gap-2',
                showRequired: false,
                json:         actions
            });

            // Los botones no llevan etiqueta: sin el renglón vacío que les pone coffeeForm.
            $('#formOrderPage label').remove();
            $('#formOrderPage > div').removeClass('mt-1');
        } else {
            $('#cardOrderPageActions').remove();
        }

        // El ícono de Lucide va por data-lucide: se pone antes de pintarlo.
        $('#cardOrderPageBody > i').first().attr('data-lucide', v.icon);

        if (window.lucide) lucide.createIcons({ root: document.getElementById('cardOrderPage') });
    }

    // -- Lo que esperan el turno, el cobro y la franja --

    can(action) {
        return (dataInit.actions || []).includes(action);
    }

    // La franja la repinta orderTurn.sync(); aquí no hay encabezado ni lista que refrescar.
    paintTurn() {}

    lsOrders() {}

    // La captura cambió de sucursal (orderForm.changeBranch): el init ya es el de la otra.
    async fetchInit() {
        return (await useFetch({ url: api, data: { opc: 'init' } })) || {};
    }

    // Con el init de la otra sucursal: permisos, turno y franja. La captura se vuelve a montar sola.
    repaint(init) {
        dataInit = init;

        if (dataInit.turns && window.navbar && typeof navbar.showTurns === 'function') navbar.showTurns(dataInit.turns);

        orderTurn.paintStrip();
    }
}
