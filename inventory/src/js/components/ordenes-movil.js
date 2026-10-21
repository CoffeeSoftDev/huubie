// -- ordenesMovil --
// Pedidos en el teléfono: encabezado con la sucursal, estados en píldoras, una tarjeta por
// pedido, botón flotante de nuevo pedido y barra inferior. Va fijo debajo del navbar (64px);
// el rail lateral (z-40) y su velo (z-30) le pasan por encima. El detalle se pinta a
// pantalla completa en detailParent().
// Bootstrap trae .border, .rounded, .shadow-lg y los espaciados 3+ con !important: aquí
// van border-[1px], radios, sombras y espacios con valor propio.

class OrdenesMovil {

    constructor(options) {
        const o = options || {};

        const defaults = {
            parent:    'root',
            id:        'ordenesMovil',
            title:     '',
            branches:  [],
            branch:    '',
            locked:    false,
            chips:     [],
            chip:      '',
            tabs:      [],
            tab:       '',
            showNew:   true,
            rangeText: '',
            json:      [],
            // {estado: [texto, fondo]} de Catálogo › Estados requisición; mandan sobre BADGES.
            colores:   {},
            labels: {
                todas:      'Todas las sucursales',
                nuevo:      'Nuevo pedido',
                material:   'material',
                materiales: 'materiales',
                necesita:   'Lo necesita',
                nueva:      'Solicitud nueva',
                emptyTitle: 'No hay pedidos',
                emptyHint:  'Prueba con otro estado o crea un pedido nuevo.'
            },
            onChip:   () => {},
            onBranch: () => {},
            onTab:    () => {},
            onOpen:   () => {},
            onNew:    () => {}
        };

        this.opts        = Object.assign({}, defaults, o);
        this.opts.labels = Object.assign({}, defaults.labels, o.labels || {});
        this.cards       = [];
    }

    // Por el estado que se muestra (estadoRequisicion del ctrl); los reabastos usan el de la BD.
    static get BADGES() {
        return {
            'En espera':            'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
            'Entregado':            'bg-blue-500/15 text-blue-700 border-blue-500/30',
            'Surtido parcialmente': 'bg-orange-500/15 text-orange-600 border-orange-500/30',
            'Confirmado':           'bg-green-500/15 text-green-600 border-green-500/30',
            Borrador:   'bg-gray-500/15 text-gray-500 border-gray-400/30',
            Solicitada: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
            Aprobada:   'bg-blue-500/15 text-blue-700 border-blue-500/30',
            Parcial:    'bg-orange-500/15 text-orange-600 border-orange-500/30',
            Recibida:   'bg-green-500/15 text-green-600 border-green-500/30',
            Rechazada:  'bg-red-500/15 text-red-600 border-red-500/30',
            Cancelada:  'bg-red-500/15 text-red-600 border-red-500/30'
        };
    }

    // -- Render --

    render() {
        const o = this.opts;
        this.ensureStyles();

        this.root = $('<div>', {
            id:    o.id,
            class: 'fixed inset-x-0 top-[64px] bottom-0 z-20 flex flex-col bg-[#F3F4F6]'
        }).append(
            this.renderHeader(),
            $('<div>', { id: `${o.id}_list`, class: 'flex-1 min-h-0 overflow-y-auto px-[16px] pt-[12px] pb-[96px]' }),
            this.renderFab(),
            $('<nav>', {
                id:    `${o.id}_nav`,
                class: 'flex-shrink-0 bg-white border-t-[1px] border-gray-200 px-[24px] pt-2 flex items-center justify-around',
                style: 'padding-bottom:max(10px, env(safe-area-inset-bottom))'
            })
        );

        this.detail = $('<div>', { id: `${o.id}Detalle`, class: 'hidden fixed inset-0 z-[60] bg-white flex flex-col' })
            .append($('<div>', { id: this.detailParent(), class: 'flex-1 min-h-0 flex flex-col' }));

        $(`#${o.parent}`).empty().append(this.root, this.detail);

        this.bindEvents();
        this.setView({});
        this.setCards(o.json);
        return this;
    }

    renderHeader() {
        const o = this.opts;

        return $('<div>', { class: 'flex-shrink-0 bg-white border-b-[1px] border-gray-200 px-[16px] pt-[12px] pb-[12px]' }).append(
            $('<div>', { class: 'mb-[12px]' }).append(
                $('<h1>', { id: `${o.id}_title`, class: 'text-[18px] font-bold text-gray-800 leading-tight m-0' }),
                $('<div>', { id: `${o.id}_branch`, class: 'mt-1' })
            ),
            $('<div>', { id: `${o.id}_chips`, class: 'flex items-center gap-2 overflow-x-auto -mx-[16px] px-[16px]' })
        );
    }

    // Con más de una sucursal el chip es un select transparente encima: abre el selector
    // nativo del teléfono.
    renderBranch() {
        const o      = this.opts;
        const actual = o.branches.find(b => String(b.id) === String(o.branch));
        const nombre = actual && actual.id !== '' ? actual.valor : o.labels.todas;
        const editable = !o.locked && o.branches.length > 1;

        const chip = $('<label>', {
            class: 'relative inline-flex items-center gap-1 m-0 px-2 py-[2px] rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border-[1px] border-blue-100'
        }).append(
            $('<i>', { 'data-lucide': 'map-pin', class: 'w-[12px] h-[12px] flex-shrink-0' }),
            $('<span>', { class: 'max-w-[240px] truncate', text: nombre })
        );

        if (editable) {
            chip.append(
                $('<i>', { 'data-lucide': 'chevron-down', class: 'w-[12px] h-[12px] flex-shrink-0' }),
                $('<select>', { class: 'absolute inset-0 w-full h-full opacity-0 cursor-pointer', 'aria-label': 'Sucursal' })
                    .append(o.branches.map(b => $('<option>', { value: b.id, text: b.valor })))
                    .val(o.branch)
                    .on('change', (e) => {
                        o.branch = e.target.value;
                        this.renderBranch();
                        o.onBranch(o.branch);
                    })
            );
        }

        $(`#${o.id}_branch`).empty().append(chip);
    }

