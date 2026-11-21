/*  Pedidos › detalle e impresion de un pedido. Si el pedido se puede
    editar, el boton «Editar pedido» abre la captura: orderForm.edit(id).

    Conserva el modal de alpha (showOrder): informacion a la izquierda,
    productos a la derecha, galeria de fotos en los personalizados. Cambia
    el tema (Claro de pro, sobre csModal en vez de bootbox) y suma la
    bitacora y el motivo de cancelacion.

    Produccion (el ctrl manda limited = true) lo ve sin dinero: ni resumen de
    pago, ni precios, ni importes. El ctrl ya no manda esas cifras.

    Entregar pide la contraseña de quien opera: deliver() abre la ventana y
    saveDeliver() la manda al ctrl, que es quien la revisa.

    «Editar entrega» (como alpha) va al pie de Informacion y sale tambien en
    el calendario: editDelivery() cambia solo fecha, hora, tipo, direccion y
    nota. En un pagado la misma ventana pide la contraseña. «Editar» un
    pagado (editPaid, alpha › editOrderPaid) usa la misma ventana: lo hace
    quien edita pedidos, con su contraseña y el turno de hoy abierto.

    Lo usan pedidos.js y calendario.js: orderDetail.show(id), .print(id), .deliver(id). */

// -- Ayudantes compartidos con pedidos.js --

function esc(t) {
    return (t == null ? '' : String(t)).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// $1,234.50. Con 0 da $0.00 (formatPrice da un guion).
// El signo va antes del $: "-$55.00".
function money(n) {
    const value = Math.round(Number(n || 0) * 100) / 100;
    const text  = Math.abs(value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (value < 0 ? '-' : '') + '$' + text;
}

// 'AAAA-MM-DD hh:mm:ss' -> 'DD/MM/AAAA' (o con la hora). Se parte el texto: sin Date no hay corrimiento de zona.
function ordDate(value, withTime) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);

    if (!m) return '';

    const day = `${m[3]}/${m[2]}/${m[1]}`;

    return withTime && m[4] ? `${day} ${ordHour(m[4] + ':' + m[5])}` : day;
}

// '16:00:00' -> '4:00 PM'.
function ordHour(value) {
    const m = String(value || '').match(/^(\d{1,2}):(\d{2})/);

    if (!m) return '';

    const h = Number(m[1]);

    return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

// Identificador de un envio: el ctrl no guarda dos veces el mismo.
function ordToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

// '1500' o '1,500.50' -> 1500.5. Vacio, letras o mas de 2 decimales -> null.
function ordAmount(raw) {
    const value = String(raw == null ? '' : raw).replace(/[$,\s]/g, '');

    if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;

    const n = Number(value);

    return n > 999999 ? null : n;
}

function ordRound(n) {
    return Math.round(Number(n || 0) * 100) / 100;
}

// Botón de coffeeForm apagado con su porqué. El botón apagado no recibe el mouse:
// el title va en su caja (order.css › .ord-locked). why vacío = encendido.
function ordLock(id, off, why) {
    $(`#${id}`).prop('disabled', !!off).parent().toggleClass('ord-locked', !!off).attr('title', off && why ? why : null);
}

// Hoja de ~80 mm en un iframe oculto: no abre ventana ni cambia de pagina.
function ordPrint(title, body) {
    const css = `
        @page { margin: 4mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; width: 300px; margin: 0 auto; }
        h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
        h2 { font-size: 12px; margin: 0 0 4px; text-transform: uppercase; }
        .c { text-align: center; } .r { text-align: right; white-space: nowrap; vertical-align: top; }
        .s { font-size: 10.5px; color: #333; } .b td { font-weight: bold; }
        .d { display: block; } .x td { color: #666; }
        hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; } td { padding: 2px 0; vertical-align: top; }`;

    ordPrintDoc(title, css, body);
}

/*  Escribe la hoja en el iframe oculto y la manda a imprimir. La usan ordPrint
    (pedido, cortes y cierre) y ordPrintTicket (venta); cada una trae su CSS.
    Si la hoja lleva imágenes (el logo del ticket) espera a que carguen, 2 s
    como mucho: con solo el tiempo fijo el logo podía salir en blanco. */
function ordPrintDoc(title, css, body) {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(title)}</title>
        <style>${css}</style></head><body>${body}</body></html>`;

    $('#ordPrintFrame').remove();

    const frame = $('<iframe>', { id: 'ordPrintFrame', title: 'Impresión', 'aria-hidden': 'true' })
        .css({ position: 'fixed', right: 0, bottom: 0, width: 0, height: 0, border: 0, visibility: 'hidden' })
        .appendTo('body')
        .get(0);

    const doc = frame.contentWindow.document;

    doc.open();
    doc.write(html);
    doc.close();

    const images = Promise.all(Array.from(doc.images).map((img) => img.decode().catch(() => { })));
    const limit  = new Promise((resolve) => setTimeout(resolve, 2000));

    // pending: hay una impresión en camino. pedido.js no regresa a la lista hasta que salga.
    ordPrintDoc.pending = true;

    Promise.race([images, limit]).then(() => setTimeout(() => {
        // Otra impresión ya quitó este iframe.
        if (frame.contentWindow) {
            frame.contentWindow.focus();
            frame.contentWindow.print();
        }

        ordPrintDoc.pending = false;
    }, 250));
}

// 'DD/MM/AAAA h:mm AM' de ahora.
function ordNow() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');

    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${ordHour(pad(now.getHours()) + ':' + pad(now.getMinutes()))}`;
}

// -- Ticket de venta (formato de alpha) --

/*  El ticket de alpha (ticketPasteleria, alpha/pedidos › pedidos-catalogo.js)
    para las ventas de mostrador: logo redondo, empresa y sucursal, datos,
    PRODUCTOS con CANT. / DESCRIPCIÓN / IMPORTE, totales a la derecha y el pie.

    Las medidas son las que alpha imprime de verdad, medidas en su ventana de
    impresión: carga Tailwind 2 con la letra base en 12px, así que 1rem = 12px
    (text-xs 9px, text-sm 10.5px, text-base 12px, text-lg 13.5px, text-xl 15px).
    Aquí van escritas a mano: el iframe no carga nada de fuera.

    Lo único que no se copia es el alto mínimo de 600px: solo gastaba papel. */
const ORD_TICKET_CSS = `
    @page { margin: 0; size: auto; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; background: #fff; color: #000; font-family: Consolas, 'Roboto Mono', 'Lucida Console', monospace; font-size: 12px; line-height: 1.5; }
    h1, p { margin: 0; }
    hr { height: 0; margin: 0; border: 0; border-top: 1px dashed #e5e7eb; }
    .tk { width: 100%; padding: 12px; background: #fff; color: #111827; }
    .tk-head { display: flex; flex-direction: column; align-items: center; margin: 9px 0 12px; }
    .tk-logo { width: 96px; height: 96px; margin-bottom: 3px; border-radius: 50%; }
    .tk-logo img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .tk-logo span { color: #fff; font-size: 36px; font-weight: 700; }
    .tk-logo.is-img { overflow: hidden; }
    .tk-logo.is-none { display: flex; align-items: center; justify-content: center; background: #7c3aed; }
    .tk-logo.is-img span, .tk-logo.is-none img { display: none; }
    .tk-order .tk-logo { width: 64px; height: 64px; }   /* ticket de pedido: logo más chico que el de venta */
    .tk-order .tk-logo span { font-size: 24px; }
    .tk-company, .tk-branch, .tk-tag, .tk-reason, .tk-stamp, .tk-notes div, .tk-small { font-size: 9px; line-height: 12px; }
    .tk-company { margin-bottom: 3px; font-weight: 600; text-transform: uppercase; }
    .tk-branch { text-transform: uppercase; }
    .tk h1 { font-size: 13.5px; line-height: 21px; font-weight: 700; }
    .tk-tag { font-weight: 700; color: #dc2626; text-transform: uppercase; }
    .tk-reason { text-align: center; }
    .tk-data, .tk-items, .tk-totals { font-size: 10.5px; line-height: 15px; }
    .tk-data > * + * { margin-top: 6px; }
    .tk-row { display: flex; justify-content: space-between; gap: 8px; }
    .tk-row > div:last-child { text-align: right; }
    .tk-label { font-weight: 600; }
    .tk-up { text-transform: uppercase; }
    .tk-stamp { color: #4b5563; }
    .tk-items { margin-top: 9px; }
    .tk-items-title { margin-bottom: 6px; text-align: center; font-weight: 700; }
    .tk-cols { display: flex; justify-content: space-between; }
    .tk-cols.is-head { padding-bottom: 6px; font-weight: 600; }
    .tk-c1 { width: 16.666667%; } .tk-c2 { width: 50%; } .tk-c3 { width: 33.333333%; text-align: right; }
    .tk-line { padding: 3px 0 6px; }
    .tk-name { font-weight: 700; text-transform: capitalize; }
    .tk-notes { margin-top: 1.5px; padding-left: 6px; }
    .tk-notes div { margin-left: 3px; }
    .tk-notes div.tk-portion { margin-left: 0; font-size: 10.5px; line-height: 15px; }
    .tk-totals > .tk-rest { margin-top: 6px; }
    hr.tk-cut { margin: 6px 0; }
    .tk-totals { margin-top: 12px; text-align: right; }
    .tk-totals > * + * { margin-top: 3px; }
    .tk-base { font-size: 12px; line-height: 18px; }
    .tk-big { font-size: 15px; line-height: 21px; font-weight: 700; }
    .tk-bold { font-weight: 700; }
    .tk-amt { font-weight: 600; }
    .tk-foot { margin-top: 18px; text-align: center; font-size: 9px; line-height: 12px; font-weight: 700; color: #111827; }
    .tk-foot > * + * { margin-top: 3px; }
    .tk-brand { font-size: 10.5px; line-height: 15px; }`;

/*  t = el ticket como lo arma el ctrl (ticketData en ctrl-ventas.php, ticketOf
    en ctrl-historial.php). La empresa y su logo salen de dataInit.scope.
    opts.draft   = número del ticket en espera: sale como PRE-CUENTA, sin folio.
    opts.reprint = true desde el Historial: dice «Reimpreso».
    ordTicketHtml arma la hoja (el visor de Tickets/Cierre la muestra tal cual);
    ordPrintTicket la manda a la impresora. */
