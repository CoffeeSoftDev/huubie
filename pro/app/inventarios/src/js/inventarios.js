// -- Inventarios: lo que comparten Stock, Entradas, Salidas, Traspasos y Kárdex --
// Cada página carga este archivo y el suyo (stock.js, entradas.js, salidas.js,
// traspasos.js, kardex.js).
// La forma es la de Catálogo: título + sucursal, pestañas en su tarjeta,
// barra de filtros, tabla flowbite y ventanas csModal.

let invPage = null;

// -- Avisos (alertBox del framework, como Catálogo) --

function notify(r) {
    if (r && r.status == 200) invPage.alertBox({ type: 'success', title: esc(r.message), timer: 1400 });
    else invPage.alertBox({ type: 'error', title: esc((r && r.message) || 'Ocurrió un error') });
}

function warnBox(text, type = 'warning') {
    invPage.alertBox({ type, title: esc(text) });
}

// Pregunta y, si confirma, manda `data` al ctrl de la página.
function confirmSend({ title, text, data, done, danger = false, okLabel = 'Sí, continuar' }) {
    invPage.alertBox({
        type: danger ? 'cancel' : 'confirm',
        title: esc(title),
        detailHtml: esc(text),
        okLabel,
        onOk: async () => done(await useFetch({ url: invPage._link, data }))
    });
}

function esc(t) {
    return (t == null ? '' : String(t)).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function money(n) {
    return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 12 · 2.5 · 1,250.125: sin ceros de más.
function qtyText(n) {
    return Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 3 });
}

// csModal no bloquea su botón: evita el doble guardado por doble clic.
async function saveFrom(modalId, request) {
    const btn = $(`#${modalId} .cs-modal-save`);

    if (btn.prop('disabled')) return;

    btn.prop('disabled', true);

    try {
        return await request();
    } finally {
        btn.prop('disabled', false);
    }
}

// La foto de evidencia: JPEG de máximo `max` px por lado, sobre blanco. '' si no se puede abrir.
function compressPhoto(file, max = 1000) {
    return new Promise((resolve) => {
        if (!file || !/^image\//.test(file.type)) return resolve('');

        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            const scale  = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve('');
        };
        img.src = url;
    });
}

// -- Página --

class InvPage extends Templates {

    constructor(link, div_modulo, page) {
        super(link, div_modulo);
        this.PROJECT_NAME = page.name;
        this.page   = page;          // { name, title, help, tabKey }
        this.data   = {};
        this.opened = {};
        invPage     = this;
    }

    async init() {
        this.data = (await useFetch({ url: this._link, data: { opc: 'init' } })) || {};

        this.layout();
        this.header();

        if (this.data.status != 200) {
            $('#tabbarInv').html(`<div class="inv-vacio">${esc(this.data.message || 'No se pudo abrir el inventario.')}</div>`);
            return;
        }

        this.tabs();
    }

    layout() {
        $('#root').html(`
            <div class="cp-pagina flex flex-1 flex-col gap-[16px]">
                <div id="headerInv"></div>
                <div id="tabbarInv" class="flex flex-1 flex-col"></div>
            </div>
        `);
    }

    // La sucursal resaltada: manda en todo lo que se ve abajo (igual que Catálogo).
    header() {
        const scope  = this.data.scope || {};
        const branch = scope.branch ? `<span class="cp-pagina-sucursal">${esc(scope.branch)}</span>` : '';
        const where  = [scope.company ? esc(scope.company) : '', branch].filter(Boolean).join(' · ');

        $('#headerInv').html(`
            <h1 class="cp-pagina-titulo">${esc(this.page.title)}</h1>
            <p class="cp-pagina-subtitulo">${where || esc(this.page.help)}</p>
        `);
    }

    // Cada página: [{ id, tab, icon, render: () => {}, reopen: () => {} }]
    tabsList() {
        return [];
    }

    activeTab(list) {
        const exists  = (id) => list.some((t) => t.id === id);
        const fromUrl = new URLSearchParams(location.search).get('tab');

        if (fromUrl && exists(fromUrl)) return fromUrl;

        let saved = null;
        try { saved = localStorage.getItem(this.page.tabKey); } catch (e) { saved = null; }

        if (saved && exists(saved)) return saved;

        return list.length ? list[0].id : null;
    }

