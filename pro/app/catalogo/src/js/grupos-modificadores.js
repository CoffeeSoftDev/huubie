// -- Grupos de modificadores --
// Ya no es pestaña: es la lista de la izquierda en la pestaña Modificadores.
// Al elegir un grupo, Modifiers pinta sus opciones a la derecha.
// Las globales (modifierGroups, modifiers, dataInit) y los ayudantes (notify, afterSave, saveFrom, esc) viven en catalogo.js.

class ModifierGroups extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'ModifierGroups';
        this.tab     = 'modifiers';
        this.groups  = [];
        this.groupId = 0;
    }

    // La página completa se recarga al cambiar de sucursal (App.onBranchChange).
    onBranchChange() {}

    // Modifiers.layout() ya pintó #filterBarModifierGroups y #modGroupList.
    mount() {
        this.filterBar();
        return this.loadList();
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterBarModifierGroups',
            id: 'fbModifierGroups',
            prefijo: 'mg_',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Grupos',
                    required: false,
                    class: 'col-6',
                    data: dataInit.statusFilter || [],
                    onchange: 'modifierGroups.loadList()'
                },
                {
                    opc: 'button',
                    id: 'btnNewModifierGroup',
                    class: 'col-6',
                    text: 'Nuevo grupo',
                    onClick: () => this.add()
                }
            ]
        });
    }

    // -- Lista --

    // Relee los grupos; se queda el elegido si sigue en la lista, si no el primero.
    async loadList() {
        const response = await useFetch({ url: this._link, data: { opc: 'lsModifierGroups', active: $('#mg_active').val() } });

        if (!response || response.status != 200) return notify(response);

        this.groups = response.groups || [];

        if (response.count !== undefined) this.csTabCount(this.tab, response.count);
        if (!this.groups.some((g) => g.id === this.groupId)) this.groupId = this.groups.length ? this.groups[0].id : 0;

        this.renderList();
        this.select(this.groupId);
    }

    renderList() {
        if (!this.groups.length) {
            const inactive = $('#mg_active').val() === '0';

            $('#modGroupList').html(`<p class="cp-mod-vacio">${inactive ? 'No hay grupos inactivos.' : 'Aún no hay grupos. Crea el primero con «Nuevo grupo».'}</p>`);
            return;
        }

        $('#modGroupList').html(this.groups.map((g) => `
            <button type="button" class="cp-mod-grupo" data-id="${g.id}" onclick="modifierGroups.select(${g.id})">
                <span class="cp-mod-grupo-nombre">${esc(g.name)}</span>
                <span class="cp-mod-grupo-meta">${g.multiple ? 'Elige varias' : 'Elige una'} · ${this.optionsText(g.modifiers)}</span>
                ${g.template ? '<span class="cp-chip bg-violet-50 text-violet-700">Plantilla</span>' : ''}
            </button>
        `).join(''));
    }

    optionsText(count) {
        return count === 1 ? '1 opción' : `${count} opciones`;
    }

    select(id) {
        const group = this.groups.find((g) => g.id === id) || null;

        this.groupId = group ? group.id : 0;

        $('#modGroupList .cp-mod-grupo').removeClass('is-active').filter(`[data-id="${this.groupId}"]`).addClass('is-active');

        this.renderHead(group);
        modifiers.openGroup(group);
    }

    // -- Encabezado del grupo elegido --

    renderHead(group) {
        if (!group) {
            $('#modGroupHead').html('');
            return;
        }

        const actions = group.template
            ? '<span class="cp-mod-candado"><i class="icon-lock"></i> Plantilla de Huubie · solo lectura</span>'
            : `<button type="button" class="cp-mod-accion" onclick="modifierGroups.edit(${group.id})"><i class="icon-pencil"></i> Editar grupo</button>
               <button type="button" class="cp-mod-accion${group.active ? ' is-danger' : ''}" onclick="modifierGroups.status(${group.id}, ${group.active ? 0 : 1})">
                   <i class="${group.active ? 'icon-toggle-on' : 'icon-toggle-off'}"></i> ${group.active ? 'Desactivar' : 'Activar'}
               </button>`;

        $('#modGroupHead').html(`
            <div class="cp-mod-head">
                <div class="min-w-0">
                    <h3 class="cp-mod-head-titulo">${esc(group.name)}</h3>
                    <p class="cp-mod-head-texto">${this.explain(group)}</p>
                </div>
                <div class="cp-mod-head-acciones">${actions}</div>
            </div>
        `);
    }

    // Lo que pasa al capturar el pedido, dicho como lo vive quien cobra.
    explain(group) {
        return group.multiple
            ? 'Al armar el pedido se eligen <b>varias</b> opciones, cada una con su cantidad. El precio se cobra <b>por pieza</b>.'
            : 'Al armar el pedido se elige <b>una sola</b> opción. Su precio se cobra <b>por porción</b>.';
    }

    // -- Formulario --

    jsonForm(row = {}) {
        return [
            { id: 'name', lbl: 'Nombre del grupo', tipo: 'text', required: true, maxlength: 100, ph: 'Ej. Relleno', class: 'w-full', value: row.name || '' },
            {
                id: 'is_extra',
                lbl: '¿Cuántas opciones se eligen al armar el pedido?',
                tipo: 'select',
                empty: false,
                class: 'w-full',
                data: [
                    { id: 0, valor: 'Una sola (ej. Relleno) · precio por porción' },
                    { id: 1, valor: 'Varias, con cantidad (ej. Decoraciones) · precio por pieza' }
                ],
                value: row.is_extra || 0
            }
        ];
    }

    add() {
        this.csModal({
            id: 'modalModifierGroup',
            title: 'Nuevo grupo',
            subtitle: 'Lo que se pregunta al armar el pedido: forma, relleno, decoraciones…',
            lucideIcon: 'layers',
            json: this.jsonForm(),
            onSave: (values, close) => this.save('addModifierGroup', values, close)
        });
    }

    async edit(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getModifierGroup', id } });

        if (!response || response.status != 200) return notify(response);

        this.csModal({
            id: 'modalModifierGroup',
            title: 'Editar grupo',
            subtitle: 'Cambia el nombre o cuántas opciones se eligen',
            lucideIcon: 'layers',
            json: this.jsonForm(response.data),
            onSave: (values, close) => this.save('editModifierGroup', { ...values, id }, close)
        });
    }

    save(opc, values, close) {
        if (!String(values.name || '').trim()) {
            warnBox('Escribe el nombre del grupo.');
            return;
        }

        return saveFrom('modalModifierGroup', async () => {
            const response = await useFetch({ url: this._link, data: { opc, ...values } });

            if (response && response.status == 200) {
                close();
                afterSave(response, () => this.loadList());
            } else {
                notify(response);
            }
        });
    }

    status(id, active) {
        confirmSend(this, {
            title: active ? '¿Activar el grupo?' : '¿Desactivar el grupo?',
            text: active ? 'Sus opciones volverán a ofrecerse.' : 'Sus opciones dejarán de ofrecerse. No se borran.',
            danger: !active,
            data: { opc: 'statusModifierGroup', id, active },
            done: (response) => afterSave(response, () => this.loadList())
        });
    }
}
