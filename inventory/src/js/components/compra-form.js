// Captura de una compra (rutina, programada o esporádica) con el formato de la
// orden (OrdenForm): mismo buscador, renglones, alta exprés y formatos. Cambia la
// configuración: tipo, nombre, fecha o días de la rutina, quién surte y de qué
// compra se copian los materiales. Requiere entrada-form.js y orden-form.js.
class CompraForm extends OrdenForm {

    constructor(options) {
        const o = options || {};
        super(Object.assign({}, o, {
            id:     o.id || 'compraFormModal',
            data:   Object.assign({ tipo: 'Esporadica', weekdays: [1], weeks: 4, compradores: [], plantillas: [] }, o.data || {}),
            labels: Object.assign({}, CompraForm.LABELS, o.labels || {})
        }));
    }

    static get LABELS() {
        return {
            title:         'Nueva compra',
            subtitle:      'Qué se compra, cuándo y quién surte',
            titleEdit:     'Editar compra',
            titleRetomar:  'Retomar',
            tipo:          'Tipo de compra',
            nombre:        'Nombre',
            nombrePh:      'Ej. Roscas de Reyes',
            surte:         'Quién surte',
            surtePh:       'Nombre de quien va a comprar',
            sucursal:      'Sucursal',
            almacen:       'Almacén destino',
            fecha:         'Fecha de compra',
            desde:         'Desde',
            dias:          'Días de compra',
            semanas:       'Programar',
            copiar:        'Copiar materiales de',
            copiarPh:      '-- Elegir compra anterior --',
            nota:          'Nota para quien surte (opcional)',
            productosLbl:  'Materiales a comprar',
            emptyTitle:    'Aún no agregas materiales',
            emptyHint:     'Búscalos arriba, carga un formato o copia los de una compra anterior',
            placeholder:   'Buscar materiales por nombre o SKU...',
            costoTotLbl:   'Estimado',
            registrar:     'Guardar compra',
            programar:     'Programar rutina',
            guardarEdit:   'Guardar cambios',
            confirmAdd:    '¿Guardar la compra?',
            confirmAddOk:  'Sí, guardar',
            confirmRutina: '¿Programar la rutina?',
            confirmEdit:   '¿Guardar los cambios de la compra?',
            confirmEditOk: 'Sí, guardar',
            nombreReq:     'Ponle un nombre a la compra',
            fechaReq:      'Elige la fecha de la compra',
            diasReq:       'Elige al menos un día de la semana',
            sinFechas:     'Con esos días no queda ninguna fecha',
            vacia:         'Agrega al menos un material a la compra',
            copiado:       'Materiales copiados de'
        };
    }

    static get TIPOS() {
        return [
            { id: 'Rutina',     valor: 'Rutina',     icon: 'repeat', hint: 'La compra de siempre, se repite' },
            { id: 'Programada', valor: 'Programada', icon: 'star',   hint: 'Anticipada para una fecha especial' },
            { id: 'Esporadica', valor: 'Esporádica', icon: 'zap',    hint: 'De una vez, cuando surge' }
        ];
    }

    static get DIAS() {
        return [
            { id: 1, valor: 'L', nombre: 'lun' }, { id: 2, valor: 'M', nombre: 'mar' }, { id: 3, valor: 'M', nombre: 'mié' },
            { id: 4, valor: 'J', nombre: 'jue' }, { id: 5, valor: 'V', nombre: 'vie' }, { id: 6, valor: 'S', nombre: 'sáb' },
            { id: 7, valor: 'D', nombre: 'dom' }
        ];
    }

    // -- Render estático --