function ordPrintTicket(t, opts = {}) {
    ordPrintDoc(opts.draft ? 'Pre-cuenta' : `Venta V${t.folio}`, ORD_TICKET_CSS, ordTicketHtml(t, opts));
}

function ordTicketHtml(t, opts = {}) {
    const scope   = (typeof dataInit !== 'undefined' && dataInit && dataInit.scope) || {};
    const company = scope.company || '';
    const draft   = opts.draft || 0;
    const initial = esc(String(company || t.branch || 'H').charAt(0).toUpperCase());
    const amount  = (text) => `<span class="tk-amt">${text}</span>`;

    // Sin logo, o si la imagen no carga, queda el círculo con la inicial (como alpha).
    const logo = scope.logo
        ? `<div class="tk-logo is-img"><img src="${esc(scope.logo)}" alt="Logo" onerror="this.parentNode.className='tk-logo is-none'"><span>${initial}</span></div>`
        : `<div class="tk-logo is-none"><span>${initial}</span></div>`;

    const tag = draft ? 'PRE-CUENTA' : (t.cancelled ? 'CANCELADA' : '');

    // l.amount ya llega neto del descuento de la partida.
    const lines = (t.lines || []).map((l) => {
        const note = l.details ? `<div>Obs.: ${esc(l.details)}</div>` : '';
        const cut  = Number(l.discount) > 0 ? `<div>Desc. −${money(l.discount)}${l.reason ? ' · ' + esc(l.reason) : ''}</div>` : '';

        return `
            <div class="tk-line">
                <div class="tk-cols">
                    <div class="tk-c1">${Number(l.quantity)}</div>
                    <div class="tk-c2 tk-name">${esc(l.name)}</div>
                    <div class="tk-c3">${money(l.amount)}</div>
                </div>
                ${note || cut ? `<div class="tk-notes">${note}${cut}</div>` : ''}
            </div>`;
    }).join('');

    const payments = (t.payments || []).map((p) => {
        const change = p.cash && Number(p.change) > 0
            ? `<div class="tk-small">Recibió ${money(p.tendered)} · cambio ${money(p.change)}</div>`
            : '';

        return `<div>${esc(p.method)}: ${amount(money(p.amount))}</div>${change}`;
    }).join('');

    const tip    = Number(t.tip) > 0;
    const credit = Number(t.credit) > 0.005;
    const points = Number(t.points) > 0.005;
    const reason = t.discount && t.discount.reason ? ' · ' + esc(t.discount.reason) : '';

    /*  Sellos de la tarjeta (Lealtad): los que sumó y cómo quedó. El premio ya sale como el descuento.
        En la reimpresión (Historial) solo se sabe lo de esta compra: goal y balance llegan en null. */
    const s      = t.stamps && (Number(t.stamps.goal) > 0 || Number(t.stamps.earned) > 0) ? t.stamps : null;
    const stamps = !s ? ''
        : Number(s.goal) > 0
            ? `<div>Sellos${Number(s.earned) > 0 ? ` +${Number(s.earned)}` : ''}: ${Number(s.balance) >= Number(s.goal) ? `${Number(s.balance)} juntados` : `${Number(s.balance)} de ${Number(s.goal)}`}${Number(s.rewards) > 0 ? ' · PREMIO LISTO' : ''}</div>`
            : `<div>Sellos de esta compra: +${Number(s.earned)}</div>`;

    const body = `
        <div class="tk">
            <div class="tk-head">
                ${logo}
                ${company ? `<div class="tk-company">${esc(company)}</div>` : ''}
                ${t.branch ? `<div class="tk-branch">${esc(t.branch)}</div>` : ''}
                <h1>TICKET DE VENTA</h1>
                ${tag ? `<div class="tk-tag">${tag}</div>` : ''}
                ${!draft && t.cancelled && t.cancel_reason ? `<div class="tk-reason">${esc(t.cancel_reason)}</div>` : ''}
            </div>
            <div class="tk-data">
                <div class="tk-row">
                    <div>
                        <div class="tk-label">${draft ? 'TICKET:' : 'FOLIO:'}</div>
                        <div class="tk-up">${draft ? esc(draft) : 'V' + esc(t.folio)}</div>
                    </div>
                    <div>
                        <div class="tk-label">FECHA Y HORA:</div>
                        <div class="tk-up">${draft ? ordNow() : ordDate(t.date, true)}</div>
                    </div>
                </div>
                <div class="tk-row">
                    <div>
                        <div class="tk-label">CLIENTE:</div>
                        <div class="tk-up">${esc(t.customer)}</div>
                    </div>
                    <div>
                        <div class="tk-label">ATIENDE:</div>
                        <div class="tk-up">${esc(t.user)}</div>
                    </div>
                </div>
                ${t.card ? `
                <div>
                    <div class="tk-label">TARJETA:</div>
                    <div class="tk-up">${esc(`${t.card.type} · ${t.card.number}`)}</div>
                </div>` : ''}
                ${draft ? '' : `<div class="tk-stamp">${opts.reprint ? 'Reimpreso' : 'Impreso'}: ${ordNow()}</div>`}
                <hr>
            </div>
            <div class="tk-items">
                <div class="tk-items-title">PRODUCTOS</div>
                <div class="tk-cols is-head">
                    <div class="tk-c1">CANT.</div>
                    <div class="tk-c2">DESCRIPCIÓN</div>
                    <div class="tk-c3">IMPORTE</div>
                </div>
                ${lines || '<div class="tk-line">Sin productos</div>'}
            </div>
            <hr class="tk-cut">
            <div class="tk-totals">
                ${t.discount ? `<div class="tk-base">Subtotal: ${amount(money(t.subtotal))}</div>` : ''}
                ${t.discount ? `<div>Descuento${reason}: ${amount('−' + money(t.discount.amount))}</div>` : ''}
                <div class="tk-big">TOTAL: ${money(t.total)}</div>
                ${tip ? `<div>Propina: ${amount(money(t.tip))}</div>` : ''}
                ${tip ? `<div class="tk-bold">Cobrado: ${money(t.charged)}</div>` : ''}
                ${payments}
                ${credit ? `<div class="tk-bold">A crédito: ${money(t.credit)}</div>` : ''}
                ${points ? `<div>Puntos al monedero: ${amount(money(t.points))}</div>` : ''}
                ${stamps}
            </div>
            <div class="tk-foot">
                <p>${draft ? 'PRE-CUENTA · NO ES COMPROBANTE' : 'ESTE NO ES UN COMPROBANTE FISCAL'}</p>
                <p class="tk-brand">Huubie</p>
                <p>GRACIAS POR SU PREFERENCIA</p>
            </div>
        </div>`;

    return body;
}

// -- Tablas --

/*  El color de las tablas de Catálogo (design 'flowbite': encabezado #F9FAFB,
    filas blancas y cebra #F9FAFB) con la forma de Pedidos: encabezado centrado
    y sin mayúsculas. Va con ...ORD_TABLE en cada createCoffeeTable3 del módulo. */
const ORD_TABLE = { design: 'flowbite', th_case: 'capitalize', th_align: 'center' };

/*  createCoffeeTable3 raya por posición al armar la tabla: al ordenar o cambiar
    de página la cebra se descuadra. Esto la repinta en el orden visible, como
    'flowbite': blanca la primera fila, gris la segunda. En página oscura no hay
    cebra (dark-mode.css): no se toca. */
function ordStripe(tbody) {
    if (cfPageTheme('light') === 'dark') return;

    $(tbody).children('tr').each((i, tr) => $(tr).children('td').toggleClass('bg-white', i % 2 === 0).toggleClass('bg-[#F9FAFB]', i % 2 === 1));
}

// -- Fotos --
/*  Las rutas son 'alpha_files/...'. En local esos archivos no existen: si la
    primera carga falla se reintenta en produccion, y si tambien falla queda
    el pastel de relleno. */
const ORDER_FILES_REMOTE = 'https://huubie.com.mx/';

