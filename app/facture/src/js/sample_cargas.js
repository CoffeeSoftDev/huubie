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

// -- Helpers --

const _cellColumna = (letra) => `<span class="w-5 h-5 inline-flex items-center justify-center rounded bg-[#1F2A37] text-gray-400 font-mono text-[9px]">${letra}</span>`;

// Tarjeta de hoja detectada a partir de la respuesta de uploadFile.
const _hojaCard = (h) => {
    const ok = h.estado === 'ok';
    return {
        icon:      h.nombre === 'Pagos' ? 'credit-card' : 'receipt-text',
        titulo:    h.nombre,
        detalle:   h.detalle,
        bgClass:   ok ? 'bg-[rgba(16,185,129,0.12)]' : 'bg-[rgba(239,68,68,0.12)]',
        iconClass: ok ? 'text-green-600' : 'text-red-400',
        avance:    h.avance === undefined ? (ok ? 100 : 0) : h.avance
    };
};

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

// Hojas que el sistema espera encontrar; tras subir el archivo se reemplazan por
// las que realmente trae, con su conteo de registros. Van en el orden en que se
// cargan: los pagos primero, para que las ventas los cruzen por folio.
const SAMPLE_CARGAS_HOJAS = [
    {
        icon:      'credit-card',
        titulo:    'Pagos',
        detalle:   'columnas A:H · header fila 7',
        bgClass:   'bg-[rgba(28,100,242,0.12)]',
        iconClass: 'text-[#1C64F2]'
    },
    {
        icon:      'receipt-text',
        titulo:    'Reporte de ventas',
        detalle:   'columnas A:J · header fila 7',
        bgClass:   'bg-[rgba(16,185,129,0.12)]',
        iconClass: 'text-green-600'
    }
];

// Roadmap en reposo: los mismos pasos que devuelve uploadFile, sin ejecutar.
const SAMPLE_CARGAS_ROADMAP = [
    { titulo: 'Recibir archivo',   estado: 'pendiente', detalle: 'Sube el Excel del periodo' },
    { titulo: 'Detectar hojas',    estado: 'pendiente', detalle: 'Pagos · Reporte de ventas' },
    { titulo: 'Validar columnas',  estado: 'pendiente', detalle: 'Se comparan contra el formato del POS' },
    { titulo: 'Guardar en base',   estado: 'pendiente', detalle: 'Un lote por hoja · los pagos primero' }
];

const SAMPLE_CARGAS_COLUMNAS = [
    { letra: 'A', campo: 'foliocomanda'   },
    { letra: 'B', campo: 'foliocuenta'    },
    { letra: 'C', campo: 'orden (mesa)'   },
    { letra: 'D', campo: 'fechaapertura'  },
    { letra: 'E', campo: 'fechacierre'    },
    { letra: 'F', campo: 'mesero'         },
    { letra: 'G', campo: 'claveproducto'  },
    { letra: 'H', campo: 'fechadecaptura' },
    { letra: 'I', campo: 'descripcion'    },
    { letra: 'J', campo: 'cantidad'       },
    { letra: 'K', campo: 'descuento'      },
    { letra: 'L', campo: 'importe'        }
];

// -- Filas --

const _columnaRow = (c) => ({
    id:    c.letra,
    Col:   _cellColumna(c.letra),
    Campo: `<span class="text-gray-400">${c.campo}</span>`
});

const SAMPLE_CARGAS_COLUMNAS_TABLE = {
    row: SAMPLE_CARGAS_COLUMNAS.map(_columnaRow)
};

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
