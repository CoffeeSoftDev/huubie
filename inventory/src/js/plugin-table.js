$.fn.rpt_json_table = function (options) {
    //Variables para la creacion de una tabla
    thead = "";
    tbody = "";
    table = "";

    var defaults = {
        tipo: "simple",
        data: json,
        name: "simple-table",
        right: [4],
        center: [0],
        color: null,
        head: "",
        grupo: "bg-default",
        th_color: "bg-default",
        clase_table: "table table-bordered table-sm ",
        folding: false,
    };

    var opts = $.fn.extend(defaults, options);

    // Imprime las columnas de la tabla
    for (const k of opts.data.thead) {
        thead += `<th class="text-center ${opts.th_color}">${k}</th>`;
    }

    var r = opts.right;
    var c = opts.color;
    var ct = opts.center;
    // Imprime la informacion contenida en rows

    for (const x of opts.data.row) {
        idRow = x.id;
        const v = Object.values(x);
        let dimension = v.length;
        let last = dimension - 1;
        clase = "";

        ico_group = "";

        if (v[last] == 1) {
            clase = opts.grupo;
        }

        fold = "";
        class_fold = "";

        if (opts.folding == true) {
            if (v[last] == 1) {
                fold = `onclick="unfold(${idRow})"`;
            } else {
                class_fold = `unfold${idRow} d-none`;
            }
        }

        tbody += `<tr class="${clase}  ${class_fold}" ${fold}>`;

        for (let col = 1; col < dimension - 1; col++) {
            right = "";
            color = "";
            center = "";

            for (let $i = 0; $i < r.length; $i++) {
                if (r[$i] == col) {
                    right = "text-right text-end";
                }
            }

            if (c != null) {
                for (let $x = 0; $x < c.length; $x++) {
                    if (c[$x] == col) {
                        if (v[last] != 1) {
                            color = "bg-default-gv bg-aliceblue";
                        }
                    }
                }
            }

            for (let $c = 0; $c < ct.length; $c++) {
                if (ct[$c] == col) {
                    center = "text-center ";
                }
            }

            ico_span = "";

            if (col == 1) {
                ico_span = ` ${ico_group} `;
            }

            tbody += `<td style="font-size:16px;" class="${right}  ${center}  ${color}"> ${ico_span} ${v[col]}  </td>`;
        }

        tbody += `</tr>`;
    } // end row

    // Imprime los resultados en una tabla
    table = `
      <table style="margin-top:15px; font-size:14px;"
      class="${opts.clase_table}" width="100%" id="${opts.name}">

      <thead>
      <tr>
      ${thead}
      </tr>
      </thead>

      <tbody>
      ${tbody}
      </tbody>
      </table>   
    `;

    div = `
    ${opts.head}

    ${table}
  `;

    $(this).html(div);

    return this;
};

