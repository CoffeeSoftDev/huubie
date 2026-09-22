/*
    CoffeeSoft Component: csIconPicker
    Selector de iconos Lucide: buscador + rejilla con TODOS los iconos.

    Existe porque "Icono (lucide)" era un campo de texto en el que habia que
    saberse el nombre de memoria, y nadie se sabe 1,800 nombres. Ahora se
    escribe "usuario" o "dinero" y se elige viendo el dibujo.

    Se declara sobre Templates.prototype para que sea un metodo del framework
    sin editar coffeeSoft.js, igual que csModal y csCards.

    Tres piezas, de afuera hacia adentro:

      csIconField(f)         El HTML de un campo de icono: la muestra del icono
                             actual, el texto con su nombre y el boton que abre
                             el selector. EL VALOR VIVE EN EL TEXTO, que lleva el
                             id del campo: csModal lo recoge con su find('#id')
                             de siempre y el servidor recibe el mismo nombre en
                             kebab-case de antes. Escribirlo a mano sigue
                             funcionando, y la muestra se actualiza al teclear.

      csIconFieldBind(host)  Engancha los eventos de TODOS los campos de icono
                             que haya dentro de host, por delegacion: los que se
                             pinten despues tambien quedan enganchados. Se llama
                             una vez por contenedor; repetirlo no duplica nada.

      csIconPicker(opts)     El panel flotante en si. Lo abre el boton del campo,
                             pero tambien se puede llamar directo:

                             this.csIconPicker({
                                 value: 'calculator',
                                 onPick: (name) => console.log(name)
                             });

    El catalogo sale de cs-icons.js (nombres canonicos) cruzado con la lucide
    que la pagina cargo: se esconden los que ya no existan y se agregan los que
    traiga de mas. Sin cs-icons.js funciona igual, con los nombres que lucide
    exponga (incluye alias, asi que algunos dibujos salen dos veces).
*/

/*  Conversiones de nombre, copiadas del propio lucide.

    data-lucide="a-arrow-down" se busca como icons.AArrowDown: kebab -> Pascal.
    Para el camino inverso (las llaves de lucide.icons -> nombre para
    data-lucide) hay que cuidar los digitos: Grid2x2 es grid-2x2 y BarChart3 es
    bar-chart-3, asi que el guion va antes de un digito SOLO cuando lo precede
    una letra que no viene de otro digito. Los 2,098 nombres de la v1.46 hacen
    el viaje de ida y vuelta sin perderse. */
function csIconToPascal(s) {
    let out = '';
    let upperNext = false;

    for (const ch of String(s)) {
        if (ch === '-' || ch === '_' || ch <= ' ') { upperNext = out.length > 0; continue; }
        out += out.length === 0 ? ch.toLowerCase() : (upperNext ? ch.toUpperCase() : ch);
        upperNext = false;
    }

    return out.charAt(0).toUpperCase() + out.slice(1);
}

function csIconToKebab(name) {
    let out = '';

    for (let i = 0; i < name.length; i++) {
        const c  = name[i];
        const p  = name[i - 1] || '';
        const pp = name[i - 2] || '';
        const up  = c >= 'A' && c <= 'Z';
        const dig = c >= '0' && c <= '9';

        if (i > 0 && (up || (dig && /[A-Za-z]/.test(p) && !/[0-9]/.test(pp)))) out += '-';

        out += c.toLowerCase();
    }

    return out;
}

/* ¿La lucide cargada conoce este nombre? Sin lucide se da por bueno. */
function csIconExists(name) {
    const n = String(name == null ? '' : name).trim();

    if (n === '') return false;
    if (!window.lucide || !lucide.icons) return true;

    return !!lucide.icons[csIconToPascal(n)];
}

