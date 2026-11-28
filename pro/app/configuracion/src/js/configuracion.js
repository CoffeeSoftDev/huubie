/*  Configuración de la empresa: lo que su dueño administra por su cuenta.

    Una pagina con pestañas, cada una con su ancla (#sucursales) para poder
    llegar directo desde el inicio o la barra:

      Empresa        nombre, logo y datos fiscales
      Sucursales     agregar, renombrar, activar y desactivar
      Usuarios       su gente: a que sucursal entra cada quien y con que rol
      Roles          los roles propios y lo que deja hacer cada uno
      Plan y pagos   el plan, pagar, la forma de pago y el historial
      Mi inicio      que tarjetas ve el dueño al entrar y donde, arrastrandolas

    Cada pestaña pide lo suyo al abrirse (ctrl-configuracion) y se vuelve a
    pedir despues de cada cambio: la lista en pantalla siempre es la del
    servidor. Los formularios de alta y edicion van en un modal (cfgModal). */
const CFG_API = 'ctrl/ctrl-configuracion.php';

const CFG_TABS = [
    { id: 'empresa',    icon: 'building-2',   label: 'Empresa' },
    { id: 'sucursales', icon: 'store',        label: 'Sucursales' },
    { id: 'usuarios',   icon: 'users',        label: 'Usuarios' },
    { id: 'roles',      icon: 'shield-check', label: 'Roles y permisos' },
    { id: 'pagos',      icon: 'credit-card',  label: 'Plan y pagos' },
    { id: 'inicio',     icon: 'layout-dashboard', label: 'Mi inicio' }
];

const CFG_PAGOS   = { paid: ['Pagado', 'is-ok'], pending: ['Pendiente', 'is-warn'], failed: ['Rechazado', 'is-bad'], refunded: ['Reembolsado', 'is-off'] };
const CFG_PLAN    = { active: ['Activo', 'is-ok'], trial: ['En prueba', 'is-ok'], past_due: ['Pago vencido', 'is-warn'], cancelled: ['Cancelado', 'is-off'], expired: ['Expirado', 'is-off'] };
const CFG_CICLOS  = { monthly: 'al mes', yearly: 'al año', lifetime: 'pago único' };
const CFG_METODOS = { stripe: 'Tarjeta (Stripe)', mercadopago: 'Tarjeta (Mercado Pago)', manual: 'Registro manual', transfer: 'Transferencia', cash: 'Efectivo' };

// Lo que contesto init (la empresa, los catalogos) y lo ultimo de cada pestaña.
// userBranch: la sucursal del filtro de Usuarios ('' = todas); sobrevive al refrescar.
// home: el editor de Mi inicio (cfgInicio); sobrevive al cambiar de pestaña.
// Roles guarda lo suyo en cfgRl (mas abajo).
const cfg = { base: null, data: {}, userBranch: '', home: null };

$(async () => {
    const root = document.getElementById('root');

    root.innerHTML = '<div class="pg-skel"></div><div class="pg-skel"></div>';

    const res = await Page.post(CFG_API, { opc: 'init' });

    if (res.status !== 200) {
        root.innerHTML = `<div class="pg-card"><div class="pg-empty"><i data-lucide="cloud-off"></i>${Page.esc(res.message || 'No se pudo cargar la configuración.')}</div></div>`;
        Page.icons();
        return;
    }

    cfg.base = res.data;

    root.innerHTML = `
        <div class="pg-head">
            <div>
                <h1 class="pg-h1">Configuración</h1>
                <p class="pg-sub" id="cfgSub">${Page.esc(cfg.base.company.name)} · todo lo de tu empresa en un solo lugar</p>
            </div>
        </div>
        <nav class="pg-tabs" role="tablist" aria-label="Secciones de configuración">
            ${CFG_TABS.map((t) => `<a class="pg-tab" role="tab" href="#${t.id}" data-tab="${t.id}"><i data-lucide="${t.icon}"></i><span>${t.label}</span></a>`).join('')}
        </nav>
        <div id="cfgPanel" role="tabpanel"></div>`;

    Page.icons();

    window.addEventListener('hashchange', cfgRoute);

    // Cerrar o recargar con permisos sin guardar: el navegador pregunta.
    window.addEventListener('beforeunload', (e) => {
        if (!cfgRlDirty()) return;
        e.preventDefault();
        e.returnValue = '';
    });

    cfgRoute();
});

// -- Pestañas --

function cfgTab() {
    const id = window.location.hash.replace('#', '');
    return CFG_TABS.some((t) => t.id === id) ? id : 'empresa';
}

async function cfgRoute() {
    const tab = cfgTab();

    // Salir de Roles con cambios sin guardar se pregunta; si se queda, vuelve a #roles.
    if (tab !== 'roles' && cfgRlDirty()) {
        if (!(await cfgRlLeave())) {
            history.replaceState(null, '', '#roles');
            return;
        }
        cfgRl.role = null;
    }

    document.querySelectorAll('.pg-tab').forEach((el) => {
        const on = el.dataset.tab === tab;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    ({ empresa: cfgEmpresa, sucursales: cfgSucursales, usuarios: cfgUsuarios, roles: cfgRoles, pagos: cfgPagos, inicio: cfgInicio })[tab]();
}

function cfgPanel(html) {
    document.getElementById('cfgPanel').innerHTML = html;
    Page.icons();
}

function cfgLoading() {
    cfgPanel('<div class="pg-skel"></div>');
}

function cfgFail(res) {
    cfgPanel(`<div class="pg-card"><div class="pg-empty"><i data-lucide="cloud-off"></i>${Page.esc(res.message || 'No se pudo cargar. Inténtalo de nuevo.')}</div></div>`);
}

// Pide una pestaña. Si mientras tanto se cambio a otra, la respuesta se tira.
async function cfgLoad(tab, opc) {
    if (!cfg.data[tab]) cfgLoading();

    const res = await Page.post(CFG_API, { opc: opc });

    if (cfgTab() !== tab) return null;
    if (res.status !== 200) { cfgFail(res); return null; }

    cfg.data[tab] = res.data;
    return res.data;
}

// -- Piezas comunes --

function cfgToast(message, ok) {
    let el = document.getElementById('cfgToast');

    if (!el) {
        el = document.createElement('div');
        el.id = 'cfgToast';
        el.className = 'pg-toast';
        el.setAttribute('role', 'status');
        document.body.appendChild(el);
    }

    el.className = 'pg-toast ' + (ok ? 'is-ok' : 'is-err');
    el.innerHTML = `<i data-lucide="${ok ? 'circle-check' : 'circle-alert'}"></i><span>${Page.esc(message)}</span>`;
    Page.icons();

    // Reinicia la animacion aunque ya hubiera uno en pantalla.
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');

    clearTimeout(cfgToast.timer);
    cfgToast.timer = setTimeout(() => el.classList.remove('is-on'), ok ? 2600 : 5200);
}

// "¿Seguro?" antes de apagar algo. Con SweetAlert vestido como la pagina.
async function cfgAsk(title, text, confirm) {
    if (typeof Swal === 'undefined') return window.confirm(title + '\n\n' + text);

    const dark = document.body.classList.contains('dark-mode');

    const result = await Swal.fire({
        title: title, text: text, icon: 'question',
        showCancelButton: true, confirmButtonText: confirm, cancelButtonText: 'Cancelar', reverseButtons: true,
        confirmButtonColor: getComputedStyle(document.documentElement).getPropertyValue('--primary-rgb') ? `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--primary-rgb')})` : '#5030A5',
        cancelButtonColor: '#9CA3AF',
        background: dark ? '#1F2A37' : '#FFFFFF', color: dark ? '#F9FAFB' : '#1D1B31',
        heightAuto: false, scrollbarPadding: false
    });

    return result.isConfirmed;
}

function cfgUsage(icon, label, limit) {
    // Sin tope en el plan: solo cuantas hay ("4 activas"); con tope, "3 de 5 activas".
    const max  = limit.max === null ? '' : ` de ${limit.max}`;
    const full = limit.max !== null && limit.used >= limit.max;

    return `<span class="pg-chip ${full ? 'is-warn' : ''}"><i data-lucide="${icon}"></i>${limit.used}${max} ${label}</span>`;
}

function cfgSwitch(on, attrs, label) {
    return `<button type="button" class="pg-switch ${on ? 'is-on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="${Page.esc(label)}" title="${Page.esc(label)}" ${attrs}><span></span></button>`;
}

function cfgField(id, label, value, attrs, cls) {
    return `
        <div class="pg-field ${cls || ''}">
            <label class="pg-label" for="${id}">${label}</label>
            <input class="pg-input" id="${id}" name="${id}" value="${Page.esc(value || '')}" ${attrs || ''}>
        </div>`;
}

// Contraseña con el ojo para verla mientras se escribe (cfgEyes lo enciende).
function cfgPassField(id, label, attrs, cls) {
    return `
        <div class="pg-field ${cls || ''}">
            <label class="pg-label" for="${id}">${label}</label>
            <div class="pg-pass">
                <input class="pg-input" id="${id}" name="${id}" type="password" ${attrs || ''}>
                <button type="button" class="pg-pass-eye" data-eye="${id}" title="Ver contraseña" aria-label="Ver contraseña"><i data-lucide="eye"></i></button>
            </div>
        </div>`;
}

function cfgEyes(form) {
    form.querySelectorAll('[data-eye]').forEach((eye) => eye.addEventListener('click', () => {
        const input = form.querySelector('#' + eye.dataset.eye);
        const show  = input.type === 'password';
        const label = show ? 'Ocultar contraseña' : 'Ver contraseña';

        input.type      = show ? 'text' : 'password';
        eye.innerHTML   = `<i data-lucide="${show ? 'eye-off' : 'eye'}"></i>`;
        eye.title       = label;
        eye.setAttribute('aria-label', label);
        Page.icons();
    }));
}

/*  Modal con un formulario. onSubmit(datos, form) devuelve la respuesta del
    servidor: con 200 se cierra; si no, enseña el mensaje y enfoca el campo
    que el servidor señalo (res.field). Sin onSubmit es solo de consulta. */
function cfgModal(o) {
    const wrap = document.createElement('div');

    wrap.className = 'pg-modal';
    wrap.innerHTML = `
        <div class="pg-modal-bg" data-close></div>
        <form class="pg-modal-box ${o.xl ? 'is-xl' : (o.wide ? 'is-wide' : '')}" role="dialog" aria-modal="true" aria-labelledby="cfgModalTitle" novalidate>
            <header class="pg-modal-head">
                <div>
                    <h2 class="pg-modal-title" id="cfgModalTitle">${Page.esc(o.title)}</h2>
                    ${o.sub ? `<p class="pg-modal-sub">${Page.esc(o.sub)}</p>` : ''}
                </div>
                <button type="button" class="pg-btn is-ghost is-round" data-close aria-label="Cerrar"><i data-lucide="x"></i></button>
            </header>
            <div class="pg-modal-body">${o.body}</div>
            <footer class="pg-modal-foot">
                <p class="pg-msg is-err" id="cfgModalMsg" role="alert" hidden></p>
                <button type="button" class="pg-btn is-ghost" data-close>${o.onSubmit ? 'Cancelar' : 'Cerrar'}</button>
                ${o.onSubmit ? `<button type="submit" class="pg-btn is-primary"><i data-lucide="check"></i>${Page.esc(o.submit || 'Guardar')}</button>` : ''}
            </footer>
        </form>`;

    document.body.appendChild(wrap);
    document.body.classList.add('pg-modal-open');
    Page.icons();

    const form  = wrap.querySelector('form');
    const msg   = wrap.querySelector('#cfgModalMsg');
    const close = () => {
        wrap.remove();
        document.removeEventListener('keydown', onKey);
        if (!document.querySelector('.pg-modal')) document.body.classList.remove('pg-modal-open');
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };

    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!o.onSubmit) return;

        const btn = form.querySelector('button[type="submit"]');

        btn.disabled = true;
        msg.hidden   = true;

        const res = await o.onSubmit(Object.fromEntries(new FormData(form).entries()), form);

        btn.disabled = false;

        if (res && res.status === 200) return close();

        msg.hidden      = false;
        msg.textContent = (res && res.message) || 'Ocurrió un error. Inténtalo de nuevo.';

        const bad = res && res.field && form.querySelector(`[name="${res.field}"]`);
        if (bad) bad.focus();
    });

    if (o.onOpen) o.onOpen(form);

    const first = form.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled])');
    if (first) first.focus();

    return close;
}

// ================================================================= Empresa

