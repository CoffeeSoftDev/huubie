/* ============================================================
   Facturador SAT · Boceto Fase 1
   Simulaciones frontend: datos, tabs, filtros, selección, impresión
   ============================================================ */

const fmtMX = n => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = n => Number(n).toLocaleString('es-MX');
const parseMX = s => Number(String(s).replace(/[^0-9.-]/g, '')) || 0;

// ---------- Datos de ejemplo ----------
const PAYMENTS = [
  { id:'461831', order:1, date:'2026-06-10', method:'Efectivo', status:'Pagada', waiter:'JORGE GORDILLO', terminal:'SERVER1', amount:1058.20, tip:0, total:1058.20, fiscal:'pending', taxRate:0.16, invoice:null },
  { id:'461832', order:2, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'ANGEL ANTONIO', terminal:'SERVER1', amount:1282.00, tip:0, total:1282.00, fiscal:'pending', taxRate:0.16, invoice:null },
  { id:'461833', order:3, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'JAZMIN DOMINGUEZ', terminal:'SERVER1', amount:2274.80, tip:0, total:2274.80, fiscal:'pending', taxRate:0.16, invoice:null },
  { id:'461834', order:4, date:'2026-06-10', method:'Efectivo', status:'Pagada', waiter:'ISMAEL CORTES', terminal:'SERVER1', amount:1610.40, tip:0, total:1610.40, fiscal:'pending', taxRate:0.16, invoice:null },
  { id:'461835', order:5, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'MOISES ROBLES', terminal:'SERVER1', amount:1271.00, tip:0, total:1271.00, fiscal:'pending', taxRate:0.16, invoice:null },
  { id:'461836', order:6, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'OBED PEREZ', terminal:'SERVER1', amount:1633.00, tip:0, total:1633.00, fiscal:'invoiced', taxRate:0.16, invoice:'A134' },
  { id:'461837', order:7, date:'2026-06-10', method:'Efectivo', status:'Pagada', waiter:'ANGEL ANTONIO', terminal:'SERVER1', amount:1533.40, tip:0, total:1533.40, fiscal:'pending', taxRate:0.16, invoice:null },
  { id:'461838', order:8, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'JAZMIN DOMINGUEZ', terminal:'SERVER1', amount:1345.30, tip:0, total:1345.30, fiscal:'invoiced', taxRate:0.16, invoice:'A135' },
  { id:'461839', order:9, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'ISMAEL CORTES', terminal:'SERVER1', amount:2024.00, tip:0, total:2024.00, fiscal:'pending', taxRate:0.16, invoice:null },
  { id:'4618310', order:10, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'MOISES ROBLES', terminal:'SERVER1', amount:1422.55, tip:0, total:1422.55, fiscal:'pending', taxRate:0.16, invoice:null },
  { id:'4618311', order:11, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'OBED PEREZ', terminal:'SERVER1', amount:1699.70, tip:0, total:1699.70, fiscal:'pending', taxRate:0, invoice:null },
  { id:'4618312', order:12, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'ANGEL ANTONIO', terminal:'SERVER1', amount:3034.90, tip:0, total:3034.90, fiscal:'pending', taxRate:0, invoice:null, table:9, generated:true },
  { id:'4618313', order:13, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'JAZMIN DOMINGUEZ', terminal:'SERVER1', amount:355.30, tip:0, total:355.30, fiscal:'pending', taxRate:0, invoice:null },
  { id:'4618314', order:14, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'ISMAEL CORTES', terminal:'SERVER1', amount:503.80, tip:0, total:503.80, fiscal:'pending', taxRate:0, invoice:null },
  { id:'4618315', order:15, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'MOISES ROBLES', terminal:'SERVER1', amount:1093.00, tip:0, total:1093.00, fiscal:'pending', taxRate:0, invoice:null },
  { id:'4618316', order:16, date:'2026-06-10', method:'Tarjeta de crédito', status:'Pagada', waiter:'OBED PEREZ', terminal:'SERVER1', amount:969.10, tip:0, total:969.10, fiscal:'pending', taxRate:0, invoice:null }
];