/*  El catalogo, calculado una vez.

    Primero los canonicos de cs-icons.js que la lucide cargada reconozca. Despues
    lo que lucide traiga y la lista no conozca, deduplicado por el DIBUJO y no
    por el nombre: lucide.icons tiene una llave por alias apuntando al mismo
    nodo, y sin esto cada icono renombrado saldria dos o tres veces. */
function csIconCatalog() {
    if (window.__csIconCatalog) return window.__csIconCatalog;

    const runtime = (window.lucide && lucide.icons) ? lucide.icons : null;
    const names   = (window.CS_ICONS || []).filter(csIconExists);

    if (runtime) {
        const vistos = new Set(names.map((n) => runtime[csIconToPascal(n)]));

        Object.keys(runtime).forEach((k) => {
            const nodo = runtime[k];

            if (vistos.has(nodo)) return;

            vistos.add(nodo);
            names.push(csIconToKebab(k));
        });
    }

    window.__csIconCatalog = names;

    return names;
}

/* Sin acentos ni mayusculas: "Calendário" y "calendario" buscan lo mismo. */
function csIconNorm(t) {
    return String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

/*  Pinta los <i data-lucide> que haya dentro de un nodo.

    Se le pasa root para no recorrer el documento entero por cada tanda de la
    rejilla. Si la lucide cargada fuera tan vieja que ignorara root, los <i>
    seguirian ahi sin convertir: en ese caso se hace la pasada global de
    siempre, que es lenta pero los pinta. */
function csIconRender(el) {
    if (!window.lucide || !el) return;

    lucide.createIcons({ root: el });

    if (el.querySelector('i[data-lucide]')) lucide.createIcons();
}

/*  Filtra el catalogo con lo que se escribio.

    Cada palabra tiene que cumplirse (AND), y cada una se cumple si el nombre la
    contiene O contiene alguna de sus traducciones del diccionario. La palabra
    se busca en el diccionario por prefijo a partir de tres letras, para que
    "usu" ya traiga lo de "usuario" mientras se termina de teclear.

    Orden: primero los que EMPIEZAN con lo escrito, luego los mas cortos, que
    suelen ser el icono base y no una variante. */
function csIconBuscar(query) {
    const cat    = csIconCatalog();
    const dicc   = window.CS_ICONS_ES || {};
    const claves = Object.keys(dicc);
    const q      = csIconNorm(query);

    if (q === '') return cat;

    const palabras = q.split(/\s+/).filter(Boolean);

    const terminos = palabras.map((p) => {
        const t = [p];

        claves.forEach((k) => {
            if (k === p || (p.length >= 3 && k.indexOf(p) === 0)) dicc[k].forEach((x) => t.push(x));
        });

        return t;
    });

    const cumple = (name) => terminos.every((t) => t.some((x) => name.indexOf(x) !== -1));

    return cat.filter(cumple).sort((a, b) => {
        const pa = palabras.some((p) => a.indexOf(p) === 0) ? 0 : 1;
        const pb = palabras.some((p) => b.indexOf(p) === 0) ? 0 : 1;

        return pa - pb || a.length - b.length || a.localeCompare(b);
    });
}

/*  El CSS del selector y del campo, inyectado una sola vez.

    Va dentro del componente y no en la hoja de cada pantalla por la misma
    razon que en csModal: un componente que necesita reglas propias se las
    trae, y asi no hay que acordarse de copiarlas en cada pagina nueva. */
function csIconPickerCSS() {
    if (document.getElementById('cs-icon-picker-css')) return;

    /*  PORT A INVENTORY: el original de erp-pro clavaba su azul institucional
        en once reglas. Aquí el acento sale del tema activo (Claro / Agents /
        Avatar) a través de --brand-600, con el terracota de respaldo por si la
        hoja de temas no está cargada. Ver src/css/themes.css. */
    const css = ''
        + ':root { --cs-ip-accent: rgb(var(--brand-600, 192 90 64)); }'

        /* ---- el campo ---- */
        + '.cs-icon-field { display:flex; align-items:stretch; gap:6px; }'
        + '.cs-icon-field input { flex:1; min-width:0; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; }'
        + '.cs-icon-prev, .cs-icon-btn { width:38px; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;'
        +   ' border:1px solid #CBD5E1; border-radius:8px; background:#FFFFFF; color:var(--cs-ip-accent); }'
        + '.cs-icon-prev.is-missing { color:#CBD5E1; border-style:dashed; }'
        + '.cs-icon-prev svg, .cs-icon-btn svg { width:17px; height:17px; }'
        + '.cs-icon-btn { cursor:pointer; color:#64748B; transition:.15s; }'
        + '.cs-icon-btn:hover { border-color:var(--cs-ip-accent); color:var(--cs-ip-accent); background:#F8FAFC; }'

        /* ---- el panel ---- */
        /*  PORT A INVENTORY: el z-index original (140) bastaba en erp-pro, donde el
            campo vive dentro de csModal. Aquí el formulario lo pinta bootbox, y
            core-libraries.php clava `.modal/.bootbox-modal/.swal2-popup` en 9999
            (backdrop 9998) con !important. Con 140 el selector se abría DETRÁS del
            modal que lo invocó. 10050 lo deja por encima de esa pila. */
        + '.cs-ip { position:fixed; inset:0; z-index:10050; display:flex; align-items:center; justify-content:center; padding:16px; }'
        + '.cs-ip-bg { position:absolute; inset:0; background:rgba(15,23,42,.45); }'
        + '.cs-ip-box { position:relative; width:100%; max-width:820px; max-height:min(85vh, 680px); display:flex; flex-direction:column;'
        +   ' background:#FFFFFF; border-radius:16px; box-shadow:0 24px 60px rgba(15,23,42,.35); overflow:hidden; }'
        + '.cs-ip-head { display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid #E2E8F0; }'
        + '.cs-ip-search-wrap { position:relative; flex:1; min-width:0; }'
        + '.cs-ip-search-wrap svg { position:absolute; left:11px; top:50%; transform:translateY(-50%); width:16px; height:16px; color:#94A3B8; }'
        + '.cs-ip-search { width:100%; font-size:13.5px; color:#1E293B; background:#F8FAFC; border:1px solid #CBD5E1; border-radius:10px; padding:9px 12px 9px 34px; }'
        + '.cs-ip-search:focus { outline:none; border-color:var(--cs-ip-accent); box-shadow:0 0 0 3px rgb(var(--brand-600, 192 90 64) / .15); background:#FFFFFF; }'
        + '.cs-ip-count { font-size:11.5px; color:#94A3B8; white-space:nowrap; }'
        + '.cs-ip-x { border:none; background:none; color:#94A3B8; font-size:22px; line-height:1; padding:2px 6px; cursor:pointer; }'
        + '.cs-ip-x:hover { color:#0F172A; }'
        + '.cs-ip-body { flex:1; overflow-y:auto; padding:8px 16px 16px; }'
        + '.cs-ip-sec { font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#94A3B8; margin:12px 0 8px; }'
        + '.cs-ip-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(78px, 1fr)); gap:6px; }'
        + '.cs-ip-item { display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px 4px 7px;'
        +   ' border:1px solid transparent; border-radius:10px; background:none; color:#334155; cursor:pointer; transition:.12s; min-width:0; }'
        + '.cs-ip-item svg { width:22px; height:22px; color:#0F2C4C; }'
        + '.cs-ip-item span { max-width:100%; font-size:9.5px; line-height:1.1; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
        + '.cs-ip-item:hover { background:#F1F5F9; border-color:#E2E8F0; }'
        + '.cs-ip-item.is-active { background:rgb(var(--brand-600, 192 90 64) / .08); border-color:rgb(var(--brand-600, 192 90 64) / .25); }'
        + '.cs-ip-item.is-active svg { color:var(--cs-ip-accent); }'
        + '.cs-ip-empty { text-align:center; color:#94A3B8; font-size:13px; padding:40px 0; }'
        + '.cs-ip-more { display:block; margin:14px auto 0; padding:8px 18px; border:1px solid #CBD5E1; border-radius:9999px;'
        +   ' background:#FFFFFF; color:#475569; font-size:12.5px; font-weight:600; cursor:pointer; }'
        + '.cs-ip-more:hover { border-color:#94A3B8; color:#0F172A; }'
        + '.cs-ip-foot { display:flex; align-items:center; gap:10px; padding:10px 16px; border-top:1px solid #E2E8F0; background:#F8FAFC; font-size:12px; color:#64748B; }'
        + '.cs-ip-foot code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--cs-ip-accent); font-weight:600; }'
        + '.cs-ip-foot .cs-ip-use { margin-left:auto; padding:7px 14px; border:none; border-radius:8px; background:var(--cs-ip-accent); color:#FFFFFF;'
        +   ' font-size:12.5px; font-weight:600; cursor:pointer; }'
        + '.cs-ip-foot .cs-ip-use:disabled { opacity:.4; cursor:default; }';

    const style = document.createElement('style');
    style.id = 'cs-icon-picker-css';
    style.textContent = css;
    document.head.appendChild(style);
}

/* ------------------------------------------------------------------
   EL CAMPO
   ------------------------------------------------------------------ */
Templates.prototype.csIconField = function (f) {
    const esc = (t) => (t == null ? '' : String(t)).replace(/[&<>"]/g, (c) => {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });

    csIconPickerCSS();

    const value = String(f.value == null ? '' : f.value).trim();
    const ok    = csIconExists(value);

    return ''
        + '<div class="cs-icon-field">'
        +   `<span class="cs-icon-prev${ok ? '' : ' is-missing'}" title="${ok ? esc(value) : 'Sin icono'}">`
        +     `<i data-lucide="${esc(ok ? value : 'circle-dashed')}"></i>`
        +   '</span>'
        /*  PORT A INVENTORY: el `name` es aditivo. csModal de erp-pro recoge el
            valor con find('#id'), pero createModalForm de CoffeeSoft arma el
            envío con FormData sobre el <form>, y FormData ignora los campos sin
            name. Sin esto el icono no llegaría al servidor. */
        +   `<input type="text" id="${esc(f.id)}"${f.name ? ` name="${esc(f.name)}"` : ''} value="${esc(value)}" class="${esc(f.inputClass || '')}"`
        +        ` placeholder="${esc(f.ph || 'layout-grid')}" spellcheck="false" autocomplete="off">`
        +   '<button type="button" class="cs-icon-btn" title="Elegir icono"><i data-lucide="layout-grid"></i></button>'
        + '</div>';
};

/*  Repinta la muestra de un campo con lo que diga su texto. Es lo que corre al
    teclear y al elegir en el selector. */
function csIconRefresh(field) {
    const $f    = $(field);
    const value = String($f.find('input').val() || '').trim();
    const ok    = csIconExists(value);
    const $prev = $f.find('.cs-icon-prev');

    $prev.toggleClass('is-missing', !ok)
         .attr('title', ok ? value : (value === '' ? 'Sin icono' : `"${value}" no existe en lucide`))
         .html(`<i data-lucide="${ok ? value : 'circle-dashed'}"></i>`);

    csIconRender($prev[0]);
}

Templates.prototype.csIconFieldBind = function (host) {
    const $host = $(host);

    if (!$host.length || $host.data('csIconBound')) return;

    $host.data('csIconBound', true);

    $host.on('input', '.cs-icon-field input', (e) => {
        csIconRefresh($(e.currentTarget).closest('.cs-icon-field'));
    });

    $host.on('click', '.cs-icon-btn', (e) => {
        const $field = $(e.currentTarget).closest('.cs-icon-field');
        const $in    = $field.find('input');

        this.csIconPicker({
            value: $in.val(),
            onPick: (name) => {
                $in.val(name);
                csIconRefresh($field);
                // Para quien escuche el campo (vistas previas, validaciones).
                $in.trigger('input');
            }
        });
    });
};

/* ------------------------------------------------------------------
   EL PANEL
   ------------------------------------------------------------------ */
Templates.prototype.csIconPicker = function (options) {
    const defaults = {
        id: 'csIconPicker',
        value: '',
        onPick: () => {}
    };

    const opts = Object.assign({}, defaults, options);

    const esc = (t) => (t == null ? '' : String(t)).replace(/[&<>"]/g, (c) => {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });

    /*  Cuantos se pintan por tanda. Son botones con un SVG cada uno: 1,800 de
        golpe tardan y no hacen falta, porque nadie los recorre uno a uno --
        se escribe y se acota. */
    const TANDA = 240;

    csIconPickerCSS();

    $(`#${opts.id}`).remove();

    const catalogo  = csIconCatalog();
    const sugeridos = (window.CS_ICONS_SUGERIDOS || []).filter(csIconExists);

    let actual   = String(opts.value == null ? '' : opts.value).trim();
    let lista    = catalogo;
    let pintados = 0;

    const panel = $('<div>', { id: opts.id, class: 'cs-ip' }).html(''
        + '<div class="cs-ip-bg"></div>'
        + '<div class="cs-ip-box" role="dialog" aria-label="Elegir icono">'
        +   '<div class="cs-ip-head">'
        +     '<div class="cs-ip-search-wrap">'
        +       '<i data-lucide="search"></i>'
        +       '<input type="text" class="cs-ip-search" placeholder="Buscar icono... usuario, dinero, calendario, calculator" spellcheck="false" autocomplete="off">'
        +     '</div>'
        +     `<span class="cs-ip-count">${catalogo.length.toLocaleString('es-MX')} iconos</span>`
        +     '<button type="button" class="cs-ip-x" title="Cerrar">&times;</button>'
        +   '</div>'
        +   '<div class="cs-ip-body"></div>'
        +   '<div class="cs-ip-foot">'
        +     '<span class="cs-ip-sel"></span>'
        +     '<button type="button" class="cs-ip-use" disabled>Usar</button>'
        +   '</div>'
        + '</div>');

    const $body   = panel.find('.cs-ip-body');
    const $search = panel.find('.cs-ip-search');
    const $sel    = panel.find('.cs-ip-sel');
    const $use    = panel.find('.cs-ip-use');

    const item = (n) => ''
        + `<button type="button" class="cs-ip-item${n === actual ? ' is-active' : ''}" data-icon="${esc(n)}" title="${esc(n)}">`
        +   `<i data-lucide="${esc(n)}"></i><span>${esc(n)}</span>`
        + '</button>';

    const pie = () => {
        if (actual === '') {
            $sel.html('Elige un icono de la rejilla o escribe para buscar.');
            $use.prop('disabled', true);
            return;
        }

        $sel.html(`<i data-lucide="${esc(actual)}" style="width:16px;height:16px;"></i> &nbsp;Seleccionado: <code>${esc(actual)}</code>`);
        $use.prop('disabled', false);

        csIconRender($sel[0]);
    };

    /*  Pinta la primera tanda de la lista actual. Con el buscador vacio,
        arriba van los sugeridos del ERP: es lo que casi siempre se busca. */
    const pintar = () => {
        const q = $search.val().trim();

        lista    = csIconBuscar(q);
        pintados = 0;

        let html = '';

        if (q === '' && sugeridos.length) {
            html += '<p class="cs-ip-sec">Sugeridos para el ERP</p>'
                  + `<div class="cs-ip-grid">${sugeridos.map(item).join('')}</div>`;
        }

        if (lista.length === 0) {
            html += '<p class="cs-ip-empty">Ningún icono coincide. Prueba en inglés: el nombre siempre está en inglés.</p>';
        } else {
            html += `<p class="cs-ip-sec">${q === '' ? 'Todos' : `${lista.length.toLocaleString('es-MX')} resultados`}</p>`
                  + '<div class="cs-ip-grid cs-ip-todos"></div>';
        }

        $body.html(html);
        $body.scrollTop(0);

        if (q === '') csIconRender($body[0]);

        masIconos();
    };

    /* Agrega la siguiente tanda a la rejilla de "Todos". */
    const masIconos = () => {
        const $grid = $body.find('.cs-ip-todos');

        if (!$grid.length) return;

        const tanda = lista.slice(pintados, pintados + TANDA);
        const $nuevo = $('<div>').html(tanda.map(item).join(''));

        $grid.append($nuevo.children());
        csIconRender($grid[0]);
        pintados += tanda.length;

        $body.find('.cs-ip-more').remove();

        if (pintados < lista.length) {
            $body.append(`<button type="button" class="cs-ip-more">Mostrar más (${(lista.length - pintados).toLocaleString('es-MX')} restantes)</button>`);
        }
    };

    const close = () => {
        panel.remove();
        document.removeEventListener('keydown', escapar, true);
        document.removeEventListener('focusin', enfocar, true);
    };

    const elegir = (name) => {
        actual = name;
        panel.find('.cs-ip-item').removeClass('is-active');
        panel.find(`.cs-ip-item[data-icon="${name}"]`).addClass('is-active');
        pie();
    };

    const usar = () => {
        if (actual === '') return;

        opts.onPick(actual);
        close();
    };

    /*  Escape cierra el selector y SOLO el selector. Se escucha en fase de
        captura y se corta ahi: csModal tambien cierra con Escape y escucha en
        document, y sin esto un Escape para cerrar la rejilla se llevaria el
        formulario entero. */
    const escapar = (e) => {
        if (e.key !== 'Escape') return;

        e.stopImmediatePropagation();
        e.preventDefault();
        close();
    };

    /*  PORT A INVENTORY: el modal de bootstrap (via bootbox) monta un "focus trap":
        escucha focusin en document y, si el foco cae fuera del modal, lo regresa de
        un tiron. Como el panel se cuelga de <body>, es fuera del modal: el buscador
        perdia el foco al instante y no se podia teclear.

        Mismo remedio que con Escape: se escucha en fase de CAPTURA (corre antes que
        el listener de bootstrap, que va en burbuja) y se corta el evento solo cuando
        el foco cayo dentro del panel. El trap del modal sigue intacto para todo lo
        demas. */
    const enfocar = (e) => {
        if (panel[0] && panel[0].contains(e.target)) e.stopImmediatePropagation();
    };

    panel.on('click', '.cs-ip-bg, .cs-ip-x', close);
    panel.on('click', '.cs-ip-more', masIconos);
    panel.on('click', '.cs-ip-use', usar);

    // Un clic marca; doble clic elige y cierra. El boton Usar sirve para el primero.
    panel.on('click',    '.cs-ip-item', (e) => elegir($(e.currentTarget).data('icon')));
    panel.on('dblclick', '.cs-ip-item', (e) => { elegir($(e.currentTarget).data('icon')); usar(); });

    // Enter en el buscador: si hay un solo resultado o ya hay seleccion, se usa.
    $search.on('keydown', (e) => {
        if (e.key !== 'Enter') return;

        e.preventDefault();

        if (actual === '' && lista.length === 1) elegir(lista[0]);

        usar();
    });

    let espera = null;

    $search.on('input', () => {
        clearTimeout(espera);
        espera = setTimeout(pintar, 120);
    });

    document.addEventListener('keydown', escapar, true);
    document.addEventListener('focusin', enfocar, true);

    $('body').append(panel);

    csIconRender(panel.find('.cs-ip-head')[0]);

    pintar();
    pie();

    $search.focus();

    return { close: close };
};
