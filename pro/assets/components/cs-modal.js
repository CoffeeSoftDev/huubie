/*
    CoffeeSoft Component: csModal
    Modal de formulario en Tailwind.
    Portado de erp-pro/pro/assets/components/cs-modal.js (CostSys nuevo).

    Existe porque createModalForm y sus hermanos usan bootbox. Se declara sobre
    Templates.prototype para que sea un método del framework sin editar
    coffeeSoft.js.

    Diferencias con el original:
      - Colores del tema de pro: bg-main (grafito) en los botones y blue-* (la
        marca, terracota) en foco, switch e ícono. Nada de #003360 fijo.
      - Ninguna utilidad que Bootstrap 5 pisa con !important (px-3, pt-5,
        gap-3, border, shadow...): van como valor arbitrario (px-[12px],
        border-[1px], shadow-[...]). Con las de Bootstrap el espaciado del
        modal se inflaba.
      - gray-* en lugar de slate-*: son las que dark-mode.css sabe oscurecer.
      - Campos con maxlength, min, max y step, y asterisco con required:true.

    Uso básico:
    this.csModal({
        title: 'Nueva categoría',
        json: [
            { id: 'name', lbl: 'Nombre', tipo: 'text', required: true, maxlength: 255 },
            { id: 'price', lbl: 'Precio', tipo: 'number', min: 0, step: '0.01' },
            { id: 'active', lbl: 'Activo', tipo: 'switch', value: 1 }
        ],
        onSave: (values, close) => console.log(values)
    });

    Tipos: text (por defecto), number, date, textarea, select, select2, switch,
    color, icon, html.

    'select2' es el mismo <select> con un buscador encima. Si la página no
    cargó select2, el campo se queda como un select normal.

    'html' no es un campo: es un bloque de solo lectura que se intercala entre
    los campos y NO viaja en los values del onSave. Su contenido va en f.html
    tal cual, así que quien lo arma escapa lo que venga de la base. Lleva el id
    en el contenedor para repintarlo desde fuera.

    'icon' usa el selector de cs-icon-picker.js; sin esa hoja cae a texto.

    En text y number, la propiedad icon (nombre Lucide) pinta ese ícono dentro
    del campo, a la izquierda: { id: 'price', tipo: 'number', icon: 'dollar-sign' }.

    Opciones opcionales:
      - body:       contenido libre. Si viene, sustituye a los campos de json.
      - lucideIcon: ícono junto al título.
      - action:     { text, lucideIcon, onClick } botón en la cabecera.
      - saveText:   false oculta Guardar.
      - cancelText: texto de Cancelar.
      - info:       texto al pie, a la izquierda de los botones.
      - zIndex:     número, para páginas cuya cabecera pelea el z-[120].
    Devuelve { close, body }: body es el selector del contenedor libre.
*/

// -- CSS --

/*  El CSS que no se puede escribir con utilidades en línea: los
    pseudo-elementos del <input type="color">, select2 vestido de campo y el
    color del título. Se inyecta una sola vez. */
