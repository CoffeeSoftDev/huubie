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
        this.photos       = {};
        this.flash        = -1;
        this.scrollTop    = 0;
        this.optionIndex  = {};
        this.s2Open       = false;
        this.timeBox      = null;   // reloj de la hora (posTime)
        this.branchNow    = '';     // sucursal de la sesión en el selector de la captura
        this.draft        = null;   // lo que trae la captura al cambiar de sucursal (changeBranch)
        this.failed       = null;   // la respuesta de formOptions que no abrió (loadOptions quiet)
        this.ticketFirst  = true;   // Pedidos y Ventas: primero la card del ticket y después el catálogo
        this.chipArrows   = true;   // Pedidos y Ventas: categorías del catálogo en carril con flechas
        this.toastTimer   = null;   // aviso negro del cambio de sucursal (branchToast)
        this.dataReady    = false;  // Pedidos: «Datos del pedido» ya capturados (toList); abre la lista y el catálogo
        this.twoTabs      = false;  // Pedidos: el ticket va en pestañas Datos | Lista (ticket); Ventas no
        this.lockOld      = false;  // la cajera en un pendiente de corte cerrado: lo de días anteriores queda fijo (como alpha)

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.s2Open = !!document.querySelector('.select2-container--open');
        }, true);

        window.addEventListener('beforeunload', (e) => {
            if (!document.getElementById('posOrderHost') || this.snapshot() === this.initial) return;

            e.preventDefault();
            e.returnValue = '';
        });
    }

    /*  Pedido nuevo: el POS abre en la pestaña «Datos del pedido», con la lista
        bajo candado y el catálogo en espera (gate) hasta «Continuar con la
        captura». El cliente arranca enfocado, esperando que escriban (typeCustomer). */
    async add() {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        if (!(await this.loadOptions(0, true))) return;

        this.order     = null;
        this.lines     = [];
        this.lockOld   = false;
        this.dataReady = false;
        this.open();
        this.applyDraft();

        // Dos cuadros después: Tailwind CDN aún arma los anchos del ticket.
        requestAnimationFrame(() => requestAnimationFrame(() => this.focusCustomer()));
    }

    // -- Cambiar de sucursal --

    /*  Pedido nuevo: las sucursales a las que se puede cambiar, las mismas del
        selector de la barra (ctrl-nav › branches). null = editando o una sola.
        turns dice cuál tiene turno abierto (formOptions › turns): lo pinta branchSelect. */
    branchOptions() {
        const list    = (window.navbar && navbar.data && navbar.data.branches) || [];
        const current = list.find((b) => b.selected);

        if (this.order || list.length < 2 || !current) return null;

        return {
            current: String(current.id),
            turns:   (this.opts && this.opts.turns) || {},
            list:    list.map((b) => ({ id: String(b.id), valor: b.name }))
        };
    }

    /*  El selector de sucursal con select2: el nombre a la izquierda y el turno en
        una píldora a la derecha, en la lista y en lo elegido. Verde = turno
        abierto, terracota = turno de otro día (como la franja), gris = sin turno.
        Sin buscador: son pocas. */
    branchSelect(branches) {
        const looks = { open: ['is-open', 'Turno abierto'], old: ['is-old', 'Turno de otro día'] };

        const item = (o) => {
            if (!o.id) return o.text;

            const look = looks[branches.turns[o.id]] || ['is-none', 'Sin turno'];

            return $(`<span class="ord-branch-opt"><span class="ord-branch-name">${esc(o.text)}</span><span class="ord-branch-turn ${look[0]}"><i></i>${look[1]}</span></span>`);
        };

        $('#of_branch').select2({
            theme:                   'bootstrap-5',
            width:                   '100%',
            minimumResultsForSearch: Infinity,
            templateResult:          item,
            templateSelection:       item
        });
    }

    /*  Igual que elegirla en la barra: la sesión cambia (ctrl-nav › switchBranch),
        pero sin recargar la página: se pide el init y las opciones de la otra
        sucursal, la pantalla de atrás se rehace (orders.repaint) y la captura se
        vuelve a montar con cliente, entrega y nota. Un aviso chico dice el cambio.
        Los productos no viajan: cada sucursal tiene su catálogo y sus precios.
        Si la otra sucursal no deja capturar (sin turno), queda la lista y lo
        traído se guarda para el siguiente «Nuevo pedido». */
    async changeBranch() {
        const select = $('#of_branch');
        const id     = String(select.val() || '');
        const branch = (navbar.data.branches || []).find((b) => String(b.id) === id);
        const name   = branch ? branch.name : select.find('option:selected').text().trim();
        const back   = () => select.prop('disabled', false).val(this.branchNow).trigger('change.select2');

        if (!id || id === this.branchNow || this.saving) return back();

        if (this.lines.length) {
            const answer = await this.swalQuestion({
                opts: {
                    title:             `¿Cambiar a ${name}?`,
                    text:              'Los productos se quitan: cada sucursal tiene su catálogo. Cliente, fecha, hora, entrega y nota se quedan.',
                    confirmButtonText: 'Cambiar de sucursal',
                    cancelButtonText:  'Seguir aquí'
                },
                extends: true
            });

            if (!answer || !answer.isConfirmed) return back();
        }

        select.prop('disabled', true);

        const res = await navbar.post({ opc: 'switchBranch', id: id });

        if (!res || res.status !== 200) {
            back();
            alert({ icon: 'error', title: 'No se cambió la sucursal', text: (res && res.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        // Elegir una sucursal apaga «Todas», como en la barra.
        navbar.clearAll();
        this.markBranch(id);

        this.draft = this.draftValues();

        const [ready, init] = await Promise.all([this.loadOptions(0, true, 0, true), orders.fetchInit()]);

        // Lo de atrás ya es de la otra sucursal. repaint() borra la captura: se monta de nuevo en el mismo tick.
        orders.repaint(init);

        if (!ready) {
            this.close();
            this.warnFail(this.failed, 'No se pudo abrir la captura', () => this.add());
            return;
        }

        this.order = null;
        this.lines = [];
        this.open();
        this.applyDraft();

        // La sucursal se elige en «Datos del pedido»: ahí se queda.
        this.ticketBox.section(true);
        this.branchToast(name);
    }

    // La barra marca la sucursal nueva sin recargar (su selectBranch sí recarga).
    markBranch(id) {
        (navbar.data.branches || []).forEach((b) => { b.selected = String(b.id) === String(id); });

        if (navbar.all) navbar.all.on = false;

        navbar.renderBranch();
        navbar.icons();
    }

    /*  El aviso negro de Configuración (Rosy, page.css › .pg-toast): abajo al
        centro, dice el cambio y se va solo. No tapa la captura ni pide clic.
        Su copia en Pedidos es .ord-toast (order.css). */
    branchToast(name) {
        const box = $('#ordToast').length
            ? $('#ordToast')
            : $('<div>', { id: 'ordToast', class: 'ord-toast', role: 'status', 'aria-live': 'polite' }).appendTo('body');

        box.html(`<i data-lucide="circle-check"></i><span>Cambiaste a <b>${esc(name)}</b></span>`);

        if (window.lucide) lucide.createIcons({ root: box[0] });

        // Reinicia la entrada aunque ya hubiera uno en pantalla.
        box.removeClass('is-on');
        void box[0].offsetWidth;
        box.addClass('is-on');

        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => box.removeClass('is-on'), 2600);
    }

    draftValues() {
        const values = this.ticketValues();

        return {
            customer:     values.of_customer_id,
            customerText: values.of_customer_id ? $('#of_customer_id option:selected').text().trim() : '',
            date:         values.of_delivery_date,
            time:         values.of_delivery_time,
            method:       values.of_delivery_method,
            location:     values.of_location,
            note:         values.of_note
        };
    }

    applyDraft() {
        const d = this.draft;

        this.draft = null;

        if (!d) return;

        if (d.customer) this.pickCustomer({ id: d.customer, valor: d.customerText || 'Cliente' });

        if (d.date && d.date >= this.opts.today) $('#of_delivery_date').val(d.date);

        if (d.time && this.timeBox) this.timeBox.set(d.time);
        else if (d.time) $('#of_delivery_time').val(d.time);

        $('#of_delivery_method').val(d.method === '1' ? '1' : '0');
        $('#of_location').val(d.location || '');
        $('#of_note').val(d.note || '');

        this.toggleLocation();
        this.waitCustomer();
        this.refreshSummary();
    }

    /*  El selector de clientes arranca CERRADO y enfocado, como un campo de texto
        esperando que escriban (typeCustomer). Escondido no se enfoca. */
    focusCustomer() {
        const select = $('#of_customer_id');
        const box    = select.next('.select2-container');

        if (!select.data('select2') || !box.is(':visible')) return;

        box.find('.select2-selection').trigger('focus');
    }

    /*  Con el selector enfocado, la primera letra o número abre la búsqueda con
        esa tecla ya escrita (select2 solo abre con Enter, espacio o Alt+↓). La
        lista se pega a <body> con la posición de ese momento: ya acomodada. */
    typeCustomer(e) {
        if (e.key.length !== 1 || e.key === ' ' || e.ctrlKey || e.metaKey || e.altKey) return;

        const select = $('#of_customer_id');

        if (select.prop('disabled') || !select.data('select2') || select.data('select2').isOpen()) return;

        e.preventDefault();
        select.select2('open');

        // select2 enfoca su buscador hasta el siguiente ciclo: se enfoca ya, o la segunda tecla se pierde.
        const field = $('.select2-container--open .select2-search__field');

        field.val(e.key).trigger('focus').trigger('input');
        field[0].setSelectionRange(1, 1);
    }

    /*  Lo que se revisa antes de editar: que se pueda y, si el pedido ya está en
        un corte, el aviso. ask = false sin el aviso: pedido.php lo abre ya
        avisado desde la lista (y al recargar no se repite). null = no se edita.
        Lo primero, como alpha (requireOpenShift): el turno de hoy (edit_turn).
        Un pagado (como alpha) no abre la captura: abre editPaid, con contraseña. */
    async editable(id, ask = true) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        const data = await orderDetail.fetchOrder(id);
        if (!data) return null;

        if (data.edit_turn) {
            this.turnLock(data.edit_turn, id);
            return null;
        }

        if (data.can && !data.can.edit && data.can.edit_paid) {
            orderDetail.editPaid(id);
            return null;
        }

        // El porqué va con quién sí puede resaltado (ordWhoCan).
        if (!data.can || !data.can.edit) {
            alert({ icon: 'info', title: 'No se puede editar', html: ordWhoCan((data.can && data.can.edit_reason) || ''), btn1: true, btn1Text: 'Entendido' });
            return null;
        }

        // Pendiente de un corte cerrado (como alpha): la cajera agrega productos; lo de días anteriores queda fijo.
        if (ask && data.can.lock_old) {
            const go = await alert({
                icon:     'info',
                title:    'Este pedido ya está en un corte',
                html:     ordWhoCan(data.can.lock_reason),
                btn1:     true,
                btn1Text: 'Editar',
                btn2:     true,
                btn2Text: 'Ahora no'
            });

            if (!go || !go.isConfirmed) return null;
        }

        return data;
    }

    // Sin turno de hoy no se edita. 423: ofrece abrirlo y vuelve a «Editar». 409 (pedido de otra sucursal): solo avisa.
    turnLock(lock, id) {
        if (Number(lock.status) === 423) return orderTurn.locked(lock, () => this.edit(id));

        alert({ icon: 'warning', title: lock.title || 'Sin turno abierto', text: lock.message || '', btn1: true, btn1Text: 'Entendido' });
    }

    async edit(id, ask = true) {
        const data = await this.editable(id, ask);
        if (!data) return;

        if (!(await this.loadOptions(data.order.customer_id, false, data.order.id))) return;

        this.order     = data.order;
        this.lockOld   = !!data.can.lock_old;
        this.lines     = (data.lines || []).map((line) => this.fromSaved(line));
        this.dataReady = true;
        this.open();
    }

    // orderId: al editar, el ctrl trae el catálogo y los clientes de la sucursal del pedido (puede ser otra).
    // quiet: sin aviso; la respuesta queda en this.failed para que quien llama avise después (changeBranch).
    async loadOptions(customerId, isNew, orderId, quiet) {
        if (this.loading) return false;

        this.loading = true;

        const data = await useFetch({ url: this._link, data: { opc: 'formOptions', customer_id: customerId || 0, is_new: isNew ? 1 : 0, order_id: orderId || 0 } });

        this.loading = false;

        if (!data || data.status != 200) {
            this.failed = data;

            if (!quiet) this.warnFail(data, 'No se pudo abrir la captura', isNew ? () => this.add() : (orderId ? () => this.edit(orderId, false) : null));

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

    // fixed: agregada antes de hoy en un pendiente de corte cerrado (lockOld); no se cambia ni se quita.
    fromSaved(line) {
        const base = {
            id:         Number(line.id),
            name:       line.name,
            price:      Number(line.price),
            quantity:   Number(line.quantity) || 1,
            details:    line.details || '',
            dedication: line.dedication || '',
            fixed:      this.lockOld && String(line.created_at || '').slice(0, 10) < String(this.opts.today || '')
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

        this.notify('formOpened');
    }

    close() {
        $(document).off('keydown.orderForm');
        $('body').removeClass('pos-tk-open');
        $('#posOrderHost').remove();
        $('#pageOrders').removeClass('hidden');
        $('#main__content').scrollTop(this.scrollTop);

        // Sin la captura, la franja vuelve sin «Volver a pedidos».
        orderTurn.paintStrip();

        this.cake      = null;
        this.cakeBox   = null;
        this.ticketBox = null;

        this.notify('formClosed');
    }

    // La página se entera de que la captura abrió o cerró: pedido.js le da su dirección
    // (?id=) y al cerrar regresa a la lista (OrderPage). Ventas no tiene esos métodos.
    notify(event) {
        if (typeof orders !== 'undefined' && orders && orders !== this && typeof orders[event] === 'function') orders[event](this.order);
    }

    // Sin encabezado, igual que Ventas: catálogo y ticket arrancan arriba y miden lo mismo.
    // La card del ticket va primero (izquierda) y el catálogo después, en Pedidos y en Ventas.
    // «Volver a pedidos» vive en la franja de caja (backButton).
    layout() {
        const catalog = { id: 'posOrderCatalog', class: 'flex-1 min-w-0 min-h-0 flex flex-col' };
        const ticket  = { id: 'posOrderTicket', class: 'md:w-[320px] lg:w-[360px] xl:w-[390px] shrink-0 min-h-0 flex flex-col' };

        this.createLayout({
            parent: 'posOrderHost',
            design: false,
            data: {
                id:    'posOrder',
                class: 'flex-1 min-h-0 flex flex-col gap-[12px]',
                container: [
                    {
                        type:  'div',
                        id:    'posOrderBody',
                        class: 'flex-1 min-h-0 flex gap-[12px]',
                        children: this.ticketFirst ? [ticket, catalog] : [catalog, ticket]
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

    // «Volver a pedidos» va en la franja de caja, junto al turno (CajaStrip.backButton).
    backButton() {
        orderTurn.paintStrip();
    }

    // Mismo diseño que Ventas: un solo color para todas las cards (el de la marca) y
    // sale-cat (foto más alta, nombre en una línea, categorías en una fila; order.css).
    // Las cards con foto van primero; entre ellas sigue el orden del ctrl (por nombre).
    catalog() {
        const tone = 'var(--po-brand)';

        this.looks  = {};
        this.photos = {};

        const categories = (this.opts.categories || []).map((c) => {
            const name = this.categoryName(c.name);
            const look = { icon: this.categoryIcon(name), tone: tone };

            this.looks[c.id] = look;

            return { id: c.id, name: name, total: c.total, icon: look.icon, tone: look.tone };
        });

        const json = (this.opts.products || []).map((p) => {
            const look  = this.looks[p.category_id] || { icon: 'package', tone: tone };
            const image = String(p.image || '').trim();
            const photo = {
                image:    image ? fileUrl(image) : '',
                fallback: image && !/^https?:/i.test(image) ? ORDER_FILES_REMOTE + encodeURI(image.replace(/^\/+/, '')) : ''
            };

            this.photos[p.id] = photo;

            return {
                id:            p.id,
                name:          String(p.name || '').trim(),
                price:         money(p.price),
                category_id:   p.category_id,
                image:         photo.image,
                imageFallback: photo.fallback,
                sku:           p.sku || '',
                barcode:       p.barcode || '',
                icon:          look.icon,
                tone:          look.tone
            };
        });

        // sort es estable: los que no tienen foto conservan su orden.
        json.sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0));

        this.posCatalog({
            parent:     'posOrderCatalogMain',
            id:         'posOrderCatalogList',
            class:      'flex-1 min-h-0 flex flex-col sale-cat',
            json:       json,
            categories: categories,
            arrows:     this.chipArrows,
            actions:    this.catalogActions(),
            onAdd:      (item) => this.addProduct(item.id)
        });
    }

    // Pedidos ya no ofrece «Línea libre»; las que ya estaban guardadas se siguen editando (editLine).
    catalogActions() {
        return [
            { id: 'btnOrderCake', text: 'Pastel personalizado', icon: 'cake-slice', onClick: () => this.cakeForm() }
        ];
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
            // Dos pestañas: primero los datos; «Continuar con la captura» abre la lista
            // (con el total y el cobro) y el catálogo. Sin datos, la lista va con candado.
            tabs:      true,
            beforeTab: (key) => key !== 'lines' || this.dataOk(),
            section:   { title: 'Datos del pedido', icon: 'calendar-days', open: !this.dataReady },
            lines:     { title: 'Lista del pedido', icon: 'shopping-cart', locked: !this.dataReady, lockText: 'Primero captura los datos del pedido' },
            launcher:  { parent: 'posOrderLauncher', text: 'Ver pedido' }
        });

        // Ventas arma su propio ticket y no lo usa.
        this.twoTabs = true;
    }

    // -- Pasos del ticket --

    // «Continuar con la captura»: con los datos completos se abren la lista y el catálogo.
    toList() {
        if (!this.dataOk()) return;

        this.dataReady = true;
        this.gate();
        this.ticketBox.tab('lines');

        $('#posOrderCatalogListSearch').trigger('focus');
    }

    // Lo primero que falta en los datos lo dice y se queda en ellos.
    dataOk() {
        const error = this.dataError(this.ticketValues());

        if (error) this.warn(error);

        return !error;
    }

    /*  Sin «Datos del pedido» capturados: la lista con candado y, en lugar del
        catálogo, un aviso de que primero van los datos. catalog() rehace
        #posOrderCatalogMain: por eso el aviso se vuelve a montar aquí. */
    gate() {
        const ready = this.dataReady;
        let box     = $('#posOrderGate');

        if (!box.length) {
            box = $('<div>', { id: 'posOrderGate', class: 'ord-gate' }).html(`
                <span class="ord-gate-icon"><i data-lucide="clipboard-list"></i></span>
                <p class="ord-gate-title">Primero, los datos del pedido</p>
                <p class="ord-gate-text">Completa cliente, fecha y hora en «Datos del pedido» y pulsa «Continuar con la captura» para agregar productos.</p>`);

            $('#posOrderCatalogMain').append(box);

            if (window.lucide) lucide.createIcons({ root: box[0] });
        }

        box.toggle(!ready);
        $('#posOrderCatalogList').toggle(ready);

        this.ticketBox.lock(!ready);
    }

    // Al agregar o cambiar un producto se ve la lista, aunque los datos estuvieran a la vista.
    showList() {
        if (this.twoTabs && this.ticketBox) this.ticketBox.section(false);
    }

    /*  La pestaña «Datos del pedido»: los campos sin encabezado (la pestaña ya
        dice qué es), «Continuar con la captura» y la nota abajo. */
    ticketForm() {
        const o        = this.order;
        const branches = this.branchOptions();

        $('#posOrderTkForm').html(`
            <div class="ord-who">
                <div id="posOrderTkData"></div>
            </div>
            <div class="ord-who-note"><i data-lucide="info"></i><span>Ya capturados, puedes volver a esta pestaña para cambiarlos.</span></div>`);

        this.coffeeForm({
            parent: 'posOrderTkData',
            id:     'formOrderTicket',
            class:  'grid grid-cols-12 gap-x-[10px]',
            json: [
                ...(branches ? [{ opc: 'select', id: 'of_branch', lbl: 'Sucursal', class: 'col-12', data: branches.list, value: branches.current }] : []),
                { opc: 'select', id: 'of_customer_id', lbl: 'Cliente', class: 'col-8', select2: true, selected: '— Elige o busca un cliente —', data: this.opts.customers || [], value: o ? o.customer_id : '' },
                { opc: 'button', id: 'btnOfCustomer', class: 'col-4', text: 'Nuevo', icon: 'icon-user-add', color_btn: 'outline', onClick: () => this.customer() },
                { opc: 'input', id: 'of_delivery_date', lbl: 'Fecha de entrega', type: 'date', class: 'col-6', value: o ? String(o.delivery_date || '').slice(0, 10) : this.opts.today },
                { opc: 'input', id: 'of_delivery_time', lbl: 'Hora', type: 'time', class: 'col-6', value: o ? String(o.delivery_time || '').slice(0, 5) : '' },
                { opc: 'select', id: 'of_delivery_method', lbl: 'Entrega', class: 'col-12', data: [{ id: '0', valor: 'Recoge en sucursal' }, { id: '1', valor: 'Envío a domicilio' }], value: o ? String(Number(o.delivery_method) === 1 ? 1 : 0) : '0' },
                { opc: 'input', id: 'of_location', lbl: 'Dirección de envío', class: 'col-12', required: false, placeholder: 'Calle, número, colonia y referencias', value: o ? o.location || '' : '' },
                { opc: 'textarea', id: 'of_note', lbl: 'Nota del pedido', class: 'col-12', rows: 2, required: false, placeholder: 'Indicaciones para producción o entrega', value: o ? o.note || '' : '' },
                { opc: 'button', id: 'btnOfNext', class: 'col-12', text: 'Continuar con la captura', color_btn: 'primary', onClick: () => this.toList() }
            ]
        });

        // El botón no lleva etiqueta: sin el renglón vacío que le pone coffeeForm.
        $('#btnOfNext').addClass('w-full').html('Continuar con la captura <i data-lucide="arrow-right"></i>').prev('label').remove();
        $('#btnOfNext').parent().addClass('mt-2');

        if (!o) $('#of_delivery_date').attr('min', this.opts.today);

        /*  Cerrado se lee como un campo de búsqueda: la opción «0» que pone
            coffeeForm pasa a placeholder de select2 (gris) y sale de la lista.
            El valor sigue siendo «0» = sin cliente. */
        $('#of_customer_id').select2('destroy').select2({ theme: 'bootstrap-5', width: '100%', placeholder: { id: '0', text: 'Buscar por nombre o teléfono…' } });

        $('#of_location').attr('maxlength', 255);
        $('#of_note').attr('maxlength', 2000);

        // La hora con el reloj de ruedas (components/pos-time.js); #of_delivery_time sigue guardando HH:MM.
        this.timeBox = this.posTime({ input: 'of_delivery_time', title: 'Hora de entrega' });

        if (branches) {
            this.branchNow = branches.current;
            this.branchSelect(branches);
            $('#of_branch').on('change', () => this.changeBranch());
        }

        $('#of_delivery_method').on('change', () => this.toggleLocation());
        $('#of_customer_id').on('change', () => this.waitCustomer());
        $('#of_customer_id').on('select2:select', () => $('#of_delivery_date').trigger('focus'));
        $('#of_customer_id').next('.select2-container').find('.select2-selection').on('keydown', (e) => this.typeCustomer(e));
        $('#formOrderTicket').on('change input', () => this.refreshSummary());

        if (window.lucide) lucide.createIcons({ root: $('#posOrderTkForm')[0] });

        this.toggleLocation();
        this.waitCustomer();
        this.refreshSummary();
        this.gate();
    }

    // Sin cliente, el selector parpadea (un punto chico, order.css › .ord-wait) hasta que se elige uno.
    waitCustomer() {
        const value = String($('#of_customer_id').val() || '');

        $('#of_customer_id').parent().toggleClass('ord-wait', value === '' || value === '0');
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

        // Con otra ventana encima (los pagos del pedido nuevo), Escape es de esa ventana.
        if ($('.cs-modal-bg, .cf-overlay').length) return;

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

        // Lo de días anteriores (lockOld): sin −/+, editar ni quitar.
        this.lines.forEach((line, i) => {
            if (line.fixed) $(`#posOrderLines .pos-tkl-item[data-index="${i}"]`).find('button.pos-tkl-step, button.pos-tkl-act').prop('disabled', true);
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

            if (line.images.length) sub.push({ text: `${line.images.length} ${line.images.length === 1 ? 'foto' : 'fotos'}`, icon: 'image', onClick: () => this.showPhotos(i) });

            if (line.modifiers.length) {
                sub.push({ tone: 'mods', text: line.modifiers.map((m) => m.multiple && m.quantity > 1 ? `${m.name} ×${m.quantity}` : m.name).join(' · ') });
            }
        }

        if (line.dedication) sub.push({ tone: 'dedication', text: `«${line.dedication}»` });
        if (line.details) sub.push({ tone: 'note', text: line.details });
        if (line.fixed) sub.push({ tone: 'note', icon: 'lock', text: 'De un día anterior: queda fijo' });

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

        let actions = [
            { id: 'btnOrderSave', text: o ? 'Guardar cambios' : 'Guardar pedido', icon: 'check', class: 'ok', disabled: this.saving, onClick: () => this.submit() }
        ];

        if (canPay && !o) {
            // Pedido nuevo: un solo botón. Abre los pagos; sin importe, ahí pregunta cómo se guarda (askHow).
            actions = [
                { id: 'btnOrderSavePay', text: 'Guardar y cobrar', icon: 'wallet', class: 'ok', disabled: this.saving, onClick: () => this.submit(true) }
            ];
        } else if (canPay) {
            actions = [
                { id: 'btnOrderSave', text: 'Solo guardar', icon: 'check', class: 'ghost', disabled: this.saving, onClick: () => this.submit() },
                { id: 'btnOrderSavePay', text: 'Guardar y cobrar', icon: 'wallet', class: 'ok', disabled: this.saving, onClick: () => this.submit(true) }
            ];
        }

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
            actions: actions
        });

        $('#posOrderTkLinesCount').text(caption);
        $('#posOrderTkLauncherCount').text(pieces);
        $('#posOrderTkLauncherTotal').text(money(count ? total : 0));
    }

    addProduct(id) {
        if (this.saving) return;

        const product = (this.opts.products || []).find((p) => String(p.id) === String(id));

        if (!product) return;

        const index = this.lines.findIndex((line) => line.type === 'product' && !line.id && Number(line.product_id) === Number(product.id) && !line.details && !line.dedication && !line.discount);

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
        if (line.fixed) return this.fixedWarn();
        if (quantity < 1 || quantity > 9999) return this.warn('La cantidad va de 1 a 9,999.');

        line.quantity = quantity;

        this.flash = index;
        this.renderLines();
        this.showList();
    }

    editLine(index) {
        const line = this.lines[index];
        if (!line) return;
        if (line.fixed) return this.fixedWarn();

        if (line.type === 'custom') return this.cakeForm(index);
        if (line.type === 'free') return this.free(index);

        this.product(index);
    }

    removeLine(index) {
        if (this.saving) return;
        if (this.lines[index] && this.lines[index].fixed) return this.fixedWarn();

        this.lines.splice(index, 1);
        this.renderLines();
    }

    // Como alpha: lo agregado en días anteriores no se toca desde la captura de la cajera.
    fixedWarn() {
        alert({ icon: 'info', title: 'Producto de un día anterior', text: 'Queda fijo: cambiarlo o quitarlo lo autoriza Dueño o Supervisor.', btn1: true, btn1Text: 'Entendido' });
    }

    putLine(index, line) {
        if (index === undefined) this.lines.push(line);
        else this.lines[index] = line;

        this.flash = index === undefined ? this.lines.length - 1 : index;
        this.renderLines();
        this.showList();
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
            alert({ icon: 'info', title: 'Sin catálogo', text: 'Esta sucursal no tiene productos de catálogo. Usa un pastel personalizado.', btn1: true, btn1Text: 'Entendido' });
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
            title:      line ? 'Editar pastel' : '¡Arma tu pastel!',
            subtitle:   'Personaliza cada detalle; el precio sugerido se calcula solo',
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

    // Clic en «N fotos» de la partida: el mismo visor del detalle del pedido (OrderDetail.preview).
    showPhotos(index) {
        const line = this.lines[index];

        if (!line || !line.images || !line.images.length) return;

        const key = `form-${index}`;

        orderDetail.galleries[key] = {
            images: line.images.map((img) => ({ path: img.path, name: img.original_name || img.name || '' })),
            index:  0
        };

        orderDetail.preview(key, 0);
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

    /*  pay = true: «Guardar y cobrar». En un pedido nuevo abre los pagos ANTES
        de guardar (payDraft): con anticipo, el pedido se crea al confirmar el
        cobro; sin importe, la ventana pregunta cómo se guarda (askHow). En uno
        que ya existe, guarda los cambios y abre sus pagos. */
    submit(pay) {
        const values  = this.ticketValues();
        const missing = this.dataError(values) !== '';

        // Falta un dato: se abren los datos. Está todo: se ve la lista (por si faltan productos).
        if (missing && this.ticketBox) {
            this.ticketBox.section(true);
            $('#posOrderTk .pos-tk-body').scrollTop(0);
        } else {
            this.showList();
        }

        this.save(values, !!pay);
    }

    ticketValues() {
        const customer = String($('#of_customer_id').val() || '');

        return {
            of_customer_id:     customer === '0' ? '' : customer,
            of_delivery_date:   $('#of_delivery_date').val(),
            of_delivery_time:   $('#of_delivery_time').val(),
            of_delivery_method: $('#of_delivery_method').val(),
            of_location:        $('#of_location').val(),
            of_note:            $('#of_note').val()
        };
    }

    // Lo primero que falta en «Datos del pedido»; '' si está completo.
    dataError(values) {
        if (!values.of_customer_id) return 'Elige el cliente.';
        if (!values.of_delivery_date) return 'Elige la fecha de entrega.';
        if (!values.of_delivery_time) return 'Elige la hora de entrega.';

        // Con envío a domicilio la dirección y la nota son opcionales.
        return '';
    }

    async save(values, pay) {
        if (this.saving) return;

        const error = this.dataError(values);

        if (error) return this.warn(error);
        if (!this.lines.length) return this.warn('Agrega al menos un producto.');

        // Pedido nuevo: se guarda desde los pagos. Sin importe que cobrar solo queda cotización.
        if (pay && !this.order) {
            if (this.orderTotal() > 0.005) return this.payDraft(values);

            if (await this.askHow() !== 'quote') return;

            pay = false;
        }

        const data = await this.send(values);

        if (!data || data.status != 200) {
            this.warnFail(data, 'No se guardó el pedido');
            return;
        }

        this.finish();

        orders.lsOrders();
        orderTurn.touch();

        if (pay && data.id) {
            await alert({ icon: data.unchanged ? 'info' : 'success', title: data.message, timer: 900 });
            return orderPay.open(Number(data.id));
        }

        alert({ icon: data.unchanged ? 'info' : 'success', title: data.message, timer: 1600 });
    }

    orderTotal() {
        return this.round2(this.lines.reduce((sum, line) => sum + this.unitPrice(line) * line.quantity, 0));
    }

    /*  «¿Cómo se guarda?» con el alertBox del framework: 'quote' (Cotización),
        'pending' (Pendiente: sin anticipo, con todo el saldo por cobrar; addOrder
        › status) o '' si se cerró sin elegir (clic fuera o Escape). Sin importe
        que cobrar, o con block (por qué no se cobra), solo queda Cotización. */
    askHow(block = '') {
        const due  = this.orderTotal() > 0.005 && !block;
        const line = (name, text) => `<span class="block mt-1"><b>${name}</b> ${text}</span>`;
        const why  = block ? line('Sin cobro:', esc(block)) : line('Sin importe:', 'no hay nada que cobrar.');
        const id   = 'ordAskHow';

        return new Promise((resolve) => {
            let done = false;

            const finish = (how) => {
                if (done) return;

                done = true;
                document.removeEventListener('keydown', onKey, true);
                resolve(how);
            };

            // Igual que cierra el alertBox, pero sin elegir nada.
            const leave = () => {
                const box = $('#' + id);

                box.find('.tf-alert-card, [data-ab-backdrop]').removeClass('tf-ab-in').addClass('tf-ab-out');
                setTimeout(() => box.remove(), 200);
                finish('');
            };

            // En captura: Escape cierra la pregunta y no llega a la captura ni a la ventana de pagos.
            const onKey = (e) => {
                if (e.key !== 'Escape') return;

                e.preventDefault();
                e.stopPropagation();
                leave();
            };

            $('#' + id).remove();

            this.alertBox({
                id:          id,
                type:        'confirm',
                title:       '¿Cómo se guarda el pedido?',
                detailHtml:  line('Cotización:', 'se guarda sin dinero; se cobra después.')
                    + (due ? line('Pendiente:', 'se guarda como pedido, con todo el saldo por cobrar.') : why),
                dual:        due,
                cancelLabel: 'Cotización',
                okLabel:     due ? 'Pendiente' : 'Cotización',
                onOk:        () => finish(due ? 'pending' : 'quote'),
                onCancel:    () => finish('quote')
            });

            // El fondo del alertBox elige un botón; aquí solo cierra.
            const box = $('#' + id);

            box.find('[data-ab-backdrop]').off('click').on('click', leave);
            document.addEventListener('keydown', onKey, true);

            setTimeout(() => box.find('[data-ab-ok]').trigger('focus'), 60);
        });
    }

    // Pedido nuevo: abre los pagos sin guardar. El pedido se crea cuando la ventana
    // confirma el cobro o elige cotización o pendiente (OrderPay.saveDraft llama a send()).
    async payDraft(values) {
        const total = this.orderTotal();

        this.saving = true;

        const button = $('#btnOrderSave, #btnOrderSavePay').prop('disabled', true);

        try {
            await orderPay.openDraft({
                customer: $('#of_customer_id option:selected').text().split(' · ')[0].trim(),
                total:    total,
                delivery: values.of_delivery_date,
                ask:      (block) => this.askHow(block),
                save:     async (how) => {
                    const data = await this.send(values, how);

                    if (data && data.status == 200) this.finish();

                    return data;
                }
            });
        } finally {
            this.saving = false;
            button.prop('disabled', false);
        }
    }

    // La petición de guardar, sin avisos: la usan save() y el cobro del pedido nuevo.
    // how = 'pending': el pedido nuevo nace Pendiente aunque no deje anticipo (askHow).
    async send(values, how = '') {
        const delivery = values.of_delivery_method === '1';

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
                status:          !this.order && how === 'pending' ? 'pending' : '',
                lines:           JSON.stringify(this.payload())
            }
        });

        this.saving = false;
        host.removeClass('is-saving');
        button.prop('disabled', false);

        return data;
    }

    // Ya guardado: la captura se cierra sin preguntar por cambios.
    finish() {
        this.initial = this.snapshot();
        this.close();
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
        const data   = await useFetch({ url: this._link, data: { opc: 'addCustomer', name: name, phone: phone, order_id: this.order ? this.order.id : 0 } });

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

        const isPaid = Number(o.sale_status_id) === 3;

        this.csModal({
            id:         'modalOrderCancel',
            title:      `Cancelar pedido${isPaid ? ' pagado' : ''} #P${o.folio || o.id}`,
            subtitle:   `${o.customer || 'Sin cliente'} · Total ${money(o.total)}`,
            lucideIcon: 'ban',
            width:      'max-w-lg',
            saveText:   'Cancelar pedido',
            cancelText: 'Volver',
            info:       isPaid ? this.paidCancelInfo(o, data.payments || [])
                : Number(o.paid) > 0
                ? `Lo abonado (${money(o.paid)}) queda como saldo a favor de ${o.customer || 'el cliente'}. No hay devolución.`
                : 'El pedido queda en la lista como Cancelado.',
            json: [
                { id: 'ox_reason', lbl: 'Motivo de la cancelación', tipo: 'textarea', required: true, maxlength: 255, rows: 3, ph: 'Ej. El cliente ya no lo necesita', class: 'w-full' },
                { id: 'ox_key', lbl: 'Tu contraseña', tipo: 'text', required: true, class: 'w-full', help: 'La misma con la que entras a Huubie.' }
            ],
            onSave: (values, close) => this.saveCancel(o, values, close)
        });

        // csModal no tiene campo de contraseña: se pinta de texto y aqui se oculta lo escrito.
        // one-time-code: el navegador no la rellena sola (si no, la clave no pediria nada).
        $('#ox_key')
            .attr({ type: 'password', autocomplete: 'one-time-code', spellcheck: 'false' })
            .on('keydown', (e) => {
                if (e.key !== 'Enter') return;

                e.preventDefault();
                $('#modalOrderCancel .cs-modal-save').trigger('click');
            });
    }

    /*  Pagado: la misma cuenta que cancelSplit (core-order). Los pagos de un
        turno abierto se anulan y salen del corte; lo de turnos cerrados queda
        a favor del cliente. Lo autoriza Dueño o Supervisor con su contraseña. */
    paidCancelInfo(o, payments) {
        const undone = ordRound(payments.filter((p) => p.turn_status === 'open').reduce((sum, p) => sum + Number(p.amount), 0));
        const kept   = ordRound(Number(o.paid) - undone);
        const parts  = ['Lo autoriza Dueño o Supervisor.'];

        if (undone > 0) parts.push(`Los pagos del turno abierto (${money(undone)}) se anulan y salen del corte: devuélvelos al cliente.`);
        if (kept > 0)   parts.push(`Lo cobrado en turnos cerrados (${money(kept)}) queda como saldo a favor de ${o.customer || 'el cliente'}.`);

        return parts.join(' ');
    }

    // El ctrl revisa la contraseña. Si falla (data.key) la ventana sigue abierta y lo dice bajo el campo.
    async saveCancel(o, values, close) {
        if (this.saving) return;

        const reason = String(values.ox_reason || '').trim();
        const key    = String(values.ox_key || '');
        const field  = $('#ox_key');
        const wrong  = (text) => {
            field.next('p').removeClass('text-gray-400').addClass('text-red-600 font-semibold').text(text);
            field.val('').trigger('focus');
        };

        if (!reason) return this.warn('Escribe el motivo de la cancelación.');
        if (!key)    return wrong('Escribe tu contraseña para cancelar.');

        this.saving = true;

        const button = $('#modalOrderCancel .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'cancelOrder', id: o.id, reason: reason, key: key } });

        this.saving = false;
        button.prop('disabled', false);

        if (data && data.key) return wrong(data.message || 'Contraseña incorrecta.');

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se canceló el pedido', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        close();

        alert({ icon: 'success', title: data.message, timer: 1600 });

        orders.lsOrders();
        orderTurn.touch();
    }

    // Eliminar: solo root (Developer), con motivo y su contraseña.
    async remove(id) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        const data = await orderDetail.fetchOrder(id);
        if (!data) return;

        const o = data.order;

        if (!data.can || !data.can.delete) {
            alert({ icon: 'info', title: 'No se puede eliminar', text: (data.can && data.can.delete_reason) || '', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        this.csModal({
            id:         'modalOrderRemove',
            title:      `Eliminar pedido #P${o.folio || o.id}`,
            subtitle:   `${o.customer || 'Sin cliente'} · Total ${money(o.total)}`,
            lucideIcon: 'trash-2',
            width:      'max-w-lg',
            saveText:   'Eliminar pedido',
            cancelText: 'Volver',
            info:       'Es permanente: el pedido sale de la lista y no se puede recuperar.',
            json: [
                { id: 'od_reason', lbl: 'Motivo de la eliminación', tipo: 'textarea', required: true, maxlength: 255, rows: 3, ph: 'Ej. Pedido capturado por error', class: 'w-full' },
                { id: 'od_key', lbl: 'Tu contraseña', tipo: 'text', required: true, class: 'w-full', help: 'La misma con la que entras a Huubie.' }
            ],
            onSave: (values, close) => this.saveRemove(o, values, close)
        });

        // Mismo trato que en cancelar: campo de texto que se oculta y no se autorrellena.
        $('#od_key')
            .attr({ type: 'password', autocomplete: 'one-time-code', spellcheck: 'false' })
            .on('keydown', (e) => {
                if (e.key !== 'Enter') return;

                e.preventDefault();
                $('#modalOrderRemove .cs-modal-save').trigger('click');
            });
    }

    async saveRemove(o, values, close) {
        if (this.saving) return;

        const reason = String(values.od_reason || '').trim();
        const key    = String(values.od_key || '');
        const field  = $('#od_key');
        const wrong  = (text) => {
            field.next('p').removeClass('text-gray-400').addClass('text-red-600 font-semibold').text(text);
            field.val('').trigger('focus');
        };

        if (reason.length < 5) return this.warn('Escribe el motivo de la eliminación (mínimo 5 caracteres).');
        if (!key)              return wrong('Escribe tu contraseña para eliminar.');

        this.saving = true;

        const button = $('#modalOrderRemove .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'deleteOrder', id: o.id, reason: reason, key: key } });

        this.saving = false;
        button.prop('disabled', false);

        if (data && data.key) return wrong(data.message || 'Contraseña incorrecta.');

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se eliminó el pedido', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        close();

        alert({ icon: 'success', title: data.message, timer: 1600 });

        orders.lsOrders();
        orderTurn.touch();
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