function cfgEmpresa() {
    const c = cfg.base.company;

    const fiscales = cfg.base.fiscal ? `
        <div class="pg-field is-wide pg-form-sep">
            <p class="pg-card-title"><span class="pg-ico"><i data-lucide="file-text"></i></span>Datos fiscales</p>
            <p class="pg-dim pg-small">Los que van en tus facturas. Puedes dejarlos para después.</p>
        </div>
        ${cfgField('legal_name', 'Razón social', c.legal_name, 'maxlength="160" placeholder="Como aparece en tu constancia fiscal"', 'is-wide')}
        ${cfgField('rfc', 'RFC', c.rfc, 'maxlength="13" autocapitalize="characters" style="text-transform:uppercase" placeholder="12 o 13 caracteres"')}
        ${cfgField('zip_code', 'Código postal fiscal', c.zip_code, 'maxlength="5" inputmode="numeric" placeholder="5 números"')}
        <div class="pg-field is-wide">
            <label class="pg-label" for="tax_regime">Régimen fiscal</label>
            <select class="pg-input" id="tax_regime" name="tax_regime">
                <option value="">Sin elegir</option>
                ${cfg.base.regimes.map((r) => `<option value="${r.id}" ${r.id === c.tax_regime ? 'selected' : ''}>${r.id} · ${Page.esc(r.name)}</option>`).join('')}
            </select>
        </div>` : cfgField('rfc', 'RFC (opcional)', c.rfc, 'maxlength="13" autocapitalize="characters" style="text-transform:uppercase"');

    const contacto = cfg.base.fiscal ? `
        ${cfgField('phone', 'Teléfono', c.phone, 'type="tel" maxlength="20" autocomplete="tel"')}
        ${cfgField('email', 'Correo de contacto', c.email, 'type="email" maxlength="120" autocomplete="email" placeholder="A donde te escriben tus clientes"')}` : '';

    cfgPanel(`
        <div class="pg-grid is-even">
            <div class="pg-col">
                <div class="pg-card">
                    <div class="pg-card-head"><p class="pg-card-title">Logo</p></div>
                    <div class="pg-logo" id="cfgLogo">${cfgLogoInner(c)}</div>
                    <p class="pg-dim pg-small" style="margin-top:12px !important">JPG, PNG o WebP de hasta 2 MB. Se ve mejor cuadrado.</p>
                    <div class="pg-logo-actions">
                        <label class="pg-btn is-ghost" for="cfgLogoFile"><i data-lucide="upload"></i>${c.logo ? 'Cambiar' : 'Subir logo'}</label>
                        <input type="file" id="cfgLogoFile" accept="image/jpeg,image/png,image/webp" hidden>
                        ${c.logo ? '<button type="button" class="pg-btn is-ghost" id="cfgLogoDrop"><i data-lucide="trash-2"></i>Quitar</button>' : ''}
                    </div>
                </div>
            </div>
            <div class="pg-col">
                <div class="pg-card">
                    <form class="pg-form" id="formEmpresa" novalidate>
                        <div class="pg-field is-wide">
                            <p class="pg-card-title"><span class="pg-ico"><i data-lucide="building-2"></i></span>Datos generales</p>
                        </div>
                        ${cfgField('name', 'Nombre de la empresa', c.name, 'maxlength="120" autocomplete="organization" required', 'is-wide')}
                        ${contacto}
                        ${cfgField('ubication', 'Dirección', c.ubication, 'maxlength="255" autocomplete="street-address"', 'is-wide')}
                        ${fiscales}
                        <div class="pg-form-foot">
                            <p class="pg-msg is-err" id="empresaMsg" role="alert" hidden></p>
                            <button type="submit" class="pg-btn is-primary"><i data-lucide="check"></i>Guardar cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`);

    document.getElementById('formEmpresa').addEventListener('submit', cfgSaveEmpresa);
    document.getElementById('cfgLogoFile').addEventListener('change', cfgSaveLogo);

    const drop = document.getElementById('cfgLogoDrop');
    if (drop) drop.addEventListener('click', cfgDropLogo);
}

function cfgLogoInner(c) {
    return c.logo
        ? `<img src="${Page.esc(c.logo)}" alt="Logo de ${Page.esc(c.name)}">`
        : `<span>${Page.esc(Page.initials(c.name))}</span>`;
}

async function cfgSaveEmpresa(e) {
    e.preventDefault();

    const form = e.currentTarget;
    const btn  = form.querySelector('button[type="submit"]');
    const msg  = document.getElementById('empresaMsg');

    btn.disabled = true;
    msg.hidden   = true;

    const data = Object.fromEntries(new FormData(form).entries());
    const res  = await Page.post(CFG_API, { opc: 'saveCompany', ...data });

    btn.disabled = false;

    if (res.status !== 200) {
        msg.hidden      = false;
        msg.textContent = res.message || 'Ocurrió un error.';

        const bad = res.field && document.getElementById(res.field);
        if (bad) bad.focus();
        return;
    }

    Object.assign(cfg.base.company, data, { rfc: String(data.rfc || '').toUpperCase() });

    // El nombre tambien esta en el encabezado y en la barra.
    document.getElementById('cfgSub').textContent = `${data.name} · todo lo de tu empresa en un solo lugar`;

    const nav = document.getElementById('navCompany');
    if (nav) nav.textContent = data.name;

    cfgToast(res.message, true);
}

async function cfgSaveLogo(e) {
    const file = e.target.files[0];
    if (!file) return;

    const body = new FormData();
    body.append('opc', 'saveLogo');
    body.append('logo', file);

    const res = await Page.post(CFG_API, body);

    if (res.status !== 200) {
        e.target.value = '';
        return cfgToast(res.message || 'No se pudo subir el logo.', false);
    }

    cfg.base.company.logo = res.data.logo;
    cfgEmpresa();
    cfgToast(res.message, true);
}

async function cfgDropLogo() {
    if (!await cfgAsk('¿Quitar el logo?', 'Tu empresa se verá con sus iniciales.', 'Sí, quitarlo')) return;

    const res = await Page.post(CFG_API, { opc: 'removeLogo' });

    if (res.status !== 200) return cfgToast(res.message || 'No se pudo quitar el logo.', false);

    cfg.base.company.logo = '';
    cfgEmpresa();
    cfgToast(res.message, true);
}

// ============================================================== Sucursales

async function cfgSucursales() {
    const d = await cfgLoad('sucursales', 'branches');
    if (!d) return;

    const rows = d.branches.map((b) => `
        <tr class="${b.active ? '' : 'is-off'}">
            <td>
                <div class="pg-row">
                    <span class="pg-ico"><i data-lucide="store"></i></span>
                    <div class="pg-row-text">
                        <p class="pg-strong pg-ellipsis">${Page.esc(b.name)}${b.current ? ' <span class="pg-chip is-mini">Estás aquí</span>' : ''}</p>
                        <p class="pg-dim pg-small pg-ellipsis">${Page.esc(b.ubication || 'Sin dirección')}</p>
                    </div>
                </div>
            </td>
            <td class="pg-td-num" data-label="Personas">${b.users}</td>
            <td class="pg-td-center" data-label="Estado"><span class="pg-chip ${b.active ? 'is-ok' : 'is-off'}">${b.active ? 'Activa' : 'Inactiva'}</span></td>
            <td class="pg-td-actions">
                <button type="button" class="pg-btn is-ghost is-round" data-edit="${b.id}" title="Editar" aria-label="Editar ${Page.esc(b.name)}"><i data-lucide="pencil"></i></button>
                ${cfgSwitch(b.active, `data-toggle="${b.id}"`, b.active ? 'Desactivar' : 'Activar')}
            </td>
        </tr>`).join('');

    cfgPanel(`
        <div class="pg-card">
            <div class="pg-card-head pg-toolbar">
                <div>
                    <p class="pg-card-title">Sucursales</p>
                    <p class="pg-dim pg-small">Cada sucursal lleva sus propios pedidos, cortes y accesos.</p>
                </div>
                <div class="pg-toolbar-side">
                    ${cfgUsage('store', 'activas', d.limits.branches)}
                    <button type="button" class="pg-btn is-primary" id="btnAddBranch"><i data-lucide="plus"></i>Agregar sucursal</button>
                </div>
            </div>
            <div class="pg-table-wrap">
                <table class="pg-table">
                    <thead><tr><th>Sucursal</th><th class="pg-td-num">Personas</th><th class="pg-td-center">Estado</th><th></th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`);

    const panel = document.getElementById('cfgPanel');

    document.getElementById('btnAddBranch').addEventListener('click', () => cfgBranchForm(null));

    panel.querySelectorAll('[data-edit]').forEach((el) => el.addEventListener('click', () => {
        cfgBranchForm(d.branches.find((b) => b.id === Number(el.dataset.edit)));
    }));

    panel.querySelectorAll('[data-toggle]').forEach((el) => el.addEventListener('click', async () => {
        const b = d.branches.find((x) => x.id === Number(el.dataset.toggle));

        if (b.active && !await cfgAsk(`¿Desactivar ${b.name}?`, 'Nadie podrá entrar a esta sucursal hasta que la actives de nuevo. Su información se conserva.', 'Sí, desactivar')) return;

        const res = await Page.post(CFG_API, { opc: 'toggleBranch', id: b.id, active: b.active ? 0 : 1 });

        cfgToast(res.message || 'No se pudo cambiar el estado.', res.status === 200);
        if (res.status === 200) cfgRefresh('sucursales', cfgSucursales);
    }));
}

// Lo que cambia una pestaña puede cambiar lo que enseñan las otras: se olvidan todas.
function cfgRefresh(tab, render) {
    cfg.data = { [tab]: cfg.data[tab] };
    render();
}

function cfgBranchForm(b) {
    cfgModal({
        title:  b ? 'Editar sucursal' : 'Nueva sucursal',
        sub:    b ? '' : 'Después dale acceso a tu gente en Usuarios.',
        submit: b ? 'Guardar' : 'Agregar sucursal',
        body: `
            <div class="pg-form is-one">
                ${cfgField('name', 'Nombre', b ? b.name : '', 'maxlength="120" required placeholder="Ej. Centro"')}
                ${cfgField('ubication', 'Dirección', b ? b.ubication : '', 'maxlength="255" placeholder="Calle, número, colonia"')}
            </div>`,
        onSubmit: async (data) => {
            const res = await Page.post(CFG_API, { opc: 'saveBranch', id: b ? b.id : 0, ...data });

            if (res.status === 200) {
                cfgToast(res.message, true);
                cfgRefresh('sucursales', cfgSucursales);
            }

            return res;
        }
    });
}

// ================================================================ Usuarios

async function cfgUsuarios() {
    const d = await cfgLoad('usuarios', 'users');
    if (!d) return;

    // Si la sucursal del filtro ya no viene en la lista, se vuelve a «Todas».
    if (!d.branches.some((b) => String(b.id) === cfg.userBranch)) cfg.userBranch = '';

    const branchOptions = d.branches.map((b) => `
        <option value="${b.id}" ${String(b.id) === cfg.userBranch ? 'selected' : ''}>${Page.esc(b.name)}${b.active ? '' : ' (inactiva)'}</option>`).join('');

    cfgPanel(`
        <div class="pg-card">
            <div class="pg-card-head pg-toolbar">
                <div>
                    <p class="pg-card-title">Usuarios</p>
                    <p class="pg-dim pg-small">Quién entra a Huubie, a qué sucursal y con qué rol.</p>
                </div>
                <div class="pg-toolbar-side">
                    <select class="pg-input" id="cfgUserBranch" aria-label="Filtrar por sucursal">
                        <option value="">Todas las sucursales</option>
                        ${branchOptions}
                    </select>
                    ${cfgUsage('users', 'activos', d.limits.users)}
                    <button type="button" class="pg-btn is-primary" id="btnAddUser"><i data-lucide="user-plus"></i>Agregar usuario</button>
                </div>
            </div>
            <div class="pg-table-wrap">
                <table class="pg-table" id="cfgUsersTable">
                    <thead><tr><th>Persona</th><th>Accesos</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead>
                    <tbody id="cfgUsersBody">${cfgUserRows(d)}</tbody>
                </table>
            </div>
        </div>`);

    document.getElementById('btnAddUser').addEventListener('click', () => cfgUserForm(null, d));

    // Cambiar de sucursal solo vuelve a pintar las filas: los datos ya estan aqui.
    document.getElementById('cfgUserBranch').addEventListener('change', (e) => {
        cfg.userBranch = e.target.value;
        document.getElementById('cfgUsersBody').innerHTML = cfgUserRows(d);
        Page.icons();
    });

    // Un solo escucha en la tabla: sigue sirviendo aunque las filas se repinten.
    document.getElementById('cfgUsersTable').addEventListener('click', async (e) => {
        const edit = e.target.closest('[data-edit]');
        if (edit) return cfgUserForm(d.users.find((u) => u.id === Number(edit.dataset.edit)), d);

        const toggle = e.target.closest('[data-toggle]');
        if (!toggle) return;

        const u      = d.users.find((x) => x.id === Number(toggle.dataset.toggle));
        const active = u.status === 'active';

        if (active && !await cfgAsk(`¿Desactivar a ${u.name}?`, 'Ya no podrá entrar a Huubie. Su historial se conserva y puedes activarlo cuando quieras.', 'Sí, desactivar')) return;

        const res = await Page.post(CFG_API, { opc: 'toggleUser', id: u.id, active: active ? 0 : 1 });

        cfgToast(res.message || 'No se pudo cambiar el estado.', res.status === 200);
        if (res.status === 200) cfgRefresh('usuarios', cfgUsuarios);
    });
}

// Las filas de la tabla, solo de la sucursal del filtro. El dueño entra a todas: sale en cualquiera.
function cfgUserRows(d) {
    const branch = Number(cfg.userBranch);
    const users  = branch ? d.users.filter((u) => u.owner || u.access.some((a) => a.branch_id === branch)) : d.users;

    if (!users.length) {
        return '<tr><td colspan="5"><div class="pg-empty"><i data-lucide="users"></i>Nadie entra a esta sucursal todavía.</div></td></tr>';
    }

    return users.map((u) => {
        const active = u.status === 'active';
        const full   = `${u.name} ${u.last_name}`.trim();

        const access = u.owner
            ? '<span class="pg-chip is-mini"><i data-lucide="crown"></i>Todas las sucursales</span>'
            : (u.access.map((a) => `<span class="pg-chip is-mini is-off">${Page.esc(a.branch)} · ${Page.esc(a.role || 'Sin rol')}</span>`).join('') || '<span class="pg-dim pg-small">Sin acceso</span>');

        // A si mismo y a otro dueño no se les ofrece el interruptor.
        const toggle = u.me || u.owner ? '' : cfgSwitch(active, `data-toggle="${u.id}"`, active ? 'Desactivar' : 'Activar');

        return `
            <tr class="${active ? '' : 'is-off'}">
                <td>
                    <div class="pg-row">
                        ${Page.avatar({ name: full, photo: u.photo, color: u.color })}
                        <div class="pg-row-text">
                            <p class="pg-strong pg-ellipsis">${Page.esc(full)}${u.me ? ' <span class="pg-chip is-mini">Tú</span>' : ''}${u.owner ? ' <span class="pg-chip is-mini is-ok">Dueño</span>' : ''}</p>
                            <p class="pg-dim pg-small pg-ellipsis">${Page.esc(u.email)}</p>
                        </div>
                    </div>
                </td>
                <td data-label="Accesos"><div class="pg-chips">${access}</div></td>
                <td data-label="Estado"><span class="pg-chip ${active ? 'is-ok' : (u.status === 'pending' ? 'is-warn' : 'is-off')}">${active ? 'Activo' : (u.status === 'pending' ? 'Pendiente' : 'Inactivo')}</span></td>
                <td data-label="Último ingreso" class="pg-dim pg-small">${u.last_login ? Page.esc(Page.date(u.last_login)) : 'Nunca'}</td>
                <td class="pg-td-actions">
                    <button type="button" class="pg-btn is-ghost is-round" data-edit="${u.id}" title="Editar" aria-label="Editar a ${Page.esc(full)}"><i data-lucide="pencil"></i></button>
                    ${toggle}
                </td>
            </tr>`;
    }).join('');
}