function fileUrl(path) {
    const p = String(path || '').trim();

    if (/^https?:\/\//i.test(p)) return p;

    return '/' + encodeURI(p.replace(/^\/+/, ''));
}

function orderImageError(img) {
    const path = img.dataset.path || '';

    if (path && !img.dataset.fileFallback && !/^https?:\/\//i.test(path)) {
        img.dataset.fileFallback = '1';
        img.src = ORDER_FILES_REMOTE + encodeURI(path.replace(/^\/+/, ''));
        return;
    }

    const box = document.createElement('div');
    box.className = 'w-full h-full flex items-center justify-center text-[#B37BC4]';
    box.innerHTML = '<i data-lucide="cake" class="w-1/3 h-1/3"></i>';

    img.replaceWith(box);

    if (window.lucide) lucide.createIcons();
}

// <img> con su reintento. La ruta viaja en data-path.
function orderImg(path, cls, alt) {
    return `<img src="${esc(fileUrl(path))}" data-path="${esc(path)}" alt="${esc(alt || '')}" `
         + `class="${cls}" loading="lazy" onerror="orderImageError(this)">`;
}

// -- Detalle --

class OrderDetail extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME   = 'PedidoDetalle';
        this.galleries      = {};
        this.loading        = false;
        this.editable       = true;   // false en el calendario: la captura vive en Pedidos
        this.delivering     = false;
        this.savingDelivery = false;
        this.limited        = false;  // true = el pedido llego sin dinero (Produccion)
        this.all            = false;  // «Todas las sucursales»: abre también el de otra (solo lectura)
    }

    // Estados de sale_status, iguales a los del ctrl.
    tones() {
        return {
            1: 'bg-[#EAF0FA] text-[#2A55A3]',
            2: 'bg-amber-50 text-amber-700',
            3: 'bg-emerald-50 text-emerald-700',
            4: 'bg-red-50 text-red-700'
        };
    }

    async fetchOrder(id) {
        if (this.loading) return null;

        this.loading = true;

        const data = await useFetch({ url: this._link, data: { opc: 'getOrder', id: id, all: this.all ? 1 : 0 } });

        this.loading = false;

        if (!data || data.status != 200) {
            alert({ icon: 'error', text: (data && data.message) || 'No se pudo abrir el pedido.', btn1: true });
            return null;
        }

        this.limited = !!data.limited;
        this.last    = data;

        return data;
    }

    async show(id) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        const data = await this.fetchOrder(id);
        if (!data) return;

        const o         = data.order;
        const folio     = o.folio || o.id;

        this.galleries = {};

        // Las acciones van en el pie, junto a «Cerrar» (footActions): el detalle empieza justo bajo el título.
        this.csModal({
            id: 'modalOrderDetails',
            title: `Pedido #P${folio}`,
            lucideIcon: 'cake',
            width: 'max-w-5xl',
            saveText: false,
            cancelText: 'Cerrar',
            // El de otra sucursal dice de cuál es y si ahí se puede cambiar (reglas de alpha), también en el calendario.
            info: !data.can ? '' : data.foreign ? (data.can.foreign_reason || '') : !this.editable ? ''
                : !data.can.edit ? (data.can.edit_paid ? 'Pedido pagado: editarlo pide tu contraseña y solo cambia los datos de entrega.' : (data.can.edit_reason || ''))
                : (data.can.lock_reason || data.can.money_reason || ''),
            body: `
                <div id="orderDetailsContainer" class="flex flex-col lg:flex-row gap-[16px] p-[20px] max-h-[70vh] overflow-y-auto">
                    <div class="lg:w-1/3 flex flex-col gap-[16px] min-w-0">
                        ${this.infoOrder(data)}
                        ${this.limited ? '' : this.infoSales(data)}
                        ${this.historyCard(data.history || [])}
                    </div>
                    <div class="lg:w-2/3 min-w-0">
                        ${this.listProducts(data.lines || [])}
                    </div>
                </div>`
        });

        $('#modalOrderDetails .cs-modal-title').after(this.badges(data));

        this.footActions(data);
        this.bindGalleries();

        if (window.lucide) lucide.createIcons();
    }

    // -- Insignias bajo el titulo --

    badges(data) {
        const o       = data.order;
        const status  = Number(o.sale_status_id);
        const tone    = this.tones()[status] || 'bg-slate-100 text-slate-600';
        const ship    = Number(o.delivery_method) === 1;
        const chip    = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap';

        return `
            <div class="flex flex-wrap items-center gap-1.5 mt-1">
                <span class="${chip} bg-gray-100 text-gray-600"><i data-lucide="house" class="w-3 h-3"></i>${esc(data.branch)}</span>
                <span class="${chip} ${tone}">${esc(o.status || 'Sin estado')}</span>
                <span class="${chip} bg-gray-100 text-gray-600">
                    <i data-lucide="${ship ? 'truck' : 'package'}" class="w-3 h-3"></i>${ship ? 'Envío a domicilio' : 'Recoge en tienda'}
                </span>
                ${this.deliveryBadge(status, Number(o.delivery_status), chip)}
            </div>`;
    }

    // Una cotizacion o un pedido cancelado no se entregan.
    deliveryBadge(status, delivery, chip) {
        if (status === 1 || status === 4) return '';

        if (delivery === 1) return `<span class="${chip} bg-emerald-50 text-emerald-700"><i data-lucide="circle-check" class="w-3 h-3"></i>Entregado</span>`;
        if (delivery === 2) return `<span class="${chip} bg-sky-50 text-sky-700"><i data-lucide="chef-hat" class="w-3 h-3"></i>En producción</span>`;

        return `<span class="${chip} bg-gray-100 text-gray-500"><i data-lucide="clock" class="w-3 h-3"></i>Sin entregar</span>`;
    }

    // -- Tarjeta base --

    card(icon, title, body, aside) {
        return `
            <section class="ord-panel bg-gray-50 border-[1px] border-gray-200 rounded-xl p-[16px]">
                <header class="flex items-center justify-between flex-wrap gap-2 mb-[12px]">
                    <h4 class="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-0">
                        <i data-lucide="${icon}" class="w-4 h-4 text-blue-600"></i>${title}
                    </h4>
                    ${aside || ''}
                </header>
                ${body}
            </section>`;
    }

    // Icono + etiqueta a la izquierda, valor a la derecha.
    infoRow(icon, label, value, sub) {
        return `
            <div class="flex items-start gap-2 py-1.5 text-[13px]">
                <i data-lucide="${icon}" class="w-4 h-4 text-gray-400 shrink-0 mt-0.5"></i>
                <span class="text-gray-500 shrink-0">${label}</span>
                <div class="ml-auto text-right min-w-0">
                    <div class="font-semibold text-gray-800 break-words">${value}</div>
                    ${sub ? `<div class="text-[11.5px] text-gray-400">${sub}</div>` : ''}
                </div>
            </div>`;
    }

    // -- Informacion del pedido --

    infoOrder(data) {
        const o       = data.order;
        const none    = '<span class="font-normal text-gray-400">Sin registro</span>';
        const ship    = Number(o.delivery_method) === 1;
        const contact = [o.phone, o.email].filter(Boolean).map(esc).join(' · ');

        const rows = [
            this.infoRow('file-text', 'Folio', `P${esc(o.folio || o.id)}`),
            this.infoRow('user', 'Cliente', esc(o.customer || 'Sin cliente'), contact),
            this.infoRow('clock', 'Creado', ordDate(o.created_at, true)),
            this.infoRow('user-pen', 'Capturó', o.created_by ? esc(o.created_by) : none),
            this.infoRow('cake', 'Produjo', o.produced_by ? esc(o.produced_by) : none, o.produced_at ? ordDate(o.produced_at, true) : ''),
            this.infoRow('calendar', 'Entrega', o.delivery_date ? ordDate(o.delivery_date) : '<span class="font-normal text-gray-400">Sin fecha</span>', ordHour(o.delivery_time))
        ];

        if (ship && o.location) rows.push(this.infoRow('map-pin', 'Dirección', esc(o.location)));
        if (o.birthday_date)    rows.push(this.infoRow('party-popper', 'Cumpleaños', ordDate(o.birthday_date)));

        const note = o.note
            ? `<div class="ord-well mt-2 p-[10px] rounded-lg bg-[#fff] border-[1px] border-gray-200 text-[12.5px] text-gray-600">
                   <span class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Nota</span>${esc(o.note)}
               </div>`
            : '';

        return this.card('info', 'Información del pedido', `<div class="divide-y divide-gray-200">${rows.join('')}</div>${note}${this.cancelBox(o)}`);
    }

    // -- Acciones del pie --

    /*  Todas las acciones del pedido en un solo lugar: el pie del modal, que
        antes solo tenía «Cerrar». Izquierda, lo que corrige o imprime. Derecha,
        junto a «Cerrar», el avance del pedido: elaborar, cobrar y entregar. */
    footActions(data) {
        const { main, side } = this.actions(data);

        if (!main.length && !side.length) return;

        const buttons = $('#modalOrderDetails .cs-modal-foot > div').last();

        if (side.length) buttons.before(`<div class="ord-detail-side">${side.join('')}</div>`);

        buttons.append(main.join(''));
    }

    /*  «Ya se elaboró» solo a Producción y al Dueño (data.producer, del
        calendario). Entregar si no hay saldo; con saldo, «Cobrar y entregar»
        encadena el cobro y la entrega (decision 5). */
    actions(data) {
        const o    = data.order;
        const id   = Number(o.id);
        const can  = data.can || {};
        const main = [];
        const side = [];

        // icon: nombre Lucide, o el <i> ya armado (el logo de WhatsApp es de fontello: Lucide no trae marcas).
        const btn = (cls, icon, text, click, title) => `
            <button type="button" class="${cls}"${title ? ` title="${title}"` : ''} onclick="${click}">
                ${icon.charAt(0) === '<' ? icon : `<i data-lucide="${icon}" class="w-4 h-4"></i>`}${text}
            </button>`;

        // En el orden en que avanza el pedido: lo último que se hace queda en la orilla derecha.
        if (data.producer && this.producible(o)) {
            const on = !!o.produced_at;

            main.push(btn(`ord-produce${on ? ' is-on' : ''}`, on ? 'rotate-ccw' : 'chef-hat', on ? 'Quitar elaborado' : 'Ya se elaboró', `orderDetail.produce(${id}, ${on ? 0 : 1})`));
        }

        // Sin dinero (Producción) no hay Cobrar, como antes en Resumen de pago.
        if (!this.limited && can.pay) main.push(btn('ord-pay-open', 'banknote', 'Cobrar', `orderPay.open(${id}, true)`));

        if (can.deliver)     main.push(btn('ord-deliver', 'package-check', 'Entregar', `orderDetail.deliver(${id}, { fromDetail: true })`));
        else if (can.settle) main.push(btn('ord-deliver', 'hand-coins', 'Cobrar y entregar', `orderPay.open(${id}, true, { deliver: true })`));

        if (this.editable && can.edit) side.push(btn('ord-act', 'pencil-line', 'Editar pedido', `orderDetail.editOrder(${id})`));
        else if (this.editable && can.edit_paid) side.push(btn('ord-act', 'lock', 'Editar pedido', `orderDetail.editPaid(${id}, { fromDetail: true })`, 'Pedido pagado: pide tu contraseña y solo cambia los datos de entrega'));

        // Como alpha (Eliminar descuento): el total vuelve al subtotal.
        if (!this.limited && can.remove_discount) side.push(btn('ord-act', 'percent', 'Quitar descuento', `orderDetail.removeDiscount(${id}, { fromDetail: true })`));

        // Sale aunque la captura no (calendario).
        if (can.delivery) {
            side.push(btn('ord-edit-delivery', can.delivery_key ? 'lock' : 'pencil', 'Editar entrega', `orderDetail.editDelivery(${id}, { fromDetail: true })`,
                can.delivery_key ? 'Editar datos de entrega (pide tu contraseña)' : 'Editar datos de entrega'));
        }

        if (can.undeliver) side.push(btn('ord-undeliver', 'undo-2', 'Deshacer entrega', `orderDetail.undeliver(${id}, { fromDetail: true })`));

        if ((data.actions || []).includes('print')) side.push(btn('ord-act', 'printer', 'Imprimir', 'orderDetail.printData(orderDetail.last)'));

        // El «Reenviar» de alpha: el aviso del pedido otra vez a WhatsApp › Avisos (Dueño o Supervisor).
        if (can.notify) side.push(btn('ord-act ord-wa', '<i class="icon-whatsapp ord-wa-ico" aria-hidden="true"></i>', 'Enviar por WhatsApp', `orderDetail.resendNotice(${id})`, 'Enviar otra vez el aviso del pedido a los destinatarios de WhatsApp'));

        return { main, side };
    }

    /*  Manda otra vez el aviso del pedido, con sus datos de hoy, a los
        destinatarios de WhatsApp › Avisos. Siempre por ctrl-pedidos: el detalle
        también se abre desde el calendario. Cada envío tarda: el botón se apaga. */
    async resendNotice(id) {
        const sure = await alert({
            icon:     'question',
            title:    '¿Enviar el aviso por WhatsApp?',
            text:     'Sale otra vez el aviso del pedido, con sus datos de hoy, a los destinatarios de WhatsApp › Avisos.',
            btn1Text: 'Enviar',
            btn2Text: 'Cancelar'
        });

        if (!sure || !sure.isConfirmed) return;

        const button = $('#modalOrderDetails button.ord-wa');
        const label  = button.html();

        button.prop('disabled', true).html('<i data-lucide="loader-circle" class="w-4 h-4 animate-spin"></i>Enviando…');

        if (window.lucide) lucide.createIcons();

        const data = await useFetch({ url: 'ctrl/ctrl-pedidos.php', data: { opc: 'resendOrderNotice', id: id } });

        button.prop('disabled', false).html(label);

        if (window.lucide) lucide.createIcons();

        const sent = data && data.status == 200 && data.sent && (Number(data.sent.sent) + Number(data.sent.simulated)) > 0;

        alert({
            icon:     sent ? 'success' : 'warning',
            title:    sent ? 'Aviso enviado' : 'No se envió',
            text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
            btn1:     true,
            btn1Text: 'Entendido'
        });
    }

    // «Editar pedido»: cierra el detalle y abre la captura.
    editOrder(id) {
        $('#modalOrderDetails .cs-modal-x').trigger('click');
        orderForm.edit(id);
    }

    // Pendiente o pagado y sin entregar: lo unico que Produccion palomea.
    producible(o) {
        return [2, 3].includes(Number(o.sale_status_id)) && Number(o.delivery_status) !== 1;
    }

    // Motivo, quien y cuando. Solo en cancelados.
    cancelBox(o) {
        if (Number(o.sale_status_id) !== 4) return '';

        const who  = o.cancelled_by ? esc(o.cancelled_by) : 'Sin registro';
        const when = o.cancelled_at ? ordDate(o.cancelled_at, true) : 'sin fecha';

        return `
            <div class="mt-[12px] p-[12px] rounded-lg bg-red-50 border-[1px] border-red-200 text-[12.5px]">
                <div class="flex items-center gap-1.5 font-semibold text-red-700"><i data-lucide="circle-x" class="w-4 h-4"></i>Pedido cancelado</div>
                <p class="text-red-800 mt-1 mb-0">${o.cancel_reason ? esc(o.cancel_reason) : 'Sin motivo registrado.'}</p>
                <p class="text-red-500 text-[11.5px] mt-1 mb-0">${who} · ${when}</p>
            </div>`;
    }

    // -- Resumen de pago --

    infoSales(data) {
        const o        = data.order;
        const total    = Number(o.total || 0);
        const paid     = Number(o.paid || 0);
        const discount = Number(o.discount_amount || 0);
        const balance  = Math.round((total - paid) * 100) / 100;
        const pct      = total > 0 ? Math.min(100, Math.round(paid / total * 100)) : (paid > 0 ? 100 : 0);
        const payments = data.payments || [];

        const line = (label, value, cls) => `
            <div class="flex items-center justify-between text-[13px] py-1">
                <span class="text-gray-500">${label}</span><span class="${cls || 'text-gray-800'}">${value}</span>
            </div>`;

        let discountHtml = '';

        if (discount > 0) {
            const why = [o.discount_percent > 0 ? `${Number(o.discount_percent)}%` : '', o.discount_reason, o.discount_note]
                .filter(Boolean).map(esc).join(' · ');

            discountHtml = line('Descuento', `−${money(discount)}`, 'font-semibold text-amber-600')
                         + (why ? `<p class="text-[11.5px] text-amber-600 text-right -mt-0.5 mb-1">${why}</p>` : '');
        }

        // "Faltan", "Liquidado" o "A favor".
        const rest = balance > 0 ? `Faltan ${money(balance)}`
                   : balance < 0 ? `A favor ${money(Math.abs(balance))}`
                   : 'Liquidado';

        const balanceHtml = balance > 0
            ? line('Saldo', money(balance), 'text-base font-bold text-red-600')
            : balance < 0
                ? line('Saldo a favor', money(Math.abs(balance)), 'text-base font-bold text-sky-700')
                : line('Saldo', '$0.00', 'text-base font-bold text-gray-400');

        // Sin importe ni abonos la barra diria "Pagado: 0%" y "Liquidado" a la vez.
        const progressHtml = (total <= 0 && paid <= 0)
            ? '<p class="text-[11.5px] text-gray-400 mt-1 mb-[12px]">Sin importe por cobrar.</p>'
            : `<div class="mt-2 mb-[12px]">
                <div class="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div class="h-full rounded-full bg-emerald-500" style="width:${pct}%"></div>
                </div>
                <div class="flex justify-between text-[11.5px] mt-1">
                    <span class="text-emerald-700 font-semibold">Pagado: ${pct}%</span>
                    <span class="${balance > 0 ? 'text-red-600' : balance < 0 ? 'text-sky-700' : 'text-gray-400'} font-semibold">${rest}</span>
                </div>
            </div>`;

        const body = `
            ${line('Subtotal', money(o.subtotal))}
            ${discountHtml}
            ${line('Total', money(total), 'text-base font-bold text-gray-900')}

            ${progressHtml}

            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Abonos (${payments.length})</p>
            ${payments.length
                ? `<div class="border-l-2 border-gray-200 pl-[12px] flex flex-col gap-2">${payments.map((p) => this.paymentRow(p, o.id, data.can && data.can.delete_payment, data.can && data.can.payment_method)).join('')}</div>`
                : '<p class="text-[12.5px] text-gray-400 mb-0">Sin abonos registrados.</p>'}

            <div class="border-t-[1px] border-gray-200 mt-[12px] pt-2">
                ${line('Abonado', money(paid), 'font-semibold text-emerald-700')}
                ${balanceHtml}
            </div>`;

        // «Cobrar» vive en el pie del modal (footActions).
        return this.card('wallet', 'Resumen de pago', body);
    }

    paymentIcon(p) {
        const key = `${p.method_code || ''} ${p.method || ''}`;

        if (/cash|efect/i.test(key))          return ['banknote', 'text-emerald-600'];
        if (/card|tarj|cr[eé]d|d[eé]b/i.test(key)) return ['credit-card', 'text-sky-600'];
        if (/transf|spei/i.test(key))         return ['arrow-right-left', 'text-violet-600'];

        return ['wallet', 'text-gray-500'];
    }

    // canMethod: Dueño o Supervisor cambian la forma de un pago mientras su turno siga abierto (como alpha).
    paymentRow(p, orderId, canDelete, canMethod) {
        const [icon, tone] = this.paymentIcon(p);

        const change = Number(p.change_amount) > 0
            ? `<div class="text-[11.5px] text-gray-400">Recibió ${money(p.tendered_amount)} · cambio ${money(p.change_amount)}</div>`
            : '';

        const who = p.received_by && String(p.received_by).trim()
            ? `<div class="text-[11.5px] text-gray-400">Cobró ${esc(p.received_by)}</div>`
            : '';

        const remove = canDelete
            ? `<button type="button" class="ord-pay-del" aria-label="Quitar este pago" onclick="orderPay.removePayment(${Number(orderId)}, ${Number(p.id)})">
                   <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
               </button>`
            : '';

        const method = canMethod && p.turn_status !== 'closed'
            ? `<button type="button" class="ord-pay-edit" aria-label="Cambiar la forma de pago" title="Cambiar la forma de pago" onclick="orderPay.changeMethod(${Number(orderId)}, ${Number(p.id)})">
                   <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
               </button>`
            : '';

        return `
            <div class="flex items-start gap-2 text-[12.5px]">
                <i data-lucide="${icon}" class="w-4 h-4 ${tone} shrink-0 mt-0.5"></i>
                <div class="min-w-0">
                    <div class="font-semibold text-gray-700">${esc(p.method || 'Sin método')}</div>
                    <div class="text-[11.5px] text-gray-400">${ordDate(p.paid_at, true)}${p.description ? ' · ' + esc(p.description) : ''}</div>
                    ${change}${who}
                </div>
                <span class="ml-auto font-semibold text-gray-800 whitespace-nowrap">${money(p.amount)}</span>
                ${method}${remove}
            </div>`;
    }

    // -- Bitacora --

    historyIcon(type, title = '') {
        if (type === 'delivery' && /deshecha/i.test(title)) return ['undo-2', 'text-amber-600'];

        const icons = {
            delivery:     ['circle-check', 'text-emerald-600'],
            production:   ['chef-hat', 'text-violet-600'],
            event:        ['sparkles', 'text-amber-500'],
            payment:      ['banknote', 'text-emerald-600'],
            edition:      ['pencil', 'text-sky-600'],
            cancellation: ['circle-x', 'text-red-600'],
            deletion:     ['trash-2', 'text-red-600'],
            discount:     ['badge-percent', 'text-amber-600'],
            price:        ['trending-up', 'text-violet-600'],
            comment:      ['message-square', 'text-gray-500']
        };

        return icons[type] || ['circle-dot', 'text-gray-400'];
    }

    // Se ven 5; el resto con "Ver N más".
    historyCard(history) {
        const SHOWN = 5;

        if (!history.length) {
            return this.card('history', 'Bitácora', '<p class="text-[12.5px] text-gray-400 mb-0">Sin movimientos registrados.</p>');
        }

        const items = history.map((h, i) => {
            const title        = h.title || h.action || 'Movimiento';
            const [icon, tone] = this.historyIcon(h.type, title);

            return `
                <li class="flex items-start gap-2 text-[12.5px] ${i >= SHOWN ? 'hidden ord-hist-more' : ''}">
                    <i data-lucide="${icon}" class="w-4 h-4 ${tone} shrink-0 mt-0.5"></i>
                    <div class="min-w-0">
                        <div class="font-semibold text-gray-700">${esc(title)}</div>
                        ${h.detail ? `<div class="text-gray-500 break-words">${esc(h.detail)}</div>` : ''}
                        <div class="text-[11px] text-gray-400">${ordDate(h.created_at, true)} · ${h.user_name ? esc(h.user_name) : 'Sin registro'}</div>
                    </div>
                </li>`;
        }).join('');

        const more = history.length > SHOWN
            ? `<button type="button" class="ord-hist-toggle mt-2 text-[12px] font-semibold text-blue-700 hover:underline" `
            +   `onclick="orderDetail.toggleHistory(this)" data-more="${history.length - SHOWN}">Ver ${history.length - SHOWN} más</button>`
            : '';

        return this.card('history', 'Bitácora', `<ul class="flex flex-col gap-[10px] mb-0 pl-0 list-none">${items}</ul>${more}`,
            `<span class="text-[11.5px] text-gray-400">${history.length}</span>`);
    }

    toggleHistory(btn) {
        const list   = $(btn).siblings('ul');
        const hidden = list.find('.ord-hist-more.hidden').length > 0;

        list.find('.ord-hist-more').toggleClass('hidden', !hidden);
        $(btn).text(hidden ? 'Ver menos' : `Ver ${btn.dataset.more} más`);
    }

    // -- Productos --

    listProducts(lines) {
        if (!lines.length) {
            return `
                <div class="ord-panel-empty bg-gray-50 border-[1px] border-gray-200 rounded-xl p-[24px] h-full flex flex-col items-center justify-center text-center">
                    <i data-lucide="shopping-basket" class="w-10 h-10 text-gray-300 mb-2"></i>
                    <p class="font-semibold text-gray-700 mb-0">No hay productos</p>
                    <p class="text-[12.5px] text-gray-400 mb-0">Este pedido no contiene productos.</p>
                </div>`;
        }

        const items = lines.reduce((acc, l) => acc + Number(l.quantity || 1), 0);

        return `
            <div class="flex flex-col">
                <div class="ord-panel bg-gray-50 border-[1px] border-gray-200 rounded-xl px-[16px] py-[12px] mb-[12px] flex items-center justify-between">
                    <h4 class="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-0">
                        <i data-lucide="shopping-bag" class="w-4 h-4 text-blue-600"></i>Productos del pedido
                    </h4>
                    <span class="text-[12.5px] text-gray-500">${items} ${items === 1 ? 'producto' : 'productos'}</span>
                </div>
                <div class="flex flex-col gap-[12px]">
                    ${lines.map((l) => Number(l.is_custom) === 1 ? this.cardCustom(l) : this.cardNormal(l)).join('')}
                </div>
            </div>`;
    }

    // Importe de la linea: precio por cantidad menos su descuento.
    lineTotal(l) {
        return Number(l.price || 0) * Number(l.quantity || 1) - Number(l.discount_amount || 0);
    }

    lineDiscount(l) {
        const d = Number(l.discount_amount || 0);

        return d > 0 ? `<span class="block text-[11px] text-amber-600">Descuento −${money(d)}</span>` : '';
    }

    // El importe de la linea, con su descuento. Sin dinero (limited) no se pinta.
    lineAmount(l, tone, wrap) {
        if (this.limited) return '';

        return `
            <div${wrap ? ` class="${wrap}"` : ''}>
                <span class="block text-[11px] text-gray-400">Importe</span>
                <p class="text-lg font-bold ${tone} mb-0">${money(this.lineTotal(l))}</p>
                ${this.lineDiscount(l)}
            </div>`;
    }

    textBlock(label, text, big) {
        if (!text || !String(text).trim()) return '';

        return `
            <div>
                <p class="text-[11px] text-gray-400 mb-0">${label}</p>
                <p class="${big ? 'text-sm' : 'text-[12.5px]'} font-semibold text-gray-700 mb-0 break-words">${esc(text)}</p>
            </div>`;
    }

    cardNormal(l) {
        const name  = l.name || l.product_name || 'Producto sin nombre';
        const photo = l.image
            ? orderImg(l.image, 'w-full h-full object-cover', name)
            : '<div class="w-full h-full flex items-center justify-center text-[#B37BC4]"><i data-lucide="cake" class="w-1/3 h-1/3"></i></div>';

        return `
            <article class="ord-panel bg-[#fff] border-[1px] border-gray-200 rounded-xl p-[16px] flex items-start gap-[16px]">
                <div class="w-20 h-20 sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-[#F1E4F5] shrink-0">${photo}</div>

                <div class="flex-1 min-w-0 flex flex-col gap-2">
                    <div>
                        <h5 class="text-sm font-bold uppercase text-gray-800 mb-0">${esc(name)}</h5>
                        ${this.limited ? '' : `<p class="text-[12px] text-blue-700 mb-0">${money(l.price)} c/u</p>`}
                    </div>
                    ${this.textBlock('Dedicatoria', l.dedication)}
                    ${this.textBlock('Observaciones', l.details)}
                </div>

                <div class="self-stretch flex flex-col items-end justify-between gap-[12px] text-right shrink-0">
                    <span class="text-[12.5px] text-gray-500">Cantidad: <b class="text-gray-800">${Number(l.quantity || 1)}</b></span>
                    ${this.lineAmount(l, 'text-gray-900')}
                </div>
            </article>`;
    }

    cardCustom(l) {
        const name     = l.name || l.product_name || 'Pastel personalizado';
        const portions = Number(l.portion_qty || 0);

        return `
            <article class="ord-panel bg-[#fff] border-[1px] border-gray-200 rounded-xl p-[16px]">
                <div class="flex items-center justify-between gap-[12px] mb-[12px]">
                    <div class="flex items-center gap-2 min-w-0">
                        <h5 class="text-sm font-bold uppercase text-gray-800 truncate mb-0">${esc(name)}</h5>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-violet-100 text-violet-700 shrink-0">Personalizado</span>
                    </div>
                    <span class="text-[12.5px] text-gray-500 shrink-0">Cantidad: <b class="text-gray-800">${Number(l.quantity || 1)}</b></span>
                </div>

                <div class="flex flex-col sm:flex-row gap-[16px]">
                    <div class="sm:w-[190px] shrink-0">${this.customGallery(l)}</div>

                    <div class="flex-1 min-w-0 flex flex-col gap-[12px]">
                        ${portions > 0 ? this.textBlock('Porción', `${portions} ${portions === 1 ? 'persona' : 'personas'}`, true) : ''}
                        ${this.textBlock('Dedicatoria', l.dedication, true)}
                        ${this.textBlock('Observaciones', l.details, true)}
                    </div>
                </div>

                ${(l.modifiers || []).length ? `
                <div class="border-t-[1px] border-gray-200 mt-[16px] pt-[16px]">
                    <h6 class="text-[11px] font-bold uppercase tracking-wide text-violet-700 mb-2">Personalización</h6>
                    ${this.personalizationGrid(l.modifiers)}
                </div>` : ''}

                ${this.lineAmount(l, 'text-emerald-700', 'text-right mt-[12px]')}
            </article>`;
    }

    // Grupos en rejilla de dos; el precio dice "Incluida" si no suma. Sin dinero (limited), solo la cantidad.
    personalizationGrid(modifiers) {
        const groups = {};

        modifiers.forEach((m) => {
            const key = m.group_name || 'Otros';
            (groups[key] = groups[key] || []).push(m);
        });

        return `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                ${Object.keys(groups).map((g) => `
                    <div class="ord-well rounded-lg bg-gray-50 border-[1px] border-gray-200 p-[10px]">
                        <p class="text-[11px] font-semibold uppercase text-gray-400 mb-1">${esc(g)}</p>
                        ${groups[g].map((m) => {
                            const qty   = Number(m.quantity || 1);
                            const price = Number(m.price || 0);
                            const cost  = this.limited ? (qty > 1 ? `× ${qty}` : '') : (price > 0 ? `${qty} × +${money(price)}` : 'Incluida');
                            const bold  = this.limited ? qty > 1 : price > 0;

                            return `
                                <div class="flex items-start justify-between gap-2 text-[12.5px] py-0.5">
                                    <span class="text-gray-700 min-w-0">${esc(m.name)}${m.details ? `<span class="block text-[11px] text-gray-400">${esc(m.details)}</span>` : ''}</span>
                                    <span class="whitespace-nowrap ${bold ? 'text-gray-800 font-semibold' : 'text-gray-400'}">${cost}</span>
                                </div>`;
                        }).join('')}
                    </div>`).join('')}
            </div>`;
    }

    // -- Galeria del personalizado --
    /*  La grande con su contador y lupa; miniaturas debajo con flechas si no
        caben. Clic en una miniatura la pasa a la grande; clic en la grande la
        amplia. Las fotos de cada linea quedan en this.galleries[id]. */
    customGallery(l) {
        const images = Array.isArray(l.images) ? l.images : [];
        const id     = Number(l.id);

        if (!images.length) {
            return `
                <div class="w-40 h-40 rounded-lg bg-[#F1E4F5] flex flex-col items-center justify-center text-center text-[#B37BC4] mx-auto sm:mx-0">
                    <i data-lucide="image-off" class="w-8 h-8 mb-1"></i>
                    <span class="text-[11px] font-semibold">Sin fotos de referencia</span>
                </div>`;
        }

        this.galleries[id] = { images: images, index: 0 };

        const thumbs = images.map((img, i) => `
            <button type="button" class="ord-thumb w-12 h-12 rounded-md overflow-hidden shrink-0 bg-[#F1E4F5] ${i === 0 ? 'ring-2 ring-blue-600' : 'ring-1 ring-gray-200'}"
                    data-line="${id}" data-index="${i}" aria-label="Foto ${i + 1}">
                ${orderImg(img.path, 'w-full h-full object-cover', img.name)}
            </button>`).join('');

        const arrows = images.length > 3;

        return `
            <div class="flex flex-col items-center sm:items-start gap-2" data-gallery="${id}">
                <button type="button" class="ord-gal-main relative w-40 h-40 rounded-lg overflow-hidden bg-[#F1E4F5] group" data-line="${id}" aria-label="Ampliar foto">
                    ${orderImg(images[0].path, 'w-full h-full object-cover', images[0].name)}
                    <span class="ord-gal-count absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10.5px] font-semibold">1 / ${images.length}</span>
                    <span class="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center opacity-80 group-hover:opacity-100">
                        <i data-lucide="zoom-in" class="w-4 h-4"></i>
                    </span>
                </button>

                ${images.length > 1 ? `
                <div class="flex items-center gap-1 w-40">
                    ${arrows ? `<button type="button" class="ord-gal-prev w-5 h-12 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30" data-line="${id}" aria-label="Anteriores" disabled><i data-lucide="chevron-left" class="w-4 h-4"></i></button>` : ''}
                    <div class="ord-thumbs flex gap-1.5 overflow-x-auto p-0.5 flex-1" data-line="${id}">${thumbs}</div>
                    ${arrows ? `<button type="button" class="ord-gal-next w-5 h-12 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30" data-line="${id}" aria-label="Siguientes"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>` : ''}
                </div>` : ''}

                <p class="text-[11px] text-gray-400 mb-0">${images.length} ${images.length === 1 ? 'foto' : 'fotos'} de referencia · clic para ampliar</p>
            </div>`;
    }

    bindGalleries() {
        const modal = $('#modalOrderDetails');

        modal.on('click', '.ord-thumb', (e) => {
            const b = e.currentTarget;
            this.selectImage(Number(b.dataset.line), Number(b.dataset.index));
        });

        modal.on('click', '.ord-gal-main', (e) => {
            const line = Number(e.currentTarget.dataset.line);
            const g    = this.galleries[line];

            if (g) this.preview(line, g.index);
        });

        modal.on('click', '.ord-gal-prev, .ord-gal-next', (e) => {
            const b = e.currentTarget;
            this.scrollThumbs(Number(b.dataset.line), b.classList.contains('ord-gal-next') ? 1 : -1);
        });

        modal.find('.ord-thumbs').each((i, el) => {
            el.addEventListener('scroll', () => this.updateChevrons(Number(el.dataset.line)), { passive: true });
            this.updateChevrons(Number(el.dataset.line));
        });
    }

    selectImage(line, index) {
        const g = this.galleries[line];
        if (!g || !g.images[index]) return;

        g.index = index;

        const box  = $(`#modalOrderDetails [data-gallery="${line}"]`);
        const main = box.find('.ord-gal-main');
        const img  = g.images[index];

        main.find('img, div:not([class*="absolute"])').first().replaceWith(orderImg(img.path, 'w-full h-full object-cover', img.name));
        main.find('.ord-gal-count').text(`${index + 1} / ${g.images.length}`);

        box.find('.ord-thumb').each((i, el) => {
            const on = i === index;
            el.classList.toggle('ring-2', on);
            el.classList.toggle('ring-blue-600', on);
            el.classList.toggle('ring-1', !on);
            el.classList.toggle('ring-gray-200', !on);
        });

        const thumb = box.find('.ord-thumb').get(index);
        if (thumb) thumb.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    scrollThumbs(line, dir) {
        const strip = $(`#modalOrderDetails .ord-thumbs[data-line="${line}"]`).get(0);
        if (strip) strip.scrollBy({ left: dir * 108, behavior: 'smooth' });
    }

    updateChevrons(line) {
        const strip = $(`#modalOrderDetails .ord-thumbs[data-line="${line}"]`).get(0);
        if (!strip) return;

        const box = $(strip).parent();

        box.find('.ord-gal-prev').prop('disabled', strip.scrollLeft <= 2);
        box.find('.ord-gal-next').prop('disabled', strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2);
    }

    // -- Vista previa --
    /*  Va por encima del csModal (z-[100001]). Escape la cierra a ella sola: el
        escucha va en captura sobre window y corta el evento antes de que llegue
        al keydown.csModal del document, que cerraria todo el detalle. */
    preview(line, index) {
        const g = this.galleries[line];
        if (!g || !g.images.length) return;

        $('#ordPreview').remove();

        let i = index;
        const total = g.images.length;

        const layer = $(`
            <div id="ordPreview" class="fixed inset-0 z-[100001] bg-black/80 flex items-center justify-center p-[16px]" role="dialog" aria-label="Foto de referencia">
                <button type="button" class="ord-pv-close absolute top-4 right-4 w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center" aria-label="Cerrar">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
                ${total > 1 ? `
                <button type="button" class="ord-pv-prev absolute left-4 w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center" aria-label="Anterior"><i data-lucide="chevron-left" class="w-6 h-6"></i></button>
                <button type="button" class="ord-pv-next absolute right-4 w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center" aria-label="Siguiente"><i data-lucide="chevron-right" class="w-6 h-6"></i></button>` : ''}
                <figure class="flex flex-col items-center gap-2 max-w-[90vw] mb-0">
                    <div class="ord-pv-img max-w-[90vw] max-h-[80vh] flex items-center justify-center"></div>
                    <figcaption class="ord-pv-cap text-white/80 text-[13px]"></figcaption>
                </figure>
            </div>`);

        const paint = () => {
            const img = g.images[i];

            layer.find('.ord-pv-img').html(orderImg(img.path, 'max-w-[90vw] max-h-[80vh] object-contain rounded-lg', img.name));
            layer.find('.ord-pv-cap').text(`${img.name || 'Foto'} · ${i + 1} / ${total}`);
        };

        const step = (dir) => {
            i = (i + dir + total) % total;
            paint();
        };

        const close = () => {
            window.removeEventListener('keydown', keys, true);
            layer.remove();
            this.selectImage(line, i);
        };

        const keys = (e) => {
            if (!['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

            e.preventDefault();
            e.stopPropagation();

            if (e.key === 'Escape')     close();
            if (e.key === 'ArrowLeft')  step(-1);
            if (e.key === 'ArrowRight') step(1);
        };

        layer.on('click', '.ord-pv-close', close);
        layer.on('click', '.ord-pv-prev', () => step(-1));
        layer.on('click', '.ord-pv-next', () => step(1));
        layer.on('click', (e) => { if (e.target === e.currentTarget) close(); });

        window.addEventListener('keydown', keys, true);

        $('body').append(layer);
        paint();

        if (window.lucide) lucide.createIcons();
    }

    // -- Entrega y elaboracion --

    /*  Entregar pide la contraseña de quien opera: esta ventana es la
        confirmacion (badge o menu de la tabla, detalle o al terminar «Cobrar y
        entregar»). Es createCoffeeModalForm, el modal compacto de Huubie
        (coffee-modal-form.js). Si vino del detalle, lo cierra antes y lo vuelve
        a abrir al terminar o al volver (onCancel). */
    deliver(id, opts = {}) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        if (this.delivering) return;

        const fromDetail = !!opts.fromDetail;
        const back       = () => (fromDetail ? this.show(id) : null);

        if (fromDetail) $('#modalOrderDetails .cs-modal-x').trigger('click');

        // Sin required: saveDeliver dice qué falta bajo el campo (#modalOrderDeliver-help).
        this.createCoffeeModalForm({
            id:          'modalOrderDeliver',
            title:       'Entregar pedido',
            iconSvg:     '<i data-lucide="package-check" class="w-5 h-5"></i>',
            iconBg:      'bg-emerald-600',
            confirmText: 'Entregar',
            cancelText:  'Volver',
            footerNote:  'Queda como entregado y ya no se edita.',
            json: [
                { opc: 'display', id: 'folio', lbl: 'Pedido', icon: '<i data-lucide="receipt" class="w-4 h-4"></i>', value: `#P${id}` },
                { opc: 'text', type: 'password', id: 'key', lbl: 'Tu contraseña', autofocus: true },
                { opc: 'html', html: '<p id="modalOrderDeliver-help" class="text-[11px] text-gray-400 mb-0">La misma con la que entras a Huubie.</p>' }
            ],
            onConfirm: (values, modal) => { this.saveDeliver(id, values, modal, back); },
            onCancel:  back
        });

        // one-time-code: el navegador no la rellena sola (si no, la clave no pediria nada).
        $('#modalOrderDeliver-key')
            .attr({ autocomplete: 'one-time-code', spellcheck: 'false' })
            .on('keydown', (e) => {
                if (e.key !== 'Enter') return;

                e.preventDefault();
                $('#modalOrderDeliver .cf-confirm').trigger('click');
            });
    }

    // El ctrl revisa la contraseña. Si falla (data.key) la ventana sigue abierta y lo dice bajo el campo.
    async saveDeliver(id, values, modal, back) {
        if (this.delivering) return;

        const field = $('#modalOrderDeliver-key');
        const key   = String(values.key || '');
        const wrong = (text) => {
            $('#modalOrderDeliver-help').removeClass('text-gray-400').addClass('text-red-600 font-semibold').text(text);
            field.val('').trigger('focus');
        };

        if (!key) return wrong('Escribe tu contraseña para entregar.');

        this.delivering = true;

        const button = $('#modalOrderDeliver .cf-confirm').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'deliverOrder', id: id, key: key } });

        this.delivering = false;
        button.prop('disabled', false);

        if (!data)    return wrong('No hubo respuesta. Revisa la conexión y vuelve a intentar.');
        if (data.key) return wrong(data.message || 'Contraseña incorrecta.');

        // modal.close() no dispara onCancel: el detalle se reabre abajo, con back().
        modal.close();

        if (data.status != 200) {
            const soft = [403, 404, 409].includes(Number(data.status));

            await alert({ icon: soft ? 'info' : 'error', title: 'No se entregó', text: data.message || 'Vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

            return back();
        }

        orders.lsOrders();
        orderTurn.touch();
        alert({ icon: 'success', title: data.message });

        back();
    }

    // Regresa el pedido a «sin entregar». Lo hace quien entrega (como alpha); pide motivo, no contraseña.
    undeliver(id, opts = {}) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        if (this.undelivering) return;

        const fromDetail = !!opts.fromDetail;
        const back       = () => (fromDetail ? this.show(id) : null);

        if (fromDetail) $('#modalOrderDetails .cs-modal-x').trigger('click');

        this.csModal({
            id:         'modalOrderUndeliver',
            title:      'Deshacer entrega',
            subtitle:   `Pedido #P${id}`,
            lucideIcon: 'undo-2',
            width:      'max-w-lg',
            saveText:   'Deshacer entrega',
            cancelText: 'Volver',
            info:       'El pedido vuelve a «sin entregar». El motivo queda en la bitácora.',
            json: [
                { id: 'ud_reason', lbl: 'Motivo', tipo: 'textarea', required: true, maxlength: 200, rows: 3, ph: 'Ej. Se marcó entregado por error', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveUndeliver(id, values, close, back)
        });

        orderPay.onDismiss('modalOrderUndeliver', back);

        $('#ud_reason').trigger('focus');
    }

    async saveUndeliver(id, values, close, back) {
        if (this.undelivering) return;

        const reason = String(values.ud_reason || '').trim();

        if (!reason) {
            alert({ icon: 'warning', title: 'Falta el motivo', text: 'Escribe por qué se deshace la entrega.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        this.undelivering = true;

        const button = $('#modalOrderUndeliver .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'undeliverOrder', id: id, reason: reason } });

        this.undelivering = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) {
            alert({
                icon:     data && [403, 404, 409].includes(Number(data.status)) ? 'info' : 'error',
                title:    'No se deshizo la entrega',
                text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        orderPay.closeQuiet('modalOrderUndeliver', close);

        orders.lsOrders();
        alert({ icon: 'success', title: data.message, timer: 1800 });

        back();
    }

    // Palomeo desde el detalle (Pedidos o calendario). Lo mismo que la casilla de la tarjeta: siempre por ctrl-calendario.
    async produce(id, want) {
        const data = await useFetch({ url: 'ctrl/ctrl-calendario.php', data: { opc: 'toggleProduced', id: id, produced: want ? 1 : 0 } });

        if (!data || data.status != 200) {
            alert({ icon: 'info', title: 'No se cambió la marca', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        // show() reemplaza el modal abierto con el pedido ya marcado.
        orders.lsOrders();
        this.show(id);
    }

    // -- Datos de entrega --

    // «Editar» un pedido pagado (como alpha): la ventana de la entrega, con contraseña y el turno de hoy abierto.
    editPaid(id, opts = {}) {
        return this.editDelivery(id, Object.assign({}, opts, { paid: true }));
    }

    /*  «Editar entrega» (como alpha): solo fecha, hora, tipo de entrega,
        direccion y nota; productos y pagos no se tocan. Pide el pedido de
        nuevo para saber si todavia se puede. En un pagado la contraseña va en
        la misma ventana. Si vino del detalle, lo vuelve a abrir al terminar.
        opts.paid: es el «Editar» de un pagado (editPaid). */
    async editDelivery(id, opts = {}) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        if (this.savingDelivery) return;

        const data = await this.fetchOrder(id);
        if (!data) return;

        const o    = data.order;
        const can  = data.can || {};
        const paid = !!opts.paid;

        if (paid ? !can.edit_paid : !can.delivery) {
            alert({
                icon:     'info',
                title:    paid ? 'No se puede editar' : 'No se puede editar la entrega',
                text:     (paid ? can.edit_paid_reason : can.delivery_reason) || 'Este pedido ya no se edita.',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        // Como alpha (requireOpenShift): editar un pagado pide primero el turno de hoy. El ctrl lo vuelve a revisar al guardar.
        if (paid && data.edit_turn) {
            const lock = data.edit_turn;

            if (Number(lock.status) === 423) return orderTurn.locked(lock, () => this.editPaid(id, opts));

            alert({ icon: 'warning', title: lock.title || 'Sin turno abierto', text: lock.message || '', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        // Hoy en la hora de la PC (toISOString daria la fecha en UTC).
        const now   = new Date();
        const pad   = (n) => String(n).padStart(2, '0');
        const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

        const fromDetail = !!opts.fromDetail;
        const back       = () => (fromDetail ? this.show(id) : null);
        const date       = String(o.delivery_date || '').slice(0, 10);
        const ctx        = { date: date, today: today, keyed: paid || !!can.delivery_key, paid: paid };

        if (fromDetail) $('#modalOrderDetails .cs-modal-x').trigger('click');

        const json = [];

        if (ctx.keyed) {
            json.push({
                id: 'ed_paid', tipo: 'html', class: 'w-full',
                html: `<div class="flex items-start gap-2 p-[10px] rounded-lg bg-amber-50 border-[1px] border-amber-200 text-[12.5px] text-amber-800">
                           <i data-lucide="lock" class="w-4 h-4 shrink-0 mt-0.5"></i>
                           <span>Pedido pagado: guardar pide tu contraseña.</span>
                       </div>`
            });
        }

        json.push(
            { id: 'ed_date', lbl: 'Fecha de entrega', tipo: 'date', required: true, value: date, min: date && date < today ? date : today },
            { id: 'ed_time', lbl: 'Hora de entrega', tipo: 'text', required: true, value: String(o.delivery_time || '').slice(0, 5) },
            {
                id: 'ed_method', lbl: 'Tipo de entrega', tipo: 'select', empty: false, class: 'w-full', value: Number(o.delivery_method) === 1 ? 1 : 0,
                data: [{ id: 0, valor: 'Recoge en tienda' }, { id: 1, valor: 'Envío a domicilio' }]
            },
            { id: 'ed_location', lbl: 'Dirección de envío', tipo: 'text', required: false, maxlength: 255, class: 'w-full', icon: 'map-pin', value: o.location || '', ph: 'Calle, número y colonia' },
            { id: 'ed_note', lbl: 'Nota', tipo: 'textarea', maxlength: 2000, rows: 3, class: 'w-full', value: o.note || '', ph: 'Ej. Entregar en recepción' }
        );

        if (ctx.keyed) json.push({ id: 'ed_key', lbl: 'Tu contraseña', tipo: 'text', required: true, class: 'w-full', help: 'La misma con la que entras a Huubie.' });

        this.csModal({
            id:         'modalOrderDelivery',
            title:      paid ? 'Editar pedido pagado' : 'Editar datos de entrega',
            subtitle:   `Pedido #P${o.folio || o.id} · ${o.customer || 'Sin cliente'}`,
            lucideIcon: 'calendar-clock',
            width:      'max-w-lg',
            saveText:   'Guardar',
            cancelText: 'Volver',
            info:       'Productos y pagos no cambian.',
            json:       json,
            onSave:     (values, close) => this.saveDelivery(id, ctx, close, back)
        });

        orderPay.onDismiss('modalOrderDelivery', back);

        // csModal no tiene campo de hora ni de contraseña: se pintan de texto y aqui se cambian.
        $('#ed_time').attr('type', 'time');

        // La direccion solo va con envio.
        const place = () => $('#ed_location').closest('.px-2').toggleClass('hidden', $('#ed_method').val() !== '1');

        $('#ed_method').on('change', () => {
            place();
            if ($('#ed_method').val() === '1') $('#ed_location').trigger('focus');
        });

        place();

        // one-time-code: el navegador no la rellena sola.
        $('#ed_key')
            .attr({ type: 'password', autocomplete: 'one-time-code', spellcheck: 'false' })
            .on('keydown', (e) => {
                if (e.key !== 'Enter') return;

                e.preventDefault();
                $('#modalOrderDelivery .cs-modal-save').trigger('click');
            });
    }

    /*  Lo que falta se avisa sin cerrar la ventana (no se pierde lo escrito).
        Contraseña mal (data.key): el aviso va bajo el campo. Al guardar, lista
        cada cambio: antes y despues. */
    async saveDelivery(id, ctx, close, back) {
        if (this.savingDelivery) return;

        const date     = String($('#ed_date').val() || '');
        const time     = String($('#ed_time').val() || '');
        const method   = $('#ed_method').val() === '1' ? 1 : 0;
        const location = String($('#ed_location').val() || '').trim();
        const note     = String($('#ed_note').val() || '').trim();
        const field    = $('#ed_key');
        const key      = ctx.keyed ? String(field.val() || '') : '';

        const warn  = (text) => alert({ icon: 'warning', title: 'Revisa la entrega', text: text, btn1: true, btn1Text: 'Entendido' });
        const wrong = (text) => {
            field.next('p').removeClass('text-gray-400').addClass('text-red-600 font-semibold').text(text);
            field.val('').trigger('focus');
        };

        if (!date)                                 return warn('Elige la fecha de entrega.');
        if (date !== ctx.date && date < ctx.today) return warn('La fecha de entrega no puede ser anterior a hoy.');
        if (!time)                                 return warn('Elige la hora de entrega.');
        if (ctx.keyed && !key)                   return wrong(ctx.paid ? 'Escribe tu contraseña para editar el pedido.' : 'Escribe tu contraseña para editar la entrega.');

        this.savingDelivery = true;

        // «Editar» un pagado vive solo en ctrl-pedidos: el detalle también se abre desde el calendario.
        const button = $('#modalOrderDelivery .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({
            url:  ctx.paid ? 'ctrl/ctrl-pedidos.php' : this._link,
            data: {
                opc:             ctx.paid ? 'editPaidOrder' : 'editOrderDelivery',
                id:              id,
                delivery_date:   date,
                delivery_time:   time,
                delivery_method: method,
                location:        method === 1 ? location : '',
                note:            note,
                key:             key
            }
        });

        this.savingDelivery = false;
        button.prop('disabled', false);

        if (!data)                       return warn('No hubo respuesta. Revisa la conexión y vuelve a intentar.');
        if (data.key && ctx.keyed)       return wrong(data.message || 'Contraseña incorrecta.');
        if (Number(data.status) === 422) return warn(data.message || 'Revisa los datos de entrega.');

        orderPay.closeQuiet('modalOrderDelivery', close);

        // Sin turno de hoy (editar un pagado): se ofrece abrirlo y se vuelve a la ventana.
        if (Number(data.status) === 423) return orderTurn.locked(data, () => this.editPaid(id));

        if (data.status != 200) {
            const soft = [403, 404, 409].includes(Number(data.status));

            await alert({ icon: soft ? 'info' : 'error', title: 'No se guardó la entrega', text: data.message || 'Vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

            return back();
        }

        if (!data.unchanged) orders.lsOrders();

        await alert({
            icon:     data.unchanged ? 'info' : 'success',
            title:    data.unchanged ? 'Sin cambios' : 'Pedido actualizado',
            html:     this.deliveryChangesHtml(data.changes || []),
            btn1:     true,
            btn1Text: 'Entendido'
        });

        back();
    }

    // Un renglon por cambio: campo, antes tachado y despues resaltado.
    deliveryChangesHtml(changes) {
        if (!changes.length) return '<p class="text-[14px] mb-0">No cambió ningún dato de entrega.</p>';

        const cut  = (t) => { const s = String(t == null ? '' : t); return s.length > 120 ? s.slice(0, 117) + '…' : s; };
        const rows = changes.map((c) => `
            <li class="py-1.5 break-words">
                <span class="block text-[11px] font-semibold uppercase tracking-wide opacity-60">${esc(c.field)}</span>
                <span class="line-through opacity-60">${esc(cut(c.before))}</span>
                <span class="mx-1 opacity-60">→</span>
                <span class="font-semibold">${esc(cut(c.after))}</span>
            </li>`).join('');

        const count = changes.length === 1 ? 'Se guardó 1 cambio' : `Se guardaron ${changes.length} cambios`;

        return `<p class="text-[13px] mb-1">${count}:</p><ul class="text-left text-[13px] mb-0 pl-0 list-none">${rows}</ul>`;
    }

    // -- Descuento --

    /*  «Quitar descuento» (alpha › deleteDiscount): cotización o pendiente; el
        total vuelve al subtotal. Pide el pedido de nuevo para saber si todavía
        se puede. Siempre por ctrl-cobro: el detalle también se abre desde el calendario. */
    async removeDiscount(id, opts = {}) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        const data = await this.fetchOrder(id);
        if (!data) return;

        const o   = data.order;
        const can = data.can || {};

        if (!can.remove_discount) {
            alert({ icon: 'info', title: 'No se puede quitar el descuento', text: can.remove_discount_reason || '', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        const sure = await alert({
            icon:     'question',
            title:    '¿Quitar el descuento?',
            text:     `P${o.folio || o.id}: se quita el descuento de ${money(o.discount_amount)} y el total vuelve a ${money(o.subtotal)}.`,
            btn1:     true,
            btn1Text: 'Quitar descuento',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!sure || !sure.isConfirmed) return;

        const res = await useFetch({ url: 'ctrl/ctrl-cobro.php', data: { opc: 'removeDiscount', id: id } });

        if (!res || res.status != 200) {
            alert({
                icon:     res && [403, 404, 409].includes(Number(res.status)) ? 'info' : 'error',
                title:    'No se quitó el descuento',
                text:     (res && res.message) || 'Revisa la conexión y vuelve a intentar.',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        orders.lsOrders();
        alert({ icon: 'success', title: res.message, timer: 1800 });

        if (opts.fromDetail) this.show(id);
    }

    // -- Impresion --

    async print(id) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        const data = await this.fetchOrder(id);
        if (data) this.printData(data);
    }

    printData(data) {
        if (!(data.actions || []).includes('print')) {
            alert({ icon: 'error', text: 'Tu rol no tiene permiso para imprimir pedidos en esta sucursal.', btn1: true });
            return;
        }

        ordPrintDoc(`Pedido P${data.order.folio || data.order.id}`, ORD_TICKET_CSS, this.ticketHtml(data));
    }

    /*  El ticket de pedido de alpha (ticketPasteleria): logo, «PEDIDOS DE
        PASTELERÍA», folio y entrega, cliente, PRODUCTOS con su detalle debajo y
        los totales a la derecha. Usa el CSS del ticket de venta (ORD_TICKET_CSS).
        limited = sin dinero: ni importes ni totales. */
    ticketHtml(data) {
        const o       = data.order;
        const limited = !!data.limited;
        const scope   = (typeof dataInit !== 'undefined' && dataInit && dataInit.scope) || {};
        const company = scope.company || '';
        const initial = esc(String(company || data.branch || 'H').charAt(0).toUpperCase());
        const amount  = (text) => `<span class="tk-amt">${text}</span>`;
        const status  = Number(o.sale_status_id);
        const ship    = Number(o.delivery_method) === 1;

        const logo = scope.logo
            ? `<div class="tk-logo is-img"><img src="${esc(scope.logo)}" alt="Logo" onerror="this.parentNode.className='tk-logo is-none'"><span>${initial}</span></div>`
            : `<div class="tk-logo is-none"><span>${initial}</span></div>`;

        const tag = status === 4 ? 'CANCELADO' : (status === 1 ? 'COTIZACIÓN' : '');

        // Como alpha: porción y opciones del personalizado, observaciones y dedicatoria van debajo del renglón.
        const lines = (data.lines || []).map((l) => {
            const custom = Number(l.is_custom) === 1;
            const notes  = [];

            if (custom && (l.modifiers || []).length) {
                notes.push(`<div class="tk-portion">Porción: ${Number(l.portion_qty) || 1}</div>`);
                (l.modifiers || []).forEach((m) => notes.push(`<div>-${esc(m.group_name)}: ${esc(m.name)} x ${Number(m.quantity) || 1}</div>`));
            }

            if (l.details)    notes.push(`<div>Obs.: ${esc(l.details)}</div>`);
            if (l.dedication) notes.push(`<div class="tk-amt">Dedicatoria: ${esc(l.dedication)}</div>`);

            return `
                <div class="tk-line">
                    <div class="tk-cols">
                        <div class="tk-c1">${Number(l.quantity || 1)}</div>
                        <div class="tk-c2 tk-name">${esc(l.name || l.product_name)}${custom ? ' (Personalizado)' : ''}</div>
                        <div class="tk-c3">${limited ? '' : money(this.lineTotal(l))}</div>
                    </div>
                    ${notes.length ? `<div class="tk-notes">${notes.join('')}</div>` : ''}
                </div>`;
        }).join('');

        return `
        <div class="tk tk-order">
            <div class="tk-head">
                ${logo}
                ${company ? `<div class="tk-company">${esc(company)}</div>` : ''}
                ${data.branch ? `<div class="tk-branch">${esc(data.branch)}</div>` : ''}
                <h1>PEDIDOS DE PASTELERÍA</h1>
                ${tag ? `<div class="tk-tag">${tag}</div>` : ''}
                ${status === 4 && o.cancel_reason ? `<div class="tk-reason">${esc(o.cancel_reason)}</div>` : ''}
            </div>
            <div class="tk-data">
                <div class="tk-row">
                    <div>
                        <div class="tk-label">FOLIO:</div>
                        <div class="tk-up">P${esc(o.folio || o.id)}</div>
                    </div>
                    <div>
                        <div class="tk-label">FECHA Y HORA DE ENTREGA:</div>
                        <div class="tk-up">${o.delivery_date ? `${ordDate(o.delivery_date)} ${ordHour(o.delivery_time)}` : 'SIN FECHA'}</div>
                    </div>
                </div>
                <div>
                    <div class="tk-label">NOMBRE:</div>
                    <div class="tk-up">${esc(o.customer || 'Sin cliente')}</div>
                    ${o.phone ? `<div class="tk-up">TEL: ${esc(o.phone)}</div>` : ''}
                </div>
                ${ship ? `
                <div>
                    <div class="tk-label">ENVÍO A DOMICILIO:</div>
                    <div>${esc(o.location || '')}</div>
                </div>` : ''}
                ${o.note ? `
                <div>
                    <div class="tk-label">NOTA:</div>
                    <div>${esc(o.note)}</div>
                </div>` : ''}
                ${o.created_at ? `<div class="tk-stamp">Creado: ${ordDate(o.created_at, true)}</div>` : ''}
                <hr>
            </div>
            <div class="tk-items">
                <div class="tk-items-title">PRODUCTOS</div>
                <div class="tk-cols is-head">
                    <div class="tk-c1">CANT.</div>
                    <div class="tk-c2">DESCRIPCIÓN</div>
                    <div class="tk-c3">${limited ? '' : 'IMPORTE'}</div>
                </div>
                ${lines || '<div class="tk-line">Sin productos</div>'}
            </div>
            ${limited ? '' : this.ticketTotals(data, amount)}
            <div class="tk-foot">
                <p>ESTE NO ES UN COMPROBANTE FISCAL</p>
                <p class="tk-brand">Huubie</p>
                <p>GRACIAS POR SU PREFERENCIA</p>
            </div>
        </div>`;
    }

    // Como alpha: sin pagos, solo TOTAL grande; con pagos, cada forma y RESTANTE grande.
    ticketTotals(data, amount) {
        const o        = data.order;
        const total    = Number(o.total || 0);
        const paid     = Number(o.paid || 0);
        const balance  = ordRound(total - paid);
        const discount = Number(o.discount_amount) > 0;
        const reason   = o.discount_reason ? ' · ' + esc(o.discount_reason) : '';
        const list     = data.payments || [];

        const payments = list.map((p) => {
            const change = Number(p.change_amount) > 0
                ? `<div class="tk-small">Recibió ${money(p.tendered_amount)} · cambio ${money(p.change_amount)}</div>`
                : '';

            return `<div>${esc(p.method || 'Pago')}: ${amount(money(p.amount))}</div>${change}`;
        }).join('');

        return `
            <hr class="tk-cut">
            <div class="tk-totals">
                ${discount ? `<div class="tk-base">Subtotal: ${amount(money(o.subtotal))}</div>` : ''}
                ${discount ? `<div>Descuento${reason}: ${amount('−' + money(o.discount_amount))}</div>` : ''}
                <div class="${list.length ? 'tk-base tk-bold' : 'tk-big'}">TOTAL: ${money(total)}</div>
                ${payments}
                ${list.length ? `<div class="tk-big tk-rest">${balance < 0 ? 'SALDO A FAVOR' : 'RESTANTE'}: ${money(Math.abs(balance))}</div>` : ''}
            </div>`;
    }
}