    tabs() {
        const list   = this.tabsList();
        const active = this.activeTab(list);
        const counts = this.data.counts || {};

        this.csTabs({
            parent: 'tabbarInv',
            id: 'tabsInv',
            json: list.map((t) => ({
                id: t.id,
                tab: t.tab,
                icon: t.icon,
                count: counts[t.id],
                active: t.id === active,
                onClick: () => this.open(t.id)
            }))
        });

        // csTabs no dispara el onClick de la pestaña activa al crearse.
        if (active) this.open(active);
    }

    open(id) {
        const tab = this.tabsList().find((t) => t.id === id);

        if (!tab) return;

        try { localStorage.setItem(this.page.tabKey, id); } catch (e) { /* sin storage solo no se recuerda */ }

        const url = new URL(location.href);
        url.searchParams.set('tab', id);
        history.replaceState(null, '', url);

        if (this.opened[id]) return tab.reopen ? tab.reopen() : tab.render();

        this.opened[id] = true;
        tab.render();
    }

    can(action) {
        return (this.data.actions || []).includes(action);
    }

    get costs() {
        return this.can('ver-costos');
    }

    // -- Filtros compartidos --

    // El almacén solo se ofrece si la sucursal tiene más de uno.
    warehouseFilter(onchange) {
        const list = this.data.warehouses || [];

        if (list.length < 2) return [];

        return [{
            opc: 'select', id: 'warehouse_id', lbl: 'Almacén', required: false, class: 'col-12 col-lg-2',
            data: [{ id: '', valor: 'Todos' }, ...list], onchange
        }];
    }

    // Periodo del filtro: el mes en curso, con atajos.
    periodPicker(inputId, onSelect) {
        const server = moment(this.data.today, 'YYYY-MM-DD', true);
        const today  = server.isValid() ? server : moment();
        const ranges = {
            'Hoy':          [today.clone(), today.clone()],
            'Ayer':         [today.clone().subtract(1, 'days'), today.clone().subtract(1, 'days')],
            'Semana actual': [today.clone().startOf('isoWeek'), today.clone()],
            'Mes actual':   [today.clone().startOf('month'), today.clone()],
            'Mes anterior': [today.clone().subtract(1, 'months').startOf('month'), today.clone().subtract(1, 'months').endOf('month')]
        };

        dataPicker({
            parent: inputId,
            type: 'all',
            rangepicker: {
                startDate: ranges['Mes actual'][0],
                endDate: ranges['Mes actual'][1],
                maxDate: today.clone(),
                showDropdowns: true,
                autoApply: true,
                locale: {
                    format: 'DD/MM/YYYY',
                    separator: ' - ',
                    firstDay: 1,
                    customRangeLabel: 'Personalizado',
                    daysOfWeek: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
                    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                },
                ranges
            },
            onSelect
        });
    }

    periodData(inputId) {
        return $(`#${inputId}`).data('daterangepicker') ? getDataRangePicker(inputId) : {};
    }

    // Una línea de chips arriba de la tabla: «12 productos · 3 bajo mínimo · Valor $4,520.00».
    paintSummary(parent, chips) {
        $(`#${parent}`).html(chips.filter(Boolean).map((c) => `<span class="inv-chip${c.tone ? ' inv-chip--' + c.tone : ''}">${c.html}</span>`).join(''));
    }

    // Tabla flowbite de una pestaña (createTable con su barra de filtros).
    table({ parent, filterBar, id, data, right = [], center = [], success, pag = 15 }) {
        this.createTable({
            parent,
            idFilterBar: filterBar,
            data,
            coffeesoft: true,
            conf: { datatable: true, pag },
            attr: { id, theme: 'light', f_size: 12, design: 'flowbite', striped: true, right, center },
            success
        });
    }

    // -- Detalle de un documento --
    // info: [[etiqueta, html]], lines: filas para createCoffeeTable3,
    // top / extra: html antes de los datos (la ruta del traspaso) y después de la tabla (su historial).

