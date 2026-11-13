/*  El inicio de una empresa: lo primero que ve cualquiera al entrar (root lo ve
    al elegir una empresa, como su dueño).

    Izquierda, quien eres y con quien: la empresa, tu saludo, tu plan y a quien
    acudir. Derecha, lo que hay que hacer y saber hoy: tus modulos, los
    cumpleaños y aniversarios del mes y tu equipo.

    Si la empresa no esta al corriente, arriba de todo va el aviso de pago y
    los modulos salen con candado: es lo unico que cambia. */
const HOME_API = 'ctrl/ctrl-home.php';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Por que no puede operar, en palabras de quien lo lee.
const AVISOS = {
    company: {
        pending:   'Completa tu pago para activar tu empresa',
        suspended: 'El acceso de tu empresa está suspendido',
        cancelled: 'La cuenta de tu empresa fue cancelada'
    },
    subscription: {
        past_due:  'Tu pago está vencido',
        cancelled: 'Tu suscripción fue cancelada',
        expired:   'Tu suscripción terminó'
    }
};

const ESTADOS_PLAN = {
    active:    { text: 'Activo',     tone: 'is-ok' },
    trial:     { text: 'En prueba',  tone: 'is-ok' },
    past_due:  { text: 'Pago vencido', tone: 'is-warn' },
    cancelled: { text: 'Cancelado',  tone: 'is-off' },
    expired:   { text: 'Expirado',   tone: 'is-off' }
};

// A quien acudir cuando la empresa no puede operar. El cobro en linea (Stripe)
// todavia no esta conectado: mientras tanto, el aviso de pago manda aqui.
const SOPORTE = { email: 'coffeesoftdev@gmail.com', phone: '962 149 3749', tel: '+529621493749' };

const CICLOS = { monthly: 'al mes', yearly: 'al año', lifetime: 'pago único' };

$(async () => {
    const root = document.getElementById('root');

    root.innerHTML = '<div class="pg-skel"></div><div class="pg-skel"></div>';

    // De regreso de Stripe la URL trae el id de la sesion de pago: se manda
    // para que el servidor la concilie, y se quita para que un F5 no la repita.
    const session = new URLSearchParams(window.location.search).get('session_id') || '';
    if (session) window.history.replaceState(null, '', window.location.pathname);

    const res = await Page.post(HOME_API, { opc: 'init', session_id: session });

    // root sin empresa elegida: su inicio es la lista de empresas.
    if (res.status === 409) {
        window.location.href = Page.root + 'app/empresas/';
        return;
    }

    if (res.status !== 200) {
        root.innerHTML = `<div class="pg-card"><div class="pg-empty"><i data-lucide="cloud-off"></i>${Page.esc(res.message || 'No se pudo cargar tu inicio.')}</div></div>`;
        Page.icons();
        return;
    }

    root.innerHTML = renderHome(res.data);
    Page.icons();

    const pay = document.getElementById('btnPay');
    if (pay) pay.addEventListener('click', () => payNow(pay));
});

async function payNow(btn) {
    btn.disabled = true;

    const res = await Page.post(HOME_API, { opc: 'checkout' });

    if (res.status === 200 && res.url) {
        window.location.href = res.url;
        return;
    }

    btn.disabled = false;
    document.getElementById('payError').textContent = res.message || 'No se pudo abrir el pago. Inténtalo de nuevo.';
}

function renderHome(d) {
    return `
        ${head(d)}
        ${d.paid && d.plan.ok ? '<div class="pg-trial is-ok" role="status"><i data-lucide="circle-check"></i><p><b>Pago recibido.</b> Tu plan está activo y tus módulos ya están disponibles. ¡Gracias!</p></div>' : ''}
        ${d.plan.ok ? trialNotice(d) : payNotice(d)}
        <div class="pg-grid">
            <div class="pg-col">
                ${companyCard(d)}
                ${helloCard(d)}
                ${planCard(d)}
                ${ownerCard(d)}
            </div>
            <div class="pg-col">
                ${modulesCard(d)}
                <div class="pg-two">
                    ${peopleCard('cake', 'cumpleaños', d.birthdays, 'Nadie cumple años este mes', (p) => `${p.day} de ${mesActual()}${p.today ? ' · ¡hoy!' : ''}`)}
                    ${peopleCard('party-popper', 'aniversarios', d.anniversaries, 'No hay aniversarios este mes', (p) => `${p.years} ${p.years === 1 ? 'año' : 'años'} en la empresa · día ${p.day}`)}
                </div>
                ${teamCard(d)}
            </div>
        </div>`;
}

