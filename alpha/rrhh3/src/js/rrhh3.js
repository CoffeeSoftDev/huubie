/**
 * RRHH v3 — Huubie Design System
 * Componentes custom, sin dependencia de createTable/coffeTable.
 * Usa solo useFetch() y formatPrice() del framework base.
 */

const api = 'ctrl/ctrl-rrhh.php';
let app3;

// ─── Helpers ────────────────────────────────────────────
const H = {
    avatarColors: [
        'from-purple-500 to-pink-500','from-green-500 to-teal-500','from-blue-500 to-purple-500',
        'from-orange-500 to-red-500','from-pink-500 to-purple-500','from-teal-500 to-blue-500',
        'from-yellow-500 to-orange-500','from-indigo-500 to-purple-500','from-red-500 to-pink-500',
        'from-green-500 to-blue-500'
    ],

    initials(name) {
        if (!name) return '??';
        const p = name.trim().split(/\s+/);
        return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
    },

    avatar(name, id) {
        const c = this.avatarColors[(id || 0) % this.avatarColors.length];
        return `<div class="hb-avatar bg-gradient-to-br ${c}">${this.initials(name)}</div>`;
    },

    badge(text, type) {
        return `<span class="hb-badge hb-badge-${type}">${text}</span>`;
    },

    money(val) {
        const n = parseFloat(val) || 0;
        return formatPrice(n);
    },

    moneyColor(val, positiveColor = 'text-green-400', negativeColor = 'text-red-400') {
        const n = parseFloat(val) || 0;
        if (n === 0) return `<span class="text-gray-500">—</span>`;
        if (n > 0) return `<span class="${positiveColor}">${formatPrice(n)}</span>`;
        return `<span class="${negativeColor}">${formatPrice(n)}</span>`;
    },

    stat(id, label, value, color = 'text-white', icon = '') {
        return `
        <div class="hb-stat" id="${id}">
            <p class="hb-stat-label">${label}</p>
            <p class="hb-stat-value ${color}">${value}</p>
        </div>`;
    },

    select(id, label, options, onChange) {
        const opts = options.map(o => `<option value="${o.id}">${o.valor}</option>`).join('');
        return `
        <div>
            <label class="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">${label}</label>
            <select id="${id}" class="hb-select" ${onChange ? `onchange="${onChange}"` : ''}>${opts}</select>
        </div>`;
    },

    /**
     * Tabla custom con estilo Huubie
     * @param {Object} cfg
     * @param {string} cfg.id
     * @param {Array}  cfg.cols - [{ key, label, align, render(val, row) }]
     * @param {Array}  cfg.rows - datos
     * @param {string} [cfg.empty] - mensaje si no hay datos
     */
    table(cfg) {
        const cols = cfg.cols || [];
        const rows = cfg.rows || [];
        const id = cfg.id || 'hbTable';
        const empty = cfg.empty || 'Sin registros';

        let ths = cols.map(c => {
            const al = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
            return `<th class="${al}">${c.label}</th>`;
        }).join('');

        let trs = '';
        if (rows.length === 0) {
            trs = `<tr><td colspan="${cols.length}" class="text-center text-gray-500 py-10">${empty}</td></tr>`;
        } else {
            rows.forEach(row => {
                let tds = cols.map(c => {
                    const al = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : '';
                    const val = row[c.key] !== undefined ? row[c.key] : '';
                    const rendered = c.render ? c.render(val, row) : val;
                    return `<td class="${al}">${rendered}</td>`;
                }).join('');
                trs += `<tr>${tds}</tr>`;
            });
        }

        return `
        <div class="overflow-x-auto scrollbar-thin">
            <table id="${id}" class="hb-table" style="min-width:${cfg.minWidth || '700px'}">
                <thead><tr>${ths}</tr></thead>
                <tbody>${trs}</tbody>
            </table>
        </div>`;
    }
};

