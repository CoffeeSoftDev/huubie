let api = "ctrl/ctrl-sucursales.php";
let app;

$(function () {
    useFetch({ url: api, data: { opc: "init" } }).then((data) => {
        app = new App(api, "root");
        app.render(data);
    });
});

// Colores para los diálogos SweetAlert según el tema activo.
function swalTheme() {
    const dark = document.body.classList.contains("dark-mode");
    return {
        background: dark ? "#111928" : "#FFFFFF",
        color:      dark ? "#F9FAFB" : "#111827",
    };
}

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Sucursales";
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
        const logo = '/inventory/src/img/logos/coffee_icon.png';

        $('#container' + this.PROJECT_NAME).html(`
            <div class="w-full h-full flex flex-col items-center justify-center text-center px-4 py-4">
                <img src="${logo}" alt="huubie" class="w-20 h-20 mb-4">

                <h1 class="text-2xl font-bold mb-1 suc-text">Selecciona tu sucursal</h1>
                <p class="suc-muted mb-4 text-sm">Elige dónde quieres iniciar sesión hoy</p>

                <div class="suc-pill flex items-center gap-2 border rounded-full px-3 py-1.5 mb-6">
                    <i data-lucide="user-circle" class="w-4 h-4 suc-muted"></i>
                    <span class="text-xs suc-muted">Bienvenid@ de nuevo, <span class="font-semibold suc-text">${userName}</span> ✨</span>
                </div>

                <div id="subsidiariesGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl"></div>

                <div class="mt-16 flex items-center gap-2 suc-muted text-sm">
                    <i data-lucide="shield-check" class="w-4 h-4"></i>
                    <span>Sesión segura ·</span>
                    <a href="#" id="btnLogoutSubsidiaries" class="suc-text hover:opacity-70 transition-opacity">Cerrar sesión</a>
                </div>
            </div>
        `);

        const SHIFT_STYLES = {
            open:          { dot: 'bg-green-400',  text: 'text-green-400'   },
            open_stale:    { dot: 'bg-orange-400', text: 'text-orange-400'  },
            pending_close: { dot: 'bg-amber-400',  text: 'text-amber-400'   },
            closed:        { dot: 'bg-blue-400',   text: 'text-blue-400'    },
            no_shift:      { dot: 'bg-gray-400',   text: 'suc-muted'        }
        };

        if (branches.length === 0) {
            $('#subsidiariesGrid').replaceWith(`
                <div class="suc-card w-full max-w-md flex flex-col items-center justify-center text-center border rounded-xl p-8">
                    <i data-lucide="store" class="w-10 h-10 suc-muted mb-3"></i>
                    <h3 class="text-base font-semibold suc-text mb-1">Sin sucursales disponibles</h3>
                    <p class="suc-muted text-sm">No tienes sucursales asignadas todavía. Contacta a tu administrador.</p>
                </div>
            `);
        }

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
                <div class="branch-menu-card suc-card cursor-pointer rounded-xl p-4 text-left transition-all duration-200 select-none
                    ${isSelected
                        ? 'border-2 suc-border hover:!border-[#C05A40]'
                        : 'border suc-border hover:!border-[#C05A40]'
                    }" data-id="${branch.id}">
                    <div class="flex items-start justify-between mb-3">
                        <div class="bg-blue-600 rounded-lg p-2.5 flex-shrink-0">
                            <i data-lucide="store" class="w-5 h-5 text-white"></i>
                        </div>
                        ${isSelected
                            ? '<span class="text-[10px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(192,90,64,0.12)] border border-[rgba(192,90,64,0.3)] text-[#C05A40] hover:bg-[rgba(192,90,64,0.25)] transition-colors self-start leading-none">ÚLTIMA USADA</span>'
                            : '<i data-lucide="arrow-right" class="w-4 h-4 suc-muted mt-1 flex-shrink-0"></i>'
                        }
                    </div>
                    <h3 class="text-base font-bold suc-text mb-1">${branch.name}</h3>
                    ${branch.ubication
                        ? `<div class="flex items-center gap-1 suc-muted text-xs mb-2">
                               <i data-lucide="map-pin" class="w-3 h-3 flex-shrink-0"></i>
                               <span class="truncate">${branch.ubication}</span>
                           </div>`
                        : '<div class="mb-2"></div>'
                    }
                    <div class="flex items-center gap-3 text-xs suc-muted">
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
                useFetch({ url: api, data: { opc: 'switchBranch', id } }).then(res => {
                    if (res && res.status === 200) {
                        // Tras elegir sucursal: dashboard de módulos (cards). Desde ahí
                        // el usuario navega módulo -> submódulo -> operación.
                        window.location.href = '/inventory/modulos/';
                    } else {
                        Swal.fire({
                            ...swalTheme(),
                            icon: 'error',
                            title: 'No se pudo seleccionar la sucursal',
                            text: (res && res.message) ? res.message : 'Intenta de nuevo.',
                            confirmButtonColor: '#C05A40',
                            heightAuto: false
                        });
                    }
                });
            }, true);
        }

        $('#btnLogoutSubsidiaries').off('click').on('click', function (e) {
            e.preventDefault();

            Swal.fire({
                ...swalTheme(),
                title: '¿Cerrar sesión?',
                text: 'Se cerrará tu sesión actual y volverás al inicio.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, cerrar sesión',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#C05A40',
                cancelButtonColor: '#9CA3AF',
                reverseButtons: true,
                scrollbarPadding: false,
                heightAuto: false
            }).then((result) => {
                if (!result.isConfirmed) return;

                Swal.fire({
                    ...swalTheme(),
                    title: 'Cerrando sesión...',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false,
                    scrollbarPadding: false,
                    heightAuto: false,
                    didOpen: () => Swal.showLoading()
                });

                useFetch({ url: api, data: { opc: 'logout' } })
                    .then(() => { window.location.href = '/inventory/'; })
                    .catch(() => { window.location.href = '/inventory/'; });
            });
        });
    }
}