// La foto que se eligio en el formulario: se valida aqui y se sube al guardar.
const CFG_PHOTO_MAX   = 2097152;   // 2 MB, igual que Mi perfil
const CFG_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function cfgUserForm(u, d) {
    const color = u && /^#[0-9A-Fa-f]{6}$/.test(u.color || '') ? u.color.toUpperCase() : '';
    const full  = u ? `${u.name} ${u.last_name}`.trim() : '';

    // Un color que no es de la paleta se ve en el circulo de "personalizado".
    const custom = color !== '' && !cfg.base.colors.includes(color);

    let photo = null;

    // Una fila por sucursal: el rol con el que entra, o "Sin acceso". Las
    // inactivas solo salen si la persona ya tenia acceso a ellas.
    const accessRows = d.branches
        .filter((b) => b.active || (u && u.access.some((a) => a.branch_id === b.id)))
        .map((b) => {
            const mine = u ? u.access.find((a) => a.branch_id === b.id) : null;

            return `
                <div class="pg-access-row">
                    <span class="pg-strong pg-ellipsis"><i data-lucide="store"></i>${Page.esc(b.name)}${b.active ? '' : ' <span class="pg-dim pg-small">(inactiva)</span>'}</span>
                    <select class="pg-input" data-branch="${b.id}" aria-label="Rol en ${Page.esc(b.name)}">
                        <option value="">Sin acceso</option>
                        ${d.roles.map((r) => `<option value="${r.id}" ${mine && mine.role_id === r.id ? 'selected' : ''}>${Page.esc(r.name)}</option>`).join('')}
                    </select>
                </div>`;
        }).join('');

    const owner = u && u.owner;

    cfgModal({
        title:  u ? 'Editar usuario' : 'Nuevo usuario',
        sub:    u ? u.email : 'Entrará con su correo y la contraseña que le pongas.',
        submit: u ? 'Guardar' : 'Agregar usuario',
        wide:   true,
        body: `
            <div class="pg-form">
                ${cfgField('name', 'Nombre', u ? u.name : '', 'maxlength="80" autocomplete="off" required')}
                ${cfgField('last_name', 'Apellidos', u ? u.last_name : '', 'maxlength="80" autocomplete="off"')}
                ${cfgField('email', 'Correo', u ? u.email : '', 'type="email" maxlength="120" autocomplete="off" required placeholder="nombre@empresa.com"', u ? '' : 'is-wide')}
                ${cfgPassField('password', u ? 'Nueva contraseña' : 'Contraseña', `maxlength="72" autocomplete="new-password" placeholder="${u ? 'Déjala vacía para no cambiarla' : 'Mínimo 8 caracteres'}"`)}
                ${u ? '' : cfgPassField('password_confirmation', 'Repite la contraseña', 'maxlength="72" autocomplete="new-password" placeholder="Escríbela otra vez"')}
                <div class="pg-field is-wide">
                    <span class="pg-label">Foto</span>
                    <div class="pg-row">
                        <span id="cfgUserAvatar">${Page.avatar({ name: full || '?', photo: u ? u.photo : '', color: color }, 'lg')}</span>
                        <label class="pg-btn is-ghost" for="cfgUserPhoto"><i data-lucide="camera"></i>${u && u.photo ? 'Cambiar foto' : 'Subir foto'}</label>
                        <input type="file" id="cfgUserPhoto" accept="image/jpeg,image/png,image/webp" hidden>
                        <span class="pg-dim pg-small">JPG, PNG o WebP de hasta 2 MB.</span>
                    </div>
                </div>
                <div class="pg-field is-wide">
                    <span class="pg-label">Color de su avatar</span>
                    <div class="pg-swatches" id="cfgColors">
                        ${cfg.base.colors.map((c) => `<button type="button" class="pg-swatch ${c === color ? 'is-on' : ''}" data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}
                        <span class="pg-swatch is-custom ${custom ? 'is-on' : ''}" title="Color personalizado">
                            <i data-lucide="pipette"></i>
                            <input type="color" id="cfgColorCustom" value="${custom ? color : cfg.base.colors[0]}" aria-label="Color personalizado">
                        </span>
                    </div>
                    <input type="hidden" name="color" value="${Page.esc(color)}">
                </div>
                <div class="pg-field is-wide pg-form-sep">
                    <p class="pg-card-title"><span class="pg-ico"><i data-lucide="key-round"></i></span>Accesos</p>
                    <p class="pg-dim pg-small">${owner ? 'Es dueño de la empresa: entra a todas las sucursales con acceso total.' : 'Elige el rol con el que entra a cada sucursal.'}</p>
                </div>
                ${owner ? '' : `<div class="pg-field is-wide pg-access" data-name="access">${accessRows}</div>`}
            </div>`,
        onOpen: (form) => {
            cfgEyes(form);

            // El avatar de muestra: la foto que se ve (la guardada o la recien
            // elegida) o, sin foto, las iniciales sobre el color marcado.
            let shown = u ? u.photo : '';

            const paint = () => {
                form.querySelector('#cfgUserAvatar').innerHTML = Page.avatar({ name: full || '?', photo: shown, color: form.querySelector('[name="color"]').value }, 'lg');
            };

            // La foto no se sube al elegirla: se ve aqui y viaja al guardar (Cancelar la descarta).
            const pick = form.querySelector('#cfgUserPhoto');

            pick.addEventListener('change', () => {
                const file = pick.files[0];
                if (!file) return;

                pick.value = '';

                if (!CFG_PHOTO_TYPES.includes(file.type)) return cfgToast('Sube una imagen JPG, PNG o WebP.', false);
                if (file.size > CFG_PHOTO_MAX)           return cfgToast('La foto pesa más de 2 MB.', false);

                photo = file;
                shown = URL.createObjectURL(file);
                paint();
            });

            // Marcar un color lo pinta en el avatar de muestra al momento.
            const pickColor = (swatch, hex) => {
                form.querySelectorAll('.pg-swatch').forEach((el) => el.classList.toggle('is-on', el === swatch));
                form.querySelector('[name="color"]').value = hex;
                paint();
            };

            form.querySelector('#cfgColors').addEventListener('click', (e) => {
                const swatch = e.target.closest('.pg-swatch[data-color]');
                if (swatch) pickColor(swatch, swatch.dataset.color);
            });

            // El personalizado: el selector de color del navegador. Al volver a
            // pulsarlo, el que ya se habia elegido queda marcado otra vez.
            const picker = form.querySelector('#cfgColorCustom');
            const own    = picker.parentElement;

            // El gotero toma la letra que se lee sobre ese color (oscura en un pastel).
            const paintOwn = (hex) => {
                own.style.background = hex;
                own.style.color      = Page.ink(hex);
                own.classList.add('has-color');
            };

            if (custom) paintOwn(color);

            picker.addEventListener('input', () => {
                paintOwn(picker.value.toUpperCase());
                pickColor(own, picker.value.toUpperCase());
            });

            picker.addEventListener('click', () => {
                if (own.style.background) pickColor(own, picker.value.toUpperCase());
            });
        },
        onSubmit: async (data, form) => {
            // Al crear, la contraseña se escribe dos veces: si no coinciden, no se manda.
            if (!u && data.password !== data.password_confirmation) {
                return { status: 422, message: 'Las contraseñas no coinciden.', field: 'password_confirmation' };
            }

            const access = Array.from(form.querySelectorAll('[data-branch]'))
                .filter((el) => el.value !== '')
                .map((el) => ({ branch_id: Number(el.dataset.branch), role_id: Number(el.value) }));

            const res = await Page.post(CFG_API, { opc: 'saveUser', id: u ? u.id : 0, ...data, access: JSON.stringify(access) });

            if (res.status === 200) {
                // Su propio color: la barra lo toma sin recargar.
                if (u && u.me && data.color && window.navbar && navbar.data) {
                    navbar.data.color = data.color;
                    navbar.renderSession();
                }

                const sent = photo ? await cfgUserPhoto(u ? u.id : res.id, photo, !!(u && u.me)) : null;

                // Los datos ya quedaron: si la foto falla, se avisa y el modal se cierra igual.
                if (sent && sent.status !== 200) cfgToast(`${res.message} La foto no se guardó: ${sent.message || 'inténtalo de nuevo.'}`, false);
                else cfgToast(res.message, true);

                cfgRefresh('usuarios', cfgUsuarios);
            }

            // "access" no es un campo: se enfoca el primer selector de rol.
            if (res.field === 'access') {
                const first = form.querySelector('[data-branch]');
                if (first) first.focus();
            }

            return res;
        }
    });
}

// Sube la foto de un usuario. me = es la del propio dueño: la barra la cambia sin recargar.
async function cfgUserPhoto(id, file, me) {
    const body = new FormData();

    body.append('opc', 'saveUserPhoto');
    body.append('id', id);
    body.append('photo', file);

    const res = await Page.post(CFG_API, body);

    if (res.status === 200 && me && window.navbar && navbar.data) {
        navbar.data.photo = res.data.photo;
        navbar.renderSession();
    }

    return res;
}

// =================================================================== Roles

/*  Roles y permisos: la lista de roles a la izquierda y, a la derecha, el rol
    abierto o Comparar roles. En el teléfono la lista es un selector arriba.

    Las 6 acciones de siempre (Ver, Agregar, Editar...) son columnas fijas.
    Los permisos especiales de una sección (Ver bitácora, Autorizar
    descuento...) se abren debajo de su fila con lo que hace cada uno: un
    permiso nuevo agrega un renglón, no una columna. «Ver» manda: sin él no
    se marca nada más de la sección y quitarlo la apaga entera (el servidor
    hace lo mismo al guardar).

    Lo marcado vive en cfgRl.marks hasta Guardar; cfgRl.saved es lo que tiene
    el servidor, para saber si hay cambios y para Deshacer.

      sel    el rol abierto           view   'editor' o 'compare'
      mod    el módulo de la pestaña  find   lo que se busca
      open   secciones con sus especiales a la vista
      diff   Comparar: solo donde los roles difieren
      role   getRole del rol abierto  cmp    compareRoles */
const cfgRl = {
    sel: 0, view: 'editor', mod: 0, find: '', open: new Set(), diff: true,
    role: null, saved: new Set(), marks: new Set(), cmp: null
};

async function cfgRoles() {
    const d = await cfgLoad('roles', 'roles');
    if (!d) return;

    // El rol abierto sigue abierto al volver; si ya no está, el primero propio y activo.
    if (!d.roles.some((r) => r.id === cfgRl.sel)) {
        const first = d.roles.find((r) => !r.system && r.active) || d.roles[0];
        cfgRl.sel = first ? first.id : 0;
    }

    cfgPanel(`
        <div class="pg-rl" id="cfgRl">
            <div class="pg-rl-pick" id="cfgRlPick">${cfgRlPick(d)}</div>
            <aside class="pg-card pg-rl-side" id="cfgRlSide" aria-label="Roles">${cfgRlSide(d)}</aside>
            <div class="pg-rl-main" id="cfgRlMain"></div>
        </div>`);

    cfgRlEvents(document.getElementById('cfgRl'));

    if (cfgRl.view === 'compare') return cfgRlCompare();

    if (!d.roles.length) {
        document.getElementById('cfgRlMain').innerHTML = '<div class="pg-card"><div class="pg-empty"><i data-lucide="shield"></i>Todavía no hay roles. Crea el primero.</div></div>';
        return Page.icons();
    }

    cfgRlOpen(cfgRl.sel, false);
}

// -- Lista de roles --

function cfgRlSide(d) {
    const total = d.sections;

    const item = (r) => {
        const on  = cfgRl.view === 'editor' && r.id === cfgRl.sel;
        const pct = total ? Math.round(r.sections / total * 100) : 0;
        const sub = r.system ? 'De Huubie · solo consulta' : `${r.active ? '' : 'Inactivo · '}${r.sections} de ${total} secciones`;

        return `
            <button type="button" class="pg-rl-role ${on ? 'is-on' : ''} ${r.active ? '' : 'is-off'}" data-role="${r.id}" aria-current="${on ? 'true' : 'false'}">
                <span class="pg-ico"><i data-lucide="${r.system ? 'shield' : 'shield-check'}"></i></span>
                <span class="pg-rl-role-text">
                    <b>${Page.esc(r.name)}</b>
                    <small>${sub}</small>
                    <span class="pg-rl-meter" aria-hidden="true"><i style="width:${pct}%"></i></span>
                </span>
                <span class="pg-rl-people" title="Personas con este rol"><i data-lucide="user"></i>${r.users}</span>
            </button>`;
    };

    return `
        <div class="pg-rl-side-head">
            <p class="pg-card-title">Roles</p>
            <button type="button" class="pg-btn is-primary pg-rl-sm" data-new><i data-lucide="plus"></i>Crear rol</button>
        </div>
        <div class="pg-rl-roles">${d.roles.map(item).join('')}</div>
        <button type="button" class="pg-btn is-ghost pg-rl-sm pg-rl-cmp-btn ${cfgRl.view === 'compare' ? 'is-on' : ''}" data-compare aria-pressed="${cfgRl.view === 'compare'}"><i data-lucide="columns-3"></i>Comparar roles</button>
        <p class="pg-dim pg-rl-hint">Un rol dice qué puede ver y hacer alguien. Se asigna por sucursal en Usuarios.</p>`;
}

// La misma lista como selector, para pantallas angostas.
function cfgRlPick(d) {
    const people = (r) => r.system ? 'de Huubie' : (r.users === 1 ? '1 persona' : `${r.users} personas`);

    return `
        <select class="pg-input" id="cfgRlPickSel" aria-label="Rol">
            ${d.roles.map((r) => `<option value="${r.id}" ${cfgRl.view === 'editor' && r.id === cfgRl.sel ? 'selected' : ''}>${Page.esc(r.name)} · ${people(r)}${r.active ? '' : ' · inactivo'}</option>`).join('')}
            <option value="compare" ${cfgRl.view === 'compare' ? 'selected' : ''}>Comparar roles</option>
        </select>
        <button type="button" class="pg-btn is-primary is-round" data-new title="Crear rol" aria-label="Crear rol"><i data-lucide="plus"></i></button>`;
}

function cfgRlSideRefresh() {
    const d = cfg.data.roles;
    if (!d || !document.getElementById('cfgRlSide')) return;

    document.getElementById('cfgRlSide').innerHTML = cfgRlSide(d);
    document.getElementById('cfgRlPick').innerHTML = cfgRlPick(d);
    Page.icons();
}

// Vuelve a pedir la lista (personas y avance de cada rol). Lo de otras pestañas se olvida.
async function cfgRlList() {
    const res = await Page.post(CFG_API, { opc: 'roles' });

    if (res.status === 200) cfg.data = { roles: res.data };
    cfgRlSideRefresh();
}

// Un solo escucha por evento en toda la pestaña: sigue sirviendo aunque se repinte.
function cfgRlEvents(root) {
    const repaint = () => (cfgRl.view === 'compare' ? cfgRlCmpPaint() : cfgRlPaint());

    root.addEventListener('click', (e) => {
        const t = e.target;
        let el;

        if ((el = t.closest('[data-role]')))  return cfgRlGo(Number(el.dataset.role));
        if (t.closest('[data-new]'))          return cfgRlNew(0);
        if (t.closest('[data-from]'))         return cfgRlNew(cfgRl.sel);
        if (t.closest('[data-compare]'))      return cfgRlGo('compare');
        if (t.closest('[data-rename]'))       return cfgRlRename();
        if (t.closest('[data-copy]'))         return cfgRlCopy();
        if (t.closest('[data-active]'))       return cfgRlActive();
        if (t.closest('[data-save]'))         return cfgRlSave();

        if (t.closest('[data-undo]')) {
            cfgRl.marks = new Set(cfgRl.saved);
            return cfgRlPaint();
        }

        if (t.closest('[data-diff]')) {
            cfgRl.diff = !cfgRl.diff;
            return cfgRlCmpPaint();
        }

        if ((el = t.closest('[data-mod]'))) {
            cfgRl.mod = Number(el.dataset.mod);
            return repaint();
        }

        if ((el = t.closest('[data-open]'))) {
            const id = Number(el.dataset.open);
            if (cfgRl.open.has(id)) cfgRl.open.delete(id); else cfgRl.open.add(id);
            return cfgRlPaint();
        }

        // Los especiales son interruptores (botones), no casillas.
        if ((el = t.closest('.pg-switch[data-perm]')) && !el.disabled) return cfgRlMark(el.dataset, !el.classList.contains('is-on'));
    });

    root.addEventListener('change', (e) => {
        if (e.target.matches('input[data-perm]')) return cfgRlMark(e.target.dataset, e.target.checked);
        if (e.target.id === 'cfgRlPickSel') cfgRlGo(e.target.value === 'compare' ? 'compare' : Number(e.target.value));
    });

    root.addEventListener('input', (e) => {
        if (!e.target.matches('[data-find]')) return;
        cfgRl.find = e.target.value;
        repaint();
    });
}

// -- Abrir un rol o Comparar --

async function cfgRlGo(target) {
    const same = target === 'compare' ? cfgRl.view === 'compare' : (cfgRl.view === 'editor' && cfgRl.sel === target && cfgRl.role);
    if (same) return;

    if (!(await cfgRlLeave())) return cfgRlSideRefresh();

    cfgRl.view = target === 'compare' ? 'compare' : 'editor';
    if (target !== 'compare') cfgRl.sel = target;
    cfgRl.role = null;
    cfgRlSideRefresh();

    return target === 'compare' ? cfgRlCompare() : cfgRlOpen(target, false);
}

// ¿Se puede dejar el rol abierto? Con cambios sin guardar, se pregunta.
async function cfgRlLeave() {
    if (!cfgRlDirty()) return true;
    return cfgAsk('Hay cambios sin guardar', `Lo que cambiaste en «${cfgRl.role.name}» se pierde si sales sin guardar.`, 'Salir sin guardar');
}

function cfgRlChanges() {
    let n = 0;
    cfgRl.marks.forEach((id) => { if (!cfgRl.saved.has(id)) n++; });
    cfgRl.saved.forEach((id) => { if (!cfgRl.marks.has(id)) n++; });
    return n;
}

function cfgRlDirty() {
    return cfgRl.view === 'editor' && !!cfgRl.role && !cfgRl.role.system && cfgRlChanges() > 0;
}

// quiet: sin el esqueleto (al volver a pedir el mismo rol después de guardar).
async function cfgRlOpen(id, quiet) {
    const main = document.getElementById('cfgRlMain');
    if (!quiet) main.innerHTML = '<div class="pg-skel"></div>';

    const res = await Page.post(CFG_API, { opc: 'getRole', id: id });

    // Mientras llegaba se cambió de rol, de vista o de pestaña: se tira.
    if (cfgTab() !== 'roles' || cfgRl.view !== 'editor' || cfgRl.sel !== id || !document.getElementById('cfgRlMain')) return;

    if (res.status !== 200) {
        main.innerHTML = `<div class="pg-card"><div class="pg-empty"><i data-lucide="cloud-off"></i>${Page.esc(res.message || 'No se pudo abrir el rol.')}</div></div>`;
        return Page.icons();
    }

    const ids = cfgRlGranted(res.data);

    cfgRl.role  = res.data;
    cfgRl.saved = new Set(ids);
    cfgRl.marks = new Set(ids);
    if (!res.data.modules.some((m) => m.id === cfgRl.mod)) cfgRl.mod = res.data.modules.length ? res.data.modules[0].id : 0;

    cfgRlEditor();
}

// Los ids que un getRole trae concedidos.
function cfgRlGranted(role) {
    const ids = [];
    role.modules.forEach((m) => m.sections.forEach((s) => s.basic.concat(s.special).forEach((a) => { if (a.granted) ids.push(a.id); })));
    return ids;
}

// -- El rol abierto --

function cfgRlEditor() {
    const r    = cfgRl.role;
    const lock = !!r.system;

    const actions = lock
        ? '<button type="button" class="pg-btn is-ghost pg-rl-sm" data-from><i data-lucide="copy-plus"></i>Crear uno a partir de este</button>'
        : `<button type="button" class="pg-btn is-ghost pg-rl-sm" data-copy><i data-lucide="copy"></i>Copiar de…</button>
           <span class="pg-rl-toggle">${cfgSwitch(r.active, 'data-active', r.active ? 'Desactivar rol' : 'Activar rol')}<span>${r.active ? 'Activo' : 'Inactivo'}</span></span>`;

    document.getElementById('cfgRlMain').innerHTML = `
        <section class="pg-card pg-rl-ed" aria-labelledby="cfgRlName">
            <header class="pg-rl-head">
                <div class="pg-rl-head-text">
                    <div class="pg-rl-title">
                        <h2 id="cfgRlName">${Page.esc(r.name)}</h2>
                        ${lock ? '<span class="pg-chip is-off is-mini">De Huubie</span>' : '<button type="button" class="pg-btn is-ghost is-round" data-rename title="Cambiar nombre" aria-label="Cambiar nombre del rol"><i data-lucide="pencil"></i></button>'}
                    </div>
                    <p class="pg-dim pg-small" id="cfgRlSub"></p>
                </div>
                <div class="pg-rl-actions">${actions}</div>
            </header>
            ${lock ? '<p class="pg-rl-lock"><i data-lucide="lock"></i><span>Rol de Huubie: lo comparten todas las empresas y aquí solo se consulta. Para uno parecido, créalo a partir de este y ajústalo.</span></p>' : ''}
            <div class="pg-rl-bar">
                <nav class="pg-rl-mods" id="cfgRlMods" aria-label="Módulos"></nav>
                <label class="pg-rl-find"><i data-lucide="search"></i><input class="pg-input" type="search" data-find value="${Page.esc(cfgRl.find)}" placeholder="Buscar sección o permiso…" aria-label="Buscar sección o permiso"></label>
            </div>
            <div class="pg-rl-grid ${lock ? 'is-lock' : ''}" id="cfgRlGrid" style="--rl-cols:${r.basic.length}"></div>
            ${lock ? '' : `
                <p class="pg-rl-foot"><i data-lucide="lock"></i>Sin «Ver» no se marca nada más de esa sección. Quitar «Ver» apaga la sección entera.</p>
                <div class="pg-rl-save">
                    <p class="pg-rl-save-text" id="cfgRlState" role="status"></p>
                    <button type="button" class="pg-btn is-ghost pg-rl-sm" data-undo><i data-lucide="rotate-ccw"></i>Deshacer</button>
                    <button type="button" class="pg-btn is-primary pg-rl-sm" data-save><i data-lucide="check"></i>Guardar</button>
                </div>`}
        </section>`;

    cfgRlPaint();
}

// «Ver» de la sección marcado. Una sección sin «Ver» (no debería haber) cuenta con cualquier acción.
function cfgRlGate(s) {
    const show = s.basic.find((a) => a.code === 'show');
    return show ? cfgRl.marks.has(show.id) : s.basic.concat(s.special).some((a) => cfgRl.marks.has(a.id));
}

function cfgRlSection(id) {
    for (const m of cfgRl.role.modules) {
        const s = m.sections.find((x) => x.id === id);
        if (s) return s;
    }
    return null;
}

// Sin acentos ni mayúsculas, para buscar.
function cfgRlNorm(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Vuelve a pintar todo lo que depende de lo marcado, sin perder el foco.
function cfgRlPaint() {
    const r = cfgRl.role;
    if (!r || !document.getElementById('cfgRlGrid')) return;

    const active = document.activeElement;
    const keep   = active && document.getElementById('cfgRlGrid').contains(active)
        ? (active.dataset.perm ? `[data-perm="${active.dataset.perm}"]` : (active.dataset.open ? `[data-open="${active.dataset.open}"]` : ''))
        : '';

    const all   = r.modules.reduce((n, m) => n + m.sections.length, 0);
    const seen  = r.modules.reduce((n, m) => n + m.sections.filter(cfgRlGate).length, 0);
    const li    = cfg.data.roles ? cfg.data.roles.roles.find((x) => x.id === r.id) : null;
    const users = li ? li.users : 0;

    document.getElementById('cfgRlSub').textContent = [
        users === 1 ? '1 persona' : `${users} personas`,
        r.system ? 'De Huubie' : 'Propio de tu empresa',
        `${seen} de ${all} secciones`
    ].join(' · ');

    document.getElementById('cfgRlMods').innerHTML = r.modules.map((m) => `
        <button type="button" class="pg-rl-mod ${m.id === cfgRl.mod ? 'is-on' : ''}" data-mod="${m.id}" aria-pressed="${m.id === cfgRl.mod}">
            <i data-lucide="${Page.esc(m.icon)}"></i>${Page.esc(m.name)}<em title="Secciones con «Ver»">${m.sections.filter(cfgRlGate).length}/${m.sections.length}</em>
        </button>`).join('');

    document.getElementById('cfgRlGrid').innerHTML = cfgRlGrid();

    const state = document.getElementById('cfgRlState');
    if (state) {
        const n = cfgRlChanges();

        state.textContent = n ? (n === 1 ? '1 cambio sin guardar' : `${n} cambios sin guardar`) : 'Sin cambios';
        state.classList.toggle('is-dirty', n > 0);
        document.querySelector('#cfgRlMain [data-undo]').disabled = !n;
        document.querySelector('#cfgRlMain [data-save]').disabled = !n;
    }

    Page.icons();

    if (keep) {
        const el = document.querySelector(`#cfgRlGrid ${keep}`);
        if (el) el.focus();
    }
}