// ─── App ────────────────────────────────────────────────
$(async () => {
    const data = await useFetch({ url: api, data: { opc: 'init' } });
    if (!data || data.status !== 200) {
        $('#root').html('<p class="text-red-400 text-center py-20">Error al cargar datos iniciales</p>');
        return;
    }

    app3 = new RRHH3(data);
    app3.render();
});


class RRHH3 {
    constructor(data) {
        this.subsidiaries = data.subsidiaries || [];
        this.puestos = data.puestos || [];
        this.turnos = data.turnos || [];
        this.usr = data.usr;
        this.sub = data.sub;
        this.rol = data.rol;
        this.activeTab = localStorage.getItem('rrhh3_tab') || 'resumen';
    }

    render() {
        const tabs = [
            { id: 'resumen',      label: 'Resumen',      icon: 'icon-chart-bar' },
            { id: 'personal',     label: 'Personal',     icon: 'icon-users' },
            { id: 'permisos',     label: 'Permisos',     icon: 'icon-doc-text' },
            { id: 'incidencias',  label: 'Incidencias',  icon: 'icon-clock' },
            { id: 'nomina',       label: 'Nomina',       icon: 'icon-money' }
        ];

        const tabsHtml = tabs.map(t => {
            const active = t.id === this.activeTab;
            return `<button data-tab="${t.id}" class="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors
                ${active ? 'bg-[#7c3aed] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}"
                onclick="app3.switchTab('${t.id}')">
                <i class="${t.icon}"></i> ${t.label}
            </button>`;
        }).join('');

        $('#root').html(`
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">${tabsHtml}</div>
            </div>
            <div id="tabContent"></div>
        `);

        this.switchTab(this.activeTab);
    }

    switchTab(id) {
        this.activeTab = id;
        localStorage.setItem('rrhh3_tab', id);
        $('[data-tab]').removeClass('bg-[#7c3aed] text-white').addClass('text-gray-400 hover:text-white hover:bg-white/5');
        $(`[data-tab="${id}"]`).removeClass('text-gray-400 hover:text-white hover:bg-white/5').addClass('bg-[#7c3aed] text-white');

        const actions = {
            resumen:     () => this.showResumen(),
            personal:    () => this.showPersonal(),
            permisos:    () => this.showPermisos(),
            incidencias: () => this.showIncidencias(),
            nomina:      () => this.showNomina()
        };
        if (actions[id]) actions[id]();
    }

    // ─── RESUMEN ────────────────────────────────────────
    async showResumen() {
        const subId = this.sub || '0';
        const data = await useFetch({ url: api, data: { opc: 'showResumen', subsidiaries_id: subId } });

        const counts = data?.counts || {};
        const permisos = data?.permisos?.row || [];

        $('#tabContent').html(`
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                ${H.stat('s1', 'Total Empleados', counts.total_empleados || 0, 'text-white')}
                ${H.stat('s2', 'Activos', counts.activos || 0, 'text-green-400')}
                ${H.stat('s3', 'Bajas', counts.bajas || 0, 'text-red-400')}
                ${H.stat('s4', 'Altas (30d)', counts.altas_periodo || 0, 'text-blue-400')}
                ${H.stat('s5', 'Bajas (30d)', counts.bajas_periodo || 0, 'text-orange-400')}
            </div>
            <div class="hb-card">
                <h3 class="text-sm font-bold text-white mb-3">Permisos Pendientes</h3>
                ${H.table({
                    id: 'tbResumenPermisos',
                    cols: [
                        { key: 'codigo', label: 'Codigo', align: 'left' },
                        { key: 'nombre', label: 'Colaborador', align: 'left', render: (v, r) => `<div class="flex items-center gap-2">${H.avatar(v, r.id)}<span class="text-xs text-white font-medium">${v}</span></div>` },
                        { key: 'puesto', label: 'Puesto', align: 'left' },
                        { key: 'tipo',   label: 'Tipo', align: 'center' },
                        { key: 'fecha',  label: 'Periodo', align: 'center' },
                        { key: 'estatus',label: 'Estatus', align: 'center' }
                    ],
                    rows: permisos,
                    empty: 'No hay permisos pendientes'
                })}
            </div>
        `);
    }

