// Chat flotante de CoffeeIA. El aspecto copia el chat coffeeIA de erp-pro
// (pro/auth/src/js/nav-coffeeia.js): panel de 380×520, cabecera con la marca,
// portada de bienvenida, burbujas con hora y copiar, y caja con el "+".
// El azul de erp-pro va como blue-* para seguir el acento del tema.

class IaChat {

    constructor(options) {
        const defaults = {
            parent:      'body',
            id:          'iaChat',
            title:       'Asistente',
            subtitle:    '',
            placeholder: 'Escribe un mensaje…',
            accept:      '',
            maxFiles:    3,
            welcome:     '',
            suggestions: [],
            questions:   ['¿Por dónde empezamos?', '¿En qué te ayudo hoy?', '¿Qué buscamos hoy?', '¿Con qué arrancamos?', '¿Qué hacemos primero?'],
            labels: {
                more:       'Más opciones',
                attach:     'Adjuntar archivos',
                attachHint: 'Excel, CSV o una imagen',
                send:       'Enviar',
                expand:     'Ampliar',
                clear:      'Borrar la conversación',
                close:      'Cerrar',
                copy:       'Copiar',
                drop:       'Suéltalo aquí',
                notice:     'puede equivocarse. Comprueba los datos importantes antes de decidir con ellos.',
                reading:    'Leyendo…',
                thinking:   'Pensando',
                applying:   'Aplicando…',
                preview:    'Vista previa',
                selectAll:  'Todos',
                confirm:    'Aplicar',
                discard:    'Descartar',
                applied:    'Aplicado',
                discarded:  'Descartado',
                replaced:   'Reemplazada por una vista previa más nueva',
                nothing:    'Nada que aplicar',
                invalid:    'no aplican',
                badFormat:  'Formato no admitido',
                tooMany:    'Máximo de archivos alcanzado',
                error:      'Algo salió mal. Inténtalo otra vez.'
            },
            actions:   {},
            onAttach:  null,
            onSend:    null,
            onConfirm: null
        };

        const o = options || {};

        this.opts         = Object.assign({}, defaults, o);
        this.opts.labels  = Object.assign({}, defaults.labels, o.labels || {});
        this.opts.actions = Object.assign({}, o.actions || {});

        this.history   = [];
        this.texts     = [];
        this.files     = [];
        this.previews  = {};
        this.busy      = false;
        this.dirty     = false;
        this.expanded  = false;
        this.ticker    = null;
        this.dragDepth = 0;

        this.mount();
        this.bindEvents();
        this.welcome();
    }

    // -- Public API --

    open() {
        $(`#${this.opts.id}`).removeClass('hidden').addClass('flex');
        this.scrollBottom();
        $(`#${this.opts.id}_input`).trigger('focus');
    }

    close() {
        this.menu(false);
        $(`#${this.opts.id}`).removeClass('flex').addClass('hidden');
    }

    toggle() {
        this.isOpen() ? this.close() : this.open();
    }

    isOpen() {
        return !$(`#${this.opts.id}`).hasClass('hidden');
    }

    // Vuelve a la portada: se van mensajes, historial, adjuntos y vistas previas.
    clear() {
        if (this.busy || !this.dirty) return;
        if (Object.values(this.previews).some(p => p.state === 'applying')) return;

        this.history  = [];
        this.texts    = [];
        this.files    = [];
        this.previews = {};
        this.dirty    = false;

        $(`#${this.opts.id}_msgs`).empty();
        $(`#${this.opts.id}_input`).val('');
        this.autosize();
        this.renderChips();
        this.welcome();
        this.syncClear();
        $(`#${this.opts.id}_input`).trigger('focus');
    }

    // -- Render --

