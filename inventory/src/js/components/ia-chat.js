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
            labels: {
                attach:    'Adjuntar archivo',
                send:      'Enviar',
                expand:    'Ampliar',
                close:     'Cerrar',
                hint:      'Enter envía · Shift+Enter hace salto de línea · Puedes pegar una captura',
                drop:      'Suelta el archivo aquí',
                reading:   'Leyendo…',
                thinking:  'Pensando',
                applying:  'Aplicando…',
                preview:   'Vista previa',
                selectAll: 'Todos',
                confirm:   'Aplicar',
                discard:   'Descartar',
                applied:   'Aplicado',
                discarded: 'Descartado',
                replaced:  'Reemplazada por una vista previa más nueva',
                nothing:   'Nada que aplicar',
                invalid:   'no aplican',
                badFormat: 'Formato no admitido',
                tooMany:   'Máximo de archivos alcanzado',
                error:     'Algo salió mal. Inténtalo otra vez.'
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
        this.files     = [];
        this.previews  = {};
        this.busy      = false;
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
        $(`#${this.opts.id}`).removeClass('flex').addClass('hidden');
    }

    toggle() {
        this.isOpen() ? this.close() : this.open();
    }

    isOpen() {
        return !$(`#${this.opts.id}`).hasClass('hidden');
    }

    // -- Render --

    mount() {
        const o = this.opts;
        const l = o.labels;

        $(`#${o.id}`).remove();

        const parent = o.parent === 'body' ? $('body') : $(`#${o.parent}`);

        parent.append(`
            <div id="${o.id}" class="hidden fixed bottom-4 right-4 z-[1040] w-[400px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-5rem)] flex-col bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden transition-[width,height] duration-200">
                <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                    <div class="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/20 flex-shrink-0">
                        <i data-lucide="sparkles" class="w-4 h-4 text-white"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-sm font-bold text-gray-800 leading-tight truncate">${this.esc(o.title)}</h3>
                        <p class="text-[11px] text-gray-500 truncate">${this.esc(o.subtitle)}</p>
                    </div>
                    <button type="button" id="${o.id}_expand" title="${this.esc(l.expand)}" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors">
                        <i data-lucide="maximize-2" class="w-4 h-4"></i>
                    </button>
                    <button type="button" id="${o.id}_close" title="${this.esc(l.close)}" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>

                <div id="${o.id}_msgs" class="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3 bg-white"></div>

                <div class="border-t border-gray-200 bg-white px-3 pt-2 pb-2.5 flex-shrink-0">
                    <div id="${o.id}_chips" class="hidden flex-wrap gap-1.5 mb-2"></div>
                    <div class="flex items-end gap-1.5 bg-gray-50 border border-gray-300 rounded-xl px-1.5 py-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 transition-all">
                        <button type="button" id="${o.id}_attach" title="${this.esc(l.attach)}" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-blue-700 hover:bg-blue-50 transition-colors flex-shrink-0">
                            <i data-lucide="paperclip" class="w-4 h-4"></i>
                        </button>
                        <textarea id="${o.id}_input" rows="1" placeholder="${this.esc(o.placeholder)}" class="flex-1 min-w-0 resize-none bg-transparent border-0 outline-none text-[13px] leading-5 text-gray-800 placeholder:text-gray-400 py-1.5 max-h-32"></textarea>
                        <button type="button" id="${o.id}_send" title="${this.esc(l.send)}" class="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0">
                            <i data-lucide="arrow-up" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <p class="text-[10px] text-gray-400 mt-1.5 px-1 truncate">${this.esc(l.hint)}</p>
                    <input type="file" id="${o.id}_file" class="hidden" multiple accept="${this.esc(o.accept)}">
                </div>

                <div id="${o.id}_drop" class="hidden absolute inset-0 z-10 items-center justify-center bg-blue-600/10 border-2 border-dashed border-blue-500 rounded-2xl pointer-events-none">
                    <span class="px-3 py-1.5 rounded-lg bg-white text-sm font-semibold text-blue-700 shadow">${this.esc(l.drop)}</span>
                </div>
            </div>`);

        this.icons();
    }

    welcome() {
        const o = this.opts;

        if (!o.welcome) return;

        this.addMessage('assistant', o.welcome);

        if (!o.suggestions.length) return;

        const chips = o.suggestions.map(s => `
            <button type="button" data-suggestion="${this.esc(s)}" class="text-left text-[11px] px-2.5 py-1 rounded-full border border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-700 transition-colors">${this.esc(s)}</button>`).join('');

        this.appendNode(`<div class="flex flex-wrap gap-1.5 pl-9">${chips}</div>`);
    }

    // -- Mensajes --

    addMessage(role, text, fileNames) {
        const esUser = role === 'user';
        const tone   = role === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200 rounded-2xl rounded-tl-md'
            : 'bg-gray-100 text-gray-800 rounded-2xl rounded-tl-md';

        const files = (fileNames || []).map(n => `
            <span class="inline-flex items-center gap-1 text-[10px] bg-white/20 rounded px-1.5 py-0.5"><i data-lucide="paperclip" class="w-3 h-3"></i>${this.esc(n)}</span>`).join('');

        if (esUser) {
            this.appendNode(`
                <div class="flex justify-end">
                    <div class="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-br-md px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words">${this.esc(text)}${files ? `<div class="flex flex-wrap gap-1 ${text ? 'mt-1.5' : ''}">${files}</div>` : ''}</div>
                </div>`);
            return;
        }

        this.appendNode(`
            <div class="flex items-start gap-2">
                ${this.avatar(role === 'error' ? 'alert-circle' : 'sparkles', role === 'error')}
                <div class="max-w-[85%] ${tone} px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words">${this.esc(text)}</div>
            </div>`);
    }

    setBusy(on, label) {
        const o = this.opts;

        this.busy = on;
        this.syncSend();

        clearInterval(this.ticker);
        $(`#${o.id}_typing`).remove();

        if (!on) return;

        const inicio = Date.now();

        this.appendNode(`
            <div id="${o.id}_typing" class="flex items-start gap-2">
                ${this.avatar('sparkles', false)}
                <div class="bg-gray-100 rounded-2xl rounded-tl-md px-3 py-2.5 flex items-center gap-2">
                    <span class="flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"></span>
                        <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]"></span>
                        <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]"></span>
                    </span>
                    <span class="text-[11px] text-gray-500">${this.esc(label || o.labels.thinking)} <span id="${o.id}_secs">0 s</span></span>
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
            <div id="${uid}" class="pl-9">
                <div class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div class="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <span class="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                            <i data-lucide="list-checks" class="w-3.5 h-3.5 text-blue-600"></i>${this.esc(l.preview)} · ${rows.length}
                        </span>
                        ${validos ? `<label class="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none"><input type="checkbox" data-all checked class="w-3.5 h-3.5 accent-blue-600 cursor-pointer">${this.esc(l.selectAll)}</label>` : ''}
                    </div>
                    <div class="flex flex-wrap gap-1.5 px-3 pt-2">
                        ${counts}${invalid ? this.badge({ tone: 'bg-gray-100 text-gray-500' }, `${invalid} ${l.invalid}`) : ''}
                    </div>
                    <ul class="${this.expanded ? 'max-h-[55vh]' : 'max-h-[280px]'} overflow-y-auto divide-y divide-gray-100 mt-1" data-list>
                        ${rows.map(r => this.previewRow(r)).join('')}
                    </ul>
                    <div class="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50" data-footer>
                        <span class="text-[11px] text-gray-500 min-w-0" data-status>${validos ? '' : this.esc(l.nothing)}</span>
                        ${validos && token ? `
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <button type="button" data-discard class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">${this.esc(l.discard)}</button>
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
        const a      = this.opts.actions[r.action] || { label: r.action, tone: 'bg-gray-100 text-gray-600' };
        const change = r.after && r.after !== '—'
            ? `${this.esc(r.before)} <i data-lucide="arrow-right" class="inline w-3 h-3 mx-0.5 -mt-px"></i> <b class="font-semibold text-gray-800">${this.esc(r.after)}</b>`
            : this.esc(r.before);

        return `
            <li class="flex items-start gap-2 px-3 py-2 ${r.valid ? '' : 'bg-gray-50/60'}">
                <input type="checkbox" data-row="${r.idx}" data-valid="${r.valid ? 1 : 0}" ${r.valid ? 'checked' : 'disabled'} class="mt-0.5 w-3.5 h-3.5 accent-blue-600 cursor-pointer disabled:cursor-not-allowed flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 min-w-0">
                        ${this.badge(a, a.label)}
                        <span class="text-[12px] font-medium truncate ${r.valid ? 'text-gray-800' : 'text-gray-400 line-through'}" title="${this.esc(r.name)}">${this.esc(r.name)}</span>
                        ${r.sku ? `<span class="text-[10px] text-gray-400 flex-shrink-0">${this.esc(r.sku)}</span>` : ''}
                    </div>
                    ${r.valid ? `<div class="text-[11px] text-gray-500 mt-0.5">${change}</div>` : ''}
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
    }

    async confirmPreview(token) {
        const l    = this.opts.labels;
        const pv   = this.previews[token];
        const card = $(`#${pv.uid}`);
        const ids  = card.find('[data-row]:checked:not(:disabled)').map((i, el) => Number($(el).data('row'))).get();

        if (!ids.length || pv.state !== 'pending' || typeof this.opts.onConfirm !== 'function') return;

        pv.state = 'applying';
        card.find('input, [data-discard]').prop('disabled', true);
        card.find('[data-confirm]').prop('disabled', true).html(`<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>${this.esc(l.applying)}`);
        card.find('[data-status]').removeClass('text-red-600').addClass('text-gray-500').text('');
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
        card.find('[data-status]').removeClass('text-gray-500').addClass('text-red-600').text((r && r.message) || l.error);
        this.icons();
        this.syncPreview(token);
    }

    closePreview(token, state, message) {
        const l    = this.opts.labels;
        const pv   = this.previews[token];
        const card = $(`#${pv.uid}`);
        const text = { applied: message || l.applied, discarded: l.discarded, replaced: l.replaced }[state];
        const icon = { applied: 'check-circle-2', discarded: 'x-circle', replaced: 'history' }[state];
        const tone = state === 'applied' ? 'text-emerald-600' : 'text-gray-500';

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

        const names   = files.map(f => f.name);
        const history = this.history.slice(-8);

        this.addMessage('user', text, names);
        this.history.push({ role: 'user', content: text + (names.length ? `\n(Adjuntó: ${names.join(', ')})` : '') });
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
            const a = this.opts.actions[x.action] ? this.opts.actions[x.action].label : x.action;
            return `${a} ${x.name}${x.after && x.after !== '—' ? ' → ' + x.after : ''}${x.valid ? '' : ' (no aplica: ' + x.note + ')'}`;
        });

        return `${r.reply || ''}\n[Vista previa] ${lines.join('; ')}`;
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
            reading: 'border-gray-200 bg-gray-50 text-gray-600',
            ok:      'border-emerald-200 bg-emerald-50 text-emerald-800',
            error:   'border-red-200 bg-red-50 text-red-700'
        };

        chips.removeClass('hidden').addClass('flex').html(this.files.map(f => {
            const icon = f.status === 'reading' ? 'loader-2' : (f.status === 'error' ? 'alert-circle' : (f.clase === 'imagen' ? 'image' : 'file-spreadsheet'));
            const info = f.status === 'reading' ? o.labels.reading : f.detalle;

            return `
                <span class="inline-flex items-center gap-1.5 max-w-full pl-2 pr-1 py-1 rounded-lg border text-[11px] ${tones[f.status]}" title="${this.esc(f.name)}${info ? ' · ' + this.esc(info) : ''}">
                    <i data-lucide="${icon}" class="w-3.5 h-3.5 flex-shrink-0 ${f.status === 'reading' ? 'animate-spin' : ''}"></i>
                    <span class="font-medium truncate max-w-[140px]">${this.esc(f.name)}</span>
                    ${info ? `<span class="opacity-70 truncate max-w-[160px]">· ${this.esc(info)}</span>` : ''}
                    <button type="button" data-remove="${f.uid}" class="w-5 h-5 rounded flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-black/5 flex-shrink-0"><i data-lucide="x" class="w-3 h-3"></i></button>
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
        $(`#${o.id}_expand`).on('click', () => this.toggleExpand());
        $(`#${o.id}_send`).on('click', () => this.send());
        $(`#${o.id}_attach`).on('click', () => file.trigger('click'));

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

        panel.toggleClass('w-[400px] h-[620px]', !this.expanded).toggleClass('w-[680px] h-[calc(100vh-5rem)]', this.expanded);
        panel.find('[data-list]').toggleClass('max-h-[280px]', !this.expanded).toggleClass('max-h-[55vh]', this.expanded);
        $(`#${o.id}_expand`).html(`<i data-lucide="${this.expanded ? 'minimize-2' : 'maximize-2'}" class="w-4 h-4"></i>`);
        this.icons();
    }

    // -- Helpers --

    syncSend() {
        const o        = this.opts;
        const reading  = this.files.some(f => f.status === 'reading');
        const hasFiles = this.files.some(f => f.status === 'ok');
        const hasText  = String($(`#${o.id}_input`).val() || '').trim() !== '';

        $(`#${o.id}_send`).prop('disabled', this.busy || reading || (!hasText && !hasFiles));
    }

    autosize() {
        const el = document.getElementById(`${this.opts.id}_input`);

        if (!el) return;

        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 128) + 'px';
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

    avatar(icon, isError) {
        return `
            <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isError ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}">
                <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
            </div>`;
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
