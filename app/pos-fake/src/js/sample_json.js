const SAMPLE_VIEW_HEADER = {
    title:    'Cuentas de Ventas',
    subtitle: 'Consulta los registros de ventas por sucursal, rango de fecha y turno',
    toggles: [
        {
            key:   'rol',
            label: 'Rol demo:',
            value: 'admin',
            options: [
                { value: 'admin',    label: 'Administrador' },
                { value: 'vendedor', label: 'Vendedor'      }
            ]
        },
        {
            key:   'dia',
            label: 'Dia:',
            value: 'abierto',
            options: [
                { value: 'abierto', label: 'Abierto' },
                { value: 'cerrado', label: 'Cerrado' }
            ]
        }
    ]
};

const SAMPLE_VIEW_FOOTER = {
    info: 'Mostrando 5 de 5 ventas',
    legends: [
        { tone: 'success', label: 'Pagado'      },
        { tone: 'danger',  label: 'Cancelado'   },
        { tone: 'success', label: 'Dia abierto' }
    ]
};

const SAMPLE_VENTAS_TABLE = {
    row: [
        {
            id: 1043,
            Folio:     'V-1043',
            Cliente:   'Andrea Martinez',
            Estatus:   '<span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:rgba(63,193,137,0.18);color:#3FC189;">PAGADO</span>',
            Fecha:     '10/05/2026 12:15',
            Total:     '$897.00',
            Descuento: '-$13.00',
            Pago:      'Mixto',
            a: [
                { class:'btn btn-sm btn-secondary me-1', html:'<i class="icon-eye"></i>',         onclick:'app.renderDetail(SAMPLE_SALE)' },
                { class:'btn btn-sm btn-primary me-1',   html:'<i class="icon-pencil"></i>',      onclick:'app.editVenta(1043)' },
                { class:'btn btn-sm btn-danger',         html:'<i class="icon-trash-empty"></i>', onclick:'app.cancelVenta(1043)' }
            ]
        },
        {
            id: 1042,
            Folio:     'V-1042',
            Cliente:   '<span class="italic text-gray-400">N/A</span>',
            Estatus:   '<span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:rgba(63,193,137,0.18);color:#3FC189;">PAGADO</span>',
            Fecha:     '10/05/2026 11:42',
            Total:     '$485.00',
            Descuento: '-$18.00',
            Pago:      'Tarjeta',
            a: [
                { class:'btn btn-sm btn-secondary me-1', html:'<i class="icon-eye"></i>',         onclick:'app.renderDetail(SAMPLE_SALE)' },
                { class:'btn btn-sm btn-primary me-1',   html:'<i class="icon-pencil"></i>',      onclick:'app.editVenta(1042)' },
                { class:'btn btn-sm btn-danger',         html:'<i class="icon-trash-empty"></i>', onclick:'app.cancelVenta(1042)' }
            ]
        },
        {
            id: 1041,
            Folio:     'V-1041',
            Cliente:   'Carlos Ramirez',
            Estatus:   '<span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:rgba(63,193,137,0.18);color:#3FC189;">PAGADO</span>',
            Fecha:     '10/05/2026 10:58',
            Total:     '$2,170.00',
            Descuento: '-$180.00',
            Pago:      'Transferencia',
            a: [
                { class:'btn btn-sm btn-secondary me-1', html:'<i class="icon-eye"></i>',         onclick:'app.renderDetail(SAMPLE_SALE)' },
                { class:'btn btn-sm btn-primary me-1',   html:'<i class="icon-pencil"></i>',      onclick:'app.editVenta(1041)' },
                { class:'btn btn-sm btn-danger',         html:'<i class="icon-trash-empty"></i>', onclick:'app.cancelVenta(1041)' }
            ]
        },
        {
            id: 1040,
            Folio:     'V-1040',
            Cliente:   '<span class="italic text-gray-400">N/A</span>',
            Estatus:   '<span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:rgba(224,36,36,0.18);color:#E02424;">CANCELADO</span>',
            Fecha:     '10/05/2026 10:20',
            Total:     '$220.00',
            Descuento: '$0.00',
            Pago:      'Efectivo',
            a: [
                { class:'btn btn-sm btn-secondary me-1',        html:'<i class="icon-eye"></i>',         onclick:'app.renderDetail(SAMPLE_SALE)' },
                { class:'btn btn-sm btn-primary me-1 disabled', html:'<i class="icon-pencil"></i>',      onclick:'return false' },
                { class:'btn btn-sm btn-danger disabled',       html:'<i class="icon-trash-empty"></i>', onclick:'return false' }
            ]
        },
        {
            id: 1039,
            Folio:     'V-1039',
            Cliente:   'Maria Gonzalez',
            Estatus:   '<span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:rgba(63,193,137,0.18);color:#3FC189;">PAGADO</span>',
            Fecha:     '09/05/2026 19:33',
            Total:     '$890.00',
            Descuento: '$0.00',
            Pago:      'Mixto',
            a: [
                { class:'btn btn-sm btn-secondary me-1', html:'<i class="icon-eye"></i>',         onclick:'app.renderDetail(SAMPLE_SALE)' },
                { class:'btn btn-sm btn-primary me-1',   html:'<i class="icon-pencil"></i>',      onclick:'app.editVenta(1039)' },
                { class:'btn btn-sm btn-danger',         html:'<i class="icon-trash-empty"></i>', onclick:'app.cancelVenta(1039)' }
            ]
        }
    ]
};