    renderChips() {
        const o = this.opts;

        $(`#${o.id}_chips`).empty().append(o.chips.map(c => {
            const on = String(c.id) === String(o.chip);

            return $('<button>', {
                type:        'button',
                'data-chip': c.id,
                class:       'flex-shrink-0 px-[14px] py-[6px] rounded-full text-[12px] font-semibold whitespace-nowrap border-[1px] transition-colors '
                           + (on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'),
                text:        c.valor
            });
        }));

        const activo = $(`#${o.id}_chips [data-chip="${String(o.chip).replace(/"/g, '')}"]`)[0];
        if (activo) activo.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    renderFab() {
        return $('<button>', {
            type:         'button',
            id:           `${this.opts.id}_new`,
            'aria-label': this.opts.labels.nuevo,
            class:        'absolute right-[20px] bottom-[84px] z-10 w-[56px] h-[56px] rounded-full bg-blue-600 border-0 text-white flex items-center justify-center active:scale-95 transition-transform',
            style:        'box-shadow:0 10px 24px -6px rgb(var(--brand-600, 192 90 64) / .55)'
        }).append($('<i>', { 'data-lucide': 'plus', class: 'w-[24px] h-[24px]' }));
    }

    renderNav() {
        const o = this.opts;

        $(`#${o.id}_nav`).empty().append(o.tabs.map(t => {
            const on = t.id === o.tab;

            return $('<button>', {
                type:       'button',
                'data-tab': t.id,
                class:      'flex-1 flex flex-col items-center gap-[2px] py-1 bg-transparent border-0 ' + (on ? 'text-blue-600' : 'text-gray-400')
            }).append(
                $('<i>', { 'data-lucide': t.icon, class: 'w-[20px] h-[20px]' }),
                $('<span>', { class: 'text-[10px] ' + (on ? 'font-semibold' : 'font-medium'), text: t.text })
            );
        }));
    }

    // -- Tarjetas --

    setCards(json) {
        const o     = this.opts;
        const $list = $(`#${o.id}_list`).empty();

        this.cards = json || [];

        if (this.cards.length) {
            $list.append($('<div>', { class: 'space-y-[12px]' }).append(this.cards.map(c => this.card(c))));
        } else {
            $list.append(
                $('<div>', { class: 'flex flex-col items-center justify-center text-center py-[48px] px-[24px]' }).append(
                    $('<i>', { 'data-lucide': 'clipboard-list', class: 'w-[40px] h-[40px] text-gray-300 mb-[12px]' }),
                    $('<p>', { class: 'text-[14px] font-semibold text-gray-500 m-0', text: o.labels.emptyTitle }),
                    $('<p>', { class: 'text-[12px] text-gray-400 mt-1 mb-0', text: o.labels.emptyHint })
                )
            );
        }

        if (o.rangeText) {
            $list.append($('<p>', { class: 'text-center text-[11px] text-gray-400 mt-[16px] mb-0', text: o.rangeText }));
        }

        if (window.lucide) lucide.createIcons();
    }

    card(c) {
        const o     = this.opts;
        const estado = c.estado || c.status;
        const badge  = OrdenesMovil.BADGES[estado] || OrdenesMovil.BADGES.Borrador;
        // El color elegido en el Catálogo (los reabastos REAB- conservan el suyo).
        const color  = String(c.folio || '').startsWith('REAB-') ? null : (o.colores || {})[estado];
        const total = Number(c.total || 0);

        const top = $('<div>', { class: 'flex items-center justify-between gap-2 mb-2' }).append(
            $('<div>', { class: 'flex items-center gap-2 min-w-0' }).append(
                c.nueva ? $('<span>', { class: 'inline-block w-[6px] h-[6px] bg-green-400 rounded-full animate-pulse flex-shrink-0', 'aria-label': o.labels.nueva }) : null,
                $('<span>', { class: 'text-[14px] font-bold text-gray-800 whitespace-nowrap', text: c.folio }),
                $('<span>', { class: 'text-[11px] text-gray-400 truncate', text: c.hace || '' })
            ),
            $('<span>', {
                class: `flex-shrink-0 px-2 py-[2px] rounded-[6px] text-[11px] font-bold border-[1px] ${color ? '' : badge}`,
                css:   color ? { color: color[0], background: color[1] || 'transparent', borderColor: `${color[0]}4D` } : {},
                text:  estado
            })
        );

        const mid = $('<div>', { class: 'flex items-center justify-between gap-2' }).append(
            $('<p>', { class: 'text-[12px] text-gray-600 truncate flex-1 min-w-0 m-0' }).append(
                document.createTextNode(c.materiales || '—'),
                c.mas > 0 ? $('<span>', { class: 'text-gray-400', text: ` +${c.mas}` }) : null
            ),
            $('<span>', { class: 'flex items-center gap-1 text-[11px] text-gray-400 flex-shrink-0' }).append(
                $('<i>', { 'data-lucide': 'package', class: 'w-[14px] h-[14px]' }),
                $('<span>', { text: `${total} ${total === 1 ? o.labels.material : o.labels.materiales}` })
            )
        );

        const foot = c.pide
            ? $('<div>', { class: 'flex items-center gap-[6px] mt-2 text-[11px] text-gray-500 min-w-0' }).append(
                $('<i>', { 'data-lucide': 'map-pin', class: 'w-[13px] h-[13px] flex-shrink-0' }),
                $('<span>', { class: 'truncate', text: c.pide }),
                c.necesita ? $('<span>', { class: 'text-gray-300', text: '·' }) : null,
                c.necesita ? $('<span>', { class: 'whitespace-nowrap ' + (c.hoy ? 'font-semibold text-red-600' : ''), text: `${o.labels.necesita}: ${c.necesita}` }) : null
            )
            : null;

        return $('<button>', {
            type:        'button',
            'data-card': c.id,
            class:       'block w-full text-left bg-white rounded-[12px] border-[1px] border-gray-200 p-[14px] shadow-sm active:scale-[.99] transition-transform'
        }).append(top, mid, foot);
    }

    // -- Public API --

    setView(view) {
        Object.assign(this.opts, view || {});
        const o = this.opts;

        $(`#${o.id}_title`).text(o.title);
        $(`#${o.id}_new`).toggleClass('hidden', !o.showNew);
        this.renderBranch();
        this.renderChips();
        this.renderNav();

        if (window.lucide) lucide.createIcons();
    }

    isActive() {
        return window.matchMedia('(max-width: 767.98px)').matches;
    }

    detailParent() {
        return `${this.opts.id}DetalleBody`;
    }

    toggleDetail(open) {
        this.detail.toggleClass('hidden', !open);
        if (open) $(`#${this.detailParent()} > div`).scrollTop(0);
    }

    // -- Events --

    bindEvents() {
        const o = this.opts;

        this.root.on('click', '[data-chip]', (e) => {
            o.chip = String($(e.currentTarget).attr('data-chip'));
            this.renderChips();
            o.onChip(o.chip);
        });

        this.root.on('click', '[data-card]', (e) => {
            const id   = String($(e.currentTarget).attr('data-card'));
            const card = this.cards.find(c => String(c.id) === id);
            if (card) o.onOpen(card);
        });

        this.root.on('click', '[data-tab]', (e) => {
            const tab = o.tabs.find(t => t.id === $(e.currentTarget).attr('data-tab'));
            if (!tab) return;
            if (tab.href) { window.location.href = tab.href; return; }
            if (tab.id === o.tab) return;
            o.onTab(tab.id);
        });

        this.root.on('click', `#${o.id}_new`, () => o.onNew());
    }

    // El detalle reusa el panel de escritorio: aquí se desplaza completo, con su
    // encabezado arriba y los botones de acción abajo siempre a la vista.
    ensureStyles() {
        if (document.getElementById('ordenesMovilStyles')) return;

        const body  = this.detailParent();
        const style = document.createElement('style');
        style.id          = 'ordenesMovilStyles';
        style.textContent = `
            #${this.opts.id}_chips { scrollbar-width: none; }
            #${this.opts.id}_chips::-webkit-scrollbar { display: none; }
            #${body} > div { overflow-y: auto !important; }
            #${body} > div > .flex-1 { flex: none !important; overflow: visible !important; }
            #${body} > div > :first-child { position: sticky; top: 0; z-index: 2; }
            #${body} .cs-orden-actions { position: sticky; bottom: 0; z-index: 2; background: #fff; padding-bottom: max(12px, env(safe-area-inset-bottom)); }`;
        document.head.appendChild(style);
    }
}


// -- ordenMovilForm --
// Nuevo pedido en el teléfono, a pantalla completa: sucursal que pide (fija), a quién se le
// pide y para cuándo, buscador con "Agregar", renglones con cantidad −/+, comentario y
// resumen. "Enviar pedido" confirma y llama a onSave(payload); si resuelve true se cierra.
// Busca y arma el texto de confirmación con un OrdenForm suelto (sin pintarlo): mismos
// resultados, mismo orden y misma semilla de costo que la captura de escritorio.

class OrdenMovilForm {

    constructor(options) {
        const o = options || {};

        const defaults = {
            parent:   'body',
            id:       'ordenMovilForm',
            title:    'Nuevo pedido',
            sucursal: '',
            json:     [],
            data: {
                sucursales:  [],
                unidades:    [],
                destino:     '',
                solicitante: ''
            },
            edit:     null,
            labels: {
                sucursal:      'Sucursal solicitante',
                buscar:        'Buscar material',
                placeholder:   'Nombre o SKU del material...',
                agregar:       'Agregar',
                sinResultados: 'Sin resultados para',
                agregados:     'Materiales agregados',
                vacioTitulo:   'Aún no has agregado materiales',
                vacioHint:     'Búscalos arriba por nombre o SKU',
                cantidad:      'Cantidad',
                nota:          'Comentario',
                opcional:      '(opcional)',
                materiales:    'Materiales',
                unidades:      'Unidades totales',
                enviar:        'Enviar pedido',
                sinMateriales: 'Agrega al menos un material al pedido',
                sinDestino:    'Elige a qué sucursal le pides',
                sinCantidad:   'Escribe la cantidad de',
                salirTitulo:   'Tienes materiales sin enviar',
                borradorHint:  'Queda en Mis pedidos para enviarlo después',
                salirHint:     'Se pierden los materiales que agregaste',
                cambiosTitulo: 'Tienes cambios sin guardar',
                cambiosHint:   'El pedido conserva su estado',
                descartarHint: 'Se pierden los cambios que hiciste',
                seguir:        'Seguir capturando'
            },
            onSave: async () => false
        };

        this.opts        = Object.assign({}, defaults, o);
        this.opts.data   = Object.assign({}, defaults.data, o.data || {});
        this.opts.labels = Object.assign({}, defaults.labels, o.labels || {});
        this.lote        = ((this.opts.edit && this.opts.edit.productos) || []).map(p => Object.assign({}, p));
        this.term        = '';
        this.saving      = false;

        this.catalogo = Object.assign(Object.create(OrdenForm.prototype), {
            opts: {
                json:   this.opts.json,
                data:   this.opts.data,
                labels: OrdenForm.LABELS
            },
            lote: []
        });
    }

    // -- Render --

    // Con `edit` (id, folio, fecha, nota, productos) abre el pedido con sus datos y guarda
    // los cambios; sin él es un pedido nuevo.
    render() {
        const o = this.opts;
        $(`#${o.id}`).remove();
        this.ensureStyles();

        this.root = $('<div>', { id: o.id, class: 'fixed inset-0 z-[60] bg-[#F3F4F6] flex flex-col' }).append(
            $('<div>', { class: 'flex-shrink-0 bg-white border-b-[1px] border-gray-200 px-[12px] py-[12px] flex items-center gap-2' }).append(
                $('<button>', { type: 'button', id: `${o.id}_back`, 'aria-label': 'Regresar', class: 'w-[36px] h-[36px] rounded-[8px] bg-transparent border-0 flex items-center justify-center text-gray-600 flex-shrink-0 active:bg-gray-100' })
                    .append($('<i>', { 'data-lucide': 'arrow-left', class: 'w-[20px] h-[20px]' })),
                $('<h1>', { class: 'text-[16px] font-bold text-gray-800 m-0 truncate', text: o.edit ? `${OrdenForm.LABELS.titleEdit} ${o.edit.folio || ''}`.trim() : o.title })
            ),
            $('<div>', { class: 'flex-1 min-h-0 overflow-y-auto px-[16px] pt-[16px] pb-[24px] space-y-[20px]' }).append(
                this.renderSucursal(),
                this.renderCampos(),
                this.renderBuscador(),
                this.renderAgregados(),
                this.renderNota(),
                this.renderResumen()
            ),
            $('<div>', {
                class: 'flex-shrink-0 bg-white border-t-[1px] border-gray-200 px-[16px] pt-[12px]',
                style: 'padding-bottom:max(16px, env(safe-area-inset-bottom))'
            }).append(
                $('<button>', {
                    type:  'button',
                    id:    `${o.id}_enviar`,
                    class: 'w-full h-[48px] rounded-[12px] bg-blue-600 border-0 text-white text-[14px] font-bold flex items-center justify-center gap-2 active:scale-[.99] transition-transform',
                    style: 'box-shadow:0 10px 20px -8px rgb(var(--brand-600, 192 90 64) / .5)'
                }).append(
                    $('<i>', { 'data-lucide': o.edit ? 'check' : 'send', class: 'w-[18px] h-[18px]' }),
                    $('<span>', { text: o.edit ? OrdenForm.LABELS.guardarEdit : o.labels.enviar })
                )
            )
        );

        $(o.parent === 'body' ? 'body' : `#${o.parent}`).append(this.root);

        $(`#${o.id}_destino`).val(o.data.destino);
        if (o.edit) {
            $(`#${o.id}_fecha`).val(o.edit.fecha || '');
            $(`#${o.id}_nota`).val(o.edit.nota || '');
        }
        this.bindEvents();
        this.syncMisma();
        this.paintLote();
        this.huellaInicial = this.huella();
        return this;
    }

    // Lo que se guardaría: sirve para saber si hubo cambios al salir de una edición.
    huella() {
        const o = this.opts;
        return JSON.stringify([
            $(`#${o.id}_destino`).val(),
            $(`#${o.id}_fecha`).val(),
            $(`#${o.id}_nota`).val(),
            this.lote.map(p => [String(p.id), Number(p.cantidad || 0), String(p.unit_id || '')])
        ]);
    }

    label(text) {
        return $('<label>', { class: 'block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-[6px]', text });
    }

    control() {
        return 'om-control w-full h-[46px] px-[12px] text-[16px] text-gray-800 bg-white border-[1px] border-gray-300 rounded-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
    }

    renderSucursal() {
        return $('<div>', { class: 'flex items-center gap-[10px] bg-blue-50 border-[1px] border-blue-100 rounded-[12px] px-[14px] py-[12px]' }).append(
            $('<div>', { class: 'w-[36px] h-[36px] rounded-[8px] bg-blue-600 flex items-center justify-center text-white flex-shrink-0' })
                .append($('<i>', { 'data-lucide': 'map-pin', class: 'w-[18px] h-[18px]' })),
            $('<div>', { class: 'flex-1 min-w-0' }).append(
                $('<p>', { class: 'text-[10px] uppercase tracking-wider text-blue-700/70 font-semibold m-0', text: this.opts.labels.sucursal }),
                $('<p>', { class: 'text-[14px] font-bold text-gray-800 truncate m-0', text: this.opts.sucursal || '-' })
            ),
            $('<i>', { 'data-lucide': 'lock', class: 'w-[16px] h-[16px] text-blue-400 flex-shrink-0' })
        );
    }

    // A quién se le pide (arranca en la sucursal de la sesión, como en escritorio) y para
    // cuándo (vacía: hay que elegirla). Abajo, el aviso de pedirle a la misma sucursal.
    renderCampos() {
        const o = this.opts;

        return $('<div>').append(
            $('<div>', { class: 'grid grid-cols-2 gap-[10px]' }).append(
                $('<div>', { class: 'min-w-0' }).append(
                    this.label(OrdenForm.LABELS.sucursal),
                    $('<div>', { class: 'relative' }).append(
                        $('<select>', { id: `${o.id}_destino`, class: `${this.control()} appearance-none pr-[32px] truncate` })
                            .append((o.data.sucursales || []).map(s => $('<option>', { value: s.id, text: s.valor }))),
                        $('<i>', { 'data-lucide': 'chevron-down', class: 'pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-gray-400' })
                    )
                ),
                $('<div>', { class: 'min-w-0' }).append(
                    this.label(OrdenForm.LABELS.fecha),
                    $('<input>', { type: 'date', id: `${o.id}_fecha`, min: o.edit ? '' : this.catalogo.haceUnMes(), class: this.control() })
                )
            ),
            $('<div>', { id: `${o.id}_misma`, class: 'hidden mt-2 flex items-start gap-2 rounded-[10px] border-[1px] border-red-100 bg-red-50 px-[10px] py-2 text-[12px] leading-snug font-semibold text-red-700' }).append(
                $('<i>', { 'data-lucide': 'alert-circle', class: 'w-[14px] h-[14px] mt-px flex-shrink-0 text-red-600' }),
                $('<span>', { text: OrdenForm.LABELS.mismaSucursal })
            )
        );
    }

    renderBuscador() {
        const o = this.opts;

        return $('<div>').append(
            this.label(o.labels.buscar),
            $('<div>', { class: 'relative' }).append(
                $('<i>', { 'data-lucide': 'search', class: 'pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 w-[20px] h-[20px] text-gray-400' }),
                $('<input>', {
                    type:         'text',
                    id:           `${o.id}_buscar`,
                    autocomplete: 'off',
                    enterkeyhint: 'search',
                    placeholder:  o.labels.placeholder,
                    class:        `${this.control()} h-[48px] pl-[44px] pr-[40px]`
                }),
                $('<button>', { type: 'button', id: `${o.id}_limpiar`, 'aria-label': 'Limpiar búsqueda', class: 'hidden absolute right-[8px] top-1/2 -translate-y-1/2 w-[30px] h-[30px] rounded-full bg-transparent border-0 flex items-center justify-center text-gray-400' })
                    .append($('<i>', { 'data-lucide': 'x', class: 'w-[16px] h-[16px]' }))
            ),
            $('<div>', { id: `${o.id}_resultados` })
        );
    }

    renderAgregados() {
        const o = this.opts;

        return $('<div>').append(
            $('<div>', { class: 'flex items-center justify-between mb-2' }).append(
                $('<span>', { class: 'text-[11px] font-semibold uppercase tracking-wider text-gray-500', text: o.labels.agregados }),
                $('<span>', { id: `${o.id}_count`, class: 'text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-[2px] rounded-full', text: '0' })
            ),
            $('<div>', { id: `${o.id}_lote`, class: 'space-y-[10px]' })
        );
    }

    renderNota() {
        const o = this.opts;

        return $('<div>').append(
            $('<label>', { class: 'block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-[6px]' }).append(
                document.createTextNode(`${o.labels.nota} `),
                $('<span>', { class: 'text-gray-400 normal-case font-normal', text: o.labels.opcional })
            ),
            $('<textarea>', {
                id:          `${o.id}_nota`,
                rows:        3,
                placeholder: OrdenForm.LABELS.nota,
                class:       'w-full px-[14px] py-[12px] text-[16px] text-gray-800 bg-white border-[1px] border-gray-300 rounded-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none'
            })
        );
    }

    renderResumen() {
        const o    = this.opts;
        const stat = (id, color, text) => $('<div>', { class: 'text-center' }).append(
            $('<p>', { id, class: `text-[24px] font-bold m-0 ${color}`, text: '0' }),
            $('<p>', { class: 'text-[11px] text-gray-500 m-0', text })
        );

        return $('<div>', { class: 'bg-white border-[1px] border-gray-200 rounded-[12px] p-[14px] flex items-center justify-around' }).append(
            stat(`${o.id}_totMat`, 'text-gray-800', o.labels.materiales),
            $('<div>', { class: 'w-px h-[36px] bg-gray-200' }),
            stat(`${o.id}_totUds`, 'text-blue-600', o.labels.unidades)
        );
    }

    // -- Buscador --

    paintResultados() {
        const o    = this.opts;
        const $box = $(`#${o.id}_resultados`).empty();
        const term = this.term.trim();

        $(`#${o.id}_limpiar`).toggleClass('hidden', !this.term);
        if (!term) return;

        const items = this.catalogo.matchCatalogo(term).slice(0, 8);

        if (!items.length) {
            $box.append($('<p>', {
                class: 'mt-2 mb-0 px-[14px] py-[12px] bg-white border-[1px] border-gray-200 rounded-[12px] text-[13px] text-gray-500',
                text:  `${o.labels.sinResultados} “${term}”`
            }));
            return;
        }

        $box.append(
            $('<div>', { class: 'mt-2 bg-white border-[1px] border-gray-200 rounded-[12px] divide-y divide-gray-100 overflow-hidden' })
                .append(items.map(p => this.resultado(p)))
        );

        if (window.lucide) lucide.createIcons();
    }

    // Ya agregado: en lugar de "Agregar" muestra la cantidad que lleva; tocarlo suma uno.
    resultado(p) {
        const o    = this.opts;
        const r    = this.lote.find(x => String(x.id) === String(p.id));
        const meta = [p.sku, p.categoria].filter(Boolean).join(' · ');

        const accion = r
            ? $('<span>', { class: 'flex items-center gap-1 px-[10px] py-1 rounded-[8px] bg-blue-50 text-blue-700 text-[12px] font-semibold flex-shrink-0' }).append(
                $('<i>', { 'data-lucide': 'check', class: 'w-[14px] h-[14px]' }),
                $('<span>', { text: this.fmt(r.cantidad) })
            )
            : $('<span>', { class: 'flex items-center gap-1 px-[10px] py-1 rounded-[8px] bg-blue-600 text-white text-[12px] font-semibold flex-shrink-0' }).append(
                $('<i>', { 'data-lucide': 'plus', class: 'w-[14px] h-[14px]' }),
                $('<span>', { text: o.labels.agregar })
            );

        return $('<button>', { type: 'button', 'data-add': p.id, class: 'w-full flex items-center gap-[12px] px-[14px] py-[12px] text-left bg-white border-0 active:bg-blue-50' }).append(
            $('<div>', { class: 'flex-1 min-w-0' }).append(
                $('<p>', { class: 'text-[14px] font-medium text-gray-800 truncate m-0', text: p.nombre }),
                meta ? $('<p>', { class: 'text-[11px] text-gray-400 truncate m-0', text: meta }) : null
            ),
            accion
        );
    }

    // Al agregar se limpia la búsqueda y se cierra la lista de resultados (y el teclado):
    // queda a la vista la lista de materiales con el recién agregado arriba.
    addProduct(id) {
        const o = this.opts;
        const p = (o.json || []).find(x => String(x.id) === String(id));
        if (!p) return;

        const r = this.lote.find(x => String(x.id) === String(id));
        if (r) r.cantidad = Number(r.cantidad || 0) + 1;
        else   this.lote.push(Object.assign({}, p, this.catalogo.seedTax(p), { cantidad: 1 }));

        this.term = '';
        $(`#${o.id}_buscar`).val('').trigger('blur');
        this.paintResultados();
        this.paintLote();

        const idx = this.lote.findIndex(x => String(x.id) === String(id));
        const row = this.root.find(`[data-row="${idx}"]`)[0];
        if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // -- Materiales agregados --

    // El último agregado va arriba: queda a la vista justo debajo del buscador.
    paintLote() {
        const o    = this.opts;
        const $box = $(`#${o.id}_lote`).empty();

        $(`#${o.id}_count`).text(this.lote.length);

        if (this.lote.length) {
            $box.append(this.lote.map((p, i) => this.renglon(p, i)).reverse());
        } else {
            $box.append(
                $('<div>', { class: 'flex flex-col items-center text-center px-[16px] py-[20px] rounded-[12px] border-[1px] border-dashed border-gray-300 bg-white' }).append(
                    $('<i>', { 'data-lucide': 'package', class: 'w-[24px] h-[24px] text-gray-300 mb-2' }),
                    $('<p>', { class: 'text-[13px] font-semibold text-gray-500 m-0', text: o.labels.vacioTitulo }),
                    $('<p>', { class: 'text-[11px] text-gray-400 m-0', text: o.labels.vacioHint })
                )
            );
        }

        this.paintResumen();
        if (window.lucide) lucide.createIcons();
    }

    // La unidad abre el buscador de unidades (unidadMovilPicker) y la cantidad es un campo
    // que se escribe a mano; −/+ suman o restan uno.
    renglon(p, i) {
        const o        = this.opts;
        const unidades = o.data.unidades || [];
        const unidad   = unidades.length
            ? $('<button>', { type: 'button', 'data-unit-pick': i, 'aria-label': 'Unidad', class: 'om-unit mr-auto min-w-0 max-w-[140px] flex items-center gap-1 pl-[10px] pr-[8px] font-semibold uppercase text-gray-700 bg-white border-[1px] border-gray-300 rounded-[8px]' }).append(
                $('<span>', { class: 'truncate text-[14px]', text: this.catalogo.unidadTexto(p.unit_id) || '-' }),
                $('<i>', { 'data-lucide': 'chevron-down', class: 'w-[14px] h-[14px] text-gray-400 flex-shrink-0' })
            )
            : $('<span>', { class: 'text-[11px] text-gray-400 mr-auto', text: this.catalogo.unitOf(p) || o.labels.cantidad });

        return $('<div>', { 'data-row': i, class: 'bg-white border-[1px] border-gray-200 rounded-[12px] p-[12px]' }).append(
            $('<div>', { class: 'flex items-start justify-between gap-2 mb-[10px]' }).append(
                $('<div>', { class: 'flex-1 min-w-0' }).append(
                    $('<p>', { class: 'text-[14px] font-medium text-gray-800 truncate m-0', text: p.nombre }),
                    p.sku ? $('<p>', { class: 'text-[11px] text-gray-400 m-0', text: p.sku }) : null
                ),
                $('<button>', { type: 'button', 'data-del': i, 'aria-label': 'Quitar', class: 'w-[28px] h-[28px] rounded-[8px] bg-transparent border-0 flex items-center justify-center text-gray-400 flex-shrink-0 active:bg-red-50 active:text-red-500' })
                    .append($('<i>', { 'data-lucide': 'trash-2', class: 'w-[16px] h-[16px]' }))
            ),
            $('<div>', { class: 'flex items-center justify-end gap-2' }).append(
                unidad,
                $('<button>', { type: 'button', 'data-step': -1, 'data-idx': i, 'aria-label': 'Menos', class: 'w-[34px] h-[34px] rounded-[8px] bg-white border-[1px] border-gray-300 flex items-center justify-center text-gray-600 flex-shrink-0 active:bg-gray-100' })
                    .append($('<i>', { 'data-lucide': 'minus', class: 'w-[16px] h-[16px]' })),
                $('<input>', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'data-qty': i, value: this.fmt(p.cantidad), 'aria-label': o.labels.cantidad, class: 'om-qty w-[64px] px-1 text-center font-bold text-gray-800 bg-white border-[1px] border-gray-300 rounded-[8px] outline-none flex-shrink-0 focus:border-blue-500 focus:ring-2 focus:ring-blue-100' }),
                $('<button>', { type: 'button', 'data-step': 1, 'data-idx': i, 'aria-label': 'Más', class: 'w-[34px] h-[34px] rounded-[8px] bg-blue-600 border-0 flex items-center justify-center text-white flex-shrink-0 active:scale-95' })
                    .append($('<i>', { 'data-lucide': 'plus', class: 'w-[16px] h-[16px]' }))
            )
        );
    }

    paintResumen() {
        const o   = this.opts;
        const uds = this.lote.reduce((s, p) => s + Number(p.cantidad || 0), 0);

        $(`#${o.id}_totMat`).text(this.lote.length);
        $(`#${o.id}_totUds`).text(this.fmt(uds));
    }

    syncMisma() {
        const o     = this.opts;
        const misma = String($(`#${o.id}_destino`).val()) === String(o.data.solicitante);
        $(`#${o.id}_misma`).toggleClass('hidden', !misma);
    }

    // -- Guardar --

    // Como en escritorio: al editar no cambia el estado (submit false), la fecha vieja del
    // pedido se respeta y cada renglón conserva su nota.
    buildPayload(submit) {
        const o       = this.opts;
        const destino = $(`#${o.id}_destino`).val() || '';
        const fecha   = $(`#${o.id}_fecha`).val()   || '';

        if (!this.lote.length) return this.aviso(o.labels.sinMateriales);
        if (!destino)          return this.aviso(o.labels.sinDestino);
        if (!fecha)            return this.aviso(OrdenForm.LABELS.fechaReq);
        if (!o.edit && fecha < this.catalogo.haceUnMes()) return this.aviso(OrdenForm.LABELS.fechaVieja);

        const sinCantidad = this.lote.find(p => !(Number(p.cantidad) > 0));
        if (sinCantidad) return this.aviso(`${o.labels.sinCantidad} ${sinCantidad.nombre}`);

        return {
            id:                    o.edit ? o.edit.id : null,
            submit:                !o.edit && submit,
            destination_branch_id: destino,
            date_order:            fecha,
            note:                  $(`#${o.id}_nota`).val() || '',
            productos: this.lote.map(p => ({
                product_id:        p.id,
                quantity:          Number(p.cantidad || 0),
                cost:              Number(p.costo || 0),
                price_without_tax: Number(p.costoSinTax || 0),
                tax:               Number(p.tax || 0),
                unit_id:           p.unit_id || null,
                note:              p.nota || ''
            }))
        };
    }

    send() {
        const o       = this.opts;
        const payload = this.buildPayload(true);
        if (!payload) return;

        this.tpl.alertBox({
            type:        'confirm',
            title:       o.edit ? OrdenForm.LABELS.confirmEdit : this.catalogo.confirmCrearTexto(payload),
            okLabel:     o.edit ? OrdenForm.LABELS.confirmEditOk : OrdenForm.LABELS.confirmAddOk,
            okIcon:      'check',
            cancelLabel: 'Cancelar',
            onOk:        () => this.save(payload)
        });
    }

    // El botón queda apagado mientras se guarda: un doble toque no duplica el pedido.
    async save(payload) {
        if (this.saving) return;

        const $btn = $(`#${this.opts.id}_enviar`);
        this.saving = true;
        $btn.prop('disabled', true).addClass('opacity-60');

        const ok = await this.opts.onSave(payload);

        this.saving = false;
        if (ok) { this.close(); return; }
        $btn.prop('disabled', false).removeClass('opacity-60');
    }

    // Con materiales: guardar borrador, salir sin guardar o seguir capturando (tocar fuera
    // también sigue capturando: no se pierde nada por accidente). Al editar se pregunta
    // solo si algo cambió, y guardar es guardar los cambios.
    requestClose() {
        const o = this.opts;
        const L = OrdenForm.LABELS;
        if (o.edit ? this.huella() === this.huellaInicial : !this.lote.length) { this.close(); return; }

        this.tpl.csChoiceCards({
            icon:      'clipboard-list',
            title:     o.edit ? o.labels.cambiosTitulo : o.labels.salirTitulo,
            lead:      o.edit ? '' : L.confirmSalir,
            backLabel: o.labels.seguir,
            choices: [
                {
                    id:    'guardar',
                    icon:  'save',
                    tone:  'ac',
                    title: o.edit ? L.guardarEdit : L.borrador,
                    text:  o.edit ? o.labels.cambiosHint : o.labels.borradorHint
                },
                {
                    id:    'salir',
                    icon:  'log-out',
                    tone:  'mut',
                    title: L.salir,
                    text:  o.edit ? o.labels.descartarHint : o.labels.salirHint
                }
            ],
            onChoose: (id) => {
                if (id === 'salir') { this.close(); return; }
                const payload = this.buildPayload(false);
                if (payload) this.save(payload);
            }
        });
    }

    close() {
        this.root.remove();
    }

    // compact.css deja todo input en 1rem (14px) y height: auto con !important. Aquí van a
    // 16px, que además evita que el iPhone haga zoom al tocar un campo.
    ensureStyles() {
        if (document.getElementById('ordenMovilFormStyles')) return;

        const id    = this.opts.id;
        const style = document.createElement('style');
        style.id          = 'ordenMovilFormStyles';
        style.textContent = `
            #${id} :is(input, select, textarea) { font-size: 16px !important; }
            #${id} .om-control { height: 46px !important; }
            #${id} :is(.om-unit, .om-qty) { height: 34px !important; }
            #${id}_buscar { height: 48px !important; }`;
        document.head.appendChild(style);
    }

    aviso(msg) {
        this.tpl.alertBox({ type: 'warning', title: msg });
        return null;
    }

    fmt(n) {
        return String(Number(Number(n || 0).toFixed(2)));
    }

    // -- Events --

    bindEvents() {
        const o = this.opts;

        this.root.on('click', `#${o.id}_back`, () => this.requestClose());
        this.root.on('click', `#${o.id}_enviar`, () => this.send());
        this.root.on('change', `#${o.id}_destino`, () => this.syncMisma());

        this.root.on('input', `#${o.id}_buscar`, (e) => {
            this.term = e.target.value;
            this.paintResultados();
        });

        // Enter (o el lector de código) agrega el primer resultado.
        this.root.on('keydown', `#${o.id}_buscar`, (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const first = $(`#${o.id}_resultados [data-add]`).first().attr('data-add');
            if (first) this.addProduct(first);
        });

        this.root.on('click', `#${o.id}_limpiar`, () => {
            this.term = '';
            $(`#${o.id}_buscar`).val('').trigger('focus');
            this.paintResultados();
        });

        this.root.on('click', '[data-add]', (e) => this.addProduct($(e.currentTarget).attr('data-add')));

        this.root.on('click', '[data-del]', (e) => {
            this.lote.splice(Number($(e.currentTarget).attr('data-del')), 1);
            this.paintLote();
            this.paintResultados();
        });

        // −/+ de uno en uno; el − no baja de lo mínimo (para quitarlo está el bote).
        this.root.on('click', '[data-step]', (e) => {
            const i    = Number($(e.currentTarget).attr('data-idx'));
            const p    = this.lote[i];
            const next = p ? Number(p.cantidad || 0) + Number($(e.currentTarget).attr('data-step')) : 0;
            if (!p || next <= 0) return;

            p.cantidad = Number(next.toFixed(2));
            this.root.find(`[data-qty="${i}"]`).val(this.fmt(p.cantidad));
            this.paintResumen();
            this.paintResultados();
        });

        this.root.on('click', '[data-unit-pick]', (e) => {
            const $btn = $(e.currentTarget);
            const p    = this.lote[Number($btn.attr('data-unit-pick'))];
            if (!p) return;

            this.tpl.unidadMovilPicker({
                subtitle: p.nombre,
                json:     o.data.unidades || [],
                value:    p.unit_id,
                onSelect: (id) => {
                    p.unit_id = id;
                    $btn.find('span').text(this.catalogo.unidadTexto(id) || '-');
                }
            });
        });

        this.root.on('focus', '[data-qty]', (e) => e.target.select());

        this.root.on('input', '[data-qty]', (e) => {
            const p = this.lote[Number($(e.target).attr('data-qty'))];
            const n = parseFloat(String(e.target.value).replace(',', '.'));
            if (!p) return;

            p.cantidad = isFinite(n) && n > 0 ? n : 0;
            this.paintResumen();
        });

        this.root.on('blur', '[data-qty]', (e) => {
            const p = this.lote[Number($(e.target).attr('data-qty'))];
            if (!p) return;

            if (!(Number(p.cantidad) > 0)) p.cantidad = 1;
            $(e.target).val(this.fmt(p.cantidad));
            this.paintResumen();
        });
    }
}


// -- unidadMovilPicker --
// Elegir unidad en el teléfono sin el select nativo, que con decenas de unidades era una
// lista eterna: buscador y solo las primeras `limit` (4) coincidencias; sin texto, la unidad
// actual primero y luego el catálogo; con texto, primero las que empiezan así. Se abre arriba
// de la pantalla y no como hoja de abajo para que el teclado no tape los resultados.

Templates.prototype.unidadMovilPicker = function (options) {
    const defaults = {
        id:       'unidadMovilPicker',
        title:    'Unidad',
        subtitle: '',
        json:     [],
        value:    '',
        limit:    4,
        labels: {
            placeholder:   'Buscar unidad...',
            mostrando:     'Mostrando',
            de:            'de',
            escribe:       'escribe para buscar otra',
            sinResultados: 'Sin unidades que coincidan con'
        },
        onSelect: () => {}
    };

    const opts   = Object.assign({}, defaults, options || {});
    opts.labels  = Object.assign({}, defaults.labels, (options || {}).labels || {});
    const actual = String(opts.value || '');
    const norm   = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const texto  = (u) => u.code || u.valor || '';

    const buscar = (term) => {
        const t = norm(term);
        if (!t) return opts.json.slice().sort((a, b) => (String(b.id) === actual) - (String(a.id) === actual));

        return opts.json
            .filter(u => norm(`${u.code || ''} ${u.valor || ''}`).includes(t))
            .sort((a, b) => norm(texto(b)).startsWith(t) - norm(texto(a)).startsWith(t));
    };

    $(`#${opts.id}`).remove();

    // compact.css deja los input en 14px y height auto con !important: aquí 16px (sin zoom en iPhone).
    const $input = $('<input>', {
        type:         'text',
        autocomplete: 'off',
        enterkeyhint: 'search',
        placeholder:  opts.labels.placeholder,
        class:        'w-full pl-[42px] pr-[12px] text-gray-800 bg-white border-[1px] border-gray-300 rounded-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100',
        style:        'font-size:16px !important;height:46px !important'
    });
    const $list = $('<div>', { class: 'border-t-[1px] border-gray-100 divide-y divide-gray-100' });
    const $hint = $('<p>', { class: 'm-0 px-[14px] py-[10px] text-[11px] text-gray-400 bg-gray-50 border-t-[1px] border-gray-100' });

    const root = $('<div>', {
        id:    opts.id,
        class: 'fixed inset-0 z-[80] flex items-start justify-center px-[12px]',
        style: 'padding-top:max(72px, env(safe-area-inset-top))'
    }).append(
        $('<div>', { 'data-close': '', class: 'absolute inset-0 bg-black/40' }),
        $('<div>', { class: 'relative w-full max-w-[420px] bg-white rounded-[16px] shadow-2xl overflow-hidden' }).append(
            $('<div>', { class: 'flex items-center gap-2 px-[14px] pt-[14px] pb-[10px]' }).append(
                $('<div>', { class: 'flex-1 min-w-0' }).append(
                    $('<p>', { class: 'm-0 text-[15px] font-bold text-gray-800', text: opts.title }),
                    opts.subtitle ? $('<p>', { class: 'm-0 text-[12px] text-gray-500 truncate', text: opts.subtitle }) : null
                ),
                $('<button>', { type: 'button', 'data-close': '', 'aria-label': 'Cerrar', class: 'w-[32px] h-[32px] rounded-[8px] bg-transparent border-0 flex items-center justify-center text-gray-400 flex-shrink-0 active:bg-gray-100' })
                    .append($('<i>', { 'data-lucide': 'x', class: 'w-[18px] h-[18px]' }))
            ),
            $('<div>', { class: 'relative mx-[14px] mb-[12px]' }).append(
                $('<i>', { 'data-lucide': 'search', class: 'pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400' }),
                $input
            ),
            $list,
            $hint
        )
    );

    const close = () => {
        root.remove();
        $(document).off(`keydown.${opts.id}`);
    };

    const paint = () => {
        const term  = $input.val().trim();
        const items = buscar(term);
        const shown = items.slice(0, opts.limit);

        $list.empty().append(shown.map(u => {
            const on = String(u.id) === actual;
            return $('<button>', {
                type:           'button',
                'data-unit-id': u.id,
                class:          'w-full flex items-center gap-3 px-[14px] py-[12px] text-left border-0 ' + (on ? 'bg-blue-50' : 'bg-white active:bg-gray-50')
            }).append(
                $('<span>', { class: 'flex-1 min-w-0' }).append(
                    $('<span>', { class: 'block text-[14px] font-semibold uppercase truncate ' + (on ? 'text-blue-700' : 'text-gray-800'), text: texto(u) }),
                    u.code && u.valor && norm(u.code) !== norm(u.valor) ? $('<span>', { class: 'block text-[11px] text-gray-400 truncate', text: u.valor }) : null
                ),
                on ? $('<i>', { 'data-lucide': 'check', class: 'w-[18px] h-[18px] text-blue-600 flex-shrink-0' }) : null
            );
        }));

        $hint.text(items.length
            ? `${opts.labels.mostrando} ${shown.length} ${opts.labels.de} ${items.length}${items.length > shown.length ? ` · ${opts.labels.escribe}` : ''}`
            : `${opts.labels.sinResultados} “${term}”`);

        if (window.lucide) lucide.createIcons();
    };

    root.on('click', '[data-close]', close);
    root.on('click', '[data-unit-id]', (e) => {
        const id = String($(e.currentTarget).attr('data-unit-id'));
        close();
        opts.onSelect(id);
    });
    $input.on('input', paint);
    $input.on('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        $list.find('[data-unit-id]').first().trigger('click');
    });
    $(document).on(`keydown.${opts.id}`, (e) => { if (e.key === 'Escape') close(); });

    $('body').append(root);
    paint();
    return { close };
};

Templates.prototype.ordenesMovil = function (options) {
    const view = new OrdenesMovil(options);
    view.tpl = this;
    return view.render();
};

Templates.prototype.ordenMovilForm = function (options) {
    const form = new OrdenMovilForm(options);
    form.tpl = this;
    return form.render();
};
