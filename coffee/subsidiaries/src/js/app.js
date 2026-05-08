let api = "/coffee/subsidiaries/ctrl/ctrl-subsidiaries.php";
let app;

$(function () {
    fn_ajax({ opc: "init" }, api).then((data) => {
        app = new App(api, "root");
        app.render(data);
    });
});

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Subsidiaries";
    }

    render(data) {
        this.layout();
        this.welcome(data);
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: 'flex mx-2 ',
            heightPreset: 'full',
            card: {
                filterBar: { class: 'w-full ', id: 'filterBar' },
                container: { class: 'w-full my-2 bg-[#1F2A37] h-screen rounded p-3 overflow-auto', id: 'container' + this.PROJECT_NAME }
            }
        });

        $('#filterBar').html(`
            <div id="filterBar${this.PROJECT_NAME}" class="w-full my-3 " ></div>
            <div id="containerHours"></div>
        `);
    }

    welcome(data) {
        const userName = data.user || 'Usuario';

        $('#container' + this.PROJECT_NAME).html(`
            <div class="w-full h-full flex flex-col items-center justify-center text-white text-center px-4">
                <h1 class="text-3xl font-semibold mb-2">Bienvenido, ${userName}</h1>
                <p class="text-gray-400 mb-8">Selecciona la sucursal a la que deseas ingresar.</p>
                <div id="subsidiariesGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl"></div>
            </div>
        `);

        if (window.lucide) lucide.createIcons();
    }
}