function cfgRlGrid() {
    const r   = cfgRl.role;
    const mod = r.modules.find((m) => m.id === cfgRl.mod);

    if (!mod) return '<div class="pg-empty"><i data-lucide="layout-grid"></i>Tu plan todavía no tiene secciones con permisos.</div>';

    const q    = cfgRlNorm(cfgRl.find);
    const rows = [];
    let group  = null;

    mod.sections.forEach((s) => {
        const hit = cfgRlHit(s, q);
        if (!hit) return;

        // Lo encontrado en un especial o en una nota: su sección se abre para verlo.
        if (hit.extra) cfgRl.open.add(s.id);

        if (s.group !== group) {
            group = s.group;
            if (group) rows.push(`<div class="pg-rl-group">${Page.esc(group)}</div>`);
        }

        rows.push(cfgRlRow(s));
    });

    if (!rows.length) return `<div class="pg-empty"><i data-lucide="search-x"></i>Nada coincide con «${Page.esc(cfgRl.find)}» en ${Page.esc(mod.name)}.</div>`;

    return `
        <div class="pg-rl-r pg-rl-th" aria-hidden="true"><span>Sección</span>${r.basic.map((b) => `<span>${Page.esc(b.name)}</span>`).join('')}<span>Especiales</span></div>
        ${rows.join('')}`;
}