const SAMPLE_FILTERS = [

    {
        opc:      'select',
        id:       'cash_shift_id',
        lbl:      'Turno:',
        class:    'col-12 col-md-3 col-lg-2',
        onchange: 'app.onChangeFilters()',
        data:     []
    },
    // {
    //     opc:      'select',
    //     id:       'fTurno',
    //     lbl:      'Periodo:',
    //     class:    'col-12 col-md-3 col-lg-2',
    //     onchange: 'app.onChangeFilters()',
    //     data: [
    //         { id: 'actual', valor: 'Turno actual' },
    //         { id: 'dia',    valor: 'Dia actual'   },
    //         { id: 'rango',  valor: 'Por rango de fecha' }
    //     ]
    // },
    {
        opc:   'input-calendar',
        id:    'calendarPOSPedidos',
        lbl:   'Rango de fecha:',
        class: 'col-12 col-md-4 col-lg-3'
    },
    {
        opc:      'select',
        id:       'status',
        lbl:      'Estatus:',
        class:    'col-12 col-md-3 col-lg-2',
        onchange: 'app.onChangeFilters()',
        data: [
            { id: '1', valor: 'Pendiente'  },
            { id: '2', valor: 'En proceso' },
            { id: '3', valor: 'Pagado'     },
            { id: '4', valor: 'Cancelado'  }
        ]
    }
];

const SAMPLE_KPIS = [
    { id:'kpiCount', label:'Ventas',      value: 12,         tone:'default' },
    { id:'kpiTotal', label:'Monto total', value:'$4,820.00', tone:'success' },
    { id:'kpiDesc',  label:'Descuentos',  value:'$320.00',   tone:'warning' },
    { id:'kpiCanc',  label:'Canceladas',  value: 1,          tone:'danger'  }
];

const SAMPLE_SALE = {
    id:1043, folio:'V-1043',
    estatus:'pagado',
    fecha:'2026-05-10T12:15:00',
    sucursal:'kafeto', turno:'manana', turnoCerrado:false,
    cliente:{ name:'Andrea Martinez', phone:'9611234567', email:'andrea.m@example.com' },
    nota:'Cliente frecuente, sin bolsa',
    items:[
        { name:'3 Leches Choco', qty:1, price:700, discount:0  },
        { name:'Latte Vainilla', qty:2, price:65,  discount:10 },
        { name:'Cupcake',        qty:4, price:55,  discount:0  }
    ],
    pagos:[
        { clave:'EFE', name:'Efectivo',           amount:500 },
        { clave:'TDC', name:'Tarjeta de Credito', amount:760 }
    ]
};
