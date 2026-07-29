// -- Vista --

const SAMPLE_VIEW_HEADER_CARGAS = {
    title:    'Cargas mensuales',
    subtitle: 'Sube los exports del POS en orden. Cada pestana indica el archivo exacto y las hojas que se leeran',
    back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' }
};

const SAMPLE_VIEW_FOOTER_CARGAS = {
    info: '',
    legends: [
        { tone: 'success', label: 'Cargado'    },
        { tone: 'warning', label: 'Pendiente'  },
        { tone: 'danger',  label: 'Con error'  }
    ]
};

// -- Helpers --

const _fmtMX = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const _fmtInt = (n) => Number(n || 0).toLocaleString('en-US');

const _badgeEstadoCarga = (estado) => {
    const map = {
        ok:        { tone: 'b-green',  text: 'OK'        },
        pendiente: { tone: 'b-yellow', text: 'Pendiente' },
        error:     { tone: 'b-red',    text: 'Error'     }
    };
    const c = map[estado] || map.pendiente;
    return `<span class="badge-base ${c.tone}">${c.text}</span>`;
};

const _cellColumna = (letra) => `<span class="w-5 h-5 inline-flex items-center justify-center rounded bg-[#1F2A37] text-gray-400 font-mono text-[9px]">${letra}</span>`;

// -- Datos --

const SAMPLE_CARGAS_DB = {
    'LOG-001': {
        folio:   'LOG-001',
        hora:    '30/06/2026 21:15',
        archivo: 'Reporte_De_Ventas_20260630.xlsx',
        hoja:    'Reporte de ventas',
        filas:   3821,
        control: 2644933.30,
        estado:  'ok'
    },
    'LOG-002': {
        folio:   'LOG-002',
        hora:    '30/06/2026 21:16',
        archivo: 'Reporte_De_Ventas_20260630.xlsx',
        hoja:    'Pagos',
        filas:   3909,
        control: 2644933.30,
        estado:  'ok'
    },
    'LOG-003': {
        folio:   'LOG-003',
        hora:    '30/06/2026 21:18',
        archivo: 'comandas.xls',
        hoja:    'Hoja1',
        filas:   13141,
        control: 0,
        estado:  'ok'
    }
};

const SAMPLE_CARGAS_ARCHIVOS = {
    'sales-report': {
        id:        'sales-report',
        titulo:    'Reporte de ventas',
        subtitulo: 'Sube un solo archivo. El sistema detecta si la hoja es "Reporte de ventas" (tickets) o "Pagos" (formas de pago) y la envia a la tabla correspondiente.',
        esperado:  'Reporte_De_Ventas_YYYYMMDD.xlsx',
        formato:   'XLSX',
        estado:    'ok'
    },
    'commands': {
        id:        'commands',
        titulo:    'Archivo de comandas',
        subtitulo: 'Renglones del POS: que se consumio, mesa, mesero y tiempos. Se guarda fila por fila tal cual viene en el Excel.',
        esperado:  'comandas.xls · columnas A:L · header fila 1',
        formato:   'XLS',
        estado:    'pendiente',
        stats: [
            { id: 'cmRenglones', title: 'Renglones', valor: '-', color: 'text-white' },
            { id: 'cmCuentas',   title: 'Cuentas',   valor: '-', color: 'text-white' },
            { id: 'cmProductos', title: 'Productos', valor: '-', color: 'text-white' },
            { id: 'cmMonto',     title: 'Monto',     valor: '-', color: 'text-white' }
        ]
    }
};

const SAMPLE_CARGAS_HOJAS = [
    {
        icon:      'receipt-text',
        titulo:    'Reporte de ventas',
        detalle:   'columnas A:J · fila 8 · 3,821 tickets',
        bgClass:   'bg-[rgba(16,185,129,0.12)] border border-green-100',
        iconClass: 'text-green-600'
    },
    {
        icon:      'credit-card',
        titulo:    'Pagos',
        detalle:   'columnas A:H · fila 8 · 3,909 pagos',
        bgClass:   'bg-[rgba(28,100,242,0.12)] border border-[#F7E3DC]',
        iconClass: 'text-[#1C64F2]'
    }
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

const _cargaRow = (e) => ({
    id:              e.folio,
    Hora:            `<span class="text-gray-400">${e.hora}</span>`,
    Archivo:         `<span class="font-semibold text-gray-300">${e.archivo}</span>`,
    Hoja:            `<span class="text-gray-400">${e.hoja}</span>`,
    Filas:           `<span class="text-gray-400">${_fmtInt(e.filas)}</span>`,
    'Control total': `<span class="font-semibold text-gray-300">${_fmtMX(e.control)}</span>`,
    Estado:          _badgeEstadoCarga(e.estado),
    a: [
        {
            class:   'btn-ghost !py-1 !px-2 text-[11px]',
            html:    '<i data-lucide="download" class="w-3.5 h-3.5"></i>Descargar',
            onclick: `cargas.downloadCarga('${e.folio}')`
        }
    ]
});

const _columnaRow = (c) => ({
    id:    c.letra,
    Col:   _cellColumna(c.letra),
    Campo: `<span class="text-gray-400">${c.campo}</span>`
});

const SAMPLE_CARGAS_COLUMNAS_TABLE = {
    row: SAMPLE_CARGAS_COLUMNAS.map(_columnaRow)
};

// -- Catalogos --

const SAMPLE_CARGAS_MESES = [
    { id: '06', valor: 'Junio'   },
    { id: '05', valor: 'Mayo'    },
    { id: '04', valor: 'Abril'   },
    { id: '03', valor: 'Marzo'   },
    { id: '02', valor: 'Febrero' },
    { id: '01', valor: 'Enero'   }
];

const SAMPLE_CARGAS_ANIOS = [
    { id: '2026', valor: '2026' },
    { id: '2025', valor: '2025' }
];

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
