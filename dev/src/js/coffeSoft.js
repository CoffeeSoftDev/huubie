class Complements {

    constructor(link, div_modulo) {
        this._link = link;
        this._div_modulo = div_modulo;
    }

    ObjectMerge(target, source) {
        // Iterar sobre todas las claves del objeto fuente
        for (const key in source) {
            // Verificar si la propiedad es propia del objeto fuente
            if (source.hasOwnProperty(key)) {
                // Verificar si el valor es un objeto y si el target tiene la misma propiedad
                if (typeof source[key] === 'object' && source[key] !== null) {
                    // Si el target no tiene la propiedad o no es un objeto, inicializarla como un objeto vacÃ­o
                    if (!target[key] || typeof target[key] !== 'object') {
                        target[key] = {};
                    }
                    // Llamada recursiva para combinar sub-objetos
                    this.ObjectMerge(target[key], source[key]);
                } else {
                    // Si no es un objeto, asignar el valor directamente
                    target[key] = source[key];
                }
            }
        }
        return target;
    }

    closedModal(data) {
        if (data === true || data.success === true) {
            alert();
            $('.bootbox-close-button').click();
        } else console.error(data);
    }

    dropdown(options) {
        let defaults = [
            { icon: "icon-pencil", text: "Editar", onClick: "alert('Editar')" },
            { icon: "icon-trash", text: "Eliminar", onClick: "alert('Eliminar')" },
        ];

        let opts = options != undefined ? options : defaults;

        const $ul = $("<ul>", { class: "dropdown-menu", "aria-labelledby": "dropdownMenu" });
        //Hago una iteraciÃ³n sobre el array de etiquetas li
        opts.forEach((m) => {
            let html = m.icon != "" ? `<i class="text-info ${m.icon}"></i>` : "<i class='icon-minus'></i>";
            html += m.text != "" ? m.text : "";

            const $a = $("<a>", { ...m, class: "pt-1 pb-1 pointer dropdown-item", onclick: m.onClick, html });
            const $li = $("<li>").append($a);
            $ul.append($li);
        });


        //Creo el boton principal ...
        const $button = $("<button>", {
            class: "btn btn-aliceblue btn-sm",
            id: "dropdownMenu",
            type: "button",
            "data-bs-toggle": "dropdown",
            "aria-expanded": "false",
            html: '<i class="icon-dot-3 text-info"></i>',
        });

        //Se puede hacer un return aquÃ­ y retorna el objeto jQuery
        const $container = $("<div>", { class: "dropdown" });
        $container.append($button, $ul);
        //Yo hago el return aquÃ­ porque convierto el objeto a un string.
        return $container.prop("outerHTML");
    }

    useFetch(options) {

        // Valores predeterminados
        let defaults = {
            method: 'POST',
            data: { opc: 'ls' },
            url: this._link, // La URL debe ser especificada en las opciones
            success: () => { } // FunciÃ³n vacÃ­a por defecto
        };

        // Mezclar los valores predeterminados con las opciones proporcionadas
        let opts = Object.assign({}, defaults, options);

        // Validar que la URL estÃ© definida
        if (!opts.url) {
            console.error('URL es obligatoria.');
            return;
        }

        // Realizar la peticiÃ³n fetch
        fetch(opts.url, {
            method: opts.method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(opts.data),
        })
            .then((response) => response.json())
            .then((data) => {
                // Llamar a la funciÃ³n success si se proporciona
                if (typeof opts.success === 'function') {
                    opts.success(data);
                }
            })
            .catch((error) => {
                console.error('Error en la peticiÃ³n:', error);
            });
    }

}

// add component
class Components extends Complements {

    constructor(link, div_modulo) {
        super(link, div_modulo);
    }

    createItemCard(options) {
        let defaults = {
            parent: 'cardGridContainer',
            json: [
                {
                    titulo: "Evento",
                    descripcion: "Dar de alta un nuevo evento",
                    imagen: "/alpha/src/img/eventos.svg",
                    enlace: "/alpha/eventos/",
                    padding: ""
                },
                {
                    titulo: "Evento",
                    descripcion: "Dar de alta un nuevo evento",
                    imagen: "/alpha/src/img/eventos.svg",
                    enlace: "/alpha/eventos/",
                    padding: ""
                }
            ]
        };

        let opts = Object.assign({}, defaults, options);

        // 📜 Título principal del grupo de tarjetas
        let title = $('<h3>', {
            class: 'text-lg font-semibold text-white mb-2 px-4',
            text: opts.title || ''
        });

        // 📜 Contenedor principal del grid de tarjetas
        let container = $('<div>', {
            class: 'w-full flex gap-4 justify-start p-4'
        });

        // 🔄 Generar cada tarjeta a partir de la data
        opts.json.forEach(item => {
            let imgContent = '';

            if (Array.isArray(item.img)) {
                imgContent = '<div class="flex gap-2 mb-2">';
                item.img.forEach(i => {
                    imgContent += `<img class="w-14 h-14 bg-[#233876] rounded-lg" src="${i.src}" alt="${i.title}">`;
                });
                imgContent += '</div>';
            } else if (item.imagen) {
                imgContent = `<img class="w-14 h-14 ${item.padding} bg-[#233876] rounded-lg group-hover:scale-110 transition-transform mb-2" src="${item.imagen}" alt="${item.titulo}">`;
            }


            let card = $(
                `<div class="group w-50 h-[200px] bg-[#333D4C] rounded-lg shadow-lg overflow-hidden p-4 flex flex-col justify-between cursor-pointer transition-all hover:shadow-xl hover:scale-105">
                  ${imgContent}
                <div class="flex-grow flex flex-col justify-center">
                    <h2 class="text-lg font-semibold text-white group-hover:text-blue-400">${item.titulo}</h2>
                    ${item.descripcion ? `<p class="text-gray-400 ">${item.descripcion}</p>` : ""}
                </div>
            </div>`
            ).click(() => {
                if (item.enlace)
                    window.location.href = item.enlace;

                if (item.onClick)
                    item.onClick();


            });

            container.append(card);
        });

        // 🎯 Insertar el grid en el DOM
        $('#' + opts.parent).append(title, container);
    }


    //

    swalQuestion(options = {}) {

        /*--  plantilla --*/
        let objSwal = {
            title: "",
            text: " ",
            icon: "warning",

            showCancelButton: true,
            confirmButtonText: "Aceptar",
            cancelButtonText: "Cancelar",
            ...options.opts,
            customClass: {
                popup: "bg-[#1F2A37] text-white rounded-lg shadow-lg",
                title: "text-2xl font-semibold",
                content: "text-gray-300",
                confirmButton:
                    "bg-[#1C64F2] hover:bg-[#0E9E6E] text-white py-2 px-4 rounded",
                cancelButton:
                    "bg-transparent text-white border border-gray-500 py-2 px-4 rounded hover:bg-[#111928]",
            },
        };


        var defaults = {

            data: { opc: "ls" },
            extends: false,
            fn: '',

            ...options,

            methods: ''

        };

        let opts = Object.assign(defaults, options);


        let extends_swal = Swal.fire(objSwal);



        if (options.extends) {

            return extends_swal;

        } else {

            extends_swal.then((result) => {

                if (result.isConfirmed) {


                    fn_ajax(opts.data, this._link, "").then((data) => {

                        if (opts.fn) {
                            window[opts.fn]();

                        } else if (opts.methods) {
                            // Obtener las llaves de los mÃ©todos
                            let methodKeys = Object.keys(opts.methods);
                            methodKeys.forEach((key) => {
                                const method = opts.methods[key];
                                method(data);
                            });

                        }


                    });
                }
            });



        }




    }

    createTable(options) {

        var defaults = {

            extends: false,
            parent: this.div_modulo,
            idFilterBar: '',

            parent: 'lsTable',
            coffeesoft: false,

            conf: {
                datatable: true,
                fn_datatable: 'simple_data_table',
                beforeSend: true,
                pag: 15,
            },

            methods: {
                send: (data) => { }
            }


        };

        // configurations.
        const dataConfig = Object.assign(defaults.conf, options.conf);


        let opts = Object.assign(defaults, options);
        const idFilter = options.idFilterBar ? options.idFilterBar : '';

        if (idFilter) { // se activo la validacion por filtro

            const sendData = { tipo: 'text', opc: 'ls', ...options.data };
            var extendsAjax = null; // extender la funcion ajax


            $(`#${idFilter}`).validar_contenedor(sendData, (datos) => {

                // console.log('opts', dataConfig);

                let beforeSend = (dataConfig.beforeSend) ? '#' + options.parent : '';

                extendsAjax = fn_ajax(datos, this._link, beforeSend);


                if (!options.extends) { // si la variable extends no esta definida se ejectuta de forma normal


                    extendsAjax.then((data) => {


                            let attr_table_filter = {
                                data: data,
                                f_size: '14',
                                id: 'tbSearch'
                            };

                            attr_table_filter = Object.assign(attr_table_filter, opts.attr);

                            opts.methods.send(data);

                            if (opts.success)
                                opts.success(data);


                            if (opts.coffeesoft) {

                                attr_table_filter.parent = opts.parent;

                                this.createCoffeTable(attr_table_filter);

                            } else {

                                $('#' + options.parent).rpt_json_table2(attr_table_filter);
                            }

                            if (dataConfig.datatable) {
                                window[dataConfig.fn_datatable]('#' + attr_table_filter.id, dataConfig.pag);
                            }






                    });


                }


            });

            if (opts.extends) {
                return extendsAjax;
            }







        } else {

            let sendData = {
                opc: 'ls',
                ...opts.data
            };



            extendsAjax = fn_ajax(sendData, this._link, '#' + opts.parent);


            if (!opts.extends) { // si la variable extends no esta definida se ejectuta de forma normal


                extendsAjax.then((data) => {

                    opts.methods.send(data);

                    this.processData(data, opts, dataConfig);


                });


            }



        }





    }

