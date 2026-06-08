const SAMPLE_ENTRADA = {
    json: [
        { id: '1', nombre: 'Café Americano 250g',  sku: 'CAF-001', stock: 12, costo: 85.00,  categoria: 'Bebidas calientes', icon: 'coffee',      bg: 'bg-amber-500/15',  color: 'text-amber-400',  image: '' },
        { id: '2', nombre: 'Té Verde 100g',         sku: 'TE-002',  stock: 3,  costo: 55.50,  categoria: 'Bebidas calientes', icon: 'leaf',        bg: 'bg-green-500/15',  color: 'text-green-400',  image: '' },
        { id: '3', nombre: 'Azúcar Morena 1kg',     sku: 'AZU-003', stock: 0,  costo: 32.00,  categoria: 'Insumos',           icon: 'package',     bg: 'bg-gray-500/15',   color: 'text-gray-400',   image: '' },
        { id: '4', nombre: 'Leche Entera 1L',       sku: 'LEC-004', stock: 24, costo: 28.00,  categoria: 'Lácteos',           icon: 'droplets',    bg: 'bg-blue-500/15',   color: 'text-blue-400',   image: '' }
    ],
    data: {
        origenes:   [
            { id: '1', valor: 'Proveedor directo' },
            { id: '2', valor: 'Produccion interna' },
            { id: '3', valor: 'Transferencia' }
        ],
        sucursales: [
            { id: '1', valor: 'Sucursal Centro', subsidiaries_id: '1' },
            { id: '2', valor: 'Sucursal Norte',  subsidiaries_id: '2' }
        ],
        almacenes:  [
            { id: '1', valor: 'Almacen General', subsidiaries_id: '1' },
            { id: '2', valor: 'Almacen Frio',    subsidiaries_id: '1' },
            { id: '3', valor: 'Almacen Norte',   subsidiaries_id: '2' }
        ],
        fecha:           '2026-06-01',
        subsidiaries_id: '1',
        warehouse_id:    '1',
        nota:            ''
    }
};

class EntradaForm {

    constructor(options) {

        this.FORMATOS_KEY = 'huubie_entradaFormatos';

        this.cls = {
            label:   'block text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1',
            input:   'w-full px-2.5 py-1.5 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded-md outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 hover:border-gray-600/80 transition-all placeholder:text-gray-600',
            select:  'w-full px-2.5 py-1.5 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded-md outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 hover:border-gray-600/80 transition-all cursor-pointer appearance-none pr-8',
            search:  'w-full pl-8 pr-2.5 py-1.5 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded-md outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 hover:border-gray-600/80 transition-all placeholder:text-gray-600',
            qtyInp:  'no-spin w-full px-3 py-1.5 text-[11px] font-bold text-center text-white bg-[#0f1825] border border-gray-700/60 rounded outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 transition-all',
            cashInp: 'no-spin w-full pl-6 pr-2.5 py-1.5 text-[11px] text-right text-white bg-[#0f1825] border border-gray-700/60 rounded outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 transition-all',
            btnOut:  'px-3 py-1.5 text-[11px] font-medium text-gray-300 bg-transparent border border-gray-700/60 rounded-md hover:bg-gray-700/30 hover:text-white hover:border-gray-600 transition-all',
            btnOk:   'px-3 py-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-emerald-600 to-green-600 rounded-md hover:from-emerald-500 hover:to-green-500 hover:shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-1.5',
            btnIco:  'px-2.5 py-1.5 text-[10px] font-medium text-gray-300 bg-[#0f1825] border border-gray-700/60 rounded-md hover:bg-purple-500/10 hover:text-white hover:border-purple-500/40 transition-all flex items-center gap-1.5',
            badge:   'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold leading-none'
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
                fecha:           '',
                subsidiaries_id: '',
                warehouse_id:    '',
                nota:            ''
            },
            labels: {
                title:        'Nueva Entrada de Stock',
                subtitle:     'Layout Compacto',
                origen:       'Origen',
                sucursal:     'Sucursal destino',
                almacen:      'Almacen',
                fecha:        'Fecha',
                nota:         'Nota (opcional)',
                buscar:       'Buscar productos',
                placeholder:  'Nombre o SKU...',
                searchHint:   'Sin resultados',
                resumenLbl:   'Resumen del lote',
                productosLbl: 'Productos',
                unidadesLbl:  'Unidades',
                costoTotLbl:  'Costo total',
                emptyTitle:   'Aun no has agregado productos',
                emptyHint:    'Usa el buscador para empezar',
                limpiar:      'Limpiar',
                cancelar:     'Cancelar',
                registrar:    'Registrar Entrada',
                stockAuto:    'El stock se actualizara automaticamente',
                guardar:      'Guardar formato',
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
            onAdd:    () => {},
            onClose:  () => {},
            onSearch: null,
            onUpdate: () => {}
        };

        const o = options || {};
        this.opts        = Object.assign({}, defaults, o);
        this.opts.data   = Object.assign({}, defaults.data,   o.data   || {});
        this.opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        this.lote          = [];
        this.searchTerm    = '';
        this.activeIdx     = 0;             // resultado resaltado para navegacion por teclado
        this.catalogItems  = [];            // resultados visibles actuales del catalogo
        this.collapsedCats = new Set();     // categorias plegadas en el catalogo
        this.editMode      = false;         // true cuando se edita una entrada existente
        this.editId        = null;          // id de la entrada en edicion

        this.ensureStyles();
        this.mount();
        this.bindEvents();
        this.renderLote();
        this.renderFormatosBadge();
    }

    // -- Render estático --

    renderHeader() {
        const o = this.opts;
        return `
            <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-700/60 bg-[#141d2b] flex-shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <i data-lucide="package-plus" class="w-5 h-5 text-white"></i>
                    </div>
                    <div>
                        <h3 id="${o.id}_title" class="text-sm font-bold text-white">${this.esc(o.labels.title)}</h3>
                        <p id="${o.id}_subtitle" class="text-[11px] text-gray-500">${this.esc(o.labels.subtitle)}</p>
                    </div>
                </div>
                <button class="w-8 h-8 rounded-lg bg-[#1a2332] border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500" data-modal-close>
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>`;
    }

