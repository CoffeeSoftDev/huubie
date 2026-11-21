// -- CSS --

function posTimeCSS() {
    if (document.getElementById('pos-time-css')) return;

    const css = ''
        // Campo: el mismo marco que .tw-input de coffeeForm (soft.css y dark-mode.css).
        + '.pos-tm{display:flex;align-items:center;gap:8px;width:100%;height:38px;padding:0 10px 0 12px;border:1px solid rgb(var(--gray-300,209 213 219));border-radius:var(--radius-ctl,12px);background:#FFF;color:var(--ink,#111827);cursor:text;transition:border-color .15s,box-shadow .15s}'
        + '.pos-tm:hover{border-color:var(--accent-line,rgb(var(--gray-400,156 163 175)))}'
        + '.pos-tm:focus-within,.pos-tm.is-open{border-color:rgb(var(--accent-2-600,80 48 165));box-shadow:0 0 0 3px rgb(var(--accent-2-600,80 48 165) / .14)}'
        + '.pos-tm.is-error{border-color:#DC2626;box-shadow:0 0 0 3px rgb(220 38 38 / .14)}'
        + '.pos-tm input.pos-tm-text{flex:1;min-width:0;height:auto;margin:0;padding:0 !important;border:0 !important;outline:none;background:transparent !important;box-shadow:none !important;color:inherit;font:inherit;font-variant-numeric:tabular-nums}'
        + '.pos-tm-ico,.pos-tm-chev{display:inline-flex;flex-shrink:0;color:#9CA3AF;cursor:pointer}'
        + '.pos-tm-ico svg{width:15px;height:15px}'
        + '.pos-tm-chev svg{width:15px;height:15px;transition:transform .15s}'
        + '.pos-tm.is-open .pos-tm-chev svg{transform:rotate(180deg)}'
        + 'body.dark-mode .pos-tm{border-color:var(--dk-input-line,#374151);background:var(--dk-input,#111827);color:var(--dk-text,#F3F4F6)}'
        + 'body.dark-mode .pos-tm:focus-within,body.dark-mode .pos-tm.is-open{border-color:rgb(var(--accent-2-600,192 90 64));box-shadow:0 0 0 3px rgb(var(--accent-2-600,192 90 64) / .2)}'
        + 'body.dark-mode .pos-tm input.pos-tm-text,body.dark-mode .pos-tm input.pos-tm-text:focus{border-color:transparent !important;background:transparent !important;box-shadow:none !important}'

        // Reloj: cuelga del <body> en posición fija para que nada lo recorte.
        + '.pos-tm-panel{--po-surface:#FFF;--po-line:#E5E7EB;--po-line-hi:#D1D5DB;--po-ink:#111827;--po-muted:#6B7280;--po-hover:#F3F4F6;'
        + '--po-brand:rgb(var(--brand-600,192 90 64));--po-brand-dark:rgb(var(--brand-700,160 72 51));--po-brand-ink:rgb(var(--brand-600,192 90 64));--po-brand-soft:rgb(var(--brand-600,192 90 64) / .10);--po-brand-line:rgb(var(--brand-600,192 90 64) / .12);'
        + 'position:fixed;z-index:4000;width:264px;padding:14px 14px 12px;border:1px solid var(--po-line);border-radius:14px;background:var(--po-surface);color:var(--po-ink);font-size:13px;line-height:1.4;text-align:left;'
        + 'box-shadow:0 18px 40px rgb(15 23 42 / .16),0 2px 6px rgb(15 23 42 / .06);animation:posTmIn .14s ease-out}'
        + 'body.dark-mode .pos-tm-panel{--po-surface:var(--dk-card,#1F2A37);--po-line:var(--dk-line,#374151);--po-line-hi:var(--dk-line-hi,#4B5563);--po-ink:var(--dk-text,#F3F4F6);--po-muted:var(--dk-muted,#9CA3AF);--po-hover:var(--dk-row-hover,#334155);'
        + '--po-brand-ink:rgb(var(--brand-200,243 199 186));--po-brand-soft:rgb(var(--brand-600,192 90 64) / .2);--po-brand-line:rgb(var(--brand-600,192 90 64) / .45);box-shadow:0 18px 40px rgb(0 0 0 / .45)}'
        + '@keyframes posTmIn{from{opacity:0;transform:translateY(-4px) scale(.98)}}'
        + '.pos-tm-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px}'
        + '.pos-tm-label{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;color:var(--po-muted)}'
        + '.pos-tm-value{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--po-brand-ink)}'
        // Hora y minutos de arriba: doble clic para escribirlos (edit()).
        + '.pos-tm-part{display:inline-block;padding:0 2px;border-radius:5px;cursor:text;user-select:none;transition:background-color .12s}'
        + '.pos-tm-part:hover{background:var(--po-brand-soft)}'
        + '.pos-tm-panel input.pos-tm-edit{display:inline-block;width:2.4ch;height:auto !important;margin:0;padding:0 2px !important;border:0 !important;border-radius:5px;outline:none;'
        + 'background:var(--po-brand-soft) !important;box-shadow:0 0 0 2px var(--po-brand-line) !important;color:inherit !important;font:inherit;font-size:inherit !important;line-height:inherit;text-align:center;font-variant-numeric:tabular-nums}'
        + '.pos-tm-note{margin:-4px 0 8px;font-size:11.5px;line-height:1.35;color:var(--po-muted)}'
        + '.pos-tm-note:empty{display:none}'
        + '.pos-tm-note.is-error{color:#DC2626}'
        + '.pos-tm-body{display:flex;gap:10px}'
        // La banda del centro: el número que queda ahí es el elegido. 36 px = ITEM del JS.
        + '.pos-tm-wheel{position:relative;flex:1;display:flex;height:180px}'
        + '.pos-tm-wheel::before{content:"";position:absolute;left:0;right:0;top:72px;height:36px;border-radius:8px;background:var(--po-brand-soft);pointer-events:none}'
        + '.pos-tm-col{position:relative;z-index:1;flex:1;padding:72px 0;overflow-y:auto;overscroll-behavior:contain;scroll-snap-type:y mandatory;scrollbar-width:none;'
        + '-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 32%,#000 68%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 32%,#000 68%,transparent 100%)}'
        + '.pos-tm-col::-webkit-scrollbar{display:none}'
        + '.pos-tm-it{height:36px;line-height:36px;text-align:center;font-size:15px;font-variant-numeric:tabular-nums;color:var(--po-muted);scroll-snap-align:center;cursor:pointer;user-select:none;transition:color .12s,font-size .12s}'
        + '.pos-tm-it:hover{color:var(--po-ink)}'
        + '.pos-tm-it.is-sel{font-size:18px;font-weight:700;color:var(--po-brand-ink)}'
        + '.pos-tm-sep{position:relative;z-index:1;align-self:center;font-size:18px;font-weight:700;color:var(--po-brand-ink)}'
        + '.pos-tm-ampm{display:flex;flex-direction:column;justify-content:center;gap:6px}'
        + 'button.pos-tm-ap{width:52px;margin:0;padding:7px 0;border:1px solid var(--po-line);border-radius:8px;background:var(--po-surface);color:var(--po-muted);font-size:12px;font-weight:600;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s}'
        + 'button.pos-tm-ap:hover{border-color:var(--po-line-hi);color:var(--po-ink)}'
        + 'button.pos-tm-ap.is-sel{border-color:var(--po-brand-line);background:var(--po-brand-soft);color:var(--po-brand-ink)}'
        + '.pos-tm-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--po-line)}'
        + 'button.pos-tm-btn{margin:0;padding:6px 14px;border:0;border-radius:8px;background:transparent;font-size:13px;font-weight:600;cursor:pointer}'
        + 'button.pos-tm-btn.is-cancel{color:var(--po-muted)}'
        + 'button.pos-tm-btn.is-cancel:hover{background:var(--po-hover);color:var(--po-ink)}'
        + 'button.pos-tm-btn.is-ok{background:var(--po-brand);color:#FFF}'
        + 'button.pos-tm-btn.is-ok:hover{background:var(--po-brand-dark)}'
        + 'button.pos-tm-ap:focus-visible,button.pos-tm-btn:focus-visible{outline:none;box-shadow:0 0 0 3px var(--po-brand-line)}';

    const style = document.createElement('style');

    style.id          = 'pos-time-css';
    style.textContent = css;

    document.head.appendChild(style);
}

