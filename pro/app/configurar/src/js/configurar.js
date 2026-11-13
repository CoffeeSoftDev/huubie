/*  Configura tu empresa: lo que el dueño completa la primera vez que entra.
    Un solo formulario corto -- empresa, sucursal y sus propios datos -- y la
    salida "Lo hago después", que lo deja como recordatorio en la campana. */
const SETUP_API = 'ctrl/ctrl-configurar.php';

$(async () => {
    const root = document.getElementById('root');

    root.innerHTML = '<div class="pg-skel"></div>';

    const res = await Page.post(SETUP_API, { opc: 'init' });

    if (res.status !== 200) {
        root.innerHTML = `<div class="pg-card"><div class="pg-empty"><i data-lucide="cloud-off"></i>${Page.esc(res.message || 'No se pudo cargar.')}</div></div>`;
        Page.icons();
        return;
    }

    root.innerHTML = render(res.data);
    Page.icons();
    bind();
});

function field(id, label, value, attrs, wide) {
    return `
        <div class="pg-field ${wide ? 'is-wide' : ''}">
            <label class="pg-label" for="${id}">${Page.esc(label)}</label>
            <input class="pg-input" id="${id}" name="${id}" value="${Page.esc(value || '')}" ${attrs || ''}>
        </div>`;
}

function section(icon, title, note) {
    return `
        <div class="pg-field is-wide" style="margin-top:6px">
            <p class="pg-card-title"><span class="pg-ico"><i data-lucide="${icon}"></i></span>${Page.esc(title)}</p>
            ${note ? `<p class="pg-dim pg-small" style="margin-top:6px !important">${Page.esc(note)}</p>` : ''}
        </div>`;
}

function render(d) {
    const yo = d.viewing ? '' : `
        ${section('user-round', 'Tus datos', 'Así te verá tu equipo.')}
        ${field('name', 'Nombre', d.name, 'maxlength="80" autocomplete="given-name" required')}
        ${field('last_name', 'Apellidos', d.last_name, 'maxlength="80" autocomplete="family-name"')}
        ${field('phone', 'Teléfono', d.phone, 'type="tel" maxlength="20" autocomplete="tel"', true)}`;

    return `
        <div class="pg-head">
            <div>
                <h1 class="pg-h1">${d.done ? 'Los datos de tu empresa' : '¡Bienvenid@! Configura tu empresa'}</h1>
                <p class="pg-sub">${d.done ? 'Puedes actualizarlos cuando quieras.' : 'Solo falta esto para dejar tu cuenta lista. Toma un minuto.'}</p>
            </div>
        </div>
        <div class="pg-card" style="max-width:760px">
            <form class="pg-form" id="formSetup" novalidate>
                ${section('building-2', 'Tu empresa')}
                ${field('company', 'Nombre de la empresa', d.company, 'maxlength="120" autocomplete="organization" required')}
                ${field('rfc', 'RFC (opcional)', d.rfc, 'maxlength="13" autocapitalize="characters" style="text-transform:uppercase"')}
                ${field('ubication', 'Dirección', d.ubication, 'maxlength="255" autocomplete="street-address"', true)}

                ${section('store', 'Tu sucursal', 'Empezamos con una. Después podrás agregar más.')}
                ${field('branch', 'Nombre de la sucursal', d.branch, 'maxlength="120" required')}
                ${field('branch_ubication', 'Dirección de la sucursal', d.branch_ubication, 'maxlength="255"')}

                ${yo}

                <div class="pg-form-foot">
                    <p class="pg-msg" id="setupMsg" hidden></p>
                    ${d.done ? '' : `<a class="pg-btn is-ghost" href="${Page.root}app/home/">Lo hago después</a>`}
                    <button type="submit" class="pg-btn is-primary"><i data-lucide="check"></i>${d.done ? 'Guardar cambios' : 'Guardar y continuar'}</button>
                </div>
            </form>
        </div>`;
}

function bind() {
    document.getElementById('formSetup').addEventListener('submit', async (e) => {
        e.preventDefault();

        const form = e.currentTarget;
        const btn  = form.querySelector('button[type="submit"]');
        const msg  = document.getElementById('setupMsg');

        btn.disabled = true;
        const res = await Page.post(SETUP_API, { opc: 'save', ...Object.fromEntries(new FormData(form).entries()) });
        btn.disabled = false;

        if (res.status === 200) {
            window.location.href = Page.root + 'app/home/';
            return;
        }

        msg.hidden      = false;
        msg.className   = 'pg-msg is-err';
        msg.textContent = res.message || 'Ocurrió un error.';

        const bad = res.field && document.getElementById(res.field);
        if (bad) bad.focus();
    });
}
