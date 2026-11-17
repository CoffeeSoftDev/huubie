/*  Ventas › WhatsApp: la bandeja de conversaciones con los clientes y el
    horario del agente (F2 del agente de WhatsApp).

    Dos pestañas de la página WhatsApp (whatsapp.js las crea y llama aquí):
      - «Conversaciones»: la lista de chats, el hilo con burbujas (wspMsg de
        whatsapp.js) y la respuesta a mano. Con la ventana de 24 h cerrada no
        hay caja de texto: WhatsApp solo deja mandar una plantilla aprobada.
      - «Agente»: encender o apagar el agente y su horario por día. Fuera de
        horario lo que llega se guarda y no sale nada automático.

    Sin token de Meta todo es simulado: las respuestas quedan en el chat con
    la marca «Simulado» y existe el simulador («Simular cliente»), que escribe
    como si fuera el cliente. Un chat simulado nunca sale a la red.

    Propuestas del agente (F3): arriba de la caja de respuesta sale la
    tarjeta con lo que el agente propone contestar, las herramientas que usó
    y los datos que leyó. NADA sale sola: una persona la manda (tal cual o
    cambiada), pide otra o la descarta. En producción las automáticas las
    arma el cron; aquí, después de «Simular cliente», se pide agentAuto.
    «Proponer» la pide a mano (sin tope por hora, solo en horario). Mientras
    se arma, la tarjeta se vuelve a pedir cada 4 s.

    Pedidos y comprobantes por chat (F4):
      - Una propuesta puede traer un pedido: la tarjeta lo enseña y el botón
        dice «Mandar y crear pedido». El pedido nace al mandarla y cae en
        Tienda en línea › Nuevos; {folio} del texto se cambia por su folio.
      - Si el agente pasó el chat a una persona, sale la marca «Persona» y una
        banda con lo que quiere el cliente. Mientras tanto el agente no
        propone solo; «Devolver al agente» lo regresa.
      - Una foto que el agente guardó como comprobante lleva su folio (C…).
        El simulador deja adjuntar una foto o un PDF para probarlo.
      - «Agente» elige de dónde sale el catálogo: la Tienda en línea o una
        lista propia («Elegir productos», que se guarda aparte del horario).

    Plantillas y BAJA (F5): con la ventana de 24 h cerrada y el cliente
    esperando respuesta, sale «Mandar «Ya abrimos»». Un cliente que escribió
    BAJA lleva la marca «BAJA»: no recibe recordatorios ni plantillas, pero lo
    que escriba se le contesta. Los recordatorios viven en whatsapp-recordatorios.js.

    Agente del dueño y automático (F6):
      - Un chat de un número del equipo con «Le pregunta al agente» lleva la
        marca «Dueño»: el agente le contesta directo (ventas, turno, pedidos,
        cartera), sin sucursal y sin tarjeta que aprobar.
      - En «Agente» se encienden los temas que salen solos: horario,
        dirección y pago; catálogo y precios. Lo demás sigue en la bandeja.
        Un mensaje que salió solo dice «Agente · salió sola».

    La lista se vuelve a pedir cada 20 s mientras la pestaña está a la vista.
    Ver es pos-whatsapp/show; contestar, simular, asignar sucursal y las
    propuestas, /update; cambiar el agente, /create. La instancia vive en
    wap.inbox. */

const WSP_DAYS  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WSP_WEEK  = [1, 2, 3, 4, 5, 6, 0];
const WSP_POLL  = 20000;
const WSP_MEDIA = { image: 'image', audio: 'mic', video: 'video', document: 'file-text', sticker: 'sticker', location: 'map-pin', contacts: 'contact', reaction: 'smile', template: 'file-check' };
const WSP_TICKS = {
    sent:      ['check', 'Enviado'],
    delivered: ['check-check', 'Entregado'],
    read:      ['check-check', 'Leído'],
    failed:    ['circle-alert', 'No salió'],
    simulated: ['flask-conical', 'Simulado: no salió a la red']
};
const WSP_PROP_POLL  = 4000;
const WSP_PROP_ICONS = { catalogo_buscar: 'book-open', negocio_datos: 'store', pedido_estado: 'package', saldo_cliente: 'wallet', portal_enlace: 'link',
    pedido_borrador: 'shopping-cart', pasar_a_persona: 'user-round', comprobante_guardar: 'receipt',
    ventas_hoy: 'chart-column', turno_estado: 'wallet-cards', pedidos_pendientes: 'package', cartera: 'hand-coins' };
// Los temas que pueden salir solos (F6), en el orden de la pestaña «Agente».
const WSP_AUTO = [
    { key: 'negocio', id: 'autoNegocio', text: 'Salen solas: horario, dirección y pago' },
    { key: 'catalogo', id: 'autoCatalogo', text: 'Salen solas: catálogo y precios' }
];
const WSP_FILE_MAX   = 5 * 1024 * 1024;
// Por qué no hubo propuesta automática que vale decir en la caja (las demás no se dicen).
const WSP_PROP_QUIET = ['done', 'busy', 'answered', 'closed', 'retired'];

// -- CSS --