    createForm(options) {
        // Conf:
        let defaults = {

            parent: 'formsContent',
            id: 'idForm',
            autofill: false,
            plugin: 'content_json_form',
            plugin_validation: 'validation_form',
            extends: false,
            type: 'div',
            class: 'row',
            methods: {
                send: (data = '') => { }
            },
        };

        let formulario = [
            {
                opc: "input",
                lbl: "Producto",
                class: 'col-12'
            },

            {
                opc: "btn-submit",
                id: "btnEnviar",
                text: 'Guardar',
                class: 'col-12'
            },


        ];



        // Reemplazar formulario:
        const jsonForm = options.json || formulario;
        // Fusionar opciones con valores por defecto
        const opts = Object.assign(defaults, options);
        opts.methods = Object.assign({}, defaults.methods, options.methods);  // Asegurar que los mÃ©todos personalizados se fusionen correctamente

        $('#' + opts.parent)[opts.plugin]({ data: jsonForm, class: opts.class, type: 'default', id: opts.id, Element: opts.type });



        if (opts.autofill) {
            // Init process auto inputs
            for (const frm in opts.autofill) {
                // Buscar elementos en el DOM cuyo atributo name coincida con la clave
                const $element = $('#' + opts.id).find(`[name="${frm}"]`);

                if ($element.length > 0) {
                    // Establecer valor dependiendo del tipo de elemento
                    if ($element.is('select')) {
                        // Seleccionar la opciÃ³n correcta en el select
                        $element.val(opts.autofill[frm]).trigger('change');
                    } else {
                        // Para otros elementos como input o textarea
                        $element.val(opts.autofill[frm]);
                    }


                } else {

                }
            }
        }


        let dataForm = {
            tipo: 'text',
            opc: 'set',
            ...options.data
        };

        var extends_ajax;



        $("#" + opts.parent).validation_form(dataForm, (datos) => {

            if (options.beforeSend)
                options.beforeSend();



            extends_ajax = fn_ajax(datos, this._link, '');

            if (!opts.extends) {

                extends_ajax.then((data) => {

                    // $("#" + opts.parent)[0].reset();
                    if (opts.success)
                        opts.success(data);

                    if (opts.methods.send)
                        opts.methods.send(data);

                });

            }


        });
        // return extends_ajax;
        // if(opts.extends){
        //     return extends_ajax;
        // }



    }

    form(options) {
        var defaults = {
            json: [],

            class: "row",
            parent: "",
            Element: "div",

            id: "containerForm",
            prefijo: "",
            icon: "icon-dollar",

            color: "primary",
            color_btn: "outline-primary",
            color_default: "primary",
            text_btn: "Aceptar",
            fn: "EnviarDatos()",
            id_btn: "btnAceptar",
            required: true,
        };

        let opts = Object.assign(defaults, options);

        // Creamos el contenedor
        var div = $("<div>", { class: opts.class, id: opts.id });

        opts.json.map((item, index) => {

            const propierties = { ...item }; // Crear una copia del objeto para evitar modificar el original
            delete propierties.class;
            delete propierties.classElement;
            delete propierties.default;
            delete propierties.opc;

            var children = $("<div>", {
                class: item.class ? "my-2 " + item.class : "col-12 ",
            }).append(
                $("<label>", {
                    class: "fw-semibold ",
                    html: item.lbl,
                })
            );

            // config. attr
            var attr = {
                class: " form-control input-sm " + item.classElement,
                id: item.id,
                name: item.id ? item.id : item.name,
                ...propierties,
            };

            const htmlElements = item.opc ? item.opc : item.element;
            switch (htmlElements) {
                case "input":
                    // Agregar clase de alineaciÃ³n segÃºn el tipo de `item`
                    if (item.tipo === "cifra" || item.tipo === "numero") {
                        attr.class += " text-end";
                    }

                    var element = $("<input>", attr);
                    break;

                case "input-calendar":
                    // Crear contenedor del grupo de input
                    var element = $("<div>", {
                        class: "input-group date calendariopicker",
                    });

                    element.append($("<input>", attr));
                    element.append(
                        $("<span>", { class: "input-group-text" }).append(
                            $("<i>", { class: "icon-calendar-2" })
                        )
                    );
                    break;

                case "select":
                    attr.class = "form-select input-sm " + item.classElement;
                    var element = $("<select>", attr);

                    if (item.default) {
                        element.append($("<option>", { value: "0", text: item.default }));
                    }

                    $.each(item.data, function (_, option) {
                        const isSelected = option.id === item.value;

                        element.append(
                            $("<option>", {
                                value: option.id,
                                text: option.valor,
                                selected: isSelected,
                            })
                        );
                    });

                    break;

                case "textarea":
                    // Crear el elemento textarea
                    attr.class = "form-control resize" + item.classElement;
                    var element = $("<textarea>", attr);
                    break;

                case 'dropdown':

                    // data default.
                    let defaults = [
                        { icon: "icon-pencil", text: "Editar", onClick: () => alert() },
                        { icon: "icon-trash", text: "Eliminar", onClick: () => alert() },
                    ];

                    let opts = Object.assign(defaults, item.data);

                    var $button = $("<button>", {
                        class: "btn btn-outline-primary btn-sm ",
                        id: item.id || "dropdownMenu",
                        type: "button",
                        "data-bs-toggle": "dropdown",
                        "aria-expanded": "false",
                        html: `<i class="${item.iconClass || 'icon-dot-3 text-info'}"></i>`,
                    });


                    var $ul = $("<ul>", { class: "dropdown-menu" });

                    opts.forEach((dropdownItem) => {
                        const $li = $("<li>");

                        // Construir el contenido dinÃ¡mico con Ã­conos y texto
                        let html = dropdownItem.icon && dropdownItem.icon !== ""
                            ? `<i class="text-info ${dropdownItem.icon}"></i>`
                            : "<i class='icon-minus'></i>";
                        html += dropdownItem.text && dropdownItem.text !== ""
                            ? ` ${dropdownItem.text}`
                            : "";

                        const $a = $("<a>", {
                            class: "dropdown-item",
                            id: dropdownItem.id,
                            href: dropdownItem.href || "#",
                            html: html, // Usar el HTML construido con Ã­conos y texto
                        });

                        if (dropdownItem.onClick) {
                            $a.on("click", dropdownItem.onClick);
                        }

                        $li.append($a);
                        $ul.append($li);
                    });
                    var element = $("<div>", { class: "dropdown" }).append($button, $ul);
                    break;


            }

            children.append(element);

            div.append(children);
        });

        $("#" + opts.parent).append(div);
    }

    //

    ModalForm(options) {

        // ConfiguraciÃ³n para formularios.
        const idFormulario = options.id ? options.id : 'modalForm';
        const components = options.components
            ? options.components
            : $("<form>", { novalidate: true, id: idFormulario, class: "" }); // Componente form.


        let defaults = {
            id: idFormulario,
            autofill: false,
            bootbox: {
                title: 'Modal example',
                closeButton: true,
                message: components,
                id: 'modal'
            },
            json: [
                {
                    opc: 'input-group',
                    class: 'col-12',
                    label: 'Nombre'
                },
                {
                    opc: 'btn-submit',
                    text: 'Guardar',
                    class: 'col-12'
                }
            ],
            plugin: 'content_json_form',
            autovalidation: true,
            data: { opc: 'setForm' }
        };

        const opts = this.ObjectMerge(defaults, options);
        let modal = bootbox.dialog(opts.bootbox); // Crear componente modal.

        // Proceso de construccion de un formulario
        $('#' + opts.id)[opts.plugin]({ data: opts.json, type: '' });


        let formData = new FormData($("#" + opts.id)[0]);



        // Proceso de autovalidacion
        if (opts.autovalidation) {


            let options_validation = {
                tipo: "text",
                opc: "save-frm",
            };

            let formData = new FormData($("#" + opts.id)[0]);

            console.log(formData);

            options_validation = Object.assign(options_validation, opts.data);


            $("#" + opts.id).validation_form(options_validation, (data) => {

                console.log("#" + opts.id)
                let formData = new FormData($("#" + opts.id)[0]);

                console.log(formData);


            });



        }










    }

