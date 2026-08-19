// TicketPaper — el papel del ticket, replica de la tira que imprime la termica
// del POS. Lo usan el modulo Tickets (vista previa del panel y hoja del dia) y la
// vista previa del emisor en Catalogos: es el mismo papel, asi que vive en un solo
// lugar en vez de en una copia por modulo.
//
// El ticket llega con sus importes ya formateados por el servidor: el papel
// imprime, no calcula. Los renglones que no traen dato no se pintan vacios.
class TicketPaper {

    // La termica arma el ticket sobre una rejilla monoespaciada de 40 columnas: los
    // separadores de "=" ocupan las 40 y el texto largo se corta una columna antes.
    static get COLS() { return 40; }
    static get TEXT_COLS() { return TicketPaper.COLS - 1; }

    static get DEFAULTS() {
        return {
            parent: 'root',
            id:     'ticketPaper',
            class:  'ticket-paper tk-pos',
            json:   null,
            emisor: { razon: '', lema: '', rfc: '', domicilio: '', expedicion: '', telefono: '' },
            // Las frases que la termica imprime siempre, con o sin datos: son parte
            // del papel, no de la sucursal.
            labels: {
                empty:     'Sin ticket seleccionado',
                lugar:     'LUGAR DE EXPEDICION',
                propina:   'PROPINA',
                descuento: 'DESC% C/IMP.:',
                leyenda:   'ESTE NO ES UN COMPROBANTE FISCAL'
            }
        };
    }

    // -- Helpers --

