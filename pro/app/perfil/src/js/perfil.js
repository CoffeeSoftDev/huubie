/*  Mi perfil. A la izquierda la ficha (foto, nombre, puesto e informacion
    general); a la derecha lo que la persona puede cambiar: sus datos, su
    contraseña y el color de su avatar.

    Dos fuentes para la misma persona: su cuenta (users) y su ficha de Capital
    Humano (employees). Lo de trabajo -- puesto, area, ingreso -- solo se
    muestra: lo lleva la empresa desde Capital Humano. root no tiene ficha: su
    perfil es solo la cuenta. */
const PERFIL_API = 'ctrl/ctrl-perfil.php';

let perfil = null;

$(() => loadPerfil());

async function loadPerfil() {
    const root = document.getElementById('root');

    if (!perfil) root.innerHTML = '<div class="pg-skel"></div><div class="pg-skel"></div>';

    const res = await Page.post(PERFIL_API, { opc: 'init' });

    if (res.status !== 200) {
        root.innerHTML = `<div class="pg-card"><div class="pg-empty"><i data-lucide="cloud-off"></i>${Page.esc(res.message || 'No se pudo cargar tu perfil.')}</div></div>`;
        Page.icons();
        return;
    }

    perfil = res.data;

    root.innerHTML = `
        <div class="pg-head">
            <div>
                <h1 class="pg-h1">Mi perfil</h1>
                <p class="pg-sub">Tus datos, como los ve tu empresa.</p>
            </div>
        </div>
        <div class="pg-grid">
            <div class="pg-col">${fichaCard()}</div>
            <div class="pg-col">
                ${perfil.work ? trabajoCard() : ''}
                ${datosCard()}
                ${passwordCard()}
            </div>
        </div>`;

    Page.icons();
    bindPerfil();
}

function fullName() {
    return `${perfil.account.name} ${perfil.account.last_name}`.trim();
}

function fact(label, value) {
    return `
        <div>
            <p class="pg-fact-label">${Page.esc(label)}</p>
            <p class="pg-fact-value ${value ? '' : 'is-empty'}">${Page.esc(value || 'Sin capturar')}</p>
        </div>`;
}

// -- Ficha (izquierda) --

function fichaCard() {
    const a = perfil.account;
    const w = perfil.work;
    const p = perfil.personal;

    const general = p ? `
        <div class="pg-list" style="margin-top:18px">
            <div class="pg-row"><div class="pg-row-text">${fact('Correo', a.email)}</div></div>
            <div class="pg-row"><div class="pg-row-text">${fact('Teléfono', p.phone)}</div></div>
            <div class="pg-row"><div class="pg-row-text">${fact('Cumpleaños', Page.date(p.birth_date))}</div></div>
            <div class="pg-row"><div class="pg-row-text">${fact('Dirección', p.address)}</div></div>
            <div class="pg-row"><div class="pg-row-text">${fact('Contacto de emergencia', [p.emergency_name, p.emergency_phone].filter(Boolean).join(' · '))}</div></div>
        </div>` : `
        <div class="pg-list" style="margin-top:18px">
            <div class="pg-row"><div class="pg-row-text">${fact('Correo', a.email)}</div></div>
        </div>`;

    return `
        <div class="pg-card">
            <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px">
                <span id="perfilAvatar">${Page.avatar({ name: fullName(), photo: a.photo, color: a.color }, 'xl')}</span>
                <div style="min-width:0;max-width:100%">
                    <p class="pg-strong" style="font-size:18px">${Page.esc(fullName())}</p>
                    <p class="pg-dim pg-small">${Page.esc((w && w.job_title) || a.rol || '')}</p>
                </div>
                <span class="pg-chip">${Page.esc(a.is_root ? 'Administrador de la plataforma' : (a.rol || 'Sin rol asignado'))}</span>
                <label class="pg-btn is-ghost" for="perfilPhoto" style="margin-top:4px"><i data-lucide="camera"></i>Cambiar foto</label>
                <input type="file" id="perfilPhoto" accept="image/jpeg,image/png,image/webp" hidden>
                <p class="pg-msg" id="photoMsg" hidden></p>
            </div>
            <p class="pg-card-title" style="margin-top:20px">Información general</p>
            ${general}
        </div>`;
}

// -- Trabajo (solo lectura) --

function trabajoCard() {
    const w = perfil.work;

    return `
        <div class="pg-card">
            <div class="pg-card-head">
                <p class="pg-card-title"><span class="pg-ico"><i data-lucide="briefcase"></i></span>Mi trabajo</p>
                <span class="pg-card-note">Lo administra Capital Humano</span>
            </div>
            <div class="pg-facts">
                ${fact('Puesto', w.job_title)}
                ${fact('Área', w.department)}
                ${fact('Empresa', w.company)}
                ${fact('Sucursal', w.branch)}
                ${fact('Fecha de ingreso', Page.date(w.hire_date))}
                ${fact('Antigüedad', w.seniority)}
            </div>
        </div>`;
}

// -- Mis datos --

function field(id, label, value, attrs, wide) {
    return `
        <div class="pg-field ${wide ? 'is-wide' : ''}">
            <label class="pg-label" for="${id}">${Page.esc(label)}</label>
            <input class="pg-input" id="${id}" name="${id}" value="${Page.esc(value || '')}" ${attrs || ''}>
        </div>`;
}

