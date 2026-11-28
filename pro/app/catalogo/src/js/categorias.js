// -- Pestaña Categorías --
// Las globales (categories, dataInit) y los ayudantes (notify, afterSave, saveFrom) viven en catalogo.js.

class Categories extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Categories';
        this.tab = 'categories';
    }

    // La pagina completa se recarga al cambiar de sucursal (App.onBranchChange).
    onBranchChange() {}

    render() {
        if ($('#filterBarCategories').length) return;

        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        $('#container-categories').html(`
            <div id="filterBarCategories" class="mb-[8px]"></div>
            <div id="containerCategories"></div>
        `);
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarCategories',
            id: 'fbCategories',
            prefijo: 'cat_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    required: false,
                    class: 'col-12 col-lg-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'categories.ls()'
                },
                {
                    opc: 'button',
                    id: 'btnNewCategory',
                    class: 'col-12 col-lg-2',
                    text: 'Nueva categoría',
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {

        this.createTable({
            parent: 'containerCategories',
            idFilterBar: 'filterBarCategories',
            data: { opc: 'lsCategories' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbCategories',
                theme: 'light',
                f_size: 12,
                design: 'flowbite',
                striped: true,
                center: [3, 4, 5]
            },
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    // -- Formulario --
    // Datos de la categoría y el ícono que se ve en el POS (Ventas, pedidos y tienda en línea).

    jsonForm(row, options) {
        const data = { name: '', description: '', icon: '', ...row };

        return [
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 255, class: 'w-full', value: data.name },
            { id: 'description', lbl: 'Descripción', tipo: 'textarea', rows: 3, maxlength: 1000, class: 'w-full', value: data.description },
            { id: 'catSecIcon', tipo: 'html', class: 'w-full cp-seccion', html: '<p>Cómo se ve en el POS</p>' },
            { id: 'catPreview', tipo: 'html', class: 'w-full', html: this.previewHtml() },
            { id: 'catIcons', tipo: 'html', class: 'w-full', html: this.iconsHtml(options.icons, data.icon) }
        ];
    }

    // -- Ícono --

    previewHtml() {
        return ''
            + '<div class="cp-pm-muestra">'
            +   '<span class="cp-pm-badge cp-pm-badge--lg cp-cat-badge" id="catPreviewBadge"></span>'
            +   '<div class="min-w-0">'
            +     '<div class="cp-celda-titulo" id="catPreviewName"></div>'
            +     '<div class="cp-celda-sub" id="catPreviewNote"></div>'
            +   '</div>'
            + '</div>';
    }

    // El SVG de cada ícono lo arma el servidor (formOptions): mismo dibujo que la tabla.
    iconsHtml(icons, current) {
        const buttons = (icons || []).map((icon) => {
            const on = icon.id === current;

            return `<button type="button" class="cp-pm-icono${on ? ' is-active' : ''}" data-icon="${esc(icon.id)}"`
                 + ` title="${esc(icon.valor)}" aria-label="${esc(icon.valor)}" aria-pressed="${on}">${icon.svg}</button>`;
        }).join('');

        return ''
            + '<label class="block text-xs font-semibold text-gray-500 mb-1.5">Ícono</label>'
            + `<div class="cp-pm-iconos" role="group" aria-label="Ícono de la categoría">${buttons}</div>`
            + '<p class="cp-pm-nota">Sin elegir, el POS pone uno según el nombre. Otro clic sobre el elegido lo quita.</p>';
    }

    // Ícono marcado en la rejilla, o '' (el servidor guarda NULL = automático).
    pickedIcon() {
        return String($('#modalCategory .cp-pm-icono.is-active').data('icon') || '');
    }

    // El automático: mismas reglas que el POS (OrderForm.categoryIcon), mandadas por el servidor.
    autoIcon(name, options) {
        const text = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const rule = (options.autoRules || []).find((r) => new RegExp(r.pattern).test(text));

        return rule ? rule.icon : options.autoDefault;
    }

    paintPreview(options) {
        const modal  = $('#modalCategory');
        const name   = String(modal.find('#name').val() || '').trim();
        const picked = this.pickedIcon();
        const show   = picked || this.autoIcon(name, options);
        const icon   = (options.icons || []).find((i) => i.id === show);

        modal.find('#catPreviewBadge').html(icon ? icon.svg : '').toggleClass('is-chosen', picked !== '');
        modal.find('#catPreviewName').text(name || 'Nombre de la categoría');
        modal.find('#catPreviewNote').text(picked ? 'Ícono elegido' : 'Automático, según el nombre');
    }

    // Un clic marca el ícono; otro clic sobre el mismo lo quita (vuelve al automático).
    bindIcon(options) {
        const modal   = $('#modalCategory');
        const repaint = () => this.paintPreview(options);

        modal.on('click', '.cp-pm-icono', (e) => {
            const button = $(e.currentTarget);
            const on     = !button.hasClass('is-active');

            modal.find('.cp-pm-icono').removeClass('is-active').attr('aria-pressed', 'false');
            button.toggleClass('is-active', on).attr('aria-pressed', String(on));
            repaint();
        });

        modal.on('input', '#name', repaint);

        repaint();
    }

    async formOptions() {
        const options = await useFetch({ url: this._link, data: { opc: 'formOptions' } });

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
            id: 'modalCategory',
            title: 'Nueva categoría',
            subtitle: 'Agrupa los productos de esta sucursal',
            lucideIcon: 'folder-plus',
            json: this.jsonForm({}, options),
            onSave: (values, close) => this.save('addCategory', values, close)
        });

        this.bindIcon(options);
    }

    async edit(id) {
        const [response, options] = await Promise.all([
            useFetch({ url: this._link, data: { opc: 'getCategory', id } }),
            this.formOptions()
        ]);

        if (!response || response.status != 200) return notify(response);
        if (!options) return;

        this.csModal({
            id: 'modalCategory',
            title: 'Editar categoría',
            subtitle: 'Cambia el nombre, la descripción o el ícono',
            lucideIcon: 'folder-pen',
            json: this.jsonForm(response.data, options),
            onSave: (values, close) => this.save('editCategory', { ...values, id }, close)
        });

        this.bindIcon(options);
    }

    save(opc, values, close) {
        if (!String(values.name || '').trim()) {
            warnBox('Escribe el nombre de la categoría.');
            return;
        }

        // El ícono vive en la rejilla (no es un campo del formulario).
        const data = { opc, ...values, icon: this.pickedIcon() };

        return saveFrom('modalCategory', async () => {
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
            title: active ? '¿Activar la categoría?' : '¿Desactivar la categoría?',
            text: active ? 'Volverá a aparecer en los formularios.' : 'Dejará de aparecer en los formularios. Sus productos no se borran.',
            danger: !active,
            data: { opc: 'statusCategory', id, active },
            done: (response) => afterSave(response, () => this.ls())
        });
    }
}
