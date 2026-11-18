/*  El inicio de una empresa: lo primero que ve cualquiera al entrar. Tiene dos
    vistas, segun quien entra (data.view, ctrl-home):

    owner    El dueño (y root, que entra a una empresa como su dueño): el
             tablero. Arriba, como va hoy el negocio en cifras. Debajo, lo
             que requiere su atencion, sus modulos, cada sucursal y la
             actividad reciente; a un lado, su plan y los festejos del mes
             (ver renderHome). Si la empresa no esta al corriente, arriba de
             todo va el aviso de pago y los modulos salen con candado.

    modules  Todos los demas: solo sus modulos, como el hub de alpha
             (alpha/menus/ventas.php con ModuleCard): saludo, buscador con
             Ctrl+K y una tarjeta por modulo. Ver renderHub(). */
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

    // ?module=code: el inicio abierto en un modulo que solo tiene submodulos.
    // Vale para las dos vistas; si el code no aplica, se pinta el inicio normal.
    const picked = pickedModule(res.data.modules);

    if (picked) {
        root.innerHTML = renderSubhub(picked);
        Page.icons();
        return;
    }

    if (res.data.view === 'modules') {
        root.innerHTML = renderHub(res.data);
        Page.icons();
        hubEvents();
        return;
    }

    root.innerHTML = renderHome(res.data);
    Page.icons();

    const pay = document.getElementById('btnPay');
    if (pay) pay.addEventListener('click', () => payNow(pay));
});

// -- Vista de modulos: quien no es dueño --

function greeting() {
    const hour = new Date().getHours();
    return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
}

