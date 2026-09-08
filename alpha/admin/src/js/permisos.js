const SAMPLE_PERMISOS = {
    roles: [
        { id: 1, name: 'Administrador', users: 13, granted: 17 },
        { id: 2, name: 'Cajero',        users: 2,  granted: 8  },
        { id: 3, name: 'Vendedor',      users: 1,  granted: 7  },
        { id: 4, name: 'Lectura',       users: 0,  granted: 1  },
        { id: 6, name: 'Supervisor',    users: 1,  granted: 8  }
    ],
    permissions: [
        { id: 1, code: 'view_order',          name: 'Ver pedidos',                description: 'Consultar el listado y el detalle de un pedido',  family: 'Pedidos',         is_dangerous: 0, has_scope: 1 },
        { id: 3, code: 'edit_order',          name: 'Editar pedido',              description: 'Cambiar datos y partidas de un pedido en armado', family: 'Pedidos',         is_dangerous: 0, has_scope: 1 },
        { id: 6, code: 'delete_order',        name: 'Eliminar pedido',            description: 'Borra el pedido y todas sus partidas',            family: 'Pedidos',         is_dangerous: 1, has_scope: 0 },
        { id: 8, code: 'edit_payment_method', name: 'Cambiar metodo de un cobro', description: 'Solo mientras el corte de ese pago siga abierto',  family: 'Pagos',           is_dangerous: 0, has_scope: 0 },
        { id: 9, code: 'delete_payment',      name: 'Eliminar pago',              description: 'Afecta el corte del dia de la sucursal que cobro', family: 'Pagos',           is_dangerous: 1, has_scope: 0 },
        { id: 13, code: 'manage_shift',       name: 'Abrir y consultar turnos',   description: 'Ver el estado de caja y abrir turno',              family: 'Turnos y cierre', is_dangerous: 0, has_scope: 1 },
        { id: 15, code: 'close_day',          name: 'Cerrar y reabrir el dia',    description: 'Cierra el corte Z de la sucursal',                 family: 'Turnos y cierre', is_dangerous: 1, has_scope: 1 }
    ],
    rolAdmin: 1
};

// -- Permisos --
class Permisos extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Permisos";
    }

    init() {
        this.render();
    }

    async render() {
        this.layout();
        this.onShowPermissions(await this.getPermissions());
    }

    layout() {
        this.createLayout({
            parent: 'container-tab-permisos',
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'w-full',
                container: [
                    {
                        type:  'div',
                        id:    `container${this.PROJECT_NAME}`,
                        class: 'w-full'
                    }
                ]
            }
        });
    }

    async getPermissions() {
        const request = await useFetch({
            url:  this._link,
            data: { opc: "init" }
        });

        if (!request || request.status !== 200) {
            alert({
                icon:     "error",
                text:     (request && request.message) || "No se pudieron cargar los permisos.",
                btn1:     true,
                btn1Text: "Ok"
            });
            return null;
        }

        return request;
    }

    onShowPermissions(data) {
        if (!data) return;

        this.rolePermissions({
            parent:   `container${this.PROJECT_NAME}`,
            id:       `cmp${this.PROJECT_NAME}`,
            theme:    'dark',
            lockedId: data.rolAdmin,
            json: {
                roles:       data.roles,
                permissions: data.permissions,
                granted:     {}
            },
            onSelect: (rolId, done) => this.getRolPermissions(rolId, done),
            onSave:   (rolId, granted, done) => this.savePermissions(rolId, granted, done)
        });
    }

    async getRolPermissions(rolId, done) {
        const request = await useFetch({
            url:  this._link,
            data: { opc: "getRolPermissions", id: rolId }
        });

        done(request && request.status === 200 ? request.granted : {});
    }

    async savePermissions(rolId, granted, done) {
        const request = await useFetch({
            url:  this._link,
            data: {
                opc:         "savePermissions",
                id:          rolId,
                permissions: JSON.stringify(granted)
            }
        });

        if (!request || request.status !== 200) {
            alert({
                icon:     "error",
                text:     (request && request.message) || "No se pudieron guardar los permisos.",
                btn1:     true,
                btn1Text: "Ok"
            });
            return;
        }

        alert({
            icon:  "success",
            text:  request.message,
            timer: 1500
        });

        done();
    }
}
