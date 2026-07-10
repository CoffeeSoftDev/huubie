/* ============================================================================
   createCoffeeModalForm — helper local (modulo pedidos)
   ----------------------------------------------------------------------------
   Modal propio estilo Huubie (dark/light) con API por json. NO usa bootbox:
   construye su propia tarjeta para clavar el diseno (header con icono + X,
   campos en cajas, footer con botones). Aislado y aditivo.

   Disponible como:
     - this.createCoffeeModalForm({...})   (clases que extienden Templates)
     - createCoffeeModalForm({...})         (funcion global, clases sueltas)

   options = {
     id:          'frmModal',          // prefijo de ids de campos
     title:       'Formulario',
     icon:        'icon-doc-text',     // clase del icono del header
     iconBg:      'bg-emerald-600',
     theme:       'dark' | 'light',
     width:       360,                 // ancho max en px
     confirmText: 'Confirmar',
     cancelText:  'Cancelar',
     confirmBg:   'bg-green-600 hover:bg-green-700',   // color del boton confirmar
     hideHeader:  false,   // oculta header lateral (icono+titulo+X) -> modo dialogo centrado
     reverseButtons: false,// confirmar a la izquierda
     footerNote:  '',      // texto pequeno centrado bajo los botones
     json: [
       { opc:'display', id, lbl, value },                       // caja solo lectura
       { opc:'money',   id, lbl, placeholder, min, step, ... }, // input number con prefijo $
       { opc:'text'|'number', id, lbl, placeholder, prefix, required, ... },
       { opc:'html',    html }                                  // bloque libre (resumen/recibo), sin caja ni label
     ],
     // onConfirm recibe los valores de los inputs y el modal.
     //   - devuelve true  -> el modal se cierra automaticamente.
     //   - devuelve otra cosa (incl. Promise) -> permanece abierto; cierra tu
     //     mismo con modal.close() (o modal.modal('hide')) al terminar (async).
     onConfirm: (data, modal) => {},
     // onCancel se dispara al cerrar por accion del usuario (X, Cancelar, Escape,
     // clic fuera). NO se dispara en el cierre programatico via modal.close().
     onCancel: () => {}
   }
   ============================================================================ */