// Solo el primer nombre, y sin gritar: users.name trae a veces el nombre
// completo y en mayusculas ("PERLA RAMOS" -> "Perla").
function firstName(name) {
    const first = String(name || '').trim().split(/\s+/)[0] || '';
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// Para buscar sin importar acentos ni mayusculas: "catalogo" encuentra "Catálogo".
function plain(text) {
    return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function renderHub(d) {
    // Primero los que abren; despues los que todavia no (sin pagina o con candado).
    const opens   = (m) => !m.locked && !!m.route;
    const modules = d.modules.filter(opens).concat(d.modules.filter((m) => !opens(m)));
    const owner   = d.owner && d.owner.name ? d.owner.name : 'tu administrador';
    const mac     = /Mac|iPhone|iPad/.test(navigator.platform || '');

    const search = modules.length ? `
        <label class="pg-search">
            <i data-lucide="search"></i>
            <input type="search" id="hubSearch" placeholder="Buscar módulo..." autocomplete="off" aria-label="Buscar módulo">
            <kbd>${mac ? '⌘ K' : 'Ctrl K'}</kbd>
        </label>` : '';

    const paused = d.plan.ok ? '' : `
        <div class="pg-trial is-urgent" role="status">
            <i data-lucide="lock"></i>
            <p><b>Tus módulos están en pausa</b> mientras tu empresa pone al día su cuenta en Huubie. Avísale a ${Page.esc(owner)}.</p>
        </div>`;

    const body = modules.length ? `
        <div class="pg-hub-grid" id="hubGrid">${modules.map(hubCard).join('')}</div>
        <div class="pg-card" id="hubNone" hidden>
            <div class="pg-empty" aria-live="polite"><i data-lucide="search-x"></i><span>Ningún módulo coincide con <b id="hubQuery"></b>.</span></div>
        </div>` : `
        <div class="pg-card">
            <div class="pg-empty"><i data-lucide="layout-grid"></i>Tu rol todavía no tiene acceso a ningún módulo. Pídeselo a ${Page.esc(owner)}.</div>
        </div>`;

    return `
        <div class="pg-hub">
            <div class="pg-hub-head">
                <div class="pg-hub-hello">
                    <h1 class="pg-h1">¡${greeting()}, ${Page.esc(firstName(d.user.name))}! 👋</h1>
                    <p class="pg-sub">Nos da gusto verte de vuelta. ¿Por dónde quieres empezar hoy?</p>
                </div>
                ${search}
            </div>
            ${paused}
            ${body}
        </div>`;
}

/*  Una tarjeta por modulo, con su icono de siempre (modules.icon). La que abre
    es un enlace de verdad (se puede abrir en otra pestaña); la que no, un
    bloque apagado con el porque en la esquina. */
function hubCard(m) {
    const off = m.locked || !m.route;

    const corner = m.locked
        ? '<span class="pg-hub-tag"><i data-lucide="lock"></i>Bloqueado</span>'
        : !m.route
        ? '<span class="pg-hub-tag">Próximamente</span>'
        : '<span class="pg-hub-go" aria-hidden="true"><i data-lucide="arrow-up-right"></i></span>';

    const inner = `
        <span class="pg-hub-top">
            <span class="pg-hub-ico"><i data-lucide="${Page.esc(m.icon)}"></i></span>
            ${corner}
        </span>
        <span class="pg-hub-name">${Page.esc(m.name)}</span>
        <span class="pg-hub-text">${Page.esc(m.text)}</span>`;

    const search = Page.esc(plain(`${m.name} ${m.text}`));

    if (off) {
        const why = m.locked ? 'Disponible cuando tu empresa ponga al día su cuenta' : 'Todavía no está disponible';
        return `<div class="pg-hub-card is-off" data-search="${search}" aria-disabled="true" title="${why}">${inner}</div>`;
    }

    return `<a class="pg-hub-card" href="${Page.esc(Page.root + m.route.replace(/^\/+/, ''))}" data-search="${search}">${inner}</a>`;
}

/*  Un modulo que solo tiene submodulos no abre una pagina: abre sus
    submodulos como tarjetas, las mismas del hub (ctrl-home los manda en
    m.submodules cuando hay mas de uno). Cada tarjeta entra a la primera
    seccion de su submodulo, y ahi el rail enseña las secciones de ese. */
function pickedModule(modules) {
    const code = new URLSearchParams(window.location.search).get('module') || '';
    if (!code) return null;

    return modules.find((m) => m.code === code && !m.locked && m.submodules.length) || null;
}

function renderSubhub(m) {
    return `
        <div class="pg-hub">
            <div class="pg-hub-head">
                <div class="pg-hub-hello">
                    <a class="pg-link" href="${Page.root}app/home/" style="margin-bottom:10px"><i data-lucide="arrow-left"></i>Inicio</a>
                    <h1 class="pg-h1">${Page.esc(m.name)}</h1>
                    <p class="pg-sub">¿A dónde quieres entrar?</p>
                </div>
            </div>
            <div class="pg-hub-grid">${m.submodules.map(hubCard).join('')}</div>
        </div>`;
}

// Buscador: filtra al escribir, Ctrl+K (⌘K) lo enfoca, Enter abre el primer
// modulo que coincide y Escape lo limpia.
function hubEvents() {
    const input = document.getElementById('hubSearch');
    if (!input) return;

    const grid  = document.getElementById('hubGrid');
    const none  = document.getElementById('hubNone');
    const cards = Array.from(grid.querySelectorAll('.pg-hub-card'));

    const filter = () => {
        const q = plain(input.value.trim());
        let shown = 0;

        cards.forEach((card) => {
            card.hidden = !!q && !card.dataset.search.includes(q);
            if (!card.hidden) shown++;
        });

        grid.hidden = shown === 0;
        none.hidden = shown > 0;
        document.getElementById('hubQuery').textContent = `“${input.value.trim()}”`;
    };

    input.addEventListener('input', filter);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            input.value = '';
            filter();
            input.blur();
        }

        if (e.key === 'Enter') {
            const first = cards.find((card) => !card.hidden && card.tagName === 'A');
            if (first) window.location.href = first.href;
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            input.focus();
            input.select();
        }
    });
}

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

/*  El tablero del dueño, de arriba a abajo por lo que mas le importa: como
    va hoy el negocio (cifras), que tiene pendiente (atencion), a donde entrar
    (modulos), como va cada sucursal y lo ultimo que paso. A la derecha, lo
    que casi no cambia: su plan y los festejos del mes. Sus datos y los de la
    empresa ya estan en la barra y en Configuración: aqui no se repiten.

    d.business viene null cuando la empresa no tiene Punto de venta o no esta
    al corriente: entonces no hay cifras y el tablero se queda con lo demas. */
