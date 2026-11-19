/*  Developer › Accesos › Inicio: las tarjetas que un dueño puede poner en su
    inicio (Configuración › Mi inicio), por módulo (ctrl-inicio.php).

    A la izquierda:
      Inicio de fábrica  lo que trae el inicio de un dueño que no lo ha
                         personalizado: se arrastra entre zonas y se saca o se
                         mete a fábrica.
      General            las tarjetas de todas las empresas.
      Cada módulo        sus tarjetas, cuántas empresas lo tienen y las
                         funciones que ofrece (con las que se arman tarjetas).

    Una tarjeta = nombre + módulo + FUNCIÓN. La función (HomeLayout::FUNCTIONS)
    es la que le da datos y la que dice cómo se ve; de aquí no se inventa una:
    se elige de las que ya existen en el código. Con eso, armar una tarjeta
    nueva para un módulo (otro nombre, otra zona, otro módulo) no pide tocar
    código. */
let homeCards;

class HomeCards extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'HomeCards';
        this.data = null;
        // 'factory', 'general' o el id de un módulo.
        this.view = 'factory';
        this.search = '';
    }

    get status() {
        return String($('#filterbar-inicio #hcStatus').val() || '1');
    }

    // -- Interface --

    render() {
        this.search = '';
        this.layout();
        this.filterBar();
    }

    layout() {
        this.createLayout({
            parent: 'container-inicio',
            design: false,
            data: {
                id: 'homeCardsBoard',
                class: 'flex flex-col gap-2 flex-1 lg:min-h-0',
                container: [
                    { type: 'div', id: 'filterbar-inicio', class: 'w-full' },
                    {
                        type: 'div',
                        id: 'inicio-body',
                        class: 'grid grid-cols-1 lg:grid-cols-[calc(25%-54px)_minmax(0,1fr)] gap-2 items-stretch flex-1 lg:min-h-0',
                        children: [
                            { id: 'inicio-nav', class: 'min-h-0 min-w-0' },
                            { id: 'inicio-board', class: 'min-h-0 min-w-0' }
                        ]
                    }
                ]
            }
        });
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterbar-inicio',
            data: [
                {
                    opc: 'input',
                    id: 'hcSearch',
                    lbl: 'Buscar',
                    placeholder: 'Buscar tarjeta o función…',
                    class: 'col-12 col-sm-4 col-lg-3',
                    required: false,
                    onkeyup: 'homeCards.onSearch(this.value)'
                },
                {
                    opc: 'select',
                    id: 'hcStatus',
                    lbl: 'Estado',
                    class: 'col-12 col-sm-4 col-lg-2',
                    data: [
                        { id: '1', valor: 'Encendidas' },
                        { id: '0', valor: 'Apagadas' },
                        { id: 'all', valor: 'Todas' }
                    ],
                    onchange: 'homeCards.renderBoard()'
                },
                {
                    opc: 'button',
                    id: 'btnNewHomeCard',
                    class: 'col-12 col-sm-4 col-lg-2',
                    text: 'Nueva tarjeta',
                    onClick: () => this.addCard(this.presetFromView())
                }
            ]
        });
    }

    async ls() {
        const request = await useFetch({ url: this._link, data: { opc: 'lsHomeWidgets' } });

        if (!request || request.status !== 200) {
            this.data = null;
            $('#inicio-nav').empty();
            $('#inicio-board').html(
                $('<div>', { class: 'bg-white border border-gray-200 rounded-xl h-full min-h-[300px] flex' }).append(
                    this.emptyState('database', 'No se pudo cargar el catálogo de tarjetas', (request && request.message) || 'Inténtalo de nuevo.')
                )
            );
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        this.data = request;

        // Si el módulo elegido ya no existe, de vuelta al inicio de fábrica.
        if (typeof this.view === 'number' && !this.module(this.view)) this.view = 'factory';

        this.renderNav();
        this.renderBoard();
    }

    onSearch(value) {
        this.search = (value || '').trim();
        this.renderBoard();
    }

    // -- Panel izquierdo --

    renderNav() {
        const d = this.data;
        const w = d.widgets;
        const $list = $('<div>', { class: 'flex-1 min-h-0 max-h-[55vh] lg:max-h-none overflow-y-auto p-2 bg-gray-50 flex flex-col gap-2' });

        const defaults = this.live().filter(x => x.default).length;

        $list.append(this.navCard({
            key: 'factory',
            icon: 'layout-dashboard',
            label: 'Inicio de fábrica',
            line: `${defaults} ${defaults === 1 ? 'tarjeta' : 'tarjetas'} · ${d.custom} ${d.custom === 1 ? 'dueño ya personalizó' : 'dueños ya personalizaron'}`
        }));

        $list.append($('<p>', { class: 'px-1 pt-2 mb-0 text-[10px] font-semibold uppercase tracking-wider text-gray-400', text: 'Por módulo' }));

        const general = w.filter(x => x.module_id === 0);
        $list.append(this.navCard({
            key: 'general',
            icon: 'globe',
            label: 'General',
            line: `${this.countLabel(general)} · todas las empresas`
        }));

        d.modules.forEach((m) => {
            const mine = w.filter(x => x.module_id === m.id);
            $list.append(this.navCard({
                key: m.id,
                icon: m.icon,
                label: m.name,
                tag: m.active ? '' : 'apagado',
                muted: !m.active || !mine.length,
                line: `${this.countLabel(mine)} · ${this.companiesLabel(m.companies)}`
            }));
        });

        const panel = $('<div>', { class: 'bg-white border border-gray-200 rounded-xl h-full min-h-0 flex flex-col overflow-hidden' }).append(
            $('<div>', { class: 'flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 shrink-0' }).append(
                $('<span>', { class: 'text-sm font-semibold text-gray-800', text: 'Tarjetas del inicio' })
            ),
            $list
        );

        $('#inicio-nav').html(panel);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Contorno con ring y no con border: Bootstrap marca .border con !important.
    navCard(item) {
        const selected = String(item.key) === String(this.view) && !this.search;

        const title = $('<p>', { class: 'flex items-center gap-2 text-sm font-semibold text-gray-900 leading-tight mb-0 min-w-0' }).append(
            $('<span>', { class: 'truncate', text: item.label })
        );
        if (item.tag) title.append(this.tag(item.tag));

        const card = $('<div>', {
            role: 'button',
            tabindex: 0,
            'aria-pressed': selected ? 'true' : 'false',
            class: 'flex items-center gap-3 p-3 rounded-xl bg-white cursor-pointer transition '
                + (selected ? 'ring-1 ring-blue-600 shadow-md' : 'ring-1 ring-inset ring-gray-200 hover:shadow-md')
        }).append(
            $('<span>', { class: 'shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-xl bg-blue-600/10 text-blue-600' + (item.muted ? ' opacity-60' : '') })
                .append($('<i>', { 'data-lucide': item.icon || 'layout-grid', class: 'w-5 h-5' })),
            $('<div>', { class: 'min-w-0 flex-1' }).append(
                title,
                $('<p>', { class: 'text-xs text-gray-500 mb-0 mt-0.5 truncate', text: item.line })
            )
        );

        const pick = () => {
            this.view = item.key;
            this.search = '';
            $('#filterbar-inicio #hcSearch').val('');
            this.renderNav();
            this.renderBoard();
        };

        card.on('click', pick);
        card.on('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            pick();
        });

        return card;
    }

    // -- Panel derecho --

    renderBoard() {
        if (!this.data) return;

        const top = $('#hcBoard').scrollTop() || 0;
        const board = $('<div>', { id: 'hcBoard', class: 'bg-white border border-gray-200 rounded-xl h-full min-h-0 overflow-y-auto p-3 flex flex-col gap-3' });

        if (this.search) board.append(this.searchView());
        else if (this.view === 'factory') board.append(this.factoryView());
        else board.append(this.moduleView());

        $('#inicio-board').html(board);
        $('#hcBoard').scrollTop(top);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        if (!this.search && this.view === 'factory') this.bindFactory();
    }

    /*  Un módulo (o General): quién lo tiene, sus tarjetas y las funciones que
        ofrece, con las que se arman tarjetas nuevas. */
    moduleView() {
        const general = this.view === 'general';
        const m = general ? null : this.module(this.view);
        const all = this.data.widgets.filter(w => w.module_id === (general ? 0 : m.id));
        const shown = this.byStatus(all);
        const code = general ? null : m.code;

        const homes = all.reduce((sum, w) => sum + w.homes, 0);
        const chips = $('<div>', { class: 'flex flex-wrap gap-1.5 mt-2' }).append(
            this.chip('building-2', general ? `Todas las empresas (${this.data.companies} activas)` : this.companiesLabel(m.companies)),
            this.chip('layout-dashboard', this.countLabel(all)),
            this.chip('star', `${all.filter(w => w.default && w.active).length} de fábrica`),
            this.chip('users', `Puestas ${homes} ${homes === 1 ? 'vez' : 'veces'} en inicios personalizados`)
        );

        const head = $('<div>', { class: 'flex flex-wrap items-start justify-between gap-3 p-3 rounded-xl bg-gray-50' }).append(
            $('<div>', { class: 'flex items-start gap-3 min-w-0' }).append(
                $('<span>', { class: 'shrink-0 w-12 h-12 inline-flex items-center justify-center rounded-xl bg-blue-600/10 text-blue-600' })
                    .append($('<i>', { 'data-lucide': general ? 'globe' : (m.icon || 'layout-grid'), class: 'w-6 h-6' })),
                $('<div>', { class: 'min-w-0' }).append(
                    $('<p>', { class: 'flex items-center gap-2 text-lg font-bold text-gray-900 mb-0' }).append(
                        $('<span>', { text: general ? 'General' : m.name }),
                        !general && !m.active ? this.tag('apagado: nadie ve sus tarjetas') : null
                    ),
                    $('<p>', { class: 'text-sm text-gray-500 mb-0', text: general ? 'Tarjetas que ve el dueño de cualquier empresa, tenga el módulo que tenga.' : (m.description || '') }),
                    chips
                )
            ),
            actionButton('plus', 'Nueva tarjeta', () => this.addCard({ module_id: general ? 'general' : String(m.id) }), true)
        );

        const block = $('<div>', { class: 'flex flex-col gap-3' }).append(head);

        // Sus tarjetas.
        block.append(this.sectionTitle('Sus tarjetas', `${shown.length}`));
        if (shown.length) {
            const grid = $('<div>', { class: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3' });
            shown.forEach((w) => grid.append(this.widgetCard(w)));
            block.append(grid);
        } else {
            block.append($('<p>', {
                class: 'text-xs text-gray-400 px-1 mb-0',
                text: all.length ? 'No hay tarjetas con ese estado.' : 'Este módulo todavía no tiene tarjetas para el inicio. Arma una con alguna de sus funciones de abajo.'
            }));
        }

        // Lo que sabe hacer: sus funciones.
        const fns = this.data.functions.filter(f => f.module === code);
        block.append(this.sectionTitle('Lo que puede mostrar este módulo', `${fns.length} ${fns.length === 1 ? 'función' : 'funciones'}`));

        if (fns.length) {
            const list = $('<div>', { class: 'grid grid-cols-1 md:grid-cols-2 gap-2' });
            fns.forEach((f) => list.append(this.functionRow(f, general ? 'general' : String(m.id))));
            block.append(list);
        } else {
            block.append(accessNote('code-xml', 'Este módulo todavía no tiene funciones para el inicio. Una función nueva se programa: su entrada en HomeLayout::FUNCTIONS (app/home/mdl/mdl-home-layout.php), su función en HomeWidgets (app/home/ctrl/widgets-home.php) y cómo se pinta en home.js (HOME_WIDGETS). Después aparece aquí para armar tarjetas con ella.'));
        }

        return block;
    }

    // Una tarjeta del catálogo, con lo que pasa con ella.
    widgetCard(w) {
        const on = w.active === 1;
        const fn = this.fn(w.fn);

        const actions = $('<div>', { class: 'flex items-center gap-1.5 shrink-0' }).append(
            this.iconButton('pencil', 'Editar tarjeta', () => this.editCard(w.id))
        );
        if (!on) actions.append(this.iconButton('trash-2', 'Eliminar tarjeta', () => this.deleteCard(w), 'hover:text-red-600'));
        actions.append(csGlSwitch(on, () => this.toggleCard(w, on ? 0 : 1)));

        const zones = $('<div>', { class: 'flex flex-wrap gap-1' });
        Object.keys(this.data.zones).forEach((z) => {
            const can = w.zones.includes(z);
            const lands = can && w.zone === z;
            zones.append($('<span>', {
                class: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium '
                    + (lands ? 'bg-blue-600 text-white' : can ? 'bg-blue-600/10 text-blue-700' : 'bg-gray-100 text-gray-400 line-through')
            }).attr('title', lands ? 'Aquí cae al agregarla' : can ? 'Puede ir aquí' : 'No puede ir aquí').append(
                lands ? $('<i>', { 'data-lucide': 'map-pin', class: 'w-3 h-3' }) : null,
                $('<span>', { text: this.data.zones[z] })
            ));
        });

        const tags = $('<div>', { class: 'flex flex-wrap gap-1' });
        if (w.default) tags.append($('<span>', { class: 'px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700', text: 'De fábrica' }));
        tags.append($('<span>', { class: 'px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600', text: `En ${w.homes} ${w.homes === 1 ? 'inicio' : 'inicios'}` }));

        const card = $('<div>', { class: 'flex flex-col gap-2.5 p-3 rounded-xl bg-white ring-1 ring-inset ring-gray-200 hover:shadow-sm transition' }).append(
            $('<div>', { class: 'flex items-start gap-2.5 min-w-0' }).append(
                $('<span>', { class: 'shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg ring-1 ring-inset ring-gray-200 text-gray-500' + (on ? '' : ' opacity-60') })
                    .append($('<i>', { 'data-lucide': w.icon || 'square', class: 'w-4 h-4' })),
                $('<div>', { class: 'min-w-0 flex-1' + (on ? '' : ' opacity-60') }).append(
                    $('<p>', { class: 'text-[13px] font-semibold text-gray-800 truncate mb-0', text: w.name }),
                    $('<p>', { class: 'text-[11px] text-gray-400 font-mono truncate mb-0', text: w.code })
                ),
                actions
            ),
            $('<p>', { class: 'text-xs text-gray-500 mb-0' }).append(
                $('<span>', { class: 'font-mono text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 me-1', text: `${w.fn}()` }),
                $('<span>', { text: fn ? fn.name : 'función que ya no existe' })
            ),
            zones,
            tags
        );

        if (w.text) card.append($('<p>', { class: 'text-xs text-gray-500 mb-0', text: w.text }));
        if (w.route) card.append($('<p>', { class: 'text-[11px] text-gray-400 font-mono truncate mb-0', text: `Ver más → ${w.route}` }));

        this.warnings(w).forEach((text) => card.append(
            $('<p>', { class: 'text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 mb-0', text: text })
        ));

        return card;
    }

    // Lo que hace que una tarjeta no se vea como se espera.
    warnings(w) {
        const out = [];
        const fn = this.fn(w.fn);
        const mod = w.module_id ? this.module(w.module_id) : null;

        if (!w.fn_ok || !fn) {
            out.push(`Su función «${w.fn}» ya no existe en el código: no se le ofrece a nadie.`);
            return out;
        }

        if (mod && !mod.active) out.push('Su módulo está apagado: nadie la ve.');

        if (fn.module !== null && (!mod || mod.code !== fn.module)) {
            out.push(`Lee datos de ${fn.module_name}: en una empresa que no lo tiene puede salir vacía.`);
        }

        return out;
    }

    // Una función del módulo: cuántas tarjetas la usan y un atajo para armar otra.
    functionRow(f, moduleKey) {
        const used = this.data.widgets.filter(w => w.fn === f.id);

        return $('<div>', { class: 'flex items-center gap-3 p-2.5 rounded-xl ring-1 ring-inset ring-gray-200' }).append(
            $('<span>', { class: 'shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg bg-gray-100 text-gray-500' })
                .append($('<i>', { 'data-lucide': 'function-square', class: 'w-4 h-4' })),
            $('<div>', { class: 'min-w-0 flex-1' }).append(
                $('<p>', { class: 'text-[13px] font-semibold text-gray-800 truncate mb-0', text: f.name }),
                $('<p>', { class: 'text-[11px] text-gray-400 mb-0 truncate' }).append(
                    $('<span>', { class: 'font-mono', text: `${f.id}()` }),
                    $('<span>', { text: ` · ${f.zones.map(z => this.data.zones[z]).join(', ')} · ` }),
                    $('<span>', { text: used.length ? `en ${used.length} ${used.length === 1 ? 'tarjeta' : 'tarjetas'}` : 'sin tarjeta todavía', class: used.length ? '' : 'text-amber-600' })
                )
            ),
            this.iconButton('plus', 'Armar una tarjeta con esta función', () => this.addCard({ fn: f.id, module_id: moduleKey }))
        );
    }

    // Búsqueda: cruza todos los módulos.
    searchView() {
        const q = this.normalize(this.search);
        const found = this.byStatus(this.data.widgets).filter(w => this.normalize(`${w.name} ${w.code} ${w.fn} ${w.text}`).includes(q));
        const block = $('<div>', { class: 'flex flex-col gap-3' });

        if (!found.length) {
            block.append(this.emptyState('search-x', `Sin tarjetas para «${this.search}»`, 'Busca por nombre, código o función, o cambia el Estado.'));
            return block;
        }

        const groups = [{ id: 0, name: 'General' }].concat(this.data.modules);
        groups.forEach((g) => {
            const mine = found.filter(w => w.module_id === g.id);
            if (!mine.length) return;

            block.append(this.sectionTitle(g.name, `${mine.length} ${mine.length === 1 ? 'resultado' : 'resultados'}`));
            const grid = $('<div>', { class: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3' });
            mine.forEach((w) => grid.append(this.widgetCard(w)));
            block.append(grid);
        });

        return block;
    }

    // -- Inicio de fábrica --

    /*  Las tres zonas del inicio con las tarjetas que trae de fábrica, y abajo
        las que solo salen si el dueño las agrega. Se arrastran entre zonas (solo
        a las que cada una acepta) y dentro de cada una para ordenarlas. Lo ve
        quien no ha personalizado su inicio, y cada dueño solo las de sus
        módulos. */
    factoryView() {
        const live = this.live();
        const zone = (z) => live.filter(w => w.default && w.zone === z);
        const off = live.filter(w => !w.default);

        const list = (id, items, empty, extra = '') => {
            const $l = $('<div>', { class: `hc-factory-list flex flex-col gap-2 min-h-[64px] p-2 rounded-xl ring-1 ring-inset ring-gray-200 bg-gray-50 ${extra}`, 'data-zone': id });
            items.forEach((w) => $l.append(this.factoryTile(w)));
            // Solo vacía: tras soltar se vuelve a pintar todo (saveFactory).
            if (!items.length) $l.append($('<p>', { class: 'hc-factory-empty col-span-full text-xs text-gray-400 text-center py-3 mb-0', text: empty }));
            return $l;
        };

        const zoneBox = (id, hint) => $('<div>', { class: 'flex flex-col gap-1.5 min-w-0' }).append(
            $('<p>', { class: 'flex items-baseline gap-2 text-sm font-semibold text-gray-800 mb-0' }).append(
                $('<span>', { text: this.data.zones[id] }),
                $('<span>', { class: 'text-xs font-normal text-gray-400', text: hint })
            ),
            list(id, zone(id), 'Suelta aquí una tarjeta')
        );

        return $('<div>', { class: 'flex flex-col gap-3' }).append(
            $('<div>', { class: 'p-3 rounded-xl bg-gray-50' }).append(
                $('<p>', { class: 'text-lg font-bold text-gray-900 mb-0', text: 'Inicio de fábrica' }),
                $('<p>', { class: 'text-sm text-gray-500 mb-0', text: 'Lo que ve un dueño que no ha personalizado su inicio. Cada dueño solo ve las tarjetas de los módulos que tiene. Arrastra para cambiar el orden o la zona; saca una a «Fuera de fábrica» para que solo salga si el dueño la agrega.' }),
                $('<div>', { class: 'flex flex-wrap gap-1.5 mt-2' }).append(
                    this.chip('users', `${this.data.custom} ${this.data.custom === 1 ? 'dueño ya personalizó su inicio: a él no le cambia' : 'dueños ya personalizaron su inicio: a ellos no les cambia'}`)
                )
            ),
            zoneBox('top', 'a todo lo ancho'),
            $('<div>', { class: 'grid grid-cols-1 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-3' }).append(
                zoneBox('main', 'la parte ancha'),
                zoneBox('side', 'angosta')
            ),
            $('<div>', { class: 'flex flex-col gap-1.5' }).append(
                $('<p>', { class: 'flex items-baseline gap-2 text-sm font-semibold text-gray-800 mb-0' }).append(
                    $('<span>', { text: 'Fuera de fábrica' }),
                    $('<span>', { class: 'text-xs font-normal text-gray-400', text: 'el dueño las agrega desde Mi inicio' })
                ),
                list('off', off, 'Todas las tarjetas salen de fábrica', 'md:grid md:grid-cols-2 xl:grid-cols-3')
            )
        );
    }

    factoryTile(w) {
        const mod = w.module_id ? this.module(w.module_id) : null;

        return $('<div>', {
            'data-id': w.id,
            'data-zones': w.zones.join(','),
            class: 'hc-factory-tile flex items-center gap-2.5 p-2 pe-3 rounded-xl bg-white ring-1 ring-inset ring-gray-200 cursor-grab active:cursor-grabbing select-none'
        }).append(
            $('<i>', { 'data-lucide': 'grip-vertical', class: 'w-3.5 h-3.5 text-gray-300 shrink-0' }),
            $('<span>', { class: 'shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg bg-blue-600/10 text-blue-600' })
                .append($('<i>', { 'data-lucide': w.icon || 'square', class: 'w-4 h-4' })),
            $('<div>', { class: 'min-w-0 flex-1' }).append(
                $('<p>', { class: 'text-[13px] font-semibold text-gray-800 truncate mb-0', text: w.name }),
                $('<p>', { class: 'text-[11px] text-gray-400 truncate mb-0', text: `${mod ? mod.name : 'General'} · en ${w.homes} ${w.homes === 1 ? 'inicio' : 'inicios'}` })
            )
        ).attr('title', `Puede ir en: ${w.zones.map(z => this.data.zones[z]).join(', ')}`);
    }

    bindFactory() {
        if (typeof Sortable === 'undefined') return;

        document.querySelectorAll('#hcBoard .hc-factory-list').forEach((el) => {
            Sortable.create(el, {
                group: {
                    name: 'hc-factory',
                    // Solo a las zonas donde puede ir; a «Fuera de fábrica», cualquiera.
                    put: (to, _from, dragEl) => to.el.dataset.zone === 'off' || (dragEl.dataset.zones || '').split(',').includes(to.el.dataset.zone)
                },
                draggable: '.hc-factory-tile',
                filter: '.hc-factory-empty',
                animation: 150,
                ghostClass: 'opacity-40',
                onEnd: (evt) => {
                    if (evt.from === evt.to && evt.oldIndex === evt.newIndex) return;
                    this.saveFactory();
                }
            });
        });
    }

    // Manda el acomodo completo de lo que se ve: las de fábrica por zona y después las de fuera.
    async saveFactory() {
        const items = [];

        ['top', 'main', 'side', 'off'].forEach((zone) => {
            $(`#hcBoard .hc-factory-list[data-zone="${zone}"] .hc-factory-tile`).each((_i, el) => {
                const id = Number($(el).data('id'));
                const w = this.data.widgets.find(x => x.id === id);
                items.push({ id: id, zone: zone === 'off' ? w.zone : zone, default: zone === 'off' ? 0 : 1 });
            });
        });

        const request = await useFetch({ url: this._link, data: { opc: 'saveFactory', items: JSON.stringify(items) } });

        if (!request || request.status !== 200) {
            notify(request);
            this.renderBoard();
            return;
        }

        // Lo mismo que guardó el servidor, sin volver a pedir todo.
        items.forEach((x, i) => {
            const w = this.data.widgets.find(r => r.id === x.id);
            w.zone = x.zone;
            w.default = x.default;
            w.orden = (i + 1) * 10;
        });
        this.data.widgets.sort((a, b) => (a.orden - b.orden) || (a.id - b.id));

        this.renderNav();
        this.renderBoard();
    }

    // -- CRUD --

    // Lo que una tarjeta nueva hereda de donde se está viendo.
    presetFromView() {
        if (this.view === 'general') return { module_id: 'general' };
        if (typeof this.view === 'number') return { module_id: String(this.view) };
        return {};
    }

    addCard(preset = {}) {
        if (!this.data) return;

        this.createModalForm({
            id: 'formHomeCardAdd',
            data: { opc: 'addHomeWidget' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nueva tarjeta del inicio' },
            autofill: Object.assign({ is_default: 'no' }, preset),
            json: this.jsonCard(),
            success: (r) => afterSave(r, () => this.ls())
        });

        this.mountExtras('formHomeCardAdd', { icon: '', zones: null, zone: null, moduleTouched: !!preset.module_id });
    }

    async editCard(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getHomeWidget', id: id } });
        if (!request || request.status !== 200) { notify(request); return; }

        const w = request.data;

        this.createModalForm({
            id: 'formHomeCardEdit',
            data: { opc: 'editHomeWidget', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: `Editar tarjeta · <span class="text-blue-600 font-bold">${esc(w.name)}</span>` },
            autofill: w,
            json: this.jsonCard(),
            success: (r) => afterSave(r, () => this.ls())
        });

        // Al editar, el código no sigue al nombre.
        $('#formHomeCardEdit #name').removeAttr('onkeyup');

        this.mountExtras('formHomeCardEdit', { icon: w.icon, zones: w.zones, zone: w.zone, moduleTouched: true });

        if (w.homes) {
            $('#formHomeCardEdit #zonesFieldWrap').append(accessNote('info', `Está en ${w.homes} ${w.homes === 1 ? 'inicio personalizado' : 'inicios personalizados'}. Si le quitas una zona donde algún dueño la tiene, a él le cae en la zona de «Al agregarla cae en».`).addClass('mt-2'));
        }
    }

    toggleCard(w, active) {
        const text = active
            ? 'Vuelve al catálogo y a los inicios donde estaba.'
            : (w.homes ? `Sale del catálogo y de ${w.homes} ${w.homes === 1 ? 'inicio' : 'inicios'} donde está. Si la vuelves a encender, regresa a su lugar.` : 'Sale del catálogo: nadie la podrá agregar.');

        this.swalQuestion({
            opts: { title: `¿${active ? 'Encender' : 'Apagar'} «${esc(w.name)}»?`, text: text, icon: 'warning' },
            data: { opc: 'toggleHomeWidget', id: w.id, active: active },
            methods: { send: (r) => afterSave(r, () => this.ls()) }
        });
    }

    deleteCard(w) {
        this.swalQuestion({
            opts: {
                title: `¿Eliminar «${esc(w.name)}» para siempre?`,
                text: w.homes
                    ? `Se borra del catálogo y del acomodo de ${w.homes} ${w.homes === 1 ? 'dueño' : 'dueños'} que la tenía. Su función sigue en el código. No se puede deshacer.`
                    : 'Se borra del catálogo. Su función sigue en el código y puedes armar otra con ella. No se puede deshacer.',
                icon: 'warning'
            },
            data: { opc: 'deleteHomeWidget', id: w.id },
            methods: { send: (r) => afterSave(r, () => this.ls()) }
        });
    }

    jsonCard() {
        const modules = [{ id: 'general', valor: 'General · todas las empresas' }]
            .concat(this.data.modules.map(m => ({ id: String(m.id), valor: m.active ? m.name : `${m.name} (apagado)` })));

        const functions = this.data.functions.map(f => ({ id: f.id, valor: `${f.name} · ${f.module_name} · ${f.id}()` }));

        return [
            { opc: 'input', id: 'name', lbl: 'Nombre (lo ve el dueño)', class: 'col-12 col-md-6 mb-3', required: true, onkeyup: 'autoCode(this.value)', placeholder: 'Ej. Top 10 productos' },
            { opc: 'input', id: 'code', lbl: 'Código (automático)', class: 'col-12 col-md-6 mb-3', readonly: true, required: false },
            { opc: 'select', id: 'fn', lbl: 'Función: sus datos y cómo se ve', class: 'col-12 col-md-6 mb-3', required: true, data: functions },
            { opc: 'select', id: 'module_id', lbl: 'Módulo: quién la puede ver', class: 'col-12 col-md-6 mb-3', required: true, data: modules },
            // Hueco vacío: lo rellena modules.mountIconField() con el selector de íconos.
            { opc: 'div', id: 'iconFieldWrap', lbl: 'Ícono', class: 'col-12 col-md-6 mb-3', required: false },
            {
                opc: 'select', id: 'is_default', lbl: '¿La trae el inicio de fábrica?', class: 'col-12 col-md-6 mb-3', required: true,
                data: [{ id: 'no', valor: 'No: el dueño la agrega' }, { id: 'yes', valor: 'Sí: sale sin que la agregue' }]
            },
            { opc: 'input', id: 'description', lbl: 'Descripción (la lee el dueño al elegirla)', class: 'col-12 mb-3', required: false },
            // Hueco vacío: lo rellena mountZones() con las zonas y dónde cae.
            { opc: 'div', id: 'zonesFieldWrap', lbl: 'Dónde puede ir', class: 'col-12 mb-3', required: false },
            { opc: 'input', id: 'route', lbl: '«Ver más» lleva a (opcional, relativa a pro/)', class: 'col-12 mb-3', required: false, placeholder: 'app/order/pedidos.php' }
        ];
    }

    /*  Lo que el formulario de CoffeeSoft no trae: el selector de íconos, las
        zonas (casillas + dónde cae) y la lista de rutas para «Ver más». Al
        cambiar la función, las zonas se ajustan a donde ella se ve bien y, si
        no se eligió módulo a mano, el módulo pasa al de la función. */
    mountExtras(formId, o) {
        const $form = $(`#${formId}`);

        modules.mountIconField(formId, o.icon || '', false);

        const $route = $form.find('#route');
        if (!$('#hcRoutes').length) {
            $('body').append($('<datalist>', { id: 'hcRoutes' }).append((dataInit.routes || []).map(r => $('<option>', { value: r.id }))));
        }
        $route.attr('list', 'hcRoutes').attr('autocomplete', 'off');

        const $wrap = $form.find('#zonesFieldWrap');
        const boxes = $('<div>', { class: 'flex flex-wrap gap-2' });

        Object.keys(this.data.zones).forEach((z) => {
            boxes.append($('<label>', { class: 'hc-zone inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1 ring-inset ring-gray-200 text-sm cursor-pointer select-none' }).append(
                $('<input>', { type: 'checkbox', value: z, class: 'hc-zone-box' }),
                $('<span>', { text: this.data.zones[z] })
            ));
        });

        const $zone = $('<select>', { name: 'zone', id: 'zone', class: this.cfThemedClass(CF_CSS.input, 'light') + ' !w-auto' });
        const $hidden = $('<input>', { type: 'hidden', name: 'zones', id: 'zones' });

        $wrap.append(
            boxes,
            $('<div>', { class: 'flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-600' }).append($('<span>', { text: 'Al agregarla cae en' }), $zone),
            $hidden
        );

        let moduleTouched = o.moduleTouched;
        $form.find('#module_id').on('change', () => { moduleTouched = true; });

        // Pinta las casillas según la función: las que no le quedan, apagadas.
        const paint = (zones, zone) => {
            const fn = this.fn($form.find('#fn').val());
            const fits = fn ? fn.zones : Object.keys(this.data.zones);

            $wrap.find('.hc-zone-box').each((_i, el) => {
                const ok = fits.includes(el.value);
                el.disabled = !ok;
                el.checked = ok && (zones ? zones.includes(el.value) : true);
                $(el).closest('label').toggleClass('opacity-40 cursor-not-allowed', !ok).attr('title', ok ? '' : 'Esta función no se ve bien aquí');
            });

            sync(zone);
        };

        // Lo marcado pasa al hidden `zones` y a las opciones de «cae en».
        const sync = (zone) => {
            const checked = $wrap.find('.hc-zone-box:checked').map((_i, el) => el.value).get();
            const keep = zone || $zone.val();

            $hidden.val(checked.join(','));
            $zone.empty().append(checked.map(z => $('<option>', { value: z, text: this.data.zones[z] })));
            $zone.val(checked.includes(keep) ? keep : (checked.includes('main') ? 'main' : checked[0] || ''));
        };

        $wrap.on('change', '.hc-zone-box', () => sync());

        $form.find('#fn').on('change', () => {
            const fn = this.fn($form.find('#fn').val());
            paint(null, null);

            if (fn && !moduleTouched) {
                const m = fn.module ? this.data.modules.find(x => x.code === fn.module) : null;
                $form.find('#module_id').val(m ? String(m.id) : 'general');
            }
        });

        paint(o.zones, o.zone);
    }

    // -- Complements --

    // Las tarjetas que se ven hoy en algún inicio: encendidas, con función y con su módulo encendido.
    live() {
        return this.data.widgets.filter((w) => {
            if (!w.active || !w.fn_ok) return false;
            const m = w.module_id ? this.module(w.module_id) : null;
            return !w.module_id || (m && m.active);
        });
    }

    byStatus(list) {
        const s = this.status;
        return s === 'all' ? list : list.filter(w => String(w.active) === s);
    }

    module(id) {
        return this.data.modules.find(m => m.id === Number(id)) || null;
    }

    fn(id) {
        return this.data.functions.find(f => f.id === id) || null;
    }

    countLabel(list) {
        const off = list.filter(w => !w.active).length;
        const n = list.length;
        return `${n} ${n === 1 ? 'tarjeta' : 'tarjetas'}${off ? ` (${off} ${off === 1 ? 'apagada' : 'apagadas'})` : ''}`;
    }

    companiesLabel(n) {
        return n ? `lo ${n === 1 ? 'tiene 1 empresa' : `tienen ${n} empresas`}` : 'ninguna empresa lo tiene';
    }

    sectionTitle(text, side) {
        return $('<div>', { class: 'flex items-center justify-between gap-2 px-1 pt-1' }).append(
            $('<p>', { class: 'text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0', text: text }),
            $('<span>', { class: 'text-[11px] font-medium text-gray-400', text: side })
        );
    }

    chip(icon, text) {
        return $('<span>', { class: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-inset ring-gray-200 text-xs text-gray-600' }).append(
            $('<i>', { 'data-lucide': icon, class: 'w-3.5 h-3.5 text-gray-400' }),
            $('<span>', { text: text })
        );
    }

    // title con .attr(): como prop de $('<el>', {...}) jQuery llama a $.fn.title
    // (complementos.js), que lo vuelve popover y queda huérfano al re-pintar.
    iconButton(icon, label, onClick, hover = 'hover:text-blue-600') {
        return $('<button>', {
            type: 'button',
            'aria-label': label,
            class: `w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 ${hover} hover:bg-gray-100 transition`
        }).attr('title', label).append($('<i>', { 'data-lucide': icon, class: 'w-3.5 h-3.5' })).on('click', (e) => {
            e.stopPropagation();
            onClick();
        });
    }

    tag(text) {
        return $('<span>', { class: 'shrink-0 px-1.5 rounded bg-amber-50 text-amber-700 text-[11px] font-medium', text: text });
    }

    emptyState(icon, title, text) {
        return $('<div>', { class: 'flex-1 flex flex-col items-center justify-center text-center py-14 px-6' }).append(
            $('<i>', { 'data-lucide': icon, class: 'w-8 h-8 text-gray-300 mb-2' }),
            $('<p>', { class: 'text-sm font-medium text-gray-600 mb-0', text: title }),
            $('<p>', { class: 'text-xs text-gray-400 mt-1 mb-0 max-w-sm', text: text })
        );
    }

    normalize(text) {
        return (text || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }
}