const PRODUCTS_BRIDGE = [
  { code:'PAR-001', name:'Parrillada Argentina', price:645.00, bridge:true, modifier:false },
  { code:'RIB-003', name:'Rib Eye 400g', price:985.00, bridge:true, modifier:false },
  { code:'LIM-014', name:'Limonada mineral', price:65.00, bridge:true, modifier:false },
  { code:'CER-021', name:'Cerveza artesanal', price:95.00, bridge:true, modifier:false },
  { code:'QUE-007', name:'Queso fundido', price:185.00, bridge:true, modifier:false },
  { code:'GUA-009', name:'Guacamole tradicional', price:110.00, bridge:true, modifier:false },
  { code:'FLA-002', name:'Flan napolitano', price:95.00, bridge:true, modifier:false }
];

const WAITERS = [
  { code:'03', name:'ANGEL ANTONIO' },
  { code:'124', name:'JAZMIN DOMINGUEZ' },
  { code:'46', name:'MOISES ROBLES' },
  { code:'07', name:'OBED PEREZ' },
  { code:'12', name:'ISMAEL CORTES' },
  { code:'09', name:'JORGE GORDILLO' }
];

const INVOICES = [
  { folio:'A133', rfc:'SACS810810APA', name:'JOSE SAUL SANCHEZ CHAVEZ', ref:'AE_63918457880806221', status:'Vigente', date:'30/06/2026', subtotal:1993.97, iva:319.03, ieps:0, total:2313.00 },
  { folio:'A132', rfc:'FRA960216DL0', name:'FLETERA RAMCA', ref:'AE_63918434040330562', status:'Vigente', date:'30/06/2026', subtotal:1700.86, iva:272.14, ieps:0, total:1973.00 },
  { folio:'A131', rfc:'CAQA7911302B5', name:'Alejandra Cardenas Quiñones', ref:'AE_63918427507709236', status:'Vigente', date:'30/06/2026', subtotal:1385.34, iva:221.66, ieps:0, total:1607.00 },
  { folio:'A121', rfc:'BIM011108DJ5', name:'BIMBO', ref:'AE_63917849002985495', status:'Cancelado', date:'23/06/2026', subtotal:282.76, iva:45.24, ieps:0, total:328.00 }
];

const UPLOAD_LOG = [
  { time:'30/06/2026 21:15', file:'Reporte_De_Ventas_20260630.xlsx', sheet:'Reporte de ventas', rows:3821, control:2644933.30, status:'ok' },
  { time:'30/06/2026 21:16', file:'Reporte_De_Ventas_20260630.xlsx', sheet:'Pagos', rows:3909, control:2644933.30, status:'ok' },
  { time:'30/06/2026 21:18', file:'comandas.xls', sheet:'Hoja1', rows:13141, control:0, status:'ok' }
];

// ---------- Estado ----------
let selectedPending = new Set(['461832','461833','461835','461839','4618310']);
let previewTicket = PAYMENTS.find(p => p.id === '4618312');
let currentDay = '2026-06-10';
let ticketsPage = 1;
const ticketsPerPage = 12;

// ---------- Inicialización ----------
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initTabs();
  initDashboard();
  initUploads();
  initTickets();
  initGenerator();
  initCatalogs();
  bindGlobalEvents();
});

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('tab-' + name).classList.add('active');
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      lucide.createIcons();
    });
  });
}

// ============================================================
// DASHBOARD
// ============================================================
function initDashboard() {
  renderDashAll();
  renderDashPending();
  renderDashInvoiced();
  recalcDashboard();

  document.getElementById('chkPendingAll').addEventListener('change', e => {
    const checked = e.target.checked;
    document.querySelectorAll('.chk-pending').forEach(c => {
      c.checked = checked;
      const id = c.dataset.id;
      checked ? selectedPending.add(id) : selectedPending.delete(id);
    });
    updatePendingSum();
  });

  document.getElementById('btnSendToInvoice').addEventListener('click', () => {
    if (!selectedPending.size) return;
    alert(`Se enviarían ${selectedPending.size} tickets al portal de facturación.`);
  });

  document.getElementById('btnRecalc').addEventListener('click', recalcDashboard);
}

