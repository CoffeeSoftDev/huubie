// Modal de captura de salidas. Mismo diseño y forma de capturar que el de entradas
// (entrada-form.js): buscador arriba con desplegable, tabla del lote a todo lo ancho,
// renglón vacío con ↓ y flechas entre renglones. Lo propio de salidas: motivo,
// evidencia fotográfica, costo bloqueado (el del producto) y aviso de stock insuficiente.

class SalidaForm {

    constructor(options) {

        this.cls = {
            label:   'block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1',
            input:   'w-full px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400',
            select:  'w-full px-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all cursor-pointer appearance-none pr-8',
            search:  'w-full pl-8 pr-3 py-2 text-sm text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400',
            qtyInp:  'no-spin w-full px-3 py-2 text-sm font-bold text-center text-gray-800 bg-white border border-gray-300 rounded outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all',
            btnOut:  'px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-800 hover:border-gray-400 transition-all',
            btnOk:   'px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-md hover:bg-red-500 hover:shadow-lg transition-all flex items-center gap-1.5',
            btnIco:  'px-2.5 py-1.5 text-[11px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all flex items-center gap-1.5',
            btnIA:   'px-3 py-1.5 text-[11px] font-bold text-gray-800 bg-violet-50 border !border-violet-300 rounded-md shadow-sm shadow-violet-500/25 hover:bg-violet-100 hover:!border-violet-500 transition-all flex items-center gap-1.5',
            iaTag:   'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold leading-none bg-violet-100 text-violet-700 flex-shrink-0',
            badge:   'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none'
        };

        const defaults = {
            parent: 'body',
            id:     'salidaFormModal',
            class:  'hidden fixed inset-0 z-[100] flex items-center justify-center',
            json:   [],
            data: {
                motivos:      [],
                sucursales:   [],
                almacenes:    [],
                motivo:       '',
                branch_id:    '',
                warehouse_id: '',
                fecha:        '',
                nota:         ''
            },
            labels: {
                title:          'Registrar Salida',
                subtitle:       'Reporta productos dañados, vencidos o perdidos',
                motivo:         'Motivo',
                sucursal:       'Sucursal',
                almacen:        'Almacen',
                fecha:          'Fecha',
                nota:           'Observaciones (opcional)',
                placeholder:    'Buscar productos por nombre o SKU...',
                searchHint:     'Sin resultados',
                fotoLbl:        'Adjuntar evidencia fotografica',
                fotoBtn:        'Evidencia',
                quitarFoto:     'Quitar evidencia',
                productosLbl:   'Productos de la salida',
                saleDeLbl:      'Sale de',
                categoriasLbl:  'Categorias',
                costoRefLbl:    'Costo',
                perdidaLbl:     'Valor de salidas',
                emptyTitle:     'Aun no has agregado productos',
                emptyHint:      'Usa el buscador o presiona ↓ para capturar en un renglon',
                draftPh:        'Escribe el nombre o SKU del producto...',
                quitarRenglon:  'Quitar renglon',
                hintRenglon:    'renglon vacio',
                hintBuscador:   'volver al buscador',
                sinAlmacenes:   'Sin almacenes activos',
                sinAlmacenesMsg:'La sucursal no tiene almacenes activos',
                stockInsuf:     'Stock insuficiente',
                noAgregado:     'No encontré «{q}» en el catálogo: no se agregó a la salida',
                confirmClose:   'Descartar los productos capturados?',
                confirmCloseOk: 'Si, descartar',
                confirmClear:   'Eliminar todos los productos de la salida?',
                limpiar:        'Limpiar',
                cancelar:       'Cancelar',
                registrar:      'Registrar Salida',
                iaBtn:          'CoffeeIA',
                iaTag:          'Agregado con CoffeeIA'
            },
            onSubmit:          () => {},
            onClose:           () => {},
            onOpenIA:          null,
            onSearch:          null,
            onWarehouseChange: null
        };

        const o = options || {};
        this.opts        = Object.assign({}, defaults, o);
        this.opts.data   = Object.assign({}, defaults.data,   o.data   || {});
        this.opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        this.lote         = [];
        this.draft        = null;   // renglón vacío con buscador propio ({ term })
        this.float        = null;   // lista flotante del renglón vacío
        this.photo        = null;
        this.searchTerm   = '';
        this.activeIdx    = 0;      // resultado resaltado para navegación por teclado
        this.catalogItems = [];     // resultados visibles actuales del catálogo

        this.ensureStyles();
        this.mount();
        this.bindEvents();
        this.renderLote();
    }

    // -- Render estático --

    renderHeader() {
        const o = this.opts;
        return `
            <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                        <i data-lucide="package-minus" class="w-5 h-5 text-white"></i>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-gray-800">${this.esc(o.labels.title)}</h3>
                        <p class="text-[11px] text-gray-500">${this.esc(o.labels.subtitle)}</p>
                    </div>
                </div>
                <button class="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400" data-modal-close>
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>`;
    }

