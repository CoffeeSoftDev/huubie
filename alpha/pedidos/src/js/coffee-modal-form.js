/* ============================================================================
   createCoffeeModalForm — helper local (modulo pedidos)
   ----------------------------------------------------------------------------
   Modal estilo Huubie (dark/light) construido sobre bootbox, con API por json.
   No depende del motor coffeeForm de la v2; es autocontenido y aditivo.

   Disponible como:
     - this.createCoffeeModalForm({...})   (clases que extienden Templates)
     - createCoffeeModalForm({...})         (funcion global, clases sueltas)

   options = {
     id:          'frmModal',          // prefijo de ids de campos
     title:       'Formulario',
     icon:        'icon-doc-text',     // clase del icono del header
     iconBg:      'bg-emerald-600',
     theme:       'dark' | 'light',
     size:        '' | 'small' | 'large' | 'extra-large',
     confirmText: 'Confirmar',
     cancelText:  'Cancelar',
     json: [
       { opc:'display', id, lbl, value },                       // caja solo lectura
       { opc:'money',   id, lbl, placeholder, min, step, ... }, // input number con prefijo $
       { opc:'text'|'number', id, lbl, placeholder, prefix, required, ... }
     ],
     // onConfirm recibe los valores de los inputs y el modal.
     //   - devuelve true  -> el modal se cierra automaticamente.
     //   - devuelve otra cosa (incl. Promise) -> permanece abierto; cierra tu
     //     mismo con modal.modal('hide') cuando termines (ideal para async).
     onConfirm: (data, modal) => {}
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
            size: '',
            confirmText: 'Confirmar',
            cancelText: 'Cancelar',
            json: [],
            onConfirm: () => true
        }, options);

        const dark     = o.theme !== 'light';
        const fieldBox = dark ? 'bg-[#1a2332] border-gray-600/60 text-white'
                              : 'bg-gray-50 border-gray-300 text-gray-900';
        const labelCls = dark ? 'text-gray-400' : 'text-gray-500';
        const inputCls = dark ? 'bg-[#1a2332] border-gray-600 text-white focus:border-emerald-500'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-emerald-500';
        const titleCls = dark ? 'text-white' : 'text-gray-900';
        const cancelCls = dark ? 'btn bg-[#1a2332] hover:bg-[#243044] text-gray-300 border border-gray-600'
                               : 'btn bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300';

        const fieldHtml = (f) => {
            const lbl = `<label class="text-[10px] font-bold ${labelCls} uppercase tracking-wide block mb-1.5">${f.lbl || ''}</label>`;

            if (f.opc === 'display') {
                return `<div>${lbl}<div class="${fieldBox} border rounded-lg px-3 py-2.5 text-sm">${f.value != null ? f.value : ''}</div></div>`;
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
                f.autofocus ? 'autofocus' : ''
            ].join(' ');

            return `<div>${lbl}<div class="relative">${prefixHtml}<input id="${o.id}-${f.id}" data-field="${f.id}" type="${type}" class="w-full ${inputCls} border rounded-lg ${pad} pr-3 py-2.5 text-sm focus:outline-none" ${attrs}></div></div>`;
        };

        const body = `<div class="space-y-4">${o.json.map(fieldHtml).join('')}</div>`;

        const titleHtml = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 ${o.iconBg} rounded-lg flex items-center justify-center">
                    <i class="${o.icon} text-white"></i>
                </div>
                <span class="text-lg font-bold ${titleCls}">${o.title}</span>
            </div>`;

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

        const bbOpts = {
            title: titleHtml,
            message: body,
            closeButton: true,
            buttons: {
                cancel: {
                    label: o.cancelText,
                    className: cancelCls
                },
                confirm: {
                    label: o.confirmText,
                    className: 'btn bg-green-600 hover:bg-green-700 text-white border-0',
                    callback: () => {
                        if (!validate()) return false;
                        const ret = o.onConfirm(collect(), modal);
                        return ret === true; // true => cerrar; otro => onConfirm cierra
                    }
                }
            }
        };
        if (o.size) bbOpts.size = o.size;

        const modal = bootbox.dialog(bbOpts);
        return modal;
    }

    if (typeof Components !== 'undefined') {
        Components.prototype.createCoffeeModalForm = function (options) { return buildModal.call(this, options); };
    }
    window.createCoffeeModalForm = buildModal;

})();
