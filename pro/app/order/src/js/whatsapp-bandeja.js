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

    La lista se vuelve a pedir cada 20 s mientras la pestaña está a la vista.
    Ver es pos-whatsapp/show; contestar, simular, asignar sucursal y las
    propuestas, /update; cambiar el agente, /create. La instancia vive en
    wap.inbox. */

const WSP_DAYS  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WSP_WEEK  = [1, 2, 3, 4, 5, 6, 0];
const WSP_POLL  = 20000;
const WSP_MEDIA = { image: 'image', audio: 'mic', video: 'video', document: 'file-text', sticker: 'sticker', location: 'map-pin', contacts: 'contact', reaction: 'smile' };
const WSP_TICKS = {
    sent:      ['check', 'Enviado'],
    delivered: ['check-check', 'Entregado'],
    read:      ['check-check', 'Leído'],
    failed:    ['circle-alert', 'No salió'],
    simulated: ['flask-conical', 'Simulado: no salió a la red']
};
const WSP_PROP_POLL  = 4000;
const WSP_PROP_ICONS = { catalogo_buscar: 'book-open', negocio_datos: 'store', pedido_estado: 'package', saldo_cliente: 'wallet', portal_enlace: 'link' };
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

        .wsp-prop { display: flex; flex-direction: column; gap: 8px; max-height: min(330px, 48vh); overflow-y: auto; margin-bottom: 10px;
            padding: 10px 12px; border: 1px solid ${aLine}; border-radius: 12px; background: ${tint}; }
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
            r.branch ? `<span class="wsp-tag">${esc(r.branch)}</span>` : '<span class="wsp-tag">Sin sucursal</span>',
            r.sim ? '<span class="wsp-tag is-accent">Simulado</span>' : '',
            r.proposal === 'pending' ? '<span class="wsp-tag is-accent"><i data-lucide="sparkles"></i>Propuesta</span>' : '',
            r.proposal === 'working' ? '<span class="wsp-tag"><i data-lucide="sparkles"></i>Armando</span>' : '',
            r.window ? '' : '<span class="wsp-tag"><i data-lucide="lock"></i>24 h</span>',
            r.opt_out ? '<span class="wsp-tag is-warn">No recibe</span>' : ''
        ].join('');
        const label  = `Abrir la conversación con ${r.name}${unread ? `, ${unread} sin leer` : ''}${r.proposal === 'pending' ? ', con propuesta del agente' : ''}`;

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
        return [r.when, r.preview, r.last_dir, r.last_status, r.branch_id, r.window, r.opt_out, r.proposal].join('|');
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
            c.branch ? `<span class="wsp-tag">${esc(c.branch)}</span>` : '<span class="wsp-tag">Sin sucursal</span>',
            c.sim ? '<span class="wsp-tag is-accent">Simulado</span>' : ''
        ].join('');

        const actions = [];

        if (this.page.allow('update')) {
            actions.push('<button type="button" class="wsp-btn" data-act="branch" aria-label="Asignar la sucursal de esta conversación"><i data-lucide="store"></i><span class="wsp-th-label">Sucursal</span></button>');

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
            + '</div>');

        $('#wspThreadBody').html(this.thread());
        this.paintFoot();

        if (box && (toBottom || near)) box.scrollTop = box.scrollHeight;
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
        if (c.opt_out) return lock('ban', 'Este cliente pidió no recibir mensajes.');

        if (!c.window) {
            return lock('lock', 'Pasaron más de 24 h desde el último mensaje del cliente'
                + (c.closes ? ` (la ventana cerró el ${c.closes})` : '')
                + '. WhatsApp solo deja mandarle una plantilla aprobada; Huubie todavía no las manda. Cuando el cliente vuelva a escribir, se abre otra vez.');
        }

        const hint = this.conn.simulated || c.sim
            ? 'Modo simulado: la respuesta queda en la conversación y no sale a la red.'
            : 'Enter manda · Shift + Enter, renglón nuevo.';
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

        const meta  = [p.auto ? 'Automática' : 'Pedida a mano', p.when, p.model, p.seconds !== null && p.seconds !== undefined ? `${p.seconds} s` : ''].filter(Boolean).join(' · ');
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

        const max  = Number(dataInit.replyMax) || 4096;
        const body = (p.outdated ? '<p class="wsp-note">El cliente escribió después de que se armó: revísala o pide otra.</p>' : '')
            + `<textarea id="wspPropText" rows="2" maxlength="${max}" aria-label="Propuesta del agente para ${esc(c.name)}. Puedes cambiarla antes de mandarla">${esc(p.body)}</textarea>`
            + this.propTools(p.tools || []);
        const send = this.propButton('prop-send', 'send-horizontal', 'Mandar', 'Mandar la propuesta al cliente (Ctrl + Enter)', ' wsp-prop-send');

        return this.propBox(meta, body, send + again + drop + '<span class="wsp-prop-hint">Nada sale hasta que la mandes.</span>');
    }

    propBox(meta, body, actions) {
        return '<section class="wsp-prop" aria-label="Propuesta del agente">'
             +   '<div class="wsp-prop-head">'
             +     '<span class="wsp-prop-title"><i data-lucide="sparkles"></i>Propuesta del agente</span>'
             +     (meta ? `<span class="wsp-prop-meta">${esc(meta)}</span>` : '')
             +   '</div>'
             +   body
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
            const v = t.args ? (t.args.texto || t.args.folio || '') : '';

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

        if (phone.length !== 10) return this.page.warn('El teléfono del cliente va a 10 dígitos, sin lada de país.');
        if (!text) return this.page.warn('Escribe lo que manda el cliente.');

        this.saving = true;

        const button = $('#modalWspSim .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'simulate', phone: phone, name: name, text: text } });

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

        const data = [{ opc: 'checkbox', id: 'enabled', text: 'Agente encendido', class: 'col-12' }];

        WSP_WEEK.forEach((day, i) => {
            data.push(
                { opc: 'checkbox', id: `d${day}`, text: WSP_DAYS[day], class: `col-12 col-sm-4 self-end ${i ? '' : 'sm:pb-[10px]'}` },
                { opc: 'input', type: 'time', id: `f${day}`, lbl: 'Abre', showLabel: i === 0, required: false, class: 'col-6 col-sm-4' },
                { opc: 'input', type: 'time', id: `t${day}`, lbl: 'Cierra', showLabel: i === 0, required: false, class: 'col-6 col-sm-4' }
            );
        });

        if (this.page.allow('create')) {
            data.push({ opc: 'button', id: 'btnWspAgentSave', class: 'col-12 col-sm-6 col-md-4', text: 'Guardar horario', icon: 'icon-floppy', color_btn: 'primary', onClick: () => this.saveAgent() });
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

        this.paintAgent();
        this.paintChatsNote();
    }

    paintAgent() {
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

        $('#wspAgentInfo').html(html + '</div>');

        $('#wsa_enabled').prop('checked', Number(a.enabled) === 1);

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

        this.saving = true;

        const button = $('#wsa_btnWspAgentSave').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'saveAgent', enabled: enabled ? '1' : '0', hours: JSON.stringify(hours) } });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.page.fail(data, 'No se guardó el agente');

        this.agent = data.agent || this.agent;

        this.paintAgent();
        this.paintChatsNote();

        alert({ icon: 'success', title: data.message, timer: 1800 });
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

    // La caja crece con el texto hasta ~6 renglones (max en px).
    grow(area, max = 140) {
        if (!area) return;

        area.style.height = 'auto';
        area.style.height = `${Math.min(area.scrollHeight + 2, max)}px`;
    }
}
