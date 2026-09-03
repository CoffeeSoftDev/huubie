// TicketPaper — el papel del ticket, replica de la tira que imprime la termica
// del POS. Lo usan el modulo Tickets (vista previa del panel y hoja del dia) y la
// vista previa del emisor en Catalogos: es el mismo papel, asi que vive en un solo
// lugar en vez de en una copia por modulo.
//
// El ticket llega con sus importes ya formateados por el servidor: el papel
// imprime, no calcula. Los renglones que no traen dato no se pintan vacios.
//
// Hay dos papeles porque hay dos sistemas de punto de venta y no imprimen igual.
// El que manda es el `pos_code` del emisor: la sucursal ya sabe con que sistema
// opera, asi que ningun modulo tiene que decidirlo al llamar.
//
// De momento los dos imprimen el papel de Soft Restaurant (ver PRESTADO): del
// ticket de Wansoft todavia no hay una muestra fisica que copiar.
class TicketPaper {

    // La termica arma el ticket sobre una rejilla monoespaciada de 40 columnas: los
    // separadores de "=" ocupan las 40 y el texto largo se corta una columna antes.
    static get COLS() { return 40; }
    static get TEXT_COLS() { return TicketPaper.COLS - 1; }

    // Que renglones del membrete imprime cada papel. No es la misma hoja: Soft
    // Restaurant encabeza con el membrete fiscal completo, y el ticket de Wansoft
    // solo lleva el nombre del negocio —donde el papel fisico trae su logo—, sin
    // lema, RFC ni domicilio. Se capturan igual en el emisor, porque el ticket
    // virtual y la factura los siguen necesitando; lo que cambia es si se imprimen.
    //
    // La llave es el papel y no el sistema: a quien imprime con papel prestado le
    // toca el membrete de ese papel, que es el que se esta imprimiendo.
    //
    // Se puede forzar al llamar con `membrete: ['razon', 'rfc']` cuando una
    // sucursal quiera otra cosa.
    static get MEMBRETE() {
        return {
            pos:     ['razon', 'lema', 'rfc', 'domicilio', 'expedicion', 'telefono'],
            wansoft: ['razon']
        };
    }

