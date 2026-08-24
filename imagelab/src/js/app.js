// ImageLab — cliente del pipeline. Habla con ctrl/api.php y registra cada paso en el
// panel de traza, para que el harness se vea mientras corre.

const IL_ENDPOINT = 'ctrl/api.php';
const IL_POLL_MS  = 1500;
const IL_POLL_MAX = 400;         // hasta ~10 min: un servidor local en CPU tarda

const ImageLab = {

    catalog:  [],
    alias:    null,
    file:     null,              // archivo elegido, aun sin subir
    uploaded: null,              // { url, width, height } ya en el servidor
    running:  false,

    init() {
        this.bind();
        this.loadCatalog();
        if (window.lucide) lucide.createIcons();
    },

    // -- Arranque --

    bind() {
        $('#ilRun').on('click', () => this.run());
        $('#ilClearTrace').on('click', () => {
            $('#ilTrace').html('<p class="il-trace-empty">Traza limpia.</p>');
        });

        const $drop = $('#ilDrop');
        $drop.on('click', () => $('#ilFile').trigger('click'));
        $('#ilFile').on('change', (e) => this.pickFile(e.target.files[0]));

        $drop.on('dragover', (e) => { e.preventDefault(); $drop.addClass('is-over'); });
        $drop.on('dragleave', () => $drop.removeClass('is-over'));
        $drop.on('drop', (e) => {
            e.preventDefault();
            $drop.removeClass('is-over');
            const f = e.originalEvent.dataTransfer.files[0];
            if (f) this.pickFile(f);
        });

        $('#ilPrompt').on('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.run();
        });
    },

    loadCatalog() {
        const t0 = performance.now();
        $.getJSON(IL_ENDPOINT, { action: 'catalog' })
            .done((res) => {
                this.trace('catalog', 'ok', performance.now() - t0, res);
                if (!res.success) return;
                this.catalog = res.items || [];
                this.renderLocal(res.local || {});
                this.renderAliases();
            })
            .fail((xhr) => this.trace('catalog', 'err', performance.now() - t0, xhr.responseText));
    },

    /** Estado del servidor local: sin esto no se entiende por que un alias esta en gris. */
    renderLocal(local) {
        const $chip = $('#ilLocal').removeClass('is-ok is-err is-work');
        if (!local.configured) {
            $chip.text('local: sin configurar').attr('title', 'Pon IL_LOCAL_BASE_URL en el .env');
            return;
        }
        if (local.alive) {
            $chip.addClass('is-ok').text('local: ' + local.kind).attr('title', 'Servidor local respondiendo');
        } else {
            $chip.addClass('is-err').text('local: apagado').attr('title', 'Configurado pero no responde');
        }
    },

    renderAliases() {
        const $wrap = $('#ilAliases').empty();

        this.catalog.forEach((item) => {
            const meta = item.engine || (item.available ? item.task : 'sin motor');
            const $btn = $('<button>')
                .addClass('il-alias')
                .attr('type', 'button')
                .attr('data-m', item.m)
                .attr('title', item.available ? meta : 'Sin motor: enciende el local o pon una key en el .env')
                .prop('disabled', !item.available)
                .append($('<span>').addClass('il-alias-name').text(item.label))
                .append($('<span>').addClass('il-alias-meta').text(item.m + ' · ' + meta));

            $btn.on('click', () => this.selectAlias(item.m));
            $wrap.append($btn);
        });

        const first = this.catalog.find((i) => i.available);
        if (first) this.selectAlias(first.m);
    },

    selectAlias(m) {
        this.alias = this.catalog.find((i) => i.m === m) || null;
        $('.il-alias').removeClass('is-active');
        $('.il-alias[data-m="' + m + '"]').addClass('is-active');

        const isEdit = this.alias && this.alias.task === 'edit';
        $('#ilInputField').prop('hidden', !isEdit);
        $('#ilAr').prop('disabled', isEdit);        // al editar manda el tamano de la foto
        $('#ilEngine')
            .text('motor: ' + (this.alias && this.alias.engine ? this.alias.engine : 'oculto'))
            .attr('title', 'Lo decide el servidor a partir del alias');
        $('#ilPrompt').attr('placeholder', isEdit
            ? 'que se vea mas iluminado el lugar'
            : 'una taza de cafe azul, icono plano, fondo claro');
    },

    // -- Entrada --

    pickFile(file) {
        if (!file) return;
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
            this.setStatus('formato no soportado', 'err');
            return;
        }
        this.file = file;
        this.uploaded = null;

        const reader = new FileReader();
        reader.onload = (e) => {
            $('#ilInputPreview').attr('src', e.target.result).prop('hidden', false);
            $('#ilDropHint').prop('hidden', true);
        };
        reader.readAsDataURL(file);
    },

    // -- Pipeline --

    async run() {
        if (this.running) return;

        const prompt = $('#ilPrompt').val().trim();
        if (!this.alias) { this.setStatus('elige una operacion', 'err'); return; }
        if (!prompt)     { this.setStatus('escribe la instruccion', 'err'); return; }

        const needsImage = this.alias.task === 'edit';
        if (needsImage && !this.file && !this.uploaded) {
            this.setStatus('sube una imagen de partida', 'err');
            return;
        }

        this.running = true;
        $('#ilRun').prop('disabled', true);
        $('#ilResult').prop('hidden', true);
        $('#ilStageEmpty').prop('hidden', false);
        $('#ilDownload').prop('hidden', true);

        try {
            if (needsImage && !this.uploaded) {
                const presign = await this.step('presign', () => $.getJSON(IL_ENDPOINT, { action: 'presign' }));
                this.uploaded = await this.step('upload', () => this.upload(presign.uploadToken));
            }

            this.setStatus('starting', 'work');
            const job = await this.step('run', () => this.postJson({
                m:   this.alias.m,
                q:   this.alias.q,
                res: $('#ilRes').val(),
                ar:  needsImage ? 'default' : $('#ilAr').val(),
                fmt: $('#ilFmt').val(),
                p:   prompt,
                i:   this.uploaded ? this.uploaded.url : ''
            }));

            if (job.engine) $('#ilEngine').text('motor: ' + job.engine);
            await this.poll(job.jobId);

        } catch (err) {
            this.setStatus(String(err && err.message ? err.message : err), 'err');
        } finally {
            this.running = false;
            $('#ilRun').prop('disabled', false);
        }
    },

    upload(token) {
        const fd = new FormData();
        fd.append('t', token);
        fd.append('file', this.file);
        return $.ajax({
            url: IL_ENDPOINT + '?action=upload',
            method: 'POST',
            data: fd,
            processData: false,
            contentType: false,
            dataType: 'json'
        });
    },

    postJson(payload) {
        return $.ajax({
            url: IL_ENDPOINT + '?action=run',
            method: 'POST',
            data: JSON.stringify(payload),
            contentType: 'application/json',
            dataType: 'json'
        });
    },

    async poll(jobId) {
        for (let i = 0; i < IL_POLL_MAX; i++) {
            const res = await this.step('status #' + (i + 1), () =>
                $.getJSON(IL_ENDPOINT, { action: 'status', id: jobId }));

            if (res.status === 'succeeded') {
                this.showResult(res.output);
                return;
            }
            if (res.status === 'failed') throw new Error(res.error || 'el trabajo fallo');

            this.setStatus(res.status + ' · ' + Math.round((i + 1) * IL_POLL_MS / 1000) + 's', 'work');
            await new Promise((r) => setTimeout(r, IL_POLL_MS));
        }
        throw new Error('se agoto la espera del proveedor');
    },

    showResult(url) {
        $('#ilStageEmpty').prop('hidden', true);
        $('#ilResult').attr('src', url).prop('hidden', false);
        $('#ilDownload').attr('href', url).prop('hidden', false);
        this.setStatus('succeeded', 'ok');
    },

    // -- Traza --

    /** Envuelve una promesa para cronometrarla y dejarla registrada en el panel. */
    async step(name, fn) {
        const t0 = performance.now();
        try {
            const res = await fn();
            if (res && res.success === false) throw new Error(res.message || 'error');
            this.trace(name, 'ok', performance.now() - t0, res);
            return res;
        } catch (err) {
            const body = err && err.responseText ? err.responseText : (err.message || String(err));
            this.trace(name, 'err', performance.now() - t0, body);
            throw new Error(this.readMessage(body));
        }
    },

    readMessage(body) {
        try {
            const parsed = typeof body === 'string' ? JSON.parse(body) : body;
            return parsed.message || parsed.error || String(body);
        } catch (e) {
            return String(body);
        }
    },

    trace(name, level, ms, payload) {
        const $trace = $('#ilTrace');
        $trace.find('.il-trace-empty').remove();

        const cls  = level === 'err' ? 'is-err' : (level === 'work' ? 'is-work' : 'is-ok');
        const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);

        const $body = $('<pre>').addClass('il-step-body').prop('hidden', true).text(text);
        const $head = $('<div>').addClass('il-step-head')
            .append($('<span>').addClass('il-step-name').text(name))
            .append($('<span>').addClass('il-step-code').text(level === 'err' ? 'error' : 'ok'))
            .append($('<span>').addClass('il-step-time').text(Math.round(ms) + ' ms'));

        $head.on('click', () => $body.prop('hidden', !$body.prop('hidden')));

        $trace.append($('<div>').addClass('il-step ' + cls).append($head).append($body));
        $trace.scrollTop($trace[0].scrollHeight);
    },

    setStatus(text, level) {
        const cls = level === 'ok' ? 'is-ok' : (level === 'err' ? 'is-err' : (level === 'work' ? 'is-work' : ''));
        $('#ilStatus').removeClass('is-ok is-err is-work').addClass(cls).text(text);
    }
};

$(function () { ImageLab.init(); });
