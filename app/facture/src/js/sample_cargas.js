// -- Vista --

const SAMPLE_VIEW_HEADER_CARGAS = {
    title:    'Cargas mensuales',
    subtitle: 'Sube los exports del POS en orden. Cada pestana indica el archivo exacto y las hojas que se leeran',
    back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' }
};

// Nombre con el que el POS exporta cada reporte: se compara antes de subir para
// avisar cuando el archivo no corresponde a la pestana activa.
const FACTURE_ARCHIVO_ESPERADO = {
    'sales-report': {
        nombre:  'Reporte de ventas',
        ejemplo: 'Reporte_De_Ventas_YYYYMMDD',
        patron:  /reporte|venta/i
    },
    'commands': {
        nombre:  'Archivo de comandas',
        ejemplo: 'comandas',
        patron:  /comanda/i
    }
};

// Color e icono con que se reconoce cada hoja mientras no hay carga: el estado de
// la carga los pisa despues.
const FACTURE_HOJA_TONO = {
    'Pagos':             { icon: 'credit-card',  bgClass: 'bg-[rgba(28,100,242,0.12)]', iconClass: 'text-[#1C64F2]' },
    'Reporte de ventas': { icon: 'receipt-text', bgClass: 'bg-[rgba(16,185,129,0.12)]', iconClass: 'text-green-600' },
    'comandas':          { icon: 'utensils',     bgClass: 'bg-[rgba(245,158,11,0.12)]', iconClass: 'text-yellow-300' }
};

const FACTURE_HOJA_TONO_DEFAULT = {
    icon: 'sheet', bgClass: 'bg-[#1F2A37]', iconClass: 'text-gray-400'
};

// -- Helpers --

const _cellColumna = (letra) => `<span class="w-5 h-5 inline-flex items-center justify-center rounded bg-[#1F2A37] text-gray-400 font-mono text-[9px]">${letra}</span>`;

// -- Tira de hojas --

// Ids de las pestanas de la tira. Son la llave de todo el segundo nivel: tabLayout
// nombra su boton `tab-{id}` y su panel `container-{id}`, y de ahi cuelgan el
// cuerpo y el pie de cada hoja.
const logKey   = (tabId)  => `log-${tabId}`;
const sheetKey = (loteId) => `sheet-${loteId}`;

const hojaIcono = (nombre) => (FACTURE_HOJA_TONO[nombre] || FACTURE_HOJA_TONO_DEFAULT).icon;

const miles = (n) => Number(n || 0).toLocaleString('en-US');
const pesos = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Esqueleto que tabLayout inyecta en el panel de cada pestana: la tabla arriba con
// su scroll y el pie fijo abajo. min-w-0 en el cuerpo porque la hoja "Pagos" trae
// 9 columnas y sin el se desborda fuera del panel en vez de scrollear dentro.
//
// La columna se arma en un wrapper con h-full y no en el contenedor del tab: ese
// contenedor lleva `hidden` mientras la pestana esta cerrada, y darle display:flex
// seria pelearse con el.
const sheetShell = (id) => `
    <div class="h-full flex flex-col">
        <div id="sheetBody-${id}" class="flex-1 min-h-0 min-w-0 overflow-auto scroll-thin"></div>
        <div id="sheetFoot-${id}" class="flex-shrink-0"></div>
    </div>
`;

const logFoot = (lotes) => {
    const ls    = lotes || [];
    const filas = ls.reduce((a, l) => a + Number(l.row_count || 0), 0);

    if (!ls.length) {
        return { text: 'El periodo no tiene cargas', note: 'Sube el Excel para que aparezcan sus hojas' };
    }

    return {
        text: `<span class="text-gray-400 font-semibold">${ls.length}</span> lote(s) en el periodo · <span class="text-gray-400">${miles(filas)}</span> filas`,
        note: 'Cada hoja abre en su propia pestana'
    };
};

// Pie de una hoja cargada. Cuando el modelo trunca el listado lo dice: la pestana
// anuncia el total del lote y la tabla trae menos filas que eso.
const sheetFoot = (lote, data) => {
    if (!lote) return { text: '' };

    const total    = Number(data.total || 0);
    const traidas  = (data.row || []).length;
    const parcial  = traidas < total ? `<span class="text-gray-400">${miles(traidas)}</span> de ` : '';

    return {
        text: `${parcial}<span class="text-gray-400 font-semibold">${miles(total)}</span> filas ·
               control <span class="text-gray-400">${pesos(lote.control_total)}</span> ·
               ${lote.file_name} · ${lote.stamp}`,
        badges: [{ text: `lote #${lote.id}`, tone: 'b-gray' }],
        actions: [
            {
                class:   'btn-icon-danger',
                icon:    'trash-2',
                title:   'Eliminar esta carga',
                onclick: `cargas.deleteCarga(${lote.id})`
            }
        ]
    };
};

// Tarjeta de hoja del panel lateral. En reposo la hoja solo se anuncia con su
// color; cuando uploadFile responde manda el estado y el color pasa a decir como
// termino la carga.
const _hojaCard = (h) => {
    const tono  = FACTURE_HOJA_TONO[h.nombre] || FACTURE_HOJA_TONO_DEFAULT;
    const ok    = h.estado === 'ok';
    const error = h.estado === 'error';

    return {
        icon:       tono.icon,
        titulo:     h.nombre,
        detalle:    h.detalle,
        bgClass:    error ? 'bg-[rgba(239,68,68,0.12)]' : (ok ? 'bg-[rgba(16,185,129,0.12)]' : tono.bgClass),
        iconClass:  error ? 'text-red-400' : (ok ? 'text-green-600' : tono.iconClass),
        // Sin carga la tarjeta no puede decir "listo": lo que ofrece es abrirse
        // para mostrar sus columnas.
        rightIcon:  error ? 'x-circle' : (ok ? 'check-circle-2' : 'chevron-right'),
        procesando: h.procesando,
        avance:     h.avance === undefined && h.estado ? (ok ? 100 : 0) : h.avance
    };
};