    createModalForm(options) {

        const idFormulario = options.id ? options.id : 'frmModal';

        const components = options.components

            ? options.components
            : $("<form>", { novalidate: true, id: idFormulario, class: "" });



        let defaults = {
            id: idFormulario,
            autofill: false,
            bootbox: {
                title: 'Modal example',
                closeButton: true,
                message: components,
            },
            json: [{ opc: 'label', text: 'Agrega tu formulario', class: 'col-12' }],
            autovalidation: true,
            data: { opc: 'sendForm' }
        };

        const conf = this.ObjectMerge(defaults, options);


        // Operations.
        let SuccessForm = () => {

            if (conf.autovalidation) {
                let options_validation = {
                    tipo: "text",
                    opc: "save-frm",
                };
                $("#" + conf.id).validar_contenedor({ tipo: 'text' }, (ok) => {
                    let formData = new FormData($('#' + conf.id)[0]);
                    const datos = {};
                    formData.forEach((value, key) => (datos[key] = value));
                    // Agregar datos dinÃ¡micos
                    const dynamicData = {};
                    if (conf.dynamicValues)
                        Object.keys(conf.dynamicValues).forEach((key) => {
                            dynamicData[key] = $(conf.dynamicValues[key]).val();
                        });
                    const data = Object.assign(datos, conf.data, dynamicData);
                    useFetch({
                        url: this._link,
                        data: data,
                        success: (request) => {
                            if (conf.success) conf.success(request);
                            modal.modal('hide');
                        }
                    })
                });
            }

        }

        let CancelForm = () => { modal.modal('hide'); }


        conf.json.push(

            {
                opc: "button",
                id: 'btnSuccess',
                className: "w-full",
                onClick: () => SuccessForm(),
                text: "Aceptar",
                class: "col-6"
            },

            {
                opc: "button",
                id: 'btnExit',
                inert: true,
                className: "w-full",
                onClick: () => CancelForm(),
                text: "Cancelar",
                color_btn: "danger",
                class: "col-6"
            },
        );


        // Components.
        let modal = bootbox.dialog(conf.bootbox);
        $('#' + conf.id).content_json_form({ data: conf.json, type: '' });




        /* propiedades de autofill*/

        if (conf.autofill) {
            // Init process auto inputs
            for (const frm in conf.autofill) {
                // Buscar elementos en el DOM cuyo atributo name coincida con la clave
                const $element = $('#' + conf.id).find(`[name="${frm}"]`);

                if ($element.length > 0) {
                    // Establecer valor dependiendo del tipo de elemento
                    if ($element.is('select')) {
                        // Seleccionar la opciÃ³n correcta en el select
                        $element.val(conf.autofill[frm]).trigger('change');
                    } else {
                        // Para otros elementos como input o textarea
                        $element.val(conf.autofill[frm]);
                    }

                } else {
                }
            }
        }





















        // if (options.beforeSend)
        //     options.beforeSend();


        // if (conf.autovalidation) {

        //     let options_validation = {
        //         // tipo: "text",
        //         opc: "save-frm",
        //     };

        //     options_validation = Object.assign(options_validation, conf.data);


        //     $("#" + conf.id).validation_form(options_validation, (formData) => {

        //         const datos = {};
        //         formData.forEach((value, key) => datos[key] = value);

        //     console.log(2,conf.data);
        //         fn_ajax(datos, this._link, '').then((data) => {



        //             if (conf.success)
        //                 conf.success(data);


        //             modal.modal('hide');

        //         });

        //         // fetch(this._link, {
        //         //     method: 'POST', // MÃ©todo HTTP
        //         //     body: datos, // FormData como cuerpo de la solicitud

        //         // }).then(response => { }).then(data => {


        //         // })



        //     });


        // } else {
        //     return modal;
        // }


        // return modal;




    }

    createModal(options) {

        let components = $('<div>');


        let defaults = {
            id: '',
            bootbox: {
                title: 'Modal example',
                closeButton: true,
                message: ' ',
            },

            extends: false,

            data: { opc: 'lsModal' }
        };

        const opts = this.ObjectMerge(defaults, options);



        fn_ajax(opts.data, this._link, '').then((data) => {
            let modal = bootbox.dialog(opts.bootbox);


            if (opts.success)
                options.success(data);

            // modal.modal('hide');


        });

    }

    createfilterBar(options) {

        let defaults = {
            id: 'idFilterBar',
            parent: 'filterBar',
            json: [
                {
                    opc: "input-calendar",
                    id: "iptDate",
                    tipo: "text",
                    class: "col-6 col-sm-3",
                    lbl: "Fecha de movimiento",
                },
                {
                    opc: "btn",
                    fn: "Buscar()",
                    color: 'primary',
                    text: "Buscar",
                    class: "col-sm-2",
                },
            ]

        };

        //  Combinar objetos
        let opts = Object.assign(defaults, options);
        $(`#${opts.parent}`).content_json_form({ data: opts.data, type: '', id: opts.id });



    }

    createTab(options) {
        let txt = "";

        var defaults = {
            data: [],
            id: "myTab",
            parent: "tabs",
        };

        // Carga opciones por defecto
        var opts = Object.assign({}, defaults, options);

        // Creamos el contenedor
        var div = $("<div>", {
            class: " ",
        });

        var ul = $("<ul>", {
            class: "nav nav-tabs",
            id: opts.id,
        });

        var div_content = $("<div>", {
            class: "tab-content ",
        });

        for (const x of opts.data) {
            let active = "";
            let tab_active = "";
            if (x.active) {
                active = "active";
                tab_active = "show active";
            }

            var li = $("<li>", {
                class: "nav-item",
            });

            // if(x.fn)



            // li.html(`<a class="nav-link ${active}"
            //     id="${x.id}-tab"  data-bs-toggle="tab" href="#${x.id}"  onclick="${x.fn}"> ${x.tab}</a>  `);
            li.append(
                $('<a>', {
                    class: "nav-link " + active,
                    id: x.id + "-tab",
                    "data-bs-toggle": "tab",
                    href: "#" + x.id,
                    onclick: x.fn,
                    text: x.tab
                })
            );
            var div_tab = $("<div>", {
                class: "tab-pane fade  mt-2 " + tab_active,
                id: x.id,
            });

            if (x.contenedor) {
                // let div_contenedor = $("<div>", {
                //     class: "row",
                // });

                for (const y of x.contenedor) {
                    var div_cont = $("<div>", {
                        class: y.class,
                        id: y.id,
                    });

                    div_tab.append(div_cont);
                }

                // div_tab.append(div_contenedor);
            }

            ul.append(li);
            div_content.append(div_tab);
        }

        div.append(ul);
        div.append(div_content);
        $(`#${opts.parent}`).html(div);
    }

    createLayaout(options = {}) {
        const defaults = {
            design: true,
            content: this._div_modulo,
            parent: '',
            clean: false,
            data: { id: "rptFormat", class: "col-12" },
        };

        const opts = Object.assign({}, defaults, options);
        const lineClass = opts.design ? ' block ' : '';

        const div = $("<div>", {
            class: opts.data.class,
            id: opts.data.id,
        });

        const row = opts.data.contenedor ? opts.data.contenedor : opts.data.elements;

        row.forEach(item => {
            let div_cont;

            switch (item.type) {

                case 'div':

                    div_cont = $("<div>", {
                        class: (item.class ? item.class : 'row') + ' ' + lineClass,
                        id: item.id,
                    });

                    if (item.children) {
                        item.children.forEach(child => {
                            child.class = (child.class ? child.class + ' ' : '') + lineClass;

                            if (child.type) {

                                div_cont.append($(`<${child.type}>`, child));

                            } else {

                                div_cont.append($("<div>", child));
                            }

                        });
                    }

                    div.append(div_cont);

                    break;

                default:

                    const { type, ...attr } = item;


                    div_cont = $("<" + item.type + ">", attr);

                    div.append(div_cont);
                    break;
            }
        });


        // aplicar limpieza al contenedor

        if (opts.clean)
            $("#" + opts.content ? opts.content : opts.parent).empty();


        if (!opts.parent) {
            $("#" + opts.content).html(div);
        } else {
            $("#" + opts.parent).html(div);
        }

    }

