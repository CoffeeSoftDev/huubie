class TraspasoForm {

    constructor(options) {

        this.cls = {
            label:   'block text-[9px] font-semibold uppercase tracking-wider text-gray-500 mb-1',
            input:   'w-full px-2.5 py-1.5 text-[11px] text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400',
            select:  'w-full px-2.5 py-1.5 text-[11px] text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all cursor-pointer appearance-none pr-8',
            search:  'w-full pl-8 pr-2.5 py-1.5 text-[11px] text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400',
            qtyInp:  'no-spin w-full px-3 py-1.5 text-[11px] font-bold text-center text-gray-800 bg-white border border-gray-300 rounded outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all',
            btnOut:  'px-3 py-1.5 text-[11px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-800 hover:border-gray-400 transition-all',
            btnOk:   'px-3 py-1.5 text-[11px] font-bold text-white bg-blue-600 rounded-md hover:bg-blue-500 hover:shadow-lg transition-all flex items-center gap-1.5',
            badge:   'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold leading-none'
        };

        const defaults = {
            parent: 'body',
            id:     'traspasoFormModal',
            class:  'hidden fixed inset-0 z-[100] flex items-center justify-center',
            json:   [],
            data: {
                sucursales:      [],
                almacenes:       [],
                categorias:      [],
                origenIdInicial: ''
            },
            labels: {
                title:        'Nuevo Traspaso',
                subtitle:     'Movimiento de inventario entre sucursales',
                origenLbl:    'Sucursal origen',
                origenAlm:    'Almacen origen',
                destinoLbl:   'Sucursal destino',
                destinoAlm:   'Almacen destino',
                destinoPh:    'Selecciona sucursal...',
                destinoAlmPh: 'Selecciona almacen...',
                categoria:    'Categoria',
                sinCategoria: 'Sin categoria',
                buscar:       'Buscar productos',
                placeholder:  'Nombre o SKU...',
                searchHint:   'Sin resultados',
                productosLbl: 'Productos',
                costoTotLbl:  'Costo total',
                emptyTitle:   'Aun no has agregado productos',
                emptyHint:    'Usa el buscador para empezar',
                limpiar:      'Limpiar',
                cancelar:     'Cancelar',
                registrar:    'Crear y enviar traspaso',
                confirmTitle: 'Crear y enviar traspaso?',
                confirmOk:    'Si, enviar',
                nota:         'Nota (opcional)',
                agregar:      'Agregar',
                errSucIgual:       'Origen y destino son iguales',
                errSucIgualDesc:   'La sucursal de origen y la de destino no pueden ser la misma.',
                errSinDest:        'Falta la sucursal destino',
                errSinDestDesc:    'Elige a que sucursal quieres enviar el traspaso.',
                errSinAlmDest:     'Falta el almacen destino',
                errSinAlmDestDesc: 'Indica en que almacen de la sucursal destino se recibiran los productos.',
                errSinProd:        'Aun no agregas productos',
                errSinProdDesc:    'Usa el buscador para agregar al menos un producto.'
            },
            onSave:  () => {},
            onClose: () => {}
        };

        const o = options || {};
        this.opts        = Object.assign({}, defaults, o);
        this.opts.data   = Object.assign({}, defaults.data,   o.data   || {});
        this.opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        this.lote         = [];
        this.allowZero    = false;
        this.searchTerm   = '';
        this.activeIdx    = 0;
        this.catalogItems = [];
        this.collapsedCats = new Set();

        this.ensureStyles();
        this.mount();
        this.bindEvents();
        this.renderLote();
    }

    renderHeader() {
        const o = this.opts;
        return `
            <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <i data-lucide="arrow-left-right" class="w-5 h-5 text-white"></i>
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
        const o    = this.opts;
        const cls  = this.cls;
        const sucs = o.data.sucursales || [];
        const alms = o.data.almacenes  || [];
        const cats = o.data.categorias || [];
        const firstAlm = alms[0] && alms[0].id;
        return `
            <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60">
                <div class="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                    <div>
                        <label class="${cls.label} flex items-center gap-1.5"><i data-lucide="arrow-up-from-line" class="w-3 h-3 text-blue-600"></i>${this.esc(o.labels.origenLbl)}</label>
                        ${this.selectWrap(`<select id="${o.id}_origenSuc" class="${cls.select}">${sucs.map(it => this.optionTag(it, o.data.origenIdInicial)).join('')}</select>`)}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.origenAlm)}</label>
                        ${this.selectWrap(`<select id="${o.id}_origenAlm" class="${cls.select}">${alms.map(it => this.optionTag(it, firstAlm)).join('')}</select>`)}
                    </div>
                    <div>
                        <label class="${cls.label} flex items-center gap-1.5"><i data-lucide="arrow-down-to-line" class="w-3 h-3 text-orange-500"></i>${this.esc(o.labels.destinoLbl)}</label>
                        ${this.selectWrap(`<select id="${o.id}_destinoSuc" class="${cls.select}"><option value="" selected>${this.esc(o.labels.destinoPh)}</option>${sucs.map(it => this.optionTag(it, '')).join('')}</select>`)}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.destinoAlm)}</label>
                        ${this.selectWrap(`<select id="${o.id}_destinoAlm" class="${cls.select}"><option value="" selected>${this.esc(o.labels.destinoAlmPh)}</option>${alms.map(it => this.optionTag(it, '')).join('')}</select>`)}
                    </div>
                    <div>
                        <label class="${cls.label} flex items-center gap-1.5"><i data-lucide="tag" class="w-3 h-3 text-gray-400"></i>${this.esc(o.labels.categoria)}</label>
                        ${this.selectWrap(`<select id="${o.id}_categoria" class="${cls.select}"><option value="" selected>${this.esc(o.labels.sinCategoria)}</option>${cats.map(it => this.optionTag(it, '')).join('')}</select>`)}
                    </div>
                </div>
            </div>`;
    }

    renderSearchPanel() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="flex-shrink-0">
                <div class="flex items-center justify-between mb-1.5">
                    <p class="text-[9px] font-bold uppercase tracking-wider text-gray-500">${this.esc(o.labels.buscar)}</p>
                </div>
                <div class="relative">
                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none flex items-center">
                        <i data-lucide="search" class="w-3.5 h-3.5"></i>
                    </span>
                    <input id="${o.id}_buscarProducto" type="text" placeholder="${this.esc(o.labels.placeholder)}" class="${cls.search} !text-[10px]" autocomplete="off">
                </div>
                <p class="mt-1.5 text-[9px] text-gray-500 flex items-center flex-wrap gap-x-1.5 gap-y-1 leading-none">
                    <span class="tf-kbd">&uarr;&darr;</span><span>navegar</span>
                    <span class="tf-kbd">Enter</span><span>agregar</span>
                </p>
            </div>
            <div id="${o.id}_catalogoLista" class="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 -mr-1 cs-scroll tf-scroll bg-gray-50 border border-gray-200 rounded-lg p-1.5"></div>`;
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
                    <span class="text-[9px] uppercase tracking-wider text-gray-500">${this.esc(o.labels.costoTotLbl)}</span>
                    <span class="text-green-600 font-bold text-[16px] leading-none" id="${o.id}_qtyCost">$0.00</span>
                </div>
            </div>`;
    }

    renderLoteHeader() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-gray-50">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center">
                        <i data-lucide="boxes" class="w-3.5 h-3.5 text-blue-600"></i>
                    </div>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-gray-600">${this.esc(o.labels.productosLbl)}</p>
                    <span id="${o.id}_cntProductos" class="${cls.badge} bg-blue-50 text-blue-700 border border-blue-200">0</span>
                </div>
                <button id="${o.id}_btnLimpiarLote" class="text-[10px] text-gray-500 hover:text-red-500 transition flex items-center gap-1 hidden px-2 py-1 rounded-md hover:bg-red-50">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>${this.esc(o.labels.limpiar)}
                </button>
            </div>`;
    }

    renderFooter() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <div class="flex items-center gap-1.5 flex-1 min-w-0">
                    <i data-lucide="sticky-note" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0"></i>
                    <input id="${o.id}_inpNota" type="text" placeholder="${this.esc(o.labels.nota)}..." class="${cls.input}">
                </div>
                <div class="flex gap-2 flex-shrink-0">
                    <button class="${cls.btnOut}" data-modal-close>${this.esc(o.labels.cancelar)}</button>
                    <button id="${o.id}_btnRegistrar" class="${cls.btnOk}">
                        <i data-lucide="send" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.registrar)}</span>
                    </button>
                </div>
            </div>`;
    }

    renderEmptyState() {
        const o = this.opts;
        return `
            <div class="flex flex-col items-center justify-center py-12 text-center">
                <div class="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
                    <i data-lucide="arrow-left-right" class="w-8 h-8 text-blue-400"></i>
                </div>
                <p class="text-xs font-semibold text-gray-700">${this.esc(o.labels.emptyTitle)}</p>
                <p class="text-[10px] text-gray-400 mt-1">${this.esc(o.labels.emptyHint)}</p>
            </div>`;
    }

    renderProductRow(p, i) {
        const o           = this.opts;
        const cls         = this.cls;
        const cant        = Number(p.cantidad || 0);
        const costoNum    = Number(p.costo || 0);
        const costoFmt    = costoNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const subtotalFmt = (cant * costoNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const stock       = Number(p.stock || 0);
        const stockColor  = stock === 0 ? 'text-red-500' : stock < 5 ? 'text-orange-500' : 'text-green-600';

        return `
            <tr class="border-b border-gray-100 last:border-b-0 hover:bg-blue-50/40 transition-colors" data-idx="${i}">
                <td class="px-3 py-2 align-middle">
                    <div class="flex items-center gap-2 min-w-0">
                        ${this.prodThumb(p, 'w-8 h-8', 'w-3.5 h-3.5')}
                        <div class="min-w-0">
                            <p class="text-[11px] font-semibold text-gray-800 truncate leading-tight">${this.esc(p.nombre)}</p>
                            <div class="flex items-center gap-1.5 mt-0.5">
                                <span class="text-[9px] text-gray-500 font-mono">${this.esc(p.sku)}</span>
                                <span class="text-gray-300">.</span>
                                <span class="text-[9px] text-gray-400">Stock origen <strong class="${stockColor}">${stock}</strong></span>
                            </div>
                        </div>
                    </div>
                </td>
                <td class="px-2 py-2 align-middle w-24">
                    <input type="number" min="1" max="${stock}" value="${cant}" class="${cls.qtyInp}" data-field="cantidad" data-idx="${i}">
                </td>
                <td class="px-2 py-2 align-middle w-28">
                    <div class="relative" title="Costo del producto (no editable)">
                        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                            <i data-lucide="dollar-sign" class="w-3 h-3"></i>
                        </span>
                        <div class="w-full pl-6 pr-6 py-1.5 text-[11px] text-right text-gray-600 bg-gray-50 border border-gray-200 rounded select-none cursor-not-allowed">${costoFmt}</div>
                        <span class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                            <i data-lucide="lock" class="w-2.5 h-2.5"></i>
                        </span>
                    </div>
                </td>
                <td class="px-2 py-2 align-middle text-right w-24">
                    <span class="text-green-600 font-bold text-[12px]" data-subtotal>$${subtotalFmt}</span>
                </td>
                <td class="px-2 py-2 align-middle w-12">
                    <div class="flex items-center justify-center">
                        <button class="w-6 h-6 rounded-md bg-white border border-gray-300 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-300 transition flex items-center justify-center" data-remove="${i}" title="Quitar">
                            <i data-lucide="x" class="w-3 h-3"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    }

    renderProductsTable() {
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
                <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                        <th class="text-center px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-24">Cant.</th>
                        <th class="text-left px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-28">Costo</th>
                        <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-24">Subtotal</th>
                        <th class="w-12"></th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>`;
    }

    renderLoteCatRow(cat, count) {
        return `
            <tr class="tf-lote-cat">
                <td colspan="5" class="px-3 pt-2.5 pb-1 bg-gray-50">
                    <div class="flex items-center justify-between">
                        <span class="text-[9px] font-bold uppercase tracking-wider text-blue-700 truncate">${this.esc(cat)}</span>
                        <span class="text-[9px] text-gray-400 flex-shrink-0 ml-2">${count}</span>
                    </div>
                </td>
            </tr>`;
    }

    renderSearchResult(p, i) {
        const stock      = this.stockOrigen(p, this.currentOrigen());
        const stockColor = stock === 0 ? 'text-red-500' : stock < 5 ? 'text-orange-500' : 'text-green-600';
        const stockBg    = stock === 0 ? 'bg-red-50' : stock < 5 ? 'bg-orange-50' : 'bg-green-50';
        const disabled   = !this.allowZero && stock <= 0;
        return `
            <div class="tf-cat-item rounded-md flex items-center gap-2.5 px-2.5 py-1.5 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-blue-50/60'} border-b border-gray-100 last:border-b-0 transition-all group" data-add-id="${this.esc(p.id)}" data-cat-idx="${i}">
                ${this.prodThumb(p, 'w-8 h-8', 'w-3.5 h-3.5')}
                <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-semibold text-gray-800 truncate">${this.esc(p.nombre)}</p>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        <span class="text-[8px] px-1.5 py-0.5 rounded ${stockBg} ${stockColor} font-bold">Stock ${stock}</span>
                        <span class="text-[8px] text-gray-500 font-mono">${this.esc(p.sku)}</span>
                        <span class="text-[8px] text-gray-500">. ${this.fmtMoney(p.costo)}</span>
                    </div>
                </div>
                <div class="w-6 h-6 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                    <i data-lucide="plus" class="w-3 h-3"></i>
                </div>
            </div>`;
    }

    renderCatHeader(cat, count, collapsed) {
        return `
            <div class="tf-cat-head flex items-center gap-1.5 px-2 py-1 bg-gray-50 border-b border-gray-200 cursor-pointer select-none hover:bg-gray-100 transition-colors" data-cat-toggle="${this.esc(cat)}">
                <i data-lucide="chevron-down" class="w-2.5 h-2.5 text-blue-600 transition-transform ${collapsed ? '-rotate-90' : ''}"></i>
                <span class="text-[8px] font-bold uppercase tracking-wider text-blue-700 truncate flex-1">${this.esc(cat)}</span>
                <span class="text-[8px] text-gray-400 flex-shrink-0 ml-2">${count}</span>
            </div>`;
    }

    ensureStyles() {
        if (document.getElementById('traspasoFormStyles')) return;
        const css = `
            input.no-spin::-webkit-inner-spin-button,
            input.no-spin::-webkit-outer-spin-button { -webkit-appearance: none !important; appearance: none !important; margin: 0 !important; }
            input.no-spin { -moz-appearance: textfield !important; appearance: textfield !important; }
            .tf-scroll { scrollbar-width: thin; scrollbar-color: #CBD5E1 transparent; }
            .tf-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
            .tf-scroll::-webkit-scrollbar-track { background: transparent; }
            .tf-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
            .tf-scroll::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
            .tf-cat-item.tf-active { background: rgba(192,90,64,0.10); box-shadow: inset 0 0 0 1px rgba(192,90,64,0.45); }
            @keyframes tfFlash { 0% { background-color: rgba(16,185,129,0.30); } 100% { background-color: transparent; } }
            tr.tf-flash { animation: tfFlash 0.6s ease-out; }
            @keyframes tfAlertBg { from { opacity: 0; } to { opacity: 1; } }
            @keyframes tfAlertPop { from { opacity: 0; transform: translateY(6px) scale(0.94); } to { opacity: 1; transform: translateY(0) scale(1); } }
            .tf-alert-bg { animation: tfAlertBg 0.18s ease-out; }
            .tf-alert-card { animation: tfAlertPop 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
            .tf-kbd { display: inline-flex; align-items: center; padding: 0 4px; height: 14px; border-radius: 3px; border: 1px solid #D1D5DB; background: #F3F4F6; font-size: 8px; line-height: 1; color: #6B7280; font-family: monospace; }`;
        const style = document.createElement('style');
        style.id = 'traspasoFormStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    mount() {
        const o = this.opts;
        this.wrap = $('<div>', { id: o.id, class: o.class });
        this.wrap.html(`
            <div class="absolute inset-0 bg-black/40" data-modal-close></div>
            <div class="relative z-10 w-full max-w-[960px] h-[90vh] mx-3 bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">
                ${this.renderHeader()}
                <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
                    ${this.renderConfigRow()}
                    <div class="flex flex-1 min-h-0">
                        <div class="w-[360px] border-r border-gray-200 flex flex-col flex-shrink-0 p-2.5 gap-2 overflow-hidden">
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
                <div id="${o.id}_alert" class="hidden absolute inset-0 z-[90] flex items-center justify-center"></div>
            </div>
        `);

        const $target = o.parent === 'body' || !$(`#${o.parent}`).length ? $('body') : $(`#${o.parent}`);
        $(`#${o.id}`).remove();
        $target.append(this.wrap);
    }

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

    // Nombre de la categoria elegida en el filtro del config-row, o '' para "Sin
    // categoria" (no filtra: el catalogo muestra todos los productos). El <select>
    // entrega el id de la categoria pero los productos solo traen el nombre, asi que
    // se traduce id -> nombre via o.data.categorias para poder comparar en renderCatalogo.
    selectedCategoriaNombre() {
        const id = $(`#${this.opts.id}_categoria`).val();
        if (!id) return '';
        const cat = (this.opts.data.categorias || []).find(c => String(c.id != null ? c.id : c.valor) === String(id));
        return cat ? String(cat.valor != null ? cat.valor : '').trim() : '';
    }

    renderCatalogo() {
        const o      = this.opts;
        const $cat   = $(`#${o.id}_catalogoLista`);
        const term   = (this.searchTerm || '').toLowerCase();
        const catName = this.selectedCategoriaNombre();
        const items  = (o.json || [])
            .filter(p => !this.lote.some(x => String(x.id) === String(p.id)))
            .filter(p => !catName || String(p.categoria || '').trim() === catName)
            .filter(p => !term || (p.nombre || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term));

        const groups = {};
        items.forEach(p => {
            const cat = (p.categoria && String(p.categoria).trim()) || 'Sin categoria';
            (groups[cat] = groups[cat] || []).push(p);
        });
        const catNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'es'));
        const searching = !!term;

        const ordered = [];
        catNames.forEach(c => {
            if (searching || !this.collapsedCats.has(c)) groups[c].forEach(p => ordered.push(p));
        });
        this.catalogItems = ordered;
        if (this.activeIdx >= ordered.length) this.activeIdx = Math.max(0, ordered.length - 1);

        if (!catNames.length) {
            $cat.html(`
                <div class="flex flex-col items-center justify-center py-8 text-center px-2">
                    <div class="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center mb-2">
                        <i data-lucide="search-x" class="w-5 h-5 text-gray-400"></i>
                    </div>
                    <p class="text-[10px] text-gray-500">${term ? this.esc(o.labels.searchHint) : 'Sin productos disponibles'}</p>
                </div>`);
        } else {
            let gi = 0;
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

    toggleCat(cat) {
        if (this.collapsedCats.has(cat)) this.collapsedCats.delete(cat);
        else                             this.collapsedCats.add(cat);
        this.renderCatalogo();
    }

    maxQty(stock) {
        return Number(stock || 0);
    }

    renderLote() {
        const o      = this.opts;
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

    doSearch(q) {
        this.searchTerm = String(q == null ? '' : q).trim();
        this.activeIdx  = 0;
        this.renderCatalogo();
    }

    addProducto(id) {
        const prod = (this.opts.json || []).find(p => String(p.id) === String(id));
        if (!prod) return;
        if (!this.allowZero && this.stockOrigen(prod, this.currentOrigen()) <= 0) return;
        this.promptCantidad(prod);
    }

    promptCantidad(prod) {
        if (!prod) return;
        const o       = this.opts;
        const popId   = `${o.id}_qtyPop`;
        const $anchor = $(`#${o.id}_buscarProducto`).closest('.relative');
        if (!$anchor.length) return;
        $(`#${popId}`).remove();

        const stock      = this.stockOrigen(prod, this.currentOrigen());
        const max        = this.maxQty(stock);
        const maxAttr    = isFinite(max) ? `max="${max}"` : '';
        const stockColor = stock === 0 ? 'text-red-500' : stock < 5 ? 'text-orange-500' : 'text-green-600';
        const html = `
            <div id="${popId}" class="absolute top-full left-0 mt-2 z-[60] w-[260px] bg-white border border-gray-200 rounded-xl shadow-2xl shadow-black/20">
                <div class="absolute -top-1.5 left-7 w-3 h-3 bg-gray-50 border-l border-t border-gray-200 rotate-45"></div>
                <div class="relative flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                    ${this.prodThumb(prod, 'w-8 h-8', 'w-3.5 h-3.5')}
                    <div class="min-w-0">
                        <p class="text-[11px] font-semibold text-gray-800 truncate">${this.esc(prod.nombre)}</p>
                        <div class="flex items-center gap-1.5">
                            <span class="text-[9px] text-gray-500 font-mono">${this.esc(prod.sku)}</span>
                            <span class="text-gray-300">.</span>
                            <span class="text-[9px] text-gray-400">Stock <strong class="${stockColor}">${stock}</strong></span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2 px-3 py-2.5">
                    <button id="${popId}_minus" type="button" class="w-8 h-8 flex-shrink-0 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all">
                        <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                    </button>
                    <input id="${popId}_qty" type="number" min="1" ${maxAttr} value="1" inputmode="numeric"
                        class="no-spin flex-1 min-w-0 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-center text-base font-bold text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all">
                    <button id="${popId}_plus" type="button" class="w-8 h-8 flex-shrink-0 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    </button>
                    <button id="${popId}_ok" type="button" class="h-8 px-3 flex-shrink-0 rounded-lg text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-1 transition-all">
                        <i data-lucide="corner-down-left" class="w-3 h-3"></i>${this.esc(o.labels.agregar)}
                    </button>
                </div>
            </div>`;

        $anchor.append(html);
        if (window.lucide) lucide.createIcons();
        const $pop = $(`#${popId}`);
        const $qty = $(`#${popId}_qty`);
        $qty.trigger('focus').trigger('select');

        const cap   = (n) => Math.max(1, isFinite(max) ? Math.min(max || 1, n) : n);
        const close = () => { $(document).off('mousedown.qtyPopTras'); $pop.remove(); };
        const backToSearch = () => {
            close();
            this.resetSearchState();
            this.renderCatalogo();
            $(`#${o.id}_buscarProducto`).trigger('focus');
        };
        const confirmar = () => {
            const qty = cap(parseInt($qty.val(), 10) || 1);
            close();
            this.resetSearchState();
            this.addOrIncrement(prod, qty);
            $(`#${o.id}_buscarProducto`).trigger('focus');
        };
        const step = (d) => $qty.val(cap((parseInt($qty.val(), 10) || 1) + d)).trigger('select');

        $(`#${popId}_minus`).on('click', () => step(-1));
        $(`#${popId}_plus`).on('click',  () => step(1));
        $(`#${popId}_ok`).on('click', confirmar);
        $qty.on('keydown', (e) => {
            if (e.key === 'Enter')  { e.preventDefault(); confirmar(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); backToSearch(); }
        });
        setTimeout(() => $(document).on('mousedown.qtyPopTras', (ev) => {
            if (!$(ev.target).closest(`#${popId}, #${o.id}_buscarProducto`).length) backToSearch();
        }), 0);
    }

    addOrIncrement(prod, qty) {
        const stock = this.stockOrigen(prod, this.currentOrigen());
        if (!this.allowZero && stock <= 0) return -1;
        const max = this.maxQty(stock);
        qty = Math.max(1, Number(qty) || 1);
        const existing = this.lote.find(x => String(x.id) === String(prod.id));
        let idx;
        if (existing) {
            existing.cantidad = Math.min(max, Number(existing.cantidad || 0) + qty);
            existing.stock    = stock;
            idx = this.lote.indexOf(existing);
        } else {
            this.lote.push({
                id:        prod.id,
                nombre:    prod.nombre,
                sku:       prod.sku,
                categoria: prod.categoria || 'Sin categoria',
                costo:     Number(prod.costo || 0),
                cantidad:  Math.min(max, qty),
                stock:     stock,
                icon:      prod.icon  || 'package',
                bg:        prod.bg    || 'bg-gray-100',
                color:     prod.color || 'text-gray-500',
                image:     prod.image || ''
            });
            idx = this.lote.length - 1;
        }
        this.renderLote();
        this.flashRow(idx);
        return idx;
    }

    handleSearchEnter() {
        const all = this.opts.json || [];
        const q   = (this.searchTerm || '').toLowerCase();
        if (q) {
            const exact = all.find(p => String(p.sku || '').toLowerCase() === q);
            if (exact) {
                if (!this.allowZero && this.stockOrigen(exact, this.currentOrigen()) <= 0) return;
                this.resetSearchState();
                this.addOrIncrement(exact, 1);
                $(`#${this.opts.id}_buscarProducto`).trigger('focus');
                return;
            }
        }
        let prod = this.catalogItems.length ? (this.catalogItems[this.activeIdx] || this.catalogItems[0]) : null;
        if (!prod && q) {
            prod = all.find(p => (p.nombre || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
        }
        if (!prod) return;
        if (!this.allowZero && this.stockOrigen(prod, this.currentOrigen()) <= 0) return;
        this.promptCantidad(prod);
    }

    resetSearchState() {
        this.searchTerm = '';
        this.activeIdx  = 0;
        $(`#${this.opts.id}_buscarProducto`).val('');
    }

    highlightActive() {
        const $items = $(`#${this.opts.id}_catalogoLista .tf-cat-item`);
        $items.removeClass('tf-active');
        const $a = $items.eq(this.activeIdx);
        $a.addClass('tf-active');
        if ($a.length && $a[0].scrollIntoView) $a[0].scrollIntoView({ block: 'nearest' });
    }

    flashRow(idx) {
        const $row = $(`#${this.opts.id}_listaProductos tr[data-idx="${idx}"]`);
        if (!$row.length) return;
        $row.removeClass('tf-flash');
        void $row[0].offsetWidth;
        $row.addClass('tf-flash');
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
                e.stopPropagation();
                this.resetSearchState();
                this.renderCatalogo();
            }
        }
    }

    onQtyKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            $(`#${this.opts.id}_buscarProducto`).trigger('focus');
        }
    }

    removeProducto(i) {
        this.lote.splice(i, 1);
        this.renderLote();
    }

    updateField($el) {
        const idx   = Number($el.data('idx'));
        const field = $el.data('field');
        if (isNaN(idx) || !this.lote[idx] || field !== 'cantidad') return;
        const item = this.lote[idx];
        let val = parseInt(String($el.val()).trim(), 10);
        if (isNaN(val) || val < 0) val = 0;
        item.cantidad = val;
        this.updateSubtotal(idx);
        this.updateTotals();
    }

    commitField($el) {
        const idx   = Number($el.data('idx'));
        const field = $el.data('field');
        if (isNaN(idx) || !this.lote[idx] || field !== 'cantidad') return;
        const item = this.lote[idx];
        let val = parseInt($el.val(), 10);
        if (isNaN(val) || val < 1) val = 1;
        if (!this.allowZero && item.stock && val > item.stock) val = item.stock;
        item.cantidad = val;
        this.refreshRow(idx);
        this.updateTotals();
    }

    updateSubtotal(i) {
        const p = this.lote[i];
        if (!p) return;
        const sub = Number(p.cantidad || 0) * Number(p.costo || 0);
        $(`#${this.opts.id}_listaProductos tr[data-idx="${i}"] [data-subtotal]`)
            .text('$' + sub.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }

    refreshRow(i) {
        const o = this.opts;
        const p = this.lote[i];
        if (!p) return;
        const cant        = Number(p.cantidad || 0);
        const costoNum    = Number(p.costo || 0);
        const subtotalFmt = (cant * costoNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const $row = $(`#${o.id}_listaProductos tr[data-idx="${i}"]`);
        const $inp = $row.find('input[data-field="cantidad"]');
        if ($inp.length && String($inp.val()) !== String(cant)) $inp.val(cant);
        $row.find('[data-subtotal]').text('$' + subtotalFmt);
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
        this.hideError();
        this.opts.onClose();
    }

    alertBox(opts) {
        return Templates.prototype.alertBox(opts || {});
    }

    showError(title, detail) {
        this.alertBox({ type: 'warning', title: title, detailHtml: detail });
    }

    hideError() {
        $(`#${this.opts.id}_alert`).addClass('hidden').empty();
    }

    showConfirm(cfg) {
        const c = cfg || {};
        this.alertBox({
            type:        'confirm',
            icon:        'arrow-left-right',
            title:       c.title,
            detailHtml:  c.detailHtml,
            okLabel:     c.okLabel,
            okIcon:      c.okIcon,
            cancelLabel: this.opts.labels.cancelar,
            onOk:        c.onOk
        });
    }

    doRegistrar() {
        const o          = this.opts;
        const origenId   = $(`#${o.id}_origenSuc`).val();
        const origenAlm  = $(`#${o.id}_origenAlm`).val();
        const destinoId  = $(`#${o.id}_destinoSuc`).val();
        const destinoAlm = $(`#${o.id}_destinoAlm`).val();
        const nota       = ($(`#${o.id}_inpNota`).val() || '').trim();

        this.hideError();

        if (!destinoId)             { this.showError(o.labels.errSinDest,    o.labels.errSinDestDesc);    return; }
        if (origenId === destinoId) { this.showError(o.labels.errSucIgual,   o.labels.errSucIgualDesc);   return; }
        if (!destinoAlm)            { this.showError(o.labels.errSinAlmDest, o.labels.errSinAlmDestDesc); return; }
        if (!this.lote.length)      { this.showError(o.labels.errSinProd,    o.labels.errSinProdDesc);    return; }

        const sucs = o.data.sucursales || [];
        const alms = o.data.almacenes  || [];
        const find = (list, id) => list.find(x => String(x.id) === String(id)) || { id: id, valor: id };

        const sucOrigen  = find(sucs, origenId);
        const sucDestino = find(sucs, destinoId);
        const almOrigen  = find(alms, origenAlm);
        const almDestino = find(alms, destinoAlm);

        const productos = this.lote.map(i => {
            const p = (o.json || []).find(x => String(x.id) === String(i.id));
            return {
                productId:        i.id,
                sku:              p ? p.sku : i.sku,
                nombre:           i.nombre,
                icon:             i.icon,
                bg:               i.bg,
                color:            i.color,
                cant:             Number(i.cantidad),
                costo:            Number(i.costo),
                stockOrigenPrev:  this.stockOrigen(p, origenId)
            };
        });

        const payload = {
            origen:    { id: sucOrigen.id,  nombre: sucOrigen.valor,  almacen: { id: almOrigen.id,  nombre: almOrigen.valor  } },
            destino:   { id: sucDestino.id, nombre: sucDestino.valor, almacen: { id: almDestino.id, nombre: almDestino.valor } },
            productos: productos,
            nota:      nota
        };

        const totalUds = productos.reduce((s, p) => s + Number(p.cant || 0), 0);
        const arrow    = '<span class="text-blue-600 px-1">&rarr;</span>';
        const detailHtml =
            `<span class="font-semibold text-gray-700">${this.esc(sucOrigen.valor)}</span>${arrow}` +
            `<span class="font-semibold text-gray-700">${this.esc(sucDestino.valor)}</span><br>` +
            `${productos.length} producto${productos.length !== 1 ? 's' : ''} &middot; ${totalUds} uds`;

        this.showConfirm({
            title:      o.labels.confirmTitle,
            detailHtml: detailHtml,
            okLabel:    o.labels.confirmOk,
            okIcon:     'send',
            onOk: () => {
                this.opts.onSave(payload);
                this.closeModal();
            }
        });
    }

    bindEvents() {
        const wrap = this.wrap;
        const id   = this.opts.id;

        wrap.on('click', '[data-modal-close]',      () => this.closeModal());
        wrap.on('click', '[data-alert-close]',      () => this.hideError());
        wrap.on('input', `#${id}_buscarProducto`,   (e) => this.doSearch(e.target.value));
        wrap.on('keydown', `#${id}_buscarProducto`, (e) => this.onSearchKeydown(e));
        wrap.on('keydown', 'input[data-field="cantidad"]', (e) => this.onQtyKeydown(e));
        wrap.on('click', '[data-cat-toggle]',       (e) => this.toggleCat($(e.currentTarget).attr('data-cat-toggle')));
        wrap.on('click', '[data-add-id]',           (e) => this.addProducto($(e.currentTarget).attr('data-add-id')));
        wrap.on('click', '[data-remove]',           (e) => this.removeProducto(Number($(e.currentTarget).attr('data-remove'))));
        wrap.on('input', 'input[data-field]',       (e) => this.updateField($(e.currentTarget)));
        wrap.on('focusout', 'input[data-field="cantidad"]', (e) => this.commitField($(e.currentTarget)));
        wrap.on('click', `#${id}_btnLimpiarLote`,   () => this.clearLote());
        wrap.on('click', `#${id}_btnRegistrar`,     () => this.doRegistrar());

        wrap.on('change', `#${id}_origenSuc, #${id}_destinoSuc`, () => this.onChangeSucursal());
        wrap.on('change', `#${id}_categoria`, () => { this.activeIdx = 0; this.renderCatalogo(); });

        $(document).off('keydown.traspasoForm').on('keydown.traspasoForm', (e) => {
            if (e.key !== 'Escape' || this.wrap.hasClass('hidden')) return;
            const $alert = $(`#${this.opts.id}_alert`);
            if ($alert.length && !$alert.hasClass('hidden')) { this.hideError(); return; }
            this.closeModal();
        });
    }

    warehousesFor(branchId) {
        const alms = this.opts.data.almacenes || [];
        if (!branchId) return alms;
        const filt = alms.filter(a => !a.branch_id || String(a.branch_id) === String(branchId));
        return filt.length ? filt : alms;
    }

    fillSelect(selId, list, placeholder) {
        const $sel = $(`#${selId}`);
        if (!$sel.length) return;
        const prev = $sel.val();
        const ph   = placeholder ? `<option value="">${this.esc(placeholder)}</option>` : '';
        $sel.html(ph + (list || []).map(it => this.optionTag(it)).join(''));
        if (prev && (list || []).some(it => String(it.id != null ? it.id : it.valor) === String(prev))) $sel.val(prev);
        else if (placeholder) $sel.val('');
    }

    refreshAlmacenes() {
        const id = this.opts.id;
        this.fillSelect(`${id}_origenAlm`,  this.warehousesFor(this.currentOrigen()));
        this.fillSelect(`${id}_destinoAlm`, this.warehousesFor($(`#${id}_destinoSuc`).val()), this.opts.labels.destinoAlmPh);
    }

    onChangeSucursal() {
        this.refreshAlmacenes();
        const origenId = this.currentOrigen();
        this.lote.forEach(item => {
            const p = (this.opts.json || []).find(x => String(x.id) === String(item.id));
            const stock = this.stockOrigen(p, origenId);
            item.stock = stock;
            if (!this.allowZero && item.cantidad > stock) item.cantidad = Math.max(1, stock);
        });
        this.renderLote();
    }

    open() {
        this.wrap.removeClass('hidden');
        this.refreshAlmacenes();
        if (window.lucide) lucide.createIcons();
        setTimeout(() => $(`#${this.opts.id}_buscarProducto`).trigger('focus'), 50);
    }

    close() {
        this.closeModal();
    }

    setData(newData) {
        Object.assign(this.opts.data, newData || {});
        const id = this.opts.id;
        if (newData && 'origenIdInicial' in newData && newData.origenIdInicial != null) {
            const want   = String(newData.origenIdInicial);
            const $sel   = $(`#${id}_origenSuc`);
            const exists = $sel.find('option').toArray().some(op => op.value === want);
            if (exists) { $sel.val(want); }
            this.onChangeSucursal();
        }
    }

    currentOrigen() {
        const val = $(`#${this.opts.id}_origenSuc`).val();
        if (val) return val;
        const sucs = this.opts.data.sucursales || [];
        return this.opts.data.origenIdInicial || (sucs[0] && sucs[0].id) || '';
    }

    stockOrigen(prod, origenId) {
        if (!prod || !origenId) return 0;
        return (prod.stockPorSuc && prod.stockPorSuc[origenId]) || 0;
    }

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
            <div class="relative ${box} rounded-lg ${this.esc(p.bg || 'bg-gray-100')} flex items-center justify-center flex-shrink-0 ring-1 ring-gray-200 overflow-hidden">
                <i data-lucide="${this.esc(p.icon || 'package')}" class="${ico} ${this.esc(p.color || 'text-gray-500')}"></i>
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
                <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 flex items-center">
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                </span>
            </div>`;
    }
}

Templates.prototype.traspasoForm = function (options) {
    return new TraspasoForm(options);
};