// Las hojas que devuelve la carga traen el resultado pero no el contrato: el
// mapeo de columnas se conserva del que trajo init() para que la hoja siga
// diciendo que se lee de ella.
const _hojasCargadas = (base, hojas) => hojas.map(h => Object.assign(
    {}, (base || []).find(b => b.nombre === h.nombre) || {}, h
));

// -- Datos --

const SAMPLE_CARGAS_ARCHIVOS = {
    'sales-report': {
        id:        'sales-report',
        titulo:    'Reporte de ventas',
        subtitulo: 'Sube un solo archivo. El sistema carga primero la hoja "Pagos" (formas de pago) y despues "Reporte de ventas" (tickets), que las cruza por folio.',
        esperado:  'Reporte_De_Ventas_YYYYMMDD.xlsx',
        formato:   'XLSX',
        estado:    'pendiente'
    },
    'commands': {
        id:        'commands',
        titulo:    'Archivo de comandas',
        subtitulo: 'Renglones del POS: que se consumio, mesa, mesero y tiempos. Se guarda fila por fila tal cual viene en el Excel.',
        esperado:  'comandas.xls · columnas A:L · header fila 1',
        formato:   'XLS',
        estado:    'pendiente'
    }
};

// Hojas que el sistema espera encontrar en cada pestana con las columnas que lee
// de cada una; tras subir el archivo se reemplazan por las que realmente trae, con
// su conteo de registros. Van en el orden en que se cargan: los pagos primero,
// para que las ventas los cruzen por folio.
//
// init() las trae del contrato del importador: estas son el reposo mientras el
// servidor responde.
const SAMPLE_CARGAS_HOJAS = {
    'sales-report': [
        {
            nombre:  'Pagos',
            detalle: 'columnas A:H · header fila 7',
            columnas: [
                { letra: 'A', campo: 'Folio'          },
                { letra: 'B', campo: 'Metodo de pago' },
                { letra: 'C', campo: 'Moneda'         },
                { letra: 'D', campo: 'Importe'        },
                { letra: 'E', campo: 'Tipo de cambio' },
                { letra: 'F', campo: 'Subtotal'       },
                { letra: 'G', campo: 'Impuestos'      },
                { letra: 'H', campo: 'Total'          }
            ]
        },
        {
            nombre:  'Reporte de ventas',
            detalle: 'columnas A:J · header fila 7',
            columnas: [
                { letra: 'A', campo: 'Folio'               },
                { letra: 'B', campo: 'Codigo facturacion'  },
                { letra: 'C', campo: 'Fecha'               },
                { letra: 'D', campo: 'Descuento'           },
                { letra: 'E', campo: 'Subtotal'            },
                { letra: 'F', campo: 'Impuestos'           },
                { letra: 'G', campo: 'Total'               },
                { letra: 'H', campo: 'Fecha de expiracion' },
                { letra: 'I', campo: 'Estado'              },
                { letra: 'J', campo: 'Folio factura'       }
            ]
        }
    ],
    'commands': [
        {
            nombre:  'comandas',
            detalle: 'columnas A:L · header fila 1',
            columnas: [
                { letra: 'A', campo: 'foliocomanda'   },
                { letra: 'B', campo: 'foliocuenta'    },
                { letra: 'C', campo: 'orden'          },
                { letra: 'D', campo: 'fechaapertura'  },
                { letra: 'E', campo: 'fechacierre'    },
                { letra: 'F', campo: 'mesero'         },
                { letra: 'G', campo: 'claveproducto'  },
                { letra: 'H', campo: 'fechadecaptura' },
                { letra: 'I', campo: 'descripcion'    },
                { letra: 'J', campo: 'cantidad'       },
                { letra: 'K', campo: 'descuento'      },
                { letra: 'L', campo: 'importe'        }
            ]
        }
    ]
};

// Roadmap en reposo: los mismos pasos que devuelve uploadFile, sin ejecutar.
const SAMPLE_CARGAS_ROADMAP = [
    { titulo: 'Recibir archivo',   estado: 'pendiente', detalle: 'Sube el Excel del periodo' },
    { titulo: 'Detectar hojas',    estado: 'pendiente', detalle: 'Pagos · Reporte de ventas' },
    { titulo: 'Validar columnas',  estado: 'pendiente', detalle: 'Se comparan contra el formato del POS' },
    { titulo: 'Guardar en base',   estado: 'pendiente', detalle: 'Un lote por hoja · los pagos primero' }
];

// -- Filas --

const _columnaRow = (c) => ({
    id:    c.letra,
    Col:   _cellColumna(c.letra),
    Campo: `<span class="text-gray-400">${c.campo}</span>`
});

// El mapeo se pinta de la hoja que este seleccionada en el panel, por eso la
// tabla se arma en el momento y no queda como constante.
const _columnasTable = (hoja) => ({
    row: ((hoja && hoja.columnas) || []).map(_columnaRow)
});

// -- Catalogos --

const SAMPLE_CARGAS_TABS = [
    {
        id:         'sales-report',
        tab:        'Reporte de ventas',
        lucideIcon: 'sheet',
        active:     true
    },
    {
        id:         'commands',
        tab:        'Comandas',
        lucideIcon: 'utensils',
        active:     false
    }
];
