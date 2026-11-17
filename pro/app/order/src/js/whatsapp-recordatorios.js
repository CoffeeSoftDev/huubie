/*  Ventas › WhatsApp › Recordatorios: quién debe en las sucursales de la
    empresa y si le toca recordatorio hoy (F5 del agente de WhatsApp).

    La lista se ve ANTES de mandar nada. Cada renglón dice por qué sale o no:
    «Sale hoy», «Esta semana ya», «BAJA», «Otra sucursal» (le llega el de su
    deuda mayor), «Mañana» (tope del día) o «Sin WhatsApp».

    El recordatorio sale como plantilla aprobada de Meta (fuera de la ventana
    de 24 h no se puede escribir libre): uno por semana por cliente, solo en
    el horario del agente. «Encender automático» deja que el cron los mande
    solo; «Mandar los de hoy» los manda ya. Las dos piden pos-whatsapp/create.
    Sin token de Meta todo es simulado: quedan en la conversación del cliente
    y no salen a la red.

    whatsapp.js la crea (wap.reminders) y la llama al entrar a la pestaña. */

// -- CSS --

function wspRemindersCSS() {
    if (document.getElementById('wsp-rem-css')) return;

    const line  = 'rgb(var(--gray-200, 231 229 228))';
    const body  = 'rgb(var(--gray-600, 87 83 78))';
    const mute  = 'rgb(var(--gray-500, 120 113 108))';
    const aFg   = 'var(--accent-soft-fg, rgb(80 48 165))';
    const brand = 'rgb(var(--brand-600, 80 48 165))';

    const css = `
        .wsp-rem-tpl { padding: 10px 12px; border: 1px solid ${line}; border-radius: 12px; background: #FFFFFF; }
        .wsp-rem-tpl summary { width: fit-content; cursor: pointer; font-size: 13px; font-weight: 600; color: ${aFg}; }
        .wsp-rem-tpl summary:focus-visible { outline: 2px solid ${brand}; outline-offset: 2px; border-radius: 4px; }
        .wsp-rem-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; margin-top: 10px; }
        @media (min-width: 900px) { .wsp-rem-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
        .wsp-rem-grid p { margin: 0 0 4px; font-size: 12.5px; color: ${body}; }
        .wsp-rem-grid pre { margin: 0 0 10px; padding: 8px 10px; border: 1px solid ${line}; border-radius: 8px; background: rgb(var(--gray-50, 250 250 249));
            font-size: 12px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; color: ${body}; }
        .wsp-rem-help { font-size: 12px !important; color: ${mute} !important; }
        #tbWspReminders thead th { text-transform: none; white-space: nowrap; }
        #tbWspReminders td { vertical-align: middle; }

        body.dark-mode .wsp-rem-tpl,
        body.dark-mode .wsp-rem-grid pre { background: var(--dk-card, #1F2A37); border-color: var(--dk-line, #374151); color: #D1D5DB; }
        body.dark-mode .wsp-rem-grid p { color: #D1D5DB; }
        body.dark-mode .wsp-rem-tpl summary { color: rgb(var(--brand-300, 196 181 253)); }
    `;

    $('<style id="wsp-rem-css">').text(css).appendTo('head');
}

// -- WhatsAppReminders --

class WhatsAppReminders extends Templates {

    // -- Initial --