// -- Ícono --

function posTimeIcon(name) {
    return $('<i>', { 'data-lucide': name, 'aria-hidden': 'true' });
}

// -- Selector de hora --

/*  Campo de hora con reloj de ruedas, como el de Costsys › Programar carga
    automática (subir-costo-potencial.js › abrirHora). Se escribe en el campo
    (4, 430, 4:30 pm, 16:30, 7p) o se elige en el reloj: horas de 1 a 12,
    minutos de step en step y AM / PM aparte, en sus propios botones.
    Doble clic en la hora o en los minutos de arriba los deja escribir (edit).
    Sin a/p, lo escrito de 1 a 12 queda en la mitad del día que marca el reloj;
    0, de 13 a 23 y el cero delante (0430) son de 24 h y lo dicen solos.
    «Listo» o Enter guardan; Cancelar, Esc o un clic fuera cierran sin cambiar
    la hora (lo escrito sí se queda, como al salir de un campo).
    El input original (options.input) pasa a hidden y sigue guardando la hora
    en 24 h (HH:MM): quien lo lee no cambia. Al guardar dispara su change. */
Templates.prototype.posTime = function (options) {
    const defaults = {
        input:       '',
        title:       'Hora',
        step:        5,
        start:       '12:00',          // donde arrancan las ruedas si aún no hay hora
        placeholder: 'Elige la hora',
        onChange:    () => {}
    };

    const opts  = Object.assign({}, defaults, options);
    const store = $(`#${opts.input}`);

    if (!store.length) return null;

    posTimeCSS();

    const ITEM  = 36;
    const two   = (n) => String(n).padStart(2, '0');
    const hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const mins  = [];

    for (let m = 0; m < 60; m += opts.step) mins.push(m);

    // 'HH:MM' de 24 h → { h: 1–12, m, ap }; null si no es hora.
    const split = (value) => {
        const p = String(value || '').match(/^(\d{1,2}):(\d{2})/);

        if (!p) return null;

        const h24 = Math.min(Number(p[1]), 23);

        return { h: h24 % 12 || 12, m: Math.min(Number(p[2]), 59), ap: h24 < 12 ? 'AM' : 'PM' };
    };

    const join  = (h, m, ap) => two((h % 12) + (ap === 'PM' ? 12 : 0)) + ':' + two(m);
    const label = (value) => {
        const t = split(value);

        return t ? `${t.h}:${two(t.m)} ${t.ap}` : '';
    };

    // La hora que marcan las ruedas: los minutos al múltiplo de step más cercano.
    const nearest = (value) => {
        const p     = String(value).split(':');
        const total = (Math.round((Number(p[0]) * 60 + Number(p[1])) / opts.step) * opts.step) % 1440;

        return two(Math.floor(total / 60)) + ':' + two(total % 60);
    };

    // Lo escrito → 'HH:MM' de 24 h, sin redondear; null si no es una hora.
    const read = (text, half) => {
        const clean = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const p     = clean.match(/^(\d{1,2})(?:[:. ]?(\d{2}))? ?(?:([ap])\.? ?m?\.?)?$/);

        if (!p) return null;

        let h      = Number(p[1]);
        const m    = p[2] ? Number(p[2]) : 0;
        const says = p[3] ? (p[3] === 'a' ? 'AM' : 'PM') : null;

        if (m > 59) return null;

        if (says) {
            if (h < 1 || h > 12) return null;

            h = (h % 12) + (says === 'PM' ? 12 : 0);
        } else if (h > 23) {
            return null;
        } else if (h >= 1 && h <= 12 && p[1].charAt(0) !== '0') {
            h = (h % 12) + (half === 'PM' ? 12 : 0);
        }

        return two(h) + ':' + two(m);
    };

    // -- Campo --

    const field = $('<div>', { id: `${opts.input}Box`, class: 'pos-tm' });
    const text  = $('<input>', {
        id:              `${opts.input}Text`,
        type:            'text',
        class:           'pos-tm-text',
        autocomplete:    'off',
        spellcheck:      'false',
        maxlength:       10,
        placeholder:     opts.placeholder,
        title:           'Escribe la hora (4, 4:30 pm, 16:30) o elígela en el reloj',
        'aria-label':    opts.title,
        'aria-haspopup': 'dialog'
    });
    const clock = $('<span>', { class: 'pos-tm-ico' }).append(posTimeIcon('clock'));
    const chev  = $('<span>', { class: 'pos-tm-chev' }).append(posTimeIcon('chevron-down'));

    field.append(clock, text, chev);
    store.attr('type', 'hidden').after(field);
    $(`label[for="${opts.input}"]`).attr('for', `${opts.input}Text`);

    if (window.lucide) lucide.createIcons({ root: field[0] });

    let panel   = null;   // el reloj abierto
    let typed   = null;   // lo escrito en el campo o arriba, ya leído (HH:MM)
    let half    = 'PM';   // la mitad del día del reloj
    let base    = 'PM';   // la de cuando se empezó a escribir
    let editing = null;   // 'h' | 'm': el número de arriba que se está escribiendo

    const paint = () => {
        text.val(label(store.val()));
        field.removeClass('is-error');
    };

    const set = (value, quiet) => {
        store.val(value || '');
        paint();

        if (quiet) return;

        store.trigger('change');
        opts.onChange(store.val());
    };

    // -- Reloj --

    const place = () => {
        if (!panel) return;

        const r   = field[0].getBoundingClientRect();
        const h   = panel.outerHeight();
        const w   = panel.outerWidth();
        const top = r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6;

        panel.css({ top: top, left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) });
    };

    const index  = (col) => Math.min(Math.max(Math.round(col.scrollTop / ITEM), 0), col.children.length - 1);
    const picked = () => ({ h: hours[index(panel.find('[data-col="h"]')[0])], m: mins[index(panel.find('[data-col="m"]')[0])] });

    const sync = () => {
        if (!panel) return;

        panel.find('.pos-tm-col').each((i, col) => {
            $(col).children().removeClass('is-sel').eq(index(col)).addClass('is-sel');
        });

        panel.find('button.pos-tm-ap').removeClass('is-sel').attr('aria-pressed', 'false')
            .filter(`[data-ap="${half}"]`).addClass('is-sel').attr('aria-pressed', 'true');

        // Mientras se escribe arriba, las ruedas no le pisan el número.
        if (editing) return;

        const t = shown();

        panel.find('.pos-tm-value').html(
            `<span class="pos-tm-part" data-part="h" title="Doble clic para escribir la hora">${t.h}</span>:`
            + `<span class="pos-tm-part" data-part="m" title="Doble clic para escribir los minutos">${two(t.m)}</span> ${t.ap}`
        );
    };

    // La hora que se ve arriba: la escrita, o la de las ruedas.
    const shown = () => {
        if (typed) return split(typed);

        const p = picked();

        return { h: p.h, m: p.m, ap: half };
    };

    // Mueve las ruedas sin animar a la hora dada (24 h).
    const spin = (value) => {
        const t = split(nearest(value));

        panel.find('[data-col="h"]')[0].scrollTop = hours.indexOf(t.h) * ITEM;
        panel.find('[data-col="m"]')[0].scrollTop = mins.indexOf(t.m) * ITEM;
        half = t.ap;
        sync();
    };

    const note = (msg, error) => {
        if (panel) panel.find('.pos-tm-note').text(msg || '').toggleClass('is-error', !!error);

        field.toggleClass('is-error', !!error);
    };

    // Lo escrito en el campo mueve las ruedas; lo que aún no es hora («4:») no mueve nada.
    const write = () => {
        typed = read(text.val(), base);
        note('');

        if (typed && panel) spin(typed);
        else sync();
    };

    // Tocar las ruedas o AM / PM deja de escribir: la hora sale de las ruedas.
    // Si estaba escribiendo arriba, lo escrito se aplica antes.
    const release = () => {
        if (editing) finish(true, false);

        typed = null;
        note('');
    };

    // -- Escribir la hora o los minutos de arriba --

    /*  Doble clic en la hora o en los minutos de arriba: el número se vuelve
        un campo chico. Enter, Tab o salir del campo lo aplican; Esc lo deja
        como estaba. La hora va de 1 a 12 (0 y de 13 a 23 dicen solos AM o PM)
        y los minutos de 0 a 59, sin redondear al step: las ruedas van a la
        más cercana, pero se guarda lo escrito. */
    const edit = (part) => {
        if (!panel || editing) return;

        const t   = shown();
        const box = $('<input>', {
            type:         'text',
            class:        'pos-tm-edit',
            inputmode:    'numeric',
            maxlength:    2,
            autocomplete: 'off',
            'aria-label': part === 'h' ? 'Hora' : 'Minutos',
            value:        part === 'h' ? String(t.h) : two(t.m)
        });

        editing = part;

        panel.find(`.pos-tm-part[data-part="${part}"]`).replaceWith(box);

        box.on('input', () => box.val(String(box.val()).replace(/\D/g, '')));
        box.on('blur', () => finish(true, false));

        box.trigger('focus').trigger('select');
    };

    // save: aplicar lo escrito. strict: si no es válido, avisa y sigue escribiendo; si no, lo descarta.
    const finish = (save, strict) => {
        if (!editing || !panel) return;

        const box  = panel.find('input.pos-tm-edit');
        const raw  = String(box.val() || '').trim();
        const part = editing;
        const t    = shown();
        const n    = Number(raw);
        let h24    = (t.h % 12) + (t.ap === 'PM' ? 12 : 0);
        let m      = t.m;

        const valid = raw !== '' && (part === 'h' ? n <= 23 : n <= 59);

        if (save && raw !== '' && !valid && strict) {
            note(part === 'h' ? 'La hora va de 1 a 12.' : 'Los minutos van de 0 a 59.', true);
            box.trigger('focus').trigger('select');
            return;
        }

        editing = null;
        note('');

        if (!save || !valid) return sync();

        if (part === 'm') m = n;
        else if (n === 0 || n > 12) h24 = n;
        else h24 = (n % 12) + (t.ap === 'PM' ? 12 : 0);

        typed = two(h24) + ':' + two(m);

        // Las ruedas van a la hora más cercana; AM / PM se queda en la escrita.
        spin(typed);
        half = h24 < 12 ? 'AM' : 'PM';
        sync();
    };

    const close = () => {
        if (!panel) return;

        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', place);
        $(document).off('mousedown.posTime');

        editing = null;

        panel.remove();
        panel = null;
        typed = null;

        field.removeClass('is-open');
        text.attr('aria-expanded', 'false');
        paint();
    };

    const commit = () => {
        const p     = picked();
        const value = typed || join(p.h, p.m, half);

        close();
        set(value);
    };

    // Lo escrito se queda al salir (Tab, clic fuera); si no es hora, vuelve la de antes.
    const leave = () => {
        const value = typed;

        close();

        if (value) set(value);
    };

    const onKey = (e) => {
        // Escribiendo arriba: Enter y Tab aplican, Esc deja el número como estaba. El reloj sigue abierto.
        if (editing) {
            if (e.key !== 'Enter' && e.key !== 'Tab' && e.key !== 'Escape') return;

            e.preventDefault();
            e.stopPropagation();

            return finish(e.key !== 'Escape', true);
        }

        if (e.key === 'Tab') return leave();

        if (e.key !== 'Escape' && e.key !== 'Enter') return;

        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') return close();

        if (document.activeElement === text[0] && text.val().trim() !== '' && !typed) {
            return note('Escribe una hora como 4, 4:30 pm o 16:30.', true);
        }

        commit();
    };

    // Lo de atrás se desplaza: el reloj sigue al campo. Sus propias ruedas no cuentan.
    const onScroll = (e) => {
        if (panel && !panel[0].contains(e.target)) place();
    };

    const open = () => {
        if (panel || store.prop('disabled')) return;

        const col = (key, items) => `
            <div class="pos-tm-col" data-col="${key}">
                ${items.map((v, i) => `<div class="pos-tm-it" data-i="${i}">${two(v)}</div>`).join('')}
            </div>`;

        panel = $(`
            <div class="pos-tm-panel" role="dialog">
                <div class="pos-tm-head"><span class="pos-tm-label"></span><b class="pos-tm-value"></b></div>
                <div class="pos-tm-note"></div>
                <div class="pos-tm-body">
                    <div class="pos-tm-wheel">${col('h', hours)}<span class="pos-tm-sep">:</span>${col('m', mins)}</div>
                    <div class="pos-tm-ampm">
                        <button type="button" class="pos-tm-ap" data-ap="AM">AM</button>
                        <button type="button" class="pos-tm-ap" data-ap="PM">PM</button>
                    </div>
                </div>
                <div class="pos-tm-foot">
                    <button type="button" class="pos-tm-btn is-cancel">Cancelar</button>
                    <button type="button" class="pos-tm-btn is-ok">Listo</button>
                </div>
            </div>`);

        panel.attr('aria-label', opts.title).find('.pos-tm-label').text(opts.title);

        $('body').append(panel);

        field.addClass('is-open');
        text.attr('aria-expanded', 'true');

        typed = null;
        spin(store.val() || opts.start);
        base = half;
        place();

        panel.find('.pos-tm-col').each((i, col) => {
            let frame = null;
            let sum   = 0;

            col.addEventListener('scroll', () => {
                if (frame) return;

                frame = requestAnimationFrame(() => { frame = null; sync(); });
            });

            // Un número por giro de la rueda: el desplazamiento nativo brinca de tres en tres.
            col.addEventListener('wheel', (e) => {
                e.preventDefault();
                release();

                sum += e.deltaY;

                if (Math.abs(sum) < 30) return;

                const step = Math.sign(sum);

                sum = 0;
                col.scrollTo({ top: (index(col) + step) * ITEM, behavior: 'smooth' });
            }, { passive: false });

            col.addEventListener('touchstart', release, { passive: true });
        });

        panel.on('mousedown', '.pos-tm-col, button.pos-tm-ap', release);

        panel.on('click', '.pos-tm-it', (e) => {
            const item = e.currentTarget;

            item.parentNode.scrollTo({ top: Number(item.dataset.i) * ITEM, behavior: 'smooth' });
        });

        panel.on('click', 'button.pos-tm-ap', (e) => {
            half = e.currentTarget.dataset.ap;
            sync();
        });

        panel.on('dblclick', '.pos-tm-part', (e) => edit(e.currentTarget.dataset.part));

        panel.on('click', 'button.is-ok', commit);
        panel.on('click', 'button.is-cancel', close);

        // Esc y Enter en captura: si no, la pantalla de atrás también los oye.
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', place);

        // Clic fuera. El campo maneja los suyos.
        setTimeout(() => {
            $(document).on('mousedown.posTime', (e) => {
                if (panel && !$(e.target).closest(panel).length && !$(e.target).closest(field).length) leave();
            });
        }, 0);
    };

    // -- Eventos del campo --

    text.on('focus', () => {
        setTimeout(() => { if (document.activeElement === text[0]) text[0].select(); }, 0);
        open();
    });

    // Ya enfocado (tras Enter o Esc), un clic lo vuelve a abrir.
    text.on('mousedown', () => {
        if (!panel && document.activeElement === text[0]) open();
    });

    text.on('input', () => {
        if (!panel) open();

        write();
    });

    // El reloj y la flecha abren o cierran sin quitarle el foco al campo.
    clock.add(chev).on('mousedown', (e) => {
        e.preventDefault();

        if (panel) return close();

        if (document.activeElement === text[0]) open();
        else text.trigger('focus');
    });

    field.on('mousedown', (e) => {
        if (e.target === field[0]) {
            e.preventDefault();
            text.trigger('focus');
        }
    });

    paint();

    return {
        set:   (value) => set(value, true),
        close: close
    };
};