    renderConfigRow() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60 space-y-3">
                <div>
                    <label class="${cls.label}">${this.esc(o.labels.tipo)}</label>
                    <div id="${o.id}_tipos" class="grid grid-cols-3 gap-2">
                        ${CompraForm.TIPOS.map(t => `
                            <button type="button" data-tipo="${t.id}" class="cf-tipo flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 border-gray-200 bg-white text-left transition-all hover:border-gray-300">
                                <span class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0"><i data-lucide="${t.icon}" class="w-4 h-4"></i></span>
                                <span class="min-w-0">
                                    <span class="block text-xs font-bold text-gray-800">${this.esc(t.valor)}</span>
                                    <span class="block text-[10px] text-gray-500 truncate">${this.esc(t.hint)}</span>
                                </span>
                            </button>`).join('')}
                    </div>
                </div>
                <div class="grid grid-cols-4 gap-3 items-end">
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.nombre)}</label>
                        <input id="${o.id}_inpNombre" type="text" maxlength="100" autocomplete="off" placeholder="${this.esc(o.labels.nombrePh)}" class="${cls.input}">
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.surte)}</label>
                        <input id="${o.id}_inpSurte" type="text" maxlength="100" list="${o.id}_compradores" autocomplete="off" placeholder="${this.esc(o.labels.surtePh)}" class="${cls.input}">
                        <datalist id="${o.id}_compradores">${(o.data.compradores || []).map(c => `<option value="${this.esc(c.valor)}"></option>`).join('')}</datalist>
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
                </div>
                <div class="grid grid-cols-4 gap-3 items-end">
                    <div>
                        <label id="${o.id}_lblFecha" class="${cls.label}">${this.esc(o.labels.fecha)}</label>
                        <input id="${o.id}_inpFecha" type="date" value="${this.esc(o.data.fecha)}" class="${cls.input}">
                    </div>
                    <div id="${o.id}_cellHint" class="col-span-2 pb-2.5">
                        <p id="${o.id}_hint" class="text-[11px] text-gray-500"></p>
                    </div>
                    <div id="${o.id}_cellDias" class="hidden">
                        <label class="${cls.label}">${this.esc(o.labels.dias)}</label>
                        <div class="flex gap-1">
                            ${CompraForm.DIAS.map(d => `<button type="button" data-dia="${d.id}" title="${d.nombre}" class="cf-dia flex-1 h-[38px] rounded-md border border-gray-300 bg-white text-xs font-bold text-gray-600 transition-all">${d.valor}</button>`).join('')}
                        </div>
                    </div>
                    <div id="${o.id}_cellSemanas" class="hidden">
                        <label class="${cls.label}">${this.esc(o.labels.semanas)}</label>
                        ${this.selectWrap(`
                            <select id="${o.id}_selSemanas" class="${cls.select}">
                                ${[2, 4, 8, 12].map(n => `<option value="${n}">Próximas ${n} semanas</option>`).join('')}
                            </select>
                        `)}
                    </div>
                    <div>
                        <label class="${cls.label}">${this.esc(o.labels.copiar)}</label>
                        ${this.selectWrap(`
                            <select id="${o.id}_selCopiar" class="${cls.select} !pl-10">
                                <option value="">${this.esc(o.labels.copiarPh)}</option>
                            </select>
                        `, 'copy')}
                    </div>
                </div>
                <p id="${o.id}_rutinaHint" class="hidden text-[11px] text-gray-500 -mt-1"></p>
            </div>`;
    }

    renderFooterActions() {
        const o   = this.opts;
        const cls = this.cls;
        return `
            <div class="flex gap-2 flex-shrink-0">
                <button class="${cls.btnOut}" data-modal-close>${this.esc(o.labels.cancelar)}</button>
                <button id="${o.id}_btnRegistrar" class="${cls.btnOk}">
                    <i data-lucide="calendar-check" class="w-3.5 h-3.5"></i><span>${this.esc(o.labels.registrar)}</span>
                </button>
            </div>`;
    }

    // -- Tipo y fechas --

    setTipo(tipo) {
        const o        = this.opts;
        const isRutina = tipo === 'Rutina' && !this.editing;
        const hints    = {
            Programada: 'Compra anticipada: imprime la hoja unos días antes de la fecha.',
            Esporadica: 'Para hoy o cuando surja. Si ya se compró, captúrala sin imprimir.',
            Rutina:     'Solo esta fecha de la rutina.'
        };
        o.data.tipo = tipo;

        $(`#${o.id}_tipos .cf-tipo`).each((i, el) => {
            const on = $(el).attr('data-tipo') === tipo;
            $(el).toggleClass('!border-blue-600 bg-blue-50', on).toggleClass('opacity-50', !!this.editing && !on);
        });
        $(`#${o.id}_lblFecha`).text(isRutina ? o.labels.desde : o.labels.fecha);
        $(`#${o.id}_cellHint`).toggleClass('hidden', isRutina);
        $(`#${o.id}_cellDias, #${o.id}_cellSemanas, #${o.id}_rutinaHint`).toggleClass('hidden', !isRutina);
        $(`#${o.id}_hint`).text(hints[tipo] || '');
        $(`#${o.id}_btnRegistrar span`).text(this.editing ? o.labels.guardarEdit : (isRutina ? o.labels.programar : o.labels.registrar));
        this.renderDias();
    }

    renderDias() {
        const o = this.opts;
        $(`#${o.id}_cellDias .cf-dia`).each((i, el) => {
            const on = o.data.weekdays.includes(Number($(el).attr('data-dia')));
            $(el).toggleClass('!bg-blue-600 !border-blue-600 !text-white', on);
        });

        const fechas = this.routineDates();
        $(`#${o.id}_rutinaHint`).html(fechas.length
            ? `Se crearán <b class="text-gray-700">${fechas.length}</b> compras: ${fechas.slice(0, 5).map(f => this.fmtDia(f)).join(', ')}${fechas.length > 5 ? '…' : ''}`
            : `<span class="text-amber-600">${this.esc(o.labels.sinFechas)}</span>`);
    }

    // Mismo cálculo que routineDates() del ctrl: 1 = lunes ... 7 = domingo.
    routineDates() {
        const o      = this.opts;
        const desde  = $(`#${o.id}_inpFecha`).val();
        const weeks  = Number($(`#${o.id}_selSemanas`).val() || o.data.weeks);
        const fechas = [];
        if (!desde) return fechas;
        for (let i = 0; i < weeks * 7; i++) {
            const dia = moment(desde).add(i, 'days');
            if (o.data.weekdays.includes(dia.isoWeekday())) fechas.push(dia.format('YYYY-MM-DD'));
        }
        return fechas;
    }

    // moment se carga sin el idioma español: "jue 08 oct".
    fmtDia(fecha) {
        const d     = moment(fecha);
        const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        return `${CompraForm.DIAS[d.isoWeekday() - 1].nombre} ${d.format('DD')} ${meses[d.month()]}`;
    }

    toggleDia(dia) {
        const dias = this.opts.data.weekdays;
        const idx  = dias.indexOf(dia);
        if (idx >= 0) dias.splice(idx, 1);
        else          dias.push(dia);
        dias.sort();
        this.renderDias();
    }

    // -- Copiar de una compra anterior --

    setPlantillas(plantillas) {
        const o = this.opts;
        o.data.plantillas = plantillas || [];
        $(`#${o.id}_selCopiar`).html(
            `<option value="">${this.esc(o.labels.copiarPh)}</option>` + o.data.plantillas.map(it => this.optionTag(it)).join('')
        );
    }

    copyFrom(id) {
        if (!id || typeof this.opts.onCopy !== 'function') return;
        this.opts.onCopy(id, (compra, productos) => {
            this.lote  = productos.map(p => Object.assign({}, p, { stock: this.stockOf(p.id) }));
            this.draft = null;
            if (!$(`#${this.opts.id}_inpNombre`).val()) $(`#${this.opts.id}_inpNombre`).val(compra.name || '');
            this.renderLote();
            this.notify(`${this.opts.labels.copiado} ${compra.folio}`, 'success');
        });
    }

    // -- Eventos --

    bindEvents() {
        super.bindEvents();
        const id = this.opts.id;

        this.wrap.on('click', `#${id}_tipos .cf-tipo`, (e) => {
            if (!this.editing) this.setTipo($(e.currentTarget).attr('data-tipo'));
        });
        this.wrap.on('click', `#${id}_cellDias .cf-dia`, (e) => this.toggleDia(Number($(e.currentTarget).attr('data-dia'))));
        this.wrap.on('change', `#${id}_inpFecha, #${id}_selSemanas`, () => this.renderDias());
        this.wrap.on('change', `#${id}_selCopiar`, (e) => this.copyFrom(e.target.value));
    }

    // -- API pública --

    // Alta, edición o retomar: `compra` trae lo que va en la configuración y el lote.
    openCompra(compra) {
        const o  = this.opts;
        const id = o.id;
        const c  = Object.assign({ tipo: 'Esporadica', fecha: this.hoy(), weekdays: [moment().isoWeekday()], productos: [] }, compra || {});

        this.setMode(c.id ? c : null);
        o.data.weekdays = (c.weekdays || []).map(Number);

        $(`#${id}_title`).text(c.id ? `${o.labels.titleEdit} ${c.folio}` : (c.origen ? `${o.labels.titleRetomar} ${c.origen}` : o.labels.title));
        $(`#${id}_compradores`).html((o.data.compradores || []).map(x => `<option value="${this.esc(x.valor)}"></option>`).join(''));
        $(`#${id}_inpNombre`).val(c.nombre || '');
        $(`#${id}_inpSurte`).val(c.surte || '');
        $(`#${id}_selSucursal`).val(String(c.branch_id || o.data.branch_id || ''));
        this.refreshAlmacenes($(`#${id}_selSucursal`).val());
        if (c.warehouse_id) $(`#${id}_selAlmacen`).val(String(c.warehouse_id));
        $(`#${id}_inpFecha`).val(c.fecha);
        $(`#${id}_selSemanas`).val(String(o.data.weeks));
        $(`#${id}_selCopiar`).val('');
        $(`#${id}_inpNota`).val(c.nota || '');

        this.origen = c.origen_id || null;
        this.lote   = (c.productos || []).map(p => Object.assign({}, p));
        this.draft  = null;
        this.resetSearchState();
        this.setTipo(c.tipo);

        this.wrap.removeClass('hidden');
        this.refreshFormatos();
        this.renderLote();
        this.reloadStock($(`#${id}_selAlmacen`).val());
        setTimeout(() => $(`#${id}_inpNombre`).trigger('focus'), 50);
    }

    // -- Guardar --

    doRegistrar() {
        const o        = this.opts;
        const tipo     = o.data.tipo;
        const isRutina = tipo === 'Rutina' && !this.editing;
        const nombre   = $.trim($(`#${o.id}_inpNombre`).val());
        const fecha    = $(`#${o.id}_inpFecha`).val();

        if (!nombre)                          { this.notify(o.labels.nombreReq); $(`#${o.id}_inpNombre`).focus(); return; }
        if (!fecha)                           { this.notify(o.labels.fechaReq); return; }
        if (isRutina && !o.data.weekdays.length) { this.notify(o.labels.diasReq); return; }
        if (isRutina && !this.routineDates().length) { this.notify(o.labels.sinFechas); return; }
        if (!this.lote.length)                { this.notify(o.labels.vacia); return; }

        const payload = {
            id:                       this.editing ? this.editing.id : null,
            purchase_type:            tipo,
            name:                     nombre,
            date_order:               fecha,
            weekdays:                 o.data.weekdays,
            weeks:                    Number($(`#${o.id}_selSemanas`).val() || 4),
            branch_id:                $(`#${o.id}_selSucursal`).val() || '',
            warehouse_id:             $(`#${o.id}_selAlmacen`).val() || '',
            buyer_name:               $.trim($(`#${o.id}_inpSurte`).val()),
            origin_purchase_order_id: this.origen || '',
            note:                     $(`#${o.id}_inpNota`).val() || '',
            productos: this.lote.map(p => ({
                product_id:        p.id,
                quantity:          Number(p.cantidad || 0),
                cost:              Number(p.costo || 0),
                price_without_tax: Number(p.costoSinTax || 0),
                tax:               Number(p.tax || 0),
                unit_id:           p.unit_id || null
            }))
        };

        const title = this.editing ? o.labels.confirmEdit : (isRutina ? o.labels.confirmRutina : o.labels.confirmAdd);
        this.confirmBox(title, () => {
            (this.editing ? o.onUpdate : o.onAdd)(payload);
            this.closeModal();
        }, {
            type:       'confirm',
            okLabel:    this.editing ? o.labels.confirmEditOk : o.labels.confirmAddOk,
            okIcon:     'check',
            focusOk:    true,
            detailHtml: isRutina ? `Se crearán ${this.routineDates().length} compras, una por cada fecha.` : ''
        });
    }
}


Templates.prototype.compraForm = function (options) {
    const form = new CompraForm(options);
    // Referencia al Templates para reutilizar componentes propios (alertBox).
    form.tpl = this;
    return form;
};