    // ─── PERSONAL ───────────────────────────────────────
    async showPersonal() {
        const subsOpts = [{ id: '0', valor: 'Todas' }, ...this.subsidiaries];

        $('#tabContent').html(`
            <div class="flex items-center gap-3 mb-4 flex-wrap">
                ${H.select('p_sub', 'Sucursal', subsOpts, 'app3.loadPersonal()')}
                <div class="self-end">
                    <button class="hb-btn hb-btn-purple" onclick="app3.addPersonal()"><i class="icon-plus"></i> Agregar</button>
                </div>
            </div>
            <div id="statsPersonal" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4"></div>
            <div id="tbPersonalWrap" class="hb-card"></div>
        `);
        this.loadPersonal();
    }

    async loadPersonal() {
        const subId = $('#p_sub').val() || '0';

        const [counts, list] = await Promise.all([
            useFetch({ url: api, data: { opc: 'showPersonal', subsidiaries_id: subId } }),
            useFetch({ url: api, data: { opc: 'lsPersonal', subsidiaries_id: subId, estado: '', puesto_id: '0', turno_id: '0' } })
        ]);

        const c = counts?.counts || {};
        $('#statsPersonal').html(`
            ${H.stat('sp1', 'Total', c.total || 0, 'text-white')}
            ${H.stat('sp2', 'Activos', c.activos || 0, 'text-green-400')}
            ${H.stat('sp3', 'Bajas', c.bajas || 0, 'text-red-400')}
            ${H.stat('sp4', 'Suspendidos', c.suspendidos || 0, 'text-yellow-400')}
        `);

        const rows = list?.row || [];
        $('#tbPersonalWrap').html(`
            <h3 class="text-sm font-bold text-white mb-3">Colaboradores</h3>
            ${H.table({
                id: 'tbPersonal3',
                minWidth: '900px',
                cols: [
                    { key: 'codigo',   label: 'Codigo' },
                    { key: 'nombre',   label: 'Nombre', render: (v, r) => `<div class="flex items-center gap-2">${H.avatar(v, r.id)}<span class="text-xs text-white font-medium">${v}</span></div>` },
                    { key: 'puesto',   label: 'Puesto', align: 'center' },
                    { key: 'turno',    label: 'Turno', align: 'center' },
                    { key: 'sucursal', label: 'Sucursal' },
                    { key: 'salario',  label: 'Salario Diario', align: 'right' },
                    { key: 'estado',   label: 'Estado', align: 'center' },
                    { key: 'ingreso',  label: 'Ingreso' }
                ],
                rows: rows,
                empty: 'No hay colaboradores registrados'
            })}
        `);
    }

    addPersonal() {
        Swal.fire({ title: 'Nuevo Colaborador', text: 'Formulario en desarrollo', icon: 'info', background: '#1F2A37', color: '#fff' });
    }

    // ─── PERMISOS ───────────────────────────────────────
    async showPermisos() {
        const subsOpts = [{ id: '0', valor: 'Todas' }, ...this.subsidiaries];

        $('#tabContent').html(`
            <div class="flex items-center gap-3 mb-4 flex-wrap">
                ${H.select('pm_sub', 'Sucursal', subsOpts, 'app3.loadPermisos()')}
                ${H.select('pm_estatus', 'Estatus', [
                    { id: '', valor: 'Todos' },
                    { id: 'pendiente', valor: 'Pendiente' },
                    { id: 'aprobado', valor: 'Aprobado' },
                    { id: 'rechazado', valor: 'Rechazado' }
                ], 'app3.loadPermisos()')}
            </div>
            <div id="tbPermisosWrap" class="hb-card"></div>
        `);
        this.loadPermisos();
    }

