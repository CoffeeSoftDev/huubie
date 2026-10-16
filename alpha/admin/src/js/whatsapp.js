const WA_UI = {
    card:        'w-full',
    btnPrimary:  'inline-flex items-center justify-center gap-[5px] rounded-md bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold px-[12px] py-[6px] transition-colors',
    btnGhost:    'inline-flex items-center justify-center gap-[5px] rounded-md border-[1px] border-[#334155] text-gray-300 hover:border-[#7C3AED] hover:text-[#A78BFA] text-xs font-medium px-[12px] py-[6px] transition-colors',
    formPrimary: '!bg-[#7C3AED] hover:!bg-[#6D28D9] !border-0 !py-[6px] !text-xs w-full',
    formGhost:   '!bg-[#374151] hover:!bg-[#4B5563] !border-0 !text-gray-100 hover:!text-white !py-[6px] !text-xs w-full',
    formWhatsApp: '!bg-[#25D366] hover:!bg-[#128C7E] !border-0 !text-white !py-[6px] !text-xs w-full',
    kpiLine:     '[&>div]:border-[1px] [&>div]:border-[#475569] [&>div]:!bg-[#283341] [&>div]:!shadow-none',
    formField:   '!py-[5px] !text-[13px]',
    tokenAddon:  'inline-flex items-center justify-center px-[10px] rounded-r-lg border-[1px] border-l-0 border-[#334155] bg-[#1F2A37] text-gray-400 hover:text-white cursor-pointer',
    tones: {
        green: '#10B981',
        red:   '#EF4444',
        amber: '#F59E0B',
        gray:  '#6B7280'
    }
};