    createNavBar(options) {
        let defaults = {
            logoSrc: 'https://erp-varoch.com/DEV/src/img/user.png',
            logoAlt: 'logo',
            onLogoClick: 'location.reload()',
            onMenuClick: '#',
            themeClass: 'bg-dia',
            menuItems: [
                { icon: 'icon-sun-inv-1', visible: false },
                { icon: 'icon-bell', visible: false },
                {
                    icon: 'icon-mail',
                    visible: false,
                    submenu: '<div id="mensage"><li>Hola</li></div>'
                },
                {
                    id: 'li_user',
                    visible: true,
                    submenu: '<li onClick="redireccion(\'perfil/perfil.php\');"></li>'
                }
            ]
        };
        let opts = $.extend({}, defaults, options);
        // Create header element
        let $header = $('<header>', { class: opts.themeClass });
        // Create section for logo and menu button
        let $section = $('<section>')
            .append(

                $('<span>', {
                    type: 'button',
                    id: 'btnSidebar',
                    html: $('<i>', { class: 'icon-menu ' }),
                    click: function () {
                        if (opts.onMenuClick && typeof opts.onMenuClick === 'function') {
                            opts.onMenuClick();
                        }
                    }
                })

            )
            .append(


                $('<img>', {
                    class: 'd-block mx-4 w-10 h-10',
                    src: opts.logoSrc,
                    alt: opts.logoAlt,
                    click: function () {
                        if (opts.onLogoClick) {
                            eval(opts.onLogoClick);
                        }
                    }
                })
            );
        $header.append($section);

        // Create nav element
        let $nav = $('<nav>');
        let $ul = $('<ul>', { class: 'theme', id: 'navbar' });

        // Create menu items
        opts.menuItems.forEach((item, index) => {
            if (!item.visible) return; // Skip hidden items

            let $li = $('<li>', { id: item.id || null })
                .append($('<i>', { class: item.icon }));

            if (item.submenu) {
                let $submenu = $('<ul>').append(item.submenu);
                $li.append($submenu);
            }

            $ul.append($li);
        });

        $nav.append($ul);
        $header.append($nav);

        // Append to body or specific parent
        $(opts.parent || 'body').prepend($header);



    }


    createTableForm2(options) {

        // 📜 ** Definición de configuración por defecto **

        let defaults = {
            id: options.id || 'root', // Identificador de referencia
            parent: 'root',
            title: '',
            classForm: 'col-12 border rounded-3 p-3',
            success: (data) => { },
            table: {
                id: 'contentTable',
                parent: 'contentTable' + (options.id || 'root'),
                idFilterBar: 'filterBar',
                message: false,
                data: { opc: "ls" },
                conf: {
                    datatable: false,
                    fn_datatable: 'simple_data_table',
                    beforeSend: false,
                    pag: 10,
                },

            },

            form: {
                parent: 'contentForm',
                id: 'formRecetas',
                autovalidation: true,
                plugin: 'content_json_form',
                json: [
                    { opc: "input", lbl: "Nombre", id: "nombre", class: "col-12", tipo: "texto", required: true },
                    {
                        opc: "select", lbl: "Categoría", id: "categoria", class: "col-12", data: [

                            { id: "1", valor: "Platillo" },
                            { id: "2", valor: "Bebida" },
                            { id: "3", valor: "Extras" }
                        ]
                    },
                    { opc: "input", lbl: "Cantidad", id: "cantidad", class: "col-12", tipo: "numero" },
                    { opc: "btn-submit", id: "btnAgregar", text: "Agregar", class: "col-12" }
                ],

                success: (data) => { }



            },

            success: (data) => {

            }
        };

        let opts = this.ObjectMerge(defaults, options);
        let opts_table = Object.assign({}, defaults.table, options.table);

        // 🔵 Corrección del error en la asignación de `success`
        opts.form.success = (data) => {
            this.createTable(opts_table);
            opts.success(data);
            $('#contentForm')[0].reset();

        };

        // 📜 **Funciones para abrir y cerrar el formulario**
        const OpenForm = (form, tb, btn) => {
            $(tb).removeClass("col-md-12").addClass("col-md-8");
            $(form).parent().removeClass("d-none");
            $(btn).addClass("d-none");
        };

        const closeForm = (form, tb, btn) => {
            $(form).parent().addClass("d-none");
            $(tb).removeClass("col-md-8").addClass("col-md-12");
            $(btn).removeClass("d-none");
        };


        // 🔵 **Generación del Layout sin usar primaryLayout**


        let layout = `
        <div class="row p-2">

            <div class="col-12 col-md-4  m-0">

            <div class="${opts.classForm}" id="${opts.form.id}" novalidate>
                <div class="col-12 mb-2 d-flex justify-content-between">
                        <span class="fw-bold fs-5">${opts.title}</span>
                        <button type="button" class="btn-close" aria-label="Close" id="btnClose" ></button>
                        </div>
                        <form class="mt-3 " id="${opts.form.parent}" ></form>
                </div>

            </div>

            <div class="col-12 col-md-8" id="layoutTable">
            <div class="">
                <button type="button" class="btn btn-primary btn-sm d-none" id="addRecetasSub">
                <i class="icon-plus"></i></button>
            </div>

            <div class="m-0 p-0" id="${opts.table.parent}">
                <table class="table table-bordered table-hover table-sm">
                    <thead class="text-white">
                        <tr>
                            <th>Subreceta</th>
                            <th>Cantidad</th>
                            <th><i class="icon-cog"></i></th>
                        </tr>
                    </thead>
                    <tbody id="tbRecetasSub"></tbody>
                </table>
            </div>
            </div>
        </div>`;

        $("#" + opts.parent).append(layout);

        // 📜 **Asignar eventos después de agregar el layout**
        $("#btnClose").on("click", function () {
            closeForm(`#${opts.form.id}`, "#layoutTable", "#addRecetasSub");
        });

        $("#addRecetasSub").on("click", function () {
            OpenForm(`#${opts.form.id}`, "#layoutTable", "#addRecetasSub");
        });

        // Renderizar el formulario y la tabla
        this.createForm(opts.form);
        this.createTable(opts_table);
    }

    createTableForm(options) {
        let name = options.id ? options.id : 'tableForm';

        // 📜 ** Definición de configuración por defecto **


        let defaults = {
            id: name, // Identificador de referencia
            parent: 'root',
            title: '',
            classForm: 'col-12 border rounded-3 p-3',

            table: {
                id: 'contentTable' * name,
                parent: 'contentTable' + name,
                idFilterBar: 'filterBar',
                message: false,
                data: { opc: "ls" },

                conf: {
                    datatable: false,
                    fn_datatable: 'simple_data_table',
                    // beforeSend: false,
                    pag: 10,
                },

            },

            form: {
                parent: 'contentForm' + name,
                id: 'form' + name,
                autovalidation: true,
                plugin: 'content_json_form',
                json: [

                ],

                success: (data) => { }



            },

            success: (data) => {

            }
        };

        let opts = this.ObjectMerge(defaults, options);
        let opts_table = Object.assign({}, defaults.table, options.table);

        // 🔵 Corrección del error en la asignación de `success`
        opts.form.success = (data) => {
            this.createTable(opts_table);
            opts.success(data);
            $('#contentForm' + name)[0].reset();

        };

        // 📜 **Funciones para abrir y cerrar el formulario**
        const OpenForm = (form, tb, btn) => {
            $(tb).removeClass("col-md-12").addClass("col-md-8");
            $(form).parent().removeClass("d-none");
            $(btn).addClass("d-none");
        };

        const closeForm = (form, tb, btn) => {
            $(form).parent().addClass("d-none");
            $(tb).removeClass("col-md-8").addClass("col-md-12");
            $(btn).removeClass("d-none");
        };


        // 🔵 **Generación del Layout sin usar primaryLayout**


        let layout = `
        <div class="row p-2">

            <div class="col-12 col-md-4  m-0">

            <div class="${opts.classForm}" id="${opts.id}"  novalidate>
                <div class="col-12 mb-2 d-flex justify-content-between">
                        <span class="fw-bold fs-5">${opts.title}</span>
                        <button type="button" class="btn-close" aria-label="Close" id="btnClose" ></button>

                </div>
                        <form class="mt-3 " id="${opts.form.parent}" ></form>
            </div>

            </div>

            <div class="col-12 col-md-8" id="layoutTable">
            <div class="">
                <button type="button" class="btn btn-primary btn-sm d-none" id="addRecetasSub">
                <i class="icon-plus"></i></button>
            </div>

            <div class="m-0 p-0" id="${opts.table.parent}">

            </div>
            </div>
        </div>`;

        $("#" + opts.parent).append(layout);

        // 📜 **Asignar eventos después de agregar el layout**
        $("#btnClose").on("click", function () {
            closeForm(`#${opts.id}`, "#layoutTable", "#addRecetasSub");
        });

        $("#addRecetasSub").on("click", function () {
            OpenForm(`#${opts.id}`, "#layoutTable", "#addRecetasSub");
        });


        // Renderizar el formulario y la tabla
        this.createForm(opts.form);
        this.createTable(opts_table);
    }

