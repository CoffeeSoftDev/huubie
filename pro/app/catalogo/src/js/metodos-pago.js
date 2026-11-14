// -- Pestaña Métodos de pago --
// Las globales (paymentMethods, dataInit) y los ayudantes (notify, afterSave, saveFrom) viven en catalogo.js.

class PaymentMethods extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'PaymentMethods';
        this.tab = 'paymentMethods';
    }

    // La página completa se recarga al cambiar de sucursal (App.onBranchChange).
    onBranchChange() {}

    render() {
        if ($('#filterBarPaymentMethods').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-paymentMethods').html(`
            <div id="filterBarPaymentMethods" class="mb-[8px]"></div>
            <div id="containerPaymentMethods"></div>
        `);
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarPaymentMethods',
            id: 'fbPaymentMethods',
            prefijo: 'pay_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    required: false,
                    class: 'col-12 col-lg-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'paymentMethods.ls()'
                },
                {
                    opc: 'button',
                    id: 'btnNewPaymentMethod',
                    class: 'col-12 col-lg-2',
                    text: 'Nuevo método',
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {

        this.createTable({
            parent: 'containerPaymentMethods',
            idFilterBar: 'filterBarPaymentMethods',
            data: { opc: 'lsPaymentMethods' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbPaymentMethods',
                theme: 'light',
                striped: true,
                center: [3, 4, 5, 6, 7, 8, 9]
            },
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    // -- Formulario --
    // Tres bloques: datos del método, cómo se ve en caja (icono y color) y cómo se comporta.

    jsonForm(row, options) {
        const data = {
            name: '', code: '', kind: '', icon: '', color: options.defaultColor,
            commission: 0, sort: 0, is_cash: 0, is_visible: 1, earns_points: 0,
            ...row
        };
        const third = 'w-full sm:w-1/3 cp-switch';

        return [
            this.formSection('pmSecDatos', 'Datos del método'),
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 50, ph: 'Ej. Vales de despensa', class: 'w-full sm:w-2/3', value: data.name },
            { id: 'code', lbl: 'Clave (opcional)', tipo: 'text', maxlength: 20, ph: 'Ej. VALES', class: 'w-full sm:w-1/3', value: data.code },
            { id: 'kind', lbl: 'Tipo', tipo: 'select', class: 'w-full sm:w-1/2', data: options.kinds, value: data.kind },
            { id: 'commission', lbl: 'Comisión (%)', tipo: 'number', min: 0, max: 100, step: '0.01', class: 'w-full sm:w-1/4', value: data.commission },
            { id: 'sort', lbl: 'Orden', tipo: 'number', min: 0, step: 1, class: 'w-full sm:w-1/4', value: data.sort },

            this.formSection('pmSecApariencia', 'Cómo se ve en caja'),
            { id: 'pmPreview', tipo: 'html', class: 'w-full', html: this.previewHtml() },
            { id: 'pmIcons', tipo: 'html', class: 'w-full', html: this.iconsHtml(options.icons, data.icon) },
            { id: 'color', lbl: 'Color', tipo: 'color', class: 'w-full sm:w-1/2', ph: options.defaultColor, value: data.color || options.defaultColor },
            { id: 'pmSwatches', tipo: 'html', class: 'w-full sm:w-1/2', html: this.swatchesHtml() },

            this.formSection('pmSecCaja', 'En la caja'),
            { id: 'is_cash', lbl: 'Es efectivo', tipo: 'switch', class: third, value: data.is_cash },
            { id: 'is_visible', lbl: 'Visible en caja', tipo: 'switch', class: third, value: data.is_visible },
            { id: 'earns_points', lbl: 'Acumula puntos', tipo: 'switch', class: third, value: data.earns_points }
        ];
    }

    // Título de sección: un bloque 'html' de csModal, no viaja en los values.
    formSection(id, text) {
        return { id, tipo: 'html', class: 'w-full cp-seccion', html: `<p>${esc(text)}</p>` };
    }

    // -- Icono y color --

    // Colores rápidos; el campo Color acepta cualquier otro.
    swatchColors() {
        return ['#16A34A', '#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#CA8A04', '#0891B2', '#64748B'];
    }

    previewHtml() {
        return ''
            + '<div class="cp-pm-muestra">'
            +   '<span class="cp-pm-badge cp-pm-badge--lg" id="pmPreviewBadge"></span>'
            +   '<div class="min-w-0">'
            +     '<div class="cp-celda-titulo" id="pmPreviewName"></div>'
            +     '<div class="cp-celda-sub">Así se verá en la caja</div>'
            +   '</div>'
            + '</div>';
    }

    // El SVG de cada icono lo arma el servidor (formOptions): mismo dibujo que la tabla.
    iconsHtml(icons, current) {
        const buttons = (icons || []).map((icon) => {
            const on = icon.id === current;

            return `<button type="button" class="cp-pm-icono${on ? ' is-active' : ''}" data-icon="${esc(icon.id)}"`
                 + ` aria-label="${esc(icon.valor)}" aria-pressed="${on}">${icon.svg}</button>`;
        }).join('');

        return ''
            + '<label class="block text-xs font-semibold text-gray-500 mb-1.5">Icono</label>'
            + `<div class="cp-pm-iconos" role="group" aria-label="Icono del método">${buttons}</div>`
            + '<p class="cp-pm-nota">Sin elegir, usa el de su tipo.</p>';
    }

    swatchesHtml() {
        const buttons = this.swatchColors().map((color) => {
            return `<button type="button" class="cp-pm-color" data-color="${color}" style="background-color:${color}" aria-label="Color ${color}"></button>`;
        }).join('');

        return ''
            + '<label class="block text-xs font-semibold text-gray-500 mb-1.5">Colores rápidos</label>'
            + `<div class="cp-pm-colores">${buttons}</div>`;
    }

    // Icono marcado en la rejilla, o '' (el servidor guarda NULL).
    pickedIcon() {
        return String($('#modalPaymentMethod .cp-pm-icono.is-active').data('icon') || '');
    }

    // Color válido del campo, o el gris por defecto mientras se teclea.
    currentColor(fallback) {
        const value = String($('#modalPaymentMethod #color').val() || '').trim();

        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value) ? hex6(value) : fallback;
    }

    // Repinta la muestra: nombre, icono (el elegido o el de su tipo) y color.
    paintPreview(options) {
        const modal = $('#modalPaymentMethod');
        const color = this.currentColor(options.defaultColor);
        const kind  = String(modal.find('#kind').val() || '');
        const name  = this.pickedIcon() || options.kindIcons[kind] || 'wallet';
        const icon  = (options.icons || []).find((i) => i.id === name);

        modal.find('.cs-modal-panel').css('--pm-color', color);
        modal.find('#pmPreviewBadge').html(icon ? icon.svg : '');
        modal.find('#pmPreviewName').text(String(modal.find('#name').val() || '').trim() || 'Nombre del método');
        modal.find('.cp-pm-color').each((i, el) => {
            $(el).toggleClass('is-active', hex6($(el).data('color')) === color);
        });
    }

    bindAppearance(options) {
        const modal   = $('#modalPaymentMethod');
        const repaint = () => this.paintPreview(options);

        // Un clic marca el icono; otro clic sobre el mismo lo quita (vuelve al de su tipo).
        modal.on('click', '.cp-pm-icono', (e) => {
            const button = $(e.currentTarget);
            const on     = !button.hasClass('is-active');

            modal.find('.cp-pm-icono').removeClass('is-active').attr('aria-pressed', 'false');
            button.toggleClass('is-active', on).attr('aria-pressed', String(on));
            repaint();
        });

        modal.on('click', '.cp-pm-color', (e) => {
            const color = String($(e.currentTarget).data('color')).toUpperCase();

            modal.find('#color').val(color);
            modal.find('#color__pick').val(hex6(color));
            repaint();
        });

        modal.on('input', '#name, #color, #color__pick', repaint);
        modal.on('change', '#kind', repaint);

        repaint();
    }

    async formOptions(keep_id = 0) {
        const options = await useFetch({ url: this._link, data: { opc: 'formOptions', keep_id } });

        if (!options || options.status != 200) {
            notify(options);
            return null;
        }

        return options;
    }

    async add() {
        const options = await this.formOptions();

        if (!options) return;

        this.csModal({
            id: 'modalPaymentMethod',
            title: 'Nuevo método de pago',
            subtitle: 'Forma de cobro para todas las sucursales de la empresa',
            lucideIcon: 'credit-card',
            json: this.jsonForm({}, options),
            onSave: (values, close) => this.save('addPaymentMethod', values, close)
        });

        this.bindAppearance(options);
    }

    async edit(id) {
        const [response, options] = await Promise.all([
            useFetch({ url: this._link, data: { opc: 'getPaymentMethod', id } }),
            this.formOptions(id)
        ]);

        if (!response || response.status != 200) return notify(response);
        if (!options) return;

        this.csModal({
            id: 'modalPaymentMethod',
            title: 'Editar método de pago',
            subtitle: 'Cambia los datos de esta forma de cobro',
            lucideIcon: 'credit-card',
            json: this.jsonForm(response.data, options),
            onSave: (values, close) => this.save('editPaymentMethod', { ...values, id }, close)
        });

        this.bindAppearance(options);
    }

    // Devuelve el primer problema del formulario, o '' si está bien.
    validate(values) {
        if (!String(values.name || '').trim()) return 'Escribe el nombre del método de pago.';

        const commission = Number(values.commission || 0);
        if (!(commission >= 0 && commission <= 100)) return 'La comisión debe ser un número de 0 a 100.';

        const sort = Number(values.sort || 0);
        if (!Number.isInteger(sort) || sort < 0) return 'El orden debe ser un número entero de 0 en adelante.';

        const color = String(values.color || '').trim();
        if (color !== '' && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)) return 'El color debe ir como #RRGGBB, por ejemplo #16A34A.';

        return '';
    }

    save(opc, values, close) {
        const problem = this.validate(values);

        if (problem) {
            warnBox(problem);
            return;
        }

        // El icono vive en la rejilla (no es un campo); el color corto #ABC se manda largo.
        const color = String(values.color || '').trim();
        const data  = { opc, ...values, icon: this.pickedIcon(), color: color === '' ? '' : hex6(color).toUpperCase() };

        return saveFrom('modalPaymentMethod', async () => {
            const response = await useFetch({ url: this._link, data });

            if (response && response.status == 200) {
                close();
                afterSave(response, () => this.ls());
            } else {
                notify(response);
            }
        });
    }

    status(id, active) {
        confirmSend(this, {
            title: active ? '¿Activar el método de pago?' : '¿Desactivar el método de pago?',
            text: active ? 'Volverá a estar disponible para cobrar.' : 'Dejará de estar disponible para cobrar. Los cobros ya registrados no cambian.',
            danger: !active,
            data: { opc: 'statusPaymentMethod', id, active },
            done: (response) => afterSave(response, () => this.ls())
        });
    }
}
