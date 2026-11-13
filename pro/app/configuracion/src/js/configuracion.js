/*  Configuración de la empresa: lo que su dueño administra por su cuenta.

    Una pagina con pestañas, cada una con su ancla (#sucursales) para poder
    llegar directo desde el inicio o la barra:

      Empresa        nombre, logo y datos fiscales
      Sucursales     agregar, renombrar, activar y desactivar
      Usuarios       su gente: a que sucursal entra cada quien y con que rol
      Roles          los roles propios y lo que deja hacer cada uno
      Plan y pagos   el plan, pagar, la forma de pago y el historial

    Cada pestaña pide lo suyo al abrirse (ctrl-configuracion) y se vuelve a
    pedir despues de cada cambio: la lista en pantalla siempre es la del
    servidor. Los formularios de alta y edicion van en un modal (cfgModal). */
const CFG_API = 'ctrl/ctrl-configuracion.php';

const CFG_TABS = [
    { id: 'empresa',    icon: 'building-2',   label: 'Empresa' },
    { id: 'sucursales', icon: 'store',        label: 'Sucursales' },
    { id: 'usuarios',   icon: 'users',        label: 'Usuarios' },
    { id: 'roles',      icon: 'shield-check', label: 'Roles y permisos' },
    { id: 'pagos',      icon: 'credit-card',  label: 'Plan y pagos' }
];

const CFG_PAGOS   = { paid: ['Pagado', 'is-ok'], pending: ['Pendiente', 'is-warn'], failed: ['Rechazado', 'is-bad'], refunded: ['Reembolsado', 'is-off'] };
const CFG_PLAN    = { active: ['Activo', 'is-ok'], trial: ['En prueba', 'is-ok'], past_due: ['Pago vencido', 'is-warn'], cancelled: ['Cancelado', 'is-off'], expired: ['Expirado', 'is-off'] };
const CFG_CICLOS  = { monthly: 'al mes', yearly: 'al año', lifetime: 'pago único' };
const CFG_METODOS = { stripe: 'Tarjeta (Stripe)', manual: 'Registro manual', transfer: 'Transferencia', cash: 'Efectivo' };

// Lo que contesto init (la empresa, los catalogos) y lo ultimo de cada pestaña.
const cfg = { base: null, data: {} };

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
    cfgRoute();
});

// -- Pestañas --

function cfgTab() {
    const id = window.location.hash.replace('#', '');
    return CFG_TABS.some((t) => t.id === id) ? id : 'empresa';
}

