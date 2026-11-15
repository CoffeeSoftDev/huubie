/*  Portal del cliente: lo que ve y usa el cliente en portal.php.

    Pagina publica e independiente (como pedir.php): sin jQuery ni coffeeSoft.
    Habla con ctrl/ctrl-portal.php:
      getPortal   lo que debe en la sucursal del enlace y sus comprobantes.
      addReceipt  sube un comprobante (foto o PDF) para revision.

    Subir un comprobante no abona nada: queda «En revisión» hasta que la tienda
    lo abona o lo rechaza con un motivo, que aqui se le muestra.
    Las fotos grandes se achican en el telefono antes de subir (lado largo de
    2000 px, JPG): una captura de 4 MB queda en unos cientos de KB y sube rapido
    con datos. Los PDF van tal cual.
    Todo texto que llega del servidor pasa por esc() antes de pintarse. */

(function () {
    'use strict';

    // -- Constantes --

    const TOKEN     = document.body.dataset.token || '';
    const API       = document.body.dataset.api || 'ctrl/ctrl-portal.php';
    const TYPES     = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const SHRINK_AT = 1200 * 1024;      // fotos de mas de ~1.2 MB se achican
    const MAX_SIDE  = 2000;             // lado largo de la foto achicada
    const QUALITY   = 0.85;
    const MAX_NOTE  = 255;
    const STALE_MS  = 60 * 1000;        // al volver a la pestaña, recarga si paso mas de esto

    const ICONS = {
        receipt:  '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
        bag:      '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
        card:     '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
        calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
        wallet:   '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
        bank:     '<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="m12 2 8 5H4z"/>',
        upload:   '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
        send:     '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
        image:    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
        file:     '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
        clock:    '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        check:    '<path d="M20 6 9 17l-5-5"/>',
        ok:       '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
        copy:     '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
        chat:     '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
        alert:    '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
        plus:     '<path d="M5 12h14"/><path d="M12 5v14"/>',
        x:        '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        link:     '<path d="M9 17H7A5 5 0 0 1 7 7"/><path d="M15 7h2a5 5 0 0 1 4 8"/><path d="M8 12h4"/><path d="m2 2 20 20"/>',
        refresh:  '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'
    };

    // -- Estado --

    const S = {
        portal:      null,
        items:       [],            // lo que ya debe: pedidos con anticipo y ventas a credito
        quotes:      [],            // pedidos sin anticipo que todavia se pueden apartar
        debt:        0,
        receipts:    [],
        pending:     0,
        canSend:     true,
        perCustomer: 3,
        maxBytes:    5 * 1024 * 1024,
        loadedAt:    0,
        sending:     false,
        preparing:   false,
        sent:        null,          // { folio, amount } del ultimo envio
        form:        { saleId: '', amount: '', typed: false, note: '' },
        file:        null           // { blob, name, size, type, url, shrunk }
    };

    const app = document.getElementById('app');
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    let toastEl, toastTimer;

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

    function plural(n, one, many) {
        return n + ' ' + (n === 1 ? one : many);
    }

    // «1,250.50», «$ 500» o «500.» -> numero con 2 decimales. Null si no es un monto.
    function parseAmount(raw) {
        const v = String(raw == null ? '' : raw).replace(/[$,\s]/g, '');

        if (!/^(\d{1,9}(\.\d{0,2})?|\.\d{1,2})$/.test(v)) return null;

        return round(Number(v));
    }

    function sizeText(bytes) {
        return bytes >= 1048576
            ? (bytes / 1048576).toFixed(1).replace(/\.0$/, '') + ' MB'
            : Math.max(1, Math.round(bytes / 1024)) + ' KB';
    }

    function waLink(text) {
        const phone = S.portal && /^\d{10}$/.test(S.portal.whatsapp || '') ? S.portal.whatsapp : '';

        return phone ? 'https://wa.me/52' + phone + '?text=' + encodeURIComponent(text) : '';
    }

    function isPhone() {
        return window.matchMedia('(max-width: 979.98px)').matches;
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
        toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2400);
    }

    // -- Servidor --

    async function post(opc, data) {
        const payload = new URLSearchParams(Object.assign({ opc: opc, t: TOKEN }, data || {}));
        const res     = await fetch(API, { method: 'POST', body: payload, cache: 'no-store', headers: { Accept: 'application/json' } });
        const json    = await res.json();

        if (!json || typeof json !== 'object') throw new Error('Respuesta vacía');

        return json;
    }

    // Con XMLHttpRequest y no fetch: fetch no dice cuanto lleva subido y con datos moviles 5 MB tardan.
    function upload(form, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.open('POST', API);
            xhr.responseType = 'json';
            xhr.timeout      = 120000;
            xhr.setRequestHeader('Accept', 'application/json');

            xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
            xhr.onload    = () => {
                let json = xhr.response;
                if (typeof json === 'string') { try { json = JSON.parse(json); } catch (e) { json = null; } }
                if (!json || typeof json !== 'object') return reject(new Error('Respuesta vacía'));
                resolve(json);
            };
            xhr.onerror   = () => reject(new Error('Sin conexión'));
            xhr.ontimeout = () => reject(new Error('Tardó demasiado'));

            xhr.send(form);
        });
    }

    // quiet: si falla, se queda lo que ya estaba pintado (recargas en segundo plano).
    async function load(quiet) {
        let res;

        try {
            res = await post('getPortal');
        } catch (e) {
            if (!quiet) paintFail();
            return false;
        }

        if (res.status === 404) {
            paintGone(res.message);
            return false;
        }

        if (res.status !== 200) {
            if (!quiet) paintFail(res.message);
            return false;
        }

        take(res);
        paint();

        return true;
    }

    function take(res) {
        S.portal      = res.portal || {};
        S.items       = res.items || [];
        S.quotes      = res.quotes || [];
        S.debt        = round(res.debt);
        S.receipts    = res.receipts || [];
        S.pending     = Number(res.pending) || 0;
        S.canSend     = !!res.can_send;
        S.perCustomer = Number(res.per_customer) || 3;
        S.maxBytes    = Number(res.max_bytes) || S.maxBytes;
        S.loadedAt    = Date.now();
    }

    // -- Para que es --

    // Las opciones de «¿Para qué es tu transferencia?». id 0 = repartirlo entre todo lo que debe.
    function choices() {
        const list = [];

        if (S.items.length > 1) {
            list.push({ id: 0, ic: 'wallet', title: 'Todo lo que debo', sub: money(S.debt) + ' · se abona del folio más viejo al más nuevo', left: S.debt, quote: false });
        }

        S.items.forEach(s => list.push({
            id: Number(s.id), ic: s.kind === 'credit' ? 'card' : 'bag',
            title: s.title + ' ' + s.folio, sub: 'Debes ' + money(s.left), left: round(s.left), quote: false
        }));

        S.quotes.forEach(s => list.push({
            id: Number(s.id), ic: 'calendar',
            title: 'Anticipo del pedido ' + s.folio, sub: 'Total ' + money(s.left) + ' · ' + s.when, left: round(s.left), quote: true
        }));

        return list;
    }

    // La opcion elegida; si ya no existe (se pago, vencio), la primera. Pone el monto si el cliente no escribio uno.
    function syncChoice() {
        const list = choices();
        const cur  = list.find(c => String(c.id) === S.form.saleId) || list[0] || null;

        S.form.saleId = cur ? String(cur.id) : '';

        if (cur && !S.form.typed) S.form.amount = cur.left > 0 ? cur.left.toFixed(2) : '';

        return cur;
    }

    function current() {
        return choices().find(c => String(c.id) === S.form.saleId) || null;
    }

    // Lo mas que acepta el servidor: lo que debe, mas la cotizacion elegida.
    function maxFor(c) {
        return round(S.debt + (c && c.quote ? c.left : 0));
    }

    function amountHint() {
        const c = current();
        if (!c) return '';

        const a   = parseAmount(S.form.amount);
        const max = maxFor(c);

        if (a !== null && a > max + 0.005)    return 'Lo más que puedes mandar es ' + money(max) + '.';
        if (c.id === 0)                       return 'Debes ' + money(S.debt) + ' en total. Escribe lo que transferiste, aunque sea menos.';
        if (a !== null && a > c.left + 0.005) return 'Lo que pase de ' + money(c.left) + ' se abona a tus otros folios.';
        if (c.quote)                          return 'Tu pedido se aparta cuando la tienda abone tu anticipo.';

        return 'Debes ' + money(c.left) + ' en este folio. Escribe lo que transferiste, aunque sea menos.';
    }

    function formOpen() {
        return S.canSend && !S.sent && choices().length > 0;
    }

    // -- Pintado --

    function paint() {
        syncChoice();

        const clear = !S.items.length && !S.quotes.length;

        app.innerHTML = '<div class="layout' + (clear ? ' is-clear' : '') + '">'
            + '<div class="col col-main">' + sumCard() + debtsBox() + quotesBox() + '</div>'
            + (clear ? '' : '<aside class="col col-side">' + bankBox() + sendBox() + '</aside>')
            + '<div class="col col-hist">' + historyBox() + helpBox() + '</div>'
            + '</div>';
    }

    function sumCard() {
        const pend    = S.receipts.filter(r => r.status === 'pending');
        const pendSum = round(pend.reduce((a, r) => a + Number(r.amount || 0), 0));
        const latest  = S.receipts[0] || null;
        const clear   = S.debt <= 0.005;
        let sub;

        if (!clear)              sub = 'En ' + plural(S.items.length, 'folio', 'folios');
        else if (S.quotes.length) sub = S.quotes.length === 1 ? 'Tienes 1 pedido esperando tu anticipo.' : 'Tienes ' + S.quotes.length + ' pedidos esperando tu anticipo.';
        else                     sub = 'Estás al día. ¡Gracias!';

        let note = '';

        if (pend.length) {
            note = '<div class="note warn">' + icon('clock', 17) + '<div>Tienes ' + money(pendSum) + ' en revisión ('
                + plural(pend.length, 'comprobante', 'comprobantes') + '). Se descuenta de tu saldo cuando la tienda lo abone.</div></div>';
        } else if (latest && latest.status === 'rejected') {
            note = '<div class="note bad">' + icon('alert', 17) + '<div>La tienda no pudo abonar tu comprobante ' + esc(latest.folio)
                + (latest.reason ? ': «' + esc(latest.reason) + '»' : '') + '. Revísalo y mándalo de nuevo.</div></div>';
        }

        const cta = formOpen() ? '<button type="button" class="btn only-m" data-act="to-form">' + icon('upload') + 'Mandar comprobante</button>' : '';

        return '<section class="box sum' + (clear && !S.quotes.length ? ' is-clear' : '') + '">'
            + '<div class="sum-top"><div>'
            +   '<small>Saldo pendiente</small>'
            +   '<strong class="sum-amt">' + money(S.debt) + '</strong>'
            +   '<span class="sum-sub">' + esc(sub) + '</span>'
            + '</div><span class="sum-ic">' + icon(clear && !S.quotes.length ? 'ok' : 'wallet', 24) + '</span></div>'
            + note + cta
            + '</section>';
    }

    function debtCard(s, quote) {
        const pct    = s.total > 0 ? Math.max(0, Math.min(100, Math.round(s.paid / s.total * 100))) : 0;
        const ic     = s.kind === 'credit' ? 'card' : (quote ? 'calendar' : 'bag');
        const picked = formOpen() && S.form.saleId === String(s.id);
        const pick   = S.canSend
            ? '<button type="button" class="link" data-act="pick" data-id="' + Number(s.id) + '">' + (quote ? 'Mandar anticipo' : 'Pagar este') + '</button>'
            : '';

        return '<article class="debt' + (picked ? ' is-picked' : '') + '" data-debt="' + Number(s.id) + '">'
            + '<div class="debt-ic">' + icon(ic, 19) + '</div>'
            + '<div class="debt-body">'
            +   '<div class="debt-top"><b>' + esc(s.title) + '<span class="fol">' + esc(s.folio) + '</span></b><strong>' + money(s.left) + '</strong></div>'
            +   '<div class="debt-when">' + esc(s.when) + '</div>'
            +   (quote ? '' : '<div class="meter" aria-hidden="true"><i style="width:' + pct + '%"></i></div>')
            +   '<div class="debt-foot"><span>' + (quote ? 'Sin pagos todavía' : 'Pagaste ' + money(s.paid) + ' de ' + money(s.total)) + '</span>' + pick + '</div>'
            + '</div></article>';
    }

    function debtsBox() {
        if (!S.items.length) return '';

        return '<section class="box"><h3><i>' + icon('receipt', 15) + '</i>Lo que debes<em>' + plural(S.items.length, 'folio', 'folios') + '</em></h3>'
            + '<div class="debts">' + S.items.map(s => debtCard(s, false)).join('') + '</div></section>';
    }

    function quotesBox() {
        if (!S.quotes.length) return '';

        return '<section class="box"><h3><i>' + icon('calendar', 15) + '</i>Pedidos por apartar<em>' + plural(S.quotes.length, 'pedido', 'pedidos') + '</em></h3>'
            + '<p class="hint">Todavía no tienen anticipo. Se apartan cuando la tienda abone tu pago.</p>'
            + '<div class="debts">' + S.quotes.map(s => debtCard(s, true)).join('') + '</div></section>';
    }

    function bankBox() {
        const bank = S.portal && S.portal.bank_info ? S.portal.bank_info : '';
        if (!bank) return '';

        return '<section class="box"><h3><i>' + icon('bank', 15) + '</i>Datos para transferir</h3>'
            + '<pre class="bank">' + esc(bank) + '</pre>'
            + '<p class="hint">En el concepto escribe tu nombre o tu folio.</p>'
            + '<div class="acts"><button type="button" class="btn ghost" data-act="copy-bank">' + icon('copy') + 'Copiar datos</button></div>'
            + '</section>';
    }

    function sendBox() {
        return '<section class="box" id="sendBox"><h3><i>' + icon('upload', 15) + '</i>Mandar comprobante</h3>'
            + '<div id="rcError"></div>'
            + '<div id="sendBody">' + sendBody() + '</div>'
            + '</section>';
    }

    function sendBody() {
        if (S.sent) return sentBlock();

        if (!S.canSend) {
            return '<div class="note warn" style="margin-top:0">' + icon('clock', 17) + '<div>Ya tienes ' + S.perCustomer
                + ' comprobantes en revisión. Cuando la tienda los revise podrás mandar otro.</div></div>';
        }

        return formHtml();
    }

    function formHtml() {
        const cur  = syncChoice();
        const f    = S.form;
        const opts = choices().map(c => {
            const on = cur && c.id === cur.id;

            return '<label class="opt' + (on ? ' is-on' : '') + '">'
                + '<input type="radio" name="rcFor" value="' + c.id + '"' + (on ? ' checked' : '') + '>'
                + '<span class="ic">' + icon(c.ic, 18) + '</span>'
                + '<span><b>' + esc(c.title) + '</b><small>' + esc(c.sub) + '</small></span>'
                + '</label>';
        }).join('');

        return '<form id="rcForm" novalidate>'
            + '<div data-f="for"><p class="sub">¿Para qué es tu transferencia?</p><div class="opts">' + opts + '</div></div>'
            + '<div class="field mt" data-f="amount"><label for="rcAmount">¿Cuánto transferiste?</label>'
            +   '<div class="money"><span>$</span><input id="rcAmount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0.00" value="' + esc(f.amount) + '"></div>'
            +   '<p class="hint" id="rcAmountHint">' + esc(amountHint()) + '</p></div>'
            + '<div class="field mt" data-f="file"><label for="rcFile">Foto o PDF de tu transferencia</label><div id="rcFileBox">' + fileHtml() + '</div></div>'
            + '<div class="field mt" data-f="note"><label for="rcNote">Nota para la tienda <small>(opcional)</small></label>'
            +   '<textarea id="rcNote" name="note" maxlength="' + MAX_NOTE + '" rows="2" placeholder="Ej. Transferí desde la cuenta de mi hermana.">' + esc(f.note) + '</textarea></div>'
            + '<div class="trap" aria-hidden="true"><label>No llenar <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>'
            + '<button type="submit" class="btn mt js-send">' + icon('send') + 'Mandar comprobante</button>'
            + '<p class="fine">La tienda lo revisa y lo abona a tu cuenta. Aquí verás si se abonó o por qué no.</p>'
            + '</form>';
    }

    function fileHtml() {
        const f = S.file;

        if (S.preparing) {
            return '<div class="drop">' + icon('image', 22) + '<b>Preparando tu foto…</b><small>Un momento</small></div>';
        }

        if (!f) {
            return '<div class="drop" id="rcDrop">' + icon('upload', 22)
                + '<b>Toca para elegir la foto o el PDF</b>'
                + '<small>JPG, PNG, WEBP o PDF · hasta ' + sizeText(S.maxBytes) + '</small>'
                + '<input type="file" id="rcFile" accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf">'
                + '</div>';
        }

        return '<div class="picked">'
            + '<div class="thumb">' + (f.url ? '<img src="' + esc(f.url) + '" alt="">' : icon('file', 24)) + '</div>'
            + '<div class="picked-body"><b>' + esc(f.name) + '</b>'
            +   '<small>' + (f.type === 'application/pdf' ? 'PDF' : 'Foto') + ' · ' + sizeText(f.size) + (f.shrunk ? ' · la achicamos para que suba rápido' : '') + '</small>'
            +   '<button type="button" class="link" data-act="change-file">Cambiar</button></div>'
            + '<button type="button" class="x" data-act="drop-file" aria-label="Quitar archivo">' + icon('x', 18) + '</button>'
            + '</div>';
    }

    function sentBlock() {
        const s    = S.sent;
        const name = S.portal && S.portal.customer ? S.portal.customer : '';
        const wa   = waLink('Hola' + (name ? ', soy ' + name : '') + '. Acabo de mandar mi comprobante ' + s.folio + ' por ' + money(s.amount) + ' desde mi portal.');

        return '<div class="sent" role="status">'
            + '<div class="ok">' + icon('check', 30) + '</div>'
            + '<b>¡Comprobante enviado!</b>'
            + '<p>Recibimos tu comprobante ' + esc(s.folio) + ' por ' + money(s.amount) + '. La tienda lo revisa y aquí verás cuando se abone.</p>'
            + (wa ? '<a class="btn wa" href="' + esc(wa) + '" target="_blank" rel="noopener">' + icon('chat') + 'Avisar por WhatsApp</a>' : '')
            + '</div>'
            + (S.canSend && choices().length
                ? '<button type="button" class="btn ghost" data-act="another">' + icon('plus') + 'Mandar otro comprobante</button>'
                : '<p class="hint" style="text-align:center">Podrás mandar otro cuando la tienda revise los que tienes en revisión.</p>');
    }

    function historyBox() {
        const head = '<h3><i>' + icon('clock', 15) + '</i>Tus comprobantes'
            + '<button type="button" class="link" data-act="reload">' + icon('refresh', 15) + 'Actualizar</button></h3>';

        if (!S.receipts.length) {
            return '<section class="box" id="history">' + head
                + '<p class="hint" style="margin:0">Aquí verás los comprobantes que mandes y si la tienda ya los abonó.</p></section>';
        }

        return '<section class="box" id="history">' + head + '<ul class="rcs">' + S.receipts.map(rcRow).join('') + '</ul></section>';
    }

    function rcRow(r) {
        const st = { pending: ['warn', 'En revisión'], applied: ['ok', 'Abonado'], rejected: ['bad', 'Rechazado'] }[r.status] || ['warn', 'En revisión'];
        const to = r.target ? 'Para ' + r.target : 'A lo que debes';

        return '<li class="rc">'
            + '<div class="rc-ic">' + icon(r.kind === 'pdf' ? 'file' : 'image', 18) + '</div>'
            + '<div class="rc-body">'
            +   '<div class="rc-top"><b>' + money(r.amount) + '</b><span class="pill ' + st[0] + '">' + st[1] + '</span></div>'
            +   '<div class="rc-sub">' + esc(r.folio) + ' · ' + esc(to) + ' · ' + esc(r.sent) + '</div>'
            +   (r.status === 'applied'
                    ? '<div class="rc-sub ok">Se abonaron ' + money(r.applied != null ? r.applied : r.amount) + (r.reviewed ? ' el ' + esc(r.reviewed) : '') + '</div>'
                    : '')
            +   (r.status === 'rejected'
                    ? '<div class="rc-why">' + (r.reason ? 'Motivo: ' + esc(r.reason) : 'La tienda no lo pudo abonar.') + '</div>'
                    : '')
            +   (r.note ? '<div class="rc-note">Tu nota: ' + esc(r.note) + '</div>' : '')
            + '</div></li>';
    }

    function helpBox() {
        const name = S.portal && S.portal.customer ? S.portal.customer : '';
        const wa   = waLink('Hola' + (name ? ', soy ' + name : '') + '. Tengo una duda sobre mi cuenta.');

        if (!wa) return '';

        return '<section class="box"><h3><i>' + icon('chat', 15) + '</i>¿Algo no cuadra?</h3>'
            + '<p class="hint">Escríbenos y lo revisamos contigo.</p>'
            + '<div class="acts"><a class="btn wa" href="' + esc(wa) + '" target="_blank" rel="noopener">' + icon('chat') + 'Escribir por WhatsApp</a></div>'
            + '</section>';
    }

    // -- Estados sin datos --

    function paintState(ic, title, text, extra) {
        app.innerHTML = '<div class="layout is-clear"><div class="col col-main">'
            + '<div class="box empty">' + icon(ic, 34) + '<b>' + esc(title) + '</b>' + esc(text)
            + (extra ? '<div class="acts" style="margin-top:18px">' + extra + '</div>' : '')
            + '</div></div></div>';
    }

    function paintGone(msg) {
        S.portal = null;
        paintState('link', 'Este enlace ya no funciona', msg || 'Pídele a la tienda tu enlace nuevo.', '');
    }

    function paintFail(msg) {
        paintState('refresh', 'No pudimos cargar tu cuenta', msg || 'Revisa tu conexión a internet e intenta de nuevo.',
            '<button type="button" class="btn" data-act="retry">' + icon('refresh') + 'Reintentar</button>');
    }

    // -- Repintados parciales --

    function repaintSend() {
        const body = $('#sendBody');
        if (body) body.innerHTML = sendBody();

        repaintPicked();
    }

    function repaintFile() {
        const box = $('#rcFileBox');
        if (box) box.innerHTML = fileHtml();
    }

    // El borde del folio elegido en «Lo que debes» y el boton del saldo siguen al formulario.
    function repaintPicked() {
        const open = formOpen();

        $$('.debt[data-debt]').forEach(el => el.classList.toggle('is-picked', open && el.dataset.debt === S.form.saleId));

        const cta = $('.sum [data-act="to-form"]');
        if (cta) cta.hidden = !open;
    }

    function updateAmount() {
        const hint = $('#rcAmountHint');
        if (hint) hint.textContent = amountHint();
    }

    // -- Formulario --

    function choose(value) {
        S.form.saleId = String(value);

        const cur = syncChoice();

        $$('#rcForm .opt').forEach(el => {
            const input = $('input', el);
            el.classList.toggle('is-on', !!input && input.value === S.form.saleId);
            if (input) input.checked = input.value === S.form.saleId;
        });

        const amount = $('#rcAmount');
        if (amount && cur && !S.form.typed) amount.value = S.form.amount;

        clearError('for');
        clearError('amount');
        updateAmount();
        repaintPicked();
    }

    function pick(id) {
        if (!S.canSend) return;

        S.form.typed = false;

        if (S.sent || !$('#rcForm')) {
            S.sent        = null;
            S.form.saleId = String(id);
            repaintSend();
        } else {
            choose(id);
        }

        toForm();
    }

    function toForm() {
        const box = $('#sendBox');
        if (!box) return;

        if (isPhone()) {
            box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            const amount = $('#rcAmount');
            if (amount) amount.focus({ preventScroll: false });
        }
    }

    function validate() {
        const errs = {};
        const c    = current();
        const a    = parseAmount(S.form.amount);

        if (!c)                               errs.for    = 'Elige para qué es tu transferencia.';
        if (a === null || a <= 0)             errs.amount = 'Escribe cuánto transferiste.';
        else if (c && a > maxFor(c) + 0.005)  errs.amount = 'El monto pasa de lo que debes (' + money(maxFor(c)) + ').';
        if (!S.file)                          errs.file   = 'Adjunta la foto o el PDF de tu transferencia.';
        if (S.form.note.trim().length > MAX_NOTE) errs.note = 'La nota admite hasta ' + MAX_NOTE + ' caracteres.';

        return errs;
    }

    function showErrors(errs) {
        $$('#rcForm [data-f]').forEach(box => {
            const key = box.dataset.f;
            const old = $('.err', box);

            if (old) old.remove();
            box.classList.toggle('is-bad', !!errs[key]);

            if (errs[key]) box.insertAdjacentHTML('beforeend', '<p class="err" role="alert">' + esc(errs[key]) + '</p>');
        });

        const first = $('#rcForm [data-f].is-bad');
        if (!first) return;

        first.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const input = $('#rcAmount', first) || $('#rcNote', first);
        if (input) input.focus({ preventScroll: true });
    }

    function fieldError(key, msg) {
        const box = $('#rcForm [data-f="' + key + '"]');
        if (!box) return toast(msg);

        clearError(key);
        box.classList.add('is-bad');
        box.insertAdjacentHTML('beforeend', '<p class="err" role="alert">' + esc(msg) + '</p>');
    }

    function clearError(key) {
        const box = $('#rcForm [data-f="' + key + '"]');
        if (!box) return;

        box.classList.remove('is-bad');

        const old = $('.err', box);
        if (old) old.remove();
    }

    function banner(msg, withWa) {
        const box = $('#rcError');
        if (!box) return msg ? toast(msg) : null;

        if (!msg) {
            box.innerHTML = '';
            return;
        }

        const name = S.portal && S.portal.customer ? S.portal.customer : '';
        const wa   = withWa ? waLink('Hola' + (name ? ', soy ' + name : '') + '. Quiero mandar mi comprobante de transferencia.') : '';

        box.innerHTML = '<div class="banner" role="alert">' + icon('alert') + '<div>' + esc(msg)
            + (wa ? ' <a href="' + esc(wa) + '" target="_blank" rel="noopener">Mandarlo por WhatsApp</a>' : '')
            + '</div></div>';

        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function setSending(on, progress) {
        S.sending = on;

        const btn = $('.js-send');
        if (!btn) return;

        btn.disabled  = on;
        btn.innerHTML = on
            ? icon('upload') + (progress > 0 && progress < 1 ? 'Subiendo… ' + Math.round(progress * 100) + '%' : 'Enviando…')
            : icon('send') + 'Mandar comprobante';
    }

    // -- Archivo --

    function clearFile() {
        if (S.file && S.file.url) URL.revokeObjectURL(S.file.url);
        S.file = null;
    }

    function baseName(name) {
        return String(name || '').replace(/\.[^.]*$/, '').trim() || 'comprobante';
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();

            img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir la foto')); };
            img.src     = url;
        });
    }

    // La foto achicada en JPG. Si el navegador no puede abrirla o no gana nada, va la original y el servidor decide.
    async function shrink(file, ready) {
        let img;

        try {
            img = await loadImage(file);
        } catch (e) {
            return ready;
        }

        const w = img.naturalWidth, h = img.naturalHeight, long = Math.max(w, h);

        if (!w || !h || (file.size <= SHRINK_AT && long <= MAX_SIDE)) return ready;

        const scale  = Math.min(1, MAX_SIDE / long);
        const canvas = document.createElement('canvas');

        canvas.width  = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));

        const ctx = canvas.getContext('2d');
        if (!ctx) return ready;

        // Una captura PNG con transparencia saldria negra en JPG: fondo blanco primero.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise(resolve => {
            try { canvas.toBlob(resolve, 'image/jpeg', QUALITY); } catch (e) { resolve(null); }
        });

        if (!blob || blob.size >= file.size) return ready;

        return { blob: blob, name: baseName(file.name) + '.jpg', size: blob.size, type: 'image/jpeg', shrunk: true };
    }

    async function pickFile(file) {
        if (!file || S.preparing) return;

        const type  = String(file.type || '').toLowerCase();
        const known = TYPES.indexOf(type) >= 0 || (type === '' && /\.(jpe?g|png|webp|pdf)$/i.test(file.name || ''));

        if (!known) return fieldError('file', 'Sube una foto (JPG, PNG o WEBP) o un PDF.');

        const isPdf = type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
        let ready   = { blob: file, name: file.name || 'comprobante', size: file.size, type: isPdf ? 'application/pdf' : type, shrunk: false };

        if (!isPdf) {
            S.preparing = true;
            repaintFile();
            ready = await shrink(file, ready);
            S.preparing = false;
        }

        if (ready.size > S.maxBytes) {
            repaintFile();
            return fieldError('file', 'El archivo pesa ' + sizeText(ready.size) + '. Sube uno de hasta ' + sizeText(S.maxBytes) + '.');
        }

        clearFile();
        ready.url = isPdf ? '' : URL.createObjectURL(ready.blob);
        S.file    = ready;

        repaintFile();
        clearError('file');
    }

    async function send() {
        if (S.sending || S.preparing) return;

        const errs = validate();

        showErrors(errs);
        if (Object.keys(errs).length) return;

        banner('');

        const c      = current();
        const amount = parseAmount(S.form.amount);
        const trap   = $('#rcForm [name="website"]');
        const form   = new FormData();

        form.append('opc', 'addReceipt');
        form.append('t', TOKEN);
        form.append('sale_id', String(c.id));
        form.append('amount', amount.toFixed(2));
        form.append('note', S.form.note.trim().replace(/\s+/g, ' '));
        form.append('website', trap ? trap.value : '');
        form.append('file', S.file.blob, S.file.name);

        setSending(true, 0);

        let res;

        try {
            res = await upload(form, p => setSending(true, p));
        } catch (e) {
            setSending(false);
            return banner('No pudimos subir tu comprobante. Revisa tu conexión e intenta de nuevo.');
        }

        setSending(false);

        if (res.status === 200) {
            clearFile();
            S.form = { saleId: '', amount: '', typed: false, note: '' };
            S.sent = { folio: res.receipt || '', amount: amount };

            take(res);
            paint();

            if (isPhone()) {
                const box = $('#sendBox');
                if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }

        if (res.status === 404) return paintGone(res.message);

        // 409: lo que debe cambio (se pago un folio, vencio una cotizacion). Se recarga al dia sin perder lo llenado.
        if (res.status === 409) {
            await load(true);
            return banner(res.message);
        }

        banner(res.message || 'No pudimos subir tu comprobante. Intenta de nuevo.', res.status === 429);
    }

    // -- Eventos --

    document.addEventListener('click', async e => {
        const el = e.target.closest('[data-act]');
        if (!el) return;

        const act = el.dataset.act;

        if (act === 'retry') return load();
        if (act === 'to-form') return toForm();
        if (act === 'pick') return pick(Number(el.dataset.id || 0));

        if (act === 'copy-bank') {
            const ok = await copyText(S.portal && S.portal.bank_info ? S.portal.bank_info : '');
            return toast(ok ? 'Datos copiados' : 'No se pudo copiar. Mantén presionado el texto para copiarlo.');
        }

        if (act === 'reload') {
            el.disabled = true;
            const ok = await load(true);
            if (!ok && el.isConnected) el.disabled = false;
            return toast(ok ? 'Listo, tu cuenta está actualizada' : 'No pudimos actualizar. Intenta de nuevo.');
        }

        if (act === 'change-file') {
            clearFile();
            repaintFile();
            const input = $('#rcFile');
            if (input) input.click();
            return;
        }

        if (act === 'drop-file') {
            clearFile();
            repaintFile();
            return;
        }

        if (act === 'another') {
            S.sent = null;
            repaintSend();
            toForm();
        }
    });

    document.addEventListener('change', e => {
        const t = e.target;

        if (t.name === 'rcFor') return choose(t.value);

        if (t.id === 'rcFile') {
            const file = t.files && t.files[0];
            t.value = '';
            pickFile(file);
        }
    });

    document.addEventListener('input', e => {
        const t = e.target;

        if (t.id === 'rcAmount') {
            S.form.amount = t.value;
            S.form.typed  = t.value.trim() !== '';
            clearError('amount');
            updateAmount();
        }

        if (t.id === 'rcNote') {
            S.form.note = t.value;
            clearError('note');
        }
    });

    // Al entrar al monto se selecciona: lo normal es escribir uno nuevo encima.
    document.addEventListener('focusin', e => {
        if (e.target.id === 'rcAmount') setTimeout(() => { try { e.target.select(); } catch (_) { /* nada */ } }, 0);
    });

    document.addEventListener('focusout', e => {
        if (e.target.id !== 'rcAmount') return;

        const v = parseAmount(e.target.value);
        if (v === null) return;

        e.target.value = S.form.amount = v.toFixed(2);
        updateAmount();
    });

    document.addEventListener('submit', e => {
        if (e.target.id !== 'rcForm') return;

        e.preventDefault();
        send();
    });

    // Arrastrar: el input invisible cubre la zona y recibe el archivo solo; aqui solo se pinta el borde.
    // Fuera de la zona se frena, para que el navegador no abra el archivo y saque al cliente del portal.
    ['dragenter', 'dragover'].forEach(type => window.addEventListener(type, e => {
        const zone = e.target.closest ? e.target.closest('.drop') : null;

        $$('.drop.is-over').forEach(d => { if (d !== zone) d.classList.remove('is-over'); });

        if (zone) zone.classList.add('is-over');
        else e.preventDefault();
    }));

    window.addEventListener('dragleave', e => {
        const zone = e.target.closest ? e.target.closest('.drop') : null;
        if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('is-over');
    });

    window.addEventListener('drop', e => {
        const zone = e.target.closest ? e.target.closest('.drop') : null;

        $$('.drop.is-over').forEach(d => d.classList.remove('is-over'));

        if (!zone) e.preventDefault();
    });

    // De vuelta en la pestaña (fue a su banco a transferir): se trae lo ultimo sin perder lo llenado.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden || S.sending || S.preparing || !S.portal) return;
        if (Date.now() - S.loadedAt < STALE_MS) return;

        const active = document.activeElement;
        if (active && active.closest && active.closest('#rcForm')) return;

        load(true);
    });

    // -- Arranque --

    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);

    load();
})();
