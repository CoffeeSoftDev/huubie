let apiComp = 'ctrl/ctrl-complementos.php';
let comp;
let compTables = [];
let compLoyaltyConfig = null;

$(async () => {
    const req = await useFetch({ url: apiComp, data: { opc: "init" } });
    compTables        = req.tables || [];
    compLoyaltyConfig = req.loyalty_config;

    comp = new ComplementosApp(apiComp, 'root');
});

class ComplementosApp extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Complementos";
    }

    // === MESAS ===

    async renderMesas() {
        const data = await useFetch({ url: this._link, data: { opc: 'lsTables' } });
        compTables = data.tables || [];

        const container = $('#container-mesas');
        if (!container.length) return;

        let html = `
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-white font-bold">Mesas / Zonas</h3>
                <button class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold" onclick="comp.addTable()">
                    <i class="icon-plus"></i> Nueva Mesa
                </button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3" id="mesasGrid">
        `;

        compTables.forEach(t => {
            const statusConfig = {
                'libre':     { bg: 'bg-green-900/30', border: 'border-green-500', text: 'text-green-400', label: 'Libre' },
                'ocupada':   { bg: 'bg-red-900/30', border: 'border-red-500', text: 'text-red-400', label: 'Ocupada' },
                'reservada': { bg: 'bg-yellow-900/30', border: 'border-yellow-500', text: 'text-yellow-400', label: 'Reservada' },
                'cuenta':    { bg: 'bg-blue-900/30', border: 'border-blue-500', text: 'text-blue-400', label: 'Pidiendo cuenta' },
            };
            const sc = statusConfig[t.status] || statusConfig['libre'];

            html += `
                <div class="bg-[#1F2A37] rounded-xl border-2 ${sc.border} p-4 text-center cursor-pointer hover:opacity-80 transition-all"
                     onclick="comp.showTableDetail(${t.id})">
                    <div class="text-3xl mb-2"><i class="icon-food ${sc.text}"></i></div>
                    <h4 class="text-white font-bold text-sm">${t.name}</h4>
                    <p class="text-gray-400 text-xs">${t.zone || ''}</p>
                    <p class="text-xs ${sc.text} font-semibold mt-1">${sc.label}</p>
                    ${t.capacity ? `<p class="text-gray-500 text-xs"><i class="icon-users"></i> ${t.capacity}</p>` : ''}
                    ${parseFloat(t.order_total) > 0 ? `<p class="text-white text-sm font-bold mt-1">${formatPrice(t.order_total)}</p>` : ''}
                </div>
            `;
        });

        html += '</div>';
        container.html(html);
    }

    addTable() {
        this.createModalForm({
            id: 'formAddTable',
            data: { opc: 'addTable' },
            bootbox: { title: 'Nueva Mesa' },
            json: this.jsonTable(),
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", text: response.message, btn1: true });
                    this.renderMesas();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true });
                }
            }
        });
    }

    async editMesa(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getTable", id } });

        if (request.status !== 200) {
            alert({ icon: "error", text: request.message, btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formEditTable',
            data: { opc: 'editTable', id },
            bootbox: { title: 'Editar Mesa' },
            autofill: request.data,
            json: this.jsonTable(),
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", text: response.message, btn1: true });
                    this.renderMesas();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true });
                }
            }
        });
    }

    deleteMesa(id) {
        this.swalQuestion({
            opts: { title: 'Eliminar mesa?', text: 'Esta accion no se puede deshacer', icon: 'warning' },
            data: { opc: 'deleteTable', id: id },
            methods: {
                request: () => {
                    alert({ icon: "success", text: "Mesa eliminada", timer: 1500 });
                    this.renderMesas();
                }
            }
        });
    }

    async showTableDetail(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getTable", id } });
        if (request.status !== 200) return;

        const t = request.data;
        const statusOptions = ['libre', 'ocupada', 'reservada', 'cuenta'];

        bootbox.dialog({
            title: `<div class="text-white"><i class="icon-food"></i> ${t.name}</div>`,
            message: `
                <div class="space-y-3">
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div><span class="text-gray-400">Zona:</span> <span class="text-white">${t.zone || '-'}</span></div>
                        <div><span class="text-gray-400">Capacidad:</span> <span class="text-white">${t.capacity}</span></div>
                        <div><span class="text-gray-400">Estado:</span> <span class="text-white">${t.status}</span></div>
                        <div><span class="text-gray-400">Orden:</span> <span class="text-white">${t.current_order_id || 'Sin orden'}</span></div>
                    </div>
                    <div class="flex gap-2 mt-3">
                        ${statusOptions.map(s => `
                            <button class="flex-1 ${s === t.status ? 'bg-blue-600' : 'bg-[#283341] hover:bg-gray-700'} text-white py-2 rounded-lg text-xs font-semibold"
                                onclick="comp.changeTableStatus(${id}, '${s}')">
                                ${s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        `).join('')}
                    </div>
                    <div class="flex gap-2">
                        <button class="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-semibold" onclick="comp.editMesa(${id})">
                            <i class="icon-pencil"></i> Editar
                        </button>
                        <button class="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-semibold" onclick="comp.deleteMesa(${id})">
                            <i class="icon-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            `,
            closeButton: true,
            className: 'modal-table-detail'
        });
    }

    async changeTableStatus(id, newStatus) {
        await useFetch({
            url: this._link,
            data: { opc: 'statusTable', id: id, status: newStatus, order_id: newStatus === 'libre' ? 0 : null }
        });
        bootbox.hideAll();
        this.renderMesas();
    }

    jsonTable() {
        return [
            { opc: "input", id: "name", lbl: "Nombre de la mesa", class: "col-12 col-md-6 mb-3" },
            { opc: "input", id: "capacity", lbl: "Capacidad (personas)", tipo: "numero", class: "col-12 col-md-6 mb-3" },
            { opc: "select", id: "zone", lbl: "Zona", class: "col-12 col-md-6 mb-3", data: [
                { id: 'interior', valor: 'Interior' },
                { id: 'terraza', valor: 'Terraza' },
                { id: 'barra', valor: 'Barra' },
                { id: 'vip', valor: 'VIP' },
            ]},
            { opc: "btn-submit", text: "Guardar", class: "col-12" }
        ];
    }

    // === LEALTAD ===

    renderLealtad() {
        const container = $('#container-lealtad');
        if (!container.length) return;

        container.html(`
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <div class="bg-[#1F2A37] rounded-lg p-4 mb-4">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="text-white font-bold">Configuracion de Lealtad</h3>
                            <button class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm" onclick="comp.editLoyaltyConfig()">
                                <i class="icon-cog"></i> Configurar
                            </button>
                        </div>
                        <div id="loyaltyConfigInfo" class="text-sm text-gray-300">
                            ${compLoyaltyConfig ? `
                                <p>Puntos por peso: <span class="text-white font-bold">${compLoyaltyConfig.points_per_peso}</span></p>
                                <p>Valor del punto: <span class="text-white font-bold">$${compLoyaltyConfig.peso_per_point}</span></p>
                                <p>Min. para canjear: <span class="text-white font-bold">${compLoyaltyConfig.min_points_redeem} pts</span></p>
                            ` : '<p class="text-yellow-400">Sin configuracion. Configura el programa de lealtad.</p>'}
                        </div>
                    </div>
                    <div id="tableLoyaltyClients"></div>
                </div>
                <div id="tableLoyaltyTransactions"></div>
            </div>
        `);

        this.lsLoyaltyClients();
        this.lsLoyaltyTransactions();
    }

    editLoyaltyConfig() {
        this.createModalForm({
            id: 'formLoyaltyConfig',
            data: { opc: 'editLoyaltyConfig' },
            bootbox: { title: 'Configuracion de Lealtad' },
            autofill: compLoyaltyConfig || {},
            json: [
                { opc: "input", id: "points_per_peso", lbl: "Puntos por cada $1 gastado", tipo: "numero", class: "col-12 mb-3" },
                { opc: "input", id: "peso_per_point", lbl: "Valor en $ de cada punto", tipo: "cifra", class: "col-12 mb-3" },
                { opc: "input", id: "min_points_redeem", lbl: "Puntos minimos para canjear", tipo: "numero", class: "col-12 mb-3" },
                { opc: "btn-submit", text: "Guardar", class: "col-12" }
            ],
            success: async (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", text: response.message, btn1: true });
                    const req = await useFetch({ url: this._link, data: { opc: "init" } });
                    compLoyaltyConfig = req.loyalty_config;
                    this.renderLealtad();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true });
                }
            }
        });
    }

    lsLoyaltyClients() {
        this.createTable({
            parent: 'tableLoyaltyClients',
            idFilterBar: `filterBar${this.PROJECT_NAME}`,

            data: { opc: 'lsLoyaltyClients' },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: 'tbLoyaltyClients',
                theme: 'dark',
                title: 'Clientes con Puntos',
                center: [2, 3, 4],
            }
        });
    }

    lsLoyaltyTransactions() {
        this.createTable({
            parent: 'tableLoyaltyTransactions',
            idFilterBar: `filterBar${this.PROJECT_NAME}`,

            data: { opc: 'lsLoyaltyTransactions' },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: 'tbLoyaltyTx',
                theme: 'dark',
                title: 'Historial de Transacciones',
                center: [2, 3],
            }
        });
    }

    // === FACTURACION CFDI ===

    renderFacturacion() {
        const container = $('#container-facturacion');
        if (!container.length) return;

        container.html(`
            <div id="filterbar-cfdi" class="mb-3"></div>
            <div class="bg-[#1F2A37] rounded-lg p-4 mb-4">
                <div class="flex items-center gap-2 mb-2">
                    <i class="icon-doc-text text-blue-400"></i>
                    <h3 class="text-white font-bold">Facturacion CFDI 4.0</h3>
                    <span class="px-2 py-0.5 rounded text-xs bg-yellow-600/30 text-yellow-400">Base preparada - Integracion PAC pendiente</span>
                </div>
                <p class="text-gray-400 text-sm">Estructura lista para integrar con Finkok, SW Sapien o Facturapi. Las facturas se registran como pendientes hasta conectar el PAC.</p>
            </div>
            <div id="tableCfdi"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-cfdi',
            data: [
                { opc: "input-calendar", class: "col-12 col-md-4", id: "calendarCfdi", lbl: "Periodo:" },
                { opc: "btn", class: "col-12 col-md-2", color_btn: "primary", text: "Buscar", fn: "comp.lsCfdi()" },
            ]
        });

        dataPicker({ parent: "calendarCfdi", onSelect: () => this.lsCfdi() });
        this.lsCfdi();
    }

    lsCfdi() {
        let rangePicker = getDataRangePicker("calendarCfdi");

        this.createTable({
            parent: 'tableCfdi',
            data: { opc: 'lsCfdiInvoices', fi: rangePicker.fi, ff: rangePicker.ff },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: 'tbCfdi',
                theme: 'dark',
                title: 'Facturas CFDI',
                right: [4],
            }
        });
    }

    // === PERMISOS (ROLES GRANULARES) ===

    renderPermisos() {
        const container = $('#container-permisos');
        if (!container.length) return;

        container.html(`
            <div class="bg-[#1F2A37] rounded-lg p-4">
                <h3 class="text-white font-bold mb-3">Roles y Permisos Granulares</h3>
                <div class="flex gap-3 mb-4">
                    <select id="permRoleId" class="bg-[#283341] border border-gray-600 text-white rounded-lg px-3 py-2 text-sm">
                        <option value="1">Administrador</option>
                        <option value="2">Cajero</option>
                        <option value="3">Cocinero</option>
                        <option value="4">Mesero</option>
                    </select>
                    <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" onclick="comp.loadPermissions()">
                        <i class="icon-search"></i> Ver Permisos
                    </button>
                </div>
                <div id="permissionsGrid"></div>
            </div>
        `);
    }

    async loadPermissions() {
        const roleId = $('#permRoleId').val();
        const data = await useFetch({ url: this._link, data: { opc: 'lsPermissions', role_id: roleId } });
        const perms = data.permissions || [];

        const modules = [
            { key: 'pos', label: 'Punto de Venta', permissions: ['view', 'create', 'cancel', 'discount', 'corte'] },
            { key: 'reportes', label: 'Reportes', permissions: ['view', 'export'] },
            { key: 'inventario', label: 'Inventario', permissions: ['view', 'create', 'edit', 'delete'] },
            { key: 'admin', label: 'Administracion', permissions: ['view', 'create', 'edit', 'delete'] },
            { key: 'cocina', label: 'Cocina (KDS)', permissions: ['view', 'edit'] },
            { key: 'facturacion', label: 'Facturacion', permissions: ['view', 'create', 'cancel'] },
            { key: 'lealtad', label: 'Lealtad', permissions: ['view', 'create', 'edit'] },
            { key: 'mesas', label: 'Mesas', permissions: ['view', 'create', 'edit'] },
        ];

        const permLabels = {
            'view': 'Ver', 'create': 'Crear', 'edit': 'Editar', 'delete': 'Eliminar',
            'cancel': 'Cancelar', 'discount': 'Descuento', 'corte': 'Corte', 'export': 'Exportar'
        };

        let html = '<div class="space-y-3">';

        modules.forEach(mod => {
            html += `
                <div class="bg-[#283341] rounded-lg p-3">
                    <h4 class="text-white font-semibold text-sm mb-2">${mod.label}</h4>
                    <div class="flex flex-wrap gap-2">
            `;

            mod.permissions.forEach(perm => {
                const existing = perms.find(p => p.module === mod.key && p.permission === perm);
                const checked = existing && parseInt(existing.allowed) === 1 ? 'checked' : '';

                html += `
                    <label class="flex items-center gap-1.5 bg-[#1a2332] px-3 py-1.5 rounded-lg cursor-pointer text-sm">
                        <input type="checkbox" class="perm-check" data-module="${mod.key}" data-perm="${perm}" ${checked}
                            class="rounded border-gray-600">
                        <span class="text-gray-300">${permLabels[perm] || perm}</span>
                    </label>
                `;
            });

            html += '</div></div>';
        });

        html += `
            <button class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold mt-3" onclick="comp.savePermissions()">
                <i class="icon-ok"></i> Guardar Permisos
            </button>
        </div>`;

        $('#permissionsGrid').html(html);
    }

    async savePermissions() {
        const roleId = $('#permRoleId').val();
        const permissions = [];

        $('.perm-check').each(function () {
            permissions.push({
                module: $(this).data('module'),
                permission: $(this).data('perm'),
                allowed: $(this).is(':checked') ? 1 : 0
            });
        });

        const response = await useFetch({
            url: this._link,
            data: {
                opc: 'editPermissions',
                role_id: roleId,
                permissions: JSON.stringify(permissions)
            }
        });

        if (response.status === 200) {
            alert({ icon: "success", text: response.message, btn1: true });
        } else {
            alert({ icon: "error", text: response.message, btn1: true });
        }
    }
}