    detail({ id, title, subtitle, icon, info, lines, right = [], center = [], save = null, action = null, warn = '', top = '', extra = '' }) {
        const cells = info
            .filter((i) => i && i[1] !== '' && i[1] != null)
            .map(([label, html]) => `<div class="inv-dato"><span>${esc(label)}</span><b>${html}</b></div>`)
            .join('');

        this.csModal({
            id,
            title,
            subtitle,
            lucideIcon: icon,
            width: 'max-w-5xl',
            saveText: save ? save.text : false,
            cancelText: 'Cerrar',
            action,
            onSave: (values, close) => save && save.onSave(close),
            body: `
                <div class="inv-detalle">
                    ${warn ? `<p class="inv-aviso">${warn}</p>` : ''}
                    ${top}
                    <div class="inv-datos">${cells}</div>
                    <div id="${id}Lines"></div>
                    ${extra}
                </div>
            `
        });

        this.createCoffeeTable3({
            parent: `${id}Lines`,
            id: `${id}Table`,
            theme: 'light',
            design: 'flowbite',
            f_size: 12,
            striped: true,
            data: { row: lines },
            right,
            center,
            emptyMessage: 'Sin renglones'
        });
    }

    // -- Cancelar con motivo y contraseña (la regla de Pedidos) --
    // key: false cuando no se mueve existencia (cerrar un traspaso que nadie recibió): solo el motivo.

    cancelDoc({ opc, id, folio, what, done, key = true, verb = 'Cancelar', saveText = 'Cancelar documento', subtitle = 'Queda en el historial como cancelada', ph = '¿Por qué se cancela?' }) {
        const json = [{ id: 'reason', lbl: 'Motivo', tipo: 'textarea', rows: 2, maxlength: 255, required: true, class: 'w-full', ph }];

        if (key) {
            json.push({
                id: 'keyField', tipo: 'html', class: 'w-full',
                html: `
                    <label for="invKey" class="block text-xs font-semibold text-gray-500 mb-1.5">Tu contraseña <span class="text-red-500">*</span></label>
                    <input id="invKey" type="password" autocomplete="current-password"
                        class="w-full text-sm text-gray-800 bg-[#fff] border-[1px] border-gray-300 rounded-lg px-[12px] py-2 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15">
                `
            });
        }

        this.csModal({
            id: 'modalCancelDoc',
            title: `${verb} ${what} ${folio || ''}`.trim(),
            subtitle,
            lucideIcon: 'ban',
            width: 'max-w-md',
            saveText,
            cancelText: 'Volver',
            json,
            onSave: (values, close) => {
                const reason = String(values.reason || '').trim();
                const pass   = key ? String($('#invKey').val() || '') : '';

                if (!reason)       return warnBox(`Escribe por qué se ${verb === 'Rechazar' ? 'rechaza' : 'cancela'}.`);
                if (key && !pass)  return warnBox('Escribe tu contraseña.');

                return saveFrom('modalCancelDoc', async () => {
                    const response = await useFetch({ url: this._link, data: key ? { opc, id, reason, key: pass } : { opc, id, reason } });

                    if (response && response.status == 200) {
                        close();
                        notify(response);
                        if (done) done(response);
                        return;
                    }

                    notify(response);

                    if (response && response.key) $('#invKey').val('').trigger('focus');
                });
            }
        });
    }
}

// -- Rejilla de captura (Entradas y Salidas) --
// La de Paquetes en Catálogo (cp-rej): arriba lo capturado, abajo la fila de
// captura (clave o nombre, cantidad, Enter). mode 'in' pide costo y, si el
// producto lleva lotes, lote y caducidad; 'out' enseña la existencia del almacén.

class InvGrid {

    constructor({ modal, mode, products, costs, warehouseId, date }) {
        this.modal       = modal;
        this.mode        = mode;
        this.products    = products || [];
        this.costs       = !!costs;
        this.warehouseId = warehouseId;
        this.date        = date;
        this.draft       = [];
    }

    get $m() {
        return $(`#${this.modal}`);
    }

    label(p) {
        return p.sku ? `${p.sku} · ${p.valor}` : String(p.valor);
    }

