/*
    CoffeeSoft Component: createCoffeeModalForm
    Modal compacto de Huubie: header con icono + X, campos en cajas y dos
    botones a lo ancho. Portado de alpha/src/js/coffeeSoft.js (mismo API).
    Se declara sobre Templates.prototype para no editar coffeeSoft.js.

    Diferencias con el de alpha:
      - Ninguna utilidad que Bootstrap 5 pisa con !important (p-4, mb-3,
        gap-3, mt-4, px-3, border...): van como valor arbitrario (p-[16px],
        border-[1px]...). Con las de Bootstrap el modal se inflaba.
      - theme 'auto' (por defecto) sigue a body.dark-mode.
      - z-index 1050: por debajo de SweetAlert (1060), así un alert() que
        salga desde el modal queda encima sin parches.
      - El overlay lleva el id: abrir dos veces deja uno solo.

    options = {
      id:          'cfModalForm',       // id del overlay y prefijo de los campos
      title:       'Formulario',
      iconSvg:     '<i data-lucide="clock" class="w-5 h-5"></i>',
      iconBg:      'bg-emerald-600',
      theme:       'auto' | 'dark' | 'light',
      width:       360,                 // ancho máximo en px
      confirmText: 'Confirmar',
      cancelText:  'Cancelar',
      confirmBg:   'bg-green-600 hover:bg-green-700',
      footerNote:  '',                  // texto pequeño centrado bajo los botones (HTML)
      json: [
        { opc:'display', id, lbl, value, icon },                 // caja solo lectura
        { opc:'money',   id, lbl, placeholder, min, step, ... }, // number con prefijo $
        { opc:'text'|'number', id, lbl, placeholder, prefix, required, ... },
        { opc:'select', id, lbl, value, data:[{id,valor}], required },
        { opc:'html',    html }                                  // bloque libre
      ],
      // Recibe los valores (sin los display) y el modal.
      //   true  -> se cierra solo.
      //   otra cosa (incl. Promise) -> sigue abierto; ciérralo con modal.close().
      onConfirm: (data, modal) => {},
      // Solo al cerrar el usuario (X, Cancelar, Escape, clic fuera).
      onCancel: () => {}
    }

    Lo que va en value, lbl, icon y html entra tal cual: quien lo arma escapa
    lo que venga de la base.
*/

