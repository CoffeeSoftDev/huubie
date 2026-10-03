const SAMPLE_ENTRADA = {
    json: [
        { id: '1', nombre: 'Café Americano 250g',  sku: 'CAF-001', stock: 12, costo: 85.00,  icon: 'coffee',      bg: 'bg-amber-500/15',  color: 'text-amber-400',  image: '' },
        { id: '2', nombre: 'Té Verde 100g',         sku: 'TE-002',  stock: 3,  costo: 55.50,  icon: 'leaf',        bg: 'bg-green-500/15',  color: 'text-green-400',  image: '' },
        { id: '3', nombre: 'Azúcar Morena 1kg',     sku: 'AZU-003', stock: 0,  costo: 32.00,  icon: 'package',     bg: 'bg-gray-500/15',   color: 'text-gray-400',   image: '' },
        { id: '4', nombre: 'Leche Entera 1L',       sku: 'LEC-004', stock: 24, costo: 28.00,  icon: 'droplets',    bg: 'bg-blue-500/15',   color: 'text-blue-400',   image: '' }
    ],
    data: {
        origenes:   [
            { id: '1', valor: 'Compra',             code: 'COMPRA',     requires_supplier: 1 },
            { id: '2', valor: 'Produccion interna', code: 'PRODUCCION', requires_supplier: 0 },
            { id: '3', valor: 'Transferencia',      code: 'TRANSFER',   requires_supplier: 0 }
        ],
        proveedores: [
            { id: '1', valor: 'Cafe del Valle S.A.' },
            { id: '2', valor: 'Distribuidora Norte' }
        ],
        sucursales: [
            { id: '1', valor: 'Sucursal Centro', branch_id: '1' },
            { id: '2', valor: 'Sucursal Norte',  branch_id: '2' }
        ],
        almacenes:  [
            { id: '1', valor: 'Almacen General', branch_id: '1' },
            { id: '2', valor: 'Almacen Frio',    branch_id: '1' },
            { id: '3', valor: 'Almacen Norte',   branch_id: '2' }
        ],
        fecha:           '2026-06-01',
        branch_id: '1',
        warehouse_id:    '1',
        nota:            ''
    }
};

class EntradaForm {

    constructor(options) {

        this.FORMATOS_KEY = 'huubie_entradaFormatos';

        this.cls = {
            label:   'block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1',
            input:   'w-full px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400',
            select:  'w-full px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all cursor-pointer appearance-none pr-8',
            search:  'w-full pl-8 pr-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400',
            qtyInp:  'no-spin w-full px-3 py-2 text-sm font-bold text-center text-gray-800 bg-white border border-gray-300 rounded outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all',
            cashInp: 'no-spin w-full pl-6 pr-3 py-2 text-sm text-right text-gray-800 bg-white border border-gray-300 rounded outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all',
            btnCancel: 'px-4 py-2 text-xs font-bold text-gray-700 bg-white border-[1px] border-gray-400 rounded-md hover:bg-gray-100 hover:border-gray-500 hover:text-gray-900 transition-all flex items-center gap-1.5',
            btnOk:   'px-4 py-2 text-xs font-bold text-white bg-green-600 rounded-md hover:bg-green-500 hover:shadow-lg transition-all flex items-center gap-1.5',
            btnIco:  'px-2.5 py-1.5 text-[11px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all flex items-center gap-1.5',
            badge:   'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none'
        };

        const defaults = {
            parent: 'body',
            id:     'entradaFormModal',
            class:  'hidden fixed inset-0 z-[100] flex items-center justify-center',
            json:   [],
            data: {
                origenes:        [],
                sucursales:      [],
                almacenes:       [],
                areas:           [],
                categorias:      [],
                unidades:        [],
                proveedores:     [],
                fecha:           '',
                branch_id: '',
                warehouse_id:    '',
                nota:            '',
                impuestos: [
                    { id: '0',  valor: '0%'  },
                    { id: '8',  valor: '8%'  },
                    { id: '16', valor: '16%' }
                ]
            },
            labels: {
                title:        'Nueva Entrada de Stock',
                subtitle:     'Layout Horizontal · Tabla completa',
                origen:       'Tipo de entrada',
                sucursal:     'Sucursal destino',
                almacen:      'Origen',
                destino:      'Destino',
                destinoPh:    'Sin área',
                proveedor:    'Proveedor',
                provPh:       '-- Selecciona proveedor --',
                provNuevo:    'Nuevo',
                provReq:      'Selecciona o crea un proveedor para este origen',
                provModalTit: 'Nuevo proveedor',
                provName:     'Nombre',
                provContact:  'Contacto',
                provPhone:    'Telefono',
                provEmail:    'Correo',
                provNamePh:   'Nombre del proveedor...',
                prodCrear:    'Crear producto',
                prodModalTit: 'Nuevo producto',
                prodName:     'Nombre del producto',
                prodCat:      'Categoría',
                prodCatPh:    'Sin categoría',
                prodUnit:     'Unidad',
                prodUnitPh:   'Sin unidad',
                prodCosto:    'Costo c/imp',
                prodTax:      'Impuesto',
                prodHint:     'El SKU se genera solo. El precio de venta se captura después.',
                prodGuardar:  'Crear y agregar',
                iaSubir:      'Subir con IA',
                fecha:        'Fecha',
                nota:         'Nota (opcional)',
                notaPh:       'Escribe una nota para esta entrada',
                comprobante:  'Comprobante',
                compDrop:     'Arrastra aquí la foto o PDF, o haz clic',
                quitarComp:   'Quitar comprobante',
                buscar:       'Buscar productos',
                placeholder:  'Buscar productos por nombre o SKU...',
                searchHint:   'Sin resultados',
                resumenLbl:   'Resumen del lote',
                productosLbl: 'Productos agregados',
                unidadesLbl:  'Unidades',
                categoriasLbl:'Categorias',
                costoRefLbl:  'Costo ref.',
                costoSinImpLbl: 'Costo sin imp.',
                impuestosLbl: 'Impuestos',
                costoTotLbl:  'Costo total',
                emptyTitle:   'Aun no has agregado productos',
                emptyHint:    'Usa el buscador o presiona ↓ para capturar en un renglon',
                draftPh:      'Escribe el nombre o SKU del producto...',
                quitarRenglon:'Quitar renglon',
                hintRenglon:  'renglon vacio',
                hintBuscador: 'volver al buscador',
                sinAlmacenes: 'Sin almacenes activos',
                sinAlmacenesMsg: 'La sucursal no tiene almacenes activos',
                confirmClose:   'Descartar los productos capturados?',
                confirmCloseOk: 'Si, descartar',
                limpiar:      'Limpiar',
                cancelar:     'Cancelar',
                registrar:    'Registrar Entrada',
                confirmAdd:   'Deseas crear una entrada?',
                confirmAddOk: 'Si, crear',
                titleEdit:    'Editar entrada',
                guardarEdit:  'Guardar cambios',
                confirmEdit:  'Deseas guardar los cambios de la entrada?',
                confirmEditOk:'Si, guardar',
                stockAuto:    'El stock se actualizara automaticamente',
                guardar:      'Guardar formato',
                guardarDia:   'Guardar también como formato',
                cargar:       'Cargar formato',
                formatosTit:  'Formatos guardados',
                sinFormatos:  'No hay formatos guardados',
                promptName:   'Nombre del formato:',
                confirmDel:   'Eliminar este formato?',
                savedOk:      'Formato guardado',
                emptyLote:    'Agrega productos al lote antes de guardar',
                modalTit:     'Guardar formato',
                nombreLbl:    'Nombre del formato',
                scopeLbl:     'Quien puede verlo',
                scopeUser:    'Solo yo',
                scopeSub:     'Mi sucursal',
                scopeCompany: 'Toda la empresa',
                btnGuardar:   'Guardar',
                agregar:      'Agregar'
            },
            onAdd:           () => {},
            onClose:         () => {},
            onSearch:        null,
            onUpdate:        () => {},
            onCreateSupplier: null,
            onCreateProduct:  null,
            onOpenIA:         null,
            onLoadFormatos:   null,
            onSaveFormato:    null,
            onDeleteFormato:  null,
            onWarehouseChange: null
        };

        const o = options || {};
        this.opts        = Object.assign({}, defaults, o);
        this.opts.data   = Object.assign({}, defaults.data,   o.data   || {});
        this.opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        // Mapa origenId -> origen, para saber cual exige proveedor.
        this.origenMap = {};
        (this.opts.data.origenes || []).forEach(it => { this.origenMap[String(it.id)] = it; });

        this.lote         = [];
        this.searchTerm   = '';
        this.activeIdx    = 0;      // resultado resaltado para navegacion por teclado
        this.catalogItems = [];     // resultados visibles actuales del catalogo
        this.formatos     = [];     // cache de formatos (BD via callbacks, o localStorage de fallback)
        this.draft        = null;   // renglon vacio pendiente de elegir producto: { term }
        this.float        = null;   // lista flotante abierta (producto del renglon vacio o impuesto)
        this.stockMap     = {};     // stock del almacen seleccionado: { item_id: cantidad }
        this.editing      = null;   // entrada abierta para editar: { id, folio }; null = alta
        this.voucher      = null;   // comprobante adjunto: { name, dataUrl }
        this.formatoAplicado = null; // id del formato cargado en el lote; null = lote capturado a mano

        this.ensureStyles();
        this.mount();
        this.bindEvents();
        this.renderLote();
        this.refreshFormatos();
    }

    // -- Render estático --

    renderHeader() {
        const o = this.opts;
        return `
            <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                        <i data-lucide="package-plus" class="w-5 h-5 text-white"></i>
                    </div>
                    <div>
                        <h3 id="${o.id}_title" class="text-lg font-bold text-gray-800 leading-tight">${this.esc(o.labels.title)}</h3>
                        <p class="text-[11px] text-gray-500">${this.esc(o.labels.subtitle)}</p>
                    </div>
                </div>
            </div>`;
    }

