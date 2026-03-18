let apiCocina = 'ctrl/ctrl-cocina.php';
let kds;
let kdsSubName = '';
let kdsRefreshInterval = null;

$(async () => {
    const req = await useFetch({ url: apiCocina, data: { opc: "init" } });
    kdsSubName = req.sub_name || '';

    kds = new KDS(apiCocina, 'root');
    kds.render();

    kdsRefreshInterval = setInterval(() => {
        kds.refreshOrders();
    }, 15000);
});

class KDS extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "KDS";
        this.orders = [];
        this.filter = 'all';
    }

    render() {
        this.layoutKDS();
        this.refreshOrders();
    }

    layoutKDS() {
        $('#root').html(`
            <div class="flex flex-col h-screen bg-[#111827] overflow-hidden">
                <div class="flex items-center justify-between px-4 py-3 bg-[#1F2A37] border-b border-gray-700">
                    <div class="flex items-center gap-3">
                        <button class="text-gray-300 hover:text-white text-sm" onclick="window.location.href='../pedidos/index.php'">
                            <i class="icon-arrow-left"></i>
                        </button>
                        <h1 class="text-white text-lg font-bold"><i class="icon-food"></i> Panel de Cocina (KDS)</h1>
                        <span class="text-gray-400 text-sm">${kdsSubName}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div id="kdsTime" class="text-gray-400 text-sm"></div>
                        <div class="flex gap-1">
                            <button class="kds-filter-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600 text-white" data-filter="all" onclick="kds.setFilter('all')">Todos</button>
                            <button class="kds-filter-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-[#283341] text-gray-300 hover:bg-gray-700" data-filter="pendiente" onclick="kds.setFilter('pendiente')">Pendientes</button>
                            <button class="kds-filter-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-[#283341] text-gray-300 hover:bg-gray-700" data-filter="preparando" onclick="kds.setFilter('preparando')">En Preparacion</button>
                            <button class="kds-filter-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-[#283341] text-gray-300 hover:bg-gray-700" data-filter="listo" onclick="kds.setFilter('listo')">Listos</button>
                        </div>
                        <button class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm" onclick="kds.refreshOrders()">
                            <i class="icon-arrows-cw"></i>
                        </button>
                    </div>
                </div>
                <div id="kdsCounts" class="flex gap-3 px-4 py-2 bg-[#1a2332]"></div>
                <div id="kdsGrid" class="flex-1 overflow-y-auto p-4"></div>
            </div>
        `);

        this.updateClock();
        setInterval(() => this.updateClock(), 60000);
    }

    updateClock() {
        const now = moment().format('DD/MM/YYYY HH:mm');
        $('#kdsTime').text(now);
    }

    setFilter(f) {
        this.filter = f;
        $('.kds-filter-btn').removeClass('bg-blue-600 text-white').addClass('bg-[#283341] text-gray-300');
        $(`.kds-filter-btn[data-filter="${f}"]`).removeClass('bg-[#283341] text-gray-300').addClass('bg-blue-600 text-white');
        this.renderOrders();
    }

    async refreshOrders() {
        const data = await useFetch({
            url: this._link,
            data: { opc: 'lsOrders' }
        });
        this.orders = data.orders || [];
        this.renderCounts();
        this.renderOrders();
    }

    renderCounts() {
        let pending = 0, preparing = 0, ready = 0, delivered = 0;

        this.orders.forEach(o => {
            if (o.kds_general_status === 'pendiente') pending++;
            else if (o.kds_general_status === 'preparando') preparing++;
            else if (o.kds_general_status === 'listo') ready++;
            else if (o.kds_general_status === 'entregado') delivered++;
        });

        $('#kdsCounts').html(`
            <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-400">Pendientes:</span>
                <span class="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">${pending}</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-400">En preparacion:</span>
                <span class="bg-yellow-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">${preparing}</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-400">Listos:</span>
                <span class="bg-green-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">${ready}</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
                <span class="text-gray-400">Total ordenes:</span>
                <span class="text-white font-bold">${this.orders.length}</span>
            </div>
        `);
    }

    renderOrders() {
        let filtered = this.orders;

        if (this.filter !== 'all') {
            filtered = this.orders.filter(o => o.kds_general_status === this.filter);
        }

        filtered = filtered.filter(o => o.kds_general_status !== 'entregado');

        if (filtered.length === 0) {
            $('#kdsGrid').html(`
                <div class="flex items-center justify-center h-full">
                    <div class="text-center">
                        <i class="icon-ok-circled text-6xl text-green-400 mb-4"></i>
                        <p class="text-gray-400 text-lg">No hay ordenes pendientes</p>
                    </div>
                </div>
            `);
            return;
        }

        let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">';

        filtered.forEach(order => {
            const statusConfig = this.getStatusConfig(order.kds_general_status);
            const elapsed = moment(order.date_creation).fromNow();
            const minutesAgo = moment().diff(moment(order.date_creation), 'minutes');
            const urgentClass = minutesAgo > 20 ? 'border-red-500 animate-pulse' : '';

            let itemsHtml = '';
            if (Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const itemStatus = this.getStatusConfig(item.kds_status);
                    itemsHtml += `
                        <div class="flex items-center justify-between py-1.5 border-b border-gray-700 last:border-0">
                            <div class="flex items-center gap-2">
                                <span class="text-white font-bold text-sm">${item.quantity}x</span>
                                <span class="text-gray-300 text-sm">${item.product_name}</span>
                            </div>
                            <button class="px-2 py-0.5 rounded text-xs font-semibold ${itemStatus.btnClass}"
                                onclick="kds.nextItemStatus(${item.package_id}, ${order.id}, '${item.kds_status}')">
                                ${itemStatus.label}
                            </button>
                        </div>
                    `;
                });
            }

            html += `
                <div class="bg-[#1F2A37] rounded-xl border-2 ${statusConfig.borderClass} ${urgentClass} overflow-hidden">
                    <div class="px-4 py-2 ${statusConfig.headerBg} flex items-center justify-between">
                        <div>
                            <span class="text-white font-bold text-lg">#${order.id}</span>
                            ${order.table_name ? `<span class="text-gray-300 text-xs ml-2">${order.table_name}</span>` : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-gray-300 text-xs">${elapsed}</span>
                            <span class="px-2 py-0.5 rounded text-xs font-semibold ${statusConfig.badgeClass}">${statusConfig.label}</span>
                        </div>
                    </div>
                    <div class="px-4 py-1 bg-[#283341] text-xs text-gray-400 flex justify-between">
                        <span>${order.client_name || 'Mostrador'}</span>
                        <span>${moment(order.date_creation).format('HH:mm')}</span>
                    </div>
                    <div class="px-4 py-2">
                        ${itemsHtml}
                    </div>
                    ${order.note ? `<div class="px-4 py-2 bg-[#283341] text-xs text-yellow-300"><i class="icon-attention"></i> ${order.note}</div>` : ''}
                    <div class="px-4 py-2 flex gap-2">
                        ${this.getOrderActions(order)}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        $('#kdsGrid').html(html);
    }

    getStatusConfig(status) {
        const configs = {
            'pendiente': {
                label: 'Pendiente', borderClass: 'border-red-500', headerBg: 'bg-red-900/30',
                badgeClass: 'bg-red-600 text-white', btnClass: 'bg-red-600/50 text-red-300 hover:bg-red-600'
            },
            'preparando': {
                label: 'Preparando', borderClass: 'border-yellow-500', headerBg: 'bg-yellow-900/30',
                badgeClass: 'bg-yellow-600 text-white', btnClass: 'bg-yellow-600/50 text-yellow-300 hover:bg-yellow-600'
            },
            'listo': {
                label: 'Listo', borderClass: 'border-green-500', headerBg: 'bg-green-900/30',
                badgeClass: 'bg-green-600 text-white', btnClass: 'bg-green-600/50 text-green-300 hover:bg-green-600'
            },
            'entregado': {
                label: 'Entregado', borderClass: 'border-blue-500', headerBg: 'bg-blue-900/30',
                badgeClass: 'bg-blue-600 text-white', btnClass: 'bg-blue-600/50 text-blue-300 hover:bg-blue-600'
            }
        };
        return configs[status] || configs['pendiente'];
    }

    getOrderActions(order) {
        const s = order.kds_general_status;
        let html = '';

        if (s === 'pendiente') {
            html += `<button class="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-1.5 rounded-lg text-xs font-semibold" onclick="kds.setAllStatus(${order.id}, 'preparando')"><i class="icon-play"></i> Preparar Todo</button>`;
        }
        if (s === 'preparando') {
            html += `<button class="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg text-xs font-semibold" onclick="kds.setAllStatus(${order.id}, 'listo')"><i class="icon-ok"></i> Todo Listo</button>`;
        }
        if (s === 'listo') {
            html += `<button class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg text-xs font-semibold" onclick="kds.setAllStatus(${order.id}, 'entregado')"><i class="icon-ok-circled"></i> Entregado</button>`;
        }

        return html;
    }

    async nextItemStatus(packageId, orderId, currentStatus) {
        const nextMap = {
            'pendiente': 'preparando',
            'preparando': 'listo',
            'listo': 'entregado',
        };

        const next = nextMap[currentStatus];
        if (!next) return;

        await useFetch({
            url: this._link,
            data: { opc: 'statusKdsItem', package_id: packageId, order_id: orderId, status: next }
        });

        this.refreshOrders();
    }

    async setAllStatus(orderId, newStatus) {
        await useFetch({
            url: this._link,
            data: { opc: 'statusAllItems', order_id: orderId, status: newStatus }
        });

        this.refreshOrders();
    }
}