    createCoffeTable(options) {
        const defaults = {
            theme: 'light',
            subtitle: null,
            dark: false,
            parent: "root",
            id: "coffeeSoftGridTable",
            title: null,
            data: { thead: [], row: [] },
            center: [],
            right: [],
            color_th: "bg-[#003360] text-gray-100",
            color_row: "bg-white hover:bg-gray-50",
            color_group: "bg-gray-200",
            class: "w-full table-auto text-sm text-gray-800",
            onEdit: () => { },
            onDelete: () => { },
            extends: true,
            f_size: 14,
            includeColumnForA: false,
            border_table: "border border-gray-300",
            border_row: "border-t border-gray-200",
            color_row_alt: "bg-gray-100",
            striped: false
        };

        if (options.theme === 'dark') {
            defaults.dark = true;
            defaults.color_th = "bg-[#374151] text-gray-300";
            defaults.color_row = "bg-[#283341]  ";
            defaults.color_group = "bg-[#334155] text-white";
            defaults.class = "w-full table-auto text-sm text-gray-300";
            defaults.border_table = "";
            defaults.border_row = "border-t border-gray-700";
            defaults.color_row_alt = "bg-[#111827]";
        } else if (options.theme === 'corporativo') {
            defaults.color_th = "bg-[#003360] text-white";
            defaults.color_row = "bg-white ";
            defaults.color_group = "bg-[#D0E3FF] ";
            defaults.class = "w-full table-auto text-sm ";
            defaults.border_table = "border border-gray-300";
            defaults.border_row = "border-t border-gray-300";
            defaults.color_row_alt = "bg-gray-200";
        } else {
            defaults.color_th = "bg-gray-100 text-gray-600";
            defaults.color_row = "bg-white hover:bg-gray-600";
            defaults.color_group = "bg-gray-200";
            defaults.class = "w-full table-auto text-sm text-gray-800";
            defaults.border_table = "border border-gray-300";
            defaults.border_row = "border-t border-gray-200";
            defaults.color_row_alt = "bg-gray-100";
        }

        const opts = Object.assign({}, defaults, options);
        const container = $("<div>", {
            class: "rounded-lg h-full table-responsive ",
        });

        if (opts.title) {
            const titleRow = $(`
            <div class="flex flex-col px-4 py-3  border-b ${opts.dark ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-white'}">
                <h2 class="text-base font-semibold ${opts.dark ? 'text-gray-100' : 'text-gray-800'}">${opts.title}</h2>
                ${opts.subtitle ? `<p class="text-sm ${opts.dark ? 'text-gray-400' : 'text-gray-600'} mt-1">${opts.subtitle}</p>` : ''}
            </div>`);
            container.append(titleRow);
        }

        const table = $("<table>", { id: opts.id, class: `border-separate border-spacing-0  ${opts.border_table} ${opts.class}` });
        const thead = $("<thead>");

        if (opts.data.thead) {
            if (opts.extends) {
                const columnHeaders = opts.data.thead;
                if (Array.isArray(columnHeaders)) {
                    const headerRow = $('<tr>');
                    columnHeaders.forEach(column => {
                        if (typeof column === 'string') {
                            headerRow.append(`<th class="text-center px-3 py-2 ${opts.color_th}">${column}</th>`);
                        } else {
                            const complexHeaderRow = $('<tr>');
                            Object.keys(column).forEach(key => {
                                const cell = (typeof column[key] === 'object')
                                    ? $('<th>', column[key])
                                    : $('<th>', { text: column[key], class: `text-center ${opts.color_th}` });
                                complexHeaderRow.append(cell);
                            });
                            thead.append(complexHeaderRow);
                        }
                    });
                    thead.append(headerRow);
                } else {
                    columnHeaders.forEach(columnGroup => {
                        const headerGroup = $("<tr>");
                        Object.keys(columnGroup).forEach(key => {
                            const cell = (typeof columnGroup[key] === 'object')
                                ? $('<th>', columnGroup[key])
                                : $('<th>', { text: key });
                            headerGroup.append(cell);
                        });
                        thead.append(headerGroup);
                    });
                }
            } else {
                const simpleHeaderRow = $('<tr>');
                opts.data.thead.forEach(header => {
                    simpleHeaderRow.append(`<th class="text-center px-3 py-2 capitalize ${opts.color_th}">${header}</th>`);
                });
                thead.append(simpleHeaderRow);
            }
        } else {
            const autoHeaderRow = $("<tr>");
            for (let clave in opts.data.row[0]) {
                if (clave != "opc" && clave != "id") {
                    clave = (clave == 'btn' || clave == 'btn_personalizado' || clave == 'a' || clave == 'dropdown') ? '<i class="icon-gear"> </i>' : clave;
                    autoHeaderRow.append($("<th>", {
                        class: `px-2 py-2 ${opts.color_th} capitalize text-center font-semibold`,
                        style: `font-size:${opts.f_size}px;`
                    }).html(clave));
                }
            }
            thead.append(autoHeaderRow);
        }

        table.append(thead);
        const tbody = $("<tbody>", { class: '' });

        opts.data.row.forEach((data, i) => {
            const colorBg = opts.striped && i % 2 === 0 ? opts.color_row_alt : opts.color_row;
            delete data.opc;

            const tr = $("<tr>", {
                class: ``,
            });

            Object.keys(data).forEach((key, colIndex) => {
                if (["btn", "a", "dropdown", "id"].includes(key)) return;

                const align =
                    opts.center.includes(colIndex) ? "text-center" :
                        opts.right.includes(colIndex) ? "text-right" : "text-left";

                let tdText = data[key];
                let cellAttributes = {
                    id: `${key}_${data.id}`,
                    style: `font-size:${opts.f_size}px;`,
                    class: `${align} ${opts.border_row} px-3 py-2 truncate ${colorBg}`,
                    html: tdText
                };



                // Si opts.extends está activo y data[key] es objeto, sobrescribe atributos
                if (opts.extends && typeof data[key] === 'object' && data[key] !== null) {
                    cellAttributes = Object.assign(cellAttributes, data[key]);
                    cellAttributes.class += ` ${opts.border_row} ${colorBg}`;
                }

                tr.append($("<td>", cellAttributes));
            });

            let actions = '';

            if (data.a?.length) {
                actions = $("<td>", { class: `px-3 py-2  w-15 relative text-end justify-end items-center ${colorBg} ${opts.border_row}` });
                data.a.forEach(atributos => {

                    const button_a = $("<a>", atributos);
                    actions.append(button_a);
                });
                tr.append(actions);
            }

            if (data.dropdown) {
                actions = $("<td>", {
                    class: `px-2 py-2 w-10 relative justify-center items-center ${colorBg} ${opts.border_row}`
                });

                const wrapper = $("<div>", {
                    class: "relative"
                });

                const btn = $("<button>", {
                    class: "icon-dot-3 text-gray-200 hover:text-gray-600",
                    click: function (e) {
                        e.stopPropagation();
                        $("ul.dropdown-menu").hide(); // cerrar todos los menús antes
                        $(this).next("ul").toggle();  // abrir solo el actual
                    }
                });

                const menu = $("<ul>", {
                    class: "dropdown-menu absolute top-full right-0 mt-2 w-44 z-10 bg-[#1F2A37] border rounded-md shadow-md hidden"
                });

                data.dropdown.forEach((item) =>
                    menu.append(`
                        <li>
                            <a onclick="${item.onclick}" class="block px-4 py-2 text-sm hover:bg-[#283341] text-gray-200 text-left">
                                <i class="${item.icon}"></i> ${item.text}
                            </a>
                        </li>
                    `)
                );

                wrapper.append(btn, menu);
                actions.append(wrapper);

                // Cerrar todos los dropdowns al hacer clic fuera
                $(document).on("click", () => {
                    $("ul.dropdown-menu").hide();
                });
            }

            tr.append(actions);
            tbody.append(tr);
        });

        table.append(tbody);
        container.append(table);
        $(`#${opts.parent}`).html(container);

        $("<style>").text(`
        #${opts.id} th:first-child { border-top-left-radius: 0.5rem; }
        #${opts.id} th:last-child { border-top-right-radius: 0.5rem; }
        #${opts.id} tr:last-child td:first-child { border-bottom-left-radius: 0.5rem; }
        #${opts.id} tr:last-child td:last-child { border-bottom-right-radius: 0.5rem; }
        `).appendTo("head");
    }

