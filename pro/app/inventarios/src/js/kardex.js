// -- Kárdex --
// Cada vez que cambió la existencia (entradas, salidas, traspasos, ajustes y
// cancelaciones), del más nuevo al más viejo, con lo que había y lo que quedó.
// Solo lectura. Ayudantes (notify, esc, InvPage) en inventarios.js.

let kardex;

$(() => {
    kardex = new Kardex('ctrl/ctrl-kardex.php', 'root');
    kardex.init();
});

class Kardex extends InvPage {

    constructor(link, div_modulo) {
        super(link, div_modulo, {
            name: 'Kardex',
            title: 'Kárdex',
            help: 'Cada movimiento de la existencia, con lo que había y lo que quedó',
            tabKey: 'inventarios:kardex:tab:v1'
        });
    }

    tabsList() {
        return [
            { id: 'moves', tab: 'Movimientos', icon: 'history', render: () => this.renderMoves(), reopen: () => this.ls() }
        ];
    }

    renderMoves() {
        $('#container-moves').html(`
            <div id="filterBarMoves" class="mb-[8px]"></div>
            <div id="summaryMoves" class="inv-resumen"></div>
            <div id="containerMoves"></div>
        `);

        this.createfilterBar({
            parent: 'filterBarMoves',
            id: 'fbMoves',
            prefijo: 'kdx_',
            coffeesoft: true,
            data: [
                { opc: 'input-calendar', id: 'calendar', lbl: 'Periodo', required: false, readonly: true, class: 'col-12 col-lg-3' },
                ...this.warehouseFilter('kardex.ls()'),
                {
                    opc: 'select', id: 'type', lbl: 'Tipo', required: false, class: 'col-12 col-lg-2',
                    data: [{ id: '', valor: 'Todos' }, ...(this.data.types || [])], onchange: 'kardex.ls()'
                },
                {
                    opc: 'select', id: 'product_id', lbl: 'Producto', required: false, select2: true, class: 'col-12 col-lg-3',
                    data: [{ id: '', valor: 'Todos los productos' }, ...(this.data.products || [])], onchange: 'kardex.ls()'
                }
            ]
        });

        this.periodPicker('kdx_calendar', () => this.ls());
        this.ls();
    }

    // Columnas: Fecha, Tipo, Folio, Producto [, Almacén], Cantidad, Antes, Quedó [, Costo, Importe], Usuario
    ls() {
        const shift = (this.data.warehouses || []).length > 1 ? 1 : 0;
        const right = [5, 6, 7, ...(this.costs ? [8, 9] : [])].map((n) => n + shift);

        this.table({
            parent: 'containerMoves',
            filterBar: 'filterBarMoves',
            id: 'tbMoves',
            data: { opc: 'lsMoves', ...this.periodData('kdx_calendar') },
            right,
            center: [2],
            pag: 25,
            success: (data) => {
                if (!data || data.status != 200) return notify(data);

                const s    = data.summary || {};
                const unit = s.unit ? ` ${esc(s.unit)}` : '';

                this.paintSummary('summaryMoves', [
                    { html: `<b>${s.moves || 0}</b> ${s.moves === 1 ? 'movimiento' : 'movimientos'}` },
                    s.more ? { html: 'Se ven los más recientes: acorta el periodo', tone: 'amber' } : null,
                    s.units_in !== undefined ? { html: `Entró <b>${qtyText(s.units_in)}${unit}</b>` } : { html: `<b>${s.in || 0}</b> suman` },
                    s.units_out !== undefined ? { html: `Salió <b>${qtyText(s.units_out)}${unit}</b>` } : { html: `<b>${s.out || 0}</b> restan` },
                    s.value_in !== undefined ? { html: `Valor que entró <b>${money(s.value_in)}</b>` } : null,
                    s.value_out !== undefined ? { html: `Valor que salió <b>${money(s.value_out)}</b>` } : null
                ]);
            }
        });
    }
}
