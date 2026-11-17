/*  Ventas › WhatsApp › Métricas: cómo va el agente (F6 del agente de WhatsApp).

    Solo lee (pos-whatsapp/show). Por periodo (hoy, 7 o 30 días):
      - Conversaciones de clientes: cuántas resolvió el agente solo, en
        cuántas intervino una persona y cuántas se quedaron sin respuesta.
        Una conversación = un chat con mensajes del cliente en un día.
      - Tiempo típico de respuesta (la mediana) del agente y de una persona.
      - Por tema: cuántas propuestas se armaron y qué pasó con ellas (salieron
        solas, se mandaron tal cual, se cambiaron, se descartaron, fallaron).
        Sirve para decidir qué tema encender en automático (pestaña «Agente»).
      - Preguntas del dueño: cuántas contestó el agente del dueño.

    whatsapp.js la crea (wap.metrics) y la llama al entrar a la pestaña. */

// -- CSS --

function wspMetricsCSS() {
    if (document.getElementById('wsp-met-css')) return;

    const css = `
        #tbWspMetrics thead th { text-transform: none; white-space: nowrap; }
        #tbWspMetrics td { vertical-align: middle; }
    `;

    $('<style id="wsp-met-css">').text(css).appendTo('head');
}

// -- WhatsAppMetrics --

class WhatsAppMetrics extends Templates {

    // -- Initial --

    constructor(link, div_modulo, page) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'WhatsAppMetrics';
        this.page    = page;
        this.data    = null;
        this.request = 0;
    }

    // -- Interface --

    init() {
        wspMetricsCSS();

        this.createLayout({
            parent: 'container-wsMetrics',
            design: false,
            data: {
                id:    'listWspMetrics',
                class: 'w-full flex flex-col gap-[14px]',
                container: [
                    { type: 'div', id: 'filterWspMetrics', class: 'w-full' },
                    { type: 'div', id: 'wspMetricsInfo', class: 'w-full flex flex-col gap-[10px]' },
                    { type: 'div', id: 'tableWspMetrics', class: 'w-full' },
                    { type: 'div', id: 'wspMetricsNote', class: 'w-full' }
                ]
            }
        });

        this.filterMetrics();
    }

    // whatsapp.js la llama al entrar a «Métricas».
    show() {
        this.lsMetrics();
    }

    filterMetrics() {
        this.createfilterBar({
            parent:     'filterWspMetrics',
            id:         'fbWspMetrics',
            prefijo:    'wst_',
            coffeesoft: true,
            data: [
                {
                    opc:      'select',
                    id:       'period',
                    lbl:      'Periodo',
                    required: false,
                    class:    'col-6 col-md-4 col-lg-3 col-xl-2',
                    data:     [{ id: '7', valor: 'Últimos 7 días' }, { id: 'today', valor: 'Hoy' }, { id: '30', valor: 'Últimos 30 días' }],
                    onchange: 'wap.metrics.lsMetrics()'
                }
            ]
        });

        $('#wst_period').attr('aria-label', 'Periodo de las métricas');
    }

    // -- Datos --

    async lsMetrics() {
        const request = ++this.request;

        $('#wspMetricsInfo, #tableWspMetrics').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsMetrics', period: String($('#wst_period').val() || '7') } });

        if (request !== this.request) return;

        $('#wspMetricsInfo, #tableWspMetrics').removeClass('opacity-50');

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) this.page.fail(data, 'No se pudieron calcular las métricas');

        this.data = loaded ? data : null;

        this.paintInfo();

        this.createCoffeeTable3({
            parent:       'tableWspMetrics',
            id:           'tbWspMetrics',
            theme:        'light',
            data:         loaded ? { row: data.row || [] } : { thead: [], row: [] },
            striped:      true,
            hover:        true,
            f_size:       13,
            center:       [2, 3, 4, 5, 6, 7, 8],
            ...ORD_TABLE,
            emptyMessage: loaded ? 'El agente todavía no arma propuestas en este periodo' : 'No se pudieron calcular las métricas',
            emptyIcon:    loaded ? 'icon-chart-bar' : 'icon-attention'
        });

        this.paintNote();
    }

    // Las cuatro cifras de arriba.
    paintInfo() {
        const d = this.data;

        if (!d) return $('#wspMetricsInfo').empty();

        const c     = d.conversations || {};
        const r     = d.response || {};
        const o     = d.owner || {};
        const total = Number(c.total) || 0;
        const pct   = c.pct_agent === null || c.pct_agent === undefined ? '—' : `${String(c.pct_agent).replace(/\.0$/, '')}%`;
        const time  = (x) => (x && x.text ? esc(x.text) : '—');
        const many  = (n, one, more) => `${n} ${n === 1 ? one : more}`;

        const html = '<div class="wsp-box-grid">'
            + this.page.box('Resueltas sin persona', esc(pct), esc(total
                ? `${Number(c.agent) || 0} de ${many(total, 'conversación', 'conversaciones')} · con persona ${Number(c.person) || 0} · sin respuesta ${Number(c.none) || 0}`
                : `Sin conversaciones del ${d.from} al ${d.to}`))
            + this.page.box('Respuesta del agente', time(r.agent), esc(r.agent && r.agent.count ? `Tiempo típico · ${r.agent.count === 1 ? '1 respuesta que salió sola' : `${r.agent.count} respuestas que salieron solas`}` : 'Ninguna salió sola'))
            + this.page.box('Respuesta de una persona', time(r.person), esc(r.person && r.person.count ? `Tiempo típico · ${many(r.person.count, 'respuesta', 'respuestas')}` : 'Sin respuestas a mano'))
            + this.page.box('Preguntas del dueño', esc(String(Number(o.answered) || 0)), esc(o.answered ? `contestadas · tarda ${o.text || '—'} en armar` : (o.failed ? `${o.failed} no se pudieron contestar` : 'Nadie del equipo ha preguntado')))
            + '</div>';

        $('#wspMetricsInfo').html(html);
    }

    // Cómo se cuenta cada cifra, en llano.
    paintNote() {
        const d = this.data;

        if (!d) return $('#wspMetricsNote').empty();

        const on = (d.auto_on || []).length
            ? 'Ahora salen solos: ' + (d.auto_on || []).map((k) => ({ negocio: 'horario, dirección y pago', catalogo: 'catálogo y precios' }[k] || k)).join(' y ') + '.'
            : 'Ahora ningún tema sale solo: todo pasa por la bandeja.';

        $('#wspMetricsNote').html(''
            + `<p class="wsp-note">Del ${esc(d.from)} al ${esc(d.to)}. Una conversación es un chat con mensajes del cliente en un día; «sin persona» = el agente contestó solo, no quedó nada del cliente sin respuesta y nadie de la sucursal escribió ni se pasó a una persona ese día. `
            + 'El tiempo típico es la mediana: la mitad se contestó más rápido. El menú de sucursales y las plantillas no cuentan como respuesta; las preguntas del dueño van aparte.</p>'
            + `<p class="wsp-note">Si un tema se manda casi siempre «Tal cual», es candidato a salir solo (pestaña «Agente»). Solo horario, dirección y pago, y catálogo pueden salir solos: saldo, pedidos y comprobantes siempre pasan por una persona. ${esc(on)}</p>`);
    }
}