(function () {

    function buildModal(options) {
        const o = Object.assign({
            id: 'cfModalForm',
            title: 'Formulario',
            icon: '',
            iconSvg: '',
            iconBg: 'bg-emerald-600',
            theme: 'auto',
            width: 360,
            confirmText: 'Confirmar',
            cancelText: 'Cancelar',
            confirmBg: 'bg-green-600 hover:bg-green-700',
            cancelBg: '',
            hideHeader: false,
            reverseButtons: false,
            footerNote: '',
            json: [],
            onConfirm: () => true,
            onCancel: null
        }, options);

        const dark = o.theme === 'auto' ? document.body.classList.contains('dark-mode') : o.theme !== 'light';

        const cardBg    = dark ? 'bg-[#1F2A37]' : 'bg-white';
        const fieldBox  = dark ? 'bg-[#1a2332] border-slate-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900';
        const labelCls  = dark ? 'text-gray-400' : 'text-gray-500';
        const inputCls  = dark ? 'bg-[#1a2332] border-slate-700 text-white focus:border-emerald-500'
                               : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500';
        const titleCls  = dark ? 'text-white' : 'text-gray-900';
        const closeCls  = dark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700';
        const cancelCls = dark ? 'bg-[#1a2332] hover:bg-[#243044] text-gray-300 border-[1px] border-gray-600'
                               : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-[1px] border-gray-300';

        // -- Campos --

        const fieldHtml = (f) => {
            if (f.opc === 'html') return f.html || '';

            const lbl = `<label class="text-[10px] font-bold ${labelCls} uppercase tracking-wide block mb-[6px]">${f.lbl || ''}</label>`;

            if (f.opc === 'display') {
                const val   = f.value != null ? f.value : '';
                const inner = f.icon
                    ? `<div class="${fieldBox} border-[1px] rounded-lg px-[12px] py-[10px] text-sm flex items-center gap-[8px]"><span class="flex-shrink-0 ${labelCls}">${f.icon}</span><span class="min-w-0 truncate">${val}</span></div>`
                    : `<div class="${fieldBox} border-[1px] rounded-lg px-[12px] py-[10px] text-sm">${val}</div>`;

                return `<div>${lbl}${inner}</div>`;
            }

            if (f.opc === 'select') {
                const placeholderOpt = f.placeholder
                    ? `<option value="" disabled ${f.value == null ? 'selected' : ''}>${f.placeholder}</option>`
                    : '';
                const optionsHtml = (f.data || []).map((it) => {
                    const sel = String(it.id) === String(f.value) ? 'selected' : '';
                    return `<option value="${it.id}" ${sel}>${it.valor}</option>`;
                }).join('');
                const chevron = `<span class="absolute inset-y-0 right-0 flex items-center pr-[10px] pointer-events-none ${labelCls}"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></span>`;

                return `<div>${lbl}<div class="relative"><select id="${o.id}-${f.id}" data-field="${f.id}" class="w-full ${inputCls} border-[1px] rounded-lg pl-[12px] pr-[32px] py-[10px] text-sm focus:outline-none appearance-none cursor-pointer" ${f.required ? 'required' : ''}>${placeholderOpt}${optionsHtml}</select>${chevron}</div></div>`;
            }

            const isMoney    = f.opc === 'money';
            const prefix     = f.prefix || (isMoney ? '$' : '');
            const type       = f.type || (isMoney || f.opc === 'number' ? 'number' : 'text');
            const pad        = prefix ? 'pl-[28px]' : 'pl-[12px]';
            const prefixHtml = prefix
                ? `<span class="absolute inset-y-0 left-0 flex items-center pl-[12px] ${labelCls} text-sm font-semibold pointer-events-none">${prefix}</span>`
                : '';
            const attrs = [
                f.placeholder != null ? `placeholder="${f.placeholder}"` : '',
                f.required ? 'required' : '',
                f.min != null ? `min="${f.min}"` : '',
                f.step != null ? `step="${f.step}"` : '',
                f.value != null ? `value="${f.value}"` : '',
                f.autofocus ? 'data-autofocus="1"' : ''
            ].join(' ');

            return `<div>${lbl}<div class="relative">${prefixHtml}<input id="${o.id}-${f.id}" data-field="${f.id}" type="${type}" class="w-full ${inputCls} border-[1px] rounded-lg ${pad} pr-[12px] py-[10px] text-sm focus:outline-none" ${attrs}></div></div>`;
        };

        // -- Tarjeta --

        const fieldsHtml = o.json.map(fieldHtml).join('');
        const iconHtml   = o.iconSvg || (o.icon ? `<i class="${o.icon} text-white"></i>` : '');
        const closeHtml  = '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M18 6 6 18M6 6l12 12"/></svg>';

        const headerHtml = o.hideHeader ? '' : ''
            + '<div class="flex items-center gap-[12px] mb-[12px]">'
            +   `<div class="w-9 h-9 ${o.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 text-white">${iconHtml}</div>`
            +   `<span class="text-base font-bold ${titleCls} flex-1 truncate">${o.title}</span>`
            +   `<button type="button" class="cf-close ${closeCls} flex items-center justify-center p-1 -mr-1" aria-label="Cerrar">${closeHtml}</button>`
            + '</div>';

        const cancelBtn   = `<button type="button" class="cf-cancel flex-1 py-[10px] rounded-lg text-sm font-semibold ${o.cancelBg || cancelCls}">${o.cancelText}</button>`;
        const confirmBtn  = `<button type="button" class="cf-confirm flex-1 py-[10px] rounded-lg text-sm font-semibold ${o.confirmBg} text-white disabled:opacity-50 disabled:cursor-wait">${o.confirmText}</button>`;
        const buttonsHtml = o.reverseButtons ? confirmBtn + cancelBtn : cancelBtn + confirmBtn;

        const footerNoteHtml = o.footerNote
            ? `<p class="cf-note text-[11px] ${labelCls} text-center mt-[12px] mb-0">${o.footerNote}</p>`
            : '';

        $(`#${o.id}`).remove();

        const overlay = $(''
            + `<div id="${o.id}" class="cf-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1050;display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .15s ease;">`
            +   `<div class="cf-card ${cardBg} rounded-2xl shadow-2xl w-full p-[16px]" role="dialog" aria-modal="true" aria-label="${o.title}" style="max-width:${o.width}px;transform:scale(.96);transition:transform .15s ease;">`
            +     headerHtml
            +     `<div class="space-y-3">${fieldsHtml}</div>`
            +     `<div class="flex gap-[12px] mt-[16px]">${buttonsHtml}</div>`
            +     footerNoteHtml
            +   '</div>'
            + '</div>');

        // -- Valores --

        const collect = () => {
            const data = {};
            o.json.forEach((f) => {
                if (f.opc !== 'display' && f.opc !== 'html') data[f.id] = $(`#${o.id}-${f.id}`).val();
            });
            return data;
        };

        const validate = () => {
            let ok = true;
            o.json.forEach((f) => {
                if (f.opc === 'display' || f.opc === 'html' || !f.required) return;
                const $i = $(`#${o.id}-${f.id}`);
                if (!String($i.val() || '').trim()) { $i.addClass('!border-red-500'); ok = false; }
                else { $i.removeClass('!border-red-500'); }
            });
            return ok;
        };

        // -- Cierre --

        let closed = false;
        const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.swal2-container')) userCancel(); };

        function close() {
            if (closed) return;
            closed = true;
            $(document).off('keydown', onKey);
            overlay.css('opacity', 0);
            overlay.find('.cf-card').css('transform', 'scale(.96)');
            setTimeout(() => overlay.remove(), 150);
        }

        // Cierre por el usuario: dispara onCancel. modal.close() no lo dispara.
        function userCancel() {
            if (closed) return;
            if (typeof o.onCancel === 'function') o.onCancel();
            close();
        }

        const modal = {
            close: close,
            el: overlay,
            modal: (action) => { if (action === 'hide') close(); }
        };

        overlay.on('mousedown', (e) => { if (e.target === overlay[0]) userCancel(); });
        overlay[0].addEventListener('focusin', (e) => e.stopPropagation(), true);
        overlay.find('.cf-close, .cf-cancel').on('click', userCancel);
        overlay.find('.cf-confirm').on('click', () => {
            if (!validate()) return;
            const ret = o.onConfirm(collect(), modal);
            if (ret === true) close();
        });

        // Dentro del .modal.show de Bootstrap si hay uno abierto: su focus-trap no roba el foco.
        const bsModals   = document.querySelectorAll('.modal.show');
        const mountPoint = bsModals.length ? bsModals[bsModals.length - 1] : document.body;

        $(mountPoint).append(overlay);

        if (window.lucide) lucide.createIcons();

        requestAnimationFrame(() => {
            overlay.css('opacity', 1);
            overlay.find('.cf-card').css('transform', 'scale(1)');
        });

        $(document).on('keydown', onKey);
        overlay.find('[data-autofocus="1"]').first().trigger('focus');

        return modal;
    }

    if (typeof Templates !== 'undefined') {
        Templates.prototype.createCoffeeModalForm = function (options) { return buildModal.call(this, options); };
    }

    window.createCoffeeModalForm = buildModal;

})();
