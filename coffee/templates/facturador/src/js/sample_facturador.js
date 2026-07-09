const SAMPLE_FACTURADOR_META = { porcentaje: 0.70, tasaIva: 0.16 };

const SAMPLE_FACTURADOR_DEFAULT_DAY   = '2026-06-08';
const SAMPLE_FACTURADOR_DEFAULT_MONTH = '2026-06';

const SAMPLE_FACTURADOR_PAYMENT_FORMS = [
    { id: 1, code: '01', name: 'Efectivo' },
    { id: 2, code: '04', name: 'Tarjetas de crédito' }
];

const SAMPLE_FACTURADOR_PAYMENT_METHODS = [
    { id: 1, code: 'PUE', name: 'Pago en una sola exhibición' },
    { id: 2, code: 'PPD', name: 'Pago en parcialidades' }
];

const SAMPLE_FACTURADOR_ORDER_TYPES = [
    { id: 1, name: 'Restaurant' }
];

const SAMPLE_FACTURADOR_CUSTOMERS = [
    { id: 1, rfc: 'XAXX010101000', name: 'PÚBLICO EN GENERAL' },
    { id: 2, rfc: 'SACS810810APA', name: 'JOSE SAUL SANCHEZ CHAVEZ' },
    { id: 3, rfc: 'GCM050221BV0', name: 'Grupo Constructor Metha' },
    { id: 4, rfc: 'ROVE900312H12', name: 'Ernesto Robles Vega' },
    { id: 5, rfc: 'MALL051010QQ8', name: 'Manufacturas del Sur SA de CV' }
];

const SAMPLE_FACTURADOR_BRIDGE_PRODUCTS = [
    { id: 1,  clave: 'PAR-001', name: 'Parrillada Argentina',     price: 645.00 },
    { id: 2,  clave: 'COR-003', name: 'Rib Eye 400g',             price: 985.00 },
    { id: 3,  clave: 'BEB-014', name: 'Limonada mineral',         price: 65.00  },
    { id: 4,  clave: 'CER-021', name: 'Cerveza artesanal',        price: 95.00  },
    { id: 5,  clave: 'ENT-007', name: 'Queso fundido',            price: 185.00 },
    { id: 6,  clave: 'ENT-010', name: 'Guacamole tradicional',    price: 110.00 },
    { id: 7,  clave: 'POS-002', name: 'Flan napolitano',          price: 95.00  },
    { id: 8,  clave: 'BEB-002', name: 'Agua fresca de horchata',  price: 55.00  },
    { id: 9,  clave: 'COR-005', name: 'Arrachera 300g',           price: 540.00 },
    { id: 10, clave: 'BEB-030', name: 'Café americano',           price: 45.00  }
];

const SAMPLE_FACTURADOR_MESES = [
    { id: '2026-06', valor: 'Junio 2026' },
    { id: '2026-05', valor: 'Mayo 2026' }
];

const SAMPLE_FACTURADOR_VISTAS = [
    { id: 'dia',   valor: 'Por día' },
    { id: 'mes',   valor: 'Por mes' },
    { id: 'todos', valor: 'Todos' }
];

const _MESES_ES   = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const _MESEROS    = ['JORGE GORDILLO', 'ANA MELGAR', 'LUIS RAMOS', 'CARLA VIDAL', 'MARIO ESQUER', 'DIANA FLORES'];
const _TERMINALES = ['SERVER1', 'SERVER2', 'SERVER3'];

const _rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const _hex = (rnd, n) => { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(rnd() * 16).toString(16); return s; };

