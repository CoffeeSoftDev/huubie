class SalidaForm {

    constructor(options) {

        this.cls = {
            label:   'block text-[9px] font-semibold uppercase tracking-wider text-gray-500 mb-1',
            input:   'w-full px-2.5 py-1.5 text-[11px] text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400',
            select:  'w-full px-2.5 py-1.5 text-[11px] text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 hover:border-gray-400 transition-all cursor-pointer appearance-none pr-8',
            search:  'w-full pl-8 pr-2.5 py-1.5 text-[11px] text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400',
            qtyInp:  'no-spin w-full px-3 py-1.5 text-[11px] font-bold text-center text-gray-800 bg-white border border-gray-300 rounded outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 transition-all',
            btnOut:  'px-3 py-1.5 text-[11px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-800 hover:border-gray-400 transition-all',
            btnOk:   'px-3 py-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-rose-500 to-rose-600 rounded-md hover:from-rose-400 hover:to-rose-500 hover:shadow-lg hover:shadow-rose-500/20 transition-all flex items-center gap-1.5',
            badge:   'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold leading-none'
        };

        const defaults = {
            parent: 'body',
            id:     'salidaFormModal',
            class:  'hidden fixed inset-0 z-[100] flex items-center justify-center',
            json:   [],
            data: {
                motivos:         [],
                sucursales:      [],
                almacenes:       [],
                motivo:          '',
                subsidiaries_id: '',
                warehouse_id:    '',
                fecha:           '',
                nota:            ''
            },
            labels: {
                title:        'Registrar Salida',
                subtitle:     'Reporta productos dañados, vencidos o perdidos',
                motivo:       'Motivo',
                sucursal:     'Sucursal',
                almacen:      'Almacen',
                fecha:        'Fecha',
                nota:         'Observaciones (opcional)',
                buscar:       'Buscar productos',
                placeholder:  'Nombre o SKU...',
                searchHint:   'Sin resultados',
                fotoLbl:      'Adjuntar evidencia fotografica',
                fotoBtn:      'Evidencia',
                fotoOk:       'Adjunta',
                resumenLbl:   'Resumen del folio',
                productosLbl: 'Productos',
                unidadesLbl:  'Unidades',
                perdidaLbl:   'Perdida total',
                emptyTitle:   'Aun no se han agregado productos',
                emptyHint:    'Usa el buscador para empezar',
                limpiar:      'Limpiar',
                cancelar:     'Cancelar',
                registrar:    'Registrar Salida',
                stockAuto:    'El stock se descontara automaticamente',
                agregar:      'Agregar'
            },
            onSubmit: () => {},
            onClose:  () => {},
            onSearch: null
        };

        const o = options || {};
        this.opts        = Object.assign({}, defaults, o);
        this.opts.data   = Object.assign({}, defaults.data,   o.data   || {});
        this.opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        this.lote         = [];
        this.photo        = null;
        this.searchTerm   = '';
        this.activeIdx    = 0;      // resultado resaltado para navegacion por teclado
        this.catalogItems = [];     // resultados visibles actuales del catalogo

        this.ensureStyles();
        this.mount();
        this.bindEvents();
        this.renderLote();
    }

    // -- Render estático --

    renderHeader() {
        const o = this.opts;
        return `
            <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-300 bg-gray-50 flex-shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20" style="background:linear-gradient(135deg,#FB7185,#FB923C);">
                        <i data-lucide="alert-triangle" class="w-5 h-5 text-white"></i>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-gray-800">${this.esc(o.labels.title)}</h3>
                        <p class="text-[11px] text-gray-500">${this.esc(o.labels.subtitle)}</p>
                    </div>
                </div>
                <button class="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-500" data-modal-close>
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
            <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50">
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
                <p class="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">${this.esc(o.labels.buscar)}</p>
                <div class="relative">
                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none flex items-center">
                        <i data-lucide="search" class="w-3.5 h-3.5"></i>
                    </span>
                    <input id="${o.id}_buscarProducto" type="text" placeholder="${this.esc(o.labels.placeholder)}" class="${cls.search}" autocomplete="off">
                </div>
                <p class="mt-1.5 text-[9px] text-gray-500 flex items-center flex-wrap gap-x-1.5 gap-y-1 leading-none">
                    <span class="mf-kbd">&uarr;&darr;</span><span>navegar</span>
                    <span class="mf-kbd">Enter</span><span>agregar</span>
                </p>
            </div>
            <div id="${o.id}_catalogoLista" class="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 -mr-1 cs-scroll mf-scroll bg-gray-50 border border-gray-200 rounded-lg p-1.5"></div>`;
    }

    renderResumen() {
        const o = this.opts;
        return `
            <div class="flex-shrink-0 border-t border-gray-200 px-4 py-2.5 bg-gray-50 flex items-center justify-between gap-4">
                <div class="flex items-center gap-4 text-[10px]">
                    <span class="text-gray-500"><strong class="text-gray-800 text-[13px]" id="${o.id}_qtyItems">0</strong> prod.</span>
                    <span class="text-gray-500"><strong class="text-gray-800 text-[13px]" id="${o.id}_qtyUnits">0</strong> uds</span>
                </div>
                <div class="flex items-baseline gap-2.5">
                    <span class="text-[9px] uppercase tracking-wider text-gray-500">${this.esc(o.labels.perdidaLbl)}</span>
                    <span class="text-rose-600 font-bold text-[16px] leading-none" id="${o.id}_qtyCost">-$0.00</span>
                </div>
            </div>`;
    }

    renderLoteHeader() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-gradient-to-b from-gray-50 to-transparent">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-md bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                        <i data-lucide="boxes" class="w-3.5 h-3.5 text-rose-600"></i>
                    </div>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-gray-700">${this.esc(o.labels.productosLbl)}</p>
                    <span id="${o.id}_cntProductos" class="${cls.badge} bg-gradient-to-br from-rose-500/25 to-rose-500/15 text-rose-600 border border-rose-500/40">0</span>
                </div>
                <button id="${o.id}_btnLimpiarLote" class="text-[10px] text-gray-500 hover:text-rose-600 transition flex items-center gap-1 hidden px-2 py-1 rounded-md hover:bg-rose-500/10">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>${this.esc(o.labels.limpiar)}
                </button>
            </div>`;
    }

    renderFooter() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-300 bg-gray-50 flex-shrink-0">
                <div class="flex items-center gap-1.5 flex-1 min-w-0">
                    <i data-lucide="sticky-note" class="w-3.5 h-3.5 text-gray-500 flex-shrink-0"></i>
                    <input id="${o.id}_inpNota" type="text" value="${this.esc(o.data.nota)}" placeholder="${this.esc(o.labels.nota)}..." class="${cls.input}">
                    <input type="file" id="${o.id}_photoInput" accept="image/*" capture="environment" class="hidden">
                    <button id="${o.id}_btnFoto" type="button" class="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:border-rose-500/50 hover:text-gray-900 transition-all flex-shrink-0" title="${this.esc(o.labels.fotoLbl)}">
                        <i data-lucide="camera" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.fotoBtn)}</span>
                    </button>
                    <div id="${o.id}_fotoChip" class="hidden items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 flex-shrink-0">
                        <img id="${o.id}_photoImg" alt="" class="w-5 h-5 rounded object-cover">
                        <span class="text-[10px] text-emerald-600 font-medium">${this.esc(o.labels.fotoOk)}</span>
                        <button id="${o.id}_photoRemove" type="button" class="text-emerald-600 hover:text-gray-900" title="Quitar evidencia">
                            <i data-lucide="x" class="w-3 h-3"></i>
                        </button>
                    </div>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                    <button class="${cls.btnOut}" data-modal-close>${this.esc(o.labels.cancelar)}</button>
                    <button id="${o.id}_btnRegistrar" class="${cls.btnOk}">
                        <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.registrar)}</span>
                    </button>
                </div>
            </div>`;
    }

    renderEmptyState() {
        const o = this.opts;
        return `
            <div class="flex flex-col items-center justify-center py-12 text-center">
                <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/10 to-rose-500/5 flex items-center justify-center mb-3">
                    <i data-lucide="package-x" class="w-8 h-8 text-rose-500"></i>
                </div>
                <p class="text-xs font-semibold text-gray-700">${this.esc(o.labels.emptyTitle)}</p>
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
        const nuevoStock  = Number(p.stock || 0) - cant;
        const stockColor  = p.stock === 0 ? 'text-rose-600' : p.stock < 5 ? 'text-orange-500' : 'text-gray-500';
        const nuevoColor  = nuevoStock < 0 ? 'text-rose-600' : nuevoStock < 5 ? 'text-orange-500' : 'text-gray-700';
        return `
            <tr class="border-b border-gray-100 last:border-b-0 hover:bg-rose-500/5 transition-colors" data-idx="${i}">
                <td class="px-3 py-2 align-middle">
                    <div class="flex items-center gap-2 min-w-0">
                        ${this.prodThumb(p, 'w-8 h-8', 'w-3.5 h-3.5')}
                        <div class="min-w-0">
                            <p class="text-[11px] font-semibold text-gray-800 truncate leading-tight">${this.esc(p.nombre)}</p>
                            <div class="flex items-center gap-1.5 mt-0.5">
                                <span class="text-[9px] text-gray-500 font-mono">${this.esc(p.sku)}</span>
                                <span class="text-gray-300">.</span>
                                <span class="text-[9px] text-gray-500">Stock <strong class="${stockColor}">${p.stock || 0}</strong> <span class="text-gray-400">&darr;</span> <strong class="${nuevoColor}" data-nuevo-stock>${nuevoStock}</strong></span>
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
                        <div class="w-full pl-6 pr-6 py-1.5 text-[11px] text-right text-gray-700 bg-gray-50 border border-gray-200 rounded select-none cursor-not-allowed">${costoFmt}</div>
                        <span class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                            <i data-lucide="lock" class="w-2.5 h-2.5"></i>
                        </span>
                    </div>
                </td>
                <td class="px-2 py-2 align-middle text-right w-24">
                    <span class="text-rose-600 font-bold text-[12px]" data-subtotal>-$${subtotalFmt}</span>
                </td>
                <td class="px-2 py-2 align-middle text-center w-10">
                    <button class="w-6 h-6 rounded-md inline-flex items-center justify-center text-gray-500 hover:text-rose-600 hover:bg-rose-500/15 transition-colors" data-remove="${i}" title="Eliminar">
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
                <thead class="sticky top-0 z-10 bg-white border-b border-gray-300">
                    <tr>
                        <th class="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                        <th class="text-center px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-24">Cant.</th>
                        <th class="text-left px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-28">Costo</th>
                        <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-24">Perdida</th>
                        <th class="w-10 px-2 py-2"></th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>`;
    }

    // Fila separadora de categoria dentro de la tabla del lote.
    renderLoteCatRow(cat, count) {
        return `
            <tr class="mf-lote-cat">
                <td colspan="5" class="px-3 pt-2.5 pb-1 bg-gray-50">
                    <div class="flex items-center justify-between">
                        <span class="text-[9px] font-bold uppercase tracking-wider text-purple-600 truncate">${this.esc(cat)}</span>
                        <span class="text-[9px] text-gray-400 flex-shrink-0 ml-2">${count}</span>
                    </div>
                </td>
            </tr>`;
    }

    renderSearchResult(p, i) {
        const stockColor = p.stock === 0 ? 'text-rose-600' : p.stock < 5 ? 'text-orange-500' : 'text-green-600';
        const stockBg    = p.stock === 0 ? 'bg-rose-500/10' : p.stock < 5 ? 'bg-orange-500/10' : 'bg-green-500/10';
        return `
            <div class="mf-cat-item rounded-md flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-transparent border-b border-gray-100 last:border-b-0 transition-all group" data-add-id="${this.esc(p.id)}" data-cat-idx="${i}">
                ${this.prodThumb(p, 'w-9 h-9', 'w-4 h-4')}
                <div class="flex-1 min-w-0">
                    <p class="text-[11px] font-semibold text-gray-800 truncate">${this.esc(p.nombre)}</p>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        <span class="text-[9px] px-1.5 py-0.5 rounded ${stockBg} ${stockColor} font-bold">Stock ${p.stock || 0}</span>
                        <span class="text-[9px] text-gray-500 font-mono">${this.esc(p.sku)}</span>
                    </div>
                </div>
                <span class="text-[10px] font-bold text-gray-700 flex-shrink-0">${this.fmtMoney(p.costo)}</span>
                <div class="w-7 h-7 rounded-lg bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-600 flex-shrink-0 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-500 transition-all">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                </div>
            </div>`;
    }

    ensureStyles() {
        if (document.getElementById('salidaFormStyles')) return;
        const css = `
            input.no-spin::-webkit-inner-spin-button,
            input.no-spin::-webkit-outer-spin-button { -webkit-appearance: none !important; appearance: none !important; margin: 0 !important; }
            input.no-spin { -moz-appearance: textfield !important; appearance: textfield !important; }
            .mf-scroll { scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent; }
            .mf-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
            .mf-scroll::-webkit-scrollbar-track { background: transparent; }
            .mf-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
            .mf-scroll::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
            .mf-cat-item.mf-active { background: rgba(147,51,234,0.08); box-shadow: inset 0 0 0 1px rgba(168,85,247,0.45); }
            @keyframes mfFlash { 0% { background-color: rgba(244,63,94,0.18); } 100% { background-color: transparent; } }
            tr.mf-flash { animation: mfFlash 0.6s ease-out; }
            .mf-kbd { display: inline-flex; align-items: center; padding: 0 4px; height: 14px; border-radius: 3px; border: 1px solid #D1D5DB; background: #F3F4F6; font-size: 8px; line-height: 1; color: #6B7280; font-family: monospace; }`;
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
            <div class="absolute inset-0 bg-black/60" data-modal-close></div>
            <div class="relative z-10 w-full max-w-[960px] h-[90vh] mx-3 bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">
                ${this.renderHeader()}
                <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
                    ${this.renderConfigRow()}
                    <div class="flex flex-1 min-h-0">
                        <div class="w-[300px] border-r border-gray-200 flex flex-col flex-shrink-0 p-2.5 gap-2 overflow-hidden">
                            ${this.renderSearchPanel()}
                        </div>
                        <div class="flex-1 flex flex-col min-w-0 min-h-0">
                            ${this.renderLoteHeader()}
                            <div id="${o.id}_listaProductos" class="flex-1 overflow-y-auto cs-scroll mf-scroll px-3 py-3"></div>
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
        $(`#${o.id}_qtyCost`).text('-' + this.fmtMoney(totalCosto));
        $(`#${o.id}_cntProductos`).text(totalItems);
    }

    renderCatalogo() {
        const o    = this.opts;
        const $cat = $(`#${o.id}_catalogoLista`);
        const term = (this.searchTerm || '').toLowerCase();
        const items = (o.json || [])
            .filter(p => !this.lote.some(x => x.id === p.id))
            .filter(p => !term || (p.nombre || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term));

        // Agrupa por categoria, ordenando alfabeticamente los grupos.
        const groups = {};
        items.forEach(p => {
            const cat = (p.categoria && String(p.categoria).trim()) || 'Sin categoria';
            (groups[cat] = groups[cat] || []).push(p);
        });
        const catNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'es'));

        // Reconstruye la lista plana en el mismo orden visual (categoria + items)
        // para que la navegacion por teclado (activeIdx) siga alineada con el DOM.
        const ordered = [];
        catNames.forEach(c => groups[c].forEach(p => ordered.push(p)));
        this.catalogItems = ordered;
        if (this.activeIdx >= ordered.length) this.activeIdx = Math.max(0, ordered.length - 1);

        if (!ordered.length) {
            $cat.html(`
                <div class="flex flex-col items-center justify-center py-8 text-center px-2">
                    <div class="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center mb-2">
                        <i data-lucide="search-x" class="w-5 h-5 text-gray-400"></i>
                    </div>
                    <p class="text-[10px] text-gray-500">${term ? this.esc(o.labels.searchHint) : 'Sin productos disponibles'}</p>
                </div>`);
        } else {
            let gi = 0; // indice global continuo a traves de las categorias
            const html = catNames.map(c => {
                const rows = groups[c].map(p => this.renderSearchResult(p, gi++)).join('');
                return this.renderCatHeader(c, groups[c].length) + rows;
            }).join('');
            $cat.html(html);
        }
        if (window.lucide) lucide.createIcons();
        this.highlightActive();
    }

    // Encabezado de seccion de categoria dentro del catalogo de busqueda.
    renderCatHeader(cat, count) {
        return `
            <div class="mf-cat-head sticky top-0 z-[5] flex items-center justify-between px-2 py-1 bg-white border-b border-gray-200">
                <span class="text-[9px] font-bold uppercase tracking-wider text-purple-600 truncate">${this.esc(cat)}</span>
                <span class="text-[9px] text-gray-400 flex-shrink-0 ml-2">${count}</span>
            </div>`;
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

        const stockColor = prod.stock === 0 ? 'text-rose-600' : prod.stock < 5 ? 'text-orange-500' : 'text-green-600';
        const html = `
            <div id="${popId}" class="absolute top-full left-0 mt-2 z-[60] w-[260px] bg-white rounded-xl shadow-2xl shadow-black/20">
                <div class="absolute -top-1.5 left-7 w-3 h-3 bg-gray-50 rotate-45"></div>
                <div class="relative flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-300 bg-gray-50 rounded-t-xl">
                    ${this.prodThumb(prod, 'w-8 h-8', 'w-3.5 h-3.5')}
                    <div class="min-w-0">
                        <p class="text-[11px] font-semibold text-gray-800 truncate">${this.esc(prod.nombre)}</p>
                        <div class="flex items-center gap-1.5">
                            <span class="text-[9px] text-gray-500 font-mono">${this.esc(prod.sku)}</span>
                            <span class="text-gray-300">.</span>
                            <span class="text-[9px] text-gray-500">Stock <strong class="${stockColor}">${prod.stock || 0}</strong></span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2 px-3 py-2.5">
                    <button id="${popId}_minus" type="button" class="w-8 h-8 flex-shrink-0 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-purple-500/10 hover:text-gray-900 hover:border-purple-500/40 transition-all">
                        <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                    </button>
                    <input id="${popId}_qty" type="number" min="1" value="1" inputmode="numeric"
                        class="no-spin flex-1 min-w-0 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-center text-base font-bold text-gray-800 outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all">
                    <button id="${popId}_plus" type="button" class="w-8 h-8 flex-shrink-0 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-purple-500/10 hover:text-gray-900 hover:border-purple-500/40 transition-all">
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

        const close = () => { $(document).off('mousedown.qtyPopSalida'); $pop.remove(); };
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
        setTimeout(() => $(document).on('mousedown.qtyPopSalida', (ev) => {
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
        const $items = $(`#${this.opts.id}_catalogoLista .mf-cat-item`);
        $items.removeClass('mf-active');
        const $a = $items.eq(this.activeIdx);
        $a.addClass('mf-active');
        if ($a.length && $a[0].scrollIntoView) $a[0].scrollIntoView({ block: 'nearest' });
    }

    flashRow(idx) {
        const $row = $(`#${this.opts.id}_listaProductos tr[data-idx="${idx}"]`);
        if (!$row.length) return;
        $row.removeClass('mf-flash');
        void $row[0].offsetWidth; // reinicia la animacion al re-escanear el mismo producto
        $row.addClass('mf-flash');
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
        if (field === 'cantidad') {
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
        const nuevoStock  = Number(p.stock || 0) - cant;
        const $row = $(`#${o.id}_listaProductos tr[data-idx="${i}"]`);
        $row.find('[data-subtotal]').text('-$' + subtotalFmt);
        $row.find('[data-nuevo-stock]').text(nuevoStock);
    }

    clearLote() {
        if (!this.lote.length) return;
        if (confirm('Eliminar todos los productos de la salida?')) {
            this.lote = [];
            this.renderLote();
        }
    }

    // Filtra los almacenes visibles por la sucursal seleccionada.
    refreshAlmacenes(subsidiariesId) {
        const o     = this.opts;
        const $sel  = $(`#${o.id}_selAlmacen`);
        const items = (o.data.almacenes || []).filter(a =>
            !subsidiariesId || String(a.subsidiaries_id) === String(subsidiariesId)
        );
        $sel.html(items.map(it => this.optionTag(it)).join(''));
    }

    // -- Foto / evidencia --

    onPhotoChange(file) {
        if (!file) return;
        const o = this.opts;

        const apply = (dataUrl) => {
            this.photo = { name: file.name, dataUrl };
            $(`#${o.id}_photoImg`).attr('src', dataUrl);
            $(`#${o.id}_btnFoto`).addClass('hidden');
            $(`#${o.id}_fotoChip`).removeClass('hidden').addClass('flex');
            if (window.lucide) lucide.createIcons();
        };

        const reader = new FileReader();
        reader.onload = (ev) => {
            // Redimensiona a max 1280px y recomprime a JPEG: una foto de camara pesa
            // varios MB y su base64 excederia el post_max_size de PHP al registrar.
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
            img.onerror = () => apply(ev.target.result); // fallback: dataURL original
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    removePhoto() {
        const o = this.opts;
        this.photo = null;
        $(`#${o.id}_photoInput`).val('');
        $(`#${o.id}_fotoChip`).addClass('hidden').removeClass('flex');
        $(`#${o.id}_btnFoto`).removeClass('hidden');
    }

    closeModal() {
        this.wrap.addClass('hidden');
        this.lote = [];
        this.removePhoto();
        this.renderLote();
        this.opts.onClose();
    }

    doRegistrar() {
        if (!this.lote.length) {
            if (typeof alert === 'function') alert({ icon: 'warning', text: 'Agrega al menos un producto a la salida' });
            return;
        }
        const o = this.opts;
        const warehouseId = $(`#${o.id}_selAlmacen`).val();
        if (!warehouseId) {
            if (typeof alert === 'function') alert({ icon: 'warning', text: 'Selecciona un almacen' });
            return;
        }
        const totUds   = this.lote.reduce((s, p) => s + Number(p.cantidad || 0), 0);
        const totCosto = this.lote.reduce((s, p) => s + Number(p.cantidad || 0) * Number(p.costo || 0), 0);
        const payload = {
            motivo:      $(`#${o.id}_selMotivo`).val(),                       // shrinkage_reason_id
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
        const submit = () => {
            o.onSubmit(payload);
            this.closeModal();
        };

        // El registro es definitivo y descuenta stock del almacen: se pide confirmacion.
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title:              'Registrar esta salida?',
                html:               `Se registraran <strong>${totUds}</strong> uds con una perdida de <strong>${this.fmtMoney(totCosto)}</strong>.<br>El stock se descontara del almacen y la accion es definitiva.`,
                icon:               'warning',
                showCancelButton:   true,
                confirmButtonText:  'Si, registrar',
                cancelButtonText:   'No',
                confirmButtonColor: '#E11D48'
            }).then((r) => { if (r.isConfirmed) submit(); });
        } else {
            submit();
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
        wrap.on('click', '[data-add-id]',             (e) => this.addProducto($(e.currentTarget).attr('data-add-id')));
        wrap.on('click', '[data-remove]',             (e) => this.removeProducto(Number($(e.currentTarget).attr('data-remove'))));
        wrap.on('input', 'input[data-field]',         (e) => this.updateField($(e.currentTarget)));
        wrap.on('click', `#${id}_btnLimpiarLote`,     () => this.clearLote());
        wrap.on('click', `#${id}_btnRegistrar`,       () => this.doRegistrar());

        wrap.on('click',  `#${id}_btnFoto`,     () => $(`#${id}_photoInput`).trigger('click'));
        wrap.on('change', `#${id}_photoInput`,  (e) => this.onPhotoChange(e.target.files && e.target.files[0]));
        wrap.on('click',  `#${id}_photoRemove`, (e) => { e.stopPropagation(); this.removePhoto(); });

        $(document).off('keydown.salidaForm').on('keydown.salidaForm', (e) => {
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
        if (newData && 'motivo' in newData)          $(`#${id}_selMotivo`).val(newData.motivo);
        if (newData && 'subsidiaries_id' in newData) {
            $(`#${id}_selSucursal`).val(newData.subsidiaries_id);
            this.refreshAlmacenes(newData.subsidiaries_id);
        }
        if (newData && 'warehouse_id' in newData)    $(`#${id}_selAlmacen`).val(newData.warehouse_id);
        if (newData && 'fecha' in newData)           $(`#${id}_inpFecha`).val(newData.fecha);
        if (newData && 'nota' in newData)            $(`#${id}_inpNota`).val(newData.nota);
    }

    // -- Helpers --

    esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    prodThumb(p, boxCls, iconCls) {
        const box = boxCls || 'w-8 h-8';
        const ico = iconCls || 'w-4 h-4';
        const src = p.image ? `https://huubie.com.mx/${String(p.image).replace(/^\/+/, '')}` : '';
        const img = src
            ? `<img src="${this.esc(src)}" alt="" class="absolute inset-0 w-full h-full object-cover" onerror="this.style.display='none'">`
            : '';
        const bg   = p.bg    || 'bg-purple-500/10';
        const icon = p.icon  || 'package';
        const col  = p.color || 'text-purple-600';
        return `
            <div class="relative ${box} rounded-lg ${this.esc(bg)} flex items-center justify-center flex-shrink-0 ring-1 ring-black/5 overflow-hidden">
                <i data-lucide="${this.esc(icon)}" class="${ico} ${this.esc(col)}"></i>
                ${img}
            </div>`;
    }

    fmtMoney(n) {
        return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    optionTag(item, sel) {
        const val = item.id != null ? item.id : item.valor;
        return `<option value="${this.esc(val)}"${String(sel) === String(val) ? ' selected' : ''}>${this.esc(item.valor)}</option>`;
    }

    selectWrap(selectHtml) {
        return `
            <div class="relative">
                ${selectHtml}
                <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-rose-600/80 flex items-center">
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                </span>
            </div>`;
    }
}

Templates.prototype.salidaForm = function (options) {
    return new SalidaForm(options);
};