    constructor(link, div_modulo, page) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'WhatsAppReminders';
        this.page    = page;
        this.data    = null;
        this.request = 0;
        this.saving  = false;
    }

    // -- Interface --

    init() {
        wspRemindersCSS();

        this.createLayout({
            parent: 'container-wsReminders',
            design: false,
            data: {
                id:    'listWspReminders',
                class: 'w-full flex flex-col gap-[14px]',
                container: [
                    { type: 'div', id: 'wspRemindersInfo', class: 'w-full flex flex-col gap-[10px]' },
                    { type: 'div', id: 'filterWspReminders', class: 'w-full' },
                    { type: 'div', id: 'tableWspReminders', class: 'w-full' }
                ]
            }
        });

        this.filterReminders();
    }

    // whatsapp.js la llama al entrar a «Recordatorios».
    show() {
        this.lsReminders();
    }

    // Los filtros van fuera de la tabla: createCoffeeTable3 la reescribe y el buscador perdería el foco.
    filterReminders() {
        const data = [
            {
                opc:         'input',
                id:          'q',
                lbl:         'Buscar',
                type:        'search',
                placeholder: 'Cliente, teléfono o sucursal',
                required:    false,
                class:       'col-12 col-md-5 col-xl-4'
            }
        ];

        if (this.page.allow('create')) {
            data.push(
                { opc: 'button', id: 'btnWspRemAuto', class: 'col-12 col-sm-6 col-md-3 col-xl-3', text: 'Encender automático', icon: 'icon-power', color_btn: 'outline', onClick: () => this.toggleReminders() },
                { opc: 'button', id: 'btnWspRemSend', class: 'col-12 col-sm-6 col-md-4 col-xl-3', text: 'Mandar los de hoy', icon: 'icon-paper-plane-1', color_btn: 'primary', onClick: () => this.sendReminders() }
            );
        }

        this.createfilterBar({
            parent:     'filterWspReminders',
            id:         'fbWspReminders',
            prefijo:    'wsm_',
            coffeesoft: true,
            data:       data
        });

        $('#wsm_q')
            .attr({ maxlength: 60, autocomplete: 'off', 'aria-label': 'Buscar cliente en los recordatorios' })
            .on('input', (e) => {
                this.page.terms.reminders = this.page.plain(e.target.value.trim());

                if ($.fn.DataTable.isDataTable('#tbWspReminders')) $('#tbWspReminders').DataTable().draw();
            });
    }

    // -- Lista --

    async lsReminders() {
        const request = ++this.request;

        $('#tableWspReminders').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsReminders' } });

        if (request !== this.request) return;

        $('#tableWspReminders').removeClass('opacity-50');

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) this.page.fail(data, 'No se pudo cargar la lista de recordatorios');

        this.data = loaded ? data : null;

        this.paintInfo();
        this.paintButtons();

        this.createCoffeeTable3({
            parent:       'tableWspReminders',
            id:           'tbWspReminders',
            theme:        'light',
            data:         loaded ? { row: data.row || [] } : { thead: [], row: [] },
            striped:      true,
            hover:        true,
            f_size:       13,
            center:       [4],
            ...ORD_TABLE,
            emptyMessage: loaded ? 'Nadie debe en las sucursales de la empresa: no hay recordatorios que mandar' : 'No se pudo cargar la lista de recordatorios',
            emptyIcon:    loaded ? 'icon-ok' : 'icon-attention'
        });

        if (loaded && (data.row || []).length) this.page.dataTable('tbWspReminders', 'reminders', 'clientes', 'Ningún cliente coincide con la búsqueda');
    }

    // Las cifras de hoy, las reglas y cómo llega la plantilla.
    paintInfo() {
        const d = this.data;

        if (!d) return $('#wspRemindersInfo').empty();

        const a     = d.agent || {};
        const c     = d.count || {};
        const tpl   = (d.template || {}).saldo || {};
        const total = ['send', 'cap', 'other', 'week', 'baja', 'phone'].reduce((n, k) => n + (Number(c[k]) || 0), 0);
        const auto  = !a.exists
            ? ['Sin número', 'Lo da de alta soporte.']
            : a.reminders
                ? ['Encendido', a.open ? 'Salen solos en el horario del agente.' : 'El agente está fuera de horario: salen al abrir.']
                : ['Apagado', 'Solo salen con «Mandar los de hoy».'];

        let html = '<div class="wsp-box-grid">'
            + this.page.box('Hoy reciben', esc(String(Number(c.send) || 0)), esc(`de ${total} que deben · hoy ya salieron ${Number(d.today) || 0} de ${Number(d.dailyCap) || 0}`))
            + this.page.box('Automático', esc(auto[0]), esc(auto[1]))
            + this.page.box('Plantilla en Meta', `<code class="wsp-key">${esc(tpl.name || '')}</code>`, esc(d.simulated ? 'Modo simulado: nada sale a la red.' : `Idioma ${tpl.lang || ''}`))
            + '</div>'
            + `<p class="wsp-note">Uno por semana por cliente, solo en el horario del agente y a lo más ${Number(d.dailyCap) || 0} al día. Si debe en dos sucursales le llega el de la deuda mayor. Quien responde BAJA ya no los recibe; con ALTA vuelve. El automático lo manda el cron cada minuto y necesita WHATSAPP_PUBLIC_URL en el .env para armar el enlace del portal.</p>`;

        if (!a.exists) html += '<p class="wsp-note is-bad">La empresa todavía no tiene número de WhatsApp para el agente: la lista se ve, pero no sale nada.</p>';
        else if (!a.open) html += '<p class="wsp-note">El agente está apagado o fuera de horario: los recordatorios esperan a que abra.</p>';

        $('#wspRemindersInfo').html(html + this.templateBlock(d.template || {}));
        this.page.icons();
    }

    // Así le llega al cliente, y el texto que debe quedar aprobado en Meta.
    templateBlock(tpl) {
        const s = tpl.saldo || {};
        const r = tpl.abrimos || {};

        return '<details class="wsp-rem-tpl">'
             +   '<summary>Cómo le llega al cliente y cómo deben estar aprobadas las plantillas en Meta</summary>'
             +   '<div class="wsp-rem-grid">'
             +     `<div>${wspBubble(s.preview || '')}</div>`
             +     '<div>'
             +       `<p><strong>${esc(s.name || '')}</strong> · ${esc(s.lang || '')} · categoría Utilidad</p><pre>${esc(s.text || '')}</pre>`
             +       `<p><strong>${esc(r.name || '')}</strong> · ${esc(r.lang || '')} · categoría Utilidad</p><pre>${esc(r.text || '')}</pre>`
             +       '<p class="wsp-rem-help">Saldo: {{1}} nombre, {{2}} negocio, {{3}} saldo, {{4}} enlace del portal. Ya abrimos: {{1}} nombre, {{2}} negocio. Si el texto cambia en Meta, hay que cambiarlo también en Huubie.</p>'
             +     '</div>'
             +   '</div>'
             + '</details>';
    }

    paintButtons() {
        const a    = (this.data && this.data.agent) || {};
        const c    = (this.data && this.data.count) || {};
        const on   = Number(a.reminders) === 1;
        const auto = $('#wsm_btnWspRemAuto');

        auto.html(`<i class="icon-power"></i> ${on ? 'Apagar automático' : 'Encender automático'} `)
            .prop('disabled', !a.exists)
            .attr('aria-label', on ? 'Apagar los recordatorios automáticos' : 'Encender los recordatorios automáticos');

        $('#wsm_btnWspRemSend')
            .prop('disabled', !a.exists || !Number(c.send))
            .attr('aria-label', 'Mandar ahora los recordatorios que salen hoy');
    }

    // -- Acciones --

    async toggleReminders() {
        if (this.saving || !this.data) return;

        const on = Number((this.data.agent || {}).reminders) !== 1;

        if (on) {
            const n = Number((this.data.count || {}).send) || 0;
            const r = await alert({
                icon:     'question',
                title:    '¿Encender los recordatorios automáticos?',
                text:     `Cada día, en el horario del agente, le llega uno a quien deba (hoy serían ${n}). Uno por semana por cliente.`
                          + (this.data.simulated ? ' Modo simulado: no salen a la red.' : ''),
                btn1:     true,
                btn1Text: 'Encender',
                btn2:     true,
                btn2Text: 'Cancelar'
            });

            if (!r || !r.isConfirmed) return;
        }

        this.saving = true;

        const button = $('#wsm_btnWspRemAuto').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'toggleReminders', on: on ? '1' : '0' } });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.page.fail(data, 'No se cambiaron los recordatorios');

        alert({ icon: 'success', title: on ? 'Automático encendido' : 'Automático apagado', text: data.message, timer: 2600 });

        this.lsReminders();
    }

    async sendReminders() {
        if (this.saving || !this.data) return;

        const n = Number((this.data.count || {}).send) || 0;

        if (!n) return this.page.warn('Hoy no le toca recordatorio a nadie.');

        const r = await alert({
            icon:     'question',
            title:    n === 1 ? '¿Mandar 1 recordatorio?' : `¿Mandar ${n} recordatorios?`,
            text:     this.data.simulated
                      ? 'Modo simulado: quedan en la conversación de cada cliente y no salen a la red.'
                      : 'Salen por WhatsApp a esos clientes, con su saldo y el enlace de su portal.',
            btn1:     true,
            btn1Text: 'Mandar',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!r || !r.isConfirmed) return;

        this.saving = true;

        const button = $('#wsm_btnWspRemSend').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'sendReminders' } });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) {
            this.page.fail(data, 'No salieron los recordatorios');
        } else {
            alert({ icon: 'success', title: 'Recordatorios', text: data.message, btn1: true, btn1Text: 'Entendido' });
        }

        this.lsReminders();
    }
}