function csModalCSS() {
    if (document.getElementById('cs-modal-css')) return;

    const brand = 'rgb(var(--brand-600, 192 90 64))';
    const halo  = 'rgb(var(--brand-600, 192 90 64) / .15)';
    const s2    = '.cs-modal-panel .select2-container--default';

    const css = ''
        + '.cs-modal-title { color:rgb(var(--primary-rgb, 41 37 36)); }'
        + 'body.dark-mode .cs-modal-title { color:var(--dk-text, #F3F4F6); }'

        /*  Página oscura como el modal de alpha (createCoffeeModalForm dark): un
            solo tono de tarjeta y líneas border-white/10. El bg-gray-50 del pie
            caía al negro de la página (dark-mode.css) y partía el modal en dos. */
        + 'body.dark-mode .cs-modal-bg { background-color:rgb(0 0 0 / .6); }'
        + 'body.dark-mode .cs-modal-panel > .cs-modal-head,'
        + 'body.dark-mode .cs-modal-panel > .cs-modal-foot { border-color:rgb(255 255 255 / .10) !important; }'
        + 'body.dark-mode .cs-modal-panel > .cs-modal-foot { background-color:transparent !important; }'

        /* Selector de color: muestra nativa pegada al campo de texto. */
        + '.cs-color { display:flex; align-items:stretch; gap:8px; }'
        + '.cs-color-pick { width:42px; flex-shrink:0; padding:0; border:1px solid #CBD5E1;'
        +   ' border-radius:8px; background:none; cursor:pointer; }'
        + '.cs-color-pick::-webkit-color-swatch-wrapper { padding:3px; }'
        + '.cs-color-pick::-webkit-color-swatch { border:none; border-radius:5px; }'
        + '.cs-color-pick::-moz-color-swatch { border:none; border-radius:5px; }'
        + '.cs-color-pick:hover { border-color:#94A3B8; }'
        + '.cs-color-hex { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.02em; }'
        + 'body.dark-mode .cs-color-pick { border-color:var(--dk-line, #374151); }'

        /*  select2 igualado al 'base' de los <input>: mismo alto, borde, radio
            y anillo de la marca al enfocar. Todo cuelga de .cs-modal-panel, que
            también es el dropdownParent, así que alcanza caja y lista. */
        + `${s2} .select2-selection--single { height:38px; border:1px solid #D1D5DB; border-radius:8px; background:#fff; }`
        + `${s2} .select2-selection--single .select2-selection__rendered {`
        +   ' line-height:36px; padding-left:12px; padding-right:38px; font-size:14px; color:#1F2937; }'
        + `${s2} .select2-selection--single .select2-selection__placeholder { color:#9CA3AF; }`
        + `${s2} .select2-selection--single .select2-selection__arrow { height:36px; right:8px; }`
        + `${s2} .select2-selection--single .select2-selection__clear { margin-right:22px; color:#9CA3AF; font-weight:400; }`
        + `${s2} .select2-selection--single .select2-selection__clear:hover { color:#B91C1C; }`
        + `${s2} .select2-selection--single:focus, ${s2} .select2-selection--single:focus-visible { outline:none; }`
        + `${s2}.select2-container--open .select2-selection--single,`
        + `${s2}.select2-container--focus .select2-selection--single { border-color:${brand}; box-shadow:0 0 0 2px ${halo}; }`
        + '.cs-modal-panel .select2-dropdown { border-color:#D1D5DB; border-radius:10px; overflow:hidden;'
        +   ' box-shadow:0 12px 28px rgba(15,23,42,.14); }'
        + '.cs-modal-panel .select2-search--dropdown { padding:8px; }'
        + '.cs-modal-panel .select2-search--dropdown .select2-search__field {'
        +   ' border:1px solid #D1D5DB; border-radius:8px; padding:7px 10px; font-size:13px; outline:none; }'
        + `.cs-modal-panel .select2-search--dropdown .select2-search__field:focus { border-color:${brand}; }`
        + '.cs-modal-panel .select2-results__options { max-height:260px; }'
        + `${s2} .select2-results__option { font-size:13px; padding:7px 12px; color:#374151; }`
        + `${s2} .select2-results__option--highlighted[aria-selected] { background:${brand}; color:#fff; }`
        + `${s2} .select2-results__option[aria-selected=true] { background:#F3F4F6; color:${brand}; font-weight:600; }`

        /* select2 en la página oscura. */
        + `body.dark-mode ${s2} .select2-selection--single { background:var(--dk-input, #111827); border-color:var(--dk-line, #374151); }`
        + `body.dark-mode ${s2} .select2-selection--single .select2-selection__rendered { color:var(--dk-text, #F3F4F6); }`
        + 'body.dark-mode .cs-modal-panel .select2-dropdown { background:var(--dk-card, #1F2A37); border-color:var(--dk-line, #374151); }'
        + `body.dark-mode ${s2} .select2-results__option { color:var(--dk-text-soft, #D1D5DB); }`
        + `body.dark-mode ${s2} .select2-results__option[aria-selected=true] { background:var(--dk-row, #273244); color:var(--dk-text, #F3F4F6); }`;

    const style = document.createElement('style');
    style.id = 'cs-modal-css';
    style.textContent = css;
    document.head.appendChild(style);
}

/*  Cualquier color a #rrggbb, que es lo ÚNICO que traga <input type="color">.
    Sin esto, un #FFF abriría la muestra en negro. */
function hex6(v) {
    const s = String(v == null ? '' : v).trim();

    if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();

    // Forma corta: #ABC -> #aabbcc
    if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
        return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
    }

    return '#000000';
}

// -- Componente --