function datosCard() {
    const a = perfil.account;
    const p = perfil.personal;

    const swatches = perfil.colors.map((c) => `
        <button type="button" class="pg-swatch ${c.toUpperCase() === String(a.color).toUpperCase() ? 'is-on' : ''}" data-color="${Page.esc(c)}" style="background:${Page.esc(c)}" title="${Page.esc(c)}" aria-label="Color ${Page.esc(c)}"></button>`).join('');

    return `
        <div class="pg-card">
            <div class="pg-card-head">
                <p class="pg-card-title"><span class="pg-ico"><i data-lucide="user-round"></i></span>Mis datos</p>
            </div>
            <form class="pg-form" id="formDatos" novalidate>
                ${field('name', 'Nombre', a.name, 'maxlength="80" autocomplete="given-name" required')}
                ${field('last_name', 'Apellidos', a.last_name, 'maxlength="80" autocomplete="family-name"')}
                ${p ? field('phone', 'Teléfono', p.phone, 'type="tel" maxlength="20" autocomplete="tel"') : ''}
                ${p ? field('birth_date', 'Fecha de nacimiento', p.birth_date, 'type="date"') : ''}
                ${p ? field('address', 'Dirección', p.address, 'maxlength="255" autocomplete="street-address"', true) : ''}
                ${p ? field('emergency_name', 'Contacto de emergencia', p.emergency_name, 'maxlength="120"') : ''}
                ${p ? field('emergency_phone', 'Teléfono de emergencia', p.emergency_phone, 'type="tel" maxlength="20"') : ''}
                <div class="pg-field is-wide">
                    <span class="pg-label">Color de tu avatar (cuando no hay foto)</span>
                    <div class="pg-swatches" id="perfilColors">${swatches}</div>
                    <input type="hidden" id="color" name="color" value="${Page.esc(a.color || '')}">
                </div>
                <div class="pg-form-foot">
                    <p class="pg-msg" id="datosMsg" hidden></p>
                    <button type="submit" class="pg-btn is-primary"><i data-lucide="save"></i>Guardar cambios</button>
                </div>
            </form>
        </div>`;
}

// -- Contraseña --

function passwordCard() {
    return `
        <div class="pg-card">
            <div class="pg-card-head">
                <p class="pg-card-title"><span class="pg-ico"><i data-lucide="key-round"></i></span>Contraseña</p>
            </div>
            <form class="pg-form" id="formPassword" novalidate>
                ${field('current', 'Contraseña actual', '', 'type="password" autocomplete="current-password" required', true)}
                ${field('password', 'Contraseña nueva', '', 'type="password" autocomplete="new-password" minlength="6" required')}
                ${field('confirm', 'Repite la contraseña nueva', '', 'type="password" autocomplete="new-password" minlength="6" required')}
                <div class="pg-form-foot">
                    <p class="pg-msg" id="passwordMsg" hidden></p>
                    <button type="submit" class="pg-btn is-primary"><i data-lucide="lock"></i>Cambiar contraseña</button>
                </div>
            </form>
        </div>`;
}

// -- Eventos --

function say(id, res) {
    const el = document.getElementById(id);
    if (!el) return;

    el.hidden      = false;
    el.textContent = res.message || (res.status === 200 ? 'Listo.' : 'Ocurrió un error.');
    el.className   = 'pg-msg ' + (res.status === 200 ? 'is-ok' : 'is-err');
}

// Mientras se guarda el boton no acepta otro envio.
async function send(form, opc) {
    const btn  = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());

    btn.disabled = true;
    const res = await Page.post(PERFIL_API, { opc: opc, ...data });
    btn.disabled = false;

    return res;
}

function bindPerfil() {
    document.getElementById('perfilColors').addEventListener('click', (e) => {
        const swatch = e.target.closest('.pg-swatch');
        if (!swatch) return;

        document.querySelectorAll('#perfilColors .pg-swatch').forEach((el) => el.classList.toggle('is-on', el === swatch));
        document.getElementById('color').value = swatch.dataset.color;
    });

    document.getElementById('formDatos').addEventListener('submit', async (e) => {
        e.preventDefault();

        const res = await send(e.currentTarget, 'saveProfile');

        if (res.status !== 200) return say('datosMsg', res);

        // La ficha de la izquierda y la barra muestran estos mismos datos.
        await loadPerfil();
        say('datosMsg', res);
        if (window.navbar && navbar.data) refreshNavbar();
    });

    document.getElementById('formPassword').addEventListener('submit', async (e) => {
        e.preventDefault();

        const form = e.currentTarget;
        const res  = await send(form, 'savePassword');

        if (res.status === 200) form.reset();
        say('passwordMsg', res);
    });

    document.getElementById('perfilPhoto').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const body = new FormData();
        body.append('opc', 'savePhoto');
        body.append('photo', file);

        const res = await Page.post(PERFIL_API, body);
        e.target.value = '';

        if (res.status !== 200) return say('photoMsg', res);

        perfil.account.photo = res.data.photo;
        document.getElementById('perfilAvatar').innerHTML = Page.avatar({ name: fullName(), photo: res.data.photo, color: perfil.account.color }, 'xl');
        say('photoMsg', res);
        refreshNavbar();
    });
}

// La barra ya pinto nombre, foto y color al cargar: se le pasan los nuevos.
function refreshNavbar() {
    if (!window.navbar || !navbar.data) return;

    navbar.data.user  = fullName();
    navbar.data.photo = perfil.account.photo;
    navbar.data.color = perfil.account.color;
    navbar.renderSession();
}
