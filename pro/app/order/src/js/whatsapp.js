/*  Ventas › WhatsApp: las conversaciones con los clientes y los avisos que
    salen solos por WhatsApp.

    Ocho pestañas:
      - «Conversaciones» y «Agente»: la bandeja del agente y su horario. Viven
        en whatsapp-bandeja.js (wap.inbox); su envío es el de Meta
        (core/helpers/_WhatsAppMeta.php), no el de los avisos.
      - «Recordatorios» (whatsapp-recordatorios.js, wap.reminders) y
        «Métricas» (whatsapp-metricas.js, wap.metrics, F6).
      - «Avisos»: pedido nuevo, cierre de turno y cierre del día. Cada uno con
        su texto (editable, con variables) y cómo le llega a WhatsApp. El del
        pedido lleva sus fotos: su editor tiene «Solo texto | Con foto».
      - «Destinatarios»: a quién le llegan. Sin sucursal = de todas. «Le
        pregunta al agente» (F6) deja a ese número preguntarle al agente del
        dueño ventas, turno, pedidos y cartera.
      - «Historial»: cada envío (salió, simulado o falló) con su texto.
      - «Conexión»: qué proveedor está puesto en el .env y qué le falta, nunca
        un valor. Desde ahí se comprueba la instancia y se manda la prueba.

    El envío es el de alpha (core/helpers/_WhatsApp.php). En modo simulado nada
    sale a la red: el historial lo marca «Simulado».
    Los estilos wsp-* se inyectan desde aquí (wspCSS) para no tocar order.css.
    Los botones de las filas los arma el ctrl y llaman a wap.editRecipient(),
    wap.toggleRecipient(), wap.deleteRecipient() y wap.viewLog().
    La instancia se llama «wap»: «wsp» ya es una función de complementos.js. */

let api = 'ctrl/ctrl-whatsapp.php';
let wap;
let dataInit = {};

const WSP_MAX = 2000;

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    wap = new WhatsAppNotices(api, 'root');
    wap.init();
});

// -- Formato de WhatsApp --

/*  El texto como lo pinta WhatsApp: *negrita*, _cursiva_, ~tachado~ y «> » al
    inicio del renglón = cita. Primero se escapa; las marcas se ponen sobre el
    texto ya escapado, así nada de la base llega como HTML. */
function wspFormat(text) {
    return String(text || '').split('\n').map((line) => {
        let html    = esc(line);
        const quote = html.indexOf('&gt; ') === 0;

        if (quote) html = html.slice(5);

        html = html
            .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
            .replace(/(^|[\s(])_([^_]+)_(?=$|[\s).,:;!?])/g, '$1<em>$2</em>')
            .replace(/~([^~]+)~/g, '<s>$1</s>');

        return quote ? `<span class="wsp-quote">${html}</span>` : html;
    }).join('<br>');
}

/*  Una burbuja. Sin hora, la de ahora.
      dir   'in' = del cliente (blanca, a la izquierda); sin dir u 'out' = la verde.
      tail  false = sin colita (el segundo mensaje seguido del mismo lado).
      who   quién la mandó (arriba, en chico); head y meta = HTML ya escapado:
            head va antes del texto (foto, audio…) y meta junto a la hora (palomitas). */
function wspMsg(text, hour, opt = {}) {
    const time  = hour || new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true });
    const empty = opt.dir ? 'Sin texto.' : 'Sin texto: no saldría nada.';
    const body  = String(text || '').trim() ? wspFormat(text) : (opt.head ? '' : `<em class="wsp-bubble-empty">${empty}</em>`);
    const cls   = 'wsp-bubble' + (opt.dir === 'in' ? ' is-in' : '') + (opt.tail === false ? ' no-tail' : '');
    const who   = opt.who ? `<span class="wsp-who">${esc(opt.who)}</span>` : '';

    return `<div class="${cls}">${who}${opt.head || ''}${body}<span class="wsp-time">${esc(time)}${opt.meta || ''}</span></div>`;
}

// La burbuja verde de un aviso, dentro de su fondo de chat. photo = con la foto de ejemplo arriba.
function wspBubble(text, hour, photo) {
    return `<div class="wsp-chat">${wspMsg(text, hour, photo ? { head: wspPhoto() } : {})}</div>`;
}

/*  La foto de ejemplo del aviso del pedido (un pastel dibujado), la misma
    idea que la vista previa «Con foto» de alpha › Admin › WhatsApp: el aviso
    real lleva la foto del pedido arriba y el texto como su pie. */
function wspPhoto() {
    return '<div class="wsp-photo"><svg viewBox="0 0 300 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Foto de ejemplo del pedido">'
        + '<rect width="300" height="190" fill="#F6D5C4"/>'
        + '<ellipse cx="150" cy="158" rx="105" ry="14" fill="#E9B79D"/>'
        + '<rect x="85" y="95" width="130" height="58" rx="6" fill="#F4A6B8"/>'
        + '<rect x="85" y="95" width="130" height="14" rx="6" fill="#FFFFFF"/>'
        + '<path d="M85 109 q10 14 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t10 0" fill="#FFFFFF"/>'
        + '<rect x="105" y="62" width="90" height="36" rx="6" fill="#F9C5D1"/>'
        + '<rect x="105" y="62" width="90" height="10" rx="5" fill="#FFFFFF"/>'
        + '<rect x="146" y="38" width="8" height="24" rx="2" fill="#C05A40"/>'
        + '<path d="M150 24 q-7 9 0 14 q7 -5 0 -14z" fill="#F59E0B"/>'
        + '<circle cx="108" cy="130" r="5" fill="#EF4444"/><circle cx="150" cy="134" r="5" fill="#EF4444"/><circle cx="192" cy="130" r="5" fill="#EF4444"/>'
        + '</svg></div>';
}

// -- Fondo de chat --

/*  El tapiz de dibujitos de línea que va detrás de las burbujas, como el de
    WhatsApp. Es un SVG propio de 300×300 que se repite; color y opacidad
    cambian entre claro y oscuro. */
const WSP_DOODLES = {
    taza:     '<path d="M-9 -3h14v7a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6z M5 -1h2a3 3 0 0 1 0 6h-2 M-5 -11c-2 2 2 3 0 5 M0 -11c-2 2 2 3 0 5"/>',
    corazon:  '<path d="M0 8C-10 1 -10 -8 -4 -8C-1 -8 0 -5 0 -4C0 -5 1 -8 4 -8C10 -8 10 1 0 8Z"/>',
    estrella: '<path d="M0 -10L2.47 -3.4L9.51 -3.09L3.99 1.3L5.88 8.09L0 4.2L-5.88 8.09L-3.99 1.3L-9.51 -3.09L-2.47 -3.4Z"/>',
    globo:    '<path d="M-10 -7h20a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-12l-5 4v-4h-3a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2z"/><circle cx="-5" cy="-.5" r="1"/><circle cx="0" cy="-.5" r="1"/><circle cx="5" cy="-.5" r="1"/>',
    panque:   '<path d="M-7 1h14l-2 9h-10z M-2 1l.5 9 M2 1l-.5 9 M-8 1a4 4 0 0 1 2 -7a6 6 0 0 1 12 0a4 4 0 0 1 2 7"/><circle cx="0" cy="-14" r="1.5"/>',
    regalo:   '<path d="M-9 -3h18v4h-18z M-8 1h16v9h-16z M0 -3v13 M0 -3c-2 -5 -7 -5 -6 -1c1 2 6 1 6 1 M0 -3c2 -5 7 -5 6 -1c-1 2 -6 1 -6 1"/>',
    nota:     '<path d="M-3 6V-9L7 -11V4"/><circle cx="-6" cy="6" r="3"/><circle cx="4" cy="4" r="3"/>',
    telefono: '<rect x="-6" y="-11" width="12" height="22" rx="2.5"/><path d="M-2 7h4"/>',
    carita:   '<circle r="10"/><circle cx="-3.5" cy="-3" r="1"/><circle cx="3.5" cy="-3" r="1"/><path d="M-5 3a6 6 0 0 0 10 0"/>',
    destello: '<path d="M0 -10C1 -3 3 -1 10 0C3 1 1 3 0 10C-1 3 -3 1 -10 0C-3 -1 -1 -3 0 -10Z"/>',
    dona:     '<circle r="9"/><circle r="3.5"/>',
    helado:   '<path d="M-6 -2a6 6 0 0 1 12 0z M-6 -2l6 13l6 -13"/>',
    sobre:    '<rect x="-10" y="-7" width="20" height="14" rx="2"/><path d="M-10 -6l10 7l10 -7"/>',
    punto:    '<circle r="1.8"/>'
};

// [dibujo, x, y, giro]: lejos de la orilla para que el mosaico no se corte.
const WSP_DOODLE_MAP = [
    ['taza', 40, 40, -12], ['corazon', 118, 30, 10], ['estrella', 196, 46, 14], ['globo', 262, 34, -8],
    ['panque', 80, 112, 8], ['regalo', 162, 112, -10], ['nota', 244, 104, 12],
    ['telefono', 28, 176, -15], ['carita', 108, 178, 0], ['destello', 192, 172, 0], ['dona', 268, 182, 0],
    ['helado', 52, 252, 12], ['sobre', 136, 250, -8], ['taza', 220, 246, 10], ['corazon', 280, 268, -12],
    ['punto', 156, 64, 0], ['punto', 18, 104, 0], ['punto', 210, 140, 0], ['punto', 232, 208, 0], ['punto', 92, 220, 0], ['punto', 178, 288, 0]
];