    mount() {
        const o    = this.opts;
        const l    = o.labels;
        const tool = 'w-7 h-7 p-1 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors';

        $(`#${o.id}`).remove();

        const parent = o.parent === 'body' ? $('body') : $(`#${o.parent}`);

        parent.append(`
            <div id="${o.id}" class="hidden fixed bottom-4 right-4 z-[1040] w-[380px] max-w-[calc(100vw-16px)] h-[520px] max-h-[72vh] flex-col bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_22px_55px_rgba(15,23,42,.20)] overflow-hidden transition-[width,height] duration-200">
                <div class="flex items-center justify-between gap-2 px-[11px] py-[9px] border-b border-[#F1F5F9] flex-shrink-0">
                    <div class="flex items-center gap-[9px] min-w-0 flex-1">
                        ${this.avatarBox('w-7 h-7 rounded-lg', 'w-4 h-4')}
                        <div class="min-w-0 flex-1">
                            <div class="text-[13.5px] font-bold text-[#0F2C4C] truncate">${this.marca(o.title)}</div>
                            <div class="text-[10.5px] text-[#94A3B8] mt-px truncate">${this.esc(o.subtitle)}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <button type="button" id="${o.id}_clear" title="${this.esc(l.clear)}" disabled class="${tool} disabled:text-[#E2E8F0] disabled:hover:bg-transparent disabled:cursor-not-allowed">
                            <i data-lucide="eraser" class="w-4 h-4"></i>
                        </button>
                        <button type="button" id="${o.id}_expand" title="${this.esc(l.expand)}" class="${tool}">
                            <i data-lucide="maximize-2" class="w-4 h-4"></i>
                        </button>
                        <button type="button" id="${o.id}_close" title="${this.esc(l.close)}" class="${tool}">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>

                <div id="${o.id}_msgs" class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-[14px] flex flex-col gap-[11px] bg-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#E2E8F0] hover:[&::-webkit-scrollbar-thumb]:bg-[#CBD5E1]"></div>

                <div class="relative border-t border-[#F1F5F9] bg-[#F8FAFC] px-3 py-[11px] flex-shrink-0">
                    <div id="${o.id}_chips" class="hidden flex-wrap gap-[5px] mb-1.5 max-h-[135px] overflow-y-auto"></div>
                    <div class="flex items-end gap-[7px] bg-white border border-[#CBD5E1] rounded-[11px] p-1 transition-shadow focus-within:border-[#7C3AED] focus-within:shadow-[0_0_0_3px_rgba(124,58,237,.13)]">
                        <div class="relative flex-shrink-0">
                            <button type="button" id="${o.id}_plus" title="${this.esc(l.more)}" aria-haspopup="true" aria-expanded="false" class="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#7C3AED] transition-colors">
                                <i data-lucide="plus" class="w-[17px] h-[17px] transition-transform duration-150"></i>
                            </button>
                            <div id="${o.id}_menu" role="menu" class="hidden absolute left-0 bottom-[calc(100%+10px)] z-[46] min-w-[232px] p-1 bg-white border border-[#DBE2EA] rounded-[11px] shadow-[0_12px_28px_rgba(15,44,76,.16)]">
                                <button type="button" id="${o.id}_attach" role="menuitem" class="group flex items-center gap-2.5 w-full px-[9px] py-[7px] rounded-lg text-left text-[#0F2C4C] hover:bg-[#F5F3FF]">
                                    <span class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#F1F5F9] text-[#475569] group-hover:bg-[#EDE9FE] group-hover:text-[#7C3AED]">
                                        <i data-lucide="paperclip" class="w-[15px] h-[15px]"></i>
                                    </span>
                                    <span class="min-w-0 flex flex-col leading-[1.3]">
                                        <b class="text-[12px] font-bold">${this.esc(l.attach)}</b>
                                        <span class="text-[10.5px] text-[#8B99AB] truncate max-w-[170px]">${this.esc(l.attachHint)}</span>
                                    </span>
                                </button>
                            </div>
                        </div>
                        <textarea id="${o.id}_input" rows="1" placeholder="${this.esc(o.placeholder)}" class="flex-1 min-w-0 resize-none bg-transparent border-0 outline-none text-[12.5px] leading-[1.45] text-[#1E293B] placeholder:text-[#94A3B8] py-1.5 px-0.5 max-h-[132px]"></textarea>
                        <button type="button" id="${o.id}_send" title="${this.esc(l.send)}" class="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-white bg-gradient-to-br from-blue-800 to-blue-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 transition-opacity">
                            <i data-lucide="arrow-up" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <input type="file" id="${o.id}_file" class="hidden" multiple accept="${this.esc(o.accept)}">
                </div>

                <div id="${o.id}_drop" class="hidden absolute inset-0 z-40 items-center justify-center rounded-2xl bg-[rgba(248,250,252,.96)] border-2 border-dashed border-[#7C3AED] pointer-events-none">
                    <div class="flex flex-col items-center gap-[5px] text-center px-5 text-[#7C3AED]">
                        <i data-lucide="file-up" class="w-6 h-6"></i>
                        <b class="text-[13px]">${this.esc(l.drop)}</b>
                        <span class="text-[11px] text-[#64748B]">${this.esc(l.attachHint)}</span>
                    </div>
                </div>
            </div>`);

        this.icons();
    }

