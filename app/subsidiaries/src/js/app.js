let api = "/app/subsidiaries/ctrl/ctrl-subsidiaries.php";
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

    onBranchChange() {}

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
        const branches = data.branches || [];

        $('#container' + this.PROJECT_NAME).html(`
            <div class="w-full h-full flex flex-col items-center justify-center text-white text-center px-4 py-10">
                <img src="/app/src/img/logo/huubie.svg" alt="huubie" class="h-10 mb-6">

                <h1 class="text-3xl font-bold mb-2">Selecciona tu sucursal</h1>
                <p class="text-gray-400 mb-6 text-sm">Elige dónde quieres iniciar sesión hoy</p>

                <div class="flex items-center gap-2 bg-[#111928] border border-[#374151] rounded-full px-4 py-2 mb-8">
                    <i data-lucide="user-circle" class="w-4 h-4 text-gray-400"></i>
                    <span class="text-sm text-gray-400">Bienvenido, <span class="font-semibold text-white">${userName}</span></span>
                </div>

                <div id="subsidiariesGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl"></div>

                <div class="mt-10 flex items-center gap-2 text-gray-500 text-sm">
                    <i data-lucide="shield-check" class="w-4 h-4"></i>
                    <span>Sesión segura ·</span>
                    <a href="#" id="btnLogout" class="text-gray-300 hover:text-white transition-colors">Cerrar sesión</a>
                </div>
            </div>
        `);

        branches.forEach(branch => {
            const isSelected = branch.selected === 1;
            const statusHtml = branch.active > 0
                ? `<div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-400 inline-block"></span><span class="text-green-400">Abierta</span></div>`
                : `<div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-400 inline-block"></span><span class="text-red-400">Cerrada</span></div>`;

            const card = `
                <div class="branch-card cursor-pointer rounded-xl p-5 text-left transition-all duration-200 select-none
                    ${isSelected
                        ? 'bg-[#111928] border-2 border-teal-400 hover:border-teal-300'
                        : 'bg-[#111928] border border-[#374151] hover:border-[#4B5563]'
                    }" data-id="${branch.id}">
                    <div class="flex items-start justify-between mb-4">
                        <div class="bg-blue-600 rounded-xl p-3 flex-shrink-0">
                            <i data-lucide="store" class="w-6 h-6 text-white"></i>
                        </div>
                        ${isSelected
                            ? '<span class="text-xs font-semibold bg-teal-500 text-white px-2 py-1 rounded-full leading-none self-start">ÚLTIMA USADA</span>'
                            : '<i data-lucide="arrow-right" class="w-5 h-5 text-gray-400 mt-1 flex-shrink-0"></i>'
                        }
                    </div>
                    <h3 class="text-sm font-bold text-white mb-1">${branch.name}</h3>
                    ${branch.ubication
                        ? `<div class="flex items-center gap-1 text-gray-400 text-xs mb-3">
                               <i data-lucide="map-pin" class="w-3 h-3 flex-shrink-0"></i>
                               <span class="truncate">${branch.ubication}</span>
                           </div>`
                        : '<div class="mb-3"></div>'
                    }
                    <div class="flex items-center gap-3 text-xs text-gray-400">
                        <div class="flex items-center gap-1">
                            <i data-lucide="users" class="w-3 h-3"></i>
                            <span>${branch.active} activos</span>
                        </div>
                        ${statusHtml}
                    </div>
                </div>`;
            $('#subsidiariesGrid').append(card);
        });

        if (window.lucide) lucide.createIcons();

        $(document).off('click.branch').on('click.branch', '.branch-card', function () {
            const id = $(this).data('id');
            fn_ajax({ opc: 'switchBranch', id }, '/app/access/ctrl/ctrl-access.php').then(res => {
                if (res.status === 200) window.location.href = '/app/pedidos/';
            });
        });

        $('#btnLogout').off('click').on('click', function (e) {
            e.preventDefault();
            fn_ajax({ opc: 'logout' }, '/app/access/ctrl/ctrl-access.php').then(() => {
                window.location.href = '/app/';
            });
        });
    }
}
