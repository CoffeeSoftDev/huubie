// Captura de un pedido a sucursal sobre la de Entradas (EntradaForm). Cambia lo propio del
// pedido: "Solicitar a" y la fecha en que se necesitan los insumos; sin almacén (lo elige
// quien surte al aprobar), sin stock, sin costos ni importes (opción `montos: false`), sin
// formatos, sin alta de productos ni comprobante. Con `montos: false` (la requisición) los
// productos se capturan en una hoja tipo Excel: se escribe en Producto y se elige solo el
// del Catálogo que más se parece (ver «Hoja» y «Coincidencias»). Compras, que hereda de
// aquí, conserva el buscador, el renglón vacío y sus costos de solo lectura. Se guarda como
// borrador o se envía a revisión. Se adapta a tablet y teléfono.
// Requiere entrada-form.js cargado antes.
class OrdenForm extends EntradaForm {

    constructor(options) {
        const o = options || {};
        super(Object.assign({}, o, {
            id:     o.id || 'ordenFormModal',
            labels: Object.assign({}, OrdenForm.LABELS, o.montos === false ? OrdenForm.LABELS_HOJA : {}, o.labels || {})
        }));
    }

    static get LABELS() {
        return {
            title:         'Nuevo pedido',
            subtitle:      'Arma la lista de materiales a solicitar',
            sucursal:      'Solicitar a',
            mismaSucursal: 'Le estás pidiendo a tu misma sucursal',
            fecha:         'Lo necesitas para',
            fechaReq:      'Elige la fecha en que necesitas tus insumos',
            fechaVieja:    'La fecha no puede ser de hace más de un mes',
            nota:          'Comentario para quien revise la solicitud',
            productosLbl:  'Materiales a solicitar',
            emptyTitle:    'Aún no has agregado materiales',
            hintRenglon:   'renglón vacío',
            placeholder:   'Buscar materiales por nombre o SKU...',
            notaProducto:  'Agregar nota de solicitud',
            notaProductoTit: 'Nota de solicitud',
            notaProductoPh:  'Marca, presentación, urgencia...',
            notaProductoMax: 'Máximo 255 caracteres',
            notaProductoOk:  'Guardar nota',
            borrador:      'Guardar borrador',
            registrar:     'Guardar y enviar a revisión',
            confirmAdd:    '¿Deseas crear el pedido?',
            confirmAddOk:  'Sí, crear',
            confirmDraft:  '¿Deseas guardar el pedido como borrador?',
            confirmDraftOk:'Sí, guardar',
            confirmSalir:  '¿Guardar el pedido como borrador o salir de la captura?',
            confirmSalirBorrador: '¿Guardar los cambios en este borrador o salir sin guardar?',
            salir:         'Salir sin guardar',
            titleEdit:     'Editar pedido',
            guardarEdit:   'Guardar cambios',
            confirmEdit:   '¿Deseas guardar los cambios del pedido?',
            confirmEditOk: 'Sí, guardar'
        };
    }

    // Lo propio de la hoja de la requisición: atajos de las filas, textos de las celdas, de
    // lo que se va a la nota y de las confirmaciones (Compras se queda con las de LABELS).
    static get LABELS_HOJA() {
        return {
            confirmAdd:       '¿Deseas crear la requisición?',
            confirmDraft:     '¿Deseas guardar la requisición como borrador?',
            confirmSalir:     '¿Guardar la requisición como borrador o salir de la captura?',
            confirmEdit:      '¿Deseas guardar los cambios de la requisición?',
            atajoMover:       'moverse',
            atajoOtraFila:    'otra fila',
            atajoEnviar:      'enviar',
            productoPh:       'Escribe el producto...',
            coincidenPara:    'Coincidencias para',
            sinCoincidencias: 'Sin coincidencias en el Catálogo',
            sinCoincidencia:  'Sin coincidencia en el Catálogo: al guardar va en la nota',
            vaEnNota:         'va en la nota',
            comoNota:         'Dejarlo como nota',
            elegir:           'elegir y otra fila',
            deshacer:         'deshacer',
            sinCatalogo:      'Sin catálogo',
            soloNotas:        'Agrega al menos un producto del Catálogo: lo que no tiene coincidencia va en la nota',
            notaLarga:        'La nota pasa de 255 caracteres: acorta el comentario o lo que va como nota'
        };
    }

    // Atajos de teclado en gris discreto: texto un poco más legible que en Entradas y
    // teclas planas con borde fino, sin fondo de color. El buscador solo reserva lugar a
    // la derecha cuando se ven los atajos (de sm para arriba).
    // Márgenes de las franjas (px-5 y px-[18px]): Bootstrap trae .px-5 = 3rem con
    // !important y en teléfono se comía 84px del ancho; 12px en teléfono y 18px desde
    // tablet, igual en todas las franjas.
    ensureStyles() {
        super.ensureStyles();
        if (document.getElementById('ordenFormStyles')) return;

        const id    = this.opts.id;
        const style = document.createElement('style');
        style.id          = 'ordenFormStyles';
        style.textContent = `
            #${id} :is(div, span):has(> .ef-kbd) { font-size: 11px; color: #6B7280; }
            #${id} .ef-kbd { height: 17px; padding: 0 5px; font-size: 10px; font-weight: 500; color: #6B7280; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 4px; }
            #${id}_buscarProducto { padding-right: 0.75rem; }
            #${id}_panel :is(.px-5, .px-\\[18px\\]) { padding-left: 12px !important; padding-right: 12px !important; }
            @media (min-width: 640px) { #${id}_buscarProducto { padding-right: 12rem; } }
            @media (min-width: 768px) { #${id}_panel :is(.px-5, .px-\\[18px\\]) { padding-left: 18px !important; padding-right: 18px !important; } }`;
        document.head.appendChild(style);
    }

    // -- Montos y unidad --

    // El pedido se abre con `montos: false` (ordenes.js): no muestra costos ni importes, la
    // unidad va en su propia columna, la presentación en el buscador y la nota general es una
    // caja más alta. Compras (CompraForm) hereda este formato y no pasa la opción: conserva
    // sus costos y su nota de una línea como estaban.
    conMontos() {
        return this.opts.montos !== false;
    }

    // La presentación es la unidad del catálogo (CJA360, KG, PZ...); '' si el producto no tiene.
    presentacionDe(p) {
        return String(p.presentacion || this.unitOf(p) || '');
    }

    // -- Render estático --