    // Portada: fecha, saludo, pregunta al azar y sugerencias. Se va con el primer mensaje.
    welcome() {
        const o      = this.opts;
        const hora   = new Date().getHours();
        const saludo = hora < 12 ? 'Buenos días' : (hora < 20 ? 'Buenas tardes' : 'Buenas noches');
        const preg   = o.questions[Math.floor(Math.random() * o.questions.length)] || '';

        const chips = o.suggestions.map(s => `
            <button type="button" data-suggestion="${this.esc(s)}" class="inline-flex items-center gap-1.5 px-3 py-[7px] border border-[#E2E8F0] rounded-full bg-white text-[11.5px] font-medium text-[#42546B] leading-[1.2] text-left hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                <i data-lucide="corner-down-right" class="w-3 h-3 flex-shrink-0 text-[#94A3B8]"></i>${this.esc(s)}
            </button>`).join('');

        this.appendNode(`
            <div data-hola class="flex flex-col flex-grow text-center px-[14px] pt-[18px] pb-1.5">
                <div class="my-auto flex flex-col items-center">
                    ${this.avatarBox('w-16 h-16 mb-3 rounded-full', 'w-7 h-7')}
                    <div class="mb-2.5 text-[9.5px] font-semibold tracking-[.2em] uppercase text-[#94A3B8]">${this.esc(this.fechaHoy())}</div>
                    <div class="text-[24px] font-medium text-[#0F172A] tracking-[-.5px] leading-[1.15]">Hola, soy ${this.marca(o.title)}</div>
                    <p class="mt-[5px] text-[13.5px] leading-[1.4] text-[#64748B]">${saludo}</p>
                    <div class="mt-4 text-[15px] font-bold text-[#0F172A] tracking-[-.2px]">${this.esc(preg)}</div>
                    <span class="block w-[46px] h-[3px] mx-auto mt-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-200"></span>
                    ${o.welcome ? `<p class="mt-3 text-[11.5px] leading-[1.5] text-[#64748B] whitespace-pre-wrap">${this.esc(o.welcome)}</p>` : ''}
                    ${chips ? `<div class="mt-3 flex flex-wrap justify-center gap-1.5">${chips}</div>` : ''}
                </div>
                <div class="pt-4 text-[9.5px] leading-[1.45] text-[#94A3B8]">${this.esc(o.title)} ${this.esc(o.labels.notice)}</div>
            </div>`);
    }

    // -- Mensajes --

    addMessage(role, text, fileNames) {
        const esUser = role === 'user';
        const idx    = this.texts.push(String(text || '')) - 1;
        const tone   = esUser
            ? 'bg-blue-600 text-white rounded-[13px] rounded-br-[4px]'
            : (role === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200 rounded-[13px] rounded-bl-[4px]'
                : 'bg-[#F1F5F9] text-[#1E293B] rounded-[13px] rounded-bl-[4px]');

        const files = (fileNames || []).map(n => `
            <span class="inline-flex items-center gap-1 text-[10.5px] bg-white/20 rounded-md px-1.5 py-0.5"><i data-lucide="paperclip" class="w-3 h-3"></i>${this.esc(n)}</span>`).join('');

        const copy = text ? `
            <button type="button" data-copy="${idx}" title="${this.esc(this.opts.labels.copy)}" class="p-[3px] rounded-[5px] leading-none text-[#94A3B8] hover:bg-[rgba(15,44,76,.06)] hover:text-blue-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all">
                <i data-lucide="copy" class="w-3 h-3"></i>
            </button>` : '';

        this.appendNode(`
            <div class="flex ${esUser ? 'justify-end' : ''} min-w-0">
                <div class="group flex flex-col ${esUser ? 'items-end' : 'items-start'} min-w-0 max-w-[92%]">
                    <div class="max-w-full ${tone} px-3 py-[9px] text-[12.5px] leading-[1.5] whitespace-pre-wrap break-words">${files ? `<div class="flex flex-wrap gap-1 ${text ? 'mb-[5px]' : ''}">${files}</div>` : ''}${this.esc(text)}</div>
                    <div class="mt-[3px] px-[3px] flex items-center gap-1.5 ${esUser ? 'flex-row-reverse' : ''}">
                        <span class="text-[10px] text-[#94A3B8] tabular-nums tracking-[.02em]">${this.hora()}</span>
                        ${copy}
                    </div>
                </div>
            </div>`);
    }

    setBusy(on, label) {
        const o = this.opts;

        this.busy = on;
        this.syncSend();
        this.syncClear();

        clearInterval(this.ticker);
        $(`#${o.id}_typing`).remove();

        if (!on) return;

        const inicio = Date.now();

        // Mientras trabaja: la animación «Cargando» del vestidor de erp-pro
        // (coffeeIA avanza dentro de una barra); sin el motor, los tres puntos.
        const carga = this.avatar('p_carga', '#F1F5F9');
        const espera = carga
            ? `<span class="w-24 h-24 -my-7 -ml-2 flex-shrink-0 [&>svg]:w-full [&>svg]:h-full">${carga}</span>`
            : `<span class="w-1.5 h-1.5 rounded-full bg-[#94A3B8] animate-pulse"></span>
               <span class="w-1.5 h-1.5 rounded-full bg-[#94A3B8] animate-pulse [animation-delay:180ms]"></span>
               <span class="w-1.5 h-1.5 rounded-full bg-[#94A3B8] animate-pulse [animation-delay:360ms]"></span>`;

        this.appendNode(`
            <div id="${o.id}_typing" class="flex">
                <div class="bg-[#F1F5F9] rounded-[13px] rounded-bl-[4px] px-3 py-[11px] flex items-center gap-1 overflow-hidden">
                    ${espera}
                    <span class="ml-1 text-[11px] italic font-semibold text-[#64748B]">${this.esc(label || o.labels.thinking)} <span id="${o.id}_secs" class="not-italic font-normal tabular-nums">0 s</span></span>
                </div>
            </div>`);

        this.ticker = setInterval(() => {
            $(`#${o.id}_secs`).text(Math.round((Date.now() - inicio) / 1000) + ' s');
        }, 1000);
    }

