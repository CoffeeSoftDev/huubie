$.fn.empty_state = function (options) {
  var defaults = {
    text: "No se encontro ningún registro",
    icon: "icon-inbox-1",
  };

  // Carga opciones por defecto
  var opts = $.fn.extend(defaults, options);

  var div = $("<div>", {
    class: "col-12 text-center",
  });

  var icon = $("<i>", {
    class: `mt-5 text-muted display-1 ${opts.icon} `,
  });

  var empty_text = $("<h5>", {
    class: "text-muted mt-3 mb-3",
    text: opts.text,
  });

  div.append(icon);
  div.append(empty_text);
  $(this).html(div);
};

$.fn.simple_json_content = function (options) {
  var defaults = {
    data: [],
    clase: "",
    opts: [],
    color_btn: "primary",
    color_default: "primary",
    fn: "buscar()",
    type: "default",
  };

  var opts = $.fn.extend(defaults, options);

  // Creamos el contenedor
  var div = $("<div>", {
    class: "row ",
  });

  for (const x of opts.data) {
    let div_col = "col-sm-2";

    if (x.class) {
      div_col = x.class;
    }

    var div_hijo = $("<div>", {
      class: div_col,
    });

    // Etiqueta del componente
    div_hijo.append(
      $(`<label>`, {
        class: "fw-bold ",
        html: x.lbl,
      })
    );

    switch (x.opc) {

      case 'label':

       let lbl = $("<label>", {
         class: "fw-bold mt-4",
         html: x.text,
         id: x.id,
       });

       div_hijo.append(lbl);
        
      break;

      case "input-group":
        var align = "";
        var inputGroup = $("<div>", {
          class: "input-group",
        });

        // El valor es de tipo numero o cifra
        let val_type = "text";

        if (x.tipo == "cifra" || x.tipo == "numero") {
          align = "text-end";
          // Se modifico por detalle de text que usaba rosa
          val_type = "text";

          var iconSpan = $("<span>", {
            class: "input-group-text",
          }).append(
            $("<i>", {
              class: x.icon,
            })
          );

          inputGroup.append(iconSpan);
        }
        //   console.log(">> " + x.attr);

        inputGroup.append(
          $(`<input >`, {
            class: `form-control input-sm ${align}`,
            id: x.id,
            tipo: x.tipo,
            name: x.id,
            //   required: required,
            value: x.value,
            type: val_type,
            placeholder: x.placeholder,
            disabled: x.disabled,

            cat: x.cat,
            readonly: x.readonly,

            // onblur: x.onblur + "()",
          })
        );

        // ESTA IDEA SURGIO X CULPA DE ROSA!! >:(

        //   inputGroup.append($(`<input >`, x.attr));

        if (x.tipo != "cifra") {
          var iconSpan = $("<span>", {
            class: "input-group-text",
          }).append(
            $("<i>", {
              class: x.icon,
            })
          );

          inputGroup.append(iconSpan);
        }

        div_hijo.append(inputGroup);

        break;

      case "textarea":
        div_hijo.append(
          $("<textarea>", {
            class: `form-control resize`,
            id:  x.id,
            tipo: x.tipo,
            name: x.id,
            text: x.value,
            placeholder: x.placeholder,
            cols: x.col,
            rows: x.row,
          })
        );

      break;
      
      
      case "input-file-btn":
        div_hijo.append(
          $("<input>", {
            class: " input-sm",
            id: x.id,
            tipo: x.tipo,
            name: x.id,
            //  required: required,
            type: "file",
          })
        );
        break;

      case "input-file":
        if (x.color_btn) {
          color = x.color_btn;
        } else {
          color = opts.color_default;
        }

        let ipt_file = $("<input>", {
          class: `hide`,
          type: "file",
          id: x.id,
          onchange: x.fn,
        });

        let lbl_btn = $("<label>", {
          class: `btn btn-outline-${color} col-12 mt-4`,
          text: x.text,
          for: x.id,

          // onclick:x.fn,
        });

        div_hijo.append(ipt_file);
        div_hijo.append(lbl_btn);
        break;

      case "btn":
        if (x.color_btn) {
          color = x.color_btn;
        } else {
          color = opts.color_default;
        }

        var _btn = $("<button>", {
          class: `btn btn-outline-${color} col-12 mt-4`,
          html: x.text,
          type: "button",
          id: x.id,
          onclick: x.fn,
        });
        div_hijo.append(_btn);

        break;

      case "select":
        var select = $(`<select>`, {
          class: "form-control input-sm",
          id: x.id,
          name: x.id,
          required: false,
          onchange: x.onchange,
          placeholder: x.placeholder,
        });

        if (x.selected) {
          select.html(`<option value="0" hidden > ${x.selected} </option>`);
        }

        $.each(x.data, function (index, item) {
          option = item.id;
          option_selected = x.value;
          bandera = false;

          if (option == option_selected) {
            bandera = true;
          }

          select.append(
            $("<option>", {
              value: option,
              text: item.valor,
              selected: bandera,
            })
          );
        });

        div_hijo.append(select);

      break;

      case "input-calendar":
        var inputGroup = $("<div>", {
          class: "input-group date calendariopicker",
        });
        // Crear objeto input calendar

        inputGroup.append(
          $("<input>", {
            class: `select_input form-control input-sm `,
            id: x.id,
            tipo: x.tipo,
            name: x.id,
            value: x.value,
          })
        );

        inputGroup.append(
          $("<span>", {
            class: "input-group-text",
          }).append(
            $("<i>", {
              class: "icon-calendar",
            })
          )
        );

        div_hijo.append(inputGroup);
        break;
    }

    /* vaciar el contenido */
    div.append(div_hijo);
  } // end coleccion

  if (opts.type == "default") {
    var div_btn = $("<div>", {
      class: `col-12 col-sm-6 col-lg-2 mt-4`,
    });

    var btn_ok = $("<button>", {
      class: `btn btn-outline-${opts.color_btn} col-12`,
      text: "Buscar",
      type: "submit",
      id: "btnOK",
      onclick: opts.fn,
    });

    div_btn.append(btn_ok);
    div.append(div_btn);
  }

  $(this).append(div);
};