// null: la sección no coincide. extra: coincidió un especial o la nota de una básica.
function cfgRlHit(s, q) {
    if (!q || cfgRlNorm(s.name).includes(q)) return { extra: false };

    const match = (a) => cfgRlNorm(`${a.name} ${a.text}`).includes(q);
    const extra = s.special.some(match) || s.basic.some((a) => a.text && cfgRlNorm(a.text).includes(q));

    return extra || s.basic.some(match) ? { extra: extra } : null;
}

function cfgRlRow(s) {
    const r     = cfgRl.role;
    const lock  = !!r.system;
    const gate  = cfgRlGate(s);
    const onB   = s.basic.filter((a) => cfgRl.marks.has(a.id)).length;
    const onS   = s.special.filter((a) => cfgRl.marks.has(a.id)).length;
    const notes = s.basic.filter((a) => a.text);
    const extra = s.special.length > 0 || notes.length > 0;
    const open  = extra && cfgRl.open.has(s.id);
    const state = !gate ? 'Sin acceso' : (onB === s.basic.length ? 'Todo lo básico' : `${onB} de ${s.basic.length} básicas`);
    const off   = (a) => lock || (a.code !== 'show' && !gate) ? 'disabled' : '';
    const data  = (a) => `data-perm="${a.id}" data-sec="${s.id}" data-code="${Page.esc(a.code)}"`;

    const cells = r.basic.map((b) => {
        const a = s.basic.find((x) => x.code === b.code);
        if (!a) return '<span class="pg-rl-cell is-none" aria-hidden="true"></span>';

        const tip = `${a.name} · ${s.name}${a.text ? `. ${a.text}` : ''}`;

        return `
            <label class="pg-rl-cell" title="${Page.esc(tip)}">
                <input type="checkbox" ${data(a)} ${cfgRl.marks.has(a.id) ? 'checked' : ''} ${off(a)}>
                <span class="pg-rl-cell-name">${Page.esc(a.name)}<span class="pg-sr"> · ${Page.esc(s.name)}</span></span>
                ${a.text ? '<i class="pg-rl-cell-dot" aria-hidden="true"></i>' : ''}
            </label>`;
    }).join('');

    const toggle = !extra
        ? '<span class="pg-rl-x-none" aria-hidden="true">—</span>'
        : `<button type="button" class="pg-rl-x ${open ? 'is-open' : ''}" data-open="${s.id}" aria-expanded="${open}" aria-controls="cfgRlX${s.id}" title="${s.special.length ? 'Permisos especiales' : 'Qué abre cada casilla'} de ${Page.esc(s.name)}">
               <span>${s.special.length ? `<span class="pg-rl-x-long">Especiales · </span>${onS} de ${s.special.length}` : 'Nota'}</span><i data-lucide="chevron-down"></i>
           </button>`;

    const special = s.special.map((a) => {
        const on = cfgRl.marks.has(a.id);

        return `
            <div class="pg-rl-sp ${on ? '' : 'is-off'}">
                <button type="button" class="pg-switch ${on ? 'is-on' : ''}" role="switch" aria-checked="${on}" aria-label="${Page.esc(a.name)} · ${Page.esc(s.name)}" ${data(a)} ${off(a)}><span></span></button>
                <span><b>${Page.esc(a.name)}</b>${a.text ? `<small>${Page.esc(a.text)}</small>` : ''}</span>
            </div>`;
    }).join('');

    const panel = !open ? '' : `
        <div class="pg-rl-extra" id="cfgRlX${s.id}">
            ${notes.length ? `<div class="pg-rl-notes">${notes.map((a) => `<p class="pg-rl-note"><i data-lucide="info"></i><span><b>${Page.esc(a.name)}:</b> ${Page.esc(a.text)}</span></p>`).join('')}</div>` : ''}
            ${special ? `<div class="pg-rl-sp-list">${special}</div>` : ''}
            ${special && !gate && !lock ? '<p class="pg-rl-x-hint">Marca «Ver» de esta sección para poder darlos.</p>' : ''}
        </div>`;

    return `
        <div class="pg-rl-r ${gate ? '' : 'is-off'}">
            <div class="pg-rl-sec">
                <span class="pg-rl-ico"><i data-lucide="${Page.esc(s.icon)}"></i></span>
                <span class="pg-rl-sec-text"><b>${Page.esc(s.name)}</b><small>${state}</small></span>
            </div>
            ${cells}
            ${toggle}
        </div>${panel}`;
}

// Marcar o desmarcar una acción. Quitar «Ver» apaga la sección entera; cualquier otra trae su «Ver».
function cfgRlMark(ds, on) {
    if (!cfgRl.role || cfgRl.role.system) return;

    const s = cfgRlSection(Number(ds.sec));
    if (!s) return;

    const show = s.basic.find((a) => a.code === 'show');

    if (ds.code === 'show' && !on) {
        s.basic.concat(s.special).forEach((a) => cfgRl.marks.delete(a.id));
    } else if (on) {
        cfgRl.marks.add(Number(ds.perm));
        if (show) cfgRl.marks.add(show.id);
    } else {
        cfgRl.marks.delete(Number(ds.perm));
    }

    cfgRlPaint();
}

async function cfgRlSave() {
    const r   = cfgRl.role;
    const btn = document.querySelector('#cfgRlMain [data-save]');

    if (btn) btn.disabled = true;

    const res = await Page.post(CFG_API, { opc: 'saveRole', id: r.id, name: r.name, permissions: JSON.stringify(Array.from(cfgRl.marks)) });

    cfgToast(res.message || 'No se pudo guardar el rol.', res.status === 200);
    if (res.status !== 200) return cfgRlPaint();

    // Lo guardado puede traer un «Ver» que puso el servidor: se vuelve a pedir.
    cfgRl.saved = new Set(cfgRl.marks);
    await cfgRlList();
    if (cfgTab() === 'roles' && cfgRl.view === 'editor' && cfgRl.sel === r.id) cfgRlOpen(r.id, true);
}

function cfgRlRename() {
    const r = cfgRl.role;

    cfgModal({
        title:  'Cambiar nombre',
        sub:    'Solo el nombre: lo marcado no cambia.',
        submit: 'Guardar',
        body:   `<div class="pg-form is-one">${cfgField('name', 'Nombre del rol', r.name, 'maxlength="60" required')}</div>`,
        onSubmit: async (data) => {
            const res = await Page.post(CFG_API, { opc: 'saveRole', id: r.id, name: data.name });

            if (res.status === 200) {
                cfgToast(res.message, true);
                r.name = String(data.name).replace(/\s+/g, ' ').trim().slice(0, 60);
                await cfgRlList();
                if (cfgRl.role === r) cfgRlEditor();
            }

            return res;
        }
    });
}

// Un rol que alguien tiene no se apaga (lo revisa el servidor y lo explica).
async function cfgRlActive() {
    const r   = cfgRl.role;
    const res = await Page.post(CFG_API, { opc: 'toggleRole', id: r.id, active: r.active ? 0 : 1 });

    cfgToast(res.message || 'No se pudo cambiar el estado.', res.status === 200);
    if (res.status !== 200) return;

    r.active = r.active ? 0 : 1;
    await cfgRlList();
    if (cfgRl.role === r) cfgRlEditor();
}

// Una opción por rol en Nuevo rol y en Copiar de…
function cfgRlOption(r, on) {
    const sections = r.sections === 1 ? '1 sección' : `${r.sections} secciones`;
    const perms    = r.perms === 1 ? '1 permiso' : `${r.perms} permisos`;

    return `
        <label class="pg-rl-opt">
            <input type="radio" name="from_role" value="${r.id}" ${on ? 'checked' : ''}>
            <span><b>${Page.esc(r.name)}</b><small>${sections} · ${perms}${r.system ? ' · de Huubie' : ''}${r.active ? '' : ' · inactivo'}</small></span>
        </label>`;
}

// Deja marcado lo mismo que otro rol. No guarda: se revisa y se le da Guardar.
function cfgRlCopy() {
    const me     = cfgRl.role;
    const others = cfg.data.roles.roles.filter((x) => x.id !== me.id);

    if (!others.length) return cfgToast('No hay otro rol de dónde copiar.', false);

    cfgModal({
        title:  'Copiar permisos de otro rol',
        sub:    `«${me.name}» queda marcado igual que el rol que elijas. No se guarda hasta que le des Guardar.`,
        submit: 'Copiar',
        wide:   true,
        body:   `<div class="pg-rl-opts">${others.map((x, i) => cfgRlOption(x, i === 0)).join('')}</div>`,
        onSubmit: async (data) => {
            const from = others.find((x) => x.id === Number(data.from_role));
            if (!from) return { status: 400, message: 'Elige de qué rol copiar.' };

            const res = await Page.post(CFG_API, { opc: 'getRole', id: from.id });
            if (res.status !== 200) return res;
            if (cfgRl.role !== me) return { status: 200 };

            cfgRl.marks = new Set(cfgRlGranted(res.data));
            cfgRlPaint();
            cfgToast(`Marcado como ${from.name}. Revisa y dale Guardar.`, true);

            return { status: 200 };
        }
    });
}

// from: el rol que queda elegido como punto de partida (0 = empezar vacío).
async function cfgRlNew(from) {
    if (!(await cfgRlLeave())) return;

    const roles = cfg.data.roles.roles.filter((x) => x.active || x.id === from);

    cfgModal({
        title:  'Nuevo rol',
        sub:    'Ponle nombre y elige desde dónde empieza. Después ajustas lo que haga falta.',
        submit: 'Crear y abrir',
        wide:   true,
        body: `
            <div class="pg-form is-one">
                ${cfgField('name', 'Nombre del rol', '', 'maxlength="60" required placeholder="Ej. Encargado de sucursal"')}
                <div class="pg-field">
                    <span class="pg-label">Empezar con los permisos de</span>
                    <div class="pg-rl-opts">
                        <label class="pg-rl-opt">
                            <input type="radio" name="from_role" value="0" ${from ? '' : 'checked'}>
                            <span><b>Nada</b><small>Rol vacío: marcas todo tú.</small></span>
                        </label>
                        ${roles.map((x) => cfgRlOption(x, x.id === from)).join('')}
                    </div>
                    <p class="pg-dim pg-small">Es una copia: cambiar después el rol original no cambia este.</p>
                </div>
            </div>`,
        onSubmit: async (data) => {
            const res = await Page.post(CFG_API, { opc: 'saveRole', id: 0, name: data.name, from_role: Number(data.from_role || 0) });

            if (res.status === 200) {
                cfgToast(res.message, true);

                cfgRl.view = 'editor';
                cfgRl.sel  = Number(res.id);
                cfgRl.role = null;

                await cfgRlList();
                if (cfgTab() === 'roles') cfgRlOpen(cfgRl.sel, false);
            }

            return res;
        }
    });
}

// -- Comparar roles --

async function cfgRlCompare() {
    const main = document.getElementById('cfgRlMain');
    if (!cfgRl.cmp) main.innerHTML = '<div class="pg-skel"></div>';

    const res = await Page.post(CFG_API, { opc: 'compareRoles' });

    if (cfgTab() !== 'roles' || cfgRl.view !== 'compare' || !document.getElementById('cfgRlMain')) return;

    if (res.status !== 200) {
        main.innerHTML = `<div class="pg-card"><div class="pg-empty"><i data-lucide="cloud-off"></i>${Page.esc(res.message || 'No se pudo comparar.')}</div></div>`;
        return Page.icons();
    }

    cfgRl.cmp = res.data;
    if (!res.data.modules.some((m) => m.id === cfgRl.mod)) cfgRl.mod = res.data.modules.length ? res.data.modules[0].id : 0;

    main.innerHTML = `
        <section class="pg-card pg-rl-ed" aria-labelledby="cfgRlName">
            <header class="pg-rl-head">
                <div class="pg-rl-head-text">
                    <div class="pg-rl-title"><h2 id="cfgRlName">Comparar roles</h2></div>
                    <p class="pg-dim pg-small">Quién puede hacer qué, rol contra rol. Solo se consulta: para cambiar algo, abre el rol.</p>
                </div>
                <div class="pg-rl-actions">
                    <span class="pg-rl-toggle">${cfgSwitch(cfgRl.diff, 'data-diff id="cfgRlDiff"', 'Solo donde los roles difieren')}<span>Solo donde los roles difieren</span></span>
                </div>
            </header>
            <div class="pg-rl-bar">
                <nav class="pg-rl-mods" id="cfgRlMods" aria-label="Módulos"></nav>
                <label class="pg-rl-find"><i data-lucide="search"></i><input class="pg-input" type="search" data-find value="${Page.esc(cfgRl.find)}" placeholder="Buscar permiso…" aria-label="Buscar permiso"></label>
            </div>
            <div class="pg-rl-cmp-wrap" id="cfgRlCmp"></div>
            <p class="pg-rl-foot" id="cfgRlFoot" hidden></p>
        </section>`;

    cfgRlCmpPaint();
}