    // -- Vista previa --

    addPreview(response) {
        const o     = this.opts;
        const l     = o.labels;
        const token = response.token || '';
        const rows  = response.row || [];
        const uid   = `${o.id}_pv${Date.now()}`;

        Object.keys(this.previews).forEach(t => {
            if (this.previews[t].state === 'pending') this.closePreview(t, 'replaced');
        });

        const validos = rows.filter(r => r.valid).length;
        const counts  = Object.keys(o.actions).map(a => {
            const n = rows.filter(r => r.valid && r.action === a).length;
            return n ? this.badge(o.actions[a], `${n} ${o.actions[a].label}`) : '';
        }).join('');
        const invalid = rows.length - validos;

        this.appendNode(`
            <div id="${uid}" class="w-full">
                <div class="bg-white border border-[#E2E8F0] rounded-[11px] overflow-hidden shadow-sm">
                    <div class="flex items-center justify-between gap-2 px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <span class="flex items-center gap-1.5 text-xs font-semibold text-[#0F2C4C]">
                            <i data-lucide="list-checks" class="w-3.5 h-3.5 text-blue-600"></i>${this.esc(l.preview)} · ${rows.length}
                        </span>
                        ${validos ? `<label class="flex items-center gap-1.5 text-[11px] text-[#64748B] cursor-pointer select-none"><input type="checkbox" data-all checked class="w-3.5 h-3.5 accent-blue-600 cursor-pointer">${this.esc(l.selectAll)}</label>` : ''}
                    </div>
                    <div class="flex flex-wrap gap-1.5 px-3 pt-2">
                        ${counts}${invalid ? this.badge({ tone: 'bg-gray-100 text-gray-500' }, `${invalid} ${l.invalid}`) : ''}
                    </div>
                    <ul class="${this.expanded ? 'max-h-[55vh]' : 'max-h-[280px]'} overflow-y-auto divide-y divide-[#F1F5F9] mt-1" data-list>
                        ${rows.map(r => this.previewRow(r)).join('')}
                    </ul>
                    <div class="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#E2E8F0] bg-[#F8FAFC]" data-footer>
                        <span class="text-[11px] text-[#64748B] min-w-0" data-status>${validos ? '' : this.esc(l.nothing)}</span>
                        ${validos && token ? `
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <button type="button" data-discard class="px-3 py-1.5 text-xs font-medium text-[#475569] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F1F5F9] transition-colors">${this.esc(l.discard)}</button>
                            <button type="button" data-confirm class="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors">
                                <i data-lucide="check" class="w-3.5 h-3.5"></i><span data-confirm-text>${this.esc(l.confirm)} ${validos}</span>
                            </button>
                        </div>` : ''}
                    </div>
                </div>
            </div>`);

        if (!validos || !token) return;

        this.previews[token] = { uid: uid, state: 'pending' };

        const card = $(`#${uid}`);

        card.on('change', '[data-all]', e => {
            card.find('[data-row]:not(:disabled)').prop('checked', e.target.checked);
            this.syncPreview(token);
        });

        card.on('change', '[data-row]', () => this.syncPreview(token));
        card.on('click', '[data-discard]', () => this.closePreview(token, 'discarded'));
        card.on('click', '[data-confirm]', () => this.confirmPreview(token));
    }

