// UploadCheck — el aviso de por que un Excel del POS no se pudo cargar.
//
// Lo comparten los dos sitios que suben un libro: la pantalla de Importacion, que
// lo muestra en un dialogo, y el modal de "Actualizar ventas" de Tickets, que lo
// pinta dentro de su propio cuerpo. El motivo, el detalle y la forma de dibujarlo
// son los mismos; lo unico que cambia es el marco, y ese lo pone quien llama.
//
// Cinco motivos, cada uno explicado con lo que hace falta para corregirlo:
//   · hojas     el libro no es el de esta pestana. Se enfrentan las hojas que
//               deberia traer con las que trae.
//   · otro-tab  es de otra pestana. Sus hojas van en ambar: no estan mal, estan
//               en el lugar equivocado.
//   · columnas  la fila de encabezados no cuadra. Se dibuja "Debe decir" contra
//               "Tu archivo" para ver donde empieza el desfase.
//   · tickets   el periodo ya tiene notas emitidas y no admite cargas.
//   · periodo   el archivo no es del mes al que se esta subiendo.
//
// El contexto lo aporta la pantalla porque cada una nombra las cosas a su manera:
//   { titulo, periodo, sugerido }
//   titulo    como se llama el archivo que esperaba el destino
//   periodo   el mes y el ano del filtro, ya escritos
//   sugerido  como se llama la pestana a la que pertenece (solo en otro-tab)
class UploadCheck {