    static esc(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Corte por caracteres, identico al del driver: rebana cada TEXT_COLS sin mirar
    // los espacios. Por eso en el ticket fisico se lee "...CHIAPAS MEXIC" y abajo
    // "O CP 29060".
    static wrapCols(text) {
        const src   = String(text == null ? '' : text).trim();
        const lines = [];

        for (let i = 0; i < src.length; i += TicketPaper.TEXT_COLS) {
            lines.push(src.slice(i, i + TicketPaper.TEXT_COLS));
        }

        return lines.join('\n');
    }

    // Las lineas de corte del papel: la larga ocupa las 40 columnas y la corta
    // encuadra el total contra el margen derecho.
    static sep(cols, align) {
        return `<div class="text-[1em] my-1 overflow-hidden whitespace-nowrap ${align}">${'='.repeat(cols)}</div>`;
    }

    static dato(label, value, extra) {
        if (!value) return '';

        return `
            <div class="flex text-[1em] leading-[1.45] ${extra || ''}">
                <span>${TicketPaper.esc(label)}</span><span>${TicketPaper.esc(value)}</span>
            </div>
        `;
    }

    // Dos datos en un mismo renglon, con el hueco que la termica deja entre ellos.
    // Si solo llega uno se imprime solo.
    static par(k1, v1, k2, v2) {
        if (!v1 && !v2) return '';

        const esc = TicketPaper.esc;

        return `
            <div class="flex text-[1em] leading-[1.45]">
                ${v1 ? `<span>${esc(k1)}</span><span>${esc(v1)}</span>` : ''}
                ${(v1 && v2) ? '<span>&nbsp;&nbsp;&nbsp;&nbsp;</span>' : ''}
                ${v2 ? `<span>${esc(k2)}</span><span>${esc(v2)}</span>` : ''}
            </div>
        `;
    }

    // Un importe en cero no se imprime: el ticket al 16% no lleva descuento y la
    // linea vacia solo ensucia el papel.
    static vacio(importe) {
        return !importe || Number(String(importe).replace(/[^0-9.-]/g, '')) === 0;
    }

    // -- Render --

    static render(options) {
        const defaults = TicketPaper.DEFAULTS;
        const o        = options || {};
        const opts     = Object.assign({}, defaults, o);

        opts.emisor = Object.assign({}, defaults.emisor, o.emisor || {});
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const esc  = TicketPaper.esc;
        const wrap = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json) {
            // Las 40 columnas tambien aqui: el papel vacio conserva el ancho de la
            // tira, no se encoge al tamano del aviso. El aviso no se comprime (no
            // es la rejilla), asi que sus 40ch se miden con los 11px de siempre y
            // no con la base agrandada del papel.
            wrap.html(`<p class="w-[40ch] mx-auto text-center text-[11px] text-gray-400 py-8">${esc(opts.labels.empty)}</p>`);
            $(`#${opts.parent}`).html(wrap);
            return;
        }

        const e = opts.json;
        const m = opts.emisor;

        // La hora completa es la del ticket del POS; fecha y hora sueltas son el
        // respaldo para quien arma un papel de muestra.
        const fecha = e.fechaHora || [e.fecha, e.hora].filter(Boolean).join(' ');

        const lineas = (e.lineas || []).map(l => `
            <tr>
                <td class="w-[5ch] text-left py-px align-top">${esc(l.cant)}</td>
                <td class="w-auto text-left pl-1 py-px align-top">${esc(l.nombre)}</td>
                <td class="w-[9ch] text-right py-px align-top whitespace-nowrap">${esc(l.importe)}</td>
            </tr>
        `).join('');

        // La rejilla mide 40 caracteres, y el tamano de esa columna lo pone el papel
        // (.tk-pos en facture.css, que lo calcula con --tk-cond): aqui no se fija
        // ninguno, o el 40ch mediria una columna y el texto de adentro otra.
        //
        // De ahi que los tamanos de abajo vayan en em: son proporciones de esa
        // misma columna, asi la tira entera sigue a la perilla.
        wrap.html(`
            <div class="w-[40ch] mx-auto leading-[1.35]">
                <header>
                    <h2 class="mt-0 mb-0.5 text-[1.18em] font-bold uppercase tracking-[0.02em] leading-[1.3]">${esc(m.razon)}</h2>
                    ${m.lema ? `<p class="m-0">${esc(m.lema)}</p>` : ''}
                    ${m.rfc  ? `<p class="m-0">RFC:${esc(m.rfc)}</p>` : ''}
                    <div class="mt-0.5 uppercase whitespace-pre">${esc(TicketPaper.wrapCols(m.domicilio))}</div>
                </header>

                ${(m.expedicion || m.telefono) ? `
                <section>
                    ${m.expedicion ? `
                        <p class="mt-0.5 mb-0 font-bold">${esc(opts.labels.lugar)}</p>
                        <div class="mt-0.5 uppercase whitespace-pre">${esc(TicketPaper.wrapCols(m.expedicion))}</div>
                    ` : ''}
                    ${m.telefono ? `<p class="m-0">TEL: ${esc(m.telefono)}</p>` : ''}
                </section>
                ` : ''}

                ${TicketPaper.sep(TicketPaper.COLS, 'text-start')}

                <section class="text-left my-1">
                    ${TicketPaper.dato('MESA:',   e.mesa)}
                    ${TicketPaper.dato('MESERO:', e.mesero)}
                    ${TicketPaper.par('PERSONAS:', e.personas, 'ORDEN:', e.orden)}
                    ${TicketPaper.dato('FOLIO:',  e.folio, 'font-semibold')}
                    ${TicketPaper.dato('',        fecha,   'font-semibold')}
                    ${TicketPaper.dato('CAJERO:', e.cajero, 'font-semibold')}
                </section>

                ${TicketPaper.sep(TicketPaper.COLS, 'text-start')}

                <section>
                    <table class="w-full table-fixed border-collapse text-left text-[1em] mt-2">
                        <thead>
                            <tr>
                                <th class="w-[5ch] text-left py-0.5 font-bold">CANT.</th>
                                <th class="w-auto text-left pl-1 py-0.5 font-bold">DESCRIPCION</th>
                                <th class="w-[9ch] text-right py-0.5 font-bold">IMPORTE</th>
                            </tr>
                        </thead>
                        <tbody>${lineas}</tbody>
                    </table>
                </section>

                ${TicketPaper.sep(14, 'text-end')}

                <section class="my-1">
                    ${TicketPaper.vacio(e.descuento) ? '' : `
                        <div class="flex justify-end items-baseline text-[1.09em]">
                            <span class="mr-[0.7em]">${esc(opts.labels.descuento)}</span>
                            <span>${esc(e.descuento)}</span>
                        </div>
                    `}
                    <div class="flex justify-end items-baseline font-semibold text-[1.45em]">
                        <span class="mr-[2em]">TOTAL:</span>
                        <span>${esc(e.total)}</span>
                    </div>
                </section>

                ${TicketPaper.sep(14, 'text-end')}

                <section class="my-1">
                    ${e.propina ? `
                        <div class="mt-4 flex justify-center items-baseline gap-[1.45em] text-[1.36em] font-bold">
                            <span class="font-semibold">${esc(opts.labels.propina)}</span>
                            <span>${esc(e.propina)}</span>
                        </div>
                    ` : ''}
                    ${e.letras ? `<p class="mt-1.5 mb-0 text-[1em] leading-[1.3] uppercase text-left">SON:<span>${esc(e.letras)}</span></p>` : ''}
                </section>

                <section class="my-1.5 text-[1em] text-left">
                    <p class="my-0.5">SUBTOTAL:${esc(e.subtotal)}${e.iva === undefined ? '' : `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;IVA:${esc(e.iva)}`}</p>
                    <p class="mt-1 mb-0.5 font-bold text-center">${esc(opts.labels.leyenda)}</p>
                </section>
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }
}