function mesActual() {
    return MESES[new Date().getMonth()];
}

function plural(n, uno, varios) {
    return `${n} ${n === 1 ? uno : varios}`;
}

// -- Encabezado --

function head(d) {
    const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return `
        <div class="pg-head">
            <div>
                <h1 class="pg-h1">Bienvenid@ a Huubie</h1>
                <p class="pg-sub">${Page.esc(hoy)}</p>
            </div>
            <div class="pg-chips">
                <span class="pg-chip"><i data-lucide="store"></i>${plural(d.company.branches, 'sucursal', 'sucursales')}</span>
                <span class="pg-chip"><i data-lucide="users"></i>${plural(d.company.users, 'usuario', 'usuarios')}</span>
                <span class="pg-chip ${d.plan.ok ? 'is-ok' : 'is-warn'}"><i data-lucide="${d.plan.ok ? 'layout-grid' : 'lock'}"></i>${plural(d.modules.length, 'módulo', 'módulos')}</span>
            </div>
        </div>`;
}

// -- Aviso de pago --

function payNotice(d) {
    const plan = d.plan;

    const title = plan.reason === 'none'
        ? 'Tu empresa no tiene un plan contratado'
        : plan.reason === 'trial'
        ? 'Tu periodo de prueba terminó'
        : ((AVISOS[plan.reason] || {})[plan.reason === 'company' ? d.company.status : plan.status] || 'Tu empresa no puede usar sus módulos');

    const body = plan.reason === 'trial'
        ? `Tu prueba del plan <b>${Page.esc(plan.name)}</b> terminó el ${Page.esc(Page.date(plan.trial_end))}. Contrátalo para seguir usando tus módulos: tu información se conserva tal como la dejaste. Mientras tanto solo puedes ver tu inicio y tu perfil.`
        : plan.name
        ? `Realiza el pago de tu plan <b>${Page.esc(plan.name)}</b> para ${d.company.status === 'pending' ? 'empezar a usar' : 'volver a usar'} tus módulos. Mientras tanto solo puedes ver tu inicio y tu perfil.`
        : 'Contrata un plan para empezar a usar tus módulos. Mientras tanto solo puedes ver tu inicio y tu perfil.';

    const amount = plan.price !== null
        ? `<div class="pg-pay-amount"><b>${Page.esc(Page.money(plan.price, plan.currency))}</b><span>${Page.esc(CICLOS[plan.cycle] || '')} · sin IVA</span></div>`
        : '';

    return `
        <div class="pg-pay" role="alert">
            <span class="pg-pay-ico"><i data-lucide="credit-card"></i></span>
            <div class="pg-pay-text">
                <p class="pg-pay-title">${Page.esc(title)}</p>
                <p class="pg-pay-body">${body}</p>
                <p class="pg-pay-body">¿Ya pagaste o necesitas ayuda? Escríbenos a <a class="pg-pay-link" href="mailto:${SOPORTE.email}">${SOPORTE.email}</a> o llama al <a class="pg-pay-link" href="tel:${SOPORTE.tel}">${SOPORTE.phone}</a>.</p>
                ${d.user.viewing ? '<p class="pg-pay-body">Estás viendo esta empresa como su dueño: esto es lo que ve su gente al entrar.</p>' : ''}
            </div>
            <div class="pg-pay-side">
                ${amount}
                ${plan.can_pay ? '<button type="button" class="pg-btn is-primary" id="btnPay"><i data-lucide="credit-card"></i>Pagar ahora</button><p class="pg-pay-error" id="payError" role="alert"></p>' : ''}
            </div>
        </div>`;
}

/*  En prueba y todavia a tiempo: cuanto le queda. No estorba al principio
    (una linea discreta) y se pone en ambar los ultimos TRIAL_AVISO dias, que es
    cuando hay que decidir. */
const TRIAL_AVISO = 3;

function trialNotice(d) {
    const plan = d.plan;
    if (plan.status !== 'trial' || plan.trial_left === null) return '';

    const left = plan.trial_left;
    const when = left === 0 ? 'Hoy es el último día de tu prueba'
               : left === 1 ? 'Te queda 1 día de prueba'
               : `Te quedan ${left} días de prueba`;

    const urgent = left <= TRIAL_AVISO;

    return `
        <div class="pg-trial ${urgent ? 'is-urgent' : ''}" role="status">
            <i data-lucide="${urgent ? 'alarm-clock' : 'sparkles'}"></i>
            <p><b>${Page.esc(when)}.</b> Tu prueba del plan ${Page.esc(plan.name)} termina el ${Page.esc(Page.date(plan.trial_end))}; después necesitarás contratarlo para seguir usando tus módulos.</p>
        </div>`;
}