    tabLayout(options) {
        const defaults = {
            parent: "root",
            id: "tabComponent",
            type: "large", // 'short' | 'large'
            theme: "light", // 'dark' | 'light'
            class: "",
            tab: {
                size: 'px-3 py-2',
            },
            content: { class:'',id:''},
            renderContainer: true,

            json: [
                { id: "TAB1", tab: "TAB1", icon: "", active: true, onClick: () => { } },
                { id: "TAB2", tab: "TAB2", icon: "", onClick: () => { } },
            ]
        };

        const opts = Object.assign({}, defaults, options);

        const themes = {
            dark: {
                base: "bg-[#19232D] text-white",
                active: "bg-blue-600 text-white",
                inactive: "text-gray-300 hover:bg-gray-700"
            },
            light: {
                base: "bg-gray-200 text-black",
                active: "bg-white text-black",
                inactive: "text-gray-600 hover:bg-white"
            }
        };

        const sizes = {
            large: "rounded-lg flex gap-1 px-1 py-1 w-full text-sm ",
            short: "rounded-lg flex  gap-1 p-1  px-1 py-1 text-sm "
        };

        const container = $("<div>", {
            id: opts.id,
            class: `${themes[opts.theme].base} ${sizes[opts.type]} ${opts.class}`
        });

        const equalWidth = opts.type === "short" ? `` : `flex-1`;

        opts.json.forEach(tab => {
            const isActive = tab.active || false;

            const tabButton = $("<button>", {
                id: `tab-${tab.id}`,
                html: tab.icon ? `<i class='${tab.icon} mr-2 h-4 w-4'></i>${tab.tab}` : tab.tab,
                class: `${opts.type === "short" ? "" : "flex-1"} flex items-center justify-center gap-2 ${opts.tab.size} rounded-lg text-sm font-medium transition
                 data-[state=active]:${themes[opts.theme].active} ${themes[opts.theme].inactive}`,
                "data-state": isActive ? "active" : "inactive",
                click: () => {
                    $(`#${opts.id} button`).each(function () {
                        $(this).attr("data-state", "inactive").removeClass(themes[opts.theme].active).addClass(themes[opts.theme].inactive);
                    });

                    tabButton.attr("data-state", "active").removeClass(themes[opts.theme].inactive).addClass(themes[opts.theme].active);

                    if (opts.renderContainer) {
                        $(`#content-${opts.id} > div`).addClass("hidden");
                        $(`#container-${tab.id}`).removeClass("hidden");
                    }

                    if (typeof tab.onClick === "function") tab.onClick(tab.id);
                }
            });

            container.append(tabButton);
        });

        $(`#${opts.parent}`).html(container);

        if (opts.renderContainer) {
            const contentContainer = $("<div>", {
                id: `content-${opts.id}`,
                class: `mt-2 ${opts.content.class}`,
            });

            opts.json.forEach(tab => {
                const contentView = $("<div>", {
                    id: `container-${tab.id}`,
                    class: `hidden  p-3 h-full rounded-lg`,
                    html: tab.content || ""
                });
                contentContainer.append(contentView);
            });

            $(`#${opts.parent}`).append(contentContainer);

            const activeTab = opts.json.find(t => t.active);
            if (activeTab) {
                $(`#container-${activeTab.id}`).removeClass("hidden");
            }
        }
    }

    navBar(options) {
        const defaults = {
            id: "navBar",
            theme: "light", // "light" | "dark" (Huubie)
            class: "h-[56px] px-4 shadow-md",
            logoFull: "https://erp-varoch.com/ERP24/src/img/logos/logo_row_wh.png",
            logoMini: "https://erp-varoch.com/ERP24/src/img/logos/logo_icon_wh.png",
            user: {
                name: "Sergio Osorio",
                photo: "https://huubie.com.mx/alpha/src/img/perfil/fotoUser26_20250803_120920.png",
                onProfile: () => redireccion('perfil/perfil.php'),
                onLogout: () => cerrar_sesion()
            },
            apps: [
                { icon: "icon-calculator", name: "Contabilidad", color: "text-indigo-400" },
                { icon: "icon-box", name: "Inventario", color: "text-blue-600" },
                { icon: "icon-cart", name: "Ventas", color: "text-green-600" },
                { icon: "icon-bag", name: "Compras", color: "text-yellow-600" },
                { icon: "icon-users", name: "Recursos", color: "text-pink-600" },
                { icon: "icon-chart", name: "Reportes", color: "text-purple-600" },
                { icon: "icon-handshake", name: "CRM", color: "text-red-600" },
                { icon: "icon-industry", name: "Producción", color: "text-orange-600" },
                { icon: "icon-cog", name: "Configuración", color: "text-gray-600" }
            ]
        };

        const opts = Object.assign({}, defaults, options);

        // ===== THEME: Huubie Dark =====
        const isDark = String(opts.theme).toLowerCase() === "dark";
        const colors = {
            navbar: isDark ? "bg-[#0F172A] text-white" : "bg-[#0A2B4B] text-white", // Huubie dark slate-900 / Light azul prof.
            dropdownBg: isDark ? "bg-[#1E293B] text-white" : "bg-white text-gray-800",
            hoverText: isDark ? "hover:text-blue-400" : "hover:text-blue-200",
            userHover: isDark ? "hover:bg-slate-700" : "hover:bg-blue-100",
            userBg: isDark ? "bg-[#1E293B]" : "bg-white",
            border: isDark ? "border border-slate-600" : "border border-gray-200",
            chipBg: isDark ? "bg-slate-700" : "bg-gray-100"
        };

        // NAVBAR
        const header = $("<header>", {
            id: opts.id,
            class: `${colors.navbar} ${opts.class} flex justify-between items-center w-full fixed top-0 left-0 z-40`
        });

        const left = $("<div>", { class: "flex items-center gap-4" }).append(
            $("<span>", {
                id: "btnSidebar",
                html: `<i class="icon-menu text-2xl cursor-pointer ${colors.hoverText}"></i>`
            }),
            $("<img>", {
                src: opts.logoFull,
                class: "h-8 hidden sm:block cursor-pointer",
                click: () => location.reload()
            }),
            $("<img>", {
                src: opts.logoMini,
                class: "h-8 block sm:hidden cursor-pointer",
                click: () => location.reload()
            })
        );

        const launcherButton = $("<div>", {
            id: "launcherBtn",
            class: `relative ${colors.hoverText} text-xl cursor-pointer`,
            html: `<i class="icon-th-3"></i>`,
            click: (e) => {
                e.stopPropagation();
                $("#appsLauncher").toggleClass("hidden");
            }
        });

        // USER (click para abrir menú)
        const user = $("<div>", {
            class: "flex items-center gap-2 ml-4 cursor-pointer relative",
            id: "userDropdown"
        }).append(
            $("<img>", {
                src: opts.user.photo,
                class: "w-9 h-9 rounded-full border-2 border-white shadow"
            }),
            $("<span>", {
                class: "hidden sm:block font-medium text-sm",
                text: opts.user.name
            }),
            $("<ul>", {
                id: "userMenu",
                class: `hidden fixed top-16 right-4 w-[280px] ${colors.dropdownBg} rounded-lg ${colors.border} shadow p-2 z-50`
            }).append(
                $("<li>", {
                    class: `px-3 py-2 rounded ${colors.userHover} cursor-pointer flex items-center gap-2`,
                    html: `<i class="icon-user"></i><span>Mi perfil</span>`,
                    click: opts.user.onProfile
                }),
                $("<li>", { class: `my-1 ${colors.border}` }),
                $("<li>", {
                    class: `px-3 py-2 rounded ${colors.userHover} cursor-pointer flex items-center gap-2`,
                    html: `<i class="icon-off"></i><span>Cerrar sesión</span>`,
                    click: opts.user.onLogout
                })
            )
        );

        const right = $("<div>", {
            class: "flex items-center gap-3 relative"
        }).append(launcherButton, user);

        header.append(left, right);
        $("body").prepend(header);

        // APPS LAUNCHER (Huubie dark)
        const launcher = $("<div>", {
            id: "appsLauncher",
            class: `hidden fixed top-16 right-4 w-[320px] ${colors.dropdownBg} rounded-lg ${colors.border} shadow p-4 z-50`
        }).append(
            $("<div>", { class: "mb-3 flex items-center justify-between" }).append(
                $("<h3>", { class: "text-sm font-semibold", text: "Módulos ERP" }),
                $("<span>", { class: `text-[10px] px-2 py-1 rounded ${colors.chipBg} opacity-80`, text: "Huubie UI" })
            ),
            $("<div>", { class: "grid grid-cols-3 gap-3" }).append(
                ...opts.apps.map(app =>
                    $("<button>", {
                        type: "button",
                        class: `flex flex-col items-center gap-2 text-xs px-2 pt-2 pb-3 rounded hover:scale-105 transition ${colors.userHover}`
                    }).append(
                        $("<div>", {
                            class: `w-12 h-12 rounded-lg flex items-center justify-center text-xl ${app.color} ${colors.chipBg}`
                        }).append($("<i>", { class: app.icon })),
                        $("<span>", { class: "opacity-90", text: app.name })
                    )
                )
            )
        );

        $("body").append(launcher);

        // Eventos de toggle/cierre (user & launcher)
        $("#userDropdown").on("click", function (e) {
            e.stopPropagation();
            $("#userMenu").toggleClass("hidden");
            $("#appsLauncher").addClass("hidden");
        });

        $(document).on("click", (e) => {
            if (!$(e.target).closest("#launcherBtn").length && !$(e.target).closest("#appsLauncher").length) {
                $("#appsLauncher").addClass("hidden");
            }
            if (!$(e.target).closest("#userDropdown").length && !$(e.target).closest("#userMenu").length) {
                $("#userMenu").addClass("hidden");
            }
        });
    }