    // Solo a quién se le pide y para cuándo: el almacén lo elige quien surte al aprobar y
    // los productos se escriben en la hoja. Cada campo ocupa col-3 en computadora y la
    // mitad en tablet (en col-3 el select y la etiqueta de la fecha no caben), alineados
    // por abajo. El aviso de sucursal propia solo sale en el formulario previo de "Nuevo
    // pedido" (ordenes.js).
    renderConfigRow() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60">
                <div id="${o.id}_configGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.sucursal)}</label>
                        ${this.selectWrap(`
                            <select id="${o.id}_selSucursal" class="${cls.select} !pl-10">
                                ${(o.data.sucursales || []).map(it => this.optionTag(it, o.data.branch_id)).join('')}
                            </select>
                        `, 'building-2')}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.fecha)}</label>
                        <input id="${o.id}_inpFecha" type="date" value="${this.esc(o.data.fecha)}" min="${this.haceUnMes()}" class="${cls.input}">
                    </div>
                </div>
            </div>`;
    }

    // La requisición no lleva buscador: se escribe en la hoja. Compras conserva su franja.
    renderSearchBar() {
        return this.conMontos() ? super.renderSearchBar() : '';
    }

    // El pedido no lleva formatos.
    renderFormatosControls() {
        return '';
    }

    // Nota y botones; en teléfono los botones bajan a su propio renglón. En el pedido la nota
    // es más alta y los botones se alinean con su base.
    renderFooter() {
        if (!this.conMontos()) {
            return `
                <div class="flex flex-col gap-2 sm:gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    ${this.renderNotaInput()}
                    <div class="flex sm:justify-end">${this.renderFooterActions()}</div>
                </div>`;
        }

        const alineacion = 'sm:items-center';
        return `
            <div class="flex flex-col sm:flex-row ${alineacion} gap-2 sm:gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                ${this.renderNotaInput()}
                ${this.renderFooterActions()}
            </div>`;
    }

    // El ícono de nota va dentro del campo, no a un lado. En el pedido el campo es una caja de
    // tres líneas para escribir el comentario completo; en Compras sigue siendo de una.
    renderNotaInput() {
        const o   = this.opts;
        const cls = this.cls;

        if (!this.conMontos()) {
            return `
                <div class="relative flex-1 min-w-0">
                    <i data-lucide="sticky-note" class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3 pointer-events-none"></i>
                    <textarea id="${o.id}_inpNota" rows="3" placeholder="${this.esc(o.labels.nota)}..." class="${cls.input} !pl-8 resize-none">${this.esc(o.data.nota)}</textarea>
                </div>`;
        }

        return `
            <div class="relative flex-1 min-w-0">
                <i data-lucide="sticky-note" class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                <input id="${o.id}_inpNota" type="text" value="${this.esc(o.data.nota)}" placeholder="${this.esc(o.labels.nota)}..." class="${cls.input} !pl-8">
            </div>`;
    }

    // El pedido no lleva comprobante.
    renderVoucher() {
        return '';
    }

    renderFooterActions() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                <button class="${cls.btnOut} flex-1 sm:flex-none justify-center !text-red-600 hover:!text-red-700" data-modal-close>${this.esc(o.labels.cancelar)}</button>
                <button id="${o.id}_btnRegistrar" class="${cls.btnOk} flex-1 sm:flex-none justify-center">
                    <i data-lucide="send" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.registrar)}</span>
                </button>
            </div>`;
    }

    // Mismos totales que Entradas (los ids los llena updateTotals); el pedido solo lleva las
    // cantidades. Con importes (Compras), en tablet y teléfono se quedan Productos, Unidades
    // y Costo total.
    renderResumen() {
        const o = this.opts;
        return `
            <div class="cs-captura-resumen flex-shrink-0 border-t border-gray-200 px-5 py-2.5 bg-gray-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <div class="flex items-center gap-4 text-[11px] text-gray-500">
                    <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Productos <strong class="text-gray-800 text-sm" id="${o.id}_qtyItems">0</strong></span>
                    <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>${this.esc(o.labels.unidadesLbl)} <strong class="text-gray-800 text-sm" id="${o.id}_qtyUnits">0</strong> uds</span>
                    <span class="hidden sm:flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>${this.esc(o.labels.categoriasLbl)} <strong class="text-gray-800 text-sm" id="${o.id}_qtyCats">0</strong></span>
                </div>
                ${this.conMontos() ? `
                <div class="flex items-center gap-4">
                    <div class="hidden lg:flex items-baseline gap-2">
                        <span class="text-[10px] uppercase tracking-wider text-gray-500">${this.esc(o.labels.costoSinImpLbl)}</span>
                        <span class="text-gray-700 font-semibold text-sm leading-none" id="${o.id}_qtyBase">$0.00</span>
                    </div>
                    <div class="hidden lg:flex items-baseline gap-2">
                        <span class="text-[10px] uppercase tracking-wider text-gray-500">${this.esc(o.labels.impuestosLbl)}</span>
                        <span class="text-gray-700 font-semibold text-sm leading-none" id="${o.id}_qtyTax">$0.00</span>
                    </div>
                    <div class="hidden lg:block h-6 w-px bg-gray-300"></div>
                    <div class="flex items-baseline gap-2.5">
                        <span class="text-[10px] uppercase tracking-wider text-gray-500">${this.esc(o.labels.costoTotLbl)}</span>
                        <span class="text-green-600 font-bold text-lg leading-none" id="${o.id}_qtyCost">$0.00</span>
                    </div>
                </div>` : ''}
            </div>`;
    }

    // -- Tabla de productos --

    // Sin stock. Ancho fijo para que las columnas no se muevan al teclear una cantidad.
    // La requisición es una hoja de cálculo con el formato de las tablas de CoffeeSoft en
    // tema claro (createCoffeeTable3): letra de 12 px y borde redondeado, sin sombra ni
    // filas sombreadas, con el encabezado en el color del tema (terracota); como en Excel,
    // lleva líneas entre columnas y el número de fila. Columnas: #, Producto (se escribe),
    // Cantidad y Unidad al centro (la unidad se elige) y Observación. Siempre termina en una
    // fila vacía para seguir escribiendo (ver «Hoja»). El contenedor recorta con
    // overflow-clip y no con hidden: así el encabezado sigue fijo al desplazar la lista.
    // Con montos (Compras) hay SKU y costos de solo lectura, que salen del catálogo: en
    // tablet se ocultan SKU, costo sin impuesto e impuesto; en teléfono también el costo y
    // la miniatura: quedan Producto, Cantidad y Subtotal.
    renderProductsTable() {
        const m = this.conMontos();
        if (!m) {
            const th = 'px-2 py-2 bg-blue-600 text-white font-semibold text-center border-r border-white/20 last:border-r-0';
            return `
            <div class="px-5 pt-[12px]">
                <div class="rounded-lg border border-gray-200 overflow-clip">
                    <table class="w-full table-fixed border-separate border-spacing-0 [&>tbody>tr:last-child>td]:border-b-0" style="font-size:12px">
                        <thead class="sticky top-0 z-10">
                            <tr>
                                <th class="${th} w-10">#</th>
                                <th class="${th}">Producto</th>
                                <th class="${th} w-[11%]">Cantidad</th>
                                <th class="${th} w-[14%]">Unidad</th>
                                <th class="${th} w-[26%]">Observación</th>
                                <th class="${th} w-10"></th>
                            </tr>
                        </thead>
                        <tbody>${this.lote.map((p, i) => this.renderProductRow(p, i)).join('')}</tbody>
                    </table>
                </div>
            </div>
            <div class="h-64" aria-hidden="true"></div>`;
        }

        const th = 'py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold';
        return `
            <table class="w-full border-collapse table-fixed">
                <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="hidden lg:table-cell text-left px-3 ${th} w-28">SKU</th>
                        <th class="text-left px-3 ${th}">Producto</th>
                        <th class="text-center px-2 ${th} w-20 md:w-24">Cantidad</th>
                        <th class="hidden md:table-cell text-right px-2 ${th} w-24">Costo c/imp</th>
                        <th class="hidden lg:table-cell text-right px-2 ${th} w-24">Costo s/imp</th>
                        <th class="hidden lg:table-cell text-center px-2 ${th} w-16">Imp. %</th>
                        <th class="text-right px-2 md:px-3 ${th} w-28 md:w-36">Subtotal</th>
                        <th class="w-10 px-2 py-2"></th>
                    </tr>
                </thead>
                <tbody>${this.lote.map((p, i) => this.renderProductRow(p, i)).join('')}${this.draft ? this.renderDraftRow() : ''}</tbody>
            </table>
            <div class="h-64" aria-hidden="true"></div>`;
    }

    // NOMBRE - PRESENTACION (HUEVO - CJA360); sin presentación, solo el nombre. En el pedido
    // la unidad tiene su propia columna y aquí va solo el nombre.
    nombreVista(p) {
        if (!this.conMontos()) return this.esc(p.nombre);

        return this.esc(p.presentacion ? `${p.nombre} - ${p.presentacion}` : p.nombre);
    }

    // Celda de la unidad (columna Unidad de la hoja): se escribe para buscar la unidad o se
    // elige de la lista con la flecha, que solo aparece en la celda activa o al pasar el
    // mouse (como la de Excel), con la misma lista flotante que el Impuesto de Entradas.
    // Sin catálogo de unidades queda solo el texto de la presentación.
    renderUnidadCell(p, i) {
        const c        = this.celdaCls();
        const unidades = (this.opts.data && this.opts.data.unidades) || [];
        if (unidades.length) {
            return `
            <td class="${c.td} group/unidad">
                <div class="relative" title="Unidad: escribe o elige (Alt+↓)">
                    <input type="text" autocomplete="off" value="${this.esc(this.unidadTexto(p.unit_id))}" data-unit-idx="${i}" style="${c.letra}"
                        class="${c.campo} pl-6 pr-6 text-center font-semibold uppercase text-gray-700">
                    <button type="button" tabindex="-1" class="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 opacity-0 group-hover/unidad:opacity-100 group-focus-within/unidad:opacity-100" data-unit-toggle="${i}">
                        <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </td>`;
        }

        const pres = this.presentacionDe(p);
        return `
            <td class="${c.td} px-2 text-center text-xs font-medium text-gray-600">
                ${pres ? `<span class="block truncate" title="${this.esc(pres)}">${this.esc(pres)}</span>` : ''}
            </td>`;
    }

    // -- Unidad: escribe o elige --

    unidadTexto(unitId) {
        const u = ((this.opts.data && this.opts.data.unidades) || []).find(x => String(x.id) === String(unitId));
        return u ? (u.code || u.valor || '') : '';
    }

    unitInput(idx) {
        return $(`#${this.opts.id}_listaProductos tr[data-idx="${idx}"] input[data-unit-idx]`);
    }

    // Con filter quedan las unidades que traen lo tecleado (nombre o código, sin acentos).
    openUnitList(idx, filter) {
        const $inp = this.unitInput(idx);
        if (!$inp.length || !this.lote[idx]) return;
        const q     = filter ? this.normTxt($inp.val()) : '';
        const all   = (this.opts.data && this.opts.data.unidades) || [];
        const items = q ? all.filter(u => this.normTxt(`${u.code || ''} ${u.valor || ''}`).includes(q)) : all;
        if (!items.length) { this.closeFloat(); return; }
        const cur = items.findIndex(u => String(u.id) === String(this.lote[idx].unit_id));
        this.openFloat({
            kind:     'unit',
            idx:      idx,
            items:    items,
            active:   Math.max(0, cur),
            $anchor:  $inp.closest('.relative'),
            minWidth: 180
        }, `<div class="max-h-[260px] overflow-y-auto cs-scroll ef-scroll">${items.map((u, k) => `
            <div class="ef-cat-item px-3 py-2 cursor-pointer text-[13px] font-semibold uppercase text-gray-800 hover:bg-blue-50/60 border-b border-gray-100 last:border-b-0 transition-all" data-unit-val="${this.esc(u.id)}" data-cat-idx="${k}">${this.esc(u.code || u.valor || '')}</div>`).join('')}
        </div>`);
    }

    // Escribir filtra la lista y Alt+↓ la abre, como en Excel; con la lista abierta las
    // flechas la recorren y Enter elige; Tab (o ←/→ al salir de la celda) también elige y
    // pasa a la celda de al lado. Sin lista, las teclas son las de la hoja.
    onUnitKeydown(e, idx) {
        const f    = this.float;
        const open = f && f.kind === 'unit' && f.idx === idx;
        if (e.key === 'ArrowDown' && e.altKey) {
            e.preventDefault();
            this.openUnitList(idx, false);
            return;
        }
        if (open) {
            if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey) || this.saleConFlecha(e)) {
                const u = f.items[f.active];
                if (u) this.selectUnit(idx, u.id);
                if (e.key === 'Enter') { e.preventDefault(); return; }
            } else if (this.onFloatKeydown(e)) return;
        }
        this.navegarHoja(e, idx, 'unidad');
    }

    // Elegida a mano, la unidad se queda aunque después se cambie el producto del renglón.
    selectUnit(idx, unitId) {
        const p = this.lote[idx];
        this.closeFloat();
        if (!p) return;
        p.unit_id       = unitId || null;
        p._unidadManual = true;
        this.unitInput(idx).val(this.unidadTexto(p.unit_id));
    }

    toggleUnitList(idx) {
        const f = this.float;
        if (f && f.kind === 'unit' && f.idx === idx) { this.closeFloat(); return; }
        this.unitInput(idx).trigger('focus');
        this.openUnitList(idx, false);
    }

    renderProductRow(p, i) {
        if (!this.conMontos()) return this.renderFilaHoja(p, i);

        const cant  = Number(p.cantidad || 0);
        const costo = Number(p.costo || 0);
        const tax   = Number(p.tax || 0);
        const base  = (p.costoSinTax != null && p.costoSinTax !== '') ? Number(p.costoSinTax) : this.baseFromCost(costo, tax);

        const quitar = `
            <button class="w-6 h-6 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" data-remove="${i}" title="Eliminar">
                <i data-lucide="x" class="w-3 h-3"></i>
            </button>`;
        const cantidad = `
                <td class="px-2 py-2 align-middle">
                    <input type="number" min="1" step="0.01" value="${cant}" class="${this.cls.qtyInp}" data-field="cantidad" data-idx="${i}">
                </td>`;
        const producto = `
                <td class="px-3 py-2 align-middle">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="hidden sm:inline-flex">${this.prodThumb(p, 'w-8 h-8', 'w-3.5 h-3.5')}</span>
                        <div class="min-w-0">
                            <p class="text-xs font-semibold text-gray-800 leading-tight line-clamp-2 sm:line-clamp-none sm:truncate">${this.nombreVista(p)}</p>
                            ${p.categoria ? `<p class="text-[10px] text-gray-400 truncate mt-0.5">${this.esc(p.categoria)}</p>` : ''}
                            ${this.equivaleHtml(p)}
                        </div>
                    </div>
                </td>`;

        return `
            <tr class="border-b border-gray-100 last:border-b-0 hover:bg-blue-100/60 transition-colors" data-idx="${i}">
                <td class="hidden lg:table-cell px-3 py-2 align-middle">
                    <span class="block truncate text-[11px] font-mono text-gray-500" title="${this.esc(p.sku)}">${this.esc(p.sku)}</span>
                </td>
                ${producto}
                ${cantidad}
                <td class="hidden md:table-cell px-2 py-2 align-middle text-right text-xs text-gray-600">${this.fmtMoney(costo)}</td>
                <td class="hidden lg:table-cell px-2 py-2 align-middle text-right text-xs text-gray-600">${this.fmtMoney(base)}</td>
                <td class="hidden lg:table-cell px-2 py-2 align-middle text-center text-xs text-gray-600">${this.fmtQty(tax)}%</td>
                <td class="px-2 md:px-3 py-2 align-middle text-right whitespace-nowrap">
                    <span class="text-green-700 font-bold text-xs" data-subtotal>${this.fmtMoney(cant * costo)}</span>${this.renderSubtotalExtra(p, i)}
                </td>
                <td class="px-2 py-2 align-middle text-center">${quitar}</td>
            </tr>`;
    }

    // Renglón vacío (↓) de Compras: mismas columnas que la tabla, para que se oculten igual.
    // La requisición no lo usa: su hoja ya termina en una fila vacía.
    renderDraftRow() {
        const o = this.opts;
        return `
            <tr class="border-b border-gray-100 bg-blue-50/30" data-draft>
                <td class="hidden lg:table-cell"></td>
                <td class="px-3 py-2 align-middle">
                    <div class="relative">
                        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                            <i data-lucide="search" class="w-3.5 h-3.5"></i>
                        </span>
                        <input id="${o.id}_draftInput" type="text" autocomplete="off" value="${this.esc(this.draft.term)}" placeholder="${this.esc(o.labels.draftPh)}" class="${this.cls.search}">
                    </div>
                </td>
                <td></td>
                <td class="hidden md:table-cell"></td>
                <td class="hidden lg:table-cell"></td>
                <td class="hidden lg:table-cell"></td>
                <td></td>
                <td class="px-2 py-2 align-middle text-center">
                    <button class="w-6 h-6 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" data-draft-remove title="${this.esc(o.labels.quitarRenglon)}">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                </td>
            </tr>`;
    }

    // -- Hoja --

    // Solo las teclas principales de la hoja, arriba de la tabla (Compras conserva las de
    // Entradas). Tab, Ctrl+D, Ctrl+Supr y Ctrl+S siguen sirviendo, pero no se anuncian.
    renderAtajos() {
        if (this.conMontos()) return super.renderAtajos();

        const l      = this.opts.labels;
        const atajos = [
            ['&larr; &uarr; &darr; &rarr;', l.atajoMover],
            ['Enter',      l.atajoOtraFila],
            ['Ctrl+Enter', l.atajoEnviar]
        ];
        return `
            <span class="hidden md:flex items-center gap-2.5 whitespace-nowrap text-[10px] text-gray-400">
                ${atajos.map(([tecla, txt]) => `<span class="inline-flex items-center gap-1"><span class="ef-kbd">${tecla}</span>${this.esc(txt)}</span>`).join('')}
            </span>`;
    }

    // Clases de la rejilla: celdas con las líneas grises de las tablas de CoffeeSoft (abajo
    // y entre columnas) y la activa (con foco) con el marco del color del tema, como la
    // celda seleccionada de Excel; el campo de adentro no se ve. La letra va en línea con
    // !important: compact.css pone 1rem y alto automático con !important a todo input, por
    // eso el alto sale del padding (px-2 py-2, el mismo de las celdas de CoffeeSoft).
    celdaCls() {
        return {
            td:    'p-0 align-middle border-b border-r border-gray-200 focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-blue-600',
            campo: 'block w-full px-2 py-2 leading-[18px] bg-transparent border-0 rounded-none outline-none shadow-none focus:ring-0',
            letra: 'font-size:12px !important'
        };
    }

    // Fila de la hoja: número de fila, Producto, Cantidad, Unidad y Observación, en blanco
    // (sin filas sombreadas: solo se marca la celda activa). En Producto se escribe libre;
    // a la derecha de lo escrito va la categoría del producto elegido o, si no coincidió
    // con nada del Catálogo, el aviso de que se va a la nota. La Observación es una celda
    // más (se guarda como la nota del renglón). Quitar se ve en toda fila con producto; la
    // fila vacía del final no lo lleva ni tiene cantidad.
    renderFilaHoja(p, i) {
        const o     = this.opts;
        const c     = this.celdaCls();
        const vacia = this.esVacia(p);
        const cant  = p.cantidad === '' || p.cantidad == null ? '' : Number(p.cantidad);
        return `
            <tr class="group/fila bg-white" data-idx="${i}">
                <td class="p-0 text-center text-[11px] text-gray-400 border-b border-r border-gray-200 select-none">${i + 1}</td>
                <td class="${c.td}">
                    <div class="flex items-center gap-2 min-w-0 pr-[10px]" data-prod-box="${i}">
                        <input type="text" autocomplete="off" value="${this.esc(this.valorProducto(p))}" placeholder="${this.esc(o.labels.productoPh)}" data-prod-idx="${i}" style="${c.letra}"
                            class="${c.campo} flex-1 min-w-0 font-medium text-gray-800 placeholder:text-gray-400">
                        <span class="flex-shrink-0 max-w-[45%] truncate" data-prod-meta="${i}">${this.metaProducto(p)}</span>
                    </div>
                </td>
                <td class="${c.td}">
                    <input type="number" min="0" step="0.01" value="${cant}" data-field="cantidad" data-idx="${i}" style="${c.letra}"
                        class="no-spin ${c.campo} text-center font-semibold text-gray-800">
                </td>
                ${this.renderUnidadCell(p, i)}
                <td class="${c.td}">
                    <input type="text" autocomplete="off" maxlength="255" value="${this.esc(p.nota || '')}" data-field="nota" data-idx="${i}" style="${c.letra}"
                        class="${c.campo} text-gray-600">
                </td>
                <td class="p-0 text-center border-b border-gray-200">
                    <button type="button" tabindex="-1" class="${vacia ? 'invisible ' : ''}w-6 h-6 rounded-md inline-flex items-center justify-center text-gray-400 hover:!text-red-500 hover:bg-red-50 transition-all" data-remove="${i}" data-quitar title="Eliminar">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                </td>
            </tr>`;
    }

    // Lo que dice la celda Producto: el nombre del Catálogo o lo que se escribió.
    valorProducto(p) {
        return p.id ? (p.nombre || '') : (p.texto || '');
    }

    // A la derecha de la celda Producto, en etiqueta: la categoría (y equivalencia) del
    // producto elegido o, si no coincidió con nada, «va en la nota» en ámbar.
    metaProducto(p) {
        if (p.id) {
            const datos = [p.categoria, p.equivale].filter(Boolean).map(x => this.esc(x)).join(' &middot; ');
            return datos ? `<span class="inline-flex max-w-full px-1.5 py-0.5 rounded text-[10px] font-medium leading-none bg-white text-gray-500 ring-1 ring-gray-200 truncate">${datos}</span>` : '';
        }
        if (!String(p.texto || '').trim()) return '';
        const l = this.opts.labels;
        return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none bg-amber-50 text-amber-700 ring-1 ring-amber-200" title="${this.esc(l.sinCoincidencia)}"><i data-lucide="sticky-note" class="w-3 h-3"></i>${this.esc(l.vaEnNota)}</span>`;
    }

    // La fila vacía va en blanco, como en Excel: la cantidad toma 1 al elegir el producto.
    filaVacia() {
        return { libre: true, texto: '', cantidad: '', unit_id: null, nota: '' };
    }

    // Sin producto del Catálogo ni nada escrito en Producto.
    esVacia(p) {
        return !p.id && !String(p.texto || '').trim();
    }

    // Las filas que cuentan: con producto o con algo escrito (en Compras, todo el lote).
    filasConContenido() {
        return this.lote.filter(p => !this.esVacia(p));
    }

    // La hoja siempre termina en una fila vacía donde seguir escribiendo.
    renderLote() {
        if (this.conMontos()) { super.renderLote(); return; }

        const ultimo = this.lote[this.lote.length - 1];
        if (!ultimo || !this.esVacia(ultimo)) this.lote.push(this.filaVacia());

        this.closeFloat();
        $(`#${this.opts.id}_listaProductos`).html(this.renderProductsTable()).removeClass('flex items-center justify-center');
        this.syncLimpiar();
        this.updateTotals();
        if (window.lucide) lucide.createIcons();
    }

    // Si la última fila ya tiene producto, agrega otra vacía al final sin repintar la hoja
    // (no se pierde el foco de la celda en que se está escribiendo).
    asegurarVacia() {
        const ultimo = this.lote[this.lote.length - 1];
        if (ultimo && this.esVacia(ultimo)) return;

        this.lote.push(this.filaVacia());
        const idx    = this.lote.length - 1;
        const $tbody = $(`#${this.opts.id}_listaProductos tbody`);
        if (!$tbody.length) return;
        $tbody.append(this.renderFilaHoja(this.lote[idx], idx));
        if (window.lucide) lucide.createIcons();
    }

    // Repinta las celdas de una fila en su lugar, sin rehacer los inputs.
    refrescarFila(i) {
        const p   = this.lote[i];
        const $tr = $(`#${this.opts.id}_listaProductos tr[data-idx="${i}"]`);
        if (!p || !$tr.length) return;

        $tr.find(`input[data-field="cantidad"][data-idx="${i}"]`).val(p.cantidad === '' || p.cantidad == null ? '' : Number(p.cantidad));
        $tr.find(`input[data-prod-idx="${i}"]`).val(this.valorProducto(p));
        $tr.find(`[data-prod-meta="${i}"]`).html(this.metaProducto(p));
        $tr.find(`input[data-unit-idx="${i}"]`).val(this.unidadTexto(p.unit_id));
        $tr.find(`input[data-field="nota"][data-idx="${i}"]`).val(p.nota || '');
        $tr.find('[data-quitar]').toggleClass('invisible', this.esVacia(p));
        if (window.lucide) lucide.createIcons();
    }

    // Los totales cuentan solo las filas con producto del Catálogo.
    updateTotals() {
        if (this.conMontos()) { super.updateTotals(); return; }

        const o    = this.opts;
        const lote = this.lote.filter(p => p.id);
        const uds  = lote.reduce((s, p) => s + Number(p.cantidad || 0), 0);
        const cats = new Set(lote.map(p => (p.categoria && String(p.categoria).trim()) || 'Sin categoria')).size;
        $(`#${o.id}_qtyItems`).text(lote.length);
        $(`#${o.id}_qtyUnits`).text(this.fmtQty(uds));
        $(`#${o.id}_qtyCats`).text(cats);
        $(`#${o.id}_cntProductos`).text(lote.length);
    }

    syncLimpiar() {
        $(`#${this.opts.id}_btnLimpiarLote`).toggleClass('hidden', !this.filasConContenido().length);
    }

    // Un producto que llega de fuera (addProducto) entra en la fila vacía del final.
    addOrIncrement(prod, qty) {
        if (this.conMontos()) return super.addOrIncrement(prod, qty);

        const ultimo = this.lote.length - 1;
        const idx    = ultimo >= 0 && this.esVacia(this.lote[ultimo]) ? ultimo : this.lote.length;
        const fila   = this.filaProducto(this.filaVacia(), prod, prod.nombre);
        fila.cantidad = Math.max(1, Number(qty) || 1);
        this.lote.splice(idx, 0, fila);
        this.renderLote();
        this.flashRow(idx);
        return idx;
    }

    celda(i, campo) {
        const $lista = $(`#${this.opts.id}_listaProductos`);
        if (campo === 'unidad')   return $lista.find(`input[data-unit-idx="${i}"]`);
        if (campo === 'producto') return $lista.find(`input[data-prod-idx="${i}"]`);
        return $lista.find(`input[data-field="${campo}"][data-idx="${i}"]`);
    }

    focusCelda(i, campo) {
        const $inp = this.celda(i, campo);
        if (!$inp.length) return;
        this.revealRow($inp.closest('tr')[0]);
        $inp.trigger('focus').trigger('select');
    }

    // Columnas de la fila en orden; Unidad solo si hay catálogo de unidades.
    columnasHoja(i) {
        return ['producto', 'cantidad'].concat(this.celda(i, 'unidad').length ? ['unidad'] : [], ['nota']);
    }

    // ← y → salen de la celda cuando ya no hay texto que recorrer hacia ese lado: con todo
    // seleccionado (recién se entró a la celda) o con el cursor en la orilla. En Cantidad
    // (número, sin cursor de texto) siempre salen.
    saleConFlecha(e) {
        if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.shiftKey || e.altKey) return false;

        const el = e.target;
        let ini = null, fin = null;
        try { ini = el.selectionStart; fin = el.selectionEnd; } catch (_) { /* type=number */ }
        if (ini == null) return true;

        const largo = el.value.length;
        if (ini === 0 && fin === largo) return true;
        if (ini !== fin) return false;
        return e.key === 'ArrowLeft' ? ini === 0 : ini === largo;
    }

    // Teclas de la hoja, como en Excel: en Producto, Enter o Tab cierran lo escrito y pasan
    // a la Cantidad de la fila; Tab sigue de Cantidad a Unidad y de Unidad a Observación;
    // ← y → pasan a la columna de al lado. En las demás celdas Enter lleva a la fila nueva
    // del final (en Producto); ↑ y ↓ suben o bajan a la misma columna y bajar desde la
    // última fila con producto crea otra. Con Ctrl van los atajos (atajoHoja).
    navegarHoja(e, i, campo) {
        if (e.ctrlKey || e.metaKey) { this.atajoHoja(e, i, campo); return; }

        const tab = e.key === 'Tab' && !e.shiftKey;
        if (campo === 'producto' && (e.key === 'Enter' || tab)) {
            this.resolverProducto(i, this.eleccionActiva(i));
            if (!this.esVacia(this.lote[i])) {
                e.preventDefault();
                this.focusCelda(i, 'cantidad');
                return;
            }
            if (tab) return;
        }

        const cols = this.columnasHoja(i);
        if (tab && (campo === 'cantidad' || campo === 'unidad')) {
            e.preventDefault();
            this.focusCelda(i, cols[cols.indexOf(campo) + 1]);
        } else if (this.saleConFlecha(e)) {
            // En la primera o última columna no se mueve, y la celda sigue lista para ← o →.
            e.preventDefault();
            const destino = cols[cols.indexOf(campo) + (e.key === 'ArrowRight' ? 1 : -1)];
            if (!destino) return;
            this.resolverProducto(i, this.eleccionActiva(i));
            this.focusCelda(i, destino);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.resolverProducto(i, this.eleccionActiva(i));
            this.asegurarVacia();
            this.focusCelda(this.lote.length - 1, 'producto');
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            this.resolverProducto(i, this.eleccionActiva(i));
            const destino = i + (e.key === 'ArrowDown' ? 1 : -1);
            if (destino >= 0 && destino < this.lote.length) this.focusCelda(destino, campo);
        }
    }

    // Ctrl+Supr quita la fila y Ctrl+D copia la celda de arriba. Ctrl+S y Ctrl+Enter
    // (guardar) los atiende la captura completa (bindEvents).
    atajoHoja(e, i, campo) {
        if (e.key === 'Delete') {
            e.preventDefault();
            this.quitarFila(i, campo);
        } else if (e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            this.copiarDeArriba(i, campo);
        }
    }

    // La fila vacía del final no se quita: la hoja siempre termina en una. El cursor se
    // queda en la misma columna de la fila que sube.
    quitarFila(i, campo) {
        if (i === this.lote.length - 1 && this.esVacia(this.lote[i])) return;

        this.removeProducto(i);
        this.focusCelda(Math.min(i, this.lote.length - 1), campo);
    }

    // Como Ctrl+D de Excel: la Cantidad, Unidad u Observación de la fila de arriba. El
    // Producto no se copia (sería el mismo material dos veces).
    copiarDeArriba(i, campo) {
        const arriba = this.lote[i - 1];
        if (!arriba || campo === 'producto') return;

        if (campo === 'unidad') {
            this.selectUnit(i, arriba.unit_id);
            this.unitInput(i).trigger('select');
            return;
        }
        const valor = campo === 'cantidad' ? (arriba.cantidad ?? '') : (arriba.nota || '');
        this.celda(i, campo).val(valor).trigger('input').trigger('select');
    }

    // Lo escrito en Producto que aún no se elige (para guardar sin salir de la celda).
    resolverPendientes() {
        this.lote.forEach((p, i) => {
            if (p && p._pendiente != null) this.resolverProducto(i, this.eleccionActiva(i));
        });
    }

    // Cantidad y Observación (input[data-field]) usan las teclas de la hoja; Compras, las de Entradas.
    onRowKeydown(e) {
        if (this.conMontos()) { super.onRowKeydown(e); return; }

        const $inp = $(e.currentTarget);
        this.navegarHoja(e, Number($inp.attr('data-idx')), $inp.attr('data-field'));
    }

    // -- Coincidencias --

    // Palabras que no sirven para buscar: «aceite de oliva» busca por aceite y oliva.
    static get VACIAS() {
        return ['de', 'del', 'la', 'las', 'el', 'los', 'con', 'sin', 'para', 'por', 'y', 'a', 'al', 'en', 'un', 'una'];
    }

    // Palabras para comparar: sin acentos ni mayúsculas y con números y letras separados
    // («355ml» = 355 ml, «3lt» = 3 lt).
    palabras(texto) {
        return this.normTxt(texto).replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2').split(' ').filter(Boolean);
    }

    // Las que buscan: sin «de», «la»... y de al menos dos letras (los números siempre).
    palabrasClave(texto) {
        return this.palabras(texto).filter(w => !OrdenForm.VACIAS.includes(w) && (w.length >= 2 || /^\d+$/.test(w)));
    }

    nombreDe(p) {
        return this.palabras(p.nombre);
    }

    // SKU, sobrenombres (Descripción del Catálogo), equivalencia y presentación.
    apodosDe(p) {
        return this.palabras(`${p.sku || ''} ${p.descripcion || ''} ${p.equivale || ''} ${p.presentacion || ''}`);
    }

    // La palabra tal cual o su plural (3), lo escrito completo al inicio de una palabra del
    // producto (2: «acei» → aceite) o la palabra completa con un error de dedo (1:
    // «mermlada» → mermelada; ver toleranciaHoja). Se compara contra la palabra entera y no
    // contra su inicio: así «bimbo» no encuentra BIMBUEÑUELOS.
    puntosPalabra(w, palabras) {
        const plural = (a, b) => a === `${b}s` || a === `${b}es`;
        if (palabras.some(x => x === w || plural(w, x) || plural(x, w))) return 3;
        if (w.length >= 3 && !/^\d+$/.test(w) && palabras.some(x => x.startsWith(w))) return 2;

        const tope = this.toleranciaHoja(w);
        if (tope && palabras.some(x => !/^\d+$/.test(x) && Math.abs(x.length - w.length) <= tope && this.distanciaLetras(w, x) <= tope)) return 1;
        return 0;
    }

    // Errores de dedo que se le perdonan a una palabra según su largo: ninguno con menos de
    // 4 letras ni en los números, uno hasta 7 letras y dos desde 8.
    toleranciaHoja(w) {
        if (w.length < 4 || /^\d+$/.test(w)) return 0;
        return w.length >= 8 ? 2 : 1;
    }

    // Letras que hay que cambiar, poner, quitar o voltear (dos juntas) para pasar de una
    // palabra a otra: «mermlada» → mermelada = 1, «ligth» → light = 1.
    distanciaLetras(a, b) {
        const d = [];
        for (let i = 0; i <= a.length; i++) d[i] = [i];
        for (let j = 0; j <= b.length; j++) d[0][j] = j;

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
            }
        }
        return d[a.length][b.length];
    }

    // Los productos del Catálogo que encuentran más palabras de lo escrito (los que
    // encuentran menos no salen: con «pan blanco chico integral» solo queda PAN BLANCO
    // CHICO). Entre ellos va primero el de palabras tal cual en el nombre (en el nombre
    // valen el doble que en los sobrenombres), luego el que más se parece completo (más de
    // su nombre escrito) y luego el nombre más corto. El SKU exacto gana siempre.
    coincidencias(texto) {
        const buscadas = this.palabrasClave(texto);
        if (!buscadas.length) return [];

        const sku   = this.normTxt(texto);
        const filas = (this.opts.json || []).map((p) => {
            if (p.sku && this.normTxt(p.sku) === sku) return { p, n: Infinity, puntos: Infinity, cubre: 1 };

            const nombre = this.nombreDe(p);
            const apodos = this.apodosDe(p);
            const usadas = new Set();
            let n = 0, puntos = 0;
            buscadas.forEach((w) => {
                const enNombre = this.puntosPalabra(w, nombre);
                const enApodo  = this.puntosPalabra(w, apodos);
                if (!enNombre && !enApodo) return;
                n++;
                puntos += Math.max(enNombre * 2, enApodo);
                nombre.forEach((x, k) => { if (this.puntosPalabra(w, [x])) usadas.add(k); });
            });
            return { p, n, puntos, cubre: nombre.length ? usadas.size / nombre.length : 0 };
        }).filter(x => x.n > 0);

        if (!filas.length) return [];
        const mejor = Math.max(...filas.map(x => x.n));
        return filas
            .filter(x => x.n === mejor)
            .sort((a, b) => b.puntos - a.puntos || b.cubre - a.cubre || String(a.p.nombre).length - String(b.p.nombre).length)
            .slice(0, 8)
            .map(x => x.p);
    }

    // Lo escrito que no está en el producto elegido: con «aceite patrona» y ACEITE queda
    // «patrona», que se guarda como descripción en la Observación de la fila.
    restoDe(texto, prod) {
        const conocidas = this.nombreDe(prod).concat(this.apodosDe(prod));
        return String(texto || '').split(/\s+/)
            .filter((w) => {
                const partes = this.palabras(w);
                return partes.length && !partes.some(x => this.puntosPalabra(x, conocidas) > 0);
            })
            .join(' ');
    }

    // Lista bajo la celda Producto: queda marcado el que más se parece y es el que se elige
    // solo; al final, dejar lo escrito como nota. Sin coincidencias solo queda la nota.
    renderCoincidencias(items, texto) {
        const l    = this.opts.labels;
        const head = items.length
            ? `<div class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/50 border-b border-gray-200 text-[11px] font-semibold text-gray-600 truncate"><i data-lucide="search" class="w-3 h-3 text-blue-600 flex-shrink-0"></i>${this.esc(l.coincidenPara)} "${this.esc(texto)}"</div>`
            : `<div class="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50/70 border-b border-gray-200 text-[11px] font-semibold text-amber-700"><i data-lucide="search-x" class="w-3 h-3 flex-shrink-0"></i>${this.esc(l.sinCoincidencias)}</div>`;
        const sep  = '<span class="text-gray-300"> &middot; </span>';
        const filas = items.map((p, k) => `
            <div class="ef-cat-item px-3 py-2 cursor-pointer hover:bg-blue-50/60 border-b border-gray-100 transition-all" data-pick-idx="${k}">
                <div class="flex items-center gap-2 min-w-0"><p class="text-xs font-semibold text-gray-800 truncate">${this.esc(p.nombre)}</p>${this.renderPresentacion(p)}</div>
                <p class="text-[10px] text-gray-500 truncate mt-0.5">${[p.sku ? `<span class="font-mono">${this.esc(p.sku)}</span>` : '', p.categoria ? this.esc(p.categoria) : ''].filter(Boolean).join(sep)}</p>
            </div>`).join('');
        const nota = `
            <div class="ef-cat-item flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-amber-50 text-[11px] font-semibold text-amber-700 transition-all" data-pick-idx="${items.length}">
                <i data-lucide="sticky-note" class="w-3.5 h-3.5 flex-shrink-0"></i><span class="truncate">${this.esc(l.comoNota)}: "${this.esc(texto)}"</span>
            </div>`;
        const pie = `
            <div class="flex items-center gap-1 px-3 py-1.5 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-400">
                <span class="ef-kbd">&crarr;</span>${this.esc(l.elegir)}<span class="ef-kbd ml-1.5">esc</span>${this.esc(l.deshacer)}
            </div>`;
        return `${head}<div class="max-h-[260px] overflow-y-auto cs-scroll ef-scroll">${filas}${nota}</div>${pie}`;
    }

    // Mientras se escribe en Producto se buscan las coincidencias; la que más se parece
    // queda marcada y es la que se elige al salir de la celda.
    escribirProducto(i, valor) {
        const p = this.lote[i];
        if (!p) return;
        p._pendiente = String(valor);

        const texto = p._pendiente.trim();
        if (!texto) { this.closeFloat(); return; }

        const items = this.coincidencias(texto);
        this.openFloat({
            kind:     'prod',
            idx:      i,
            items:    items.concat([{ nota: true }]),
            active:   0,
            $anchor:  $(`#${this.opts.id}_listaProductos [data-prod-box="${i}"]`),
            minWidth: 420
        }, this.renderCoincidencias(items, texto));
    }

    // Lo marcado en la lista de la fila: un producto, 'nota' o null (la que más se parece).
    eleccionActiva(i) {
        const f = this.float;
        if (!f || f.kind !== 'prod' || f.idx !== i) return null;
        const item = f.items[f.active];
        return item && item.nota ? 'nota' : (item || null);
    }

    // Escape deshace lo escrito; con la lista abierta las flechas la recorren. Lo demás,
    // las teclas de la hoja.
    onProductoKeydown(e, i) {
        const p = this.lote[i];
        if (e.key === 'Escape' && p && p._pendiente != null) {
            e.preventDefault();
            e.stopPropagation();
            p._pendiente = null;
            this.closeFloat();
            $(e.currentTarget).val(this.valorProducto(p)).trigger('select');
            return;
        }

        const f = this.float;
        if (f && f.kind === 'prod' && f.idx === i && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            this.onFloatKeydown(e);
            return;
        }
        this.navegarHoja(e, i, 'producto');
    }

    // Cierra lo escrito en Producto: con coincidencia la fila toma ese producto del Catálogo
    // (lo que sobra de lo escrito va a la Observación); sin coincidencia, o si se eligió
    // dejarlo como nota, queda el texto y al guardar se va a la nota de la requisición.
    // Borrar el texto deja la fila vacía.
    resolverProducto(i, eleccion = null) {
        const p = this.lote[i];
        if (!p || p._pendiente == null) return;

        const texto = p._pendiente.trim();
        if (this.float && this.float.kind === 'prod' && this.float.idx === i) this.closeFloat();

        let fila;
        if (!texto || eleccion === 'nota') {
            fila = this.filaLibre(p, texto);
        } else {
            const prod = eleccion || this.coincidencias(texto)[0];
            fila = prod ? this.filaProducto(p, prod, texto) : this.filaLibre(p, texto);
        }

        this.lote[i] = fila;
        this.refrescarFila(i);
        this.asegurarVacia();
        this.updateTotals();
        this.syncLimpiar();
    }

    // La unidad es la del producto salvo que se haya elegido a mano. La Observación toma lo
    // que sobró de lo escrito mientras nadie la haya cambiado.
    filaProducto(p, prod, texto) {
        const resto = this.restoDe(texto, prod);
        const auto  = !p.nota || p.nota === p._notaAuto;
        return Object.assign({}, prod, this.seedTax(prod), {
            cantidad:      p.cantidad || 1,
            unit_id:       p._unidadManual ? p.unit_id : (prod.unit_id || p.unit_id || null),
            _unidadManual: p._unidadManual,
            nota:          auto ? resto : p.nota,
            _notaAuto:     auto ? resto : (p._notaAuto || '')
        });
    }

    // Sin producto: se queda lo escrito, la cantidad (1 si hay texto y no tenía), la unidad
    // elegida a mano y la observación propia (la que puso el producto anterior se quita).
    filaLibre(p, texto) {
        const auto = !p.nota || p.nota === p._notaAuto;
        return {
            libre:         true,
            texto:         texto,
            cantidad:      texto ? (p.cantidad || 1) : p.cantidad,
            unit_id:       p._unidadManual || !p.id ? p.unit_id : null,
            _unidadManual: p._unidadManual,
            nota:          auto ? '' : p.nota
        };
    }

    // Lo que no tuvo coincidencia en el Catálogo va a la nota de la requisición, en una
    // línea: «Sin catálogo: 2 PZA aceite patrona; 1 cloro azul (urgente)».
    notaConLibres(nota, libres) {
        if (!libres.length) return nota;

        const lineas = libres.map((p) => {
            const obs = String(p.nota || '').trim();
            return [this.fmtQty(p.cantidad || 1), this.unidadTexto(p.unit_id), p.texto.trim()].filter(Boolean).join(' ') + (obs ? ` (${obs})` : '');
        });
        return [String(nota || '').trim(), `${this.opts.labels.sinCatalogo}: ${lineas.join('; ')}`].filter(Boolean).join('\n');
    }

    // Nota por producto para quien surte en Compras: ícono al final del subtotal. Con nota va
    // marcado y la muestra al pasar el mouse; el clic abre la edición (editNota). En la
    // requisición la nota es la celda Observación de la hoja.
    renderSubtotalExtra(p, i) {
        const nota = String(p.nota || '');
        return `
            <button type="button" tabindex="-1" data-nota-idx="${i}" title="${this.esc(nota || this.opts.labels.notaProducto)}"
                class="ml-1.5 inline-flex align-middle w-6 h-6 rounded-md items-center justify-center transition-colors ${nota ? 'text-blue-600 bg-blue-50' : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'}">
                <i data-lucide="${nota ? 'message-square-text' : 'message-square'}" class="w-3.5 h-3.5"></i>
            </button>`;
    }

    editNota(idx) {
        const p = this.lote[idx];
        if (!p || !this.tpl) return;

        const o = this.opts;
        this.tpl.alertBox({
            type:             'confirm',
            title:            o.labels.notaProductoTit,
            detailHtml:       this.esc(p.nombre),
            input:            'textarea',
            inputValue:       p.nota || '',
            inputPlaceholder: o.labels.notaProductoPh,
            inputValidator:   (v) => v.length > 255 ? o.labels.notaProductoMax : null,
            okLabel:          o.labels.notaProductoOk,
            cancelLabel:      o.labels.cancelar,
            onOk: (value) => {
                p.nota = value || '';
                this.renderLote();
            }
        });
    }

    // -- Buscador --

    // Resultados en este orden: 1) el nombre empieza con lo buscado, 2) lo trae en medio,
    // 3) al final (o solo en SKU / sobrenombres) y 4) los parecidos ("tal vez quisiste decir").
    matchCatalogo(term) {
        const t = this.normTxt(term);
        if (!t) return [];

        const grupo = (p) => {
            const nombre = this.normTxt(p.nombre);
            const pos    = nombre.indexOf(t);
            if (pos === 0) return 0;
            if (pos > 0 && !nombre.endsWith(t)) return 1;
            return 2;
        };

        const exactos = super.matchCatalogo(term)
            .map((p, k) => ({ p, g: grupo(p), k }))
            .sort((a, b) => a.g - b.g || a.k - b.k)
            .map(x => x.p);

        return exactos.concat(this.sugerirCatalogo(term).filter(p => !exactos.includes(p)));
    }

    // Etiqueta con la presentación del producto; sin presentación no se pinta. Va pegada al
    // nombre, a la izquierda, y no al extremo del resultado: lejos del nombre se pierde.
    renderPresentacion(p) {
        const pres = this.presentacionDe(p);
        if (!pres) return '';

        return `<span class="inline-flex items-center flex-shrink-0 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold leading-none tracking-wide">${this.esc(pres)}</span>`;
    }

    // Igual que en Entradas pero sin el stock: el pedido no lleva almacén. A la derecha va el
    // costo de referencia; el pedido no lo lleva y muestra la presentación junto al nombre.
    renderSearchResult(p, i, term) {
        const o        = this.opts;
        const m        = this.conMontos();
        const costoFmt = Number(p.costo || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const nombre   = `<p class="text-xs font-semibold text-gray-800 truncate">${this.esc(p.nombre)}</p>`;
        return `
            <div class="ef-cat-item flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50/60 border-b border-gray-100 last:border-b-0 transition-all group" data-add-id="${this.esc(p.id)}" data-cat-idx="${i}">
                ${this.prodThumb(p, 'w-9 h-9', 'w-4 h-4')}
                <div class="flex-1 min-w-0">
                    ${m ? nombre : `<div class="flex items-center gap-2 min-w-0">${nombre}${this.renderPresentacion(p)}</div>`}
                    <p class="text-[10px] text-gray-500 truncate mt-0.5">
                        <span class="font-mono">${this.esc(p.sku)}</span>${p.categoria ? `<span class="text-gray-300"> &middot; </span>${this.esc(p.categoria)}` : ''}
                    </p>
                    ${this.equivaleHtml(p)}
                    ${this.coincidenciaHtml(p, term)}
                </div>
                ${m ? `
                <div class="text-right flex-shrink-0">
                    <p class="text-[10px] text-gray-400 leading-none">${this.esc(o.labels.costoRefLbl)}</p>
                    <p class="text-xs font-bold text-gray-700 mt-0.5">$${costoFmt}</p>
                </div>` : ''}
                <div class="ef-add-btn w-7 h-7 rounded-lg bg-gray-100 border border-gray-200 text-gray-400 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                </div>
            </div>`;
    }

    // -- Proveedor --

    // El pedido no lleva proveedor: no hay celda que mostrar u ocultar.
    syncProveedorVisibility() {}

    // -- Eventos --

    bindEvents() {
        super.bindEvents();
        const id = this.opts.id;

        // Sin comprobante: soltar un archivo no hace nada (y no abre el archivo en la pestaña).
        this.wrap.off('dragenter dragleave drop');
        this.wrap.on('drop', (e) => e.preventDefault());

        // Cancelar y Escape no cierran a ciegas: con materiales capturados preguntan si se
        // guarda como borrador o se sale (requestClose).
        this.wrap.off('click', '[data-modal-close]').on('click', '[data-modal-close]', () => this.requestClose());

        // Unidad: al escribir se filtra la lista y la flecha (o Alt+↓) la abre; al salir del
        // campo sin elegir vuelve a decir la unidad que tenía.
        const unitIdx = (e) => Number($(e.currentTarget).attr('data-unit-idx'));
        this.wrap.on('input',   'input[data-unit-idx]', (e) => this.openUnitList(unitIdx(e), true));
        this.wrap.on('keydown', 'input[data-unit-idx]', (e) => this.onUnitKeydown(e, unitIdx(e)));
        this.wrap.on('focusout', 'input[data-unit-idx]', (e) => {
            const p = this.lote[unitIdx(e)];
            if (this.float && this.float.kind === 'unit') this.closeFloat();
            if (p) $(e.currentTarget).val(this.unidadTexto(p.unit_id));
        });
        this.wrap.on('mousedown', '[data-unit-toggle]', (e) => e.preventDefault());
        this.wrap.on('click', '[data-unit-toggle]', (e) => this.toggleUnitList(Number($(e.currentTarget).attr('data-unit-toggle'))));
        this.wrap.on('click', '[data-unit-val]', (e) => {
            if (this.float && this.float.kind === 'unit') this.selectUnit(this.float.idx, $(e.currentTarget).attr('data-unit-val'));
        });

        this.wrap.on('click', '[data-nota-idx]', (e) => this.editNota(Number($(e.currentTarget).attr('data-nota-idx'))));

        // Producto de la hoja: al escribir salen las coincidencias y al salir de la celda se
        // elige la marcada. La lista no le quita el foco a la celda (mousedown en #_float),
        // así el clic en una opción sí cuenta.
        const prodIdx = (e) => Number($(e.currentTarget).attr('data-prod-idx'));
        this.wrap.on('input',    'input[data-prod-idx]', (e) => this.escribirProducto(prodIdx(e), e.currentTarget.value));
        this.wrap.on('keydown',  'input[data-prod-idx]', (e) => this.onProductoKeydown(e, prodIdx(e)));
        this.wrap.on('focusout', 'input[data-prod-idx]', (e) => this.resolverProducto(prodIdx(e), this.eleccionActiva(prodIdx(e))));

        // Como en Excel, al entrar a Producto, Cantidad o Unidad se selecciona lo que dice y
        // escribir lo reemplaza; el mouseup del mismo clic no deshace la selección.
        const seleccionables = 'input[data-prod-idx], input[data-field="cantidad"], input[data-unit-idx]';
        this.wrap.on('focusin', seleccionables, (e) => {
            if (this.conMontos()) return;
            e.currentTarget.select();
            this.focoCelda = { el: e.currentTarget, t: Date.now() };
        });
        this.wrap.on('mouseup', seleccionables, (e) => {
            const f = this.focoCelda;
            if (f && f.el === e.currentTarget && Date.now() - f.t < 400) e.preventDefault();
        });
        this.wrap.on('click', '[data-pick-idx]', (e) => {
            const f = this.float;
            if (!f || f.kind !== 'prod') return;
            const item = f.items[Number($(e.currentTarget).attr('data-pick-idx'))];
            this.resolverProducto(f.idx, item && item.nota ? 'nota' : item);
        });

        // Desde cualquier parte de la captura: Ctrl+S guarda como borrador y Ctrl+Enter
        // guarda y envía a revisión, con la confirmación de siempre (al editar, los dos
        // guardan los cambios). Con una alerta encima no hacen nada.
        $(document).off(`keydown.hoja_${id}`).on(`keydown.hoja_${id}`, (e) => {
            if (this.conMontos() || this.wrap.hasClass('hidden') || !(e.ctrlKey || e.metaKey)) return;

            const guardar = e.key === 's' || e.key === 'S';
            if (!guardar && e.key !== 'Enter') return;
            e.preventDefault();
            if (e.repeat || this.hasOverlay()) return;

            this.resolverPendientes();
            this.doRegistrar(!guardar);
        });
    }

    // -- Abrir --

    // EntradaForm topa la fecha en hoy; el pedido puede ser para más adelante. La hoja
    // arranca en el Producto de su fila vacía.
    open() {
        super.open();
        $(`#${this.opts.id}_inpFecha`).removeAttr('max');
        if (!this.conMontos()) setTimeout(() => this.focusCelda(this.lote.length - 1, 'producto'), 60);
    }

    // `status` = el del pedido: si es Borrador, al cerrar se ofrece guardarlo en ese mismo.
    openEdit(orden) {
        super.openEdit(orden);
        $(`#${this.opts.id}_inpFecha`).removeAttr('max');

        this.editing.borrador = orden.status === 'Borrador';
        this.huellaInicial    = this.huella();
        if (!this.conMontos()) setTimeout(() => this.focusCelda(this.lote.length - 1, 'producto'), 60);
    }

    // Lo capturado en texto: dice si el borrador abierto cambió (la fila vacía no cuenta).
    huella() {
        const id = this.opts.id;
        return JSON.stringify([
            this.filasConContenido().map(p => [p.id || '', p.texto || '', Number(p.cantidad || 0), Number(p.costo || 0), p.unit_id || '', p.nota || '']),
            $(`#${id}_selSucursal`).val(),
            $(`#${id}_inpFecha`).val(),
            $(`#${id}_inpNota`).val()
        ]);
    }

    // -- Guardar --

    // La fecha de una orden nueva no puede ser de hace más de un mes; al editar una orden
    // vieja se respeta la suya.
    setMode(orden) {
        super.setMode(orden);

        const $fecha = $(`#${this.opts.id}_inpFecha`);

        if (orden) $fecha.removeAttr('min');
        else       $fecha.attr('min', this.haceUnMes());
    }

    haceUnMes() {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // Con materiales: guardar como borrador o salir. Un borrador abierto se guarda en
    // ese mismo (y si no cambió, solo se cierra); otro pedido abierto, o sin
    // materiales, se queda con el comportamiento de siempre.
    requestClose() {
        if (!this.filasConContenido().length) { this.closeModal(); return; }

        if (this.editing) {
            if (!this.editing.borrador)               { super.requestClose(); return; }
            if (this.huella() === this.huellaInicial) { this.closeModal(); return; }
        }

        const o = this.opts;

        this.confirmBox(this.editing ? o.labels.confirmSalirBorrador : o.labels.confirmSalir, () => this.saveDraft(), {
            type:        'confirm',
            okLabel:     o.labels.borrador,
            cancelLabel: o.labels.salir,
            onCancel:    () => this.closeModal()
        });
    }

    saveDraft() {
        const payload = this.buildPayload(false);

        if (!payload) return;

        (this.editing ? this.opts.onUpdate : this.opts.onAdd)(payload);
        this.closeModal();
    }

    // submit = true envía a revisión (Solicitada); false la deja en Borrador.
    // Al editar no cambia el estado.
    doRegistrar(submit = true) {
        const payload = this.buildPayload(submit);

        if (payload) this.confirmRegistrar(payload);
    }

    // Revisa lo capturado y arma lo que se manda; null (con aviso) si algo falta. Se mandan
    // las filas con producto del Catálogo; lo escrito sin coincidencia va en la nota (que
    // en la base es de 255 caracteres) y necesita al menos un producto que acompañe.
    buildPayload(submit) {
        const o      = this.opts;
        const filas  = this.filasConContenido();
        const lote   = filas.filter(p => p.id);
        const libres = filas.filter(p => !p.id);
        if (!lote.length) { this.notify(libres.length ? o.labels.soloNotas : 'Agrega al menos un material al pedido'); return null; }

        const fecha = $(`#${o.id}_inpFecha`).val();
        if (!fecha) {
            this.notify(o.labels.fechaReq);
            return null;
        }
        if (!this.editing && fecha < this.haceUnMes()) {
            this.notify(o.labels.fechaVieja);
            return null;
        }

        const nota = this.notaConLibres($(`#${o.id}_inpNota`).val() || '', libres);
        if (libres.length && nota.length > 255) {
            this.notify(o.labels.notaLarga);
            return null;
        }

        return {
            id:                    this.editing ? this.editing.id : null,
            submit:                !this.editing && submit,
            destination_branch_id: $(`#${o.id}_selSucursal`).val() || '',
            date_order:            fecha,
            note:                  nota,
            productos: lote.map(p => ({
                product_id:        p.id,
                quantity:          Number(p.cantidad || 0),
                cost:              Number(p.costo || 0),
                price_without_tax: Number(p.costoSinTax || 0),
                tax:               Number(p.tax || 0),
                unit_id:           p.unit_id || null,
                note:              p.nota || ''
            }))
        };
    }

    // "¿Deseas crear la requisición de la sucursal X para el día viernes 17 de octubre del 2026?"
    confirmCrearTexto(payload) {
        const dias     = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const meses    = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const m        = String(payload.date_order || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        const sucursal = ((this.opts.data && this.opts.data.sucursales) || []).find(s => String(s.id) === String(payload.destination_branch_id));

        if (!m || !sucursal) return this.opts.labels.confirmAdd;

        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        // El alertBox pinta el título como HTML; sucursal y fecha van escapadas y en el color del tema.
        const tema  = 'style="color:rgb(var(--brand-600, 192 90 64))"';
        const fecha = `${dias[d.getDay()]} ${Number(m[3])} de ${meses[Number(m[2]) - 1]} del ${m[1]}`;
        return `¿Deseas crear la requisición de la sucursal <span ${tema}>${this.esc(sucursal.valor)}</span> para el día <span ${tema}>${this.esc(fecha)}</span>?`;
    }

    confirmRegistrar(payload) {
        const o       = this.opts;
        const editing = !!this.editing;

        const title = editing ? o.labels.confirmEdit   : (payload.submit ? this.confirmCrearTexto(payload) : o.labels.confirmDraft);
        const okLbl = editing ? o.labels.confirmEditOk : (payload.submit ? o.labels.confirmAddOk : o.labels.confirmDraftOk);

        this.confirmBox(title, () => {
            (editing ? o.onUpdate : o.onAdd)(payload);
            this.closeModal();
        }, {
            type:    'confirm',
            okLabel: okLbl,
            okIcon:  'check',
            focusOk: true
        });
    }
}


Templates.prototype.ordenForm = function (options) {
    const form = new OrdenForm(options);
    // Referencia al Templates para reutilizar componentes propios (alertBox).
    form.tpl = this;
    return form;
};