    async loadPermisos() {
        const data = await useFetch({ url: api, data: {
            opc: 'lsPermisos',
            subsidiaries_id: $('#pm_sub').val() || '0',
            estatus: $('#pm_estatus').val() || '',
            tipo: ''
        }});

        const rows = data?.row || [];
        $('#tbPermisosWrap').html(`
            <h3 class="text-sm font-bold text-white mb-3">Permisos</h3>
            ${H.table({
                id: 'tbPermisos3',
                minWidth: '950px',
                cols: [
                    { key: 'codigo',  label: 'Codigo' },
                    { key: 'nombre',  label: 'Colaborador', render: (v, r) => `<div class="flex items-center gap-2">${H.avatar(v, r.id)}<span class="text-xs text-white font-medium">${v}</span></div>` },
                    { key: 'puesto',  label: 'Puesto', align: 'center' },
                    { key: 'tipo',    label: 'Tipo', align: 'center' },
                    { key: 'inicio',  label: 'Inicio', align: 'center' },
                    { key: 'fin',     label: 'Fin', align: 'center' },
                    { key: 'dias',    label: 'Dias', align: 'center' },
                    { key: 'estatus', label: 'Estatus', align: 'center' }
                ],
                rows: rows
            })}
        `);
    }

    // ─── INCIDENCIAS ────────────────────────────────────
    async showIncidencias() {
        const subsOpts = [{ id: '0', valor: 'Todas' }, ...this.subsidiaries];
        this._incMode = this._incMode || 'semanal';

        $('#tabContent').html(`
            <div class="flex items-center gap-3 mb-4 flex-wrap">
                ${H.select('inc_sub', 'Sucursal', subsOpts, 'app3.loadIncidenciasGrid()')}
                <div>
                    <label class="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Fecha inicio</label>
                    <input type="date" id="inc_desde" class="hb-input" value="${moment().startOf('isoWeek').format('YYYY-MM-DD')}" onchange="app3.loadIncidenciasGrid()">
                </div>
                <div class="self-end flex bg-[#1a2332] border border-gray-700 rounded-lg p-1 gap-1">
                    <button class="hb-inc-pill ${this._incMode === 'semanal' ? 'active' : ''}" onclick="app3.setIncMode('semanal')">Semanal</button>
                    <button class="hb-inc-pill ${this._incMode === 'quincenal' ? 'active' : ''}" onclick="app3.setIncMode('quincenal')">Quincenal</button>
                    <button class="hb-inc-pill ${this._incMode === 'mensual' ? 'active' : ''}" onclick="app3.setIncMode('mensual')">Mensual</button>
                </div>
            </div>
            <div class="flex items-center gap-4 mb-3 text-[10px] text-gray-400">
                <span><span class="hb-dot hb-dot-green"></span> A tiempo</span>
                <span><span class="hb-dot hb-dot-red"></span> Falta/Retardo</span>
                <span><span class="hb-dot hb-dot-yellow"></span> Vacaciones</span>
                <span><span class="hb-dot hb-dot-pink"></span> Incapacidad</span>
                <span><span class="hb-dot hb-dot-gray"></span> Sin estatus</span>
            </div>
            <div id="tbIncidenciasWrap" class="hb-card p-0 overflow-hidden"></div>
        `);
        this.loadIncidenciasGrid();
    }

    setIncMode(mode) {
        this._incMode = mode;
        $('.hb-inc-pill').removeClass('active');
        $(`.hb-inc-pill:contains('${mode.charAt(0).toUpperCase() + mode.slice(1)}')`).addClass('active');

        const desde = moment($('#inc_desde').val());
        if (mode === 'semanal') $('#inc_desde').val(desde.startOf('isoWeek').format('YYYY-MM-DD'));
        else if (mode === 'quincenal') $('#inc_desde').val(desde.date() <= 15 ? desde.startOf('month').format('YYYY-MM-DD') : desde.date(16).format('YYYY-MM-DD'));
        else $('#inc_desde').val(desde.startOf('month').format('YYYY-MM-DD'));

        this.loadIncidenciasGrid();
    }

