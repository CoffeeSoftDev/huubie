// -- Pestaña Modificadores --
// Las globales (modifiers, dataInit) y los ayudantes (notify, afterSave, saveFrom) viven en catalogo.js.

class Modifiers extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Modifiers';
        this.tab = 'modifiers';
        this.groups = [];
    }

    // La página completa se recarga al cambiar de sucursal (App.onBranchChange).
    onBranchChange() {}

    async render() {
        if ($('#filterBarModifiers').length) return;

        this.layout();
        await this.loadFilter();
        this.filterBar();
        this.ls();
    }

    // App la llama al volver a la pestaña: en Grupos pudieron crear o desactivar alguno.
    async reopen() {
        // render() sigue esperando las opciones: él termina de pintar.
        if (!$('#mod_active').length) return;

        const group  = $('#mod_modifier_group_id').val();
        const active = $('#mod_active').val();

        await this.loadFilter();
        this.filterBar();
        this.restoreFilter('mod_modifier_group_id', group);
        this.restoreFilter('mod_active', active);
        this.ls();
    }

    layout() {
        $('#container-modifiers').html(`
            <div id="filterBarModifiers" class="mb-[8px]"></div>
            <div id="containerModifiers"></div>
        `);
    }

    // -- Filtro --

    // Si la petición falla se quedan las opciones que ya había.
    async loadFilter() {
        const response = await useFetch({ url: this._link, data: { opc: 'init' } });

        if (response && response.status == 200) this.groups = response.groups || [];
    }

    // Si la opción ya no existe, el select se queda en la primera.
    restoreFilter(id, value) {
        const select = $(`#${id}`);

        if (select.find('option').filter((_, option) => option.value === value).length) select.val(value);
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarModifiers',
            id: 'fbModifiers',
            prefijo: 'mod_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'modifier_group_id',
                    lbl: 'Grupo',
                    required: false,
                    class: 'col-12 col-md-3',
                    data: [{ id: '', valor: 'Todos' }, ...this.groups],
                    onchange: 'modifiers.ls()'
                },
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    required: false,
                    class: 'col-12 col-md-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'modifiers.ls()'
                },
                {
                    opc: 'button',
                    id: 'btnNewModifier',
                    class: 'col-12 col-md-3 col-lg-2',
                    text: 'Nuevo modificador',
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: 'containerModifiers',
            idFilterBar: 'filterBarModifiers',
            data: { opc: 'lsModifiers' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbModifiers',
                theme: 'light',
                striped: true,
                right: [3, 4],
                center: [5]
            },
            success: (data) => {
                if (data && data.count !== undefined) this.csTabCount(this.tab, data.count);
            }
        });
    }

    // -- Formulario --

    jsonForm(groups, row = {}) {
        return [
            { id: 'modifier_group_id', lbl: 'Grupo', tipo: 'select', required: true, class: 'w-full', data: groups, value: row.modifier_group_id },
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 255, class: 'w-full', value: row.name || '' },
            { id: 'price', lbl: 'Precio extra', tipo: 'number', min: 0, step: '0.01', ph: '0.00', class: 'w-full sm:w-1/2', value: row.price },
            { id: 'quantity', lbl: 'Cantidad', tipo: 'number', min: 0, step: '0.001', ph: '0', class: 'w-full sm:w-1/2', value: row.quantity },
            { id: 'description', lbl: 'Descripción', tipo: 'textarea', rows: 2, maxlength: 255, class: 'w-full', value: row.description || '' }
        ];
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
        const groups = await this.groupOptions();

        if (!groups) return;

        if (!groups.length) {
            alert({ icon: 'info', text: 'Primero crea un grupo propio en la pestaña Grupos de modificadores.', btn1: true });
            return;
        }

        this.csModal({
            id: 'modalModifier',
            title: 'Nuevo modificador',
            subtitle: 'Una opción de un grupo, con su precio extra',
            lucideIcon: 'sliders-horizontal',
            json: this.jsonForm(groups),
            onSave: (values, close) => this.save('addModifier', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getModifier', id } });

        if (!response || response.status != 200) return notify(response);

        const groups = await this.groupOptions(response.data.modifier_group_id);

        if (!groups) return;

        this.csModal({
            id: 'modalModifier',
            title: 'Editar modificador',
            subtitle: 'Cambia sus datos o muévelo a otro grupo',
            lucideIcon: 'sliders-horizontal',
            json: this.jsonForm(groups, response.data),
            onSave: (values, close) => this.save('editModifier', { ...values, id }, close)
        });
    }

    // Vacío vale (se guarda 0); lo demás debe ser un número no negativo.
    badAmount(value) {
        return String(value).trim() !== '' && !(Number(value) >= 0);
    }

    save(opc, values, close) {
        const warn = (text) => alert({ icon: 'warning', text, btn1: true });

        if (!values.modifier_group_id) return warn('Elige el grupo del modificador.');
        if (!String(values.name || '').trim()) return warn('Escribe el nombre del modificador.');
        if (this.badAmount(values.price)) return warn('El precio extra debe ser un número mayor o igual a 0.');
        if (this.badAmount(values.quantity)) return warn('La cantidad debe ser un número mayor o igual a 0.');

        return saveFrom('modalModifier', async () => {
            const response = await useFetch({ url: this._link, data: { opc, ...values } });

            if (response && response.status == 200) {
                close();
                afterSave(response, () => this.ls());
            } else {
                notify(response);
            }
        });
    }

    status(id, active) {
        this.swalQuestion({
            opts: {
                title: active ? '¿Activar el modificador?' : '¿Desactivar el modificador?',
                text: active ? 'Volverá a ofrecerse.' : 'Dejará de ofrecerse. No se borra.'
            },
            data: { opc: 'statusModifier', id, active },
            methods: {
                send: (response) => afterSave(response, () => this.ls())
            }
        });
    }
}