    // Graficos.
    dashboardComponent(options) {
        const defaults = {
            parent: "root",
            id: "dashboardComponent",
            title: "📊 Huubie · Dashboard de Eventos",
            subtitle: "Resumen mensual · Cotizaciones · Pagados · Cancelados",
            json: [
                { type: "card", id: "infoCards", class: '' },
                { type: "grafico", id: "barChartContainer", title: "Eventos por sucursal" },
                { type: "tabla", id: "tableSucursal", title: "Tabla de sucursales" },
                { type: "grafico", id: "donutChartContainer", title: "Ventas vs Entrada de dinero" },
                { type: "grafico", id: "topClientsChartContainer", title: "Top 10 clientes" },
                { type: "tabla", id: "tableClientes", title: "Tabla de clientes" }
            ]
        };

        const opts = Object.assign(defaults, options);

        const container = $(`
        <div id="${opts.id}" class="w-full bg-[#111928] text-white">
            <!-- Header -->
            <header class="bg-[#0F172A] p-6 border-b border-[#1E293B] ">
                <div class="max-w-7xl mx-auto">
                    <h1 class="text-2xl font-semibold text-white">${opts.title}</h1>
                    <p class="text-sm text-slate-300">${opts.subtitle}</p>
                </div>
            </header>

            <!-- FilterBar -->
            <div id="filterBarDashboard" class="max-w-7xl mx-auto px-4 py-4  ">
          
            </div>

             <section id="cardDashboard" class="max-w-7xl mx-auto px-4 py-4 ">
              
            </section>

            <!-- Content -->
            <section id="content-${opts.id}" class="max-w-7xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-2"></section>
        </div>`);

        // Renderizar contenedores desde JSON
        opts.json.forEach(item => {
            let block = $("<div>", {
                id: item.id,
                class: "bg-slate-800 p-4 rounded-xl shadow min-h-[200px]"
            });

            if (item.title) {
                // Emojis por defecto según el tipo
                const defaultEmojis = {
                    'grafico': '📊',
                    'tabla': '📋',
                    'doc': '📄',
                    'filterBar': '🔍'
                };

                // Usar emoji personalizado o por defecto
                const emoji = item.emoji || defaultEmojis[item.type] || '';

                // Usar icono si está definido
                const iconHtml = item.icon ? `<i class="${item.icon}"></i> ` : '';

                // Construir el título con emoji e icono
                const titleContent = `${emoji} ${iconHtml}${item.title}`;

                block.prepend(`<h3 class="text-sm font-semibold mb-3">${titleContent}</h3>`);
            }

            // Procesar contenido personalizado antes de agregar el bloque
            if (item.content && Array.isArray(item.content)) {
                item.content.forEach(contentItem => {
                    const element = $(`<${contentItem.type}>`, {
                        id: contentItem.id || '',
                        class: contentItem.class || '',
                        text: contentItem.text || ''
                    });

                    // Agregar atributos adicionales si existen
                    if (contentItem.attributes) {
                        Object.keys(contentItem.attributes).forEach(attr => {
                            element.attr(attr, contentItem.attributes[attr]);
                        });
                    }

                    // Agregar HTML interno si existe
                    if (contentItem.html) {
                        element.html(contentItem.html);
                    }

                    // Agregar el contenido directamente al bloque
                    block.append(element);
                });
            }

            $(`#content-${opts.id}`, container).append(block);
        });

        $(`#${opts.parent}`).html(container);
    }

    cardsDashboard(options) {
        const defaults = {
            parent: "root",
            id: "infoCardKPI",
            class: "",
            theme: "light", // light | dark
            json: [],
            data: {
                value: "0",
                description: "",
                color: "text-gray-800"
            },
            onClick: () => { }
        };

        const opts = Object.assign({}, defaults, options);

        const isDark = opts.theme === "dark";

        const cardBase = isDark
            ? "bg-[#1F2A37] text-white rounded-xl shadow"
            : "bg-white text-gray-800 rounded-xl shadow";

        const titleColor = isDark ? "text-gray-300" : "text-gray-600";
        const descColor = isDark ? "text-gray-400" : "text-gray-500";

        const renderCard = (card, i = "") => {
            const box = $("<div>", {
                id: `${opts.id}_${i}`,
                class: `${cardBase} p-4`
            });

            const title = $("<p>", {
                class: `text-sm ${titleColor}`,
                text: card.title
            });

            const value = $("<p>", {
                id: card.id || "",
                class: `text-2xl font-bold ${card.data?.color || "text-white"}`,
                text: card.data?.value
            });

            const description = $("<p>", {
                class: `text-xs mt-1 ${card.data?.color || descColor}`,
                text: card.data?.description
            });

            box.append(title, value, description);
            return box;
        };

        const container = $("<div>", {
            id: opts.id,
            class: `grid grid-cols-2 md:grid-cols-4 gap-4 ${opts.class}`
        });

        if (opts.json.length > 0) {
            opts.json.forEach((item, i) => {
                container.append(renderCard(item, i));
            });
        } else {
            container.append(renderCard(opts));
        }

        $(`#${opts.parent}`).html(container);
    }

    barChart(options) {
        const defaults = {
            parent: "containerChequePro",
            id: "chart",
            title: "",
            class: "border p-4 rounded-xl",
            data: {},
            json: [],
            onShow: () => { },
        };

        const opts = Object.assign({}, defaults, options);

        // 🔹 Eliminar instancia previa de Chart.js si existe
        if (!window._charts) window._charts = {};
        if (window._charts[opts.id]) {
            window._charts[opts.id].destroy();
            delete window._charts[opts.id];
        }

        // 🔹 Crear nuevo contenedor
        const newContainer = $("<div>", {
            id: opts.id + "-container",
            class: opts.class
        });

        const title = $("<h2>", {
            class: "text-lg font-bold mb-3",
            text: opts.title
        });

        const canvas = $("<canvas>", {
            id: opts.id,
            class: "w-full h-[150px]"
        });

        newContainer.append(title, canvas);

        // 🔹 Si el contenedor ya existe → reemplazar, si no → append
        const existing = $("#" + opts.id + "-container");
        if (existing.length) {
            existing.replaceWith(newContainer);
        } else {
            $("#" + opts.parent).append(newContainer);
        }

        // 🔹 Crear gráfico
        const ctx = document.getElementById(opts.id).getContext("2d");
        window._charts[opts.id] = new Chart(ctx, {
            type: "bar",
            data: opts.data,
            options: {
                responsive: true,
                aspectRatio: 3,
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => formatPrice(v) }
                    }
                }
            }
        });
    }


    linearChart(options) {
        const defaults = {
            parent: "containerLineChart",
            id: "linearChart",
            title: "",
            class: "border p-3 rounded-xl",
            data: {},   // <- puede contener { labels: [], datasets: [], tooltip: [] }
            json: [],
            onShow: () => { },
        };

        const opts = Object.assign({}, defaults, options);

        const container = $("<div>", { class: opts.class });
        const title = $("<h2>", {
            class: "text-lg font-bold mb-2",
            text: opts.title
        });
        const canvas = $("<canvas>", {
            id: opts.id,
            class: "w-full h-[150px]"
        });

        container.append(title, canvas);
        $('#' + opts.parent).append(container);

        const ctx = document.getElementById(opts.id).getContext("2d");
        if (!window._charts) window._charts = {};
        if (window._charts[opts.id]) {
            window._charts[opts.id].destroy();
        }

        window._charts[opts.id] = new Chart(ctx, {
            type: "line",
            data: opts.data,
            options: {
                responsive: true,
                aspectRatio: 3,
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                const index = items[0].dataIndex;
                                const tooltips = opts.data.tooltip || opts.data.labels;
                                return tooltips[index];
                            },
                            label: (ctx) => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}`
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        anchor: 'end',
                        color: '#1E3A8A',
                        font: {
                            weight: 'bold',
                            size: 12
                        },
                        formatter: (value) => value
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (v) => v
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    payChart(options) {
        const defaults = {
            parent: "containerPayChart",
            id: "payChart",
            title: "",
            class: "border p-3 rounded-xl",
            data: {},
        };

        const opts = Object.assign({}, defaults, options);

        const container = $("<div>", { class: opts.class });
        const title = $("<h2>", {
            class: "text-lg font-bold mb-2",
            text: opts.title
        });
        const canvas = $("<canvas>", {
            id: opts.id,
            class: "w-full h-[200px]"
        });

        container.append(title, canvas);
        $("#" + opts.parent).append(container);

        const ctx = document.getElementById(opts.id).getContext("2d");
        if (!window._charts) window._charts = {};
        if (window._charts[opts.id]) {
            window._charts[opts.id].destroy();
        }

        window._charts[opts.id] = new Chart(ctx, {
            type: "doughnut",
            data: opts.data,
            options: {
                responsive: true,
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${formatPrice(ctx.parsed)}`
                        }
                    }
                }
            }
        });
    }



    



}

class Templates extends Components {
    constructor(link, div_modulo) {
        super(link, div_modulo);
    }

    createLayaout(options = {}) {
        const defaults = {
            design: true,
            content: this._div_modulo,
            parent: '',
            clean: false,
            data: { id: "rptFormat", class: "col-12" },
        };

        const opts = Object.assign({}, defaults, options);
        const lineClass = opts.design ? ' block ' : '';

        const div = $("<div>", {
            class: opts.data.class,
            id: opts.data.id,
        });

        const row = opts.data.contenedor ? opts.data.contenedor : opts.data.elements;

        row.forEach(item => {
            let div_cont;

            switch (item.type) {

                case 'div':

                    div_cont = $("<div>", {
                        class: (item.class ? item.class : 'row') + ' ' + lineClass,
                        id: item.id,
                    });

                    if (item.children) {
                        item.children.forEach(child => {
                            child.class = (child.class ? child.class + ' ' : '') + lineClass;

                            if (child.type) {

                                div_cont.append($(`<${child.type}>`, child));

                            } else {

                                div_cont.append($("<div>", child));
                            }

                        });
                    }

                    div.append(div_cont);

                    break;

                default:

                    const { type, ...attr } = item;


                    div_cont = $("<" + item.type + ">", attr);

                    div.append(div_cont);
                    break;
            }
        });


        // aplicar limpieza al contenedor

        if (opts.clean)
            $("#" + opts.content ? opts.content : opts.parent).empty();


        if (!opts.parent) {
            $("#" + opts.content).html(div);
        } else {
            $("#" + opts.parent).html(div);
        }

    }