$.fn.validar_contenedor = function (options, callback) {
  let opc = {
    texto: /^[a-zA-ZÀ-ÖØ-öø-ÿ\s]+$/,
    texto_replace: /[^a-zA-ZÀ-ÖØ-öø-ÿ\s]+/g,
    numero: /^\d+$/,
    numero_replace: /[^0-9]/g,
    txtnum: /^[a-zA-Z0-9]*$/,
    txtnum_replace: /[^a-zA-Z0-9]+/g,
    cifra: /^-?\d+(\.\d+)?$/,
    email: /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/,
  };

  const elemento = $(this);

  //Caso contrario es un contenedor
  let isValid = true;

  $(this)
    .find("input, textarea")
    .on("input", function () {
      const IPT = $(this);
      let iptval = IPT.val().trim();

      if (IPT.is('[tipo="texto"]'))
        if (!opc.texto.test(iptval))
          IPT.val(iptval.replace(opc.texto_replace, ""));

      if (IPT.is('[tipo="numero"]'))
        if (!opc.numero.test(iptval))
          IPT.val(iptval.replace(opc.numero_replace, ""));

      if (IPT.is('[tipo="textoNum"],[tipo="alfanumerico"]'))
        if (!opc.txtnum.test(iptval))
          IPT.val(iptval.replace(opc.txtnum_replace, ""));

      if (IPT.is('[tipo="cifra"]'))
        if (!opc.cifra.test(iptval)) {
          IPT.val(
            iptval
              .replace("--", "-")
              .replace("..", ".")
              .replace(".-", ".")
              .replace("-.", "-0.")
              .replace(/^\./, "0.")
              .replace(/[^0-9\.\-]/g, "")
              .replace(/(\.[^.]+)\./g, "$1")
              .replace(/(\d)\-/g, "$1")
          );
        }

      if (IPT.is('[tipo="correo"],[tipo="email"],[type="email"]')) {
        if (!opc.email.test(iptval)) {
          IPT.addClass("form-control is-invalid");
          if (IPT.parent().hasClass("input-group")) {
            IPT.parent().next("span.text-danger").remove();
            IPT.parent().after(
              '<span class="text-danger form-text"><i class="icon-attention"></i> Ingrese un correo válido.</span>'
            );
          } else {
            IPT.next("span.text-danger").remove();
            IPT.after(
              '<span class="text-danger form-text"><i class="icon-attention"></i> Ingrese un correo válido.</span>'
            );
          }
        } else {
          IPT.removeClass("form-control is-invalid");
          if (IPT.parent().hasClass("input-group"))
            IPT.parent().next("span").remove();
          else IPT.next("span").remove();
        }
      }

      if (IPT.hasClass("text-uppercase")) IPT.val(IPT.val().toUpperCase());
      if (IPT.hasClass("text-lowercase")) IPT.val(IPT.val().toLowerCase());

      if (IPT.is("[maxlength]")) {
        let limit = parseInt(IPT.attr("maxlength"));
        IPT.val(IPT.val().slice(0, limit));
      }

      if (IPT.val().trim() !== "") {
        isValid = true;
        IPT.removeClass("is-invalid");
        IPT.siblings("span.text-danger").addClass("hide");
        if (IPT.parent().hasClass("input-group"))
          IPT.parent().next("span").addClass("hide");
      }
    });

  $(this)
    .find("select")
    .on("change", function () {
      const SELECT = $(this);
      let value = SELECT.val();

      if (value !== "" || value != "0") {
        isValid = true;
        SELECT.removeClass("is-invalid");
        SELECT.siblings("span.text-danger").addClass("hide");
        if (SELECT.parent().hasClass("input-group"))
          SELECT.parent().next("span").addClass("hide");
      }
    });

  $(this)
    .find("[required]")
    .each(function () {
      if (
        $(this).val() === "" ||
        $(this).val() == "0" ||
        $(this).val().length == 0 ||
        $(this).val() == null
      ) {
        isValid = false;
        $(this).focus();
        $(this).addClass("is-invalid");
        $(this)
          .siblings("span.text-danger")
          .removeClass("hide")
          .html('<i class="icon-attention"></i> El campo es requerido');
        if ($(this).parent().hasClass("input-group"))
          $(this)
            .parent()
            .next("span")
            .removeClass("hide")
            .html('<i class="icon-attention"></i> El campo es requerido');
      } else {
        $(this).removeClass("is-invalid");
        $(this).siblings("span.text-danger").addClass("hide");
        if ($(this).parent().hasClass("input-group"))
          $(this).parent().next("span").addClass("hide");
      }
    });

  if (isValid) {
    let defaults = {
      tipo: "json",
    };
    // Comvina opciones y defaults
    let opts = $.extend(defaults, options);

    let formData = new FormData();

    for (const key in opts) {
      if (key !== "tipo") {
        formData.append(key, opts[key]);
      }
    }

    elemento.find("*").each(function () {
      if ($(this).is(":input") && !$(this).is("button")) {
        let name = $(this).attr("name");
        let value = $(this).val();
        formData.append(name, value);
      }
    });

    if (opts.tipo === "text") {
      let valores = "";
      formData.forEach((value, name) => {
        valores += name + "=" + value + "&";
      });

      if (typeof callback === "function") callback(valores.slice(0, -1));
    } else if (opts.tipo === "json") {
      if (typeof callback === "function") callback(formData);
    }
  }
};