function cfgRoute() {
    const tab = cfgTab();

    document.querySelectorAll('.pg-tab').forEach((el) => {
        const on = el.dataset.tab === tab;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    ({ empresa: cfgEmpresa, sucursales: cfgSucursales, usuarios: cfgUsuarios, roles: cfgRoles, pagos: cfgPagos })[tab]();
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

/*  Modal con un formulario. onSubmit(datos, form) devuelve la respuesta del
    servidor: con 200 se cierra; si no, enseña el mensaje y enfoca el campo
    que el servidor señalo (res.field). Sin onSubmit es solo de consulta. */
function cfgModal(o) {
    const wrap = document.createElement('div');

    wrap.className = 'pg-modal';
    wrap.innerHTML = `
        <div class="pg-modal-bg" data-close></div>
        <form class="pg-modal-box ${o.wide ? 'is-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="cfgModalTitle" novalidate>
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
        <div class="pg-grid">
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
            <td data-label="Estado"><span class="pg-chip ${b.active ? 'is-ok' : 'is-off'}">${b.active ? 'Activa' : 'Inactiva'}</span></td>
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
                    <thead><tr><th>Sucursal</th><th class="pg-td-num">Personas</th><th>Estado</th><th></th></tr></thead>
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

    const rows = d.users.map((u) => {
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

    cfgPanel(`
        <div class="pg-card">
            <div class="pg-card-head pg-toolbar">
                <div>
                    <p class="pg-card-title">Usuarios</p>
                    <p class="pg-dim pg-small">Quién entra a Huubie, a qué sucursal y con qué rol.</p>
                </div>
                <div class="pg-toolbar-side">
                    ${cfgUsage('users', 'activos', d.limits.users)}
                    <button type="button" class="pg-btn is-primary" id="btnAddUser"><i data-lucide="user-plus"></i>Agregar usuario</button>
                </div>
            </div>
            <div class="pg-table-wrap">
                <table class="pg-table">
                    <thead><tr><th>Persona</th><th>Accesos</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`);

    const panel = document.getElementById('cfgPanel');

    document.getElementById('btnAddUser').addEventListener('click', () => cfgUserForm(null, d));

    panel.querySelectorAll('[data-edit]').forEach((el) => el.addEventListener('click', () => {
        cfgUserForm(d.users.find((u) => u.id === Number(el.dataset.edit)), d);
    }));

    panel.querySelectorAll('[data-toggle]').forEach((el) => el.addEventListener('click', async () => {
        const u      = d.users.find((x) => x.id === Number(el.dataset.toggle));
        const active = u.status === 'active';

        if (active && !await cfgAsk(`¿Desactivar a ${u.name}?`, 'Ya no podrá entrar a Huubie. Su historial se conserva y puedes activarlo cuando quieras.', 'Sí, desactivar')) return;

        const res = await Page.post(CFG_API, { opc: 'toggleUser', id: u.id, active: active ? 0 : 1 });

        cfgToast(res.message || 'No se pudo cambiar el estado.', res.status === 200);
        if (res.status === 200) cfgRefresh('usuarios', cfgUsuarios);
    }));
}

function cfgUserForm(u, d) {
    const color = (u && u.color) || '';

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
                ${cfgField('email', 'Correo', u ? u.email : '', 'type="email" maxlength="120" autocomplete="off" required placeholder="nombre@empresa.com"')}
                ${cfgField('password', u ? 'Nueva contraseña' : 'Contraseña', '', `type="password" maxlength="72" autocomplete="new-password" placeholder="${u ? 'Déjala vacía para no cambiarla' : 'Mínimo 8 caracteres'}"`)}
                <div class="pg-field is-wide">
                    <span class="pg-label">Color de su avatar</span>
                    <div class="pg-swatches" id="cfgColors">
                        ${cfg.base.colors.map((c) => `<button type="button" class="pg-swatch ${c === color ? 'is-on' : ''}" data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}
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
            form.querySelector('#cfgColors').addEventListener('click', (e) => {
                const swatch = e.target.closest('.pg-swatch');
                if (!swatch) return;

                form.querySelectorAll('.pg-swatch').forEach((el) => el.classList.toggle('is-on', el === swatch));
                form.querySelector('[name="color"]').value = swatch.dataset.color;
            });
        },
        onSubmit: async (data, form) => {
            const access = Array.from(form.querySelectorAll('[data-branch]'))
                .filter((el) => el.value !== '')
                .map((el) => ({ branch_id: Number(el.dataset.branch), role_id: Number(el.value) }));

            const res = await Page.post(CFG_API, { opc: 'saveUser', id: u ? u.id : 0, ...data, access: JSON.stringify(access) });

            if (res.status === 200) {
                cfgToast(res.message, true);
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

// =================================================================== Roles

async function cfgRoles() {
    const d = await cfgLoad('roles', 'roles');
    if (!d) return;

    const rows = d.roles.map((r) => `
        <tr class="${r.active ? '' : 'is-off'}">
            <td>
                <div class="pg-row">
                    <span class="pg-ico"><i data-lucide="${r.system ? 'shield' : 'shield-check'}"></i></span>
                    <div class="pg-row-text">
                        <p class="pg-strong pg-ellipsis">${Page.esc(r.name)}</p>
                        <p class="pg-dim pg-small">${r.system ? 'De Huubie · igual para todas las empresas' : 'Propio de tu empresa'}</p>
                    </div>
                </div>
            </td>
            <td class="pg-td-num" data-label="Personas">${r.users}</td>
            <td data-label="Estado"><span class="pg-chip ${r.active ? 'is-ok' : 'is-off'}">${r.active ? 'Activo' : 'Inactivo'}</span></td>
            <td class="pg-td-actions">
                <button type="button" class="pg-btn is-ghost is-round" data-edit="${r.id}" title="${r.system ? 'Ver permisos' : 'Editar'}" aria-label="${r.system ? 'Ver permisos de' : 'Editar'} ${Page.esc(r.name)}"><i data-lucide="${r.system ? 'eye' : 'pencil'}"></i></button>
                ${r.system ? '' : cfgSwitch(r.active, `data-toggle="${r.id}"`, r.active ? 'Desactivar' : 'Activar')}
            </td>
        </tr>`).join('');

    cfgPanel(`
        <div class="pg-card">
            <div class="pg-card-head pg-toolbar">
                <div>
                    <p class="pg-card-title">Roles y permisos</p>
                    <p class="pg-dim pg-small">Un rol dice qué puede ver y hacer alguien. Se asigna por sucursal en Usuarios.</p>
                </div>
                <div class="pg-toolbar-side">
                    <button type="button" class="pg-btn is-primary" id="btnAddRole"><i data-lucide="plus"></i>Crear rol</button>
                </div>
            </div>
            <div class="pg-table-wrap">
                <table class="pg-table">
                    <thead><tr><th>Rol</th><th class="pg-td-num">Personas</th><th>Estado</th><th></th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="4"><div class="pg-empty"><i data-lucide="shield"></i>Todavía no hay roles.</div></td></tr>'}</tbody>
                </table>
            </div>
        </div>`);

    const panel = document.getElementById('cfgPanel');

    document.getElementById('btnAddRole').addEventListener('click', () => cfgRoleForm(0));

    panel.querySelectorAll('[data-edit]').forEach((el) => el.addEventListener('click', () => cfgRoleForm(Number(el.dataset.edit))));

    panel.querySelectorAll('[data-toggle]').forEach((el) => el.addEventListener('click', async () => {
        const r   = d.roles.find((x) => x.id === Number(el.dataset.toggle));
        const res = await Page.post(CFG_API, { opc: 'toggleRole', id: r.id, active: r.active ? 0 : 1 });

        cfgToast(res.message || 'No se pudo cambiar el estado.', res.status === 200);
        if (res.status === 200) cfgRefresh('roles', cfgRoles);
    }));
}

// El rol con su arbol de permisos: modulo > seccion > acciones. Los del sistema solo se consultan.
async function cfgRoleForm(id) {
    const res = await Page.post(CFG_API, { opc: 'getRole', id: id });

    if (res.status !== 200) return cfgToast(res.message || 'No se pudo abrir el rol.', false);

    const role = res.data;
    const lock = role.system ? 'disabled' : '';

    const tree = role.modules.map((m) => `
        <div class="pg-tree-mod">
            <p class="pg-tree-title"><i data-lucide="${Page.esc(m.icon)}"></i>${Page.esc(m.name)}</p>
            ${m.sections.map((s) => `
                <div class="pg-tree-sec">
                    <label class="pg-tree-all">
                        <input type="checkbox" data-all ${lock} ${s.actions.every((a) => a.granted) ? 'checked' : ''}>
                        <span>${Page.esc(s.name)}</span>
                    </label>
                    <div class="pg-tree-acts">
                        ${s.actions.map((a) => `<label class="pg-check"><input type="checkbox" data-perm="${a.id}" ${lock} ${a.granted ? 'checked' : ''}><span>${Page.esc(a.name)}</span></label>`).join('')}
                    </div>
                </div>`).join('')}
        </div>`).join('');

    cfgModal({
        title:  role.system ? role.name : (id ? 'Editar rol' : 'Nuevo rol'),
        sub:    role.system ? 'Rol de Huubie: lo comparten todas las empresas y no se modifica aquí.' : 'Marca lo que este rol puede ver y hacer en cada sección.',
        submit: id ? 'Guardar' : 'Crear rol',
        wide:   true,
        body: `
            <div class="pg-form is-one">
                ${role.system ? '' : cfgField('name', 'Nombre del rol', role.name, 'maxlength="60" required placeholder="Ej. Encargado de sucursal"')}
                <div class="pg-tree">${tree || '<div class="pg-empty"><i data-lucide="layout-grid"></i>Tu plan todavía no tiene secciones con permisos.</div>'}</div>
            </div>`,
        onOpen: (form) => {
            // La casilla de la seccion marca o desmarca todas sus acciones, y se
            // queda a medias (indeterminate) cuando solo hay algunas.
            const sync = (sec) => {
                const boxes = Array.from(sec.querySelectorAll('[data-perm]'));
                const all   = sec.querySelector('[data-all]');
                const on    = boxes.filter((b) => b.checked).length;

                all.checked       = on === boxes.length && on > 0;
                all.indeterminate = on > 0 && on < boxes.length;
            };

            form.querySelectorAll('.pg-tree-sec').forEach((sec) => {
                sync(sec);

                sec.addEventListener('change', (e) => {
                    if (e.target.matches('[data-all]')) sec.querySelectorAll('[data-perm]').forEach((b) => { b.checked = e.target.checked; });
                    sync(sec);
                });
            });
        },
        onSubmit: role.system ? null : async (data, form) => {
            const permissions = Array.from(form.querySelectorAll('[data-perm]:checked')).map((el) => Number(el.dataset.perm));
            const saved       = await Page.post(CFG_API, { opc: 'saveRole', id: id, name: data.name, permissions: JSON.stringify(permissions) });

            if (saved.status === 200) {
                cfgToast(saved.message, true);
                cfgRefresh('roles', cfgRoles);
            }

            return saved;
        }
    });
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
        <div class="pg-grid">
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
                // El plan cambia lo que muestran todas las pestañas (topes, modulos, permisos).
                cfg.data = {};
                if (!saved.unchanged) cfgPagos();
            }

            return saved;
        }
    });
}