    // Exacto por «clave · nombre», clave o nombre; si no, el único que contenga el texto.
    find(text) {
        const t = String(text || '').trim().toUpperCase();

        if (!t) return null;

        const exact = this.products.find((p) =>
            this.label(p).toUpperCase() === t
            || String(p.sku || '').trim().toUpperCase() === t
            || String(p.valor).toUpperCase() === t
        );

        if (exact) return exact;

        const similar = this.products.filter((p) => this.label(p).toUpperCase().includes(t));

        return similar.length === 1 ? similar[0] : null;
    }

    have(p) {
        const stock = p.stock || {};
        return Number(stock[this.warehouseId()] || 0);
    }

    // Caducidad sugerida: la fecha de la entrada + vida útil del Catálogo.
    suggestExpiry(p) {
        if (!p.lots || !p.shelf) return '';

        const base = moment(this.date(), 'YYYY-MM-DD', true);

        return base.isValid() ? base.add(p.shelf, 'days').format('YYYY-MM-DD') : '';
    }

    columns() {
        const cols = [['Clave', 'cp-rej-clave'], ['Producto', '']];

        if (this.mode === 'out') cols.push(['Existencia', 'n']);

        cols.push(['Cantidad', 'n cp-rej-cant']);

        if (this.mode === 'in' && this.costs) cols.push(['Costo', 'n inv-rej-costo']);
        if (this.mode === 'out' && this.costs) cols.push(['Costo', 'n']);
        if (this.mode === 'in') cols.push(['Lote', 'inv-rej-lote'], ['Caducidad', 'inv-rej-cad']);
        if (this.costs) cols.push(['Importe', 'n']);

        cols.push(['', 'cp-rej-boton']);

        return cols;
    }

    html() {
        const cols    = this.columns();
        const options = this.products
            .map((p) => `<option value="${esc(this.label(p))}" label="${esc(p.unit)}"></option>`)
            .join('');
        const span    = cols.length;

        // La fila de captura: clave/nombre (2 columnas), cantidad, costo (entradas) y Agregar.
        const before = this.mode === 'out' ? '<td class="n" id="gridPickHave">—</td>' : '';
        const cost   = this.mode === 'in' && this.costs
            ? '<td class="ed"><input id="gridCost" class="n" type="number" min="0" step="0.01" placeholder="0.00" aria-label="Costo"></td>'
            : (this.mode === 'out' && this.costs ? '<td class="n" id="gridPickCost">—</td>' : '');
        const lots   = this.mode === 'in' ? '<td colspan="2" class="cp-rej-nota" id="gridPickLot"></td>' : '';
        const amount = this.costs ? '<td class="n" id="gridPickAmount">—</td>' : '';

        return `
            <label for="gridPick" class="block text-xs font-semibold text-gray-500 mb-1.5">
                Productos <span class="text-red-500">*</span>
            </label>
            <div class="cp-rej inv-rej">
                <table>
                    <thead><tr>${cols.map(([t, c]) => `<th class="${c}">${t}</th>`).join('')}</tr></thead>
                    <tbody id="gridRows"></tbody>
                    <tbody>
                        <tr class="nuevo">
                            <td class="ed" colspan="2">
                                <input id="gridPick" type="text" list="gridProducts" autocomplete="off" placeholder="Clave o nombre del producto">
                                <datalist id="gridProducts">${options}</datalist>
                            </td>
                            ${before}
                            <td class="ed"><input id="gridQty" class="n" type="number" min="0.001" step="0.001" value="1" aria-label="Cantidad"></td>
                            ${cost}
                            ${lots}
                            ${amount}
                            <td class="cp-rej-boton"><button type="button" class="cp-rej-agregar" title="Agregar (Enter)">Agregar</button></td>
                        </tr>
                    </tbody>
                    ${this.costs ? `<tfoot><tr><td colspan="${span - 2}" class="n">Total</td><td class="n" id="gridTotal">${money(0)}</td><td></td></tr></tfoot>` : ''}
                </table>
            </div>
            <p id="gridNote" class="cp-rej-nota"></p>
        `;
    }