const _SEED_FACTURADOR = (() => {
    const rnd = _rng(20260601);
    const sales = [];
    const invoices = [];
    let saleId = 0, posRef = 460800, posMov = 3400, invSeq = 0;

    const days = [];
    for (let d = 25; d <= 31; d++) days.push(['2026-05', d]);
    for (let d = 1; d <= 30; d++)  days.push(['2026-06', d]);

    days.forEach(([mes, d]) => {
        const date = `${mes}-${String(d).padStart(2, '0')}`;
        const nTickets = 3 + Math.floor(rnd() * 6);
        for (let o = 1; o <= nTickets; o++) {
            saleId++; posRef++; posMov++;

            const details = [];
            let total = 0;
            const nItems = 1 + Math.floor(rnd() * 4);
            for (let it = 0; it < nItems; it++) {
                const p = SAMPLE_FACTURADOR_BRIDGE_PRODUCTS[Math.floor(rnd() * SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.length)];
                const qty = 1 + Math.floor(rnd() * 3);
                const sub = qty * p.price;
                const iva = sub - sub / 1.16;
                details.push({ name: p.name, clave: p.clave, qty, price: p.price, subtotal: +sub.toFixed(2), iva: +iva.toFixed(2), total: +sub.toFixed(2), modifier: null });
                total += sub;
            }
            total = +total.toFixed(2);

            const rp = rnd();
            let payments;
            if (rp < 0.35) {
                payments = [{ formCode: '01', amount: total, tip: 0, totalCharged: total }];
            } else if (rp < 0.80) {
                payments = [{ formCode: '04', amount: total, tip: 0, totalCharged: total }];
            } else {
                const cash = +(total * 0.4).toFixed(2);
                payments = [
                    { formCode: '01', amount: cash, tip: 0, totalCharged: cash },
                    { formCode: '04', amount: +(total - cash).toFixed(2), tip: 0, totalCharged: +(total - cash).toFixed(2) }
                ];
            }

            const hasCard = payments.some(p => p.formCode === '04');
            let invoiced = false;
            if (hasCard && rnd() < 0.22) {
                invoiced = true;
                invSeq++;
                const cust = SAMPLE_FACTURADOR_CUSTOMERS[1 + (invSeq % (SAMPLE_FACTURADOR_CUSTOMERS.length - 1))];
                const sub = +(total / 1.16).toFixed(2);
                const tax = +(total - sub).toFixed(2);
                const cancel = rnd() < 0.06;
                invoices.push({
                    id: invSeq,
                    folio: 'A' + String(100 + invSeq),
                    rfc: cust.rfc,
                    name: cust.name,
                    reference: 'AE_' + _hex(rnd, 17).toUpperCase(),
                    uuid: `${_hex(rnd, 8)}-${_hex(rnd, 4)}-${_hex(rnd, 4)}-${_hex(rnd, 4)}-${_hex(rnd, 12)}`,
                    invoiceDate: date,
                    operationDate: date,
                    subtotal: sub,
                    tax,
                    ieps: 0,
                    total,
                    tip: 0,
                    status: cancel ? 'Cancelado' : 'Vigente',
                    paymentFormCode: '04',
                    paymentMethodCode: 'PUE',
                    orderNo: o,
                    invoiceType: 'Auto emisión'
                });
            }

            sales.push({
                id: saleId,
                posRef: String(posRef),
                posMovement: posMov,
                orderSeq: o,
                operationDate: date,
                day: String(d).padStart(2, '0'),
                mesa: rnd() < 0.15 ? null : 'M' + (1 + Math.floor(rnd() * 14)),
                personas: rnd() < 0.15 ? null : 1 + Math.floor(rnd() * 6),
                mesero: _MESEROS[Math.floor(rnd() * _MESEROS.length)],
                terminal: _TERMINALES[Math.floor(rnd() * _TERMINALES.length)],
                status: 'Pagada',
                invoiced,
                ivaRate: 0.16,
                payments,
                details
            });
        }
    });

    return { sales, invoices };
})();

const SAMPLE_FACTURADOR_SALES    = _SEED_FACTURADOR.sales;
const SAMPLE_FACTURADOR_INVOICES = _SEED_FACTURADOR.invoices;

const _money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const _fmtDate = (d) => {
    if (!d) return '';
    const parts = String(d).split('-');
    return (parts[2] && parts[1]) ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
};

const _fmtMes = (m) => {
    if (!m) return '';
    const [y, mm] = String(m).split('-');
    return mm ? `${_MESES_ES[parseInt(mm, 10) - 1] || mm} ${y}` : m;
};

const _nullCell = (v) => (v === null || v === undefined || v === '') ? '<span class="cell-null">NULL</span>' : v;

const _nextId = (arr) => arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;