    createPlantilla(options) {

        let json_components = {
            id: "mdlGastos",
            class: "card-body row m-2",

            contenedor: [
                {
                    type: "form",
                    id: "formGastos",
                    class: " col-lg-4  block pt-2",
                    novalidate: true,
                },

                {
                    type: "div",
                    id: "contentGast",
                    class: "col-lg-8 ",
                    children: [
                        { class: 'col-12', id: 'filterGastos' },
                        { class: 'col-12', id: 'tableGastos' }
                    ]
                },
            ]
        };


        var defaults = { data: json_components, design: true };
        let opts = Object.assign(defaults, options);
        this.createLayaout(opts);

    }

    splitLayout(options) {
        let name = options.id ? options.id : 'splitLayout';
        // ConfiguraciÃ³n por defecto
        let defaults = {
            id: name,
            parent: this._div_modulo,
            className: "flex flex-col w-full h-full p-1",

            filterBar: {
                id: 'filterBar' + name,
                class: 'w-full h-1/4  line',
                text: 'filterBar'
            },

            container: {

                id: 'container' + name,
                class: 'flex h-2/4 w-full flex-grow ',

                children: [
                    { class: 'w-1/2 line', id: 'left' + name, text: 'splitlayout' },
                    { class: 'w-1/2 line', id: 'right' + name }
                ],

            },

            footer: {
                id: 'footer' + name,
                class: 'w-full h-1/4  line',
            },
        };



        // Combina los valores predeterminados con las opciones proporcionadas
        const opts = this.ObjectMerge(defaults, options);

        // Construye el objeto JSON de componentes
        let jsonComponents = {
            id: opts.id,
            class: opts.className,
            contenedor: [
                {
                    type: 'div',
                    ...opts.filterBar, // Barra de filtros
                },
                {
                    type: 'div',
                    ...opts.container, // Contenedor central
                    children: opts.container.children.map((child) => ({
                        type: 'div',
                        ...child, // Mapea cada hijo del contenedor
                    })),
                },
                {
                    type: 'div',
                    ...opts.footer, // Pie de pÃ¡gina
                },
            ],
        };

        // Crea la plantilla con los datos generados
        this.createPlantilla({
            data: jsonComponents,
            parent: opts.parent,
            design: false,
        });
    }

    primaryLayout(options) {
        const name = options.id ? options.id : 'primaryLayout';

        // 🎯 Presets de altura para diferentes layouts
        const heightPresets = {
            'full': 'min-h-screen',
            'viewport': 'h-[calc(100vh-120px)]',
            'compact': 'h-[calc(100vh-200px)]',
            'auto': 'h-auto'
        };

        // Determinar la altura basada en el preset o usar la clase personalizada
        const heightClass = options.heightPreset 
            ? heightPresets[options.heightPreset] || heightPresets['viewport']
            : (options.class?.includes('h-') ? '' : heightPresets['viewport']);

        let defaults = {
            id: name,
            parent: this._div_modulo,
            class: `d-flex mx-2 my-2 ${heightClass}`,
            heightPreset: 'viewport', // Default preset
            card: {
                name: "singleLayout",
                class: "flex flex-col col-12",
                filterBar: { class: 'w-full my-3 ', id: 'filterBar' + name },
                container: { class: 'w-full my-3 bg-[#1F2A37] rounded-lg h-[calc(100vh-20rem)] ', id: 'container' + name }
            }
        };


        // Mezclar opciones con valores predeterminados
        const opts = this.ObjectMerge(defaults, options);

        // 🔧 Aplicar preset de altura si no se especifica clase personalizada
        if (opts.heightPreset && !opts.class.includes('h-')) {
            const presetHeight = heightPresets[opts.heightPreset] || heightPresets['viewport'];
            opts.class = opts.class.replace(/h-\S+/g, '').trim() + ` ${presetHeight}`;
        }


        this.createPlantilla({
            data: {
                id: opts.id,
                class: opts.class,
                contenedor: [
                    {
                        type: "div",
                        id: opts.card.name,
                        class: opts.card.class,
                        children: [
                            { type: "div", class: opts.card.filterBar.class, id: opts.card.filterBar.id },
                            { type: "div", class: opts.card.container.class, id: opts.card.container.id }
                        ]
                    }
                ]
            }, parent: opts.parent, design: false
        });

    }

    verticalLinearLayout(options) {

        let defaults = {
            id: '',
            parent: this._div_modulo,
            className: "flex m-2 ",


            card: {
                id: "singleLayout",
                className: "w-full",
                filterBar: { className: 'w-full  line', id: 'filterBar' },
                container: { className: 'w-full my-2 line', id: 'container' },
                footer: { className: 'w-full my-2 line', id: 'footer' },
            }


        };


        const opts = this.ObjectMerge(defaults, options);
        let jsonComponents = {
            id: opts.id,
            class: opts.className,
            contenedor: [
                {
                    type: "div",
                    id: opts.card.id,
                    class: opts.card.className,
                    children: [
                        { class: opts.card.filterBar.className, id: opts.card.filterBar.id },
                        { class: opts.card.container.className, id: opts.card.container.id },
                        { class: opts.card.footer.className, id: opts.card.footer.id },
                    ],
                },
            ],
        };
        this.createPlantilla({ data: jsonComponents, parent: opts.parent, design: false });
    }

    secondaryLayout(components) {
        let name = components.id ? components.id : 'secondaryLayout';


        let nameComponent = {
            name: name,
            parent: this._div_modulo,
            className: 'flex p-2 ',
            cardtable: {
                className: 'col-7 line',
                id: 'containerTable' + name,
                filterBar: { id: 'filterTable', className: 'col-12 mb-2 line' },
                container: { id: 'listTable', className: 'col-12 line' },
            },
            cardform: {
                className: 'col-5 line',
                id: 'containerForm' + name,

            },
        };

        let ui = this.ObjectMerge(nameComponent, components);

        let jsonComponents = {
            id: ui.name,
            class: ui.className,

            contenedor: [

                {
                    type: 'div',
                    id: ui.cardform.id,
                    class: ui.cardform.className,

                },

                {
                    type: "div",
                    id: ui.cardtable.id,
                    class: ui.cardtable.className,
                    children: [
                        { class: ui.cardtable.filterBar.className, id: ui.cardtable.filterBar.id },
                        { class: ui.cardtable.container.className, id: ui.cardtable.container.id },
                    ]
                },


            ],
        };

        this.createPlantilla({
            data: jsonComponents,
            parent: ui.parent,
            design: false
        });
    }

    tabsLayout(components) {
        let jsonTabs = [
            { tab: "tab-1", id: "tab-1", active: true },
            { tab: "tab-2", id: "tab-2" },
        ];
        let defaults = {
            parent: 'tabsLayout',
            id: 'tabs',
            json: jsonTabs
        };

        let opts = Object.assign(defaults, components);
        $(`#${opts.parent}`).simple_json_tab({ data: opts.json });
    }


}


async function useFetch(options = {}) {

    // Valores predeterminados
    let defaults = {

        method: 'POST',
        data: { opc: 'ls' },
        url: '',
        success: null

    };

    // Mezclar los valores predeterminados con las opciones proporcionadas
    let opts = Object.assign({}, defaults, options);

    // Validar que la URL estÃ© definida
    if (!opts.url) {
        console.error('URL es obligatoria.');
        return null;
    }

    try {
        // Realizar la peticiÃ³n fetch
        let response = await fetch(opts.url, {
            method: opts.method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(opts.data),
        });

        // Procesar la respuesta como JSON
        let data = await response.json();

        // Si se proporciona el mÃ©todo success, lo ejecutamos con los datos obtenidos
        if (typeof opts.success === 'function') {
            opts.success(data);
        }

        // Retornar los datos por si se quieren usar fuera de la funciÃ³n success
        return data;
    } catch (error) {
        console.error('Error en la petición:', error);
        return null;
    }
}

function formDataToJson(formData) {
    let obj = {};
    formData.forEach((value, key) => {
        // Si el objeto ya tiene una propiedad con ese nombre, la convierte en un array
        if (obj[key]) {
            // Si ya es un array, agrega el nuevo valor
            if (Array.isArray(obj[key])) {
                obj[key].push(value);
            } else {
                obj[key] = [obj[key], value];
            }
        } else {
            obj[key] = value;
        }
    });
    return obj;
}

