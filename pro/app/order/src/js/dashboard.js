/*  Pedidos › Dashboard (sección pos-dashboard): un mes contra otro.

    Lo mismo que el de alpha (KPIs, estados, venta diaria, días de la semana y
    ranking) con las cuentas corregidas: Vendido = pendientes + pagados,
    Cobrado = pagos reales del mes, Por cobrar = saldo de hoy (nunca negativo).
    Si uno de los meses es el actual, los dos se cortan en el día de hoy.
    Cada gráfica tiene su vista de tabla con los mismos números.
    Colores: A = azul, B = naranja; validados en claro (#FFFFFF) y oscuro (#1F2A37). */

let api = 'ctrl/ctrl-dashboard.php';
let dashboard;
let dataInit = {};

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    dashboard = new Dashboard(api, 'root');
    dashboard.init();
});

// -- Plugins de Chart.js --

// Línea vertical en el día que señala el tooltip (detrás de las líneas).
const ordCrosshair = {
    id: 'ordCrosshair',
    beforeDatasetsDraw(chart, args, opts) {
        const active = chart.tooltip ? chart.tooltip.getActiveElements() : [];

        if (!active.length) return;

        const { ctx, chartArea } = chart;
        const x = active[0].element.x;

        ctx.save();
        ctx.strokeStyle = opts.color;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.restore();
    }
};

// Nombre corto del mes al final de cada línea, sobre un fondo del color de la tarjeta.
const ordEndLabels = {
    id: 'ordEndLabels',
    afterDatasetsDraw(chart, args, opts) {
        const { ctx, chartArea } = chart;
        const marks = [];

        chart.data.datasets.forEach((ds, i) => {
            const meta = chart.getDatasetMeta(i);
            let last   = -1;

            if (meta.hidden) return;

            ds.data.forEach((v, j) => { if (v !== null && v !== undefined) last = j; });

            if (last < 0 || !meta.data[last]) return;

            marks.push({ x: meta.data[last].x, y: meta.data[last].y, text: ds.short || ds.label });
        });

        marks.sort((m, n) => m.y - n.y);

        for (let k = 1; k < marks.length; k++) {
            if (Math.abs(marks[k].x - marks[k - 1].x) < 40 && marks[k].y - marks[k - 1].y < 16) marks[k].y = marks[k - 1].y + 16;
        }

        ctx.save();
        ctx.font         = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
        ctx.textBaseline = 'middle';

        marks.forEach((m) => {
            const width = ctx.measureText(m.text).width;
            const x     = Math.min(m.x + 8, chartArea.right + 4);
            const y     = Math.max(chartArea.top + 6, Math.min(m.y, chartArea.bottom - 6));

            ctx.fillStyle = opts.surface;
            ctx.fillRect(x - 3, y - 8, width + 6, 16);
            ctx.fillStyle = opts.color;
            ctx.fillText(m.text, x, y);
        });

        ctx.restore();
    }
};

// -- Dashboard --