Templates.prototype.csModal = function (options) {
    const defaults = {
        id: "csModal",
        title: "Formulario",
        subtitle: "",
        lucideIcon: "",
        action: null,
        saveText: "Guardar",
        cancelText: "Cancelar",
        info: "",
        width: "max-w-2xl",
        zIndex: null,
        body: "",
        json: [],
        onSave: () => {}
    };

    const opts = Object.assign({}, defaults, options);

    const esc = (t) => (t == null ? '' : String(t)).replace(/[&<>"]/g, (c) => {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });

    // Límites del campo: maxlength para texto, min/max/step para números.
    const limits = (f) => ''
        + (f.maxlength ? ` maxlength="${Number(f.maxlength)}"` : '')
        + (f.min !== undefined ? ` min="${esc(f.min)}"` : '')
        + (f.max !== undefined ? ` max="${esc(f.max)}"` : '')
        + (f.step !== undefined ? ` step="${esc(f.step)}"` : '');

    const label = (f) => esc(f.lbl) + (f.required ? ' <span class="text-red-500">*</span>' : '');

    const field = (f) => {
        const wrap = f.class || 'w-full sm:w-1/2';

        /*  disabled: el campo se ve y no se toca, y tampoco viaja en los values
            del onSave. Aplica a text, number, textarea, select y select2. */
        const tono    = f.disabled ? 'text-gray-500 bg-gray-100 cursor-not-allowed' : 'text-gray-800 bg-[#fff]';
        const bloqueo = f.disabled ? ' disabled' : '';
        const base    = `w-full text-sm ${tono} border-[1px] border-gray-300 rounded-lg px-[12px] py-2 `
                      + 'focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15';

        let input = '';

        /*  select y select2 pintan el mismo <select>; el segundo lleva una
            clase de marca y lo convierte el arranque de abajo, ya con el modal
            en el DOM (sobre un nodo suelto select2 mide cero). */
        if (f.tipo === 'select' || f.tipo === 'select2') {
            const opciones = (f.data || []).map((o) => {
                const sel = String(o.id) === String(f.value) ? ' selected' : '';
                return `<option value="${esc(o.id)}"${sel}>${esc(o.valor)}</option>`;
            }).join('');

            const marca  = f.tipo === 'select2' ? ' cs-modal-s2' : '';
            const vacio  = f.empty === false ? '' : `<option value="">${esc(f.empty || '— Selecciona —')}</option>`;

            input = `<select id="${esc(f.id)}" class="${base}${marca}"${bloqueo}>${vacio}${opciones}</select>`;

        } else if (f.tipo === 'textarea') {
            input = `<textarea id="${esc(f.id)}" rows="${f.rows || 3}" class="${base}" placeholder="${esc(f.ph || '')}"${limits(f)}${bloqueo}>${esc(f.value)}</textarea>`;

        } else if (f.tipo === 'switch') {
            // Pista y bolita van como HERMANAS del input: peer-checked: compila
            // a `.peer:checked ~ .clase`, que solo alcanza hermanos.
            // bg-[#fff] y no bg-white en la bolita: dark-mode.css oscurece
            // .bg-white y la bolita desaparecería sobre la pista.
            const on = Number(f.value) === 1 ? ' checked' : '';
            return ''
                + `<div class="${wrap} px-2 mt-[12px]">`
                +   '<label class="flex items-center gap-[12px] cursor-pointer select-none mb-0">'
                +     '<span class="relative inline-flex shrink-0">'
                +       `<input type="checkbox" id="${esc(f.id)}" class="cs-modal-switch sr-only peer"${on}>`
                +       '<span class="w-11 h-6 bg-gray-300 rounded-full transition-colors peer-checked:bg-blue-600"></span>'
                +       '<span class="absolute top-0.5 left-0.5 w-5 h-5 bg-[#fff] rounded-full shadow-[0_1px_2px_rgba(15,23,42,.3)] transition-transform peer-checked:translate-x-5"></span>'
                +     '</span>'
                +     `<span class="text-sm text-gray-700">${esc(f.lbl)}</span>`
                +   '</label>'
                +   (f.help ? `<p class="text-xs text-gray-400 mt-1 mb-0 ml-14">${esc(f.help)}</p>` : '')
                + '</div>';

        /*  Selector de color. EL CAMPO QUE MANDA ES EL DE TEXTO y lleva el id
            del campo; la muestra es un ayudante que no viaja. */
        } else if (f.tipo === 'color') {
            input = ''
                + '<div class="cs-color">'
                +   `<input type="color" id="${esc(f.id)}__pick" class="cs-color-pick" value="${hex6(f.value)}" aria-label="Elegir color">`
                +   `<input type="text" id="${esc(f.id)}" value="${esc(f.value)}" class="${base} cs-color-hex"`
                +        ` placeholder="${esc(f.ph || '#0F2740')}" maxlength="7" spellcheck="false">`
                + '</div>';

        // Bloque de solo lectura: sin <label> ni margen de campo.
        } else if (f.tipo === 'html') {
            return `<div class="${wrap} px-2 mt-[12px]" id="${esc(f.id)}">${f.html || ''}</div>`;

        } else if (f.tipo === 'icon' && typeof this.csIconField === 'function') {
            input = this.csIconField({ id: f.id, value: f.value, ph: f.ph, inputClass: base });

        } else {
            const type = f.tipo === 'number' ? 'number' : f.tipo === 'date' ? 'date' : 'text';

            const sangria = f.icon ? ' pl-[36px]' : '';

            input = `<input type="${type}" id="${esc(f.id)}" value="${esc(f.value)}" class="${base}${sangria}" placeholder="${esc(f.ph || '')}"${limits(f)}${bloqueo}>`;

            // Ícono dentro del campo: no recibe clics, el foco sigue en el input.
            if (f.icon) {
                input = '<div class="relative">'
                    +   `<i data-lucide="${esc(f.icon)}" class="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"></i>`
                    +   input
                    + '</div>';
            }
        }

        return ''
            + `<div class="${wrap} px-2 mt-[12px]">`
            +   `<label for="${esc(f.id)}" class="block text-xs font-semibold text-gray-500 mb-1.5">${label(f)}</label>`
            +   input
            +   (f.help ? `<p class="text-xs text-gray-400 mt-1 mb-0">${esc(f.help)}</p>` : '')
            + '</div>';
    };

    const icono = opts.lucideIcon
        ? '<span class="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">'
        +   `<i data-lucide="${esc(opts.lucideIcon)}" class="w-5 h-5"></i>`
        + '</span>'
        : '';

    const accion = opts.action
        ? '<button type="button" class="cs-modal-action inline-flex items-center gap-2 whitespace-nowrap shrink-0 '
        +   'px-[12px] py-1.5 text-xs font-semibold text-white rounded-lg bg-main hover:bg-main-hover">'
        +   (opts.action.lucideIcon ? `<i data-lucide="${esc(opts.action.lucideIcon)}" class="w-4 h-4 shrink-0"></i>` : '')
        +   esc(opts.action.text || '')
        + '</button>'
        : '';

    // El cuerpo libre gana sobre los campos.
    const cuerpo = opts.body
        ? `<div class="cs-modal-body">${opts.body}</div>`
        : `<div class="px-[16px] pb-2 pt-1 flex flex-wrap">${opts.json.map(field).join('')}</div>`;

    const guardar = opts.saveText === false ? ''
        : '<button type="button" class="cs-modal-save px-[16px] py-2 text-sm font-semibold text-white rounded-lg '
        +   `bg-main hover:bg-main-hover disabled:opacity-50 disabled:cursor-wait">${esc(opts.saveText)}</button>`;

    const capa = Number(opts.zIndex) > 0;

    $(`#${opts.id}`).remove();

    const modal = $('<div>', {
        id: opts.id,
        class: `fixed inset-0 ${capa ? '' : 'z-[120] '}flex items-start justify-center overflow-y-auto p-[16px] sm:p-8`,
        style: capa ? `z-index:${Number(opts.zIndex)};` : null
    }).html(''
        + '<div class="cs-modal-bg fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]"></div>'
        + `<div class="cs-modal-panel relative w-full ${opts.width} bg-white rounded-2xl shadow-2xl my-auto">`
        +   '<div class="cs-modal-head flex items-start justify-between gap-[16px] px-6 pt-[20px] pb-[16px] border-b border-gray-200">'
        +     '<div class="flex items-center gap-[12px] min-w-0">'
        +       icono
        +       '<div class="min-w-0">'
        +         `<h3 class="cs-modal-title text-lg font-semibold mb-0">${esc(opts.title)}</h3>`
        +         (opts.subtitle ? `<p class="text-xs text-gray-500 mt-0.5 mb-0">${esc(opts.subtitle)}</p>` : '')
        +       '</div>'
        +     '</div>'
        +     '<div class="flex items-center gap-2 shrink-0">'
        +       accion
        +       '<button type="button" class="cs-modal-x text-gray-400 hover:text-gray-700 text-xl leading-none px-1" aria-label="Cerrar">&times;</button>'
        +     '</div>'
        +   '</div>'
        +   cuerpo
        +   `<div class="cs-modal-foot flex items-center ${opts.info ? 'justify-between' : 'justify-end'} gap-2 px-6 py-[16px] mt-2 border-t border-gray-200 bg-gray-50 rounded-b-2xl">`
        +     (opts.info ? `<span class="cs-modal-info text-xs text-gray-400">${esc(opts.info)}</span>` : '')
        +     '<div class="flex items-center gap-2">'
        +       `<button type="button" class="cs-modal-cancel px-[16px] py-2 text-sm font-medium text-gray-600 hover:text-gray-900">${esc(opts.cancelText)}</button>`
        +       guardar
        +     '</div>'
        +   '</div>'
        + '</div>');

    /*  Con un zIndex propio, los swal que salen desde el modal suben por
        encima. Solo mientras haya un csModal abierto. */
    if (capa) {
        const reglas = $('#csModalZ').length ? $('#csModalZ') : $('<style>', { id: 'csModalZ' }).appendTo('head');

        reglas.text(`body.cs-modal-open .swal2-container{z-index:${Number(opts.zIndex) + 10};}`);
    }

    /*  Si al pulsar Escape había un desplegable de select2 abierto. Se anota en
        FASE DE CAPTURA: para cuando el evento llega al cierre del modal,
        select2 ya cerró su lista y la misma tecla cerraría todo. */
    let s2Abierto = false;

    const espiarEscape = (e) => {
        if (e.key === 'Escape') s2Abierto = !!document.querySelector('.select2-container--open');
    };

    document.addEventListener('keydown', espiarEscape, true);

    const close = () => {
        modal.remove();
        $(document).off('keydown.csModal');
        document.removeEventListener('keydown', espiarEscape, true);

        if (!$('.cs-modal-bg').length) $('body').removeClass('cs-modal-open');
    };

    modal.on('click', '.cs-modal-x, .cs-modal-cancel, .cs-modal-bg', close);

    if (opts.action && opts.action.onClick) {
        modal.on('click', '.cs-modal-action', () => opts.action.onClick());
    }

    // De la muestra al texto siempre; del texto a la muestra solo si es un color.
    modal.on('input', '.cs-color-pick', (e) => {
        const pick = $(e.currentTarget);

        pick.closest('.cs-color').find('.cs-color-hex').val(String(pick.val()).toUpperCase());
    });

    modal.on('input', '.cs-color-hex', (e) => {
        const txt = $(e.currentTarget);
        const v   = String(txt.val()).trim();

        if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v)) {
            txt.closest('.cs-color').find('.cs-color-pick').val(hex6(v));
        }
    });

    modal.on('click', '.cs-modal-save', () => {
        const values = {};

        opts.json.forEach((f) => {
            // Los bloques 'html' y los disabled se muestran, no se guardan.
            if (f.tipo === 'html' || f.disabled) return;

            values[f.id] = f.tipo === 'switch'
                         ? (modal.find(`#${f.id}`).is(':checked') ? 1 : 0)
                         : modal.find(`#${f.id}`).val();
        });

        opts.onSave(values, close);
    });

    // Escape cierra el modal, salvo cuando venía a cerrar un select2.
    $(document).on('keydown.csModal', (e) => {
        if (e.key !== 'Escape') return;
        if (s2Abierto) return;

        close();
    });

    csModalCSS();

    $('body').addClass('cs-modal-open').append(modal);

    if (typeof this.csIconFieldBind === 'function') this.csIconFieldBind(modal);

    // Campos buscables, ya con el modal en el DOM y medible.
    const buscables = modal.find('.cs-modal-s2');

    if (buscables.length && $.fn.select2) {
        buscables.each((i, el) => {
            const campo = $(el);

            campo.select2({
                dropdownParent: modal.find('.cs-modal-panel'),
                width: '100%',
                allowClear: true,
                placeholder: campo.find('option[value=""]').first().text()
            });
        });
    }

    if (window.lucide) lucide.createIcons();

    // Foco al primer campo escribible (ni la muestra de color ni un select2).
    modal.find('input:not(.cs-color-pick):not(.cs-modal-switch), select:not(.cs-modal-s2), textarea').not(':disabled').first().focus();

    return { close: close, body: `${opts.id} .cs-modal-body` };
};
