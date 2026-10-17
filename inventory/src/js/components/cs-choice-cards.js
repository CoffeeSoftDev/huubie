// -- csChoiceCards --
// Aviso con una pregunta y varios caminos en tarjetas (ícono, título, explicación y etiqueta).
// Sin tarjetas es el aviso simple de un botón. Se monta sobre cfModal y devuelve su modal.

Templates.prototype.csChoiceCards = function (options) {
    const defaults = {
        id:        'csChoiceCards',
        icon:      'alert-triangle',
        title:     '',
        lead:      '',
        alerts:    [],
        ask:       '',
        hint:      '',
        choices:   [],
        backLabel: 'Regresar',
        okLabel:   '',
        okTone:    'go',
        zIndex:    10000,
        onChoose:  () => {},
        onOk:      () => {},
        onBack:    () => {}
    };

    const opts = Object.assign({}, defaults, options || {});
    const tone = {
        go:  'background:#3FC189',
        mut: 'background:#6B7280',
        ac:  'background:rgb(var(--brand-600, 192 90 64))'
    };
    const okBg = { go: 'bg-[#3FC189] hover:bg-[#2FA973]', pri: '' };

    let answered = false;

    const modal = this.cfModal({
        title:       `<span class="inline-flex items-center gap-2"><i data-lucide="${opts.icon}" class="w-[18px] h-[18px] text-orange-600"></i>${opts.title}</span>`,
        size:        'default',
        okLabel:     opts.okLabel,
        cancelLabel: opts.backLabel,
        okBg:        okBg[opts.okTone] || '',
        onOk:        () => { answered = true; modal.close(); opts.onOk(); },
        onClose:     () => { if (!answered) opts.onBack(); }
    });

    const card = (c) => {
        const $card = $('<button>', {
            type:          'button',
            'data-choice': c.id,
            class:         'flex items-start gap-3 w-full text-left rounded-[11px] border bg-white p-3 transition-colors hover:bg-gray-50 '
                         + (c.badge ? 'border-[rgba(63,193,137,.5)] hover:border-[#3FC189]' : 'border-gray-200 hover:border-blue-500')
        });

        $card.append(
            $('<span>', { class: 'w-8 h-8 rounded-[9px] flex items-center justify-center flex-shrink-0 text-white mt-px', style: tone[c.tone] || tone.mut })
                .append($('<i>', { 'data-lucide': c.icon, class: 'w-4 h-4' })),
            $('<span>', { class: 'flex-1 min-w-0' }).append(
                $('<span>', { class: 'block text-[13px] font-semibold text-gray-800', text: c.title }),
                $('<span>', { class: 'block text-[11.5px] text-gray-500 mt-0.5 leading-snug', html: c.text || '' })
            )
        );

        if (c.badge) {
            $card.append($('<span>', {
                class: 'self-center flex-shrink-0 inline-flex items-center h-[22px] px-2.5 rounded-full text-[11px] font-semibold',
                style: 'background:rgba(21,128,61,.10);color:#15803D',
                text:  c.badge
            }));
        }

        return $card.append($('<i>', { 'data-lucide': 'chevron-right', class: 'w-4 h-4 text-gray-400 flex-shrink-0 mt-1.5' }));
    };

    modal.el.attr('id', opts.id).css('z-index', opts.zIndex);

    const $body = modal.body.addClass('flex flex-col gap-3');

    if (opts.lead) $body.append($('<p>', { class: 'text-[13.5px] leading-relaxed text-gray-700', html: opts.lead }));

    opts.alerts.forEach((a) => {
        $body.append(
            $('<div>', {
                class: 'flex gap-2.5 rounded-[10px] border px-3 py-2.5 text-[12.5px] leading-snug',
                style: 'background:rgba(249,115,22,.10);border-color:rgba(249,115,22,.30);color:#C2410C'
            }).append(
                $('<i>', { 'data-lucide': a.icon || 'alert-triangle', class: 'w-4 h-4 flex-shrink-0 mt-px' }),
                $('<div>', { html: a.html })
            )
        );
    });

    if (opts.choices.length) {
        const $ask = $('<div>');

        if (opts.ask)  $ask.append($('<p>', { class: 'text-[13px] font-semibold text-gray-800 leading-snug', html: opts.ask }));
        if (opts.hint) $ask.append($('<p>', { class: 'text-[11.5px] text-gray-500 leading-snug mt-0.5', html: opts.hint }));

        $body.append($ask, $('<div>', { class: 'flex flex-col gap-2' }).append(opts.choices.map(card)));
    }

    modal.footer.removeClass('justify-end').addClass('justify-between');
    if (!opts.okLabel) modal.footer.children().eq(1).remove();

    $body.on('click', '[data-choice]', (e) => {
        answered = true;
        modal.close();
        opts.onChoose($(e.currentTarget).attr('data-choice'));
    });

    if (window.lucide) lucide.createIcons();
    $body.find('[data-choice]').first().trigger('focus');

    return modal;
};
