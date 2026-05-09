let api = "../admin/ctrl/ctrl-empresa.php";
let app;
let rol, sucursal;

$(function () {
    fn_ajax({ opc: "init" }, api).then((data) => {
        rol = data.rol;
        customers = data.customers;

        app = new Company(api, "root");
        app.init();
    });
});


class Company extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Company";
    }

    init() {
        this.render();
    }

    render() {
        this.layout();
    }

    layout() {
        this.primaryLayout({
            parent: `root`,
            id: this.PROJECT_NAME,
            class: 'd-flex mx-2 my-2 h-100 mt-5 p-3',
            card: {
                filterBar: { class: 'w-full my-3', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full my-3 bg-[#1F2A37] rounded-lg p-3', id: 'container' + this.PROJECT_NAME }
            }
        });

        this.newCompanyLayout();
    }

    lsCompanies() {
        $('#contentTableCompanies').empty();
        this.createTable({
            parent: "contentTableCompanies",
            idFilterBar: "filterBarCompany",
            data: { opc: "lsCompanies" },
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbCompany",
            },
        });
    }

    newCompanyLayout() {
        $('#containerCompany').empty();
        this.createTableForm({
            parent: 'containerCompany',
            id: 'Companies',
            classForm: 'col-12 border border-gray-200 rounded-lg p-3',
            title: '',
            table: {
                id: 'tbCompanies',
                conf: { datatable: true, beforeSend: false },
                data: { opc: "lsCompanies" },
                attr: {
                    color_th: 'bg-[#374151] text-white p-2',
                    id: 'tbCompany',
                },
                success: (data) => { },
            },
            form: {
                data: { opc: 'addCompany' },
                json: [
                    {
                        opc: "input", lbl: "Nombre Comercial", id: "social_name", class: "col-12", tipo: "texto", required: true
                    },
                    {
                        opc: "select", lbl: "Cliente", id: "customers_id", class: "col-12",
                        data: customers
                    },
                    { opc: "btn-submit", id: "btnAgregar", text: "Agregar", class: "col-12" }
                ],
            },
            success: (data) => {
                alert();
            }
        });
    }

    async editCompany(id) {
        let data = await useFetch({
            url: this._link,
            data: { opc: 'getCompany', id: id }
        });
        $('#contentFormCompanies').empty();
        $('#contentFormCompanies').off();
        this.createForm({
            parent: 'contentFormCompanies',
            autofill: data.company,
            autovalidation: false,
            data: { opc: 'editCompany', id: id },
            json: [
                {
                    opc: "input", lbl: "Nombre Comercial", id: "social_name", class: "col-12", tipo: "texto", required: true
                },
                {
                    opc: "select", lbl: "Cliente", id: "customers_id", class: "col-12",
                    data: customers
                },
                { opc: "btn-submit", id: "btnActualizar", text: "Actualizar", class: "col-6" },
                {
                    opc: "button", className: 'w-100', color_btn: 'danger', id: "btnSalir", text: "Cancelar", class: "col-6", onClick: () => {
                        this.newCompanyLayout();
                    }
                }
            ],
            success: () => {
                this.newCompanyLayout();
            }
        });
    }

    deleteCompany(id) {
        let tr = $(event.target).closest("tr");
        let title = tr.find("td").eq(0).text();
        this.swalQuestion({
            opts: { title: `¿Deseas eliminar la empresa ${title} ?` },
            data: {
                opc: "deleteCompany",
                enabled: 0,
                id: id,
            },
            methods: {
                request: (response) => {
                    if (response.status == 200) {
                        alert({ icon: "success", text: response.message });
                        this.lsCompanies();
                    } else {
                        alert({ icon: "error", text: response.message });
                    }
                }
            }
        });
    }
}