class Dashboard extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Dashboard';
        this.short        = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        this.weekShort    = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        this.statuses     = [
            { key: 'quotes',    label: 'Cotizaciones' },
            { key: 'pending',   label: 'Pendientes' },
            { key: 'paid',      label: 'Pagados' },
            { key: 'cancelled', label: 'Cancelados' }
        ];
        this.cards        = {
            Daily:  { title: 'Venta por día',                  wide: true },
            Status: { title: 'Pedidos por estado' },
            Week:   { title: 'Promedio por día de la semana' }
        };
        this.data    = null;
        this.charts  = {};
        this.modes   = {};
        this.request = 0;
        this.dark    = document.body.classList.contains('dark-mode');
    }

    get filters() {
        return {
            month_a: $('#dash_month_a').val() || '',
            month_b: $('#dash_month_b').val() || ''
        };
    }

    // -- Interface --

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.header();

        if (dataInit.status != 200) return this.blocked(dataInit.message || 'No se pudo cargar el dashboard. Recarga la página.');

        if (!this.can('show')) return this.blocked('Tu rol no tiene permiso para ver el dashboard de esta sucursal.');

        if (typeof Chart === 'undefined') return this.blocked('No se pudo cargar la librería de gráficas. Revisa la conexión y recarga.');

        Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
        Chart.defaults.font.size   = 12;

        this.filterBar();
        this.board();
        this.watchTheme();
        this.lsDashboard();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:    `page${this.PROJECT_NAME}`,
                class: 'flex flex-col gap-[16px]',
                container: [
                    { type: 'div', id: `header${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `body${this.PROJECT_NAME}`, class: 'w-full' }
                ]
            }
        });

        this.primaryLayout({
            parent: `body${this.PROJECT_NAME}`,
            id:     this.PROJECT_NAME,
            class:  'ord-card',
            card: {
                name:      `card${this.PROJECT_NAME}`,
                class:     'flex flex-col',
                filterBar: { class: 'w-full mb-[14px]' },
                container: { class: 'w-full' }
            }
        });
    }

    header() {
        const scope = dataInit.scope || {};

        this.createLayout({
            parent: `header${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `title${this.PROJECT_NAME}`,
                class: 'w-full',
                container: [
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'Dashboard' },
                    { type: 'p', class: 'cp-pagina-subtitulo', text: [scope.company, scope.branch].filter(Boolean).join(' · ') || 'Un mes contra otro' }
                ]
            }
        });
    }

    blocked(message) {
        this.createLayout({
            parent: `body${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `blocked${this.PROJECT_NAME}`,
                class: 'ord-aviso',
                container: [
                    { type: 'i', class: 'icon-lock text-[22px]' },
                    {
                        type:  'div',
                        class: 'flex flex-col',
                        children: [
                            { type: 'p', class: 'ord-aviso-titulo', text: message },
                            { type: 'p', class: 'ord-aviso-texto', text: 'Si crees que es un error, pide acceso a quien administra Huubie.' }
                        ]
                    }
                ]
            }
        });
    }

    filterBar() {
        const months = dataInit.months || [];
        const a      = months[0] ? months[0].id : '';
        const b      = months[1] ? months[1].id : a;

        this.createfilterBar({
            parent:     `filterBar${this.PROJECT_NAME}`,
            id:         `fb${this.PROJECT_NAME}`,
            prefijo:    'dash_',
            coffeesoft: true,
            data: [
                {
                    opc:      'select',
                    id:       'month_a',
                    lbl:      'Mes',
                    required: false,
                    class:    'col-12 col-sm-6 col-lg-3',
                    data:     months,
                    value:    a,
                    onchange: 'dashboard.onFilterChange()'
                },
                {
                    opc:      'select',
                    id:       'month_b',
                    lbl:      'Comparar con',
                    required: false,
                    class:    'col-12 col-sm-6 col-lg-3',
                    data:     months,
                    value:    b,
                    onchange: 'dashboard.onFilterChange()'
                }
            ]
        });
    }

    // Esqueleto: aviso, KPIs, venta diaria, estados + semana, ranking.
    board() {
        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `board${this.PROJECT_NAME}`,
                class: 'ord-dash',
                container: [
                    { type: 'p', id: `note${this.PROJECT_NAME}`, class: 'ord-dash-note', 'aria-live': 'polite' },
                    { type: 'div', id: `kpis${this.PROJECT_NAME}`, class: 'ord-kpis' },
                    { type: 'div', id: `cardDaily${this.PROJECT_NAME}`, class: 'min-w-0' },
                    {
                        type:  'div',
                        class: 'ord-dash-grid',
                        children: [
                            { id: `cardStatus${this.PROJECT_NAME}`, class: 'min-w-0' },
                            { id: `cardWeek${this.PROJECT_NAME}`, class: 'min-w-0' }
                        ]
                    },
                    { type: 'div', id: `cardRank${this.PROJECT_NAME}`, class: 'min-w-0' }
                ]
            }
        });

        Object.keys(this.cards).forEach((key) => this.chartShell(key));

        this.createLayout({
            parent: `cardRank${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `rank${this.PROJECT_NAME}`,
                class: 'ord-chart',
                container: [
                    { type: 'div', id: `rankText${this.PROJECT_NAME}`, class: 'min-w-0' },
                    { type: 'div', id: `rankTable${this.PROJECT_NAME}`, class: 'ord-chart-table is-open' }
                ]
            }
        });

        $(`#board${this.PROJECT_NAME}`).on('click', 'button.ord-seg', (e) => {
            const btn = $(e.currentTarget);

            this.setMode(String(btn.attr('data-card')), String(btn.attr('data-mode')));
        });
    }

    // Tarjeta de una gráfica: título, Gráfica | Tabla, lienzo y tabla.
    chartShell(key) {
        const id   = `${key.toLowerCase()}${this.PROJECT_NAME}`;
        const card = this.cards[key];

        this.modes[key] = 'chart';

        this.createLayout({
            parent: `card${key}${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    id,
                class: 'ord-chart',
                container: [
                    {
                        type:  'div',
                        class: 'ord-chart-head',
                        children: [
                            { id: `${id}Text`, class: 'min-w-0' },
                            { id: `${id}Modes`, class: 'ord-chart-modes', role: 'group', 'aria-label': `Ver ${card.title} como` }
                        ]
                    },
                    {
                        type:  'div',
                        id:    `${id}Canvas`,
                        class: card.wide ? 'ord-chart-canvas is-wide' : 'ord-chart-canvas',
                        children: [{ type: 'canvas', id: `${id}Chart`, role: 'img', 'aria-label': card.title }]
                    },
                    { type: 'div', id: `${id}Table`, class: 'ord-chart-table' }
                ]
            }
        });

        $(`#${id}Text`).html(`<h2 class="ord-chart-title">${esc(card.title)}</h2><p class="ord-chart-sub" id="${id}Sub"></p>`);

        $(`#${id}Modes`).html(['chart', 'table'].map((mode) => {
            const active = mode === 'chart';

            return `<button type="button" class="ord-seg${active ? ' is-active' : ''}" data-card="${key}" data-mode="${mode}" aria-pressed="${active}">${mode === 'chart' ? 'Gráfica' : 'Tabla'}</button>`;
        }).join(''));
    }

    // -- Datos --

    async lsDashboard() {
        const request = ++this.request;
        const board   = $(`#board${this.PROJECT_NAME}`);

        // Lo anterior se queda a media luz hasta que llega lo nuevo: sin parpadeo.
        board.addClass('is-loading').attr('aria-busy', 'true');

        const data = await useFetch({ url: api, data: { opc: 'apiDashboard', ...this.filters } });

        if (request !== this.request) return;

        board.removeClass('is-loading').attr('aria-busy', 'false');

        if (!data || data.status != 200) {
            return alert({ icon: 'error', title: 'No se pudo cargar el dashboard', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
        }

        this.data = data;
        this.paint();
    }

    paint() {
        this.paintNote();
        this.paintKpis();
        this.paintCharts();
        this.paintTables();
        this.paintRank();
    }

    paintNote() {
        const { a, b, cut } = this.data;
        const parts         = [`<strong>${esc(a.label)}</strong> contra <strong>${esc(b.label)}</strong>.`];

        if (cut) parts.push(`Del 1 al ${cut} de cada mes: el mes en curso se compara contra los mismos días del otro.`);
        if (a.month === b.month) parts.push('Elegiste el mismo mes en los dos lados.');
        if (!this.hasData(a) && !this.hasData(b)) parts.push('No hay pedidos en ninguno de los dos meses.');

        $(`#note${this.PROJECT_NAME}`).html(parts.join(' '));
    }

    // -- KPIs --

    paintKpis() {
        const { a, b } = this.data;
        const tag      = this.tag(b);

        const plural   = (n, one, many) => `${this.num(n)} ${n === 1 ? one : many}`;
        const ticket   = (k) => (k.orders ? money(k.ticket) : '—');

        // base = el mes B; hint = de dónde sale la cifra de A.
        const tiles = [
            { key: 'sold',   label: 'Vendido',         value: this.peso(a.kpi.sold),  base: this.peso(b.kpi.sold),  polarity: 1, hint: 'Pendientes y pagados' },
            { key: 'paid',   label: 'Cobrado',         value: this.peso(a.kpi.paid),  base: this.peso(b.kpi.paid),  polarity: 1, hint: `${plural(a.kpi.payments, 'pago recibido', 'pagos recibidos')}` },
            { key: 'orders', label: 'Pedidos',         value: this.num(a.kpi.orders), base: this.num(b.kpi.orders), polarity: 1, hint: `${plural(a.kpi.cancelled, 'cancelado', 'cancelados')} aparte` },
            { key: 'ticket', label: 'Ticket promedio', value: ticket(a.kpi),          base: ticket(b.kpi),          polarity: 1, hint: 'Vendido entre pedidos' },
            { key: 'quotes', label: 'Cotizaciones',    value: this.num(a.kpi.quotes), base: this.num(b.kpi.quotes), polarity: 0, hint: `${this.peso(a.kpi.quotes_total)} sin confirmar` }
        ];

        const html = tiles.map((t) => {
            const d = t.key === 'ticket' && !a.kpi.orders
                ? { cls: 'is-flat', icon: '–', text: 'Sin pedidos' }
                : this.delta(a.kpi[t.key], b.kpi[t.key], t.polarity);

            return this.kpiTile({
                label: t.label,
                value: t.value,
                delta: `<span aria-hidden="true">${d.icon}</span> ${d.text} <span class="ord-kpi-vs">vs ${tag}</span>`,
                cls:   d.cls,
                base:  `${esc(this.cap(tag))}: ${t.base}`,
                hint:  t.hint
            });
        });

        // Por cobrar es el saldo de HOY: comparar contra otro mes no dice nada.
        html.push(this.kpiTile({
            label: 'Por cobrar',
            value: this.peso(a.kpi.due),
            delta: plural(a.kpi.due_orders, 'pedido con saldo', 'pedidos con saldo'),
            cls:   'is-flat',
            base:  `${esc(this.cap(tag))}: ${this.peso(b.kpi.due)}`,
            hint:  'Saldo de hoy de los pendientes'
        }));

        $(`#kpis${this.PROJECT_NAME}`).html(html.join(''));
    }

    kpiTile(t) {
        return `
            <div class="ord-kpi">
                <p class="ord-kpi-label">${esc(t.label)}</p>
                <p class="ord-kpi-value">${t.value}</p>
                <p class="ord-kpi-delta ${t.cls}">${t.delta}</p>
                <p class="ord-kpi-base">${t.base}</p>
                <p class="ord-kpi-hint">${esc(t.hint)}</p>
            </div>`;
    }

    // ▲/▼ con su porcentaje. polarity: 1 subir es bueno, -1 es malo, 0 neutro.
    delta(a, b, polarity) {
        a = Number(a || 0);
        b = Number(b || 0);

        if (!a && !b) return { cls: 'is-flat', icon: '–', text: 'Sin cambio' };

        const up   = a > b;
        const tone = polarity === 0 || a === b ? 'is-flat' : ((up ? 1 : -1) * polarity > 0 ? 'is-good' : 'is-bad');

        if (!b) return { cls: tone, icon: '▲', text: 'Nuevo' };

        const pct = Math.abs((a - b) / b * 100);

        if (pct < 0.05) return { cls: 'is-flat', icon: '–', text: '0 %' };

        return { cls: tone, icon: up ? '▲' : '▼', text: `${up ? '+' : '−'}${this.num(pct, pct < 10 ? 1 : 0)} %` };
    }

    // -- Gráficas --

    paintCharts() {
        const { a, b } = this.data;
        const t        = this.theme();
        const longest  = Math.max(a.days, b.days);
        const days     = Array.from({ length: longest }, (v, i) => String(i + 1));
        const pad      = (list) => days.map((d, i) => (i < list.length ? list[i] : null));
        const whole    = a.whole && b.whole;

        $(`#daily${this.PROJECT_NAME}Sub`).text(whole ? 'Vendido por día de captura del pedido.' : `Vendido por día de captura, del 1 al ${longest}.`);
        $(`#status${this.PROJECT_NAME}Sub`).text('Pedidos capturados en el mes, según su estado de hoy.');
        $(`#week${this.PROJECT_NAME}Sub`).text('Vendido entre las veces que cae ese día en el mes.');

        this.draw('Daily', {
            type: 'line',
            data: {
                labels:   days,
                datasets: [
                    this.lineSet(a, pad(a.daily.sold), t.a),
                    this.lineSet(b, pad(b.daily.sold), t.b)
                ]
            },
            options: this.options(t, {
                money:   true,
                title:   (items) => `Día ${items[0].label}`,
                label:   (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y === null ? 'sin día' : money(ctx.parsed.y)}`,
                padding: 52,
                extra:   { ordCrosshair: { color: t.axis }, ordEndLabels: { color: t.text2, surface: t.surface } }
            }),
            plugins: [ordCrosshair, ordEndLabels]
        });

        this.draw('Status', {
            type: 'bar',
            data: {
                labels:   this.statuses.map((s) => s.label),
                datasets: [
                    this.barSet(a, this.statuses.map((s) => a.status[s.key].orders), t.a),
                    this.barSet(b, this.statuses.map((s) => b.status[s.key].orders), t.b)
                ]
            },
            options: this.options(t, {
                integer: true,
                label:   (ctx) => {
                    const period = ctx.datasetIndex === 0 ? a : b;
                    const total  = period.status[this.statuses[ctx.dataIndex].key].total;

                    return ` ${ctx.dataset.label}: ${this.num(ctx.parsed.y)} · ${money(total)}`;
                }
            })
        });

        this.draw('Week', {
            type: 'bar',
            data: {
                labels:   this.weekShort,
                datasets: [
                    this.barSet(a, a.week.map((w) => w.avg_sold), t.a),
                    this.barSet(b, b.week.map((w) => w.avg_sold), t.b)
                ]
            },
            options: this.options(t, {
                money: true,
                title: (items) => a.week[items[0].dataIndex].day,
                label: (ctx) => {
                    const w = (ctx.datasetIndex === 0 ? a : b).week[ctx.dataIndex];

                    return ` ${ctx.dataset.label}: ${money(ctx.parsed.y)} (${w.count} ${w.count === 1 ? 'vez' : 'veces'})`;
                }
            })
        });
    }

    draw(key, config) {
        const canvas = document.getElementById(`${key.toLowerCase()}${this.PROJECT_NAME}Chart`);

        if (!canvas) return;

        if (this.charts[key]) this.charts[key].destroy();

        this.charts[key] = new Chart(canvas, config);
    }

    lineSet(period, data, color) {
        return {
            label:                period.label,
            short:                this.tag(period),
            data:                 data,
            borderColor:          color,
            backgroundColor:      color,
            borderWidth:          2,
            pointRadius:          0,
            pointHoverRadius:     5,
            pointHitRadius:       12,
            pointHoverBorderWidth: 2,
            pointHoverBorderColor: this.theme().surface,
            // Monótona: la curva no se pasa del pico ni baja de $0 entre dos días.
            cubicInterpolationMode: 'monotone',
            spanGaps:             false
        };
    }

    barSet(period, data, color) {
        return {
            label:              period.label,
            data:               data,
            backgroundColor:    color,
            hoverBackgroundColor: color,
            borderRadius:       4,
            borderSkipped:      'start',
            barPercentage:      0.86,
            categoryPercentage: 0.72,
            maxBarThickness:    30
        };
    }

    // Opciones comunes: un solo eje, rejilla tenue, leyenda arriba y tooltip por día o categoría.
    options(t, o) {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        return {
            responsive:          true,
            maintainAspectRatio: false,
            animation:           reduce ? false : { duration: 250 },
            interaction:         { mode: 'index', intersect: false },
            layout:              { padding: { right: o.padding || 4, top: 4 } },
            plugins: {
                legend: {
                    position: 'top',
                    align:    'start',
                    labels:   { color: t.text2, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 14 }
                },
                tooltip: {
                    backgroundColor: t.tipBg,
                    titleColor:      t.text,
                    bodyColor:       t.text2,
                    borderColor:     t.line,
                    borderWidth:     1,
                    padding:         10,
                    cornerRadius:    8,
                    usePointStyle:   true,
                    boxWidth:        8,
                    boxHeight:       8,
                    boxPadding:      4,
                    titleFont:       { weight: '600' },
                    callbacks:       Object.assign({ label: o.label }, o.title ? { title: o.title } : {})
                },
                ...(o.extra || {})
            },
            scales: {
                x: {
                    grid:   { display: false },
                    border: { color: t.axis },
                    ticks:  { color: t.tick, maxRotation: 0, autoSkip: true, autoSkipPadding: 10 }
                },
                y: {
                    beginAtZero: true,
                    grid:   { color: t.grid },
                    border: { display: false },
                    ticks:  {
                        color:     t.tick,
                        precision: o.integer ? 0 : undefined,
                        callback:  (v) => (o.money ? this.axisMoney(v) : this.num(v))
                    }
                }
            }
        };
    }

    // Colores del tema en uso. El fondo sale de la tarjeta real (cambia por esquema).
    theme() {
        const card    = $(`#board${this.PROJECT_NAME}`).closest('.ord-card')[0];
        const surface = card ? getComputedStyle(card).backgroundColor : '';

        if (this.dark) {
            return {
                a: '#3987e5', b: '#d95926',
                grid: 'rgba(255,255,255,0.08)', axis: 'rgba(255,255,255,0.22)', tick: '#9CA3AF',
                text: '#f0efec', text2: '#c3c2b7', line: 'rgba(255,255,255,0.12)',
                tipBg: '#111928', surface: surface || '#1F2A37'
            };
        }

        return {
            a: '#2a78d6', b: '#eb6834',
            grid: '#e1e0d9', axis: '#c3c2b7', tick: '#898781',
            text: '#0b0b0b', text2: '#52514e', line: 'rgba(11,11,11,0.10)',
            tipBg: '#ffffff', surface: surface || '#ffffff'
        };
    }

    // -- Tablas --

    paintTables() {
        const { a, b } = this.data;
        const ta       = esc(this.cap(this.tag(a)));
        const tb       = esc(this.cap(this.tag(b)));
        const longest  = Math.max(a.days, b.days);

        const daily = Array.from({ length: longest }, (v, i) => [
            String(i + 1),
            i < a.days ? money(a.daily.sold[i]) : '—',
            i < a.days ? this.num(a.daily.orders[i]) : '—',
            i < b.days ? money(b.daily.sold[i]) : '—',
            i < b.days ? this.num(b.daily.orders[i]) : '—'
        ]);

        $(`#daily${this.PROJECT_NAME}Table`).html(this.table(
            ['Día', `${ta} vendido`, `${ta} pedidos`, `${tb} vendido`, `${tb} pedidos`],
            daily,
            ['Total', money(a.kpi.sold), this.num(a.kpi.orders), money(b.kpi.sold), this.num(b.kpi.orders)]
        ));

        $(`#status${this.PROJECT_NAME}Table`).html(this.table(
            ['Estado', `${ta} pedidos`, `${ta} importe`, `${tb} pedidos`, `${tb} importe`],
            this.statuses.map((s) => [
                s.label,
                this.num(a.status[s.key].orders), money(a.status[s.key].total),
                this.num(b.status[s.key].orders), money(b.status[s.key].total)
            ])
        ));

        $(`#week${this.PROJECT_NAME}Table`).html(this.table(
            ['Día', `${ta} veces`, `${ta} promedio`, `${tb} veces`, `${tb} promedio`],
            a.week.map((w, i) => [
                w.day,
                this.num(w.count), w.count ? money(w.avg_sold) : '—',
                this.num(b.week[i].count), b.week[i].count ? money(b.week[i].avg_sold) : '—'
            ])
        ));
    }

    // Ranking del mes A por vendido promedio, como el «Ranking por promedio semanal» de alpha.
    paintRank() {
        const { a, b } = this.data;
        const ta       = esc(this.cap(this.tag(a)));
        const tb       = esc(this.cap(this.tag(b)));

        const rows = a.week
            .map((w, i) => ({ ...w, other: b.week[i] }))
            .sort((m, n) => n.avg_sold - m.avg_sold)
            .map((w, i) => {
                const d = w.count && w.other.count ? this.delta(w.avg_sold, w.other.avg_sold, 1) : null;

                return [
                    `${i + 1}. ${esc(w.day)}`,
                    w.count ? money(w.avg_sold) : '—',
                    w.count ? this.num(w.avg_orders, 1) : '—',
                    w.count ? this.num(w.avg_customers, 1) : '—',
                    w.other.count ? money(w.other.avg_sold) : '—',
                    d ? `<span class="ord-kpi-delta ${d.cls}"><span aria-hidden="true">${d.icon}</span> ${d.text}</span>` : '—'
                ];
            });

        $(`#rankText${this.PROJECT_NAME}`).html(`
            <h2 class="ord-chart-title">Ranking de días</h2>
            <p class="ord-chart-sub">Días de ${esc(a.label)} ordenados por lo que se vende en promedio. Ayuda a decidir cuánto producir y cuánto personal poner.</p>`);

        $(`#rankTable${this.PROJECT_NAME}`).html(this.table(
            ['Día', `${ta} vendido`, `${ta} pedidos`, `${ta} clientes`, `${tb} vendido`, 'Cambio'],
            rows
        ));
    }

    // Tabla con los mismos números de la gráfica. Las celdas ya vienen escapadas.
    table(head, rows, foot) {
        const th = head.map((h, i) => `<th scope="col"${i ? ' class="r"' : ''}>${h}</th>`).join('');
        const tr = (row) => row.map((c, i) => `<td${i ? ' class="r"' : ''}>${c}</td>`).join('');

        return `
            <table>
                <thead><tr>${th}</tr></thead>
                <tbody>${rows.map((row) => `<tr>${tr(row)}</tr>`).join('')}</tbody>
                ${foot ? `<tfoot><tr>${tr(foot)}</tr></tfoot>` : ''}
            </table>`;
    }

    setMode(key, mode) {
        if (!this.cards[key]) return;

        const id = `${key.toLowerCase()}${this.PROJECT_NAME}`;

        this.modes[key] = mode === 'table' ? 'table' : 'chart';

        $(`#${id}Canvas`).toggleClass('is-hidden', this.modes[key] === 'table');
        $(`#${id}Table`).toggleClass('is-open', this.modes[key] === 'table');

        $(`#${id}Modes button.ord-seg`).each((i, el) => {
            const active = $(el).attr('data-mode') === this.modes[key];

            $(el).toggleClass('is-active', active).attr('aria-pressed', String(active));
        });
    }

    // -- Complements --

    // body.dark-mode cambia sin evento: se repintan solo las gráficas.
    watchTheme() {
        new MutationObserver(() => {
            const dark = document.body.classList.contains('dark-mode');

            if (dark === this.dark) return;

            this.dark = dark;

            if (this.data) this.paintCharts();
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    onBranchChange() {
        location.reload();
    }

    onFilterChange() {
        this.lsDashboard();
    }

    can(action) {
        return (dataInit.actions || []).includes(action);
    }

    hasData(period) {
        return Boolean(period.kpi.orders || period.kpi.quotes || period.kpi.cancelled || period.kpi.paid);
    }

    // «oct 2026»; «oct 26» no se entiende en una leyenda.
    tag(period) {
        const [y, m] = String(period.month).split('-');

        return `${this.short[Number(m) - 1] || ''} ${y}`;
    }

    cap(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    num(n, decimals = 0) {
        return Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }

    // Pesos sin centavos para las cifras grandes.
    peso(n) {
        const value = Math.round(Number(n || 0));

        return (value < 0 ? '-' : '') + '$' + Math.abs(value).toLocaleString('es-MX');
    }

    axisMoney(v) {
        if (Math.abs(v) >= 1000) return `$${this.num(v / 1000, v % 1000 ? 1 : 0)}k`;

        return `$${this.num(v)}`;
    }
}