function cfgRlCmpPaint() {
    const c = cfgRl.cmp;
    if (!c || !document.getElementById('cfgRlCmp')) return;

    const roles = c.roles;
    const has   = new Map(roles.map((r) => [r.id, new Set(r.grants)]));

    // "Difieren" se mide entre los roles de la empresa; los de Huubie se ven, pero no cuentan.
    const own   = roles.filter((r) => !r.system);
    const judge = own.length >= 2 ? own : roles;

    const sw = document.getElementById('cfgRlDiff');
    sw.classList.toggle('is-on', cfgRl.diff);
    sw.setAttribute('aria-checked', cfgRl.diff ? 'true' : 'false');

    document.getElementById('cfgRlMods').innerHTML = c.modules.map((m) => {
        const n = m.sections.reduce((t, s) => t + s.basic.length + s.special.length, 0);
        return `<button type="button" class="pg-rl-mod ${m.id === cfgRl.mod ? 'is-on' : ''}" data-mod="${m.id}" aria-pressed="${m.id === cfgRl.mod}"><i data-lucide="${Page.esc(m.icon)}"></i>${Page.esc(m.name)}<em title="Permisos">${n}</em></button>`;
    }).join('');

    const mod  = c.modules.find((m) => m.id === cfgRl.mod);
    const q    = cfgRlNorm(cfgRl.find);
    let hidden = 0;

    const body = !mod ? '' : mod.sections.map((s) => {
        const whole = !q || cfgRlNorm(s.name).includes(q);
        const acts  = s.basic.map((a) => ({ a: a, sp: false })).concat(s.special.map((a) => ({ a: a, sp: true })));

        const keep = acts.filter((x) => {
            if (!whole && !cfgRlNorm(`${x.a.name} ${x.a.text}`).includes(q)) return false;

            if (cfgRl.diff) {
                const v = judge.map((r) => has.get(r.id).has(x.a.id));
                if (v.every((y) => y === v[0])) { hidden++; return false; }
            }

            return true;
        });

        if (!keep.length) return '';

        return `
            <tr class="pg-rl-cmp-sec"><th colspan="${roles.length + 1}" scope="rowgroup"><span class="pg-rl-sec"><span class="pg-rl-ico"><i data-lucide="${Page.esc(s.icon)}"></i></span>${Page.esc(s.name)}</span></th></tr>
            ${keep.map((x) => `
                <tr class="pg-rl-cmp-act">
                    <th scope="row" ${x.a.text ? `title="${Page.esc(x.a.text)}"` : ''}>${Page.esc(x.a.name)}${x.sp ? '<span class="pg-rl-tag">especial</span>' : ''}</th>
                    ${roles.map((r) => `<td class="pg-rl-c">${has.get(r.id).has(x.a.id)
                        ? `<span class="pg-rl-dot ${r.system ? 'is-sys' : ''}"><i data-lucide="check"></i><span class="pg-sr">Sí</span></span>`
                        : '<span class="pg-rl-no"></span><span class="pg-sr">No</span>'}</td>`).join('')}
                </tr>`).join('')}`;
    }).join('');

    const empty = !roles.length ? 'No hay roles activos que comparar.'
        : (q ? `Nada coincide con «${Page.esc(cfgRl.find)}».` : (cfgRl.diff ? 'En este módulo todos los roles tienen lo mismo.' : 'Este módulo no tiene permisos.'));

    document.getElementById('cfgRlCmp').innerHTML = `
        <table class="pg-rl-cmp">
            <thead><tr>
                <th scope="col">Permiso</th>
                ${roles.map((r) => `
                    <th scope="col" class="pg-rl-c">
                        <button type="button" class="pg-rl-cmp-role" data-role="${r.id}" title="Abrir ${Page.esc(r.name)}">
                            ${Page.esc(r.name)}<small>${r.system ? 'de Huubie' : (r.users === 1 ? '1 persona' : `${r.users} personas`)}</small>
                        </button>
                    </th>`).join('')}
            </tr></thead>
            <tbody>${body || `<tr><td colspan="${roles.length + 1}"><div class="pg-empty"><i data-lucide="equal"></i>${empty}</div></td></tr>`}</tbody>
        </table>`;

    const foot  = document.getElementById('cfgRlFoot');
    const names = judge.map((r) => r.name);
    const list  = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names.join('');

    foot.hidden    = !(cfgRl.diff && hidden);
    foot.innerHTML = `<i data-lucide="eye-off"></i>${hidden === 1 ? '1 permiso oculto' : `${hidden} permisos ocultos`}: ${Page.esc(list)} ${names.length > 1 ? 'los tienen igual' : 'lo tiene así'}.`;

    Page.icons();
}

// ============================================================ Plan y pagos

async function cfgPagos() {
    const d = await cfgLoad('pagos', 'billing');
    if (!d) return;

    const plan   = d.plan;
    const estado = plan.reason === 'trial' ? ['Prueba terminada', 'is-warn'] : (CFG_PLAN[plan.status] || ['Sin plan', 'is-off']);

    const cuando = plan.trial_end
        ? `<div class="pg-row"><div class="pg-row-text"><p class="pg-dim pg-small">${plan.trial_left < 0 ? 'La prueba terminó' : 'La prueba termina'}</p></div><p class="pg-strong">${Page.esc(Page.date(plan.trial_end))}</p></div>`
        : (plan.next ? `<div class="pg-row"><div class="pg-row-text"><p class="pg-dim pg-small">Próximo pago</p></div><p class="pg-strong">${Page.esc(Page.date(plan.next))}</p></div>` : '');

    const pagos = d.payments.map((p) => {
        const st = CFG_PAGOS[p.status] || [p.status, 'is-off'];

        return `
            <tr>
                <td class="pg-strong">${Page.esc(Page.date(p.day))}</td>
                <td data-label="Método" class="pg-dim">${Page.esc(CFG_METODOS[p.gateway] || p.gateway || '—')}</td>
                <td data-label="Estado"><span class="pg-chip ${st[1]}">${st[0]}</span></td>
                <td class="pg-td-num pg-strong" data-label="Monto">${Page.esc(Page.money(p.amount, p.currency))}</td>
                <td class="pg-td-actions">${p.invoice ? `<a class="pg-link" href="${Page.esc(p.invoice)}" target="_blank" rel="noopener">Recibo <i data-lucide="external-link"></i></a>` : ''}</td>
            </tr>`;
    }).join('');

    cfgPanel(`
        <div class="pg-grid is-even">
            <div class="pg-col">
                <div class="pg-card">
                    <div class="pg-card-head">
                        <p class="pg-card-title"><span class="pg-ico"><i data-lucide="badge-check"></i></span>Tu plan</p>
                        <span class="pg-chip ${estado[1]}">${estado[0]}</span>
                    </div>
                    ${plan.name ? `
                        <p class="pg-strong" style="font-size:20px">${Page.esc(plan.name)}</p>
                        ${plan.price !== null ? `<p class="pg-dim pg-small">${Page.esc(Page.money(plan.price, plan.currency))} ${Page.esc(CFG_CICLOS[plan.cycle] || '')} · sin IVA</p>` : ''}
                        <div class="pg-list" style="margin-top:14px">
                            ${cuando}
                            <div class="pg-row"><div class="pg-row-text"><p class="pg-dim pg-small">Sucursales activas</p></div><p class="pg-strong">${d.limits.branches.used}${d.limits.branches.max === null ? '' : ' de ' + d.limits.branches.max}</p></div>
                            <div class="pg-row"><div class="pg-row-text"><p class="pg-dim pg-small">Usuarios activos</p></div><p class="pg-strong">${d.limits.users.used}${d.limits.users.max === null ? '' : ' de ' + d.limits.users.max}</p></div>
                        </div>` : '<p class="pg-dim pg-small">Tu empresa todavía no tiene un plan contratado.</p>'}
                    <div class="pg-logo-actions">
                        ${d.can_pay ? '<button type="button" class="pg-btn is-primary" id="btnCfgPay"><i data-lucide="credit-card"></i>Pagar ahora</button>' : ''}
                        ${plan.name ? `<button type="button" class="pg-btn ${d.can_pay ? 'is-ghost' : 'is-primary'}" id="btnCfgPlan"><i data-lucide="repeat-2"></i>Cambiar plan</button>` : ''}
                        ${d.can_portal ? '<button type="button" class="pg-btn is-ghost" id="btnCfgPortal"><i data-lucide="wallet"></i>Forma de pago</button>' : ''}
                    </div>
                    ${d.can_portal ? '' : '<p class="pg-dim pg-small" style="margin-top:12px !important">Tu forma de pago se guarda con tu primer pago en línea; después podrás cambiarla desde aquí.</p>'}
                    <p class="pg-msg is-err" id="pagosMsg" role="alert" hidden style="margin-top:10px !important"></p>
                </div>
                ${d.modules.length ? `
                <div class="pg-card">
                    <div class="pg-card-head"><p class="pg-card-title">Incluye</p><span class="pg-card-note">${d.modules.length} ${d.modules.length === 1 ? 'módulo' : 'módulos'}</span></div>
                    <div class="pg-chips">${d.modules.map((m) => `<span class="pg-chip"><i data-lucide="${Page.esc(m.icon)}"></i>${Page.esc(m.name)}</span>`).join('')}</div>
                </div>` : ''}
            </div>
            <div class="pg-col">
                <div class="pg-card">
                    <div class="pg-card-head"><p class="pg-card-title">Historial de pagos</p><span class="pg-card-note">${d.payments.length ? d.payments.length + (d.payments.length === 1 ? ' pago' : ' pagos') : ''}</span></div>
                    ${pagos ? `
                    <div class="pg-table-wrap">
                        <table class="pg-table">
                            <thead><tr><th>Fecha</th><th>Método</th><th>Estado</th><th class="pg-td-num">Monto</th><th></th></tr></thead>
                            <tbody>${pagos}</tbody>
                        </table>
                    </div>` : '<div class="pg-empty"><i data-lucide="receipt"></i>Aquí aparecerán tus pagos cuando hagas el primero.</div>'}
                </div>
            </div>
        </div>`);

    const go = async (btn, opc) => {
        const msg = document.getElementById('pagosMsg');

        btn.disabled = true;
        msg.hidden   = true;

        const res = await Page.post(CFG_API, { opc: opc });

        if (res.status === 200 && res.url) { window.location.href = res.url; return; }

        btn.disabled    = false;
        msg.hidden      = false;
        msg.textContent = res.message || 'No se pudo abrir. Inténtalo de nuevo.';
    };

    const pay    = document.getElementById('btnCfgPay');
    const portal = document.getElementById('btnCfgPortal');

    if (pay)    pay.addEventListener('click', () => go(pay, 'checkout'));
    if (portal) portal.addEventListener('click', () => go(portal, 'portal'));

    const change = document.getElementById('btnCfgPlan');
    if (change) change.addEventListener('click', cfgPlanForm);
}

// -- Cambiar de plan --

function cfgPlanPrice(p) {
    if (p.mode === 'custom') return '<span class="pg-plan-price">A tu medida</span><span class="pg-dim pg-small">según tus módulos</span>';

    return `<span class="pg-plan-price">${Page.esc(Page.money(p.price, p.currency))}</span><span class="pg-dim pg-small">${Page.esc(CFG_CICLOS[p.cycle] || '')} · sin IVA</span>`;
}

function cfgPlanLimit(n, uno, varios) {
    return n === null ? `${varios} ilimitados` : `${n} ${n === 1 ? uno : varios}`;
}

/*  Los planes de Huubie como tarjetas a elegir. En el Personalizado (y en los
    planes "a elegir") aparecen los modulos sueltos con su precio y el total se
    va sumando. El cambio aplica al momento; el precio nuevo, en el siguiente pago. */