    // El modal se recrea en cada apertura: estos handlers mueren con él.
    bind() {
        const m = this.$m;

        m.on('click', '.cp-rej-agregar', () => this.add());

        // Enter en la fila de captura agrega (como Soft); no guarda el modal.
        m.on('keydown', '#gridPick, #gridQty, #gridCost', (e) => {
            if (e.key !== 'Enter') return;

            e.preventDefault();
            this.add();
        });

        m.on('input', '#gridPick, #gridQty, #gridCost', () => this.paintPick());

        // Al elegir de la lista: costo sugerido y a la cantidad.
        m.on('change', '#gridPick', () => {
            const p = this.find(m.find('#gridPick').val());

            if (!p) return;

            if (this.mode === 'in' && this.costs && m.find('#gridCost').val() === '') m.find('#gridCost').val(p.cost || '');

            this.paintPick();
            m.find('#gridQty').trigger('focus').trigger('select');
        });

        m.on('input', '.inv-rej-campo', (e) => {
            const input = $(e.currentTarget);
            const item  = this.draft[Number(input.data('index'))];
            const field = input.data('field');

            if (!item) return;

            item[field] = field === 'quantity' || field === 'cost' ? (Number(input.val()) || 0) : String(input.val());

            if (field === 'quantity' || field === 'cost') {
                input.closest('tr').find('.cp-rej-importe').text(money(item.quantity * item.cost));
                this.paintTotal();
            }

            // «Solo hay N» se prende y se apaga al corregir la cantidad.
            if (field === 'quantity' && this.mode === 'out') {
                const p = this.products.find((x) => x.id === item.id) || {};
                input.closest('tr').find('.inv-rej-falta').toggleClass('hidden', !(item.quantity > this.have(p) + 0.00001));
            }
        });

        m.on('click', '.cp-rej-quitar', (e) => {
            this.draft.splice(Number($(e.currentTarget).data('index')), 1);
            this.paint();
        });

        this.paint();
        this.paintPick();
    }

    paintPick() {
        const m   = this.$m;
        const p   = this.find(m.find('#gridPick').val());
        const qty = Number(m.find('#gridQty').val()) || 0;

        if (this.mode === 'out') {
            m.find('#gridPickHave').text(p ? `${qtyText(this.have(p))} ${p.unit}` : '—');
            if (this.costs) m.find('#gridPickCost').text(p ? money(p.cost) : '—');
            if (this.costs) m.find('#gridPickAmount').text(p && qty > 0 ? money(p.cost * qty) : '—');
            return;
        }

        const cost = this.costs ? Number(m.find('#gridCost').val()) || 0 : 0;

        if (this.costs) m.find('#gridPickAmount').text(p && qty > 0 ? money(cost * qty) : '—');

        m.find('#gridPickLot').text(p ? (p.lots ? 'Lleva lote y caducidad: se piden en el renglón' : `Se cuenta en ${p.unit}`) : '');
    }

    // Devuelve false si algo falta (ya avisó).
    add() {
        const m    = this.$m;
        const warn = (text) => { warnBox(text); return false; };
        const text = String(m.find('#gridPick').val() || '').trim();
        const qty  = Math.round(Number(m.find('#gridQty').val()) * 1000) / 1000;

        if (!text) return warn('Escribe la clave o el nombre del producto.');

        const p = this.find(text);

        if (!p)          return warn(`No encontré un solo producto con «${text}». Elígelo de la lista.`);
        if (!(qty > 0))  return warn('La cantidad debe ser mayor a 0.');
        if (!p.decimals && Math.floor(qty) !== qty) return warn(`«${p.valor}» se cuenta en ${p.unit}: sin decimales.`);

        const cost = this.mode === 'in' && this.costs
            ? Number(m.find('#gridCost').val() === '' ? (p.cost || 0) : m.find('#gridCost').val())
            : Number(p.cost || 0);

        if (cost < 0) return warn('El costo no puede ser negativo.');

        // En salidas el mismo producto suma en su renglón; en entradas, con lote, puede repetirse.
        const current = this.draft.find((d) => d.id === p.id && (this.mode === 'out' || !p.lots));

        if (current) {
            current.quantity = Math.round((current.quantity + qty) * 1000) / 1000;
        } else {
            this.draft.push({
                id: p.id, sku: p.sku, name: p.valor, unit: p.unit, decimals: p.decimals, lots: p.lots,
                quantity: qty, cost, batch_code: '', expires_at: this.suggestExpiry(p)
            });
        }

        m.find('#gridPick').val('');
        m.find('#gridQty').val(1);
        m.find('#gridCost').val('');
        this.paint();
        this.paintPick();
        setTimeout(() => m.find('#gridPick').trigger('focus'), 20);

        return true;
    }