    renderConfigRow() {
        const o   = this.opts;
        const cls = this.cls;
        const almacenesVisibles = (o.data.almacenes || []).filter(a =>
            !o.data.subsidiaries_id || String(a.subsidiaries_id) === String(o.data.subsidiaries_id)
        );
        return `
            <div class="px-5 pt-3 pb-3 border-b border-gray-800/70 bg-[#0f1825]/40">
                <div class="grid grid-cols-4 gap-3 items-end">
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
                                ${(o.data.sucursales || []).map(it => this.optionTag(it, o.data.subsidiaries_id)).join('')}
                            </select>
                        `)}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.almacen)}</label>
                        ${this.selectWrap(`
                            <select id="${o.id}_selAlmacen" class="${cls.select}">
                                ${almacenesVisibles.map(it => this.optionTag(it, o.data.warehouse_id)).join('')}
                            </select>
                        `)}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.fecha)}</label>
                        <input id="${o.id}_inpFecha" type="date" value="${this.esc(o.data.fecha)}" class="${cls.input}">
                    </div>
                </div>
            </div>`;
    }

    renderSearchPanel() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="flex-shrink-0">
                <p class="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">${this.esc(o.labels.buscar)}</p>
                <div class="relative">
                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none flex items-center">
                        <i data-lucide="search" class="w-3.5 h-3.5"></i>
                    </span>
                    <input id="${o.id}_buscarProducto" type="text" placeholder="${this.esc(o.labels.placeholder)}" class="${cls.search} !text-[10px]" autocomplete="off">
                </div>
                <p class="mt-1.5 text-[9px] text-gray-500 flex items-center flex-wrap gap-x-1.5 gap-y-1 leading-none">
                    <span class="ef-kbd">&uarr;&darr;</span><span>navegar</span>
                    <span class="ef-kbd">Enter</span><span>agregar</span>
                </p>
            </div>
            <div id="${o.id}_catalogoLista" class="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 -mr-1 cs-scroll ef-scroll bg-[#0f172a]/40 border border-gray-800/60 rounded-lg p-1.5"></div>`;
    }

    renderResumen() {
        const o = this.opts;
        return `
            <div class="flex-shrink-0 border-t border-gray-800/70 px-4 py-2.5 bg-[#0f1825]/50 flex items-center justify-between gap-4">
                <div class="flex items-center gap-4 text-[10px]">
                    <span class="text-gray-500"><strong class="text-white text-[13px]" id="${o.id}_qtyItems">0</strong> prod.</span>
                    <span class="text-gray-500"><strong class="text-white text-[13px]" id="${o.id}_qtyUnits">0</strong> uds</span>
                </div>
                <div class="flex items-baseline gap-2.5">
                    <span class="text-[9px] uppercase tracking-wider text-gray-500">${this.esc(o.labels.costoTotLbl)}</span>
                    <span class="text-green-400 font-bold text-[16px] leading-none" id="${o.id}_qtyCost">$0.00</span>
                </div>
            </div>`;
    }

    renderLoteHeader() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="px-4 py-2.5 border-b border-gray-800/70 flex items-center justify-between flex-shrink-0 bg-gradient-to-b from-[#0f1825]/60 to-transparent">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-md bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                        <i data-lucide="boxes" class="w-3.5 h-3.5 text-purple-400"></i>
                    </div>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-gray-300">${this.esc(o.labels.productosLbl)}</p>
                    <span id="${o.id}_cntProductos" class="${cls.badge} bg-gradient-to-br from-purple-500/25 to-fuchsia-500/15 text-purple-300 border border-purple-500/40">0</span>
                </div>
                <button id="${o.id}_btnLimpiarLote" class="text-[10px] text-gray-500 hover:text-red-400 transition flex items-center gap-1 hidden px-2 py-1 rounded-md hover:bg-red-500/10">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>${this.esc(o.labels.limpiar)}
                </button>
            </div>`;
    }

    renderFooter() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-700/60 bg-[#141d2b] flex-shrink-0">
                <div class="flex items-center gap-2 relative flex-shrink-0">
                    <button id="${o.id}_btnSaveFormato" class="${cls.btnIco}" title="${this.esc(o.labels.guardar)}">
                        <i data-lucide="bookmark-plus" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.guardar)}</span>
                    </button>
                    <button id="${o.id}_btnLoadFormato" class="${cls.btnIco}" title="${this.esc(o.labels.cargar)}">
                        <i data-lucide="folder-open" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.cargar)}</span>
                        <span id="${o.id}_cntFormatos" class="${cls.badge} bg-purple-500/20 text-purple-300 border border-purple-500/30 ml-0.5 hidden">0</span>
                    </button>
                    <div id="${o.id}_formatosDropdown" class="hidden absolute bottom-full left-0 mb-2 w-[280px] bg-[#0f172a] border border-gray-700/60 rounded-lg shadow-2xl shadow-black/60 overflow-hidden z-20">
                        <div class="px-3 py-2 border-b border-gray-800/70 bg-[#141d2b]/60 flex items-center justify-between">
                            <p class="text-[10px] font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                                <i data-lucide="layers" class="w-3 h-3 text-purple-400"></i>${this.esc(o.labels.formatosTit)}
                            </p>
                            <button id="${o.id}_btnCloseFormatos" class="text-gray-500 hover:text-white transition-colors">
                                <i data-lucide="x" class="w-3 h-3"></i>
                            </button>
                        </div>
                        <div id="${o.id}_formatosLista" class="max-h-[260px] overflow-y-auto cs-scroll"></div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 flex-1 min-w-0">
                    <i data-lucide="sticky-note" class="w-3.5 h-3.5 text-gray-500 flex-shrink-0"></i>
                    <input id="${o.id}_inpNota" type="text" value="${this.esc(o.data.nota)}" placeholder="${this.esc(o.labels.nota)}..." class="${cls.input}">
                </div>
                <div class="flex gap-2 flex-shrink-0">
                    <button class="${cls.btnOut}" data-modal-close>${this.esc(o.labels.cancelar)}</button>
                    <button id="${o.id}_btnRegistrar" class="${cls.btnOk}">
                        <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i><span id="${o.id}_btnRegistrarLbl">${this.esc(o.labels.registrar)}</span>
                    </button>
                </div>
            </div>`;
    }

    renderEmptyState() {
        const o = this.opts;
        return `
            <div class="flex flex-col items-center justify-center py-12 text-center">
                <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/5 flex items-center justify-center mb-3">
                    <i data-lucide="package-plus" class="w-8 h-8 text-purple-400/70"></i>
                </div>
                <p class="text-xs font-semibold text-gray-200">${this.esc(o.labels.emptyTitle)}</p>
                <p class="text-[10px] text-gray-500 mt-1">${this.esc(o.labels.emptyHint)}</p>
            </div>`;
    }

    renderProductRow(p, i) {
        const cls         = this.cls;
        const cant        = Number(p.cantidad || 0);
        const costoNum    = Number(p.costo || 0);
        const costoFmt    = costoNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const subtotal    = (cant * costoNum).toFixed(2);
        const subtotalFmt = Number(subtotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const nuevoStock  = Number(p.stock || 0) + cant;
        const stockColor  = p.stock === 0 ? 'text-red-400' : p.stock < 5 ? 'text-orange-400' : 'text-green-400';
        return `
            <tr class="border-b border-gray-800/40 last:border-b-0 hover:bg-purple-500/5 transition-colors" data-idx="${i}">
                <td class="px-3 py-2 align-middle">
                    <div class="flex items-center gap-2 min-w-0">
                        ${this.prodThumb(p, 'w-8 h-8', 'w-3.5 h-3.5')}
                        <div class="min-w-0">
                            <p class="text-[11px] font-semibold text-white truncate leading-tight">${this.esc(p.nombre)}</p>
                            <div class="flex items-center gap-1.5 mt-0.5">
                                <span class="text-[9px] text-gray-500 font-mono">${this.esc(p.sku)}</span>
                                <span class="text-gray-700">.</span>
                                <span class="text-[9px] text-gray-400">Stock <strong class="${stockColor}">${p.stock || 0}</strong> <span class="text-gray-600">&rarr;</span> <strong class="text-green-400" data-nuevo-stock>${nuevoStock}</strong></span>
                            </div>
                        </div>
                    </div>
                </td>
                <td class="px-2 py-2 align-middle w-24">
                    <input type="number" min="1" value="${cant}" class="${cls.qtyInp}" data-field="cantidad" data-idx="${i}">
                </td>
                <td class="px-2 py-2 align-middle w-28">
                    <div class="relative" title="Costo del producto (no editable)">
                        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none flex items-center">
                            <i data-lucide="dollar-sign" class="w-3 h-3"></i>
                        </span>
                        <div class="w-full pl-6 pr-6 py-1.5 text-[11px] text-right text-gray-300 bg-[#0f1825]/50 border border-gray-800/50 rounded select-none cursor-not-allowed">${costoFmt}</div>
                        <span class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none flex items-center">
                            <i data-lucide="lock" class="w-2.5 h-2.5"></i>
                        </span>
                    </div>
                </td>
                <td class="px-2 py-2 align-middle text-right w-24">
                    <span class="text-green-400 font-bold text-[12px]" data-subtotal>$${subtotalFmt}</span>
                </td>
                <td class="px-2 py-2 align-middle text-center w-10">
                    <button class="w-6 h-6 rounded-md inline-flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/15 transition-colors" data-remove="${i}" title="Eliminar">
                        <i data-lucide="x" class="w-3 h-3"></i>
                    </button>
                </td>
            </tr>`;
    }

    renderProductsTable() {
        // Agrupa el lote por categoria conservando el indice original en this.lote
        // (lo usan removeProducto / updateField / refreshRow via data-idx).
        const groups = {};
        this.lote.forEach((p, i) => {
            const cat = (p.categoria && String(p.categoria).trim()) || 'Sin categoria';
            (groups[cat] = groups[cat] || []).push({ p, i });
        });
        const catNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'es'));

        const body = catNames.map(c => {
            const rows = groups[c].map(({ p, i }) => this.renderProductRow(p, i)).join('');
            return this.renderLoteCatRow(c, groups[c].length) + rows;
        }).join('');

        return `
            <table class="w-full border-collapse">
                <thead class="sticky top-0 z-10 bg-[#0f1825] border-b border-gray-700/60">
                    <tr>
                        <th class="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                        <th class="text-center px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-24">Cant.</th>
                        <th class="text-left px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-28">Costo</th>
                        <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-24">Subtotal</th>
                        <th class="w-10 px-2 py-2"></th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>`;
    }

    // Fila separadora de categoria dentro de la tabla del lote.
    renderLoteCatRow(cat, count) {
        return `
            <tr class="ef-lote-cat">
                <td colspan="5" class="px-3 pt-2.5 pb-1 bg-[#0f172a]/50">
                    <div class="flex items-center justify-between">
                        <span class="text-[9px] font-bold uppercase tracking-wider text-purple-300/80 truncate">${this.esc(cat)}</span>
                        <span class="text-[9px] text-gray-600 flex-shrink-0 ml-2">${count}</span>
                    </div>
                </td>
            </tr>`;
    }

    renderSearchResult(p, i) {
        const stockColor = p.stock === 0 ? 'text-red-400' : p.stock < 5 ? 'text-orange-400' : 'text-green-400';
        const stockBg    = p.stock === 0 ? 'bg-red-500/10' : p.stock < 5 ? 'bg-orange-500/10' : 'bg-green-500/10';
        return `
            <div class="ef-cat-item rounded-md flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-transparent border-b border-gray-800/40 last:border-b-0 transition-all group" data-add-id="${this.esc(p.id)}" data-cat-idx="${i}">
                ${this.prodThumb(p, 'w-8 h-8', 'w-3.5 h-3.5')}
                <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-semibold text-white truncate">${this.esc(p.nombre)}</p>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        <span class="text-[8px] px-1.5 py-0.5 rounded ${stockBg} ${stockColor} font-bold">Stock ${p.stock || 0}</span>
                        <span class="text-[8px] text-gray-500 font-mono">${this.esc(p.sku)}</span>
                    </div>
                </div>
                <div class="w-6 h-6 rounded-lg bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-500 transition-all">
                    <i data-lucide="plus" class="w-3 h-3"></i>
                </div>
            </div>`;
    }

    ensureStyles() {
        if (document.getElementById('entradaFormStyles')) return;
        const css = `
            input.no-spin::-webkit-inner-spin-button,
            input.no-spin::-webkit-outer-spin-button { -webkit-appearance: none !important; appearance: none !important; margin: 0 !important; }
            input.no-spin { -moz-appearance: textfield !important; appearance: textfield !important; }
            .ef-scroll { scrollbar-width: thin; scrollbar-color: #374151 transparent; }
            .ef-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
            .ef-scroll::-webkit-scrollbar-track { background: transparent; }
            .ef-scroll::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
            .ef-scroll::-webkit-scrollbar-thumb:hover { background: #4B5563; }
            .ef-cat-item.ef-active { background: linear-gradient(90deg, rgba(147,51,234,0.20), rgba(147,51,234,0.02)); box-shadow: inset 0 0 0 1px rgba(168,85,247,0.5); }
            @keyframes efFlash { 0% { background-color: rgba(16,185,129,0.30); } 100% { background-color: transparent; } }
            tr.ef-flash { animation: efFlash 0.6s ease-out; }
            .ef-kbd { display: inline-flex; align-items: center; padding: 0 4px; height: 14px; border-radius: 3px; border: 1px solid rgba(75,85,99,0.6); background: rgba(31,41,55,0.6); font-size: 8px; line-height: 1; color: #9CA3AF; font-family: monospace; }`;
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
            <div class="absolute inset-0 bg-black/60" data-modal-close></div>
            <div class="relative z-10 w-full max-w-[960px] h-[90vh] mx-3 bg-[#111928] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col">
                ${this.renderHeader()}
                <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
                    ${this.renderConfigRow()}
                    <div class="flex flex-1 min-h-0">
                        <div class="w-[360px] border-r border-gray-800/70 flex flex-col flex-shrink-0 p-2.5 gap-2 overflow-hidden">
                            ${this.renderSearchPanel()}
                        </div>
                        <div class="flex-1 flex flex-col min-w-0 min-h-0">
                            ${this.renderLoteHeader()}
                            <div id="${o.id}_listaProductos" class="flex-1 overflow-y-auto cs-scroll px-3 py-3"></div>
                            ${this.renderResumen()}
                        </div>
                    </div>
                </div>
                ${this.renderFooter()}
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
        $(`#${o.id}_qtyItems`).text(totalItems);
        $(`#${o.id}_qtyUnits`).text(totalUds);
        $(`#${o.id}_qtyCost`).text(this.fmtMoney(totalCosto));
        $(`#${o.id}_cntProductos`).text(totalItems);
    }

    renderCatalogo() {
        const o    = this.opts;
        const $cat = $(`#${o.id}_catalogoLista`);
        const term = (this.searchTerm || '').toLowerCase();
        const items = (o.json || [])
            .filter(p => !this.lote.some(x => String(x.id) === String(p.id)))
            .filter(p => !term || (p.nombre || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term));

        // Agrupa por categoria, ordenando alfabeticamente los grupos.
        const groups = {};
        items.forEach(p => {
            const cat = (p.categoria && String(p.categoria).trim()) || 'Sin categoria';
            (groups[cat] = groups[cat] || []).push(p);
        });
        const catNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'es'));

        // Si hay termino de busqueda se expanden todas las categorias para no
        // ocultar coincidencias detras de una seccion plegada.
        const searching = !!term;

        // Reconstruye la lista plana SOLO con los items visibles (categorias
        // expandidas) para que la navegacion por teclado (activeIdx) siga
        // alineada con lo que realmente se pinta en el DOM.
        const ordered = [];
        catNames.forEach(c => {
            if (searching || !this.collapsedCats.has(c)) groups[c].forEach(p => ordered.push(p));
        });
        this.catalogItems = ordered;
        if (this.activeIdx >= ordered.length) this.activeIdx = Math.max(0, ordered.length - 1);

        if (!catNames.length) {
            $cat.html(`
                <div class="flex flex-col items-center justify-center py-8 text-center px-2">
                    <div class="w-10 h-10 rounded-lg bg-gray-800/40 border border-gray-700/50 flex items-center justify-center mb-2">
                        <i data-lucide="search-x" class="w-5 h-5 text-gray-600"></i>
                    </div>
                    <p class="text-[10px] text-gray-500">${term ? this.esc(o.labels.searchHint) : 'Sin productos disponibles'}</p>
                </div>`);
        } else {
            let gi = 0; // indice global continuo a traves de las categorias visibles
            const html = catNames.map(c => {
                const collapsed = !searching && this.collapsedCats.has(c);
                const rows = collapsed ? '' : groups[c].map(p => this.renderSearchResult(p, gi++)).join('');
                return this.renderCatHeader(c, groups[c].length, collapsed) + rows;
            }).join('');
            $cat.html(html);
        }
        if (window.lucide) lucide.createIcons();
        this.highlightActive();
    }

    // Encabezado colapsable de seccion de categoria dentro del catalogo de busqueda.
    renderCatHeader(cat, count, collapsed) {
        return `
            <div class="ef-cat-head flex items-center gap-1.5 px-2 py-1 bg-[#0f172a]/60 border-b border-gray-800/60 cursor-pointer select-none hover:bg-[#0f172a] transition-colors" data-cat-toggle="${this.esc(cat)}">
                <i data-lucide="chevron-down" class="w-2.5 h-2.5 text-purple-300/70 transition-transform ${collapsed ? '-rotate-90' : ''}"></i>
                <span class="text-[8px] font-bold uppercase tracking-wider text-purple-300/80 truncate flex-1">${this.esc(cat)}</span>
                <span class="text-[8px] text-gray-600 flex-shrink-0 ml-2">${count}</span>
            </div>`;
    }

    toggleCat(cat) {
        if (this.collapsedCats.has(cat)) this.collapsedCats.delete(cat);
        else                             this.collapsedCats.add(cat);
        this.renderCatalogo();
    }

    renderLote() {
        const o = this.opts;
        const $lista   = $(`#${o.id}_listaProductos`);
        const $limpiar = $(`#${o.id}_btnLimpiarLote`);
        if (!this.lote.length) {
            $lista.html(this.renderEmptyState()).removeClass('p-0').addClass('px-3 py-3');
            $limpiar.addClass('hidden');
        } else {
            $lista.html(this.renderProductsTable()).removeClass('px-3 py-3').addClass('p-0');
            $limpiar.removeClass('hidden');
        }
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
        if (!prod) return;
        this.promptCantidad(prod);
    }

    // Popover de cantidad anclado al buscador (sin backdrop): enfoca el input
    // preseleccionado, Enter agrega y devuelve el foco al buscador para encadenar.
    promptCantidad(prod) {
        if (!prod) return;
        const o       = this.opts;
        const popId   = `${o.id}_qtyPop`;
        const $anchor = $(`#${o.id}_buscarProducto`).closest('.relative');
        if (!$anchor.length) return;
        $(`#${popId}`).remove();

        const stockColor = prod.stock === 0 ? 'text-red-400' : prod.stock < 5 ? 'text-orange-400' : 'text-green-400';
        const html = `
            <div id="${popId}" class="absolute top-full left-0 mt-2 z-[60] w-[260px] bg-[#0f172a] rounded-xl shadow-2xl shadow-black/60">
                <div class="absolute -top-1.5 left-7 w-3 h-3 bg-[#141d2b] rotate-45"></div>
                <div class="relative flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-700/60 bg-[#141d2b] rounded-t-xl">
                    ${this.prodThumb(prod, 'w-8 h-8', 'w-3.5 h-3.5')}
                    <div class="min-w-0">
                        <p class="text-[11px] font-semibold text-white truncate">${this.esc(prod.nombre)}</p>
                        <div class="flex items-center gap-1.5">
                            <span class="text-[9px] text-gray-500 font-mono">${this.esc(prod.sku)}</span>
                            <span class="text-gray-700">.</span>
                            <span class="text-[9px] text-gray-400">Stock <strong class="${stockColor}">${prod.stock || 0}</strong></span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2 px-3 py-2.5">
                    <button id="${popId}_minus" type="button" class="w-8 h-8 flex-shrink-0 rounded-lg bg-[#0f1825] border border-gray-700/60 flex items-center justify-center text-gray-300 hover:bg-purple-500/10 hover:text-white hover:border-purple-500/40 transition-all">
                        <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                    </button>
                    <input id="${popId}_qty" type="number" min="1" value="1" inputmode="numeric"
                        class="no-spin flex-1 min-w-0 bg-[#0f1825] border border-gray-700/60 rounded-lg px-2 py-1.5 text-center text-base font-bold text-white outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all">
                    <button id="${popId}_plus" type="button" class="w-8 h-8 flex-shrink-0 rounded-lg bg-[#0f1825] border border-gray-700/60 flex items-center justify-center text-gray-300 hover:bg-purple-500/10 hover:text-white hover:border-purple-500/40 transition-all">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    </button>
                    <button id="${popId}_ok" type="button" class="h-8 px-3 flex-shrink-0 rounded-lg text-[11px] font-semibold text-white bg-purple-600 hover:bg-purple-500 flex items-center gap-1 transition-all">
                        <i data-lucide="corner-down-left" class="w-3 h-3"></i>${this.esc(o.labels.agregar || 'Agregar')}
                    </button>
                </div>
            </div>`;

        $anchor.append(html);
        if (window.lucide) lucide.createIcons();
        const $pop = $(`#${popId}`);
        const $qty = $(`#${popId}_qty`);
        $qty.trigger('focus').trigger('select');

        const close = () => { $(document).off('mousedown.qtyPop'); $pop.remove(); };
        const backToSearch = () => {
            close();
            this.resetSearchState();
            this.renderCatalogo();
            $(`#${o.id}_buscarProducto`).trigger('focus');
        };
        const confirmar = () => {
            const qty = Math.max(1, parseInt($qty.val(), 10) || 1);
            close();
            this.resetSearchState();
            this.addOrIncrement(prod, qty);
            $(`#${o.id}_buscarProducto`).trigger('focus');
        };
        const step = (d) => $qty.val(Math.max(1, (parseInt($qty.val(), 10) || 1) + d)).trigger('select');

        $(`#${popId}_minus`).on('click', () => step(-1));
        $(`#${popId}_plus`).on('click',  () => step(1));
        $(`#${popId}_ok`).on('click', confirmar);
        $qty.on('keydown', (e) => {
            if (e.key === 'Enter')  { e.preventDefault(); confirmar(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); backToSearch(); } // no propagar: el Escape global cierra el modal entero
        });
        // Click fuera del popover (y fuera del buscador) lo cierra sin agregar.
        setTimeout(() => $(document).on('mousedown.qtyPop', (ev) => {
            if (!$(ev.target).closest(`#${popId}, #${o.id}_buscarProducto`).length) backToSearch();
        }), 0);
    }

    // Suma al lote: si el producto ya existe acumula la cantidad (modo escaner),
    // si no, lo agrega como nueva fila. Devuelve el indice de la fila afectada.
    addOrIncrement(prod, qty) {
        qty = Math.max(1, Number(qty) || 1);
        const existing = this.lote.find(x => String(x.id) === String(prod.id));
        let idx;
        if (existing) {
            existing.cantidad = Number(existing.cantidad || 0) + qty;
            idx = this.lote.indexOf(existing);
        } else {
            this.lote.push(Object.assign({}, prod, { cantidad: qty }));
            idx = this.lote.length - 1;
        }
        this.renderLote();
        this.flashRow(idx);
        return idx;
    }

    // Enter en el buscador: prioriza SKU exacto (lector de codigo), luego el
    // resultado resaltado, luego la primera coincidencia. Conserva el foco.
    handleSearchEnter() {
        const all = this.opts.json || [];
        const q   = (this.searchTerm || '').toLowerCase();
        // SKU exacto = lector de codigo: agrega 1 directo y sigue, sin pedir cantidad.
        if (q) {
            const exact = all.find(p => String(p.sku || '').toLowerCase() === q);
            if (exact) {
                this.resetSearchState();
                this.addOrIncrement(exact, 1);
                $(`#${this.opts.id}_buscarProducto`).trigger('focus');
                return;
            }
        }
        // Item resaltado (navegacion con flechas, con o sin texto): pide la cantidad.
        let prod = this.catalogItems.length ? (this.catalogItems[this.activeIdx] || this.catalogItems[0]) : null;
        if (!prod && q) {
            prod = all.find(p => (p.nombre || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
        }
        if (!prod) return;
        this.promptCantidad(prod);
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

    onQtyKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            $(`#${this.opts.id}_buscarProducto`).trigger('focus'); // vuelve al buscador para encadenar
        }
    }

    removeProducto(i) {
        this.lote.splice(i, 1);
        this.renderLote();
    }

    updateField($el) {
        const idx   = Number($el.data('idx'));
        const field = $el.data('field');
        if (isNaN(idx) || !this.lote[idx] || !field) return;
        this.lote[idx][field] = $el.val();
        if (field === 'cantidad' || field === 'costo') {
            this.refreshRow(idx);
            this.updateTotals();
        }
    }

    refreshRow(i) {
        const o = this.opts;
        const p = this.lote[i];
        if (!p) return;
        const cant        = Number(p.cantidad || 0);
        const costoNum    = Number(p.costo || 0);
        const subtotalFmt = (cant * costoNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const nuevoStock  = Number(p.stock || 0) + cant;
        const $row = $(`#${o.id}_listaProductos tr[data-idx="${i}"]`);
        $row.find('[data-subtotal]').text('$' + subtotalFmt);
        $row.find('[data-nuevo-stock]').text(nuevoStock);
    }

    clearLote() {
        if (!this.lote.length) return;
        if (confirm('Eliminar todos los productos del lote?')) {
            this.lote = [];
            this.renderLote();
        }
    }

    closeModal() {
        this.wrap.addClass('hidden');
        this.lote = [];
        this.renderLote();
        if (this.editMode) this.applyEditUI(false);
        this.editMode  = false;
        this.editId    = null;
        this.editFolio = null;
        this.opts.onClose();
    }

    doRegistrar() {
        if (!this.lote.length) { alert('Agrega al menos un producto al lote'); return; }
        const o = this.opts;

        // Modo edicion: el almacen/sucursal/origen no cambian (los fija el header de
        // la entrada en el backend). Solo viajan los renglones, con su detail_id para
        // distinguir altas (sin id) de cambios (con id); las bajas las infiere el
        // backend al faltar un detail_id que antes existia.
        if (this.editMode) {
            const payload = {
                note:      $(`#${o.id}_inpNota`).val(),
                productos: this.lote.map(p => ({
                    detail_id:  p.detailId || null,
                    product_id: p.id,
                    quantity:   Number(p.cantidad || 0),
                    cost:       Number(p.costo || 0)
                }))
            };
            o.onUpdate({ id: this.editId, folio: this.editFolio, payload: payload });
            this.closeModal();
            return;
        }

        const warehouseId = $(`#${o.id}_selAlmacen`).val();
        if (!warehouseId) { alert('Selecciona un almacen'); return; }
        const payload = {
            origen:      $(`#${o.id}_selOrigen`).val(),
            sucursal:    $(`#${o.id}_selSucursal option:selected`).text(),
            sucursalId:  $(`#${o.id}_selSucursal`).val(),
            almacen:     $(`#${o.id}_selAlmacen option:selected`).text(),
            warehouseId: warehouseId,
            fecha:       $(`#${o.id}_inpFecha`).val(),
            nota:        $(`#${o.id}_inpNota`).val(),
            productos:  this.lote.map(p => ({
                id:     p.id,
                nombre: p.nombre, sku: p.sku, icon: p.icon, bg: p.bg, color: p.color,
                cant:   Number(p.cantidad || 0),
                costo:  Number(p.costo || 0),
                stockPrev: Number(p.stock || 0)
            })),
            totalUds:   this.lote.reduce((s, p) => s + Number(p.cantidad || 0), 0),
            totalCosto: this.lote.reduce((s, p) => s + Number(p.cantidad || 0) * Number(p.costo || 0), 0)
        };
        o.onAdd(payload);
        this.closeModal();
    }

    // -- Formatos --

    loadFormatos() {
        // Guarda contra localStorage corrupto: loadFormatos corre en el constructor,
        // un JSON invalido sin captura romperia la apertura del modal entero.
        try {
            const parsed = JSON.parse(localStorage.getItem(this.FORMATOS_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    persistFormatos(arr) {
        localStorage.setItem(this.FORMATOS_KEY, JSON.stringify(arr));
    }

    saveFormato() {
        if (!this.lote.length) { alert(this.opts.labels.emptyLote); return; }

        const o       = this.opts;
        const modalId = `${o.id}_saveFormatoModal`;

        const scopes = [
            { value: 'user',       label: 'Solo yo',         icon: 'user',       iconClass: 'text-gray-400'   },
            { value: 'subsidiary', label: 'Mi sucursal',     icon: 'store',      iconClass: 'text-blue-400'   },
            { value: 'company',    label: 'Toda la empresa', icon: 'building-2', iconClass: 'text-purple-400' }
        ];
        const scopeRadios = scopes.map((s, i) => `
            <label class="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer border transition-all
                          ${i === 0 ? 'border-purple-500/50 bg-purple-500/10' : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600/60 hover:bg-gray-800/50'}
                          scope-radio-label" data-value="${s.value}">
                <input type="radio" name="${modalId}_scope" value="${s.value}" class="sr-only"
                       ${i === 0 ? 'checked' : ''}>
                <i data-lucide="${s.icon}" class="w-3.5 h-3.5 flex-shrink-0 ${s.iconClass}"></i>
                <span class="text-[11px] font-medium text-gray-200">${this.esc(s.label)}</span>
            </label>`).join('');

        const html = `
            <div id="${modalId}" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" data-sf-backdrop></div>
                <div class="relative w-full max-w-xs bg-[#0f172a] border border-gray-700/60 rounded-xl shadow-2xl shadow-black/70 overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700/60 bg-[#141d2b]">
                        <p class="text-xs font-bold text-white flex items-center gap-1.5">
                            <i data-lucide="bookmark-plus" class="w-3.5 h-3.5 text-purple-400"></i>
                            ${this.esc(o.labels.modalTit)}
                        </p>
                        <button id="${modalId}_close" class="text-gray-500 hover:text-white transition-colors">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <div class="px-4 pt-4 pb-3 flex flex-col gap-3">
                        <div class="flex flex-col gap-1">
                            <label class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                ${this.esc(o.labels.nombreLbl)}
                            </label>
                            <input id="${modalId}_name" type="text" maxlength="80" autocomplete="off"
                                class="w-full bg-gray-800/60 border border-gray-700/60 rounded-lg px-3 py-2
                                       text-xs text-white placeholder-gray-500 outline-none
                                       focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all"
                                placeholder="${this.esc(o.labels.nombreLbl)}...">
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                ${this.esc(o.labels.scopeLbl)}
                            </label>
                            <div class="flex flex-col gap-1.5">
                                ${scopeRadios}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-700/60 bg-[#141d2b]">
                        <button id="${modalId}_cancel"
                            class="px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-400
                                   border border-gray-700/50 hover:border-gray-600 hover:text-white transition-all">
                            ${this.esc(o.labels.cancelar)}
                        </button>
                        <button id="${modalId}_confirm"
                            class="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white
                                   bg-purple-600 hover:bg-purple-500 border border-purple-500/40
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
            $(`#${modalId} .scope-radio-label`).removeClass('border-purple-500/50 bg-purple-500/10')
                .addClass('border-gray-700/50 bg-gray-800/30');
            $(this).closest('.scope-radio-label').removeClass('border-gray-700/50 bg-gray-800/30')
                .addClass('border-purple-500/50 bg-purple-500/10');
        });

        $(`#${modalId}_confirm`).on('click', () => {
            const name = $(`#${modalId}_name`).val().trim();
            if (!name) { $(`#${modalId}_name`).focus(); return; }
            const scope    = $(`input[name="${modalId}_scope"]:checked`).val() || 'user';
            const formatos = this.loadFormatos();
            formatos.unshift({
                id:        Date.now(),
                name:      name,
                scope:     scope,
                productos: this.lote.map(p => Object.assign({}, p)),
                createdAt: new Date().toISOString()
            });
            this.persistFormatos(formatos);
            this.renderFormatosBadge();
            this.renderFormatosLista();
            closeSaveModal();
        });

        $(`#${modalId}_name`).on('keydown', (e) => {
            if (e.key === 'Enter')  $(`#${modalId}_confirm`).trigger('click');
            if (e.key === 'Escape') closeSaveModal();
        });
    }

    applyFormato(id) {
        const f = this.loadFormatos().find(x => x.id === id);
        if (!f) return;
        this.lote = f.productos.map(p => Object.assign({}, p));
        $(`#${this.opts.id}_formatosDropdown`).addClass('hidden');
        this.renderLote();
    }

    deleteFormato(id) {
        if (!confirm(this.opts.labels.confirmDel)) return;
        const formatos = this.loadFormatos().filter(x => x.id !== id);
        this.persistFormatos(formatos);
        this.renderFormatosBadge();
        this.renderFormatosLista();
    }

    renderFormatosBadge() {
        const count = this.loadFormatos().length;
        const $b = $(`#${this.opts.id}_cntFormatos`);
        if (count > 0) $b.text(count).removeClass('hidden');
        else           $b.addClass('hidden');
    }

    renderFormatosLista() {
        const o        = this.opts;
        const $lista   = $(`#${o.id}_formatosLista`);
        const formatos = this.loadFormatos();
        if (!formatos.length) {
            $lista.html(`
                <div class="flex flex-col items-center justify-center py-6 px-3 text-center">
                    <div class="w-10 h-10 rounded-lg bg-gray-800/40 border border-gray-700/50 flex items-center justify-center mb-2">
                        <i data-lucide="inbox" class="w-5 h-5 text-gray-600"></i>
                    </div>
                    <p class="text-[10px] text-gray-500">${this.esc(o.labels.sinFormatos)}</p>
                </div>`);
        } else {
            const scopeMap = {
                user:       { icon: 'user',       cls: 'text-gray-400'   },
                subsidiary: { icon: 'store',      cls: 'text-blue-400'   },
                company:    { icon: 'building-2', cls: 'text-purple-400' }
            };
            $lista.html(formatos.map(f => {
                const uds = (f.productos || []).reduce((s, p) => s + Number(p.cantidad || 0), 0);
                const tot = (f.productos || []).reduce((s, p) => s + Number(p.cantidad || 0) * Number(p.costo || 0), 0);
                const sc  = scopeMap[f.scope || 'user'] || scopeMap.user;
                return `
                    <div class="group flex items-center gap-2 px-3 py-2 border-b border-gray-800/40 last:border-b-0 hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-transparent transition-all cursor-pointer" data-apply-id="${f.id}">
                        <div class="w-7 h-7 rounded-md bg-purple-500/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="bookmark" class="w-3.5 h-3.5 text-purple-300"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5">
                                <p class="text-[11px] font-semibold text-white truncate">${this.esc(f.name)}</p>
                                <i data-lucide="${sc.icon}" class="w-3 h-3 flex-shrink-0 ${sc.cls}"></i>
                            </div>
                            <p class="text-[9px] text-gray-500">${f.productos.length} prod. . ${uds} uds . ${this.fmtMoneyShort(tot)}</p>
                        </div>
                        <button class="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/15 flex-shrink-0 transition-colors" data-delete-id="${f.id}" title="${this.esc(o.labels.confirmDel)}">
                            <i data-lucide="trash-2" class="w-3 h-3"></i>
                        </button>
                    </div>`;
            }).join(''));
        }
        if (window.lucide) lucide.createIcons();
    }

    refreshAlmacenes(subsidiariesId) {
        const o     = this.opts;
        const $sel  = $(`#${o.id}_selAlmacen`);
        const items = (o.data.almacenes || []).filter(a =>
            !subsidiariesId || String(a.subsidiaries_id) === String(subsidiariesId)
        );
        $sel.html(items.map(it => this.optionTag(it)).join(''));
    }

    toggleFormatosDropdown() {
        const $dd = $(`#${this.opts.id}_formatosDropdown`);
        if ($dd.hasClass('hidden')) {
            this.renderFormatosLista();
            $dd.removeClass('hidden');
        } else {
            $dd.addClass('hidden');
        }
    }

    // -- Eventos --

    bindEvents() {
        const wrap = this.wrap;
        const id   = this.opts.id;

        wrap.on('click', '[data-modal-close]',        () => this.closeModal());
        wrap.on('change', `#${id}_selSucursal`,       (e) => this.refreshAlmacenes(e.target.value));
        wrap.on('input', `#${id}_buscarProducto`,     (e) => this.doSearch(e.target.value));
        wrap.on('keydown', `#${id}_buscarProducto`,   (e) => this.onSearchKeydown(e));
        wrap.on('keydown', 'input[data-field="cantidad"]', (e) => this.onQtyKeydown(e));
        wrap.on('click', '[data-cat-toggle]',         (e) => this.toggleCat($(e.currentTarget).attr('data-cat-toggle')));
        wrap.on('click', '[data-add-id]',             (e) => this.addProducto($(e.currentTarget).attr('data-add-id')));
        wrap.on('click', '[data-remove]',             (e) => this.removeProducto(Number($(e.currentTarget).attr('data-remove'))));
        wrap.on('input', 'input[data-field]',         (e) => this.updateField($(e.currentTarget)));
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

        $(document).off('keydown.entradaForm').on('keydown.entradaForm', (e) => {
            if (e.key === 'Escape' && !this.wrap.hasClass('hidden')) this.closeModal();
        });
    }

    // -- API publica --

    open() {
        this.wrap.removeClass('hidden');
        if (window.lucide) lucide.createIcons();
        setTimeout(() => $(`#${this.opts.id}_buscarProducto`).trigger('focus'), 50);
    }

    close() {
        this.closeModal();
    }

    setData(newData) {
        Object.assign(this.opts.data, newData || {});
        const id = this.opts.id;
        if (newData && 'fecha' in newData)           $(`#${id}_inpFecha`).val(newData.fecha);
        if (newData && 'subsidiaries_id' in newData) {
            $(`#${id}_selSucursal`).val(newData.subsidiaries_id);
            this.refreshAlmacenes(newData.subsidiaries_id);
        }
        if (newData && 'nota' in newData)            $(`#${id}_inpNota`).val(newData.nota);
    }

    // Abre el modal para EDITAR una entrada existente: precarga sus renglones en el
    // lote (conservando detail_id para el backend) y bloquea origen/sucursal/almacen
    // (no se cambian en edicion). La entrada llega con el shape de mapEntradaDetail.
    openEdit(entrada) {
        if (!entrada || !entrada.id) return;
        this.editMode  = true;
        this.editId    = entrada.id;
        this.editFolio = entrada.folio || '';

        const catalogo = this.opts.json || [];
        const byId = {};
        catalogo.forEach(c => { byId[String(c.id)] = c; });

        // Cada renglon parte de la cantidad realmente aplicada (cantReal); enriquece
        // categoria/icono/stock desde el catalogo para que la tabla agrupe y pinte igual.
        this.lote = (entrada.productos || []).map(p => {
            const cat = byId[String(p.id)] || {};
            return {
                id:        p.id,
                detailId:  p.detailId,
                nombre:    p.nombre,
                sku:       p.sku,
                costo:     Number(p.costo || 0),
                cantidad:  Number(p.cantReal != null ? p.cantReal : (p.cant || 0)),
                stock:     Number(cat.stock || 0),
                categoria: cat.categoria || p.categoria || 'Sin categoria',
                icon:      cat.icon  || p.icon  || 'package',
                bg:        cat.bg    || p.bg    || 'bg-gray-700/40',
                color:     cat.color || p.color || 'text-gray-300',
                image:     cat.image || p.image || ''
            };
        });

        const id = this.opts.id;
        // Refleja el contexto real de la entrada en los selects (quedan bloqueados:
        // el backend usa el almacen del header, no estos campos).
        if (entrada.origenId != null)       $(`#${id}_selOrigen`).val(String(entrada.origenId));
        if (entrada.subsidiariesId != null) {
            $(`#${id}_selSucursal`).val(String(entrada.subsidiariesId));
            this.refreshAlmacenes(entrada.subsidiariesId);
        }
        if (entrada.warehouseId != null)    $(`#${id}_selAlmacen`).val(String(entrada.warehouseId));

        this.applyEditUI(true, entrada);
        this.renderLote();

        $(`#${id}_inpNota`).val(entrada.nota || '');

        this.wrap.removeClass('hidden');
        if (window.lucide) lucide.createIcons();
        setTimeout(() => $(`#${id}_buscarProducto`).trigger('focus'), 50);
    }

    // Alterna la UI entre alta (false) y edicion (true): textos del header/boton y
    // bloqueo de los selects de contexto (origen/sucursal/almacen/fecha).
    applyEditUI(on, entrada) {
        const o  = this.opts;
        const id = o.id;
        const ctxSelectors = [`#${id}_selOrigen`, `#${id}_selSucursal`, `#${id}_selAlmacen`, `#${id}_inpFecha`];

        if (on) {
            const folio = (entrada && entrada.folio) ? entrada.folio : '';
            $(`#${id}_title`).text(`Editar entrada ${folio}`.trim());
            $(`#${id}_subtitle`).text('Agrega o quita productos de la entrada');
            $(`#${id}_btnRegistrarLbl`).text('Guardar cambios');
            ctxSelectors.forEach(sel => $(sel).prop('disabled', true).addClass('opacity-50 cursor-not-allowed'));
        } else {
            $(`#${id}_title`).text(o.labels.title);
            $(`#${id}_subtitle`).text(o.labels.subtitle);
            $(`#${id}_btnRegistrarLbl`).text(o.labels.registrar);
            ctxSelectors.forEach(sel => $(sel).prop('disabled', false).removeClass('opacity-50 cursor-not-allowed'));
        }
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
            <div class="relative ${box} rounded-lg ${this.esc(p.bg)} flex items-center justify-center flex-shrink-0 ring-1 ring-white/5 overflow-hidden">
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

    optionTag(item, sel) {
        return `<option value="${this.esc(item.id || item.valor)}"${sel === (item.id || item.valor) ? ' selected' : ''}>${this.esc(item.valor)}</option>`;
    }

    selectWrap(selectHtml) {
        return `
            <div class="relative">
                ${selectHtml}
                <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-purple-300/80 flex items-center">
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                </span>
            </div>`;
    }
}

Templates.prototype.entradaForm = function (options) {
    return new EntradaForm(options);
};