function wspWallpaper(color, opacity) {
    const shapes = WSP_DOODLE_MAP.map(([name, x, y, turn]) => `<g transform="translate(${x} ${y}) rotate(${turn})">${WSP_DOODLES[name]}</g>`).join('');
    const svg    = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">'
        + `<g fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${shapes}</g>`
        + '</svg>';

    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// -- CSS --

function wspCSS() {
    if (document.getElementById('wsp-css')) return;

    const line  = 'rgb(var(--gray-200, 231 229 228))';
    const soft  = 'rgb(var(--gray-50, 250 250 249))';
    const ink   = 'rgb(var(--gray-900, 28 25 23))';
    const mute  = 'rgb(var(--gray-500, 120 113 108))';
    const body  = 'rgb(var(--gray-600, 87 83 78))';
    const brand = 'rgb(var(--brand-600, 80 48 165))';
    const aBg   = 'var(--accent-soft-bg, rgb(80 48 165 / .09))';
    const aFg   = 'var(--accent-soft-fg, rgb(80 48 165))';
    const aLine = 'var(--accent-line, rgb(80 48 165 / .32))';
    const tint  = 'var(--tint, rgb(80 48 165 / .06))';

    const css = `
        .wsp-pill { background: ${aBg}; color: ${aFg}; }

        .wsp-conn-pill { display: inline-flex; align-items: center; gap: 6px; width: max-content; padding: 5px 12px; border-radius: 999px;
            font-size: 12.5px; font-weight: 600; white-space: nowrap; }
        .wsp-conn-pill svg { width: 15px; height: 15px; flex-shrink: 0; }
        .wsp-conn-pill.is-ok  { background: var(--ok-soft-bg, #E6F7ED); color: var(--ok-soft-fg, #15803D); }
        .wsp-conn-pill.is-sim { background: rgb(var(--gray-100, 245 245 244)); color: ${body}; }
        .wsp-conn-pill.is-bad { background: #FFF1F2; color: #BE123C; }
        .wsp-conn-pill.is-icon { justify-content: center; width: 34px; height: 34px; padding: 0; cursor: help; }
        .wsp-conn-pill.is-icon svg { width: 17px; height: 17px; }

        .wsp-banner { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border: 1px solid ${aLine}; border-radius: 14px; background: ${tint}; }
        .wsp-banner > svg { width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; color: ${brand}; }
        .wsp-banner p { margin: 0; }
        .wsp-banner-title { font-size: 14px; font-weight: 700; color: ${ink}; }
        .wsp-banner-text { margin-top: 2px !important; font-size: 13px; line-height: 1.45; color: ${body}; }
        .wsp-banner.is-bad { border-color: #FECDD3; background: #FFF1F2; }
        .wsp-banner.is-bad > svg { color: #E11D48; }

        .wsp-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
        @media (min-width: 760px)  { .wsp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 1180px) { .wsp-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

        .wsp-card { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 16px; border: 1px solid ${line}; border-radius: 14px; background: #FFFFFF; }
        .wsp-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .wsp-card-title { margin: 0; font-size: 15px !important; font-weight: 700; color: ${ink}; }
        .wsp-card-when { margin: 3px 0 0; font-size: 12.5px; line-height: 1.4; color: ${mute}; }
        .wsp-card.is-paused .wsp-chat { opacity: .55; }
        .wsp-card-foot { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; }

        .wsp-state { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
        .wsp-state.is-on  { background: var(--ok-soft-bg, #E6F7ED); color: var(--ok-soft-fg, #15803D); }
        .wsp-state.is-off { background: rgb(var(--gray-100, 245 245 244)); color: ${body}; }
        .wsp-state-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }

        .wsp-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .wsp-tag { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border: 1px solid ${line}; border-radius: 999px;
            background: #FFFFFF; font-size: 12px; font-weight: 500; color: ${body}; }
        .wsp-tag svg { width: 14px; height: 14px; flex-shrink: 0; }
        .wsp-tag.is-accent { border-color: ${aLine}; background: ${aBg}; color: ${aFg}; }
        .wsp-tag.is-warn { border-color: #FECDD3; background: #FFF1F2; color: #BE123C; }

        /* Seis pestañas no caben a 390 px: se desplaza la barra, no la página. */
        #tabsWsp { max-width: 100%; }

        .wsp-chat { padding: 14px; border-radius: 12px; background-color: #EFEAE2; background-image: ${wspWallpaper('#8C7B62', .2)};
            background-size: 260px 260px; max-height: 380px; overflow-y: auto; }
        #wnPreview .wsp-chat { max-height: 440px; }
        .wsp-bubble { position: relative; width: fit-content; max-width: 100%; margin-left: auto; padding: 7px 10px 20px; border-radius: 10px 0 10px 10px;
            background: #D9FDD3; box-shadow: 0 1px .5px rgba(11, 20, 26, .13); font-size: 13.5px; line-height: 1.45; color: #111B21; overflow-wrap: anywhere; }
        .wsp-bubble::after { content: ''; position: absolute; top: 0; right: -8px; border-left: 8px solid #D9FDD3; border-bottom: 8px solid transparent; }
        .wsp-bubble strong { font-weight: 700; }
        .wsp-bubble-empty { color: #667781; }
        .wsp-time { position: absolute; right: 9px; bottom: 4px; font-size: 11px; color: #667781; white-space: nowrap; }
        .wsp-quote { display: inline-block; padding-left: 8px; border-left: 3px solid rgba(17, 27, 33, .25); color: #3B4A54; }
        .wsp-bubble.is-in { margin-left: 0; margin-right: auto; border-radius: 0 10px 10px 10px; background: #FFFFFF; }
        .wsp-bubble.is-in::after { right: auto; left: -8px; border-left: 0; border-right: 8px solid #FFFFFF; }
        .wsp-bubble.no-tail { border-radius: 10px; }
        .wsp-bubble.no-tail::after { display: none; }
        .wsp-who { display: block; margin-bottom: 2px; font-size: 12px; font-weight: 600; color: ${aFg}; }
        .wsp-photo { width: 260px; max-width: 100%; margin: -4px -7px 6px; border-radius: 8px; overflow: hidden; }
        .wsp-photo svg { display: block; width: 100%; height: auto; }
        .wsp-modes { display: flex; justify-content: center; margin-bottom: 8px; }
        .wsp-modes .ord-viewer-modes { width: 220px; }
        .wsp-modes button.ord-seg { height: 30px; font-size: 12.5px; }
        .wsp-media { display: flex; align-items: center; gap: 6px; font-size: 13px; font-style: italic; color: #54656F; }
        .wsp-media svg { width: 16px; height: 16px; flex-shrink: 0; }
        .wsp-time { display: inline-flex; align-items: center; gap: 3px; }
        .wsp-tick { display: inline-flex; color: #667781; }
        .wsp-tick svg { width: 15px; height: 15px; }
        .wsp-tick.is-read { color: ${brand}; }
        .wsp-tick.is-failed { color: #E11D48; }

        button.wsp-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid ${line}; border-radius: 8px;
            background: #FFFFFF; font-size: 13px; font-weight: 600; color: ${body}; transition: background-color .15s, color .15s, border-color .15s; }
        button.wsp-btn:hover { border-color: ${aLine}; background: ${tint}; color: ${aFg}; }
        button.wsp-btn svg { width: 15px; height: 15px; }

        .wsp-label { margin: 0 0 6px; font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: ${mute}; }
        .wsp-hint { margin: 0 0 8px; font-size: 12.5px; line-height: 1.4; color: ${mute}; }
        .wsp-section { margin: 6px 0 -4px; padding-top: 12px; border-top: 1px solid ${line}; font-size: 12px; font-weight: 700; letter-spacing: .04em;
            text-transform: uppercase; color: ${mute}; }
        .wsp-vars { display: flex; flex-wrap: wrap; gap: 6px; }
        button.wsp-var { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border: 1px dashed ${aLine}; border-radius: 999px;
            background: transparent; font-size: 12px; font-weight: 500; color: ${body}; }
        button.wsp-var:hover { border-style: solid; background: ${tint}; }
        .wsp-var-key { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; font-weight: 600; color: ${aFg}; }
        .wsp-count { margin: 4px 0 0; font-size: 12px; text-align: right; color: ${mute}; }

        .wsp-group-state { display: flex; align-items: flex-start; gap: 6px; margin: -4px 0 0; font-size: 12.5px; line-height: 1.4; color: ${mute}; }
        .wsp-group-state svg { width: 15px; height: 15px; flex-shrink: 0; margin-top: 1px; }
        .wsp-group-state.is-ok svg { color: #047857; }
        .wsp-group-state.is-warn { color: #B45309; }
        .wsp-group-state.is-info svg { color: ${aFg}; }

        .wsp-box-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
        @media (min-width: 640px) { .wsp-box-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        .wsp-box { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 10px 12px; border: 1px solid ${line}; border-radius: 12px; background: #FFFFFF; }
        .wsp-box p { margin: 0; }
        .wsp-box-label { font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: ${mute}; }
        .wsp-box-value { font-size: 14px; font-weight: 600; color: ${ink}; overflow-wrap: anywhere; }
        .wsp-box-sub { font-size: 12.5px; line-height: 1.4; color: ${mute}; overflow-wrap: anywhere; }

        .wsp-note { margin: 0; padding: 10px 12px; border-radius: 12px; background: ${soft}; font-size: 13px; line-height: 1.45; color: ${body}; }
        .wsp-note.is-bad { background: #FFF1F2; color: #9F1239; }
        .wsp-note.is-live { background: ${aBg}; color: ${aFg}; font-weight: 600; }
        .wsp-key { display: inline-block; margin: 2px 2px 2px 0; padding: 1px 6px; border: 1px solid ${line}; border-radius: 6px; background: ${soft};
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; color: ${ink}; }

        .wsp-conn { display: flex; flex-direction: column; gap: 14px; }
        .wsp-help { padding: 14px 16px; border: 1px solid ${line}; border-radius: 12px; font-size: 13px; line-height: 1.55; color: ${body}; }
        .wsp-help ol { margin: 0 0 8px; padding-left: 20px; list-style: decimal; }
        .wsp-help li { margin-bottom: 6px; }
        .wsp-help p { margin: 0; }
        .wsp-log { display: flex; flex-direction: column; gap: 14px; padding: 1.5rem; }
        .wsp-empty { display: flex; align-items: center; gap: 10px; padding: 18px; border: 1px dashed ${line}; border-radius: 12px; font-size: 13.5px; color: ${mute}; }
        .wsp-empty p { margin: 0; }

        #containerWhatsAppNotices .ord-dt-top { display: flex; align-items: center; min-height: 42px; margin-bottom: 10px; }
        #containerWhatsAppNotices .ord-dt-scroll { overflow-x: auto; }
        #containerWhatsAppNotices .ord-dt-foot { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
        #containerWhatsAppNotices .dataTables_paginate .pagination { margin: 0; }
        #containerWhatsAppNotices .dataTables_info { font-size: 12.5px; color: ${mute}; padding-top: 12px !important; }
        #containerWhatsAppNotices .dataTables_paginate { padding-top: 8px; }
        #tbWspRecipients thead th, #tbWspLog thead th { text-transform: none; white-space: nowrap; }
        #tbWspRecipients td, #tbWspLog td { vertical-align: middle; }

        body.dark-mode .wsp-card,
        body.dark-mode .wsp-box,
        body.dark-mode .wsp-tag,
        body.dark-mode button.wsp-btn { background: var(--dk-card, #1F2A37); border-color: var(--dk-line, #374151); }
        body.dark-mode .wsp-help,
        body.dark-mode .wsp-empty,
        body.dark-mode .wsp-section { border-color: var(--dk-line, #374151); }
        body.dark-mode .wsp-group-state { color: var(--dk-muted, #9CA3AF); }
        body.dark-mode .wsp-group-state.is-warn { color: #FCD34D; }
        body.dark-mode .wsp-card-title,
        body.dark-mode .wsp-box-value,
        body.dark-mode .wsp-banner-title { color: var(--dk-text, #F3F4F6); }
        body.dark-mode .wsp-tag,
        body.dark-mode .wsp-help,
        body.dark-mode .wsp-banner-text,
        body.dark-mode button.wsp-btn,
        body.dark-mode button.wsp-var { color: #D1D5DB; }
        body.dark-mode .wsp-note,
        body.dark-mode .wsp-key,
        body.dark-mode .wsp-state.is-off,
        body.dark-mode .wsp-conn-pill.is-sim { background: rgba(255, 255, 255, .06); border-color: var(--dk-line, #374151); color: #D1D5DB; }
        body.dark-mode .wsp-state.is-on,
        body.dark-mode .wsp-conn-pill.is-ok { background: rgba(16, 185, 129, .15); color: #6EE7B7; }
        body.dark-mode .wsp-conn-pill.is-bad,
        body.dark-mode .wsp-tag.is-warn,
        body.dark-mode .wsp-note.is-bad,
        body.dark-mode .wsp-banner.is-bad { background: rgba(244, 63, 94, .12); border-color: rgba(244, 63, 94, .4); color: #FDA4AF; }
        body.dark-mode .wsp-chat { background-color: #0B141A; background-image: ${wspWallpaper('#FFFFFF', .06)}; }
        body.dark-mode .wsp-bubble { background: #005C4B; color: #E9EDEF; }
        body.dark-mode .wsp-bubble::after { border-left-color: #005C4B; }
        body.dark-mode .wsp-bubble.is-in { background: #202C33; }
        body.dark-mode .wsp-bubble.is-in::after { border-right-color: #202C33; }
        body.dark-mode .wsp-who,
        body.dark-mode .wsp-tick.is-read { color: rgb(var(--brand-300, 196 181 253)); }
        body.dark-mode .wsp-time,
        body.dark-mode .wsp-tick,
        body.dark-mode .wsp-media,
        body.dark-mode .wsp-bubble-empty { color: rgba(233, 237, 239, .6); }
        body.dark-mode .wsp-quote { border-color: rgba(233, 237, 239, .35); color: #D1D7DB; }
        body.dark-mode #tbWspRecipients tbody tr.ct3-hoverable:hover td,
        body.dark-mode #tbWspLog tbody tr.ct3-hoverable:hover td { background-color: var(--dk-row-hover, #334155) !important; }
    `;

    $('<style id="wsp-css">').text(css).appendTo('head');
}

// -- WhatsAppNotices --

class WhatsAppNotices extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'WhatsAppNotices';
        this.tab          = 'chats';
        this.inbox        = new WhatsAppInbox(link, div_modulo, this);
        this.reminders    = new WhatsAppReminders(link, div_modulo, this);
        this.metrics      = new WhatsAppMetrics(link, div_modulo, this);
        this.requests     = { notices: 0, recipients: 0, log: 0, preview: 0, groups: 0 };
        this.groups       = [];
        this.pageLength   = { recipients: 15, log: 15, reminders: 15 };
        this.terms        = { recipients: '', log: '', reminders: '' };
        this.saving       = false;
        this.notices      = {};
        this.conn         = dataInit.conn || {};
        this.check        = null;
        this.testPhone    = '';
        this.previewTimer = null;
        this.previewPhoto = false;   // «Solo texto | Con foto» del editor del aviso (como alpha)

        // Filtro propio de DataTables: el buscador de cada pestaña.
        $.fn.dataTable.ext.search.push((settings, row) => {
            const table = settings.nTable.id;

            if (table === 'tbWspRecipients') return this.matches('recipients', `${row[0]} ${row[1]}`);
            if (table === 'tbWspLog') return this.matches('log', `${row[1]} ${row[2]}`);
            if (table === 'tbWspReminders') return this.matches('reminders', `${row[0]} ${row[1]}`);

            return true;
        });
    }

    // -- Interface --

    init() {
        this.render();
    }

    render() {
        wspCSS();
        this.layout();
        this.header();

        if (dataInit.status != 200) return this.blocked(dataInit.message || 'No se pudo cargar WhatsApp. Recarga la página.');

        if (!this.allow('show')) return this.blocked('Tu rol no tiene permiso para ver los avisos de WhatsApp.');

        this.headerStatus();
        this.summary();
        this.tabs();
        this.filterRecipients();
        this.filterLog();
        this.connection();
        this.inbox.init();
        this.reminders.init();
        this.metrics.init();
        this.inbox.showChats();
    }

    // Los conteos y el historial son de la sucursal: se vuelve a cargar todo.
    onBranchChange() {
        location.reload();
    }

    // createLayout reemplaza a su padre: encabezado, aviso y cuerpo van en contenedores aparte.
    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:    `page${this.PROJECT_NAME}`,
                class: 'flex flex-1 flex-col gap-[16px]',
                container: [
                    { type: 'div', id: `header${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `summary${this.PROJECT_NAME}`, class: 'w-full hidden' },
                    { type: 'div', id: `body${this.PROJECT_NAME}`, class: 'w-full flex flex-1 flex-col' }
                ]
            }
        });
    }

    header() {
        const scope = dataInit.scope || {};

        this.createLayout({
            parent: `header${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `title${this.PROJECT_NAME}`,
                class: 'w-full',
                container: [
                    {
                        type:  'div',
                        class: 'flex items-end justify-between gap-[12px] flex-wrap',
                        children: [
                            { type: 'div', id: `headerText${this.PROJECT_NAME}`, class: 'min-w-0' },
                            { type: 'div', id: `headerActions${this.PROJECT_NAME}`, class: 'shrink-0' }
                        ]
                    }
                ]
            }
        });

        this.createLayout({
            parent: `headerText${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `headerTextBody${this.PROJECT_NAME}`,
                class: 'w-full',
                container: [
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'WhatsApp' },
                    { type: 'p', class: 'cp-pagina-subtitulo', text: [scope.company, scope.branch].filter(Boolean).join(' · ') || 'Avisos automáticos' }
                ]
            }
        });
    }

    // A la derecha del título: qué proveedor está puesto y si le falta algo.
    // En simulado va solo el icono (el texto queda en el tooltip) hasta que se conecte.
    headerStatus() {
        const c    = this.conn || {};
        const name = this.providerName(c.provider);
        let pill   = ['is-bad', 'circle-alert', `${name}: faltan datos`];

        if (c.simulated) pill = ['is-sim is-icon', 'flask-conical', 'Modo simulado: los avisos no salen a WhatsApp'];
        else if (c.ready) pill = ['is-ok', 'circle-check', `${name} configurado`];

        const label = c.simulated ? '' : esc(pill[2]);
        const tip   = c.simulated ? ` role="img" title="${esc(pill[2])}" aria-label="${esc(pill[2])}"` : '';

        $(`#headerActions${this.PROJECT_NAME}`).html(`<span class="wsp-conn-pill ${pill[0]}"${tip}><i data-lucide="${pill[1]}"></i>${label}</span>`);

        this.icons();
    }

    // Franja arriba de las pestañas: solo si los avisos no salen de verdad.
    summary() {
        const c      = this.conn || {};
        const parent = $(`#summary${this.PROJECT_NAME}`).empty().toggleClass('hidden', Boolean(c.ready));

        if (c.ready) return;

        const bad   = !c.simulated;
        const title = bad
            ? `Faltan datos de ${this.providerName(c.provider)} en el .env`
            : 'Modo simulado: los avisos no salen a WhatsApp';
        const text  = bad
            ? `Falta: ${(c.missing || []).join(', ')}. Mientras falte, cada aviso queda como «Falló» en el historial.`
            : 'Se arman y quedan en el historial como «Simulado», pero no salen a la red. Para mandarlos de verdad, conecta un proveedor (pestaña «Conexión»).';

        parent.html(''
            + `<div class="wsp-banner${bad ? ' is-bad' : ''}" role="status">`
            +   `<i data-lucide="${bad ? 'circle-alert' : 'flask-conical'}"></i>`
            +   `<div><p class="wsp-banner-title">${esc(title)}</p><p class="wsp-banner-text">${esc(text)}</p></div>`
            + '</div>');

        this.icons();
    }

    // El id empieza con «tabs»: así lo cubre el modo oscuro de dark-mode.css.
    tabs() {
        this.createLayout({
            parent: `body${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `card${this.PROJECT_NAME}`,
                class: 'ord-card flex-1',
                container: [
                    { type: 'div', id: `container${this.PROJECT_NAME}`, class: 'w-full' }
                ]
            }
        });

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id:     'tabsWsp',
            theme:  'light',
            type:   'button',
            json: [
                { id: 'wsChats', tab: 'Conversaciones', lucideIcon: 'message-circle', active: true, onClick: () => this.showTab('chats') },
                { id: 'wsReminders', tab: 'Recordatorios', lucideIcon: 'bell-ring', onClick: () => this.showTab('reminders') },
                { id: 'wsMetrics', tab: 'Métricas', lucideIcon: 'chart-column', onClick: () => this.showTab('metrics') },
                { id: 'wsNotices', tab: 'Avisos', lucideIcon: 'bell', onClick: () => this.showTab('notices') },
                { id: 'wsRecipients', tab: 'Destinatarios', lucideIcon: 'users', onClick: () => this.showTab('recipients') },
                { id: 'wsLog', tab: 'Historial', lucideIcon: 'history', onClick: () => this.showTab('log') },
                { id: 'wsAgent', tab: 'Agente', lucideIcon: 'bot', onClick: () => this.showTab('agent') },
                { id: 'wsConn', tab: 'Conexión', lucideIcon: 'plug', onClick: () => this.showTab('conn') }
            ]
        });

        this.createLayout({
            parent: 'container-wsNotices',
            design: false,
            data: {
                id:    'listWspNotices',
                class: 'w-full',
                container: [
                    { type: 'div', id: 'wspNotices', class: 'wsp-grid' }
                ]
            }
        });

        // Los filtros van fuera de la tabla: createCoffeeTable3 la reescribe y el buscador perdería el foco.
        this.createLayout({
            parent: 'container-wsRecipients',
            design: false,
            data: {
                id:    'listWspRecipients',
                class: 'w-full',
                container: [
                    { type: 'div', id: 'filterWspRecipients', class: 'w-full mb-[14px]' },
                    { type: 'div', id: 'tableWspRecipients', class: 'w-full' }
                ]
            }
        });

        this.createLayout({
            parent: 'container-wsLog',
            design: false,
            data: {
                id:    'listWspLog',
                class: 'w-full',
                container: [
                    { type: 'div', id: 'filterWspLog', class: 'w-full mb-[14px]' },
                    { type: 'div', id: 'tableWspLog', class: 'w-full' }
                ]
            }
        });

        // Los botones de las tarjetas: una sola escucha para las tres.
        $('#wspNotices').on('click', 'button[data-act]', (e) => {
            const button = $(e.currentTarget);
            const type   = String(button.closest('.wsp-card').attr('data-type'));
            const act    = button.attr('data-act');

            if (act === 'edit') return this.formNotice(type);
            if (act === 'toggle') return this.toggleNotice(type);
            if (act === 'test') return this.formTest(type);
        });
    }

    filterRecipients() {
        const data = [
            {
                opc:         'input',
                id:          'q',
                lbl:         'Buscar',
                type:        'search',
                placeholder: 'Nombre, teléfono o sucursal',
                required:    false,
                class:       'col-12 col-md-6 col-xl-4'
            }
        ];

        if (this.allow('create')) {
            data.push({ opc: 'button', id: 'btnWspAddRecipient', class: 'col-12 col-sm-6 col-md-3 col-xl-3', text: 'Agregar destinatario', icon: 'icon-plus', color_btn: 'primary', onClick: () => this.formRecipient(null) });
            data.push({ opc: 'button', id: 'btnWspAddGroup', class: 'col-12 col-sm-6 col-md-3 col-xl-2', text: 'Agregar grupo', icon: 'icon-users', color_btn: 'outline', onClick: () => this.formGroup(null) });
        }

        this.createfilterBar({
            parent:     'filterWspRecipients',
            id:         'fbWspRecipients',
            prefijo:    'wsr_',
            coffeesoft: true,
            data:       data
        });

        $('#wsr_q')
            .attr({ maxlength: 60, autocomplete: 'off', 'aria-label': 'Buscar destinatario' })
            .on('input', (e) => this.onSearchInput('recipients', e));
    }

    filterLog() {
        const types = (dataInit.types || []).map((t) => ({ id: t.key, valor: t.name }));

        this.createfilterBar({
            parent:     'filterWspLog',
            id:         'fbWspLog',
            prefijo:    'wsl_',
            coffeesoft: true,
            data: [
                {
                    opc:      'select',
                    id:       'period',
                    lbl:      'Periodo',
                    required: false,
                    class:    'col-6 col-md-4 col-lg-3 col-xl-2',
                    data:     [{ id: '7', valor: 'Últimos 7 días' }, { id: 'today', valor: 'Hoy' }, { id: '30', valor: 'Últimos 30 días' }, { id: 'all', valor: 'Todo' }],
                    onchange: 'wap.lsLog()'
                },
                {
                    opc:      'select',
                    id:       'type',
                    lbl:      'Aviso',
                    required: false,
                    class:    'col-6 col-md-4 col-lg-3 col-xl-2',
                    data:     [{ id: '', valor: 'Todos' }].concat(types, [{ id: 'handoff', valor: 'Cliente pide una persona' }, { id: 'test', valor: 'Pruebas' }]),
                    onchange: 'wap.lsLog()'
                },
                {
                    opc:         'input',
                    id:          'q',
                    lbl:         'Buscar',
                    type:        'search',
                    placeholder: 'Folio, nombre o teléfono',
                    required:    false,
                    class:       'col-12 col-md-4 col-xl-3'
                }
            ]
        });

        $('#wsl_q')
            .attr({ maxlength: 60, autocomplete: 'off', 'aria-label': 'Buscar envío' })
            .on('input', (e) => this.onSearchInput('log', e));
    }

    // tabLayout no corre el onClick de la pestaña activa al crearla: las conversaciones se piden en render().
    showTab(tab) {
        this.tab = tab;

        if (tab === 'chats') return this.inbox.showChats();
        if (tab === 'agent') return this.inbox.showAgent();
        if (tab === 'reminders') return this.reminders.show();
        if (tab === 'metrics') return this.metrics.show();
        if (tab === 'notices') return this.loadNotices();
        if (tab === 'recipients') return this.lsRecipients();
        if (tab === 'log') return this.lsLog();

        this.paintConn();
    }

    blocked(message, text) {
        $(`#summary${this.PROJECT_NAME}`).empty().addClass('hidden');

        this.createLayout({
            parent: `body${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `blocked${this.PROJECT_NAME}`,
                class: 'ord-aviso',
                container: [
                    { type: 'i', class: 'icon-lock text-[22px]' },
                    {
                        type:  'div',
                        class: 'flex flex-col',
                        children: [
                            { type: 'p', class: 'ord-aviso-titulo', text: message },
                            { type: 'p', class: 'ord-aviso-texto', text: text || 'Si crees que es un error, pide acceso a quien administra Huubie.' }
                        ]
                    }
                ]
            }
        });
    }

    // -- Avisos --

    async loadNotices() {
        const request = ++this.requests.notices;
        const box     = $('#wspNotices').addClass('opacity-50');
        const data    = await useFetch({ url: this._link, data: { opc: 'getNotices' } });

        if (request !== this.requests.notices) return;

        box.removeClass('opacity-50');

        if (!data || data.status != 200) {
            box.html(`<div class="wsp-empty"><i class="icon-attention"></i><p>${esc((data && data.message) || 'No se pudieron cargar los avisos. Recarga la página.')}</p></div>`);
            return;
        }

        this.notices = {};
        (data.row || []).forEach((n) => { this.notices[n.type] = n; });

        box.html((data.row || []).map((n) => this.noticeCard(n)).join(''));

        this.icons();
    }

    // Todo lo que viene de la base pasa por esc(); la burbuja, por wspFormat().
    noticeCard(n) {
        const type   = this.typeOf(n.type);
        const on     = Number(n.active) === 1;
        const count  = Number(n.recipients) || 0;
        const people = count ? `${count} ${count === 1 ? 'destinatario' : 'destinatarios'}` : 'Nadie lo recibe en esta sucursal';
        const custom = n.custom
            ? `<span class="wsp-tag is-accent">Personalizado${n.updated_at ? ' · ' + esc(n.updated_at) : ''}</span>`
            : '<span class="wsp-tag">Mensaje original</span>';

        const foot = this.allow('create')
            ? '<footer class="wsp-card-foot">'
            +   this.cardBtn('edit', 'pencil', 'Editar', `Editar el aviso ${type.name}`)
            +   this.cardBtn('toggle', on ? 'pause' : 'play', on ? 'Pausar' : 'Encender', `${on ? 'Pausar' : 'Encender'} el aviso ${type.name}`)
            +   this.cardBtn('test', 'send', 'Probar', `Mandar una prueba del aviso ${type.name}`)
            + '</footer>'
            : '';

        return `<article class="wsp-card${on ? '' : ' is-paused'}" data-type="${esc(n.type)}">`
             +   '<header class="wsp-card-head">'
             +     `<div class="min-w-0"><h3 class="wsp-card-title">${esc(type.name)}</h3><p class="wsp-card-when">${esc(type.when)}</p>${type.note ? `<p class="wsp-card-when">${esc(type.note)}</p>` : ''}</div>`
             +     `<span class="wsp-state ${on ? 'is-on' : 'is-off'}"><span class="wsp-state-dot"></span>${on ? 'Encendido' : 'Pausado'}</span>`
             +   '</header>'
             +   `<div class="wsp-tags"><span class="wsp-tag${count ? '' : ' is-warn'}"><i data-lucide="users"></i>${people}</span>${custom}</div>`
             +   wspBubble(n.preview)
             +   foot
             + '</article>';
    }

    cardBtn(act, icon, text, label) {
        return `<button type="button" class="wsp-btn" data-act="${act}" aria-label="${esc(label)}"><i data-lucide="${icon}"></i><span>${text}</span></button>`;
    }

    // Texto a la izquierda, cómo le llega a la derecha; las variables arriba.
    formNotice(type) {
        const n = this.notices[type];

        if (!n || this.saving) return;

        const t    = this.typeOf(type);
        const vars = t.vars.map((v) => ''
            + `<button type="button" class="wsp-var" data-var="${esc(v.key)}" aria-label="Poner ${esc(v.label)} en el mensaje">`
            +   `<span class="wsp-var-key">{${esc(v.key)}}</span>${esc(v.label)}`
            + '</button>').join('');

        this.csModal({
            id:         'modalWspNotice',
            title:      `Aviso: ${t.name}`,
            subtitle:   t.when,
            lucideIcon: 'message-circle',
            width:      'max-w-5xl',
            saveText:   'Guardar aviso',
            cancelText: 'Cancelar',
            action:     { text: 'Restaurar original', lucideIcon: 'rotate-ccw', onClick: () => this.restoreNotice(type) },
            json: [
                {
                    id:    'wn_vars',
                    tipo:  'html',
                    class: 'w-full',
                    html:  '<p class="wsp-label">Variables</p>'
                         + '<p class="wsp-hint">Toca una para ponerla donde está el cursor. Un renglón con todas sus variables vacías no se manda.</p>'
                         + `<div class="wsp-vars">${vars}</div>`
                },
                { id: 'wn_body', lbl: 'Mensaje', tipo: 'textarea', rows: 18, maxlength: WSP_MAX, value: n.body, help: '*negrita*   _cursiva_   ~tachado~   «> » al inicio del renglón = cita', class: 'w-full lg:w-1/2' },
                {
                    id:    'wn_side',
                    tipo:  'html',
                    class: 'w-full lg:w-1/2',
                    html:  '<p class="wsp-label" style="margin-bottom:8px">Así le llega (con datos de ejemplo)</p>'
                         + (t.note ? `<p class="wsp-hint">${esc(t.note)}</p>${this.photoModes()}` : '')
                         + `<div id="wnPreview">${wspBubble(n.preview, '', this.withPhoto(type))}</div>`
                },
                { id: 'wn_active', lbl: 'Aviso encendido', tipo: 'switch', value: Number(n.active) === 1 ? 1 : 0, help: 'Pausado no le llega a nadie; el texto se queda guardado.', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveNotice(type, values, close)
        });

        const modal = $('#modalWspNotice');

        modal.on('click', '.wsp-var', (e) => this.insertVar(`{${$(e.currentTarget).attr('data-var')}}`));
        modal.on('click', 'button[data-photo]', (e) => this.photoMode(type, $(e.currentTarget).attr('data-photo') === '1'));
        modal.on('input', '#wn_body', () => {
            this.countBody();
            this.schedulePreview(type);
        });

        $('#wn_body').after('<p id="wnCount" class="wsp-count" aria-live="polite"></p>');

        this.countBody();
        this.icons();
    }

    // Pone la variable donde está el cursor (o sobre lo seleccionado).
    insertVar(token) {
        const area = document.getElementById('wn_body');

        if (!area) return;

        const start = Number.isInteger(area.selectionStart) ? area.selectionStart : area.value.length;
        const end   = Number.isInteger(area.selectionEnd) ? area.selectionEnd : start;

        if (area.value.length - (end - start) + token.length > WSP_MAX) return this.warn(`El mensaje admite hasta ${WSP_MAX.toLocaleString('es-MX')} caracteres.`);

        area.focus();
        area.setRangeText(token, start, end, 'end');
        $(area).trigger('input');
    }

    countBody() {
        const length = String($('#wn_body').val() || '').length;

        $('#wnCount').text(`${length.toLocaleString('es-MX')} / ${WSP_MAX.toLocaleString('es-MX')}`);
    }

    // La vista previa la arma el servidor (la misma fill() del envío) 350 ms después de la última tecla.
    schedulePreview(type) {
        clearTimeout(this.previewTimer);

        this.previewTimer = setTimeout(() => this.previewNotice(type), 350);
    }

    async previewNotice(type) {
        const request = ++this.requests.preview;
        const data    = await useFetch({ url: this._link, data: { opc: 'previewNotice', type: type, body: String($('#wn_body').val() || '') } });

        if (request !== this.requests.preview || !$('#wnPreview').length) return;

        if (!data || data.status != 200) {
            $('#wnPreview').html(`<p class="wsp-note is-bad">${esc((data && data.message) || 'No se pudo armar la vista previa.')}</p>`);
            return;
        }

        $('#wnPreview').html(wspBubble(data.text, '', this.withPhoto(type)));
    }

    // -- Vista previa con foto --

    // «Solo texto | Con foto», como alpha › Admin › WhatsApp. Solo los avisos que llevan fotos (note).
    photoModes() {
        const on   = !!this.previewPhoto;
        const seg  = (value, text) => {
            const active = (value === '1') === on;

            return `<button type="button" class="ord-seg${active ? ' is-active' : ''}" data-photo="${value}" aria-pressed="${active}">${text}</button>`;
        };

        return `<div class="wsp-modes"><div class="ord-viewer-modes" role="group" aria-label="Vista previa">${seg('0', 'Solo texto')}${seg('1', 'Con foto')}</div></div>`;
    }

    withPhoto(type) {
        return !!this.previewPhoto && !!this.typeOf(type).note;
    }

    // Cambia la foto de la burbuja sin volver a pedir el texto: el pie no cambia.
    photoMode(type, on) {
        this.previewPhoto = on;

        $('#modalWspNotice button[data-photo]').each((i, button) => {
            const active = ($(button).attr('data-photo') === '1') === on;

            $(button).toggleClass('is-active', active).attr('aria-pressed', active);
        });

        const bubble = $('#wnPreview .wsp-bubble');

        if (!bubble.length) return;

        bubble.find('.wsp-photo').remove();

        if (this.withPhoto(type)) bubble.prepend(wspPhoto());
    }

    // Solo cambia el texto del editor: se guarda con «Guardar aviso».
    restoreNotice(type) {
        const n = this.notices[type];

        if (!n) return;

        $('#wn_body').val(n.default).trigger('input');
    }

    async saveNotice(type, values, close) {
        if (this.saving) return;

        const body = String(values.wn_body || '').replace(/\r/g, '');

        if (!body.trim()) return this.warn('Escribe el mensaje del aviso.');
        if (body.length > WSP_MAX) return this.warn(`El mensaje admite hasta ${WSP_MAX.toLocaleString('es-MX')} caracteres.`);

        this.saving = true;

        const button = $('#modalWspNotice .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'saveNotice', type: type, body: body, active: values.wn_active ? '1' : '0' } });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.fail(data, 'No se guardó el aviso');

        clearTimeout(this.previewTimer);
        close();
        alert({ icon: 'success', title: data.message, timer: 1600 });
        this.loadNotices();
    }

    // Pausar se confirma; encender no.
    async toggleNotice(type) {
        const n = this.notices[type];

        if (!n || this.saving) return;

        const on = Number(n.active) !== 1;

        if (!on) {
            const r = await alert({
                icon:     'warning',
                title:    `¿Pausar «${this.typeOf(type).name}»?`,
                text:     'No le llega a nadie hasta que lo vuelvas a encender. El texto se queda guardado.',
                btn1:     true,
                btn1Text: 'Pausar',
                btn2:     true,
                btn2Text: 'Cancelar'
            });

            if (!r || !r.isConfirmed || this.saving) return;
        }

        this.saving = true;

        const data = await useFetch({ url: this._link, data: { opc: 'toggleNotice', type: type, active: on ? '1' : '0' } });

        this.saving = false;

        if (!data || data.status != 200) return this.fail(data, 'No se cambió el aviso');

        alert({ icon: 'success', title: data.message, timer: 1600 });
        this.loadNotices();
    }

    // -- Destinatarios --

    // keep = true conserva la página de la tabla (al pausar o eliminar uno).
    async lsRecipients(keep) {
        const request = ++this.requests.recipients;
        const table   = '#tbWspRecipients';
        const page    = keep && $.fn.DataTable.isDataTable(table) ? $(table).DataTable().page() : 0;

        $('#tableWspRecipients').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsRecipients' } });

        if (request !== this.requests.recipients) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) this.fail(data, 'No se pudo cargar la lista');

        $('#tableWspRecipients').removeClass('opacity-50');

        this.createCoffeeTable3({
            parent:       'tableWspRecipients',
            id:           'tbWspRecipients',
            theme:        'light',
            data:         loaded && data.row ? data : { thead: [], row: [] },
            striped:      true,
            hover:        true,
            f_size:       13,
            center:       [3, 4],
            ...ORD_TABLE,
            emptyMessage: loaded ? 'Nadie recibe los avisos todavía. Agrega a quien debe recibirlos' : 'No se pudo cargar la lista de destinatarios',
            emptyIcon:    loaded ? 'icon-whatsapp' : 'icon-attention'
        });

        if (!(loaded && data.row && data.row.length)) return;

        this.dataTable('tbWspRecipients', 'recipients', 'destinatarios', 'Ningún destinatario coincide con la búsqueda');

        if (page > 0) {
            const dt = $(table).DataTable();

            dt.page(Math.min(page, Math.max(dt.page.info().pages - 1, 0))).draw(false);
        }
    }

    async editRecipient(id) {
        if (this.saving) return;

        const data = await useFetch({ url: this._link, data: { opc: 'getRecipient', id: id } });

        if (!data || data.status != 200) return this.fail(data, 'No se pudo abrir el destinatario');

        if (/@g\.us$/i.test(String(data.row.phone))) return this.formGroup(data.row);

        this.formRecipient(data.row);
    }

    // r = null: nuevo, con los tres avisos marcados. «Le pregunta al agente» (F6) va apagado de fábrica.
    formRecipient(r) {
        if (this.saving) return;

        const isNew = !r;
        const row   = r || { id: 0, name: '', phone: '', branch_id: '', notify_order: 1, notify_turn: 1, notify_day: 1, can_ask: 0 };

        this.csModal({
            id:         'modalWspRecipient',
            title:      isNew ? 'Agregar destinatario' : 'Editar destinatario',
            subtitle:   'A quién le llegan los avisos por WhatsApp',
            lucideIcon: 'users',
            width:      'max-w-xl',
            saveText:   isNew ? 'Agregar' : 'Guardar cambios',
            cancelText: 'Cancelar',
            json: [
                { id: 'wr_name', lbl: 'Nombre', maxlength: 80, ph: 'Ej. Ana López (dueña)', value: row.name, class: 'w-full sm:w-1/2' },
                { id: 'wr_phone', lbl: 'WhatsApp', maxlength: 40, ph: '962 123 4567', icon: 'phone', value: this.phone(row.phone), help: '10 dígitos, sin lada de país. Para un grupo usa «Agregar grupo».', class: 'w-full sm:w-1/2' },
                { id: 'wr_branch', lbl: 'Sucursal', tipo: 'select', data: dataInit.branches || [], empty: 'Todas las sucursales', value: row.branch_id, help: 'Con una sucursal, solo le llegan los avisos de esa sucursal.', class: 'w-full' },
                { id: 'wr_s1', tipo: 'html', class: 'w-full', html: '<p class="wsp-section">Qué avisos recibe</p>' },
                { id: 'wr_order', lbl: 'Pedido nuevo', tipo: 'switch', value: Number(row.notify_order) === 1 ? 1 : 0, class: 'w-full sm:w-1/3' },
                { id: 'wr_turn', lbl: 'Cierre de turno', tipo: 'switch', value: Number(row.notify_turn) === 1 ? 1 : 0, class: 'w-full sm:w-1/3' },
                { id: 'wr_day', lbl: 'Cierre del día', tipo: 'switch', value: Number(row.notify_day) === 1 ? 1 : 0, class: 'w-full sm:w-1/3' },
                { id: 'wr_s2', tipo: 'html', class: 'w-full', html: '<p class="wsp-section">Agente del dueño</p>' },
                { id: 'wr_ask', lbl: 'Le pregunta al agente', tipo: 'switch', value: Number(row.can_ask) === 1 ? 1 : 0, help: 'Desde este WhatsApp puede escribirle al número del agente y preguntar ventas del día, turno, pedidos pendientes y quién debe. Le contesta directo, en el horario del agente. Con sucursal, solo de esa sucursal. Solo un teléfono de 10 dígitos.', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveRecipient(Number(row.id) || 0, values, close)
        });

        this.icons();
    }

    async saveRecipient(id, values, close) {
        if (this.saving) return;

        const name  = String(values.wr_name || '').replace(/\s+/g, ' ').trim();
        const phone = String(values.wr_phone || '').trim();

        if (!name) return this.warn('Escribe el nombre de quien recibe los avisos.');
        if (!phone) return this.warn('Escribe el WhatsApp: 10 dígitos, sin lada de país.');
        if (!values.wr_order && !values.wr_turn && !values.wr_day && !values.wr_ask) return this.warn('Marca al menos un aviso, o que le pueda preguntar al agente.');
        if (values.wr_ask && (/@g\.us$/i.test(phone) || phone.replace(/\D/g, '').length < 10)) return this.warn('Para preguntarle al agente hace falta un teléfono de 10 dígitos (un grupo no puede).');

        this.saving = true;

        const button = $('#modalWspRecipient .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({
            url:  this._link,
            data: {
                opc:          'saveRecipient',
                id:           id,
                name:         name,
                phone:        phone,
                branch_id:    values.wr_branch || '',
                notify_order: values.wr_order ? '1' : '0',
                notify_turn:  values.wr_turn ? '1' : '0',
                notify_day:   values.wr_day ? '1' : '0',
                can_ask:      values.wr_ask ? '1' : '0'
            }
        });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.fail(data, 'No se guardó el destinatario');

        close();
        alert({ icon: 'success', title: data.message, timer: 1400 });
        this.lsRecipients(id > 0);
    }

    // -- Grupos --

    /*  «Agregar grupo»: se elige de los grupos del WhatsApp conectado
        (lsGroups) y su nombre llena «Nombre». Si no aparece, o el proveedor
        es «simulado», se pega su ID …@g.us. Se guarda como cualquier
        destinatario (saveRecipient); un grupo no le pregunta al agente. */
    formGroup(r) {
        if (this.saving) return;

        const isNew = !r;
        const row   = r || { id: 0, name: '', phone: '', branch_id: '', notify_order: 1, notify_turn: 1, notify_day: 1 };

        this.csModal({
            id:         'modalWspGroup',
            title:      isNew ? 'Agregar grupo' : 'Editar grupo',
            subtitle:   'Un grupo de WhatsApp que recibe los avisos',
            lucideIcon: 'users-round',
            width:      'max-w-xl',
            saveText:   isNew ? 'Agregar grupo' : 'Guardar cambios',
            cancelText: 'Cancelar',
            json: [
                { id: 'wg_pick', lbl: 'Grupo de WhatsApp', tipo: 'select2', data: [], empty: '— Elige un grupo —', class: 'w-full' },
                { id: 'wg_state', tipo: 'html', class: 'w-full', html: '<p class="wsp-group-state"><i data-lucide="loader-circle" class="animate-spin"></i>Buscando los grupos de tu WhatsApp…</p>' },
                { id: 'wg_id', lbl: 'ID del grupo', maxlength: 60, ph: '120363000000000000@g.us', icon: 'hash', value: row.phone, help: 'Se llena al elegir el grupo. Si no aparece en la lista, pega aquí su ID.', class: 'w-full' },
                { id: 'wg_name', lbl: 'Nombre', maxlength: 80, ph: 'Ej. Encargados de sucursal', value: row.name, class: 'w-full sm:w-1/2' },
                { id: 'wg_branch', lbl: 'Sucursal', tipo: 'select', data: dataInit.branches || [], empty: 'Todas las sucursales', value: row.branch_id, class: 'w-full sm:w-1/2' },
                { id: 'wg_s1', tipo: 'html', class: 'w-full', html: '<p class="wsp-section">Qué avisos recibe</p>' },
                { id: 'wg_order', lbl: 'Pedido nuevo', tipo: 'switch', value: Number(row.notify_order) === 1 ? 1 : 0, class: 'w-full sm:w-1/3' },
                { id: 'wg_turn', lbl: 'Cierre de turno', tipo: 'switch', value: Number(row.notify_turn) === 1 ? 1 : 0, class: 'w-full sm:w-1/3' },
                { id: 'wg_day', lbl: 'Cierre del día', tipo: 'switch', value: Number(row.notify_day) === 1 ? 1 : 0, class: 'w-full sm:w-1/3' }
            ],
            onSave: (values, close) => this.saveGroup(Number(row.id) || 0, values, close)
        });

        // Elegir el grupo llena el ID y, si el nombre está vacío o era el de otro grupo, el nombre.
        $('#wg_pick').on('change', () => {
            const pick = (this.groups || []).find((g) => g.id === $('#wg_pick').val());

            if (!pick) return;

            const name = String($('#wg_name').val() || '').trim();

            $('#wg_id').val(pick.id);

            if (!name || (this.groups || []).some((g) => g.name === name)) $('#wg_name').val(pick.name);
        });

        this.icons();
        this.loadGroups(row.phone);
    }

    // Los grupos del WhatsApp conectado. keep = el ID que ya tenía (al editar).
    async loadGroups(keep) {
        const request = ++this.requests.groups;
        const data    = await useFetch({ url: this._link, data: { opc: 'lsGroups' } });

        if (request !== this.requests.groups || !$('#modalWspGroup').length) return;

        const pick  = $('#wg_pick');
        const state = (icon, text, tone) => {
            $('#wg_state').html(`<p class="wsp-group-state${tone ? ' is-' + tone : ''}"><i data-lucide="${icon}"></i>${esc(text)}</p>`);
            this.icons();
        };

        this.groups = data && data.status == 200 && data.ok ? data.groups || [] : [];

        if (!data || data.status != 200) return state('triangle-alert', (data && data.message) || 'No se pudo preguntar por los grupos. Pega el ID del grupo.', 'warn');
        if (data.simulated) return state('info', 'WhatsApp está en modo simulado: no hay un número conectado para ver sus grupos. Pega el ID del grupo.', 'info');
        if (!data.ok) return state('triangle-alert', `${data.detail || 'El proveedor no dio la lista.'} Pega el ID del grupo.`, 'warn');
        if (!this.groups.length) return state('info', 'El WhatsApp conectado no está en ningún grupo. Agrégalo al grupo y vuelve a abrir esta ventana.', 'info');

        // Los que ya reciben avisos se ven, pero no se eligen otra vez (salvo el que se está editando).
        pick.html('<option value="">— Elige un grupo —</option>' + this.groups.map((g) => {
            const taken = g.added && g.id !== keep;

            return `<option value="${esc(g.id)}"${taken ? ' disabled' : ''}${g.id === keep ? ' selected' : ''}>${esc(g.name)}${taken ? ' · ya agregado' : ''}</option>`;
        }).join('')).trigger('change.select2');

        state('circle-check', `${this.groups.length} ${this.groups.length === 1 ? 'grupo' : 'grupos'} en tu WhatsApp. Escribe para buscar.`, 'ok');
    }

    async saveGroup(id, values, close) {
        if (this.saving) return;

        const name  = String(values.wg_name || '').replace(/\s+/g, ' ').trim();
        const group = String(values.wg_id || '').trim();

        if (!/^[0-9-]+@g\.us$/.test(group)) return this.warn('Elige el grupo de la lista o pega su ID, por ejemplo 120363000000000000@g.us.');
        if (!name) return this.warn('Escribe un nombre para reconocer el grupo.');
        if (!values.wg_order && !values.wg_turn && !values.wg_day) return this.warn('Marca al menos un aviso.');

        this.saving = true;

        const button = $('#modalWspGroup .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({
            url:  this._link,
            data: {
                opc:          'saveRecipient',
                id:           id,
                name:         name,
                phone:        group,
                branch_id:    values.wg_branch || '',
                notify_order: values.wg_order ? '1' : '0',
                notify_turn:  values.wg_turn ? '1' : '0',
                notify_day:   values.wg_day ? '1' : '0',
                can_ask:      '0'
            }
        });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.fail(data, 'No se guardó el grupo');

        close();
        alert({ icon: 'success', title: id > 0 ? 'Grupo guardado.' : 'Grupo agregado.', timer: 1400 });
        this.lsRecipients(id > 0);
    }

    async toggleRecipient(id, active) {
        if (this.saving) return;

        this.saving = true;

        const data = await useFetch({ url: this._link, data: { opc: 'toggleRecipient', id: id, active: active ? '1' : '0' } });

        this.saving = false;

        if (!data || data.status != 200) return this.fail(data, 'No se cambió el destinatario');

        alert({ icon: 'success', title: data.message, timer: 1400 });
        this.lsRecipients(true);
    }

    async deleteRecipient(id) {
        if (this.saving) return;

        const r = await alert({
            icon:     'warning',
            title:    '¿Eliminar el destinatario?',
            text:     'Deja de recibir avisos. El historial conserva lo que ya se le mandó.',
            btn1:     true,
            btn1Text: 'Eliminar',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!r || !r.isConfirmed || this.saving) return;

        this.saving = true;

        const data = await useFetch({ url: this._link, data: { opc: 'deleteRecipient', id: id } });

        this.saving = false;

        if (!data || data.status != 200) return this.fail(data, 'No se eliminó el destinatario');

        alert({ icon: 'success', title: data.message, timer: 1400 });
        this.lsRecipients(true);
    }

    // -- Historial --

    async lsLog() {
        const request = ++this.requests.log;

        $('#tableWspLog').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsLog', period: $('#wsl_period').val() || '7', type: $('#wsl_type').val() || '' } });

        if (request !== this.requests.log) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) this.fail(data, 'No se pudo cargar el historial');

        $('#tableWspLog').removeClass('opacity-50');

        this.createCoffeeTable3({
            parent:       'tableWspLog',
            id:           'tbWspLog',
            theme:        'light',
            data:         loaded && data.row ? data : { thead: [], row: [] },
            striped:      true,
            hover:        true,
            f_size:       13,
            center:       [5],
            ...ORD_TABLE,
            emptyMessage: loaded ? 'No salió ningún aviso en este periodo' : 'No se pudo cargar el historial',
            emptyIcon:    loaded ? 'icon-chat' : 'icon-attention'
        });

        if (!(loaded && data.row && data.row.length)) return;

        this.dataTable('tbWspLog', 'log', 'envíos', 'Ningún envío coincide con la búsqueda');
    }

    // El mensaje tal como salió (o como se habría mandado, si fue simulado).
    async viewLog(id) {
        const data = await useFetch({ url: this._link, data: { opc: 'getLog', id: id } });

        if (!data || data.status != 200) return this.fail(data, 'No se pudo abrir el envío');

        const l      = data.row;
        const status = { sent: ['is-ok', 'Enviado'], simulated: ['is-sim', 'Simulado'], failed: ['is-bad', 'Falló'] }[l.status] || ['is-sim', l.status];
        const hour   = String(l.when || '').split(' · ')[1] || '';
        const ref    = String(l.reference || '').replace(`${l.type} · `, '');
        const note   = l.status === 'failed'
            ? `<p class="wsp-note is-bad">${esc(l.error || 'El proveedor no lo aceptó.')}</p>`
            : l.status === 'simulated' ? '<p class="wsp-note">Modo simulado: este mensaje no salió a la red.</p>' : '';

        const body = '<div class="wsp-log">'
            +   '<div class="wsp-box-grid">'
            +     this.box('Aviso', esc(l.type), ref !== l.type ? esc(ref) : '')
            +     this.box('Para', esc(l.recipient || l.phone), l.recipient ? esc(l.phone) : '')
            +     this.box('Estado', `<span class="wsp-conn-pill ${status[0]}">${esc(status[1])}</span>`, l.status === 'simulated' ? '' : esc(this.providerName(l.provider)))
            +   '</div>'
            +   note
            +   wspBubble(l.body, hour)
            + '</div>';

        this.csModal({
            id:         'modalWspLog',
            title:      'Mensaje de WhatsApp',
            subtitle:   l.when,
            lucideIcon: 'message-circle',
            width:      'max-w-2xl',
            saveText:   false,
            cancelText: 'Cerrar',
            body:       body
        });

        this.icons();
    }

    // -- Conexión --

    connection() {
        this.createLayout({
            parent: 'container-wsConn',
            design: false,
            data: {
                id:    'connWsp',
                class: 'w-full flex flex-col gap-[14px]',
                container: [
                    { type: 'div', id: 'filterWspConn', class: 'w-full' },
                    { type: 'div', id: 'wspConnInfo', class: 'w-full' }
                ]
            }
        });

        if (this.allow('create')) {
            this.createfilterBar({
                parent:     'filterWspConn',
                id:         'fbWspConn',
                prefijo:    'wsc_',
                coffeesoft: true,
                data: [
                    { opc: 'button', id: 'btnWspCheck', class: 'col-12 col-sm-6 col-md-4 col-xl-3', text: 'Comprobar conexión', icon: 'icon-plug', color_btn: 'outline', onClick: () => this.checkConnection() },
                    { opc: 'button', id: 'btnWspTest', class: 'col-12 col-sm-6 col-md-4 col-xl-3', text: 'Mandar prueba', icon: 'icon-paper-plane', color_btn: 'primary', onClick: () => this.formTest('') }
                ]
            });
        }

        this.paintConn();
    }

    // Qué hay puesto y qué falta. Solo nombres de llaves: ningún valor del .env llega aquí.
    paintConn() {
        const c       = this.conn || {};
        const k       = this.check;
        const missing = c.missing || [];
        const key     = (name) => `<code class="wsp-key">${esc(name)}</code>`;

        let instance = ['Sin comprobar', c.simulated ? 'En modo simulado no hay instancia.' : 'Pulsa «Comprobar conexión».'];

        if (k && k.ok) instance = [c.simulated ? 'Simulada' : 'Vinculada', !c.simulated && k.state ? `Estado: ${esc(k.state)}` : ''];
        else if (k) instance = ['Sin conexión', esc(k.detail || '')];

        const html = '<div class="wsp-conn">'
            +   '<div class="wsp-box-grid">'
            +     this.box('Proveedor', esc(this.providerName(c.provider)), c.simulated ? 'Nada sale a la red.' : '')
            +     this.box('Datos del .env', c.simulated ? 'No aplica' : missing.length ? `Faltan ${missing.length}` : 'Completos', missing.map(key).join(' '))
            +     this.box('Instancia', instance[0], instance[1])
            +   '</div>'
            +   (missing.length ? '<p class="wsp-note is-bad">Mientras falten esos datos, cada aviso queda como «Falló» en el historial.</p>' : '')
            +   '<div class="wsp-help">'
            +     '<p class="wsp-label">Cómo se conecta</p>'
            +     '<ol>'
            +       '<li>Crea una instancia en Green API o en UltraMsg y vincúlala con el WhatsApp que va a mandar los avisos (se escanea un código QR, como en WhatsApp Web).</li>'
            +       `<li>En el servidor, en el archivo ${key('pro/core/config/.env')}, pon ${key('WHATSAPP_PROVEEDOR')} con greenapi o ultramsg y los datos de esa instancia:<br>`
            +         `Green API: ${key('GREENAPI_INSTANCIA')} ${key('GREENAPI_TOKEN')} (y ${key('GREENAPI_URL')} solo si tu cuenta usa otra).<br>`
            +         `UltraMsg: ${key('ULTRAMSG_INSTANCIA')} ${key('ULTRAMSG_TOKEN')}.</li>`
            +       '<li>Vuelve aquí: «Comprobar conexión» y después «Mandar prueba» a tu número.</li>'
            +     '</ol>'
            +     '<p>Los valores no se ven en esta página ni se guardan en la base. Sin proveedor, todo queda en modo simulado.</p>'
            +   '</div>'
            + '</div>';

        $('#wspConnInfo').html(html);
    }

    // Pregunta al proveedor si la instancia está vinculada. No manda mensajes.
    async checkConnection() {
        if (this.saving) return;

        this.saving = true;

        const data = await useFetch({ url: this._link, data: { opc: 'checkConnection' } });

        this.saving = false;

        if (!data || data.status != 200) return this.fail(data, 'No se pudo comprobar la conexión');

        this.conn  = data.conn || this.conn;
        this.check = data.check || null;

        this.headerStatus();
        this.summary();
        this.paintConn();

        const k = this.check || {};

        alert({
            icon:     k.ok ? (this.conn.simulated ? 'info' : 'success') : 'warning',
            title:    k.ok ? (this.conn.simulated ? 'Modo simulado' : 'WhatsApp conectado') : 'Sin conexión',
            text:     k.detail || (k.ok ? 'La instancia está vinculada y lista para mandar.' : 'Revisa la instancia en el proveedor.'),
            btn1:     true,
            btn1Text: 'Entendido'
        });
    }

    // Una prueba a un número escrito a mano: un texto corto o un aviso con datos de ejemplo.
    formTest(type) {
        if (this.saving) return;

        const c     = this.conn || {};
        const types = (dataInit.types || []).map((t) => ({ id: t.key, valor: `${t.name} (con datos de ejemplo)` }));
        const note  = c.simulated
            ? '<p class="wsp-note">Modo simulado: no sale a la red. Queda en el historial como «Simulado».</p>'
            : '<p class="wsp-note is-live">Se manda de verdad al número que escribas.</p>';

        this.csModal({
            id:         'modalWspTest',
            title:      'Mandar prueba',
            subtitle:   'Para confirmar que los avisos llegan',
            lucideIcon: 'send',
            width:      'max-w-xl',
            saveText:   'Mandar',
            cancelText: 'Cancelar',
            json: [
                { id: 'wt_phone', lbl: 'WhatsApp', maxlength: 40, ph: '962 123 4567', icon: 'phone', value: this.testPhone, class: 'w-full sm:w-1/2' },
                { id: 'wt_type', lbl: 'Qué mandar', tipo: 'select', data: types, empty: 'Un texto corto de prueba', value: type || '', class: 'w-full sm:w-1/2' },
                { id: 'wt_note', tipo: 'html', class: 'w-full', html: note }
            ],
            onSave: (values, close) => this.sendTest(values, close)
        });

        this.icons();
        $('#wt_phone').trigger('focus');
    }

    async sendTest(values, close) {
        if (this.saving) return;

        const phone = String(values.wt_phone || '').trim();

        if (!phone) return this.warn('Escribe el WhatsApp al que va la prueba.');

        this.saving = true;

        const button = $('#modalWspTest .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'sendTest', phone: phone, type: values.wt_type || '' } });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.fail(data, 'No salió la prueba');

        this.testPhone = phone;
        close();

        const simulated = data.sent === 'simulated';

        alert({ icon: simulated ? 'info' : 'success', title: simulated ? 'Prueba simulada' : 'Prueba enviada', text: data.message, btn1: true, btn1Text: 'Entendido' });
    }

    // -- Complements --

    dataTable(id, key, noun, zero) {
        $(`#${id}`).DataTable({
            dom:          '<"ord-dt-top"l><"ord-dt-scroll"t><"ord-dt-foot"ip>',
            pageLength:   this.pageLength[key],
            lengthMenu:   [10, 15, 25, 50],
            ordering:     false,
            searching:    true,
            lengthChange: true,
            destroy:      true,
            autoWidth:    false,
            language: {
                lengthMenu:   'Mostrar _MENU_ registros por página',
                info:         `Mostrando _START_ a _END_ de _TOTAL_ ${noun}`,
                infoEmpty:    `Sin ${noun}`,
                infoFiltered: '(de _MAX_ en total)',
                emptyTable:   `Sin ${noun}`,
                zeroRecords:  zero,
                paginate:     { first: 'Primera', last: 'Última', next: '›', previous: '‹' }
            },
            drawCallback: () => this.icons()
        }).on('length.dt', (e, settings, len) => { this.pageLength[key] = len; });
    }

    onSearchInput(key, e) {
        const table = key === 'recipients' ? '#tbWspRecipients' : '#tbWspLog';

        this.terms[key] = this.plain(e.target.value.trim());

        if ($.fn.DataTable.isDataTable(table)) $(table).DataTable().draw();
    }

    // Sin acentos ni mayúsculas; el teléfono se encuentra con o sin espacios.
    matches(key, cells) {
        const term = this.terms[key];

        if (!term) return true;

        const text = this.plain(String(cells || '').replace(/<[^>]*>/g, ' '));

        return text.includes(term) || text.replace(/\s+/g, '').includes(term.replace(/\s+/g, ''));
    }

    plain(text) {
        return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    // 9621234567 → 962 123 4567.
    phone(text) {
        const digits = String(text || '').replace(/\D/g, '');

        return digits.length === 10 ? digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3') : String(text || '');
    }

    box(label, value, sub) {
        return '<div class="wsp-box">'
             +   `<p class="wsp-box-label">${label}</p>`
             +   `<p class="wsp-box-value">${value}</p>`
             +   (sub ? `<p class="wsp-box-sub">${sub}</p>` : '')
             + '</div>';
    }

    typeOf(key) {
        return (dataInit.types || []).find((t) => t.key === key) || { key: key, name: key, when: '', vars: [] };
    }

    providerName(provider) {
        return { greenapi: 'Green API', ultramsg: 'UltraMsg', simulado: 'Simulado' }[provider] || 'Simulado';
    }

    // Permisos de la sección WhatsApp (pos-whatsapp).
    allow(action) {
        return (dataInit.wa || []).includes(action);
    }

    icons() {
        if (window.lucide) lucide.createIcons();
    }

    warn(text) {
        alert({ icon: 'warning', title: 'Falta un dato', text: text, btn1: true, btn1Text: 'Entendido' });
    }

    fail(data, title) {
        const soft = data && [403, 404, 409, 422].includes(Number(data.status));

        alert({
            icon:     soft ? 'warning' : 'error',
            title:    title,
            text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
            btn1:     true,
            btn1Text: 'Entendido'
        });
    }
}