function wspInboxCSS() {
    if (document.getElementById('wsp-inbox-css')) return;

    const line  = 'rgb(var(--gray-200, 231 229 228))';
    const ink   = 'rgb(var(--gray-900, 28 25 23))';
    const mute  = 'rgb(var(--gray-500, 120 113 108))';
    const body  = 'rgb(var(--gray-600, 87 83 78))';
    const brand = 'rgb(var(--brand-600, 80 48 165))';
    const aBg   = 'var(--accent-soft-bg, rgb(80 48 165 / .09))';
    const aFg   = 'var(--accent-soft-fg, rgb(80 48 165))';
    const tint  = 'var(--tint, rgb(80 48 165 / .06))';
    const aLine = 'var(--accent-line, rgb(80 48 165 / .32))';

    const css = `
        .wsp-inbox { display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); height: clamp(460px, calc(100vh - 330px), 760px);
            border: 1px solid ${line}; border-radius: 14px; overflow: hidden; background: #FFFFFF; }
        .wsp-list { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid ${line}; }
        .wsp-list-scroll { flex: 1; min-height: 0; overflow-y: auto; }

        button.wsp-item { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 11px 14px; border: 0; border-bottom: 1px solid ${line};
            background: transparent; text-align: left; transition: background-color .15s; }
        button.wsp-item:hover { background: ${tint}; }
        button.wsp-item.is-active { background: ${aBg}; box-shadow: inset 3px 0 0 ${brand}; }
        .wsp-avatar { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 38px; height: 38px; border-radius: 999px;
            background: ${aBg}; color: ${aFg}; font-size: 15px; font-weight: 700; }
        .wsp-item-main { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
        .wsp-item-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
        .wsp-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; color: ${ink}; }
        .wsp-item-when { flex-shrink: 0; font-size: 11.5px; color: ${mute}; }
        .wsp-item-preview { display: flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            font-size: 13px; color: ${body}; }
        .wsp-item-preview > span:last-child { overflow: hidden; text-overflow: ellipsis; }
        .wsp-item.is-unread .wsp-item-name, .wsp-item.is-unread .wsp-item-preview { color: ${ink}; font-weight: 700; }
        .wsp-item.is-unread .wsp-item-when { color: ${brand}; font-weight: 700; }
        .wsp-unread { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; min-width: 20px; height: 20px; padding: 0 6px;
            border-radius: 999px; background: ${brand}; color: #FFFFFF; font-size: 11.5px; font-weight: 700; }
        .wsp-item .wsp-tags { gap: 4px; margin-top: 2px; }
        .wsp-item .wsp-tag { padding: 1px 7px; font-size: 11px; }
        .wsp-item .wsp-tag svg, .wsp-th .wsp-tag svg { width: 12px; height: 12px; }

        .wsp-pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
        .wsp-th { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid ${line}; }
        .wsp-th-main { flex: 1; min-width: 0; }
        .wsp-th-main p { margin: 0; }
        .wsp-th-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 700; color: ${ink}; }
        .wsp-th-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 2px !important; font-size: 12.5px; color: ${mute}; }
        .wsp-th-actions { display: flex; gap: 6px; flex-shrink: 0; }
        button.wsp-back { display: none; align-items: center; justify-content: center; width: 34px; height: 34px; border: 0; border-radius: 8px;
            background: transparent; color: ${body}; }
        button.wsp-back:hover { background: ${tint}; color: ${aFg}; }
        button.wsp-back svg { width: 20px; height: 20px; }

        .wsp-chat.wsp-thread { flex: 1; min-height: 0; max-height: none; border-radius: 0; padding: 10px 16px 14px; }
        .wsp-thread .wsp-bubble { min-width: 96px; max-width: min(78%, 560px); margin-top: 3px; }
        .wsp-thread .wsp-bubble:not(.no-tail) { margin-top: 10px; }
        .wsp-day { display: flex; justify-content: center; margin: 12px 0 2px; }
        .wsp-day span { padding: 4px 10px; border-radius: 8px; background: #FFFFFF; box-shadow: 0 1px .5px rgba(11, 20, 26, .13);
            font-size: 12px; font-weight: 500; color: #54656F; }
        .wsp-fail { width: fit-content; max-width: min(78%, 560px); margin: 4px 0 0 auto; font-size: 12px; color: #BE123C; }

        .wsp-foot { padding: 10px 14px; border-top: 1px solid ${line}; }
        .wsp-composer { display: flex; align-items: flex-end; gap: 8px; margin: 0; }
        .wsp-composer textarea { flex: 1; min-width: 0; max-height: 140px; padding: 9px 12px; border: 1px solid ${line}; border-radius: 12px; resize: none;
            background: #FFFFFF; font-size: 14px; line-height: 1.4; color: ${ink}; }
        .wsp-composer textarea:focus { outline: none; border-color: ${brand}; box-shadow: 0 0 0 3px ${aBg}; }
        button.wsp-send { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 42px; height: 42px; border: 0;
            border-radius: 999px; background: ${brand}; color: #FFFFFF; transition: opacity .15s; }
        button.wsp-send:disabled { opacity: .5; cursor: wait; }
        button.wsp-send svg { width: 19px; height: 19px; }
        .wsp-foot-hint { margin: 6px 2px 0; font-size: 11.5px; color: ${mute}; }
        .wsp-lock { display: flex; align-items: flex-start; gap: 10px; margin: 0; padding: 10px 12px; border-radius: 12px; background: ${aBg};
            font-size: 13px; line-height: 1.45; color: ${aFg}; }
        .wsp-lock svg { width: 17px; height: 17px; flex-shrink: 0; margin-top: 1px; }
        .wsp-lock .wsp-lock-text { flex: 1; min-width: 0; }
        .wsp-lock button.wsp-btn { flex-shrink: 0; align-self: center; }
        @media (max-width: 760px) { .wsp-lock { flex-wrap: wrap; } .wsp-lock button.wsp-btn { width: 100%; justify-content: center; } }

        .wsp-pane-empty { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px;
            text-align: center; font-size: 13.5px; color: ${mute}; }
        .wsp-pane-empty svg { width: 34px; height: 34px; color: ${brand}; opacity: .6; }
        .wsp-pane-empty p { margin: 0; max-width: 320px; }
        .wsp-list .wsp-empty { margin: 14px; }

        .wsp-agent { display: flex; flex-direction: column; gap: 14px; }
        .wsp-agent-form { padding: 14px 16px; border: 1px solid ${line}; border-radius: 12px; }

        .wsp-foot-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
        .wsp-foot-row .wsp-foot-hint { margin: 0 2px; }
        .wsp-foot-row button.wsp-btn { flex-shrink: 0; padding: 4px 10px; font-size: 12.5px; }

        .wsp-prop { display: flex; flex-direction: column; gap: 8px; max-height: min(360px, 50vh); margin-bottom: 10px;
            padding: 10px 12px; border: 1px solid ${aLine}; border-radius: 12px; background: ${tint}; }
        .wsp-prop-body { display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; }
        .wsp-prop-body > * { flex-shrink: 0; }
        .wsp-prop-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 10px; }
        .wsp-prop-title { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: ${aFg}; }
        .wsp-prop-title svg { width: 15px; height: 15px; }
        .wsp-prop-meta { font-size: 11.5px; color: ${mute}; }
        .wsp-prop textarea { width: 100%; min-height: 64px; max-height: 160px; padding: 8px 10px; border: 1px solid ${line}; border-radius: 10px;
            resize: none; background: #FFFFFF; font-size: 14px; line-height: 1.4; color: ${ink}; }
        .wsp-prop textarea:focus { outline: none; border-color: ${brand}; box-shadow: 0 0 0 3px ${aBg}; }
        .wsp-prop .wsp-tags { gap: 4px; }
        .wsp-prop .wsp-tag { padding: 1px 8px; font-size: 11.5px; }
        .wsp-prop .wsp-tag svg { width: 12px; height: 12px; }
        .wsp-prop .wsp-note { padding: 7px 10px; font-size: 12.5px; }
        .wsp-prop-wait { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; color: ${body}; }
        .wsp-prop-dot { flex-shrink: 0; width: 7px; height: 7px; border-radius: 999px; background: ${brand}; animation: wspPropBlink 1.6s ease-in-out infinite; }
        @keyframes wspPropBlink { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
        .wsp-prop-data summary { width: fit-content; cursor: pointer; font-size: 12.5px; font-weight: 600; color: ${aFg}; }
        .wsp-prop-data summary:focus-visible { outline: 2px solid ${brand}; outline-offset: 2px; border-radius: 4px; }
        .wsp-prop-tool { margin-top: 8px; }
        .wsp-prop-tool p { margin: 0 0 4px; font-size: 12.5px; color: ${body}; }
        .wsp-prop-tool pre { max-height: 150px; margin: 0; padding: 6px 8px; overflow: auto; border: 1px solid ${line}; border-radius: 8px;
            background: #FFFFFF; font-size: 11.5px; line-height: 1.35; white-space: pre-wrap; word-break: break-word; color: ${body}; }
        .wsp-prop-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .wsp-prop-actions .wsp-prop-hint { margin-left: auto; font-size: 11.5px; color: ${mute}; }
        button.wsp-btn.wsp-prop-send { border-color: ${brand}; background: ${brand}; color: #FFFFFF; }
        button.wsp-btn.wsp-prop-send:hover { border-color: ${brand}; background: ${brand}; color: #FFFFFF; opacity: .9; }
        button.wsp-btn:disabled { opacity: .55; cursor: wait; }
        @media (prefers-reduced-motion: reduce) { .wsp-prop-dot { animation: none; opacity: .8; } }

        .wsp-handoff { display: flex; align-items: flex-start; gap: 10px; padding: 8px 14px; border-bottom: 1px solid ${line}; background: ${aBg};
            font-size: 12.5px; line-height: 1.45; color: ${aFg}; }
        .wsp-handoff > svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }
        .wsp-handoff p { flex: 1; min-width: 0; margin: 0; overflow-wrap: anywhere; }
        .wsp-handoff button.wsp-btn { flex-shrink: 0; padding: 4px 10px; font-size: 12.5px; }

        .wsp-prop-draft { padding: 8px 10px; border: 1px solid ${aLine}; border-radius: 10px; background: #FFFFFF; font-size: 12.5px; color: ${body}; }
        .wsp-prop-draft p { margin: 0; overflow-wrap: anywhere; }
        .wsp-prop-draft p.wsp-prop-draft-title { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-weight: 700; color: ${aFg}; }
        .wsp-prop-draft-title svg { width: 14px; height: 14px; flex-shrink: 0; }
        .wsp-prop-draft ul { margin: 0 0 6px; padding: 0; list-style: none; }
        .wsp-prop-draft li { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; color: ${ink}; }
        .wsp-prop-draft li span:last-child { flex-shrink: 0; font-variant-numeric: tabular-nums; }
        .wsp-prop-draft li.is-total { margin-top: 2px; padding-top: 5px; border-top: 1px solid ${line}; font-weight: 700; }

        .wsp-pick-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
        .wsp-pick-bar input { flex: 1; min-width: 180px; padding: 7px 10px; border: 1px solid ${line}; border-radius: 10px; background: #FFFFFF;
            font-size: 13.5px; color: ${ink}; }
        .wsp-pick-bar input:focus { outline: none; border-color: ${brand}; box-shadow: 0 0 0 3px ${aBg}; }
        .wsp-pick-count { font-size: 12.5px; font-weight: 600; color: ${aFg}; }
        .wsp-pick-list { max-height: min(46vh, 420px); overflow-y: auto; border: 1px solid ${line}; border-radius: 10px; }
        .wsp-pick-cat { position: sticky; top: 0; z-index: 1; margin: 0; padding: 5px 10px; background: rgb(var(--gray-100, 245 245 244));
            font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: ${mute}; }
        label.wsp-pick { display: flex; align-items: center; gap: 10px; margin: 0; padding: 7px 10px; border-top: 1px solid ${line};
            font-size: 13.5px; color: ${ink}; cursor: pointer; }
        label.wsp-pick:hover { background: ${tint}; }
        label.wsp-pick[hidden], .wsp-pick-cat[hidden] { display: none; }
        label.wsp-pick input { flex-shrink: 0; width: 16px; height: 16px; accent-color: ${brand}; }
        .wsp-pick-name { flex: 1; min-width: 0; }
        .wsp-pick-sub { display: block; font-size: 11.5px; color: ${mute}; }
        .wsp-pick-price { flex-shrink: 0; font-variant-numeric: tabular-nums; color: ${body}; }

        label.wsp-file { display: flex; flex-direction: column; gap: 5px; margin: 0; font-size: 13px; color: ${body}; }
        label.wsp-file input { font-size: 13px; }

        @media (max-width: 760px) {
            .wsp-inbox { grid-template-columns: minmax(0, 1fr); height: auto; }
            .wsp-list { border-right: 0; }
            .wsp-list-scroll { max-height: 70vh; }
            .wsp-pane { display: none; height: 78vh; min-height: 440px; }
            .wsp-inbox.is-open .wsp-list { display: none; }
            .wsp-inbox.is-open .wsp-pane { display: flex; }
            button.wsp-back { display: inline-flex; }
            .wsp-th { padding: 8px 10px; gap: 8px; }
            .wsp-th .wsp-avatar { display: none; }
            .wsp-th-label { display: none; }
            .wsp-chat.wsp-thread { padding: 8px 10px 12px; }
            .wsp-thread .wsp-bubble, .wsp-fail { max-width: 88%; }
        }

        body.dark-mode .wsp-inbox,
        body.dark-mode .wsp-composer textarea { background: var(--dk-card, #1F2A37); border-color: var(--dk-line, #374151); }
        body.dark-mode .wsp-list,
        body.dark-mode button.wsp-item,
        body.dark-mode .wsp-th,
        body.dark-mode .wsp-foot,
        body.dark-mode .wsp-agent-form { border-color: var(--dk-line, #374151); }
        body.dark-mode .wsp-item-name,
        body.dark-mode .wsp-th-name,
        body.dark-mode .wsp-composer textarea,
        body.dark-mode .wsp-item.is-unread .wsp-item-preview { color: var(--dk-text, #F3F4F6); }
        body.dark-mode .wsp-item-preview,
        body.dark-mode button.wsp-back { color: #D1D5DB; }
        body.dark-mode button.wsp-item:hover { background: rgba(255, 255, 255, .04); }
        body.dark-mode .wsp-day span { background: #182229; color: rgba(233, 237, 239, .75); }
        body.dark-mode .wsp-fail { color: #FDA4AF; }
        body.dark-mode .wsp-prop { background: rgba(255, 255, 255, .03); }
        body.dark-mode .wsp-prop textarea,
        body.dark-mode .wsp-prop-tool pre { background: var(--dk-card, #1F2A37); border-color: var(--dk-line, #374151); color: var(--dk-text, #F3F4F6); }
        body.dark-mode .wsp-prop-wait,
        body.dark-mode .wsp-prop-tool p { color: #D1D5DB; }
        body.dark-mode .wsp-prop-title,
        body.dark-mode .wsp-prop-data summary { color: rgb(var(--brand-300, 196 181 253)); }
        body.dark-mode .wsp-prop-draft,
        body.dark-mode .wsp-pick-bar input { background: var(--dk-card, #1F2A37); border-color: var(--dk-line, #374151); color: var(--dk-text, #F3F4F6); }
        body.dark-mode .wsp-prop-draft li,
        body.dark-mode label.wsp-pick { color: var(--dk-text, #F3F4F6); }
        body.dark-mode .wsp-handoff,
        body.dark-mode .wsp-pick-list,
        body.dark-mode label.wsp-pick,
        body.dark-mode .wsp-prop-draft li.is-total { border-color: var(--dk-line, #374151); }
        body.dark-mode .wsp-pick-cat { background: #111827; color: #D1D5DB; }
        body.dark-mode label.wsp-pick:hover { background: rgba(255, 255, 255, .04); }
        body.dark-mode .wsp-handoff,
        body.dark-mode .wsp-prop-draft p.wsp-prop-draft-title,
        body.dark-mode .wsp-pick-count { color: rgb(var(--brand-300, 196 181 253)); }
        body.dark-mode label.wsp-file,
        body.dark-mode .wsp-pick-price { color: #D1D5DB; }
    `;

    $('<style id="wsp-inbox-css">').text(css).appendTo('head');
}

