// Captura de un pedido a sucursal con el mismo formato que la de Entradas (EntradaForm):
// buscador y renglón vacío con ↓. Cambia lo propio del pedido: "Solicitar a" y la fecha en
// que se necesitan los insumos; sin almacén (lo elige quien surte al aprobar), sin stock,
// costos de solo lectura, sin formatos, sin alta de productos ni comprobante. Se guarda
// como borrador o se envía a revisión. Se adapta a tablet y teléfono.
// Requiere entrada-form.js cargado antes.
class OrdenForm extends EntradaForm {

    constructor(options) {
        const o = options || {};
        super(Object.assign({}, o, {
            id:     o.id || 'ordenFormModal',
            labels: Object.assign({}, OrdenForm.LABELS, o.labels || {})
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

    // -- Render estático --

    // Solo a quién se le pide y para cuándo: el almacén lo elige quien surte al aprobar.
    // Cada campo ocupa col-3 en computadora y la mitad en tablet (en col-3 el select y la
    // etiqueta de la fecha no caben), alineados por abajo. El aviso de sucursal propia
    // solo sale en el formulario previo de "Nuevo pedido" (ordenes.js).
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

    // El pedido no lleva formatos.
    renderFormatosControls() {
        return '';
    }

    // Nota y botones; en teléfono los botones bajan a su propio renglón.
    renderFooter() {
        return `
            <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                ${this.renderNotaInput()}
                ${this.renderFooterActions()}
            </div>`;
    }

    // El ícono de nota va dentro del campo, no a un lado.
    renderNotaInput() {
        const o   = this.opts;
        const cls = this.cls;
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
            <div class="flex gap-2 flex-shrink-0">
                <button class="${cls.btnOut} flex-1 sm:flex-none justify-center !text-red-600 hover:!text-red-700" data-modal-close>${this.esc(o.labels.cancelar)}</button>
                <button id="${o.id}_btnRegistrar" class="${cls.btnOk} flex-1 sm:flex-none justify-center">
                    <i data-lucide="send" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.registrar)}</span>
                </button>
            </div>`;
    }

    // Mismos totales que Entradas (los ids los llena updateTotals); en tablet y teléfono
    // se quedan Productos, Unidades y Costo total.
    renderResumen() {
        const o = this.opts;
        return `
            <div class="cs-captura-resumen flex-shrink-0 border-t border-gray-200 px-5 py-2.5 bg-gray-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <div class="flex items-center gap-4 text-[11px] text-gray-500">
                    <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Productos <strong class="text-gray-800 text-sm" id="${o.id}_qtyItems">0</strong></span>
                    <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>${this.esc(o.labels.unidadesLbl)} <strong class="text-gray-800 text-sm" id="${o.id}_qtyUnits">0</strong> uds</span>
                    <span class="hidden sm:flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>${this.esc(o.labels.categoriasLbl)} <strong class="text-gray-800 text-sm" id="${o.id}_qtyCats">0</strong></span>
                </div>
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
                </div>
            </div>`;
    }

    // -- Tabla de productos --

    // Sin stock y con los costos de solo lectura (salen del catálogo). Ancho fijo para que
    // las columnas no se muevan al teclear una cantidad. En tablet se ocultan SKU, costo
    // sin impuesto e impuesto; en teléfono también el costo y la miniatura: quedan
    // Producto (el nombre en hasta dos renglones), Cantidad y Subtotal.
    renderProductsTable() {
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

    renderProductRow(p, i) {
        const cant  = Number(p.cantidad || 0);
        const costo = Number(p.costo || 0);
        const tax   = Number(p.tax || 0);
        const base  = (p.costoSinTax != null && p.costoSinTax !== '') ? Number(p.costoSinTax) : this.baseFromCost(costo, tax);
        return `
            <tr class="border-b border-gray-100 last:border-b-0 hover:bg-blue-100/60 transition-colors" data-idx="${i}">
                <td class="hidden lg:table-cell px-3 py-2 align-middle">
                    <span class="block truncate text-[11px] font-mono text-gray-500" title="${this.esc(p.sku)}">${this.esc(p.sku)}</span>
                </td>
                <td class="px-3 py-2 align-middle">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="hidden sm:inline-flex">${this.prodThumb(p, 'w-8 h-8', 'w-3.5 h-3.5')}</span>
                        <div class="min-w-0">
                            <p class="text-xs font-semibold text-gray-800 leading-tight line-clamp-2 sm:line-clamp-none sm:truncate">${this.esc(p.nombre)}</p>
                            ${p.categoria ? `<p class="text-[10px] text-gray-400 truncate mt-0.5">${this.esc(p.categoria)}</p>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-2 py-2 align-middle">
                    <input type="number" min="1" step="0.01" value="${cant}" class="${this.cls.qtyInp}" data-field="cantidad" data-idx="${i}">
                </td>
                <td class="hidden md:table-cell px-2 py-2 align-middle text-right text-xs text-gray-600">${this.fmtMoney(costo)}</td>
                <td class="hidden lg:table-cell px-2 py-2 align-middle text-right text-xs text-gray-600">${this.fmtMoney(base)}</td>
                <td class="hidden lg:table-cell px-2 py-2 align-middle text-center text-xs text-gray-600">${this.fmtQty(tax)}%</td>
                <td class="px-2 md:px-3 py-2 align-middle text-right whitespace-nowrap">
                    <span class="text-green-700 font-bold text-xs" data-subtotal>${this.fmtMoney(cant * costo)}</span>${this.renderSubtotalExtra(p, i)}
                </td>
                <td class="px-2 py-2 align-middle text-center">
                    <button class="w-6 h-6 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" data-remove="${i}" title="Eliminar">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                </td>
            </tr>`;
    }

    // Renglón vacío (↓): mismas columnas que la tabla, para que se oculten igual.
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

    // Nota por producto para quien surte: ícono al final del subtotal. Con nota va
    // marcado y la muestra al pasar el mouse; el clic abre la edición (editNota).
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

    // Igual que en Entradas pero sin el stock: el pedido no lleva almacén.
    renderSearchResult(p, i, term) {
        const o        = this.opts;
        const costoFmt = Number(p.costo || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `
            <div class="ef-cat-item flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50/60 border-b border-gray-100 last:border-b-0 transition-all group" data-add-id="${this.esc(p.id)}" data-cat-idx="${i}">
                ${this.prodThumb(p, 'w-9 h-9', 'w-4 h-4')}
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-gray-800 truncate">${this.esc(p.nombre)}</p>
                    <p class="text-[10px] text-gray-500 truncate mt-0.5">
                        <span class="font-mono">${this.esc(p.sku)}</span>${p.categoria ? `<span class="text-gray-300"> &middot; </span>${this.esc(p.categoria)}` : ''}
                    </p>
                    ${this.coincidenciaHtml(p, term)}
                </div>
                <div class="text-right flex-shrink-0">
                    <p class="text-[10px] text-gray-400 leading-none">${this.esc(o.labels.costoRefLbl)}</p>
                    <p class="text-xs font-bold text-gray-700 mt-0.5">$${costoFmt}</p>
                </div>
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

        this.wrap.on('click', '[data-nota-idx]', (e) => this.editNota(Number($(e.currentTarget).attr('data-nota-idx'))));
    }

    // -- Abrir --

    // EntradaForm topa la fecha en hoy; el pedido puede ser para más adelante.
    open() {
        super.open();
        $(`#${this.opts.id}_inpFecha`).removeAttr('max');
    }

    // `status` = el del pedido: si es Borrador, al cerrar se ofrece guardarlo en ese mismo.
    openEdit(orden) {
        super.openEdit(orden);
        $(`#${this.opts.id}_inpFecha`).removeAttr('max');

        this.editing.borrador = orden.status === 'Borrador';
        this.huellaInicial    = this.huella();
    }

    // Lo capturado en texto: dice si el borrador abierto cambió.
    huella() {
        const id = this.opts.id;
        return JSON.stringify([
            this.lote.map(p => [p.id, Number(p.cantidad || 0), Number(p.costo || 0), p.nota || '']),
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
        if (!this.lote.length) { super.requestClose(); return; }

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

    // Revisa lo capturado y arma lo que se manda; null (con aviso) si algo falta.
    buildPayload(submit) {
        if (!this.lote.length) { this.notify('Agrega al menos un material al pedido'); return null; }
        const o = this.opts;

        const fecha = $(`#${o.id}_inpFecha`).val();
        if (!fecha) {
            this.notify(o.labels.fechaReq);
            return null;
        }
        if (!this.editing && fecha < this.haceUnMes()) {
            this.notify(o.labels.fechaVieja);
            return null;
        }

        return {
            id:                    this.editing ? this.editing.id : null,
            submit:                !this.editing && submit,
            destination_branch_id: $(`#${o.id}_selSucursal`).val() || '',
            date_order:            fecha,
            note:                  $(`#${o.id}_inpNota`).val() || '',
            productos: this.lote.map(p => ({
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

    // "¿Deseas crear el pedido de la sucursal X para el día viernes 17 de octubre del 2026?"
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
        return `¿Deseas crear el pedido de la sucursal <span ${tema}>${this.esc(sucursal.valor)}</span> para el día <span ${tema}>${this.esc(fecha)}</span>?`;
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