    paint() {
        const rows = this.$m.find('#gridRows');
        const span = this.columns().length;

        if (!this.draft.length) {
            rows.html(`<tr><td colspan="${span}" class="cp-rej-vacia">Sin productos. Escribe abajo la clave o el nombre y pulsa Enter.</td></tr>`);
            this.paintTotal();
            return;
        }

        rows.html(this.draft.map((d, i) => {
            const p     = this.products.find((x) => x.id === d.id) || {};
            const have  = this.mode === 'out' ? this.have(p) : 0;
            const short = this.mode === 'out' && d.quantity > have + 0.00001;
            const field = (name, type, value, extra = '') =>
                `<input type="${type}" class="inv-rej-campo${type === 'number' ? ' n' : ''}" data-index="${i}" data-field="${name}" value="${esc(value)}" ${extra}>`;

            let html = `
                <td class="cp-rej-clave">${esc(d.sku) || '—'}</td>
                <td>${esc(d.name)}${this.mode === 'out' ? ` <span class="cp-chip bg-red-50 text-red-700 inv-rej-falta${short ? '' : ' hidden'}">Solo hay ${qtyText(have)}</span>` : ''}</td>
            `;

            if (this.mode === 'out') html += `<td class="n">${qtyText(have)} ${esc(d.unit)}</td>`;

            html += `<td class="ed">${field('quantity', 'number', d.quantity, `min="0.001" step="${d.decimals ? '0.001' : '1'}" aria-label="Cantidad de ${esc(d.name)}"`)}</td>`;

            if (this.mode === 'in' && this.costs) html += `<td class="ed">${field('cost', 'number', d.cost, `min="0" step="0.01" aria-label="Costo de ${esc(d.name)}"`)}</td>`;
            if (this.mode === 'out' && this.costs) html += `<td class="n">${money(d.cost)}</td>`;

            if (this.mode === 'in') {
                html += d.lots
                    ? `<td class="ed">${field('batch_code', 'text', d.batch_code, 'maxlength="40" placeholder="Opcional" aria-label="Lote"')}</td>
                       <td class="ed">${field('expires_at', 'date', d.expires_at, 'aria-label="Caducidad"')}</td>`
                    : '<td class="cp-celda-sub">—</td><td class="cp-celda-sub">—</td>';
            }

            if (this.costs) html += `<td class="n cp-rej-importe">${money(d.quantity * d.cost)}</td>`;

            html += `<td class="cp-rej-boton"><button type="button" class="cp-rej-quitar" data-index="${i}" title="Quitar" aria-label="Quitar ${esc(d.name)}">&times;</button></td>`;

            return `<tr>${html}</tr>`;
        }).join(''));

        this.paintTotal();
    }

    paintTotal() {
        const total = this.draft.reduce((s, d) => s + d.quantity * d.cost, 0);
        const units = this.draft.reduce((s, d) => s + d.quantity, 0);

        this.$m.find('#gridTotal').text(money(total));
        this.$m.find('#gridNote').text(this.draft.length
            ? `${this.draft.length} ${this.draft.length === 1 ? 'producto' : 'productos'} · ${qtyText(units)} unidades`
            : '');
    }

    // Lo que viaja al ctrl, o un aviso si falta algo.
    lines() {
        if (!this.draft.length) return { error: 'Agrega al menos un producto.' };

        for (const d of this.draft) {
            if (!(d.quantity > 0)) return { error: `La cantidad de «${d.name}» debe ser mayor a 0.` };
            if (this.mode === 'in' && d.lots && !d.expires_at) return { error: `«${d.name}» lleva caducidad: escribe la fecha.` };
        }

        return {
            lines: this.draft.map((d) => this.mode === 'in'
                ? { product_id: d.id, quantity: d.quantity, cost: d.cost, batch_code: d.batch_code, expires_at: d.expires_at }
                : { product_id: d.id, quantity: d.quantity })
        };
    }

    // Repinta las existencias al cambiar de almacén (salidas).
    refresh() {
        this.paint();
        this.paintPick();
    }
}