async function cfgPlanForm() {
    const res = await Page.post(CFG_API, { opc: 'plans' });

    if (res.status !== 200) return cfgToast(res.message || 'No se pudieron cargar los planes.', false);

    const d = res.data;

    if (!d.plans.length) return cfgToast('Por ahora no hay otros planes disponibles. Escríbenos y lo vemos contigo.', false);

    const mine = Object.fromEntries(d.mine.map((m) => [m.id, m.price]));

    const cards = d.plans.map((p) => {
        const current = p.id === d.current;
        const incluye = p.mode === 'included' ? p.modules.join(', ')
                      : p.mode === 'all'      ? 'Todos los módulos'
                      : p.mode === 'pick'     ? `${p.pick} ${p.pick === 1 ? 'módulo' : 'módulos'} a elegir`
                      : 'Los módulos que tú elijas';

        return `
            <label class="pg-plan ${current ? 'is-current' : ''}">
                <input type="radio" name="plan_id" value="${p.id}" ${current ? 'checked' : ''}>
                <span class="pg-plan-head">
                    <span class="pg-plan-name">${Page.esc(p.name)}</span>
                    ${current ? '<span class="pg-chip is-mini is-ok">Tu plan</span>' : (p.featured ? '<span class="pg-chip is-mini">Recomendado</span>' : '')}
                </span>
                <span class="pg-plan-cost">${cfgPlanPrice(p)}</span>
                <span class="pg-plan-list">
                    <span><i data-lucide="layout-grid"></i>${Page.esc(incluye || 'Sin módulos')}</span>
                    <span><i data-lucide="store"></i>${cfgPlanLimit(p.max_branches, 'sucursal', 'sucursales').replace('sucursales ilimitados', 'Sucursales ilimitadas')}</span>
                    <span><i data-lucide="users"></i>${cfgPlanLimit(p.max_users, 'usuario', 'usuarios').replace('usuarios ilimitados', 'Usuarios ilimitados')}</span>
                </span>
            </label>`;
    }).join('');

    const modules = d.modules.map((m) => {
        // Los que ya tiene contratados conservan su precio.
        const price = mine[m.id] !== undefined && mine[m.id] > 0 ? mine[m.id] : m.price;

        return `
            <label class="pg-mod-pick">
                <input type="checkbox" data-module="${m.id}" data-price="${price}" ${mine[m.id] !== undefined ? 'checked' : ''}>
                <span class="pg-ico"><i data-lucide="${Page.esc(m.icon)}"></i></span>
                <span class="pg-row-text">
                    <span class="pg-strong">${Page.esc(m.name)}</span>
                    <span class="pg-dim pg-small pg-ellipsis">${Page.esc(m.text)}</span>
                </span>
                <span class="pg-strong pg-mod-pick-price">${Page.esc(Page.money(price, 'MXN'))}</span>
            </label>`;
    }).join('');

    const cuando = d.next ? `en tu siguiente pago, el ${Page.date(d.next)}` : 'en tu siguiente pago';

    cfgModal({
        title:  'Cambiar plan',
        sub:    `Lo que incluye el plan nuevo aplica desde ahora; el precio nuevo se cobra ${cuando}.`,
        submit: 'Cambiar plan',
        wide:   true,
        body: `
            <div class="pg-plans">${cards}</div>
            <div id="cfgPlanModules" hidden>
                <div class="pg-form-sep">
                    <p class="pg-card-title"><span class="pg-ico"><i data-lucide="blocks"></i></span><span id="cfgPlanModulesTitle">Elige tus módulos</span></p>
                    <p class="pg-dim pg-small" id="cfgPlanModulesNote"></p>
                </div>
                <div class="pg-mod-picks" data-name="modules">${modules}</div>
            </div>
            <div class="pg-plan-total" id="cfgPlanTotal"></div>`,
        onOpen: (form) => {
            const box   = form.querySelector('#cfgPlanModules');
            const total = form.querySelector('#cfgPlanTotal');

            const paint = () => {
                const chosen = form.querySelector('[name="plan_id"]:checked');
                const plan   = chosen ? d.plans.find((p) => p.id === Number(chosen.value)) : null;

                form.querySelectorAll('.pg-plan').forEach((el) => el.classList.toggle('is-on', el.contains(chosen)));

                if (!plan) { box.hidden = true; total.innerHTML = ''; return; }

                const picks  = plan.mode === 'custom' || plan.mode === 'pick';
                const marked = Array.from(form.querySelectorAll('[data-module]:checked'));

                box.hidden = !picks;
                box.classList.toggle('is-pick', plan.mode === 'pick');

                if (plan.mode === 'pick') {
                    form.querySelector('#cfgPlanModulesTitle').textContent = `Elige ${plan.pick} ${plan.pick === 1 ? 'módulo' : 'módulos'}`;
                    form.querySelector('#cfgPlanModulesNote').textContent  = `Van incluidos en el precio del plan. Llevas ${marked.length} de ${plan.pick}.`;
                } else if (picks) {
                    form.querySelector('#cfgPlanModulesTitle').textContent = 'Elige tus módulos';
                    form.querySelector('#cfgPlanModulesNote').textContent  = 'Pagas solo los que marques. Precios al mes, sin IVA.';
                }

                const amount = plan.mode === 'custom' ? marked.reduce((sum, el) => sum + Number(el.dataset.price), 0) : plan.price;

                total.innerHTML = `
                    <span class="pg-dim pg-small">Tu siguiente pago</span>
                    <span class="pg-strong">${amount > 0 ? Page.esc(Page.money(amount, plan.currency)) + ' <span class="pg-dim pg-small">' + Page.esc(CFG_CICLOS[plan.cycle] || '') + ' · más IVA</span>' : '—'}</span>`;
            };

            form.addEventListener('change', paint);
            paint();
        },
        onSubmit: async (data, form) => {
            const modules = Array.from(form.querySelectorAll('[data-module]:checked')).map((el) => Number(el.dataset.module));
            const saved   = await Page.post(CFG_API, { opc: 'changePlan', plan_id: data.plan_id || 0, modules: JSON.stringify(modules) });

            if (saved.status === 200) {
                cfgToast(saved.message, true);
                // El plan cambia lo que muestran todas las pestañas (topes, modulos,
                // permisos, las tarjetas que se pueden poner en el inicio).
                cfg.data = {};
                cfg.home = null;
                if (!saved.unchanged) cfgPagos();
            }

            return saved;
        }
    });
}

// =============================================================== Mi inicio

/*  El dueño elige que tarjetas ve al entrar y las acomoda arrastrandolas
    (ctrl-configuracion :: homeLayout). El tablero de la izquierda es su inicio
    en chiquito, con las tres zonas de verdad (HM_ZONES); a la derecha, todas
    las tarjetas agrupadas por modulo: las de lo que contrato se pueden poner,
    las de otros modulos se ven con candado.

    Nada se guarda hasta «Guardar». Mientras tanto el borrador vive en
    cfg.home y sobrevive al cambiar de pestaña; al salir de la pagina con
    cambios, el navegador pregunta.

    Arrastrar va con Pointer Events (mouse, dedo y pluma) y no con el
    drag-and-drop de HTML, que en el celular no funciona. Con el dedo se
    arrastra desde el ⋮⋮ (o el icono, en la lista): el resto de la tarjeta deja
    desplazar la pagina. Con el teclado, el ⋮⋮ se mueve con ↑ ↓ y Supr la
    quita. */
const HM_ZONES = [
    { id: 'top',  label: 'Arriba',            hint: 'a todo lo ancho' },
    { id: 'main', label: 'Columna principal', hint: 'la parte ancha' },
    { id: 'side', label: 'Columna lateral',   hint: 'angosta; en el celular va debajo' }
];

async function cfgInicio() {
    // Con cambios sin guardar, volver a la pestaña no los pierde.
    if (cfg.home && hmDirty()) return hmRender();

    const d = await cfgLoad('inicio', 'homeLayout');
    if (!d) return;

    const layout = hmFromList(d.layout);

    cfg.home = {
        data:    d,
        widgets: Object.fromEntries(d.widgets.map((w) => [w.code, w])),
        groups:  Object.fromEntries(d.groups.map((g) => [g.key, g])),
        layout:  layout,
        saved:   JSON.stringify(layout),
        custom:  !!d.custom
    };

    hmRender();
}

// [{code, zone}] -> { top: [codes], main: [...], side: [...] }
function hmFromList(list) {
    const layout = { top: [], main: [], side: [] };
    list.forEach((x) => { if (layout[x.zone]) layout[x.zone].push(x.code); });
    return layout;
}

// El acomodo en el orden en que se ve: lo que se guarda.
function hmList() {
    const out = [];
    HM_ZONES.forEach((z) => cfg.home.layout[z.id].forEach((code) => out.push({ code: code, zone: z.id })));
    return out;
}

function hmDirty() {
    return JSON.stringify(cfg.home.layout) !== cfg.home.saved;
}

function hmZoneOf(code) {
    return HM_ZONES.map((z) => z.id).find((id) => cfg.home.layout[id].includes(code)) || null;
}

/*  Pinta el editor completo. o.focus: selector a enfocar despues (el ⋮⋮ de la
    tarjeta que se movio con el teclado). o.say: lo que se anuncia al lector
    de pantalla. o.flash: code de la tarjeta recien puesta, para resaltarla. */