// -- WhatsAppInbox --

class WhatsAppInbox extends Templates {

    // -- Initial --

    constructor(link, div_modulo, page) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'WhatsAppInbox';
        this.page      = page;
        this.rows      = [];
        this.current   = 0;
        this.chat      = null;
        this.messages  = [];
        this.signature = '';
        this.agent     = dataInit.agent || {};
        this.conn      = dataInit.agentConn || {};
        this.requests  = { list: 0, chat: 0 };
        this.saving    = false;
        this.sending   = false;
        this.searchTimer = null;
        this.pollTimer   = null;
        this.sim       = { phone: '', name: '' };

        // Propuestas del agente (F3).
        this.ai        = false;       // hay llave del servicio de IA (lo dice getChat)
        this.proposal  = null;        // la propuesta abierta del chat a la vista
        this.propDraft = null;        // { id, text }: lo que la persona cambió en la tarjeta
        this.propTimer = null;
        this.asking    = new Set();   // chats con una propuesta pedida desde esta pantalla, en camino
        this.dropped   = new Set();   // de esos, los que se descartaron mientras se armaban
        this.note      = null;        // { id, text }: por qué no hubo propuesta automática
        this.deciding  = false;

        // Catálogo del agente (F4).
        this.ownCount  = null;        // productos en la lista propia (lo dicen getAgent y los guardados)
        this.picking   = false;
    }

    // -- Interface --

    init() {
        wspInboxCSS();
        this.layoutChats();
        this.layoutAgent();

        this.pollTimer = setInterval(() => this.poll(), WSP_POLL);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.poll();
        });
    }

    // whatsapp.js la llama al entrar a «Conversaciones» (y al cargar: es la pestaña inicial).
    showChats() {
        this.paintChatsNote();
        this.lsChats();
    }

    showAgent() {
        this.getAgent();
    }

    // Solo con «Conversaciones» a la vista, sin un modal abierto y con la página visible.
    poll() {
        if (!this.page || this.page.tab !== 'chats' || document.hidden || $('.cs-modal-bg').length) return;

        this.lsChats(true);
    }

    layoutChats() {
        this.createLayout({
            parent: 'container-wsChats',
            design: false,
            data: {
                id:    'chatsWsp',
                class: 'w-full flex flex-col gap-[12px]',
                container: [
                    { type: 'div', id: 'wspChatsNote', class: 'w-full' },
                    { type: 'div', id: 'filterWspChats', class: 'w-full' },
                    { type: 'div', id: 'wspInbox', class: 'wsp-inbox' }
                ]
            }
        });

        this.filterChats();

        $('#wspInbox').html(''
            + '<section class="wsp-list" aria-label="Conversaciones">'
            +   '<div id="wspList" class="wsp-list-scroll"></div>'
            + '</section>'
            + '<section class="wsp-pane" aria-label="Conversación abierta">'
            +   '<div id="wspThreadHead"></div>'
            +   '<div id="wspThreadBody" class="wsp-chat wsp-thread" aria-live="polite"></div>'
            +   '<div id="wspThreadFoot"></div>'
            + '</section>');

        this.paintEmptyPane();

        const inbox = $('#wspInbox');

        inbox.on('click', 'button.wsp-item', (e) => this.openChat(Number($(e.currentTarget).attr('data-id')), { bottom: true }));
        inbox.on('click', 'button[data-act="back"]', () => this.closeChat());
        inbox.on('click', 'button[data-act="branch"]', () => this.formBranch());
        inbox.on('click', 'button[data-act="as-client"]', () => this.formSimulate(true));
        inbox.on('click', 'button[data-act="agent-back"]', () => this.agentBack());
        inbox.on('click', 'button[data-act="reopen"]', () => this.sendReopen());
        inbox.on('submit', '.wsp-composer', (e) => {
            e.preventDefault();
            this.sendReply();
        });
        inbox.on('keydown', '#wspReply', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                this.sendReply();
            }
        });
        inbox.on('input', '#wspReply', (e) => this.grow(e.currentTarget));

        inbox.on('click', 'button[data-act="propose"]', () => this.proposeNow());
        inbox.on('click', 'button[data-act="prop-send"]', () => this.sendProposal());
        inbox.on('click', 'button[data-act="prop-discard"]', () => this.discardProposal());
        inbox.on('input', '#wspPropText', (e) => {
            if (this.proposal) this.propDraft = { id: this.proposal.id, text: e.currentTarget.value };
            this.grow(e.currentTarget, 160);
        });
        // Ctrl + Enter manda la propuesta; Enter solo hace renglón (se está revisando).
        inbox.on('keydown', '#wspPropText', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) {
                e.preventDefault();
                this.sendProposal();
            }
        });
    }

    filterChats() {
        const branches = [{ id: '', valor: 'Todas' }, { id: 'none', valor: 'Sin sucursal' }].concat(dataInit.branches || []);
        const data     = [
            {
                opc:         'input',
                id:          'q',
                lbl:         'Buscar',
                type:        'search',
                placeholder: 'Nombre o teléfono',
                required:    false,
                class:       'col-12 col-md-5 col-xl-4'
            },
            {
                opc:      'select',
                id:       'branch',
                lbl:      'Sucursal',
                required: false,
                class:    'col-6 col-md-4 col-xl-3',
                data:     branches,
                onchange: 'wap.inbox.lsChats()'
            }
        ];

        if (this.conn.simulated && this.page.allow('update')) {
            data.push({ opc: 'button', id: 'btnWspSimulate', class: 'col-6 col-md-3 col-xl-2', text: 'Simular cliente', icon: 'icon-comment', color_btn: 'outline', onClick: () => this.formSimulate(false) });
        }

        this.createfilterBar({
            parent:     'filterWspChats',
            id:         'fbWspChats',
            prefijo:    'wsi_',
            coffeesoft: true,
            data:       data
        });

        $('#wsi_q')
            .attr({ maxlength: 60, autocomplete: 'off', 'aria-label': 'Buscar conversación' })
            .on('input', () => {
                clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => this.lsChats(), 300);
            });

        $('#wsi_branch').attr('aria-label', 'Filtrar por sucursal');
        $('#wsi_btnWspSimulate').attr('aria-label', 'Escribir como si fueras un cliente (simulador)');
    }

    // Una línea arriba de la bandeja: si es simulado y si el agente atiende ahora.
    paintChatsNote() {
        const c = this.conn || {};
        const a = this.agent || {};
        let text;
        let cls = '';

        if (c.simulated) {
            text = 'Modo simulado: sin token de Meta, las respuestas quedan en la conversación y no salen a WhatsApp. «Simular cliente» escribe como si fueras el cliente.';
        } else if (!c.ready) {
            text = `Faltan datos de Meta en el .env: ${(c.missing || []).join(', ')}. Mientras falten, las respuestas quedan como «No salió».`;
            cls  = ' is-bad';
        } else if (!a.exists) {
            text = 'La empresa todavía no tiene número de WhatsApp para el agente. Lo da de alta soporte.';
            cls  = ' is-bad';
        }

        const state = !a.exists ? '' : !a.enabled
            ? ' El agente está apagado: nada sale solo.'
            : a.open ? ' El agente está en horario.' : ' El agente está fuera de horario: lo que llegue se guarda y no sale nada automático.';

        if (!text && !state) return $('#wspChatsNote').empty();

        $('#wspChatsNote').html(`<p class="wsp-note${cls}">${esc((text || '') + state).trim()}</p>`);
    }

    // -- Lista --

    // quiet = la consulta de cada 20 s: no atenúa la lista.
    async lsChats(quiet) {
        const request = ++this.requests.list;
        const list    = $('#wspList');

        if (!quiet) list.addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsChats', search: String($('#wsi_q').val() || ''), branch: String($('#wsi_branch').val() || '') } });

        if (request !== this.requests.list) return;

        list.removeClass('opacity-50');

        if (!data || data.status != 200) {
            if (!quiet) list.html(`<div class="wsp-empty"><i class="icon-attention"></i><p>${esc((data && data.message) || 'No se pudieron cargar las conversaciones. Recarga la página.')}</p></div>`);
            return;
        }

        const wasOpen = this.agent.open;

        this.rows  = data.row || [];
        this.agent = data.agent || this.agent;

        if (wasOpen !== this.agent.open) this.paintChatsNote();

        this.paintList();

        // El chat abierto cambió (mensaje nuevo, status, sucursal): se vuelve a pedir su hilo.
        const row = this.rows.find((r) => r.id === this.current);

        if (row && this.current && this.rowSignature(row) !== this.signature) this.openChat(this.current, { quiet: true });
    }

    paintList() {
        const list = $('#wspList');

        if (!this.rows.length) {
            const filtered = String($('#wsi_q').val() || '') !== '' || String($('#wsi_branch').val() || '') !== '';
            const hint     = filtered
                ? 'Ninguna conversación coincide con el filtro.'
                : 'Todavía no hay conversaciones. Cuando un cliente escriba al número del agente, aparece aquí.'
                  + (this.conn.simulated && this.page.allow('update') ? ' Para probar, usa «Simular cliente».' : '');

            list.html(`<div class="wsp-empty"><i data-lucide="message-circle"></i><p>${esc(hint)}</p></div>`);
            this.page.icons();
            return;
        }

        list.html(this.rows.map((r) => this.item(r)).join(''));
        this.page.icons();
    }

    item(r) {
        const active = r.id === this.current;
        const unread = Number(r.unread) || 0;
        const tick   = r.last_dir === 'out' ? this.tick(r.last_status) : '';
        const tags   = [
            r.owner ? '<span class="wsp-tag is-accent"><i data-lucide="briefcase"></i>Dueño</span>'
                : r.branch ? `<span class="wsp-tag">${esc(r.branch)}</span>` : '<span class="wsp-tag">Sin sucursal</span>',
            r.sim ? '<span class="wsp-tag is-accent">Simulado</span>' : '',
            r.human ? '<span class="wsp-tag is-accent"><i data-lucide="user-round"></i>Persona</span>' : '',
            r.proposal === 'pending' ? '<span class="wsp-tag is-accent"><i data-lucide="sparkles"></i>Propuesta</span>' : '',
            r.proposal === 'working' ? '<span class="wsp-tag"><i data-lucide="sparkles"></i>Armando</span>' : '',
            r.window ? '' : '<span class="wsp-tag"><i data-lucide="lock"></i>24 h</span>',
            r.opt_out ? '<span class="wsp-tag is-warn" aria-label="Escribió BAJA: no recibe recordatorios">BAJA</span>' : ''
        ].join('');
        const label  = `Abrir la conversación con ${r.name}${r.owner ? ' (número del equipo)' : ''}${unread ? `, ${unread} sin leer` : ''}${r.human ? ', la atiende una persona' : ''}${r.proposal === 'pending' ? ', con propuesta del agente' : ''}`;

        return `<button type="button" class="wsp-item${active ? ' is-active' : ''}${unread ? ' is-unread' : ''}" data-id="${Number(r.id)}" aria-label="${esc(label)}"${active ? ' aria-current="true"' : ''}>`
             +   `<span class="wsp-avatar" aria-hidden="true">${esc(this.initial(r.name))}</span>`
             +   '<span class="wsp-item-main">'
             +     `<span class="wsp-item-row"><span class="wsp-item-name">${esc(r.name)}</span><span class="wsp-item-when">${esc(r.when)}</span></span>`
             +     `<span class="wsp-item-row"><span class="wsp-item-preview">${tick}<span>${esc(r.preview)}</span></span>${unread ? `<span class="wsp-unread" aria-hidden="true">${unread}</span>` : ''}</span>`
             +     `<span class="wsp-tags">${tags}</span>`
             +   '</span>'
             + '</button>';
    }

    // Lo que cambia cuando el hilo abierto necesita volver a pedirse (no cuenta los no leídos).
    rowSignature(r) {
        return [r.when, r.preview, r.last_dir, r.last_status, r.branch_id, r.window, r.opt_out, r.proposal, r.human].join('|');
    }

    // -- Hilo --

    // quiet = recarga del mismo chat (sondeo o después de mandar): conserva lo escrito.
    async openChat(id, opt = {}) {
        if (!id) return;

        const request = ++this.requests.chat;
        const same    = id === this.current;

        this.current = id;

        $('#wspList button.wsp-item').removeClass('is-active').removeAttr('aria-current');
        $(`#wspList button.wsp-item[data-id="${id}"]`).addClass('is-active').attr('aria-current', 'true');
        $('#wspInbox').addClass('is-open');

        if (!opt.quiet && !same) $('#wspThreadBody').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'getChat', id: id } });

        if (request !== this.requests.chat || id !== this.current) return;

        $('#wspThreadBody').removeClass('opacity-50');

        if (!data || data.status != 200) {
            if (opt.quiet) return;

            this.page.fail(data, 'No se pudo abrir la conversación');

            if (data && Number(data.status) === 404) {
                this.closeChat();
                this.lsChats(true);
            }

            return;
        }

        this.chat     = data.chat;
        this.messages = data.messages || [];
        this.proposal = data.proposal || null;
        this.ai       = Boolean(data.ai);

        // Abrirlo lo deja leído: la lista se corrige sin volver a pedirla.
        const row = this.rows.find((r) => r.id === id);

        if (row) {
            this.signature = this.rowSignature(row);

            if (this.page.allow('update') && row.unread) {
                row.unread = 0;
                this.paintList();
            }
        }

        this.paintThread(opt.bottom || !same);
    }

    // Botón «atrás» del teléfono: regresa a la lista.
    closeChat() {
        this.current   = 0;
        this.chat      = null;
        this.proposal  = null;
        this.signature = '';
        this.requests.chat++;

        clearTimeout(this.propTimer);

        $('#wspInbox').removeClass('is-open');
        $('#wspList button.wsp-item').removeClass('is-active').removeAttr('aria-current');

        this.paintEmptyPane();
    }

    paintEmptyPane() {
        $('#wspThreadHead, #wspThreadFoot').empty();
        $('#wspThreadBody').html('<div class="wsp-pane-empty"><i data-lucide="messages-square"></i><p>Elige una conversación para leerla y contestar.</p></div>');
        this.page.icons();
    }

    paintThread(toBottom) {
        const c    = this.chat;
        const box  = document.getElementById('wspThreadBody');
        const near = box ? box.scrollHeight - box.scrollTop - box.clientHeight < 80 : true;
        const sub  = [
            `<span>${esc(c.phone)}</span>`,
            c.owner ? '<span class="wsp-tag is-accent"><i data-lucide="briefcase"></i>Dueño · le contesta el agente directo</span>'
                : c.branch ? `<span class="wsp-tag">${esc(c.branch)}</span>` : '<span class="wsp-tag">Sin sucursal</span>',
            c.sim ? '<span class="wsp-tag is-accent">Simulado</span>' : '',
            c.human ? '<span class="wsp-tag is-accent"><i data-lucide="user-round"></i>Persona</span>' : ''
        ].join('');

        const actions = [];

        if (this.page.allow('update')) {
            // El dueño ve las sucursales de su alta en Destinatarios: no se le asigna una.
            if (!c.owner) actions.push('<button type="button" class="wsp-btn" data-act="branch" aria-label="Asignar la sucursal de esta conversación"><i data-lucide="store"></i><span class="wsp-th-label">Sucursal</span></button>');

            if (c.sim && this.conn.simulated) {
                actions.push('<button type="button" class="wsp-btn" data-act="as-client" aria-label="Escribir como este cliente (simulador)"><i data-lucide="flask-conical"></i><span class="wsp-th-label">Como cliente</span></button>');
            }
        }

        $('#wspThreadHead').html(''
            + '<div class="wsp-th">'
            +   '<button type="button" class="wsp-back" data-act="back" aria-label="Volver a la lista de conversaciones"><i data-lucide="arrow-left"></i></button>'
            +   `<span class="wsp-avatar" aria-hidden="true">${esc(this.initial(c.name))}</span>`
            +   `<div class="wsp-th-main"><p class="wsp-th-name">${esc(c.name)}</p><p class="wsp-th-sub">${sub}</p></div>`
            +   `<div class="wsp-th-actions">${actions.join('')}</div>`
            + '</div>'
            + (c.human ? this.handoffBand(c) : ''));

        $('#wspThreadBody').html(this.thread());
        this.paintFoot();

        if (box && (toBottom || near)) box.scrollTop = box.scrollHeight;
    }

    // Bajo el encabezado: el agente pasó el chat a una persona y ya no propone solo.
    handoffBand(c) {
        const until = c.human_until ? ` hasta el ${c.human_until}` : '';
        const note  = c.handoff ? ` Qué necesita: ${c.handoff}` : '';
        const back  = this.page.allow('update')
            ? '<button type="button" class="wsp-btn" data-act="agent-back" aria-label="Devolver esta conversación al agente"><i data-lucide="bot"></i><span>Devolver al agente</span></button>'
            : '';

        return '<div class="wsp-handoff" role="status"><i data-lucide="user-round"></i>'
             +   `<p><strong>La atiende una persona${esc(until)}.</strong> El agente no propone solo en este chat.${esc(note)}</p>`
             +   back
             + '</div>';
    }

    async agentBack() {
        const id = this.current;

        if (!id || !this.chat || this.saving) return;

        this.saving = true;

        const button = $('#wspThreadHead button[data-act="agent-back"]').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'agentBack', id: id } });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.page.fail(data, 'No se devolvió la conversación al agente');

        alert({ icon: 'success', title: data.message, timer: 1600 });

        await this.lsChats(true);
        if (id === this.current) this.openChat(id, { quiet: true });
    }

    // La caja de abajo (propuesta + respuesta). Conserva lo escrito en las dos y el foco.
    paintFoot() {
        if (!this.chat) return;

        const box   = document.getElementById('wspThreadBody');
        const near  = box ? box.scrollHeight - box.scrollTop - box.clientHeight < 80 : false;
        const draft = String($('#wspReply').val() || '');
        const focus = document.activeElement ? document.activeElement.id : '';

        $('#wspThreadFoot').html(this.foot(this.chat));

        const reply = document.getElementById('wspReply');
        const area  = document.getElementById('wspPropText');

        if (draft && reply) {
            reply.value = draft;
            this.grow(reply);
        }

        if (area) {
            const p = this.proposal;

            if (this.propDraft && p && this.propDraft.id === p.id) area.value = this.propDraft.text;
            this.grow(area, 160);
        }

        const back = focus === 'wspReply' ? reply : focus === 'wspPropText' ? area : null;

        if (back) {
            back.focus();
            back.setSelectionRange(back.value.length, back.value.length);
        }

        this.page.icons();

        if (box && near) box.scrollTop = box.scrollHeight;

        this.watchProposal();
    }

    // Separador por día y burbujas; la cola solo en el primero de una racha del mismo lado.
    thread() {
        if (!this.messages.length) return '<div class="wsp-pane-empty"><p>Sin mensajes.</p></div>';

        let html    = '';
        let lastDay = '';
        let lastDir = '';

        this.messages.forEach((m) => {
            if (m.date !== lastDay) {
                html   += `<div class="wsp-day"><span>${esc(this.dayLabel(m.date))}</span></div>`;
                lastDay = m.date;
                lastDir = '';
            }

            html   += this.message(m, m.dir !== lastDir);
            lastDir = m.dir;
        });

        return html;
    }

    message(m, tail) {
        const out  = m.dir === 'out';
        const icon = WSP_MEDIA[m.type];
        let head   = '';

        if (icon) head = `<span class="wsp-media"><i data-lucide="${icon}"></i>${esc(m.label)}</span>`;
        else if (m.type !== 'text' && !String(m.body || '').trim()) head = '<span class="wsp-media"><i data-lucide="circle-help"></i>Mensaje que Huubie no puede mostrar</span>';

        // El agente la guardó como comprobante: se revisa en Clientes › Comprobantes.
        if (m.receipt) head += `<span class="wsp-media"><i data-lucide="receipt"></i>Comprobante ${esc(m.receipt)}</span>`;

        const bubble = wspMsg(m.body, m.hour, {
            dir:  m.dir,
            tail: tail,
            who:  out ? m.user : '',
            head: head,
            meta: out ? this.tick(m.status) : ''
        });

        return out && m.status === 'failed'
            ? bubble + `<p class="wsp-fail">No salió${m.error ? ': ' + esc(m.error) : ''}</p>`
            : bubble;
    }

    // La caja de respuesta, o por qué no hay.
    foot(c) {
        const lock = (icon, text) => `<div class="wsp-foot"><p class="wsp-lock"><i data-lucide="${icon}"></i><span>${esc(text)}</span></p></div>`;
        const max  = Number(dataInit.replyMax) || 4096;

        if (!this.page.allow('update')) return lock('eye', 'Tu rol puede leer las conversaciones, pero no contestarlas.');

        if (!c.window) return this.closedFoot(c);

        // BAJA apaga recordatorios y plantillas; lo que escribe el cliente se le sigue contestando.
        const baja = c.opt_out ? `Escribió BAJA${c.opt_out_at ? ` el ${c.opt_out_at}` : ''}: no recibe recordatorios ni plantillas. Lo que escriba sí se le contesta.` : '';
        const hint = baja || (this.conn.simulated || c.sim
            ? 'Modo simulado: la respuesta queda en la conversación y no sale a la red.'
            : 'Enter manda · Shift + Enter, renglón nuevo.');
        const note = this.note && this.note.id === c.id && this.note.count === this.messages.length ? this.note.text : '';
        const ask  = this.canPropose() && !this.proposal && !this.asking.has(c.id)
            ? this.propButton('propose', 'sparkles', 'Proponer', 'Pedirle al agente una propuesta de respuesta')
            : '';

        return '<div class="wsp-foot">'
             +   this.proposalCard(c)
             +   '<form class="wsp-composer" novalidate>'
             +     `<textarea id="wspReply" rows="1" maxlength="${max}" placeholder="Escribe un mensaje" aria-label="Respuesta para ${esc(c.name)}"></textarea>`
             +     '<button type="submit" class="wsp-send" aria-label="Mandar la respuesta"><i data-lucide="send-horizontal"></i></button>'
             +   '</form>'
             +   `<div class="wsp-foot-row"><p class="wsp-foot-hint">${esc(note || hint)}</p>${ask}</div>`
             + '</div>';
    }

    /*  Ventana de 24 h cerrada: solo se puede mandar una plantilla aprobada. Si el
        cliente se quedó esperando respuesta, «Ya abrimos» la retoma (c.reopen:
        'ok' se puede · 'closed' fuera de horario · 'baja' · 'agent' sin número · '' no aplica). */
    closedFoot(c) {
        const base = 'Pasaron más de 24 h desde el último mensaje del cliente'
            + (c.closes ? ` (la ventana cerró el ${c.closes})` : '')
            + '. WhatsApp solo deja mandarle una plantilla aprobada.';
        const why  = {
            ok:     'El cliente se quedó esperando respuesta: mándale «Ya abrimos» para retomar la conversación.',
            closed: 'El cliente se quedó esperando: «Ya abrimos» sale en el horario del agente.',
            baja:   'Escribió BAJA: no se le mandan plantillas hasta que vuelva a escribir.',
            agent:  'La empresa no tiene número de WhatsApp dado de alta.'
        }[c.reopen] || 'Cuando el cliente vuelva a escribir, se abre otra vez.';
        const send = c.reopen === 'ok'
            ? '<button type="button" class="wsp-btn wsp-prop-send" data-act="reopen" aria-label="Mandar al cliente la plantilla «Ya abrimos»"><i data-lucide="send-horizontal"></i><span>Mandar «Ya abrimos»</span></button>'
            : '';

        return '<div class="wsp-foot">'
             +   `<div class="wsp-lock"><i data-lucide="lock"></i><span class="wsp-lock-text">${esc(base + ' ' + why)}</span>${send}</div>`
             + '</div>';
    }

    async sendReopen() {
        if (this.sending || !this.chat) return;

        this.sending = true;

        const id     = this.chat.id;
        const button = $('#wspThreadFoot button[data-act="reopen"]').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'sendReopen', id: id } });

        this.sending = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) {
            this.page.fail(data, 'No salió «Ya abrimos»');
            if (data && [404, 409].includes(Number(data.status)) && id === this.current) this.openChat(id, { quiet: true, bottom: true });
            return;
        }

        alert({ icon: data.sent === 'simulated' ? 'info' : 'success', title: data.message, timer: 2400 });

        if (id === this.current) await this.openChat(id, { quiet: true, bottom: true });

        this.lsChats(true);
    }

    // -- Propuesta del agente --

    // Con llave del servicio de IA y el agente en horario (fuera de horario no propone).
    canPropose() {
        return this.ai && Boolean(this.agent && this.agent.open) && this.page.allow('update');
    }

    /*  La tarjeta arriba de la caja de respuesta. Mientras una propuesta pedida
        desde aquí va en camino y el servidor todavía no la tiene, sale «leyendo». */
    proposalCard(c) {
        const p = this.proposal;

        if (this.asking.has(c.id) && !this.dropped.has(c.id) && (!p || p.status !== 'working')) {
            return this.propBox('', this.propWait('El agente está leyendo la conversación…'), '');
        }

        if (!p) return '';

        // El tema (F6) dice por qué no salió sola: solo horario y catálogo pueden.
        const meta  = [p.auto ? 'Automática' : 'Pedida a mano', p.topic, p.when, p.model, p.seconds !== null && p.seconds !== undefined ? `${p.seconds} s` : ''].filter(Boolean).join(' · ');
        const again = this.canPropose()
            ? this.propButton('propose', 'refresh-cw', p.status === 'pending' ? 'Otra' : 'Proponer de nuevo', 'Pedirle al agente otra propuesta')
            : '';
        const drop  = this.propButton('prop-discard', 'x', 'Descartar', 'Descartar la propuesta del agente');

        if (p.status === 'working') {
            return this.propBox(meta, this.propWait('El agente está armando la respuesta con los datos del negocio…'), drop);
        }

        if (p.status === 'failed') {
            return this.propBox(meta, `<p class="wsp-note is-bad">No se armó: ${esc(p.error || 'el agente no devolvió respuesta.')}</p>`, again + drop);
        }

        const max   = Number(dataInit.replyMax) || 4096;
        const order = p.action === 'order' && p.draft;
        const extra = order
            ? this.propDraftBox(p.draft)
            : p.action === 'handoff' ? `<p class="wsp-note">El agente pasó este chat a una persona${p.handoff ? `: ${esc(p.handoff)}` : '.'}</p>` : '';
        const body  = (p.outdated ? '<p class="wsp-note">El cliente escribió después de que se armó: revísala o pide otra.</p>' : '')
            + extra
            + `<textarea id="wspPropText" rows="2" maxlength="${max}" aria-label="Propuesta del agente para ${esc(c.name)}. Puedes cambiarla antes de mandarla">${esc(p.body)}</textarea>`
            + this.propTools(p.tools || []);
        const send  = order
            ? this.propButton('prop-send', 'send-horizontal', 'Mandar y crear pedido', 'Mandar la propuesta al cliente y crear el pedido (Ctrl + Enter)', ' wsp-prop-send')
            : this.propButton('prop-send', 'send-horizontal', 'Mandar', 'Mandar la propuesta al cliente (Ctrl + Enter)', ' wsp-prop-send');
        const hint  = order ? 'El pedido se crea al mandarla.' : 'Nada sale hasta que la mandes.';

        return this.propBox(meta, body, send + again + drop + `<span class="wsp-prop-hint">${hint}</span>`);
    }

    // El pedido que se crea al mandar la propuesta (el borrador que armó el agente).
    propDraftBox(d) {
        const lines = (d.lines || []).map((l) => `<li><span>${Number(l.quantity) || 0} × ${esc(l.name)}</span><span>${esc(this.money(l.amount))}</span></li>`).join('');
        const facts = [
            d.delivery + (d.address ? `: ${d.address}` : ''),
            d.when,
            d.payment,
            d.name ? `A nombre de ${d.name}` : '',
            d.note ? `Nota: ${d.note}` : ''
        ].filter(Boolean).join(' · ');

        return '<div class="wsp-prop-draft">'
             +   '<p class="wsp-prop-draft-title"><i data-lucide="shopping-cart"></i>Al mandarla se crea este pedido en Tienda en línea › Nuevos</p>'
             +   `<ul>${lines}<li class="is-total"><span>Total</span><span>${esc(this.money(d.total))}</span></li></ul>`
             +   `<p>${esc(facts)}</p>`
             +   '<p>En el texto, {folio} se cambia por el folio del pedido.</p>'
             + '</div>';
    }

    // Solo el cuerpo se desplaza: el título y los botones quedan siempre a la vista.
    propBox(meta, body, actions) {
        return '<section class="wsp-prop" aria-label="Propuesta del agente">'
             +   '<div class="wsp-prop-head">'
             +     '<span class="wsp-prop-title"><i data-lucide="sparkles"></i>Propuesta del agente</span>'
             +     (meta ? `<span class="wsp-prop-meta">${esc(meta)}</span>` : '')
             +   '</div>'
             +   `<div class="wsp-prop-body">${body}</div>`
             +   (actions ? `<div class="wsp-prop-actions">${actions}</div>` : '')
             + '</section>';
    }

    propWait(text) {
        return `<p class="wsp-prop-wait" role="status"><span class="wsp-prop-dot" aria-hidden="true"></span><span>${esc(text)}</span></p>`;
    }

    propButton(act, icon, text, label, cls = '') {
        return `<button type="button" class="wsp-btn${cls}" data-act="${act}" aria-label="${esc(label)}"><i data-lucide="${icon}"></i><span>${esc(text)}</span></button>`;
    }

    // Las herramientas que usó (marcas) y lo que leyó de cada una (desplegable).
    propTools(tools) {
        if (!tools.length) return '<p class="wsp-prop-meta">Contestó sin consultar datos del negocio.</p>';

        const name  = (t) => {
            const a = t.args || {};
            const v = a.texto || a.folio || a.productos || (a.monto ? `$${a.monto}` : '');

            return t.label + (v ? ` · «${v}»` : '');
        };
        const chips = tools.map((t) => `<span class="wsp-tag is-accent"><i data-lucide="${WSP_PROP_ICONS[t.name] || 'wrench'}"></i>${esc(name(t))}</span>`).join('');
        const read  = tools.map((t) => '<div class="wsp-prop-tool">'
            + `<p><strong>${esc(name(t))}</strong>${t.summary ? ' — ' + esc(t.summary) : ''}`
            +   `${(t.ignored || []).length ? ` · ignoró: ${esc(t.ignored.join(', '))}` : ''}</p>`
            + (t.data ? `<pre>${esc(this.pretty(t.data))}</pre>` : '')
            + '</div>').join('');

        return `<div class="wsp-tags" role="group" aria-label="Herramientas que usó">${chips}</div>`
             + `<details class="wsp-prop-data"><summary>Datos que leyó (${tools.length})</summary>${read}</details>`;
    }

    // JSON con sangría; si vino recortado (más de 2,000 caracteres) va tal cual.
    pretty(text) {
        try {
            return JSON.stringify(JSON.parse(text), null, 1);
        } catch (e) {
            return String(text);
        }
    }

    // Mientras la propuesta del chat a la vista se arma (en el cron o en otra pestaña), se vuelve a pedir.
    watchProposal() {
        clearTimeout(this.propTimer);

        const id = this.current;
        const p  = this.proposal;

        if (!id || !p || p.status !== 'working' || this.asking.has(id)) return;

        this.propTimer = setTimeout(async () => {
            if (id !== this.current) return;
            if (document.hidden) return this.watchProposal();

            const data = await useFetch({ url: this._link, data: { opc: 'getProposal', id: id } });

            if (id !== this.current || this.asking.has(id)) return;
            if (!data || data.status != 200) return this.watchProposal();

            const before = JSON.stringify(this.proposal);

            this.proposal = data.proposal || null;

            if (JSON.stringify(this.proposal) !== before) {
                this.paintFoot();
                this.lsChats(true);
            } else {
                this.watchProposal();
            }
        }, WSP_PROP_POLL);
    }

    // Lo que no vale una alerta: por qué no hubo propuesta automática, en la caja de abajo.
    noteFor(id, data) {
        const text = data.reason === 'branch'
            ? 'El agente propone cuando el chat tiene sucursal: el cliente la elige del menú o asígnala tú.'
            : String(data.message || '');

        // count: con un mensaje nuevo en el hilo la nota ya no aplica.
        this.note = text ? { id: id, text: text, count: this.messages.length } : null;
    }

    // Después de «Simular cliente»: la propuesta automática, como la armaría el cron.
    async autoPropose(id) {
        if (!id || this.asking.has(id)) return;

        this.asking.add(id);
        this.dropped.delete(id);
        if (id === this.current) this.paintFoot();

        const data = await useFetch({ url: this._link, data: { opc: 'agentAuto', id: id } });

        this.asking.delete(id);
        this.afterPropose(id, data, true);
    }

    // «Proponer», «Otra» y «Proponer de nuevo».
    async proposeNow() {
        const id = this.current;

        if (!id || !this.chat || this.asking.has(id) || this.deciding) return;

        this.asking.add(id);
        this.dropped.delete(id);
        this.note      = null;
        this.propDraft = null;
        this.paintFoot();

        const data = await useFetch({ url: this._link, data: { opc: 'proposeNow', id: id } });

        this.asking.delete(id);
        this.afterPropose(id, data, false);
    }

    async afterPropose(id, data, auto) {
        const dropped = this.dropped.delete(id);

        if (!data || data.status != 200) {
            if (!auto && !dropped && id === this.current) this.page.fail(data, 'El agente no armó la propuesta');
            if (id === this.current) await this.openChat(id, { quiet: true });
            return;
        }

        // Salió sola (tema en automático o pregunta del dueño, F6): el mensaje ya está en el hilo.
        if (data.state === 'sent') {
            if (id === this.current) {
                this.proposal = null;
                await this.openChat(id, { quiet: true, bottom: true });
                this.note = { id: id, text: data.message || 'Salió sola.', count: this.messages.length };
                this.paintFoot();
            }

            this.lsChats(true);
            return;
        }

        if (id === this.current) {
            this.proposal = data.proposal || null;

            if (data.state === 'skip' || data.state === 'off') {
                if (!WSP_PROP_QUIET.includes(data.reason)) this.noteFor(id, data);
            } else {
                this.note = null;
            }

            this.paintFoot();
        }

        this.lsChats(true);
    }

    async sendProposal() {
        const p = this.proposal;

        if (this.deciding || this.sending || !p || p.status !== 'pending' || !this.chat) return;

        const area = $('#wspPropText');
        const text = String(area.val() || '').replace(/\r/g, '').trim();
        const max  = Number(dataInit.replyMax) || 4096;

        if (!text) return this.page.warn('La propuesta quedó vacía: escribe la respuesta o descártala.');
        if (text.length > max) return this.page.warn(`El mensaje admite hasta ${max.toLocaleString('es-MX')} caracteres.`);

        this.deciding = true;

        const id      = this.chat.id;
        const buttons = $('#wspThreadFoot .wsp-prop button').prop('disabled', true);
        const data    = await useFetch({ url: this._link, data: { opc: 'sendProposal', id: p.id, text: text } });

        this.deciding = false;
        buttons.prop('disabled', false);

        // Un 409 de Meta deja el mensaje guardado como «No salió»; otro 409 es que alguien ya la decidió.
        if (!data || data.status != 200) {
            this.page.fail(data, 'No salió la propuesta');

            if (data && [404, 409].includes(Number(data.status)) && id === this.current) {
                this.propDraft = null;
                this.openChat(id, { quiet: true, bottom: true });
            }

            return;
        }

        this.propDraft = null;
        this.note      = null;

        // Con pedido: se avisa el folio y dónde quedó.
        if (data.folio) alert({ icon: 'success', title: `Pedido ${data.folio} creado`, text: data.message, timer: 3200 });

        if (id === this.current) await this.openChat(id, { quiet: true, bottom: true });

        this.lsChats(true);
    }

    async discardProposal() {
        const p = this.proposal;

        if (this.deciding || !p || !this.chat) return;

        this.deciding = true;

        const id      = this.chat.id;
        const buttons = $('#wspThreadFoot .wsp-prop button').prop('disabled', true);
        const data    = await useFetch({ url: this._link, data: { opc: 'discardProposal', id: p.id } });

        this.deciding = false;
        buttons.prop('disabled', false);

        if (!data || data.status != 200) {
            this.page.fail(data, 'No se descartó la propuesta');
            if (data && [404, 409].includes(Number(data.status)) && id === this.current) this.openChat(id, { quiet: true });
            return;
        }

        // La que esta pantalla pidió sigue en camino: al volver no se avisa nada.
        if (this.asking.has(id)) this.dropped.add(id);

        this.propDraft = null;

        if (id === this.current) {
            this.proposal = null;
            this.paintFoot();
            $('#wspReply').trigger('focus');
        }

        this.lsChats(true);
    }

    async sendReply() {
        if (this.sending || !this.chat) return;

        const area = $('#wspReply');
        const text = String(area.val() || '').replace(/\r/g, '').trim();
        const max  = Number(dataInit.replyMax) || 4096;

        if (!text) return area.trigger('focus');
        if (text.length > max) return this.page.warn(`El mensaje admite hasta ${max.toLocaleString('es-MX')} caracteres.`);

        this.sending = true;

        const id     = this.chat.id;
        const button = $('#wspThreadFoot button.wsp-send').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'sendReply', id: id, text: text } });

        this.sending = false;
        button.prop('disabled', false);

        // Un 409 de Meta también deja el mensaje guardado como «No salió»: se repinta el hilo.
        if (!data || data.status != 200) {
            this.page.fail(data, 'No salió el mensaje');

            if (data && data.message_id) area.val('');
            if (data && Number(data.status) === 409) this.openChat(id, { quiet: true, bottom: true });

            return;
        }

        if (id === this.current) {
            $('#wspReply').val('');
            await this.openChat(id, { quiet: true, bottom: true });
            $('#wspReply').trigger('focus');
        }

        this.lsChats(true);
    }

    // -- Sucursal --

    formBranch() {
        const c = this.chat;

        if (!c || this.saving) return;

        this.csModal({
            id:         'modalWspBranch',
            title:      'Sucursal de la conversación',
            subtitle:   c.name,
            lucideIcon: 'store',
            width:      'max-w-md',
            saveText:   'Guardar',
            cancelText: 'Cancelar',
            json: [
                { id: 'wb_branch', lbl: 'Sucursal', tipo: 'select', data: dataInit.branches || [], empty: 'Sin sucursal', value: c.branch_id === null ? '' : c.branch_id, help: 'La que atiende a este cliente. Con sucursal ya no le sale el menú de sucursales.', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveBranch(c.id, values, close)
        });

        this.page.icons();
    }

    async saveBranch(id, values, close) {
        if (this.saving) return;

        this.saving = true;

        const button = $('#modalWspBranch .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'setChatBranch', id: id, branch_id: values.wb_branch || '' } });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.page.fail(data, 'No se asignó la sucursal');

        close();
        alert({ icon: 'success', title: data.message, timer: 1400 });

        await this.lsChats(true);
        if (id === this.current) this.openChat(id, { quiet: true });
    }

    // -- Simulador --

    // asClient = desde el chat abierto: escribe como ese mismo cliente.
    formSimulate(asClient) {
        if (this.saving || !this.conn.simulated) return;

        const c     = asClient && this.chat && this.chat.sim ? this.chat : null;
        const phone = c ? String(c.phone).replace(/\D/g, '') : this.sim.phone;
        const name  = c ? (c.name !== c.phone ? c.name : '') : this.sim.name;
        const a     = this.agent || {};
        const note  = !a.exists || !a.open
            ? 'El agente está fuera de horario o apagado: el mensaje se guarda y no sale nada automático.'
            : 'El agente está en horario: si el chat no tiene sucursal, le sale el menú de sucursales (simulado).';

        this.csModal({
            id:         'modalWspSim',
            title:      'Simular cliente',
            subtitle:   'Escribe como si fueras el cliente. Nada sale a la red.',
            lucideIcon: 'flask-conical',
            width:      'max-w-xl',
            saveText:   'Mandar como cliente',
            cancelText: 'Cancelar',
            json: [
                { id: 'ws_phone', lbl: 'Teléfono del cliente', maxlength: 14, ph: '962 123 4567', icon: 'phone', value: this.page.phone(phone), help: '10 dígitos. El chat queda marcado «Simulado».', class: 'w-full sm:w-1/2' },
                { id: 'ws_name', lbl: 'Nombre (como en su WhatsApp)', maxlength: 120, ph: 'Ej. Laura Gómez', value: name, class: 'w-full sm:w-1/2' },
                { id: 'ws_text', lbl: 'Lo que escribe el cliente', tipo: 'textarea', rows: 4, maxlength: Number(dataInit.replyMax) || 4096, ph: 'Hola, ¿tienen pastel de chocolate para mañana?', class: 'w-full' },
                { id: 'ws_file', tipo: 'html', class: 'w-full', html: '<label class="wsp-file" for="wsFile"><span>Foto o PDF que manda el cliente (opcional; sirve para probar un comprobante de pago, hasta 5 MB)</span>'
                    + '<input type="file" id="wsFile" accept="image/jpeg,image/png,image/webp,application/pdf"></label>' },
                { id: 'ws_note', tipo: 'html', class: 'w-full', html: `<p class="wsp-note">${esc(note)}</p>` }
            ],
            onSave: (values, close) => this.simulate(values, close)
        });

        this.page.icons();
        $(c ? '#ws_text' : '#ws_phone').trigger('focus');
    }

    async simulate(values, close) {
        if (this.saving) return;

        const phone = String(values.ws_phone || '').replace(/\D/g, '');
        const name  = String(values.ws_name || '').replace(/\s+/g, ' ').trim();
        const text  = String(values.ws_text || '').replace(/\r/g, '').trim();
        const input = document.getElementById('wsFile');
        const file  = input && input.files && input.files[0] ? input.files[0] : null;

        if (phone.length !== 10) return this.page.warn('El teléfono del cliente va a 10 dígitos, sin lada de país.');
        if (!text && !file) return this.page.warn('Escribe lo que manda el cliente, o adjunta una foto.');
        if (file && file.size > WSP_FILE_MAX) return this.page.warn('El archivo pesa más de 5 MB: adjunta uno más ligero.');

        this.saving = true;

        const button  = $('#modalWspSim .cs-modal-save').prop('disabled', true);
        const payload = { opc: 'simulate', phone: phone, name: name, text: text };
        const data    = file ? await this.postFile(payload, file) : await useFetch({ url: this._link, data: payload });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.page.fail(data, 'No se simuló el mensaje');

        this.sim = { phone: phone, name: name };
        close();

        alert({ icon: 'success', title: 'Mensaje simulado', text: data.message, timer: 2600 });

        if (typeof data.open === 'boolean') this.agent.open = data.open;

        const chatId = Number(data.chat_id);

        await this.lsChats(true);
        await this.openChat(chatId, { bottom: true });

        // En producción esto lo hace el cron; fuera de horario no se pide nada.
        if (data.open) this.autoPropose(chatId);
    }

    // useFetch manda todo como texto: con un archivo, la petición va como formulario.
    async postFile(data, file) {
        const form = new FormData();

        Object.keys(data).forEach((key) => form.append(key, data[key]));
        form.append('file', file);

        try {
            const response = await fetch(this._link, { method: 'POST', body: form });

            return await response.json();
        } catch (e) {
            return null;
        }
    }

    // -- Agente --

    layoutAgent() {
        this.createLayout({
            parent: 'container-wsAgent',
            design: false,
            data: {
                id:    'agentWsp',
                class: 'wsp-agent',
                container: [
                    { type: 'div', id: 'wspAgentInfo', class: 'w-full' },
                    { type: 'div', id: 'formWspAgent', class: 'wsp-agent-form' }
                ]
            }
        });

        // Catálogo + «Elegir productos» llenan su renglón (5 + 4 de 12): los días empiezan en el siguiente.
        const data = [
            { opc: 'checkbox', id: 'enabled', text: 'Agente encendido', class: 'col-12' },
            {
                opc:      'select',
                id:       'catalog',
                lbl:      'Catálogo del agente',
                required: false,
                class:    'col-12 col-sm-6 col-md-5',
                data:     [{ id: 'store', valor: 'Tienda en línea' }, { id: 'own', valor: 'Lista propia' }],
                onchange: 'wap.inbox.paintCatalog()'
            },
            { opc: 'button', id: 'btnWspPick', class: 'col-12 col-sm-6 col-md-4', text: 'Elegir productos', icon: 'icon-th-list', color_btn: 'outline', onClick: () => this.formProducts() }
        ];

        // F6: los temas que salen sin pasar por la bandeja (apagados de fábrica).
        WSP_AUTO.forEach((t) => data.push({ opc: 'checkbox', id: t.id, text: t.text, class: 'col-12 col-sm-6' }));

        WSP_WEEK.forEach((day, i) => {
            data.push(
                { opc: 'checkbox', id: `d${day}`, text: WSP_DAYS[day], class: `col-12 col-sm-4 self-end ${i ? '' : 'sm:pb-[10px]'}` },
                { opc: 'input', type: 'time', id: `f${day}`, lbl: 'Abre', showLabel: i === 0, required: false, class: 'col-6 col-sm-4' },
                { opc: 'input', type: 'time', id: `t${day}`, lbl: 'Cierra', showLabel: i === 0, required: false, class: 'col-6 col-sm-4' }
            );
        });

        if (this.page.allow('create')) {
            data.push({ opc: 'button', id: 'btnWspAgentSave', class: 'col-12 col-sm-6 col-md-4', text: 'Guardar agente', icon: 'icon-floppy', color_btn: 'primary', onClick: () => this.saveAgent() });
        }

        this.createfilterBar({
            parent:     'formWspAgent',
            id:         'fbWspAgent',
            prefijo:    'wsa_',
            coffeesoft: true,
            data:       data
        });

        WSP_WEEK.forEach((day) => {
            $(`#wsa_f${day}`).attr('aria-label', `${WSP_DAYS[day]}: abre a las`);
            $(`#wsa_t${day}`).attr('aria-label', `${WSP_DAYS[day]}: cierra a las (00:00 = medianoche)`);
        });

        $('#wsa_catalog').attr('aria-label', 'De dónde sale el catálogo del agente');
        WSP_AUTO.forEach((t) => $(`#wsa_${t.id}`).attr('aria-label', `${t.text}, sin que una persona las revise`));
        $('#wsa_btnWspPick').attr('aria-label', 'Elegir los productos de la lista propia del agente');

        // Día apagado = sin horas; al encenderlo se proponen 09:00 a 20:00.
        $('#fbWspAgent').on('change', 'input[type="checkbox"][id^="wsa_d"]', (e) => {
            const day = String(e.currentTarget.id).replace('wsa_d', '');
            const on  = e.currentTarget.checked;

            if (on && !$(`#wsa_f${day}`).val()) $(`#wsa_f${day}`).val('09:00');
            if (on && !$(`#wsa_t${day}`).val()) $(`#wsa_t${day}`).val('20:00');

            this.toggleDay(day, on);
        });

        this.paintAgent();
    }

    async getAgent() {
        const data = await useFetch({ url: this._link, data: { opc: 'getAgent' } });

        if (!data || data.status != 200) return this.page.fail(data, 'No se pudo cargar el agente');

        this.agent = data.agent || {};
        this.conn  = data.conn || this.conn;
        this.keepOwnCount(data.agent);

        this.paintAgent();
        this.paintChatsNote();
    }

    // La lista de chats trae el agente sin ese conteo: se guarda aparte para no perderlo.
    keepOwnCount(agent) {
        if (agent && typeof agent.own_count === 'number') this.ownCount = agent.own_count;
    }

    // Las cajas y las notas de arriba, y el formulario con lo guardado.
    paintAgent() {
        const a = this.agent || {};

        this.paintAgentInfo();

        $('#wsa_enabled').prop('checked', Number(a.enabled) === 1);
        $('#wsa_catalog').val(a.catalog_mode === 'own' ? 'own' : 'store');
        WSP_AUTO.forEach((t) => $(`#wsa_${t.id}`).prop('checked', (a.auto_topics || []).includes(t.key)));

        WSP_WEEK.forEach((day) => {
            const range = ((a.hours || [])[day] || [])[0];
            const on    = Boolean(range);

            $(`#wsa_d${day}`).prop('checked', on);
            $(`#wsa_f${day}`).val(on ? range[0] : '');
            $(`#wsa_t${day}`).val(on ? (range[1] === '24:00' ? '00:00' : range[1]) : '');

            this.toggleDay(day, on);
        });

        // Sin permiso de cambiarlo, o sin número dado de alta: se ve y no se toca.
        if (!this.page.allow('create') || !a.exists) {
            $('#fbWspAgent :input').prop('disabled', true);
        }

        this.paintCatalog();
    }

    // «Elegir productos» solo aplica a la lista propia.
    paintCatalog() {
        const own = String($('#wsa_catalog').val() || 'store') === 'own';
        const can = this.page.allow('create') && Boolean(this.agent && this.agent.exists);

        $('#wsa_btnWspPick').prop('disabled', !own || !can);
    }

    // Solo lo de arriba: no toca lo que la persona esté cambiando en el formulario.
    paintAgentInfo() {
        const a    = this.agent || {};
        const c    = this.conn || {};
        const key  = (name) => `<code class="wsp-key">${esc(name)}</code>`;
        const now  = !a.exists ? ['—', ''] : !a.enabled ? ['Apagado', 'Nada sale solo.'] : a.open ? ['En horario', 'Contesta lo automático.'] : ['Fuera de horario', 'Lo que llega se guarda; nada sale solo.'];
        const meta = c.simulated
            ? ['Modo simulado', 'Sin WHATSAPP_META_TOKEN nada sale a la red.']
            : c.ready ? ['Meta configurado', ''] : [`Faltan ${(c.missing || []).length}`, (c.missing || []).map(key).join(' ')];

        let html = '<div class="wsp-agent">'
            + '<div class="wsp-box-grid">'
            +   this.page.box('Número del agente', a.exists ? esc(a.phone || 'Sin número visible') : 'Sin alta', a.exists ? '' : 'Lo da de alta soporte.')
            +   this.page.box('Ahora', esc(now[0]), esc(now[1]))
            +   this.page.box('Meta', esc(meta[0]), c.simulated ? esc(meta[1]) : meta[1])
            + '</div>'
            + '<p class="wsp-note">Fuera de horario los mensajes se guardan y no sale nada automático: ni el menú de sucursales. Contestar a mano se puede siempre que la ventana de 24 h esté abierta. Cierre 00:00 = medianoche.</p>';

        if (!a.exists) html += '<p class="wsp-note is-bad">La empresa todavía no tiene número de WhatsApp para el agente: el horario se guarda cuando soporte lo dé de alta.</p>';
        if ((a.hours || []).some((h) => h.length > 1)) html += '<p class="wsp-note">Algún día tiene más de un tramo: aquí se ve y se guarda solo el primero.</p>';

        if (a.exists) {
            const n   = this.ownCount;
            const own = a.catalog_mode === 'own';
            const src = own
                ? `la lista propia${n !== null ? ` (${n} producto${n === 1 ? '' : 's'})` : ''}`
                : 'los productos de la Tienda en línea (los que tienen encendido «Catálogo»)';

            html += `<p class="wsp-note">Catálogo del agente: ${esc(src)}. Con eso da precios y arma pedidos; lo que no esté ahí lo pasa a una persona. `
                  + 'Los pedidos por WhatsApp caen en Tienda en línea › Nuevos, así que la tienda de la sucursal tiene que estar encendida.</p>';

            const on = WSP_AUTO.filter((t) => (a.auto_topics || []).includes(t.key)).map((t) => t.text.replace('Salen solas: ', ''));

            html += `<p class="wsp-note">${on.length
                ? `Salen solas, sin que nadie las revise: ${esc(on.join(' y '))}. Solo cuando para contestar consultó únicamente eso y ninguna consulta falló.`
                : 'Todas las respuestas pasan por la bandeja: una persona las manda.'} Saldo, pedidos, comprobantes y lo que no consultó datos siempre pasan por una persona. `
                  + 'Al número del equipo con «Le pregunta al agente» (Destinatarios) le contesta directo. Cómo van: pestaña «Métricas».</p>';
        }

        $('#wspAgentInfo').html(html + '</div>');
    }

    toggleDay(day, on) {
        $(`#wsa_f${day}, #wsa_t${day}`).prop('disabled', !on || !this.page.allow('create') || !this.agent.exists);
    }

    async saveAgent() {
        if (this.saving || !this.page.allow('create')) return;

        const enabled = $('#wsa_enabled').is(':checked');
        const hours   = [[], [], [], [], [], [], []];

        for (const day of WSP_WEEK) {
            if (!$(`#wsa_d${day}`).is(':checked')) continue;

            const from = String($(`#wsa_f${day}`).val() || '').slice(0, 5);
            const to   = String($(`#wsa_t${day}`).val() || '').slice(0, 5);
            const name = WSP_DAYS[day].toLowerCase();

            if (!from || !to) return this.page.warn(`Pon la hora en que abre y en que cierra el ${name}.`);
            if (to !== '00:00' && to <= from) return this.page.warn(`El ${name} cierra antes de abrir. Para cerrar a medianoche, pon 00:00.`);

            hours[day] = [[from, to]];
        }

        if (enabled && !hours.some((h) => h.length)) return this.page.warn('Marca al menos un día con horario, o deja el agente apagado.');

        // Encender un tema que sale solo pide confirmar: esas respuestas le llegan al cliente sin que nadie las vea antes.
        const added = WSP_AUTO.filter((t) => $(`#wsa_${t.id}`).is(':checked') && !(this.agent.auto_topics || []).includes(t.key));

        if (added.length) {
            const what = added.map((t) => t.text.replace('Salen solas: ', '')).join(' y ');
            const r    = await alert({
                icon:     'question',
                title:    '¿Que estas respuestas salgan solas?',
                text:     `Las de ${what} le llegan al cliente sin que una persona las revise. Saldo, pedidos y comprobantes siguen pasando por la bandeja.`
                          + (this.conn.simulated ? ' Modo simulado: no salen a la red.' : ''),
                btn1:     true,
                btn1Text: 'Sí, que salgan solas',
                btn2:     true,
                btn2Text: 'Cancelar'
            });

            if (!r || !r.isConfirmed) return;
        }

        this.saving = true;

        const button = $('#wsa_btnWspAgentSave').prop('disabled', true);
        const mode   = String($('#wsa_catalog').val() || 'store') === 'own' ? 'own' : 'store';
        const topics = WSP_AUTO.filter((t) => $(`#wsa_${t.id}`).is(':checked')).map((t) => t.key).join(',');
        const data   = await useFetch({ url: this._link, data: { opc: 'saveAgent', enabled: enabled ? '1' : '0', hours: JSON.stringify(hours), catalog_mode: mode, auto_topics: topics } });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.page.fail(data, 'No se guardó el agente');

        this.agent = data.agent || this.agent;
        this.keepOwnCount(data.agent);

        this.paintAgent();
        this.paintChatsNote();

        alert({ icon: 'success', title: data.message, timer: 1800 });
    }

    // -- Lista propia del agente --

    // Los productos de toda la empresa, por categoría, con los ya elegidos marcados. Se guarda aparte del horario.
    async formProducts() {
        if (this.saving || this.picking || !this.page.allow('create')) return;

        this.picking = true;

        const data = await useFetch({ url: this._link, data: { opc: 'lsAgentProducts' } });

        this.picking = false;

        if (!data || data.status != 200) return this.page.fail(data, 'No se pudieron cargar los productos');

        const rows = data.row || [];

        if (!rows.length) return this.page.warn('La empresa todavía no tiene productos en el catálogo.');

        let list = '';
        let cat  = null;

        rows.forEach((p) => {
            if (p.category !== cat) {
                cat   = p.category;
                list += `<p class="wsp-pick-cat">${esc(cat)}</p>`;
            }

            const sub = [p.branch, p.store ? 'Sale en la tienda en línea' : ''].filter(Boolean).join(' · ');

            list += `<label class="wsp-pick" data-text="${esc(this.fold(`${p.name} ${p.category} ${p.branch}`))}">`
                  +   `<input type="checkbox" value="${Number(p.id)}"${p.picked ? ' checked' : ''}>`
                  +   `<span class="wsp-pick-name">${esc(p.name)}${sub ? `<span class="wsp-pick-sub">${esc(sub)}</span>` : ''}</span>`
                  +   `<span class="wsp-pick-price">${esc(this.money(p.price))}</span>`
                  + '</label>';
        });

        this.csModal({
            id:         'modalWspPick',
            title:      'Lista propia del agente',
            subtitle:   'Los productos que el agente puede ofrecer y pedir por WhatsApp.',
            lucideIcon: 'list-checks',
            width:      'max-w-2xl',
            saveText:   'Guardar lista',
            cancelText: 'Cancelar',
            json: [
                {
                    id:    'wp_list',
                    tipo:  'html',
                    class: 'w-full',
                    html:  '<div class="wsp-pick-bar">'
                         +   '<input type="search" id="wspPickSearch" maxlength="60" autocomplete="off" placeholder="Buscar producto" aria-label="Buscar producto en la lista">'
                         +   '<span class="wsp-pick-count" id="wspPickCount" aria-live="polite"></span>'
                         + '</div>'
                         + `<div class="wsp-pick-list" id="wspPickList" role="group" aria-label="Productos de la empresa">${list}</div>`
                }
            ],
            onSave: (values, close) => this.saveProducts(close)
        });

        const count = () => {
            const n = $('#wspPickList input:checked').length;

            $('#wspPickCount').text(n === 1 ? '1 elegido' : `${n} elegidos`);
        };

        $('#wspPickList').on('change', 'input', count);

        // El buscador esconde lo que no coincide, y la categoría que se queda sin productos.
        $('#wspPickSearch').on('input', (e) => {
            const q = this.fold(e.currentTarget.value);

            $('#wspPickList label.wsp-pick').each((i, el) => {
                el.hidden = Boolean(q) && !String(el.getAttribute('data-text') || '').includes(q);
            });

            $('#wspPickList .wsp-pick-cat').each((i, el) => {
                el.hidden = !$(el).nextUntil('.wsp-pick-cat').filter((j, item) => !item.hidden).length;
            });
        });

        count();
        this.page.icons();
        $('#wspPickSearch').trigger('focus');
    }

    async saveProducts(close) {
        if (this.saving) return;

        const ids = $('#wspPickList input:checked').map((i, el) => Number(el.value)).get();

        this.saving = true;

        const button = $('#modalWspPick .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'saveAgentProducts', product_ids: JSON.stringify(ids) } });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.page.fail(data, 'No se guardó la lista');

        this.keepOwnCount(data.agent);
        close();

        // La lista ya quedó; que el agente la use depende de «Guardar agente».
        const pending = String($('#wsa_catalog').val() || 'store') === 'own' && this.agent.catalog_mode !== 'own';

        this.paintAgentInfo();

        alert({ icon: 'success', title: data.message, text: pending ? 'Falta «Guardar agente» para que el agente use la lista propia.' : '', timer: pending ? 3200 : 1800 });
    }

    // -- Complements --

    tick(status) {
        const t = WSP_TICKS[status];

        return t ? `<span class="wsp-tick is-${esc(status)}" role="img" aria-label="${esc(t[1])}"><i data-lucide="${t[0]}"></i></span>` : '';
    }

    // Hoy, Ayer o dd/mm/aaaa, con la fecha del servidor.
    dayLabel(date) {
        const today = String(dataInit.today || '');
        const d     = new Date(`${today}T12:00:00`);

        d.setDate(d.getDate() - 1);

        const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        if (date === today) return 'Hoy';
        if (date === yesterday) return 'Ayer';

        const p = String(date || '').split('-');

        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(date || '');
    }

    initial(name) {
        const ch = String(name || '').trim().charAt(0);

        return ch ? ch.toUpperCase() : '?';
    }

    // $450 o $450.50.
    money(n) {
        const v = Number(n) || 0;

        return '$' + v.toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
    }

    // Para buscar: minúsculas y sin acentos.
    fold(text) {
        return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    }

    // La caja crece con el texto hasta ~6 renglones (max en px).
    grow(area, max = 140) {
        if (!area) return;

        area.style.height = 'auto';
        area.style.height = `${Math.min(area.scrollHeight + 2, max)}px`;
    }
}