// -- Columna izquierda --

function companyCard(d) {
    return `
        <div class="pg-card">
            <div class="pg-row">
                ${Page.avatar({ name: d.company.name }, 'lg')}
                <div class="pg-row-text">
                    <p class="pg-strong pg-ellipsis" style="font-size:16px">${Page.esc(d.company.name)}</p>
                    <p class="pg-dim pg-small pg-ellipsis">${Page.esc(d.company.ubication || 'Tu empresa en Huubie')}</p>
                </div>
            </div>
        </div>`;
}

function helloCard(d) {
    return `
        <div class="pg-card">
            <div class="pg-row">
                ${Page.avatar({ name: d.user.full, photo: d.user.photo, color: d.user.color }, 'lg')}
                <div class="pg-row-text">
                    <p class="pg-strong pg-ellipsis" style="font-size:16px">Hola, ${Page.esc(d.user.name)}</p>
                    <p class="pg-dim pg-small pg-ellipsis">${Page.esc(d.user.viewing ? 'Viendo como dueño' : (d.user.rol || 'Sin rol asignado'))}</p>
                </div>
            </div>
            <div class="pg-list" style="margin-top:14px">
                <div class="pg-row">
                    <span class="pg-ico"><i data-lucide="map-pin"></i></span>
                    <div class="pg-row-text">
                        <p class="pg-strong pg-ellipsis">${Page.esc(d.user.branch || 'Sin sucursal')}</p>
                        <p class="pg-dim pg-small">Tu sucursal activa</p>
                    </div>
                    <a class="pg-link" href="${Page.root}app/perfil/">Mi perfil <i data-lucide="arrow-right"></i></a>
                </div>
            </div>
        </div>`;
}

function planCard(d) {
    const plan   = d.plan;
    const estado = plan.reason === 'trial'
        ? { text: 'Prueba terminada', tone: 'is-warn' }
        : (ESTADOS_PLAN[plan.status] || { text: 'Sin plan', tone: 'is-off' });

    if (!plan.name) {
        return `
            <div class="pg-card">
                <div class="pg-card-head"><p class="pg-card-title"><span class="pg-ico"><i data-lucide="badge-check"></i></span>Tu plan</p></div>
                <p class="pg-dim pg-small">Tu empresa todavía no tiene un plan contratado.</p>
            </div>`;
    }

    return `
        <div class="pg-card">
            <div class="pg-card-head">
                <p class="pg-card-title"><span class="pg-ico"><i data-lucide="badge-check"></i></span>Tu plan</p>
                <span class="pg-chip ${estado.tone}">${Page.esc(estado.text)}</span>
            </div>
            <p class="pg-strong" style="font-size:18px">${Page.esc(plan.name)}</p>
            ${plan.price !== null ? `<p class="pg-dim pg-small">${Page.esc(Page.money(plan.price, plan.currency))} ${Page.esc(CICLOS[plan.cycle] || '')} · sin IVA</p>` : ''}
            <div class="pg-list" style="margin-top:12px">
                <div class="pg-row">
                    <div class="pg-row-text"><p class="pg-dim pg-small">Módulos incluidos</p></div>
                    <p class="pg-strong">${d.modules.length}</p>
                </div>
                ${plan.trial_end ? `
                <div class="pg-row">
                    <div class="pg-row-text"><p class="pg-dim pg-small">${plan.trial_left < 0 ? 'La prueba terminó' : 'La prueba termina'}</p></div>
                    <p class="pg-strong">${Page.esc(Page.date(plan.trial_end))}</p>
                </div>` : ''}
                ${plan.next && !plan.trial_end ? `
                <div class="pg-row">
                    <div class="pg-row-text"><p class="pg-dim pg-small">Próximo pago</p></div>
                    <p class="pg-strong">${Page.esc(Page.date(plan.next))}</p>
                </div>` : ''}
            </div>
        </div>`;
}

// A quien acudir. Al dueño no se le presenta a si mismo.
function ownerCard(d) {
    const o = d.owner;
    if (!o || o.me) return '';

    return `
        <div class="pg-card">
            <div class="pg-card-head"><p class="pg-card-title"><span class="pg-ico"><i data-lucide="headset"></i></span>Tu administrador</p></div>
            <p class="pg-dim pg-small" style="margin-bottom:12px !important">¿Alguna duda o problema con Huubie?</p>
            <div class="pg-row">
                ${Page.avatar(o)}
                <div class="pg-row-text">
                    <p class="pg-strong pg-ellipsis">${Page.esc(o.name)}</p>
                    <p class="pg-dim pg-small pg-ellipsis">${Page.esc(o.email)}</p>
                </div>
                ${o.phone ? `<a class="pg-btn is-ghost is-round" href="tel:${Page.esc(o.phone.replace(/[^0-9+]/g, ''))}" title="Llamar"><i data-lucide="phone"></i></a>` : ''}
                <a class="pg-btn is-ghost is-round" href="mailto:${Page.esc(o.email)}" title="Escribir un correo"><i data-lucide="mail"></i></a>
            </div>
        </div>`;
}

