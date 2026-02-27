$(function () {
    const app = new App();
    app.init();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "projectName";
    }

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.createFilterBar();
        this.ls();
    }

    layout() {
        this.primaryLayout({
            parent: `root`,
            id: this.PROJECT_NAME,
        });
    }

    createFilterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "input-calendar",
                    class: "col-sm-4",
                    id: "calendar",
                    lbl: "Consultar fecha: ",
                },
                {
                    opc: "btn",
                    class: "col-sm-2",
                    color_btn: "primary",
                    id: "btn",
                    text: "Buscar",
                    fn: `${this.PROJECT_NAME.toLowerCase()}.ls()`,
                },
            ],
        });

        dataPicker({
            parent: "calendar",
            onSelect: () => this.ls(),
        });
    }

    ls() {
        let rangePicker = getDataRangePicker("calendar");

        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: "lsMenu", fi: rangePicker.fi, ff: rangePicker.ff },
            conf: { datatable: false, pag: 3 },
            attr: {
                color_th: "bg-primary",
                id: `tb${this.PROJECT_NAME}`,
                class: "table table-bordered table-sm uppercase",
                f_size: 12,
                center: [2],
                right: [2, 3, 4, 5],
                extends: true,
            },
        });
    }
}