$.fn.edit_json_form = function (options) {
  txt = "";

  var defaults = {
    data: [],
    smart: false,
    input_default: true,
  };

  // Carga opciones por defecto
  var opts = $.fn.extend(defaults, options);

  /* -- funcion smart
    Permite crear inputs de forma dinamica,
    por defecto crea inputs tipo number
  -- */

  if (opts.smart) {
    var div = $(this);
    position = 0;

    for (var clave in opts.data) {
      var div_hijo = $("<div>", {
        class: `col mb-3 `,
      });

      div_hijo.append(
        $("<label>", {
          class: "fw-bold ",
          html: clave,
        })
      );

      div_hijo.append(
        $("<input>", {
          class: "form-control input-sm text-end",
          name: clave,
          id: clave,
        })
      );

      div.append(div_hijo);

      console.log("clave: " + clave);
    }
  }

  /*Recorrido del json  */

  for (const frm in opts.data) {
    /* LLenamos la informacion si encontramos un objeto input */

    if (
      $(this)
        .find('[name="' + frm + '"]')
        .not("select")
        .is(":input")
    )
      $(this)
        .find('[name="' + frm + '"]')
        .val(opts.data[frm]);
  } // end for
};

$.fn.simple_json_tab = function (options) {
  txt = "";

  var defaults = {
    data: [],
    id: "myTab",
  };

  // Carga opciones por defecto
  var opts = $.fn.extend(defaults, options);

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
    active = "";
    tab_active = "";
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
    let idTab  = x.id ?? x.tab.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
    
    li.append(
        $('<a>', {
            class: "nav-link text-dark " + active,
            id: idTab + "-tab",
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

  $(this).html(div);
};

$.fn.content_json_form = function (options) {

    var defaults = {
        data: [],

        class  : "row ",
        type   : "btn",
        
        icon   : "icon-dollar",
        id     : 'jsonForm',
        prefijo: '',

        Element :'div',
        
        color        : "primary",
        color_btn    : "outline-primary",
        color_default: 'primary',
        text_btn     : "Aceptar",
        fn           : "EnviarDatos()",
        id_btn       : "btnAceptar",
        required     : true,
    };

    var opts = $.fn.extend(defaults, options);

    // Creamos el contenedor
    var div = $("<div>", {
        class     : opts.class,
        id        : opts.id
    });


    for (const x of opts.data) {
        let div_col = "col-sm-4 mt-1";

        if (x.class) 
            div_col = x.class;
        

        var div_hijo = $("<div>", {
            class: div_col,
        });

        // Etiqueta del componente
            div_hijo.append(
                $('<label>', {
                    class: "fw-bold ",
                    html: x.lbl,
                })
            );
       
        /*-- Crear elementos para los formularios --*/

        var required = x.required === false ? false : true;
        let aux_name = x.name ? x.name : x.id;
        let className = '';


        var attr_default = {
            id   : opts.prefijo + x.id,
            tipo : x.tipo,
            name : aux_name,
            value: x.value,
            
            required   :required,
            placeholder: x.placeholder,
            disabled   : x.disabled,
        };
        
        switch (x.opc) {

            case 'code':
                div_hijo.empty();

                let code = JSON.stringify(x.json, null, 2);

                div_hijo.addClass('code-viewer ');
                let pre = $('<pre>').text(code);

                div_hijo.append(pre);
            break;

            case 'radio':

                // div_hijo.empty();

                let idx = x.id;
                className = x.className ? x.className :'form-check-input ';

                let rd = $('<input>', {
                    type: 'radio',
                    class: className,
                    name: x.name ? x.name : id,
                    value: x.value,
                    onChange: x.onchange ,

                    checked: x.checked || false,
                    id: idx,
                });

                var lbl = $('<label>', {
                    class: 'px-2 form-check-label fw-bold',
                    text: x.text ? x.text : x.valor,
                    for: idx,
                });

             
                div_hijo.append(rd,lbl);

            break;    

            case 'checkbox':
                div_hijo.empty();
                let id = x.id;

                div_hijo.attr('for',id);
                

                    className  = x.className ? x.className :'form-check-input ';
                let classLabel = x.classLabel ? x.classLabel : 'form-check-label fw-semibold';
            

                let radio = $('<input>', {
                    type    : 'checkbox',
                    class   : className,
                    onChange: x.onchange+'()',
                    name    : x.name ? x.name: id,
                    value   : true,
                    id      : id
                });

                let label = $('<label>', { 
                    class: classLabel,
                    text: x.text ? x.text : x.valor,
                    for: id,
                });


                div_hijo.append(radio, label);




                // div_hijo.append(check_group);
            break;


            case "list-group": 
                let divGroup = $('<div>',{ class: 'list-group ' });

                x.data.forEach((item) => {

                    let a     = $('<a>', { class: 'list-item pointer' });
                    let icons = $('<span>', { class: 'text-muted icon ' + item.ico });
                    icons.prepend(item.text);

                    
                    let spans = $('<span>',{class:'badge badge-bordered badge-primary'});
                    spans.prepend(item.notifications);
                    
                    a.append(icons,spans);

                    divGroup.append(a);
                });


                div_hijo.append(divGroup);
            
            
            break;

            case "input":
                var align = "";
                if (x.tipo == "cifra" || x.tipo == "numero") {
                    align = "text-end";
                }

                // asignar atributos al input:
                let attr_ipt = {
                    class: `form-control input-sm ${align}   `,
                    type: x.type,
                    
                    onkeyup: x.onkeyup ? x.onkeyup : '',
                };

                attr_ipt = Object.assign(attr_default, attr_ipt);

                div_hijo.append($('<input>', attr_ipt));

            break;

            case "input-group":
                var align = "";
                var inputGroup = $("<div>", {
                    class: "input-group",
                });

                // El valor es de tipo numero o cifra

                let val_type = "text";
                if(x.type)
                val_type = x.type;    

                if (x.tipo == "cifra" || x.tipo == "numero") {
                    align = "text-end";
                    // Se modifico por detalle de text que usaba rosa
                    // val_type = "text";

                    var iconSpan = $("<span>", {
                        class: "input-group-text",
                    }).append(
                        $("<i>", {
                            class: x.icon,
                        })
                    );

                    inputGroup.append(iconSpan);
                }
                //   console.log(">> " + x.attr);

                let atributos_ipt = {
                    class   : `form-control input-sm ${align}`,
                    cat     : x.cat,
                    readonly: x.readonly,
                    type    : val_type,
                    onKeyUp : x.onkeyup,

                };

                atributos_ipt = Object.assign(attr_default, atributos_ipt);

                inputGroup.append($('<input >', atributos_ipt));

      
                if (x.tipo != "cifra") {
                    var iconSpan = $("<span>", {
                        class: "input-group-text",
                    }).append(
                        $("<i>", {
                            class: x.icon,
                        })
                    );

                    inputGroup.append(iconSpan);
                }

                div_hijo.append(inputGroup);

                break;

            case "textarea":
                div_hijo.append(
                    $("<textarea>", {
                        class: `form-control resize`,
                        id: x.id,
                        tipo: x.tipo,
                        name: x.id,
                        text: x.value,
                        placeholder: x.placeholder,
                        cols: x.cols,
                        rows: x.rows,
                        required: x.required || false
                    })
                );

            break;


            case "input-file-btn":
                div_hijo.append(
                    $("<input>", {
                        class: " input-sm",
                        id: x.id,
                        tipo: x.tipo,
                        name: x.id,
                        //  required: required,
                        type: "file",
                    })
                );
                break;

            case "input-file":
                if (x.color_btn) {
                    color = x.color_btn;
                } else {
                    color = opts.color_default;
                }

                let ipt_file = $("<input>", {
                    class: `hide`,
                    type: "file",
                    accept:'.xlsx, .xls',
                    id: x.id,
                    onchange: x.fn,
                });

                // let icons = (x.icon) ? `<i class="${x.icon}"></i>` : '';
                // console.warn(icons);

                let lbl_btn = $("<label>", {
                    class: `btn btn-outline-${color} col-12 mt-4`,
                    html: `  ${x.text} `,
                    for: x.id,

                    // onclick:x.fn,
                });

                div_hijo.append(ipt_file);
                div_hijo.append(lbl_btn);
                break;

            case "btn":
                if (x.color_btn) {
                    color = x.color_btn;
                } else {
                    color = opts.color_default;
                }

                let icon = (x.icon) ? `<i class="${x.icon}"></i>`   : '';
                var text = x.text ? x.text : '';



                var _btn = $("<button>", {
                    class: `btn btn-${color} w-100 mt-4`,
                    html: `${icon}  ${text} ` ,
                    type: "button",
                    id: x.id,
                    onclick: x.fn,
                });
                div_hijo.append(_btn);

            break;
            
            case "btn-submit":
                if (x.color_btn) {
                    color = x.color_btn;
                } else {
                    color = opts.color_default;
                }

                var _btn = $("<button>", {
                    class: `btn btn-${color} col-12 mt-4`,
                    text: x.text,
                    type: "submit",
                    id: x.id,
                    onclick: x.fn,
                });
                div_hijo.append(_btn);

                break;
            case 'button':

                if (x.color_btn) {
                    color = x.color_btn;
                } else {
                    color = opts.color_default;
                }

                var i = (x.icon) ? `<i class="${x.icon}"></i>` : '';
                var text = x.text ? x.text : '';

                className = `mt-4 btn btn-${color} `;

                let buttonEvents = {
                    onclick :x.fn
                };

                if(x.onClick)
                buttonEvents = { click: x.onClick }



 
                var button = $('<button>',{
                    class: className + (x.className ? x.className :''),
                    html: `${i} ${text} `,
                    id: x.id,
                    ...buttonEvents,
                    type: 'button'
                    
                });

                // var _btn = $("<button>", {
                //     class: ` w-100 `,
                //     type: "button",
                   
                // });

                div_hijo.append(button);


            break;
                

            case "select":
                var select = $(`<select>`, {
                    class: "form-select input-sm",
                    id: x.id,
                    name: x.id,
                    required: false,
                    onchange: x.onchange,
                    placeholder: x.placeholder,
                    multiple: x.multiple
                });

                if (x.selected) {
                    select.html(`<option value="0" > ${x.selected} </option>`);
                }

                $.each(x.data, function (index, item) {
                    option = item.id;
                    option_selected = x.value;
                    bandera = false;

                    if (option == option_selected) {
                        bandera = true;
                    }

                    select.append(
                        $("<option>", {
                            value: option,
                            text: item.valor,
                            selected: bandera,
                        })
                    );
                });

                div_hijo.append(select);

                break;

            case "input-calendar":
                var inputGroup = $("<div>", {
                    class: "input-group date calendariopicker",
                });
                // Crear objeto input calendar

                inputGroup.append(
                    $("<input>", {
                        class: `select_input form-control input-sm `,
                        id: x.id,
                        tipo: x.tipo,
                        name: x.id,
                        value: x.value,
                    })
                );

                inputGroup.append(

                    $("<span>", {
                        class: "input-group-text",
                    }).append(
                        $("<i>", {
                            class: "icon-calendar-2",
                        })
                    )
                );

                div_hijo.append(inputGroup);
            break;    

            case 'btn-select':

                const iptGroup = $('<div>',{class: 'input-group'});

                const btnGroup = $('<a>',{ 
                    class: 'btn btn-primary' ,
                    text: x.text,
                    onclick: x.fn 
                });

                const icons = $('<i>',{class: x.icon});
                btnGroup.append(icons);

                // select 

                var iptSelect = $('<select>', {
                    class   : "form-control input-sm",
                    id      : x.id,
                    name    : x.id,
                    required: required,
                    onchange: x.onchange
                });

                if (x.selected) {
                    iptSelect.html(`<option value="0" > ${x.selected} </option>`);
                }

                $.each(x.data, function (index, item) {
                    var option = item.id;
                    var option_selected = x.value;
                    var bandera = false;

                    if (option == option_selected) {
                        bandera = true;
                    }

                    iptSelect.append(
                        $("<option>", {
                            value: option,
                            text: item.valor,
                            selected: bandera,
                        })
                    );
                });




                iptGroup.append(iptSelect);
                iptGroup.append(btnGroup);


                div_hijo.append(iptGroup);

                

            break;    

            default:
               
                div_hijo.append($('<'+x.opc+'>',x));
            break;
    

        }
        /* vaciar el contenido */
        div.append(div_hijo);
    }


    // Crear botón para envio:

    if (opts.type == "btn") {
    
        var div_btn = $("<div>", {
        class: 'mt-3 col-12 d-flex justify-content-center',
        });

        var btn_submit = $("<button>", {
        class: "btn btn-"+opts.color+" bt-sm col-12 col-lg-4",
        text : "Aceptar",
        id   : "btnAceptar",
        type : "submit",
        });

        div_btn.append(btn_submit);
        div.append(div_btn);
    
    }


    

    $(this).append(div);

};


/*  -------------------------------------------   
 > Modulo 1 : Estructura que permite crear un formulario
  y una tabla con sus respectivas funciones 
----------------------------------------------- */
$.fn.modulo_1 = function (options) {
  txt = "";

  var defaults = {
    frm: "content-form",
    class_frm: "col-12 col-lg-4 ",
    class_formulario: "col-12",

    class_table: "col-12 col-lg-8 ",
    content_table: "content-table",
    table: "rpt-table",

    atributos_table: {},
    atributos_frm: {},
    atributos_event: {},
    attr_json_frm: {},

    color: "success",
    size: "lg",
    json_frm: [],
    datos: { opc: "ls" },
    enlace: "",
    datatable: false,
    evento_ipt: true,

    atributos_alert: { icon: "success", title: "ok", timer: 1000 },
    alert: true,
    fn: '',
  };

  // Carga opciones por defecto
  var opts = $.fn.extend(defaults, options);

  div = $("<div>", {
    class: "row p-2",
  });

  div_form = $("<div>", {
    class: opts.class_frm,
  });

  /* Crear contenedor del formulario */

  div_formulario = $("<form>", {
    class: opts.class_formulario,
    id: opts.frm,
    novalidate: true,
  });

  div_form.append(div_formulario);
  div.append(div_form);

  /* -- Vaciar ambos contenedores en el modulo-- */
  $(this).html(div);

  /* Crear contendor de tablas */

  div_table = $("<div>", {
    class: opts.class_table,
    id: opts.content_table,
  });

  div.append(div_table);

  /* Asignar los respectivos plugins a la tabla*/
//   crear_tabla();

  function crear_tabla() {
    fn_ajax(opts.datos, opts.enlace, "#" + opts.content_table).then((data) => {
    //   var opts_table = {
    //     data: data,
    //     id: opts.table,
    //     f_size: "12",
    //   };

    //   if (opts.atributos_table)
    //     opts_table = Object.assign(opts_table, opts.atributos_table);

    //   $("#" + opts.content_table).rpt_json_table2(opts_table);
      
      
    //   if(opts.fn)
    //   ejecutarFuncion(opts.fn);

    //   eventoTabla("#" + opts.table, opts.enlace, opts.atributos_event);

    //   if (opts.datatable) simple_data_table_no("#" + opts.table, 10);
    });
  }



  


  /* --  ejecutar funcion  -- */

  function ejecutarFuncion(fn){
     fn();
  }


  /* Asignar los respectivos plugins del formulario*/

  opts_attr_frm = {
    data: opts.json_frm,
  };

  if (opts.attr_json_frm)
    opts_attr_frm = Object.assign(opts_attr_frm, opts.attr_json_frm);

  $("#" + opts.frm).simple_json_form(opts_attr_frm);

  let opts_frm = {
    tipo: "text",
    opc: "add-frm-data",
  };

  if (opts.atributos_frm)
    opts_frm = Object.assign(opts_frm, opts.atributos_frm);

  $("#" + opts.frm).validation_form(opts_frm, (data) => {
    let data_json_table = getter_json_table("#" + opts.table);

    console.table(data_json_table);

    fn_ajax(data, opts.enlace, "").then((rtx) => {
      $("#" + opts.frm)
        .find("select")
        .each(function () {
          $(this).val("").trigger("change");
        });

      $("#" + opts.frm)[0].reset();

      if (opts.alert) {
        if (rtx.ok === false) {
          alert({ icon: "error", text: rtx.msg, timer: 1500 });
        } else {
          crear_tabla();
          alert(opts.atributos_alert);
        }
      } else {
        crear_tabla();
      }
    });
  });
};




// $.fn.modulo_1 = function (options) {
//   txt = "";

//   var defaults = {
//     frm: "content-form",
//     class_frm: "col-12 col-lg-4 ",
//     class_formulario: "col-12",

//     class_table: "col-12 col-lg-8 ",
//     content_table: "content-table",
//     table: "rpt-table",

//     atributo_tabla: {},
//     atributo_frm: {},
    
//     color: "success",
//     size: "lg",
//     json_frm: [],
//     datos: {opc: "ls"},
//     enlace: link,
//     datatable: false,
//   };

//   // Carga opciones por defecto
//   var opts = $.fn.extend(defaults, options);

//   div = $("<div>", {
//     class: "row p-2",
//   });

//   div_form = $("<div>", {
//     class: opts.class_frm,
//   });

//   /* Crear contenedor del formulario */

//   div_formulario = $("<form>", {
//     class: opts.class_formulario,
//     id: opts.frm,
//     novalidate: true,
//   });

//   div_form.append(div_formulario);
//   div.append(div_form);

//   /* -- Vaciar ambos contenedores en el modulo-- */
//   $(this).html(div);

//   /* Crear contendor de tablas */

//   div_table = $("<div>", {
//     class: opts.class_table,
//     id: opts.content_table,
//   });

//   div.append(div_table);

//   /* Asignar los respectivos plugins a la tabla*/
//   crear_tabla(); 


//   function crear_tabla(){

//     fn_ajax(opts.datos, opts.enlace, "#" + opts.content_table).then((data) => {
   
//     var opts_table = {
//       data  : data,
//       id    : opts.table,
//       f_size: "12",
     
//     };

//     if (opts.atributo_tabla)
//         opts_table = Object.assign(opts_table, opts.atributo_tabla);

//         $("#" + opts.content_table).rpt_json_table2(opts_table);

//         if (opts.datatable) 
//         simple_data_table_no("#" + opts.table, 15);
//     });
  
//   }

  

//   /* Asignar los respectivos plugins del formulario*/

//   $("#" + opts.frm).simple_json_form({
//     data: opts.json_frm,
//   });

//   let opts_frm = {
//     tipo: "text",
//     opc: "add-frm-data",
//   };

//   if (opts.atributos_frm)
//    opts_frm = Object.assign(opts_frm, opts.atributos_frm);

   

//     $("#" + opts.frm).validation_form(opts_frm, (data) => {
//       fn_ajax(data, opts.enlace, "").then((data) => {
//          $("#" + opts.frm)[0].reset();
//         crear_tabla();
//       });
//     });
// };




function modulo1(id_contenedor, json_form) {
  div = $("<div>", {
    class: "row p-2",
  });

  div_formulario = $("<div>", {
      class: "col-12 col-lg-4 line",
    id: "archivos-form",
    novalidate: true,
  });

  div.append(div_formulario);

  div_table = $("<div>", {
    class: "col-12 col-lg-8 ",
    id: "tb-archivos",
  });

  div.append(div_table);

  $(id_contenedor).append(div);

  $("#archivos-form").simple_json_content({
    data: json_form,
    type: "",
  });





  // // div_formulario.validation_form({}, (data) => {
  // //   for (const x of data) console.log(x);
  // // });

  //  div_formulario.validar_contenedor(
  //    {
  //      opc: "frm-data",
  //    },
  //    (datos) => {
  //       console.log(datos);

  //       form_data_ajax(datos, link).then((data) => {

  //       });
  //     }

  //  );
}