$.fn.rpt_json_table2 = function (options) {
    return new Promise((resolve, reject) => {
        var defaults = {
            data: [],
            id: "simple-table",
            right: [],
            center: [],

            /* input */
            ipt: [],
            select: [],
            /* Colores en la tabla */
            color_col: [],
            color_th: "bg-default",
            color_group: "bg-default",
            color: "bg-warning-1",
            /* Reportes & configuracion */
            frm_head: "",
            frm_foot: "",
            title_th: "",
            f_size: 14,
            font_size: 12,
            parametric: false,
            class: "table table-bordered table-sm mt-2",
            folding: false,
            extends: false
        };

        var opts = $.fn.extend(defaults, options);

        tabla = $("<table>", {
            class: opts.class,
            id: opts.id,
        });

        /* Imprimir titulo de tabla */
        arreglo_th = opts.data.thead;

        title = opts.title_th;
        thead = $("<thead>");

        if (title) {
            th = $("<tr>");
            col_size = arreglo_th.length;
            th.append(`<th colspan="${col_size}" > ${title}  </th>`);
            thead.append(th);
        }

        // Imprime las columnas de la tabla

        if (opts.data.thead) {
            // si la variable th recibe datos crea las columnas
            if (opts.extends) {
                
                const ths = opts.data.thead;
 
                if (Array.isArray(ths)){

                   

                    var thClean  = null;
                    var rowtr  = null;
                    var colth    = null;
                   

                    
                    var headerRow = $('<tr>');
                    var headerCell = null;


                    ths.forEach(element => {


                    if(typeof element === 'string'){

                        headerCell = $('<th>', { text: element, class: `text-center ${opts.color_th}` });
                        headerRow.append(headerCell);

                    }else{
                        
                        rowtr = $('<tr>');
                        Object.keys(element).forEach(key => {


                            var cell = $('<th>', { text: element[key], class: `text-center ${opts.color_th}` });
                            
                            if (typeof element[key] === 'object') {
                                cell = $('<th>', element[key]);
                            } 
                            
                            rowtr.append(cell);
                        });
                        thead.append(rowtr);
                    }
                        


                        
                    }); // end row

                    thead.append(headerRow);
                    
                    
                 
                  
                }else {

                                           
                    ths.forEach(element => {
                        th = $("<tr>");
                        var col_th;
                        Object.keys(element).forEach(key => {
                            if (typeof element[key] === 'object') {
                                col_th = $('<th>', element[key]);
                            }else {
                                col_th = $('<th>', {'text': key});
                            }
                            th.append(col_th);
                        });
                        thead.append(th);
                    });

                }


            } else {

                let newTh = $('<tr>');
               


                for (const k of arreglo_th) {
                    newTh.append(`<th class="text-center ${opts.color_th}"> ${k}  </th>`);
                }


                thead.append(newTh);

            }






        } else {
            th = $("<tr>");

            for (var clave in opts.data.row[0]) {
                clave = (clave == 'btn' || clave == 'btn_personalizado' || clave == 'a' || clave == 'dropdown') ? '' : clave;
                if (clave != "opc" && clave != "id")
                    th.append(
                        $("<th>", {
                            class: `${opts.color_th}`,
                            style: `font-size:${opts.f_size}px;`
                        }).html(clave)
                    );
            }

            thead.append(th);
        }



        // Variables de posicionamiento & color

        var r = opts.right;
        var c = opts.color_col;
        var ct = opts.center;
        var iptx = opts.ipt;
        var select = opts.select;

        /*-- Imprime las filas de la tabla y el cuerpo --*/
        tbody = $("<tbody>");

        for (const x of opts.data.row) {
            idRow = x.id;
            const obj = Object.values(x);
            let dimension = obj.length;

            let cols_conf = 1;
            if (x.btn != null)
                cols_conf = 2;

            let last = dimension - cols_conf;

            /*-- Crear el elemento folding   -- */

            fold = "";
            class_fold = "";
            ico_group = '';

            if (opts.folding == true) {

                if (obj[last] == 1) {
                    fold = `unfold(${idRow})`;
                    class_fold = "pointer fw-bold ";
                    ico_group = '<i class="icon-right-dir"></i>';
                } else {
                    class_fold = `unfold${idRow} d-none`;
                }
            }


            td = $("<tr>",{class: class_fold , onclick: fold});

            // Recorrido por columnas
            for (let col = 1; col < dimension - 1; col++) {
                // Variables de posicionamiento & color
                right = "";
                color = "";
                center = "";

                bg_grupo = "";

                if (!x.colgroup) {

                    if (x.opc) {
                        if (x.opc == 1) {
                            bg_grupo = opts.color_group + " fw-bold ";
                        } else if (x.opc == 2) {
                            bg_grupo = opts.color_group + " text-primary fw-bold ";
                        }


                    }

                    for (let $i = 0; $i < r.length; $i++) {
                        if (r[$i] == col) {
                            right = "text-right text-end";
                        }
                    }

                    for (let j = 0; j < ct.length; j++) {
                        if (ct[j] == col) {
                            center = "text-center";
                        }
                    }

                    let indices = Object.keys(x);

                    // Determina si esta habilitada el grupo
                    if (x.opc != 1 && x.opc != 2) {
                        for (let k = 0; k < c.length; k++) {
                            if (c[k] == col) {
                                bg_grupo = opts.color;
                            }
                        }
                    }

                    let tdText = obj[col];

                    /* --  --*/

                    for (let a = 0; a < iptx.length; a++) {
                        if (iptx[a] == col) {
                            let data_ipt = obj[col];

                            ipt_type = "text";

                            if (typeof data_ipt === "string") {
                                tdText = `<input disabled type="${ipt_type}" class="form-control input-sm cellx text-end" value="${data_ipt}" />`;

                            } else {
                                for (const z of data_ipt) {
                                    let disabled = '';

                                    if (z.disabled) {
                                        disabled = `disabled = ${z.disabled}`;
                                    }

                                    let onChangeipt = z.fn ? z.fn : '';

                                    tdText = `<input 
                                    type   ="${ipt_type}"
                                    value  = "${z.value}"  
                                    id     = "${z.id}"
                                    name   = "${z.name}"
                                    onkeyUp = "${onChangeipt}"
                                    ${disabled}
                                    class=" form-control input-sm text-primary cellx fw-bold text-end" />`;
                                }
                            }
                        } //end recorrido input
                    }

                    /*ESTE SELECT ES POR CULPA DE ROSA */

                    for (let b = 0; b < select.length; b++) {
                        if (select[b] == col) {
                            let data_select = obj[col];

                            if (typeof data_select === "string") {
                                tdText = `<input class="form-control " value="${data_select}" />`;
                            } else {
                                for (const z of data_select) {
                                    tdText = `<select class="form-control input-sm">`;
                                    tdText += `<option id="" value="0" hidden selected > - Seleccionar - </option>`;

                                    $.each(z.data, function (index, item) {
                                        tdText += `<option value="${item.id}" >  ${item.valor}</option>`;
                                    });

                                    tdText += `</select>`;
                                }
                            }
                        } //end recorrido input
                    }
                    //

                    if (obj[col] != "btn") {


                        let attr_td = {
                            id: indices[col] + '_' + x.id,
                            style: 'font-size:' + opts.f_size + 'px',
                            class: `${right} ${center} ${bg_grupo}`,
                            html: tdText
                        };



                        if (opts.extends) {

                            if (typeof obj[col] === 'object') {
                                attr_td = Object.assign(attr_td, obj[col]);
                            }


                        }

                        td.append($('<td>', attr_td));


                        //   td.append(`<td id="${indices[col]}_${x.id}"
                        //   style="" 
                        //   class=""> 
                        //   ${tdText}  </td>`);
                    }


                }//end agrupar 
                else {

                    td.append($('<td>', {
                        class: opts.color_group,
                        colspan: arreglo_th.length,
                        html: obj[col]
                    }));
                }


            } //endfor

            /* Agregar botón  */

            if (x.btn != null) {
                td_btn = $("<td> ", {
                    class: `text-center ${bg_grupo} `,
                });


                for (const y of x.btn) {
                    let text = '';
                    if (y.text) {
                        text = y.text;
                    }

                    btn_col = $(" <button>", {
                        class: `btn btn-outline-${y.color} btn-sm me-1`,
                        onclick: `${y.fn}(${x.id})`,
                        html: `<i class="${y.icon}"></i>  ${text} `,
                    });

                    td_btn.append(btn_col);
                }

                td.append(td_btn);
            }

            //crear boton personalizado 
            
            if (x.dropdown != null) {

                let colorButtonDropdown =  'outline-primary'; 

               
                td_btn = $("<td> ", {
                    class: `text-center ${bg_grupo}`,
                });

                var $button = $("<button>", {
                    class: `btn btn-${colorButtonDropdown} btn-sm` ,
                    id: "dropdownMenu" + x.id,
                    type: "button",
                    "data-bs-toggle": "dropdown",
                    "aria-expanded": "false",
                    html: `<i class="icon-dot-3 text-primary"></i>`,

                });

                var $ul = $("<ul>", { class: "dropdown-menu" });

                x.dropdown.forEach((dropdownItem) => {
                    const $li = $("<li>");

                    // Construir el contenido dinámico con íconos y texto
                    let html = dropdownItem.icon && dropdownItem.icon !== ""
                        ? `<i class="text-primary ${dropdownItem.icon}"></i>`
                        : "<i class='icon-minus'></i>";

                    html += dropdownItem.text && dropdownItem.text !== ""
                        ? ` ${dropdownItem.text}`
                        : "";

                    const $a = $("<a>", {
                        class: "dropdown-item",
                        id: dropdownItem.id,
                        href: dropdownItem.href || "#",
                        html: html,
                        onclick: dropdownItem.onclick
                    });

                    $li.append($a);

                    $ul.append($li);
                });





                td_btn.append($button, $ul);

                td.append(td_btn);
            }

            if (x.a != null) {

                td_btn = $("<td> ", {
                    class: `text-center ${bg_grupo}`,
                });

                for (const p of x.a) {

                    let btn_col = $(" <a>", p);


                    td_btn.append(btn_col);

                }

                td.append(td_btn);

            }

            /* Agregar botón personalizado  */
            if (x.btn_personalizado != null) {
                td_btn = $("<td> ", {
                    class: `text-center ${bg_grupo}`,
                });

                for (const p of x.btn_personalizado) {
                    p.text ? (text = p.text) : (text = "");

                    btn_col = $(" <button>", {
                        class: `btn btn-outline-${p.color} btn-sm me-1`,
                        id: (p.id_btn) ? p.id_btn : p.id,
                        estado: p.estado,
                        onclick: `${p.fn}`,
                        html: `<i class="${p.icon}"></i>  ${text}`,
                    });

                    td_btn.append(btn_col);
                }

                td.append(td_btn);
            }

            tbody.append(td);
        }

    

        tabla.append(thead);
        tabla.append(tbody);

        div_table = $("<div>", {
            class: "table-responsive",
        });

        div_table.append(tabla);

        /* --  Contenedor para Reporte  -- */

        div = $("<div>");

        const header = opts.data.head ? createDocsHead(opts.data.head) : '';


        div.append(opts.data.frm_head);
        div.append(header);
        div.append(div_table);
        div.append(opts.data.frm_foot);

        $(this).html(div);

        //   return this;
        resolve();
    });
};



