let apiFacturador = 'ctrl/ctrl-facturador.php';
let app, facturador, facturadorView;

let branch_id;

const FACTURADOR_TABS = [
    { id: 'folios',    label: 'Folios',    icon: 'printer',          title: 'Folios · consulta de tickets', subtitle: 'Reparto 70/30 y ticket virtual', periodo: true, detail: true },
    { id: 'resumen',   label: 'Resumen',   icon: 'layout-dashboard', title: 'Resumen',                      subtitle: 'Avance de la meta de facturación', periodo: true },
    { id: 'ventas',    label: 'Ventas',    icon: 'credit-card',      title: 'Venta por pago',               subtitle: 'Cada renglón es un pago aplicado a una orden', periodo: true },
    { id: 'detallado', label: 'Detallado', icon: 'list',             title: 'Detallado',                    subtitle: 'Tickets del POS línea por línea', periodo: true },
    { id: 'facturas',  label: 'Facturas',  icon: 'file-check-2',     title: 'Facturados',                   subtitle: 'CFDI emitidos en el periodo', periodo: true },
    { id: 'catalogos', label: 'Catálogo',  icon: 'book-open',        title: 'Catálogos',                    subtitle: 'Productos puente, clientes y parámetros', periodo: false }
];

const HEAD_FOLIOS    = ['Orden', 'ID', 'Facturado', 'Folio', 'Monto', '16%', ''];
const HEAD_ACUMULADO = ['ID', 'Orden', 'Forma de pago', 'Monto'];
const HEAD_PENDING   = ['ID', 'Orden', 'Monto', 'Tasa'];
const HEAD_FACTURADO = ['ID', 'Orden', 'Folio', 'Monto'];
const HEAD_VENTAS    = ['ID', 'Facturado', 'Forma de pago', 'Fecha', 'Orden', 'Mov. PDV', 'Estatus', 'Mesero', 'Terminal', 'Total', 'Propina', 'Total cobrado'];
const HEAD_DETALLADO = ['Día', 'Fecha', 'Orden', 'Mesa', 'Personas', 'Mesero', 'Terminal', 'Subtotal', 'IVA', 'IEPS', 'Total', 'Cant.', 'P. unit.', 'Platillo / Artículo', 'Clave', 'Modificador'];
const HEAD_FACTURAS  = ['Folio', 'RFC', 'Nombre / Razón social', 'Referencia', 'Estatus', 'Fecha', 'Subtotal', 'IVA', 'IEPS', 'Total', 'UUID', 'Forma', 'Método', 'Orden', 'Fecha op.', 'Tipo'];
const HEAD_BRIDGE    = ['Clave', 'Platillo / Artículo', 'Precio', ''];
const HEAD_CUSTOMERS = ['RFC', 'Razón social', ''];

const _formaPagoName = (code) => {
    const f = SAMPLE_FACTURADOR_PAYMENT_FORMS.find(x => x.code === code);
    return f ? f.name : code;
};

$(async () => {
    facturadorView = new FacturadorView(apiFacturador, 'root');
    facturador     = new Facturador(apiFacturador, 'root');
    app            = new App(apiFacturador, 'root');
    await app.init();
});