    renderConfigRow() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60">
                <div class="grid grid-cols-4 gap-3 items-end">
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.motivo)}</label>
                        ${this.selectWrap(`
                            <select id="${o.id}_selMotivo" class="${cls.select}">
                                ${(o.data.motivos || []).map(it => this.optionTag(it, o.data.motivo)).join('')}
                            </select>
                        `)}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.sucursal)}</label>
                        ${this.selectWrap(`
                            <select id="${o.id}_selSucursal" class="${cls.select} !pl-10">
                                ${(o.data.sucursales || []).map(it => this.optionTag(it, o.data.branch_id)).join('')}
                            </select>
                        `, 'building-2')}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.almacen)}</label>
                        ${this.selectWrap(`
                            <select id="${o.id}_selAlmacen" class="${cls.select} !pl-10">
                                ${this.almacenOptions(o.data.branch_id, o.data.warehouse_id)}
                            </select>
                        `, 'warehouse')}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.fecha)}</label>
                        <input id="${o.id}_inpFecha" type="date" value="${this.esc(o.data.fecha)}" class="${cls.input}">
                    </div>
                </div>
            </div>`;
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
                        <span class="sf-kbd">&uarr;&darr;</span><span>navegar</span>
                        <span class="sf-kbd">Enter</span><span>agregar</span>
                    </div>
                    <div id="${o.id}_catalogoLista" class="hidden absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl shadow-black/20 overflow-hidden"></div>
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
                        <span class="sf-kbd">&darr;</span>${this.esc(o.labels.hintRenglon)}
                        <span class="sf-kbd ml-1.5">Enter</span>${this.esc(o.labels.hintBuscador)}
                    </span>
                    ${typeof o.onOpenIA === 'function' ? `
                    <button id="${o.id}_btnIA" type="button" class="${cls.btnIA}">
                        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-violet-600"></i><span>${this.marcaIA(o.labels.iaBtn)}</span>
                    </button>` : ''}
                    <button id="${o.id}_btnLimpiarLote" class="text-[10px] text-gray-500 hover:text-red-500 transition flex items-center gap-1 hidden px-2 py-1 rounded-md hover:bg-red-50">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>${this.esc(o.labels.limpiar)}
                    </button>
                </div>
            </div>`;
    }

    renderResumen() {
        const o = this.opts;
        return `
            <div class="flex-shrink-0 border-t border-gray-200 px-5 py-2.5 bg-gray-50 flex items-center justify-between gap-4">
                <div class="flex items-center gap-5 text-[11px] text-gray-500">
                    <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Productos <strong class="text-blue-600 text-sm" id="${o.id}_qtyItems">0</strong></span>
                    <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>${this.esc(o.labels.saleDeLbl)} <strong class="text-blue-600 text-sm" id="${o.id}_qtySucursal">-</strong></span>
                    <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>${this.esc(o.labels.categoriasLbl)} <strong class="text-gray-800 text-sm" id="${o.id}_qtyCats">0</strong></span>
                </div>
                <div class="flex items-baseline gap-2.5">
                    <span class="text-[10px] uppercase tracking-wider text-gray-500">${this.esc(o.labels.perdidaLbl)}</span>
                    <span class="text-blue-600 font-bold text-lg leading-none" id="${o.id}_qtyCost">-$0.00</span>
                </div>
            </div>`;
    }

    renderFooter() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <div class="flex items-center gap-1.5 flex-1 min-w-0">
                    <i data-lucide="sticky-note" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0"></i>
                    <input id="${o.id}_inpNota" type="text" value="${this.esc(o.data.nota)}" placeholder="${this.esc(o.labels.nota)}..." class="${cls.input}">
                    <input id="${o.id}_photoInput" type="file" accept="image/*" capture="environment" class="hidden">
                    <button id="${o.id}_btnFoto" type="button" class="${cls.btnIco} flex-shrink-0" title="${this.esc(o.labels.fotoLbl)}">
                        <i data-lucide="camera" class="w-3.5 h-3.5 flex-shrink-0"></i><span id="${o.id}_fotoLbl" class="truncate max-w-[140px]">${this.esc(o.labels.fotoBtn)}</span>
                    </button>
                    <button id="${o.id}_photoRemove" type="button" class="hidden w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0" title="${this.esc(o.labels.quitarFoto)}">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                    <button class="${cls.btnOut}" data-modal-close>${this.esc(o.labels.cancelar)}</button>
                    <button id="${o.id}_btnRegistrar" class="${cls.btnOk}">
                        <i data-lucide="package-minus" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.registrar)}</span>
                    </button>
                </div>
            </div>`;
    }

    renderEmptyState() {
        const o = this.opts;
        return `
            <div class="flex flex-col items-center justify-center py-12 text-center">
                <div class="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                    <i data-lucide="package-minus" class="w-8 h-8 text-blue-400"></i>
                </div>
                <p class="text-xs font-semibold text-gray-700">${this.esc(o.labels.emptyTitle)}</p>
                <p class="text-[11px] text-gray-400 mt-1">${this.esc(o.labels.emptyHint)}</p>
            </div>`;
    }

    // Stock antes -> resultante; en rojo y con aviso si la salida lo deja en negativo.
    // Con el mismo producto en varios renglones, cada uno parte de lo que dejó el
    // anterior, igual que lo descuenta el servidor.
    stockCell(p, i) {
        const stock      = this.fmtQty(Number(p.stock || 0) - this.usadoAntes(p.id, i));
        const nuevo      = this.fmtQty(stock - Number(p.cantidad || 0));
        const stockColor = stock === 0 ? 'text-red-500' : stock < 5 ? 'text-orange-500' : 'text-green-600';
        const nuevoColor = nuevo < 0 ? 'text-red-600' : nuevo < 5 ? 'text-orange-500' : 'text-gray-700';
        const aviso      = nuevo < 0
            ? `<span class="block mt-0.5 text-[9px] font-bold uppercase tracking-wide text-red-600">${this.esc(this.opts.labels.stockInsuf)}</span>`
            : '';
        return `
            <span class="text-[11px] text-gray-500">
                <strong class="${stockColor}">${stock}</strong>
                <span class="text-gray-300 mx-0.5">&rarr;</span>
                <strong class="${nuevoColor}">${nuevo}</strong>
            </span>${aviso}`;
    }

    renderProductRow(p, i) {
        const cls         = this.cls;
        const cant        = Number(p.cantidad || 0);
        const costoNum    = Number(p.costo || 0);
        const subtotalFmt = (cant * costoNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `
            <tr class="border-b border-gray-100 last:border-b-0 hover:bg-blue-100/60 transition-colors" data-idx="${i}">
                <td class="px-3 py-2 align-middle w-28">
                    <span class="block truncate text-[11px] font-mono text-gray-500" title="${this.esc(p.sku)}">${this.esc(p.sku)}</span>
                </td>
                <td class="px-3 py-2 align-middle">
                    <div class="flex items-center gap-2.5 min-w-0">
                        ${this.prodThumb(p, 'w-8 h-8', 'w-3.5 h-3.5')}
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <p class="text-xs font-semibold text-gray-800 truncate leading-tight">${this.esc(p.nombre)}</p>
                                ${p.origen === 'ia' ? `<span class="${cls.iaTag}" title="${this.esc(this.opts.labels.iaTag)}"><i data-lucide="sparkles" class="w-2.5 h-2.5"></i>IA</span>` : ''}
                            </div>
                            ${p.categoria ? `<p class="text-[10px] text-gray-400 truncate mt-0.5">${this.esc(p.categoria)}</p>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-2 py-2 align-middle text-center w-36" data-stock-cell>${this.stockCell(p, i)}</td>
                <td class="px-2 py-2 align-middle w-24">
                    <input type="number" min="1" step="0.01" value="${cant}" class="${cls.qtyInp}" data-field="cantidad" data-idx="${i}">
                </td>
                <td class="px-2 py-2 align-middle w-28">
                    <div class="relative" title="Costo del producto (no editable)">
                        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                            <i data-lucide="dollar-sign" class="w-3 h-3"></i>
                        </span>
                        <div class="w-full pl-6 pr-6 py-2 text-sm text-right text-gray-600 bg-gray-50 border border-gray-200 rounded select-none cursor-not-allowed">${costoNum.toFixed(2)}</div>
                        <span class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                            <i data-lucide="lock" class="w-3 h-3"></i>
                        </span>
                    </div>
                </td>
                <td class="px-5 py-2 align-middle text-right w-28">
                    <span class="text-red-600 font-bold text-xs" data-subtotal>-$${subtotalFmt}</span>
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
                        <th class="text-center px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-36">Stock</th>
                        <th class="text-center px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">Cantidad</th>
                        <th class="text-left px-2 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-28">Costo</th>
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
                <td colspan="4"></td>
                <td class="px-2 py-2 align-middle text-center w-10">
                    <button class="w-6 h-6 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" data-draft-remove title="${this.esc(o.labels.quitarRenglon)}">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                </td>
            </tr>`;
    }

    renderDraftLista(items) {
        if (!items.length) return `<div class="px-3 py-4 text-center text-[11px] text-gray-500">${this.esc(this.opts.labels.searchHint)}</div>`;
        return `<div class="max-h-[240px] overflow-y-auto cs-scroll sf-scroll">${items.map((p, i) => this.renderSearchResult(p, i)).join('')}</div>`;
    }

    renderSearchResult(p, i) {
        const o          = this.opts;
        const stockColor = p.stock === 0 ? 'text-red-500' : p.stock < 5 ? 'text-orange-500' : 'text-green-600';
        const costoFmt   = Number(p.costo || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `
            <div class="sf-cat-item flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50/60 border-b border-gray-100 last:border-b-0 transition-all group" data-add-id="${this.esc(p.id)}" data-cat-idx="${i}">
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
                <div class="sf-add-btn w-7 h-7 rounded-lg bg-gray-100 border border-gray-200 text-gray-400 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                </div>
            </div>`;
    }

    ensureStyles() {
        if (document.getElementById('salidaFormStyles')) return;
        const css = `
            input.no-spin::-webkit-inner-spin-button,
            input.no-spin::-webkit-outer-spin-button { -webkit-appearance: none !important; appearance: none !important; margin: 0 !important; }
            input.no-spin { -moz-appearance: textfield !important; appearance: textfield !important; }
            .sf-scroll { scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent; }
            .sf-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
            .sf-scroll::-webkit-scrollbar-track { background: transparent; }
            .sf-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
            .sf-scroll::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
            .sf-cat-item.sf-active { background: rgb(var(--brand-600, 192 90 64) / 0.10); box-shadow: inset 0 0 0 1px rgb(var(--brand-600, 192 90 64) / 0.45); }
            .sf-cat-item.sf-active .sf-add-btn { background: rgb(var(--brand-600, 192 90 64)); border-color: rgb(var(--brand-600, 192 90 64)); color: #fff; }
            @keyframes sfFlash { 0% { background-color: rgba(239,68,68,0.16); } 100% { background-color: transparent; } }
            tr.sf-flash { animation: sfFlash 0.6s ease-out; }
            .sf-kbd { display: inline-flex; align-items: center; padding: 0 4px; height: 14px; border-radius: 3px; border: 1px solid #D1D5DB; background: #F3F4F6; font-size: 9px; line-height: 1; color: #6B7280; font-family: monospace; }`;
        const style = document.createElement('style');
        style.id = 'salidaFormStyles';
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
                ${this.renderFooter()}
                <div id="${o.id}_float" class="hidden absolute z-[60] bg-white border border-gray-200 rounded-lg shadow-2xl shadow-black/20 overflow-hidden"></div>
            </div>
        `);

        const $target = o.parent === 'body' || !$(`#${o.parent}`).length ? $('body') : $(`#${o.parent}`);
        $(`#${o.id}`).remove();
        $target.append(this.wrap);
    }

    // -- Render dinámico --

    updateTotals() {
        const o = this.opts;
        const totalItems = this.lote.length;
        const totalCosto = this.lote.reduce((s, p) => s + Number(p.cantidad || 0) * Number(p.costo || 0), 0);
        const totalCats  = new Set(this.lote.map(p => (p.categoria && String(p.categoria).trim()) || 'Sin categoria')).size;
        $(`#${o.id}_qtyItems`).text(totalItems);
        $(`#${o.id}_qtySucursal`).text(this.origenActual() || '-');
        $(`#${o.id}_qtyCats`).text(totalCats);
        $(`#${o.id}_qtyCost`).text('-' + this.fmtMoney(totalCosto));
        $(`#${o.id}_cntProductos`).text(totalItems);
    }

    renderCatalogo() {
        const o    = this.opts;
        const $dd  = $(`#${o.id}_catalogoLista`);
        const term = (this.searchTerm || '').toLowerCase();

        // El desplegable solo aparece al escribir; sin término la tabla ocupa todo el alto.
        if (!term) {
            this.catalogItems = [];
            $dd.addClass('hidden').empty();
            return;
        }

        const catalogo = this.opts.json || [];
        const items    = this.matchCatalogo(term);

        // Mismo orden en que se pintan los .sf-cat-item: las flechas indexan por posición.
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
                <span class="flex items-center gap-1"><span class="sf-kbd">&crarr;</span>agregar<span class="sf-kbd ml-1.5">esc</span>cerrar</span>
                <span>Mostrando ${items.length} de ${catalogo.length}</span>
            </div>`;

        const body = items.length
            ? `<div class="max-h-[340px] overflow-y-auto cs-scroll sf-scroll">${items.map((p, i) => this.renderSearchResult(p, i)).join('')}</div>`
            : `<div class="flex flex-col items-center justify-center py-8 text-center px-2">
                    <div class="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center mb-2">
                        <i data-lucide="search-x" class="w-5 h-5 text-gray-400"></i>
                    </div>
                    <p class="text-[11px] text-gray-500">${this.esc(o.labels.searchHint)}</p>
               </div>`;

        $dd.html(head + body + foot).removeClass('hidden');
        if (window.lucide) lucide.createIcons();
        this.highlightActive();
    }

    // Todo el catálogo: un producto que ya está en el lote puede entrar otra vez.
    matchCatalogo(term) {
        const t = String(term || '').trim().toLowerCase();
        if (!t) return [];
        return (this.opts.json || []).filter(p =>
            (p.nombre || '').toLowerCase().includes(t) || (p.sku || '').toLowerCase().includes(t)
        );
    }

    renderLote() {
        const o = this.opts;
        const $lista = $(`#${o.id}_listaProductos`);
        this.closeFloat();
        if (!this.lote.length && !this.draft) {
            $lista.html(this.renderEmptyState()).addClass('flex items-center justify-center');
        } else {
            $lista.html(this.renderProductsTable()).removeClass('flex items-center justify-center');
        }
        $(`#${o.id}_btnLimpiarLote`).toggleClass('hidden', !this.lote.length);
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

    // Agrega y limpia la búsqueda. Con focusQty salta a la cantidad del renglón
    // para teclearla; sin él, el foco se queda en el buscador (modo escáner, que
    // acumula sobre el renglón capturado a mano).
    commitProducto(prod, qty, focusQty) {
        if (!prod) return;
        this.resetSearchState();
        const idx = this.addRow(prod, qty || 1, !focusQty);
        if (focusQty) this.focusCantidad(idx);
        else $(`#${this.opts.id}_buscarProducto`).trigger('focus');
    }

    // Enter dentro de la cantidad vuelve al buscador (onRowKeydown) para encadenar.
    focusCantidad(idx) {
        const $inp = $(`#${this.opts.id}_listaProductos tr[data-idx="${idx}"] input[data-field="cantidad"]`);
        if ($inp.length) $inp.trigger('focus').trigger('select');
        else $(`#${this.opts.id}_buscarProducto`).trigger('focus');
    }

    // Con la lista llena, el renglón nuevo cae al borde: la lista salta hasta dejarlo
    // a media altura (debajo queda el espacio en blanco del final).
    revealRow(el) {
        const list = $(`#${this.opts.id}_listaProductos`)[0];
        if (!el || !list) return;
        const r = el.getBoundingClientRect();
        const l = list.getBoundingClientRect();
        if (r.top >= l.top && r.bottom <= l.bottom - r.height) return;
        list.scrollTop += (r.top - l.top) - (list.clientHeight - r.height) / 2;
    }

    // Cada producto elegido entra en su propio renglón: el mismo puede ir varias
    // veces, como en la nota. Con merge (lector de código) suma al último renglón
    // de ese producto capturado a mano. Devuelve el índice.
    addRow(prod, qty, merge) {
        qty = Math.max(1, Number(qty) || 1);
        let idx = merge ? this.lastManualIdx(prod.id) : -1;
        if (idx > -1) this.lote[idx].cantidad = this.fmtQty(Number(this.lote[idx].cantidad || 0) + qty);
        else idx = this.lote.push(Object.assign({}, prod, { cantidad: qty })) - 1;
        this.renderLote();
        this.revealRow($(`#${this.opts.id}_listaProductos tr[data-idx="${idx}"]`)[0]);
        this.flashRow(idx);
        return idx;
    }

    // Lo que se aplica en el chat de CoffeeIA: [{prod, cantidad}]. Un solo repintado;
    // cada uno entra en su renglón marcado como IA, la cantidad respeta decimales y
    // el costo es siempre el del producto. Devuelve cuántos renglones agregó.
    addFromIA(items) {
        let added = 0;
        (items || []).forEach((it) => {
            if (!it.prod) return;
            const qty = Number(it.cantidad) > 0 ? Number(it.cantidad) : 1;
            this.lote.push(Object.assign({}, it.prod, { cantidad: this.fmtQty(qty), origen: 'ia' }));
            added++;
        });
        this.draft = null;
        this.renderLote();
        return added;
    }

    // Enter en el buscador: SKU exacto (lector de código) agrega 1 y sigue escaneando;
    // si no, el resaltado o la primera coincidencia, y salta a su cantidad.
    handleSearchEnter() {
        const all = this.opts.json || [];
        const q   = (this.searchTerm || '').toLowerCase();
        if (q) {
            const exact = all.find(p => String(p.sku || '').toLowerCase() === q);
            if (exact) { this.commitProducto(exact, 1, false); return; }
        }
        let prod = this.catalogItems.length ? (this.catalogItems[this.activeIdx] || this.catalogItems[0]) : null;
        if (!prod && q) {
            prod = all.find(p => (p.nombre || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
        }
        if (!prod && q) { this.notifyNoAgregado(this.searchTerm); return; }
        this.commitProducto(prod, 1, true);
    }

    notifyNoAgregado(term) {
        this.notify(this.opts.labels.noAgregado.replace('{q}', String(term).trim()));
    }

    resetSearchState() {
        this.searchTerm = '';
        this.activeIdx  = 0;
        $(`#${this.opts.id}_buscarProducto`).val('');
    }

    highlightActive() {
        const $items = $(`#${this.opts.id}_catalogoLista .sf-cat-item`);
        $items.removeClass('sf-active');
        const $a = $items.eq(this.activeIdx);
        $a.addClass('sf-active');
        if ($a.length && $a[0].scrollIntoView) $a[0].scrollIntoView({ block: 'nearest' });
    }

    flashRow(idx) {
        const $row = $(`#${this.opts.id}_listaProductos tr[data-idx="${idx}"]`);
        if (!$row.length) return;
        $row.removeClass('sf-flash');
        void $row[0].offsetWidth; // reinicia la animación al re-escanear el mismo producto
        $row.addClass('sf-flash');
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
                e.stopPropagation(); // primer Escape limpia; el segundo (vacío) cierra
                this.resetSearchState();
                this.renderCatalogo();
            }
        }
    }

    // En un renglón: Enter vuelve al buscador; flechas cambian de renglón (no suman al
    // número) y bajar desde el último abre el renglón vacío.
    onRowKeydown(e) {
        const $inp  = $(e.currentTarget);
        const idx   = Number($inp.attr('data-idx'));
        const field = $inp.attr('data-field');

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

    // -- Renglón vacío --

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
            items:    items,
            active:   0,
            $anchor:  $(`#${this.opts.id}_draftInput`),
            minWidth: 380
        }, this.renderDraftLista(items));
    }

    // Escape limpia lo escrito y, con el renglón ya vacío, lo quita. Arriba sin lista
    // abierta regresa al último renglón capturado.
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
            const prod = this.pickDraft();
            if (!prod && this.draft && this.draft.term.trim()) { this.notifyNoAgregado(this.draft.term); return; }
            this.commitDraft(prod);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this.lote.length) this.focusField(this.lote.length - 1, 'cantidad');
            else $(`#${id}_buscarProducto`).trigger('focus');
        }
    }

    // SKU exacto primero (lector de código), luego el resultado resaltado.
    pickDraft() {
        const q = String((this.draft && this.draft.term) || '').trim().toLowerCase();
        if (!q) return null;
        const exact = (this.opts.json || []).find(p => String(p.sku || '').toLowerCase() === q);
        if (exact) return exact;
        const f = this.float;
        return (f && f.items.length) ? (f.items[f.active] || f.items[0]) : null;
    }

    commitDraft(prod) {
        if (!prod) return;
        this.draft = null;
        this.focusCantidad(this.addRow(prod, 1, false));
    }

    // -- Lista flotante --

    // Vive en el panel, fuera del scroll de la tabla, para que el renglón del fondo no
    // la recorte. Nunca tapa la barra de totales: si no cabe, la lista se desplaza (el
    // espacio libre del final lo permite) y solo sin recorrido posible abre hacia arriba.
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
        const $items = $(`#${this.opts.id}_float .sf-cat-item`);
        $items.removeClass('sf-active');
        const $a = $items.eq(this.float.active);
        $a.addClass('sf-active');
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
        this.renderLote();
    }

    // Solo la cantidad es editable; 2 decimales como máximo (lo de más se corta).
    updateField($el) {
        const idx = Number($el.data('idx'));
        if (isNaN(idx) || !this.lote[idx] || $el.data('field') !== 'cantidad') return;
        const raw = String($el.val());
        const cut = raw.replace(/^(\d*\.\d{2})\d+$/, '$1');
        if (cut !== raw) $el.val(cut);
        this.lote[idx].cantidad = $el.val();
        this.refreshRow(idx);
        this.updateTotals();
    }

    // La cantidad de un renglón cambia el stock de los renglones del mismo producto.
    refreshRow(i) {
        const p = this.lote[i];
        if (!p) return;
        const subtotalFmt = (Number(p.cantidad || 0) * Number(p.costo || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const $lista = $(`#${this.opts.id}_listaProductos`);
        $lista.find(`tr[data-idx="${i}"] [data-subtotal]`).text('-$' + subtotalFmt);
        this.lote.forEach((x, j) => {
            if (String(x.id) === String(p.id)) $lista.find(`tr[data-idx="${j}"] [data-stock-cell]`).html(this.stockCell(x, j));
        });
    }

    usadoAntes(id, i) {
        return this.lote.slice(0, i)
            .filter(x => String(x.id) === String(id))
            .reduce((s, x) => s + Number(x.cantidad || 0), 0);
    }

    lastManualIdx(id) {
        for (let i = this.lote.length - 1; i >= 0; i--) {
            if (String(this.lote[i].id) === String(id) && this.lote[i].origen !== 'ia') return i;
        }
        return -1;
    }

    clearLote() {
        if (!this.lote.length) return;
        this.confirmBox(this.opts.labels.confirmClear, () => {
            this.lote  = [];
            this.draft = null;
            this.renderLote();
        });
    }

    sucursalActual() {
        return $(`#${this.opts.id}_selSucursal option:selected`).text().trim();
    }

    // De dónde sale la mercancía: sucursal · almacén (sin almacén, solo la sucursal).
    origenActual() {
        const $alm = $(`#${this.opts.id}_selAlmacen`);
        const alm  = $alm.val() ? $alm.find('option:selected').text().trim() : '';
        return [this.sucursalActual(), alm].filter(Boolean).join(' · ');
    }

    // Almacenes de la sucursal; sin almacenes activos lo dice en el select.
    almacenOptions(branchId, selected) {
        const items = (this.opts.data.almacenes || []).filter(a =>
            !branchId || String(a.branch_id) === String(branchId)
        );
        if (!items.length) return `<option value="">${this.esc(this.opts.labels.sinAlmacenes)}</option>`;
        return items.map(it => this.optionTag(it, selected)).join('');
    }

    refreshAlmacenes(branchId) {
        $(`#${this.opts.id}_selAlmacen`).html(this.almacenOptions(branchId));
    }

    // El stock vive por almacén+producto: al cambiar de almacén se pide al host.
    reloadStock(warehouseId) {
        if (typeof this.opts.onWarehouseChange !== 'function') return;
        this.opts.onWarehouseChange(warehouseId, (stockMap) => this.applyStock(stockMap));
    }

    applyStock(stockMap) {
        const map = stockMap || {};
        const at  = (p) => Number(map[String(p.id)] || 0);
        (this.opts.json || []).forEach(p => { p.stock = at(p); });
        this.lote.forEach(p => { p.stock = at(p); });
        this.renderLote();
    }

    // -- Evidencia --

    // Se reduce a 1280 px en JPEG: una foto de cámara pesa varios MB y su base64
    // excedería el post_max_size de PHP al registrar.
    onPhotoChange(file) {
        if (!file) return;
        const o = this.opts;

        const apply = (dataUrl) => {
            this.photo = { name: file.name, dataUrl: dataUrl };
            $(`#${o.id}_fotoLbl`).text(file.name || o.labels.fotoBtn);
            $(`#${o.id}_btnFoto`).addClass('!text-green-700 !border-green-300 !bg-green-50');
            $(`#${o.id}_photoRemove`).removeClass('hidden');
        };

        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const max = 1280;
                let w = img.width, h = img.height;
                if (w > max || h > max) {
                    const scale = max / Math.max(w, h);
                    w = Math.round(w * scale);
                    h = Math.round(h * scale);
                }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                apply(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => apply(ev.target.result);
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    removePhoto() {
        const o = this.opts;
        this.photo = null;
        $(`#${o.id}_photoInput`).val('');
        $(`#${o.id}_fotoLbl`).text(o.labels.fotoBtn);
        $(`#${o.id}_btnFoto`).removeClass('!text-green-700 !border-green-300 !bg-green-50');
        $(`#${o.id}_photoRemove`).addClass('hidden');
    }

    closeModal() {
        this.wrap.addClass('hidden');
        this.lote  = [];
        this.draft = null;
        this.resetSearchState();
        this.removePhoto();
        this.renderLote();
        this.opts.onClose();
    }

    // Con productos capturados, cerrar pide confirmación: un doble Escape (limpiar la
    // búsqueda + cerrar) ya no tira la salida completa.
    requestClose() {
        if (!this.lote.length) { this.closeModal(); return; }
        this.confirmBox(this.opts.labels.confirmClose, () => this.closeModal(), {
            okLabel: this.opts.labels.confirmCloseOk
        });
    }

    hasOverlay() {
        return $('[data-ab-backdrop]').length > 0;
    }

    doRegistrar() {
        if (!this.lote.length) { this.notify('Agrega al menos un producto a la salida'); return; }
        const o = this.opts;
        const warehouseId = $(`#${o.id}_selAlmacen`).val();
        if (!warehouseId) { this.notify(o.labels.sinAlmacenesMsg); return; }

        const totUds   = this.fmtQty(this.lote.reduce((s, p) => s + Number(p.cantidad || 0), 0));
        const totCosto = this.lote.reduce((s, p) => s + Number(p.cantidad || 0) * Number(p.costo || 0), 0);
        const totProd  = this.lote.length;
        const payload  = {
            motivo:      $(`#${o.id}_selMotivo`).val(),       // shrinkage_reason_id
            sucursalId:  $(`#${o.id}_selSucursal`).val(),
            sucursal:    $(`#${o.id}_selSucursal option:selected`).text(),
            warehouseId: warehouseId,
            almacen:     $(`#${o.id}_selAlmacen option:selected`).text(),
            fecha:       $(`#${o.id}_inpFecha`).val(),
            nota:        $(`#${o.id}_inpNota`).val(),
            items:       this.lote.map(p => ({
                id:          p.id,
                nombre:      p.nombre,
                sku:         p.sku,
                qty:         Number(p.cantidad || 0),
                costo:       Number(p.costo || 0),
                costo_total: Number(p.cantidad || 0) * Number(p.costo || 0)
            })),
            total_unidades: totUds,
            total_costo:    totCosto,
            photo:          this.photo
        };

        // El registro es definitivo y descuenta stock del almacén: se pide confirmación.
        // Productos, sucursal y valor van en el color del resumen del modal.
        const dato = (txt) => `<strong class="text-blue-600">${txt}</strong>`;
        this.confirmBox('Registrar esta salida?', () => { o.onSubmit(payload); this.closeModal(); }, {
            detailHtml:  `Se registraran ${dato(`${totProd} ${totProd === 1 ? 'producto' : 'productos'}`)} de ${dato(this.esc(this.sucursalActual()))} por un valor de ${dato(this.fmtMoney(totCosto))}.<br>El stock se descontara del almacen y la accion es definitiva.`,
            okLabel:     'Sí, registrar',
            cancelLabel: 'No'
        });
    }

    // Aviso con el alertBox de CoffeeSoft; sin la referencia a Templates cae al nativo.
    notify(title, type = 'warning') {
        if (this.tpl && typeof this.tpl.alertBox === 'function') {
            this.tpl.alertBox({ type, title });
            this.focusAlert('[data-ab-ok]');
        } else {
            alert(title);
        }
    }

    // Confirmación con el alertBox propio: Enter queda sobre Cancelar (acciones destructivas).
    confirmBox(title, onOk, opts = {}) {
        if (this.tpl && typeof this.tpl.alertBox === 'function') {
            this.tpl.alertBox(Object.assign({
                type:        'cancel',
                title:       title,
                cancelLabel: this.opts.labels.cancelar,
                onOk:        onOk
            }, opts));
            this.focusAlert('[data-ab-cancel]');
        } else if (confirm(title)) {
            onOk();
        }
    }

    // Saca el foco del botón que abrió la alerta: sin esto, Enter volvía a pulsar
    // Registrar y apilaba otra confirmación encima.
    focusAlert(selector) {
        setTimeout(() => $(selector).last().trigger('focus'), 60);
    }

    // -- Eventos --

    bindEvents() {
        const wrap = this.wrap;
        const id   = this.opts.id;

        wrap.on('click', '[data-modal-close]',        () => this.requestClose());
        wrap.on('change', `#${id}_selSucursal`, (e) => {
            this.refreshAlmacenes(e.target.value);
            this.reloadStock($(`#${id}_selAlmacen`).val());
            this.updateTotals();
        });
        wrap.on('change', `#${id}_selAlmacen`,        (e) => this.reloadStock(e.target.value));
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

        // La lista flotante no roba el foco al input: un clic en una opción no dispara
        // el focusout que la cierra.
        wrap.on('mousedown', `#${id}_float`,          (e) => e.preventDefault());
        wrap.on('focusout', `#${id}_draftInput`,      () => this.closeFloat());
        $(`#${id}_listaProductos`).on('scroll', () => this.placeFloat());

        wrap.on('click',  `#${id}_btnFoto`,           () => $(`#${id}_photoInput`).trigger('click'));
        wrap.on('change', `#${id}_photoInput`,        (e) => this.onPhotoChange(e.target.files && e.target.files[0]));
        wrap.on('click',  `#${id}_photoRemove`,       () => this.removePhoto());
        wrap.on('click',  `#${id}_btnIA`,             () => this.opts.onOpenIA());
        wrap.on('click',  `#${id}_btnLimpiarLote`,    () => this.clearLote());
        wrap.on('click',  `#${id}_btnRegistrar`,      () => this.doRegistrar());

        // Clic fuera de la barra de búsqueda cierra el desplegable de resultados.
        wrap.on('click', (e) => {
            if (this.searchTerm && !$(e.target).closest(`#${id}_searchBar`).length) {
                this.resetSearchState();
                this.renderCatalogo();
            }
        });

        // Escape en cascada: lista flotante -> cerrar (con confirmación si hay
        // productos). Buscador y renglón vacío lo atienden antes.
        $(document).off('keydown.salidaForm').on('keydown.salidaForm', (e) => {
            if (e.key !== 'Escape' || this.wrap.hasClass('hidden') || this.hasOverlay()) return;
            if (this.float) { this.closeFloat(); return; }
            this.requestClose();
        });
    }

    // -- API pública --

    open() {
        this.wrap.removeClass('hidden');
        if (window.lucide) lucide.createIcons();
        this.reloadStock($(`#${this.opts.id}_selAlmacen`).val());
        setTimeout(() => $(`#${this.opts.id}_buscarProducto`).trigger('focus'), 50);
    }

    close() {
        this.closeModal();
    }

    setData(newData) {
        Object.assign(this.opts.data, newData || {});
        const id = this.opts.id;
        if (newData && 'motivo' in newData)       $(`#${id}_selMotivo`).val(newData.motivo);
        if (newData && 'branch_id' in newData) {
            $(`#${id}_selSucursal`).val(newData.branch_id);
            this.refreshAlmacenes(newData.branch_id);
            this.updateTotals();
        }
        if (newData && 'warehouse_id' in newData) $(`#${id}_selAlmacen`).val(newData.warehouse_id);
        if (newData && 'fecha' in newData)        $(`#${id}_inpFecha`).val(newData.fecha);
        if (newData && 'nota' in newData)         $(`#${id}_inpNota`).val(newData.nota);
    }

    // -- Helpers --

    esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    prodThumb(p, boxCls, iconCls) {
        const box = boxCls  || 'w-8 h-8';
        const ico = iconCls || 'w-4 h-4';
        const src = p.image ? `https://huubie.com.mx/${String(p.image).replace(/^\/+/, '')}` : '';
        const img = src
            ? `<img src="${this.esc(src)}" alt="" class="absolute inset-0 w-full h-full object-cover" onerror="this.style.display='none'">`
            : '';
        return `
            <div class="relative ${box} rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 ring-1 ring-black/5 overflow-hidden">
                <i data-lucide="${this.esc(p.icon || 'package')}" class="${ico} text-gray-500"></i>
                ${img}
            </div>`;
    }

    fmtMoney(n) {
        return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // "CoffeeIA" con el "IA" en morado, como la marca del chat.
    marcaIA(text) {
        const m = String(text || '').match(/^(.*?)(IA)$/);
        if (!m) return this.esc(text);
        return `${this.esc(m[1])}<span class="text-violet-600">IA</span>`;
    }

    // Unidades con 2 decimales como máximo y sin ceros de relleno (3, 2.5, 1.25).
    fmtQty(n) {
        return Number(Number(n || 0).toFixed(2));
    }

    optionTag(item, sel) {
        const val = item.id != null ? item.id : item.valor;
        return `<option value="${this.esc(val)}"${String(sel) === String(val) ? ' selected' : ''}>${this.esc(item.valor)}</option>`;
    }

    // Con icon, un cuadro con el tinte del acento a la izquierda, igual que el
    // selector de sucursal de la navbar (branch-pill-icon).
    selectWrap(selectHtml, icon) {
        const badge = icon
            ? `<span class="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                    <i data-lucide="${this.esc(icon)}" class="w-4 h-4"></i>
               </span>`
            : '';
        return `
            <div class="relative">
                ${badge}
                ${selectHtml}
                <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 flex items-center">
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                </span>
            </div>`;
    }
}

Templates.prototype.salidaForm = function (options) {
    const form = new SalidaForm(options);
    // Referencia al Templates para reutilizar componentes propios (alertBox).
    form.tpl = this;
    return form;
};