function hmRender(o) {
    o = o || {};

    const h     = cfg.home;
    const count = hmList().length;
    const dirty = hmDirty();
    const added = new Set(hmList().map((x) => x.code));

    const groups = Object.values(h.groups);
    const mine   = groups.filter((g) => g.on);
    const others = groups.filter((g) => !g.on);

    const palette = mine.map((g) => hmGroup(g, added)).join('')
        + (others.length ? `
            <div class="pg-hm-others">
                <p class="pg-strong pg-small">Con otros módulos</p>
                <p class="pg-dim pg-small">Agrega el módulo a tu plan para poder ponerlas en tu inicio.</p>
            </div>
            ${others.map((g) => hmGroup(g, added)).join('')}
            <a class="pg-link" href="#pagos"><span>Ver planes y módulos</span><i data-lucide="arrow-right"></i></a>` : '');

    cfgPanel(`
        <div class="pg-card" id="hmEditor">
            <div class="pg-card-head pg-toolbar">
                <div>
                    <p class="pg-card-title">Tu pantalla de inicio</p>
                    <p class="pg-dim pg-small">Elige qué quieres ver al entrar y acomódalo arrastrando las tarjetas. Cada módulo que tienes trae las suyas.</p>
                </div>
                <div class="pg-toolbar-side">
                    ${dirty ? '<button type="button" class="pg-btn is-ghost" id="hmDiscard"><i data-lucide="undo-2"></i>Descartar cambios</button>' : ''}
                    ${h.custom && !dirty ? '<button type="button" class="pg-btn is-ghost" id="hmReset"><i data-lucide="rotate-ccw"></i>Volver al de fábrica</button>' : ''}
                    <button type="button" class="pg-btn is-primary" id="hmSave" ${dirty && count ? '' : 'disabled'}><i data-lucide="check"></i>Guardar</button>
                </div>
            </div>
            ${h.data.viewing ? '<p class="pg-trial" style="margin-bottom:16px"><i data-lucide="info"></i><span>Estás acomodando <b>tu</b> inicio en esta empresa; el dueño acomoda el suyo desde su cuenta.</span></p>' : ''}
            <div class="pg-hm">
                <section class="pg-hm-board" aria-label="Así se verá tu inicio">
                    <div class="pg-hm-screen">
                        <div class="pg-hm-bar" aria-hidden="true"><span></span><span></span><span></span><p>Tu inicio</p></div>
                        <div class="pg-hm-fixed"><i data-lucide="lock-keyhole"></i><span>Tu saludo y los avisos de tu plan</span><span class="pg-dim">· siempre van arriba</span></div>
                        ${hmZone('top')}
                        <div class="pg-hm-cols">${hmZone('main')}${hmZone('side')}</div>
                    </div>
                    <p class="pg-dim pg-small pg-hm-help">
                        <span><i data-lucide="grip-vertical"></i>Arrastra desde aquí para mover · con el teclado, ↑ ↓ mueven y Supr quita</span>
                        <span class="${count ? '' : 'pg-msg is-err'}">${count ? `${count} de ${h.data.max} tarjetas` : 'Deja al menos una tarjeta'}</span>
                    </p>
                </section>
                <aside class="pg-hm-palette" data-palette aria-label="Tarjetas disponibles">
                    <div>
                        <p class="pg-card-title">Tarjetas disponibles</p>
                        <p class="pg-dim pg-small">Arrástralas a tu inicio o pulsa <b>+</b>.</p>
                    </div>
                    <p class="pg-hm-out"><i data-lucide="trash-2"></i>Suéltala aquí para quitarla</p>
                    ${palette}
                </aside>
            </div>
            <p class="pg-sr" id="hmLive" aria-live="polite"></p>
        </div>`);

    const editor = document.getElementById('hmEditor');

    editor.addEventListener('click', hmClick);
    editor.addEventListener('keydown', hmKey);
    hmDrag(editor);

    if (o.flash) {
        const tile = editor.querySelector(`.pg-hm-tile[data-code="${o.flash}"]`);
        if (tile) {
            tile.classList.add('is-new');
            tile.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    if (o.focus) {
        const el = editor.querySelector(o.focus);
        if (el) el.focus();
    }

    if (o.say) hmSay(o.say);
}

function hmZone(id) {
    const z = HM_ZONES.find((x) => x.id === id);

    return `
        <div class="pg-hm-zone is-${id}">
            <p class="pg-hm-zone-label">${z.label}<span>${z.hint}</span></p>
            <div class="pg-hm-list" data-list="${id}" aria-label="${Page.esc(z.label)}">
                ${cfg.home.layout[id].map(hmTile).join('')}
                <p class="pg-hm-empty">Suelta aquí una tarjeta</p>
            </div>
        </div>`;
}

// Una tarjeta puesta en el tablero.
function hmTile(code) {
    const w = cfg.home.widgets[code];
    const g = cfg.home.groups[w.group];

    return `
        <div class="pg-hm-tile" data-drag data-code="${Page.esc(code)}">
            <button type="button" class="pg-hm-grip" data-handle title="Arrastra para mover" aria-label="Mover ${Page.esc(w.name)}. Flechas arriba y abajo para moverla, Suprimir para quitarla."><i data-lucide="grip-vertical"></i></button>
            <span class="pg-hm-ico"><i data-lucide="${Page.esc(w.icon)}"></i></span>
            <span class="pg-hm-name"><span class="pg-ellipsis">${Page.esc(w.name)}</span><span class="pg-hm-mod pg-ellipsis">${Page.esc(g ? g.name : 'General')}</span></span>
            <button type="button" class="pg-hm-x" data-remove="${Page.esc(code)}" title="Quitar de mi inicio" aria-label="Quitar ${Page.esc(w.name)} de mi inicio"><i data-lucide="x"></i></button>
        </div>`;
}

// Un grupo de la lista: General o un modulo, con sus tarjetas.
function hmGroup(g, added) {
    const items = cfg.home.data.widgets.filter((w) => w.group === g.key);

    return `
        <div class="pg-hm-group ${g.on ? '' : 'is-locked'}">
            <p class="pg-hm-group-title"><i data-lucide="${Page.esc(g.icon)}"></i><span>${Page.esc(g.name)}</span>${g.on ? '' : '<i data-lucide="lock" class="pg-hm-lock"></i>'}</p>
            ${items.map((w) => hmItem(w, added.has(w.code))).join('')}
        </div>`;
}

function hmItem(w, added) {
    const text = `
        <span class="pg-row-text">
            <span class="pg-strong pg-ellipsis">${Page.esc(w.name)}</span>
            <span class="pg-dim pg-hm-text">${Page.esc(w.text)}</span>
        </span>`;

    if (!w.on) {
        return `
            <div class="pg-hm-item is-locked" title="Disponible con el módulo ${Page.esc((cfg.home.groups[w.group] || {}).name || '')}">
                <span class="pg-hm-ico"><i data-lucide="${Page.esc(w.icon)}"></i></span>
                ${text}
            </div>`;
    }

    if (added) {
        return `
            <div class="pg-hm-item is-added">
                <span class="pg-hm-ico"><i data-lucide="${Page.esc(w.icon)}"></i></span>
                ${text}
                <button type="button" class="pg-hm-add is-on" data-remove="${Page.esc(w.code)}" title="Ya está en tu inicio · pulsa para quitarla" aria-label="Quitar ${Page.esc(w.name)} de mi inicio">
                    <span class="pg-hm-add-on"><i data-lucide="check"></i></span><span class="pg-hm-add-off"><i data-lucide="x"></i></span>
                </button>
            </div>`;
    }

    return `
        <div class="pg-hm-item" data-drag data-code="${Page.esc(w.code)}">
            <span class="pg-hm-ico" data-handle><i data-lucide="${Page.esc(w.icon)}"></i></span>
            ${text}
            <button type="button" class="pg-hm-add" data-add="${Page.esc(w.code)}" title="Agregar a mi inicio" aria-label="Agregar ${Page.esc(w.name)} a mi inicio"><i data-lucide="plus"></i></button>
        </div>`;
}

function hmSay(text) {
    const live = document.getElementById('hmLive');
    if (live) live.textContent = text;
}

function hmZoneLabel(id) {
    return (HM_ZONES.find((z) => z.id === id) || {}).label || '';
}

// "Ventas de hoy: lugar 2 de 4 en Columna principal".
function hmWhere(code) {
    const zone = hmZoneOf(code);
    const list = cfg.home.layout[zone];
    return `${cfg.home.widgets[code].name}: lugar ${list.indexOf(code) + 1} de ${list.length} en ${hmZoneLabel(zone)}`;
}

// -- Cambios al acomodo --

// La pone al final de su zona de siempre.
function hmAdd(code) {
    const w = cfg.home.widgets[code];
    if (!w || !w.on || hmZoneOf(code)) return;

    if (hmList().length >= cfg.home.data.max) return cfgToast(`Tu inicio admite hasta ${cfg.home.data.max} tarjetas. Quita alguna para agregar otra.`, false);

    cfg.home.layout[w.zone].push(code);
    hmRender({ flash: code, say: `Agregaste ${w.name} en ${hmZoneLabel(w.zone)}.` });
}

function hmRemove(code) {
    const zone = hmZoneOf(code);
    if (!zone) return;

    const list = cfg.home.layout[zone];
    const i    = list.indexOf(code);

    list.splice(i, 1);

    // Con el teclado, el foco pasa a la que quedo en su lugar (o a la de antes).
    const next = list[i] || list[i - 1];

    hmRender({
        say:   `Quitaste ${cfg.home.widgets[code].name} de tu inicio.`,
        focus: next ? `.pg-hm-tile[data-code="${next}"] [data-handle]` : null
    });
}

// La lleva a `zone`, en la posicion `index` (contada sin ella).
function hmMove(code, zone, index) {
    const w = cfg.home.widgets[code];
    if (!w || !w.zones.includes(zone)) return hmRender();

    const from = hmZoneOf(code);
    if (from) cfg.home.layout[from].splice(cfg.home.layout[from].indexOf(code), 1);
    else if (hmList().length >= cfg.home.data.max) {
        hmRender();
        return cfgToast(`Tu inicio admite hasta ${cfg.home.data.max} tarjetas. Quita alguna para agregar otra.`, false);
    }

    cfg.home.layout[zone].splice(Math.max(0, Math.min(index, cfg.home.layout[zone].length)), 0, code);

    hmRender({ flash: from ? null : code, say: hmWhere(code) });
}

/*  Con el teclado: un lugar arriba o abajo. En la orilla de su zona salta a
    la siguiente que la acepte (Arriba -> Principal -> Lateral). */
function hmStep(code, dir) {
    const L    = cfg.home.layout;
    const w    = cfg.home.widgets[code];
    const zone = hmZoneOf(code);
    const i    = L[zone].indexOf(code);
    const keep = { focus: `.pg-hm-tile[data-code="${code}"] [data-handle]` };

    if (L[zone][i + dir] !== undefined) {
        L[zone][i]       = L[zone][i + dir];
        L[zone][i + dir] = code;
        return hmRender(Object.assign(keep, { say: hmWhere(code) }));
    }

    const ids = HM_ZONES.map((z) => z.id);

    for (let k = ids.indexOf(zone) + dir; k >= 0 && k < ids.length; k += dir) {
        if (!w.zones.includes(ids[k])) continue;

        L[zone].splice(i, 1);
        if (dir > 0) L[ids[k]].unshift(code);
        else L[ids[k]].push(code);

        return hmRender(Object.assign(keep, { say: hmWhere(code) }));
    }

    hmSay(dir < 0 ? `${w.name} ya está hasta arriba.` : `${w.name} ya está hasta abajo.`);
}

// -- Botones --

async function hmClick(e) {
    const add = e.target.closest('[data-add]');
    if (add) return hmAdd(add.dataset.add);

    const remove = e.target.closest('[data-remove]');
    if (remove) return hmRemove(remove.dataset.remove);

    if (e.target.closest('#hmSave'))    return hmSave(e.target.closest('#hmSave'));
    if (e.target.closest('#hmDiscard')) return hmDiscard();
    if (e.target.closest('#hmReset'))   return hmReset();
}

function hmKey(e) {
    const grip = e.target.closest('.pg-hm-tile [data-handle]');
    if (!grip) return;

    const code = grip.closest('[data-code]').dataset.code;

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        hmStep(code, e.key === 'ArrowUp' ? -1 : 1);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        hmRemove(code);
    }
}

async function hmSave(btn) {
    btn.disabled = true;

    const res = await Page.post(CFG_API, { opc: 'saveHomeLayout', layout: JSON.stringify(hmList()) });

    if (res.status !== 200) {
        btn.disabled = false;
        return cfgToast(res.message || 'No se pudo guardar tu inicio. Inténtalo de nuevo.', false);
    }

    cfg.home.saved  = JSON.stringify(cfg.home.layout);
    cfg.home.custom = true;

    hmRender();
    cfgToast(res.message, true);
}

function hmDiscard() {
    cfg.home.layout = JSON.parse(cfg.home.saved);
    hmRender({ say: 'Descartaste tus cambios.' });
}

async function hmReset() {
    if (!await cfgAsk('¿Volver al inicio de fábrica?', 'Tu inicio volverá a traer las tarjetas que trae Huubie, cada una en su lugar de siempre.', 'Sí, volver')) return;

    const res = await Page.post(CFG_API, { opc: 'resetHomeLayout' });

    cfgToast(res.message || 'No se pudo restablecer tu inicio.', res.status === 200);
    if (res.status !== 200) return;

    cfg.home = null;
    delete cfg.data.inicio;
    cfgInicio();
}

// Salir de la pagina con cambios sin guardar: que el navegador pregunte.
window.addEventListener('beforeunload', (e) => {
    if (cfg.home && hmDirty()) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// -- Arrastrar --

/*  Una tarjeta del tablero o de la lista se arrastra a una zona. Mientras se
    arrastra, la sigue una copia (ghost) y el lugar donde caeria se marca: en
    el tablero es la misma tarjeta, apagada; desde la lista, un hueco nuevo.
    Las zonas donde esa tarjeta no cabe se apagan. Soltar una del tablero
    sobre la lista la quita. Escape cancela. Al soltar, el cambio pasa al
    acomodo (hmMove / hmRemove) y el editor se vuelve a pintar. */
function hmDrag(editor) {
    let s = null;

    const lists = () => editor.querySelectorAll('[data-list]');

    const start = () => {
        const r = s.item.getBoundingClientRect();

        s.dx = s.x - r.left;
        s.dy = s.y - r.top;

        s.ghost = s.item.cloneNode(true);
        s.ghost.classList.add('is-floating');
        s.ghost.removeAttribute('data-drag');
        s.ghost.setAttribute('aria-hidden', 'true');
        s.ghost.style.width = r.width + 'px';
        editor.appendChild(s.ghost);

        if (s.board) {
            s.ph = s.item;
            s.item.classList.add('is-ph');
        } else {
            s.ph = document.createElement('div');
            s.ph.className = 'pg-hm-ph';
        }

        const zones = cfg.home.widgets[s.code].zones;
        lists().forEach((l) => l.classList.toggle('is-deny', !zones.includes(l.dataset.list)));

        editor.classList.add('is-dragging', s.board ? 'from-board' : 'from-palette');
        s.scroller = hmScroller(editor);
        s.on = true;
        s.raf = requestAnimationFrame(tick);
    };

    // Mueve la copia y el hueco al lugar bajo el puntero.
    const place = (x, y) => {
        s.ghost.style.transform = `translate(${x - s.dx}px, ${y - s.dy}px)`;

        const hit  = document.elementFromPoint(x, y);
        const list = hit && hit.closest('[data-list]');
        const out  = s.board && !!(hit && hit.closest('[data-palette]'));

        s.valid = !!list && !list.classList.contains('is-deny');

        editor.classList.toggle('is-out', out);
        editor.classList.toggle('is-lost', s.board && !s.valid && !out);
        lists().forEach((l) => l.classList.toggle('is-over', l === list && s.valid));

        if (!s.valid) {
            // Fuera de una zona: el hueco de una de la lista desaparece; la del
            // tablero se queda apagada y, si se suelta aqui, vuelve a su lugar.
            if (!s.board && s.ph.parentNode) s.ph.remove();
            return;
        }

        const tiles  = Array.from(list.querySelectorAll(':scope > .pg-hm-tile')).filter((t) => t !== s.ph);
        const before = tiles.find((t) => { const r = t.getBoundingClientRect(); return y < r.top + r.height / 2; })
                    || list.querySelector(':scope > .pg-hm-empty');

        if (s.ph.parentNode !== list || s.ph.nextElementSibling !== before) list.insertBefore(s.ph, before);
    };

    // Cerca de la orilla de arriba o de abajo, la pagina se desplaza sola.
    const tick = () => {
        if (!s || !s.on) return;

        const sc   = s.scroller;
        const root = sc === document.scrollingElement;
        const top  = root ? 0 : sc.getBoundingClientRect().top;
        const bot  = root ? window.innerHeight : sc.getBoundingClientRect().bottom;
        const edge = 70;

        let dy = 0;
        if (s.cy < top + edge)      dy = -Math.ceil((top + edge - s.cy) / 5);
        else if (s.cy > bot - edge) dy = Math.ceil((s.cy - (bot - edge)) / 5);

        if (dy) {
            sc.scrollTop += dy;
            place(s.cx, s.cy);
        }

        s.raf = requestAnimationFrame(tick);
    };

    const finish = () => {
        cancelAnimationFrame(s.raf);

        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('keydown', esc, true);

        if (s.ghost) s.ghost.remove();
        if (!s.board && s.ph && s.ph.parentNode) s.ph.remove();
        if (s.board) s.item.classList.remove('is-ph');

        editor.classList.remove('is-dragging', 'from-board', 'from-palette', 'is-out', 'is-lost');
        lists().forEach((l) => l.classList.remove('is-deny', 'is-over'));

        s = null;
    };

    const move = (e) => {
        if (!s || e.pointerId !== s.pointer) return;

        s.cx = e.clientX;
        s.cy = e.clientY;

        // Un clic no es arrastre: hasta que se mueve unos pixeles.
        if (!s.on) {
            if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return;
            start();
        }

        e.preventDefault();
        place(e.clientX, e.clientY);
    };

    const up = (e) => {
        if (!s || e.pointerId !== s.pointer) return;

        if (!s.on) return finish();

        // Soltada fuera de una zona (y no sobre la lista para quitarla): no cambia nada.
        if (!s.valid && !editor.classList.contains('is-out')) return cancel();

        const code = s.code;
        const out  = s.board && editor.classList.contains('is-out');
        const list = s.ph.parentNode && s.ph.parentNode.matches('[data-list]') ? s.ph.parentNode : null;
        const at   = list ? Array.from(list.children).filter((c) => c.matches('.pg-hm-tile, .pg-hm-ph')).indexOf(s.ph) : -1;

        finish();

        if (out) hmRemove(code);
        else if (list) hmMove(code, list.dataset.list, at);
        else hmRender();
    };

    const cancel = () => {
        const was = s && s.on;
        finish();
        if (was) hmRender();
    };

    const esc = (e) => {
        if (e.key !== 'Escape' || !s) return;
        e.preventDefault();
        e.stopPropagation();
        cancel();
    };

    editor.addEventListener('pointerdown', (e) => {
        if (s || e.button !== 0) return;

        const item = e.target.closest('[data-drag]');
        if (!item || !editor.contains(item)) return;

        // Quitar y + son botones; el ⋮⋮ si arrastra.
        if (e.target.closest('button:not([data-handle]), a')) return;

        // Con el dedo o la pluma, solo desde el ⋮⋮ (o el icono, en la lista).
        if (e.pointerType !== 'mouse' && !e.target.closest('[data-handle]')) return;

        s = { item: item, code: item.dataset.code, board: !!item.closest('[data-list]'), pointer: e.pointerId, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, on: false };

        window.addEventListener('pointermove', move, { passive: false });
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', cancel);
        window.addEventListener('keydown', esc, true);
    });
}

// Quien se desplaza: en estas paginas, #main__content (general.css), no la ventana.
function hmScroller(el) {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const o = getComputedStyle(n).overflowY;
        if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n;
    }

    return document.scrollingElement || document.documentElement;
}
