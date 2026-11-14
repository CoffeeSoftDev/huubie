// -- Pestaña Modificadores --
// Una sola pantalla: a la izquierda los grupos (ModifierGroups, en grupos-modificadores.js)
// y a la derecha las opciones del grupo elegido.
// Las globales (modifiers, modifierGroups, dataInit) y los ayudantes (notify, afterSave, saveFrom, esc) viven en catalogo.js.

class Modifiers extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Modifiers';
        this.tab   = 'modifiers';
        this.group = null;
    }

    // La página completa se recarga al cambiar de sucursal (App.onBranchChange).
    onBranchChange() {}

    render() {
        if ($('#modGroupList').length) return;

        this.layout();
        modifierGroups.mount();
    }

    // App la llama al volver a la pestaña: relee los grupos y el grupo elegido.
    reopen() {
        if (!$('#modGroupList').length) return;

        modifierGroups.loadList();
    }

    // La explicación vive tras el ícono de info: sale al pasar el mouse o al tocarlo.
    layout() {
        $('#container-modifiers').html(`
            <div class="cp-mod-info">
                <button type="button" class="cp-info-btn" aria-describedby="modInfoPop">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    <span>¿Qué es un grupo de modificadores?</span>
                </button>
                <div id="modInfoPop" class="cp-info-pop" role="tooltip">
                    <p><b>Grupo</b>: lo que se pregunta al armar el pedido. Ej.: Forma, Relleno, Decoraciones.</p>
                    <p><b>Opciones</b>: lo que el cliente elige dentro del grupo. Ej.: Redonda, Chocolate, Flores.</p>
                </div>
            </div>
            <div class="cp-mod">
                <aside class="cp-mod-grupos">
                    <div id="filterBarModifierGroups"></div>
                    <div id="modGroupList" class="cp-mod-lista"></div>
                </aside>
                <section class="cp-mod-detalle">
                    <div id="modGroupHead"></div>
                    <div id="filterBarModifiers" class="mb-[8px]"></div>
                    <div id="containerModifiers"></div>
                </section>
            </div>
        `);
    }

    // ModifierGroups la llama al elegir un grupo (null = no hay grupo que mostrar).
    openGroup(group) {
        this.group = group;

        if (!group) {
            $('#filterBarModifiers').html('');
            $('#containerModifiers').html('<p class="cp-mod-vacio">Elige o crea un grupo para ver sus opciones.</p>');
            return;
        }

        const active = $('#mod_active').val();

        this.filterBar();
        if (active !== undefined) this.restoreFilter('mod_active', active);
        this.ls();
    }

    // -- Filtro --

    // «Nueva opción» solo en grupos propios y activos: a una plantilla o a un grupo inactivo no se le agregan.
    filterBar() {
        const data = [
            {
                opc: 'select',
                id: 'active',
                lbl: 'Opciones',
                required: false,
                class: 'col-6 col-lg-2',
                data: dataInit.statusFilter || [],
                onchange: 'modifiers.ls()'
            }
        ];

        if (!this.group.template && this.group.active) {
            data.push({
                opc: 'button',
                id: 'btnNewModifier',
                class: 'col-6 col-lg-2',
                text: 'Nueva opción',
                onClick: () => this.add()
            });
        }

        this.createfilterBar({
            parent: 'filterBarModifiers',
            id: 'fbModifiers',
            prefijo: 'mod_',
            coffeesoft: true,
            data
        });
    }

    // Si la opción ya no existe, el select se queda en la primera.
    restoreFilter(id, value) {
        const select = $(`#${id}`);

        if (select.find('option').filter((_, option) => option.value === value).length) select.val(value);
    }

    ls() {
        if (!this.group) return;


        this.createTable({
            parent: 'containerModifiers',
            idFilterBar: 'filterBarModifiers',
            data: { opc: 'lsModifiers', modifier_group_id: this.group.id },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbModifiers',
                theme: 'light',
                striped: true,
                right: [2],
                center: [3]
            }
        });
    }

    // -- Formulario --

    // El precio se lee distinto según el grupo: una sola = por porción; varias = por pieza.
    priceLabel(group) {
        return group && group.multiple ? 'Precio por pieza' : 'Precio por porción';
    }

    jsonForm(groups, row = {}) {
        const group = groups.find((g) => String(g.id) === String(row.modifier_group_id));

        return [
            { id: 'modifier_group_id', lbl: 'Grupo', tipo: 'select', required: true, empty: false, class: 'w-full', data: groups, value: row.modifier_group_id },
            { id: 'name', lbl: 'Nombre de la opción', tipo: 'text', required: true, maxlength: 255, ph: 'Ej. Chocolate', class: 'w-full', value: row.name || '' },
            { id: 'price', lbl: this.priceLabel(group), tipo: 'number', min: 0, step: '0.01', ph: '0.00', help: 'Déjalo en 0 si no cuesta extra.', class: 'w-full sm:w-1/2', value: row.price },
            { id: 'description', lbl: 'Descripción (opcional)', tipo: 'textarea', rows: 2, maxlength: 255, class: 'w-full', value: row.description || '' }
        ];
    }

    // Al cambiar de grupo en el modal, la etiqueta del precio lo sigue.
    bindPriceLabel(groups) {
        $('#modalModifier').on('change', '#modifier_group_id', (e) => {
            const group = groups.find((g) => String(g.id) === String($(e.currentTarget).val()));

            $('#modalModifier label[for="price"]').text(this.priceLabel(group));
        });
    }

    // Grupos propios para el modal, o null si la petición falló (ya avisó).
    async groupOptions(keep_id = 0) {
        const response = await useFetch({ url: this._link, data: { opc: 'formOptions', keep_id } });

        if (!response || response.status != 200) {
            notify(response);
            return null;
        }

        return response.groups || [];
    }

    async add() {
        if (!this.group || this.group.template) return;

        const groups = await this.groupOptions();

        if (!groups) return;

        this.csModal({
            id: 'modalModifier',
            title: 'Nueva opción',
            subtitle: `Se agrega al grupo ${this.group.name}`,
            lucideIcon: 'sliders-horizontal',
            json: this.jsonForm(groups, { modifier_group_id: this.group.id }),
            onSave: (values, close) => this.save('addModifier', values, close)
        });

        this.bindPriceLabel(groups);
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getModifier', id } });

        if (!response || response.status != 200) return notify(response);

        const groups = await this.groupOptions(response.data.modifier_group_id);

        if (!groups) return;

        this.csModal({
            id: 'modalModifier',
            title: 'Editar opción',
            subtitle: 'Cambia sus datos o muévela a otro grupo',
            lucideIcon: 'sliders-horizontal',
            json: this.jsonForm(groups, response.data),
            onSave: (values, close) => this.save('editModifier', { ...values, id }, close)
        });

        this.bindPriceLabel(groups);
    }

    // Vacío vale (se guarda 0); lo demás debe ser un número no negativo.
    badAmount(value) {
        return String(value).trim() !== '' && !(Number(value) >= 0);
    }

    save(opc, values, close) {
        const warn = (text) => warnBox(text);

        if (!values.modifier_group_id) return warn('Elige el grupo de la opción.');
        if (!String(values.name || '').trim()) return warn('Escribe el nombre de la opción.');
        if (this.badAmount(values.price)) return warn('El precio debe ser un número mayor o igual a 0.');

        return saveFrom('modalModifier', async () => {
            const response = await useFetch({ url: this._link, data: { opc, ...values } });

            if (response && response.status == 200) {
                close();
                // La lista de grupos lleva el conteo de opciones: se relee junto con la tabla.
                afterSave(response, () => modifierGroups.loadList());
            } else {
                notify(response);
            }
        });
    }

    status(id, active) {
        confirmSend(this, {
            title: active ? '¿Activar la opción?' : '¿Desactivar la opción?',
            text: active ? 'Volverá a ofrecerse.' : 'Dejará de ofrecerse. No se borra.',
            danger: !active,
            data: { opc: 'statusModifier', id, active },
            done: (response) => afterSave(response, () => modifierGroups.loadList())
        });
    }
}