(function () {

    function buildModal(options) {
        const o = Object.assign({
            id: 'cfModalForm',
            title: 'Formulario',
            icon: 'icon-doc-text',
            iconBg: 'bg-emerald-600',
            theme: 'dark',
            width: 360,
            confirmText: 'Confirmar',
            cancelText: 'Cancelar',
            confirmBg: 'bg-green-600 hover:bg-green-700',
            hideHeader: false,      // oculta el header (icono lateral + titulo + X): modo dialogo centrado
            reverseButtons: false,  // confirmar a la izquierda, cancelar a la derecha
            footerNote: '',         // texto pequeno centrado debajo de los botones
            json: [],
            onConfirm: () => true,
            onCancel: null
        }, options);

        const dark = o.theme !== 'light';

        const cardBg   = dark ? 'bg-[#1F2A37]' : 'bg-white';
        const fieldBox = dark ? 'bg-[#1a2332] border-gray-600/60 text-white'
                              : 'bg-gray-50 border-gray-300 text-gray-900';
        const labelCls = dark ? 'text-gray-400' : 'text-gray-500';
        const inputCls = dark ? 'bg-[#1a2332] border-gray-600 text-white focus:border-emerald-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500';
        const titleCls = dark ? 'text-white' : 'text-gray-900';
        const closeCls = dark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700';
        const cancelCls = dark ? 'bg-[#1a2332] hover:bg-[#243044] text-gray-300 border border-gray-600'
                               : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300';

        const fieldHtml = (f) => {
            // Bloque de HTML libre: se inyecta tal cual, sin label ni caja.
            // Sirve para resumenes/recibos dentro del mismo marco del modal.
            if (f.opc === 'html') return f.html || '';

            const lbl = `<label class="text-[10px] font-bold ${labelCls} uppercase tracking-wide block mb-1.5">${f.lbl || ''}</label>`;

            if (f.opc === 'display') {
                const val = f.value != null ? f.value : '';
                const inner = f.icon
                    ? `<div class="${fieldBox} border rounded-lg px-3 py-2.5 text-sm flex items-center gap-2"><span class="flex-shrink-0 ${labelCls}">${f.icon}</span><span>${val}</span></div>`
                    : `<div class="${fieldBox} border rounded-lg px-3 py-2.5 text-sm">${val}</div>`;
                return `<div>${lbl}${inner}</div>`;
            }

            const isMoney = f.opc === 'money';
            const prefix  = f.prefix || (isMoney ? '$' : '');
            const type    = f.type || (isMoney || f.opc === 'number' ? 'number' : 'text');
            const pad     = prefix ? 'pl-7' : 'pl-3';
            const prefixHtml = prefix
                ? `<span class="absolute inset-y-0 left-0 flex items-center pl-3 ${labelCls} text-sm font-semibold pointer-events-none">${prefix}</span>`
                : '';
            const attrs = [
                f.placeholder != null ? `placeholder="${f.placeholder}"` : '',
                f.required ? 'required' : '',
                f.min != null ? `min="${f.min}"` : '',
                f.step != null ? `step="${f.step}"` : '',
                f.value != null ? `value="${f.value}"` : '',
                f.autofocus ? 'data-autofocus="1"' : ''
            ].join(' ');

            return `<div>${lbl}<div class="relative">${prefixHtml}<input id="${o.id}-${f.id}" data-field="${f.id}" type="${type}" class="w-full ${inputCls} border rounded-lg ${pad} pr-3 py-2.5 text-sm focus:outline-none" ${attrs}></div></div>`;
        };

        const fieldsHtml = o.json.map(fieldHtml).join('');

        const iconHtml  = o.iconSvg || (o.icon ? `<i class="${o.icon} text-white"></i>` : '');
        const closeHtml = (typeof lucideIcon !== 'undefined') ? lucideIcon('x', 'w-5 h-5') : '&times;';

        const headerHtml = o.hideHeader ? '' : `
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-9 h-9 ${o.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 text-white">
                            ${iconHtml}
                        </div>
                        <span class="text-base font-bold ${titleCls} flex-1 truncate">${o.title}</span>
                        <button type="button" class="cf-close ${closeCls} flex items-center justify-center p-1 -mr-1">${closeHtml}</button>
                    </div>`;

        const cancelBtn  = `<button type="button" class="cf-cancel flex-1 py-2.5 rounded-lg text-sm font-semibold ${cancelCls}">${o.cancelText}</button>`;
        const confirmBtn = `<button type="button" class="cf-confirm flex-1 py-2.5 rounded-lg text-sm font-semibold ${o.confirmBg} text-white">${o.confirmText}</button>`;
        const buttonsHtml = o.reverseButtons ? confirmBtn + cancelBtn : cancelBtn + confirmBtn;

        const footerNoteHtml = o.footerNote
            ? `<p class="text-[11px] ${labelCls} text-center mt-3">${o.footerNote}</p>`
            : '';

        const overlay = $(`
            <div class="cf-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;display:flex;align-items:center;justify-content:center;padding:1rem;opacity:0;transition:opacity .15s ease;">
                <div class="cf-card ${cardBg} rounded-2xl shadow-2xl w-full p-4" style="max-width:${o.width}px;transform:scale(.96);transition:transform .15s ease;">
                    ${headerHtml}
                    <div class="space-y-3">${fieldsHtml}</div>
                    <div class="flex gap-3 mt-4">${buttonsHtml}</div>
                    ${footerNoteHtml}
                </div>
            </div>
        `);

        const collect = () => {
            const data = {};
            o.json.forEach(f => { if (f.opc !== 'display') data[f.id] = $(`#${o.id}-${f.id}`).val(); });
            return data;
        };

        const validate = () => {
            let ok = true;
            o.json.forEach(f => {
                if (f.opc === 'display' || !f.required) return;
                const $i = $(`#${o.id}-${f.id}`);
                if (!String($i.val() || '').trim()) { $i.addClass('!border-red-500'); ok = false; }
                else { $i.removeClass('!border-red-500'); }
            });
            return ok;
        };

        let closed = false;
        const onKey = (e) => { if (e.key === 'Escape') userCancel(); };
        function close() {
            if (closed) return;
            closed = true;
            $(document).off('keydown', onKey);
            overlay.css('opacity', 0);
            overlay.find('.cf-card').css('transform', 'scale(.96)');
            setTimeout(() => overlay.remove(), 150);
        }
        // Cierre por accion del usuario (X, Cancelar, Escape, clic fuera): dispara onCancel.
        // El cierre programatico via modal.close() NO lo dispara.
        function userCancel() {
            if (closed) return;
            if (typeof o.onCancel === 'function') o.onCancel();
            close();
        }

        const modal = {
            close: close,
            el: overlay,
            // Compatibilidad con codigo estilo Bootstrap: modal.modal('hide')
            modal: (action) => { if (action === 'hide') close(); }
        };

        overlay.on('mousedown', (e) => { if (e.target === overlay[0]) userCancel(); });
        overlay.find('.cf-close, .cf-cancel').on('click', userCancel);
        overlay.find('.cf-confirm').on('click', () => {
            if (!validate()) return;
            const ret = o.onConfirm(collect(), modal);
            if (ret === true) close();
        });

        $('body').append(overlay);
        // animacion de entrada
        requestAnimationFrame(() => {
            overlay.css('opacity', 1);
            overlay.find('.cf-card').css('transform', 'scale(1)');
        });
        $(document).on('keydown', onKey);
        overlay.find('[data-autofocus="1"]').first().trigger('focus');

        return modal;
    }

    if (typeof Components !== 'undefined') {
        Components.prototype.createCoffeeModalForm = function (options) { return buildModal.call(this, options); };
    }
    window.createCoffeeModalForm = buildModal;

})();
