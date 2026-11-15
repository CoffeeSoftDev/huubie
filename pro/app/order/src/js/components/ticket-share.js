/*  V7 · Enviar el ticket de una venta por WhatsApp.

    Sin proveedor de mensajes: arma un enlace wa.me y lo abre en una pestaña.
    La cajera manda el mensaje desde SU WhatsApp (web o el del teléfono).
    El cliente recibe el enlace firmado a ticket.php y lo abre sin sesión.

    Uso:
        this.ticketShare(data.share, data.ticket);

    share  = { link, phone } de ctrl (TicketLink::ticketShare). phone: 10 dígitos o ''.
    ticket = { folio, branch, customer, total, tip } de ticketData / ticketOf.

    Teléfono vacío: wa.me abre WhatsApp y deja elegir el contacto. */

// -- Ayudantes --

// Copia al portapapeles. Fuera de https (p. ej. por la IP de Hamachi) no hay
// navigator.clipboard: cae al textarea con execCommand.
function ticketCopy(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(() => true, () => false);
    }

    const area = $('<textarea>', { readonly: true, style: 'position:fixed;top:-1000px;opacity:0;' }).val(text).appendTo('body');

    area[0].select();

    let ok = false;

    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }

    area.remove();

    return Promise.resolve(ok);
}

// 10 dígitos de México, o 12 si ya trae el 52 delante. '' = sin teléfono.
function ticketPhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');

    if (digits === '') return '';
    if (digits.length === 10) return '52' + digits;
    if (digits.length === 12 && digits.startsWith('52')) return digits;

    return null;
}

// -- Componente --

Templates.prototype.ticketShare = function (share, ticket = {}) {
    if (!share || !share.link) {
        alert({ icon: 'warning', title: 'Sin enlace', text: 'No tienes permiso para enviar tickets de esta venta.', btn1: true, btn1Text: 'Entendido' });
        return;
    }

    const folio    = String(ticket.folio || '');
    const branch   = String(ticket.branch || '').trim();
    const name     = String(ticket.customer || '').trim();
    const first    = name !== '' && name !== 'Público en general' ? name.split(/\s+/)[0] : '';
    const amount   = Number(ticket.total || 0) + Number(ticket.tip || 0);
    const greeting = first !== '' ? `Hola ${first}, gracias` : 'Hola, gracias';
    const where    = branch !== '' ? ` en ${branch}` : '';

    const message = `${greeting} por tu compra${where}.\n`
                  + `Aquí está tu ticket de la venta V${folio} por ${money(amount)}:\n`
                  + share.link;

    const linkBox = ''
        + '<div class="flex items-center gap-2 px-[12px] py-2 rounded-lg bg-gray-100 text-xs text-gray-600">'
        +   '<i data-lucide="link" class="w-4 h-4 shrink-0 text-gray-400"></i>'
        +   `<a href="${esc(share.link)}" target="_blank" rel="noopener" class="truncate text-blue-600 hover:underline">${esc(share.link)}</a>`
        + '</div>';

    this.csModal({
        id:         'ticketShareModal',
        title:      'Enviar ticket',
        subtitle:   `Venta V${folio}`,
        lucideIcon: 'message-circle',
        width:      'max-w-lg',
        zIndex:     1200,
        saveText:   'Abrir WhatsApp',
        action:     {
            text:       'Copiar enlace',
            lucideIcon: 'copy',
            onClick:    () => {
                ticketCopy(share.link).then((ok) => {
                    alert(ok
                        ? { icon: 'success', title: 'Enlace copiado', timer: 1200 }
                        : { icon: 'warning', title: 'No se pudo copiar', text: 'Selecciona el enlace y cópialo a mano.', btn1: true, btn1Text: 'Entendido' });
                });
            }
        },
        info:       'El cliente abre el ticket sin iniciar sesión.',
        json:       [
            {
                id:        'share_phone',
                lbl:       'WhatsApp del cliente',
                tipo:      'text',
                icon:      'phone',
                value:     share.phone || '',
                ph:        '10 dígitos',
                maxlength: 16,
                help:      'Vacío: WhatsApp te deja elegir el contacto.',
                class:     'w-full'
            },
            {
                id:        'share_message',
                lbl:       'Mensaje',
                tipo:      'textarea',
                value:     message,
                rows:      5,
                maxlength: 1000,
                class:     'w-full'
            },
            { id: 'share_link', tipo: 'html', html: linkBox, class: 'w-full' }
        ],
        onSave: (values, close) => {
            const phone = ticketPhone(values.share_phone);

            if (phone === null) {
                alert({ icon: 'warning', title: 'Teléfono no válido', text: 'Escribe los 10 dígitos o deja el campo vacío.', btn1: true, btn1Text: 'Entendido' });
                return;
            }

            let text = String(values.share_message || '').trim();

            // Sin el enlace el mensaje no sirve: si lo borraron, va al final.
            if (!text.includes(share.link)) text = (text !== '' ? text + '\n' : '') + share.link;

            const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

            window.open(url, '_blank', 'noopener');
            close();
        }
    });
};