    static get DEFAULTS() {
        return {
            parent: 'root',
            id:     'ticketPaper',
            // Sin clase fija: la pone el formato del POS (ver `formato`). Se sigue
            // admitiendo una por parametro para quien quiera forzar un papel.
            class:  '',
            json:   null,
            pos:    '',
            membrete: null,
            emisor: { razon: '', lema: '', rfc: '', domicilio: '', expedicion: '', telefono: '', pos_code: '' },
            // Las frases que la termica imprime siempre, con o sin datos: son parte
            // del papel, no de la sucursal.
            labels: {
                empty:     'Sin ticket seleccionado',
                lugar:     'LUGAR DE EXPEDICION',
                propina:   'PROPINA',
                descuento: 'DESC% C/IMP.:',
                leyenda:   'ESTE NO ES UN COMPROBANTE FISCAL',
                // Las de Wansoft, que rotula sus bloques con frases propias.
                pagado:     'Ticket de Pagado',
                venta:      'Venta en Mesa',
                articulos:  'Artículos:',
                formasPago: 'FORMAS DE PAGO',
                powered:    'Powered by Wansoft v.25.0.6.4'
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

    // Con que sistema opera la sucursal. La llave es el `code` del catalogo de POS,
    // no el nombre: el nombre se puede editar desde Catalogos y dejaria el ticket
    // sin formato.
    static formato(opts) {
        const code = String(opts.pos || (opts.emisor || {}).pos_code || '').toLowerCase();

        return code === 'wansoft' ? 'wansoft' : 'pos';
    }

    // Que sistema imprime con papel prestado. De Wansoft no hay todavia un ticket
    // fisico que copiar, y un formato supuesto se entrega al cliente como si fuera
    // el suyo: hasta que llegue la muestra sale en el papel de Soft Restaurant,
    // que si esta cotejado contra la tira real —membrete fiscal completo incluido,
    // porque es ese papel el que se esta imprimiendo.
    //
    // `paperWansoft` se queda armado tal cual: en cuanto haya con que compararlo se
    // borra esta llave y vuelve a entrar sin tocar nada mas.
    static get PRESTADO() {
        return { wansoft: 'pos' };
    }

    // El papel que de verdad se imprime, ya resuelto el prestamo. Es lo que tiene
    // que consultar quien rotule algo del formato (la banda de la vista previa del
    // emisor), o la pantalla diria una cosa y el papel imprimiria otra.
    static papel(opts) {
        const formato = TicketPaper.formato(opts);

        return TicketPaper.PRESTADO[formato] || formato;
    }

    // Un renglon del membrete solo se imprime si el papel lo lleva y si tiene dato:
    // devuelve cadena vacia en los dos casos, que es lo que el render ya sabe no
    // pintar.
    static membrete(opts, campo) {
        return (opts.membrete || []).indexOf(campo) < 0 ? '' : (opts.emisor[campo] || '');
    }

    // El encabezado del papel: el logo si la sucursal lo tiene cargado, y si no la
    // razon social. Nunca los dos —son el mismo dato dicho de dos maneras y juntos
    // imprimen el nombre repetido—, por eso la razon social viaja igual en el `alt`:
    // si la imagen no carga, el papel sigue diciendo de quien es.
    static encabezado(opts, razon, claseTexto) {
        const esc  = TicketPaper.esc;
        const logo = (opts.emisor || {}).logo || '';

        if (logo) return `<img src="${esc(logo)}" alt="${esc(razon)}" class="tk-logo">`;

        return razon ? `<h2 class="${claseTexto}">${esc(razon)}</h2>` : '';
    }

    // -- Render --

    static render(options) {
        const defaults = TicketPaper.DEFAULTS;
        const o        = options || {};
        const opts     = Object.assign({}, defaults, o);

        opts.emisor = Object.assign({}, defaults.emisor, o.emisor || {});
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const esc   = TicketPaper.esc;
        const papel = TicketPaper.papel(opts);
        const wrap  = $('<div>', { id: opts.id, class: opts.class || `ticket-paper tk-${papel}` });

        opts.membrete = o.membrete || TicketPaper.MEMBRETE[papel];

        if (!opts.json) {
            // Las 40 columnas tambien aqui: el papel vacio conserva el ancho de la
            // tira, no se encoge al tamano del aviso.
            //
            // Y tampoco se encoge de alto: tk-empty le da el del panel (ver
            // facture.css) para que siga siendo una tira de papel sin nada impreso
            // y no una tarjeta suelta a media altura. El aviso se centra solo.
            wrap.addClass('tk-empty');
            wrap.html(`<p class="w-[40ch] text-center text-[11px] text-gray-400">${esc(opts.labels.empty)}</p>`);
            $(`#${opts.parent}`).html(wrap);
            return;
        }

        wrap.html(papel === 'wansoft'
            ? TicketPaper.paperWansoft(opts)
            : TicketPaper.paperPos(opts));

        $(`#${opts.parent}`).html(wrap);
    }

    // -- Papel Soft Restaurant --

    static paperPos(opts) {
        const esc = TicketPaper.esc;
        const e   = opts.json;
        const m   = {
            razon:      TicketPaper.membrete(opts, 'razon'),
            lema:       TicketPaper.membrete(opts, 'lema'),
            rfc:        TicketPaper.membrete(opts, 'rfc'),
            domicilio:  TicketPaper.membrete(opts, 'domicilio'),
            expedicion: TicketPaper.membrete(opts, 'expedicion'),
            telefono:   TicketPaper.membrete(opts, 'telefono')
        };

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

        // La rejilla mide 40 caracteres y el tamano de esa columna lo pone el papel
        // (.tk-pos en facture.css): aqui no se fija ninguno, o el 40ch mediria una
        // columna y el texto de adentro otra.
        //
        // De ahi que los tamanos de abajo vayan en em: son proporciones de esa
        // misma columna, asi la tira entera sigue al tamano del papel.
        return `
            <div class="w-[40ch] mx-auto leading-[1.35]">
                <header>
                    ${TicketPaper.encabezado(opts, m.razon, 'mt-0 mb-0.5 text-[1.18em] font-bold uppercase tracking-[0.02em] leading-[1.3]')}
                    ${m.lema ? `<p class="m-0">${esc(m.lema)}</p>` : ''}
                    ${m.rfc  ? `<p class="m-0">RFC:${esc(m.rfc)}</p>` : ''}
                    ${m.domicilio ? `<div class="mt-0.5 uppercase whitespace-pre">${esc(TicketPaper.wrapCols(m.domicilio))}</div>` : ''}
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
                    ${e.letras ? `<p class="mt-1.5 mb-0 max-w-[${TicketPaper.TEXT_COLS}ch] text-[1em] leading-[1.3] uppercase text-left">SON:<span>${esc(e.letras)}</span></p>` : ''}
                </section>

                <section class="my-1.5 text-[1em] text-left">
                    <p class="my-0.5">SUBTOTAL:${esc(e.subtotal)}${e.iva === undefined ? '' : `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;IVA:${esc(e.iva)}`}</p>
                    <p class="mt-1 mb-0.5 font-bold text-center">${esc(opts.labels.leyenda)}</p>
                </section>
            </div>
        `;
    }

    // -- Papel Wansoft --

    // Wansoft no imprime una tira monoespaciada: su ticket sale con letra
    // proporcional, reglas horizontales entre bloques y la etiqueta contra el
    // margen izquierdo con su valor contra el derecho. Por eso no reusa nada del
    // papel de arriba —ni la rejilla de 40 columnas ni el corte por caracteres— y
    // solo comparte el membrete, que es dato del emisor y no del sistema.
    //
    // Los renglones llegan con el vocabulario de Wansoft (movimiento, hora de
    // cierre, formas de pago) y caen a los nombres del otro POS cuando no vienen:
    // asi un ticket ya armado se puede ver en este papel sin regenerarlo.
    static paperWansoft(opts) {
        const esc = TicketPaper.esc;
        const e   = opts.json;
        const l   = opts.labels;
        const m   = {
            razon:      TicketPaper.membrete(opts, 'razon'),
            lema:       TicketPaper.membrete(opts, 'lema'),
            rfc:        TicketPaper.membrete(opts, 'rfc'),
            domicilio:  TicketPaper.membrete(opts, 'domicilio'),
            expedicion: TicketPaper.membrete(opts, 'expedicion'),
            telefono:   TicketPaper.membrete(opts, 'telefono')
        };

        const movimiento = e.movimiento || e.folio || '';
        const fechaOp    = e.fechaOperacion || String(e.fechaHora || e.fecha || '').split(' ')[0];
        const impresion  = e.fechaImpresion || e.fechaHora || '';
        const articulos  = e.articulos === undefined ? TicketPaper.articulos(e.lineas) : e.articulos;
        const pagos      = TicketPaper.pagos(e);

        const lineas = (e.lineas || []).map(li => `
            <tr>
                <td class="w-[6ch] text-left align-top">${esc(li.cant)}</td>
                <td class="w-auto text-left pr-2 align-top">${esc(li.nombre)}</td>
                <td class="w-[9ch] text-right align-top whitespace-nowrap">${esc(li.importe)}</td>
            </tr>
        `).join('');

        const filasPago = pagos.map(p => `
            <tr>
                <td class="text-left align-top">${esc(p.nombre)}</td>
                <td class="text-right align-top whitespace-nowrap">${esc(p.monto)}</td>
                <td class="text-right align-top whitespace-nowrap">${esc(p.propina)}</td>
                <td class="text-right align-top whitespace-nowrap">${esc(p.cambio)}</td>
            </tr>
        `).join('');

        return `
            <div class="w-full">
                <header class="text-center">
                    ${TicketPaper.encabezado(opts, m.razon, 'm-0 text-[1.7em] font-bold leading-[1.15]')}
                    ${m.lema ? `<p class="m-0 text-[1.1em]">${esc(m.lema)}</p>` : ''}
                    ${m.rfc  ? `<p class="mt-1 mb-0">RFC: ${esc(m.rfc)}</p>` : ''}
                    ${m.domicilio ? `<p class="m-0 uppercase">${esc(m.domicilio)}</p>` : ''}
                    ${m.expedicion ? `<p class="m-0 uppercase">${esc(l.lugar)}: ${esc(m.expedicion)}</p>` : ''}
                    ${m.telefono ? `<p class="m-0">Tel: ${esc(m.telefono)}</p>` : ''}
                </header>

                <section class="mt-4 text-center font-bold">
                    <p class="m-0">${esc(l.pagado)}</p>
                    <p class="m-0">${esc(e.tipoOrden || l.venta)}</p>
                </section>

                ${TicketPaper.rule()}

                <p class="my-1 text-center">${esc(e.cuenta || e.nota || '')}</p>

                ${TicketPaper.rule()}

                <section class="my-1 font-bold">
                    ${TicketPaper.fila('Movimiento:', movimiento)}
                    ${TicketPaper.fila('Fecha operación:', fechaOp)}
                </section>

                ${TicketPaper.rule()}

                <section class="my-1 font-bold">
                    ${TicketPaper.fila('Orden:', e.orden, 'text-[1.7em] leading-[1.2]')}
                    ${TicketPaper.fila('Mesa:',  e.mesa,  'text-[1.7em] leading-[1.2]')}
                    ${TicketPaper.fila('Personas:', e.personas)}
                    ${TicketPaper.fila('Mesero:',   e.mesero)}
                    ${TicketPaper.fila('Hora Entrada:', e.horaEntrada)}
                    ${TicketPaper.fila('Hora Impresión Preticket:', e.horaPreticket)}
                    ${TicketPaper.fila('Hora Cierre:', e.horaCierre || e.hora)}
                </section>

                ${TicketPaper.rule()}

                <section>
                    <table class="w-full table-fixed">
                        <thead>
                            <tr>
                                <th class="w-[6ch] text-left">Cant.</th>
                                <th class="w-auto text-left pr-2">Descripción</th>
                                <th class="w-[9ch] text-right">Importe</th>
                            </tr>
                        </thead>
                        <tbody>${lineas}</tbody>
                    </table>
                </section>

                ${TicketPaper.rule()}

                <p class="my-1">${esc(l.articulos)} ${esc(articulos)}</p>

                ${TicketPaper.rule()}

                <section class="my-1 text-right">
                    ${TicketPaper.vacio(e.descuento) ? '' : `<p class="m-0">Descuento: ${esc(e.descuento)}</p>`}
                    ${e.subtotal ? `<p class="m-0">Subtotal: ${esc(e.subtotal)}</p>` : ''}
                    ${e.iva === undefined ? '' : `<p class="m-0">IVA: ${esc(e.iva)}</p>`}
                    <p class="m-0 text-[1.55em] font-bold leading-[1.2]">Gran Total: ${esc(e.total)}</p>
                </section>

                ${e.letras ? `<p class="my-1 text-center uppercase">${esc(e.letras)}</p>` : ''}

                ${TicketPaper.rule()}

                <section>
                    <p class="m-0 text-center font-bold">${esc(l.formasPago)}</p>
                    <table class="w-full table-fixed">
                        <thead>
                            <tr>
                                <th class="text-left">Nombre</th>
                                <th class="text-right">Monto</th>
                                <th class="text-right">Propina</th>
                                <th class="text-right">Cambio</th>
                            </tr>
                        </thead>
                        <tbody>${filasPago}</tbody>
                    </table>
                </section>

                ${(e.terminal || impresion) ? `
                    ${TicketPaper.rule()}
                    <section class="my-1">
                        ${TicketPaper.fila('Terminal:', e.terminal)}
                        ${TicketPaper.fila('Fecha impresión:', impresion)}
                    </section>
                ` : ''}

                ${TicketPaper.rule()}

                <p class="m-0 text-right">${esc(l.powered)}</p>
            </div>
        `;
    }

    // -- Helpers del papel Wansoft --

    // La regla horizontal con la que Wansoft parte sus bloques: es una linea, no
    // una fila de "=", asi que la dibuja el CSS y no el texto.
    static rule() {
        return '<div class="tk-rule"></div>';
    }

    // Etiqueta contra el margen izquierdo y valor contra el derecho. Sin valor no
    // se imprime el renglon: un ticket para llevar no trae mesa y la etiqueta sola
    // se leeria como un dato perdido.
    static fila(label, value, extra) {
        if (value === undefined || value === null || value === '') return '';

        const esc = TicketPaper.esc;

        return `
            <div class="flex items-baseline justify-between gap-2 ${extra || ''}">
                <span>${esc(label)}</span><span class="text-right">${esc(value)}</span>
            </div>
        `;
    }

    // Wansoft imprime cuantas piezas se sirvieron, no cuantos renglones tiene la
    // comanda: dos veces el mismo platillo son dos articulos en una sola linea.
    static articulos(lineas) {
        return (lineas || []).reduce((total, li) => total + (Number(li.cant) || 0), 0);
    }

    // El bloque de formas de pago admite varias filas porque una cuenta se puede
    // partir. El ticket virtual se cobra de una sola forma, asi que cuando no
    // llega el arreglo se arma la unica fila con lo que si trae el papel.
    static pagos(e) {
        if (Array.isArray(e.pagos) && e.pagos.length) return e.pagos;

        if (!e.metodo && !e.total) return [];

        return [{
            nombre:  e.metodo || '',
            monto:   e.total   || '',
            propina: e.propina || '',
            cambio:  e.cambio  || ''
        }];
    }
}