    _getDateRange() {
        const desde = moment($('#inc_desde').val());
        let hasta;
        if (this._incMode === 'semanal') hasta = desde.clone().add(6, 'days');
        else if (this._incMode === 'quincenal') hasta = desde.clone().add(14, 'days');
        else hasta = desde.clone().endOf('month');
        return { desde, hasta };
    }

    _getDaysArray(desde, hasta) {
        const days = [];
        const cur = desde.clone();
        while (cur.isSameOrBefore(hasta)) {
            days.push({ date: cur.format('YYYY-MM-DD'), dayName: cur.format('dd'), dayNum: cur.format('DD/MM') });
            cur.add(1, 'day');
        }
        return days;
    }

    _dotForStatus(estatus) {
        const map = {
            atiempo: { dot: 'hb-dot-green', label: 'A tiempo' },
            retardo: { dot: 'hb-dot-red',   label: 'Retardo' },
            falta:   { dot: 'hb-dot-red',   label: 'Falta' },
            vacaciones:  { dot: 'hb-dot-yellow', label: 'Vac.' },
            incapacidad: { dot: 'hb-dot-pink',   label: 'Incap.' },
            reconocimiento: { dot: 'hb-dot-purple', label: 'Rec.' },
            sin_estatus: { dot: 'hb-dot-gray',  label: '—' }
        };
        return map[estatus] || map.sin_estatus;
    }

    async loadIncidenciasGrid() {
        const { desde, hasta } = this._getDateRange();
        const days = this._getDaysArray(desde, hasta);

        const data = await useFetch({ url: api, data: {
            opc: 'lsIncidenciaPersonalizado',
            fecha_inicio: desde.format('YYYY-MM-DD'),
            fecha_fin: hasta.format('YYYY-MM-DD'),
            subsidiaries_id: $('#inc_sub').val() || '0'
        }});

        const rows = data?.data || [];

        // Pivotear: agrupar por empleado_id
        const empMap = {};
        rows.forEach(r => {
            if (!empMap[r.empleado_id]) {
                empMap[r.empleado_id] = { id: r.empleado_id, nombre: r.nombre_completo, puesto: r.puesto, turno: r.turno, dias: {} };
            }
            empMap[r.empleado_id].dias[r.fecha] = r.estatus;
        });
        const empleados = Object.values(empMap);

        // Generar headers de dias
        const dayHeaders = days.map(d =>
            `<th class="text-center py-3 px-1 font-medium" style="min-width:58px">${d.dayName}<br><span class="text-[8px] text-gray-600">${d.dayNum}</span></th>`
        ).join('');

        // Generar filas
        let tbodyHtml = '';
        if (empleados.length === 0) {
            tbodyHtml = `<tr><td colspan="${3 + days.length}" class="text-center text-gray-500 py-10">Sin incidencias para este periodo</td></tr>`;
        } else {
            empleados.forEach(emp => {
                const dayCells = days.map(d => {
                    const est = emp.dias[d.date];
                    if (!est) return `<td class="py-2 px-1 text-center"><span class="text-gray-700 text-[10px]">—</span></td>`;
                    const info = this._dotForStatus(est);
                    return `<td class="py-2 px-1 text-center"><span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-gray-300 hover:bg-[#1a2332] cursor-default"><span class="hb-dot ${info.dot}"></span>${info.label}</span></td>`;
                }).join('');

                tbodyHtml += `
                <tr class="hover:bg-[#1a2332]/50">
                    <td class="py-2 px-3"><div class="flex items-center gap-2">${H.avatar(emp.nombre, emp.id)}<span class="text-xs text-white font-medium whitespace-nowrap">${emp.nombre}</span></div></td>
                    <td class="py-2 px-2">${H.badge(emp.puesto, 'puesto')}</td>
                    <td class="py-2 px-2 text-[11px] text-gray-400 whitespace-nowrap">${emp.turno}</td>
                    ${dayCells}
                </tr>`;
            });
        }

        const titulo = `${desde.format('DD MMM')} — ${hasta.format('DD MMM YYYY')} (${this._incMode})`;

        $('#tbIncidenciasWrap').html(`
            <div class="px-4 py-3 border-b border-gray-800">
                <h3 class="text-sm font-bold text-white">${titulo}</h3>
            </div>
            <div class="overflow-x-auto scrollbar-thin">
                <table class="hb-table" style="min-width:${Math.max(700, 200 + days.length * 62)}px">
                    <thead class="sticky top-0 bg-[#111928] z-10">
                        <tr class="text-[9px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                            <th class="text-left py-3 px-3 font-medium">Colaborador</th>
                            <th class="text-left py-3 px-2 font-medium">Puesto</th>
                            <th class="text-left py-3 px-2 font-medium">Turno</th>
                            ${dayHeaders}
                        </tr>
                    </thead>
                    <tbody>${tbodyHtml}</tbody>
                </table>
            </div>
        `);
    }