    previewRow(r) {
        const a       = this.opts.actions[r.action] || { label: r.action, tone: 'bg-gray-100 text-gray-600' };
        const changes = (r.changes && r.changes.length) ? r.changes : (r.after ? [{ label: '', before: r.before, after: r.after }] : []);
        const lines   = changes.map(ch => `
                    <div class="text-[11px] text-gray-500 mt-0.5 break-words">
                        ${ch.label ? `<span class="text-gray-400">${this.esc(ch.label)}:</span> ` : ''}${this.change(ch.before, ch.after)}
                    </div>`).join('');

        return `
            <li class="flex items-start gap-2 px-3 py-2 ${r.valid ? '' : 'bg-gray-50/60'}">
                <input type="checkbox" data-row="${r.idx}" data-action="${this.esc(r.action)}" data-valid="${r.valid ? 1 : 0}" ${r.valid ? 'checked' : 'disabled'} class="mt-0.5 w-3.5 h-3.5 accent-blue-600 cursor-pointer disabled:cursor-not-allowed flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 min-w-0">
                        ${this.badge(a, a.label)}
                        ${r.tag ? `<span class="text-[10px] font-medium uppercase tracking-wide text-gray-400 flex-shrink-0">${this.esc(r.tag)}</span>` : ''}
                        <span class="text-[12px] font-medium truncate ${r.valid ? 'text-gray-800' : 'text-gray-400 line-through'}" title="${this.esc(r.name)}">${this.esc(r.name)}</span>
                        ${r.sku ? `<span class="text-[10px] text-gray-400 flex-shrink-0">${this.esc(r.sku)}</span>` : ''}
                    </div>
                    ${r.valid ? lines : ''}
                    ${r.valid && r.detail ? `<div class="text-[11px] text-gray-400">${this.esc(r.detail)}</div>` : ''}
                    ${r.warn ? `<div class="text-[11px] text-amber-600 mt-0.5 flex items-start gap-1"><i data-lucide="alert-triangle" class="w-3 h-3 mt-0.5 flex-shrink-0"></i><span>${this.esc(r.warn)}</span></div>` : ''}
                    ${r.note ? `<div class="text-[11px] text-red-600 mt-0.5">${this.esc(r.note)}</div>` : ''}
                </div>
            </li>`;
    }

    syncPreview(token) {
        const card  = $(`#${this.previews[token].uid}`);
        const total = card.find('[data-row]:not(:disabled)').length;
        const sel   = card.find('[data-row]:checked:not(:disabled)').length;

        card.find('[data-all]').prop('checked', sel === total).prop('indeterminate', sel > 0 && sel < total);
        card.find('[data-confirm]').prop('disabled', sel === 0);
        card.find('[data-confirm-text]').text(`${this.opts.labels.confirm} ${sel}`);
        this.disarmPreview(token);
    }

    // Una acción con "confirm" (vaciar) pide un segundo clic: el primero solo arma el botón.
    armPreview(token, action) {
        const card = $(`#${this.previews[token].uid}`);

        this.previews[token].armed = true;
        card.find('[data-confirm]').removeClass('bg-blue-600 hover:bg-blue-500').addClass('bg-red-600 hover:bg-red-500');
        card.find('[data-confirm-text]').text(action.confirmLabel || this.opts.labels.confirm);
        card.find('[data-status]').removeClass('text-[#64748B]').addClass('text-red-600 font-medium').text(action.confirm);
    }

    disarmPreview(token) {
        const pv   = this.previews[token];
        const card = $(`#${pv.uid}`);

        card.find('[data-confirm]').removeClass('bg-red-600 hover:bg-red-500').addClass('bg-blue-600 hover:bg-blue-500');

        if (!pv.armed) return;

        pv.armed = false;
        card.find('[data-status]').removeClass('text-red-600 font-medium').addClass('text-[#64748B]').text('');
    }

    async confirmPreview(token) {
        const l    = this.opts.labels;
        const pv   = this.previews[token];
        const card = $(`#${pv.uid}`);
        const sel  = card.find('[data-row]:checked:not(:disabled)');
        const ids  = sel.map((i, el) => Number($(el).data('row'))).get();

        if (!ids.length || pv.state !== 'pending' || typeof this.opts.onConfirm !== 'function') return;

        const risky = sel.map((i, el) => this.opts.actions[$(el).data('action')]).get().find(a => a && a.confirm);

        if (risky && !pv.armed) {
            this.armPreview(token, risky);
            return;
        }

        pv.armed = false;

        pv.state = 'applying';
        card.find('input, [data-discard]').prop('disabled', true);
        card.find('[data-confirm]').prop('disabled', true).html(`<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>${this.esc(l.applying)}`);
        card.find('[data-status]').removeClass('text-red-600').addClass('text-[#64748B]').text('');
        this.icons();

        let r = null;

        try {
            r = await this.opts.onConfirm(token, ids);
        } catch (e) {
            r = null;
        }

        if (r && r.status === 200) {
            this.closePreview(token, 'applied', r.message);
            this.addMessage('assistant', r.message || l.applied);
            this.history.push({ role: 'assistant', content: `Se aplicaron los cambios: ${r.message || ''}` });
            return;
        }

        pv.state = 'pending';
        card.find('[data-row][data-valid="1"], [data-all], [data-discard]').prop('disabled', false);
        card.find('[data-confirm]').html(`<i data-lucide="check" class="w-3.5 h-3.5"></i><span data-confirm-text></span>`);
        card.find('[data-status]').removeClass('text-[#64748B]').addClass('text-red-600').text((r && r.message) || l.error);
        this.icons();
        this.syncPreview(token);
    }

