let api = 'ctrl/ctrl-calendario.php';
let app;

$(function () {
    app = new App(api, 'root');
    app.init();
});

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Calendario";
        this.calendar = null;
        this.subsidiaries = [];
        this.isAdmin = false;
        this._pedidosLink = '../ctrl/ctrl-pedidos.php';
        this._calendarLink = link;
    }

    async init() {
        const data = await useFetch({ url: this._link, data: { opc: 'init' } });
        this.subsidiaries = data.subsidiaries;
        this.subsidiariesCobro = data.subsidiariesCobro || [];
        this.isAdmin = data.isAdmin;
        // Supervisores (rol 6 y 7): perfil de consulta -> se les ocultan acciones de
        // operacion (Volver a Lista, Entregar, Pagar). El 7 (restringido) ademas no
        // puede aplicar descuentos.
        this.rolId = data.rolId || 0;
        this.isSupervisor = this.rolId == 6 || this.rolId == 7;
        // Produccion (rol 8): solo mira el calendario. No opera, no edita ni ve cotizaciones.
        this.isProduction = this.rolId == 8;
        // Administrador (1), SuperAdmin (5) y supervisores (6, 7) ven el ok de lo que
        // Produccion ya elaboro, sin poder palomear.
        this.seesProduced = [1, 5, 6, 7].includes(Number(this.rolId));
        this.canOperate = !this.isSupervisor && !this.isProduction;
        this.canDiscount = this.rolId != 7 && !this.isProduction;
        this.subsidiaryName = data.subsidiaryName || '';
        this.subsidiaryId = data.subsidiaryId || null;
        this.render();

        // Sincronizar con la navbar de pedidos: al elegir sucursal en su pill filtra la
        // vista (no toca la sesion) y dispara 'branchChanged'. El calendario refleja
        // ese cambio en su propio filtro (#subsidiaryFilter) y recarga.
        document.addEventListener('branchChanged', (e) => {
            const id = (e.detail && e.detail.id != null) ? String(e.detail.id) : '0';
            $('#subsidiaryFilter').val(id);
            this.createCalendar();
        });
    }

    render() {
        this.layout();
        this.createCalendar();
    }

    layout() {
        this.primaryLayout({
            parent: this._div_modulo,
            id: this.PROJECT_NAME,
            class: 'd-flex lg:mx-2 lg:my-2 h-100  lg:p-2',
            card: {
                // Sin filterBar: los filtros viven dentro del container. La banda vacia
                // (my-3) dejaba un hueco entre la navbar y la tarjeta.
                filterBar: { class: 'hidden' },
                container: {
                    id: `container${this.PROJECT_NAME}`,
                    class: 'w-full h-auto mb-3 rounded-lg p-3 bg-[#1F2A37]'
                }
            }
        });

        $(`#container${this.PROJECT_NAME}`).html(`
            <!-- Barra de filtros:
                 - Celular: un control por renglon.
                 - Tablet (md a lg): "Volver a Lista" (solo icono) y los 4 filtros en UNA
                   linea; controles de 44px para el dedo; etiquetas cortas en tablet vertical.
                 - PC (xl): filtros y leyenda en la MISMA linea; la leyenda queda fija a la
                   derecha y buscador y sucursal se encogen. Hasta 1700px van las etiquetas
                   cortas para que todo quepa en laptops; desde 1700px, las completas.
                 Padding y gap en valores arbitrarios: bootstrap trae .px-N/.gap-N con
                 !important y anula las variantes md:/xl: de Tailwind. -->
            <div class="p-2 flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-[12px] min-[1700px]:gap-[16px]">
                <div class="flex flex-col md:flex-row md:items-center gap-[12px] xl:flex-1 xl:min-w-0">
                ${!this.canOperate ? '' : `
                <button title="Volver a Lista" type="button"
                    class="btn bg-gray-700 hover:bg-purple-950 text-white rounded shrink-0 w-full md:w-auto h-11 xl:h-10 px-[24px] md:px-[12px] min-[1700px]:px-[24px] flex items-center justify-center gap-2"
                    onclick="window.location.href = '/alpha/pedidos/'">
                    <i class="icon-reply"></i><small class="md:hidden min-[1700px]:inline">Volver a Lista</small>
                </button>`}

                <div class="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto_minmax(0,1fr)] gap-[12px]">
                    <div id="searchFilter" class="flex items-center gap-2 min-w-0 h-11 xl:h-10 bg-[#1a2332] border-[1px] border-[#374151] px-[16px] md:px-[4px] xl:px-[6px] min-[1700px]:px-[16px] py-2 rounded-md text-gray-400"></div>

                    <div class="relative">
                        <button id="statusFilterBtn" type="button"
                            class="flex items-center gap-1 lg:gap-1.5 xl:gap-2 w-full h-11 xl:h-10 bg-[#1a2332] hover:bg-[#2B3D4F] border-[1px] border-[#374151] text-gray-400 px-[10px] lg:px-[12px] min-[1700px]:px-[16px] py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors">
                            <i class="icon-filter"></i>
                            <span class="md:hidden lg:inline xl:hidden min-[1700px]:inline">Filtrar Estados</span>
                            <span class="hidden md:inline lg:hidden xl:inline min-[1700px]:hidden">Estados</span>
                            <span id="statusCount" class="bg-gray-700 text-white text-xs px-2 py-0.5 rounded-full">${this.isProduction ? 2 : 4}</span>
                            <i class="icon-down-open text-xs ml-auto"></i>
                        </button>

                        <div id="statusDropdown" class="hidden absolute top-full left-0 mt-2 bg-[#2B3D4F] border border-gray-700 rounded-lg shadow-lg z-50 min-w-[240px]">
                            <div class="p-3 border-b border-gray-700">
                                <p class="text-xs font-semibold text-white uppercase">Seleccionar Estados</p>
                            </div>
                            <div class="p-2 space-y-1">
                                ${this.isProduction ? '' : `
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="1" class="status-checkbox w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" checked>
                                    <i class="icon-blank text-lg" style="color: #6E95C0"></i>
                                    <span class="text-sm text-white">Cotización</span>
                                </label>`}
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="2" class="status-checkbox w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" checked>
                                    <i class="icon-blank text-lg" style="color: #FE6F00"></i>
                                    <span class="text-sm text-white">Pendiente</span>
                                </label>
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="3" class="status-checkbox w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" checked>
                                    <i class="icon-blank text-lg" style="color: #0E9E6E"></i>
                                    <span class="text-sm text-white">Pagado</span>
                                </label>
                                ${this.isProduction ? '' : `
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="4" class="status-checkbox w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" checked>
                                    <i class="icon-blank text-lg" style="color: #E60001"></i>
                                    <span class="text-sm text-white">Cancelado</span>
                                </label>`}
                            </div>
                            <div class="p-2 border-t border-gray-700 flex gap-2">
                                <button id="selectAllBtn" class="flex-1 text-xs px-3 py-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 rounded transition-colors">
                                    Todos
                                </button>
                                <button id="clearAllBtn" class="flex-1 text-xs px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded transition-colors">
                                    Ninguno
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="relative">
                        <button id="deliveryFilterBtn" type="button"
                            class="flex items-center gap-1 lg:gap-1.5 xl:gap-2 w-full h-11 xl:h-10 bg-[#1a2332] hover:bg-[#2B3D4F] border-[1px] border-[#374151] text-gray-400 px-[10px] lg:px-[12px] min-[1700px]:px-[16px] py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors">
                            <i class="icon-truck"></i>
                            <span class="md:hidden lg:inline xl:hidden min-[1700px]:inline">Estado Entrega</span>
                            <span class="hidden md:inline lg:hidden xl:inline min-[1700px]:hidden">Entrega</span>
                            <span id="deliveryCount" class="bg-gray-700 text-white text-xs px-2 py-0.5 rounded-full">3</span>
                            <i class="icon-down-open text-xs ml-auto"></i>
                        </button>

                        <div id="deliveryDropdown" class="hidden absolute top-full left-0 mt-2 bg-[#2B3D4F] border border-gray-700 rounded-lg shadow-lg z-50 min-w-[240px]">
                            <div class="p-3 border-b border-gray-700">
                                <p class="text-xs font-semibold text-white uppercase">Estado de Entrega</p>
                            </div>
                            <div class="p-2 space-y-1">
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="1" class="delivery-checkbox w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500" checked>
                                    <i class="icon-ok text-lg text-green-400"></i>
                                    <span class="text-sm text-white">Entregado</span>
                                </label>
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="2" class="delivery-checkbox w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500" checked>
                                    <span class="text-lg">🎂</span>
                                    <span class="text-sm text-white">Para Producir</span>
                                </label>
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="0" class="delivery-checkbox w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500" checked>
                                    <i class="icon-cancel text-lg text-orange-400"></i>
                                    <span class="text-sm text-white">No Entregado</span>
                                </label>
                            </div>
                            <div class="p-2 border-t border-gray-700 flex gap-2">
                                <button id="selectAllDeliveryBtn" class="flex-1 text-xs px-3 py-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 rounded transition-colors">
                                    Todos
                                </button>
                                <button id="clearAllDeliveryBtn" class="flex-1 text-xs px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded transition-colors">
                                    Ninguno
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 min-w-0 h-11 xl:h-10 bg-[#1a2332] border-[1px] border-[#374151] px-[16px] md:px-[8px] min-[1700px]:px-[16px] py-2 rounded-md transition-colors">
                        <label for="subsidiaryFilter" class="md:hidden lg:inline xl:hidden min-[1700px]:inline text-xs font-medium text-gray-400 whitespace-nowrap">Sucursal:</label>
                        <select id="subsidiaryFilter" class="flex-1 min-w-0 text-xs bg-[#1a2332] text-white border-0 rounded-md px-2 py-1 focus:ring-1 focus:ring-gray-500 focus:outline-none">
                            <option value="0">Todas las sucursales</option>
                        </select>
                    </div>
                </div>
                </div>

                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm xl:gap-x-2 xl:text-xs min-[1700px]:gap-x-3 min-[1700px]:text-sm xl:flex-nowrap xl:whitespace-nowrap xl:shrink-0">
                        ${this.isProduction ? '' : `
                        <p class="flex items-center">
                            <i class="icon-blank text-lg" style="color: #6E95C0"></i> Cotización
                        </p>`}
                        <p class="flex items-center">
                            <i class="icon-blank text-lg" style="color: #0E9E6E"></i> Pagado
                        </p>
                        <p class="flex items-center">
                            <i class="icon-blank text-lg" style="color: #FE6F00"></i> Pendiente
                        </p>
                        ${this.isProduction ? '' : `
                        <p class="flex items-center">
                            <i class="icon-blank text-lg" style="color: #E60001"></i> Cancelado
                        </p>`}
                        ${this.isProduction ? `
                        <span class="w-px h-5 bg-gray-600 mx-1"></span>
                        <p class="flex items-center gap-1.5">
                            <span class="w-5 h-5 rounded-full border-[2.5px] border-gray-300 bg-black/25"></span> Por producir
                        </p>
                        <p class="flex items-center gap-1.5">
                            <span class="w-5 h-5 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center"><i class="icon-ok text-[10px]"></i></span> Producido
                        </p>` : ''}
                        ${this.seesProduced ? `
                        <span class="w-px h-5 bg-gray-600 mx-1"></span>
                        <p class="flex items-center gap-1.5">
                            <span class="w-5 h-5 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center"><i class="icon-ok text-[10px]"></i></span> Producido
                        </p>` : ''}
                </div>
            </div>

            ${this.isProduction ? `
            <p class="flex items-center gap-2 px-2 mt-2 text-sm text-purple-200">
                <span class="w-5 h-5 rounded-full border-[2.5px] border-gray-300 bg-black/25 shrink-0"></span>
                Da clic en el círculo de cada pedido cuando termines de producirlo. Otro clic lo desmarca.
            </p>` : ''}
            ${this.seesProduced ? `
            <p class="flex items-center gap-2 px-2 mt-2 text-sm text-gray-300">
                <span class="w-5 h-5 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center shrink-0"><i class="icon-ok text-[10px]"></i></span>
                Los pedidos con esta palomita ya los elaboró Producción. Pasa el mouse sobre ella para ver cuándo.
            </p>` : ''}

            <div class="row h-full mt-4">
                <div class="bg-[#111928] rounded-lg p-4 h-100 w-full" id="calendarFull"></div>
            </div>
        `);

        this.initSubsidiaryFilter();
        this.initStatusFilter();
        this.initSearchFilter();
    }

    initSearchFilter() {
        const $input = $('<input>', {
            id: 'searchOrder',
            type: 'search',
            placeholder: 'Buscar folio o cliente',
            // Padding en valores arbitrarios: bootstrap.min.css trae .px-2/.px-3 con
            // !important y se comia las variantes responsivas de Tailwind (md:px-*).
            class: 'flex-1 min-w-0 text-xs bg-[#1a2332] text-white border-0 rounded-md px-[8px] md:px-[2px] xl:px-[4px] min-[1700px]:px-[8px] py-1 focus:ring-1 focus:ring-gray-500 focus:outline-none'
        });

        $('#searchFilter').append($('<i>', { class: 'icon-search' }), $input);

        $input.on('input', () => this.highlightSearch());
    }

    initSubsidiaryFilter() {
        // Selector disponible para todos: permite ver una sucursal o "Todas".
        const $select = $('#subsidiaryFilter');

        this.subsidiaries.forEach(sub => {
            $select.append(`<option value="${sub.id}">${sub.valor}</option>`);
        });

        // Arranca en "Todas" (value 0, primera opcion); el usuario elige su sucursal si quiere.

        // La navbar muestra lo mismo que este filtro. syncBranch la repinta sin
        // disparar 'branchChanged'; si la navbar no tiene esa sucursal (o es etiqueta
        // fija) se deja como esta.
        $select.on('change', () => {
            if (window.navbar && typeof window.navbar.syncBranch === 'function') {
                window.navbar.syncBranch($select.val());
            }
            this.createCalendar();
        });
    }

    initStatusFilter() {
        const $statusBtn = $('#statusFilterBtn');
        const $statusDropdown = $('#statusDropdown');
        const $statusCheckboxes = $('.status-checkbox');
        const $statusCount = $('#statusCount');

        const $deliveryBtn = $('#deliveryFilterBtn');
        const $deliveryDropdown = $('#deliveryDropdown');
        const $deliveryCheckboxes = $('.delivery-checkbox');
        const $deliveryCount = $('#deliveryCount');

        $statusBtn.on('click', (e) => {
            e.stopPropagation();
            $statusDropdown.toggleClass('hidden');
            $deliveryDropdown.addClass('hidden');
        });

        $deliveryBtn.on('click', (e) => {
            e.stopPropagation();
            $deliveryDropdown.toggleClass('hidden');
            $statusDropdown.addClass('hidden');
        });

        $(document).on('click', (e) => {
            if (!$(e.target).closest('#statusFilterBtn, #statusDropdown, #deliveryFilterBtn, #deliveryDropdown').length) {
                $statusDropdown.addClass('hidden');
                $deliveryDropdown.addClass('hidden');
            }
        });

        const updateStatusCount = () => {
            const count = $statusCheckboxes.filter(':checked').length;
            $statusCount.text(count);
        };

        const updateDeliveryCount = () => {
            const count = $deliveryCheckboxes.filter(':checked').length;
            $deliveryCount.text(count);
        };

        $statusCheckboxes.on('change', () => {
            updateStatusCount();
            this.createCalendar();
        });

        $deliveryCheckboxes.on('change', () => {
            updateDeliveryCount();
            this.createCalendar();
        });

        $('#selectAllBtn').on('click', () => {
            $statusCheckboxes.prop('checked', true);
            updateStatusCount();
            this.createCalendar();
        });

        $('#clearAllBtn').on('click', () => {
            $statusCheckboxes.prop('checked', false);
            updateStatusCount();
            this.createCalendar();
        });

        $('#selectAllDeliveryBtn').on('click', () => {
            $deliveryCheckboxes.prop('checked', true);
            updateDeliveryCount();
            this.createCalendar();
        });

        $('#clearAllDeliveryBtn').on('click', () => {
            $deliveryCheckboxes.prop('checked', false);
            updateDeliveryCount();
            this.createCalendar();
        });
    }

    async createCalendar() {
        const selectedStatuses = $('.status-checkbox:checked').map(function () {
            return $(this).val();
        }).get();

        const selectedDelivery = $('.delivery-checkbox:checked').map(function () {
            return $(this).val();
        }).get();

        if (selectedStatuses.length === 0 || selectedDelivery.length === 0) {
            if (this.calendar) {
                this.calendar.destroy();
                this.calendar = null;
            }
            $('#calendarFull').html('<div class="flex items-center justify-center h-full text-gray-400"><p>Selecciona al menos un estado y un tipo de entrega para ver los pedidos</p></div>');
            return;
        }

        // Cualquier usuario filtra por la sucursal elegida en el selector
        // ("0" = todas las sucursales).
        const subsidiaryId = $('#subsidiaryFilter').val() || 0;

        let data = await useFetch({
            url: this._calendarLink,
            data: {
                opc: 'getCalendar',
                statuses: selectedStatuses.join(','),
                delivery: selectedDelivery.join(','),
                subsidiaries_id: subsidiaryId
            }
        });

        const calendarEl = document.getElementById('calendarFull');

        if (!calendarEl) {
            console.error('Elemento del calendario no encontrado');
            return;
        }

        if (this.calendar) {
            this.calendar.destroy();
        }

        // Produccion: el pedido producido se pinta en tono apagado. baseColor guarda
        // el color del estado para volver a el al quitar la palomita.
        if (this.isProduction) {
            data = data.map(ev => ({
                ...ev,
                baseColor: ev.color,
                color: ev.produced == 1 ? this.producedColor(ev.color) : ev.color
            }));
        }

        // Los filtros vuelven a crear el calendario: arranca en el mes y la vista que
        // el usuario estaba viendo (los guarda datesSet), no en el mes actual.
        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: this.currentView || 'dayGridMonth',
            initialDate: this.currentDate || new Date(),
            locale: 'es',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                // Semana en cuadricula de dias (dayGridWeek): sin la columna de horas.
                // Dia es la galeria propia (galleryDayPlugin).
                right: 'dayGridMonth,dayGridWeek,galeriaDia'
            },
            plugins: [this.galleryDayPlugin()],
            // El bundle global no trae el locale 'es': las fechas salen en español (Intl)
            // pero los botones de vista y el de hoy se quedaban en ingles.
            buttonText: {
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día'
            },
            height: 'auto',
            contentHeight: 'auto',
            dayMaxEvents: 3,
            moreLinkClick: 'popover',
            events: data,
            // Las coincidencias del buscador van primero en su dia: con dayMaxEvents
            // quedarian escondidas dentro del "+N".
            eventOrder: '-searchMatch,start,-duration,allDay,title',
            eventClassNames: (arg) => this.searchClassNames(arg.event),
            eventContent: (arg) => this.renderEventContent(arg),
            // La casilla de la esquina palomea; el resto de la tarjeta abre el pedido.
            eventClick: (info) => {
                if (info.jsEvent.target.closest('[data-produce]')) return this.toggleProduced(info.event);
                this.showOrder(info.event.id);
            },
            datesSet: (info) => {
                this.currentView = info.view.type;
                this.currentDate = info.view.calendar.getDate();
                this.customizeCalendarAppearance();
            }
        });

        this.calendar.render();
        this.applyCalendarStyles();
        this.highlightSearch();
    }

    // Marca cada pedido como coincidencia (1) o no (0) del texto buscado; sin texto
    // queda en null y el calendario se ve normal.
    highlightSearch() {
        if (!this.calendar) return;

        const term   = this.normalizeText($('#searchOrder').val());
        const events = this.calendar.getEvents();

        const matches = term
            ? events.filter(ev => [ev.extendedProps.folio, ev.title].some(v => this.normalizeText(v).includes(term)))
            : [];

        const matchSet = new Set(matches);

        this.calendar.batchRendering(() => {
            events.forEach(ev => ev.setExtendedProp('searchMatch', term ? (matchSet.has(ev) ? 1 : 0) : null));
        });

        // Si ninguna coincidencia cae en la vista actual, salta a la mas cercana para que se vea.
        const view    = this.calendar.view;
        const visible = matches.some(ev => ev.start >= view.activeStart && ev.start < view.activeEnd);

        if (matches.length && !visible) {
            const ref     = view.currentStart.getTime();
            const nearest = matches.reduce((a, b) => Math.abs(b.start - ref) < Math.abs(a.start - ref) ? b : a);
            this.calendar.gotoDate(nearest.start);
        }

        // Lleva la pantalla a la tarjeta encontrada: en el mes o en la galeria del dia
        // puede quedar fuera de la vista. Espera a que se deje de escribir (y a que
        // FullCalendar termine de pintar) para no saltar con cada letra.
        clearTimeout(this._searchScroll);

        if (!matches.length) return;

        this._searchScroll = setTimeout(() => {
            const el = document.querySelector('#calendarFull .search-match');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 400);
    }

    searchClassNames(event) {
        const match = event.extendedProps.searchMatch;
        if (match === 1) return ['search-match'];
        if (match === 0) return ['search-dim'];
        return [];
    }

    // Minusculas y sin acentos: "maria" encuentra "María".
    normalizeText(value) {
        return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    }

    renderEventContent(arg) {
        let envio_domicilio = arg.event.extendedProps.type == 'Envío a Domicilio' ? true : false;
        let entregado = arg.event.extendedProps.delivery == 'Entregado' ? true : false;
        let paraProducir = arg.event.extendedProps.delivery == 'Para Producir' ? true : false;

        // Si es para producir, usar emoji de pastel, sino usar el emoji según tipo de entrega
        let emoji = paraProducir ? "🎂" : (envio_domicilio ? "🚚" : "🏠");

        // Tablet (md a lg) usa una tarjeta mas compacta: menos padding y letra mas chica.
        // Padding en valores arbitrarios: bootstrap trae .px-N con !important y anula
        // las variantes md:/xl: de Tailwind.

        // Contenedor principal
        let containerEl = document.createElement("div");
        containerEl.classList.add("px-[8px]", "md:px-[4px]", "xl:px-[8px]", "py-[6px]", "md:py-[3px]", "xl:py-[6px]", "w-full", "relative");

        // Folio
        let folioEl = document.createElement("div");
        folioEl.classList.add("absolute", "top-1", "right-1", "bg-black/25", "text-white", "text-[10px]", "md:text-[9px]", "xl:text-[10px]", "font-semibold", "px-1", "py-px", "rounded");
        folioEl.textContent = arg.event.extendedProps.folio || '';

        // Nombre del cliente
        let titleEl = document.createElement("div");
        titleEl.classList.add("font-semibold", "text-[13px]", "md:text-[11px]", "xl:text-[13px]", "leading-tight", "mb-0.5", "truncate", "pr-12");
        titleEl.innerHTML = arg.event.title;

        // Tipo de entrega
        let deliveryEl = document.createElement("div");
        deliveryEl.classList.add("flex", "items-center", "gap-1", "text-[11px]", "md:text-[10px]", "xl:text-[11px]", "mb-0.5", "opacity-80");
        deliveryEl.innerHTML = `
        <span>${emoji}</span>
        <span>${arg.event.extendedProps.type}</span>
    `;

        // Hora
        let timeEl = document.createElement("div");
        timeEl.classList.add("flex", "items-center", "gap-1", "text-[11px]", "md:text-[10px]", "xl:text-[11px]", "opacity-80");
        timeEl.innerHTML = `
        <i class='icon-clock'></i>
        <span>${arg.event.extendedProps.hour}</span>
    `;

        // Badge de estado
        let badgeEl = document.createElement("div");
        badgeEl.classList.add("mt-1");

        let badgeClass = "bg-orange-100 text-orange-700 border-1 border-orange-300";

        if (entregado) {
            badgeClass = "bg-green-100 text-green-700 border-1 border-green-300";
        } else if (paraProducir) {
            badgeClass = "bg-purple-100 text-purple-700 border-1 border-purple-300";
        }

        badgeEl.innerHTML = `
        <span class="${badgeClass} px-1.5 py-px rounded-full text-[10px] md:text-[9px] xl:text-[10px] leading-4 md:leading-3 xl:leading-4 font-medium inline-block">
            ${arg.event.extendedProps.delivery}
        </span>
    `;

        // Ensamblar elementos
        if (folioEl.textContent) containerEl.appendChild(folioEl);
        containerEl.appendChild(titleEl);
        containerEl.appendChild(deliveryEl);
        containerEl.appendChild(timeEl);
        containerEl.appendChild(badgeEl);

        if (this.isProduction) this.addProductionCheck(containerEl, badgeEl, arg.event);
        else if (this.seesProduced && arg.event.extendedProps.produced == 1) this.addProducedMark(containerEl, badgeEl, arg.event);

        return { domNodes: [containerEl] };
    }

    // -- Vista Dia: galeria --

    // Vista Dia propia: los pedidos del dia agrupados por hora de entrega, en tarjetas
    // con la foto grande arriba (variacion 2 de
    // coffee/templates/calendario-dia-variaciones.html). Va como vista de FullCalendar
    // para conservar Hoy, las flechas, el titulo y los filtros.
    galleryDayPlugin() {
        this._galleryPlugin = this._galleryPlugin || FullCalendar.createPlugin({
            name: 'galeriaDia',
            views: {
                galeriaDia: {
                    duration: { days: 1 },
                    buttonText: 'Día',
                    content: (props) => ({ domNodes: [this.renderGalleryDay(props)] })
                }
            }
        });

        return this._galleryPlugin;
    }

    // Se vuelve a dibujar cada vez que cambian los eventos (filtros, buscador,
    // palomita), porque FullCalendar llama a content con las props nuevas. La hora
    // llega en extendedProps.hour como "02:52 PM".
    renderGalleryDay(props) {
        const minutos = (hora) => {
            const m = moment(hora, 'hh:mm A');
            return m.isValid() ? m.hours() * 60 + m.minutes() : 0;
        };

        const pedidos = FullCalendar.sliceEvents(props, true)
            .map(seg => ({
                id:    seg.def.publicId,
                title: seg.def.title,
                color: seg.ui.backgroundColor,
                ...seg.def.extendedProps
            }))
            .sort((a, b) => minutos(a.hour) - minutos(b.hour) || a.title.localeCompare(b.title));

        const wrap = document.createElement('div');
        wrap.className = 'p-[16px]';

        if (!pedidos.length) {
            wrap.innerHTML = '<p class="text-center text-gray-400 text-sm py-[40px]">Sin pedidos este día.</p>';
            return wrap;
        }

        const grupos = {};
        pedidos.forEach(p => (grupos[p.hour] = grupos[p.hour] || []).push(p));

        Object.entries(grupos).forEach(([hora, lista]) => {
            const grupo = document.createElement('div');
            grupo.className = 'mb-[20px] last:mb-0';
            grupo.innerHTML = `
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    ${hora} <span class="text-gray-600 normal-case font-normal">· ${lista.length} ${lista.length === 1 ? 'pedido' : 'pedidos'}</span>
                </p>`;

            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-[10px]';
            lista.forEach(p => grid.appendChild(this.galleryCard(p)));

            grupo.appendChild(grid);
            wrap.appendChild(grupo);
        });

        return wrap;
    }

    // Tarjeta de la galeria: foto arriba con la hora y el color del estado; abajo
    // cliente, folio, tipo de entrega y estado de entrega. Sin borde. Clic = detalle.
    galleryCard(p) {
        const emoji    = p.delivery == 'Para Producir' ? '🎂' : (p.type == 'Envío a Domicilio' ? '🚚' : '🏠');
        const estados  = { 'Entregado': 'bg-green-100 text-green-700', 'Para Producir': 'bg-purple-100 text-purple-700' };
        const atenuado = this.isProduction && p.produced == 1 ? ' opacity-60' : '';
        const busqueda = p.searchMatch === 1 ? ' search-match' : (p.searchMatch === 0 ? ' search-dim' : '');

        const card = document.createElement('div');
        card.className = `cal-gallery-card rounded-lg overflow-hidden bg-[#29374A] cursor-pointer${busqueda}`;
        card.title = `${p.title} · ${p.folio || ''} · ${p.type} · ${p.hour} · ${p.delivery}`;
        card.addEventListener('click', () => this.showOrder(p.id));

        const fotoEl = document.createElement('div');
        fotoEl.className = 'relative h-24';
        fotoEl.appendChild(this.eventPhoto(p, atenuado));
        fotoEl.insertAdjacentHTML('beforeend', `
            <span class="absolute top-1 left-1 bg-black/60 text-[9px] font-semibold px-1 py-px rounded">${p.hour}</span>
            <span class="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full" style="background:${p.color}"></span>`);

        const palomita = this.galleryProduction(p);
        if (palomita) fotoEl.appendChild(palomita);

        const body = document.createElement('div');
        body.className = 'p-[6px]' + atenuado;
        body.innerHTML = `
            <p class="text-[12px] font-semibold truncate">${p.title}</p>
            <p class="text-[10px] text-gray-400 truncate">${p.folio || ''} · ${emoji} ${p.type}</p>
            <span class="inline-block mt-1 ${estados[p.delivery] || 'bg-orange-100 text-orange-700'} px-1.5 rounded-full text-[9px] font-medium">${p.delivery}</span>`;

        card.append(fotoEl, body);
        return card;
    }

    // Foto del pedido (photo de getCalendar) a todo lo ancho de la tarjeta. Sin foto,
    // o si no carga ni en produccion (fileUrlFallback), queda el pastel.
    eventPhoto(p, clases = '') {
        const box = document.createElement('div');
        box.className = 'w-full h-full bg-black/20 flex items-center justify-center text-white/80' + clases;
        box.innerHTML = lucideIcon('cake', 'w-8 h-8');

        if (!p.photo) return box;

        const img = document.createElement('img');
        img.src = fileUrl(p.photo);
        img.alt = p.title;
        img.className = 'w-full h-full object-cover';
        img.onerror = () => {
            if (!img.dataset.fileFallback) return fileUrlFallback(img);
            box.innerHTML = lucideIcon('cake', 'w-8 h-8');
        };

        box.innerHTML = '';
        box.appendChild(img);
        return box;
    }

    // Palomeo en la galeria, igual que en el mes: Produccion tiene la casilla (vacia o
    // llena) en la esquina de la foto; admin y supervisores ven solo el ok de lo ya
    // producido. La casilla no abre el pedido.
    galleryProduction(p) {
        const producido = p.produced == 1;

        if (!this.isProduction && !(this.seesProduced && producido)) return null;

        const el = document.createElement(this.isProduction ? 'button' : 'span');
        el.className = 'absolute right-1 bottom-1 w-5 h-5 rounded-full flex items-center justify-center ' + (producido
            ? 'bg-gray-300 shadow'
            : 'border-[2.5px] border-gray-300 bg-black/25 text-transparent hover:text-gray-300/70 transition-colors');
        if (producido) el.style.color = p.baseColor || p.color;
        el.innerHTML = lucideIcon('check', 'w-3 h-3');

        if (!this.isProduction) {
            el.title = `Producción ya elaboró este pedido (${p.producedAt}).`;
            return el;
        }

        el.type  = 'button';
        el.title = producido
            ? `Producido el ${p.producedAt}. Da clic para desmarcarlo.`
            : 'Da clic aquí cuando termines de producir este pedido.';
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleProduced(this.calendar.getEventById(p.id));
        });

        return el;
    }

    // -- Palomeo de Produccion --

    // Casilla redonda en la esquina inferior derecha: vacia (solo el aro) = por
    // producir; llena (gris con el check del color del estado) = producido. En el
    // producido el contenido se atenua para que se distinga de un vistazo.
    addProductionCheck(containerEl, badgeEl, event) {
        const produced = event.extendedProps.produced == 1;

        if (produced) {
            Array.from(containerEl.children).forEach(el => el.style.opacity = '0.6');
        }
        badgeEl.classList.add('pr-7', 'md:pr-6', 'xl:pr-7');

        const checkEl = document.createElement('button');
        checkEl.type = 'button';
        checkEl.dataset.produce = event.id;
        checkEl.title = produced
            ? `Producido el ${event.extendedProps.producedAt}. Da clic para desmarcarlo.`
            : 'Da clic aquí cuando termines de producir este pedido.';
        checkEl.className = produced
            ? 'absolute right-1 bottom-1 w-6 h-6 md:w-5 md:h-5 xl:w-6 xl:h-6 rounded-full flex items-center justify-center bg-gray-300 shadow'
            : 'absolute right-1 bottom-1 w-6 h-6 md:w-5 md:h-5 xl:w-6 xl:h-6 rounded-full flex items-center justify-center border-[2.5px] border-gray-300 bg-black/25 text-transparent hover:text-gray-300/70 transition-colors';
        if (produced) checkEl.style.color = event.extendedProps.baseColor;

        const iconEl = document.createElement('i');
        iconEl.className = 'icon-ok text-xs';
        checkEl.appendChild(iconEl);

        containerEl.appendChild(checkEl);
    }

    // Administradores y supervisores: solo el ok lleno, y solo si ya se produjo. Es
    // un span, no un boton: tocarlo abre el pedido como el resto de la tarjeta.
    addProducedMark(containerEl, badgeEl, event) {
        badgeEl.classList.add('pr-7', 'md:pr-6', 'xl:pr-7');

        const markEl = document.createElement('span');
        markEl.title = `Producción ya elaboró este pedido (${event.extendedProps.producedAt}).`;
        markEl.className = 'absolute right-1 bottom-1 w-6 h-6 md:w-5 md:h-5 xl:w-6 xl:h-6 rounded-full flex items-center justify-center bg-gray-300 shadow';
        markEl.style.color = event.backgroundColor;

        const iconEl = document.createElement('i');
        iconEl.className = 'icon-ok text-xs';
        markEl.appendChild(iconEl);

        containerEl.appendChild(markEl);
    }

    // Guarda la palomita y repinta solo esa tarjeta, sin recargar el calendario.
    async toggleProduced(event) {
        if (this._producing?.has(event.id)) return;
        this._producing = this._producing || new Set();
        this._producing.add(event.id);

        const produced = event.extendedProps.produced == 1 ? 0 : 1;
        const response = await useFetch({
            url: this._calendarLink,
            data: { opc: 'statusProduction', id: event.id, produced }
        });

        this._producing.delete(event.id);

        if (response.status != 200) {
            alert({ icon: 'error', title: 'Error', text: response.message, btn1: true, btn1Text: 'Ok' });
            return;
        }

        const baseColor = event.extendedProps.baseColor;
        event.setExtendedProp('producedAt', response.producedAt);
        event.setExtendedProp('produced', produced);
        event.setProp('color', produced ? this.producedColor(baseColor) : baseColor);
    }

    // Tono "producido": el color del estado mezclado 50% con el fondo del
    // calendario (#111928). Sigue siendo el mismo color, solo apagado.
    producedColor(hex) {
        const bg  = [0x11, 0x19, 0x28];
        const rgb = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16));

        return '#' + rgb.map((c, i) => Math.round((c + bg[i]) / 2).toString(16).padStart(2, '0')).join('');
    }

    customizeCalendarAppearance() {
        document.querySelectorAll('.fc-day-today').forEach(el => {
            el.style.backgroundColor = '#2C3E50';
        });

        document.querySelectorAll('.fc-daygrid-day, .fc-scrollgrid, .fc-theme-standard td, .fc-theme-standard th').forEach(el => {
            el.style.border = '1px solid #1F2A37';
        });
    }

    applyCalendarStyles() {
        const styleId = 'calendar-custom-styles';
        if ($('#' + styleId).length === 0) {
            $('<style>', {
                id: styleId,
                text: `
                    thead {
                        background: #2B3D4F;
                    }

                    .fc-daygrid-day-frame {
                        min-height: 120px !important;
                        max-height: 600px !important;
                    }
                    
                    .fc-daygrid-day-events {
                        max-height: 600px !important;
                        overflow-y: auto !important;
                        margin-bottom: 2px !important;
                    }
                    
                    .fc-daygrid-day-events::-webkit-scrollbar {
                        width: 4px;
                    }
                    
                    .fc-daygrid-day-events::-webkit-scrollbar-track {
                        background: #1F2A37;
                        border-radius: 2px;
                    }
                    
                    .fc-daygrid-day-events::-webkit-scrollbar-thumb {
                        background: #4B5563;
                        border-radius: 2px;
                    }
                    
                    .fc-daygrid-day-events::-webkit-scrollbar-thumb:hover {
                        background: #6B7280;
                    }
                    
                    .fc-daygrid-event {
                        margin-bottom: 2px !important;
                        font-size: 0.75rem !important;
                    }
                    
                    .fc-daygrid-event-harness {
                        margin-bottom: 2px !important;
                    }

                    .fc-event.search-match,
                    .cal-gallery-card.search-match {
                        outline: 2px solid #A78BFA;
                        outline-offset: -2px;
                        box-shadow: 0 0 12px rgba(124, 58, 237, 0.7);
                    }

                    .fc-event.search-dim,
                    .cal-gallery-card.search-dim {
                        opacity: 0.25;
                    }

                    /* Vista Dia (galeria): la tarjeta se aclara al pasar el mouse. */
                    .cal-gallery-card {
                        transition: filter .15s;
                    }

                    .cal-gallery-card:hover {
                        filter: brightness(1.08);
                    }
                    
                    .fc-more-link {
                        font-size: 0.7rem !important;
                        padding: 2px 4px !important;
                        background: #374151 !important;
                        color: #9CA3AF !important;
                        border-radius: 4px !important;
                        margin-top: 2px !important;
                    }
                    
                    .fc-more-link:hover {
                        background: #4B5563 !important;
                        color: #D1D5DB !important;
                    }
                    
                    .fc-popover {
                        background: #1F2A37 !important;
                        border: 1px solid #374151 !important;
                        max-height: 600px !important;
                        overflow-y: auto !important;         
                    }
                    
                    .fc-popover-header {
                        background: #111928 !important;
                        color: #fff !important;
                        padding: 8px 12px !important;
                    }
                    
                    .fc-popover-body {
                        padding: 8px !important;
                    }
                `
            }).appendTo('head');
        }
    }



    // Show Order.

    // Mismo modal, diseño y logica que el detalle del listado de pedidos (app.js):
    // encabezado con tipo de entrega, sucursal y estado; footer con la nota de consulta
    // y "Cerrar". Las acciones del panel que abren modales de bootstrap (descuento,
    // editar entrega, imprimir) suben por encima de este overlay con el CSS de index.php.
    async showOrder(orderId) {
        const response = await useFetch({
            url: this._pedidosLink,
            data: { opc: 'getOrderDetails', id: orderId }
        });

        if (!response?.data?.order) {
            alert({
                icon: 'error',
                title: 'No se pudo abrir el pedido',
                text: response?.message ?? 'El servidor no devolvió una respuesta válida. Revisa la consola del navegador.',
                btn1: true,
                btn1Text: 'Ok'
            });

            return;
        }

        const orderData      = response.data.order || {};
        const products       = response.data.products || [];
        const paymentMethods = response.data.paymentMethods || [];
        const payments       = response.data.payments || [];

        // createCoffeeModalForm no trae modo solo lectura, asi que el detalle va como
        // bloque 'html' y del footer se quita Confirmar mas abajo. Se guarda en
        // detailModal para cerrarlo desde las acciones del panel (handleDeliveryClick).
        const modal = createCoffeeModalForm({
            id: 'modalOrderDetails',
            title: `Pedido #${orderData.folio}`,
            iconSvg: lucideIcon('cake', 'w-5 h-5'),
            iconBg: 'bg-blue-500',
            theme: 'dark',
            width: 900,
            cancelText: 'Cerrar',
            cancelBg: 'bg-[#2C3A4C] hover:bg-[#36475D] text-white',
            json: [
                {
                    opc: 'html',
                    html: '<div id="orderDetailsContainer" class="max-h-[70vh] overflow-y-auto"></div>'
                }
            ]
        });

        this.detailModal = modal;

        // Encabezado y footer a todo el ancho de la tarjeta, separados del cuerpo por
        // una linea. El componente no trae esas opciones, se ajustan sus clases. Los
        // espaciados van como valores arbitrarios (px-[20px]) porque bootstrap.min.css
        // pisa px-5, p-4 y similares con !important.
        const $card   = modal.el.find('.cf-card');
        const $header = $card.children().first();

        $card.removeClass('p-4').addClass('overflow-hidden');
        $header.removeClass('items-center mb-3').addClass('items-start px-[20px] py-[16px] border-b border-white/10');
        $header.children().first().removeClass('w-9 h-9 rounded-lg').addClass('w-11 h-11 rounded-xl');
        $header.find('.cf-close').removeClass('p-1 -mr-1').addClass('w-8 h-8 rounded-lg border border-gray-600');

        // Sucursal, tipo de entrega y estado de entrega como subtitulo del encabezado: el
        // componente no admite subtitulo por opciones. Los badges conservan su id porque
        // refreshOrderDetails() los repinta.
        $header.find('span').first().removeClass('text-base truncate').addClass('text-lg block')
            .wrap('<div class="flex-1 min-w-0"></div>').after(`
            <div class="flex flex-wrap items-center gap-2 mt-1.5">
                <span class="inline-flex items-center gap-1 text-xs text-gray-400">
                    ${lucideIcon('house', 'w-3.5 h-3.5')} ${orderData.subsidiarie_name || ''}
                </span>
                <span id="orderDeliveryBadge">${this.getBadgeDeliveryType(orderData.delivery_type)}</span>
                <span id="orderStatusBadge">${this.statusDelivery(orderData.is_delivered)}</span>
            </div>`);

        // El detalle es de consulta: sin Confirmar. El boton de cancelar queda como
        // "Cerrar", a la derecha del footer, con la nota de consulta a la izquierda.
        modal.el.find('.cf-confirm').remove();
        modal.el.find('.cf-cancel').removeClass('flex-1').addClass('px-6').parent()
            .removeClass('mt-4').addClass('items-center justify-between px-[20px] py-[12px] border-t border-white/10')
            .prepend(`
                <p class="text-xs text-gray-400 flex items-center gap-1.5">
                    ${lucideIcon('info', 'w-3.5 h-3.5')} Pedido de consulta — sin edición de productos
                </p>`);

        this.layoutManager = {
            isMobile: () => window.innerWidth < 768,
            isTablet: () => window.innerWidth >= 768 && window.innerWidth < 1024,
            isDesktop: () => window.innerWidth >= 1024,

            applyLayout: function () {
                const container = $('#orderDetailsContainer');
                container.removeClass('flex flex-col flex-row space-y-4 p-[16px] p-[20px]');

                if (this.isMobile()) {
                    container.addClass('flex flex-col space-y-4 p-[16px]');
                } else if (this.isTablet()) {
                    container.addClass('flex flex-col lg:flex-row p-[20px]');
                } else {
                    container.addClass('flex flex-row p-[20px]');
                }
            }
        };

        this.layoutManager.applyLayout();

        $('#orderDetailsContainer').html(`
            <div id="orderInfoPanel" class="w-full lg:w-1/3 mb-6 lg:mb-0 lg:pr-2">
                <div class="lg:sticky lg:top-0">
                    ${this.orderActions(orderData, orderId)}
                    ${this.detailsCard(orderData, paymentMethods, payments)}
                </div>
            </div>

            <div id="productDisplayArea" class="w-full lg:w-2/3 lg:pl-2">
                ${this.listProducts(products)}
            </div>
        `);

        return modal;
    }

    // Pildora con contorno del encabezado del detalle. border-[1px] y no `border`: el
    // .border de bootstrap lleva !important y pintaria el contorno gris.
    getBadgeDeliveryType(tipo) {
        if (tipo == 0 || tipo === '0') {
            return `<span class="px-2.5 py-0.5 rounded-full border-[1px] border-blue-500/50 bg-blue-500/10 text-blue-300 text-xs font-semibold inline-flex items-center gap-1">${lucideIcon('store', 'w-3.5 h-3.5')} Local</span>`;
        } else if (tipo == 1 || tipo === '1') {
            return `<span class="px-2.5 py-0.5 rounded-full border-[1px] border-amber-500/50 bg-amber-500/10 text-amber-300 text-xs font-semibold inline-flex items-center gap-1">${lucideIcon('truck', 'w-3.5 h-3.5')} A domicilio</span>`;
        }
        return '<span class="px-2.5 py-0.5 rounded-full border-[1px] border-gray-500/50 bg-gray-500/10 text-gray-300 text-xs font-semibold inline-flex items-center">Sin especificar</span>';
    }

    detailsCard(orderData, paymentMethods = [], payments = []) {
        return `
            <div class="space-y-3">
                ${this.infoOrder(orderData)}
                ${this.infoSales(orderData, paymentMethods, payments)}
            </div>
        `;
    }

    // Acciones del pedido en el panel de detalles. Se pintan igual al abrir el modal y
    // al refrescarlo despues de un cambio, por eso viven en un solo lugar. Editar los
    // datos de entrega no esta aqui: es el boton al pie de la tarjeta que los muestra
    // (editDeliveryButton).
    orderActions(orderData, orderId) {
        const cerrado    = orderData.status == '3' || orderData.status == '4';
        const operable   = !cerrado && orderData.is_delivered != '2';
        const entregable = this.canOperate && (orderData.is_delivered == '0' || orderData.is_delivered == null) && (orderData.status != '4');

        const botones = [];

        if (operable && this.canOperate) botones.push(`
            <button onclick="app.historyPay(${orderId})"
                class="flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-[11px] font-medium px-2 py-2 rounded-md transition-colors">
                ${lucideIcon('dollar-sign', 'w-3.5 h-3.5')} Pagar
            </button>`);

        if (operable) botones.push(`
            <button onclick="app.printOrder(${orderId})"
                class="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium px-2 py-2 rounded-md transition-colors">
                ${lucideIcon('printer', 'w-3.5 h-3.5')} Imprimir
            </button>`);

        if (operable && this.canDiscount) botones.push(`
            <button onclick="app.addDiscount(${orderId})"
                class="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-medium px-2 py-2 rounded-md transition-colors">
                ${lucideIcon('percent', 'w-3.5 h-3.5')} Descuento
            </button>`);

        return `
            ${botones.length ? `
                <div class="grid ${this.actionGridCols(botones.length)} gap-2 mb-3">
                    ${botones.join('')}
                </div>
            ` : ''}
            ${entregable ? `
                <button onclick="app.handleDeliveryClick(${orderId}, ${orderData.is_delivered || 0}, '${orderData.folio || ''}')"
                        class="w-full mb-3 flex items-center justify-center gap-1.5
                            text-white text-[11px] font-medium px-2 py-2 rounded-md
                            glass-purple-btn">
                    Entregar productos
                </button>
            ` : ''}
        `;
    }

    // Columnas del grid de acciones segun cuantos botones quedaron visibles por rol y
    // estado del pedido: una columna por boton, de modo que todos comparten fila.
    actionGridCols(visibles) {
        return ['grid-cols-1', 'grid-cols-2', 'grid-cols-3'][visibles - 1] || 'grid-cols-3';
    }

    handleDeliveryClick(orderId, currentStatus, folio) {
        Swal.fire({
            title: '📦 Actualizar estado de entrega',
            html: `<p class="mb-3">Selecciona el estado del pedido <strong>${folio}</strong></p>`,
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '✓ Entregado',
            denyButtonText: '🎂 Para producir',
            cancelButtonText: '✗ No entregado',
            confirmButtonColor: '#10b981',
            denyButtonColor: '#db2777',
            cancelButtonColor: '#ef4444',
            reverseButtons: false,
            customClass: {
                popup: 'bg-[#1F2A37] text-white rounded-lg shadow-lg px-2',
                title: 'text-2xl font-semibold',
                content: 'text-gray-300',
                confirmButton: 'bg-[#10b981] hover:bg-[#0E9E6E] text-white py-2 px-4 rounded',
                denyButton: 'bg-[#db2777] hover:bg-[#be185d] text-white py-2 px-4 rounded',
                cancelButton: 'bg-[#ef4444] hover:bg-[#dc2626] text-white py-2 px-4 rounded',
            }
        }).then(async (result) => {
            let newStatus = null;

            if (result.isConfirmed) {
                newStatus = 1; // Entregado
            } else if (result.isDenied) {
                newStatus = 2; // Para producir
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                newStatus = 0; // No entregado
            }

            if (newStatus !== null) {
                const response = await useFetch({
                    url: this._link,
                    data: {
                        opc: 'updateDeliveryStatus',
                        id: orderId,
                        is_delivered: newStatus
                    }
                });

                if (response.status == 200) {
                    // Cierra el modal de detalles del pedido
                    this.detailModal?.close();
                     alert({
                        icon: 'success',
                        title: 'Estado actualizado',
                        text: response.message,
                        timer: 2000,
                        showConfirmButton: false
                    });
                    // Recarga el calendario para reflejar el cambio
                    this.createCalendar();
                   
                } else {
                    alert({
                        icon: 'error',
                        title: 'Error',
                        text: response.message,
                        btn1: true,
                        btn1Text: 'Ok'
                    });
                }
            }
        });
    }

    // Editar los datos de entrega va al pie de la tarjeta que los muestra, no en la
    // barra de acciones. Un pedido liquidado (3) lo corrigen admin y supervisores, y
    // ahi la edicion pide contraseña; el resto de los pedidos, cualquiera que opere el
    // calendario. El cancelado (4) no se edita.
    editDeliveryButton(orderData) {
        const liquidado  = orderData.status == '3';
        const autorizado = this.isAdmin || this.isSupervisor;
        const editable   = !this.isProduction && orderData.status != '4' && (!liquidado || autorizado);

        if (!editable) return '';

        return `
            <button onclick="app.editOrderDelivery(${orderData.id})"
                title="${liquidado ? 'Editar datos de entrega (requiere contraseña)' : 'Editar datos de entrega'}"
                class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-600 text-xs font-semibold text-gray-200 hover:text-white hover:bg-white/10 transition-colors">
                ${lucideIcon('pencil', 'w-3.5 h-3.5')}
                Editar entrega
            </button>`;
    }

    // Fecha y hora de entrega van en una sola fila. getOrderID ya las manda con formato
    // de pantalla (12/10/2026 y 04:00 PM). El estado de entrega se muestra en el
    // encabezado del modal. Capturó y Produjo solo los consultan admin (1), SuperAdmin
    // (5) y supervisores (6, 7): seesProduced.
    infoOrder(orderData) {
        const entrega = [orderData.date_order, orderData.time_order].filter(Boolean).join(' · ');

        const fila = (icono, label, valor) => `
                    <div class="flex items-center gap-2">
                        ${lucideIcon(icono, 'w-4 h-4 text-gray-400 shrink-0')}
                        <span class="text-gray-300 text-sm">${label}</span>
                        <span class="text-white font-semibold text-sm ml-auto text-right">${valor || 'N/A'}</span>
                    </div>`;

        return `
            <div class="bg-[#29374A] rounded-xl p-[16px]">
                <h3 class="text-white font-semibold text-base mb-3 flex items-center">
                    ${lucideIcon('info', 'w-4 h-4 text-blue-400 mr-2')}
                    Información del pedido
                </h3>

                <div class="space-y-2.5">
                    ${fila('file-text', 'Folio:', orderData.folio)}
                    ${fila('user', 'Cliente:', orderData.name)}
                    ${fila('clock', 'Creado:', this.formatDateTime(orderData.date_creation))}
                    ${this.seesProduced ? fila('user-pen', 'Capturó:', orderData.created_by_name || 'Sin registro') : ''}
                    ${this.seesProduced ? this.producedByRow(orderData) : ''}
                    ${fila('calendar', 'Entrega:', entrega)}
                </div>

                ${this.editDeliveryButton(orderData)}
            </div>
        `;
    }

    // Quien palomeo el pedido en Produccion y cuando: 09/OCT/2026 10:15pm. produced_at
    // llega de getOrderID como 09/10/2026 10:15 PM. "Sin registro" = la palomita existe
    // pero el usuario ya no esta en usr_users.
    producedByRow(orderData) {
        const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const fecha = moment(orderData.produced_at, 'DD/MM/YYYY hh:mm A', true);

        const value = orderData.produced_at
            ? `<span class="block text-white font-semibold text-sm">${orderData.produced_by_name || 'Sin registro'}</span>
               <span class="block text-gray-400 text-[11px]">${fecha.isValid()
                    ? `${fecha.format('DD')}/${meses[fecha.month()]}/${fecha.format('YYYY')} ${fecha.format('hh:mma')}`
                    : orderData.produced_at}</span>`
            : `<span class="block text-gray-400 font-semibold text-sm">Aún sin producir</span>`;

        return `
                    <div class="flex items-center gap-2">
                        ${lucideIcon('cake', 'w-4 h-4 text-gray-400 shrink-0')}
                        <span class="text-gray-300 text-sm">Produjo:</span>
                        <span class="ml-auto text-right leading-tight">${value}</span>
                    </div>`;
    }

    // border-1 no existe en Tailwind (la utilidad es `border`), por eso las etiquetas
    // quedaban sin contorno. El ancho va como border-[1px] y no como `border` porque
    // bootstrap.min.css se carga despues y su .border lleva !important, con lo que el
    // contorno salia gris en lugar del color del estado. Las clases se guardan enteras
    // y no armadas por concatenacion, que Tailwind no detecta.
    statusDelivery(is_delivered) {
        const estados = {
            '1': { tono: 'bg-green-500/10 border-green-500/50 text-green-300',   icono: 'circle-check', texto: 'Entregado' },
            '2': { tono: 'bg-purple-500/10 border-purple-500/50 text-purple-300', icono: 'cake',         texto: 'Para Producir' }
        };

        const estado = estados[is_delivered]
            || { tono: 'bg-red-500/10 border-red-500/50 text-red-300', icono: 'circle-x', texto: 'No entregado' };

        return `<span class="px-2.5 py-0.5 text-xs font-semibold rounded-full border-[1px] ${estado.tono} inline-flex items-center gap-1 whitespace-nowrap">
                    ${lucideIcon(estado.icono, 'w-3 h-3')} ${estado.texto}
                </span>`;
    }

    formatDateTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(String(dateStr).replace(' ', 'T'));
        if (isNaN(d.getTime())) return dateStr;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    }

    // Fecha de los abonos en el resumen de pago: 12/sep/2026 19:22 pm. El resto del
    // detalle (Creado) sigue con formatDateTime.
    formatPayDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(String(dateStr).replace(' ', 'T'));
        if (isNaN(d.getTime())) return dateStr;
        const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        const ampm = d.getHours() < 12 ? 'am' : 'pm';
        return `${dd}/${meses[d.getMonth()]}/${d.getFullYear()} ${hh}:${mi} ${ampm}`;
    }

    paymentMethodStyle(method) {
        const m = String(method || '').toLowerCase();
        if (m.includes('efect')) return { icon: 'banknote', bg: 'bg-green-500/15', text: 'text-green-400', dot: 'bg-green-400' };
        if (m.includes('tarj') || m.includes('tdc') || m.includes('tarjeta')) return { icon: 'credit-card', bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-400' };
        if (m.includes('transf')) return { icon: 'arrow-right-left', bg: 'bg-purple-500/15', text: 'text-purple-400', dot: 'bg-purple-400' };
        return { icon: 'wallet', bg: 'bg-gray-500/15', text: 'text-gray-300', dot: 'bg-gray-400' };
    }

    infoSales(orderData, paymentMethods = [], payments = []) {
        const totalPay = parseFloat(orderData.total_pay || 0);
        const discount = parseFloat(orderData.discount || 0);
        const totalPaid = parseFloat(orderData.total_paid || 0);
        const balance = parseFloat(orderData.balance || 0);
        const infoDiscount = orderData.info_discount || '';

        // Total a cobrar y avance del pago para la barra: Pagado N% · Faltan $X.
        const total   = totalPay - discount;
        const avance  = total > 0 ? Math.min(100, Math.round(totalPaid / total * 100)) : 0;
        const faltan  = Math.max(balance, 0);

        // Eliminar abono: el mismo boton del historial de pagos (listPayment). Solo el
        // admin (1) y el supervisor (6) borran pagos y aqui siempre confirma con
        // contraseña (ultimo argumento de deletePay). Con el pedido liquidado lleva
        // candado, como en el historial.
        const requiereClave = balance <= 0.009 ? 1 : 0;
        const deleteBtn = (p) => [1, 6].includes(Number(this.rolId)) ? `
                                <button type="button" onclick="app.deletePay(${p.id}, ${orderData.id}, ${requiereClave}, ${parseFloat(p.pay || 0)}, true)"
                                    title="Eliminar pago (requiere contraseña)"
                                    class="${requiereClave ? 'text-amber-400 hover:text-amber-300' : 'text-red-400 hover:text-red-300'} p-1 shrink-0">
                                    ${lucideIcon(requiereClave ? 'lock' : 'trash-2', 'w-3.5 h-3.5')}
                                </button>` : '';

        // Historial detallado: cada abono con su fecha y metodo, sin agrupar.
        // Si no llega el historial, se cae al resumen agrupado por metodo.
        const methodsHtml = (Array.isArray(payments) && payments.length > 0) ? `
                    <div class="border-l-2 border-gray-600 pl-3">
                        <span class="text-gray-400 text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5 mb-1">
                            ${lucideIcon('clock', 'w-3.5 h-3.5')}
                            Abonos (${payments.length})
                        </span>
                        <div class="divide-y divide-gray-600/60">
                            ${payments.map(p => {
                                const st = this.paymentMethodStyle(p.method_pay);
                                return `
                            <div class="flex items-center justify-between gap-2 py-2">
                                <div class="flex flex-col min-w-0">
                                    <span class="text-white text-xs font-semibold flex items-center gap-1.5">
                                        ${lucideIcon(st.icon, 'w-3.5 h-3.5 ' + st.text)}
                                        ${p.method_pay || 'Sin método'}
                                    </span>
                                    <span class="text-gray-500 text-[11px]">${this.formatPayDate(p.date_pay)}</span>
                                </div>
                                <span class="flex items-center gap-1 ml-auto">
                                    <span class="text-green-400 font-bold text-sm whitespace-nowrap">${formatPrice(p.pay)}</span>
                                    ${deleteBtn(p)}
                                </span>
                            </div>
                            `;
                            }).join('')}
                        </div>
                    </div>
        ` : (Array.isArray(paymentMethods) && paymentMethods.length > 0) ? `
                    <div class="pl-3 space-y-1 border-l-2 border-gray-600">
                        ${paymentMethods.map(m => `
                        <div class="flex items-center justify-between">
                            <span class="text-gray-400 text-xs flex items-center gap-1.5">
                                ${lucideIcon('credit-card', 'w-3.5 h-3.5')}
                                ${m.method_pay || 'Sin método'}:
                            </span>
                            <span class="text-gray-300 text-xs">${formatPrice(m.pay)}</span>
                        </div>
                        `).join('')}
                    </div>
        ` : '';

        const discountHtml = discount > 0 ? `
                    <div>
                        <div class="flex items-center justify-between">
                            <span class="text-gray-300 text-sm">Descuento:</span>
                            <span class="text-amber-400 font-bold text-sm">−${formatPrice(discount)}</span>
                        </div>
                        ${infoDiscount ? `<span class="block text-gray-500 text-[11px] italic mt-0.5">${infoDiscount}</span>` : ''}
                    </div>
        ` : '';

        return `
            <div class="bg-[#29374A] rounded-xl p-[16px]">
                <h3 class="text-white font-semibold text-base mb-3 flex items-center">
                    ${lucideIcon('dollar-sign', 'w-4 h-4 text-green-400 mr-2')}
                    Resumen de pago
                </h3>

                <div class="space-y-2.5">
                    <div class="flex items-center justify-between">
                        <span class="text-gray-300 text-sm">Subtotal:</span>
                        <span class="text-white font-bold text-sm">${formatPrice(totalPay)}</span>
                    </div>

                    ${discountHtml}

                    <div class="flex items-center justify-between">
                        <span class="text-gray-300 text-sm">Total:</span>
                        <span class="text-white font-bold text-base">${formatPrice(total)}</span>
                    </div>

                    <div>
                        <div class="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                            <div class="h-full rounded-full bg-emerald-400" style="width:${avance}%"></div>
                        </div>
                        <div class="flex items-center justify-between mt-1.5 text-[11px]">
                            <span class="text-emerald-400 font-semibold">Pagado: ${avance}%</span>
                            <span class="text-gray-400">Faltan ${formatPrice(faltan)}</span>
                        </div>
                    </div>

                    <div class="flex items-center justify-between">
                        <span class="text-gray-300 text-sm">Pagado:</span>
                        <span class="text-green-400 font-bold text-sm">${formatPrice(totalPaid)}</span>
                    </div>

                    ${methodsHtml}

                    <div class="flex items-center justify-between pt-1">
                        <span class="text-gray-300 text-sm">Saldo:</span>
                        <span class="text-red-400 font-bold text-sm">${formatPrice(balance)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    listProducts(products) {



        if (!products || products.length === 0) {
            return `
                <div class="bg-[#283341] rounded-lg p-2 text-center h-full flex flex-col items-center justify-center">
                    ${lucideIcon('shopping-basket', 'w-12 h-12 text-gray-500 mb-4')}
                    <h3 class="text-white text-lg font-semibold mb-2">No hay productos</h3>
                    <p class="text-gray-400">Este pedido no contiene productos.</p>
                </div>
            `;
        }

        const totalItems = products.reduce((acc, item) => acc + parseInt(item.quantity || 1), 0);

        // Sin scroll propio: la lista crece y lo que se desplaza es el contenedor del
        // modal (#orderDetailsContainer), con una sola barra.
        return `
            <div class="flex flex-col">
                <div class="bg-[#29374A] rounded-xl px-[16px] py-[12px] mb-3 flex items-center justify-between">
                    <h3 class="text-white font-semibold text-base flex items-center">
                        ${lucideIcon('shopping-bag', 'w-4 h-4 mr-2 text-blue-400')}
                        Productos del pedido
                    </h3>
                    <span class="text-gray-400 text-sm">${totalItems} productos</span>
                </div>
                <div id="productsContainer" class="space-y-3">
                    ${products.map(product =>
                        product.is_custom || (product.customer_products && product.customer_products.length > 0)
                            ? this.cardCustom(product)
                            : this.cardNormal(product)
                    ).join('')}
                </div>
            </div>
        `;
    }

    cardNormal(product) {
        const total = parseFloat(product.price || 0) * parseInt(product.quantity || 1);
        const hasDedication = product.dedication && product.dedication.trim() !== '';
        const hasDetails = product.order_details && product.order_details.trim() !== '';

        // Si la linea trae fotos propias (order_images) se muestran con la misma galeria
        // del personalizado; si no, la miniatura del producto del catalogo.
        const hasPhotos = Array.isArray(product.images) && product.images.length > 0;
        const photo = hasPhotos
            ? `<div class="sm:w-[190px] shrink-0">${this.customGallery(product)}</div>`
            : `<div class="w-14 h-14 rounded-lg overflow-hidden bg-[#D8B4E2] flex-shrink-0">
                    ${this.renderProductImage(product)}
                </div>`;

        return `
            <div class="bg-[#29374A] rounded-xl p-[16px] flex items-start gap-[16px]">
                ${photo}

                <div class="flex-1 min-w-0">
                    <h4 class="text-white font-bold text-sm uppercase">${product.name || 'Producto sin nombre'}</h4>
                    <p class="text-blue-400 text-xs mt-0.5">${formatPrice(product.price)} c/u</p>

                    ${hasDedication ? `
                    <p class="text-gray-400 text-xs mt-3">Dedicatoria:</p>
                    <p class="text-white text-xs font-semibold">${product.dedication}</p>
                    ` : ''}
                    ${hasDetails ? `
                    <p class="text-gray-400 text-xs mt-2">Observaciones:</p>
                    <p class="text-white text-xs font-semibold">${product.order_details}</p>
                    ` : ''}
                </div>

                <div class="self-stretch flex flex-col items-end justify-between gap-3 text-right shrink-0">
                    <span class="text-gray-400 text-sm">Cantidad: <span class="text-white font-bold">${product.quantity || 1}</span></span>
                    <div>
                        <span class="text-gray-400 text-xs block">Importe</span>
                        <p class="text-white font-bold text-lg">${formatPrice(total)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    cardCustom(product) {
        const hasDedication    = product.dedication && product.dedication.trim()       !== '';
        const hasDetails       = product.order_details && product.order_details.trim() !== '';
        const hasCustomization = product.customer_products && product.customer_products.length > 0;

        // price es order_custom.price_real: el precio que se cobra y que ya incluye la
        // personalizacion. El total de la linea es ese precio por la cantidad, igual que
        // lo suma updateTotalOrder() en total_pay.
        const total = parseFloat(product.price || 0) * parseInt(product.quantity || 1);

        return `
        <div class="bg-[#29374A] rounded-xl p-[16px]">
            <div class="flex items-center justify-between gap-3 mb-3">
                <div class="flex items-center gap-2 min-w-0">
                    <h4 class="text-white font-bold text-sm uppercase truncate">${product.name || 'Pastel Personalizado'}</h4>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300 shrink-0">Personalizado</span>
                </div>
                <span class="text-gray-400 text-sm shrink-0">Cantidad: <span class="text-white font-bold">${product.quantity || 1}</span></span>
            </div>

            <div class="flex flex-col sm:flex-row gap-[16px]">
                <div class="sm:w-[190px] shrink-0">${this.customGallery(product)}</div>

                <div class="flex-1 min-w-0 space-y-3">
                    <div>
                        <p class="text-gray-400 text-xs">Porción:</p>
                        <p class="text-white text-sm font-semibold">${product.portion_qty || 1} personas</p>
                    </div>
                    ${hasDedication ? `
                    <div>
                        <p class="text-gray-400 text-xs">Dedicatoria:</p>
                        <p class="text-white text-sm font-semibold">${product.dedication}</p>
                    </div>
                    ` : ''}
                    ${hasDetails ? `
                    <div>
                        <p class="text-gray-400 text-xs">Observaciones:</p>
                        <p class="text-white text-sm font-semibold">${product.order_details}</p>
                    </div>
                    ` : ''}
                </div>
            </div>

            ${hasCustomization ? `
            <div class="border-t border-gray-600/60 mt-[16px] pt-[16px]">
                <h5 class="text-purple-300 font-bold text-xs uppercase tracking-wide mb-3">Personalización</h5>
                ${this.renderPersonalizationGrid(product.customer_products)}
            </div>
            ` : ''}

            <div class="text-right mt-3">
                <span class="text-gray-400 text-xs block">Importe</span>
                <p class="text-emerald-400 font-bold text-lg">${formatPrice(total)}</p>
            </div>
        </div>
    `;
    }

    // Fotos de referencia del pastel personalizado: la grande con su contador y las
    // miniaturas numeradas. Clic en una miniatura la pasa a la grande (selectCustomImage)
    // y clic en la grande la amplia. La vista previa lee el src de la <img> y no la
    // ruta original: si la foto solo existe en produccion, fileUrlFallback() ya la cambio.
    customGallery(product) {
        const images = Array.isArray(product.images) ? product.images : [];

        if (!images.length) {
            return `
                <div class="w-40 h-40 rounded-lg bg-[#D8B4E2] flex items-center justify-center">
                    ${lucideIcon('cake', 'w-10 h-10 text-white')}
                </div>`;
        }

        const total = images.length;
        const first = images[0];

        const thumbs = total > 1 ? `
            <div class="flex flex-wrap gap-1.5 mt-2">
                ${images.map((img, i) => `
                <button type="button" onclick="app.selectCustomImage(this, ${product.id})"
                    class="relative w-6 h-6 rounded overflow-hidden bg-gray-700 ${i === 0 ? 'ring-2 ring-blue-500' : ''}">
                    <img src="${fileUrl(img.path)}" alt="${img.original_name || 'Imagen'}"
                         onerror="app.productImageError(this)"
                         class="object-cover w-full h-full pointer-events-none">
                    <span class="absolute bottom-0 right-0 px-0.5 rounded-tl bg-black/70 text-[8px] font-bold leading-tight text-white">${i + 1}</span>
                </button>`).join('')}
            </div>` : '';

        return `
            <div class="relative w-40 h-40 rounded-lg overflow-hidden bg-gray-700 cursor-pointer"
                 onclick="app.previewImage(this.querySelector('img').src, this.querySelector('img').alt)">
                <img id="customMain${product.id}" src="${fileUrl(first.path)}" alt="${first.original_name || 'Imagen'}"
                     onerror="app.productImageError(this)"
                     class="object-cover w-full h-full pointer-events-none">
                <span id="customCount${product.id}" class="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[11px] font-semibold text-white">1 / ${total}</span>
                <span class="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-md bg-black/60 flex items-center justify-center text-white">${lucideIcon('zoom-in', 'w-4 h-4')}</span>
            </div>
            ${thumbs}
            <p class="text-gray-500 text-[11px] mt-2">${total} ${total === 1 ? 'foto' : 'fotos'} de referencia · clic para ampliar</p>
        `;
    }

    // La miniatura elegida pasa a la foto grande y se marca con el anillo azul.
    selectCustomImage(thumb, packageId) {
        const $thumb = $(thumb);
        const $img   = $thumb.find('img');

        if ($img.length) {
            $(`#customMain${packageId}`).attr({ src: $img.attr('src'), alt: $img.attr('alt') });
        }

        $(`#customCount${packageId}`).text(`${$thumb.index() + 1} / ${$thumb.parent().children().length}`);
        $thumb.addClass('ring-2 ring-blue-500').siblings().removeClass('ring-2 ring-blue-500');
    }

    renderProductImage(product) {
        const hasImage = product.image && product.image.trim() !== '';

        if (hasImage) {
            const imageUrl = fileUrl(product.image);
            // La vista previa toma this.src y no imageUrl: si fileUrlFallback() cambio
            // la ruta porque la original fallo, se amplia la que si cargo.
            return `
                <img src="${imageUrl}" alt="${product.name}"
                     class="object-cover w-full h-full cursor-pointer hover:opacity-80 transition-opacity"
                     onclick="app.previewImage(this.src, this.alt)"
                     onerror="app.productImageError(this)">
            `;
        } else {
            return `
                <div class="w-full h-full flex items-center justify-center">
                    ${lucideIcon('cake', 'w-6 h-6 text-white')}
                </div>
            `;
        }
    }

    // Foto de producto que no carga. Las fotos viejas solo viven en el servidor de
    // produccion: primero se reintenta ahi (fileUrlFallback) y, si tampoco esta, se
    // pone el icono de pastel en su lugar. El recuadro deja de abrir la vista previa
    // porque ya no hay foto que ampliar.
    productImageError(img) {
        if (!img.dataset.fileFallback) return fileUrlFallback(img);

        const $box = $(img).parent();

        $box.removeAttr('onclick').removeClass('cursor-pointer hover:opacity-80 transition-opacity');
        $box.addClass('flex items-center justify-center');
        $(img).replaceWith(lucideIcon('cake', 'w-1/2 h-1/2 text-white'));
    }

    // Modificadores agrupados por categoria (Relleno, Cobertura...), en dos columnas.
    // Cada opcion lleva su precio de modificador, o "Incluida" si no tiene costo.
    renderPersonalizationGrid(customizations) {
        const grouped = {};

        customizations.forEach(item => {
            const category = `${item.modifier_name || ''}:`;
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(item);
        });

        const precio = (item) => {
            const price = parseFloat(item.custom_price || 0);
            const qty   = parseInt(item.custom_quantity || 1);
            if (price <= 0) return 'Incluida';
            return `${qty > 1 ? qty + ' × ' : ''}+${formatPrice(price)}`;
        };

        return `
            <div class="grid grid-cols-2 gap-x-6 gap-y-3">
                ${Object.entries(grouped).map(([category, items]) => `
                    <div class="flex flex-col">
                        <span class="text-purple-300 font-bold text-[11px] tracking-wide uppercase">${category}</span>
                        ${items.map(item => `
                            <span class="text-white font-semibold text-sm">${item.name || 'N/A'}</span>
                            <span class="text-gray-400 text-[11px]">${precio(item)}</span>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        `;
    }

    // =============================================
    // Migrado desde app.js - Descuentos
    // =============================================

    // El guardado de los modales (createModalForm) sale por this._link, asi que se
    // apunta al ctrl de pedidos y se restaura al cerrar. Solo se recuerda el link del
    // calendario si no estaba ya cambiado: dos modales seguidos (pagar y luego editar)
    // lo perderian y el calendario dejaria de recargar.
    _switchToPedidos() {
        if (this._link !== this._pedidosLink) this._calendarLink = this._link;
        this._link = this._pedidosLink;
    }

    _restoreLink() {
        this._link = this._calendarLink;
    }

    async refreshOrderDetails(orderId) {
        const response = await useFetch({
            url: this._pedidosLink,
            data: { opc: 'getOrderDetails', id: orderId }
        });
        const orderData = response.data.order || {};
        const paymentMethods = response.data.paymentMethods || [];
        const payments = response.data.payments || [];
        $('#orderInfoPanel .lg\\:sticky').html(`
            ${this.orderActions(orderData, orderId)}
            ${this.detailsCard(orderData, paymentMethods, payments)}
        `);
        // El tipo y el estado de entrega se muestran en el encabezado, fuera del panel.
        $('#orderDeliveryBadge').html(this.getBadgeDeliveryType(orderData.delivery_type));
        $('#orderStatusBadge').html(this.statusDelivery(orderData.is_delivered));
    }

    // Edicion acotada desde el calendario: solo los datos de entrega (fecha, hora,
    // tipo y descripcion). Cliente, productos y cobros se siguen editando desde el
    // listado de pedidos, que tiene el flujo completo y sus autorizaciones.
    async editOrderDelivery(id, password = null) {
        const response = await useFetch({
            url: this._pedidosLink,
            data: { opc: 'getOrderDelivery', id: id }
        });

        if (response.status != 200) {
            alert({
                icon: 'error',
                title: 'Error',
                text: response.message,
                btn1: true,
                btn1Text: 'Ok'
            });
            return;
        }

        // El tipo de entrega queda fuera del autofill: sus dos radios comparten name y
        // el autofill hace .val() sobre TODOS los inputs que lo comparten, con lo que
        // los dos acabarian con el mismo value. Se marca a mano al final.
        const order = response.data;
        const { delivery_type, ...autofill } = order;

        // Pedido liquidado: la contraseña se pide antes de abrir el formulario y se
        // reenvia en data para que editOrderDelivery (ctrl) la revalide al guardar.
        const liquidado = order.status == 3;

        if (liquidado && !password) {
            this.editOrderDeliveryPaid(id);
            return;
        }

        this._switchToPedidos();

        this.createModalForm({
            id: 'formEditDelivery',
            data: password
                ? { opc: 'editOrderDelivery', id: id, password: password }
                : { opc: 'editOrderDelivery', id: id },
            autofill: autofill,
            bootbox: {
                title: `<div class="flex items-center gap-2 text-white text-lg font-semibold">
                            ${lucideIcon('calendar', 'w-5 h-5 text-blue-400')}
                            Editar datos de entrega
                        </div>`,
                size: 'medium'
            },
            json: [
                ...(liquidado ? [{
                    opc: "div",
                    id: "paidOrderNotice",
                    class: "col-12 mb-3",
                    html: `
                        <div class="flex items-center gap-3 bg-amber-500/10 rounded-lg px-3 py-2">
                            <i class="icon-lock text-amber-400 text-lg"></i>
                            <div class="text-xs leading-relaxed">
                                <b class="text-amber-100 block">Pedido liquidado — edición autorizada</b>
                                <span class="text-amber-200/80">Solo se guardarán los datos de entrega.</span>
                            </div>
                        </div>
                    `
                }] : []),
                {
                    opc: "input",
                    id: "date_order",
                    lbl: "Fecha de entrega",
                    type: "date",
                    class: "col-12 col-sm-6 mb-3",
                    required: true
                },
                {
                    opc: "input",
                    id: "time_order",
                    lbl: "Hora de entrega",
                    type: "time",
                    class: "col-12 col-sm-6 mb-3",
                    required: true
                },
                {
                    opc: "div",
                    id: "radioDeliveryType",
                    lbl: "Tipo de entrega",
                    class: "col-12 mb-3",
                    html: `
                        <div class="flex gap-2 mt-2">
                            <label class="w-1/2 shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 cursor-pointer select-none transition-colors text-gray-300 hover:bg-white/10 has-[:checked]:bg-indigo-500/[12.5%] has-[:checked]:text-white">
                                <input
                                    class="h-4 w-4 shrink-0 accent-indigo-500 cursor-pointer"
                                    type="radio"
                                    name="delivery_type"
                                    id="local"
                                    value="0"
                                    onclick="this.value='0'"
                                >
                                ${lucideIcon('store', 'w-4 h-4')}
                                <span class="text-sm font-medium">Local</span>
                            </label>

                            <label class="w-1/2 shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 cursor-pointer select-none transition-colors text-gray-300 hover:bg-white/10 has-[:checked]:bg-indigo-500/[12.5%] has-[:checked]:text-white">
                                <input
                                    class="h-4 w-4 shrink-0 accent-indigo-500 cursor-pointer"
                                    type="radio"
                                    name="delivery_type"
                                    id="domicilio"
                                    value="1"
                                    onclick="this.value='1'"
                                >
                                <i class="icon-motorcycle text-amber-500"></i>
                                <span class="text-sm font-medium">A domicilio</span>
                            </label>
                        </div>
                    `
                },
                {
                    opc: "textarea",
                    id: "note",
                    lbl: "Descripción",
                    rows: 3,
                    class: "col-12 mb-3",
                    required: false
                }
            ],
            success: (response) => {
                this._restoreLink();

                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Pedido actualizado",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });

                    this.refreshOrderDetails(id);
                    // La fecha de entrega manda la posicion del pedido en el calendario.
                    this.createCalendar();
                } else {
                    alert({
                        icon: "error",
                        title: "Error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });

        // El link vuelve al calendario aunque se cierre el modal sin guardar.
        $('#formEditDelivery').closest('.bootbox').one('hidden.bs.modal', () => this._restoreLink());

        $(`#formEditDelivery input[name="delivery_type"][value="${String(delivery_type ?? 0)}"]`).prop('checked', true);
    }

    // Pedido liquidado: pide la contraseña antes de abrir el formulario de entrega, el
    // mismo flujo que editOrderPaid en el listado. Se valida aqui para no descubrir una
    // clave mal escrita hasta despues de capturar los cambios; la autorizacion real la
    // vuelve a exigir editOrderDelivery() del controlador al guardar.
    editOrderDeliveryPaid(id) {
        this.alertBox({
            theme:       'dark',
            type:        'cancel',
            icon:        'lock',
            title:       'Pedido liquidado',
            detailHtml:  'Este pedido ya se liquidó (está pagado completo). Cambiar sus datos de entrega requiere autorización: ingresa tu contraseña para continuar.',
            input:       'password',
            inputLabel:  'Contraseña',
            inputPlaceholder: '••••••••',
            inputRequired: true,
            inputError:  'Ingresa tu contraseña',
            okLabel:     'Continuar',
            cancelLabel: 'Cancelar',
            onOk: async (password) => {
                const res = await useFetch({
                    url: this._pedidosLink,
                    data: { opc: 'verifyOrderDeliveryKey', id: id, password: password }
                });

                if (res.status !== 200) {
                    // Contraseña rechazada: se avisa y se vuelve a abrir el dialogo,
                    // porque alertBox ya se cerro al confirmar.
                    this.alertBox({
                        theme:      'dark',
                        type:       'error',
                        title:      'No se puede editar',
                        detailHtml: res.message || 'Contraseña incorrecta.',
                        okLabel:    'Reintentar',
                        onOk:       () => this.editOrderDeliveryPaid(id)
                    });
                    return;
                }

                this.editOrderDelivery(id, password);
            }
        });
    }

    async addDiscount(id) {
        const discountInfo = await useFetch({
            url: this._pedidosLink,
            data: { opc: "getDiscount", id: id }
        });

        const totalPay = parseFloat(discountInfo.data?.total_pay) || 0;
        const currentDiscount = parseFloat(discountInfo.data?.discount) || 0;
        const hasDiscount = currentDiscount > 0;

        this._switchToPedidos();
        this.createModalForm({
            id: 'formAddDiscount',
            data: { opc: 'addDiscount', id: id },
            autofill: discountInfo.data,
            bootbox: {
                title: '<i class="icon-percent text-green-400"></i> Aplicar Descuento',
                size: 'medium'
            },
            json: [
                {
                    opc: "input-group",
                    id: "total_pay",
                    lbl: "Total del pedido",
                    icon: 'icon-dollar',
                    disabled: true,
                    tipo: "cifra",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input-group",
                    id: "discount",
                    lbl: "Monto del descuento",
                    icon: 'icon-dollar',
                    tipo: "cifra",
                    class: "col-12 mb-3",
                    placeholder: "$ 0.00",
                    required: true,
                    onkeyup: `app.calculateDiscounted(${totalPay})`
                },
                {
                    opc: "input",
                    id: "info_discount",
                    lbl: "Motivo del descuento",
                    class: "col-12 mb-3",
                    placeholder: "Ej: CLIENTE FRECUENTE",
                    required: true
                },
                ...(hasDiscount ? [{
                    opc: "button",
                    id: "btnRemoveDiscount",
                    color_btn: "outline-danger",
                    className: 'w-100',
                    text: "Quitar descuento actual",
                    class: "col-12",
                    onClick: () => {
                        this.removeDiscount(id, {
                            discount: currentDiscount,
                            reason: discountInfo.data?.info_discount || '',
                            total: totalPay
                        });
                        $('#formAddDiscount').closest('.bootbox').modal('hide');
                    }
                }] : []),
                {
                    opc: "div",
                    id: "totalDescontado",
                    class: 'col-12',
                    html: `
                        <div class="w-full mt-3 text-center bg-[#1E293B] p-4 rounded-lg">
                            <p class="text-sm text-gray-400 font-medium mb-1">Total con Descuento</p>
                            <p id="TotalConDescuento" class="text-2xl text-white font-bold">${formatPrice(totalPay)}</p>
                        </div>
                    `
                }
            ],
            success: (response) => {
                this._restoreLink();
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Descuento aplicado",
                        text: response.message,
                        btn1: true
                    });
                    this.refreshOrderDetails(id);
                } else {
                    alert({
                        icon: "error",
                        title: "Error",
                        text: response.message,
                        btn1: true
                    });
                }
            }
        });

        this.calculateDiscounted(totalPay);
    }

    calculateDiscounted(totalOriginal) {
        const descuentoInput = document.getElementById("discount");
        const saldoElement = document.getElementById("TotalConDescuento");
        const applyBtn = document.querySelector(".bootbox .btn-primary");

        if (descuentoInput && saldoElement && applyBtn) {
            const saldoOriginal = parseFloat(totalOriginal) || 0;
            const descuento = parseFloat(descuentoInput.value) || 0;
            const nuevoTotal = saldoOriginal - descuento;

            const totalFormateado = nuevoTotal.toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN",
                minimumFractionDigits: 2
            });

            saldoElement.textContent = totalFormateado;

            if (nuevoTotal < 0) {
                saldoElement.classList.add("text-red-500");
                saldoElement.classList.remove("text-white");
            } else {
                saldoElement.classList.remove("text-red-500");
                saldoElement.classList.add("text-white");
            }

            applyBtn.disabled = nuevoTotal < 0;
        }
    }

    removeDiscount(id, orderData) {
        const { discount, reason, total } = orderData;

        this._switchToPedidos();
        this.createModalForm({
            id: "modalQuitarDescuento",
            parent: "root",
            data: { opc: "deleteDiscount", id: id },
            class: "",
            json: [
                {
                    opc: "div",
                    id: "bloqueDescuentoActual",
                    class: "col-12",
                    html: `
                        <div class="bg-[#334155] text-red-400 p-4 rounded-lg mb-3">
                            <p class="text-sm">Descuento actual:</p>
                            <p class="text-lg font-bold">-${formatPrice(discount)}</p>
                            <p class="text-sm text-white">${reason || 'Sin motivo especificado'}</p>
                        </div>
                    `
                },
                {
                    opc: "div",
                    id: "bloquePrecioSinDescuento",
                    class: "col-12",
                    html: `
                        <div class="bg-[#1E293B] p-4 rounded-lg text-center mb-3">
                            <p class="text-sm text-gray-400">Precio sin descuento</p>
                            <p class="text-2xl font-bold text-white">${formatPrice(total)}</p>
                        </div>
                    `
                },
                {
                    opc: "div",
                    id: "mensajeConfirmacion",
                    class: "col-12 text-center",
                    html: `<p class="text-sm text-gray-400">¿Estás seguro de que deseas quitar el descuento aplicado?</p>`
                }
            ],
            bootbox: {
                title: '<i class="icon-tag text-yellow-400"></i> Quitar Descuento',
                closeButton: true
            },
            success: (response) => {
                this._restoreLink();
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Descuento eliminado",
                        text: response.message,
                        btn1: true
                    });
                    this.refreshOrderDetails(id);
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true
                    });
                }
            }
        });
    }

    async editDiscount(id) {
        const discountInfo = await useFetch({
            url: this._pedidosLink,
            data: { opc: "getDiscount", id: id }
        });

        const data = discountInfo.data || {};
        const totalPay = parseFloat(data.total_pay) || 0;

        this._switchToPedidos();
        this.createModalForm({
            id: 'formEditDiscount',
            data: { opc: 'editDiscount', id: id },
            bootbox: {
                title: '<i class="icon-pencil text-yellow-400"></i> Editar Descuento',
                size: 'medium'
            },
            autofill: {
                discount: data.discount,
                info_discount: data.info_discount
            },
            json: [
                {
                    opc: "div",
                    id: "infoActual",
                    class: "col-12 mb-3",
                    html: `
                        <div class="bg-[#334155] p-3 rounded-lg">
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-400">Total del pedido:</span>
                                <span class="text-white font-semibold">${formatPrice(totalPay)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Descuento actual:</span>
                                <span class="text-red-400 font-semibold">-${formatPrice(data.discount)}</span>
                            </div>
                        </div>
                    `
                },
                {
                    opc: "input-group",
                    id: "discount",
                    lbl: "Nuevo monto del descuento",
                    icon: 'icon-dollar',
                    tipo: "cifra",
                    class: "col-12 mb-3",
                    placeholder: "$ 0.00",
                    required: true,
                    onkeyup: `app.calculateDiscounted(${totalPay})`
                },
                {
                    opc: "input",
                    id: "info_discount",
                    lbl: "Motivo del cambio",
                    class: "col-12 mb-3",
                    placeholder: "Ej: AJUSTE DE PRECIO"
                },
                {
                    opc: "div",
                    id: "totalDescontado",
                    class: 'col-12',
                    html: `
                        <div class="w-full mt-3 text-center bg-[#1E293B] p-4 rounded-lg">
                            <p class="text-sm text-gray-400 font-medium mb-1">Total con Descuento</p>
                            <p id="TotalConDescuento" class="text-2xl text-white font-bold">${formatPrice(totalPay - data.discount)}</p>
                        </div>
                    `
                }
            ],
            success: (response) => {
                this._restoreLink();
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Descuento actualizado",
                        text: response.message,
                        btn1: true
                    });
                    this.refreshOrderDetails(id);
                } else {
                    alert({
                        icon: "error",
                        title: "Error",
                        text: response.message,
                        btn1: true
                    });
                }
            }
        });

        this.calculateDiscounted(totalPay);
    }

    deleteDiscount(id) {
        this._switchToPedidos();
        this.swalQuestion({
            opts: {
                title: '¿Eliminar descuento?',
                html: `¿Estás seguro de eliminar el descuento de este pedido?
                <br><br>
                <span class="text-yellow-500">El total del pedido volverá a su valor original.</span>`,
                icon: 'warning'
            },
            data: { opc: 'deleteDiscount', id: id },
            methods: {
                request: (response) => {
                    this._restoreLink();
                    alert({
                        icon: 'success',
                        title: 'Descuento eliminado',
                        text: response.message,
                        btn1: true
                    });
                    this.refreshOrderDetails(id);
                }
            }
        });
    }

    // =============================================
    // Migrado desde app.js - Imprimir Pedido
    // =============================================

    async printOrder(id) {
        const pos = await useFetch({
            url: this._pedidosLink,
            data: { opc: "getOrderDetails", id: id }
        });

        const modal = bootbox.dialog({
            closeButton: true,
            title: `<div class="flex items-center gap-2 text-white text-lg font-semibold">
                        <i class="icon-print text-blue-400 text-xl"></i>
                        Imprimir
                    </div>`,
            message: `
                <div class="p-2">
                    <div id="containerPrintOrder"></div>
                </div>
            `
        });

        // Usa CatalogProduct (pedidos-catalogo.js) para generar el ticket
        const printer = new CatalogProduct(this._pedidosLink, 'root');
        printer.ticketPasteleria({
            parent: 'containerPrintOrder',
            data: {
                head: pos.data.order,
                products: pos.data.products,
                paymentMethods: pos.data.paymentMethods || [],
                clausules: pos.data.clausules || []
            }
        });
    }

    // =============================================
    // Migrado desde app.js - Historial de Pagos
    // =============================================

    async historyPay(id) {
        this._switchToPedidos();

        const data  = await useFetch({ url: this._link, data: { opc: 'initHistoryPay', id } });
        const order = data.order;

        // El candado de turno de la sucursal que cobra se decide con este snapshot.
        await this.refreshSubsidiariesCobro();

        // Escala del modal. El diseño no cambia: se dibuja mas chico, igual que con el
        // zoom del navegador al 75%. Los anchos de abajo van en coordenadas sin escalar,
        // asi que el ancho real en pantalla es el valor por ZOOM.
        const ZOOM = 0.75;

        // El ancho lo manda el tab: el formulario de pago se descuadra si el modal se
        // estira, y el historial son 6 columnas (fecha, metodo, monto, sucursal,
        // observacion y acciones) que no caben en el ancho del formulario. El tope
        // por vw evita que el modal se salga en pantallas chicas.
        const WIDTH_PAY     = '600px';
        // En px: con la transicion activa el navegador no interpola entre una longitud
        // y una funcion como min(), y el ancho se quedaba clavado en el valor anterior.
        const WIDTH_HISTORY = Math.min(820, Math.round(window.innerWidth * 0.95 / ZOOM)) + 'px';
        // La tarjeta del modal es ANCESTRO de #modalAdvance, no descendiente: el ancho
        // se toca por la referencia que devuelve el componente.
        const setModalWidth = width => this.payModal?.el.find('.cf-card').css('max-width', width);

        // createCoffeeModalForm no maneja pestañas, asi que el contenido va como bloque
        // 'html' y el tabLayout se monta dentro. El wrapper conserva el id modalAdvance
        // porque index.php cuelga de el la regla que colapsa los <label> vacios del
        // plugin de formularios.
        const modal = createCoffeeModalForm({
            id: 'frmHistoryPay',
            title: 'Gestión de Pagos',
            iconSvg: lucideIcon('wallet', 'w-5 h-5'),
            iconBg: 'bg-blue-600',
            theme: 'dark',
            width: 600,
            confirmText: 'Registrar Pago',
            confirmBg: 'bg-blue-600 hover:bg-blue-700',
            json: [
                {
                    opc: 'html',
                    html: '<div id="modalAdvance"><div id="containerChat"></div></div>'
                }
            ],
            // El submit del formulario ya trae su propia confirmacion, asi que el boton
            // del modal solo lo dispara. Se devuelve false para que el modal siga abierto:
            // lo cierra el flujo de exito del pago.
            onConfirm: () => {
                document.getElementById('form-payment')?.requestSubmit();
                return false;
            }
        });

        this.payModal = modal;

        // El diseño se mantiene tal cual y se dibuja al 75%, que es como se ve bien con
        // el zoom del navegador en esa escala. zoom (no transform: scale) porque rehace
        // el layout: la tarjeta ocupa de verdad menos espacio y los clics siguen cayendo
        // donde toca. El max-height es solo una red de seguridad para pantallas bajas.
        const $card = modal.el.find('.cf-card');

        $card.css({
            'zoom':           ZOOM,
            'max-height':     Math.round(92 / ZOOM) + 'vh',
            'display':        'flex',
            'flex-direction': 'column',
            'overflow':       'hidden',
            'transition':     'max-width .2s ease'
        });

        $card.children('.space-y-3').css({ 'overflow-y': 'auto', 'flex': '1 1 auto', 'min-height': '0' });

        // Folio y fecha como subtitulo del encabezado, aprovechando el hueco que deja el
        // icono: en su propia linea gastaban una fila entera del cuerpo. El componente no
        // admite subtitulo por opciones, asi que se inserta sobre el header ya montado.
        const $header = $card.children().first();
        const $titulo = $header.find('span').first();

        $header.removeClass('items-center mb-3').addClass('items-start mb-2');
        $titulo.wrap('<div class="flex-1 min-w-0"></div>').after(`
            <p class="text-[13px] text-gray-400 flex items-center gap-3 mt-0.5">
                <span class="flex items-center gap-1.5">
                    ${lucideIcon('file-text', 'w-3.5 h-3.5')}
                    Folio <b class="text-blue-400 font-semibold">${order.folio}</b>
                </span>
                <span class="flex items-center gap-1.5">
                    ${lucideIcon('calendar', 'w-3.5 h-3.5')}
                    ${order.formatted_date_order || order.date_order}
                </span>
            </p>`);

        // Se elimina el boton cancelar del componente: el modal ya se cierra con la X,
        // Escape o clic fuera, y sin el hermano el de registrar (flex-1) toma el ancho
        // completo. El footer entero se oculta en el historial, donde no hay que
        // registrar nada y un boton suelto solo estorba.
        modal.el.find('.cf-cancel').remove();
        const footerBtns = modal.el.find('.cf-confirm').parent();

        this.tabLayout({
            parent: 'containerChat',
            theme: 'dark',
            class: '',
            json: [
                { id: 'payment', tab: 'Registrar Pago', icon: 'icon-plus-circled', active: true, onClick: () => { setModalWidth(WIDTH_PAY); footerBtns.show(); } },
                { id: 'listPayment', tab: 'Historial de Pagos', icon: 'icon-list', onClick: () => { setModalWidth(WIDTH_HISTORY); footerBtns.hide(); } },
            ]
        });

        // Renders
        $('#container-listPayment').html('<div id="container-info-payment"></div><div id="container-methodPay"></div>');

        this.addPayment(order, id);
        this.renderResumenPagos(data.details);
        this.lsPay(id);
    }

    async addPayment(order, id) {
        // Totales base
        this.totalPay = order.total_pay;
        this.totalPaid = order.total_paid;
        this.discount = order.discount ?? 0;

        const saldoOriginal = order.total_pay;
        const discount = order.discount ?? 0;
        const saldoRestante = order.total_pay - discount - order.total_paid;
        const isPaidInFull = saldoRestante <= 0;

        // El candado de turno no debe reactivar el formulario de un pedido ya pagado.
        this.payIsPaidInFull = isPaidInFull;

        // Sucursal de cobro (cobro cruzado). El calendario no tiene el filtro de sucursal
        // de la navbar, asi que el default es la sucursal activa que entrega su init();
        // si no hay, la del pedido.
        const defaultCobroSub = this.subsidiaryId
            ? String(this.subsidiaryId)
            : String(order.subsidiaries_id ?? '');

        // Sucursal de origen del pedido (referencia para el cobro cruzado).
        const origenSub    = (this.subsidiariesCobro || []).find(s => String(s.id) === String(order.subsidiaries_id));
        const origenNombre = origenSub ? origenSub.valor : '—';

        // Estado inicial de la tarjeta "Sucursal que cobrará".
        const origenSubId      = String(order.subsidiaries_id ?? '');
        const cobroSubSel      = (this.subsidiariesCobro || []).find(s => String(s.id) === String(defaultCobroSub));
        const cobroNombre      = cobroSubSel ? cobroSubSel.valor : origenNombre;
        const cobroEsMismaSuc  = String(defaultCobroSub) === origenSubId;
        const cobroSubtitulo   = cobroEsMismaSuc ? 'Misma sucursal de origen' : 'Cobro en otra sucursal';
        const cobroOptionsHtml = (this.subsidiariesCobro || [])
            .map(s => `<option value="${s.id}" ${String(s.id) === String(defaultCobroSub) ? 'selected' : ''}>${s.valor}</option>`)
            .join('');

        // Metodos de pago del dropdown custom (.js-dd). El value es el id que espera
        // el backend (1=Efectivo, 2=Tarjeta, 3=Transferencia) y vive en el input
        // hidden #method_pay_id que lee el form al registrar el pago.
        const metodosPago = [
            { id: '1', label: 'Efectivo',      sub: 'Pago en efectivo', icon: 'banknote' },
            { id: '2', label: 'Tarjeta',       sub: 'Débito o crédito', icon: 'credit-card' },
            { id: '3', label: 'Transferencia', sub: 'Depósito o SPEI',  icon: 'arrow-right-left' }
        ];
        const metodoDefault = metodosPago[0];
        const methodPayOptionsHtml = metodosPago.map((m, i) => `
            <div class="js-dd-option flex items-center gap-2.5 px-2.5 py-2 cursor-pointer hover:bg-slate-700/50"
                data-value="${m.id}" data-label="${m.label}" data-sub="${m.sub}" data-icon="${m.icon}">
                <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-700/60 text-gray-300 shrink-0">
                    ${window.lucideIcon(m.icon, 'w-4 h-4')}
                </div>
                <div class="flex flex-col leading-tight flex-1 min-w-0">
                    <span class="text-sm text-white font-semibold truncate">${m.label}</span>
                    <span class="text-[11px] text-gray-400">${m.sub}</span>
                </div>
                <span class="js-dd-check text-emerald-400 shrink-0 ${i === 0 ? '' : 'opacity-0'}">${window.lucideIcon('check', 'w-4 h-4')}</span>
            </div>`).join('');

        const methodPayCardHtml = `
            <input type="hidden" id="method_pay_id" name="method_pay_id" value="${metodoDefault.id}" required>
            <div class="js-dd relative">
                <div class="js-dd-trigger flex items-center gap-2.5 bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 ${isPaidInFull ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}" ${isPaidInFull ? 'disabled' : ''}>
                    <div class="js-dd-trigger-icon flex items-center justify-center w-7 h-7 rounded-lg bg-slate-700/60 text-gray-300 shrink-0">
                        ${window.lucideIcon(metodoDefault.icon, 'w-4 h-4')}
                    </div>
                    <div class="flex flex-col leading-tight flex-1 min-w-0">
                        <span class="js-dd-trigger-label text-sm text-white font-semibold truncate">${metodoDefault.label}</span>
                        <span class="js-dd-trigger-sub text-[11px] text-gray-400">${metodoDefault.sub}</span>
                    </div>
                    <span class="js-dd-chevron text-gray-400 shrink-0 transition-transform">${window.lucideIcon('chevron-down', 'w-4 h-4')}</span>
                </div>
                <div class="js-dd-menu hidden absolute left-0 right-0 mt-1 z-20 bg-[#1E293B] border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    ${methodPayOptionsHtml}
                </div>
            </div>`;

        // Contenedor del formulario centrado y reducido
        $("#container-payment").html(`
            <div class="flex justify-center items-start">
                <div class="w-full">
                    <form id="form-payment" novalidate></form>
                </div>
            </div>
        `);

        this.createForm({
            id: "formRegisterPayment",
            parent: "form-payment",
            data: {
                opc: "addPayment",
                total: order.total_pay,
                saldo: saldoRestante,
                id: id
            },
            json: [
                {
                    opc: "div",
                    id: "Amount",
                    class: "col-12 mb-2",
                    html: `
                    <div id="dueAmount" class="p-2.5 rounded-xl ${isPaidInFull ? 'bg-green-900/30' : 'bg-[#1E293B]'} text-white text-center">
                        <p class="text-[13px] opacity-80">${isPaidInFull ? 'Pedido pagado completamente' : 'Monto restante a pagar'}</p>
                        <p id="SaldoEvent" class="text-lg font-bold leading-tight">
                            ${formatPrice(saldoRestante)}
                        </p>
                        ${discount > 0 ? `
                            <div class="mt-1.5 pt-1.5 border-t border-gray-600">
                                <p class="text-[11px] text-gray-400">Total original: <span class="line-through">${formatPrice(saldoOriginal)}</span></p>
                                <p class="text-[11px] text-green-400 flex items-center justify-center gap-1">${lucideIcon('tag', 'w-3 h-3')} Descuento aplicado: -${formatPrice(discount)}</p>
                            </div>
                        ` : ''}
                        ${isPaidInFull ? lucideIcon('circle-check', 'w-5 h-5 text-green-400 mt-0.5 inline-block') : ''}
                    </div>`
                },
                {
                    opc: "div",
                    id: "cardMethodPay",
                    class: "col-12 mb-2",
                    lbl: "Método de pago",
                    html: methodPayCardHtml
                },
                {
                    opc: "div",
                    id: "origenPedido",
                    lbl: "Origen del pedido",
                    class: "col-12 mb-2",
                    html: `<div class="flex items-center gap-2.5 bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5">
                        <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-700/60 text-gray-300 shrink-0">
                            ${lucideIcon('house', 'w-4 h-4')}
                        </div>
                        <div class="flex flex-col leading-tight min-w-0">
                            <span class="text-sm text-white font-semibold truncate">${origenNombre}</span>
                            <span class="text-[11px] text-gray-400">Sucursal donde se generó la venta</span>
                        </div>
                    </div>`
                },
                {
                    opc: "div",
                    id: "cobroWrapper",
                    lbl: "Sucursal que cobrará",
                    // mb-2 como el resto: el mb-3 abria un hueco mayor justo antes de Importe.
                    class: "col-12 mb-2",
                    html: `<div class="relative">
                        <div id="cobroCard" class="flex items-center gap-2.5 bg-[#1E293B] border ${cobroEsMismaSuc ? 'border-slate-700' : 'border-amber-500/60'} rounded-lg px-2.5 py-1.5 pointer-events-none">
                            <div id="cobroCardIcon" class="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-700/60 ${cobroEsMismaSuc ? 'text-blue-400' : 'text-amber-400'} shrink-0">
                                ${lucideIcon('landmark', 'w-4 h-4')}
                            </div>
                            <div class="flex flex-col leading-tight flex-1 min-w-0">
                                <span id="cobroCardName" class="text-sm text-white font-semibold truncate">${cobroNombre}</span>
                                <span id="cobroCardSub" class="text-[11px] text-gray-400">${cobroSubtitulo}</span>
                            </div>
                            ${lucideIcon('chevron-down', 'w-4 h-4 text-gray-400 shrink-0')}
                        </div>
                        <select id="payment_subsidiaries_id" name="payment_subsidiaries_id" data-origen="${origenSubId}" required
                            class="absolute inset-0 w-full h-full opacity-0 ${isPaidInFull ? 'cursor-not-allowed' : 'cursor-pointer'}"
                            ${isPaidInFull ? 'disabled' : ''} onchange="app.onCobroChange(this)">
                            ${cobroOptionsHtml}
                        </select>
                    </div>
                    <div id="cobroShiftAlert" class="hidden mt-1.5"></div>`
                },
                {
                    opc: "input",
                    type: "number",
                    id: "advanced_pay",
                    lbl: "Importe",
                    class: "col-12 mb-2",
                    placeholder: "0.00",
                    required: true,
                    min: 0,
                    onkeyup: "app.updateTotal()",
                    disabled: isPaidInFull
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Observación",
                    class: "col-12 mb-2",
                    disabled: isPaidInFull
                }
                // Sin btn-submit: el boton de registrar es el del footer del modal
                // (.cf-confirm), que dispara el submit de este formulario.
            ],
            success: async (response) => {
                if (response.status === 200) {

                    const data = response.data;

                    // ✅ Alert con cierre automático
                    alert({
                        icon: "success",
                        text: "Pago registrado correctamente ✅",
                        timer: 1000
                    });

                    // Refrescar pagos y vista general. Aqui no hay tabla de pedidos que
                    // recargar (el ls() de pedidos): lo que se actualiza es la ficha del
                    // pedido abierta detras del modal.
                    this.lsPay(id);
                    this.refreshOrderDetails(id);
                    this.renderResumenPagos(data.details);

                    // Recalcular saldo restante sin redibujar
                    const order = data.order;
                    const discount = order.discount ?? 0;
                    const restante2 = order.total_pay - discount - order.total_paid;
                    this.totalPay = order.total_pay;
                    this.totalPaid = order.total_paid;
                    this.discount = discount;

                    // Verificar si se pagó completamente
                    if (restante2 <= 0) {
                        // Recargar el formulario para mostrar estado pagado
                        this.addPayment(order, id);
                    } else {
                        $("#SaldoEvent").text(formatPrice(restante2));
                        $("#advanced_pay").val("");
                        $("#description").val("");
                        app.updateTotal();
                    }

                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }

            }
        });

        // ── Interacción de los dropdowns (abrir/cerrar, seleccionar) ───────────
        const $payRoot = $('#container-payment');
        $payRoot.off('click.dd');

        // Abrir / cerrar al pulsar el trigger.
        $payRoot.on('click.dd', '.js-dd-trigger:not([disabled])', function (e) {
            e.stopPropagation();
            const $menu = $(this).siblings('.js-dd-menu');
            const willOpen = $menu.hasClass('hidden');
            // Cerrar cualquier otro menú abierto.
            $payRoot.find('.js-dd-menu').addClass('hidden');
            $payRoot.find('.js-dd-chevron').removeClass('rotate-180');
            if (willOpen) {
                $menu.removeClass('hidden');
                $(this).find('.js-dd-chevron').addClass('rotate-180');
            }
        });

        // Seleccionar una opción: actualiza hidden + trigger + check y cierra.
        $payRoot.on('click.dd', '.js-dd-option', function (e) {
            e.stopPropagation();
            const $opt = $(this);
            const $dd = $opt.closest('.js-dd');
            const value = $opt.attr('data-value');
            const label = $opt.attr('data-label');
            const sub = $opt.attr('data-sub') || '';
            const icon = $opt.attr('data-icon');

            // Valor real (id) para el envío del formulario.
            $dd.prevAll('input[type="hidden"]').first().val(value);

            // Reflejar la selección en el trigger.
            const $trigger = $dd.find('.js-dd-trigger');
            $trigger.find('.js-dd-trigger-icon').html(window.lucideIcon(icon, 'w-4 h-4'));
            $trigger.find('.js-dd-trigger-label').text(label);
            $trigger.find('.js-dd-trigger-sub').text(sub);

            // Mover el check a la opción elegida.
            $dd.find('.js-dd-check').addClass('opacity-0');
            $opt.find('.js-dd-check').removeClass('opacity-0');

            // Cerrar.
            $dd.find('.js-dd-menu').addClass('hidden');
            $trigger.find('.js-dd-chevron').removeClass('rotate-180');
        });

        // Cerrar al hacer click fuera de cualquier dropdown.
        $(document).off('click.payDD').on('click.payDD', function () {
            $('#container-payment .js-dd-menu').addClass('hidden');
            $('#container-payment .js-dd-chevron').removeClass('rotate-180');
        });

        // Confirmación antes de registrar el pago. Se intercepta el submit en fase
        // de captura (antes de validation_form): si no está confirmado, se bloquea,
        // se valida el importe y se pregunta; al confirmar se reenvía con bandera
        // para que el flujo normal (validación + AJAX) continúe.
        const formEl = document.getElementById('form-payment');
        if (formEl) {
            formEl.addEventListener('submit', async (e) => {
                if (formEl.dataset.payConfirmed === '1') {
                    formEl.dataset.payConfirmed = '';
                    return; // ya confirmado: dejar pasar a validation_form
                }
                e.preventDefault();
                e.stopImmediatePropagation();

                // Sin turno abierto en la sucursal que cobra el dinero no entra a
                // ningun corte: se bloquea aqui y tambien en el backend.
                if (!this.requireCobroShift()) return;

                const importe = parseFloat($('#advanced_pay').val()) || 0;
                if (importe <= 0) {
                    alert({ icon: 'error', text: 'Ingresa un importe válido para registrar el pago.', btn1: true, btn1Text: 'Ok' });
                    return;
                }

                // Datos legibles para que el usuario entienda cómo se registrará el pago.
                const metodos = { '1': 'Efectivo', '2': 'Tarjeta', '3': 'Transferencia' };
                const metodoTxt = metodos[String($('#method_pay_id').val())] || '—';
                const subCobroId = String($('#payment_subsidiaries_id').val() || '');
                const subCobroObj = (this.subsidiariesCobro || []).find(s => String(s.id) === subCobroId);
                const subCobroNombre = subCobroObj ? subCobroObj.valor : origenNombre;
                // Cobro cruzado: la sucursal que cobra es distinta a la de origen del pedido.
                const esCruzado = subCobroId !== '' && String(order.subsidiaries_id ?? '') !== subCobroId;

                const row = (lbl, val, color = '#fff') => `
                    <div style="display:flex;justify-content:space-between;gap:16px;padding:3px 0;">
                        <span style="color:#9ca3af;">${lbl}</span><b style="color:${color};">${val}</b>
                    </div>`;

                const htmlConfirm = `
                    <div style="text-align:left;font-size:14px;line-height:1.5;">
                        ${row('Importe', formatPrice(importe))}
                        ${row('Método de pago', metodoTxt)}
                        ${row('Sucursal que cobra', subCobroNombre, '#A78BFA')}
                        ${esCruzado ? `
                        <div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);color:#fcd34d;font-size:12.5px;line-height:1.45;">
                            Cobro cruzado: el pedido es de <b>${origenNombre}</b>, pero el cobro se registrará en <b>${subCobroNombre}</b>.
                        </div>` : ''}
                    </div>`;

                const res = await alert({
                    icon: 'question',
                    title: '¿Registrar pago?',
                    html: htmlConfirm,
                    btn1Text: 'Sí, registrar',
                    btn2Text: 'Cancelar'
                });

                if (res && res.isConfirmed) {
                    formEl.dataset.payConfirmed = '1';
                    formEl.requestSubmit();
                }
            }, true);
        }

        // Aplicar estilos disabled si está pagado
        if (isPaidInFull) {
            setTimeout(() => {
                $("#advanced_pay, #description, #btnSuccess").prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
                $('.cf-confirm').prop('disabled', true).addClass('opacity-50 cursor-not-allowed').text('Pedido Pagado');
            }, 100);
        }

        // Estado inicial del candado de turno. Va despues del bloque de "pagado" para
        // no pelearse con el, y con retraso porque el boton vive en el footer del modal.
        setTimeout(() => this.applyCobroShiftLock(), 120);
    }

    // Snapshot fresco de las sucursales de cobro con su shift_opened_at. Sale por el
    // ctrl de pedidos porque el init del calendario entrega la lista sin el turno.
    async refreshSubsidiariesCobro() {
        const res = await useFetch({ url: this._pedidosLink, data: { opc: 'getSubsidiariesShift' } });
        if (res && Array.isArray(res.data) && res.data.length) this.subsidiariesCobro = res.data;
    }

    // Estado de turno de una sucursal a partir del snapshot (sub.shift_opened_at):
    // sin turno, turno abierto hoy o turno de otro dia sin cerrar.
    subsidiaryShift(sub) {
        const opened = sub && sub.shift_opened_at;
        if (!opened) return { status: 'none', canSell: false };
        if (moment(opened).isSame(moment(), 'day')) return { status: 'open', canSell: true };
        return { status: 'old', canSell: false };
    }

    // Turno de la sucursal que cobra: sin turno abierto de hoy el pago no puede
    // registrarse (el dinero no caeria en ningun corte). Pinta el aviso bajo el
    // selector y bloquea importe, observacion y el boton de registrar.
    applyCobroShiftLock() {
        const sub = (this.subsidiariesCobro || []).find(s => String(s.id) === String($('#payment_subsidiaries_id').val() || ''));
        const st  = this.subsidiaryShift(sub);

        const $alert = $('#cobroShiftAlert');

        if (st.canSell) {
            $alert.addClass('hidden').empty();
        } else {
            const nombre  = sub ? sub.valor : 'seleccionada';
            const titulo  = st.status === 'old' ? 'Turno sin cerrar' : 'Sucursal sin turno abierto';
            const detalle = st.status === 'old'
                ? `La sucursal <b class="text-gray-300">${nombre}</b> tiene un turno de otro día sin cerrar; no se puede registrar este pago.`
                : `La sucursal <b class="text-gray-300">${nombre}</b> debe abrir su turno para poder registrar este pago.`;

            $alert.removeClass('hidden').html(`
                <div class="flex items-start gap-2 bg-amber-500/10 rounded-lg px-2.5 py-1.5">
                    <span class="text-amber-400 shrink-0 mt-0.5">${lucideIcon('circle-alert', 'w-4 h-4')}</span>
                    <div class="flex flex-col leading-tight min-w-0">
                        <span class="text-[12px] font-semibold text-amber-300">${titulo}</span>
                        <span class="text-[11px] text-gray-400">${detalle}</span>
                    </div>
                </div>`);
        }

        if (this.payIsPaidInFull) return st;

        const locked = !st.canSell;
        $('#advanced_pay, #description').prop('disabled', locked).toggleClass('opacity-50 cursor-not-allowed', locked);
        $('.cf-confirm').prop('disabled', locked).toggleClass('opacity-50 cursor-not-allowed', locked);

        return st;
    }

    requireCobroShift() {
        const st = this.applyCobroShiftLock();
        if (st.canSell) return true;

        const sub    = (this.subsidiariesCobro || []).find(s => String(s.id) === String($('#payment_subsidiaries_id').val() || ''));
        const nombre = sub ? sub.valor : 'seleccionada';

        alert({
            icon: 'warning',
            title: st.status === 'old' ? 'Turno sin cerrar' : 'Sucursal sin turno abierto',
            text: st.status === 'old'
                ? `La sucursal ${nombre} tiene un turno de otro día sin cerrar. Debe cerrarlo y abrir el turno de hoy para registrar este pago.`
                : `La sucursal ${nombre} debe abrir su turno de caja para poder registrar este pago.`,
            btn1: true,
            btn1Text: 'Entendido'
        });

        return false;
    }

    onCobroChange(sel) {
        const $sel   = $(sel);
        const id     = String($sel.val() || '');
        const nombre = $sel.find('option:selected').text().trim();
        const origen = String($sel.data('origen') || '');
        const same   = id === origen;

        $('#cobroCardName').text(nombre);
        $('#cobroCardSub').text(same ? 'Misma sucursal de origen' : 'Cobro en otra sucursal');
        $('#cobroCard')
            .toggleClass('border-slate-700', same)
            .toggleClass('border-amber-500/60', !same);
        $('#cobroCardIcon')
            .toggleClass('text-blue-400', same)
            .toggleClass('text-amber-400', !same);

        this.applyCobroShiftLock();
    }

    // Desde el historial el monto se lee de su fila de la tabla. El resumen de pago del
    // detalle lo manda en amount porque sus abonos no son filas <tr>, y pide la
    // contraseña siempre (pedirClave), este o no liquidado el pedido.
    deletePay(id, idFolio, requiereClave = 0, amount = null, pedirClave = false) {
        if (amount === null) {
            const row = event.target.closest("tr");
            amount = parseFloat(row.cells[2].textContent.replace(/[^\d.-]/g, ""));
        }

        this._switchToPedidos();

        // Pedido liquidado: el controlador exige la contraseña del usuario en
        // sesión, así que se confirma con ella en vez del sí/no de siempre.
        if (requiereClave == 1 || pedirClave) {
            this.deletePayWithKey(id, idFolio, amount, requiereClave == 1);
            return;
        }

        // Sin contraseña, el dialogo del motivo es la confirmacion del borrado.
        this.askDeleteReason(amount, async (reason) => {
            const res = await useFetch({
                url: this._pedidosLink,
                data: { opc: 'deletePay', id: idFolio, amount: amount, idPay: id, reason: reason }
            });

            if (res.status === 200) {
                this.afterDeletePay(res, idFolio);
            } else {
                this._restoreLink();
                alert({ icon: "error", text: res.message });
            }
        });
    }

    // Motivo del borrado: el controlador lo exige y lo deja en la bitacora del pedido.
    askDeleteReason(amount, onReason) {
        this.alertBox({
            theme:       'dark',
            type:        'cancel',
            icon:        'trash-2',
            title:       '¿Eliminar pago?',
            detailHtml:  `Se eliminará el pago de <b class="text-gray-200">${formatPrice(amount)}</b> de forma permanente.`,
            input:       'textarea',
            inputLabel:  'Motivo',
            inputPlaceholder: 'Ej. el pago se registró dos veces',
            inputRequired: true,
            inputError:  'Escribe el motivo',
            okLabel:     'Eliminar pago',
            okBg:        'bg-[#E02424] hover:bg-[#C81E1E]',
            cancelLabel: 'Cancelar',
            onCancel:    () => this._restoreLink(),
            onOk:        onReason
        });
    }

    // Borrado autorizado. Liquidado: el saldo del pedido ya es cero, por lo que
    // eliminar un abono reabre un pedido cerrado. Sin liquidar: confirmacion con
    // contraseña desde el resumen de pago del detalle. Este modal solo recolecta la
    // contraseña; quien la valida es deletePay() del controlador. Despues de la
    // contraseña se pide el motivo; en un reintento ya viene en reason y no se repite.
    deletePayWithKey(id, idFolio, amount, liquidado = true, reason = '') {
        const enviar = async (password, motivo) => {
            const res = await useFetch({
                url: this._pedidosLink,
                data: { opc: 'deletePay', id: idFolio, amount: amount, idPay: id, password: password, reason: motivo }
            });

            if (res.status !== 200) {
                // Contraseña rechazada: se avisa y se vuelve a abrir el dialogo,
                // porque alertBox ya se cerro al confirmar.
                this._restoreLink();
                this.alertBox({
                    theme:      'dark',
                    type:       'error',
                    title:      'No se eliminó el pago',
                    detailHtml: res.message || 'Contraseña incorrecta.',
                    okLabel:    'Reintentar',
                    onOk:       () => this.deletePayWithKey(id, idFolio, amount, liquidado, motivo)
                });
                return;
            }

            this.afterDeletePay(res, idFolio);
        };

        this.alertBox({
            theme:       'dark',
            type:        'cancel',
            icon:        'lock',
            title:       liquidado ? 'Pedido liquidado' : 'Eliminar pago',
            detailHtml:  `Ingresa tu contraseña para eliminar el pago de <b class="text-gray-200">${formatPrice(amount)}</b>.`,
            input:       'password',
            inputLabel:  'Contraseña',
            inputPlaceholder: '••••••••',
            inputRequired: true,
            inputError:  'Ingresa tu contraseña',
            okLabel:     reason ? 'Eliminar pago' : 'Continuar',
            okBg:        'bg-[#E02424] hover:bg-[#C81E1E]',
            cancelLabel: 'Cancelar',
            onCancel:    () => this._restoreLink(),
            onOk: (password) => reason
                ? enviar(password, reason)
                : this.askDeleteReason(amount, (motivo) => enviar(password, motivo))
        });
    }

    // Refresco comun tras eliminar un pago (con o sin contraseña). Si se borro desde
    // el resumen de pago del detalle, Gestion de Pagos (#modalAdvance) no esta
    // abierto: solo se repinta el detalle y el link vuelve al calendario.
    afterDeletePay(res, idFolio) {
        const data = res.initHistoryPay;

        if ($('#modalAdvance').length) {
            this.renderResumenPagos(data.details);
            this.lsPay(idFolio);

            const order = data.order;
            this.totalPay = order.total_pay;
            this.totalPaid = order.total_paid;
            this.addPayment(order, idFolio);
        } else {
            this._restoreLink();
        }

        // Refrescar detalles del pedido en el modal
        this.refreshOrderDetails(idFolio);

        alert({
            icon: "success",
            text: res.message || "Pago eliminado correctamente. Saldo actualizado.",
            timer: 2000
        });
    }

    async lsPay(id) {
        this._switchToPedidos();
        const response = await useFetch({
            url: this._pedidosLink,
            data: { opc: 'listPayment', id: id }
        });

        if (!response.row || response.row.length === 0) {
            $("#container-methodPay").html(`
                <div class="flex flex-col items-center justify-center py-12 text-center bg-[#1E293B] border border-slate-700 rounded-xl">
                    <div class="w-16 h-16 rounded-2xl bg-slate-700/60 flex items-center justify-center mb-4">
                        ${lucideIcon('history', 'w-7 h-7 text-gray-400')}
                    </div>
                    <p class="text-gray-300 text-base font-semibold mb-1">Aún no se ha realizado ningún abono</p>
                    <p class="text-gray-500 text-sm">Los pagos registrados aparecerán aquí</p>
                </div>
            `);
            return;
        }

        this.createTable({
            parent: "container-methodPay",
            idFilterBar: "filterBarEventos",
            data: { opc: 'listPayment', id: id },
            conf: { datatable: false, pag: 8 },
            coffeesoft: true,
            attr: {
                id: "tableOrder",
                theme: 'dark',
                center: [1, , 3, 6, 7],
                right: [4],
                f_size: 11,
                extends: true,
            },
        });
    }

    renderResumenPagos(totales) {
        const totalPagado = totales?.pagado ?? 0;
        const discount = totales?.discount ?? 0;
        const totalEvento = totales?.total ?? 0;

        const totalConDescuento = totalEvento - discount;
        const restante = totalConDescuento - totalPagado;

        const fmt = (n) => n.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2
        });

        // Liquidado: el restante deja de ser una alerta y se pinta en verde como el
        // total pagado, para que la tarjeta no siga en rojo con saldo cero.
        const liquidado = restante <= 0;

        let originalHTML = `<p class="text-lg font-bold text-blue-400 mt-1" id="totalEvento">${formatPrice(totalEvento)}</p>`;

        if (discount > 0) {
            originalHTML = `
            <p class="text-lg font-bold text-blue-400 mt-1" id="totalEvento">${fmt(totalConDescuento)}</p>
            <p class="text-xs text-gray-500 line-through">${fmt(totalEvento)}</p>
            <p class="text-xs text-emerald-400 mt-1 flex items-center justify-center gap-1">
                ${lucideIcon('tag', 'w-3 h-3')} Descuento:
                <span class="font-semibold">${fmt(discount)}</span>
            </p>
        `;
        }

        $('#container-info-payment').html(`
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div class="bg-emerald-500/10 rounded-xl p-3 text-center">
                <p class="text-xs text-emerald-400/80 flex items-center justify-center gap-1.5">
                    ${lucideIcon('circle-check', 'w-3.5 h-3.5')} Total pagado
                </p>
                <p class="text-lg font-bold text-emerald-400 mt-1" id="totalPagado">${fmt(totalPagado)}</p>
            </div>
            <div class="bg-blue-500/10 rounded-xl p-3 text-center">
                <p class="text-xs text-blue-400/80 flex items-center justify-center gap-1.5">
                    ${lucideIcon('wallet', 'w-3.5 h-3.5')} Total
                </p>
                ${originalHTML}
            </div>
            <div class="${liquidado ? 'bg-emerald-500/10' : 'bg-red-500/10'} rounded-xl p-3 text-center">
                <p class="text-xs ${liquidado ? 'text-emerald-400/80' : 'text-red-400/80'} flex items-center justify-center gap-1.5">
                    ${lucideIcon(liquidado ? 'circle-check' : 'clock', 'w-3.5 h-3.5')} Restante
                </p>
                <p class="text-lg font-bold ${liquidado ? 'text-emerald-400' : 'text-red-400'} mt-1" id="totalRestante">${fmt(restante)}</p>
            </div>
        </div>
    `);
    }

    updateTotal(total, totalPaid) {
        const val = parseFloat($("#advanced_pay").val()) || 0;
        const t = typeof total === 'number' ? total : (this.totalPay || 0);
        const tp = typeof totalPaid === 'number' ? totalPaid : (this.totalPaid || 0);
        const d = this.discount || 0;
        const restante = (t - d - (tp || 0)) - val;
        // .cf-confirm: en Gestion de Pagos el boton de registrar vive en el footer del
        // modal, no dentro del formulario.
        const btn = $("#btnSuccess").add('.cf-confirm');
        const display = $("#SaldoEvent");
        if (display && display.length) {
            display.text(formatPrice(restante < 0 ? 0 : restante));
        }
        // Sin turno en la sucursal que cobra el boton se queda bloqueado: este metodo
        // corre en cada tecla y despues de cada pago, y sin esto reabriria el candado.
        const shiftLocked = $('#cobroShiftAlert').length && !$('#cobroShiftAlert').hasClass('hidden');

        if (restante < 0 || shiftLocked) {
            btn.prop("disabled", true).addClass("opacity-50 cursor-not-allowed");
        } else {
            btn.prop("disabled", false).removeClass("opacity-50 cursor-not-allowed");
        }
    }

    previewImage(imageUrl, imageName = 'Imagen') {
        const modal = $(`
            <div id="imagePreviewModal" class="fixed inset-0 z-[100100] flex items-center justify-center bg-black/80" onclick="if(event.target === this) $(this).remove()">
                <div class="relative max-w-4xl max-h-[90vh] p-2">
                    <button onclick="$('#imagePreviewModal').remove()"
                            class="absolute -top-2 -right-2 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xl font-bold z-10 shadow-lg">
                        ×
                    </button>
                    <img src="${imageUrl}" alt="${imageName}"
                         class="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain">
                    <p class="text-white text-center mt-3 text-sm">${imageName}</p>
                </div>
            </div>
        `);

        $('body').append(modal);

        $(document).on('keydown.imagePreview', function (e) {
            if (e.key === 'Escape') {
                $('#imagePreviewModal').remove();
                $(document).off('keydown.imagePreview');
            }
        });
    }



}
