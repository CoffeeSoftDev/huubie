class Complements {

    constructor(link, div_modulo) {
        this._link = link;
        this._div_modulo = div_modulo;
    }


    // Operations.

    toggleEstatus(options) {

        let defaults = {
            idButton: 'btnEstatus',
            id: 1,
            data: {
                opc: 'setEstatus'
            },
        };
        
        const opts = Object.assign(defaults, options);

        // Obtiene el icono dentro del botón
        let button = document.getElementById(opts.idButton + opts.id);

        let icon = button.querySelector('i');
        let estatus = button.getAttribute('estatus');


        // Alterna las clases del icono entre "icon-toggle-on" y "icon-toggle-off"
        if (icon.classList.contains('icon-toggle-on')) {

            icon.classList.remove('icon-toggle-on');
            icon.classList.add('icon-toggle-off');
        } else {

            icon.classList.remove('icon-toggle-off');
            icon.classList.add('icon-toggle-on');
        }

        let nuevoEstatus = estatus === '1' ? '0' : '1';


        fn_ajax({ ...opts.data, nuevoEstado: nuevoEstatus, id: opts.id }, this._link).then((data) => {

            button.setAttribute('estatus', nuevoEstatus);

            if (opts.success) opts.success(data)

        });



    }

    /* Plantilla para crear Layaouts */

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


    /*
     plantilla para activar un sweet alert
    */

    swalQuestion(options = {}) {


        /*--  plantilla --*/

        let objSwal = {
            title: "",
            text: " ",
            icon: "warning",

            showCancelButton: true,
            confirmButtonText: "Aceptar",
            cancelButtonText: "Cancelar",
            ...options.opts
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
                            // Obtener las llaves de los métodos
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

    createDivs(options = {}) {

        var defaults = {
            data: { id: "rptFormat", class: "col-12" },


            div_content: this._div_modulo,

        };

        var opts = Object.assign(defaults, options);

        var div = $("<div>", {
            class: opts.data.class,
            id: opts.data.id,
        });

        let row = opts.data;


        for (const x of row.contenedor) {

            var div_cont = $("<div>", {
                class: x.class,
                id: x.id,
            });

            div.append(div_cont);
        }



        $("#" + opts.div_content).html(div);
    }

    /*getter and setter variables */
    static _data_modal = {};
    /*getter and setter metodos*/
    set data_modal(valor) {
        this._data_modal = valor;
    }
    set attr_content_table(valor) {
        this._attr_content_table = valor;
    }


    // Metodo para un lsSearchFilter :
    static _dataSearchTable = {};
    _idFilterBar = 'filterBar';


    set dataSearchTable(valor) {
        this._dataSearchTable = valor;
    }

    set idFilterBar(valor) {
        this._idFilterBar = valor;
    }


    searchTable(options = {}) {

        var defaults = {
            tipo: "text",


        };

        var opts = Object.assign(defaults, this._dataSearchTable);
        var extendsAjax = null; // extender la funcion ajax 

        $("#" + this._idFilterBar).validar_contenedor(opts, (datos) => {


            extendsAjax = fn_ajax(datos, this._link, "#" + options.id);

            if (!options.extends) { // si la variable extends no esta definida se ejectuta de forma normal

                extendsAjax.then((data) => {

                    let attr_table_filter = {
                        data: data,
                        f_size: '12',
                        id: 'tbSearch'
                    };

                    attr_table_filter = Object.assign(attr_table_filter, this._attr_table);
                    $("#" + options.id).rpt_json_table2(attr_table_filter);

                    if (options.datatable)
                        simple_data_table_no("#" + attr_table_filter.id, 10);

                });

            }

        });


        if (options.extends) {
            return extendsAjax;
        }


    }


    sendAjaxx(data, div = '') {

        let isFormData = data instanceof FormData;
        let objType = {};
        let datos = {};

        //Tipo de objeto data que se recibe:

        if (isFormData) {

            objType = {
                contentType: false,
                processData: false,
                cache: false,
            };

            datos = data;

        } else {

            datos = {
                opc: 'ls',
                ...data // combina los elementos 
            };

        }

        // verificar before send
        let objBeforeSend = {};


        if (div !== '') objBeforeSend = { beforeSend: () => $('#' + div).Loading(this.objLoading) };

        //Ejecutar ajax con una promesa : 
        return new Promise(function (resolve, reject) {
            console.log('link', this.link);

            $.ajax({
                type: "POST",
                url: this._link,
                data: datos,
                dataType: "json",
                ...objType,
                ...objBeforeSend,
                success: (data) => {
                    resolve(data);
                },
                error: function (xhr, status, error) {
                    swal_error(xhr, status, error);
                },
            });


        });





    }





    // Crear un metodo AJAX :

    _data = {};

    set data(valor) {
        this._data = valor;
    }

    sendAjaxa(options = {}) {


        var defaults = {
            id: 'content-data',
            table: false,
            fn: '',
        };

        var opts = Object.assign(defaults, options);


        let content = '';
        if (opts.id)
            content = '#' + opts.id;

        fn_ajax(this._data, this._link, content).then((data) => {

            if (opts.table)
                this.lsTable();

            if (opts.fn)
                window[opts.fn]();


        });
    }

    // Crear metodo para un modal form :




    modal_formulario(options = {}) {


        let json_default = [

            {
                opc: "input-group",
                lbl: "Nombre",
                id: "name",
                tipo: "cifra",
                required: true,
                placeholder: "Agrega un dato",
                icon: "icon-phone-2",
            },

        ];



        /*--  Asignamos valores por defecto --*/

        let defaults = {
            id_frm: 'frm-modal',
            id_content: 'content-modal',
            autovalidation: true,
            json: json_default,
            fn: '',
            extends: false,

        };



        var opts = Object.assign(defaults, options);

        /*-- Creamos el objeto de configuracion del modal --*/

        let data_modal = {

            title: "<strong> </strong>",
            closeButton: true,
            message: `<form class="" id="${opts.id_frm}"  novalidate></form> <div id="${opts.id_content}"></div>`,

        };

        data_modal = Object.assign(data_modal, this._data_modal);

        let modal = bootbox.dialog(data_modal);


        /*-- Asignar parametros al plugin simple json form --*/
        let data_json_form = {
            data: opts.json,
            type_btn: "two_btn",
            prefijo: "txt",
        };


        if (opts.extends) {
            $("#" + opts.id_frm).content_json_form(data_json_form);
        } else {

            $("#" + opts.id_frm).simple_json_form(data_json_form);
        }



        if (opts.autovalidation) {

            let options_validation = {
                tipo: "text",
                opc: "save-frm",
            };

            options_validation = Object.assign(options_validation, this._data_form);

            $("#" + opts.id_frm).validation_form(options_validation, (datos) => {



                fn_ajax(datos, this._link, '').then((data) => {

                    if (opts.fn)
                        window[opts.fn]();

                    modal.modal('hide');

                });



            });


        } else {
            return modal;
        }



    }


    // -- Estructura basica para una tabla --
    _id_table = 'mdl-table';
    _id_content_table = 'content-table';

    static _attr_table = {};
    static _data_table = {};


    static _attr_content_table = {};
    static _opts_table = {};

    set attr_table(valor) {
        this._attr_table = valor;
    }

    set id_table(valor) {
        this._id_table = valor;
    }

    set id_content_table(valor) {
        this._id_content_table = valor;
    }

    set data_table(valor) {
        this._data_table = valor;
    }

    set opts_table(valor) {
        this._opts_table = valor;
    }



    lsTable(options = {}) {

        var defaults = {

            id: this._id_content_table,
            extends_fn: function () { },
            datatable: true,
            no: 15,
            data_events: "",
        };

        let opts = Object.assign(defaults, this._opts_table, options);

        /* --   Configuracion de la data para backend  -- */

        let data = { // data por default
            opc: "ls",
        };

        data = Object.assign(data, this._data_table);

        // console.log(data);



        // --  Proceso para crear la tabla a partir del backend-- */

        fn_ajax(data, this._link, "#" + opts.id).then((datos) => {

            let atributos_table = {
                data: datos,
                f_size: '12',
                color_th: "bg-primary-1 bg-primary",
                id: this._id_table,
            };

            atributos_table = Object.assign(atributos_table, this._attr_table);

            // console.log('atributos', atributos_table);
            $("#" + opts.id).rpt_json_table2(atributos_table);

            // Asignar eventos a la tabla
            if (opts.data_events) // se activa al crear un objecto data_events
                eventoTabla('#' + this._id_table, this._link, opts.data_events);


            if (opts.datatable) // se activa con la opcion datatable
                simple_data_table_no("#" + atributos_table.id, opts.no);

            // if (opts.fn)
            opts.extends_fn();


            // eventoInput('mdl-table');
        });
    }

    /*--  Estructura basica para una question  --*/

    static _data_question = {};
    static _attr_question = {};

    static _dataQuestion = {};



    set data_question(valor) {
        this._data_question = valor;
    }

    set dataQuestion(valor) {
        this._dataQuestion = valor;
    }

    set attr_question(valor) {
        this._attr_question = valor;
    }

    modal_question(options = {}) {

        /*--  Asignamos valores por defecto --*/
        var defaults = {
            fn: '',
            extends: false
        };

        let opts = Object.assign(defaults, options);


        let dtx = { // data por default
            opc: "question",
        };

        if (this._data_question) // si se seteo un nuevo valor se reemplaza
        {
            dtx = this._data_question;
        } else if (this._dataQuestion) {
            dtx = this._dataQuestion;
        }




        /*--  atributos para un modal --*/

        let object_alert = {
            title: "",
            text: " ",
            icon: "warning",

            showCancelButton: true,
            confirmButtonText: "Aceptar",
            cancelButtonText: "Cancelar",
        };

        object_alert = Object.assign(object_alert, this._attr_question);


        /*--  plantilla --*/


        let extends_swal = Swal.fire(object_alert);

        if (opts.extends) {
            return extends_swal;


        } else {

        }


        extends_swal.then((result) => {
            if (result.isConfirmed) {


                fn_ajax(dtx, this._link, "").then((data) => {

                    if (opts.fn) {

                        window[opts.fn]();
                    } else {

                        // this.lsTable();
                    }


                });
            }
        });
    }


    // -- Estructura para un modulo de consulta

    _idContentForm = 'contentForms';
    _idContentTable = 'contentTable';

    _idForm = 'idFrm';
    _idTable = 'idTable';

    _dataPluginForm = {};

    static _attrContentForm = {};
    static _attrContentTable = {};


    set idContentForm(valor) {
        this._idContentForm = valor;
    }

    set idContentTable(valor) {
        this._idContentTable = valor;
    }

    set attrContentForm(valor) {
        this._attrContentForm = valor;
    }

    set attrContentTable(valor) {
        this._attrContentTable = valor;
    }

    set idForm(valor) {
        this._idForm = valor;
    }

    set dataPluginForm(valor) {
        this._dataPluginForm = valor;
    }



    jsonDefault = [
        {
            opc: "input",
            lbl: "Producto",
            id: "producto",
            tipo: "texto",
            class: 'col-12'
        },

        {
            opc: "input-group",
            lbl: "Cantidad",
            id: "cantidad",
            placeholder: "0.00",
            tipo: "cifra",
            class: 'col-12'
        },


    ];

    formTable(options = {}) {

        /* --  Configuracion inicial del modulo -- */

        let defaults = {

            class_content: "row p-2",
            id_frm: this._idForm,
            id_tabla: this._idContentTable,

            datatable: true,
            autovalidation: true,
            alert: true,
            toogle_close: false,
            data_alert: { title: 'Registro guardado con exito' },
            fn: ''
        };

        var opts = Object.assign(defaults, options);

        let div = $("<div>", {
            class: opts.class_content,
        });


        //  Contenedor para el div del formulario :

        let attrDivForm = {
            class: "col-lg-4 col-12 line",
            id: this._idContentForm,
        };


        if (this._attrContentForm) // Si fue cambiado los atributos el nuevo atributo cambia el formulario
            attrDivForm = Object.assign(attrDivForm, this._attrContentForm);


        let div_form = $("<div>", attrDivForm);


        let div_formulario = $("<form>", {
            id: opts.id_frm,
            novalidate: true,
        });



        // // let div_close      = $('<div>', {
        // //     class: "col mb-3  float-end",
        // // }).append('<label>',{
        // //     class:'fw-bold'
        // // });

        // // let btn_close = $('<button>', {
        // //     onclick: 'closeForm()',
        // //     class: 'btn-close',
        // //     type: 'button',
        // // });

        // // div_close.append(btn_close);

        // // if (opts.toogle_close)
        // //     div_formulario.append(div_close);

        div_form.append(div_formulario);
        div.append(div_form);



        // Contenedor para el div de la tabla :

        let opts_content_table = {
            class: "col-12 col-lg-8 line",
            id: this._idContentTable,
        };

        opts_content_table = Object.assign(opts_content_table, this._attrContentTable);
        let div_table = $("<div>", opts_content_table);
        div.append(div_table);





        //-- Vaciar los contenedores -- */
        $("#" + this._div_modulo).html(div);




        // Proceso para crear un formulario :

        let opc_json_form = {
            data: this.jsonDefault,
            type: "default",
        };
        opc_json_form = Object.assign(opc_json_form, this._dataPluginForm);




        // Asignar los plugins a los elementos:
        $("#" + opts.id_frm).content_json_form(opc_json_form);




        if (opts.autovalidation) {

            //     let data_validation_form = {
            //         tipo: "text",
            //         opc: "save-frm",

            //     };

            //     data_validation_form = Object.assign(data_validation_form, this._data_form);


            //     $("#" + opts.id_frm).validation_form(data_validation_form, (datos) => {


            //         fn_ajax(datos, this._link, "").then((data) => {
            //             $("#" + opts.id_frm)[0].reset();

            //             if (opts.alert)
            //                 alert(opts.data_alert);

            //             this.lsTable();
            //         });
            //     }
            //     );


        }
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
            f_size: 12,
            includeColumnForA: false,
            border_table: "border border-gray-300",
            border_row: "border-t border-gray-200",
            color_row_alt: "bg-gray-100",
            striped: false
        };

        if (options.theme === 'dark') {
            defaults.dark = true;
            defaults.color_th = "bg-[#0F172A] text-white";
            defaults.color_row = "bg-[#1E293B] text-white";
            defaults.color_group = "bg-[#334155] text-white";
            defaults.class = "w-full table-auto text-sm text-white";
            defaults.border_table = "";
            defaults.border_row = "border-t border-gray-700";
            defaults.color_row_alt = "bg-[#111827]";
        } else if (options.theme === 'corporativo') {
            defaults.color_th = "bg-[#0F243E] text-white";
            defaults.color_row = " ";
            defaults.color_group = "bg-gray-100 ";
            defaults.class = "w-full text-sm ";
            defaults.border_table = "border rounded-lg  border-gray-300";
            defaults.border_row = "border-t border-gray-300";
            defaults.color_row_alt = "bg-gray-100";
        }

        else if (options.theme === 'shadcdn') {
            defaults.color_th = "bg-[#111827] text-white";
            defaults.color_row = "bg-white text-[#111827]";
            defaults.color_group = "bg-[#F1F5F9]";
            defaults.class = "w-full table-auto text-sm";
            defaults.border_table = "border rounded-md border-[#CBD5E1]";
            defaults.border_row = "border-t border-[#E2E8F0]";
            defaults.color_row_alt = "bg-[#F8FAFC]";
        }
        else {
            defaults.color_th = "bg-[#F2F5F9] text-[#003360]";
            defaults.color_row = " hover:bg-gray-600";
            defaults.color_group = "bg-gray-200";
            defaults.class = "w-full table-auto text-sm text-gray-800";
            defaults.border_table = "border rounded-lg  border-gray-300";
            defaults.border_row = "border-t border-gray-200";
            defaults.color_row_alt = "bg-gray-50";
        }

        const opts = Object.assign({}, defaults, options);
        const container = $("<div>", {
            class: "rounded-lg h-full table-responsive ",
        });

        if (opts.title) {
            const titleRow = $(`
            <div class="flex flex-col py-2 ">
                <span class="text-lg font-semibold ${opts.dark ? 'text-gray-100' : 'text-gray-800'}">${opts.title}</span>
                ${opts.subtitle ? `<p class="text-sm ${opts.dark ? 'text-gray-400' : 'text-gray-600'} mt-1">${opts.subtitle}</p>` : ''}
            </div>`);
            container.append(titleRow);
        }

        const table = $("<table>", { id: opts.id, class: ` border-separate border-spacing-0 ${opts.border_table} ${opts.class}` });
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
        const tbody = $("<tbody>");

        opts.data.row.forEach((data, i) => {

            // 🚩 Detectamos fila de agrupación horizontal
            if (data.colgroup) {
                const colspan = opts.data.thead?.length || Object.keys(data).length - 2; // exclude id, colgroup
                const labelKey = Object.keys(data).find(key => !['id', 'colgroup'].includes(key));
                const labelText = data[labelKey] || "";
                const paddingClass = labelText ? "py-2" : "py-1";

                const colgroupRow = $("<tr>").append(
                    $("<td>", {
                        colspan: colspan,
                        class: `px-3 ${paddingClass} font-semibold lowercase capitalize ${opts.border_row} ${opts.color_group}`,
                        html: labelText
                    })
                );

                tbody.append(colgroupRow);
                return; // Salta esta iteración
            }



            let bg_grupo = "";

            if (data.opc) {
                if (data.opc == 1) {
                    bg_grupo = opts.color_group + " font-bold";
                } else if (data.opc == 2) {
                    bg_grupo = opts.color_group + " text-primary fw-bold ";
                }
            }



            const colorBg = bg_grupo || (opts.striped && i % 2 === 0 ? opts.color_row_alt : opts.color_row);


            delete data.opc;

            const tr = $("<tr>", {
                class: ` `,
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
                    cellAttributes.class += ` ${opts.border_row} ${colorBg} `;
                }

                tr.append($("<td>", cellAttributes));
            });

            let actions = '';

            if (data.a?.length) {
                actions = $("<td>", { class: `px-2 py-2 flex justify-center items-center ${colorBg} ${opts.border_row}` });
                data.a.forEach(atributos => {

                    const button_a = $("<a>", atributos);
                    actions.append(button_a);
                });
                tr.append(actions);
            }

            if (data.dropdown) {
                actions = $("<td>", { class: `px-2 py-2 flex justify-center items-center ${colorBg} ${opts.border_row}` });

                const wrapper = $("<div>", {
                    class: "relative"
                });

                const btn = $("<button>", {
                    class: "icon-dot-3 text-gray-600 hover:text-blue-600",
                    click: function (e) {
                        e.stopPropagation();
                        $(this).next("ul").toggle();
                    }
                });

                const menu = $("<ul>", {
                    class: "absolute right-0 mt-2 w-44 z-10 bg-white border rounded-md shadow-md hidden",
                });

                data.dropdown.forEach((item) =>
                    menu.append(`
                    <li><a onclick="${item.onclick}"text-left class="block px-4 py-2 text-sm hover:bg-gray-100 text-gray-800">
                    <i class="${item.icon} "></i> ${item.text}</a></li>`)
                );





                wrapper.append(btn, menu);
                actions.append(wrapper);
                $(document).on("click", () => menu.hide());
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




}

class Templates extends Complements {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this._table = null;
    }

    set table(valor) {
        this._table = valor;
    }
    get table() {
        return $(this._table);
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

    // Layouts.
 

    createTable(options) {
        
        var defaults = {

            extends: false,
            parent: this.div_modulo,
            idFilterBar: '',
            url: this._link, 
            parent: 'lsTable',

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

                extendsAjax = fn_ajax(datos, opts.url, beforeSend);


                if (!options.extends) { // si la variable extends no esta definida se ejectuta de forma normal


                    extendsAjax.then((data) => {

                        let attr_table_filter = {
                            data: data,
                            f_size: '14',
                            id: 'tbSearch'
                        };

                        attr_table_filter = Object.assign(attr_table_filter, opts.attr);

                        opts.methods.send(data);

                        if(opts.success)
                            opts.success(data);



                        $('#' + options.parent).rpt_json_table2(attr_table_filter);


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
            
            parent           : 'formsContent',
            id               : 'idForm',
            plugin           : 'content_json_form',
            plugin_validation: 'validation_form',
            extends          : false,
            type             : 'div',
            class            : 'row',
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
        opts.methods = Object.assign({}, defaults.methods, options.methods);  // Asegurar que los métodos personalizados se fusionen correctamente

        $('#' + opts.parent)[opts.plugin]({ data: jsonForm, class: opts.class, type: 'default', id: opts.id, Element: opts.type });

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

                    opts.methods.send(data);

                });

            }


        });
        // return extends_ajax;
        // if(opts.extends){
        //     return extends_ajax;
        // }



    }


    createModalForm(options) {

        const idFormulario = options.id ? options.id : 'modalForm';

        const components = options.components

            ? options.components
            : $("<form>", { novalidate: true, id: idFormulario, class: "" });



        let defaults = {
            id: idFormulario,

            bootbox: {
                title: 'Modal example',
                id:'modalExample',
                closeButton: true,
                message: components,
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


            autovalidation: false,

            data: { opc: 'sendForm' }

        };

        const conf = this.ObjectMerge(defaults, options);
        let modal = bootbox.dialog(conf.bootbox);


        $('#' + conf.id).content_json_form({ data: conf.json, type: '' });

        if (options.beforeSend)
            options.beforeSend();


        if (conf.autovalidation) {

            let options_validation = {
                tipo: "text",
                opc: "save-frm",
            };

            options_validation = Object.assign(options_validation, conf.data);


            $("#" + conf.id).validation_form(options_validation, (datos) => {

                fn_ajax(datos, this._link, '').then((data) => {

                    

                    if (conf.success)
                        conf.success(data);
            

                    modal.modal('hide');

                });



            });


        } else {
            return modal;
        }


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

    createButtonGroup(options) {

        const icon_default = 'icon-shop';
        let   groups       = {
            parent : 'groupButtons',
            cols   : 'w-25 ',
            size   : 'sm',
            fn     : '',
            onClick: '',
            class  : '',
            data   : [{
                text : 'FRANCES',
                color: 'primary',
                icon : 'icon-shop',
                id   : '',
            },
            {
                text : 'PASTELERIA',
                color: 'outline-success',
                icon : 'icon-shop',
            },
            ]
        };
        let configuration = Object.assign(groups, options);
        let divs = $('<div>', { class: 'd-flex overflow-auto ' + configuration.class });
          // Iterate over the group data and create buttons
        if (!configuration.dataEl) {
            configuration.data.forEach((item) => {
                let btn = $('<a>', {
                    class  : `btn btn-${configuration.size} btn-${item.color} ${configuration.cols} me-1 d-flex flex-column align-items-center justify-content-center`,
                    id     : item.id,
                    click  : item.onClick,
                    onclick: item.fn
                });
                if (item.type) {
                    btn = $('<label>', {
                        class: `btn z-index-0 btn-${configuration.size} btn-${item.color} ${configuration.cols} me-1 `,
                        for  : item.id,
                        id   : item.btnid || 'btnfile'
                    });
                    let ipt_file = $('<input>', {
                        class   : 'hide',
                        type    : 'file',
                        accept  : item.accept ? item.accept: '.xlsx, .xls',
                        id      : item.id,
                        onchange: item.fn,
                    });
                    divs.append(ipt_file);
                      // btn.append(counter);
                }
                if (item.icon) {
                    let icon = $('<i>', { class: item.icon + ' d-block' });
                    btn.append(icon);
                }
                if (item.text) {
                    let span = $('<span>', { text: item.text });
                    btn.append(span);
                }
                divs.append(btn);
            });
        } else {
            let classDisabled = configuration.dataEl.disabled ? 'disabled' : '';
            configuration.dataEl.data.forEach((item) => {
                let props = {
                    onclick: configuration.dataEl.onClick + `(${item.id})` || configuration.dataEl.fn + `(${item.id})`
                }
                if (configuration.onClick) {
                    props = {
                        click: configuration.onClick
                    }
                }
                let btn = $('<a>', {
                    class: `btn ${classDisabled} btn-outline-primary ${configuration.cols} d-flex me-1 flex-column w-100 align-items-center justify-content-center`,   // Add dynamic color class
                    id   : item.id,
                    ...props
                });
                var itemIcon = configuration.dataEl.icon ? configuration.dataEl.icon : '';
                let icon = $('<i>', { class: 'ms-2  d-block ' + (item.icon ? item.icon : itemIcon) });
                let span = $('<span>', { text: item.valor });
                  // if(item.id){
                btn.append(icon, span);
                  // }else{
                  //     btn.append(span);
                  // }
                divs.append(btn);
            });
        }
        if (groups.parent) {
            $('#' + groups.parent).html(divs);
        } else {
            return divs;
        }
        const cardPosGroup = document.getElementById(groups.parent);
          // Agregar un evento de clic al contenedor
        cardPosGroup.addEventListener('click', function (event) {
              // // Verificar si el elemento clicado es un botón
            if (event.target.closest('a')) {
                  // Seleccionar todos los botones
                const buttons = cardPosGroup.querySelectorAll('a');
                buttons.forEach(button => {
                    button.classList.remove('active', 'btn-primary', 'text-white');
                    button.classList.add('btn-outline-primary');
                });
                  // Agregar las clases de estilo al botón clicado
                const clickedButton = event.target.closest('a');
                clickedButton.classList.add('active', 'btn-primary', 'text-white');
                clickedButton.classList.remove('btn-outline-primary');
            }
        });
    }

    createGrid(options) {

        let defaults = {

            parent: '',
            color: 'bg-default',
            data: [{ id: 1, nombre: 'BOSQUE DE CHOCOLATE' }],
            size: 'soft',
            type: '',
            image: true,
            class: 'grid-container'

        };

        let opts = Object.assign(defaults, options);
        let divs = $('<div>', { class: opts.class, id:'gridcontainer' });


        opts.data.forEach((element) => {



            if (opts.type == 'catalog') {
                var img       = "https://15-92.com/ERP3/src/img/default_flower.png";
                var grid_item = $('<div>', { class: ` ${opts.color} grid-item  `, onClick: element.onclick });
                var link      = (element.attr.src) ? element.attr.src : img;
                var imagen    = $('<img>', { src: link, class: 'col-12' });
                
                // add image.
                var details = $('<div>', { class: 'col-12 div1 pointer' }).append(imagen);
                
                // add text. 
                var description = $('<div>', { class: 'col-12 bg-primary d-flex flex-column pt-1 div2 pointer' });
                var h6          = $('<label>', { text: element.nombre, class: 'fw-bold col-12' });
                var sub         = $('<sub>', { text: element.costo, class: 'fw-bold py-2' })
                
                description.append(h6, sub);
                // draw grid items.
                grid_item.append(details, description);
            
            } else if (opts.type == 'almacen'){
                // Config. Evento onclick.

                let props = { 
                    onclick: element.onclick
                }
                if (opts.onClick) {
                    props = {
                        click: opts.onClick
                    }
                }


                // Config. disponibilidad.

                const disp       = element.disponible ? element.disponible : '';
                var   class_disp = element.disponible == 0 ? 'disabled bg-gray-200 text-gray-400' : 'hover:shadow-md hover:bg-slate-800 hover:text-gray-100 ';
                var   especial   = element.especial ? element.especial : 0;
                var price = especial > 0 ? element.especial : element.costo;
                
                var   card       = $('<div>', {

                    id   : element.id,
                    costo: price ? price   : 0,
                    class: 'card h-32 transition-all text-center pointer ' + class_disp,
                    
                    ...props
                });

               
                
                var details      = $('<div>', { class: 'p-2 card-content flex flex-col py-3 gap-2 w-full ' });
                var label        = $('<label>', { text: element.nombre ? element.nombre : element.valor, class: 'fw-semibold text-uppercase text-xs' });
                var precio       = $('<label>', { class: ` ${especial > 0 ? ' text-lime-600 ':''} font-bold text-lg`, text: element.costo ? formatPrice(price): '' });
                var text_almacen = $('<span>', { class: `text-xs font-semibold ${disp == 0 ? 'text-red-400 font-bold' : 'text-gray-400' } `, html: disp == 0 ? 'Sin stock' : `disponibles: `});
                
                var almacen = $('<span>', { id: 'cantidad' + element.id,class: `text-xs font-semibold text-gray-400 `, html: disp == 0 ? '' : disp})
                
                var container_disponibilidad = $('<div>', { class: 'flex justify-center items-center' }).append(text_almacen, almacen);
                details.append(label, precio, container_disponibilidad);
                
                card.append(details);
                divs.append(card);



            } else if (opts.type == 'pos') {

                // Config. Evento onclick.

                let props = {
                    onclick: element.onclick
                }
                if (opts.onClick) {
                    props = {
                        click: opts.onClick
                    }
                }


                const disp = element.disponible ? element.disponible : '';

                var class_disp = element.disponible == 0 ? ' disabled bg-gray-200 text-gray-400' : 'hover:shadow-md hover:bg-slate-800 hover:text-gray-100 ';

                var card = $('<div>', {
                   
                    id   : element.id,
                    costo: element.costo ? element.costo  : 0,
                    class: ' card h-52 transition-all text-center pointer ' + class_disp,

                    ...props
                });

                // img
                
                // Crear el enlace `<a>`
                let enlace = $('<a>', { href: element.href || '#!' });

                // Crear la imagen `<img>`

               let containerImage =  $('<div>', {
                    class: 'w-100 h-32  p-1  rounded-lg flex-shrink-0 ',
                }).append(
                    $('<img>', {
                        class: element.imgClass || ' rounded-lg object-cover object-center h-100 w-full p-1',
                        src: element.src,
                    })
                );



             
                let iconContainer = $('<div>', {
                    class: ' mx-2 py-4 mt-2 bg-gray-100  rounded-lg text-center',
                }).append($('<i>', { class: ' icon-birthday text-muted', style: 'font-size: 42px;' }));


                // info and details

                var details = $('<div>', { class: ' px-2 card-content flex flex-col py-2 gap-2 w-full '});
                var label   = $('<label>', { text: element.nombre ? element.nombre : element.valor, class: ' fw-semibold text-uppercase text-xs' });
                var precio  = $('<label>', { class: 'text-sm font-bold pb-2', text: element.costo ? formatPrice(element.costo) : '' });
                
                
                details.append(label, precio);
                if(opts.image){

                    if(element.src){

                        card.append(containerImage, details);
                    }else{
                        
                        card.append(iconContainer, details);
                    }

                }else{

                    card.append(details);
                }

                divs.append(card);

            } else {

                let props = { // propiedades del evento click/onClick
                    onclick: element.onclick
                }
                if (opts.onClick) {
                    props = {
                        click: opts.onClick
                    }
                }

                var grid_item = $('<div>',{

                        id   : element.id,
                        costo: element.costo ? element.costo : 0,
                        class: ` ${opts.color} grid-item-${opts.size}  `,
                        ...props
                        // click: element.onclick ? element.onclick : opts.onClick 
                    });

                // add cost.
                var details = $('<div>', { class: 'col-12 pointer' });
                var lbl = $('<label>', { text: element.costo ? formatPrice(element.costo) : '', class: 'col-12 fw-semibold py-2 text-muted' });
                details.append(lbl);
                // add text. 
                var description = $('<div>', { class: 'col-12 fw-bold d-flex flex-column pt-1 div1 pointer' });
                var label = $('<label>', { text: element.nombre ? element.nombre : element.valor, class: 'fw-bold col-12' });
                description.append(label);
                // draw grid items.
                grid_item.append(description, details);

            }

            divs.append(grid_item);


        });

        $('#' + opts.parent).html(divs);

    }

    createfilterBar(options) {

        const defaults = {
            parent: 'filterBar',
            id: 'filterForm',
            data: [{ opc: 'btn', text: 'Guardar' }]
        };

        const opts = Object.assign(defaults, options);


        $(`#${opts.parent}`).content_json_form({ data: opts.data, type: '', id: opts.id });


    }

    // Componentes para crear groupCards.

    creategroupCard(options) {

        let groups = {

            parent: 'groupButtons',
            cols: 'w-25 ',
            size: 'sm',
            type: 'group',
            colors: 'bg-primary',
            description: '',
            titleGroup: 'Tiempo',
            subtitleGroup: 'hrs',

            data: [
                {
                    valor: 'Limpieza',
                    color: 'outline-primary',
                    icon: 'icon-shop',
                    onClick: '',
                    id: 1,
                    puntaje: '0',
                    obtenido: '0',
                },
                {
                    valor: 'Terraza',
                    color: 'outline-primary',
                    icon: 'icon-shop',
                    onClick: '',
                    id: 2,
                    puntaje: '0',
                    obtenido: '0',

                },


            ],

            styleCard: {

                group: {
                    class: 'category-card mb-3',



                }

            }

        };



        let opts = Object.assign(groups, options);

        let divs = $('#' + opts.parent);
        divs.empty();

        // add title.

        let title = $('<label>', { class: 'text-uppercase fw-bold text-muted', text: opts.title });
        let descr = $('<p>', { class: 'mb-0', text: opts.description });

        if (opts.title) divs.append(title);

        // Verificar si opts.data está definido y no es null
        if (opts.data) {
            // console.log('cards',opts.data)

            opts.data.map((El, index) => {

                // category or group

                if (opts.type == 'group') {

                    // --- items / result

                    let items = El.items ? El.items : '';
                    let results = El.items ? El.result : ' ';

                    let class_answered_group = '';
                    if (items == results) { class_answered_group = 'answered'; }




                    let btn = $('<div>', {
                        class: `category-card mb-3 ${class_answered_group} `,
                        id: El.id,
                        onclick: El.onclick ? El.onclick : opts.fn + `(${El.id})`  // jQuery usa 'click' en lugar de 'onclick'
                    });


                    let span = $('<h6>', { class: 'text-uppercase fw-bold', text: El.valor });
                    let puntaje = $('<p>', { class: 'mb-0 fw-semibold', style: 'font-size:1rem;', text: opts.titleGroup + ' : ' + El.totalTime });
                    let total = $('<span>', { html: `Preguntas: ${results} / ${items}` });

                    btn.append(span, total);
                    divs.append(btn);
                }

                else if (opts.type == 'subgroup') {

                    let items = El.items;
                    let result = El.result;
                    let class_success = (result == items) ? 'answered' : ' d-flex justify-content-center ';


                    let btn = $('<div>', {
                        class: `group-card mb-3 ${El.id != 0 ? class_success : ''} `,
                        id: El.id,
                        idGroup: El.idGroup || '',
                        onclick: (El.onclick) ? El.onclick : opts.fn + `(${El.id})`
                    });


                    if (El.id != 0) {

                        // add components.

                        var label = $('<label>', { class: 'text-uppercase' }).text(El.text ? El.text : El.valor);
                        var paragraph = $('<span>', { class: 'mb-0' }).html(`Preguntas: <br> ${result} / ${items}`);

                        btn.append(label, paragraph);

                    } else {

                        let icon = $('<i>', { class: El.icon + ' fs-1  d-block' });
                        var label = $('<label>', { class: 'text-uppercase' }).text(El.text ? El.text : El.valor);

                        btn.append(icon, label);
                    }


                    divs.append(btn);

                }

                else if (opts.type == 'question') {

                    let noIndex = index + 1;

                    let class_success = El.answer ? 'answered' : '';

                    let btn = $('<div>', {

                        class: `question-card   mb-3 ${El.id != 0 ? class_success : ''} `,
                        id: 'question_' + El.id,

                        idQuestion: El.id,
                        type: El.id_QuestionType,

                        name: 'question',
                        noIndex: noIndex,
                        points: El.points ? El.points : 0,
                        onclick: (El.onclick) ? El.onclick : opts.fn + `(event)`


                    });



                    if (El.id == 0) {

                        btn = $('<div>', {
                            class: `question-card bg-primary mb-3 `,
                            onclick: (El.onclick) ? El.onclick : opts.fn + `(event)`

                        });

                        let icon = $('<i>', { class: El.icon + ' fs-1  d-block' });
                        var label = $('<label>', { class: 'text-uppercase' }).text(El.text ? El.text : El.valor);

                        btn.append(icon, label);

                    }

                    else {

                        var text = El.valor;

                        var label = $('<label>', { class: 'text-uppercase' }).text(El.valor ? text : El.text);

                        btn.append(label);

                    }

                    divs.append(btn);

                }

                else if (opts.type == 'options') {

                    let options = {
                        id: El.id,
                        data: El.groups
                    };

                    let btn = $('<div>', {
                        class: `question-card pointer my-2 `,

                    }).click(() => {

                        opts.success(options)

                    });

                    let getout = 0;

                    if (El.data.length) {
                        getout = El.data[0].getout;
                    }



                    let label = $('<label>', { class: 'text-uppercase pointer ', text: El.valor });
                    let span = $('<span>', { class: 'ms-auto text-primary pointer fw-bold ', text: getout, style: 'font-size:1.2rem;' });

                    span.append($('<i>', { class: 'icon-logout' }));

                    btn.append(label, span);




                    divs.append(btn);


                }



            });


        } else {

            divs.append('No hay grupos definidos.');
        }



 



    }

    useFetch(options) {

        // Valores predeterminados
        let defaults = {
            method: 'POST',
            data: { opc: 'ls' },
            url: this._link, // La URL debe ser especificada en las opciones
            success: () => { } // Función vacía por defecto
        };

        // Mezclar los valores predeterminados con las opciones proporcionadas
        let opts = Object.assign({}, defaults, options);

        // Validar que la URL esté definida
        if (!opts.url) {
            console.error('URL es obligatoria.');
            return;
        }

        // Realizar la petición fetch
        fetch(opts.url, {
            method: opts.method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(opts.data),
        })
            .then((response) => response.json())
            .then((data) => {
                // Llamar a la función success si se proporciona
                if (typeof opts.success === 'function') {
                    opts.success(data);
                }
            })
            .catch((error) => {
                console.error('Error en la petición:', error);
            });
    }

    useAjax(options) {

        var defaults = {
            idFilterBar: '',
            parent: 'contentDataGrupos',

            conf: {
                beforeSend: true,
            },

            data: {},


        };

        const opts = Object.assign(defaults, options);


        let beforeSend = (opts.conf.beforeSend) ? '#' + opts.parent : '';


        if (opts.idFilterBar) { // se activa la validacion por filtro

            const sendData = { tipo: 'text', opc: 'ls', ...options.data };

            $('#' + opts.idFilterBar).validar_contenedor(sendData, (datos) => {

                console.log(beforeSend);

                fn_ajax(datos, this._link, beforeSend).then((data) => {

                    if (options.success) {
                        options.success(data);
                    }



                });

            });



        } else {

            fn_ajax(options.data, this._link, beforeSend).then((data) => {

                let beforeSend = (opts.conf.beforeSend) ? '#' + opts.parent : '';

                if (options.success) {
                    options.success(data);
                }



            });



        }



    }

    fnAjax(options) {

        let defaults = {

            idFilterBar: 'filter',

            data: {
                tipo: 'text',
                opc: 'frm-data',
            },

            methods: ''




        };

        const settings = this.ObjectMerge(defaults, options);

        console.warn(settings.data);


        $("#" + settings.idFilterBar).validar_contenedor(settings.data, (datos) => {

            fn_ajax(datos, this._link).then((data) => {


                if (settings.methods) {
                    // Obtener las llaves de los métodos
                    let methodKeys = Object.keys(settings.methods);
                    methodKeys.forEach((key) => {
                        const method = settings.methods[key];
                        method(data);
                    });

                }




            });

        });
    }

    // layouts.

    layoutWithCards(components) {

        let nameComponent = {
            name: 'container',
            parent: this._div_modulo,
            class: 'd-flex mx-2 my-3 gap-2',
            cardtable: {
                className: 'col-8 line',
                id       : 'containertable',
            
                filterBar: { id: 'filterTable', className: 'col-12 mb-2 line' },
                container: { id: 'listTable', className: 'col-12 line' },
            
            },
            cardticket: {

                className: 'col-4 line',
                id       : 'containertable',

                filterBar: { id: 'filterTicket', className: 'col-12 mb-2 line' },
                container: { id: 'containerTicket', className: 'col-12 line' },
                message  : { id: 'containerMessage', className: 'col-12 ' },
            
            },
        };

        let ui = this.ObjectMerge(nameComponent, components);

        let jsonComponents = {
            id: ui.name,
            class: ui.class,

            contenedor: [
                {
                    type: "div",
                    id: ui.cardtable.id,
                    class: ui.cardtable.className,
                    children: [
                        { class: ui.cardtable.filterBar.className, id: ui.cardtable.filterBar.id },
                        { class: ui.cardtable.container.className, id: ui.cardtable.container.id },

                    ]
                },
                {
                    type: 'div',
                    id: ui.cardticket.id,
                    class: ui.cardticket.className,
                    children: [
                        { class: ui.cardticket.filterBar.className, id: ui.cardticket.filterBar.id },
                        { class: ui.cardticket.message.className, id: ui.cardticket.message.id },
                        { class: ui.cardticket.container.className, id: ui.cardticket.container.id },

                    ],
                },
            ],
        };

        this.createPlantilla({
            data: jsonComponents,
            parent: ui.parent,
            design: false
        });
    }

    layoutWithFilters(options) {

        let defaults = {
            id: '',
            parent: this._div_modulo,
            class: "d-flex mx-2 my-3 h-100",
            card: {
                name: "containerTyM",
                class: "col-12",
                filterBar: { className: 'w-full my-2 line', id: 'filterBar' },
                container: { className: 'w-full my-2 line', id: 'container' }
            }
        };
        const opts = this.ObjectMerge(defaults, options);
        let jsonComponents = {
            id: opts.id,
            class: opts.class,
            contenedor: [
                {
                    type: "div",
                    id: "containerTyM",
                    class: opts.card.class,
                    children: [
                        { class: "w-full my-2 line", id: opts.card.filterBar.id },
                        { class: opts.card.container.className, id: opts.card.container.id }
                    ],
                },
            ],
        };
        this.createPlantilla({ data: jsonComponents, parent: opts.parent, design: false });
    }

    splitLayout(options) {
        let name = options.id ? options.id : 'splitLayout';
        // Configuración por defecto
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
                    ...opts.footer, // Pie de página
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

        let defaults = {
            id: name,
            parent: this._div_modulo,
            class: "d-flex mx-2 my-2 h-100",
            card: {
                name: "singleLayout",
                class: "col-12",
                filterBar: { class: 'w-full line', id: 'filterBar' + name },
                container: { class: 'w-full my-2 line', id: 'container' + name }
            }
        };


        // Mezclar opciones con valores predeterminados
        const opts = this.ObjectMerge(defaults, options);

       
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
        let nameComponent = {
            name: 'container',
            parent: this._div_modulo,
            className: 'flex p-2 ',
            cardtable: {
                className: 'col-4 line',
                id: 'containertable',
                filterBar: { id: 'filterTable', className: 'col-12 mb-2 line' },
                container: { id: 'listTable', className: 'col-12 line' },
            },
            cardform: {
                className: 'col-8 line',
                id: 'containertable',
                filterBar: { id: 'filterTicket', className: 'col-12 mb-2 line' },
                container: { id: 'containerTicket', className: 'col-12 line' },
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
                    children: [
                        { class: ui.cardform.filterBar.className, id: ui.cardform.filterBar.id },
                        { class: ui.cardform.container.className, id: ui.cardform.container.id },
                    ],
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



    // Sugerencia de gpt.

    ObjectMerge(target, source) {
        // Iterar sobre todas las claves del objeto fuente
        for (const key in source) {
            // Verificar si la propiedad es propia del objeto fuente
            if (source.hasOwnProperty(key)) {
                // Verificar si el valor es un objeto y si el target tiene la misma propiedad
                if (typeof source[key] === 'object' && source[key] !== null) {
                    // Si el target no tiene la propiedad o no es un objeto, inicializarla como un objeto vacío
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

    async fetchData(data, opts) {
        return fn_ajax(data, this._link, `#${opts.parent}`);
    }

    processData(data, opts, conf) {

        let attrTable = {
            data: data,
            f_size: '14',
            id: 'tbSearch',
            ...opts.attr
        };

        $(`#${opts.parent}`).rpt_json_table2(attrTable);
        opts.methods.send(data);

        if (conf.datatable) {
            window[conf.fn_datatable](`#${attrTable.id}`, conf.pag);
        }
    }


}


class Modulo_Tab {
    constructor(link, div_filter) {
        this._link = link;
        this._div_filter = div_filter;
    }

    //   
    static obj_filter = {};

    /* getters and setters */


    set object_table(valor) {
        Modulo_Tab.obj_filter = valor;
    }


    filterBar() {
        let json_filter = [
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
        ];

        let dtx = {
            data: json_filter,
            type: false
        }

        // console.table(Modulo_Tab.obj_filter);

        dtx = Object.assign(dtx, Modulo_Tab.obj_filter);

        $("#content-bar").simple_json_content(dtx);



    }

    rpt(id_rpt, obj_rpt = {}) {
        // init data para crear un reporte
        let data_rpt = {
            tipo: "text",
            opc: "rpt",
        };

        data_rpt = Object.assign(data_rpt, obj_rpt);

        // crea un paquete para enviar al servidor

        $("#" + this._div_filter).validar_contenedor(data_rpt, (dtx) => {

            fn_ajax(dtx, this._link, "").then((data) => {

                $("#" + id_rpt).rpt_json_table2({
                    color_th: 'bg-primary-1',
                    data: data.table_rpt,
                    right: [2, 3, 4, 5],
                });

                $("#content-fp").rpt_json_table2({
                    color_th: "bg-primary-1",
                    data: data.table_fp,
                    right: [2, 3],
                });

                $("#content-propinas").rpt_json_table2({
                    color_th: "bg-primary-1",
                    data: data.table_propina,
                    right: [2, 3],
                });


            });

        });
    }

    // metodos mas simples para crear una tabla o un formulario

    simple_json_table(data, idTable) {
        $("#" + idTable).rpt_json_table2({ data: data });
    }
}

class Modulo_formulario {

    constructor(link, div_modulo) {
        this._link = link;
        this._div_modulo = div_modulo;
    }

    /*getter and setter variables */

    static object_data_table = {};
    static object_attr_table = {};

    static object_data_forms = {};
    static object_attr_forms = {};

    static _json_filter_bar = [];

    static json_forms = [];

    static object_forms = [];
    /*getter and setter metodos*/

    set data_table(valor) {
        Modulo_formulario.object_data_table = valor;
    }

    get data_table() {
        return Modulo_formulario.object_data_table;
    }

    set attr_table(valor) {
        Modulo_formulario.object_attr_table = valor;
    }



    set object_forms(valor) {
        Modulo_formulario.object_data_forms = valor;
    }

    /*-- Objetos para la filter bar --*/

    set json_filter_bar(valor) {
        Modulo_formulario._json_filter_bar = valor;
    }


    filterBar(idContent) {
        let json_filter = [
            {
                opc: "input-calendar",
                id: "iptDate",
                tipo: "text",
                class: "col-sm-3",
                lbl: "Fecha de movimiento",
            },
            {
                opc: "btn",
                fn: "Cheque()",
                color: 'primary',
                text: "Buscar",
                class: "col-sm-2",
            },
        ];

        if (Modulo_formulario._json_filter_bar.length > 0)
            json_filter = Modulo_formulario._json_filter_bar;

        let dtx = {
            data: json_filter,
            type: false
        }


        dtx = Object.assign(dtx, Modulo_Tab.obj_filter);

        $("#" + idContent).simple_json_content(dtx);



    }

    modulo_forms() {
        let obj_form = {
            // json_frm: json_cheque,
            class_frm: "col-12 col-md-4 line",
            class_formulario: "row row-col-2 row-cols-sm-2 row-cols-lg-2 ",
            // atributos_frm: object_frm,
        };

        obj_form = Object.assign(obj_form, Modulo_formulario.object_data_forms);

        /*--------------------------
        * Objectos para la tabla 
        ---------------------------*/

        let data = {
            opc: "ls",
        };

        data = Object.assign(data, Modulo_formulario.object_data_table);

        let object_table = {
            color_th: "bg-primary",
        };

        let obj_table = {

            datos: data,
            class_table: "col-12 col-md-8 p-3",
            datatable: true,
            atributos_table: Modulo_formulario.object_attr_table,

        };

        /*--------------------------
        * Configuracion
        ---------------------------*/

        let obj_ext = {

            /*Configuracion inicial*/
            enlace: this._link,

            /* Configuracion de formularios*/

            /*Configuracion de recetas */

            //   head_frm: true,
            //   alert: false,
            // content_table: "contentTableRecetasIng",

            // atributos_alert: object_alert,
            // atributos_event: object_event_ing,
        };

        let object_modulo = Object.assign(obj_form, obj_table, obj_ext);

        $("#" + this._div_modulo).modulo_1(object_modulo);
    }

    lsTable(opts = {}) {

        var defaults = {

            datatable: true,
            fn: '',
            id: 'tb-archivos',

        };


        opts = Object.assign(defaults, opts);


        /*--------------------------
       * Objectos para la tabla 
       ---------------------------*/

        let data = {
            opc: "ls",
        };

        data = Object.assign(data, Modulo_formulario.object_data_table);

        fn_ajax(data, this._link, "#" + opts.id).then((datos) => {

            let opt_table = {
                data: datos,
                color_th: "bg-primary-1",
            };



            opt_table = Object.assign(opt_table, Modulo_formulario.object_attr_table);

            $("#" + opts.id).rpt_json_table2(opt_table);

            if (opts.datatable)
                simple_data_table_no('#' + opt_table.id, 15);


        });

    }

    modulo_forms_horizontal() {
        let div = $("<div>", {
            class: "row p-2 ",
        });

        //-- Creamos el formulario -- */

        let opts_forms = {
            class: "col-12 col-lg-12  line",
            id: "archivos-formx",
            //   novalidate: true,
        };

        let div_formulario = $("<div>", opts_forms);
        div.append(div_formulario);

        // -- Creamos la tabla -- */

        let div_table = $("<div>", {
            class: "col-12 col-lg-12 mt-2 line",
            id: "tb-archivos",
        });


        div.append(div_table);
        $("#" + this._div_modulo).append(div);


        /*--  Configuracion de tabla  --*/

        this.lsTable({ id: "tb-archivos" });





        $("#" + opts_forms.id).content_json_form(
            Modulo_formulario.object_data_forms
        );
    }
}

class Modulo_busqueda extends Complements {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        // this._link = link;
        // this._content_table = content_table;
    }

    /*getter and setter variables */

    // static _data_table = {};
    // static _attr_table = {};

    static _json_filter_bar = {};
    static _data_filter = {}

    static _jsonFilterBar = {};



    set json_filter_bar(valor) {
        this._json_filter_bar = valor;
    }

    set data_filter(valor) {
        this._data_filter = valor;
    }

    set jsonFilterBar(valor) {
        this._jsonFilterBar = valor;
    }





    filterBar(idContent) {

        // json por defecto para probar su funcionamiento
        let json_filter = [
            {
                opc: "input-calendar",
                id: "iptDate",
                tipo: "text",
                class: "col-sm-3",
                lbl: "Fecha de movimiento",
            },
            {
                opc: "btn",
                fn: "lsHistorial()",
                color: 'danger',
                text: "Buscar",
                class: "col-sm-2",
            },
        ];

        // si el json fue seteado, se reemplaza

        if (this._json_filter_bar) {

            json_filter = this._json_filter_bar;
        } else if (this._jsonFilterBar) {
            json_filter = this._jsonFilterBar;
        }





        let dtx = {
            data: json_filter,
            type: false
        }

        // console.log(dtx);


        // dtx = Object.assign(dtx, this._data_filter);

        // console.log(idContent);

        $("#" + idContent).simple_json_content(dtx);
    }




}

class modulo_uno extends Complements {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        // this._link = link;
        // this._div_modulo = div_modulo;    
    }

    // setter y getter

    static _attr_content_form = {};
    static _attr_content_table = {};

    static _attr_table = {};
    static _data_form = {};
    static _data_plugin_form = {};
    // static _data_table       = {};

    static _opts_table = {};
    static _attr_form = {};

    _id_table = 'mdl-table';
    _id_frm = 'frm';

    _id_content_table = 'content-table';
    _id_content_frm = 'content-frm';

    /*getter and setter metodos*/

    set attr_content_form(valor) {
        this._attr_content_form = valor;
    }

    set attr_content_table(valor) {
        this._attr_content_table = valor;
    }


    set id_content_frm(valor) {
        this._id_content_frm = valor;
    }

    set id_content_table(valor) {
        this._id_content_table = valor;
    }


    set id_table(valor) {
        this._id_table = valor;
    }

    set id_frm(valor) {
        this._id_frm = valor;
    }



    set data_form(valor) {
        this._data_form = valor;
    }


    // set data_table(valor) {
    //     this._data_table = valor;
    // }

    set attr_table(valor) {
        this._attr_table = valor;
    }

    set opts_table(valor) {
        this._opts_table = valor;
    }

    quitar_registro(options = {}) {

        let object_alert = {
            title: "",
            text: "¿ Deseas quitar el registro ?",
            icon: "warning",

            showCancelButton: true,
            confirmButtonText: "Aceptar",
            cancelButtonText: "Cancelar",
        };

        let dtx = { opc: "Quitar" };

        if (options.data)
            dtx = options.data;



        Swal.fire(
            object_alert,
        ).then((result) => {
            if (result.isConfirmed) {

                fn_ajax(dtx, this._link, "").then((data) => {
                    this.lsTable();
                });
            }
        });
    }

    // Configuración para crear una tabla y un formulario :

    set data_plugin_form(valor) {
        this._data_plugin_form = valor;
    }



    modulo_tabla_formulario(options = {}) {

        /* --  Configuracion inicial del modulo -- */

        let defaults = {

            class_content: "row p-2",
            id_frm: this._id_frm,
            id_tabla: this._id_content_table,

            datatable: true,
            autovalidation: true,
            alert: true,
            toogle_close: false,
            data_alert: { title: 'Registro guardado con exito' },
            fn: ''
        };

        var opts = Object.assign(defaults, options);

        let div = $("<div>", {
            class: opts.class_content,
        });



        //-- Creamos el contenedor del formulario -- */

        let attr_div_form = {
            class: "col-lg-4 col-12 line",
            id: this._id_content_frm,
        };


        // Si fue cambiado los atributos el nuevo atributo cambia el formulario
        if (this._attr_content_form)
            attr_div_form = Object.assign(attr_div_form, this._attr_content_form);


        let div_form = $("<div>", attr_div_form);


        let opts_forms = {
            id: opts.id_frm,
            novalidate: true,
        };

        // console.table(opts_forms);

        let div_formulario = $("<form>", opts_forms);



        // let div_close      = $('<div>', {
        //     class: "col mb-3  float-end",
        // }).append('<label>',{
        //     class:'fw-bold'
        // });

        // let btn_close = $('<button>', {
        //     onclick: 'closeForm()',
        //     class: 'btn-close',
        //     type: 'button',
        // });

        // div_close.append(btn_close);

        // if (opts.toogle_close)
        //     div_formulario.append(div_close);


        div_form.append(div_formulario);
        div.append(div_form);

        // -- Creamos la tabla -- */
        let opts_content_table = {
            class: "col-12 col-lg-8 line",
            id: this._id_content_table,
        };

        opts_content_table = Object.assign(opts_content_table, this._attr_content_table);
        let div_table = $("<div>", opts_content_table);
        div.append(div_table);


        //-- Vaciar los contenedores -- */

        $("#" + this._div_modulo).html(div);

        /*  --  Proceso para crear el formulario -- */

        let json = [
            {
                opc: "input",
                lbl: "Nombre",
                id: "nombre",
                placeholder: "Nombre",
                tipo: "texto",
            },
        ];

        let opc_json_form = {
            data: json,
        };

        opc_json_form = Object.assign(opc_json_form, this._data_plugin_form);


        // Asignar los plugins a los elementos
        $("#" + opts.id_frm).content_json_form(opc_json_form);


        if (opts.autovalidation) {

            let data_validation_form = {
                tipo: "text",
                opc: "save-frm",

            };

            data_validation_form = Object.assign(data_validation_form, this._data_form);


            $("#" + opts.id_frm).validation_form(data_validation_form, (datos) => {


                fn_ajax(datos, this._link, "").then((data) => {
                    $("#" + opts.id_frm)[0].reset();

                    if (opts.alert)
                        alert(opts.data_alert);

                    this.lsTable();
                });
            }
            );


        }
    }

}


/* -------
   modulo dos [ visor de datos ]
   ------ */

class Modulo_dos {


    constructor(link, div_modulo) {
        this._link = link;
        this._div_modulo = div_modulo;
    }

    // setter y getter

    static _attr_content_form = {};
    static _attr_content_table = {};

    static _attr_table = {};
    static _data_form = {};
    static _data_plugin_form = {};
    static _data_table = {};

    static _opts_table = {};
    static _attr_form = {};

    _id_table = 'mdl-table';
    _id_frm = 'frm';

    _id_content_table = 'content-table';
    _id_content_frm = 'content-frm';

    /*getter and setter metodos*/

    set attr_content_form(valor) {
        this._attr_content_form = valor;
    }

    set attr_content_table(valor) {
        this._attr_content_table = valor;
    }


    set id_content_frm(valor) {
        this._id_content_frm = valor;
    }

    set id_content_table(valor) {
        this._id_content_table = valor;
    }


    set data_table(valor) {
        this._data_table = valor;
    }

    set attr_table(valor) {
        this._attr_table = valor;
    }

    set opts_table(valor) {
        this._opts_table = valor;
    }



    // setter and getter de filter bar
    static _json_filter_bar = [];
    static _data_filter = {};

    set json_filter_bar(valor) {
        this._json_filter_bar = valor;
    }

    set data_filter(valor) {
        this._data_filter = valor;
    }


    filterBar(idContent) {
        // json por defecto para probar su funcionamiento
        let json_filter = [
            {
                opc: "input-calendar",
                id: "iptDate",
                tipo: "text",
                class: "col-sm-3",
                lbl: "Fecha de movimiento",
            },
            {
                opc: "btn",
                fn: "lsHistorial()",
                color: 'danger',
                text: "Buscar",
                class: "col-sm-2",
            },
        ];

        console.log(this._json_filter_bar);

        if (this._json_filter_bar.length > 0) // si el json fue seteado, se reemplaza
            json_filter = this._json_filter_bar;

        let dtx = {
            data: json_filter,
            type: false
        }


        dtx = Object.assign(dtx, this._data_filter);

        $("#" + idContent).simple_json_content(dtx);
    }

    lsTable(options = {}) {

        var defaults = {
            id: this._id_content_table,
            fn: "",
            datatable: true,
            no: 15,
        };



        let opts = Object.assign(defaults, options, this._opts_table);

        console.log(opts);

        /* --   Configuracion de la data para backend  -- */

        let data = { // data por default
            opc: "ls",
        };

        data = Object.assign(data, this._data_table);


        // --  Proceso para crear la tabla a partir del backend-- */

        fn_ajax(data, this._link, "#" + opts.id).then((datos) => {

            let atributos_table = {
                data: datos,
                color_th: "bg-primary-1",
                id: this._id_table,
            };

            atributos_table = Object.assign(atributos_table, this._attr_table);


            $("#" + opts.id).rpt_json_table2(atributos_table);


            if (opts.datatable)
                simple_data_table_no("#" + atributos_table.id, opts.no);

            eventoInput('mdl-table');
        });
    }





}

// functions complementarias

function sendAjax(options) {

    var defaults = {
        data: { tipo: 'text', opc: "ls" },
        config: {
            datatable: false,
            fn: '',
            idFilter: this.idFilterBar,
        },
        extends: false

    };

    // Combinamos ambas opciones para envio al backend.
    console.error(options.data);
    let data_form = Object.assign(defaults.data, options.data);

    // Combinamos config con las opciones por default:
    let opts = Object.assign(defaults.config, options.config);

    $('#' + opts.idFilter).validar_contenedor(data_form, (datos) => {
        let extends_ajax = fn_ajax(datos, this._link, '');

        if (!opts.extends) { // si la variable extends no esta definida se ejectuta de forma normal

            //     extendsAjax.then((data) => {

            //         let attr_table_filter = {
            //             data: data,
            //             f_size: '12',
            //             id: 'tbSearch'
            //         };

            //         attr_table_filter = Object.assign(attr_table_filter, this._attr_table);
            //         $("#" + options.id).rpt_json_table2(attr_table_filter);

            //         if (options.datatable)
            //             simple_data_table_no("#" + attr_table_filter.id, 10);

            //     });

        }

    });

}

function getNameMonth(NoMonth) {
    const Months = {
        1: "Enero",
        2: "Febrero",
        3: "Marzo",
        4: "Abril",
        5: "Mayo",
        6: "Junio",
        7: "Julio",
        8: "Agosto",
        9: "Septiembre",
        10: "Octubre",
        11: "Noviembre",
        12: "Diciembre"
    };

    return Months[NoMonth];
}


// datatable
function data_table_export(table, size = 10) {


    $(table).DataTable({
        destroy: true,
        dom: "Bfrtip",
        order: [],

        pageLength: size,
        buttons: [{ extend: 'excel', className: 'btn-outline-primary' }, { extend: 'copy', className: 'btn-outline-primary' }],

        // buttons: ["copy", "excel"],
        oLanguage: {
            sSearch: "Buscar:",
            sInfo:
                "Mostrando del (_START_ al _END_) de un total de _TOTAL_ registros",
            sInfoEmpty: "Mostrando del 0 al 0 de un total de 0 registros",
            sLoadingRecords: "Por favor espere - cargando...",
            oPaginate: {
                sFirst: "Primero",
                sLast: "Último",
                sNext: "Siguiente",
                sPrevious: "Anterior",
            },
        },
    });
}

function simple_data_table(table, no) {
    $(table).DataTable({
        pageLength: no,
        destroy: true,
        searching: true,
        bLengthChange: false,
        bFilter: false,
        order: [],
        bInfo: true,
        "oLanguage": {
            "sSearch": "Buscar:",
            "sInfo": "Mostrando del (_START_ al _END_) de un total de _TOTAL_ registros",
            "sInfoEmpty": "Mostrando del 0 al 0 de un total de 0 registros",
            "sLoadingRecords": "Por favor espere - cargando...",
            "oPaginate": {
                "sFirst": "Primero",
                "sLast": "'Último",
                "sNext": "Siguiente",
                "sPrevious": "Anterior"
            }
        }
    });
}

// Complementos.
function createDocsHead(options) {

    let defaults = {
        data: [],
        type: 'simple-ticket',
        element: null,
    };


    let opts = $.fn.extend(defaults, options);

    const div = $('<div>', { class: 'flex flex-col gap-2 mb-4' });

    switch (opts.type) {
        case 'simple-ticket':

            var row     = $('<div>', { class: 'w-100 flex text-sm justify-between text-uppercase ' });
            var date    = $('<div>', { class: ' text-muted', html: opts.data.date });
            var row2    = $('<div>', { class: 'row mt-1' });
            var label   = $('<label>', { class: 'fw-bold text-muted me-1', 'text': 'Cliente: ' });
            var span    = $('<span>', { class: 'text-muted ', html: opts.data.cliente });
            var cliente = $('<div>', { class: '' }).append(span);


            row.append(cliente, date);
            div.append(row, row2);

            break;

        case 'details':

            var row     = $('<div>', { class: 'w-full flex text-sm  justify-between text-uppercase ' });
            var folio   = $('<div>', { class: ' text-primary font-bold ', html: opts.data.folio });
            var span    = $('<span>', { class: 'text-muted font-semibold ', html: opts.data.cliente });
            var cliente = $('<div>', { class: 'text-primary  font-bold ',text:'Cliente: ' }).append(span);
            
            row.append(
                cliente,
                folio,
            );

            var row2   = $('<div>', { class: 'w-full flex text-sm justify-between text-uppercase mb-2' });
            var span2  = $('<span>', { class: 'text-muted font-semibold ', html: opts.data.date });
            var pedido = $('<label>', { class: 'font-bold text-primary me-1', 'text': 'Fecha :  ' }).append(span2);
           

            

            row2.append(pedido);

            div.append(row, row2);

            break;


        default:

            div.append(opts.element);
            break;

    }






    return div;

}

function dataPicker(options) {

    let defaults = {
        parent: 'iptCalendar',

        type: 'all',

        rangepicker: {

            startDate    : moment().startOf("month"),
            endDate      : moment().endOf("month"),
            showDropdowns: true,
            "autoApply"  : true,

            ranges: {

                Ayer          : [moment().subtract(1, "days"), moment().subtract(1, "days")],
                Antier        : [moment().subtract(2, "days"), moment().subtract(2, "days")],

                "Mes actual"  : [moment().startOf("month"), moment()],
                "Mes anterior": [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")],

            },

            function (start,end){

                onDateRange(start,end);

            }

        },

        rangeDefault: {
            singleDatePicker: true,
            showDropdowns: true,
            "autoApply": true,

            locale: {
                format: "YYYY-MM-DD",
            }

        },

        onSelect: (start, end) => {
            console.log(`Seleccionado: ${start.format("YYYY-MM-DD")} - ${end.format("YYYY-MM-DD")}`);

        }

    };


    let onDateRange = (start, end) => {

        console.log(start,end);

    }


    const settings = { ...defaults, ...options };
    // Configurar el comportamiento según el tipo
    if (settings.type === 'all') {
        $("#" + settings.parent).daterangepicker(
            settings.rangepicker,
            function (start, end) {

                settings.onSelect(start, end);
            }
        );
    } else if (settings.type === 'simple') {
        $("#" + settings.parent).daterangepicker(
            settings.rangeDefault,
            function (start, end) {
                // Llamar a la función personalizada al seleccionar una fecha
                settings.onSelect(start, end);
            }
        );
    }

    // if (settings.type == 'all') {
    //     $("#" + settings.parent).daterangepicker(settings.rangepicker);

    // } else if (settings.type == 'simple') {

    //     $("#" + settings.parent).daterangepicker(settings.rangeDefault);
    // }




}

function addProperties(array, properties) {

    return array.map(item => {
        return {
            ...item,        // Mantiene las propiedades existentes
            ...properties  // Agrega las nuevas propiedades
        };
    });

}

function getDataRangePicker(idInput) {
    const fi = $("#" + idInput).data("daterangepicker").startDate.format("YYYY-MM-DD");
    const ff = $("#" + idInput).data("daterangepicker").endDate.format("YYYY-MM-DD");

    return { fi, ff };
}

function formatPrice(amount, locale = 'es-MX', currency = 'MXN') {
    // Verificar si el monto es null, undefined o 0
    if (!amount) {
        return '-';
    }
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
    }).format(amount);
}

async function useFetch(options = {}) {
    
    // Valores predeterminados
    let defaults = {

        method : 'POST',
        data   : { opc: 'ls' },
        url    : '',            
        success: null     
    
    };

    // Mezclar los valores predeterminados con las opciones proporcionadas
    let opts = Object.assign({}, defaults, options);

    // Validar que la URL esté definida
    if (!opts.url) {
        console.error('URL es obligatoria.');
        return null;
    }

    try {
        // Realizar la petición fetch
        let response = await fetch(opts.url, {
            method: opts.method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(opts.data),
        });

        // Procesar la respuesta como JSON
        let data = await response.json();

        // Si se proporciona el método success, lo ejecutamos con los datos obtenidos
        if (typeof opts.success === 'function') {
            opts.success(data);
        }

        // Retornar los datos por si se quieren usar fuera de la función success
        return data;
    } catch (error) {
        console.error('Error en la petición:', error);
        return null;
    }
}

function getColumnTotal(idTable, col) {
    let total = 0;

    $(`#${idTable} tbody tr`).each(function () {
        const valor = $(this).find(`td:eq(${col})`).text().trim();
        const valorNumerico = parseFloat(valor.replace(/[\$,\-]/g, "")); // Elimina símbolos de $, comas y guiones

        if (!isNaN(valorNumerico)) {
            total += valorNumerico;
        }
    });

    return total;
}

function fomartSpanishDate(fecha) {
    const fechaObj = new Date(fecha);

    const year = fechaObj.getFullYear();
    const month = fechaObj.getMonth() + 1; // El mes se indexa desde 0, por lo que debes sumar 1
    const day = fechaObj.getDate();

    var fechita = fecha;
    var elem = fechita.split('-');
    dia = elem[2];
    mess = elem[1];
    anio = elem[0];


    const dias = [

        'Lunes',
        'Martes',
        'Miercoles',
        'Jueves',
        'Viernes',
        'Sabado',
        'Domingo'
    ];

    const Mes = [
        'SB',
        'Enero',
        'Febrero',
        'Marzo',
        'Abril',
        'MAYO',
        'JUNIO',
        'JULIO',
        'AGOSTO',
        'SEPTIEMBRE',
        'OCTUBRE',
        'NOVIEMBRE',
        'DICIEMBRE'
    ];

    const numeroDia = new Date(fecha).getDay();
    const nombreDia = dias[numeroDia];
    const nombreMes = Mes[month];



    fecha_format = '<span class="text-primary">' + nombreDia + ', ' + dia + ' de ' + nombreMes + ' del ' + year + '</span>';
    return fecha_format;
}

function toogleViewDiv(options) {

    let defaults = {
        parent: 'jsonForm',
        hide: true,         // Indica si ocultar o mostrar los divs
        positions: [4, 5, 6]     // Array con las posiciones de los divs a ocultar
    };

    let opts = Object.assign(defaults, options);
    const form = document.getElementById(opts.parent);
    if (!form) {
        console.warn(`El formulario con ID "${opts.parent}" no existe.`);
        return;
    }

    const allDivs = form.querySelectorAll('.row > div'); // Seleccionar todos los divs directos dentro del formulario

    allDivs.forEach((div, index) => {
        // Si la posiciÃ³n del div estÃ¡ en el array `positions`, se aplica el estilo
        if (opts.positions.includes(index)) {
            div.style.display = opts.hide ? 'none' : '';
        } else {
            div.style.display = ''; // Por defecto, mostrar
        }
    });
}

