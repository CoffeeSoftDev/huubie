/*  Pedidos › Calendario como página sola: la usa quien ve el calendario pero
    no Pedidos (Producción). Quien también ve Pedidos llega a pedidos.php con
    la vista Calendario (calendario.php lo redirige).

    La clase vive en components/order-calendar.js: la comparten esta página y
    la vista Calendario de Pedidos. */

let api = 'ctrl/ctrl-calendario.php';
let orders, orderDetail, orderTurn, orderPay, orderClosure;
let dataInit = {};

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    orderDetail          = new OrderDetail(api, 'root');
    orderDetail.editable = false;
    orderTurn            = new OrderTurn('ctrl/ctrl-turno.php', 'root');
    orderPay             = new OrderPay('ctrl/ctrl-cobro.php', 'root');
    orderClosure         = new OrderClosure('ctrl/ctrl-cierre.php', 'root');
    orders               = new OrderCalendar(api, 'root');
    orders.info          = dataInit;

    // «Todas las sucursales» de la barra (navbar.offerAll): la comparte con Pedidos.
    orders.all      = !!(dataInit.all && window.navbar && typeof navbar.offerAll === 'function' && navbar.offerAll('order', dataInit.all));
    orderDetail.all = orders.all;

    orders.init();
});