function renderHome(d) {
    const b = d.business;

    return `
        ${head(d)}
        ${d.paid && d.plan.ok ? '<div class="pg-trial is-ok" role="status"><i data-lucide="circle-check"></i><p><b>Pago recibido.</b> Tu plan está activo y tus módulos ya están disponibles. ¡Gracias!</p></div>' : ''}
        ${d.plan.ok ? trialNotice(d) : payNotice(d)}
        ${b ? kpis(b) : ''}
        <div class="pg-grid is-side-right">
            <div class="pg-col">
                ${attentionCard(d)}
                ${modulesCard(d)}
                ${b ? branchesCard(b) : ''}
                ${b ? activityCard(b) : ''}
            </div>
            <div class="pg-col">
                ${planCard(d)}
                ${datesCards(d)}
                ${ownerCard(d)}
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

/*  El saludo, con los colores de la marca como en el logo: el nombre en
    morado y el punto final en coral (.pg-brand, .pg-brand-dot). A su lado el
    logo de la empresa, o sus iniciales. */
function head(d) {
    const hoy  = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const logo = d.company.logo
        ? `<span class="pg-avatar is-lg"><img src="${Page.esc(d.company.logo)}" alt=""></span>`
        : Page.avatar({ name: d.company.name }, 'lg');

    return `
        <div class="pg-head">
            <div class="pg-hello">
                ${logo}
                <div class="pg-row-text">
                    <h1 class="pg-h1">${greeting()}, <span class="pg-brand">${Page.esc(firstName(d.user.name))}</span><span class="pg-brand-dot">.</span></h1>
                    <p class="pg-sub">${Page.esc(hoy)} · ${d.business ? 'Así va' : 'Este es el inicio de'} ${Page.esc(d.company.name)}${d.business ? ' hoy' : ''}</p>
                </div>
            </div>
            <div class="pg-chips">
                <span class="pg-chip"><i data-lucide="store"></i>${plural(d.company.branches, 'sucursal', 'sucursales')}</span>
                <span class="pg-chip"><i data-lucide="users"></i>${plural(d.company.users, 'usuario', 'usuarios')}</span>
            </div>
        </div>`;
}

// -- Las cifras de hoy --

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/*  Cuatro cifras de toda la empresa. Vendido y cobrado se comparan contra el
    mismo dia de la semana pasada a esta misma hora (ctrl-home :: business). */
function kpis(b) {
    const t   = b.today;
    const dia = `el ${DIAS[new Date().getDay()]} pasado a esta hora`;

    const entregas = t.deliveries
        ? `${t.deliveries - t.to_deliver} de ${t.deliveries} ya ${t.deliveries - t.to_deliver === 1 ? 'entregado' : 'entregados'}`
        : 'Sin entregas programadas para hoy';

    return `
        <div class="pg-kpis">
            ${kpi('trending-up', 'Vendido hoy', Page.money(t.sold), delta(t.sold, b.before.sold, dia, 'Sin ventas'))}
            ${kpi('wallet', 'Cobrado hoy', Page.money(t.paid), delta(t.paid, b.before.paid, dia, 'Sin cobros'))}
            ${kpi('receipt', 'Ventas y pedidos', t.tickets, t.tickets ? `Ticket promedio de ${Page.esc(Page.money(t.sold / t.tickets))}` : 'Todavía no hay ventas hoy')}
            ${kpi('package', 'Por entregar hoy', t.to_deliver, entregas)}
        </div>`;
}

function kpi(icon, label, value, note) {
    return `
        <div class="pg-kpi">
            <p class="pg-kpi-label"><i data-lucide="${icon}"></i>${label}</p>
            <p class="pg-kpi-value">${Page.esc(value)}</p>
            <p class="pg-kpi-note">${note}</p>
        </div>`;
}

// Sube o baja, en porcentaje. Sin con que comparar lo dice, no inventa un 100%.
function delta(now, before, when, none) {
    if (!before) return `${none} ${when}`;

    const pct = Math.round(((now - before) / before) * 100);

    if (pct === 0) return `Igual que ${when}`;

    return `<b class="pg-delta ${pct > 0 ? 'is-up' : 'is-down'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%</b> vs. ${when}`;
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

// -- Plan y administrador --

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
                <a class="pg-btn is-ghost pg-btn-block" href="${Page.root}app/configuracion/#pagos"><i data-lucide="settings-2"></i>Configurar suscripción</a>
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
            <a class="pg-btn is-ghost pg-btn-block" href="${Page.root}app/configuracion/#pagos"><i data-lucide="settings-2"></i>Configurar suscripción</a>
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

// -- Columna principal --

/*  Lo que el dueño tiene que saber o mandar hacer hoy (ctrl-home ::
    attention). Cada pendiente es un enlace a donde se resuelve. */
function attentionCard(d) {
    const items = d.attention || [];

    if (!items.length) {
        return `
            <div class="pg-card">
                <div class="pg-row">
                    <span class="pg-ico is-ok"><i data-lucide="circle-check"></i></span>
                    <div class="pg-row-text">
                        <p class="pg-strong">Todo en orden</p>
                        <p class="pg-dim pg-small">No hay nada que requiera tu atención por ahora.</p>
                    </div>
                </div>
            </div>`;
    }

    const rows = items.map((item) => `
        <a class="pg-row pg-todo" href="${Page.esc(Page.root + item.route)}">
            <span class="pg-ico is-warn"><i data-lucide="${Page.esc(item.icon)}"></i></span>
            <span class="pg-row-text">
                <span class="pg-strong">${Page.esc(item.title)}</span>
                <span class="pg-dim pg-small">${Page.esc(item.text)}</span>
            </span>
            <span class="pg-link"><span>${Page.esc(item.go)}</span><i data-lucide="arrow-right"></i></span>
        </a>`).join('');

    return `
        <div class="pg-card">
            <div class="pg-card-head">
                <p class="pg-card-title">Requiere tu atención</p>
                <span class="pg-chip is-warn">${plural(items.length, 'pendiente', 'pendientes')}</span>
            </div>
            <div class="pg-list">${rows}</div>
        </div>`;
}

/*  Las mismas tarjetas del hub de quien no es dueño (hubCard). Un modulo
    contratado que todavia no tiene pagina no ocupa una tarjeta apagada: va
    abajo, en una linea de "Próximamente". Con la empresa sin pago al
    corriente todos salen como tarjeta, con su candado. Al final, Mi perfil y
    Configuración del dueño (d.shortcuts), que ya no van en el rail. */
function modulesCard(d) {
    const own = d.shortcuts || [];

    if (!d.modules.length) {
        return `
            <div class="pg-card">
                <div class="pg-card-head"><p class="pg-card-title">Tus módulos</p></div>
                <div class="pg-empty"><i data-lucide="layout-grid"></i>${d.plan.name ? 'Tu rol todavía no tiene acceso a ningún módulo. Pídelo a tu administrador.' : 'Aquí aparecerán los módulos de tu plan.'}</div>
            </div>
            ${own.length ? `<div class="pg-hub-grid">${own.map(hubCard).join('')}</div>` : ''}`;
    }

    const soon  = d.modules.filter((m) => !m.locked && !m.route);
    const cards = d.modules.filter((m) => m.locked || m.route).concat(own);

    return `
        <section>
            <div class="pg-card-head">
                <p class="pg-card-title">Tus módulos</p>
                <span class="pg-card-note">${d.plan.name ? 'Plan ' + Page.esc(d.plan.name) : ''}</span>
            </div>
            ${cards.length ? `<div class="pg-hub-grid">${cards.map(hubCard).join('')}</div>` : ''}
            ${soon.length ? `
            <div class="pg-soon">
                <span class="pg-dim pg-small">Próximamente en tu plan:</span>
                ${soon.map((m) => `<span class="pg-chip is-off" title="${Page.esc(m.text)}"><i data-lucide="${Page.esc(m.icon)}"></i>${Page.esc(m.name)}</span>`).join('')}
            </div>` : ''}
        </section>`;
}

const CAJAS = {
    open: { text: 'Caja abierta',      tone: 'is-ok' },
    old:  { text: 'Turno sin cerrar',  tone: 'is-warn' },
    none: { text: 'Sin turno abierto', tone: 'is-off' }
};

// Como va cada sucursal hoy. Con una sola, las cifras de arriba ya lo dicen.
function branchesCard(b) {
    if (b.branches.length < 2) return '';

    const rows = b.branches.map((s) => `
        <tr>
            <td class="pg-strong">${Page.esc(s.name)}</td>
            <td class="pg-td-num" data-label="Vendido">${Page.esc(Page.money(s.sold))}</td>
            <td class="pg-td-num" data-label="Cobrado">${Page.esc(Page.money(s.paid))}</td>
            <td class="pg-td-num" data-label="Ventas y pedidos">${s.tickets}</td>
            <td class="pg-td-num" data-label="Por entregar">${s.to_deliver}</td>
            <td class="pg-td-num" data-label="Caja"><span class="pg-chip is-mini ${CAJAS[s.turn].tone}">${CAJAS[s.turn].text}</span></td>
        </tr>`).join('');

    return `
        <div class="pg-card">
            <div class="pg-card-head">
                <p class="pg-card-title">Hoy por sucursal</p>
            </div>
            <div class="pg-table-wrap">
                <table class="pg-table">
                    <thead><tr><th>Sucursal</th><th class="pg-td-num">Vendido</th><th class="pg-td-num">Cobrado</th><th class="pg-td-num">Ventas y pedidos</th><th class="pg-td-num">Por entregar</th><th class="pg-td-num">Caja</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}

const ACTIVIDAD = { payment: 'banknote', delivery: 'package-check', event: 'plus', edition: 'pencil' };

// Lo ultimo que paso con los pedidos y ventas, en cualquier sucursal.
function activityCard(b) {
    if (!b.activity.length) return '';

    const rows = b.activity.map((a) => `
        <div class="pg-row">
            <span class="pg-ico"><i data-lucide="${ACTIVIDAD[a.type] || 'activity'}"></i></span>
            <div class="pg-row-text">
                <p class="pg-strong pg-clamp">${Page.esc(a.text)}</p>
                <p class="pg-dim pg-small pg-ellipsis">${Page.esc(['Folio ' + a.folio, a.branch, a.user].filter(Boolean).join(' · '))}</p>
            </div>
            <span class="pg-dim pg-small pg-nowrap">${Page.esc(ago(a.at))}</span>
        </div>`).join('');

    return `
        <div class="pg-card">
            <div class="pg-card-head"><p class="pg-card-title">Actividad reciente</p></div>
            <div class="pg-list">${rows}</div>
        </div>`;
}

// '2026-11-14 09:08:11' (hora del servidor) -> "hace 5 min", "ayer", "30 oct".
function ago(at) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(at || '');
    if (!m) return '';

    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
    const min  = Math.floor((Date.now() - date.getTime()) / 60000);

    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    if (min < 1440) return `hace ${Math.floor(min / 60)} h`;
    if (min < 2880) return 'ayer';

    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// -- Columna lateral --

/*  Cumpleaños y aniversarios laborales (años en la empresa, por
    employees.hire_date) del mes. Solo sale la tarjeta que tiene a quien
    festejar; sin nadie, una sola linea. */
function datesCards(d) {
    if (!d.birthdays.length && !d.anniversaries.length) {
        return `
            <div class="pg-card">
                <div class="pg-row">
                    <span class="pg-ico"><i data-lucide="cake"></i></span>
                    <div class="pg-row-text">
                        <p class="pg-strong">Sin festejos este mes</p>
                        <p class="pg-dim pg-small">Aquí verás los cumpleaños y aniversarios laborales de tu equipo.</p>
                    </div>
                </div>
            </div>`;
    }

    return (d.birthdays.length ? peopleCard('cake', 'Cumpleaños', d.birthdays, (p) => `${p.day} de ${mesActual()}`) : '')
         + (d.anniversaries.length ? peopleCard('party-popper', 'Aniversarios laborales', d.anniversaries, (p) => `${p.years} ${p.years === 1 ? 'año' : 'años'} en la empresa · ${p.day} de ${mesActual()}`) : '');
}

// El icono y el titulo van siempre arriba; a quien le toca hoy se le marca.
function peopleCard(icon, title, people, detail) {
    const rows = people.map((p) => `
        <div class="pg-row">
            ${Page.avatar(p, 'sm')}
            <div class="pg-row-text">
                <p class="pg-strong pg-ellipsis">${Page.esc(p.name)}</p>
                <p class="pg-dim pg-small">${Page.esc(detail(p))}</p>
            </div>
            ${p.today ? '<span class="pg-chip is-mini is-ok">¡Hoy!</span>' : ''}
        </div>`).join('');

    return `
        <div class="pg-card">
            <div class="pg-card-head">
                <p class="pg-card-title"><span class="pg-ico"><i data-lucide="${icon}"></i></span>${Page.esc(title)}</p>
                <span class="pg-chip is-mini" title="Este mes">${people.length}</span>
            </div>
            <div class="pg-list">${rows}</div>
        </div>`;
}