    closePreview(token, state, message) {
        const l    = this.opts.labels;
        const pv   = this.previews[token];
        const card = $(`#${pv.uid}`);
        const text = { applied: message || l.applied, discarded: l.discarded, replaced: l.replaced }[state];
        const icon = { applied: 'check-circle-2', discarded: 'x-circle', replaced: 'history' }[state];
        const tone = state === 'applied' ? 'text-emerald-600' : 'text-[#64748B]';

        pv.state = state;
        card.find('input').prop('disabled', true);
        card.find('[data-footer]').html(`<span class="flex items-center gap-1.5 text-[11px] font-medium ${tone}"><i data-lucide="${icon}" class="w-3.5 h-3.5 flex-shrink-0"></i>${this.esc(text)}</span>`);
        this.icons();
    }

    // -- Envío --

    async send() {
        const o     = this.opts;
        const input = $(`#${o.id}_input`);
        const text  = String(input.val() || '').trim();
        const files = this.files.filter(f => f.status === 'ok');

        if (this.busy || this.files.some(f => f.status === 'reading') || typeof o.onSend !== 'function') return;
        if (!text && !files.length) return;

        input.val('');
        this.autosize();
        this.menu(false);
        $(`#${o.id}_msgs [data-hola]`).remove();

        const names   = files.map(f => f.name);
        const history = this.history.slice(-8);

        this.addMessage('user', text, names);
        this.history.push({ role: 'user', content: text + (names.length ? `\n(Adjuntó: ${names.join(', ')})` : '') });
        this.dirty = true;
        this.setBusy(true);

        let r = null;

        try {
            r = await o.onSend(text, files.map(f => ({ nombre: f.name, texto: f.texto })), history);
        } catch (e) {
            r = null;
        }

        this.setBusy(false);

        if (!r || r.status !== 200) {
            this.history.pop();
            this.addMessage('error', (r && r.message) || o.labels.error);
            return;
        }

        this.addMessage('assistant', r.reply || '');

        if (r.row && r.row.length) this.addPreview(r);

        this.history.push({ role: 'assistant', content: this.historyText(r) });
    }

    historyText(r) {
        const rows = r.row || [];

        if (!rows.length) return r.reply || '';

        const lines = rows.slice(0, 40).map(x => {
            const a      = this.opts.actions[x.action] ? this.opts.actions[x.action].label : x.action;
            const campos = (x.changes || []).map(ch => `${ch.label} ${ch.after}`).join(', ') || x.after || '';
            return `${a} ${x.tag ? x.tag.toLowerCase() + ' ' : ''}${x.name}${campos ? ' (' + campos + ')' : ''}${x.valid ? '' : ' [no aplica: ' + x.note + ']'}`;
        });

        return `${r.reply || ''}\n[Vista previa] ${lines.join('; ')}`;
    }

    // Copia el texto crudo del mensaje. navigator.clipboard pide https o localhost;
    // en la red interna por http queda el respaldo con execCommand.
    copy(btn) {
        const text = this.texts[Number($(btn).data('copy'))] || '';
        const ok   = () => {
            $(btn).addClass('!text-emerald-600 !bg-emerald-50 !opacity-100');
            setTimeout(() => $(btn).removeClass('!text-emerald-600 !bg-emerald-50 !opacity-100'), 1500);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(ok).catch(() => this.copyLegacy(text, ok));
            return;
        }

        this.copyLegacy(text, ok);
    }

    copyLegacy(text, ok) {
        const area = $('<textarea>', { class: 'fixed -left-[9999px] top-0' }).val(text).appendTo('body');

        area[0].select();

        try {
            if (document.execCommand('copy')) ok();
        } catch (e) { }

        area.remove();
    }

    // -- Adjuntos --

    async addFiles(fileList) {
        const o = this.opts;
        const l = o.labels;

        for (const file of Array.from(fileList || [])) {
            const item = { uid: 'f' + Date.now() + Math.random().toString(36).slice(2, 6), name: file.name || 'captura.png', status: 'reading', texto: '', detalle: '' };

            if (this.files.length >= o.maxFiles) {
                this.addMessage('error', `${l.tooMany} (${o.maxFiles}).`);
                break;
            }

            this.files.push(item);

            if (!this.accepts(item.name)) {
                Object.assign(item, { status: 'error', detalle: l.badFormat });
                this.renderChips();
                continue;
            }

            this.renderChips();

            let r = null;

            try {
                r = typeof o.onAttach === 'function' ? await o.onAttach(file) : null;
            } catch (e) {
                r = null;
            }

            if (!this.files.includes(item)) continue;

            if (r && r.status === 200 && r.data) {
                Object.assign(item, { status: 'ok', texto: r.data.texto || '', detalle: r.data.detalle || '', clase: r.data.clase || '' });
            } else {
                Object.assign(item, { status: 'error', detalle: (r && r.message) || l.error });
            }

            this.renderChips();
        }
    }