const _ticketTotal = (sale) => (sale.payments || []).reduce((a, p) => a + (p.totalCharged || 0), 0);

const _isCashOnly = (sale) => (sale.payments || []).length > 0 && sale.payments.every(p => p.formCode === '01');

const _invoiceOf = (sale) => SAMPLE_FACTURADOR_INVOICES.find(inv => inv.orderNo === sale.orderSeq && inv.operationDate === sale.operationDate && inv.status !== 'Cancelado') || null;

const _isInvoiced = (sale) => !!_invoiceOf(sale) || !!sale.invoiced;

const _calcTasasDia = (salesDia) => {
    const metaDia = salesDia.flatMap(s => s.payments).reduce((a, p) => a + (p.totalCharged || 0), 0) * (SAMPLE_FACTURADOR_META.porcentaje || 0.70);
    const tasaPorId = {};
    let acum = 0;
    salesDia.filter(_isInvoiced).forEach(s => { tasaPorId[s.id] = '16%'; acum += _ticketTotal(s); });
    salesDia.filter(s => !_isInvoiced(s)).sort((a, b) => (a.orderSeq || 0) - (b.orderSeq || 0)).forEach(s => {
        if (acum < metaDia) { tasaPorId[s.id] = '16%'; acum += _ticketTotal(s); }
        else { tasaPorId[s.id] = '0%'; }
    });
    return tasaPorId;
};

const _armarProductosPuente = (total) => {
    const pool = [...SAMPLE_FACTURADOR_BRIDGE_PRODUCTS];
    const items = [];
    let sum = 0, guard = 0;
    while (sum < total && pool.length && guard < 200) {
        guard++;
        const prod = pool[Math.floor(Math.random() * pool.length)];
        if (prod.price > (total - sum) * 3) continue;
        const qty = 1 + Math.floor(Math.random() * 3);
        const line = qty * prod.price;
        if (sum + line > total * 1.6) continue;
        items.push({ clave: prod.clave, name: prod.name, qty, price: prod.price });
        sum += line;
        if (items.length >= 12) break;
    }
    return items;
};

const _buildVirtualTicket = (sale) => {
    const total = _ticketTotal(sale);
    const items = _armarProductosPuente(total);
    const subtotal = items.reduce((a, it) => a + it.qty * it.price, 0);
    const discount = Math.max(0, subtotal - total);
    const paymentForm = (sale.payments[0] && sale.payments[0].formCode !== '01') ? 'TARJETA DE CRÉDITO' : 'EFECTIVO';
    return { saleId: sale.id, nota: sale.orderSeq, date: sale.operationDate, items, subtotal, discount, total, paymentForm, mesero: sale.mesero, mesa: sale.mesa, terminal: sale.terminal };
};

const _computeStats = (salesDia) => {
    const totalReal = salesDia.flatMap(s => s.payments).reduce((a, p) => a + (p.totalCharged || 0), 0);
    const pct = SAMPLE_FACTURADOR_META.porcentaje || 0.70;
    const meta = totalReal * pct;
    const facturadas = salesDia.filter(_isInvoiced);
    const totalFact = facturadas.reduce((a, s) => a + _ticketTotal(s), 0);
    const visibles = salesDia.filter(s => _isInvoiced(s) || !_isCashOnly(s));
    const pendientes = visibles.filter(s => !_isInvoiced(s));
    return {
        totalReal, pct, meta, totalFact,
        aFacturar: Math.max(0, meta - totalFact),
        cero: totalReal * (1 - pct),
        ticketsCount: salesDia.length,
        visiblesCount: visibles.length,
        facturadasCount: facturadas.length,
        pendientesCount: pendientes.length,
        montoPend: pendientes.reduce((a, s) => a + _ticketTotal(s), 0),
        logrado: meta > 0 ? (totalFact / meta * 100) : 0
    };
};

const _badgeFolio = (folio) => `<span class="badge-base b-terra">${folio}</span>`;

const _badgeTasa = (tasa, fact) => {
    if (fact) return '<span class="badge-base b-green">16%</span>';
    if (tasa === '16%') return '<span class="badge-base b-terra">16%</span>';
    return '<span class="badge-base b-gray">0%</span>';
};
