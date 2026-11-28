// -- Inventarios: lo común de sus páginas --
// La interfaz es la de inventory/ (visor: encabezado, filtros, tarjetas KPI,
// tabla y panel de detalle a la derecha) aplicada a los productos del Catálogo
// de pro. Cada página carga este archivo y el suyo (entradas.js, salidas.js...).
// Los componentes del visor (viewHeader, kpisRow, kpiDetailModal) se cuelgan de
// Templates, como cs-modal.js, para no editar coffeeSoft.js.

// -- Permisos --
// inventory nombra las acciones en español; pro las guarda por código.
// INV_ACTIONS llega en el init de cada página (Permission::actions).

let INV_ACTIONS = [];

const INV_ACTION_CODES = {
    'ver':               'show',
    'agregar':           'create',
    'editar':            'update',
    'cancelar':          'cancel',
    'eliminar':          'delete',
    'imprimir':          'print',
    'subir-comprobante': 'create',
    'producir':          'producir',
    'ver-costos':        'ver-costos'
};

function can(action) {
    return INV_ACTIONS.includes(INV_ACTION_CODES[action] || action);
}

function invEsc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function invMoney(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 12 · 2.5 · 1,250.125: sin ceros de más.
function invQty(n) {
    return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
}

// Título «Entradas de Inventario · Reginas Cuarta» con la sucursal en el color del tema.
function invTitleHtml(title, branch) {
    return branch
        ? `${invEsc(title)} <span class="font-bold" style="color:rgb(var(--brand-600, 192 90 64));">&middot; ${invEsc(branch)}</span>`
        : invEsc(title);
}

// -- Encabezado del visor --

Templates.prototype.viewHeader = function (options) {
    const defaults = {
        parent:  'root',
        id:      'viewHeader',
        class:   'flex items-center justify-between w-full',
        json:    { title: '', titleHtml: '', subtitle: '' },
        classes: {
            title:    'text-lg font-bold text-gray-800',
            subtitle: 'text-xs text-gray-500'
        }
    };

    const opts = Object.assign({}, defaults, options || {});
    opts.json    = Object.assign({}, defaults.json,    (options || {}).json    || {});
    opts.classes = Object.assign({}, defaults.classes, (options || {}).classes || {});

    const wrap = $('<div>', { id: opts.id, class: opts.class });
    wrap.html(`
        <div>
            <h1 class="${opts.classes.title}">${opts.json.titleHtml || invEsc(opts.json.title)}</h1>
            ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${invEsc(opts.json.subtitle)}</p>` : ''}
        </div>
    `);

    $(`#${opts.parent}`).html(wrap);
    if (window.lucide) lucide.createIcons();
};

// -- Tarjetas KPI (clic = su desglose) --

Templates.prototype.kpisRow = function (options) {
    const defaults = {
        parent:     'root',
        id:         'kpisRow',
        class:      'grid grid-cols-2 md:grid-cols-4 gap-4',
        json:       [],
        tones: {
            default: 'text-gray-800',
            success: 'text-green-600',
            warning: 'text-amber-500',
            danger:  'text-red-600',
            info:    'text-blue-600',
            purple:  'text-purple-600'
        },
        cardClass:  'bg-white rounded-lg border border-gray-200 dark:!border-0 px-4 py-3 cursor-pointer hover:shadow-lg transition-shadow',
        labelClass: 'text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1 text-left',
        valueClass: 'text-2xl font-bold text-right',
        onClick:    () => {}
    };

    const opts = Object.assign({}, defaults, options || {});
    opts.tones = Object.assign({}, defaults.tones, (options || {}).tones || {});

    const toneClass = (tone) => opts.tones[tone] || opts.tones.default;
    const grid      = $('<div>', { id: opts.id, class: opts.class });

    if (!opts.json || opts.json.length === 0) {
        grid.html('<p class="col-span-full text-xs text-gray-400 italic text-center py-2">Sin indicadores</p>');
        $(`#${opts.parent}`).html(grid);
        return;
    }

    grid.html(opts.json.map((kpi, idx) => `
        <div id="${kpi.id || opts.id + '_' + idx}" data-kpi-idx="${idx}" class="${opts.cardClass}">
            <p class="${opts.labelClass}">${invEsc(kpi.label)}</p>
            <p class="${opts.valueClass} ${toneClass(kpi.tone)}">${invEsc(kpi.value)}</p>
        </div>
    `).join(''));

    $(`#${opts.parent}`).html(grid);
    grid.find('[data-kpi-idx]').on('click', (e) => {
        const idx = parseInt($(e.currentTarget).attr('data-kpi-idx'), 10);
        opts.onClick(opts.json[idx], idx);
    });
};

// Desglose de una tarjeta: solo lectura, se cierra con la X, Escape o clic afuera.
Templates.prototype.kpiDetailModal = function (options) {
    const defaults = {
        id:       'kpiDetail',
        title:    '',
        value:    '',
        subtitle: '',
        size:     'large',
        center:   [],
        right:    [],
        data:     { row: [] }
    };

    const opts  = Object.assign({}, defaults, options || {});
    const modal = this.cfModal({ title: opts.title, size: opts.size, backdropClose: true });

    modal.footer.remove();
    modal.body.attr('id', `${opts.id}${this.PROJECT_NAME}`);

    this.createCoffeeTable3({
        parent:       `${opts.id}${this.PROJECT_NAME}`,
        id:           `tb${opts.id}${this.PROJECT_NAME}`,
        theme:        'light',
        title:        opts.value,
        subtitle:     opts.subtitle,
        center:       opts.center,
        right:        opts.right,
        extends:      true,
        scrollable:   false,
        f_size:       12,
        emptyMessage: 'Sin movimientos con los filtros aplicados',
        emptyIcon:    'icon-doc-text',
        data:         opts.data
    });

    if (window.lucide) lucide.createIcons();
};

// -- Rango de fechas del filtro (el de inventory) --
// onSelect(fi, ff) recibe YYYY-MM-DD. Devuelve el rango inicial.

Templates.prototype.invRangePicker = function ({ parent, days = 6, start = null, end = null, onSelect }) {
    const ini = start ? moment(start) : moment().subtract(days, 'days');
    const fin = end ? moment(end) : moment();

    dataPicker({
        parent,
        type: 'all',
        rangepicker: {
            startDate:           ini,
            endDate:             fin,
            maxDate:             moment(),
            showDropdowns:       true,
            alwaysShowCalendars: true,
            ranges: {
                'Hoy':            [moment(), moment()],
                'Ayer':           [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                'Ultimos 7 dias': [moment().subtract(6, 'days'), moment()],
                'Semana actual':  [moment().startOf('isoWeek'), moment()],
                'Mes actual':     [moment().startOf('month'), moment()],
                'Mes anterior':   [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
            },
            locale: {
                format:           'DD-MM-YYYY',
                separator:        '  a  ',
                applyLabel:       'Aplicar',
                cancelLabel:      'Cancelar',
                customRangeLabel: 'Personalizado',
                daysOfWeek:       ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
                monthNames:       ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                firstDay:         1
            }
        },
        onSelect: (s, e) => onSelect(s.format('YYYY-MM-DD'), e.format('YYYY-MM-DD'))
    });

    return { fi: ini.format('YYYY-MM-DD'), ff: fin.format('YYYY-MM-DD') };
};

// -- Cancelar: contraseña y motivo (alertBox con campo) --
// Resuelve true si la contraseña es correcta; con una equivocada vuelve a
// preguntar y con Cancelar resuelve false. El ctrl deja la autorización en la
// sesión para ESE documento (verifyKey) y la consume al cancelarlo.

Templates.prototype.invAskPassword = function ({ url, doc, id, hint, retry = false }) {
    return new Promise((resolve) => {
        this.alertBox({
            type:             'confirm',
            icon:             'lock',
            title:            'Confirma tu contraseña',
            detailHtml:       retry ? invEsc(retry) : invEsc(hint),
            input:            'password',
            inputPlaceholder: 'Tu contraseña',
            inputRequired:    true,
            inputError:       'Escribe tu contraseña',
            okLabel:          'Continuar',
            cancelLabel:      'Cancelar',
            onOk: async (password) => {
                const r = await useFetch({ url, data: { opc: 'verifyKey', doc, id, key: password } }).catch(() => null);

                if (r && r.status === 200) { resolve(true); return; }
                if (r && r.status === 401) { resolve(await this.invAskPassword({ url, doc, id, hint, retry: r.message })); return; }

                this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo verificar la contraseña' });
                resolve(false);
            },
            onCancel: () => resolve(false)
        });
    });
};

// El motivo de la cancelación (queda en el kárdex). Resuelve el texto o null.
Templates.prototype.invAskReason = function ({ title, detail, okLabel = 'Sí, cancelar', placeholder = '¿Por qué se cancela?' }) {
    return new Promise((resolve) => {
        this.alertBox({
            type:             'cancel',
            title,
            detailHtml:       invEsc(detail),
            input:            'textarea',
            inputPlaceholder: placeholder,
            inputRequired:    true,
            inputError:       'Escribe el motivo',
            okLabel,
            cancelLabel:      'No',
            onOk:     (text) => resolve(String(text || '').trim() || null),
            onCancel: () => resolve(null)
        });
    });
};

// -- Layout del visor: tabla a la izquierda y detalle a la derecha --
// key: prefijo del ancho guardado (--<key>-detail-w). Lo usan Entradas, Salidas,
// Traspasos y Movimientos.

Templates.prototype.invVisorLayout = function ({ id, key, kpisFirst = false }) {
    const header  = { id: 'viewHeader', class: 'flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-gray-200 dark:!border-0 flex-shrink-0' };
    const filters = { id: 'filterBar',  class: 'px-3 py-3 bg-white border-b border-gray-200 dark:!border-0 flex-shrink-0' };
    const kpis    = { id: 'kpisRow',    class: 'px-3 py-3 bg-gray-50 border-b border-gray-200 dark:!border-0 flex-shrink-0' };
    const table   = { id: 'tableWrap',  class: 'p-3 flex-1 min-h-0 overflow-auto bg-white' };

    const mainPanel = {
        type:     'div',
        id:       'mainPanel',
        class:    'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
        children: kpisFirst ? [header, kpis, filters, table] : [header, filters, kpis, table]
    };

    // Tirador y visor arrancan ocultos (!hidden le gana a md:block y a flex):
    // la tabla toma todo el ancho hasta que se abre un documento.
    const detailResizer = {
        type:  'div',
        id:    'detailResizer',
        class: "!hidden md:block relative z-[5] flex-shrink-0 w-[6px] -mx-[3px] cursor-col-resize touch-none after:content-[''] after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:-translate-x-1/2 after:rounded-full after:transition-colors hover:after:bg-gray-400"
    };

    const detailPanel = {
        type:  'aside',
        id:    'detailPanel',
        class: `!hidden w-full md:w-[var(--${key}-detail-w,420px)] md:max-w-[60vw] flex-shrink-0 bg-white border-[1px] border-solid border-gray-200 rounded-lg dark:!border-0 flex flex-col overflow-hidden`,
        children: [
            { id: 'emptyDetail',   class: 'flex-1 flex flex-col items-center justify-center text-center px-6' },
            { id: 'detailContent', class: 'hidden flex-1 flex flex-col overflow-hidden' }
        ]
    };

    this.createLayout({
        parent: 'root',
        design: false,
        data: {
            id,
            class:     'cs-visor flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden bg-white rounded-lg border border-gray-200 dark:!border-0',
            container: [mainPanel, detailResizer, detailPanel]
        }
    });
};

// Muestra u oculta el visor de la derecha.
function invToggleVisor(show) {
    $('#detailPanel, #detailResizer').toggleClass('!hidden', !show);
}

// Marca la fila abierta en la tabla (la que tenga ese folio).
function invMarkRow(tableId, folio) {
    const rows = $(`#${tableId} tbody tr`);

    rows.removeClass('row-active');

    if (folio) rows.filter(function () { return $(this).text().includes(folio); }).addClass('row-active');
}

// Pantalla sin sucursal o sin permiso: el mensaje en la tarjeta.
function invBlocked(message) {
    $('#root').html(`
        <div class="flex-1 flex flex-col items-center justify-center text-center py-16 bg-white rounded-lg border border-gray-200">
            <i data-lucide="lock" class="w-10 h-10 text-gray-300 mb-3"></i>
            <p class="text-sm font-semibold text-gray-500">${invEsc(message || 'No se pudo abrir el inventario.')}</p>
        </div>
    `);
    if (window.lucide) lucide.createIcons();
}