    // ─── NOMINA ─────────────────────────────────────────
    async showNomina() {
        const subsOpts = [{ id: '0', valor: 'Todas' }, ...this.subsidiaries];

        $('#tabContent').html(`
            <div class="flex items-center gap-3 mb-4 flex-wrap">
                ${H.select('nom_sub', 'Sucursal', subsOpts, 'app3.loadNomina()')}
            </div>
            <div id="tbNominaWrap" class="hb-card"></div>
        `);
        this.loadNomina();
    }

    async loadNomina() {
        const data = await useFetch({ url: api, data: {
            opc: 'lsNomina',
            subsidiaries_id: $('#nom_sub').val() || '0'
        }});

        const rows = data?.row || [];
        $('#tbNominaWrap').html(`
            <h3 class="text-sm font-bold text-white mb-3">Periodos de Nomina</h3>
            ${H.table({
                id: 'tbNomina3',
                minWidth: '900px',
                cols: [
                    { key: 'codigo',        label: 'Codigo' },
                    { key: 'sucursal',      label: 'Sucursal' },
                    { key: 'periodo',       label: 'Periodo', align: 'center' },
                    { key: 'frecuencia',    label: 'Frecuencia', align: 'center' },
                    { key: 'total',         label: 'Total', align: 'right', render: v => `<span class="font-bold text-white">${v}</span>` },
                    { key: 'colaboradores', label: 'Colaboradores', align: 'center' },
                    { key: 'estatus',       label: 'Estatus', align: 'center' },
                    { key: 'a',             label: '', align: 'center', render: (v, r) => `<button class="hb-btn hb-btn-ghost text-[10px] py-1 px-2" onclick="app3.verNominaDetalle(${r.id})"><i class="icon-eye"></i></button>` }
                ],
                rows: rows
            })}
        `);
    }

