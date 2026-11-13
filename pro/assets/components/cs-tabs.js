/*
    CoffeeSoft Component: csTabs
    Pestañas con ícono, etiqueta y contador, en su propia tarjeta.
    Portado de erp-pro/pro/assets/components/cs-tabs.js (CostSys nuevo).

    Genera los contenedores container-[id] igual que tabLayout, así que las
    clases que ya consumen esos ids siguen funcionando sin cambios.

    El contador se puede actualizar después de cargar los datos:
        this.csTabCount('modules', 14);

    Una pestaña sin count nace SIN número, no con cero: mientras nadie haya
    contado sus datos no se sabe cuántos hay. La píldora vacía la esconde
    .cs-tab-count:empty.

    A diferencia del original, este trae su CSS (csTabsCSS): en erp-pro cada
    app lo copiaba a su hoja y la primera que no lo hizo sacó las pestañas
    como texto amontonado. Usa los tokens del tema de pro (--brand-*,
    --primary-rgb) y las superficies de la página oscura (--dk-*).

    Uso básico:
    this.csTabs({
        parent: 'devTabs',
        json: [
            { id: 'modules', tab: 'Módulos', icon: 'layout-grid', count: 0, active: true, onClick: () => modules.init() },
            { id: 'sections', tab: 'Secciones', icon: 'list-tree', onClick: () => sections.init() }
        ]
    });
*/

// -- CSS --

/*  button.cs-tab y no .cs-tab: el preflight del CDN de Tailwind se inyecta
    después de esta hoja y su [type=button] (misma especificidad que una
    clase) le quitaría el fondo y el borde a la pestaña. */
function csTabsCSS() {
    if (document.getElementById('cs-tabs-css')) return;

    const css = ''
        + '.cs-tabs { background:#fff; border:1px solid #E2E8F0; border-radius:14px;'
        +   ' box-shadow:0 1px 3px rgba(15,23,42,.04); padding:0 8px; overflow-x:auto; scrollbar-width:thin; }'
        + '.cs-tabs-bar { display:flex; gap:4px; min-width:max-content; }'
        + '.cs-tabs-center { justify-content:center; }'
        + 'button.cs-tab { display:inline-flex; align-items:center; gap:8px; padding:14px; margin:0;'
        +   ' font-size:13.5px; font-weight:600; line-height:1.2; color:#64748B; background:none; border:none;'
        +   ' border-bottom:2px solid transparent; border-radius:0; white-space:nowrap; cursor:pointer;'
        +   ' transition:color .15s ease, border-color .15s ease; }'
        + 'button.cs-tab:hover { color:#334155; }'
        + 'button.cs-tab:focus-visible { outline:2px solid rgb(var(--brand-600, 192 90 64) / .35); outline-offset:-2px; }'
        + 'button.cs-tab.is-active { color:rgb(var(--primary-rgb, 41 37 36)); border-bottom-color:rgb(var(--brand-600, 192 90 64)); }'
        + '.cs-tab-count { font-size:11px; font-weight:700; line-height:1; padding:4px 8px; border-radius:999px;'
        +   ' background:#F1F5F9; color:#64748B; }'
        + '.cs-tab-count:empty { display:none; }'
        + 'button.cs-tab.is-active .cs-tab-count { background:rgb(var(--brand-600, 192 90 64) / .12);'
        +   ' color:rgb(var(--brand-700, 168 74 51)); }'

        /* Encabezado de página de CostSys (migas + título + subtítulo). */
        + '.cp-pagina-titulo { font-family:Poppins, Inter, sans-serif; font-size:26px; font-weight:700;'
        +   ' letter-spacing:-.02em; line-height:1.15; margin:0; color:rgb(var(--primary-rgb, 41 37 36)); }'
        + '.cp-pagina-subtitulo { font-size:13px; color:#64748B; margin:5px 0 0; }'

        /* Página oscura: superficies de themes.css. */
        + 'body.dark-mode .cs-tabs { background:var(--dk-card, #1F2A37); border-color:var(--dk-line, #374151); box-shadow:none; }'
        + 'body.dark-mode button.cs-tab { color:var(--dk-muted, #9CA3AF); }'
        + 'body.dark-mode button.cs-tab:hover { color:var(--dk-text-soft, #D1D5DB); }'
        + 'body.dark-mode button.cs-tab.is-active { color:var(--dk-text, #F3F4F6); }'
        + 'body.dark-mode .cs-tab-count { background:rgb(100 116 139 / .16); color:var(--dk-muted, #9CA3AF); }'
        + 'body.dark-mode button.cs-tab.is-active .cs-tab-count { background:rgb(var(--brand-600, 192 90 64) / .25);'
        +   ' color:var(--dk-text, #F3F4F6); }'
        + 'body.dark-mode .cp-pagina-titulo { color:var(--dk-text, #F3F4F6); }'
        + 'body.dark-mode .cp-pagina-subtitulo { color:var(--dk-muted, #9CA3AF); }';

    const style = document.createElement('style');
    style.id = 'cs-tabs-css';
    style.textContent = css;
    document.head.appendChild(style);
}