// -- Columna derecha --

function modulesCard(d) {
    if (!d.modules.length) {
        return `
            <div class="pg-card">
                <div class="pg-card-head"><p class="pg-card-title">Tus módulos</p></div>
                <div class="pg-empty"><i data-lucide="layout-grid"></i>${d.plan.name ? 'Tu rol todavía no tiene acceso a ningún módulo. Pídelo a tu administrador.' : 'Aquí aparecerán los módulos de tu plan.'}</div>
            </div>`;
    }

    const cards = d.modules.map((m) => {
        const body = `
            <span class="pg-mod-ico"><i data-lucide="${Page.esc(m.icon)}"></i></span>
            <span class="pg-row-text">
                <p class="pg-mod-name">${Page.esc(m.name)}</p>
                <p class="pg-mod-text">${Page.esc(m.text)}</p>
            </span>`;

        if (m.locked) return `<div class="pg-mod is-off" title="Disponible al regularizar tu pago">${body}<span class="pg-mod-tag"><i data-lucide="lock"></i>Bloqueado</span></div>`;
        if (!m.route) return `<div class="pg-mod is-off" title="Todavía no está disponible">${body}<span class="pg-mod-tag">Próximamente</span></div>`;

        return `<a class="pg-mod" href="${Page.esc(Page.root + m.route.replace(/^\/+/, ''))}">${body}</a>`;
    }).join('');

    return `
        <div class="pg-card">
            <div class="pg-card-head">
                <p class="pg-card-title">Tus módulos</p>
                <span class="pg-card-note">${d.plan.name ? 'Plan ' + Page.esc(d.plan.name) : ''}</span>
            </div>
            <div class="pg-mods">${cards}</div>
        </div>`;
}

function peopleCard(icon, what, people, empty, detail) {
    if (!people.length) {
        return `
            <div class="pg-card">
                <div class="pg-row">
                    <span class="pg-ico"><i data-lucide="${icon}"></i></span>
                    <div class="pg-row-text">
                        <p class="pg-dim pg-small">Este mes</p>
                        <p class="pg-strong">${Page.esc(empty)}</p>
                    </div>
                </div>
            </div>`;
    }

    return `
        <div class="pg-card">
            <div class="pg-card-head">
                <div class="pg-avatars">${people.slice(0, 5).map((p) => Page.avatar(p, 'sm')).join('')}</div>
                <span class="pg-card-note">Este mes</span>
            </div>
            <p class="pg-strong" style="font-size:15px;margin-bottom:10px !important">${people.length} ${Page.esc(what)}</p>
            <div class="pg-list">
                ${people.map((p) => `
                <div class="pg-row">
                    <div class="pg-row-text">
                        <p class="pg-strong pg-ellipsis">${Page.esc(p.name)}</p>
                        <p class="pg-dim pg-small">${Page.esc(detail(p))}</p>
                    </div>
                </div>`).join('')}
            </div>
        </div>`;
}

function teamCard(d) {
    const team = d.team;

    const rows = team.people.map((p) => `
        <div class="pg-row">
            ${Page.avatar(p)}
            <div class="pg-row-text">
                <p class="pg-strong pg-ellipsis">${Page.esc(p.name)}</p>
                <p class="pg-dim pg-small pg-ellipsis">${Page.esc([p.job, p.branch].filter(Boolean).join(' · ') || 'Sin puesto asignado')}</p>
            </div>
        </div>`).join('');

    return `
        <div class="pg-card">
            <div class="pg-card-head">
                <p class="pg-card-title">Tu equipo</p>
                <span class="pg-card-note">${plural(team.total, 'persona', 'personas')}</span>
            </div>
            ${rows ? `<div class="pg-list">${rows}</div>` : '<div class="pg-empty"><i data-lucide="users"></i>Cuando tu empresa registre a su gente en Capital Humano, aparecerá aquí.</div>'}
            ${team.total > team.people.length ? `<p class="pg-dim pg-small" style="margin-top:12px !important">y ${team.total - team.people.length} más</p>` : ''}
        </div>`;
}