    removeFile(uid) {
        this.files = this.files.filter(f => f.uid !== uid);
        this.renderChips();
    }

    renderChips() {
        const o     = this.opts;
        const chips = $(`#${o.id}_chips`);

        if (!this.files.length) {
            chips.removeClass('flex').addClass('hidden').empty();
            this.syncSend();
            return;
        }

        const tones = {
            reading: 'bg-[#F8FAFC] border-[#E2E8F0] text-[#334155] opacity-60',
            ok:      'bg-[#F8FAFC] border-[#E2E8F0] text-[#334155]',
            error:   'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
        };

        chips.removeClass('hidden').addClass('flex').html(this.files.map(f => {
            const icon = f.status === 'reading' ? 'loader-2' : (f.status === 'error' ? 'alert-circle' : (f.clase === 'imagen' ? 'image' : 'file-spreadsheet'));
            const info = f.status === 'reading' ? o.labels.reading : f.detalle;

            return `
                <span class="flex items-center gap-1.5 max-w-[calc(50%-3px)] border rounded-[9px] px-[7px] py-[5px] text-[11px] ${tones[f.status]}" title="${this.esc(f.name)}${info ? ' · ' + this.esc(info) : ''}">
                    <i data-lucide="${icon}" class="w-3.5 h-3.5 flex-shrink-0 ${f.status === 'reading' ? 'animate-spin' : ''}"></i>
                    <span class="min-w-0 flex flex-col leading-[1.25]">
                        <span class="font-semibold truncate">${this.esc(f.name)}</span>
                        ${info ? `<span class="text-[10px] opacity-75 truncate">${this.esc(info)}</span>` : ''}
                    </span>
                    <button type="button" data-remove="${f.uid}" class="flex-shrink-0 opacity-50 hover:opacity-100"><i data-lucide="x" class="w-3 h-3"></i></button>
                </span>`;
        }).join(''));

        this.icons();
        this.syncSend();
    }

    accepts(name) {
        const list = String(this.opts.accept || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
        const ext  = '.' + String(name).toLowerCase().split('.').pop();

        return !list.length || list.includes(ext);
    }

    // -- Eventos --

    bindEvents() {
        const o     = this.opts;
        const panel = $(`#${o.id}`);
        const input = $(`#${o.id}_input`);
        const file  = $(`#${o.id}_file`);

        $(`#${o.id}_close`).on('click', () => this.close());
        $(`#${o.id}_clear`).on('click', () => this.clear());
        $(`#${o.id}_expand`).on('click', () => this.toggleExpand());
        $(`#${o.id}_send`).on('click', () => this.send());
        $(`#${o.id}_plus`).on('click', () => this.menu($(`#${o.id}_menu`).hasClass('hidden')));

        $(`#${o.id}_attach`).on('click', () => {
            this.menu(false);
            file.trigger('click');
        });

        $(document).off(`mousedown.${o.id}`).on(`mousedown.${o.id}`, e => {
            if (!$(e.target).closest(`#${o.id}_plus, #${o.id}_menu`).length) this.menu(false);
        });

        file.on('change', () => {
            this.addFiles(file[0].files);
            file.val('');
        });

        input.on('input', () => {
            this.autosize();
            this.syncSend();
        });

        input.on('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.send();
            }
            if (e.key === 'Escape') this.close();
        });

        input.on('paste', e => {
            const cb = e.originalEvent.clipboardData;

            if (cb && cb.files && cb.files.length) {
                e.preventDefault();
                this.addFiles(cb.files);
            }
        });

        panel.on('click', '[data-suggestion]', e => {
            input.val($(e.currentTarget).data('suggestion')).trigger('input').trigger('focus');
        });

        panel.on('click', '[data-copy]', e => this.copy(e.currentTarget));
        panel.on('click', '[data-remove]', e => this.removeFile(String($(e.currentTarget).data('remove'))));

        panel.on('dragenter', e => {
            e.preventDefault();
            this.dragDepth++;
            $(`#${o.id}_drop`).removeClass('hidden').addClass('flex');
        });

        panel.on('dragover', e => e.preventDefault());

        panel.on('dragleave', () => {
            this.dragDepth = Math.max(0, this.dragDepth - 1);
            if (!this.dragDepth) $(`#${o.id}_drop`).removeClass('flex').addClass('hidden');
        });