// -- Componente --

Templates.prototype.csTabs = function (options) {
    const defaults = {
        parent: "root",
        id: "csTabs",
        center: false,
        json: []
    };

    const opts = Object.assign({}, defaults, options);

    const esc = (t) => (t == null ? '' : String(t)).replace(/[&<>"]/g, (c) => {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });

    const tab = (t) => {
        const on = t.active === true;

        return ''
            + `<button type="button" class="cs-tab${on ? ' is-active' : ''}" data-tab="${esc(t.id)}">`
            +   (t.icon ? `<i data-lucide="${esc(t.icon)}" class="w-4 h-4"></i>` : '')
            +   `<span>${esc(t.tab)}</span>`
            +   `<span class="cs-tab-count" data-count="${esc(t.id)}">${t.count === undefined ? '' : esc(t.count)}</span>`
            + '</button>';
    };

    csTabsCSS();

    const bar = $('<div>', {
        class: `cs-tabs-bar${opts.center ? ' cs-tabs-center' : ''}`,
        html: opts.json.map(tab).join('')
    });

    const panels = $('<div>', { class: 'cs-tabs-panels' }).html(
        opts.json.map((t) => `<div id="container-${esc(t.id)}" class="${t.active === true ? '' : 'hidden'}"></div>`).join('')
    );

    /*  Trae la pestaña activa a la vista cuando la barra no cabe entera (se
        puede llegar por ?tab= a una del final). scrollLeft a mano y no
        scrollIntoView(), que arrastra también la ventana. */
    const verActiva = () => {
        const caja = bar.parent()[0];
        const act  = bar.find('.cs-tab.is-active')[0];

        if (!caja || !act || caja.scrollWidth <= caja.clientWidth) return;

        caja.scrollLeft = Math.max(0, act.offsetLeft - (caja.clientWidth - act.offsetWidth) / 2);
    };

    $(`#${opts.parent}`).html($('<div>', { id: opts.id, class: 'cs-tabs' }).append(bar));
    $(`#${opts.parent}`).append(panels);

    bar.on('click', '.cs-tab', (e) => {
        const id = $(e.currentTarget).data('tab');

        bar.find('.cs-tab').removeClass('is-active');
        $(e.currentTarget).addClass('is-active');

        panels.children().addClass('hidden');
        $(`#container-${id}`).removeClass('hidden');

        verActiva();

        const item = opts.json.filter((x) => String(x.id) === String(id))[0];
        if (item && typeof item.onClick === 'function') item.onClick();
    });

    if (window.lucide) lucide.createIcons();

    verActiva();
};

Templates.prototype.csTabCount = function (id, n) {
    $(`[data-count="${id}"]`).text(n);
};
