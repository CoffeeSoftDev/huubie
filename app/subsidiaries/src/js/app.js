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
        this.createLayout({
            design: false,
            parent: 'root',
            data: {
                id: this.PROJECT_NAME,
                class: 'flex flex-col mx-3 my-1 h-full',
                container: [
                    { type: 'div', id: 'filterBar', class: 'w-full' },
                    { type: 'div', id: 'container' + this.PROJECT_NAME, class: 'w-full flex-1 rounded p-3 overflow-auto' }
                ]
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
        let logo = '/alpha/src/img/huubie.png';
        $('#container' + this.PROJECT_NAME).html(`
            <div class="w-full h-full flex flex-col items-center justify-center text-white text-center px-4 py-4">
                <img src="${logo}" alt="huubie" class="w-20 h-20 mb-4">

                <h1 class="text-2xl font-bold mb-1">Selecciona tu sucursal</h1>
                <p class="text-gray-400 mb-4 text-sm">Elige dónde quieres iniciar sesión hoy</p>

                <div class="flex items-center gap-2 bg-[#1D2937] border border-[#374151] rounded-full px-3 py-1.5 mb-6">
                    <i data-lucide="user-circle" class="w-4 h-4 text-gray-400"></i>
                    <span class="text-xs text-gray-400">Bienvenid@ de nuevo, <span class="font-semibold text-white">${userName}</span> ✨</span>
                </div>

                <div id="subsidiariesGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl"></div>

                <div class="mt-16 flex items-center gap-2 text-gray-500 text-sm">
                    <i data-lucide="shield-check" class="w-4 h-4"></i>
                    <span>Sesión segura ·</span>
                    <a href="#" id="btnLogoutSubsidiaries" class="text-gray-300 hover:text-white transition-colors">Cerrar sesión</a>
                </div>
            </div>
        `);

        const SHIFT_STYLES = {
            open:          { dot: 'bg-green-400',  text: 'text-green-400'   },
            open_stale:    { dot: 'bg-orange-400', text: 'text-orange-400'  },
            pending_close: { dot: 'bg-amber-400',  text: 'text-amber-400'   },
            closed:        { dot: 'bg-blue-400',   text: 'text-blue-400'    },
            no_shift:      { dot: 'bg-gray-500',   text: 'text-gray-400'    }
        };

        branches.forEach(branch => {
            const isSelected = branch.selected === 1;
            const shiftKey   = branch.shift_status || 'no_shift';
            const shiftStyle = SHIFT_STYLES[shiftKey] || SHIFT_STYLES.no_shift;
            const shiftLabel = branch.shift_label || 'Sin turno hoy';
            const statusHtml = `
                <div class="flex items-center gap-1 whitespace-nowrap">
                    <span class="w-2 h-2 rounded-full ${shiftStyle.dot} inline-block shrink-0"></span>
                    <span class="${shiftStyle.text}">${shiftLabel}</span>
                </div>`;

            const card = `
                <div class="branch-menu-card bg-[#1F2A37] cursor-pointer rounded-xl p-4 text-left transition-all duration-200 select-none
                    ${isSelected
                        ? 'border-2 border-[#1F2A37]  hover:!border-[#7959FB]'
                        : ' border hover:!border-[#7C3AED]'
                    }" data-id="${branch.id}">
                    <div class="flex items-start justify-between mb-3">
                        <div class="bg-blue-600 rounded-lg p-2.5 flex-shrink-0">
                            <i data-lucide="store" class="w-5 h-5 text-white"></i>
                        </div>
                        ${isSelected
                            ? '<span class="text-[10px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.3)] text-[#c4b5fd] hover:bg-[rgba(124,58,237,0.25)] hover:text-white transition-colors self-start leading-none">ÚLTIMA USADA</span>'
                            : '<i data-lucide="arrow-right" class="w-4 h-4 text-gray-400 mt-1 flex-shrink-0"></i>'
                        }
                    </div>
                    <h3 class="text-base font-bold text-white mb-1">${branch.name}</h3>
                    ${branch.ubication
                        ? `<div class="flex items-center gap-1 text-gray-400 text-xs mb-2">
                               <i data-lucide="map-pin" class="w-3 h-3 flex-shrink-0"></i>
                               <span class="truncate">${branch.ubication}</span>
                           </div>`
                        : '<div class="mb-2"></div>'
                    }
                    <div class="flex items-center gap-3 text-xs text-gray-400">
        
                        ${statusHtml}
                    </div>
                </div>`;
            $('#subsidiariesGrid').append(card);
        });

        if (window.lucide) lucide.createIcons();

        const grid = document.getElementById('subsidiariesGrid');
        if (grid) {
            grid.addEventListener('click', (e) => {
                const card = e.target.closest('.branch-menu-card');
                if (!card || !grid.contains(card)) return;
                e.stopPropagation();
                e.preventDefault();
                const id = card.getAttribute('data-id');
                fn_ajax({ opc: 'switchBranch', id }, '/app/access/ctrl/ctrl-access.php').then(res => {
                    if (res.status === 200) window.location.href = '/app/ventas/';
                });
            }, true);
        }

        $('#btnLogoutSubsidiaries').off('click').on('click', function (e) {
            e.preventDefault();

            Swal.fire({
                title: '¿Cerrar sesión?',
                text: 'Se cerrará tu sesión actual y volverás al inicio.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, cerrar sesión',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#7C3AED',
                cancelButtonColor: '#374151',
                background: '#111928',
                color: '#fff',
                reverseButtons: true,
                scrollbarPadding: false,
                heightAuto: false
            }).then((result) => {
                if (!result.isConfirmed) return;

                Swal.fire({
                    title: 'Cerrando sesión...',
                    background: '#111928',
                    color: '#fff',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false,
                    scrollbarPadding: false,
                    heightAuto: false,
                    didOpen: () => Swal.showLoading()
                });

                fn_ajax({ opc: 'logout' }, '/app/access/ctrl/ctrl-access.php')
                    .then(() => { window.location.href = '/app/'; })
                    .catch(() => { window.location.href = '/app/'; });
            });
        });
    }
}