    renderConfigRow() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60">
                <div id="${o.id}_configGrid" class="grid grid-cols-5 gap-3 items-end">
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.origen)}</label>
                        ${this.selectWrap(`
                            <select id="${o.id}_selOrigen" class="${cls.select}">
                                ${(o.data.origenes || []).map(it => this.optionTag(it)).join('')}
                            </select>
                        `)}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.sucursal)}</label>
                        ${this.selectWrap(`
                            <select id="${o.id}_selSucursal" class="${cls.select}">
                                ${(o.data.sucursales || []).map(it => this.optionTag(it, o.data.branch_id)).join('')}
                            </select>
                        `)}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.almacen)}</label>
                        ${this.selectWrap(`
                            <select id="${o.id}_selAlmacen" class="${cls.select}">
                                ${this.almacenOptions(o.data.branch_id, o.data.warehouse_id)}
                            </select>
                        `)}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.destino)}</label>
                        ${this.selectWrap(`
                            <select id="${o.id}_selDestino" class="${cls.select}">
                                ${this.destinoOptions(o.data.warehouse_id)}
                            </select>
                        `)}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.fecha)}</label>
                        <input id="${o.id}_inpFecha" type="date" value="${this.esc(o.data.fecha)}" class="${cls.input}">
                    </div>
                    <div id="${o.id}_cellProveedor" class="hidden">
                        <div class="flex items-center justify-between mb-1">
                            <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">${this.esc(o.labels.proveedor)}</label>
                            <button id="${o.id}_btnNuevoProveedor" type="button" class="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 leading-none">
                                <i data-lucide="plus" class="w-3 h-3"></i>${this.esc(o.labels.provNuevo)}
                            </button>
                        </div>
                        ${this.selectWrap(`
                            <select id="${o.id}_selProveedor" class="${cls.select}">
                                <option value="">${this.esc(o.labels.provPh)}</option>
                                ${(o.data.proveedores || []).map(it => this.optionTag(it)).join('')}
                            </select>
                        `)}
                    </div>
                </div>
            </div>`;
    }

    // -- Proveedor --

    requiresSupplier(originId) {
        const o = this.origenMap[String(originId)];
        if (!o) return false;
        if (typeof o.requires_supplier !== 'undefined') return !!Number(o.requires_supplier);
        return ['COMPRA', 'PROVEEDOR'].includes(String(o.code || '').toUpperCase());
    }

    syncProveedorVisibility() {
        const o      = this.opts;
        const origen = $(`#${o.id}_selOrigen`).val();
        const show   = this.requiresSupplier(origen);
        $(`#${o.id}_cellProveedor`).toggleClass('hidden', !show);
        $(`#${o.id}_configGrid`)
            .toggleClass('grid-cols-6', show)
            .toggleClass('grid-cols-5', !show);
    }

    addSupplierOption(sup) {
        const o    = this.opts;
        const $sel = $(`#${o.id}_selProveedor`);
        if (!$sel.find(`option[value="${sup.id}"]`).length) {
            $sel.append(`<option value="${this.esc(sup.id)}">${this.esc(sup.valor)}</option>`);
            (o.data.proveedores || (o.data.proveedores = [])).push({ id: sup.id, valor: sup.valor });
        }
        $sel.val(String(sup.id));
    }

    openNuevoProveedor() {
        const o       = this.opts;
        const modalId = `${o.id}_supModal`;
        $(`#${modalId}`).remove();

        const field = (id, label, type, ph) => `
            <div class="flex flex-col gap-1">
                <label class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">${this.esc(label)}</label>
                <input id="${modalId}_${id}" type="${type}" autocomplete="off"
                    class="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                    placeholder="${this.esc(ph || '')}">
            </div>`;

        const html = `
            <div id="${modalId}" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" data-sup-backdrop></div>
                <div class="relative w-full max-w-xs bg-white border border-gray-200 rounded-xl shadow-2xl shadow-black/30 overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <p class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                            <i data-lucide="truck" class="w-3.5 h-3.5 text-blue-600"></i>${this.esc(o.labels.provModalTit)}
                        </p>
                        <button id="${modalId}_close" class="text-gray-400 hover:text-gray-700 transition-colors">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <div class="px-4 pt-4 pb-3 flex flex-col gap-3">
                        ${field('name',    o.labels.provName,    'text', o.labels.provNamePh)}
                        ${field('contact', o.labels.provContact, 'text', '')}
                        ${field('phone',   o.labels.provPhone,   'tel',  '')}
                        ${field('email',   o.labels.provEmail,   'email','')}
                    </div>
                    <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
                        <button id="${modalId}_cancel" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-300 hover:border-gray-400 hover:text-gray-800 transition-all">${this.esc(o.labels.cancelar)}</button>
                        <button id="${modalId}_confirm" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-600 flex items-center gap-1.5 transition-all">
                            <i data-lucide="check" class="w-3 h-3"></i>${this.esc(o.labels.btnGuardar)}
                        </button>
                    </div>
                </div>
            </div>`;

        $('body').append(html);
        if (window.lucide) lucide.createIcons();
        $(`#${modalId}_name`).focus();

        const closeModal = () => $(`#${modalId}`).remove();
        $(`#${modalId}`).on('click', '[data-sup-backdrop]', closeModal);
        $(`#${modalId}_close`).on('click', closeModal);
        $(`#${modalId}_cancel`).on('click', closeModal);

        const confirmar = () => {
            const name = $(`#${modalId}_name`).val().trim();
            if (!name) { $(`#${modalId}_name`).focus(); return; }
            const payload = {
                name:         name,
                contact_name: $(`#${modalId}_contact`).val().trim(),
                phone:        $(`#${modalId}_phone`).val().trim(),
                email:        $(`#${modalId}_email`).val().trim()
            };
            if (typeof o.onCreateSupplier === 'function') {
                o.onCreateSupplier(payload, (sup) => {
                    if (sup && sup.id) { this.addSupplierOption(sup); closeModal(); }
                });
            } else {
                // Sin backend (modo demo): alta local optimista.
                this.addSupplierOption({ id: 'tmp-' + Date.now(), valor: name });
                closeModal();
            }
        };

        $(`#${modalId}_confirm`).on('click', confirmar);
        $(`#${modalId}_name`).on('keydown', (e) => {
            if (e.key === 'Enter')  { e.preventDefault(); confirmar(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeModal(); }
        });
    }

    // -- Producto nuevo --

    // Botón de los resultados vacíos: el producto buscado no existe y se da de alta ahí mismo.
    renderCreateProduct(term) {
        if (typeof this.opts.onCreateProduct !== 'function' || !String(term || '').trim()) return '';
        return `
            <button type="button" class="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-t border-emerald-100 transition-colors" data-create-product="${this.esc(String(term).trim())}">
                <i data-lucide="package-plus" class="w-3.5 h-3.5"></i>${this.esc(this.opts.labels.prodCrear)} &laquo;${this.esc(String(term).trim())}&raquo;
            </button>`;
    }

    openNuevoProducto(prefill) {
        const o       = this.opts;
        const modalId = `${o.id}_prodModal`;
        $(`#${modalId}`).remove();
        this.closeFloat();

        const selCls  = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all cursor-pointer';
        const options = (list, ph) => `<option value="">${this.esc(ph)}</option>` + (list || []).map(it => this.optionTag(it)).join('');

        const html = `
            <div id="${modalId}" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" data-prod-backdrop></div>
                <div class="relative w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-2xl shadow-black/30 overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <p class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                            <i data-lucide="package-plus" class="w-3.5 h-3.5 text-emerald-600"></i>${this.esc(o.labels.prodModalTit)}
                        </p>
                        <button id="${modalId}_close" class="text-gray-400 hover:text-gray-700 transition-colors">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <div class="px-4 pt-4 pb-3 flex flex-col gap-3">
                        <div class="flex flex-col gap-1">
                            <label class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">${this.esc(o.labels.prodName)}</label>
                            <input id="${modalId}_name" type="text" autocomplete="off" value="${this.esc(prefill || '')}"
                                class="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all">
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">${this.esc(o.labels.prodCat)}</label>
                                <select id="${modalId}_cat" class="${selCls}">${options(o.data.categorias, o.labels.prodCatPh)}</select>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">${this.esc(o.labels.prodUnit)}</label>
                                <select id="${modalId}_unit" class="${selCls}">${options(o.data.unidades, o.labels.prodUnitPh)}</select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">${this.esc(o.labels.prodCosto)}</label>
                                <input id="${modalId}_cost" type="number" min="0" step="0.01" value="0.00"
                                    class="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-right text-gray-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all">
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">${this.esc(o.labels.prodTax)}</label>
                                <select id="${modalId}_tax" class="${selCls}">${(o.data.impuestos || []).map(it => this.optionTag(it)).join('')}</select>
                            </div>
                        </div>
                        <p id="${modalId}_err" class="hidden text-[11px] font-medium text-red-500"></p>
                        <p class="text-[10px] text-gray-400">${this.esc(o.labels.prodHint)}</p>
                    </div>
                    <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
                        <button id="${modalId}_cancel" class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-300 hover:border-gray-400 hover:text-gray-800 transition-all">${this.esc(o.labels.cancelar)}</button>
                        <button id="${modalId}_confirm" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-600 flex items-center gap-1.5 transition-all">
                            <i data-lucide="check" class="w-3 h-3"></i>${this.esc(o.labels.prodGuardar)}
                        </button>
                    </div>
                </div>
            </div>`;

        $('body').append(html);
        if (window.lucide) lucide.createIcons();
        setTimeout(() => $(`#${modalId}_name`).trigger('focus').trigger('select'), 50);

        const closeModal = () => $(`#${modalId}`).remove();
        $(`#${modalId}`).on('click', '[data-prod-backdrop]', closeModal);
        $(`#${modalId}_close`).on('click', closeModal);
        $(`#${modalId}_cancel`).on('click', closeModal);
        $(`#${modalId}`).on('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeModal(); }
        });

        const confirmar = () => {
            const name = ($(`#${modalId}_name`).val() || '').trim();
            if (!name) { $(`#${modalId}_name`).focus(); return; }

            const costo = Math.max(0, parseFloat($(`#${modalId}_cost`).val()) || 0);
            const tax   = this.parseTax($(`#${modalId}_tax`).val());

            const $btn = $(`#${modalId}_confirm`).prop('disabled', true).addClass('opacity-60');
            const payload = {
                name:        name,
                category_id: $(`#${modalId}_cat`).val()  || '',
                unit_id:     $(`#${modalId}_unit`).val() || '',
                // Costo como lo guarda una entrada: base sin impuesto + tasa.
                costo:       costo,
                cost_unit:   this.baseFromCost(costo, tax),
                cost_tax:    tax
            };

            o.onCreateProduct(payload, (prod, error) => {
                if (!prod) {
                    $btn.prop('disabled', false).removeClass('opacity-60');
                    $(`#${modalId}_err`).text(error || '').toggleClass('hidden', !error);
                    return;
                }
                (o.json || (o.json = [])).push(prod);
                closeModal();
                this.draft = null;
                this.resetSearchState();
                this.focusCantidad(this.addOrIncrement(prod, 1));
            });
        };

        $(`#${modalId}_confirm`).on('click', confirmar);
        $(`#${modalId}_name, #${modalId}_cost`).on('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
        });
    }

    renderSearchBar() {
        const o = this.opts;
        return `
            <div id="${o.id}_searchBar" class="px-5 py-3 border-b border-gray-200 bg-white">
                <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                        <i data-lucide="search" class="w-4 h-4"></i>
                    </span>
                    <input id="${o.id}_buscarProducto" type="text" placeholder="${this.esc(o.labels.placeholder)}" autocomplete="off"
                        class="w-full pl-9 pr-40 py-2.5 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400">
                    <div class="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5 text-[10px] text-gray-400 pointer-events-none">
                        <span class="ef-kbd">&uarr;&darr;</span><span>navegar</span>
                        <span class="ef-kbd">Enter</span><span>agregar</span>
                    </div>
                    <div id="${o.id}_catalogoLista" class="hidden absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl shadow-black/20 overflow-hidden"></div>
                </div>
            </div>`;
    }

    renderResumen() {
        const o = this.opts;
        return `
            <div class="flex-shrink-0 border-t border-gray-200 px-5 py-2.5 bg-gray-50 flex items-center justify-between gap-4">
                <div class="flex items-center gap-5 text-[11px] text-gray-500">
                    <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Productos <strong class="text-gray-800 text-sm" id="${o.id}_qtyItems">0</strong></span>
                    <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>${this.esc(o.labels.unidadesLbl)} <strong class="text-gray-800 text-sm" id="${o.id}_qtyUnits">0</strong> uds</span>
                    <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>${this.esc(o.labels.categoriasLbl)} <strong class="text-gray-800 text-sm" id="${o.id}_qtyCats">0</strong></span>
                </div>
                <div class="flex items-center gap-5">
                    <div class="flex items-baseline gap-2">
                        <span class="text-[10px] uppercase tracking-wider text-gray-500">${this.esc(o.labels.costoSinImpLbl)}</span>
                        <span class="text-gray-700 font-semibold text-sm leading-none" id="${o.id}_qtyBase">$0.00</span>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <span class="text-[10px] uppercase tracking-wider text-gray-500">${this.esc(o.labels.impuestosLbl)}</span>
                        <span class="text-gray-700 font-semibold text-sm leading-none" id="${o.id}_qtyTax">$0.00</span>
                    </div>
                    <div class="h-6 w-px bg-gray-300"></div>
                    <div class="flex items-baseline gap-2.5">
                        <span class="text-[10px] uppercase tracking-wider text-gray-500">${this.esc(o.labels.costoTotLbl)}</span>
                        <span class="text-green-600 font-bold text-lg leading-none" id="${o.id}_qtyCost">$0.00</span>
                    </div>
                </div>
            </div>`;
    }

    renderLoteHeader() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="px-5 py-2.5 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-gray-50">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center">
                        <i data-lucide="boxes" class="w-3.5 h-3.5 text-blue-600"></i>
                    </div>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-gray-600">${this.esc(o.labels.productosLbl)}</p>
                    <span id="${o.id}_cntProductos" class="${cls.badge} bg-blue-50 text-blue-700 border border-blue-200">0</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="hidden md:flex items-center gap-1 text-[10px] text-gray-400">
                        <span class="ef-kbd">&darr;</span>${this.esc(o.labels.hintRenglon)}
                        <span class="ef-kbd ml-1.5">Enter</span>${this.esc(o.labels.hintBuscador)}
                    </span>
                    ${typeof o.onOpenIA === 'function' ? `
                    <button id="${o.id}_btnIA" type="button" class="${cls.btnIco}">
                        <i data-lucide="sparkles" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.iaSubir)}</span>
                    </button>` : ''}
                    <button id="${o.id}_btnLimpiarLote" class="text-[10px] text-gray-500 hover:text-red-500 transition flex items-center gap-1 hidden px-2 py-1 rounded-md hover:bg-red-50">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>${this.esc(o.labels.limpiar)}
                    </button>
                </div>
            </div>`;
    }

    renderFooter() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <div class="flex items-center gap-2 relative flex-shrink-0">
                    <button id="${o.id}_btnSaveFormato" class="${cls.btnIco}" title="${this.esc(o.labels.guardar)}">
                        <i data-lucide="bookmark-plus" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.guardar)}</span>
                    </button>
                    <button id="${o.id}_btnLoadFormato" class="${cls.btnIco}" title="${this.esc(o.labels.cargar)}">
                        <i data-lucide="folder-open" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.cargar)}</span>
                        <span id="${o.id}_cntFormatos" class="${cls.badge} bg-blue-50 text-blue-700 border border-blue-200 ml-0.5 hidden">0</span>
                    </button>
                    <div id="${o.id}_formatosDropdown" class="hidden absolute bottom-full left-0 mb-2 w-[280px] bg-white border border-gray-200 rounded-lg shadow-2xl shadow-black/20 overflow-hidden z-20">
                        <div class="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                            <p class="text-[10px] font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                                <i data-lucide="layers" class="w-3 h-3 text-blue-600"></i>${this.esc(o.labels.formatosTit)}
                            </p>
                            <button id="${o.id}_btnCloseFormatos" class="text-gray-400 hover:text-gray-700 transition-colors">
                                <i data-lucide="x" class="w-3 h-3"></i>
                            </button>
                        </div>
                        <div id="${o.id}_formatosLista" class="max-h-[260px] overflow-y-auto cs-scroll"></div>
                    </div>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                    <button class="${cls.btnCancel}" data-modal-close>
                        <i data-lucide="x" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.cancelar)}</span>
                    </button>
                    <button id="${o.id}_btnRegistrar" class="${cls.btnOk}">
                        <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.registrar)}</span>
                    </button>
                </div>
            </div>`;
    }

    renderDetalles() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="flex items-end gap-3 px-5 py-2.5 border-t border-gray-200 bg-white flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <label for="${o.id}_inpNota" class="${cls.label}">${this.esc(o.labels.nota)}</label>
                    <input id="${o.id}_inpNota" type="text" value="${this.esc(o.data.nota)}" placeholder="${this.esc(o.labels.notaPh)}..." class="${cls.input}">
                </div>
                <div class="w-[300px] flex-shrink-0">
                    <label class="${cls.label}">${this.esc(o.labels.comprobante)}</label>
                    <input id="${o.id}_voucherInput" type="file" accept="image/*,application/pdf" class="hidden">
                    <div id="${o.id}_btnVoucher" role="button" tabindex="0" title="${this.esc(o.labels.compDrop)}"
                        class="h-[38px] px-3 flex items-center gap-2 rounded-md border-[1px] border-dashed border-gray-300 bg-gray-50 text-[11px] text-gray-500 cursor-pointer hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all">
                        <i data-lucide="paperclip" class="w-3.5 h-3.5 flex-shrink-0"></i>
                        <span id="${o.id}_voucherLbl" class="flex-1 min-w-0 truncate">${this.esc(o.labels.compDrop)}</span>
                        <button id="${o.id}_voucherClear" type="button" class="hidden w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0" title="${this.esc(o.labels.quitarComp)}">
                            <i data-lucide="x" class="w-3 h-3"></i>
                        </button>
                    </div>
                </div>
            </div>`;
    }

    renderEmptyState() {
        const o = this.opts;
        return `
            <div class="flex flex-col items-center justify-center py-12 text-center">
                <div class="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                    <i data-lucide="package-plus" class="w-8 h-8 text-blue-400"></i>
                </div>
                <p class="text-xs font-semibold text-gray-700">${this.esc(o.labels.emptyTitle)}</p>
                <p class="text-[11px] text-gray-400 mt-1">${this.esc(o.labels.emptyHint)}</p>
            </div>`;
    }

    renderProductRow(p, i) {
        const cls         = this.cls;
        const cant        = Number(p.cantidad || 0);
        const taxNum      = Number(p.tax || 0);
        const costoNum    = Number(p.costo || 0);
        const baseNum     = (p.costoSinTax != null && p.costoSinTax !== '') ? Number(p.costoSinTax) : this.baseFromCost(costoNum, taxNum);
        const subtotal    = (cant * costoNum).toFixed(2);
        const subtotalFmt = Number(subtotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const baseFmt     = baseNum.toFixed(2);
        const nuevoStock  = this.fmtQty(Number(p.stock || 0) + cant);
        const stockColor  = p.stock === 0 ? 'text-red-500' : p.stock < 5 ? 'text-orange-500' : 'text-green-600';
        return `
            <tr class="border-b border-gray-100 last:border-b-0 hover:bg-blue-100/60 transition-colors" data-idx="${i}">
                <td class="px-3 py-2 align-middle w-28">
                    <span class="block truncate text-[11px] font-mono text-gray-500" title="${this.esc(p.sku)}">${this.esc(p.sku)}</span>
                </td>
                <td class="px-3 py-2 align-middle">
                    <div class="flex items-center gap-2.5 min-w-0">
                        ${this.prodThumb(p, 'w-8 h-8', 'w-3.5 h-3.5')}
                        <div class="min-w-0">
                            <p class="text-xs font-semibold text-gray-800 truncate leading-tight">${this.esc(p.nombre)}</p>
                            ${p.categoria ? `<p class="text-[10px] text-gray-400 truncate mt-0.5">${this.esc(p.categoria)}</p>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-2 py-2 align-middle text-center w-32">
                    <span class="text-[11px] text-gray-500">
                        <strong class="${stockColor}">${p.stock || 0}</strong>
                        <span class="text-gray-300 mx-0.5">&rarr;</span>
                        <strong class="text-green-600" data-nuevo-stock>${nuevoStock}</strong>
                    </span>
                </td>
                <td class="px-2 py-2 align-middle w-24">
                    <input type="number" min="1" step="0.01" value="${cant}" class="${cls.qtyInp}" data-field="cantidad" data-idx="${i}">
                </td>
                <td class="px-2 py-2 align-middle w-28">
                    <div class="relative" title="Costo con impuesto">
                        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                            <i data-lucide="dollar-sign" class="w-3 h-3"></i>
                        </span>
                        <input type="number" min="0" step="0.01" value="${costoNum.toFixed(2)}" class="${cls.cashInp}" data-field="costo" data-idx="${i}">
                    </div>
                </td>
                <td class="px-2 py-2 align-middle w-28">
                    <div class="relative" title="Costo sin impuesto">
                        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                            <i data-lucide="dollar-sign" class="w-3 h-3"></i>
                        </span>
                        <input type="number" min="0" step="0.01" value="${baseFmt}" class="${cls.cashInp}" data-field="costoSinTax" data-idx="${i}">
                    </div>
                </td>
                <td class="px-2 py-2 align-middle w-24">
                    <div class="relative" title="Impuesto (%): escribe o elige">
                        <input type="text" inputmode="decimal" autocomplete="off" value="${taxNum}" class="w-full pr-9 pl-2.5 py-2 text-sm text-right text-gray-800 bg-white border border-gray-300 rounded outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all" data-field="tax" data-idx="${i}">
                        <span class="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[11px]">%</span>
                        <button type="button" tabindex="-1" class="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100" data-tax-toggle="${i}">
                            <i data-lucide="chevron-down" class="w-3 h-3"></i>
                        </button>
                    </div>
                </td>
                <td class="px-5 py-2 align-middle text-right w-28">
                    <span class="text-green-700 font-bold text-xs" data-subtotal>$${subtotalFmt}</span>
                </td>
                <td class="px-2 py-2 align-middle text-center w-10">
                    <button class="w-6 h-6 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" data-remove="${i}" title="Eliminar">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                </td>
            </tr>`;
    }

    renderProductsTable() {
        return `
            <table class="w-full border-collapse">
                <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-28">SKU</th>
                        <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                        <th class="text-center px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-32">Stock</th>
                        <th class="text-center px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">Cantidad</th>
                        <th class="text-left px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-28">Costo c/imp</th>
                        <th class="text-left px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-28">Costo s/imp</th>
                        <th class="text-center px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">Imp. %</th>
                        <th class="text-right px-5 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-28">Subtotal</th>
                        <th class="w-10 px-2 py-2"></th>
                    </tr>
                </thead>
                <tbody>${this.lote.map((p, i) => this.renderProductRow(p, i)).join('')}${this.draft ? this.renderDraftRow() : ''}</tbody>
            </table>
            <div class="h-64" aria-hidden="true"></div>`;
    }

    renderDraftRow() {
        const o = this.opts;
        return `
            <tr class="border-b border-gray-100 bg-blue-50/30" data-draft>
                <td class="px-3 py-2 align-middle w-28"></td>
                <td class="px-3 py-2 align-middle">
                    <div class="relative">
                        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                            <i data-lucide="search" class="w-3.5 h-3.5"></i>
                        </span>
                        <input id="${o.id}_draftInput" type="text" autocomplete="off" value="${this.esc(this.draft.term)}" placeholder="${this.esc(o.labels.draftPh)}" class="${this.cls.search}">
                    </div>
                </td>
                <td colspan="6"></td>
                <td class="px-2 py-2 align-middle text-center w-10">
                    <button class="w-6 h-6 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" data-draft-remove title="${this.esc(o.labels.quitarRenglon)}">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                </td>
            </tr>`;
    }

    renderTaxLista(items) {
        return items.map((t, i) => `
            <div class="ef-cat-item px-3 py-2 cursor-pointer text-xs font-semibold text-gray-800 hover:bg-blue-50/60 border-b border-gray-100 last:border-b-0 transition-all" data-tax-val="${this.esc(t.id)}" data-cat-idx="${i}">${this.esc(t.valor)}</div>`
        ).join('');
    }

    renderDraftLista(items) {
        if (!items.length) {
            return `<div class="px-3 py-4 text-center text-[11px] text-gray-500">${this.esc(this.opts.labels.searchHint)}</div>${this.renderCreateProduct(this.draft ? this.draft.term : '')}`;
        }
        return `<div class="max-h-[240px] overflow-y-auto cs-scroll ef-scroll">${items.map((p, i) => this.renderSearchResult(p, i)).join('')}</div>`;
    }

    renderSearchResult(p, i) {
        const o          = this.opts;
        const stockColor = p.stock === 0 ? 'text-red-500' : p.stock < 5 ? 'text-orange-500' : 'text-green-600';
        const costoFmt   = Number(p.costo || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `
            <div class="ef-cat-item flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50/60 border-b border-gray-100 last:border-b-0 transition-all group" data-add-id="${this.esc(p.id)}" data-cat-idx="${i}">
                ${this.prodThumb(p, 'w-9 h-9', 'w-4 h-4')}
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-gray-800 truncate">${this.esc(p.nombre)}</p>
                    <p class="text-[10px] text-gray-500 truncate mt-0.5">
                        <span class="font-mono">${this.esc(p.sku)}</span>${p.categoria ? `<span class="text-gray-300"> &middot; </span>${this.esc(p.categoria)}` : ''}<span class="text-gray-300"> &middot; </span>Stock: <strong class="${stockColor}">${p.stock || 0}</strong>
                    </p>
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

    ensureStyles() {
        if (document.getElementById('entradaFormStyles')) return;
        const css = `
            input.no-spin::-webkit-inner-spin-button,
            input.no-spin::-webkit-outer-spin-button { -webkit-appearance: none !important; appearance: none !important; margin: 0 !important; }
            input.no-spin { -moz-appearance: textfield !important; appearance: textfield !important; }
            .ef-scroll { scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent; }
            .ef-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
            .ef-scroll::-webkit-scrollbar-track { background: transparent; }
            .ef-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
            .ef-scroll::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
            .ef-cat-head { position: -webkit-sticky; position: sticky; top: 0; z-index: 10; background: #F9FAFB; }
            .ef-cat-item.ef-active { background: rgb(var(--brand-600, 192 90 64) / 0.10); box-shadow: inset 0 0 0 1px rgb(var(--brand-600, 192 90 64) / 0.45); }
            @keyframes efFlash { 0% { background-color: rgba(16,185,129,0.20); } 100% { background-color: transparent; } }
            tr.ef-flash { animation: efFlash 0.6s ease-out; }
            .ef-kbd { display: inline-flex; align-items: center; padding: 0 4px; height: 14px; border-radius: 3px; border: 1px solid #D1D5DB; background: #F3F4F6; font-size: 9px; line-height: 1; color: #6B7280; font-family: monospace; }
            .ef-cat-item.ef-active .ef-add-btn { background: rgb(var(--brand-600, 192 90 64)); border-color: rgb(var(--brand-600, 192 90 64)); color: #fff; }`;
        const style = document.createElement('style');
        style.id = 'entradaFormStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // -- Mount --

    mount() {
        const o = this.opts;
        this.wrap = $('<div>', { id: o.id, class: o.class });
        this.wrap.html(`
            <div class="absolute inset-0 bg-black/40" data-modal-close></div>
            <div id="${o.id}_panel" class="relative z-10 w-full max-w-[1080px] h-[90vh] mx-3 bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">
                ${this.renderHeader()}
                ${this.renderConfigRow()}
                ${this.renderSearchBar()}
                ${this.renderLoteHeader()}
                <div id="${o.id}_listaProductos" class="flex-1 min-h-0 overflow-y-auto cs-scroll"></div>
                ${this.renderResumen()}
                ${this.renderDetalles()}
                ${this.renderFooter()}
                <div id="${o.id}_float" class="hidden absolute z-[60] bg-white border border-gray-200 rounded-lg shadow-2xl shadow-black/20 overflow-hidden"></div>
            </div>
        `);

        const $target = o.parent === 'body' || !$(`#${o.parent}`).length ? $('body') : $(`#${o.parent}`);
        $(`#${o.id}`).remove();
        $target.append(this.wrap);
    }

    // -- Render dinamico --

    updateTotals() {
        const o = this.opts;
        const totalItems = this.lote.length;
        const totalUds   = this.lote.reduce((s, p) => s + Number(p.cantidad || 0), 0);
        const totalCosto = this.lote.reduce((s, p) => s + Number(p.cantidad || 0) * Number(p.costo || 0), 0);
        // Costo sin impuestos (base) e impuestos = total c/imp - total s/imp.
        const totalBase  = this.lote.reduce((s, p) => s + Number(p.cantidad || 0) * Number(p.costoSinTax || 0), 0);
        const totalTax   = totalCosto - totalBase;
        const totalCats  = new Set(this.lote.map(p => (p.categoria && String(p.categoria).trim()) || 'Sin categoria')).size;
        $(`#${o.id}_qtyItems`).text(totalItems);
        $(`#${o.id}_qtyUnits`).text(this.fmtQty(totalUds));
        $(`#${o.id}_qtyCats`).text(totalCats);
        $(`#${o.id}_qtyBase`).text(this.fmtMoney(totalBase));
        $(`#${o.id}_qtyTax`).text(this.fmtMoney(totalTax));
        $(`#${o.id}_qtyCost`).text(this.fmtMoney(totalCosto));
        $(`#${o.id}_cntProductos`).text(totalItems);
    }

    renderCatalogo() {
        const o    = this.opts;
        const $dd  = $(`#${o.id}_catalogoLista`);
        const term = (this.searchTerm || '').toLowerCase();

        // El dropdown de resultados solo aparece al escribir; sin termino queda
        // oculto y la tabla del lote ocupa todo el alto disponible.
        if (!term) {
            this.catalogItems = [];
            $dd.addClass('hidden').empty();
            return;
        }

        const disponibles = this.productosDisponibles();
        const items       = this.matchCatalogo(term);

        // this.catalogItems debe seguir el MISMO orden en que se pintan los
        // .ef-cat-item: highlightActive() y la navegacion con flechas indexan
        // por posicion en el DOM.
        this.catalogItems = items;
        if (this.activeIdx >= items.length) this.activeIdx = Math.max(0, items.length - 1);

        const head = `
            <div class="flex items-center justify-between px-3 py-2 bg-blue-50/50 border-b border-gray-200">
                <span class="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5 truncate">
                    <i data-lucide="search" class="w-3 h-3 text-blue-600"></i>Resultados para "${this.esc(this.searchTerm)}"
                </span>
                <span class="text-[10px] text-gray-400 flex-shrink-0 ml-2">${items.length} ${items.length === 1 ? 'encontrado' : 'encontrados'}</span>
            </div>`;

        const foot = `
            <div class="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-400">
                <span class="flex items-center gap-1"><span class="ef-kbd">&crarr;</span>agregar<span class="ef-kbd ml-1.5">esc</span>cerrar</span>
                <span>Mostrando ${items.length} de ${disponibles.length}</span>
            </div>`;

        const body = items.length
            ? `<div class="max-h-[340px] overflow-y-auto cs-scroll ef-scroll">${items.map((p, i) => this.renderSearchResult(p, i)).join('')}</div>`
            : `<div class="flex flex-col items-center justify-center py-8 text-center px-2">
                    <div class="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center mb-2">
                        <i data-lucide="search-x" class="w-5 h-5 text-gray-400"></i>
                    </div>
                    <p class="text-[11px] text-gray-500">${this.esc(o.labels.searchHint)}</p>
               </div>${this.renderCreateProduct(this.searchTerm)}`;

        $dd.html(head + body + foot).removeClass('hidden');
        if (window.lucide) lucide.createIcons();
        this.highlightActive();
    }

    // Catalogo que aun no esta en el lote.
    productosDisponibles() {
        return (this.opts.json || []).filter(p => !this.lote.some(x => String(x.id) === String(p.id)));
    }

    matchCatalogo(term) {
        const t = String(term || '').trim().toLowerCase();
        if (!t) return [];
        return this.productosDisponibles().filter(p =>
            (p.nombre || '').toLowerCase().includes(t) || (p.sku || '').toLowerCase().includes(t)
        );
    }

    renderLote() {
        const o = this.opts;
        const $lista   = $(`#${o.id}_listaProductos`);
        const $limpiar = $(`#${o.id}_btnLimpiarLote`);
        this.closeFloat();
        if (!this.lote.length && !this.draft) {
            $lista.html(this.renderEmptyState()).addClass('flex items-center justify-center');
        } else {
            $lista.html(this.renderProductsTable()).removeClass('flex items-center justify-center');
        }
        $limpiar.toggleClass('hidden', !this.lote.length);
        this.syncSaveFormato();
        this.updateTotals();
        this.renderCatalogo();
        if (window.lucide) lucide.createIcons();
    }

    // -- Acciones de lote --

    doSearch(q) {
        this.searchTerm = String(q == null ? '' : q).trim();
        this.activeIdx  = 0;
        if (typeof this.opts.onSearch === 'function') {
            this.opts.onSearch(this.searchTerm, (matches) => {
                this.opts.json = matches || [];
                this.renderCatalogo();
            });
        } else {
            this.renderCatalogo();
        }
    }

    addProducto(id) {
        const prod = (this.opts.json || []).find(p => String(p.id) === String(id));
        this.commitProducto(prod, 1, true);
    }

    // Agrega (o acumula) el producto al lote y limpia la busqueda (oculta el
    // dropdown). Con focusQty enfoca la casilla de cantidad de la fila para
    // teclear el valor; sin el, deja el foco en el buscador (modo escaner).
    commitProducto(prod, qty, focusQty) {
        if (!prod) return;
        this.resetSearchState();
        const idx = this.addOrIncrement(prod, qty || 1);
        if (focusQty) this.focusCantidad(idx);
        else $(`#${this.opts.id}_buscarProducto`).trigger('focus');
    }

    // Enfoca y preselecciona el input de cantidad de la fila recien afectada,
    // de modo que al teclear se reemplaza el valor. Enter vuelve al buscador
    // (onRowKeydown) para encadenar la siguiente alta.
    focusCantidad(idx) {
        const $inp = $(`#${this.opts.id}_listaProductos tr[data-idx="${idx}"] input[data-field="cantidad"]`);
        if ($inp.length) {
            $inp.trigger('focus').trigger('select');
        } else {
            $(`#${this.opts.id}_buscarProducto`).trigger('focus');
        }
    }

    // Cuando la lista ya llenó su alto, el renglón nuevo cae al borde (o fuera).
    // La lista salta hasta dejarlo a media altura: debajo queda el espacio en
    // blanco del final (h-64) y se aprecia que se agregó.
    revealRow(el) {
        const list = $(`#${this.opts.id}_listaProductos`)[0];
        if (!el || !list) return;
        const r = el.getBoundingClientRect();
        const l = list.getBoundingClientRect();
        if (r.top >= l.top && r.bottom <= l.bottom - r.height) return;
        list.scrollTop += (r.top - l.top) - (list.clientHeight - r.height) / 2;
    }

    // Suma al lote: si el producto ya existe acumula la cantidad (modo escaner),
    // si no, lo agrega como nueva fila. Devuelve el indice de la fila afectada.
    addOrIncrement(prod, qty) {
        qty = Math.max(1, Number(qty) || 1);
        const existing = this.lote.find(x => String(x.id) === String(prod.id));
        let idx;
        if (existing) {
            existing.cantidad = this.fmtQty(Number(existing.cantidad || 0) + qty);
            idx = this.lote.indexOf(existing);
        } else {
            this.lote.push(Object.assign({}, prod, this.seedTax(prod), { cantidad: qty }));
            idx = this.lote.length - 1;
        }
        this.renderLote();
        this.revealRow($(`#${this.opts.id}_listaProductos tr[data-idx="${idx}"]`)[0]);
        this.flashRow(idx);
        return idx;
    }

    // Semilla de costo por renglon: price_without_tax es el ultimo costo de compra
    // del producto SIN IVA y tax el IVA de esa compra. El costo CON IVA se deriva;
    // sin base se usa el costo del catalogo. Ambos quedan editables y se recalculan
    // entre si. El precio de venta (item.price) no participa.
    seedTax(prod) {
        const tax = Number(prod.tax || 0);
        let base = (prod.price_without_tax != null && prod.price_without_tax !== '')
            ? Number(prod.price_without_tax)
            : null;
        let costo = base != null ? this.costFromBase(base, tax) : Number(prod.costo || 0);
        if (!isFinite(costo) || costo < 0) costo = 0;
        if (base == null || !isFinite(base) || base < 0) base = this.baseFromCost(costo, tax);
        return { costo: costo, tax: tax, costoSinTax: base };
    }

    // Base sin impuesto a partir del costo con impuesto y la tasa (%).
    baseFromCost(costo, tax) {
        const c = Number(costo || 0);
        const t = Number(tax || 0);
        return t > 0 ? c / (1 + t / 100) : c;
    }

    // Costo con impuesto a partir de la base sin impuesto y la tasa (%).
    costFromBase(base, tax) {
        const b = Number(base || 0);
        const t = Number(tax || 0);
        return t > 0 ? b * (1 + t / 100) : b;
    }

    // Enter en el buscador: prioriza SKU exacto (lector de codigo), luego el
    // resultado resaltado, luego la primera coincidencia. Conserva el foco.
    handleSearchEnter() {
        const all = this.opts.json || [];
        const q   = (this.searchTerm || '').toLowerCase();
        // SKU exacto = lector de codigo: agrega 1 directo y sigue escaneando
        // (el foco se queda en el buscador, sin saltar a la cantidad).
        if (q) {
            const exact = all.find(p => String(p.sku || '').toLowerCase() === q);
            if (exact) { this.commitProducto(exact, 1, false); return; }
        }
        // Item resaltado (navegacion con flechas) o primera coincidencia del
        // texto: seleccion manual -> enfoca la cantidad para teclearla.
        let prod = this.catalogItems.length ? (this.catalogItems[this.activeIdx] || this.catalogItems[0]) : null;
        if (!prod && q) {
            prod = all.find(p => (p.nombre || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
        }
        this.commitProducto(prod, 1, true);
    }

    resetSearchState() {
        this.searchTerm = '';
        this.activeIdx  = 0;
        $(`#${this.opts.id}_buscarProducto`).val('');
    }

    highlightActive() {
        const $items = $(`#${this.opts.id}_catalogoLista .ef-cat-item`);
        $items.removeClass('ef-active');
        const $a = $items.eq(this.activeIdx);
        $a.addClass('ef-active');
        if ($a.length && $a[0].scrollIntoView) $a[0].scrollIntoView({ block: 'nearest' });
    }

    flashRow(idx) {
        const $row = $(`#${this.opts.id}_listaProductos tr[data-idx="${idx}"]`);
        if (!$row.length) return;
        $row.removeClass('ef-flash');
        void $row[0].offsetWidth; // reinicia la animacion al re-escanear el mismo producto
        $row.addClass('ef-flash');
    }

    onSearchKeydown(e) {
        const items = this.catalogItems || [];
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items.length) { this.activeIdx = Math.min(this.activeIdx + 1, items.length - 1); this.highlightActive(); }
            else if (!this.searchTerm) this.openDraft();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length) { this.activeIdx = Math.max(this.activeIdx - 1, 0); this.highlightActive(); }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.handleSearchEnter();
        } else if (e.key === 'Escape') {
            const $inp = $(`#${this.opts.id}_buscarProducto`);
            if (($inp.val() || '').length) {
                e.stopPropagation(); // primer Escape limpia; el segundo (vacio) cierra el modal
                this.resetSearchState();
                this.renderCatalogo();
            }
        }
    }

    // Teclado dentro de un renglon: Enter vuelve al buscador para encadenar la
    // siguiente alta; flechas se mueven al mismo campo del renglon de arriba/abajo
    // (en vez de sumar/restar al numero) y bajar desde el ultimo abre un renglon vacio.
    onRowKeydown(e) {
        const $inp  = $(e.currentTarget);
        const idx   = Number($inp.attr('data-idx'));
        const field = $inp.attr('data-field');
        if (field === 'tax' && this.onTaxKeydown(e, idx)) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            $(`#${this.opts.id}_buscarProducto`).trigger('focus');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (idx < this.lote.length - 1) this.focusField(idx + 1, field);
            else this.openDraft();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (idx > 0) this.focusField(idx - 1, field);
            else $(`#${this.opts.id}_buscarProducto`).trigger('focus');
        }
    }

    focusField(idx, field) {
        const $inp = $(`#${this.opts.id}_listaProductos tr[data-idx="${idx}"] input[data-field="${field}"]`);
        if (!$inp.length) return;
        if ($inp[0].scrollIntoView) $inp[0].scrollIntoView({ block: 'nearest' });
        $inp.trigger('focus').trigger('select');
    }

    // -- Renglon vacio --

    openDraft() {
        if (!this.draft) {
            this.draft = { term: '' };
            this.renderLote();
        }
        const $inp = $(`#${this.opts.id}_draftInput`);
        if (!$inp.length) return;
        this.revealRow($inp.closest('tr')[0]);
        $inp.trigger('focus');
    }

    removeDraft() {
        this.draft = null;
        this.renderLote();
    }

    onDraftInput(value) {
        if (!this.draft) return;
        this.draft.term = String(value || '');
        if (!this.draft.term.trim()) { this.closeFloat(); return; }
        const items = this.matchCatalogo(this.draft.term);
        this.openFloat({
            kind:     'draft',
            items:    items,
            active:   0,
            $anchor:  $(`#${this.opts.id}_draftInput`),
            minWidth: 380
        }, this.renderDraftLista(items));
    }

    // Escape limpia lo escrito y, con el renglon ya vacio, lo quita. Arriba sin
    // lista abierta regresa al ultimo renglon capturado.
    onDraftKeydown(e) {
        const id = this.opts.id;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            if (this.draft && this.draft.term) {
                this.draft.term = '';
                $(e.currentTarget).val('');
                this.closeFloat();
            } else {
                this.removeDraft();
                $(`#${id}_buscarProducto`).trigger('focus');
            }
            return;
        }
        if (this.onFloatKeydown(e)) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            this.commitDraft(this.pickDraft());
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this.lote.length) this.focusField(this.lote.length - 1, 'cantidad');
            else $(`#${id}_buscarProducto`).trigger('focus');
        }
    }

    // SKU exacto primero (lector de codigo), luego el resultado resaltado.
    pickDraft() {
        const q = String((this.draft && this.draft.term) || '').trim().toLowerCase();
        if (!q) return null;
        const exact = (this.opts.json || []).find(p => String(p.sku || '').toLowerCase() === q);
        if (exact) return exact;
        const f = this.float;
        return (f && f.kind === 'draft' && f.items.length) ? (f.items[f.active] || f.items[0]) : null;
    }

    commitDraft(prod) {
        if (!prod) return;
        this.draft = null;
        const idx = this.addOrIncrement(prod, 1);
        this.focusCantidad(idx);
    }

    // -- Impuesto (escribe o elige) --

    taxInput(idx) {
        return $(`#${this.opts.id}_listaProductos tr[data-idx="${idx}"] input[data-field="tax"]`);
    }

    // Con filter las opciones se reducen a las que empiezan con lo tecleado; sin
    // coincidencias la lista se cierra y queda el valor escrito a mano.
    openTaxList(idx, filter) {
        const $inp = this.taxInput(idx);
        if (!$inp.length || !this.lote[idx]) return;
        const q     = filter ? String($inp.val() || '').replace('%', '').trim() : '';
        const all   = this.opts.data.impuestos || [];
        const items = q ? all.filter(t => String(t.id).startsWith(q)) : all;
        if (!items.length) { this.closeFloat(); return; }
        const cur = items.findIndex(t => Number(t.id) === Number(this.lote[idx].tax));
        this.openFloat({
            kind:     'tax',
            idx:      idx,
            items:    items,
            active:   Math.max(0, cur),
            $anchor:  $inp.closest('.relative'),
            minWidth: 110
        }, this.renderTaxLista(items));
    }

    onTaxKeydown(e, idx) {
        const f    = this.float;
        const open = f && f.kind === 'tax' && f.idx === idx;
        if (e.key === 'ArrowDown' && e.altKey) {
            e.preventDefault();
            this.openTaxList(idx, false);
            return true;
        }
        if (!open) return false;
        if (e.key === 'Enter') {
            e.preventDefault();
            const it = f.items[f.active];
            if (it) this.selectTax(idx, it.id);
            else this.closeFloat();
            return true;
        }
        return this.onFloatKeydown(e);
    }

    selectTax(idx, value) {
        const $inp = this.taxInput(idx);
        this.closeFloat();
        if (!$inp.length) return;
        $inp.val(value);
        this.updateField($inp);
    }

    toggleTaxList(idx) {
        const f = this.float;
        if (f && f.kind === 'tax' && f.idx === idx) { this.closeFloat(); return; }
        this.taxInput(idx).trigger('focus');
        this.openTaxList(idx, false);
    }

    parseTax(value) {
        const n = parseFloat(String(value == null ? '' : value).replace('%', '').replace(',', '.'));
        return isFinite(n) && n >= 0 ? n : 0;
    }

    // -- Lista flotante --

    // Vive en el panel del modal, fuera del scroll de la tabla, para que el
    // renglon del fondo no la recorte. Nunca tapa la barra de totales: si no cabe
    // dentro de la lista, la lista se desplaza (el espacio libre del final lo
    // permite) y solo sin recorrido posible abre hacia arriba.
    openFloat(state, html) {
        this.float = state;
        $(`#${this.opts.id}_float`).html(html);
        this.placeFloat(true);
        this.highlightFloat();
        if (window.lucide) lucide.createIcons();
    }

    placeFloat(ensureRoom) {
        const f = this.float;
        if (!f || !f.$anchor || !f.$anchor.length) return;
        const $f    = $(`#${this.opts.id}_float`);
        const panel = $(`#${this.opts.id}_panel`)[0].getBoundingClientRect();
        const r     = f.$anchor[0].getBoundingClientRect();
        const width = Math.min(Math.max(r.width, f.minWidth || 0), panel.width - 16);
        const left  = Math.max(8, Math.min(r.left - panel.left, panel.width - width - 8));

        $f.css({ left: left, width: width, top: r.bottom - panel.top + 4, bottom: 'auto' }).removeClass('hidden');
        const h        = $f.outerHeight();
        const list     = $(`#${this.opts.id}_listaProductos`)[0];
        const overflow = r.bottom + 4 + h - list.getBoundingClientRect().bottom;
        if (overflow <= 0) return;

        const room = list.scrollHeight - list.clientHeight - list.scrollTop;
        if (ensureRoom && room >= overflow) {
            // El evento scroll de la lista vuelve a llamar a placeFloat ya con espacio.
            list.scrollTop += Math.ceil(overflow);
            return;
        }
        if (r.top - panel.top > panel.bottom - r.bottom) {
            $f.css({ top: 'auto', bottom: panel.bottom - r.top + 4 });
        }
    }

    closeFloat() {
        this.float = null;
        $(`#${this.opts.id}_float`).addClass('hidden').empty();
    }

    highlightFloat() {
        if (!this.float) return;
        const $items = $(`#${this.opts.id}_float .ef-cat-item`);
        $items.removeClass('ef-active');
        const $a = $items.eq(this.float.active);
        $a.addClass('ef-active');
        if ($a.length && $a[0].scrollIntoView) $a[0].scrollIntoView({ block: 'nearest' });
    }

    onFloatKeydown(e) {
        const f = this.float;
        if (!f) return false;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (f.items.length) {
                f.active = e.key === 'ArrowDown'
                    ? Math.min(f.active + 1, f.items.length - 1)
                    : Math.max(f.active - 1, 0);
                this.highlightFloat();
            }
            return true;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.closeFloat();
            return true;
        }
        return false;
    }

    removeProducto(i) {
        this.lote.splice(i, 1);
        if (!this.lote.length) this.formatoAplicado = null;
        this.renderLote();
    }

    updateField($el) {
        const idx   = Number($el.data('idx'));
        const field = $el.data('field');
        if (isNaN(idx) || !this.lote[idx] || !field) return;
        // Cantidad con 2 decimales como máximo: lo que se teclee de más se corta ahí mismo.
        if (field === 'cantidad') {
            const raw = String($el.val());
            const cut = raw.replace(/^(\d*\.\d{2})\d+$/, '$1');
            if (cut !== raw) $el.val(cut);
        }
        this.lote[idx][field] = field === 'tax' ? this.parseTax($el.val()) : $el.val();
        const p = this.lote[idx];
        // Costo c/imp y costo s/imp se recalculan entre si usando el tax:
        //  - al editar el costo c/imp se deriva la base s/imp,
        //  - al editar la base s/imp (o el tax) se deriva el costo c/imp.
        if (field === 'costo') {
            p.costoSinTax = this.baseFromCost(p.costo, p.tax);
        } else if (field === 'costoSinTax' || field === 'tax') {
            p.costo = this.costFromBase(p.costoSinTax, p.tax);
        }
        if (['cantidad', 'costo', 'costoSinTax', 'tax'].includes(field)) {
            this.refreshRow(idx, field);
            this.updateTotals();
        }
    }

    refreshRow(i, editedField) {
        const o = this.opts;
        const p = this.lote[i];
        if (!p) return;
        const cant        = Number(p.cantidad || 0);
        const costoNum    = Number(p.costo || 0);
        const baseNum     = Number(p.costoSinTax || 0);
        const subtotalFmt = (cant * costoNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const nuevoStock  = this.fmtQty(Number(p.stock || 0) + cant);
        const $row = $(`#${o.id}_listaProductos tr[data-idx="${i}"]`);
        // Solo refresca el input que el usuario NO esta editando, para no pisar
        // el cursor mientras teclea en costo c/imp o en costo s/imp.
        if (editedField !== 'costo')       $row.find('[data-field="costo"]').val(costoNum.toFixed(2));
        if (editedField !== 'costoSinTax') $row.find('[data-field="costoSinTax"]').val(baseNum.toFixed(2));
        $row.find('[data-subtotal]').text('$' + subtotalFmt);
        $row.find('[data-nuevo-stock]').text(nuevoStock);
    }

    clearLote() {
        if (!this.lote.length) return;
        this.confirmBox('Eliminar todos los productos del lote?', () => {
            this.lote  = [];
            this.draft = null;
            this.formatoAplicado = null;
            this.renderLote();
        });
    }

    // -- Comprobante --

    // Foto o PDF como dataURL. La foto se reduce a 1280 px en JPEG, igual que la
    // evidencia de Mermas; el PDF va tal cual hasta 4 MB. Lo usa también el detalle.
    static readVoucher(file) {
        return new Promise((resolve, reject) => {
            const isPdf = file.type === 'application/pdf';
            if (!isPdf && !/^image\//.test(file.type)) { reject('El comprobante debe ser una imagen o un PDF'); return; }
            if (isPdf && file.size > 4 * 1024 * 1024) { reject('El PDF pesa mas de 4 MB'); return; }

            const reader = new FileReader();
            reader.onerror = () => reject('No se pudo leer el archivo');
            reader.onload  = (ev) => {
                if (isPdf) { resolve(ev.target.result); return; }
                const img = new Image();
                img.onload = () => {
                    const max = 1280;
                    let w = img.width, h = img.height;
                    if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => reject('La imagen no se pudo abrir');
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async attachVoucher(file) {
        try {
            this.setVoucher({ name: file.name, dataUrl: await EntradaForm.readVoucher(file) });
        } catch (msg) {
            this.notify(msg);
        }
    }

    // -- Lectura con IA --

    // Lo que se confirma en el chat de CoffeeIA entra aquí: [{prod, cantidad, costo}].
    // Un producto recién creado desde el chat se suma al catálogo del modal. Un solo
    // repintado; la cantidad respeta decimales (kilos) y el costo leído, si viene,
    // reemplaza al último costo del producto. Devuelve cuántos renglones tocó.
    addFromIA(items) {
        const catalogo = this.opts.json || (this.opts.json = []);
        let added = 0;
        (items || []).forEach((it) => {
            const prod = it.prod;
            if (!prod) return;
            if (!catalogo.some(p => String(p.id) === String(prod.id))) catalogo.push(prod);
            const qty = Number(it.cantidad) > 0 ? Number(it.cantidad) : 1;
            let row = this.lote.find(x => String(x.id) === String(prod.id));
            if (row) {
                row.cantidad = this.fmtQty(Number(row.cantidad || 0) + qty);
            } else {
                row = Object.assign({}, prod, this.seedTax(prod), { cantidad: this.fmtQty(qty) });
                this.lote.push(row);
            }
            if (it.costo != null && it.costo !== '') {
                row.costo       = Number(it.costo);
                row.costoSinTax = this.baseFromCost(row.costo, row.tax);
            }
            added++;
        });

        this.draft = null;
        this.renderLote();
        return added;
    }

    setVoucher(voucher) {
        const id = this.opts.id;
        this.voucher = voucher;
        $(`#${id}_voucherInput`).val('');
        $(`#${id}_voucherLbl`).text(voucher ? voucher.name : this.opts.labels.compDrop);
        $(`#${id}_btnVoucher`).toggleClass('!text-green-700 !border-green-300 !border-solid !bg-green-50', !!voucher);
        $(`#${id}_voucherClear`).toggleClass('hidden', !voucher);
    }

    closeModal() {
        this.wrap.addClass('hidden');
        this.lote  = [];
        this.draft = null;
        this.formatoAplicado = null;
        this.setVoucher(null);
        if (this.editing) this.setMode(null);
        this.renderLote();
        this.opts.onClose();
    }

    // Escape con productos capturados pide confirmacion: un doble Escape (limpiar
    // busqueda + cerrar) ya no tira el lote completo.
    requestClose() {
        if (!this.lote.length) { this.closeModal(); return; }
        this.confirmBox(this.opts.labels.confirmClose, () => this.closeModal(), {
            okLabel: this.opts.labels.confirmCloseOk
        });
    }

    // Alertas y modales hijos (proveedor, formato) atienden su propio Escape.
    hasOverlay() {
        const id = this.opts.id;
        return $(`#${id}_supModal, #${id}_prodModal, #${id}_saveFormatoModal`).length > 0 || $('[data-ab-backdrop]').length > 0;
    }

    doRegistrar() {
        if (!this.lote.length) { this.notify('Agrega al menos un producto al lote'); return; }
        const o = this.opts;
        const warehouseId = $(`#${o.id}_selAlmacen`).val();
        if (!warehouseId) { this.notify(o.labels.sinAlmacenesMsg); return; }

        const origenId   = $(`#${o.id}_selOrigen`).val();
        const supplierId = $(`#${o.id}_selProveedor`).val() || '';
        if (this.requiresSupplier(origenId) && !supplierId) {
            this.notify(o.labels.provReq);
            this.syncProveedorVisibility();
            $(`#${o.id}_selProveedor`).focus();
            return;
        }

        const payload = {
            id:          this.editing ? this.editing.id : null,
            origen:      origenId,
            sucursal:    $(`#${o.id}_selSucursal option:selected`).text(),
            sucursalId:  $(`#${o.id}_selSucursal`).val(),
            almacen:     $(`#${o.id}_selAlmacen option:selected`).text(),
            warehouseId: warehouseId,
            warehouseAreaId: $(`#${o.id}_selDestino`).val() || '',
            proveedor:   $(`#${o.id}_selProveedor option:selected`).text(),
            supplierId:  supplierId,
            fecha:       $(`#${o.id}_inpFecha`).val(),
            nota:        $(`#${o.id}_inpNota`).val(),
            voucher:     this.voucher ? this.voucher.dataUrl : null,
            productos:  this.lote.map(p => ({
                id:     p.id,
                nombre: p.nombre, sku: p.sku, icon: p.icon, bg: p.bg, color: p.color,
                cant:           Number(p.cantidad || 0),
                priceWithoutTax: Number(p.costoSinTax || 0),
                tax:            Number(p.tax || 0),
                costo:          Number(p.costo || 0),
                stockPrev:      Number(p.stock || 0)
            })),
            totalUds:   this.lote.reduce((s, p) => s + Number(p.cantidad || 0), 0),
            totalCosto: this.lote.reduce((s, p) => s + Number(p.cantidad || 0) * Number(p.costo || 0), 0)
        };
        this.confirmRegistrar(payload);
    }

    // Confirma antes de crear la entrada; el modal permanece abierto si el
    // usuario cancela. Usa el alertBox propio de CoffeeSoft (via Templates) y
    // cae a confirm nativo si la referencia no esta disponible.
    confirmRegistrar(payload) {
        const o         = this.opts;
        const editing   = !!this.editing;
        const dia       = this.formatoDelDia();
        const chkId     = `${o.id}_chkFormatoDia`;
        const productos = this.lote.map(p => Object.assign({}, p));

        const proceed = () => {
            const guardarDia = !!dia && $(`#${chkId}`).is(':checked');
            (editing ? o.onUpdate : o.onAdd)(payload);
            this.closeModal();
            if (guardarDia) this.storeFormato(dia, 'user', productos, true);
        };

        this.confirmBox(editing ? o.labels.confirmEdit : o.labels.confirmAdd, proceed, {
            type:       'confirm',
            okLabel:    editing ? o.labels.confirmEditOk : o.labels.confirmAddOk,
            okIcon:     'check',
            focusOk:    true,
            detailHtml: dia ? `
                <label class="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border-[1px] border-blue-200 text-[12px] font-medium text-blue-700 cursor-pointer select-none">
                    <input id="${chkId}" type="checkbox" checked class="w-3.5 h-3.5 accent-blue-600">
                    <i data-lucide="bookmark-plus" class="w-3.5 h-3.5"></i>${this.esc(o.labels.guardarDia)} «${this.esc(dia)}»
                </label>` : ''
        });
    }

    // Notificacion de validacion usando el alertBox propio de CoffeeSoft;
    // cae a alert nativo si la referencia a Templates no esta disponible.
    notify(title, type = 'warning') {
        if (this.tpl && typeof this.tpl.alertBox === 'function') {
            this.tpl.alertBox({ type, title });
            this.focusAlert('[data-ab-ok]');
        } else {
            alert(title);
        }
    }

    // Confirmacion usando el alertBox propio; ejecuta onOk solo al aceptar.
    // Cae a confirm nativo si no hay referencia a Templates. focusOk deja Enter
    // sobre Aceptar; sin el, Enter cae en Cancelar (confirmaciones destructivas).
    confirmBox(title, onOk, opts = {}) {
        if (this.tpl && typeof this.tpl.alertBox === 'function') {
            const { focusOk, ...alertOpts } = opts;
            this.tpl.alertBox(Object.assign({
                type:        'cancel',
                title:       title,
                cancelLabel: this.opts.labels.cancelar,
                onOk:        onOk
            }, alertOpts));
            this.focusAlert(focusOk ? '[data-ab-ok]' : '[data-ab-cancel]');
        } else if (confirm(title)) {
            onOk();
        }
    }

    // Saca el foco del boton que abrio la alerta: sin esto, Enter volvia a pulsar
    // Registrar y apilaba otra confirmacion encima.
    focusAlert(selector) {
        setTimeout(() => $(selector).last().trigger('focus'), 60);
    }

    // -- Formatos --

    // Fuente de verdad de los formatos: si el orquestador inyecta onLoadFormatos
    // (entradas.js -> BD) se usa esa; si no, cae a localStorage (modo UI-first/SAMPLE).
    async refreshFormatos() {
        if (typeof this.opts.onLoadFormatos === 'function') {
            try {
                const list = await this.opts.onLoadFormatos();
                this.formatos = Array.isArray(list) ? list : [];
            } catch (e) {
                this.formatos = [];
            }
        } else {
            this.formatos = this.loadLocalFormatos();
        }
        this.renderFormatosBadge();
        if (!$(`#${this.opts.id}_formatosDropdown`).hasClass('hidden')) this.renderFormatosLista();
        return this.formatos;
    }

    loadLocalFormatos() {
        // Guarda contra localStorage corrupto: refreshFormatos corre en el constructor,
        // un JSON invalido sin captura romperia la apertura del modal entero.
        try {
            const parsed = JSON.parse(localStorage.getItem(this.FORMATOS_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    persistLocalFormatos(arr) {
        localStorage.setItem(this.FORMATOS_KEY, JSON.stringify(arr));
    }

    saveFormato() {
        if (!this.lote.length) { this.notify(this.opts.labels.emptyLote); return; }

        const o       = this.opts;
        const modalId = `${o.id}_saveFormatoModal`;

        const scopes = [
            { value: 'user',       label: 'Solo yo',         icon: 'user',       iconClass: 'text-gray-400'  },
            { value: 'subsidiary', label: 'Mi sucursal',     icon: 'store',      iconClass: 'text-sky-500'   },
            { value: 'company',    label: 'Toda la empresa', icon: 'building-2', iconClass: 'text-blue-600'  }
        ];
        const scopeRadios = scopes.map((s, i) => `
            <label class="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer border transition-all
                          ${i === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}
                          scope-radio-label" data-value="${s.value}">
                <input type="radio" name="${modalId}_scope" value="${s.value}" class="sr-only"
                       ${i === 0 ? 'checked' : ''}>
                <i data-lucide="${s.icon}" class="w-3.5 h-3.5 flex-shrink-0 ${s.iconClass}"></i>
                <span class="text-xs font-medium text-gray-700">${this.esc(s.label)}</span>
            </label>`).join('');

        const html = `
            <div id="${modalId}" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" data-sf-backdrop></div>
                <div class="relative w-full max-w-xs bg-white border border-gray-200 rounded-xl shadow-2xl shadow-black/30 overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <p class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                            <i data-lucide="bookmark-plus" class="w-3.5 h-3.5 text-blue-600"></i>
                            ${this.esc(o.labels.modalTit)}
                        </p>
                        <button id="${modalId}_close" class="text-gray-400 hover:text-gray-700 transition-colors">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <div class="px-4 pt-4 pb-3 flex flex-col gap-3">
                        <div class="flex flex-col gap-1">
                            <label class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                ${this.esc(o.labels.nombreLbl)}
                            </label>
                            <input id="${modalId}_name" type="text" maxlength="80" autocomplete="off"
                                class="w-full bg-white border border-gray-300 rounded-lg px-3 py-2
                                       text-xs text-gray-800 placeholder-gray-400 outline-none
                                       focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                                placeholder="${this.esc(o.labels.nombreLbl)}...">
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                ${this.esc(o.labels.scopeLbl)}
                            </label>
                            <div class="flex flex-col gap-1.5">
                                ${scopeRadios}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
                        <button id="${modalId}_cancel"
                            class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600
                                   border border-gray-300 hover:border-gray-400 hover:text-gray-800 transition-all">
                            ${this.esc(o.labels.cancelar)}
                        </button>
                        <button id="${modalId}_confirm"
                            class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white
                                   bg-blue-600 hover:bg-blue-500 border border-blue-600
                                   flex items-center gap-1.5 transition-all">
                            <i data-lucide="bookmark-check" class="w-3 h-3"></i>
                            ${this.esc(o.labels.btnGuardar)}
                        </button>
                    </div>
                </div>
            </div>`;

        $('body').append(html);
        if (window.lucide) lucide.createIcons();
        $(`#${modalId}_name`).focus();

        const closeSaveModal = () => $(`#${modalId}`).remove();

        $(`#${modalId}`).on('click', '[data-sf-backdrop]', closeSaveModal);
        $(`#${modalId}_close`).on('click', closeSaveModal);
        $(`#${modalId}_cancel`).on('click', closeSaveModal);

        $(`#${modalId}`).on('change', `input[name="${modalId}_scope"]`, function () {
            $(`#${modalId} .scope-radio-label`).removeClass('border-blue-300 bg-blue-50')
                .addClass('border-gray-200 bg-white');
            $(this).closest('.scope-radio-label').removeClass('border-gray-200 bg-white')
                .addClass('border-blue-300 bg-blue-50');
        });

        $(`#${modalId}_confirm`).on('click', async () => {
            const name = $(`#${modalId}_name`).val().trim();
            if (!name) { $(`#${modalId}_name`).focus(); return; }
            const scope     = $(`input[name="${modalId}_scope"]:checked`).val() || 'user';
            const productos = this.lote.map(p => Object.assign({}, p));

            await this.storeFormato(name, scope, productos);
            this.formatoAplicado = true;
            this.syncSaveFormato();
            closeSaveModal();
        });

        $(`#${modalId}_name`).on('keydown', (e) => {
            if (e.key === 'Enter')  $(`#${modalId}_confirm`).trigger('click');
            if (e.key === 'Escape') { e.stopPropagation(); closeSaveModal(); }
        });
    }

    // formatoAplicado: el lote salio de un formato o ya se guardo como uno.
    syncSaveFormato() {
        const sugerir = this.lote.length > 0 && !this.formatoAplicado && !this.editing;
        $(`#${this.opts.id}_btnSaveFormato`).toggleClass('!bg-blue-50 !text-blue-700 !border-blue-300 font-semibold', sugerir);
    }

    // silent: guardado ofrecido al registrar; el aviso de la entrada ya cubre el exito.
    async storeFormato(name, scope, productos, silent = false) {
        if (typeof this.opts.onSaveFormato === 'function') {
            await this.opts.onSaveFormato({ name: name, scope: scope, productos: productos, silent: silent });
        } else {
            const formatos = this.loadLocalFormatos();
            formatos.unshift({ id: Date.now(), name: name, scope: scope, productos: productos, createdAt: new Date().toISOString() });
            this.persistLocalFormatos(formatos);
        }
        await this.refreshFormatos();
    }

    // Nombre del dia de la fecha de la entrada ("Lunes"), si aun no existe un
    // formato con ese nombre y el lote no salio de un formato; si no, null.
    formatoDelDia() {
        if (this.editing || this.formatoAplicado || !this.lote.length) return null;
        const fecha = String($(`#${this.opts.id}_inpFecha`).val() || '').split('-').map(Number);
        if (fecha.length !== 3 || !fecha[0]) return null;

        const dia  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(fecha[0], fecha[1] - 1, fecha[2]).getDay()];
        const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
        return (this.formatos || []).some(f => norm(f.name) === norm(dia)) ? null : dia;
    }

    applyFormato(id) {
        const f = (this.formatos || []).find(x => String(x.id) === String(id));
        if (!f) return;
        // Rearma el lote por el mismo camino que agregar desde el buscador: seedTax
        // deriva costo (c/imp), base s/imp e impuesto desde price_without_tax + tax
        // del catalogo vigente, de modo que el formato refleja el precio/impuesto
        // actual del producto en lugar de uno congelado al guardarlo.
        this.lote = (f.productos || []).map(p =>
            Object.assign({}, p, this.seedTax(p), { cantidad: Number(p.cantidad || 0), stock: this.stockOf(p.id) })
        );
        this.formatoAplicado = f.id;
        $(`#${this.opts.id}_formatosDropdown`).addClass('hidden');
        this.renderLote();
    }

    deleteFormato(id) {
        this.confirmBox(this.opts.labels.confirmDel, async () => {
            if (typeof this.opts.onDeleteFormato === 'function') {
                await this.opts.onDeleteFormato(id);
            } else {
                this.persistLocalFormatos(this.loadLocalFormatos().filter(x => String(x.id) !== String(id)));
            }
            await this.refreshFormatos();
        });
    }

    renderFormatosBadge() {
        const count = (this.formatos || []).length;
        const $b = $(`#${this.opts.id}_cntFormatos`);
        if (count > 0) $b.text(count).removeClass('hidden');
        else           $b.addClass('hidden');
    }

    renderFormatosLista() {
        const o        = this.opts;
        const $lista   = $(`#${o.id}_formatosLista`);
        const formatos = this.formatos || [];
        if (!formatos.length) {
            $lista.html(`
                <div class="flex flex-col items-center justify-center py-6 px-3 text-center">
                    <div class="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center mb-2">
                        <i data-lucide="inbox" class="w-5 h-5 text-gray-400"></i>
                    </div>
                    <p class="text-[11px] text-gray-500">${this.esc(o.labels.sinFormatos)}</p>
                </div>`);
        } else {
            const scopeMap = {
                user:       { icon: 'user',       cls: 'text-gray-400' },
                subsidiary: { icon: 'store',      cls: 'text-sky-500'  },
                company:    { icon: 'building-2', cls: 'text-blue-600' }
            };
            $lista.html(formatos.map(f => {
                const uds = (f.productos || []).reduce((s, p) => s + Number(p.cantidad || 0), 0);
                const tot = (f.productos || []).reduce((s, p) => s + Number(p.cantidad || 0) * Number(p.costo || 0), 0);
                const sc  = scopeMap[f.scope || 'user'] || scopeMap.user;
                return `
                    <div class="group flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-blue-50/60 transition-all cursor-pointer" data-apply-id="${f.id}">
                        <div class="w-7 h-7 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="bookmark" class="w-3.5 h-3.5 text-blue-600"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5">
                                <p class="text-xs font-semibold text-gray-800 truncate">${this.esc(f.name)}</p>
                                <i data-lucide="${sc.icon}" class="w-3 h-3 flex-shrink-0 ${sc.cls}"></i>
                            </div>
                            <p class="text-[10px] text-gray-500">${f.productos.length} prod. . ${this.fmtQty(uds)} uds . ${this.fmtMoneyShort(tot)}</p>
                        </div>
                        <button class="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0 transition-colors" data-delete-id="${f.id}" title="${this.esc(o.labels.confirmDel)}">
                            <i data-lucide="trash-2" class="w-3 h-3"></i>
                        </button>
                    </div>`;
            }).join(''));
        }
        if (window.lucide) lucide.createIcons();
    }

    refreshAlmacenes(branchId) {
        $(`#${this.opts.id}_selAlmacen`).html(this.almacenOptions(branchId));
    }

    // Una sucursal sin almacenes activos lo dice en el select en vez de dejarlo en blanco.
    almacenOptions(branchId, selected) {
        const items = (this.opts.data.almacenes || []).filter(a =>
            !branchId || String(a.branch_id) === String(branchId)
        );
        if (!items.length) return `<option value="">${this.esc(this.opts.labels.sinAlmacenes)}</option>`;
        return items.map(it => this.optionTag(it, selected)).join('');
    }

    // El Destino es un área DEL almacén elegido. Un área sin almacén (anterior a esa
    // regla) se ofrece en todos para no perderla.
    destinoOptions(warehouseId) {
        const items = (this.opts.data.areas || []).filter(a =>
            !a.warehouse_id || String(a.warehouse_id) === String(warehouseId)
        );
        return `<option value="">${this.esc(this.opts.labels.destinoPh)}</option>`
            + items.map(it => this.optionTag(it)).join('');
    }

    refreshDestinos(warehouseId) {
        $(`#${this.opts.id}_selDestino`).html(this.destinoOptions(warehouseId));
    }

    // Pide al host el stock del almacen seleccionado y lo refleja en el catalogo
    // y en el lote: el stock vive por almacen+producto, asi que cambia con el almacen.
    reloadStock(warehouseId) {
        if (typeof this.opts.onWarehouseChange !== 'function') return;
        this.opts.onWarehouseChange(warehouseId, (stockMap) => this.applyStock(stockMap));
    }

    applyStock(stockMap) {
        this.stockMap = stockMap || {};
        (this.opts.json || []).forEach(p => { p.stock = this.stockOf(p.id); });
        this.lote.forEach(p => { p.stock = this.stockOf(p.id); });
        this.renderLote();
    }

    stockOf(id) {
        return Number((this.stockMap || {})[String(id)] || 0);
    }

    toggleFormatosDropdown() {
        const $dd = $(`#${this.opts.id}_formatosDropdown`);
        if ($dd.hasClass('hidden')) {
            this.renderFormatosLista();   // pinta lo que haya en cache de inmediato
            $dd.removeClass('hidden');
            this.refreshFormatos();       // y recarga desde la fuente (BD) en segundo plano
        } else {
            $dd.addClass('hidden');
        }
    }

    // -- Eventos --

    bindEvents() {
        const wrap = this.wrap;
        const id   = this.opts.id;

        wrap.on('click', '[data-modal-close]',        () => this.closeModal());
        wrap.on('change', `#${id}_selOrigen`,         () => this.syncProveedorVisibility());
        wrap.on('click', `#${id}_btnNuevoProveedor`,  () => this.openNuevoProveedor());
        wrap.on('click', '[data-create-product]',     (e) => this.openNuevoProducto($(e.currentTarget).attr('data-create-product')));
        wrap.on('change', `#${id}_selSucursal`, (e) => {
            this.refreshAlmacenes(e.target.value);
            this.refreshDestinos($(`#${id}_selAlmacen`).val());
            this.reloadStock($(`#${id}_selAlmacen`).val());
        });
        wrap.on('change', `#${id}_selAlmacen`, (e) => {
            this.refreshDestinos(e.target.value);
            this.reloadStock(e.target.value);
        });
        wrap.on('input', `#${id}_buscarProducto`,     (e) => this.doSearch(e.target.value));
        wrap.on('keydown', `#${id}_buscarProducto`,   (e) => this.onSearchKeydown(e));
        wrap.on('keydown', `#${id}_listaProductos input[data-field]`, (e) => this.onRowKeydown(e));
        wrap.on('click', '[data-add-id]', (e) => {
            const pid = $(e.currentTarget).attr('data-add-id');
            if ($(e.currentTarget).closest(`#${id}_float`).length) {
                this.commitDraft((this.opts.json || []).find(p => String(p.id) === String(pid)));
            } else {
                this.addProducto(pid);
            }
        });
        wrap.on('click', '[data-remove]',             (e) => this.removeProducto(Number($(e.currentTarget).attr('data-remove'))));
        wrap.on('input', 'input[data-field]',         (e) => this.updateField($(e.currentTarget)));

        wrap.on('input',   `#${id}_draftInput`,       (e) => this.onDraftInput(e.target.value));
        wrap.on('keydown', `#${id}_draftInput`,       (e) => this.onDraftKeydown(e));
        wrap.on('click',   '[data-draft-remove]',     () => this.removeDraft());

        wrap.on('input', 'input[data-field="tax"]',   (e) => this.openTaxList(Number($(e.currentTarget).attr('data-idx')), true));
        wrap.on('click', 'input[data-field="tax"]',   (e) => this.openTaxList(Number($(e.currentTarget).attr('data-idx')), false));
        wrap.on('click', '[data-tax-toggle]',         (e) => this.toggleTaxList(Number($(e.currentTarget).attr('data-tax-toggle'))));
        wrap.on('click', '[data-tax-val]', (e) => {
            if (this.float && this.float.kind === 'tax') this.selectTax(this.float.idx, $(e.currentTarget).attr('data-tax-val'));
        });

        // La lista flotante no roba el foco al input: asi un click en una opcion
        // no dispara el focusout que la cierra.
        wrap.on('mousedown', `#${id}_float, [data-tax-toggle]`, (e) => e.preventDefault());
        wrap.on('focusout', `#${id}_draftInput, input[data-field="tax"]`, () => this.closeFloat());
        $(`#${id}_listaProductos`).on('scroll', () => this.placeFloat());
        wrap.on('click', `#${id}_btnVoucher`,         () => $(`#${id}_voucherInput`).trigger('click'));
        // Solo la zona: Enter sobre la X de adentro debe quitar, no abrir el selector.
        wrap.on('keydown', `#${id}_btnVoucher`, (e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $(`#${id}_voucherInput`).trigger('click'); }
        });
        wrap.on('click', `#${id}_voucherClear`, (e) => { e.stopPropagation(); this.setVoucher(null); });
        wrap.on('change', `#${id}_voucherInput`, (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this.attachVoucher(file);
        });

        // El wrap cancela dragover/drop: un archivo soltado fuera de la zona no
        // hace que el navegador lo abra y se pierda el lote.
        const dropOn = 'ring-2 ring-blue-400 !border-blue-400 !bg-blue-50';
        wrap.on('dragover drop', (e) => e.preventDefault());
        wrap.on('dragenter dragover', `#${id}_btnVoucher`, (e) => $(e.currentTarget).addClass(dropOn));
        wrap.on('dragleave', `#${id}_btnVoucher`, (e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) $(e.currentTarget).removeClass(dropOn);
        });
        wrap.on('drop', `#${id}_btnVoucher`, (e) => {
            $(e.currentTarget).removeClass(dropOn);
            const files = e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.files;
            if (files && files[0]) this.attachVoucher(files[0]);
        });
        wrap.on('click', `#${id}_btnIA`,              () => this.opts.onOpenIA());
        wrap.on('click', `#${id}_btnLimpiarLote`,     () => this.clearLote());
        wrap.on('click', `#${id}_btnRegistrar`,       () => this.doRegistrar());
        wrap.on('click', `#${id}_btnSaveFormato`,     () => this.saveFormato());
        wrap.on('click', `#${id}_btnLoadFormato`,     (e) => { e.stopPropagation(); this.toggleFormatosDropdown(); });
        wrap.on('click', `#${id}_btnCloseFormatos`,   () => $(`#${id}_formatosDropdown`).addClass('hidden'));
        wrap.on('click', '[data-apply-id]', (e) => {
            if ($(e.target).closest('[data-delete-id]').length) return;
            this.applyFormato(Number($(e.currentTarget).attr('data-apply-id')));
        });
        wrap.on('click', '[data-delete-id]', (e) => {
            e.stopPropagation();
            this.deleteFormato(Number($(e.currentTarget).attr('data-delete-id')));
        });

        wrap.on('click', (e) => {
            const $dd = $(`#${id}_formatosDropdown`);
            if (!$dd.hasClass('hidden') && !$(e.target).closest(`#${id}_formatosDropdown, #${id}_btnLoadFormato`).length) {
                $dd.addClass('hidden');
            }
        });

        // Click fuera de la barra de busqueda cierra el dropdown de resultados.
        wrap.on('click', (e) => {
            if (this.searchTerm && !$(e.target).closest(`#${id}_searchBar`).length) {
                this.resetSearchState();
                this.renderCatalogo();
            }
        });

        // Escape en cascada: lista flotante -> formatos -> cerrar (con confirmacion
        // si hay productos). Buscador, renglon vacio e impuesto lo atienden antes.
        $(document).off('keydown.entradaForm').on('keydown.entradaForm', (e) => {
            if (e.key !== 'Escape' || this.wrap.hasClass('hidden') || this.hasOverlay()) return;
            if (this.float) { this.closeFloat(); return; }
            const $dd = $(`#${id}_formatosDropdown`);
            if (!$dd.hasClass('hidden')) { $dd.addClass('hidden'); return; }
            this.requestClose();
        });
    }

    // -- API publica --

    open() {
        this.wrap.removeClass('hidden');
        this.refreshFormatos();
        this.syncProveedorVisibility();
        if (window.lucide) lucide.createIcons();
        this.refreshDestinos($(`#${this.opts.id}_selAlmacen`).val());
        this.reloadStock($(`#${this.opts.id}_selAlmacen`).val());
        setTimeout(() => $(`#${this.opts.id}_buscarProducto`).trigger('focus'), 50);
    }

    close() {
        this.closeModal();
    }

    // Abre una entrada ya registrada con sus datos y renglones. Al guardar llama
    // onUpdate (en vez de onAdd) con el mismo payload mas el id de la entrada.
    openEdit(entrada) {
        const id = this.opts.id;
        this.setMode(entrada);

        $(`#${id}_selOrigen`).val(String(entrada.origen || ''));
        this.syncProveedorVisibility();
        $(`#${id}_selSucursal`).val(String(entrada.branch_id || ''));
        this.refreshAlmacenes(entrada.branch_id);
        $(`#${id}_selAlmacen`).val(String(entrada.warehouse_id || ''));
        this.refreshDestinos(entrada.warehouse_id);
        $(`#${id}_selDestino`).val(entrada.warehouse_area_id ? String(entrada.warehouse_area_id) : '');
        $(`#${id}_selProveedor`).val(entrada.supplier_id ? String(entrada.supplier_id) : '');
        $(`#${id}_inpFecha`).val(entrada.fecha || '');
        $(`#${id}_inpNota`).val(entrada.nota || '');

        this.lote  = (entrada.productos || []).map(p => Object.assign({}, p));
        this.draft = null;
        this.resetSearchState();

        this.wrap.removeClass('hidden');
        this.renderLote();
        this.reloadStock(entrada.warehouse_id);
    }

    // Alta (entrada = null) o edicion: titulo y boton de guardar. Al salir de una
    // edicion se limpian los campos que setData no toca.
    setMode(entrada) {
        const o  = this.opts;
        const id = o.id;
        this.editing = entrada ? { id: entrada.id, folio: entrada.folio } : null;

        $(`#${id}_title`).text(entrada ? `${o.labels.titleEdit} ${entrada.folio || ''}`.trim() : o.labels.title);
        $(`#${id}_btnRegistrar span`).text(entrada ? o.labels.guardarEdit : o.labels.registrar);

        if (!entrada) {
            $(`#${id}_selDestino`).val('');
            $(`#${id}_selProveedor`).val('');
            $(`#${id}_inpNota`).val('');
        }
    }

    setData(newData) {
        Object.assign(this.opts.data, newData || {});
        const id = this.opts.id;
        if (newData && 'fecha' in newData)           $(`#${id}_inpFecha`).val(newData.fecha);
        if (newData && 'branch_id' in newData) {
            $(`#${id}_selSucursal`).val(newData.branch_id);
            this.refreshAlmacenes(newData.branch_id);
        }
        if (newData && 'nota' in newData)            $(`#${id}_inpNota`).val(newData.nota);
    }

    // -- Helpers --

    esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    prodThumb(p, boxCls, iconCls) {
        const box  = boxCls  || 'w-8 h-8';
        const ico  = iconCls || 'w-4 h-4';
        const src  = p.image ? `https://huubie.com.mx/${String(p.image).replace(/^\/+/, '')}` : '';
        const img  = src
            ? `<img src="${this.esc(src)}" alt="" class="absolute inset-0 w-full h-full object-cover" onerror="this.style.display='none'">`
            : '';
        return `
            <div class="relative ${box} rounded-lg ${this.esc(p.bg)} flex items-center justify-center flex-shrink-0 ring-1 ring-black/5 overflow-hidden">
                <i data-lucide="${this.esc(p.icon)}" class="${ico} ${this.esc(p.color)}"></i>
                ${img}
            </div>`;
    }

    fmtMoney(n) {
        return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    fmtMoneyShort(n) {
        return '$' + Number(n).toLocaleString('en-US');
    }

    // Unidades con 2 decimales como máximo y sin ceros de relleno (3, 2.5, 1.25).
    fmtQty(n) {
        return Number(Number(n || 0).toFixed(2));
    }

    optionTag(item, sel) {
        return `<option value="${this.esc(item.id || item.valor)}"${sel === (item.id || item.valor) ? ' selected' : ''}>${this.esc(item.valor)}</option>`;
    }

    selectWrap(selectHtml) {
        return `
            <div class="relative">
                ${selectHtml}
                <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 flex items-center">
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                </span>
            </div>`;
    }
}


Templates.prototype.entradaForm = function (options) {
    const form = new EntradaForm(options);
    // Referencia al Templates para reutilizar componentes propios (alertBox).
    form.tpl = this;
    return form;
};
