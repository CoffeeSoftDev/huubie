// -- OrderForm --

class OrderForm extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'OrderForm';
        this.opts         = null;
        this.order        = null;
        this.lines        = [];
        this.token        = '';
        this.saving       = false;
        this.loading      = false;
        this.initial      = '';
        this.cake         = null;
        this.cakeBox      = null;
        this.ticketBox    = null;
        this.looks        = {};
        this.flash        = -1;
        this.scrollTop    = 0;
        this.optionIndex  = {};
        this.s2Open       = false;

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.s2Open = !!document.querySelector('.select2-container--open');
        }, true);

        window.addEventListener('beforeunload', (e) => {
            if (!document.getElementById('posOrderHost') || this.snapshot() === this.initial) return;

            e.preventDefault();
            e.returnValue = '';
        });
    }

    async add() {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        if (!(await this.loadOptions(0, true))) return;

        this.order = null;
        this.lines = [];
        this.open();
    }

    async edit(id) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        const data = await orderDetail.fetchOrder(id);
        if (!data) return;

        if (!data.can || !data.can.edit) {
            alert({ icon: 'info', title: 'No se puede editar', text: (data.can && data.can.edit_reason) || '', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        // Pedido de un corte cerrado: la cajera edita, pero el ctrl rechaza si el total se mueve.
        if (data.can.money === false) {
            const go = await alert({
                icon:     'info',
                title:    'Este pedido ya está en un corte',
                text:     `${data.can.money_reason} Puedes cambiar lo que no mueva el total: fecha, hora y notas.`,
                btn1:     true,
                btn1Text: 'Editar',
                btn2:     true,
                btn2Text: 'Ahora no'
            });

            if (!go || !go.isConfirmed) return;
        }

        if (!(await this.loadOptions(data.order.customer_id))) return;

        this.order = data.order;
        this.lines = (data.lines || []).map((line) => this.fromSaved(line));
        this.open();
    }

    async loadOptions(customerId, isNew) {
        if (this.loading) return false;

        this.loading = true;

        const data = await useFetch({ url: this._link, data: { opc: 'formOptions', customer_id: customerId || 0, is_new: isNew ? 1 : 0 } });

        this.loading = false;

        if (!data || data.status != 200) {
            this.warnFail(data, 'No se pudo abrir la captura', isNew ? () => this.add() : null);
            return false;
        }

        this.opts = data;
        this.indexOptions();

        return true;
    }

    indexOptions() {
        this.optionIndex = {};

        (this.opts.groups || []).forEach((g) => {
            (g.options || []).forEach((o) => {
                this.optionIndex[o.id] = { id: Number(o.id), name: o.name, price: Number(o.price), group_id: Number(g.id), group_name: g.name, multiple: Boolean(g.multiple) };
            });
        });
    }

    fromSaved(line) {
        const base = {
            id:         Number(line.id),
            name:       line.name,
            price:      Number(line.price),
            quantity:   Number(line.quantity) || 1,
            details:    line.details || '',
            dedication: line.dedication || ''
        };

        if (Number(line.is_custom) === 1) {
            const modifiers = (line.modifiers || []).map((m) => ({
                id:         Number(m.modifier_id),
                name:       m.name,
                price:      Number(m.price),
                quantity:   Number(m.quantity) || 1,
                group_id:   Number(m.modifier_group_id),
                group_name: m.group_name,
                multiple:   Boolean(Number(m.multiple))
            }));

            const cake = {
                ...base,
                type:       'custom',
                product_id: Number(line.product_id) || 0,
                portions:   Number(line.portion_qty) || 1,
                modifiers:  modifiers,
                saved:      modifiers.map((m) => ({ ...m })),
                images:     (line.images || []).map((img) => ({ id: Number(img.id), path: img.path, name: img.name }))
            };

            cake.priceInput = this.round2(this.suggested(cake)) === this.round2(base.price) ? '' : String(base.price);

            return cake;
        }

        if (!line.product_id) return { ...base, type: 'free' };

        return { ...base, type: 'product', product_id: Number(line.product_id) };
    }

    // -- Interface --

    open() {
        this.token     = this.newToken();
        this.saving    = false;
        this.cake      = null;
        this.flash     = -1;
        this.scrollTop = $('#main__content').scrollTop();

        $('#posOrderHost').remove();
        $('#pageOrders').addClass('hidden');
        $('#root').append($('<div>', { id: 'posOrderHost', class: 'flex-1 min-h-0 flex flex-col' }));

        this.layout();
        this.backButton();
        this.catalog();
        this.ticket();
        this.ticketForm();
        this.renderLines();

        $(document).off('keydown.orderForm').on('keydown.orderForm', (e) => this.onEscape(e));

        $('#main__content').scrollTop(0);

        this.initial = this.snapshot();
    }

    close() {
        $(document).off('keydown.orderForm');
        $('body').removeClass('pos-tk-open');
        $('#posOrderHost').remove();
        $('#pageOrders').removeClass('hidden');
        $('#main__content').scrollTop(this.scrollTop);

        this.cake      = null;
        this.cakeBox   = null;
        this.ticketBox = null;
    }

    layout() {
        this.createLayout({
            parent: 'posOrderHost',
            design: false,
            data: {
                id:    'posOrder',
                class: 'flex-1 min-h-0 flex flex-col gap-[12px]',
                container: [
                    {
                        type:  'div',
                        id:    'posOrderHead',
                        class: 'shrink-0 flex flex-wrap items-center justify-between gap-[12px]',
                        children: [
                            { id: 'posOrderBack', class: 'shrink-0' }
                        ]
                    },
                    {
                        type:  'div',
                        id:    'posOrderBody',
                        class: 'flex-1 min-h-0 flex gap-[12px]',
                        children: [
                            { id: 'posOrderCatalog', class: 'flex-1 min-w-0 min-h-0 flex flex-col' },
                            { id: 'posOrderTicket', class: 'md:w-[320px] lg:w-[360px] xl:w-[390px] shrink-0 min-h-0 flex flex-col' }
                        ]
                    }
                ]
            }
        });

        this.createLayout({
            parent: 'posOrderCatalog',
            design: false,
            data: {
                id:    'posOrderCatalogBox',
                class: 'flex-1 min-h-0 flex flex-col gap-[10px]',
                container: [
                    { type: 'div', id: 'posOrderCatalogMain', class: 'flex-1 min-h-0 flex flex-col' },
                    { type: 'div', id: 'posOrderLauncher', class: 'shrink-0 md:hidden' }
                ]
            }
        });
    }

    backButton() {
        this.coffeeForm({
            parent:       'posOrderBack',
            id:           'formOrderBack',
            class:        'flex',
            showRequired: false,
            json: [
                { opc: 'button', id: 'btnOrderBack', class: 'col-12', text: 'Volver a pedidos', icon: 'icon-left-open', color_btn: 'outline', onClick: () => this.askClose() }
            ]
        });
    }

    catalog() {
        const tones = ['#C05A40', '#D97706', '#7C3AED', '#0284C7', '#059669', '#DB2777', '#4F46E5', '#0D9488', '#EA580C', '#65A30D'];

        this.looks = {};

        const categories = (this.opts.categories || []).map((c, i) => {
            const name = this.categoryName(c.name);
            const look = { icon: this.categoryIcon(name), tone: tones[i % tones.length] };

            this.looks[c.id] = look;

            return { id: c.id, name: name, total: c.total, icon: look.icon, tone: look.tone };
        });

        const json = (this.opts.products || []).map((p) => {
            const look  = this.looks[p.category_id] || { icon: 'package', tone: '#6B7280' };
            const image = String(p.image || '').trim();

            return {
                id:            p.id,
                name:          String(p.name || '').trim(),
                price:         money(p.price),
                category_id:   p.category_id,
                image:         image ? fileUrl(image) : '',
                imageFallback: image && !/^https?:/i.test(image) ? ORDER_FILES_REMOTE + encodeURI(image.replace(/^\/+/, '')) : '',
                sku:           p.sku || '',
                barcode:       p.barcode || '',
                icon:          look.icon,
                tone:          look.tone
            };
        });

        this.posCatalog({
            parent:     'posOrderCatalogMain',
            id:         'posOrderCatalogList',
            json:       json,
            categories: categories,
            actions: [
                { id: 'btnOrderCake', text: 'Pastel personalizado', icon: 'cake-slice', onClick: () => this.cakeForm() },
                { id: 'btnOrderFree', text: 'Línea libre', icon: 'pencil-line', onClick: () => this.free() }
            ],
            onAdd: (item) => this.addProduct(item.id)
        });
    }

    ticket() {
        const o = this.order;

        this.ticketBox = this.posTicket({
            parent:   'posOrderTicket',
            id:       'posOrderTk',
            title:    o ? `Pedido #P${o.folio || o.id}` : 'Nuevo pedido',
            subtitle: `Sucursal ${this.opts.branch}`,
            tag:      o ? 'Editando' : '',
            icon:     'receipt-text',
            section:  { title: 'Datos del pedido', icon: 'calendar-days', open: !o },
            launcher: { parent: 'posOrderLauncher', text: 'Ver pedido' }
        });
    }

    ticketForm() {
        const o = this.order;

        this.coffeeForm({
            parent:       'posOrderTkForm',
            id:           'formOrderTicket',
            class:        'grid grid-cols-12 gap-x-[10px] gap-y-[2px]',
            showRequired: false,
            json: [
                { opc: 'select', id: 'of_customer_id', lbl: 'Cliente', class: 'col-8', select2: true, selected: '— Elige o busca un cliente —', data: this.opts.customers || [], value: o ? o.customer_id : '' },
                { opc: 'button', id: 'btnOfCustomer', class: 'col-4', text: 'Nuevo', icon: 'icon-user-add', color_btn: 'outline', onClick: () => this.customer() },
                { opc: 'input', id: 'of_delivery_date', lbl: 'Fecha de entrega', type: 'date', class: 'col-6', value: o ? String(o.delivery_date || '').slice(0, 10) : this.opts.today },
                { opc: 'input', id: 'of_delivery_time', lbl: 'Hora', type: 'time', class: 'col-6', value: o ? String(o.delivery_time || '').slice(0, 5) : '' },
                { opc: 'select', id: 'of_delivery_method', lbl: 'Entrega', class: 'col-12', data: [{ id: '0', valor: 'Recoge en sucursal' }, { id: '1', valor: 'Envío a domicilio' }], value: o ? String(Number(o.delivery_method) === 1 ? 1 : 0) : '0' },
                { opc: 'input', id: 'of_location', lbl: 'Dirección de envío', class: 'col-12', required: false, placeholder: 'Calle, número, colonia y referencias', value: o ? o.location || '' : '' },
                { opc: 'textarea', id: 'of_note', lbl: 'Nota del pedido', class: 'col-12', rows: 2, required: false, placeholder: 'Indicaciones para producción o entrega', value: o ? o.note || '' : '' }
            ]
        });

        if (!o) $('#of_delivery_date').attr('min', this.opts.today);

        $('#of_location').attr('maxlength', 255);
        $('#of_note').attr('maxlength', 2000);

        $('#of_delivery_method').on('change', () => this.toggleLocation());
        $('#formOrderTicket').on('change input', () => this.refreshSummary());

        this.toggleLocation();
        this.refreshSummary();
    }

    refreshSummary() {
        const customer = String($('#of_customer_id').val() || '');
        const date     = String($('#of_delivery_date').val() || '');
        const time     = String($('#of_delivery_time').val() || '');
        const picked   = customer !== '' && customer !== '0';

        const parts = [
            picked ? $('#of_customer_id option:selected').text().split(' · ')[0].trim() : 'Sin cliente',
            date ? ordDate(date) : 'Sin fecha',
            time ? ordHour(time) : 'Sin hora',
            $('#of_delivery_method').val() === '1' ? 'Envío' : 'Recoge'
        ];

        $('#posOrderTkSummary').text(parts.join(' · '));
    }

    toggleLocation() {
        $('#of_location').parent().toggleClass('hidden', $('#of_delivery_method').val() !== '1');
    }

    onEscape(e) {
        if (e.key !== 'Escape' || this.s2Open) return;
        if (window.Swal && Swal.isVisible()) return;

        const sub = $('#modalOrderProduct, #modalOrderFree, #modalOrderCustomer, #modalOrderCake').last();

        if (sub.length) {
            sub.find('.cs-modal-cancel').trigger('click');
            return;
        }

        if ($('body').hasClass('pos-tk-open')) {
            $('body').removeClass('pos-tk-open');
            return;
        }

        this.askClose();
    }

    subModal(options) {
        const modal = this.csModal(options);

        $(document).off('keydown.csModal');

        return modal;
    }

    async askClose() {
        if (this.saving) return;
        if (this.snapshot() === this.initial) return this.close();

        const answer = await this.swalQuestion({
            opts: {
                title:             '¿Descartar los cambios?',
                text:              'Lo que capturaste en este pedido se pierde.',
                confirmButtonText: 'Descartar',
                cancelButtonText:  'Seguir editando'
            },
            extends: true
        });

        if (answer && answer.isConfirmed) this.close();
    }

    renderLines() {
        this.posTicketLines({
            parent:   'posOrderTkLines',
            id:       'posOrderLines',
            json:     this.lines.map((line, i) => this.lineView(line, i)),
            onUpdate: (index, quantity) => this.setQuantity(index, quantity),
            onEdit:   (index) => this.editLine(index),
            onDelete: (index) => this.removeLine(index)
        });

        this.flash = -1;
        this.renderTotals();
    }

    lineView(line, i) {
        const unit = this.unitPrice(line);
        const look = this.lineLook(line);
        const sub  = [];

        if (line.type === 'custom') {
            sub.push({ text: `${line.portions} ${line.portions === 1 ? 'porción' : 'porciones'}` });

            if (line.images.length) sub.push({ text: `${line.images.length} ${line.images.length === 1 ? 'foto' : 'fotos'}`, icon: 'image' });

            if (line.modifiers.length) {
                sub.push({ tone: 'mods', text: line.modifiers.map((m) => m.multiple && m.quantity > 1 ? `${m.name} ×${m.quantity}` : m.name).join(' · ') });
            }
        }

        if (line.dedication) sub.push({ tone: 'dedication', text: `«${line.dedication}»` });
        if (line.details) sub.push({ tone: 'note', text: line.details });

        return {
            name:     line.name,
            icon:     look.icon,
            tone:     look.tone,
            chip:     look.chip,
            sub:      sub,
            quantity: line.quantity,
            unit:     `× ${money(unit)}`,
            amount:   money(unit * line.quantity),
            isNew:    i === this.flash
        };
    }

    renderTotals() {
        const o        = this.order;
        const count    = this.lines.length;
        const pieces   = this.lines.reduce((sum, line) => sum + line.quantity, 0);
        const subtotal = this.round2(this.lines.reduce((sum, line) => sum + this.unitPrice(line) * line.quantity, 0));
        const discount = o ? Number(o.discount_amount) || 0 : 0;
        const paid     = o ? Number(o.paid) || 0 : 0;
        const total    = this.round2(subtotal - discount);
        const caption  = count === 0 ? 'Sin productos' : `${count} ${count === 1 ? 'partida' : 'partidas'} · ${pieces} ${pieces === 1 ? 'pieza' : 'piezas'}`;
        const canPay   = orders.can('create') && (!o || this.round2(total - paid) > 0.005);
        const json     = [];
        const after    = [];

        if (count && discount > 0) {
            json.push({ text: 'Subtotal', value: money(subtotal), tone: 'muted' }, { text: 'Descuento', value: `− ${money(discount)}`, tone: 'discount' });
        }

        if (paid > 0) {
            after.push({ text: 'Abonado', value: money(paid), tone: 'paid' }, { text: 'Saldo', value: money(this.round2(total - paid)), tone: 'due' });
        }

        this.posTicketTotals({
            parent: 'posOrderTkFoot',
            id:     'posOrderTotals',
            json:   json,
            total:  { label: 'Total', caption: caption, value: money(count ? total : 0) },
            after:  after,
            actions: canPay
                ? [
                    { id: 'btnOrderSave', text: 'Solo guardar', icon: 'check', class: 'ghost', disabled: this.saving, onClick: () => this.submit() },
                    { id: 'btnOrderSavePay', text: o ? 'Guardar y cobrar' : 'Guardar y dejar anticipo', icon: 'wallet', class: 'ok', disabled: this.saving, onClick: () => this.submit(true) }
                ]
                : [
                    { id: 'btnOrderSave', text: o ? 'Guardar cambios' : 'Guardar pedido', icon: 'check', class: 'ok', disabled: this.saving, onClick: () => this.submit() }
                ]
        });

        $('#posOrderTkLauncherCount').text(pieces);
        $('#posOrderTkLauncherTotal').text(money(count ? total : 0));
    }

    addProduct(id) {
        if (this.saving) return;

        const product = (this.opts.products || []).find((p) => String(p.id) === String(id));

        if (!product) return;

        const index = this.lines.findIndex((line) => line.type === 'product' && !line.id && Number(line.product_id) === Number(product.id) && !line.details && !line.dedication);

        if (index >= 0) return this.setQuantity(index, this.lines[index].quantity + 1);

        if (!this.canAdd()) return;

        this.putLine(undefined, {
            id:         0,
            type:       'product',
            product_id: Number(product.id),
            name:       product.name,
            price:      Number(product.price),
            quantity:   1,
            details:    '',
            dedication: ''
        });
    }

    setQuantity(index, quantity) {
        const line = this.lines[index];

        if (this.saving || !line) return;
        if (quantity < 1 || quantity > 9999) return this.warn('La cantidad va de 1 a 9,999.');

        line.quantity = quantity;

        this.flash = index;
        this.renderLines();
    }

    editLine(index) {
        const line = this.lines[index];
        if (!line) return;

        if (line.type === 'custom') return this.cakeForm(index);
        if (line.type === 'free') return this.free(index);

        this.product(index);
    }

    removeLine(index) {
        if (this.saving) return;

        this.lines.splice(index, 1);
        this.renderLines();
    }

    putLine(index, line) {
        if (index === undefined) this.lines.push(line);
        else this.lines[index] = line;

        this.flash = index === undefined ? this.lines.length - 1 : index;
        this.renderLines();
    }

    canAdd() {
        if (this.lines.length < 100) return true;

        this.warn('Un pedido admite hasta 100 productos.');

        return false;
    }

    product(index) {
        const line   = index === undefined ? null : this.lines[index];
        const locked = Boolean(line && line.id);
        const data   = (this.opts.products || []).map((p) => ({ id: p.id, valor: p.valor }));

        if (!line && !this.canAdd()) return;

        if (!line && !data.length) {
            alert({ icon: 'info', title: 'Sin catálogo', text: 'Esta sucursal no tiene productos de catálogo. Usa una línea libre o un pastel personalizado.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        if (line && !data.some((p) => Number(p.id) === Number(line.product_id))) {
            data.unshift({ id: line.product_id, valor: `${line.name} · ${money(line.price)}` });
        }

        this.subModal({
            id:         'modalOrderProduct',
            title:      line ? 'Editar producto' : 'Producto del catálogo',
            subtitle:   `Sucursal ${this.opts.branch}`,
            lucideIcon: 'shopping-basket',
            width:      'max-w-lg',
            saveText:   line ? 'Guardar' : 'Agregar',
            json: [
                {
                    id:       'op_product_id',
                    lbl:      'Producto',
                    tipo:     'select2',
                    required: true,
                    data:     data,
                    value:    line ? line.product_id : '',
                    empty:    '— Busca un producto —',
                    disabled: locked,
                    help:     locked ? 'El producto y su precio quedan como se guardaron. Para cambiarlo, quita la línea y agrega otra.' : '',
                    class:    'w-full'
                },
                { id: 'op_quantity', lbl: 'Cantidad', tipo: 'number', required: true, min: 1, max: 9999, step: 1, value: line ? line.quantity : 1, class: 'w-full sm:w-1/3' },
                { id: 'op_details', lbl: 'Detalles', maxlength: 255, value: line ? line.details : '', ph: 'Ej. Sin azúcar, empaque de regalo', class: 'w-full sm:w-2/3' }
            ],
            onSave: (values, close) => this.saveProduct(index, values, close)
        });
    }

    free(index) {
        const line = index === undefined ? null : this.lines[index];

        if (!line && !this.canAdd()) return;

        this.subModal({
            id:         'modalOrderFree',
            title:      line ? 'Editar línea libre' : 'Línea libre',
            subtitle:   'Un producto que no está en el catálogo',
            lucideIcon: 'pencil',
            width:      'max-w-lg',
            saveText:   line ? 'Guardar' : 'Agregar',
            json: [
                { id: 'ol_name', lbl: 'Nombre', required: true, maxlength: 150, value: line ? line.name : '', ph: 'Ej. Velas de número', class: 'w-full' },
                { id: 'ol_price', lbl: 'Precio unitario', tipo: 'number', required: true, min: 0, step: '0.01', value: line ? line.price : '', ph: '0.00', class: 'w-1/2' },
                { id: 'ol_quantity', lbl: 'Cantidad', tipo: 'number', required: true, min: 1, max: 9999, step: 1, value: line ? line.quantity : 1, class: 'w-1/2' },
                { id: 'ol_details', lbl: 'Detalles', maxlength: 255, value: line ? line.details : '', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveFree(index, values, close)
        });
    }

    customer() {
        if (this.saving) return;

        this.subModal({
            id:         'modalOrderCustomer',
            title:      'Nuevo cliente',
            subtitle:   `Sucursal ${this.opts.branch}`,
            lucideIcon: 'user-plus',
            width:      'max-w-md',
            saveText:   'Agregar cliente',
            json: [
                { id: 'ocu_name', lbl: 'Nombre', required: true, maxlength: 120, class: 'w-full' },
                { id: 'ocu_phone', lbl: 'Teléfono', required: true, maxlength: 16, ph: '10 dígitos', help: 'Si el teléfono ya existe, se elige ese cliente.', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveCustomer(values, close)
        });

        $('#ocu_phone')
            .attr({ inputmode: 'numeric', autocomplete: 'off' })
            .on('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
    }

    pickCustomer(customer) {
        const select = $('#of_customer_id');
        const id     = String(customer.id);

        if (!select.find(`option[value="${Number(customer.id)}"]`).length) {
            select.append(new Option(customer.valor, id));
            this.opts.customers.push({ id: customer.id, valor: customer.valor });
        }

        select.val(id).trigger('change');
    }

    cakeForm(index) {
        const line = index === undefined ? null : this.lines[index];

        if (!line && !this.canAdd()) return;

        const saved   = line ? line.saved.map((m) => ({ ...m })) : [];
        const groups  = this.cakeGroups(saved);
        const options = {};

        groups.forEach((g) => {
            g.options.forEach((o) => {
                options[o.id] = { id: o.id, name: o.name, price: o.price, group_id: g.id, group_name: g.name, multiple: g.multiple };
            });
        });

        this.cake = {
            index:   index,
            line:    line,
            saved:   saved,
            options: options,
            images:  line ? line.images.map((img) => ({ ...img })) : []
        };

        this.subModal({
            id:         'modalOrderCake',
            title:      line ? 'Editar pastel personalizado' : 'Pastel personalizado',
            subtitle:   'Arma el pastel paso a paso; el precio sugerido se calcula solo',
            lucideIcon: 'cake-slice',
            width:      'max-w-6xl',
            saveText:   line ? 'Guardar' : 'Agregar',
            body:       '<div id="ocWizard"></div>',
            onSave:     (values, close) => this.saveCake(close)
        });

        this.cakeBox = this.posCake({
            parent: 'ocWizard',
            id:     'posOrderCake',
            json:   groups,
            value: {
                name:       line ? line.name : 'Pastel personalizado',
                portions:   line ? line.portions : '',
                quantity:   line ? line.quantity : 1,
                price:      line ? line.priceInput : '',
                dedication: line ? line.dedication : '',
                details:    line ? line.details : '',
                modifiers:  line ? line.modifiers.map((m) => ({ id: m.id, quantity: m.quantity })) : []
            },
            images:        this.cakeImages(),
            maxImages:     10,
            onFiles:       (files) => this.addPhotos(files),
            onRemoveImage: (i) => this.removePhoto(i)
        });
    }

    async addPhotos(files) {
        const cake = this.cake;
        const box  = this.cakeBox;

        if (!files.length || !cake || !box || this.saving) return;

        const images = files.filter((file) => /^image\//.test(file.type));

        if (!images.length) {
            this.warn('Solo se pueden subir imágenes.');
            return;
        }

        if (cake.images.length + images.length > 10) {
            this.warn(`Un pastel admite hasta 10 fotos. Le quedan ${10 - cake.images.length}.`);
            return;
        }

        const form = new FormData();

        form.append('opc', 'uploadImages');
        images.forEach((file) => form.append('archivos[]', file));

        this.saving = true;
        box.busy(true);
        $('#modalOrderCake .cs-modal-save').prop('disabled', true);

        let data = null;

        try {
            const response = await fetch(this._link, { method: 'POST', body: form });
            data = await response.json();
        } catch (e) {
            data = null;
        }

        this.saving = false;

        if (this.cake !== cake || !$('#modalOrderCake').length) return;

        box.busy(false);
        $('#modalOrderCake .cs-modal-save').prop('disabled', false);

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se subieron las fotos', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        (data.images || []).forEach((img) => cake.images.push({ id: 0, path: img.path, name: img.name, original_name: img.original_name }));

        box.images(this.cakeImages());

        if ((data.errors || []).length) {
            alert({ icon: 'warning', title: data.message, text: data.errors.join(' '), btn1: true, btn1Text: 'Entendido' });
        }
    }

    removePhoto(index) {
        if (!this.cake || !this.cakeBox || this.saving) return;

        this.cake.images.splice(index, 1);
        this.cakeBox.images(this.cakeImages());
    }

    // -- CRUD --

    payload() {
        return this.lines.map((line) => {
            const item = {
                id:         line.id || 0,
                type:       line.type,
                quantity:   String(line.quantity),
                details:    line.details || '',
                dedication: line.dedication || ''
            };

            if (line.type === 'product') item.product_id = line.product_id;

            if (line.type === 'free') Object.assign(item, { name: line.name, price: String(line.price) });

            if (line.type === 'custom') {
                Object.assign(item, {
                    name:      line.name,
                    price:     line.priceInput,
                    portions:  String(line.portions),
                    modifiers: line.modifiers.map((m) => ({ id: m.id, quantity: m.quantity })),
                    images:    line.images.map((img) => img.id ? { id: img.id } : { path: img.path, name: img.name, original_name: img.original_name || img.name })
                });
            }

            return item;
        });
    }

    // pay = true: al guardar abre «Gestión de pagos» para dejar el anticipo.
    submit(pay) {
        const customer = String($('#of_customer_id').val() || '');

        const values = {
            of_customer_id:     customer === '0' ? '' : customer,
            of_delivery_date:   $('#of_delivery_date').val(),
            of_delivery_time:   $('#of_delivery_time').val(),
            of_delivery_method: $('#of_delivery_method').val(),
            of_location:        $('#of_location').val(),
            of_note:            $('#of_note').val()
        };

        const delivery = values.of_delivery_method === '1';
        const missing  = !values.of_customer_id || !values.of_delivery_date || !values.of_delivery_time || (delivery && !String(values.of_location || '').trim());

        if (missing && this.ticketBox) {
            this.ticketBox.section(true);
            $('#posOrderTk .pos-tk-body').scrollTop(0);
        }

        this.save(values, !!pay);
    }

    async save(values, pay) {
        if (this.saving) return;

        const delivery = values.of_delivery_method === '1';

        if (!values.of_customer_id) return this.warn('Elige el cliente.');
        if (!values.of_delivery_date) return this.warn('Elige la fecha de entrega.');
        if (!values.of_delivery_time) return this.warn('Elige la hora de entrega.');
        if (delivery && !String(values.of_location || '').trim()) return this.warn('Escribe la dirección de envío.');
        if (!this.lines.length) return this.warn('Agrega al menos un producto.');

        this.saving = true;

        const host   = $('#posOrderHost').addClass('is-saving');
        const button = $('#btnOrderSave, #btnOrderSavePay').prop('disabled', true);

        const data = await useFetch({
            url: this._link,
            data: {
                opc:             this.order ? 'editOrder' : 'addOrder',
                id:              this.order ? this.order.id : 0,
                token:           this.token,
                customer_id:     values.of_customer_id,
                delivery_date:   values.of_delivery_date,
                delivery_time:   values.of_delivery_time,
                delivery_method: delivery ? '1' : '0',
                location:        delivery ? values.of_location : '',
                note:            values.of_note || '',
                lines:           JSON.stringify(this.payload())
            }
        });

        this.saving = false;
        host.removeClass('is-saving');
        button.prop('disabled', false);

        if (!data || data.status != 200) {
            this.warnFail(data, 'No se guardó el pedido');
            return;
        }

        this.initial = this.snapshot();
        this.close();

        orders.lsOrders();

        if (pay && data.id) {
            await alert({ icon: data.unchanged ? 'info' : 'success', title: data.message, timer: 900 });
            return orderPay.open(Number(data.id));
        }

        alert({ icon: data.unchanged ? 'info' : 'success', title: data.message, timer: 1600 });
    }

    saveProduct(index, values, close) {
        const line     = index === undefined ? null : this.lines[index];
        const quantity = this.qty(values.op_quantity, 9999);
        const details  = String(values.op_details || '').trim();

        if (quantity === null) return this.warn('La cantidad va de 1 a 9,999.');

        if (line && line.id) {
            close();
            this.putLine(index, { ...line, quantity: quantity, details: details });
            return;
        }

        const product = (this.opts.products || []).find((p) => String(p.id) === String(values.op_product_id));

        if (!product) return this.warn('Elige el producto.');

        close();

        this.putLine(index, {
            id:         0,
            type:       'product',
            product_id: Number(product.id),
            name:       product.name,
            price:      Number(product.price),
            quantity:   quantity,
            details:    details,
            dedication: line ? line.dedication : ''
        });
    }

    saveFree(index, values, close) {
        const line     = index === undefined ? null : this.lines[index];
        const name     = String(values.ol_name || '').trim().replace(/\s+/g, ' ');
        const price    = this.amount(values.ol_price);
        const quantity = this.qty(values.ol_quantity, 9999);

        if (!name) return this.warn('Escribe el nombre.');
        if (price === null) return this.warn('Escribe un precio válido, con hasta 2 decimales.');
        if (quantity === null) return this.warn('La cantidad va de 1 a 9,999.');

        close();

        this.putLine(index, {
            id:         line ? line.id : 0,
            type:       'free',
            name:       name,
            price:      price,
            quantity:   quantity,
            details:    String(values.ol_details || '').trim(),
            dedication: line ? line.dedication : ''
        });
    }

    async saveCustomer(values, close) {
        if (this.saving) return;

        const name  = String(values.ocu_name || '').trim();
        const phone = String(values.ocu_phone || '').replace(/\D/g, '');

        if (!name) return this.warn('Escribe el nombre del cliente.');
        if (phone.length !== 10) return this.warn('El teléfono debe tener 10 dígitos.');

        this.saving = true;

        const button = $('#modalOrderCustomer .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'addCustomer', name: name, phone: phone } });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se guardó el cliente', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        this.pickCustomer(data.customer);
        close();

        if (data.existing) alert({ icon: 'info', title: 'Cliente existente', text: data.message, btn1: true, btn1Text: 'Entendido' });
        else alert({ icon: 'success', title: data.message, timer: 1400 });
    }

    saveCake(close) {
        if (this.saving || !this.cake || !this.cakeBox) return;

        const cake       = this.cake;
        const data       = this.cakeBox.get();
        const name       = data.name.trim().replace(/\s+/g, ' ');
        const portions   = this.qty(data.portions, 999);
        const quantity   = this.qty(data.quantity, 9999);
        const priceInput = data.price.trim();
        const modifiers  = data.modifiers.map((m) => this.modifier(m.id, m.quantity)).filter(Boolean);

        if (!name) return this.warn('Escribe el nombre del pastel.');
        if (portions === null) return this.warn('Las porciones van de 1 a 999.');
        if (quantity === null) return this.warn('La cantidad de pasteles va de 1 a 9,999.');
        if (!modifiers.length) return this.warn('Elige al menos una opción del pastel.');
        if (priceInput !== '' && this.amount(priceInput) === null) return this.warn('Escribe un precio válido o déjalo vacío para usar el sugerido.');

        close();

        this.putLine(cake.index, {
            id:         cake.line ? cake.line.id : 0,
            type:       'custom',
            product_id: cake.line ? cake.line.product_id : 0,
            name:       name,
            portions:   portions,
            quantity:   quantity,
            priceInput: priceInput,
            details:    data.details.trim().replace(/\s+/g, ' '),
            dedication: data.dedication.trim(),
            modifiers:  modifiers,
            images:     cake.images,
            saved:      cake.saved
        });

        this.cake    = null;
        this.cakeBox = null;
    }

    async cancel(id) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        const data = await orderDetail.fetchOrder(id);
        if (!data) return;

        const o = data.order;

        if (!data.can || !data.can.cancel) {
            alert({ icon: 'info', title: 'No se puede cancelar', text: (data.can && data.can.cancel_reason) || '', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        this.csModal({
            id:         'modalOrderCancel',
            title:      `Cancelar pedido #P${o.folio || o.id}`,
            subtitle:   `${o.customer || 'Sin cliente'} · Total ${money(o.total)}`,
            lucideIcon: 'ban',
            width:      'max-w-lg',
            saveText:   'Cancelar pedido',
            cancelText: 'Volver',
            info:       Number(o.paid) > 0
                ? `Lo abonado (${money(o.paid)}) queda como saldo a favor de ${o.customer || 'el cliente'}. No hay devolución.`
                : 'El pedido queda en la lista como Cancelado.',
            json: [
                { id: 'ox_reason', lbl: 'Motivo de la cancelación', tipo: 'textarea', required: true, maxlength: 255, rows: 3, ph: 'Ej. El cliente ya no lo necesita', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveCancel(o, values, close)
        });
    }

    async saveCancel(o, values, close) {
        if (this.saving) return;

        const reason = String(values.ox_reason || '').trim();

        if (!reason) return this.warn('Escribe el motivo de la cancelación.');

        this.saving = true;

        const button = $('#modalOrderCancel .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'cancelOrder', id: o.id, reason: reason } });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se canceló el pedido', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        close();

        alert({ icon: 'success', title: data.message, timer: 1600 });

        orders.lsOrders();
    }

    // -- Complements --

    snapshot() {
        return JSON.stringify([
            $('#of_customer_id').val(),
            $('#of_delivery_date').val(),
            $('#of_delivery_time').val(),
            $('#of_delivery_method').val(),
            $('#of_location').val(),
            $('#of_note').val(),
            this.payload()
        ]);
    }

    modifier(id, quantity) {
        const source = this.cake.options[Number(id)];

        if (!source) return null;

        return {
            id:         source.id,
            name:       source.name,
            price:      Number(source.price),
            quantity:   Number(quantity) || 1,
            group_id:   Number(source.group_id),
            group_name: source.group_name,
            multiple:   Boolean(source.multiple)
        };
    }

    cakeGroups(saved) {
        const groups = (this.opts.groups || []).map((g) => ({
            id:       Number(g.id),
            name:     g.name,
            multiple: Boolean(g.multiple),
            options:  (g.options || []).map((o) => ({ id: Number(o.id), name: o.name, price: Number(o.price) || 0 }))
        }));

        saved.forEach((m) => {
            const found = groups.reduce((hit, g) => hit || g.options.find((o) => o.id === m.id), null);

            if (found) {
                found.name  = m.name;
                found.price = m.price;
                return;
            }

            let group = groups.find((g) => g.id === m.group_id);

            if (!group) {
                group = { id: m.group_id, name: m.group_name || 'Opciones guardadas', multiple: m.multiple, options: [] };
                groups.push(group);
            }

            group.options.push({ id: m.id, name: m.name, price: m.price });
        });

        return groups;
    }

    cakeImages() {
        return (this.cake ? this.cake.images : []).map((img) => {
            const path = String(img.path || '').trim();

            return {
                src:      fileUrl(path),
                fallback: /^https?:\/\//i.test(path) ? '' : ORDER_FILES_REMOTE + encodeURI(path.replace(/^\/+/, '')),
                name:     img.original_name || img.name || ''
            };
        });
    }

    lineLook(line) {
        if (line.type === 'custom') return { icon: 'cake', tone: '#7C3AED', chip: { text: 'Personalizado', tone: 'purple' } };
        if (line.type === 'free') return { icon: 'pencil-line', tone: '#6B7280', chip: { text: 'Libre', tone: 'gray' } };

        const product = (this.opts.products || []).find((p) => Number(p.id) === Number(line.product_id));
        const look    = product ? this.looks[product.category_id] : null;

        return { icon: look ? look.icon : 'package', tone: look ? look.tone : '#6B7280', chip: null };
    }

    categoryName(name) {
        const text = String(name || '').trim();

        if (text === '' || text !== text.toUpperCase() || text === text.toLowerCase()) return text;

        return text.charAt(0) + text.slice(1).toLowerCase();
    }

    categoryIcon(name) {
        const text = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

        const rules = [
            [/porci/, 'cake-slice'],
            [/pastel/, 'cake'],
            [/galleta/, 'cookie'],
            [/\bpan\b/, 'croissant'],
            [/postre/, 'dessert'],
            [/bocadillo/, 'sandwich'],
            [/charola/, 'utensils'],
            [/decora/, 'sparkles'],
            [/pedido/, 'clipboard-list'],
            [/bebida|caf/, 'cup-soda']
        ];

        const found = rules.find((rule) => rule[0].test(text));

        return found ? found[1] : 'package';
    }

    unitPrice(line) {
        if (line.type !== 'custom') return Number(line.price) || 0;

        return line.priceInput === '' ? this.suggested(line) : Number(line.priceInput) || 0;
    }

    suggested(cake) {
        const portions = Number(cake.portions) || 0;

        return this.round2((cake.modifiers || []).reduce((sum, m) => sum + (m.multiple ? m.price * m.quantity : m.price * portions), 0));
    }

    warn(text) {
        alert({ icon: 'warning', title: 'Falta un dato', text: text, btn1: true, btn1Text: 'Entendido' });
    }

    // next: con 423, lo que sigue cuando quede un turno abierto hoy.
    warnFail(data, title, next) {
        if (data && data.status == 423) return orderTurn.locked(data, next);

        alert({
            icon:     data && data.status == 409 ? 'warning' : 'error',
            title:    title,
            text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
            btn1:     true,
            btn1Text: 'Entendido'
        });
    }

    qty(raw, max) {
        const value = String(raw == null ? '' : raw).trim();

        if (!/^\d+$/.test(value)) return null;

        const n = Number(value);

        return n >= 1 && n <= max ? n : null;
    }

    amount(raw) {
        const value = String(raw == null ? '' : raw).trim();

        if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;

        const n = Number(value);

        return n > 999999 ? null : n;
    }

    round2(n) {
        return Math.round(Number(n) * 100) / 100;
    }

    newToken() {
        return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    }
}
