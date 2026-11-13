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

// Hoja de ~80 mm en un iframe oculto: no abre ventana ni cambia de pagina.
function ordPrint(title, body) {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(title)}</title>
        <style>
            @page { margin: 4mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; width: 300px; margin: 0 auto; }
            h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
            h2 { font-size: 12px; margin: 0 0 4px; text-transform: uppercase; }
            .c { text-align: center; } .r { text-align: right; white-space: nowrap; vertical-align: top; }
            .s { font-size: 10.5px; color: #333; } .b td { font-weight: bold; }
            .d { display: block; } .x td { color: #666; }
            hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; } td { padding: 2px 0; vertical-align: top; }
        </style></head><body>${body}</body></html>`;

    $('#ordPrintFrame').remove();

    const frame = $('<iframe>', { id: 'ordPrintFrame', title: 'Impresión', 'aria-hidden': 'true' })
        .css({ position: 'fixed', right: 0, bottom: 0, width: 0, height: 0, border: 0, visibility: 'hidden' })
        .appendTo('body')
        .get(0);

    const doc = frame.contentWindow.document;

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
    }, 250);
}

// 'DD/MM/AAAA h:mm AM' de ahora.
function ordNow() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');

    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${ordHour(pad(now.getHours()) + ':' + pad(now.getMinutes()))}`;
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
        this.PROJECT_NAME = 'PedidoDetalle';
        this.galleries    = {};
        this.loading      = false;
        this.editable     = true;   // false en el calendario: la captura vive en Pedidos
        this.delivering   = false;
        this.limited      = false;  // true = el pedido llego sin dinero (Produccion)
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

        const data = await useFetch({ url: this._link, data: { opc: 'getOrder', id: id } });

        this.loading = false;

        if (!data || data.status != 200) {
            alert({ icon: 'error', text: (data && data.message) || 'No se pudo abrir el pedido.', btn1: true });
            return null;
        }

        this.limited = !!data.limited;

        return data;
    }

    async show(id) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        const data = await this.fetchOrder(id);
        if (!data) return;

        const o         = data.order;
        const canPrint  = (data.actions || []).includes('print');
        const folio     = o.folio || o.id;

        this.galleries = {};

        this.csModal({
            id: 'modalOrderDetails',
            title: `Pedido #P${folio}`,
            lucideIcon: 'cake',
            width: 'max-w-5xl',
            saveText: this.editable && data.can && data.can.edit ? 'Editar pedido' : false,
            cancelText: 'Cerrar',
            info: !this.editable || !data.can ? '' : !data.can.edit ? (data.can.edit_reason || '') : (data.can.money_reason || ''),
            onSave: (values, close) => { close(); orderForm.edit(id); },
            action: canPrint ? { text: 'Imprimir', lucideIcon: 'printer', onClick: () => this.printData(data) } : null,
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

        return this.card('info', 'Información del pedido', `<div class="divide-y divide-gray-200">${rows.join('')}</div>${note}${this.cancelBox(o)}`, this.orderActions(data));
    }

    /*  Botones del encabezado de Informacion. «Ya se elaboro» solo a Produccion
        (data.producer, del calendario). Entregar si no hay saldo; con saldo,
        «Cobrar y entregar» encadena el cobro y la entrega (decision 5). */
    orderActions(data) {
        const o   = data.order;
        const id  = Number(o.id);
        const can = data.can || {};
        const out = [];

        if (data.producer && this.producible(o)) {
            const on = !!o.produced_at;

            out.push(`<button type="button" class="ord-produce${on ? ' is-on' : ''}" onclick="orderDetail.produce(${id}, ${on ? 0 : 1})">
                          <i data-lucide="${on ? 'rotate-ccw' : 'chef-hat'}" class="w-4 h-4"></i>${on ? 'Quitar elaborado' : 'Ya se elaboró'}
                      </button>`);
        }

        if (can.deliver) {
            out.push(`<button type="button" class="ord-deliver" onclick="orderDetail.deliver(${id}, { fromDetail: true })">
                          <i data-lucide="package-check" class="w-4 h-4"></i>Entregar
                      </button>`);
        } else if (can.settle) {
            out.push(`<button type="button" class="ord-deliver" onclick="orderPay.open(${id}, true, { deliver: true })">
                          <i data-lucide="hand-coins" class="w-4 h-4"></i>Cobrar y entregar
                      </button>`);
        }

        if (can.undeliver) {
            out.push(`<button type="button" class="ord-undeliver" onclick="orderDetail.undeliver(${id}, { fromDetail: true })">
                          <i data-lucide="undo-2" class="w-4 h-4"></i>Deshacer entrega
                      </button>`);
        }

        return out.length ? `<div class="flex flex-wrap gap-[6px]">${out.join('')}</div>` : '';
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
                ? `<div class="border-l-2 border-gray-200 pl-[12px] flex flex-col gap-2">${payments.map((p) => this.paymentRow(p, o.id, data.can && data.can.delete_payment)).join('')}</div>`
                : '<p class="text-[12.5px] text-gray-400 mb-0">Sin abonos registrados.</p>'}

            <div class="border-t-[1px] border-gray-200 mt-[12px] pt-2">
                ${line('Abonado', money(paid), 'font-semibold text-emerald-700')}
                ${balanceHtml}
            </div>`;

        const pay = data.can && data.can.pay
            ? `<button type="button" class="ord-pay-open" onclick="orderPay.open(${Number(o.id)}, true)">
                   <i data-lucide="banknote" class="w-4 h-4"></i>Cobrar
               </button>`
            : '';

        return this.card('wallet', 'Resumen de pago', body, pay);
    }

    paymentIcon(p) {
        const key = `${p.method_code || ''} ${p.method || ''}`;

        if (/cash|efect/i.test(key))          return ['banknote', 'text-emerald-600'];
        if (/card|tarj|cr[eé]d|d[eé]b/i.test(key)) return ['credit-card', 'text-sky-600'];
        if (/transf|spei/i.test(key))         return ['arrow-right-left', 'text-violet-600'];

        return ['wallet', 'text-gray-500'];
    }

    paymentRow(p, orderId, canDelete) {
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

        return `
            <div class="flex items-start gap-2 text-[12.5px]">
                <i data-lucide="${icon}" class="w-4 h-4 ${tone} shrink-0 mt-0.5"></i>
                <div class="min-w-0">
                    <div class="font-semibold text-gray-700">${esc(p.method || 'Sin método')}</div>
                    <div class="text-[11.5px] text-gray-400">${ordDate(p.paid_at, true)}${p.description ? ' · ' + esc(p.description) : ''}</div>
                    ${change}${who}
                </div>
                <span class="ml-auto font-semibold text-gray-800 whitespace-nowrap">${money(p.amount)}</span>
                ${remove}
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
        confirmacion (tabla, detalle o al terminar «Cobrar y entregar»). Si vino
        del detalle, lo cierra antes y lo vuelve a abrir al terminar o al volver. */
    deliver(id, opts = {}) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        if (this.delivering) return;

        const fromDetail = !!opts.fromDetail;
        const back       = () => (fromDetail ? this.show(id) : null);

        if (fromDetail) $('#modalOrderDetails .cs-modal-x').trigger('click');

        this.csModal({
            id:         'modalOrderDeliver',
            title:      'Entregar pedido',
            subtitle:   `Pedido #P${id}`,
            lucideIcon: 'package-check',
            width:      'max-w-md',
            saveText:   'Entregar',
            cancelText: 'Volver',
            info:       'Queda como entregado y ya no se edita.',
            json: [
                { id: 'dl_key', lbl: 'Tu contraseña', tipo: 'text', required: true, class: 'w-full', help: 'La misma con la que entras a Huubie.' }
            ],
            onSave: (values, close) => this.saveDeliver(id, close, back)
        });

        orderPay.onDismiss('modalOrderDeliver', back);

        // csModal no tiene campo de contraseña: se pinta de texto y aqui se oculta lo escrito.
        // one-time-code: el navegador no la rellena sola (si no, la clave no pediria nada).
        $('#dl_key')
            .attr({ type: 'password', autocomplete: 'one-time-code', spellcheck: 'false' })
            .on('keydown', (e) => {
                if (e.key !== 'Enter') return;

                e.preventDefault();
                $('#modalOrderDeliver .cs-modal-save').trigger('click');
            })
            .trigger('focus');
    }

    // El ctrl revisa la contraseña. Si falla (data.key) la ventana sigue abierta y lo dice bajo el campo.
    async saveDeliver(id, close, back) {
        if (this.delivering) return;

        const field = $('#dl_key');
        const key   = String(field.val() || '');
        const wrong = (text) => {
            field.next('p').removeClass('text-gray-400').addClass('text-red-600 font-semibold').text(text);
            field.val('').trigger('focus');
        };

        if (!key) return wrong('Escribe tu contraseña para entregar.');

        this.delivering = true;

        const button = $('#modalOrderDeliver .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'deliverOrder', id: id, key: key } });

        this.delivering = false;
        button.prop('disabled', false);

        if (!data)    return wrong('No hubo respuesta. Revisa la conexión y vuelve a intentar.');
        if (data.key) return wrong(data.message || 'Contraseña incorrecta.');

        orderPay.closeQuiet('modalOrderDeliver', close);

        if (data.status != 200) {
            const soft = [403, 404, 409].includes(Number(data.status));

            await alert({ icon: soft ? 'info' : 'error', title: 'No se entregó', text: data.message || 'Vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

            return back();
        }

        orders.lsOrders();
        alert({ icon: 'success', title: data.message });

        back();
    }

    // Regresa el pedido a «sin entregar». Solo Dueño o Supervisor; pide motivo, no contraseña.
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

    // Palomeo desde el detalle (Produccion en el calendario). Lo mismo que la casilla de la tarjeta.
    async produce(id, want) {
        const data = await useFetch({ url: this._link, data: { opc: 'toggleProduced', id: id, produced: want ? 1 : 0 } });

        if (!data || data.status != 200) {
            alert({ icon: 'info', title: 'No se cambió la marca', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        // show() reemplaza el modal abierto con el pedido ya marcado.
        orders.lsOrders();
        this.show(id);
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

        const o       = data.order;
        const limited = !!data.limited;   // sin dinero: ni importes ni totales
        const total   = Number(o.total || 0);
        const paid    = Number(o.paid || 0);
        const balance = Math.round((total - paid) * 100) / 100;
        const ship    = Number(o.delivery_method) === 1;

        const row = (a, b, strong) => `<tr${strong ? ' class="b"' : ''}><td>${a}</td><td class="r">${b}</td></tr>`;

        const lines = (data.lines || []).map((l) => {
            const extra = [
                l.dedication ? `Dedicatoria: ${esc(l.dedication)}` : '',
                l.details ? `Obs.: ${esc(l.details)}` : '',
                (l.modifiers || []).length ? (l.modifiers || []).map((m) => esc(m.name)).join(', ') : ''
            ].filter(Boolean).map((t) => `<div class="s">${t}</div>`).join('');

            return `<tr><td>${Number(l.quantity || 1)} × ${esc(l.name || l.product_name)}${extra}</td>${limited ? '' : `<td class="r">${money(this.lineTotal(l))}</td>`}</tr>`;
        }).join('');

        const payments = (data.payments || []).map((p) => {
            const change = Number(p.change_amount) > 0
                ? `<tr><td colspan="2" class="s">Recibió ${money(p.tendered_amount)} · cambio ${money(p.change_amount)}</td></tr>`
                : '';

            return row(`${esc(p.method || 'Pago')} · ${ordDate(p.paid_at, true)}`, money(p.amount)) + change;
        }).join('');

        const body = `
            <h1>Pedido P${esc(o.folio || o.id)}</h1>
            <div class="c">${esc(data.branch)}</div>
            <div class="c s">Creado ${ordDate(o.created_at, true)}${o.status ? ' · ' + esc(o.status) : ''}</div>
            <hr>
            <table>
                ${row('Cliente', esc(o.customer || 'Sin cliente'))}
                ${o.phone ? row('Teléfono', esc(o.phone)) : ''}
                ${row('Entrega', o.delivery_date ? `${ordDate(o.delivery_date)} ${ordHour(o.delivery_time)}` : 'Sin fecha')}
                ${row('Tipo', ship ? 'Envío a domicilio' : 'Recoge en tienda')}
            </table>
            ${ship && o.location ? `<div class="s">${esc(o.location)}</div>` : ''}
            ${o.note ? `<div class="s">Nota: ${esc(o.note)}</div>` : ''}
            <hr>
            <table>${lines || '<tr><td>Sin productos</td></tr>'}</table>
            ${limited ? '' : `<hr>
            <table>
                ${row('Subtotal', money(o.subtotal))}
                ${Number(o.discount_amount) > 0 ? row('Descuento', '−' + money(o.discount_amount)) : ''}
                ${row('Total', money(total), true)}
                ${payments}
                ${row('Abonado', money(paid))}
                ${row(balance < 0 ? 'Saldo a favor' : 'Saldo', money(Math.abs(balance)), true)}
            </table>`}
            ${Number(o.sale_status_id) === 4 ? `<hr><div class="c b">CANCELADO</div>${o.cancel_reason ? `<div class="c s">${esc(o.cancel_reason)}</div>` : ''}` : ''}
            <hr>
            <div class="c s">Impreso ${ordNow()}</div>`;

        ordPrint(`Pedido P${o.folio || o.id}`, body);
    }
}