function renderDashAll() {
  const tbody = document.getElementById('dashAllBody');
  let total = 0;
  tbody.innerHTML = PAYMENTS.map(p => {
    total += p.total;
    const badge = p.method === 'Efectivo' ? 'b-green' : 'b-terra';
    return `<tr><td class="font-mono text-[10px]">${p.id}</td><td>${p.order}</td><td><span class="badge-base ${badge}">${p.method}</span></td><td class="text-right font-semibold text-ink-900">${fmtMX(p.total)}</td></tr>`;
  }).join('');
  document.getElementById('dashAllTotal').textContent = fmtMX(total);
}

function renderDashPending() {
  const tbody = document.getElementById('dashPendingBody');
  const rows = PAYMENTS.filter(p => p.fiscal === 'pending' && p.method !== 'Efectivo');
  tbody.innerHTML = rows.map(p => {
    const checked = selectedPending.has(p.id) ? 'checked' : '';
    return `<tr>
      <td><input type="checkbox" class="chk-pending accent-brand-500" data-id="${p.id}" data-amount="${p.total}" ${checked}></td>
      <td class="font-mono text-[10px]">${p.id}</td>
      <td>${p.order}</td>
      <td class="text-right font-semibold text-ink-900">${fmtMX(p.total)}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.chk-pending').forEach(c => {
    c.addEventListener('change', () => {
      const id = c.dataset.id;
      c.checked ? selectedPending.add(id) : selectedPending.delete(id);
      syncPendingMaster();
      updatePendingSum();
    });
  });
  syncPendingMaster();
  updatePendingSum();
}

function syncPendingMaster() {
  const all = document.querySelectorAll('.chk-pending');
  const checked = document.querySelectorAll('.chk-pending:checked');
  const master = document.getElementById('chkPendingAll');
  if (!all.length) { master.checked = false; master.indeterminate = false; return; }
  master.checked = checked.length === all.length;
  master.indeterminate = checked.length > 0 && checked.length < all.length;
}

function updatePendingSum() {
  let sum = 0;
  document.querySelectorAll('.chk-pending:checked').forEach(c => sum += parseFloat(c.dataset.amount));
  document.getElementById('dashPendingSum').textContent = fmtMX(sum);
  const target = parseMX(document.getElementById('kpiTarget').textContent);
  const invoiced = parseMX(document.getElementById('kpiInvoiced').textContent);
  document.getElementById('dashRemaining').textContent = fmtMX(Math.max(0, target - invoiced - sum));
  const btn = document.getElementById('btnSendToInvoice');
  btn.disabled = sum <= 0;
}

function renderDashInvoiced() {
  const tbody = document.getElementById('dashInvoicedBody');
  const rows = PAYMENTS.filter(p => p.fiscal === 'invoiced');
  let total = 0;
  tbody.innerHTML = rows.map(p => {
    total += p.total;
    return `<tr class="row-locked"><td class="font-mono text-[10px]">${p.id}</td><td>${p.order}</td><td><span class="badge-base b-terra">${p.invoice}</span></td><td class="text-right font-semibold text-ink-900">${fmtMX(p.total)}</td></tr>`;
  }).join('');
  document.getElementById('dashInvoicedTotal').textContent = fmtMX(total);
}

function recalcDashboard() {
  const total = PAYMENTS.reduce((a, p) => a + p.total, 0);
  const invoiced = PAYMENTS.filter(p => p.fiscal === 'invoiced').reduce((a, p) => a + p.total, 0);
  const target = total * 0.70;
  const pending = Math.max(0, target - invoiced);
  const progress = target > 0 ? (invoiced / target) * 100 : 0;

  document.getElementById('kpiTotal').textContent = fmtMX(total);
  document.getElementById('kpiTarget').textContent = fmtMX(target);
  document.getElementById('kpiInvoiced').textContent = fmtMX(invoiced);
  document.getElementById('kpiPending').textContent = fmtMX(pending);
  document.getElementById('kpiProgress').textContent = progress.toFixed(1) + '%';
  document.getElementById('kpiProgressBar').style.width = Math.min(progress, 100) + '%';
  document.getElementById('progressInvoiced').textContent = fmtMX(invoiced) + ' facturado';
  document.getElementById('progressTarget').textContent = 'objetivo ' + fmtMX(target);
  updatePendingSum();
}

// ============================================================
// UPLOADS
// ============================================================
function initUploads() {
  renderUploadLog();

  // sub-tabs de cargas
  document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.subtab;
      document.querySelectorAll('.subtab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('subtab-' + name).classList.add('active');
      document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      lucide.createIcons();
    });
  });

  document.querySelectorAll('.upload-zone').forEach(zone => {
    zone.addEventListener('click', () => {
      const type = zone.dataset.type;
      const names = {
        'sales-report':'Reporte de ventas (XLSX)',
        'commands-sheet':'Archivo de comandas'
      };
      alert(`Simulación: se abriría el selector de archivos para “${names[type]}”`);
      toggleUploadStatus(zone, 'ok');
    });
  });
  document.getElementById('btnClearLog').addEventListener('click', () => {
    document.getElementById('uploadLogBody').innerHTML = '<tr><td colspan="7" class="text-center text-ink-400 py-4">Sin registros</td></tr>';
  });
}

function toggleUploadStatus(zone, status) {
  const badge = zone.querySelector('.status-badge');
  if (status === 'ok') {
    badge.className = 'badge-base b-green status-badge';
    badge.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i>Cargado';
    zone.classList.remove('pending');
  }
  lucide.createIcons();
}

function renderUploadLog() {
  const tbody = document.getElementById('uploadLogBody');
  tbody.innerHTML = UPLOAD_LOG.map(l => {
    const badge = l.status === 'ok' ? '<span class="badge-base b-green"><i data-lucide="check" class="w-3 h-3"></i>OK</span>' : '<span class="badge-base b-red"><i data-lucide="alert-circle" class="w-3 h-3"></i>Error</span>';
    return `<tr>
      <td>${l.time}</td>
      <td class="font-semibold text-ink-800">${l.file}</td>
      <td>${l.sheet}</td>
      <td>${fmtInt(l.rows)}</td>
      <td class="font-semibold text-ink-800">${fmtMX(l.control)}</td>
      <td>${badge}</td>
      <td><button class="btn-ghost !py-1 !px-2 text-[11px]"><i data-lucide="download" class="w-3.5 h-3.5"></i>Descargar</button></td>
    </tr>`;
  }).join('');
}

// ============================================================
// TICKETS
// ============================================================
function initTickets() {
  renderTickets();
  document.getElementById('ticketSearch').addEventListener('input', () => { ticketsPage = 1; renderTickets(); });
  document.getElementById('ticketFilterPay').addEventListener('change', () => { ticketsPage = 1; renderTickets(); });
  document.getElementById('ticketFilterStatus').addEventListener('change', () => { ticketsPage = 1; renderTickets(); });
}

function getFilteredTickets() {
  const q = document.getElementById('ticketSearch').value.toLowerCase();
  const pay = document.getElementById('ticketFilterPay').value;
  const status = document.getElementById('ticketFilterStatus').value;
  return PAYMENTS.filter(p => {
    if (q && !p.id.toLowerCase().includes(q) && !String(p.order).includes(q) && !p.method.toLowerCase().includes(q)) return false;
    if (pay && p.method !== pay) return false;
    if (status === 'pending' && p.fiscal !== 'pending') return false;
    if (status === 'invoiced' && p.fiscal !== 'invoiced') return false;
    if (status === 'zero' && p.taxRate !== 0) return false;
    return true;
  });
}

function renderTickets() {
  const rows = getFilteredTickets();
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / ticketsPerPage));
  if (ticketsPage > pages) ticketsPage = pages;
  const start = (ticketsPage - 1) * ticketsPerPage;
  const pageRows = rows.slice(start, start + ticketsPerPage);

  const tbody = document.getElementById('ticketsBody');
  tbody.innerHTML = pageRows.map(p => {
    const sub = p.total / (1 + p.taxRate);
    const iva = p.total - sub;
    const methodBadge = p.method === 'Efectivo' ? 'b-green' : 'b-terra';
    let statusBadge = '';
    if (p.fiscal === 'invoiced') statusBadge = '<span class="badge-base b-green"><i data-lucide="lock" class="w-3 h-3"></i>Facturado</span>';
    else if (p.taxRate === 0) statusBadge = '<span class="badge-base b-yellow">IVA 0%</span>';
    else statusBadge = '<span class="badge-base b-gray">Pendiente</span>';
    const taxBadge = p.taxRate === 0 ? '<span class="badge-base b-yellow">0%</span>' : '<span class="badge-base b-terra">16%</span>';
    return `<tr>
      <td class="font-mono text-[10px]">${p.id}</td>
      <td>${p.order}</td>
      <td>${p.date.split('-').reverse().join('/')}</td>
      <td><span class="badge-base ${methodBadge}">${p.method}</span></td>
      <td>PUE</td>
      <td>${statusBadge}</td>
      <td>${taxBadge}</td>
      <td class="text-right">${fmtMX(sub)}</td>
      <td class="text-right">${fmtMX(iva)}</td>
      <td class="text-right">$0.00</td>
      <td class="text-right font-semibold text-ink-900">${fmtMX(p.total)}</td>
      <td>${p.invoice ? `<span class="badge-base b-terra">${p.invoice}</span>` : '<span class="cell-null">—</span>'}</td>
      <td><button class="btn-ghost !py-1 !px-2 text-[11px]" onclick="viewTicket('${p.id}')"><i data-lucide="eye" class="w-3.5 h-3.5"></i>Ver</button></td>
    </tr>`;
  }).join('');

  document.getElementById('ticketsCount').textContent = `Mostrando ${pageRows.length} de ${total}`;
  renderPagination(pages, 'ticketsPagination', n => { ticketsPage = n; renderTickets(); });
  lucide.createIcons();
}

function renderPagination(pages, containerId, handler) {
  const c = document.getElementById(containerId);
  if (pages <= 1) { c.innerHTML = ''; return; }
  let html = `<button class="btn-ghost !px-2.5 !py-1.5" ${pages <= 1 ? 'disabled' : ''}><i data-lucide="chevron-left" class="w-4 h-4"></i></button>`;
  for (let i = 1; i <= pages; i++) {
    const active = i === ticketsPage ? 'bg-ink-100 border-ink-300' : '';
    html += `<button class="btn-ghost !px-2.5 !py-1.5 ${active}" data-page="${i}">${i}</button>`;
  }
  html += `<button class="btn-ghost !px-2.5 !py-1.5"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>`;
  c.innerHTML = html;
  c.querySelectorAll('button[data-page]').forEach(b => b.addEventListener('click', () => handler(parseInt(b.dataset.page))));
}

window.viewTicket = function(id) {
  const p = PAYMENTS.find(x => x.id === id);
  if (!p) return;
  previewTicket = p;
  activateTab('generator');
  renderPreview();
};

function activateTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${name}"]`).classList.add('active');
  lucide.createIcons();
}

// ============================================================
// GENERADOR
// ============================================================
function initGenerator() {
  renderGeneratorList();
  renderPreview();

  document.getElementById('genDate').addEventListener('change', e => {
    currentDay = e.target.value;
    document.getElementById('genDateLabel').textContent = currentDay.split('-').reverse().join('/');
    renderGeneratorList();
  });

  document.getElementById('btnGenAll').addEventListener('click', () => {
    const zeros = PAYMENTS.filter(p => p.date === currentDay && p.method !== 'Efectivo' && p.taxRate === 0 && p.fiscal !== 'invoiced');
    zeros.forEach(p => { if (!p.generated) p.generated = true; });
    renderGeneratorList();
    alert(`Se generaron ${zeros.length} tickets virtuales para el día ${currentDay.split('-').reverse().join('/')}.`);
  });

  document.getElementById('btnRegenerate').addEventListener('click', () => {
    if (!previewTicket) return;
    previewTicket.generated = true;
    renderPreview();
  });

  document.getElementById('btnPrint').addEventListener('click', () => window.print());
}

function renderGeneratorList() {
  const rows = PAYMENTS.filter(p => p.date === currentDay && p.method !== 'Efectivo');
  const locked = rows.filter(p => p.fiscal === 'invoiced');
  const zeros = rows.filter(p => p.taxRate === 0 && p.fiscal !== 'invoiced');
  document.getElementById('genLockedCount').textContent = locked.length;
  document.getElementById('genZeroCount').textContent = zeros.length;

  const tbody = document.getElementById('generatorBody');
  tbody.innerHTML = rows.map((p, idx) => {
    const note = p.generated ? `#${p.order}` : `#${p.order}`;
    const taxBadge = p.taxRate === 0 ? '<span class="badge-base b-yellow">0%</span>' : '<span class="badge-base b-terra">16%</span>';
    let stateBadge = '';
    let action = '';
    if (p.fiscal === 'invoiced') {
      stateBadge = `<span class="badge-base b-green"><i data-lucide="lock" class="w-3 h-3"></i>Facturado ${p.invoice}</span>`;
      action = `<button class="btn-ghost !px-2.5 !py-1" disabled>Bloqueado</button>`;
    } else if (p.taxRate === 0) {
      stateBadge = '<span class="badge-base b-yellow">Requiere ticket virtual</span>';
      const active = p.generated ? 'btn-primary' : 'btn-ghost';
      const label = p.generated ? 'Regenerar' : 'Generar';
      action = `<button class="${active} !px-2.5 !py-1" onclick="previewGenerate('${p.id}')"><i data-lucide="wand-2" class="w-3.5 h-3.5"></i>${label}</button>`;
    } else {
      stateBadge = '<span class="badge-base b-gray">Pendiente de facturar</span>';
      action = `<button class="btn-ghost !px-2.5 !py-1" onclick="previewGenerate('${p.id}')"><i data-lucide="eye" class="w-3.5 h-3.5"></i>Ver</button>`;
    }
    const rowClass = p.fiscal === 'invoiced' ? 'row-locked' : (p.taxRate === 0 ? 'bg-brand-50' : '');
    return `<tr class="${rowClass}">
      <td class="font-bold text-ink-800">${note}</td>
      <td class="font-mono text-[10px]">${p.id}</td>
      <td>${taxBadge}</td>
      <td>${stateBadge}</td>
      <td class="text-right font-semibold text-ink-900">${fmtMX(p.total)}</td>
      <td class="text-right">${action}</td>
    </tr>`;
  }).join('');
  lucide.createIcons();
}

window.previewGenerate = function(id) {
  const p = PAYMENTS.find(x => x.id === id);
  if (!p) return;
  previewTicket = p;
  previewTicket.generated = true;
  renderPreview();
};

function renderPreview() {
  if (!previewTicket) return;
  const p = previewTicket;
  const prepared = prepareVirtualTicket(p);

  document.getElementById('previewNoteNum').textContent = p.order;
  document.getElementById('previewTaxBadge').textContent = p.taxRate === 0 ? 'IVA 0%' : 'IVA 16%';
  document.getElementById('previewTaxBadge').className = p.taxRate === 0 ? 'badge-base b-yellow' : 'badge-base b-terra';

  document.getElementById('printNoteNum').textContent = '#' + p.order;
  document.getElementById('printDate').textContent = p.date.split('-').reverse().join('/') + ' 19:47';
  document.getElementById('printTable').textContent = p.table || Math.floor(Math.random() * 20) + 1;
  document.getElementById('printWaiter').textContent = p.waiter;
  document.getElementById('printTerminal').textContent = p.terminal;
  document.getElementById('printPayment').textContent = 'PAGO: ' + p.method.toUpperCase();

  const linesBody = document.getElementById('printLines');
  linesBody.innerHTML = prepared.lines.map(l => `<tr><td>${l.qty}&nbsp;&nbsp;${l.name}</td><td style="text-align:right">${fmtMX(l.amount)}</td></tr>`).join('');

  document.getElementById('printSubtotal').textContent = fmtMX(prepared.subtotal);
  document.getElementById('printDiscount').textContent = '-' + fmtMX(prepared.discount);
  document.getElementById('printTotal').textContent = fmtMX(p.total);

  document.getElementById('printExplanation').textContent =
    `Productos puente: ${prepared.lines.length} artículos suman ${fmtMX(prepared.subtotal)} → descuento de ${fmtMX(prepared.discount)} para cuadrar los ${fmtMX(p.total)} del ticket.`;
}

function prepareVirtualTicket(p) {
  let remaining = p.total;
  const lines = [];
  const pool = [...PRODUCTS_BRIDGE].sort(() => Math.random() - 0.5);
  for (const prod of pool) {
    if (remaining <= 0) break;
    const maxQty = Math.floor(remaining / prod.price);
    if (maxQty <= 0) continue;
    const qty = Math.min(maxQty, 3) || 1;
    const amount = qty * prod.price;
    lines.push({ qty, name: prod.name, amount });
    remaining -= amount;
  }
  // Si sobra un residuo, lo metemos como descuento (negativo) o ajuste
  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const discount = subtotal - p.total;
  return { lines, subtotal, discount };
}

// ============================================================
// CATALOGOS
// ============================================================
function initCatalogs() {
  const prodBody = document.getElementById('catalogProductsBody');
  prodBody.innerHTML = PRODUCTS_BRIDGE.map(p => `<tr>
    <td class="font-mono text-[10px]">${p.code}</td>
    <td class="font-semibold text-ink-800">${p.name}</td>
    <td class="text-right">${fmtMX(p.price)}</td>
    <td><span class="badge-base ${p.bridge ? 'b-green' : 'b-gray'}">${p.bridge ? 'Sí' : 'No'}</span></td>
    <td><span class="badge-base ${p.modifier ? 'b-yellow' : 'b-gray'}">${p.modifier ? 'Sí' : 'No'}</span></td>
    <td><button class="btn-ghost !py-1 !px-2 text-[11px]"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar</button></td>
  </tr>`).join('');

  const waiterBody = document.getElementById('catalogWaitersBody');
  waiterBody.innerHTML = WAITERS.map(w => `<tr>
    <td class="font-mono text-[10px]">${w.code}</td>
    <td class="font-semibold text-ink-800">${w.name}</td>
    <td><button class="btn-ghost !py-1 !px-2 text-[11px]"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar</button></td>
  </tr>`).join('');
}

// ============================================================
// GLOBAL
// ============================================================
function bindGlobalEvents() {
  document.getElementById('periodDay').addEventListener('change', e => {
    const d = e.target.value;
    const [y, m, day] = d.split('-');
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    document.getElementById('dashDateLabel').textContent = `${parseInt(day)} de ${meses[parseInt(m) - 1]} de ${y}`;
    document.getElementById('periodMonth').value = `${y}-${m}`;
  });

  document.getElementById('periodMonth').addEventListener('change', e => {
    const [y, m] = e.target.value.split('-');
    const current = document.getElementById('periodDay').value;
    const day = current ? current.split('-')[2] : '10';
    document.getElementById('periodDay').value = `${y}-${m}-${day}`;
    document.getElementById('periodDay').dispatchEvent(new Event('change'));
  });
}