// -- WhatsApp --
class WhatsApp extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "WhatsApp";
        this.config       = null;
        this.provider     = 'ultramsg';
        this.templateType = 'cierre';
        this.preview      = null;
        this.historyLogs  = [];
    }

    // -- Interface --

    async render() {
        this.layout();

        const request = await this.lsConfig();

        if (!this.isOk(request)) {
            this.emptyState({
                parent: `tabs${this.PROJECT_NAME}`,
                icon:   'alert-triangle',
                title:  'No se pudo abrir la configuración de WhatsApp',
                text:   this.errorText(request, 'Revisa tu conexión y vuelve a intentarlo.')
            });
            return;
        }

        this.config   = request;
        this.provider = request.proveedor || 'ultramsg';

        this.renderTabs();
        this.renderProvider();
    }

    layout() {
        this.createLayout({
            parent: 'container-tab-whatsapp',
            design: false,
            data: {
                id:    this.PROJECT_NAME,
                class: 'w-full',
                container: [
                    {
                        type:  'div',
                        id:    `tabs${this.PROJECT_NAME}`,
                        class: 'w-full'
                    }
                ]
            }
        });
    }

    // La pildora vive junto al titulo de la pestaña Proveedor: si esa pestaña no
    // esta pintada no hay donde ponerla.
    renderStatus() {
        if (!$(`#status${this.PROJECT_NAME}`).length) return;

        const active = this.config.proveedor;
        const state  = active
            ? this.providerState(active)
            : {
                tone:  'gray',
                label: 'Sin proveedor activo',
                ok:    false
            };

        const color = WA_UI.tones[state.tone];
        const text  = active
            ? `${this.providerName(active)} · ${state.ok ? 'Conectada' : state.label}`
            : state.label;

        this.createLayout({
            parent: `status${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `statusPill${this.PROJECT_NAME}`,
                class: 'inline-flex items-center gap-[6px] rounded-md px-[8px] py-[3px]',
                container: [
                    {
                        type:  'span',
                        class: 'inline-block w-1.5 h-1.5 rounded-full',
                        css: {
                            background: color,
                            boxShadow:  `0 0 5px ${color}`
                        }
                    },
                    {
                        type:  'span',
                        class: 'text-[11px] font-semibold',
                        css: {
                            color: color
                        },
                        text: text
                    }
                ]
            }
        });

        $(`#statusPill${this.PROJECT_NAME}`).css('background', `${color}1F`);
    }

    renderTabs() {
        this.tabLayout({
            parent:     `tabs${this.PROJECT_NAME}`,
            id:         `tabsContent${this.PROJECT_NAME}`,
            theme:      'dark',
            type:       'short',
            showBorder: false,
            json: [
                {
                    id:         'wa-proveedor',
                    tab:        'Proveedor',
                    lucideIcon: 'package',
                    iconColor:  'text-white',
                    active:     true,
                    onClick:    () => this.renderProvider()
                },
                {
                    id:         'wa-destinatarios',
                    tab:        'Destinatarios',
                    lucideIcon: 'contact',
                    iconColor:  'text-white',
                    onClick:    () => this.renderRecipients()
                },
                {
                    id:         'wa-credenciales',
                    tab:        'Credenciales API',
                    lucideIcon: 'key-round',
                    iconColor:  'text-white',
                    onClick:    () => this.renderCredentials()
                },
                {
                    id:         'wa-plantillas',
                    tab:        'Plantillas',
                    lucideIcon: 'layout-template',
                    iconColor:  'text-white',
                    onClick:    () => this.renderTemplates()
                },
                {
                    id:         'wa-historial',
                    tab:        'Historial',
                    lucideIcon: 'history',
                    iconColor:  'text-white',
                    onClick:    () => this.renderHistory()
                }
            ]
        });
    }

    renderProvider() {
        this.createLayout({
            parent: 'container-wa-proveedor',
            design: false,
            data: {
                id:    'waProviderPanel',
                class: 'flex flex-col gap-[10px]',
                container: [
                    {
                        type:  'div',
                        id:    'waProviderCard',
                        class: WA_UI.card
                    },
                    {
                        type:  'div',
                        id:    'waProviderBar',
                        class: 'w-full'
                    }
                ]
            }
        });

        this.createLayout({
            parent: 'waProviderCard',
            design: false,
            data: {
                id:    'waProviderBody',
                class: 'flex flex-col gap-[10px]',
                container: [
                    {
                        type:  'div',
                        id:    'waProviderTitle',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waProviderCards',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waCompareTitle',
                        class: 'w-full pt-[10px] border-t-[1px] border-[#334155]'
                    },
                    {
                        type:  'div',
                        id:    'waCompareTable',
                        class: 'w-full overflow-x-auto'
                    }
                ]
            }
        });

        this.createLayout({
            parent: 'waProviderTitle',
            design: false,
            data: {
                id:    'waProviderHeading',
                class: 'flex flex-col sm:flex-row sm:items-start justify-between gap-[12px]',
                container: [
                    {
                        type:  'div',
                        id:    'waProviderHeadingText',
                        class: 'min-w-0'
                    },
                    {
                        type:  'div',
                        id:    `status${this.PROJECT_NAME}`,
                        class: 'shrink-0'
                    }
                ]
            }
        });

        this.sectionTitle({
            parent: 'waProviderHeadingText',
            icon:   'package',
            title:  'Proveedor de WhatsApp',
            text:   'Selecciona qué servicio API enviará los mensajes. Solo uno puede estar activo a la vez.'
        });

        this.renderStatus();
        this.renderProviderCards();

        this.sectionTitle({
            parent: 'waCompareTitle',
            icon:   'list',
            color:  '#9CA3AF',
            title:  'Comparativa'
        });

        this.createCoffeTable({
            parent: 'waCompareTable',
            id:     'tbWaCompare',
            theme:  'dark',
            f_size: 12,
            data:   this.compareData()
        });

        this.saveBar({
            parent: 'waProviderBar',
            icon:   'alert-triangle',
            text:   'Cambiar de proveedor requiere sus credenciales: captúralas en «Credenciales API» si es la primera vez que lo usas.',
            actions: [
                {
                    id:      'btnWaSaveProvider',
                    icon:    'check',
                    text:    'Guardar proveedor',
                    onClick: () => this.saveProvider()
                }
            ]
        });
    }

    renderProviderCards() {
        this.selectCards({
            parent:   'waProviderCards',
            id:       'waProviders',
            class:    'grid grid-cols-2 md:grid-cols-4 gap-[8px]',
            theme:    'dark',
            size:     'sm',
            selected: this.provider,
            json: [
                {
                    id:       'ultramsg',
                    title:    'UltraMsg',
                    subtitle: 'API REST · ultramsg.com',
                    logo:     'UM',
                    color:    this.providerColor('ultramsg'),
                    badge:    this.providerBadge('ultramsg'),
                    status:   this.providerStatus('ultramsg'),
                    features: [
                        'Números formato <code class="text-[#A78BFA]">+52XXXXXXXXXX</code>',
                        'Instancia + Token (2 credenciales)',
                        'Soporta grupos (<code class="text-gray-300">@g.us</code>)',
                        'Envía texto y archivos'
                    ]
                },
                {
                    id:       'greenapi',
                    title:    'Green API',
                    subtitle: 'API REST · green-api.com',
                    logo:     'GA',
                    color:    this.providerColor('greenapi'),
                    badge:    this.providerBadge('greenapi'),
                    status:   this.providerStatus('greenapi'),
                    features: [
                        'Números formato <code class="text-[#4ADE80]">521XXXXXXXXXX@c.us</code>',
                        'Instancia + Token + URL (3 credenciales)',
                        'Soporta grupos (<code class="text-gray-300">@g.us</code>)',
                        'Verificación de estado de instancia'
                    ]
                }
            ],
            onSelect: (id) => this.selectProvider(id)
        });
    }

    renderRecipients() {
        this.createLayout({
            parent: 'container-wa-destinatarios',
            design: false,
            data: {
                id:    'waRecipientsPanel',
                class: 'flex flex-col gap-[10px]',
                container: [
                    {
                        type:  'div',
                        id:    'waRecipientsGrid',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waRecipientsBar',
                        class: 'w-full'
                    }
                ]
            }
        });

        this.createLayout({
            parent: 'waRecipientsGrid',
            design: false,
            data: {
                id:    'waRecipientsCards',
                class: 'grid grid-cols-1 lg:grid-cols-2 gap-[10px]',
                container: this.noticeTypes().map(notice => ({
                    type:  'div',
                    id:    `waCard-${notice.id}`,
                    class: 'min-w-0'
                }))
            }
        });

        this.noticeTypes().forEach(notice => this.renderRecipientCard(notice.id));

        this.saveBar({
            parent: 'waRecipientsBar',
            icon:   'info',
            text:   'Cada cambio se guarda al momento y surte efecto en el siguiente envío. Pausar un número no lo borra.'
        });
    }

    renderRecipientCard(type) {
        const notice     = this.noticeTypes().find(item => item.id === type);
        const template   = this.config.plantillas[type];
        const recipients = this.config.destinatarios.filter(item => item.tipo === type);

        this.listCard({
            parent:    `waCard-${type}`,
            id:        `waList-${type}`,
            theme:     'dark',
            icon:      notice.icon,
            color:     notice.color,
            title:     notice.title,
            subtitle:  notice.subtitle,
            label:     'Destinatarios',
            addText:   'Agregar número',
            emptyText: 'Nadie recibe este aviso todavía',
            note:      notice.note,
            footnote:  'Puedes agregar números de 10 dígitos o IDs de grupo (…@g.us)',
            toggle: {
                checked: Number(template.activo) === 1,
                title:   'Activar o pausar este aviso'
            },
            json: recipients.map(item => ({
                id:       item.id,
                title:    item.nombre,
                subtitle: this.formatPhone(item.telefono),
                initials: item.nombre.charAt(0).toUpperCase(),
                badge:    Number(item.activo) === 1
                    ? {
                        text: 'Activo',
                        type: 'success'
                    }
                    : {
                        text: 'Pausado',
                        type: 'danger'
                    },
                switch: {
                    checked: Number(item.activo) === 1,
                    title:   Number(item.activo) === 1 ? 'Pausar este número' : 'Reactivar este número'
                }
            })),
            onToggle: (checked) => this.toggleNotice(type, checked),
            onSwitch: (id, checked) => this.statusDestinatario(id, checked),
            onAdd:    () => this.addDestinatario(type),
            onEdit:   (id) => this.editDestinatario(id),
            onDelete: (id) => this.deleteDestinatario(id)
        });
    }

    renderCredentials() {
        const provider = this.provider;
        const name     = this.providerName(provider);
        const isActive = provider === this.config.proveedor;

        this.createLayout({
            parent: 'container-wa-credenciales',
            design: false,
            data: {
                id:    'waCredGrid',
                class: 'grid grid-cols-1 lg:grid-cols-3 gap-[16px]',
                container: [
                    {
                        type:  'div',
                        id:    'waCredCard',
                        class: `${WA_UI.card} lg:col-span-2 min-w-0`
                    },
                    {
                        type:  'div',
                        id:    'waCredHelp',
                        class: `${WA_UI.card} lg:border-l-[1px] lg:border-[#334155] lg:pl-[16px]`
                    }
                ]
            }
        });

        this.createLayout({
            parent: 'waCredCard',
            design: false,
            data: {
                id:    'waCredBody',
                class: 'flex flex-col gap-[10px]',
                container: [
                    {
                        type:  'div',
                        id:    'waCredTitle',
                        class: 'w-full'
                    },
                    {
                        type:  'p',
                        class: 'text-xs text-gray-400 m-0',
                        html:  this.consoleHint(provider)
                    },
                    {
                        type:  'div',
                        id:    'waCredForm',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waCredConn',
                        class: 'w-full pt-[10px] border-t-[1px] border-[#334155]'
                    },
                    {
                        type:  'div',
                        id:    'waCredSend',
                        class: 'w-full pt-[10px] border-t-[1px] border-[#334155]'
                    }
                ]
            }
        });

        this.sectionTitle({
            parent: 'waCredTitle',
            icon:   'key-round',
            color:  this.providerColor(provider),
            title:  `Credenciales de ${name}`,
            text:   isActive
                ? 'Configuración activa: los avisos salen por este proveedor.'
                : 'Seleccionado en «Proveedor»: se activa al guardar sus credenciales.'
        });

        this.createForm({
            parent:     'waCredForm',
            id:         'formWaCredentials',
            coffeesoft: true,
            theme:      'dark',
            data: {
                opc:       'saveWaProvider',
                proveedor: provider,
                api_url:   ''
            },
            json: [
                ...this.jsonCredentials(provider),
                {
                    opc:       'button',
                    id:        'btnWaTest',
                    text:      'Probar conexión',
                    className: WA_UI.formGhost,
                    onClick:   () => this.testConnection(),
                    class:     'col-12 col-sm-6'
                },
                {
                    opc:       'btn-submit',
                    id:        'btnWaSaveCredentials',
                    text:      'Guardar credenciales',
                    className: WA_UI.formPrimary,
                    class:     'col-12 col-sm-6'
                }
            ],
            success: (request) => this.onCredentialsSaved(request)
        });

        $('#formWaCredentials').find('input').addClass(WA_UI.formField);
        this.bindTokenToggle();

        this.createLayout({
            parent: 'waCredConn',
            design: false,
            data: {
                id:    'waConnBody',
                class: 'flex flex-col gap-[8px]',
                container: [
                    {
                        type:  'div',
                        id:    'waConnTitle',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waConnKpis',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waConnResult',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waConnStates',
                        class: 'w-full overflow-x-auto'
                    }
                ]
            }
        });

        this.sectionTitle({
            parent: 'waConnTitle',
            icon:   'activity',
            title:  'Estado de la conexión',
            text:   '«Probar conexión» consulta al proveedor con las llaves que están en pantalla, guardadas o no.'
        });

        this.renderConnection();
        this.renderTestMessage();
        this.renderHelp();
    }

    renderTestMessage() {
        const recipient = this.config.destinatarios.find(item => Number(item.activo) === 1);

        this.createLayout({
            parent: 'waCredSend',
            design: false,
            data: {
                id:    'waSendBody',
                class: 'flex flex-col gap-[8px]',
                container: [
                    {
                        type:  'div',
                        id:    'waSendTitle',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waSendForm',
                        class: 'w-full'
                    }
                ]
            }
        });

        this.sectionTitle({
            parent: 'waSendTitle',
            icon:   'send',
            color:  '#25D366',
            title:  'Mensaje de prueba',
            text:   'Envía un WhatsApp real con las llaves que están en pantalla. Queda en el Historial como «Mensaje de prueba».'
        });

        // Sin <form>: Enter no debe disparar un envío sin pasar por sendTest().
        this.coffeeForm({
            parent:  'waSendForm',
            id:      'formWaSend',
            Element: 'div',
            theme:   'dark',
            json: [
                {
                    opc:         'input',
                    lbl:         'Número de destino',
                    id:          'waSendPhone',
                    name:        'telefono',
                    placeholder: '9621501886 o ID de grupo …@g.us',
                    value:       recipient ? recipient.telefono : '',
                    class:       'col-12 col-sm-4'
                },
                {
                    opc:         'input',
                    lbl:         'Mensaje',
                    id:          'waSendMessage',
                    name:        'mensaje',
                    value:       `Mensaje de prueba de ${nameCompany}: si te llegó, los avisos de WhatsApp ya funcionan.`,
                    class:       'col-12 col-sm-8'
                },
                {
                    opc:       'button',
                    id:        'btnWaSend',
                    text:      'Enviar mensaje de prueba',
                    className: WA_UI.formWhatsApp,
                    onClick:   () => this.sendTest(),
                    class:     'col-12 col-sm-4 offset-sm-8'
                }
            ]
        });

        $('#formWaSend').find('input').addClass(WA_UI.formField);
    }

    renderConnection() {
        const creds = this.config.proveedores[this.provider];
        const state = this.providerState(this.provider);

        this.cardsDashboard({
            parent: 'waConnKpis',
            id:     'waConnCards',
            theme:  'dark',
            size:   'sm',
            class:  WA_UI.kpiLine,
            json: [
                {
                    title: 'Proveedor',
                    data: {
                        value: this.providerName(this.provider),
                        color: 'text-white'
                    }
                },
                {
                    title: 'Instancia',
                    data: {
                        value: state.label,
                        color: this.toneText(state.tone)
                    }
                },
                {
                    title: 'Última verificación',
                    data: {
                        value: creds.verificado || 'Sin probar',
                        color: 'text-white'
                    }
                },
                {
                    title: 'Mensajes hoy',
                    data: {
                        value: `${this.config.enviadosHoy} enviados`,
                        color: 'text-white'
                    }
                }
            ]
        });

        if (this.provider !== 'greenapi') {
            $('#waConnStates').empty();
            return;
        }

        this.createLayout({
            parent: 'waConnStates',
            design: false,
            data: {
                id:    'waConnStatesBody',
                class: 'flex flex-col gap-[6px]',
                container: [
                    {
                        type:  'p',
                        class: 'text-[11px] font-semibold text-gray-400 m-0',
                        text:  'Estados posibles de la instancia (getStateInstance)'
                    },
                    {
                        type:  'div',
                        id:    'waConnStatesTable',
                        class: 'w-full'
                    }
                ]
            }
        });

        this.createCoffeTable({
            parent: 'waConnStatesTable',
            id:     'tbWaStates',
            theme:  'dark',
            f_size: 12,
            data: {
                thead: ['Estado', 'Qué hacer'],
                row:   ['authorized', 'notAuthorized', 'starting', 'sleepMode', 'suspended', 'blocked'].map((code, index) => {
                    const info  = this.stateInfo(code);
                    const color = WA_UI.tones[info.tone];

                    return {
                        id: index + 1,
                        estado: {
                            html:  `<span class="inline-flex items-center gap-[8px] font-semibold text-white"><span class="inline-block w-2 h-2 rounded-full" style="background:${color};box-shadow:0 0 6px ${color}"></span>${code}</span>`,
                            class: 'px-[10px] py-[5px] whitespace-nowrap'
                        },
                        remedio: {
                            html:  info.text,
                            class: 'px-[10px] py-[5px] whitespace-normal text-gray-300'
                        }
                    };
                })
            }
        });
    }

    renderTestResult(result) {
        const info  = this.stateInfo(result.estado);
        const color = WA_UI.tones[info.tone];
        const text  = result.detalle ? `${result.detalle} ${info.text}` : info.text;

        this.createLayout({
            parent: 'waConnResult',
            design: false,
            data: {
                id:    'waConnResultBox',
                class: 'flex items-start gap-[8px] rounded-lg border-[1px] px-[10px] py-[8px]',
                container: [
                    {
                        type:  'span',
                        class: 'shrink-0 mt-[1px]',
                        css: {
                            color: color
                        },
                        html: lucideIcon(info.ok ? 'circle-check' : 'alert-triangle', 'w-4 h-4')
                    },
                    {
                        type:  'div',
                        class: 'min-w-0',
                        children: [
                            {
                                type:  'p',
                                class: 'text-xs font-semibold m-0',
                                css: {
                                    color: color
                                },
                                text: `${this.providerName(result.proveedor)} · ${info.label} · ${result.verificado}`
                            },
                            {
                                type:  'p',
                                class: 'text-[11px] text-gray-300 m-0 mt-[1px]',
                                text:  text
                            }
                        ]
                    }
                ]
            }
        });

        $('#waConnResultBox').css({
            background:  `${color}14`,
            borderColor: `${color}66`
        });
    }

    renderHelp() {
        const name    = this.providerName(this.provider);
        const isGreen = this.provider === 'greenapi';

        const steps = [
            `${name} conecta un WhatsApp normal por QR y envía los mensajes por API REST.`,
            'Cada vez que se cierra un Corte Z, un Corte X, se termina un pedido o se edita uno ya avisado, el sistema arma el resumen con su plantilla y lo envía solo.',
            'Si la API falla, el cierre no se ve afectado: el error queda en el Historial.',
            isGreen
                ? 'El token viaja dentro de la URL del request; por eso esa URL nunca se escribe en los logs.'
                : 'El token es la llave de la instancia: no lo compartas fuera de este panel.'
        ];

        this.createLayout({
            parent: 'waCredHelp',
            design: false,
            data: {
                id:    'waCredHelpBody',
                class: 'flex flex-col gap-[8px]',
                container: [
                    {
                        type:  'div',
                        id:    'waHelpTitle',
                        class: 'w-full'
                    },
                    ...steps.map((step, index) => ({
                        type:  'div',
                        class: 'flex gap-[6px] text-xs text-gray-400',
                        children: [
                            {
                                type:  'span',
                                class: 'shrink-0 w-4 h-4 rounded-full grid place-items-center text-[10px] font-bold bg-[#7C3AED]/15 text-[#A78BFA]',
                                text:  index + 1
                            },
                            {
                                type:  'p',
                                class: 'm-0',
                                text:  step
                            }
                        ]
                    })),
                    {
                        type:   'a',
                        href:   isGreen ? 'https://console.green-api.com' : 'https://user.ultramsg.com',
                        target: '_blank',
                        rel:    'noopener',
                        class:  'flex items-center justify-between gap-[8px] mt-[2px] px-[10px] py-[7px] rounded-lg bg-[#1F2A37] border-[1px] border-[#334155] hover:border-[#7C3AED] text-xs font-medium text-white no-underline',
                        html:   `<span>Consola de ${name}</span>${lucideIcon('external-link', 'w-3.5 h-3.5 text-gray-400')}`
                    }
                ]
            }
        });

        this.sectionTitle({
            parent: 'waHelpTitle',
            icon:   'info',
            color:  '#25D366',
            title:  '¿Cómo funciona?'
        });
    }

    renderTemplates() {
        this.createLayout({
            parent: 'container-wa-plantillas',
            design: false,
            data: {
                id:    'waTplGrid',
                class: 'grid grid-cols-1 lg:grid-cols-2 gap-[16px]',
                container: [
                    {
                        type:  'div',
                        id:    'waTplEditor',
                        class: `${WA_UI.card} min-w-0`
                    },
                    {
                        type:  'div',
                        id:    'waTplPreview',
                        class: `${WA_UI.card} min-w-0 lg:border-l-[1px] lg:border-[#334155] lg:pl-[16px]`
                    }
                ]
            }
        });

        this.createLayout({
            parent: 'waTplEditor',
            design: false,
            data: {
                id:    'waTplEditorBody',
                class: 'flex flex-col gap-[8px]',
                container: [
                    {
                        type:  'div',
                        id:    'waTplTabs',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waTplFormats',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waTplForm',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waTplVars',
                        class: 'w-full'
                    }
                ]
            }
        });

        this.createLayout({
            parent: 'waTplPreview',
            design: false,
            data: {
                id:    'waTplPreviewBody',
                class: 'flex flex-col gap-[10px]',
                container: [
                    {
                        type:  'div',
                        id:    'waTplPreviewTitle',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waTplPreviewMode',
                        class: 'w-full flex justify-center'
                    },
                    {
                        type:  'div',
                        id:    'waTplPhone',
                        class: 'w-full'
                    }
                ]
            }
        });

        this.sectionTitle({
            parent: 'waTplPreviewTitle',
            icon:   'smartphone',
            color:  '#25D366',
            title:  'Vista previa',
            text:   'Así se verá el mensaje en WhatsApp, con datos de ejemplo.'
        });

        this.tabLayout({
            parent:          'waTplTabs',
            id:              'tabsWaTemplates',
            theme:           'dark',
            type:            'short',
            renderContainer: false,
            json: this.noticeTypes().map(notice => ({
                id:         `tpl-${notice.id}`,
                tab:        notice.short,
                lucideIcon: notice.icon,
                iconColor:  'text-white',
                active:     notice.id === this.templateType,
                onClick:    () => {
                    this.templateType = notice.id;
                    this.renderTemplateEditor();
                }
            }))
        });

        this.renderTemplateEditor();
    }

    renderTemplateEditor() {
        const type     = this.templateType;
        const template = this.config.plantillas[type];

        this.createForm({
            parent:     'waTplForm',
            id:         'formWaTemplate',
            coffeesoft: true,
            theme:      'dark',
            data: {
                opc:    'saveWaPlantilla',
                tipo:   type,
                activo: template.activo
            },
            json: [
                {
                    opc:      'textarea',
                    lbl:      'Plantilla del mensaje',
                    id:       'waBody',
                    name:     'cuerpo',
                    rows:     10,
                    value:    template.cuerpo,
                    required: true,
                    class:    'col-12'
                },
                {
                    opc:       'button',
                    id:        'btnWaRestore',
                    text:      'Restaurar default',
                    className: WA_UI.formGhost,
                    onClick:   () => this.restoreTemplate(),
                    class:     'col-12 col-sm-6'
                },
                {
                    opc:       'btn-submit',
                    id:        'btnWaSaveTemplate',
                    text:      'Guardar plantilla',
                    className: WA_UI.formPrimary,
                    class:     'col-12 col-sm-6'
                }
            ],
            success: (request) => this.onTemplateSaved(type, request)
        });

        $('#waBody')
            .addClass('font-mono !text-[12px] !py-[6px] leading-snug')
            .css({ resize: 'none', overflow: 'hidden', minHeight: '220px' });

        this.renderTemplateFormats();
        this.renderTemplateVars();
        this.renderPreviewMode();

        this.preview = this.chatPreview({
            parent: 'waTplPhone',
            id:     'waPhone',
            name:   nameCompany,
            theme:  'light',
            image:  !!this.previewImage,
            text:   this.fillTemplate(template.cuerpo)
        });

        $('#waBody').on('input', () => {
            this.autoGrowBody();
            this.preview.update(this.fillTemplate($('#waBody').val()));
        });

        $(window).off('resize.waBody').on('resize.waBody', () => this.autoGrowBody());
        this.autoGrowBody();
    }

    autoGrowBody() {
        const field = document.getElementById('waBody');
        if (!field) return;

        field.style.height = 'auto';
        field.style.height = `${field.scrollHeight + 2}px`;
    }

    renderPreviewMode() {
        const modes = [
            { id: 'text',  label: 'Solo texto', image: false },
            { id: 'photo', label: 'Con foto',   image: true }
        ];

        this.createLayout({
            parent: 'waTplPreviewMode',
            design: false,
            data: {
                id:    'waTplModeBtns',
                class: 'inline-flex rounded-lg bg-[#111827] p-[3px] gap-[2px]',
                container: modes.map(mode => ({
                    type:  'button',
                    id:    `waMode-${mode.id}`,
                    class: `text-[11px] px-[10px] py-[3px] rounded-md transition-colors ${mode.image === !!this.previewImage ? 'bg-[#7C3AED] text-white' : 'text-gray-400 hover:text-white'}`,
                    text:  mode.label,
                    click: () => {
                        this.previewImage = mode.image;
                        modes.forEach(item => $(`#waMode-${item.id}`)
                            .toggleClass('bg-[#7C3AED] text-white', item.image === mode.image)
                            .toggleClass('text-gray-400 hover:text-white', item.image !== mode.image));
                        this.preview.setImage(mode.image);
                    }
                }))
            }
        });
    }

    renderTemplateFormats() {
        const formats = [
            { label: 'B',    cls: 'font-bold',          tip: 'Negrita · *texto*',               mark: '*',   kind: 'wrap' },
            { label: 'I',    cls: 'italic',             tip: 'Cursiva · _texto_',               mark: '_',   kind: 'wrap' },
            { label: 'S',    cls: 'line-through',       tip: 'Tachado · ~texto~',               mark: '~',   kind: 'wrap' },
            { label: '</>',  cls: 'font-mono',          tip: 'Monoespaciado · ```texto```',     mark: '```', kind: 'wrap' },
            { label: '`x`',  cls: 'font-mono',          tip: 'Código en línea · `texto`',       mark: '`',   kind: 'wrap' },
            { label: '• Lista',    cls: '',             tip: 'Lista · * al inicio del renglón', prefix: '* ',  kind: 'line' },
            { label: '1. Lista',   cls: '',             tip: 'Lista numerada · 1. al inicio',   prefix: '1. ', kind: 'line' },
            { label: '❝ Cita',     cls: '',             tip: 'Cita · > al inicio del renglón',  prefix: '> ',  kind: 'line' }
        ];

        this.createLayout({
            parent: 'waTplFormats',
            design: false,
            data: {
                id:    'waTplFormatBody',
                class: 'flex flex-col gap-[6px]',
                container: [
                    {
                        type:  'p',
                        class: 'text-xs text-gray-400 m-0',
                        text:  'Formato de WhatsApp · aplica a lo seleccionado o al renglón del cursor:'
                    },
                    {
                        type:  'div',
                        id:    'waTplFormatChips',
                        class: 'flex flex-wrap gap-[6px]',
                        children: formats.map(format => ({
                            type:  'button',
                            class: `text-[11px] px-[8px] py-[2px] rounded bg-[#25D366]/15 text-[#4ADE80] hover:bg-[#25D366]/30 transition-colors ${format.cls}`,
                            attr:  { title: format.tip, type: 'button' },
                            text:  format.label,
                            click: () => this.applyFormat(format)
                        }))
                    }
                ]
            }
        });
    }

    applyFormat(format) {
        const field = document.getElementById('waBody');
        if (!field) return;

        let start = field.selectionStart;
        let end   = field.selectionEnd;
        const value = field.value;

        let result, from, to;

        if (format.kind === 'wrap') {
            const selected = value.slice(start, end);
            result = value.slice(0, start) + format.mark + selected + format.mark + value.slice(end);
            from   = start + format.mark.length;
            to     = from + selected.length;
        } else {
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const lineEnd   = value.indexOf('\n', end) === -1 ? value.length : value.indexOf('\n', end);
            const lines     = value.slice(lineStart, lineEnd).split('\n');
            const numbered  = format.prefix === '1. ';
            const marked    = lines.map((line, index) => (numbered ? `${index + 1}. ` : format.prefix) + line).join('\n');

            result = value.slice(0, lineStart) + marked + value.slice(lineEnd);
            from   = lineStart;
            to     = lineStart + marked.length;
        }

        field.value = result;
        field.focus();
        field.setSelectionRange(from, to);

        $(field).trigger('input');
    }

    renderTemplateVars() {
        this.createLayout({
            parent: 'waTplVars',
            design: false,
            data: {
                id:    'waTplVarsBody',
                class: 'flex flex-col gap-[6px]',
                container: [
                    {
                        type:  'p',
                        class: 'text-xs text-gray-400 m-0',
                        text:  'Variables disponibles · clic para insertarla donde está el cursor:'
                    },
                    {
                        type:  'div',
                        id:    'waTplVarList',
                        class: 'w-full'
                    }
                ]
            }
        });

        this.createLayout({
            parent: 'waTplVarList',
            design: false,
            data: {
                id:    'waTplVarChips',
                class: 'flex flex-wrap gap-[6px]',
                container: this.templateVars(this.templateType).map(variable => ({
                    type:  'button',
                    class: 'font-mono text-[11px] px-[6px] py-[1px] rounded bg-[#7C3AED]/15 text-[#A78BFA] hover:bg-[#7C3AED]/30 transition-colors',
                    attr: {
                        title: `Ejemplo: ${variable.sample}`
                    },
                    text: `{${variable.key}}`,
                    click: () => this.insertVariable(`{${variable.key}}`)
                }))
            }
        });
    }

    renderHistory() {
        this.createLayout({
            parent: 'container-wa-historial',
            design: false,
            data: {
                id:    'waHistCard',
                class: `${WA_UI.card} flex flex-col gap-[10px]`,
                container: [
                    {
                        type:  'div',
                        id:    'waHistHead',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waHistKpis',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waHistLimit',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'waHistTable',
                        class: 'w-full'
                    }
                ]
            }
        });

        this.createLayout({
            parent: 'waHistHead',
            design: false,
            data: {
                id:    'waHistHeadRow',
                class: 'flex flex-col md:flex-row md:flex-wrap md:items-end justify-between gap-[12px]',
                container: [
                    {
                        type:  'div',
                        id:    'waHistTitle',
                        class: 'min-w-0 md:flex-1'
                    },
                    {
                        type:  'div',
                        id:    'waHistPeriod',
                        class: 'w-full md:w-[340px]'
                    },
                    {
                        type:  'div',
                        id:    'filterBarWaHistorial',
                        class: 'w-full md:w-[460px]'
                    }
                ]
            }
        });

        this.sectionTitle({
            parent: 'waHistTitle',
            icon:   'activity',
            title:  'Historial de envíos',
            text:   'Cargando…',
            textId: 'waHistSubtitle'
        });

        this.histMode = 'rango';
        this.periodBox();

        this.createfilterBar({
            parent: 'filterBarWaHistorial',
            data: [
                {
                    opc:      'select',
                    id:       'waFilterTipo',
                    class:    'col-12 col-sm-7',
                    onchange: 'whatsapp.lsHistorial()',
                    data: [
                        {
                            id:    '',
                            valor: 'Todos los avisos'
                        },
                        {
                            id:    'cierre',
                            valor: 'Cierre Diario'
                        },
                        {
                            id:    'turno',
                            valor: 'Cierre de Turno'
                        },
                        {
                            id:    'personalizado',
                            valor: 'Pedidos'
                        },
                        {
                            id:    'edicion',
                            valor: 'Pedido editado'
                        }
                    ]
                },
                {
                    opc:       'button',
                    id:        'btnWaExport',
                    text:      'Exportar',
                    color_btn: 'outline-secondary',
                    className: 'w-full btn-sm',
                    class:     'col-12 col-sm-5',
                    onClick:   () => this.exportHistorial()
                }
            ]
        });

        // content_json_form deja una <label> vacía y un mt-4 en el botón: sin etiqueta sobran.
        $('#waFilterTipo').addClass('form-select-sm').siblings('label').remove();
        $('#btnWaExport').removeClass('mt-4').siblings('label').remove();

        this.lsHistorial();
    }

    periodBox() {
        const radio = (value, text) => ({
            type:  'label',
            class: 'flex items-center gap-[4px] text-[12px] text-gray-200 cursor-pointer whitespace-nowrap m-0',
            html:  `<input type="radio" name="waHistMode" value="${value}" class="m-0" style="accent-color:#7C3AED" ${this.histMode === value ? 'checked' : ''} onchange="whatsapp.setHistPeriod('${value}')"> ${text}`
        });
        const input = (id) => ({
            type:  'input',
            id:    id,
            class: 'flex-1 min-w-0 w-full bg-transparent text-white text-[12px] border-0 outline-none p-0 m-0'
        });

        this.createLayout({
            parent: 'waHistPeriod',
            design: false,
            data: {
                id:    'waHistPeriodBox',
                class: 'flex items-center gap-[8px] h-[31px] px-[10px] rounded-md border-[1px] border-[#475569] bg-[#1F2A37]',
                container: [
                    radio('fecha', 'Fecha'),
                    radio('rango', 'Rango'),
                    {
                        type:  'span',
                        class: 'shrink-0 bg-[#475569]',
                        style: 'width:1px;height:16px'
                    },
                    input('waHistFecha'),
                    input('waHistRango'),
                    {
                        type:  'span',
                        class: 'shrink-0 text-gray-400 flex items-center',
                        html:  lucideIcon('calendar', 'w-4 h-4')
                    }
                ]
            }
        });

        dataPicker({
            parent: 'waHistFecha',
            type:   'simple',
            onSelect: () => this.lsHistorial()
        });

        dataPicker({
            parent: 'waHistRango',
            type:   'all',
            rangepicker: {
                startDate:     moment().subtract(29, 'days'),
                endDate:       moment(),
                showDropdowns: true,
                ranges: {
                    'Hoy':          [moment(), moment()],
                    'Últimos 7 días': [moment().subtract(6, 'days'), moment()],
                    'Mes actual':   [moment().startOf('month'), moment()],
                    'Mes anterior': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                },
                locale: { format: 'DD-MM-YYYY' }
            },
            onSelect: () => this.lsHistorial()
        });

        this.applyHistPeriod();
    }

    applyHistPeriod() {
        $('#waHistFecha').toggle(this.histMode === 'fecha');
        $('#waHistRango').toggle(this.histMode === 'rango');
    }

    setHistPeriod(mode) {
        this.histMode = mode;
        this.applyHistPeriod();
        this.lsHistorial();
    }

    histPeriod() {
        const { fi, ff } = getDataRangePicker(this.histMode === 'fecha' ? 'waHistFecha' : 'waHistRango');
        const show       = (date) => date.split('-').reverse().join('/');

        return {
            fi,
            ff,
            label: fi === ff ? show(fi) : `${show(fi)} al ${show(ff)}`
        };
    }

    renderHistoryLimit(limit) {
        const used     = limit.hoy;
        const reached  = used >= limit.max;
        const near     = !reached && used >= limit.aviso;
        const tone     = reached ? WA_UI.tones.red : near ? WA_UI.tones.amber : WA_UI.tones.green;
        const message  = reached
            ? 'Llegaste al tope diario: los siguientes envíos pueden ser rechazados por el proveedor.'
            : near
                ? 'Te acercas al tope diario de mensajes.'
                : 'Uso del tope diario de mensajes.';

        this.createLayout({
            parent: 'waHistLimit',
            design: false,
            data: {
                id:    'waHistLimitBox',
                class: `flex items-center gap-[10px] rounded-lg border-[1px] border-[${tone}] bg-[${tone}]/10 px-[12px] py-[8px]`,
                container: [
                    {
                        type:  'span',
                        class: 'shrink-0',
                        style: `color:${tone}`,
                        html:  lucideIcon(reached || near ? 'alert-triangle' : 'activity', 'w-4 h-4')
                    },
                    {
                        type:  'p',
                        class: 'text-[12px] font-bold text-white m-0 whitespace-nowrap',
                        text:  `${used} de ${limit.max} mensajes hoy`
                    },
                    {
                        type:  'p',
                        class: 'text-[11px] text-gray-300 m-0',
                        text:  message
                    }
                ]
            }
        });
    }

    renderHistoryKpis(kpis) {
        this.cardsDashboard({
            parent: 'waHistKpis',
            id:     'waHistCards',
            theme:  'dark',
            size:   'sm',
            class:  WA_UI.kpiLine,
            json: [
                {
                    title: 'Total enviados',
                    data: {
                        value: kpis.total,
                        color: 'text-white'
                    }
                },
                {
                    title: 'Exitosos',
                    data: {
                        value: kpis.exitosos,
                        color: 'text-[#34D399]'
                    }
                },
                {
                    title: 'Fallidos',
                    data: {
                        value: kpis.fallidos,
                        color: 'text-[#F87171]'
                    }
                },
                {
                    title: 'Tasa de éxito',
                    data: {
                        value: kpis.total ? `${kpis.tasa}%` : '—',
                        color: 'text-white'
                    }
                }
            ]
        });
    }

    sectionTitle(options) {
        const opts = Object.assign({
            parent: '',
            icon:   'info',
            color:  '#A78BFA',
            size:   'base',
            title:  '',
            text:   '',
            textId: undefined
        }, options);

        const isLarge   = opts.size === 'lg';
        const container = [
            {
                type:  'p',
                class: `${isLarge ? 'text-[15px]' : 'text-[13px]'} font-bold text-white flex items-center gap-[6px] m-0`,
                html:  `<span class="shrink-0" style="color:${opts.color}">${lucideIcon(opts.icon, isLarge ? 'w-[18px] h-[18px]' : 'w-[15px] h-[15px]')}</span><span>${opts.title}</span>`
            }
        ];

        if (opts.text) {
            container.push({
                type:  'p',
                id:    opts.textId,
                class: 'text-[11px] text-gray-400 m-0 mt-[2px]',
                text:  opts.text
            });
        }

        this.createLayout({
            parent: opts.parent,
            design: false,
            data: {
                id:        `${opts.parent}Head`,
                class:     'flex flex-col',
                container: container
            }
        });
    }

    saveBar(options) {
        const opts = Object.assign({
            parent:  '',
            icon:    'info',
            text:    '',
            actions: []
        }, options);

        this.createLayout({
            parent: opts.parent,
            design: false,
            data: {
                id:    `${opts.parent}Inner`,
                class: 'flex flex-col sm:flex-row sm:items-center justify-between gap-[8px] border-t-[1px] border-[#334155] pt-[10px]',
                container: [
                    {
                        type:  'p',
                        class: 'text-[11px] text-gray-400 m-0 flex items-start gap-[6px]',
                        html:  `<span class="shrink-0 mt-[1px]">${lucideIcon(opts.icon, 'w-3.5 h-3.5')}</span><span>${opts.text}</span>`
                    },
                    {
                        type:  'div',
                        id:    `${opts.parent}Actions`,
                        class: 'shrink-0'
                    }
                ]
            }
        });

        if (!opts.actions.length) return;

        this.createLayout({
            parent: `${opts.parent}Actions`,
            design: false,
            data: {
                id:    `${opts.parent}Buttons`,
                class: 'flex flex-wrap gap-[8px]',
                container: opts.actions.map(action => ({
                    type:  'button',
                    id:    action.id,
                    class: action.ghost ? WA_UI.btnGhost : WA_UI.btnPrimary,
                    html:  `${lucideIcon(action.icon, 'w-3.5 h-3.5')}<span>${action.text}</span>`,
                    click: action.onClick
                }))
            }
        });
    }

    emptyState(options) {
        this.createLayout({
            parent: options.parent,
            design: false,
            data: {
                id:    `${options.parent}Empty`,
                class: 'flex flex-col items-center text-center gap-[4px] py-[20px] px-[12px] rounded-lg border-[1px] border-dashed border-[#334155] text-gray-400',
                container: [
                    {
                        type: 'span',
                        html: lucideIcon(options.icon, 'w-6 h-6')
                    },
                    {
                        type:  'p',
                        class: 'text-xs font-semibold text-white m-0',
                        text:  options.title
                    },
                    {
                        type:  'p',
                        class: 'text-[11px] m-0 max-w-[420px]',
                        text:  options.text
                    }
                ]
            }
        });
    }

    // -- CRUD --

    lsConfig() {
        return useFetch({
            url:  this._link,
            data: {
                opc: 'lsWaConfig'
            }
        });
    }

    async lsDestinatarios() {
        const request = await useFetch({
            url:  this._link,
            data: {
                opc:  'lsWaDestinatarios',
                tipo: ''
            }
        });

        if (this.isOk(request)) this.config.destinatarios = request.row;

        this.noticeTypes().forEach(notice => this.renderRecipientCard(notice.id));
    }

    async lsHistorial() {
        const tipo    = $('#waFilterTipo').val() || '';
        const period  = this.histPeriod();
        const request = await useFetch({
            url:  this._link,
            data: {
                opc:  'lsWaHistorial',
                tipo: tipo,
                fi:   period.fi,
                ff:   period.ff
            }
        });

        if (!this.isOk(request)) {
            this.notify('error', this.errorText(request, 'No se pudo cargar el historial.'));
            return;
        }

        $('#waHistSubtitle').text(`${period.label} · ordenado por fecha descendente.`);
        this.historyLogs = request.logs;
        this.renderHistoryKpis(request.kpis);
        this.renderHistoryLimit(request.limite);

        if (!request.row.length) {
            this.emptyState({
                parent: 'waHistTable',
                icon:   'clock',
                title:  tipo ? 'Sin envíos de este aviso' : 'Sin envíos en este periodo',
                text:   tipo
                    ? 'En el periodo elegido no salió ningún aviso de este tipo.'
                    : 'Cambia el periodo de consulta o espera al próximo aviso: aparecerá aquí con su proveedor y su estado.'
            });
            return;
        }

        this.createCoffeTable({
            parent: 'waHistTable',
            id:     'tbWaHistorial',
            theme:  'dark',
            f_size: 12,
            data: {
                thead: request.thead,
                row:   request.row
            }
        });

        simple_data_table('#tbWaHistorial', 15);
    }

    async saveProvider() {
        const creds   = this.config.proveedores[this.provider];
        const request = await useFetch({
            url:  this._link,
            data: {
                opc:       'saveWaProvider',
                proveedor: this.provider,
                instancia: creds.instancia,
                token:     creds.token,
                api_url:   creds.api_url
            }
        });

        if (!this.isOk(request)) {
            this.notify('error', this.errorText(request, 'No se pudo guardar el proveedor.'));
            return;
        }

        this.notify('success', request.message);
        await this.refresh();
        this.renderProviderCards();
    }

    async testConnection() {
        const button = $('#btnWaTest');
        const label  = button.html();

        button.prop('disabled', true).text('Probando…');

        const request = await useFetch({
            url:  this._link,
            data: {
                opc:       'testWaConnection',
                proveedor: this.provider,
                instancia: $('#waInstance').val() || '',
                token:     $('#waToken').val() || '',
                api_url:   $('#waApiUrl').val() || ''
            }
        });

        button.prop('disabled', false).html(label);

        if (!this.isOk(request)) {
            this.notify('error', this.errorText(request, 'No se pudo probar la conexión.'));
            return;
        }

        await this.refresh();
        this.renderConnection();
        this.renderTestResult(request);

        this.notify(
            request.ok ? 'success' : 'warning',
            request.ok ? 'Conexión verificada' : `${this.providerName(request.proveedor)}: ${this.stateInfo(request.estado).label}`
        );
    }

    async sendTest() {
        const phone   = $('#waSendPhone').val() || '';
        const message = ($('#waSendMessage').val() || '').trim();

        if (this.normalizePhone(phone) === '') {
            this.notify('warning', 'Escribe un número de 10 dígitos o el ID de un grupo …@g.us.');
            return;
        }

        if (!message) {
            this.notify('warning', 'Escribe el mensaje de prueba.');
            return;
        }

        const button = $('#btnWaSend');
        const label  = button.html();

        button.prop('disabled', true).text('Enviando…');

        const request = await useFetch({
            url:  this._link,
            data: {
                opc:       'sendWaTest',
                proveedor: this.provider,
                instancia: $('#waInstance').val() || '',
                token:     $('#waToken').val() || '',
                api_url:   $('#waApiUrl').val() || '',
                telefono:  phone,
                mensaje:   message
            }
        });

        button.prop('disabled', false).html(label);

        if (!this.isOk(request)) {
            this.notify('error', this.errorText(request, 'No se pudo enviar el mensaje de prueba.'));
            return;
        }

        this.notify('success', request.message);
        await this.refresh();
        this.renderConnection();
    }

    addDestinatario(type) {
        this.createModalForm({
            id:      'formWaRecipient',
            bootbox: {
                title: '<strong>Agregar destinatario</strong>'
            },
            data: {
                opc: 'addWaDestinatario'
            },
            json: this.jsonDestinatario({
                nombre:   '',
                telefono: '',
                tipo:     type,
                activo:   1
            }),
            success: (request) => this.onRecipientSaved(request)
        });

        this.bindRecipientForm(1);
    }

    editDestinatario(id) {
        const recipient = this.config.destinatarios.find(item => Number(item.id) === Number(id));
        if (!recipient) return;

        this.createModalForm({
            id:      'formWaRecipient',
            bootbox: {
                title: '<strong>Editar destinatario</strong>'
            },
            data: {
                opc: 'editWaDestinatario',
                id:  recipient.id
            },
            json:    this.jsonDestinatario(recipient),
            success: (request) => this.onRecipientSaved(request)
        });

        this.bindRecipientForm(recipient.activo);
    }

    deleteDestinatario(id) {
        const recipient = this.config.destinatarios.find(item => Number(item.id) === Number(id));
        if (!recipient) return;

        const notice = this.noticeTypes().find(item => item.id === recipient.tipo);

        this.alertBox({
            theme:      'dark',
            type:       'cancel',
            title:      `¿Eliminar a ${this.escape(recipient.nombre)}?`,
            detailHtml: `Deja de recibir el aviso de ${notice.name}. Si solo quieres detener sus avisos, apaga el interruptor de su fila.`,
            okLabel:    'Sí, eliminar',
            onOk: async () => {
                const request = await useFetch({
                    url:  this._link,
                    data: {
                        opc: 'delWaDestinatario',
                        id:  recipient.id
                    }
                });

                if (!this.isOk(request)) {
                    this.notify('error', this.errorText(request, 'No se pudo eliminar el destinatario.'));
                    return;
                }

                this.notify('success', request.message);
                this.lsDestinatarios();
            }
        });
    }

    // Pausa o reactiva un número en un aviso; la tarjeta se repinta para que el badge cuadre.
    async statusDestinatario(id, checked) {
        const recipient = this.config.destinatarios.find(item => Number(item.id) === Number(id));
        if (!recipient) return;

        const request = await useFetch({
            url:  this._link,
            data: {
                opc:    'statusWaDestinatario',
                id:     recipient.id,
                activo: checked ? 1 : 0
            }
        });

        if (!this.isOk(request)) {
            this.notify('error', this.errorText(request, 'No se pudo cambiar el destinatario.'));
            this.renderRecipientCard(recipient.tipo);
            return;
        }

        recipient.activo = checked ? 1 : 0;
        this.notify(checked ? 'success' : 'warning', request.message);
        this.renderRecipientCard(recipient.tipo);
    }

    async toggleNotice(type, checked) {
        const template = this.config.plantillas[type];
        const notice   = this.noticeTypes().find(item => item.id === type);
        const request  = await useFetch({
            url:  this._link,
            data: {
                opc:    'saveWaPlantilla',
                tipo:   type,
                cuerpo: template.cuerpo,
                activo: checked ? 1 : 0
            }
        });

        if (!this.isOk(request)) {
            this.notify('error', this.errorText(request, 'No se pudo cambiar el aviso.'));
            this.renderRecipientCard(type);
            return;
        }

        template.activo = checked ? 1 : 0;
        this.notify(checked ? 'success' : 'warning', `Aviso de ${notice.name} ${checked ? 'activado' : 'pausado'}`);
    }

    jsonCredentials(provider) {
        const creds = this.config.proveedores[provider];

        if (provider === 'greenapi') {
            return [
                {
                    opc:         'input',
                    lbl:         'API URL (servidor de la instancia)',
                    id:          'waApiUrl',
                    name:        'api_url',
                    placeholder: 'https://7103.api.greenapi.com',
                    value:       creds.api_url,
                    class:       'col-12'
                },
                {
                    opc:         'input',
                    lbl:         'ID Instancia (idInstance)',
                    id:          'waInstance',
                    name:        'instancia',
                    placeholder: '1234567890',
                    value:       creds.instancia,
                    class:       'col-12 col-sm-6'
                },
                {
                    opc:         'input-group',
                    lbl:         'Token (apiTokenInstance)',
                    id:          'waToken',
                    name:        'token',
                    type:        'password',
                    placeholder: 'Tu token de API',
                    value:       creds.token,
                    class:       'col-12 col-sm-6'
                }
            ];
        }

        return [
            {
                opc:         'input',
                lbl:         'Instance ID',
                id:          'waInstance',
                name:        'instancia',
                placeholder: 'instance12345',
                value:       creds.instancia,
                class:       'col-12 col-sm-6'
            },
            {
                opc:         'input-group',
                lbl:         'Token',
                id:          'waToken',
                name:        'token',
                type:        'password',
                placeholder: 'Tu token de API',
                value:       creds.token,
                class:       'col-12 col-sm-6'
            }
        ];
    }

    jsonDestinatario(values) {
        return [
            {
                opc:         'input',
                lbl:         'Nombre / Etiqueta',
                id:          'nombre',
                placeholder: 'Ej: Rosy (Gerente)',
                value:       values.nombre,
                class:       'col-12 mb-3'
            },
            {
                opc:         'input',
                lbl:         'Número de teléfono <span class="text-xs text-gray-400">· 10 dígitos, se antepone +52 al enviar</span>',
                id:          'telefono',
                placeholder: '9621501886 o ID de grupo …@g.us',
                value:       values.telefono,
                onkeyup:     'whatsapp.validatePhone(this)',
                class:       'col-12 mb-3'
            },
            {
                opc:   'select',
                lbl:   'Tipo de aviso',
                id:    'tipo',
                value: values.tipo,
                data:  this.recipientTypes(),
                class: 'col-12 mb-3'
            },
            {
                opc:      'input',
                id:       'activo',
                type:     'hidden',
                value:    values.activo,
                required: false,
                class:    'hidden'
            },
            {
                opc:        'checkbox',
                id:         'activoSwitch',
                text:       'Activo',
                onchange:   'whatsapp.syncActive',
                className:  'form-check-input ms-0 me-2 mt-0',
                classLabel: 'text-sm text-white',
                class:      'col-12 mb-3 form-switch d-flex align-items-center !pl-[12px]'
            }
        ];
    }

    // -- Complements --

    async refresh() {
        const request = await this.lsConfig();
        if (!this.isOk(request)) return;

        this.config = request;
        this.renderStatus();
    }

    selectProvider(id) {
        this.provider = id;
        this.renderProviderCards();

        if (id !== this.config.proveedor) {
            this.notify('info', `${this.providerName(id)} seleccionado: guarda para activarlo.`);
        }
    }

    async onCredentialsSaved(request) {
        if (!this.isOk(request)) {
            this.notify('error', this.errorText(request, 'No se pudieron guardar las credenciales.'));
            return;
        }

        this.notify('success', request.message);
        await this.refresh();
        this.renderCredentials();
    }

    onRecipientSaved(request) {
        if (!this.isOk(request)) {
            this.notify('error', this.errorText(request, 'No se pudo guardar el destinatario.'));
            return;
        }

        this.notify('success', request.message);
        this.lsDestinatarios();
    }

    onTemplateSaved(type, request) {
        if (!this.isOk(request)) {
            this.notify('error', this.errorText(request, 'No se pudo guardar la plantilla.'));
            return;
        }

        this.config.plantillas[type].cuerpo = $('#waBody').val();
        this.notify('success', request.message);
    }

    // Tamaños compactos de Bootstrap sobre el modal de createModalForm.
    bindRecipientForm(active) {
        const form = $('#formWaRecipient');

        form.find('.form-control').addClass('form-control-sm');
        form.find('.form-select').addClass('form-select-sm');
        form.find('.btn').addClass('btn-sm');
        form.find('label').addClass('text-[13px]');

        $('#activoSwitch').prop('checked', Number(active) === 1);
        this.syncActive();
    }

    // El switch no viaja si esta apagado: el hidden `activo` lleva siempre 1 o 0.
    syncActive() {
        const on = $('#activoSwitch').is(':checked');

        $('#activo').val(on ? 1 : 0);
        $('label[for="activoSwitch"]').text(on ? 'Activo' : 'Pausado');
    }

    validatePhone(input) {
        const value = $(input).val().trim();
        const valid = value === '' || this.normalizePhone(value) !== '';

        $('#msgWaPhone').remove();

        if (!valid) {
            $('<div>', {
                id:    'msgWaPhone',
                class: 'text-[#F87171] text-xs mt-1',
                text:  'Escribe 10 dígitos (ej. 9621501886) o pega el ID del grupo …@g.us'
            }).insertAfter(input);
        }

        $('#formWaRecipient').find('#btnSuccess').prop('disabled', !valid);
    }

    bindTokenToggle() {
        $('#waToken')
            .removeClass('rounded-l-none')
            .addClass('rounded-r-none')
            .next('span')
            .attr('class', WA_UI.tokenAddon)
            .attr('title', 'Mostrar u ocultar el token')
            .html(lucideIcon('eye', 'w-4 h-4'))
            .on('click', () => this.toggleToken());
    }

    toggleToken() {
        const field = $('#waToken');
        const show  = field.attr('type') === 'password';

        field.attr('type', show ? 'text' : 'password');
        field.next('span').html(lucideIcon(show ? 'eye-off' : 'eye', 'w-4 h-4'));
    }

    insertVariable(token) {
        const field = document.getElementById('waBody');
        if (!field) return;

        const start = field.selectionStart;
        const end   = field.selectionEnd;

        field.value = field.value.slice(0, start) + token + field.value.slice(end);
        field.focus();
        field.setSelectionRange(start + token.length, start + token.length);

        $(field).trigger('input');
    }

    restoreTemplate() {
        $('#waBody').val(this.config.defaults[this.templateType]).trigger('input');
        this.notify('info', 'Plantilla restaurada al texto original. Guarda para conservarla.');
    }

    exportHistorial() {
        if (!this.historyLogs.length) {
            this.notify('warning', 'No hay envíos para exportar con este filtro.');
            return;
        }

        const columns = [
            ['fecha', 'Fecha'],
            ['aviso', 'Aviso'],
            ['sucursal', 'Sucursal'],
            ['referencia', 'Referencia'],
            ['destinatarios', 'Destinatarios'],
            ['proveedor', 'Proveedor'],
            ['estado', 'Estado'],
            ['error', 'Error']
        ];

        const cell  = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
        const lines = [columns.map(column => cell(column[1])).join(',')]
            .concat(this.historyLogs.map(log => columns.map(column => cell(log[column[0]])).join(',')));

        // El BOM hace que Excel abra el CSV en UTF-8 y respete los acentos.
        const blob = new Blob(['﻿' + lines.join('\r\n')], {
            type: 'text/csv;charset=utf-8'
        });
        const link = document.createElement('a');

        link.href     = URL.createObjectURL(blob);
        link.download = `historial-whatsapp-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);

        this.notify('success', `${this.historyLogs.length} envíos exportados`);
    }

    notify(type, text) {
        this.createToast({
            theme: 'dark',
            type:  type,
            text:  text
        });
    }

    providerState(provider) {
        const creds = this.config.proveedores[provider];

        if (!creds.configurado) {
            return {
                tone:  'red',
                label: 'Faltan credenciales',
                text:  'Captura la instancia y el token en «Credenciales API».',
                ok:    false
            };
        }

        if (!creds.estado) {
            return {
                tone:  'gray',
                label: 'Sin probar',
                text:  'Usa «Probar conexión» para confirmar que envía.',
                ok:    false
            };
        }

        return this.stateInfo(creds.estado);
    }

    providerBadge(id) {
        if (id === this.config.proveedor) {
            return {
                text: 'Actual',
                tone: 'green'
            };
        }

        if (id === this.provider) {
            return {
                text: 'Seleccionado',
                tone: 'violet'
            };
        }

        return null;
    }

    providerStatus(id) {
        const state = this.providerState(id);

        return {
            label: 'Estado:',
            text:  state.label,
            tone:  state.tone
        };
    }

    stateInfo(code) {
        const catalog = this.stateCatalog();

        return catalog[code] || {
            tone:  'amber',
            label: code || 'Desconocido',
            text:  'El proveedor devolvió un estado que este panel no conoce. Revísalo en su consola.',
            ok:    false
        };
    }

    // Green API: los 6 estados de getStateInstance. UltraMsg: los de /instance/status.
    stateCatalog() {
        const starting = {
            tone:  'amber',
            label: 'Arrancando',
            text:  'La instancia se está iniciando. Espera un par de minutos y vuelve a probar.',
            ok:    false
        };

        return {
            authorized: {
                tone:  'green',
                label: 'authorized',
                text:  'La instancia está vinculada y lista para enviar.',
                ok:    true
            },
            notAuthorized: {
                tone:  'red',
                label: 'notAuthorized',
                text:  'Sin sesión en el teléfono: escanea el QR de la instancia en console.green-api.com y vuelve a probar.',
                ok:    false
            },
            starting: {
                tone:  'amber',
                label: 'starting',
                text:  'La instancia está arrancando (reinicio o mantenimiento). Espera hasta 5 minutos y vuelve a probar.',
                ok:    false
            },
            sleepMode: {
                tone:  'amber',
                label: 'sleepMode',
                text:  'El teléfono está apagado o sin internet. Enciéndelo: puede tardar 5 minutos en volver a authorized.',
                ok:    false
            },
            suspended: {
                tone:  'amber',
                label: 'suspended',
                text:  'WhatsApp restringió el envío por un tiempo. Baja el ritmo de mensajes y revisa la instancia en la consola.',
                ok:    false
            },
            blocked: {
                tone:  'red',
                label: 'blocked',
                text:  'WhatsApp bloqueó el número. Hay que vincular otro número a la instancia.',
                ok:    false
            },
            authenticated: {
                tone:  'green',
                label: 'Conectada',
                text:  'La instancia está vinculada y lista para enviar.',
                ok:    true
            },
            qr: {
                tone:  'red',
                label: 'Sin vincular',
                text:  'Escanea el QR desde el panel de UltraMsg con el teléfono que envía.',
                ok:    false
            },
            disconnected: {
                tone:  'red',
                label: 'Desconectada',
                text:  'El teléfono perdió la sesión. Vuelve a escanear el QR en el panel de UltraMsg.',
                ok:    false
            },
            standby: {
                tone:  'amber',
                label: 'En espera',
                text:  'La instancia está en pausa. Reactívala desde el panel de UltraMsg.',
                ok:    false
            },
            loading:    starting,
            initialize: starting,
            retrying:   starting,
            credencialesInvalidas: {
                tone:  'red',
                label: 'Credenciales inválidas',
                text:  'El proveedor rechazó la instancia o el token. Cópialos otra vez desde su consola.',
                ok:    false
            },
            sinRespuesta: {
                tone:  'red',
                label: 'Sin respuesta',
                text:  'El servidor del proveedor no contestó. Revisa la API URL y la conexión a internet.',
                ok:    false
            }
        };
    }

    noticeTypes() {
        return [
            {
                id:       'cierre',
                name:     'Cierre Diario',
                short:    'Cierre Diario',
                title:    'Cierre Diario · Corte Z',
                subtitle: 'Se envía al cerrar el día completo',
                icon:     'calendar',
                color:    '#A78BFA',
                note:     ''
            },
            {
                id:       'turno',
                name:     'Cierre de Turno',
                short:    'Cierre Turno',
                title:    'Cierre de Turno · Corte X',
                subtitle: 'Se envía al cerrar cada turno individual',
                icon:     'clock',
                color:    '#F59E0B',
                note:     ''
            },
            {
                id:       'personalizado',
                name:     'Pedidos',
                short:    'Pedidos',
                title:    'Pedidos',
                subtitle: 'Se envía al terminar cada pedido, normal o personalizado',
                icon:     'cake',
                color:    '#C4B5FD',
                note:     'Incluye los productos del pedido; el pastel personalizado lleva sus modificadores y dedicatoria, y su foto va arriba del mensaje (si hay más, llegan detrás).'
            },
            {
                id:       'edicion',
                name:     'Pedido editado',
                short:    'Pedido editado',
                title:    'Pedido editado',
                subtitle: 'Se envía cuando cambia un pedido que ya se avisó',
                icon:     'pencil',
                color:    '#38BDF8',
                note:     'Dice qué cambió desde el último aviso (➕ agregado, ➖ quitado, antes → ahora) y cómo quedó el pedido; solo manda las fotos nuevas del pastel personalizado. Si no cambió nada, no se envía.'
            }
        ];
    }

    recipientTypes() {
        return [
            {
                id:    'todos',
                valor: 'Todos los avisos (Cierres + Pedidos + Editados)'
            },
            {
                id:    'cierres',
                valor: 'Cierre Diario + Cierre de Turno'
            },
            {
                id:    'pedidos',
                valor: 'Pedidos + Pedido editado'
            },
            {
                id:    'cierre',
                valor: 'Solo Cierre Diario (Corte Z)'
            },
            {
                id:    'turno',
                valor: 'Solo Cierre de Turno (Corte X)'
            },
            {
                id:    'personalizado',
                valor: 'Solo Pedidos'
            },
            {
                id:    'edicion',
                valor: 'Solo Pedido editado'
            }
        ];
    }

    // Datos de ejemplo para la vista previa; al enviar los pone pedidos.
    templateVars(type) {
        const branch = typeof sucursal !== 'undefined' && sucursal.length ? sucursal[0].valor : 'Sucursal Centro';
        const today  = new Date().toLocaleDateString('es-MX', {
            day:   '2-digit',
            month: '2-digit',
            year:  'numeric'
        });

        const order = [
            ['folio',     'P988-25'],
            ['hora',      '01:00 PM'],
            ['cliente',   'María'],
            ['telefono',  '962 XXX XXXX'],
            ['productos', [
                '• *1 × Tres Leches Fresas con Crema 12*',
                '   ◦ Dedicatoria: Felicidades mami',
                '• *1 × Pastel personalizado «María»*',
                '   ◦ Porciones: 10',
                '   ◦ Forma: redonda',
                '   ◦ Rellenos: manjar',
                '   ◦ Dedicatoria: Happy Birthday Mom',
                '   ◦ 🖼️ 1 imagen adjunta'
            ].join('\n')],
            ['total',      '$1,250.00'],
            ['anticipo',   '$500.00'],
            ['forma_pago', 'Efectivo'],
            ['restante',   '$750.00'],
            ['estatus',    '🟡 PENDIENTE']
        ];

        const pairs = {
            // Mismas cifras que el "Resumen del dia" del Corte Z (ejemplo: 30/09/2026).
            cierre: [
                ['cajero',          'Rosy'],
                ['venta_bruta',     '10,220.00'],
                ['pendiente',       '6,320.00'],
                ['pedidos_dia',     '3,900.00'],
                ['abonos_ant',      '1,780.00'],
                ['en_caja',         '5,680.00'],
                ['efectivo',        '1,200.00'],
                ['efectivo_n',      '3'],
                ['tarjeta',         '650.00'],
                ['tarjeta_n',       '2'],
                ['transferencia',   '3,830.00'],
                ['transferencia_n', '6'],
                ['fondo_inicial',   '-'],
                ['pagadas',         '4'],
                ['pendientes',      '4'],
                ['cotizaciones',    '1'],
                ['cuentas',         '9'],
                ['canceladas',      '-'],
                ['con_descuento',   '-'],
                ['ticket_promedio', '1,277.50'],
                ['turnos',          '2'],
                ['ventas',          '10,220.00'],
                ['descuentos',      '-'],
                ['pedidos',         '9']
            ],
            // Mismas cifras que el ticket "Cierre x Turno".
            turno: [
                ['cajero',        'Rosy'],
                ['apertura',      '09:00 AM'],
                ['cierre',        '03:00 PM'],
                ['fondo_inicial', '500.00'],
                ['ventas',        '4,200.00'],
                ['cobrado_turno', '3,400.00'],
                ['abonos_ant',    '800.00'],
                ['abonos_n',      '2'],
                ['total_caja',    '4,200.00'],
                ['efectivo',      '1,800.00'],
                ['tarjeta',       '2,400.00'],
                ['transferencia', '-'],
                ['pedidos',       '9'],
                ['pagados',       '5'],
                ['pendientes',    '3'],
                ['cotizaciones',  '1'],
                ['cancelados',    '-']
            ],
            personalizado: order,
            edicion: [
                ...order,
                ['cambios', [
                    '• Hora: 11:00 AM → 01:00 PM',
                    '• Anticipo: $300.00 → $500.00',
                    '➕ *1 × Pastel personalizado «María»*',
                    '   ◦ Porciones: 10',
                    '   ◦ Rellenos: manjar',
                    '➖ *1 × Gelatina de mosaico*'
                ].join('\n')]
            ]
        };

        // El Map deja una sola variable por nombre: el aviso puede pisar el ejemplo común.
        const merged = new Map([['sucursal', branch], ['fecha', today], ...(pairs[type] || [])]);

        return [...merged].map(pair => ({
            key:    pair[0],
            sample: pair[1]
        }));
    }

    fillTemplate(body) {
        const values = {};
        this.templateVars(this.templateType).forEach(variable => values[variable.key] = variable.sample);

        // Igual que Message::fillTemplate: un cero llega como "-"; si va entre parentesis
        // ({efectivo_n}) se quitan, y si lleva "$" delante (${var}) se quita el "$".
        return String(body || '')
            .replace(/ ?\(\{(\w+)\}\)/g, (match, key) => values[key] === '-' ? '' : match)
            .replace(/(\$?)\{(\w+)\}/g, (match, dollar, key) => {
                if (values[key] === undefined) return match;
                return values[key] === '-' ? '-' : dollar + values[key];
            });
    }

    compareData() {
        const cell = (html, extra = '') => ({
            html:  html,
            class: `px-[10px] py-[5px] whitespace-normal ${extra}`
        });

        return {
            thead: [
                '',
                '<span class="text-[#A78BFA]">UltraMsg</span>',
                '<span class="text-[#4ADE80]">Green API</span>'
            ],
            row: [
                ['Credenciales', '2 (Instance + Token)', '3 (URL + Instance + Token)'],
                ['Formato de número', '<code class="text-gray-200">+52XXXXXXXXXX</code>', '<code class="text-gray-200">521XXXXXXXXXX@c.us</code>'],
                ['Estado de instancia', 'Básico (<code class="text-gray-200">instance/status</code>)', 'Sí (<code class="text-gray-200">getStateInstance</code>, 6 estados)'],
                ['Archivos', 'Sí', 'Sí'],
                ['Grupos', 'Sí (<code class="text-gray-200">@g.us</code>)', 'Sí (<code class="text-gray-200">@g.us</code>)']
            ].map((item, index) => ({
                id:       index + 1,
                concepto: cell(item[0], 'font-medium text-white'),
                ultramsg: cell(item[1], 'text-center'),
                greenapi: cell(item[2], 'text-center')
            }))
        };
    }

    consoleHint(provider) {
        return provider === 'greenapi'
            ? 'Encuentra estos datos en <a href="https://console.green-api.com" target="_blank" rel="noopener" class="text-[#4ADE80] underline">console.green-api.com</a> → tu instancia. Cada instancia vive en su propio servidor: la API URL es de la instancia, no fija.'
            : 'Encuentra estos datos en <a href="https://user.ultramsg.com" target="_blank" rel="noopener" class="text-[#A78BFA] underline">user.ultramsg.com</a> → tu instancia.';
    }

    toneText(tone) {
        const classes = {
            green: 'text-[#34D399]',
            red:   'text-[#F87171]',
            amber: 'text-[#FBBF24]',
            gray:  'text-gray-300'
        };

        return classes[tone] || classes.gray;
    }

    providerName(provider) {
        return provider === 'greenapi' ? 'Green API' : 'UltraMsg';
    }

    providerColor(provider) {
        return provider === 'greenapi' ? '#4CAF50' : '#8B5CF6';
    }

    formatPhone(phone) {
        const value = String(phone || '');
        return /^\d{10}$/.test(value)
            ? `+52 ${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(6)}`
            : value;
    }

    // Misma regla que normalizePhone() del controlador: 10 dígitos o …@g.us.
    normalizePhone(value) {
        const raw = String(value || '').trim();

        if (/@g\.us$/i.test(raw)) {
            const group = raw.replace(/\s+/g, '').toLowerCase();
            return /^[0-9-]+@g\.us$/.test(group) ? group : '';
        }

        let digits = raw.replace(/\D/g, '');
        if (digits.length === 13 && digits.startsWith('521')) digits = digits.slice(3);
        if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2);

        return digits.length === 10 ? digits : '';
    }

    escape(text) {
        return $('<div>').text(text == null ? '' : text).html();
    }

    isOk(request) {
        return !!request && Number(request.status) === 200;
    }

    errorText(request, fallback) {
        return (request && request.message) || fallback;
    }
}