        panel.on('drop', e => {
            e.preventDefault();
            this.dragDepth = 0;
            $(`#${o.id}_drop`).removeClass('flex').addClass('hidden');
            this.addFiles(e.originalEvent.dataTransfer.files);
        });

        this.syncSend();
    }

    toggleExpand() {
        const o     = this.opts;
        const panel = $(`#${o.id}`);

        this.expanded = !this.expanded;

        panel.toggleClass('w-[380px] h-[520px] max-h-[72vh]', !this.expanded).toggleClass('w-[680px] h-[calc(100vh-5rem)] max-h-[calc(100vh-5rem)]', this.expanded);
        panel.find('[data-list]').toggleClass('max-h-[280px]', !this.expanded).toggleClass('max-h-[55vh]', this.expanded);
        $(`#${o.id}_expand`).html(`<i data-lucide="${this.expanded ? 'minimize-2' : 'maximize-2'}" class="w-4 h-4"></i>`);
        this.icons();
    }

    // El "+" gira a "×" mientras su menú está abierto.
    menu(open) {
        const o = this.opts;

        $(`#${o.id}_menu`).toggleClass('hidden', !open);
        $(`#${o.id}_plus`).attr('aria-expanded', open ? 'true' : 'false').toggleClass('!bg-[#F1F5F9] !text-[#7C3AED]', open);
        $(`#${o.id}_plus svg`).toggleClass('rotate-45', open);
    }

    // -- Helpers --

    syncSend() {
        const o        = this.opts;
        const reading  = this.files.some(f => f.status === 'reading');
        const hasFiles = this.files.some(f => f.status === 'ok');
        const hasText  = String($(`#${o.id}_input`).val() || '').trim() !== '';

        $(`#${o.id}_send`).prop('disabled', this.busy || reading || (!hasText && !hasFiles));
    }

    // Sin nada que borrar la goma va apagada: así no se dispara por accidente.
    syncClear() {
        $(`#${this.opts.id}_clear`).prop('disabled', this.busy || !this.dirty);
    }

    autosize() {
        const el = document.getElementById(`${this.opts.id}_input`);

        if (!el) return;

        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 132) + 'px';
    }

    appendNode(html) {
        $(`#${this.opts.id}_msgs`).append(html);
        this.icons();
        this.scrollBottom();
    }

    scrollBottom() {
        const msgs = document.getElementById(`${this.opts.id}_msgs`);

        if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

    // El muñeco de coffeeIA: la receta de casa del motor de erp-pro (forja-blob.js,
    // window.Bloub). Es SVG animado --se mueve solo, sin bucle en JS-- y se arma
    // en cada llamada (~10 ms): cada copia trae sus propios ids de recorte y
    // reusar la cadena los repetiría en la página. Sin el motor devuelve '' y
    // quien llama deja el ícono de destellos.
    avatar(anim, fondo) {
        const B = window.Bloub;
        if (!B || !B.CASA) return '';

        return B.animado(B.receta(Object.assign({}, B.CASA[0], { anim: anim, fondo: fondo })), { centrado: true });
    }

    // Recuadro del muñeco en reposo (cabecera y portada); sin motor, los destellos.
    avatarBox(box, iconSize) {
        const cara = this.avatar('ninguna', '#F8F8F8');

        return cara
            ? `<span class="${box} bg-[#F8F8F8] border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0 [&>svg]:w-full [&>svg]:h-full">${cara}</span>`
            : `<span class="${box} bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0"><i data-lucide="sparkles" class="${iconSize}"></i></span>`;
    }

    // "CoffeeIA" con el "IA" en el acento, como la marca de erp-pro.
    marca(title) {
        const t = String(title || '');
        const m = t.match(/^(.*?)(IA)$/);

        if (!m) return this.esc(t);

        return `<span class="font-extrabold tracking-[-.02em] text-[#0F172A]">${this.esc(m[1])}<b class="font-extrabold text-blue-600">IA</b></span>`;
    }

    fechaHoy() {
        try {
            return new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
        } catch (e) {
            return '';
        }
    }

    hora() {
        const d = new Date();
        const h = d.getHours();

        return `${(h % 12) || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
    }

    change(before, after) {
        const antes = before && before !== '—' ? `${this.esc(before)} <i data-lucide="arrow-right" class="inline w-3 h-3 mx-0.5 -mt-px"></i> ` : '';

        return `${antes}<b class="font-semibold text-gray-800">${this.esc(after)}</b>`;
    }

    badge(action, text) {
        return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none flex-shrink-0 ${action.tone || 'bg-gray-100 text-gray-600'}">${this.esc(text)}</span>`;
    }

    icons() {
        if (window.lucide) lucide.createIcons();
    }

    esc(s) {
        return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
}


Templates.prototype.iaChat = function (options) {
    const chat = new IaChat(options);
    chat.tpl = this;
    return chat;
};
