// Captura de una orden de compra con el mismo formato que la de Entradas (EntradaForm):
// buscador, renglón vacío con ↓, impuesto escribe-o-elige, alta exprés de producto y
// formatos. Cambia lo propio de la orden: Sucursal destino, Almacén y Proveedor
// opcionales, sin comprobante, y se guarda como borrador o se envía a revisión.
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
            title:         'Nueva orden de compra',
            subtitle:      'Arma la lista de materiales a solicitar',
            sucursal:      'Sucursal destino',
            almacen:       'Almacén',
            sinDefinir:    'Sin definir',
            proveedor:     'Proveedor',
            provPh:        '-- Sin proveedor --',
            fecha:         'Fecha de solicitud',
            fechaReq:      'Elige la fecha de la solicitud',
            fechaFutura:   'La fecha no puede ser posterior a hoy',
            nota:          'Comentario para quien revise la solicitud',
            productosLbl:  'Materiales a solicitar',
            emptyTitle:    'Aun no has agregado materiales',
            placeholder:   'Buscar materiales por nombre o SKU...',
            stockSinAlm:   'Elige un almacén para ver su stock',
            borrador:      'Guardar borrador',
            registrar:     'Guardar y enviar a revisión',
            confirmAdd:    'Deseas enviar la orden a revisión?',
            confirmAddOk:  'Si, enviar',
            confirmDraft:  'Deseas guardar la orden como borrador?',
            confirmDraftOk:'Si, guardar',
            titleEdit:     'Editar orden',
            guardarEdit:   'Guardar cambios',
            confirmEdit:   'Deseas guardar los cambios de la orden?',
            confirmEditOk: 'Si, guardar'
        };
    }

    // -- Render estático --

    // Proveedor siempre visible: en la orden es opcional en cualquier etapa.
    renderConfigRow() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60">
                <div id="${o.id}_configGrid" class="grid grid-cols-4 gap-3 items-end">
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.sucursal)}</label>
                        ${this.selectWrap(`
                            <select id="${o.id}_selSucursal" class="${cls.select} !pl-10">
                                <option value="">${this.esc(o.labels.sinDefinir)}</option>
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
                        <input id="${o.id}_inpFecha" type="date" value="${this.esc(o.data.fecha)}" max="${this.hoy()}" class="${cls.input}">
                    </div>
                    <div id="${o.id}_cellProveedor">
                        <div class="flex items-center justify-between mb-1">
                            <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">${this.esc(o.labels.proveedor)}</label>
                            <button id="${o.id}_btnNuevoProveedor" type="button" class="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 leading-none">
                                <i data-lucide="plus" class="w-3 h-3"></i>${this.esc(o.labels.provNuevo)}
                            </button>
                        </div>
                        ${this.selectWrap(`
                            <select id="${o.id}_selProveedor" class="${cls.select} !pl-10">
                                <option value="">${this.esc(o.labels.provPh)}</option>
                                ${(o.data.proveedores || []).map(it => this.optionTag(it)).join('')}
                            </select>
                        `, 'truck')}
                    </div>
                </div>
            </div>`;
    }

    // La orden no lleva comprobante.
    renderVoucher() {
        return '';
    }

    renderFooterActions() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="flex gap-2 flex-shrink-0">
                <button class="${cls.btnOut}" data-modal-close>${this.esc(o.labels.cancelar)}</button>
                <button id="${o.id}_btnBorrador" type="button" class="${cls.btnIco}">
                    <i data-lucide="save" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.borrador)}</span>
                </button>
                <button id="${o.id}_btnRegistrar" class="${cls.btnOk}">
                    <i data-lucide="send" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.registrar)}</span>
                </button>
            </div>`;
    }

    // La orden no mueve stock: solo se muestra lo que hay en el almacén elegido.
    stockCell(p) {
        if (!$(`#${this.opts.id}_selAlmacen`).val()) {
            return `<span class="text-[11px] text-gray-300" title="${this.esc(this.opts.labels.stockSinAlm)}">&mdash;</span>`;
        }
        const stock = Number(p.stock || 0);
        const color = stock === 0 ? 'text-red-500' : stock < 5 ? 'text-orange-500' : 'text-green-600';
        return `<strong class="text-[11px] ${color}">${this.fmtQty(stock)}</strong>`;
    }

    // -- Proveedor --

    syncProveedorVisibility() {}

    // -- Almacén --

    // Almacén opcional: sin sucursal se ofrecen todos.
    almacenOptions(branchId, selected) {
        const items = (this.opts.data.almacenes || []).filter(a =>
            !branchId || String(a.branch_id) === String(branchId)
        );
        return `<option value="">${this.esc(this.opts.labels.sinDefinir)}</option>`
            + items.map(it => this.optionTag(it, selected)).join('');
    }

    // -- Eventos --

    bindEvents() {
        super.bindEvents();
        const id = this.opts.id;

        // Sin comprobante: soltar un archivo no hace nada (y no abre el archivo en la pestaña).
        this.wrap.off('dragenter dragleave drop');
        this.wrap.on('drop', (e) => e.preventDefault());

        this.wrap.on('click', `#${id}_btnBorrador`, () => this.doRegistrar(false));
    }

    // -- Guardar --

    setMode(orden) {
        super.setMode(orden);
        $(`#${this.opts.id}_btnBorrador`).toggleClass('hidden', !!orden);
    }

    // submit = true envía a revisión (Solicitada); false la deja en Borrador.
    // Al editar no cambia el estado.
    doRegistrar(submit = true) {
        if (!this.lote.length) { this.notify('Agrega al menos un material a la orden'); return; }
        const o = this.opts;

        const fecha = $(`#${o.id}_inpFecha`).val();
        if (!fecha || fecha > this.hoy()) {
            this.notify(fecha ? o.labels.fechaFutura : o.labels.fechaReq);
            return;
        }

        const payload = {
            id:                    this.editing ? this.editing.id : null,
            submit:                !this.editing && submit,
            destination_branch_id: $(`#${o.id}_selSucursal`).val()  || '',
            warehouse_id:          $(`#${o.id}_selAlmacen`).val()   || '',
            supplier_id:           $(`#${o.id}_selProveedor`).val() || '',
            date_order:            fecha,
            note:                  $(`#${o.id}_inpNota`).val() || '',
            productos: this.lote.map(p => ({
                product_id:        p.id,
                quantity:          Number(p.cantidad || 0),
                cost:              Number(p.costo || 0),
                price_without_tax: Number(p.costoSinTax || 0),
                tax:               Number(p.tax || 0),
                unit_id:           p.unit_id || null
            }))
        };
        this.confirmRegistrar(payload);
    }

    confirmRegistrar(payload) {
        const o         = this.opts;
        const editing   = !!this.editing;
        const dia       = this.formatoDelDia();
        const chkId     = `${o.id}_chkFormatoDia`;
        const productos = this.lote.map(p => Object.assign({}, p));

        const title = editing ? o.labels.confirmEdit   : (payload.submit ? o.labels.confirmAdd   : o.labels.confirmDraft);
        const okLbl = editing ? o.labels.confirmEditOk : (payload.submit ? o.labels.confirmAddOk : o.labels.confirmDraftOk);

        const proceed = () => {
            const guardarDia = !!dia && $(`#${chkId}`).is(':checked');
            (editing ? o.onUpdate : o.onAdd)(payload);
            this.closeModal();
            if (guardarDia) this.storeFormato(dia, 'user', productos, true);
        };

        this.confirmBox(title, proceed, {
            type:       'confirm',
            okLabel:    okLbl,
            okIcon:     'check',
            focusOk:    true,
            detailHtml: dia ? `
                <label class="mt-3 pt-3 border-t border-gray-200 flex items-center justify-center gap-2 text-[12px] text-gray-600 cursor-pointer select-none">
                    <input id="${chkId}" type="checkbox" class="w-3.5 h-3.5 accent-blue-600">
                    ${this.esc(o.labels.guardarDia)} «${this.esc(dia)}»
                </label>` : ''
        });
    }
}


Templates.prototype.ordenForm = function (options) {
    const form = new OrdenForm(options);
    // Referencia al Templates para reutilizar componentes propios (alertBox).
    form.tpl = this;
    return form;
};