$.fn.JsonTablePro = function (options) {
    var defaults = {
        data: [],
        id: "simple-table",
        right: [],
        center: [],

        /* Colores en la tabla */

        color_col: [],
        color_th: "bg-default",
        color_group: "bg-default",

        /* Reportes & configuracion */

        frm_head: "",
        frm_foot: "",
        title_th: "",
        f_size: 14,
        parametric: false,
        clase_table: "table table-bordered table-sm mt-2",
        folding: false,
        extends: false,
    };

    var opts = $.fn.extend(defaults, options);

    /* Crear tabla */
    tabla = $("<table>", {
        class: opts.clase_table,
        id: opts.id,
    });

    thead = $("<thead>");

    // -- Imprime las columnas de la tabla --
    contador = 0;
    th = $("<tr>", {
        class: "bg-primary",
    });

    th.append(`<th  class="text-center bg-primary"></th>`);

    thead.append(th);

    for (const k of opts.data.colspan) {
        if (contador != 0) {
            th.append(`<th colspan="3" class="text-center bg-primary"> ${k}  </th>`);
        }

        contador++;
    }

    thead.append(th);

    th = $("<tr>");
    for (const k of opts.data.thead) {
        th.append(`<th class="text-center ${opts.color_th}"> ${k}  </th>`);
    }

    thead.append(th);

    // -- --

    // thead_th = opts.data.th;
    // th = $("<tr>");

    // thead_th.forEach((thx) => {
    //     console.log(...thx);
    //     // th.append('<th>');
    //     // thead.append(th);
    // });

    // Recorrido por columnas
    // for (const x of opts.data.th) {
    //      const obj = Object.values(x);
    //      let dimension = obj.length;

    //     th = $("<tr>");

    //     for (let col = 0; col < dimension ; col++) {
    //       objx =     Object.values(obj[col]);

    //       th.append(`<th> ${objx} </th>`);

    //     }

    //     thead.append(th);
    // }

    // Variables de posicionamiento & color
    var r = opts.right;
    var c = opts.color;
    var ct = opts.center;

    /*-- Imprime las filas de la tabla y el cuerpo --*/
    tbody = $("<tbody>");
    for (const x of opts.data.row) {
        idRow = x.id;
        const obj = Object.values(x);
        let dimension = obj.length;
        let last = dimension - 1;

        bg_grupo = "";

        if (x.opc) {
            if (x.opc == 1) {
                bg_grupo = opts.bg_grupo;
            }
        }

        td = $("<tr>", {
            class: bg_grupo,
        });

        // Recorrido por columnas
        for (let col = 1; col < dimension - 1; col++) {
            // Variables de posicionamiento & color
            right = col == 1 ? "" : "text-end";
            color = "";
            center = "";

            for (let $i = 0; $i < r.length; $i++) {
                if (r[$i] == col) {
                    right = "text-right text-end";
                }
            }

            td.append(
                `<td style="font-size:${opts.f_size}px;"  class="${right} p-0 ${bg_grupo}"> ${obj[col]}  </td>`
            );
        }

        /* Agregar botón  */

        if (x.btn != null) {
            td_btn = $("<td> ", {
                class: "text-center",
            });
            for (const y of x.btn) {
                btn_col = $(" <button>", {
                    class: `btn btn-outline-${y.color} btn-sm me-1`,
                    onclick: `${y.fn}(${x.id})`,
                    html: `<i class="${y.icon}"></i> `,
                });
                td_btn.append(btn_col);
            }

            td.append(td_btn);
        }

        /* Agregar botón personalizado  */
        if (x.btn_personalizado != null) {
            td_btn = $("<td> ", {
                class: "text-center",
            });

            for (const p of x.btn_personalizado) {
                p.text ? (text = p.text) : (text = "");

                btn_col = $(" <button>", {
                    class: `btn btn-outline-${p.color} btn-sm me-1`,
                    id: p.id_btn,
                    estado: p.estado,
                    onclick: `${p.fn}`,
                    html: `<i class="${p.icon}"></i>  ${text}`,
                });

                td_btn.append(btn_col);
            }

            td.append(td_btn);
        }

        tbody.append(td);
    }

    tabla.append(thead);
    tabla.append(tbody);

    div_table = $("<div>", {
        class: "table-responsive",
    });

    div_table.append(tabla);

    /* Contenedor para Reporte */

    div = $("<div>", {
        class: "",
    });

    div.append(opts.data.frm_head);
    div.append(div_table);
    div.append(opts.data.frm_foot);

    $(this).html(div);
};
