/*  V8 · Tienda en linea: lo que ve y usa el cliente en pedir.php.

    Pagina publica e independiente (como ticket.php): sin jQuery ni coffeeSoft.
    Habla con ctrl/ctrl-pedir.php:
      getCatalog   tienda, categorias y productos.
      addWebOrder  manda el pedido; precio y nombre los pone el servidor.

    El carrito se guarda en este navegador por enlace (7 dias). Los datos del
    cliente, solo si deja marcada «Recordar mis datos». Todo texto que llega del
    servidor pasa por esc() antes de pintarse. */

(function () {
    'use strict';

    // -- Constantes --

    const TOKEN     = document.body.dataset.token || '';
    const API       = document.body.dataset.api || 'ctrl/ctrl-pedir.php';
    const CART_KEY  = 'huubie:pedir:' + TOKEN + ':v1';
    const ME_KEY    = 'huubie:pedir:yo:v1';
    const CART_TTL  = 7 * 24 * 60 * 60 * 1000;
    const MAX_QTY   = 999;
    const DAY_CHIPS = 8;
    const WEEK      = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const MONTHS    = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    const ICONS = {
        search:   '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        plus:     '<path d="M5 12h14"/><path d="M12 5v14"/>',
        minus:    '<path d="M5 12h14"/>',
        trash:    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
        bag:      '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
        x:        '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        back:     '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
        store:    '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>',
        truck:    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
        bank:     '<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="m12 2 8 5H4z"/>',
        wallet:   '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
        check:    '<path d="M20 6 9 17l-5-5"/>',
        copy:     '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
        chat:     '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
        calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
        alert:    '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
        moon:     '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
        link:     '<path d="M9 17H7A5 5 0 0 1 7 7"/><path d="M15 7h2a5 5 0 0 1 4 8"/><path d="M8 12h4"/><path d="m2 2 20 20"/>',
        refresh:  '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'
    };

    // -- Estado --

    const S = {
        store:      null,
        open:       false,
        categories: [],
        products:   [],
        byId:       new Map(),
        cart:       new Map(),      // id de producto -> cantidad
        view:       'loading',      // catalog | checkout | done | closed | gone
        q:          '',
        sending:    false,
        order:      null,
        pruned:     0,              // productos que salieron del carrito en la ultima carga
        loadedAt:   0,
        scrollY:    0,
        form: {
            name: '', phone: '', email: '', address: '', note: '',
            delivery: '', payment: '', date: '', time: '',
            otherDate: false, remember: true
        }
    };

    const app = document.getElementById('app');
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    let backdrop, cartbar, dlg, toastEl, toastTimer, lastFocus = null, ticking = false, spyLock = 0, dlgId = 0, dlgQty = 1;

    // -- Utilidades --

    const $     = (sel, root) => (root || document).querySelector(sel);
    const $$    = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
    const money = n => fmt.format(Number(n) || 0);
    const round = n => Math.round((Number(n) || 0) * 100) / 100;

    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function icon(name, size) {
        const s = size || 18;
        return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
    }

    // Sin acentos y en minusculas, para buscar «pastel» y encontrar «Pastél».
    function plain(v) {
        return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    function initials(name) {
        const words = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
        return words.map(w => w.charAt(0).toUpperCase()).join('') || '?';
    }

    function plural(n, one, many) {
        return n + ' ' + (n === 1 ? one : many);
    }

    // «52 993 123 4567», «+52 1 993...» o «993-123-4567» -> 10 digitos, o '' si no cuadra.
    function phone10(v) {
        let d = String(v || '').replace(/\D/g, '');
        if (d.length > 10) {
            const m = d.match(/^521?(\d{10})$/);
            if (m) d = m[1];
        }
        return d.length === 10 ? d : '';
    }

    function addDays(ymd, n) {
        const p = ymd.split('-').map(Number);
        return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
    }

    function dayParts(ymd) {
        const p = ymd.split('-').map(Number);
        const t = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
        return { week: WEEK[t.getUTCDay()], day: p[2], month: MONTHS[p[1] - 1] };
    }

    // La hora de la tienda (la del servidor al cargar) mas lo que ha pasado desde entonces.
    function storeNow() {
        const parts = String(S.store && S.store.now || '00:00').split(':').map(Number);
        const mins  = parts[0] * 60 + parts[1] + Math.floor((Date.now() - S.loadedAt) / 60000);
        const h     = Math.min(23, Math.floor(mins / 60));
        const m     = mins >= 24 * 60 ? 59 : mins % 60;
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    function readStore(key) {
        try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
    }

    function writeStore(key, value) {
        try {
            if (value == null) localStorage.removeItem(key);
            else localStorage.setItem(key, JSON.stringify(value));
        } catch (e) { /* modo privado o almacenamiento bloqueado: se sigue sin guardar */ }
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
            ta.remove();
            return ok;
        }
    }

    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('is-on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
    }

    function waStore() {
        return S.store && /^\d{10}$/.test(S.store.whatsapp || '') ? 'https://wa.me/52' + S.store.whatsapp : '';
    }

    // Salto sin animacion: el html tiene scroll-behavior: smooth.
    function jump(y) {
        window.scrollTo({ top: Math.max(0, y), left: 0, behavior: 'instant' });
    }

    // Al cambiar de vista: al inicio del contenido, debajo de la portada.
    function toApp() {
        jump(app.getBoundingClientRect().top + window.scrollY - 12);
    }

    // -- Servidor --

    async function post(opc, data) {
        const payload = new URLSearchParams(Object.assign({ opc: opc, t: TOKEN }, data || {}));
        const res     = await fetch(API, { method: 'POST', body: payload, cache: 'no-store', headers: { Accept: 'application/json' } });
        const json    = await res.json();

        if (!json || typeof json !== 'object') throw new Error('Respuesta vacía');

        return json;
    }

    async function load(keepView) {
        let res;

        try {
            res = await post('getCatalog');
        } catch (e) {
            return paintFail();
        }

        if (res.status === 404) return paintGone(res.message);
        if (res.status !== 200) return paintFail(res.message);

        S.store      = res.store || {};
        S.open       = !!res.open;
        S.categories = res.categories || [];
        S.products   = res.products || [];
        S.byId       = new Map(S.products.map(p => [Number(p.id), p]));
        S.loadedAt   = Date.now();
        S.pruned     = pruneCart();

        if (!S.open) return paintClosed();

        if (keepView && S.view === 'checkout' && S.cart.size) return paintCheckout();

        paintCatalog();
    }

    // -- Carrito --

    function readCart() {
        const saved = readStore(CART_KEY);

        if (!saved || !Array.isArray(saved.items) || Date.now() - Number(saved.at || 0) > CART_TTL) return;

        saved.items.forEach(item => {
            const id  = Number(item && item[0]);
            const qty = Math.min(MAX_QTY, Math.floor(Number(item && item[1])));
            if (id > 0 && qty > 0) S.cart.set(id, qty);
        });
    }

    function saveCart() {
        writeStore(CART_KEY, S.cart.size ? { at: Date.now(), items: Array.from(S.cart) } : null);
    }

    // Lo que ya no esta en la tienda sale del carrito.
    function pruneCart() {
        let gone = 0;

        Array.from(S.cart.keys()).forEach(id => {
            if (!S.byId.has(id)) { S.cart.delete(id); gone++; }
        });

        if (gone) saveCart();

        return gone;
    }

    function cartLines() {
        return Array.from(S.cart)
            .map(([id, q]) => ({ p: S.byId.get(id), q: q }))
            .filter(l => l.p)
            .map(l => Object.assign(l, { amount: round(l.p.price * l.q) }));
    }

    function setQty(id, qty) {
        const before = S.cart.get(id) || 0;
        const q      = Math.max(0, Math.min(MAX_QTY, Math.floor(qty)));

        if (q) S.cart.set(id, q);
        else S.cart.delete(id);

        saveCart();
        paintItem(id);
        paintCart();

        if (q > before) bump();

        if (S.view === 'checkout' && !S.cart.size) {
            closeOverlays();
            backToCatalog();
            toast('Tu carrito quedó vacío.');
        }
    }

    function bump() {
        if (!cartbar) return;
        cartbar.classList.remove('bump');
        void cartbar.offsetWidth;
        cartbar.classList.add('bump');
    }

    // -- Piezas --

    function photo(p, badge) {
        const ini   = initials(p.name);
        const q     = badge ? (S.cart.get(Number(p.id)) || 0) : 0;
        const inner = p.image
            ? '<img src="' + esc(p.image) + '" data-src="' + esc(p.image) + '" data-ini="' + esc(ini) + '" alt="" loading="lazy" decoding="async">'
            : '<span class="ini">' + esc(ini) + '</span>';

        return '<div class="ph' + (p.image ? '' : ' is-empty') + '">' + inner + (q ? '<span class="badge">' + q + '</span>' : '') + '</div>';
    }

    function control(id, size) {
        const q = S.cart.get(id) || 0;

        if (!q && size !== 'sm') {
            return '<button type="button" class="add" data-act="add" data-id="' + id + '" aria-label="Agregar al pedido">' + icon('plus', 20) + '</button>';
        }

        return '<div class="step ' + (size || '') + '">'
             +   '<button type="button" data-act="dec" data-id="' + id + '" aria-label="' + (q === 1 ? 'Quitar del pedido' : 'Uno menos') + '">' + icon(q === 1 ? 'trash' : 'minus', 16) + '</button>'
             +   '<span>' + q + '</span>'
             +   '<button type="button" data-act="inc" data-id="' + id + '" aria-label="Uno más"' + (q >= MAX_QTY ? ' disabled' : '') + '>' + icon('plus', 16) + '</button>'
             + '</div>';
    }

    function card(p) {
        const id = Number(p.id);
        const q  = S.cart.get(id) || 0;

        return '<article class="card' + (q ? ' is-in' : '') + '" data-id="' + id + '" data-text="' + esc(plain(p.name + ' ' + p.description)) + '">'
             +   '<a class="open" href="#producto-' + id + '" data-act="view" data-id="' + id + '">'
             +     photo(p, true)
             +     '<div class="txt"><h3>' + esc(p.name) + '</h3>' + (p.description ? '<p class="desc">' + esc(p.description) + '</p>' : '') + '</div>'
             +   '</a>'
             +   '<div class="foot"><span class="price">' + money(p.price) + '</span><div class="ctl" data-ctl="' + id + '">' + control(id) + '</div></div>'
             + '</article>';
    }

    // Una tarjeta ya pintada: insignia, borde y boton, sin repintar todo el catalogo.
    function paintItem(id) {
        const q = S.cart.get(id) || 0;

        $$('.card[data-id="' + id + '"]').forEach(el => {
            el.classList.toggle('is-in', q > 0);

            const ph = $('.ph', el);
            let badge = $('.badge', ph);

            if (q && !badge) {
                badge = document.createElement('span');
                badge.className = 'badge';
                ph.appendChild(badge);
            }

            if (badge) {
                if (q) badge.textContent = q;
                else badge.remove();
            }

            $('.ctl', el).innerHTML = control(id);
        });
    }

    // -- Armazon --

    function overlays() {
        document.body.insertAdjacentHTML('beforeend',
              '<div class="backdrop" id="backdrop" data-act="close"></div>'
            + '<button type="button" class="cartbar" id="cartbar" data-act="cart-open"><span class="n">0</span><span class="lbl">Ver mi pedido</span><span class="amt"></span></button>'
            + '<div class="dlg" id="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgTitle"></div>'
            + '<div class="toast" id="toast" role="status" aria-live="polite"></div>');

        backdrop = $('#backdrop');
        cartbar  = $('#cartbar');
        dlg      = $('#dlg');
        toastEl  = $('#toast');
    }

    function shell() {
        if ($('#main')) return;

        app.innerHTML =
              '<div class="bar" id="bar"><div class="bar-in">'
            +   '<div class="search">' + icon('search', 18)
            +     '<input id="q" type="search" placeholder="Buscar productos" aria-label="Buscar productos" autocomplete="off" enterkeyhint="search">'
            +     '<button type="button" class="clear" data-act="clear" aria-label="Borrar búsqueda" hidden>' + icon('x', 16) + '</button>'
            +   '</div>'
            +   '<div class="chips" id="chips"></div>'
            + '</div></div>'
            + '<div class="layout"><main id="main"></main><aside class="cart" id="cart" aria-label="Tu pedido"></aside></div>';

        const q = $('#q');
        let timer;

        q.value = S.q;
        q.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                S.q = q.value;
                $('[data-act="clear"]').hidden = q.value === '';
                applySearch();
            }, 120);
        });

        if (window.ResizeObserver) new ResizeObserver(measure).observe($('#bar'));
    }

    // Alto de la barra fija: de ahi salen el tope del carrito y el salto a cada categoria.
    function measure() {
        const bar = $('#bar');
        const h   = bar && !bar.hidden && S.view === 'catalog' ? bar.offsetHeight : 0;
        document.documentElement.style.setProperty('--top', h + 'px');
    }

    // -- Catalogo --

    function paintCatalog() {
        S.view = 'catalog';
        document.body.classList.remove('is-done');
        shell();

        $('#bar').hidden = false;

        const chips = $('#chips');
        chips.hidden    = S.categories.length < 2;
        chips.innerHTML = S.categories.map((c, i) =>
            '<button type="button" class="chip' + (i === 0 ? ' is-active' : '') + '" data-act="chip" data-cat="' + Number(c.id) + '">' + esc(c.name) + ' <small>' + Number(c.count) + '</small></button>'
        ).join('');

        const main = $('#main');

        if (!S.products.length) {
            $('#bar').hidden = true;
            main.innerHTML = '<div class="box empty">' + icon('bag', 34) + '<b>Aún no hay productos en la tienda</b>Vuelve pronto: la tienda está preparando su catálogo.</div>';
        } else {
            main.innerHTML = S.categories.map(c => {
                const items = S.products.filter(p => Number(p.category_id) === Number(c.id));
                return '<section class="cat" id="cat-' + Number(c.id) + '" data-cat="' + Number(c.id) + '">'
                     +   '<h2>' + esc(c.name) + ' <small>' + items.length + '</small></h2>'
                     +   '<div class="grid">' + items.map(card).join('') + '</div>'
                     + '</section>';
            }).join('')
            + '<div class="empty" id="noResults" hidden>' + icon('search', 34) + '<b>Sin resultados</b><span id="noResultsTxt"></span></div>';
        }

        paintCart();
        applySearch();
        measure();
        onScroll();
    }

    function applySearch() {
        const main = $('#main');
        if (!main || S.view !== 'catalog') return;

        const terms = plain(S.q).trim().split(/\s+/).filter(Boolean);
        let any = false;

        $$('.cat', main).forEach(sec => {
            let shown = 0;

            $$('.card', sec).forEach(el => {
                const ok = terms.every(t => el.dataset.text.indexOf(t) !== -1);
                el.hidden = !ok;
                if (ok) shown++;
            });

            sec.hidden = shown === 0;
            if (shown) any = true;

            const chip = $('.chip[data-cat="' + sec.dataset.cat + '"]');
            if (chip) chip.hidden = shown === 0;
        });

        const none = $('#noResults');

        if (none) {
            none.hidden = any;
            $('#noResultsTxt').textContent = 'No encontramos «' + S.q.trim() + '». Prueba con otra palabra.';
        }

        onScroll();
    }

    function goCategory(id) {
        const sec = $('#cat-' + id);
        if (!sec) return;

        if (S.q) {
            S.q = '';
            $('#q').value = '';
            $('[data-act="clear"]').hidden = true;
            applySearch();
        }

        setChip(id);
        spyLock = Date.now() + 700;
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function setChip(id) {
        const chips = $('#chips');
        if (!chips) return;

        let active = null;

        $$('.chip', chips).forEach(c => {
            const on = c.dataset.cat === String(id);
            c.classList.toggle('is-active', on);
            if (on) active = c;
        });

        if (active) {
            chips.scrollTo({ left: active.offsetLeft - chips.clientWidth / 2 + active.clientWidth / 2, behavior: 'smooth' });
        }
    }

    // Barra con sombra al pegarse arriba y categoria activa segun lo que se ve.
    function onScroll() {
        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
            ticking = false;

            const bar = $('#bar');
            if (!bar || bar.hidden || S.view !== 'catalog') return;

            bar.classList.toggle('is-stuck', bar.getBoundingClientRect().top <= 0.5);

            if (Date.now() < spyLock) return;

            const secs = $$('#main .cat:not([hidden])');
            if (!secs.length) return;

            const line   = bar.offsetHeight + 48;
            const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
            let cur      = secs[0];

            if (bottom) cur = secs[secs.length - 1];
            else secs.forEach(sec => { if (sec.getBoundingClientRect().top <= line) cur = sec; });

            const chip = $('.chip.is-active');
            if (!chip || chip.dataset.cat !== cur.dataset.cat) setChip(cur.dataset.cat);
        });
    }

    // -- Panel del pedido --

    function paintCart() {
        const box = $('#cart');
        const lines = cartLines();
        const count = lines.reduce((a, l) => a + l.q, 0);
        const total = round(lines.reduce((a, l) => a + l.amount, 0));
        const isCo  = S.view === 'checkout';

        if (box) {
            const head = '<div class="cart-head"><h2>' + (isCo ? 'Resumen' : 'Tu pedido') + '</h2>'
                       + (count ? '<small>' + plural(count, 'pieza', 'piezas') + '</small>' : '')
                       + '<button type="button" class="x" data-act="close" aria-label="Cerrar">' + icon('x') + '</button></div>';

            if (!lines.length) {
                box.innerHTML = head + '<div class="empty">' + icon('bag', 34) + '<b>Tu carrito está vacío</b>Toca <strong>+</strong> en un producto para agregarlo.</div>';
            } else {
                const list = lines.map(l => {
                    const id = Number(l.p.id);
                    return '<div class="line">' + photo(l.p, false)
                         +   '<div><b title="' + esc(l.p.name) + '">' + esc(l.p.name) + '</b><small>' + money(l.p.price) + ' c/u</small></div>'
                         +   '<div class="right"><span class="amt">' + money(l.amount) + '</span>' + control(id, 'sm') + '</div>'
                         + '</div>';
                }).join('');

                const action = isCo
                    ? '<button type="button" class="btn only-d js-send" data-act="send"' + (S.sending ? ' disabled' : '') + '>' + icon('check') + (S.sending ? 'Enviando…' : 'Enviar pedido') + '</button>'
                      + '<p class="fine only-d">No se cobra nada al enviar. La tienda te confirma por WhatsApp.</p>'
                    : '<button type="button" class="btn" data-act="checkout">Continuar <span class="sum">' + money(total) + '</span></button>';

                box.innerHTML = head
                    + '<div class="cart-list">' + list + '</div>'
                    + '<div class="cart-foot">'
                    +   '<div class="total"><span>Total</span><strong>' + money(total) + '</strong></div>'
                    +   (S.store && S.store.delivery ? '<p class="fine">Si eliges envío a domicilio, el costo se acuerda con la tienda.</p>' : '')
                    +   action
                    + '</div>';
            }
        }

        if (cartbar) {
            cartbar.classList.toggle('is-on', count > 0 && S.view === 'catalog');
            $('.n', cartbar).textContent  = count;
            $('.amt', cartbar).textContent = money(total);
        }

        $$('[data-total]').forEach(el => { el.textContent = money(total); });
        $$('[data-count]').forEach(el => { el.textContent = plural(count, 'pieza', 'piezas'); });
    }

    function openCart() {
        const box = $('#cart');
        if (!box || window.matchMedia('(min-width: 980px)').matches) return;

        lastFocus = document.activeElement;
        box.classList.add('is-open');
        backdrop.classList.add('is-open');
        document.documentElement.classList.add('lock');
        const x = $('.x', box);
        if (x) x.focus({ preventScroll: true });
    }

    function closeOverlays() {
        const box = $('#cart');
        const was = (box && box.classList.contains('is-open')) || (dlg && dlg.classList.contains('is-open'));

        if (box) box.classList.remove('is-open');
        if (dlg) dlg.classList.remove('is-open');
        if (backdrop) backdrop.classList.remove('is-open');
        document.documentElement.classList.remove('lock');

        // El foco regresa al boton que abrio la capa, si sigue en la pagina.
        if (was && lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
        lastFocus = null;
    }

    // -- Ficha del producto --

    function openProduct(id) {
        const p = S.byId.get(id);
        if (!p) return;

        dlgId  = id;
        dlgQty = S.cart.get(id) || 1;

        dlg.innerHTML = '<button type="button" class="x" data-act="close" aria-label="Cerrar">' + icon('x') + '</button>'
            + photo(p, false)
            + '<div class="dlg-body">'
            +   '<h2 id="dlgTitle">' + esc(p.name) + '</h2>'
            +   '<strong class="price">' + money(p.price) + '</strong>'
            +   (p.description ? '<p>' + esc(p.description) + '</p>' : '')
            +   '<div class="dlg-foot">'
            +     '<div class="step lg"><button type="button" data-act="dlg-dec" aria-label="Uno menos">' + icon('minus') + '</button><span id="dlgQty"></span><button type="button" data-act="dlg-inc" aria-label="Uno más">' + icon('plus') + '</button></div>'
            +     '<button type="button" class="btn" data-act="dlg-add" id="dlgAdd"></button>'
            +   '</div>'
            + '</div>';

        paintDlg();
        lastFocus = document.activeElement;
        dlg.scrollTop = 0;
        dlg.classList.add('is-open');
        backdrop.classList.add('is-open');
        document.documentElement.classList.add('lock');
        $('#dlgAdd').focus({ preventScroll: true });
    }

    function paintDlg() {
        const p = S.byId.get(dlgId);
        if (!p) return;

        $('#dlgQty').textContent = dlgQty;
        $('#dlgAdd').textContent = (S.cart.has(dlgId) ? 'Guardar' : 'Agregar') + ' · ' + money(p.price * dlgQty);
        $('[data-act="dlg-dec"]', dlg).disabled = dlgQty <= 1;
        $('[data-act="dlg-inc"]', dlg).disabled = dlgQty >= MAX_QTY;
    }

    // -- Formulario del pedido --

    function goCheckout() {
        if (!S.cart.size) return;

        S.scrollY = window.scrollY;
        lastFocus = null;
        closeOverlays();

        try { history.pushState({ pedir: 'checkout' }, ''); } catch (e) { /* sin historial: el boton de regresar sigue sirviendo */ }

        paintCheckout();
        toApp();
    }

    function backToCatalog() {
        if (history.state && history.state.pedir === 'checkout') {
            history.back();
            return;
        }

        paintCatalog();
        jump(S.scrollY);
    }

    function option(group, value, ic, title, sub, subKey) {
        const on = S.form[group] === value;

        return '<label class="opt' + (on ? ' is-on' : '') + '">'
             +   '<input type="radio" name="' + group + '" value="' + value + '"' + (on ? ' checked' : '') + '>'
             +   '<span class="ic">' + icon(ic, 19) + '</span>'
             +   '<span><b>' + esc(title) + '</b><small' + (subKey ? ' data-sub="' + subKey + '"' : '') + '>' + esc(sub) + '</small></span>'
             + '</label>';
    }

    function field(key, label, input, hidden, cls) {
        return '<div class="field' + (cls ? ' ' + cls : '') + '" data-field="' + key + '"' + (hidden ? ' hidden' : '') + '><label for="f_' + key + '">' + label + '</label>' + input + '</div>';
    }

    function payStoreText() {
        return S.form.delivery === 'delivery' ? 'Pagas cuando recibes tu pedido' : 'Pagas cuando recoges tu pedido';
    }

    function daysHtml() {
        const st = S.store, f = S.form, out = [];
        const tomorrow = addDays(st.today, 1);
        let d = st.min_date;

        for (let i = 0; i < DAY_CHIPS && d <= st.max_date; i++, d = addDays(d, 1)) {
            const p  = dayParts(d);
            const on = !f.otherDate && f.date === d;
            const top = d === st.today ? 'Hoy' : (d === tomorrow ? 'Mañana' : p.week);

            out.push('<button type="button" class="day' + (on ? ' is-on' : '') + '" data-act="day" data-date="' + d + '" aria-pressed="' + on + '">'
                + '<small>' + top + '</small><b>' + p.day + '</b><span>' + p.month + '</span></button>');
        }

        out.push('<button type="button" class="day more' + (f.otherDate ? ' is-on' : '') + '" data-act="more-day" aria-pressed="' + f.otherDate + '">'
            + '<span>' + icon('calendar', 18) + '<br>Otra fecha</span></button>');

        return out.join('');
    }

    function paintCheckout() {
        const st = S.store, f = S.form;

        S.view = 'checkout';
        document.body.classList.remove('is-done');
        shell();
        $('#bar').hidden = true;
        measure();

        // Opcion que la tienda ya no da: se borra. Si solo hay una, va elegida.
        if ((f.delivery === 'pickup' && !st.pickup) || (f.delivery === 'delivery' && !st.delivery)) f.delivery = '';
        if ((f.payment === 'store' && !st.pay_store) || (f.payment === 'transfer' && !st.pay_transfer)) f.payment = '';
        if (!f.delivery && st.pickup !== st.delivery) f.delivery = st.pickup ? 'pickup' : 'delivery';
        if (!f.payment && st.pay_store !== st.pay_transfer) f.payment = st.pay_store ? 'store' : 'transfer';
        if (f.date && (f.date < st.min_date || f.date > st.max_date)) { f.date = ''; f.otherDate = false; }

        const place = [st.branch, st.address].filter(Boolean).join(' · ');
        const lead  = Number(st.lead_days) || 0;

        $('#main').innerHTML =
              '<div class="co-top"><button type="button" class="link" data-act="back">' + icon('back') + 'Seguir comprando</button></div>'
            + '<h2 class="co-title">Completa tu pedido</h2>'
            + '<div id="coError"></div>'
            + '<form id="coForm" novalidate autocomplete="on">'

            + '<section class="box"><h3><i>1</i>Tus datos</h3>'
            +   '<div class="fields two">'
            +     field('name', 'Nombre', '<input id="f_name" name="name" type="text" autocomplete="name" maxlength="120" value="' + esc(f.name) + '">')
            +     field('phone', 'Teléfono <small>(WhatsApp)</small>', '<input id="f_phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="10 dígitos" value="' + esc(f.phone) + '">')
            +   '</div>'
            +   field('email', 'Correo <small>(opcional)</small>', '<input id="f_email" name="email" type="email" inputmode="email" autocomplete="email" maxlength="255" value="' + esc(f.email) + '">', false, 'mt')
            + '</section>'

            + '<section class="box"><h3><i>2</i>Entrega</h3>'
            +   '<div class="opts" data-field="delivery">'
            +     (st.pickup ? option('delivery', 'pickup', 'store', 'Recojo en tienda', place || 'En la sucursal') : '')
            +     (st.delivery ? option('delivery', 'delivery', 'truck', 'Envío a domicilio', 'El costo del envío se acuerda por WhatsApp') : '')
            +   '</div>'
            +   field('address', 'Dirección de entrega', '<textarea id="f_address" name="address" rows="2" maxlength="255" autocomplete="street-address" placeholder="Calle, número, colonia y alguna referencia">' + esc(f.address) + '</textarea>', f.delivery !== 'delivery', 'mt')
            +   '<p class="sub">¿Para cuándo?</p>'
            +   '<div class="days" id="days" data-field="date">' + daysHtml() + '</div>'
            +   '<div class="when">'
            +     field('dateOther', 'Otra fecha', '<input id="f_dateOther" name="date" type="date" min="' + esc(st.min_date) + '" max="' + esc(st.max_date) + '" value="' + (f.otherDate ? esc(f.date) : '') + '">', !f.otherDate)
            +     field('time', 'Hora', '<input id="f_time" name="time" type="time" step="900" value="' + esc(f.time) + '">')
            +   '</div>'
            +   (lead ? '<p class="hint">Pedimos ' + plural(lead, 'día', 'días') + ' de anticipación.</p>' : '')
            + '</section>'

            + '<section class="box"><h3><i>3</i>Pago</h3>'
            +   '<div class="opts" data-field="payment">'
            +     (st.pay_transfer ? option('payment', 'transfer', 'bank', 'Transferencia', 'Te damos los datos al terminar') : '')
            +     (st.pay_store ? option('payment', 'store', 'wallet', 'Pago en tienda', payStoreText(), 'store') : '')
            +   '</div>'
            + '</section>'

            + '<section class="box"><h3><i>4</i>Nota para la tienda <em>Opcional</em></h3>'
            +   '<div class="field" data-field="note"><label for="f_note" class="sr">Nota</label>'
            +     '<textarea id="f_note" name="note" rows="3" maxlength="2000" placeholder="Ej. texto del pastel, sin nuez, vela de cumpleaños…">' + esc(f.note) + '</textarea>'
            +   '</div>'
            + '</section>'

            + '<label class="check"><input type="checkbox" name="remember"' + (f.remember ? ' checked' : '') + '> Recordar mis datos en este dispositivo</label>'
            + '<div class="trap" aria-hidden="true"><label>No llenar este campo <input name="website" type="text" tabindex="-1" autocomplete="off"></label></div>'

            // Hijos directos del form: asi el boton fijo (sticky) acompaña todo el formulario en el celular.
            + '<div class="resume only-m"><button type="button" class="link" data-act="cart-open">' + icon('bag', 16) + 'Ver resumen · <span data-count></span></button></div>'
            + '<div class="send-m only-m"><button type="submit" class="btn js-send"' + (S.sending ? ' disabled' : '') + '>' + (S.sending ? 'Enviando… ' : 'Enviar pedido ') + '<span class="sum" data-total></span></button></div>'
            + '<p class="fine only-m" style="text-align:center;margin-top:10px">No se cobra nada al enviar. La tienda te confirma por WhatsApp.</p>'
            + '</form>';

        paintCart();
    }

    function repaintDays() {
        const days = $('#days');
        if (days) days.innerHTML = daysHtml();

        const other = $('[data-field="dateOther"]');
        if (other) other.hidden = !S.form.otherDate;
    }

    function onDelivery() {
        const address = $('[data-field="address"]');
        if (address) address.hidden = S.form.delivery !== 'delivery';

        const sub = $('[data-sub="store"]');
        if (sub) sub.textContent = payStoreText();

        if (S.form.delivery !== 'delivery') clearError('address');
    }

    // Cada campo del formulario vive en S.form: si la pagina se repinta, nada se pierde.
    function onField(e) {
        const el = e.target;

        if (!el || !el.name || !el.closest || !el.closest('#coForm') || el.name === 'website') return;

        const f = S.form;

        if (el.type === 'checkbox') f[el.name] = el.checked;
        else if (el.type === 'radio') {
            if (el.checked) f[el.name] = el.value;
            $$('#coForm input[name="' + el.name + '"]').forEach(r => r.closest('.opt').classList.toggle('is-on', r.checked));
        }
        else f[el.name] = el.value;

        clearError(el.name);

        if (el.name === 'delivery') onDelivery();
        if (el.name === 'payment')  clearError('payment');

        if (el.name === 'date') {
            f.otherDate = true;
            repaintDays();
        }
    }

    function validate() {
        const f = S.form, st = S.store, errs = {};
        const name = f.name.trim().replace(/\s+/g, ' ');

        if (name.length < 2) errs.name = 'Escribe tu nombre.';
        if (!phone10(f.phone)) errs.phone = 'Escribe tu número a 10 dígitos.';
        if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errs.email = 'Revisa tu correo, o déjalo vacío.';
        if (!f.delivery) errs.delivery = 'Elige cómo quieres recibir tu pedido.';
        if (f.delivery === 'delivery' && !f.address.trim()) errs.address = 'Escribe la dirección de entrega.';

        if (!f.date) errs.date = 'Elige el día de entrega.';
        else if (f.date < st.min_date || f.date > st.max_date) errs.date = 'Elige un día entre el ' + niceDate(st.min_date) + ' y el ' + niceDate(st.max_date) + '.';

        if (!/^\d{2}:\d{2}/.test(f.time)) errs.time = 'Elige la hora.';
        else if (f.date === st.today && f.time.slice(0, 5) <= storeNow()) errs.time = 'Para hoy, elige una hora más tarde.';

        if (!f.payment) errs.payment = 'Elige cómo quieres pagar.';

        return errs;
    }

    function niceDate(ymd) {
        const p = dayParts(ymd);
        return p.day + ' ' + p.month;
    }

    function showErrors(errs) {
        $$('#coForm .is-bad').forEach(el => el.classList.remove('is-bad'));
        $$('#coForm [data-err-of]').forEach(el => el.remove());

        let first = null;

        Object.keys(errs).forEach(key => {
            const host = $('#coForm [data-field="' + key + '"]');
            if (!host) return;

            host.classList.add('is-bad');

            const msg = '<p class="err" data-err-of="' + key + '">' + esc(errs[key]) + '</p>';

            if (host.classList.contains('field')) host.insertAdjacentHTML('beforeend', msg);
            else host.insertAdjacentHTML('afterend', msg);

            if (!first) first = host;
        });

        if (first) {
            first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const input = $('input:not([type=radio]), textarea', first);
            if (input) setTimeout(() => input.focus({ preventScroll: true }), 300);
        }
    }

    function clearError(key) {
        const k = key === 'dateOther' ? 'date' : key;
        const host = $('#coForm [data-field="' + k + '"]');

        if (host) host.classList.remove('is-bad');
        $$('#coForm [data-err-of="' + k + '"]').forEach(el => el.remove());
    }

    function banner(msg, withWa) {
        const box = $('#coError');
        if (!box) return toast(msg);

        if (!msg) {
            box.innerHTML = '';
            return;
        }

        const wa = withWa ? waStore() : '';

        box.innerHTML = '<div class="banner" role="alert">' + icon('alert') + '<div>' + esc(msg)
            + (wa ? ' <a href="' + esc(wa) + '" target="_blank" rel="noopener">Escribir por WhatsApp</a>' : '')
            + '</div></div>';

        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function setSending(on) {
        S.sending = on;

        $$('.js-send').forEach(btn => {
            btn.disabled = on;

            const sum = $('.sum', btn);
            const first = btn.firstChild;

            if (sum) {
                btn.firstChild.textContent = on ? 'Enviando… ' : 'Enviar pedido ';
            } else if (first) {
                btn.innerHTML = icon('check') + (on ? 'Enviando…' : 'Enviar pedido');
            }
        });
    }

    async function send() {
        if (S.sending) return;

        const errs = validate();

        showErrors(errs);
        if (Object.keys(errs).length) return;

        banner('');
        setSending(true);

        const f    = S.form;
        const trap = $('#coForm [name="website"]');
        let res;

        try {
            res = await post('addWebOrder', {
                name:     f.name.trim().replace(/\s+/g, ' '),
                phone:    phone10(f.phone),
                email:    f.email.trim(),
                delivery: f.delivery,
                payment:  f.payment,
                date:     f.date,
                time:     f.time.slice(0, 5),
                address:  f.delivery === 'delivery' ? f.address.trim() : '',
                note:     f.note.trim(),
                website:  trap ? trap.value : '',
                lines:    JSON.stringify(Array.from(S.cart).map(([id, qty]) => ({ id: id, qty: qty })))
            });
        } catch (e) {
            setSending(false);
            return banner('No pudimos enviar tu pedido. Revisa tu conexión e intenta de nuevo.');
        }

        setSending(false);

        if (res.status === 200 && res.order) {
            remember();
            S.cart.clear();
            saveCart();
            Object.assign(S.form, { note: '', date: '', time: '', otherDate: false });
            S.order = res.order;
            return paintDone();
        }

        // 409: la tienda cerro o un producto ya no esta. Se recarga la tienda al dia.
        if (res.status === 409) {
            await load(true);
            if (S.view === 'checkout') banner(S.pruned ? 'Quitamos de tu carrito lo que ya no está disponible. Revisa el resumen y vuelve a enviar tu pedido.' : res.message);
            else if (S.view === 'catalog') toast(S.pruned ? 'Lo que tenías en el carrito ya no está disponible.' : res.message);
            return;
        }

        banner(res.message || 'No pudimos enviar tu pedido. Intenta de nuevo.', res.status === 429);
    }

    function remember() {
        const f = S.form;

        writeStore(ME_KEY, f.remember
            ? { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), address: f.address.trim() }
            : null);
    }

    // -- Confirmacion --

    function paintDone() {
        const o  = S.order, st = S.store;
        const wa = /^https:\/\/wa\.me\/\d+/.test(o.wa || '') ? o.wa : '';

        S.view = 'done';
        closeOverlays();
        document.body.classList.add('is-done');
        shell();
        measure();

        try { history.replaceState(null, ''); } catch (e) { /* nada */ }

        const lines = (o.lines || []).map(l =>
            '<div><dt>' + Number(l.quantity) + ' × ' + esc(l.name) + '</dt><dd>' + money(l.amount) + '</dd></div>'
        ).join('');

        const bank = o.payment === 'transfer' && o.bank_info
            ? '<section class="box"><h3><i>' + icon('bank', 15) + '</i>Datos para transferir</h3>'
              + '<pre class="bank" id="bankInfo">' + esc(o.bank_info) + '</pre>'
              + '<p class="hint">Cuando transfieras, manda tu comprobante por WhatsApp con tu folio <b>' + esc(o.folio) + '</b>.</p>'
              + '<div class="acts" style="margin-top:12px"><button type="button" class="btn ghost" data-act="copy-bank">' + icon('copy') + 'Copiar datos</button></div>'
              + '</section>'
            : '';

        $('#main').innerHTML =
              '<div class="done">'
            +   '<div class="ok">' + icon('check', 38) + '</div>'
            +   '<h2>¡Pedido enviado!</h2>'
            +   '<p>' + esc(st.title) + ' lo va a revisar y te confirmará por WhatsApp.' + (wa ? ' Avísales que ya lo mandaste:' : '') + '</p>'
            +   '<span class="folio">Folio ' + esc(o.folio) + '</span>'
            + '</div>'
            + (wa ? '<div class="acts" style="margin:18px 0 14px"><a class="btn wa" href="' + esc(wa) + '" target="_blank" rel="noopener">' + icon('chat') + 'Avisar por WhatsApp</a></div>' : '<div style="height:18px"></div>')
            + bank
            + '<section class="box"><h3>Tu pedido</h3>'
            +   '<dl class="rows">'
            +     '<div><dt>A nombre de</dt><dd>' + esc(o.name) + '</dd></div>'
            +     '<div><dt>' + (o.delivery === 'delivery' ? 'Envío a' : 'Recoges en') + '</dt><dd>' + esc(o.address || st.branch) + '</dd></div>'
            +     '<div><dt>Cuándo</dt><dd>' + esc(o.when) + '</dd></div>'
            +     '<div><dt>Pago</dt><dd>' + (o.payment === 'transfer' ? 'Transferencia' : 'Pago en tienda') + '</dd></div>'
            +   '</dl>'
            +   '<dl class="rows" style="margin-top:10px;border-top:1px solid var(--line);padding-top:6px">' + lines + '</dl>'
            +   '<div class="total" style="margin-top:12px"><span>Total</span><strong>' + money(o.total) + '</strong></div>'
            +   (o.delivery === 'delivery' ? '<p class="fine" style="margin-top:6px">El costo del envío se acuerda con la tienda.</p>' : '')
            + '</section>'
            + '<div class="acts"><button type="button" class="btn ghost" data-act="again">Hacer otro pedido</button></div>';

        paintCart();
        toApp();
    }

    // -- Estados sin catalogo --

    function paintState(ic, title, text, extra) {
        closeOverlays();
        document.body.classList.remove('is-done');
        if (cartbar) cartbar.classList.remove('is-on');
        document.documentElement.style.setProperty('--top', '0px');

        app.innerHTML = '<div class="layout" style="grid-template-columns:minmax(0,560px);justify-content:center">'
            + '<div class="box empty">' + icon(ic, 34) + '<b>' + esc(title) + '</b>' + esc(text)
            + (extra ? '<div class="acts" style="margin-top:18px">' + extra + '</div>' : '')
            + '</div></div>';
    }

    function paintClosed() {
        S.view = 'closed';
        const wa = waStore();

        // La portada salio del servidor como «Recibiendo pedidos»: si cerro despues, se corrige.
        const badge = $('.hero .state');
        if (badge) {
            badge.classList.add('is-closed');
            badge.textContent = 'Cerrado por ahora';
        }

        paintState('moon', 'La tienda está cerrada por ahora', 'Vuelve más tarde para hacer tu pedido.',
            wa ? '<a class="btn wa" href="' + esc(wa) + '" target="_blank" rel="noopener">' + icon('chat') + 'Escribir por WhatsApp</a>' : '');
    }

    function paintGone(msg) {
        S.view = 'gone';
        paintState('link', msg || 'Este enlace no es válido.', 'Pídele a la tienda el enlace nuevo.', '');
    }

    function paintFail(msg) {
        S.view = 'gone';
        paintState('refresh', 'No pudimos cargar la tienda', msg || 'Revisa tu conexión a internet e intenta de nuevo.',
            '<button type="button" class="btn" data-act="retry">' + icon('refresh') + 'Reintentar</button>');
    }

    // -- Eventos --

    document.addEventListener('click', e => {
        const el = e.target.closest('[data-act]');
        if (!el) return;

        const act = el.dataset.act;
        const id  = Number(el.dataset.id || 0);

        switch (act) {
            case 'add':
            case 'inc':
                setQty(id, (S.cart.get(id) || 0) + 1);
                break;
            case 'dec':
                setQty(id, (S.cart.get(id) || 0) - 1);
                break;
            case 'view':
                e.preventDefault();
                openProduct(id);
                break;
            case 'chip':
                goCategory(el.dataset.cat);
                break;
            case 'clear':
                S.q = '';
                $('#q').value = '';
                el.hidden = true;
                applySearch();
                $('#q').focus();
                break;
            case 'cart-open':
                openCart();
                break;
            case 'close':
                closeOverlays();
                break;
            case 'checkout':
                goCheckout();
                break;
            case 'back':
                backToCatalog();
                break;
            case 'send':
                send();
                break;
            case 'day':
                S.form.date      = el.dataset.date;
                S.form.otherDate = false;
                clearError('date');
                repaintDays();
                break;
            case 'more-day': {
                S.form.otherDate = true;
                const input = $('#f_dateOther');
                S.form.date = input ? input.value : '';
                repaintDays();
                if (input) {
                    input.focus();
                    try { input.showPicker(); } catch (err) { /* navegador sin showPicker */ }
                }
                break;
            }
            case 'dlg-dec':
                dlgQty = Math.max(1, dlgQty - 1);
                paintDlg();
                break;
            case 'dlg-inc':
                dlgQty = Math.min(MAX_QTY, dlgQty + 1);
                paintDlg();
                break;
            case 'dlg-add': {
                const had = S.cart.has(dlgId);
                setQty(dlgId, dlgQty);
                closeOverlays();
                toast(had ? 'Pedido actualizado' : 'Agregado a tu pedido');
                break;
            }
            case 'copy-bank':
                copyText(S.order && S.order.bank_info || '').then(ok => toast(ok ? 'Datos copiados' : 'No se pudo copiar: selecciónalos a mano'));
                break;
            case 'again':
                S.order = null;
                paintCatalog();
                jump(0);
                break;
            case 'retry':
                app.innerHTML = '<div class="skel"><div></div><div></div><div></div><div></div></div>';
                load(false);
                break;
        }
    });

    document.addEventListener('submit', e => {
        if (e.target && e.target.id === 'coForm') {
            e.preventDefault();
            send();
        }
    });

    document.addEventListener('input', onField);
    document.addEventListener('change', onField);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeOverlays();
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { measure(); onScroll(); });

    window.addEventListener('popstate', () => {
        if (S.view === 'checkout') {
            closeOverlays();
            paintCatalog();
            jump(S.scrollY);
        }
    });

    // -- Arranque --

    if (!TOKEN) return;

    overlays();
    readCart();

    const me = readStore(ME_KEY);

    if (me && typeof me === 'object') {
        ['name', 'phone', 'email', 'address'].forEach(k => {
            if (typeof me[k] === 'string') S.form[k] = me[k].slice(0, 255);
        });
    }

    load(false);
})();