    async verNominaDetalle(periodoId) {
        const req = await useFetch({ url: api, data: { opc: 'showNomina', periodo_id: periodoId } });
        if (!req || req.status !== 200) return;

        const t = req.totals || {};
        const rows = req.row || [];

        $('#tabContent').html(`
            <button class="hb-btn hb-btn-ghost mb-4" onclick="app3.showNomina()"><i class="icon-left-open"></i> Volver</button>

            <div class="flex items-center justify-between px-5 py-3 bg-[#141d2b] border-b border-gray-800 rounded-t-xl">
                <div class="flex items-center gap-3">
                    <h2 class="text-lg font-bold text-white">Detalle de Nomina <span class="text-gray-400 font-normal">— Periodo #${periodoId}</span></h2>
                </div>
            </div>

            <div class="flex items-center justify-end gap-6 px-5 py-3 bg-[#141d2b] border-b border-gray-800">
                <div class="text-right"><p class="text-[10px] text-gray-500 uppercase tracking-wider">Total Efectivo</p><p class="text-sm font-bold text-green-400">${formatPrice(parseFloat(t.total_efectivo || 0))}</p></div>
                <div class="text-right"><p class="text-[10px] text-gray-500 uppercase tracking-wider">Total Bancos</p><p class="text-sm font-bold text-blue-400">${formatPrice(parseFloat(t.total_bancos || 0))}</p></div>
                <div class="text-right"><p class="text-[10px] text-gray-500 uppercase tracking-wider">Total General</p><p class="text-sm font-bold text-purple-400">${formatPrice(parseFloat(t.total_general || 0))}</p></div>
                <div class="text-right"><p class="text-[10px] text-gray-500 uppercase tracking-wider">Colaboradores</p><p class="text-sm font-bold text-white">${t.total_colaboradores || 0}</p></div>
            </div>

            <div class="bg-[#111928] rounded-b-xl overflow-hidden">
                ${H.table({
                    id: 'tbNominaDetalle3',
                    minWidth: '1100px',
                    cols: [
                        { key: 'nombre',         label: 'Colaborador', render: (v, r) => `<div class="flex items-center gap-2">${H.avatar(v, r.id || 0)}<div><p class="text-xs font-medium text-white">${v}</p><p class="text-[10px] text-gray-500">${r.codigo || ''}</p></div></div>` },
                        { key: 'puesto',         label: 'Puesto', render: v => H.badge(v, 'puesto') },
                        { key: 'dias_laborados', label: 'Dias Lab.', align: 'right' },
                        { key: 'dias_faltas',    label: 'Faltas', align: 'right', render: v => { const n = parseFloat(v) || 0; return n > 0 ? `<span class="text-red-400">${n}</span>` : `<span class="text-gray-500">0</span>`; } },
                        { key: 'sueldo_diario',  label: 'Sueldo Diario', align: 'right', render: v => H.money(v) },
                        { key: 'bonos',          label: 'Bonos', align: 'right', render: v => H.moneyColor(v, 'text-green-400') },
                        { key: 'descuentos',     label: 'Descuentos', align: 'right', render: v => H.moneyColor(v, 'text-red-400', 'text-red-400') },
                        { key: 'total_nomina',   label: 'Total Nomina', align: 'right', render: v => `<span class="text-sm font-bold text-white">${H.money(v)}</span>` }
                    ],
                    rows: rows
                })}
            </div>

            <div class="flex items-center justify-end gap-2 px-5 py-3 bg-[#141d2b] border-t border-gray-800 rounded-b-xl mt-0">
                <button class="hb-btn hb-btn-blue"><i class="icon-download"></i> Descargar XLS</button>
                <button class="hb-btn hb-btn-green" onclick="app3.aprobarNomina(${periodoId})">Aprobar</button>
                <button class="hb-btn hb-btn-red">Rechazar</button>
            </div>
        `);
    }

    aprobarNomina(periodoId) {
        Swal.fire({
            title: 'Autorizar',
            text: 'Ingresa tu password para aprobar',
            input: 'password',
            inputPlaceholder: 'Password',
            showCancelButton: true,
            confirmButtonText: 'Aprobar',
            confirmButtonColor: '#3fc189',
            background: '#1F2A37',
            color: '#fff',
            preConfirm: async (password) => {
                if (!password) { Swal.showValidationMessage('Ingresa tu password'); return false; }
                const req = await useFetch({ url: api, data: {
                    opc: 'addAutorizacion', password, accion: 'aprobar_nomina',
                    tabla_afectada: 'rrhh_nomina_periodos', registro_id: periodoId,
                    valor_anterior: '', valor_nuevo: ''
                }});
                if (req.status !== 200) { Swal.showValidationMessage(req.message); return false; }
                return true;
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                await useFetch({ url: api, data: {
                    opc: 'editNomina', id: periodoId, estatus: 'aprobada',
                    aprobado_por: this.usr,
                    aprobado_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                }});
                Swal.fire({ title: 'Aprobada', icon: 'success', background: '#1F2A37', color: '#fff', confirmButtonColor: '#3fc189' });
                this.showNomina();
            }
        });
    }
}
