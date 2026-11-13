/*  Lo que comparten las paginas de tarjetas (el inicio y el perfil): pedir al
    ctrl, escapar, pintar un avatar. Van sin coffeeSoft.js -- no usan tablas ni
    formularios del framework -- asi que esto es todo lo que necesitan. */
const Page = {
    // De esta pagina a pro/: las dos viven en app/<pagina>/.
    root: '../../',

    /*  POST a un ctrl. data puede ser un objeto o un FormData (subir la foto).
        Devuelve el JSON, o { status: 0 } si no hubo respuesta que leer. Con la
        sesion muerta manda al login: no hay nada que la pagina pueda hacer. */
    async post(url, data) {
        try {
            const body = data instanceof FormData ? data : new URLSearchParams(data);
            const res  = await fetch(url, { method: 'POST', body: body });
            const json = await res.json();

            if (json && json.status === 401) window.location.href = Page.root + 'index.php';

            return json || { status: 0 };
        } catch (e) {
            return { status: 0, message: 'No se pudo conectar con el servidor. Inténtalo de nuevo.' };
        }
    },

    esc(text) {
        return (text == null ? '' : String(text)).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    initials(name) {
        const parts = String(name || '').trim().split(/\s+/);
        const first = parts[0] ? parts[0][0] : '';
        const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
        return (first + last).toUpperCase() || '?';
    },

    // person: { name, photo, color }. size: '' | 'sm' | 'lg' | 'xl'.
    avatar(person, size) {
        const color = /^#[0-9A-Fa-f]{6}$/.test(person.color || '') ? ` style="background:${person.color}"` : '';
        const inner = person.photo
            ? `<img src="${Page.esc(person.photo)}" alt="">`
            : Page.esc(Page.initials(person.name));

        return `<span class="pg-avatar ${size ? 'is-' + size : ''}"${color} title="${Page.esc(person.name)}">${inner}</span>`;
    },

    money(amount, currency) {
        if (amount === null || amount === undefined) return '';

        try {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency || 'MXN', maximumFractionDigits: 2 }).format(amount);
        } catch (e) {
            return '$' + Number(amount).toFixed(2);
        }
    },

    // '2026-11-27' -> '27 de noviembre de 2026'. Se arma por partes y no con
    // new Date(iso): eso lo lee en UTC y en Mexico lo regresa un dia.
    date(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
        if (!m) return '';

        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
            .toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    },

    icons() {
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};