    static esc(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Las letras de la hoja. Es lo que vuelve inconfundible que el dibujo es un
    // Excel: sin ellas la cuadricula sola se lee como una tabla cualquiera.
    static get COLUMNAS() {
        return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    }

    // El caso de la pestana equivocada es el unico que pregunta: los demas no
    // tienen nada que ofrecer, solo que corregir el archivo o el periodo.
    static mueve(v) {
        return (v || {}).motivo === 'otro-tab';
    }

    // Ni el archivo ni el periodo se pueden corregir desde el aviso: son cierres,
    // no errores del libro.
    static cerrado(v) {
        const motivo = (v || {}).motivo;

        return motivo === 'tickets' || motivo === 'periodo';
    }

    // El archivo de otro mes SI tiene salida: cargarlo en el mes que de verdad
    // contiene. El servidor manda el periodo en numeros junto al escrito, y sin
    // esos numeros no hay a donde moverlo y el aviso se queda en avisar.
    static mudaPeriodo(v) {
        const val = v || {};

        return val.motivo === 'periodo' && val.mesArchivo > 0 && val.anioArchivo > 0;
    }

    static title(v, ctx) {
        const c = ctx || {};

        // El candado de las notas emitidas corta dos cosas distintas —volver a
        // cargar el periodo y borrar una carga— y el titulo tiene que decir cual,
        // porque lo que se puede hacer despues no es lo mismo.
        if (v.motivo === 'tickets' && v.accion === 'borrar') return 'Esta carga tiene tickets emitidos';

        return {
            'hojas':    'Este no es el archivo de esta pestana',
            'otro-tab': 'Este archivo va en otra pestana',
            'columnas': 'Revisa las columnas del archivo',
            'tickets':  'El periodo ya tiene tickets virtuales',
            'periodo':  `Este archivo no es de ${v.periodoFiltro || c.periodo || 'este periodo'}`
        }[v.motivo] || 'El archivo no se pudo procesar';
    }

    // El archivo que se estaba subiendo, encabezando el aviso.
    //
    // El icono va en SVG y no como <i data-lucide>: el dialogo se monta y se
    // destruye con SweetAlert, y un icono que necesita que alguien llame a
    // createIcons() despues se queda en blanco la mitad de las veces. Es el mismo
    // motivo por el que el libro de Excel de mas abajo se dibuja con divs y no
    // con una imagen.
    static archivo(fileName, detalle) {
        const esc = UploadCheck.esc;

        return `
            <div class="chk-file">
                <svg class="chk-xls-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"
                          stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                    <path d="M13 2v7h7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                    <path d="m9.2 12.6 5.6 5.8M14.8 12.6l-5.6 5.8"
                          stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                <span class="chk-file-txt">
                    <span class="chk-file-name">${esc(fileName)}</span>
                    ${detalle ? `<span class="chk-file-sub">${esc(detalle)}</span>` : ''}
                </span>
            </div>
        `;
    }

    // Lo que se sabe del archivo antes de entrar en el detalle, que cambia con el
    // motivo: de que hoja y cuantos movimientos cuando el problema es el periodo,
    // cuantas hojas trae cuando lo son las columnas.
    static resumen(v) {
        if (v.motivo === 'periodo') {
            const movs = (v.fuera || 0) + (v.dentro || 0);

            return v.hoja ? `Hoja "${v.hoja}" · ${movs} movimiento(s)` : `${movs} movimiento(s)`;
        }

        if (v.motivo === 'columnas') return `${(v.columnas || []).length} hoja(s) con columnas que no cuadran`;

        return (v.libro || []).length ? `${(v.libro || []).length} hoja(s) en el libro` : '';
    }

    // Las hojas se dibujan como la barra de pestanas de Excel y no como una lista:
    // es lo que el usuario ve al pie de su archivo cuando lo abre, asi que puede
    // comparar sin que nadie le explique donde mirar.
    static libro(titulo, hojas) {
        const esc = UploadCheck.esc;

        return `
            <p class="chk-lead">${titulo}</p>
            <div class="xls-book">
                <div class="xls-head">${UploadCheck.COLUMNAS.map(c => `<span>${c}</span>`).join('')}</div>
                <div class="xls-grid"></div>
                <div class="xls-tabs">
                    ${hojas.map(h => `<span class="xls-tab xls-${h.tone}">${esc(h.nombre)}</span>`).join('')}
                </div>
            </div>
        `;
    }

    static hojasEsperadas(v, ctx) {
        const esc       = UploadCheck.esc;
        const esperadas = v.esperadas || [];
        const libro     = v.libro || [];

        const trae = libro.length
            ? libro.map(h => ({ nombre: h, tone: esperadas.indexOf(h) >= 0 ? 'ok' : 'bad' }))
            : [{ nombre: 'sin hojas', tone: 'bad' }];

        return UploadCheck.libro(
            `Asi debe venir el Excel de <strong>${esc(ctx.titulo)}</strong>:`,
            esperadas.map(h => ({ nombre: h, tone: 'ok' }))
        ) + UploadCheck.libro('Asi viene el que subiste:', trae);
    }

    // El archivo cayo en la pestana equivocada pero es valido en otra: en vez de
    // rechazarlo se ofrece cargarlo donde va. Sus hojas se pintan en ambar y no en
    // rojo porque no estan mal, solo estan en el lugar equivocado.
    static otroTab(v, ctx) {
        const esc   = UploadCheck.esc;
        const suyas = v.suyas || [];

        return `
            <p class="chk-lead">Parece que subiste el archivo de
                <strong>${esc(ctx.sugerido || v.sugerido)}</strong> en la pestana de
                <strong>${esc(ctx.titulo)}</strong>.</p>
            ${UploadCheck.libro(
                'Las hojas que trae son las de esa otra pestana:',
                (v.libro || []).map(h => ({ nombre: h, tone: suyas.indexOf(h) >= 0 ? 'alt' : 'bad' }))
            )}
        `;
    }

    // La fila de encabezados se dibuja como esta en la hoja, con las dos versiones
    // una debajo de otra: sin las columnas que si cuadran no se ve donde empieza el
    // desfase, que es lo que hay que corregir. Se pintan todas y solo se resaltan
    // las que fallan.
    static columnas(v) {
        const esc = UploadCheck.esc;

        const celda = (texto, estado) => `
            <span class="xls-cel ${estado ? 'xls-cel-' + estado : ''}" title="${esc(texto)}">${esc(texto) || '&nbsp;'}</span>
        `;

        const bloqueHoja = (item) => {
            const cols     = item.columnas || item.faltan || [];
            const faltan   = item.faltan || [];
            const perdidas = faltan.filter(c => c.estado === 'ausente');
            const corridas = faltan.filter(c => c.estado === 'movida');

            const resumen = [
                perdidas.length ? `<span class="chk-bad-txt">falta ${perdidas.map(c => esc(c.esperada)).join(', ')}</span>` : '',
                corridas.length ? `<span class="chk-warn-txt">${corridas.length} columna(s) corridas de lugar</span>` : ''
            ].filter(Boolean).join(' · ');

            // Con diez columnas la fila no cabe en el dialogo: se anota cual es la
            // primera que falla para desplazar la hoja hasta ahi al abrir, y que el
            // error se vea sin tener que buscarlo.
            const primerMal = cols.findIndex(c => c.estado !== 'ok');

            return `
                <p class="chk-lead">Hoja <strong>${esc(item.hoja)}</strong>, fila ${esc(item.headerRow)}: ${resumen}</p>
                <div class="xls-book">
                    <div class="xls-scroll" data-mal="${primerMal}">
                        <div class="xls-line">
                            <span class="xls-lbl"></span>
                            ${cols.map(c => `<span class="xls-hcel">${esc(c.letra)}</span>`).join('')}
                        </div>
                        <div class="xls-line">
                            <span class="xls-lbl">Debe decir</span>
                            ${cols.map(c => celda(c.esperada, c.estado === 'ok' ? '' : 'want')).join('')}
                        </div>
                        <div class="xls-line">
                            <span class="xls-lbl">Tu archivo</span>
                            ${cols.map(c => celda(c.encontrada, c.estado === 'ok' ? '' : (c.estado === 'ausente' ? 'bad' : 'alt'))).join('')}
                        </div>
                    </div>
                </div>
            `;
        };

        return (v.columnas || []).map(bloqueHoja).join('');
    }

    // Periodo con notas emitidas. Aqui no hay nada que corregir en el archivo: lo
    // que se dice es por que no se puede cargar y que habria que hacer antes, con
    // las notas nombradas para poder ir a buscarlas.
    static notasEmitidas(v) {
        const esc   = UploadCheck.esc;
        const notas = v.notas || [];

        const rango = v.notaMin === v.notaMax
            ? `la nota <strong>#${esc(v.notaMin)}</strong>`
            : `las notas <strong>#${esc(v.notaMin)}</strong> a <strong>#${esc(v.notaMax)}</strong>`;

        // Borrar y recargar acaban en el mismo sitio —las ventas se van y la nota
        // con ellas— pero el usuario llego por caminos distintos y hay que nombrar
        // el suyo.
        if (v.accion === 'borrar') {
            const fila = (n) => `
                <tr>
                    <td class="chk-col">#${esc(n.note_number)}</td>
                    <td>${esc(n.folio)}</td>
                    <td class="chk-right">$${Number(n.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
            `;

            return `
                <p class="chk-lead">Sobre las ventas de esta carga se emitio ${rango}.
                    Borrarla las dejaria <strong>sin el respaldo que dicen tener</strong>.</p>
                <table class="chk-table">
                    <thead><tr><th>Nota</th><th>Folio</th><th>Total</th></tr></thead>
                    <tbody>${notas.map(fila).join('')}</tbody>
                </table>
                ${v.total > notas.length ? `<p class="chk-note">y ${esc(v.total - notas.length)} mas</p>` : ''}
            `;
        }

        const fila = (n) => `
            <tr>
                <td class="chk-col">#${esc(n.note_number)}</td>
                <td>${esc(n.folio)}</td>
                <td class="chk-right">$${Number(n.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;

        return `
            <p class="chk-lead">Este periodo ya tiene ${rango} emitidas sobre sus ventas.
                Volver a cargar reemplazaria esas ventas y <strong>las notas se borrarian con ellas</strong>.</p>
            <table class="chk-table">
                <thead><tr><th>Nota</th><th>Folio</th><th>Total</th></tr></thead>
                <tbody>${notas.map(fila).join('')}</tbody>
            </table>
            ${v.total > notas.length ? `<p class="chk-note">y ${esc(v.total - notas.length)} mas</p>` : ''}
        `;
    }

    // De que meses es el archivo, escrito.
    //
    // Antes esta caja decia "Julio 2026 +1": nombraba el mes que manda y dejaba los
    // demas en una cuenta. Con 1 284 movimientos de julio y 1 137 de agosto, ese
    // "+1" escondia justo la mitad del archivo.
    //
    // El año se dice una vez cuando todos lo comparten —"Julio y Agosto 2026"— y
    // completo en cada uno cuando el archivo cruza de año.
    static mesesDelArchivo(v) {
        const traen = (v.reparto || []).filter((m) => m.movimientos > 0);

        if (!traen.length) return v.periodoArchivo || 'otro periodo';

        return UploadCheck.listaDeMeses(traen, 'y');
    }

    // Los meses escritos en fila. El año se dice una vez cuando todos lo comparten
    // —"Julio y Agosto 2026"— y completo en cada uno cuando cruzan de año.
    static listaDeMeses(items, union) {
        const anios  = items.map((m) => m.anio).filter((a, i, t) => t.indexOf(a) === i);
        const mismo  = anios.length === 1;
        const partes = items.map((m) => mismo ? String(m.periodo).replace(/\s+\d{4}$/, '') : m.periodo);

        const lista = partes.length === 1
            ? partes[0]
            : partes.slice(0, -1).join(', ') + ` ${union} ` + partes[partes.length - 1];

        return mismo ? `${lista} ${anios[0]}` : lista;
    }

    // Los meses con los que el selector SI admite este archivo.
    //
    // La carga se objeta cuando el mes elegido no esta practicamente en el archivo;
    // cualquier mes que ponga una decima parte o mas de los movimientos entra sin
    // preguntar. Se calcula con el mismo corte que usa el servidor para decidirlo,
    // asi que lo que aqui se ofrece es lo que alli va a pasar.
    static mesesQueAdmiten(v) {
        const traen = (v.reparto || []).filter((m) => m.movimientos > 0);
        const total = traen.reduce((n, m) => n + m.movimientos, 0);

        return traen.filter((m) => m.movimientos * 10 >= total);
    }

    // Lo que dice el boton que acepta la carga.
    //
    // «Moverlo a Julio 2026» solo es cierto cuando el archivo es de un mes. Con dos
    // prometia un destino que no era: aceptando se crean los lotes de julio Y de
    // agosto, porque cada movimiento va al suyo. Con muchos meses no se nombran —el
    // boton no da para una lista— y se dice cuantos son.
    // `elegidos` son las claves marcadas en la lista.
    //
    // Se distingue "no hay seleccion" —sin argumento, y entonces se habla del
    // archivo entero— de "el usuario desmarco todo", que es una lista vacia y tiene
    // que decirlo. Comprobar solo `length` juntaba los dos casos y el boton acababa
    // ofreciendo cargar los meses que acababan de quitarse.
    static accionMover(v, elegidos) {
        let traen = (v.reparto || []).filter((m) => m.movimientos > 0);

        if (Array.isArray(elegidos)) {
            traen = traen.filter((m) => elegidos.indexOf(UploadCheck.claveDeMes(m)) >= 0);
        }

        if (!traen.length)     return 'Elige al menos un mes';
        if (traen.length <= 3) return `Cargar ${UploadCheck.listaDeMeses(traen, 'y')}`;

        return `Cargar los ${traen.length} meses`;
    }

    // La clave con la que viaja un mes al servidor. Es la misma con la que el
    // importador agrupa las filas, asi que lo que se marca aqui es exactamente lo
    // que alla se guarda.
    static claveDeMes(m) {
        return String(m.anio) + '-' + String(m.mes).padStart(2, '0');
    }

    // Los meses que quedaron marcados en la lista.
    static mesesMarcados(scope) {
        return $(scope || document).find('.chk-mes:checked').map((i, e) => $(e).val()).get();
    }

    // Cuantos movimientos pone cada mes. Son las filas que va a tener cada lote, y
    // el archivo se reparte solo: cada movimiento va al suyo.
    //
    // El mes del filtro se marca aunque venga en cero —es el caso normal aqui— para
    // que se lea de un vistazo por que el archivo no es de ese mes: no es que traiga
    // pocos, es que no trae ninguno.
    static reparto(v) {
        const esc   = UploadCheck.esc;
        const meses = v.reparto || [];

        if (!meses.length) return '';

        const tope = meses.reduce((n, m) => Math.max(n, m.movimientos), 0) || 1;

        // Cada mes se puede dejar fuera desmarcandolo, y todos nacen marcados: lo
        // normal es querer el archivo entero, y el que solo quiere un mes lo dice
        // quitando los otros en vez de teniendo que elegirlos uno a uno.
        //
        // El mes sin movimientos no lleva casilla: no hay nada que incluir ni que
        // excluir, y una casilla que no cambia nada solo invita a probarla.
        const casilla = (m) => m.movimientos > 0
            ? `<input type="checkbox" class="chk-mes" value="${esc(UploadCheck.claveDeMes(m))}" checked>`
            : '';

        const fila = (m) => `
            <tr>
                <td class="chk-pick-cell">${casilla(m)}</td>
                <td class="chk-col">${esc(m.periodo)}${m.esDelFiltro ? ' ·' : ''}</td>
                <td class="chk-bar-cell">
                    <span class="chk-bar"><i style="width:${Math.round(m.movimientos * 100 / tope)}%"></i></span>
                </td>
                <td class="chk-right">${esc(Number(m.movimientos).toLocaleString('en-US'))}</td>
            </tr>
        `;

        return `
            <table class="chk-table">
                <tbody>${meses.map(fila).join('')}</tbody>
            </table>
        `;
    }

    // El archivo no es del mes al que se esta subiendo.
    //
    // El aviso enfrenta las dos fechas —la del filtro y la del archivo— porque el
    // error es siempre que una de las dos esta mal, y el usuario tiene que decidir
    // cual: corregir el selector o subir otro archivo. Debajo, los dias con su
    // proporcion, que es lo que le deja reconocer su export.
    static periodoAjeno(v, ctx, compacto) {
        const esc  = UploadCheck.esc;
        const dias = v.dias || [];
        const tope = Math.max(1, v.tope || 0);

        // Los dos periodos vienen escritos del servidor, que los resuelve con el
        // mismo catalogo que llena el selector.
        const filtro     = v.periodoFiltro  || ctx.periodo || 'el periodo elegido';
        const mesArchivo = UploadCheck.mesesDelArchivo(v);

        const fila = (d) => `
            <tr>
                <td class="chk-col">${esc(d.dia)}</td>
                <td class="chk-bar-cell">
                    <span class="chk-bar"><i style="width:${Math.round(d.filas * 100 / tope)}%"></i></span>
                </td>
                <td class="chk-right">${esc(d.filas)}</td>
            </tr>
        `;

        const cabeza = `
            <div class="chk-vs">
                <div class="chk-vs-side">
                    <span class="chk-vs-lbl">Lo estas cargando en</span>
                    <span class="chk-vs-val chk-vs-bad">${esc(filtro)}</span>
                </div>
                <span class="chk-vs-sep">≠</span>
                <div class="chk-vs-side">
                    <span class="chk-vs-lbl">Pero el archivo es de</span>
                    <span class="chk-vs-val">${esc(mesArchivo)}</span>
                </div>
            </div>
        `;

        // El desglose por dia es para reconocer el export cuando no se sabe cual se
        // subio. Donde el archivo esta a la vista —su renglon, con su nombre, justo
        // encima del aviso— no responde ninguna pregunta: los dos meses enfrentados
        // ya dicen lo unico que hay que decidir.
        if (compacto) {
            return cabeza + `
                <p class="chk-lead">Sus <strong>${esc(v.dentro + v.fuera)}</strong> movimientos, por el mes al que pertenecen:</p>
                ${UploadCheck.reparto(v)}
            `;
        }

        return cabeza + `
            <p class="chk-lead">${v.dentro > 0
                ? `Solo <strong>${esc(v.dentro)}</strong> de sus movimientos caen en ${esc(filtro)};
                   los otros <strong>${esc(v.fuera)}</strong> no.`
                : `Ninguno de sus <strong>${esc(v.fuera)}</strong> movimientos cae en ${esc(filtro)}.`}
                Cargarlo aqui sellaria el lote con un mes que el archivo no contiene.</p>

            <table class="chk-table">
                <thead><tr><th>Dia</th><th></th><th class="chk-right">Movs.</th></tr></thead>
                <tbody>${dias.map(fila).join('')}</tbody>
            </table>
            ${v.masDias > 0 ? `<p class="chk-note">y ${esc(v.masDias)} dia(s) mas</p>` : ''}
        `;
    }

    // Que paso con los datos. Son dos lecturas distintas: o no se toco nada, o
    // alguna hoja si alcanzo a entrar y anunciar "no se modifico nada" seria falso.
    //
    // El cierre del aviso de notas no manda a ninguna pantalla a proposito: dar de
    // baja una nota emitida no es una accion que el modulo ofrezca hoy, y
    // prometerla dejaria al usuario buscando un boton que no existe.
    static cierre(v) {
        const esc      = UploadCheck.esc;
        const cargadas = v.cargadas || [];

        if (v.motivo === 'tickets' && v.accion === 'borrar') {
            return 'No se elimino nada. Para poder borrar esta carga hay que eliminar antes esos tickets.';
        }

        const cierres = {
            'otro-tab': 'Todavia no se modifico nada. Si aceptas se revisan sus columnas antes de cargar.',
            'tickets':  'No se modifico ningun dato. Mientras existan esas notas el periodo no admite cargas; se puede cargar en otro mes.',
            'periodo':  'No se modifico ningun dato. Corrige el mes y el año del filtro, o sube el archivo que corresponde a este periodo.'
        };

        // Con el periodo del archivo a la mano el aviso deja de ser un callejon: se
        // ofrece moverlo, y el cierre dice lo que va a pasar si se acepta.
        if (UploadCheck.mudaPeriodo(v)) {
            return `Todavia no se modifico nada. Si aceptas, la carga se guarda en
                    <span class="chk-strong">${UploadCheck.esc(v.periodoArchivo)}</span> en vez de
                    ${UploadCheck.esc(v.periodoFiltro)}.`;
        }

        if (cierres[v.motivo]) return cierres[v.motivo];

        return cargadas.length
            ? `Si entro: <span class="chk-strong">${esc(cargadas.join(' · '))}</span>. El resto no se modifico.`
            : 'No se modifico ningun dato. Corrige el archivo y vuelve a subirlo.';
    }

    // `compacto` es para el aviso que se pinta DENTRO de una pantalla que ya tiene
    // el archivo a la vista y un boton para resolverlo. Ahi la ficha del archivo y
    // el desglose por dia repiten lo que ya esta alrededor; en el dialogo suelto de
    // Importacion, en cambio, son lo unico que hay.
    static box(v, fileName, ctx, opts) {
        const c = ctx || {};
        const o = opts || {};

        const cuerpos = {
            'hojas':    () => UploadCheck.hojasEsperadas(v, c),
            'otro-tab': () => UploadCheck.otroTab(v, c),
            'columnas': () => UploadCheck.columnas(v),
            'tickets':  () => UploadCheck.notasEmitidas(v),
            'periodo':  () => UploadCheck.periodoAjeno(v, c, o.compacto)
        };

        const suave = UploadCheck.mueve(v) || UploadCheck.cerrado(v);
        const tono  = suave ? 'chk-note' : ((v.cargadas || []).length ? 'chk-partial' : 'chk-safe');

        // El cierre dice que paso con los datos y como sigue. Cuando la pantalla ya
        // ofrece la salida en un boton, esa frase se vuelve el pie de un cartel que
        // nadie necesita leer dos veces.
        const cierre = (o.compacto && UploadCheck.mudaPeriodo(v))
            ? ''
            : `<p class="${tono}">${UploadCheck.cierre(v)}</p>`;

        // Sin nombre no hay ficha que pintar: el aviso no siempre nace de un archivo
        // —el que impide borrar una carga habla de un lote que ya esta en base— y
        // una tarjeta con el hueco del nombre se leeria como un dato que falta.
        return `
            <div class="chk-box">
                ${(o.compacto || !fileName) ? '' : UploadCheck.archivo(fileName, UploadCheck.resumen(v))}
                ${(cuerpos[v.motivo] || cuerpos.columnas)()}
                ${cierre}
            </div>
        `;
    }

    // Cada bloque de columnas se coloca en su primera columna con problema para que
    // el error quede a la vista al abrir. Se llama despues de meter el aviso en el
    // DOM: sin el nodo montado no hay nada que desplazar.
    static settle(scope) {
        $(scope || document).find('.xls-scroll').each(function () {
            const mal = Number($(this).attr('data-mal'));

            if (mal > 1) this.scrollLeft = (mal - 1) * 76;
        });
    }
}
