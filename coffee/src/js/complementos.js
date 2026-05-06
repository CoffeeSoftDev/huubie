let LOAD = `<div class="d-flex align-items-center justify-content-center" style="min-height:300px;">
                    <h3 class="text-primary">
                        <i class="icon-spin4 animate-spin"></i>
                        ANALIZANDO
                    </h3>
                </div>`;
                
function create_dropdown(options) {
        let defaults = [
            { icon: "icon-pencil", text: "Editar", fn: "alert('Editar')" },
            { icon: "icon-trash", text: "Eliminar", fn: "alert('Eliminar')" },
        ];

        let opts = options != undefined ? options : defaults;

        const $container = $("<div>", { class: "dropdown" });

        const $button = $("<button>", {
            class: "btn btn-aliceblue btn-sm",
            id: "dropdownMenu",
            type: "button",
            "data-bs-toggle": "dropdown",
            "aria-expanded": "false",
            html: '<i class="icon-dot-3 text-info"></i>',
        });
        const $ul = $("<ul>", { class: "dropdown-menu", "aria-labelledby": "dropdownMenu" });

        opts.forEach((m) => {
            let html = m.icon != "" ? `<i class="text-info ${m.icon}"></i> ` : "<i class='icon-minus'></i>";
            html += m.text != "" ? m.text : "";

            const $a = $("<a>", { ...m, class: "pt-1 pb-1 pointer dropdown-item", onclick: m.fn, html });
            const $li = $("<li>").append($a);
            $ul.append($li);
        });

        $container.append($button, $ul);
        return $container.prop("outerHTML");
}
function closedModal(){
    $('.bootbox-close-button').click();
}
function format_date(fecha){
    const mes = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const date = fecha.split('-');
    return date[2]+'-'+mes[parseInt(date[1])]+'-'+date[0];
}
function format_phone(numero) {
    // Verificar que numero no sea null ni undefined
    if (numero && typeof numero === 'string' && numero.length === 10) {
        return '(' + numero.substr(0, 3) + ') ' + numero.substr(3, 3) + ' ' + numero.substr(6, 2) + ' ' + numero.substr(8, 2);
    } else {
        return numero;
    }
}

const hideData = (clase) => $("." + clase).addClass("hide");
const showData = (clase) => $("." + clase).toggleClass("hide");

$.fn.tb_fixed = function (fixed) {
    let col = [];
    for (let i = 0; i < fixed; i++) col.push(i);

    $(this).table_format({
        ordering: false,
        responsive: false,
        paging: false,
        searching: false,
        info: false,
        keys: true,
        autoWidth: false,
        columnDefs: [
            { targets: "_all", width: "100px" }, // Ancho mínimo para todas las columnas
            { targets: col, width: "150px", className: "bg-aliceblue" }, // Ancho fijo para las dos primeras columnas px
        ],
        fixedColumns: {
            left: fixed,
        },
        scrollY: "500px",
        scrollX: true,
        scrollCollapse: true,
    });
};

function log() {
    console.clear();
    console.log.apply(console, arguments);
}

function allSelectGroupMultiple(id) {
    const select = $("#" + id);

    let icon = "off";
    let allValues = null;

    if (select.val().length <= 1) {
        icon = "on";

        allValues = $("#" + id + " option")
            .map(function () {
                if ($(this).val() != 0) return $(this).val();
            })
            .get();
    }

    select.siblings("span.input-group-text").html('<i class="icon-toggle-' + icon + '"></i>');
    select.val(allValues).trigger("change");
}

function initComponents(url) {
  return new Promise(function (resolve, reject) {
     dtx = { opc: "initComponents" };

    $.ajax({
      type: "POST",
      url: url,
      data: dtx,
      dataType: "json",

      success: (data) => {
        resolve(data);
      },
      error: function (xhr, status, error) {
        swal_error(xhr, status, error);
      },
    });
  });
}

function simple_send_ajax(datos, url) {
  return new Promise(function (resolve, reject) {
    $.ajax({
      type: "POST",
      url: url,
      data: datos,
      dataType: "json",

      success: (data) => {
        resolve(data);
      },
      error: function (xhr, status, error) {
        swal_error(xhr, status, error);
      },
    });
  });
}

function form_data_ajax(datos, url) {
  return new Promise(function (resolve, reject) {
    $.ajax({
      type: "POST",
      url: url,
      contentType: false,
      data: datos,
      processData: false,
      cache: false,
      dataType: "json",
      
      success: (data) => {
        resolve(data);
      },
      error: function (xhr, status, error) {
        swal_error(xhr, status, error);
      },
    });
  });
}


function _get_simple_datax(multiple, name_opc) {
  url = "";

  if (multiple != null) {
    for (var i = 0; i < multiple.length; i++) {
      url = url + multiple[i] + "=" + $("#txt" + multiple[i]).val() + "&";
    }
  }

  url = url + "opc=" + name_opc;
  return url;
}

function _get_data_opc(multiple, name_opc) {
  url = "";

  if (multiple != null) {
    for (var i = 0; i < multiple.length; i++) {
      url = url + multiple[i] + "=" + $("#txt" + multiple[i]).val() + "&";
    }
  }

  url = url + "opc=" + name_opc;
  return url;
}

function _get_data(multiple, name_opc) {
  url = "";

  if (multiple != null) {
    for (var i = 0; i < multiple.length; i++) {
      url = url + multiple[i] + "=" + $("#txt" + multiple[i]).val() + "&";
    }
  }

  url = url + "opc=" + name_opc;
  return url;
}

$.fn.Loading = function (options) {
  var defaults = {
    tipo: "simple",
    texto: "Cargando datos ...",
  };

  var opts = $.fn.extend(defaults, options);

  var load = "";
  var opc = opts.tipo;

  switch (opc) {
    case "simple":
      load = `<div class="d-flex align-items-center justify-content-center" style="min-height:300px;">
                    <h3 class="text-success">
                        <i class="icon-spin5 animate-spin"></i>
                      
                       CARGANDO...
                    </h3>
                </div>`;
      break;

    case "edit":
      load = `<div class="d-flex align-items-center justify-content-center" style="min-height:300px;">
                    <h3 class="text-success">
                        <i class="icon-spin3 animate-spin"></i>
                        ${opts.texto}
                    </h3>
                </div>`;
      break;
  }

  $(this).html("" + load);
};

$.fn.simple_json_table = function (options) {
  //Variables para la creacion de una tabla
  thead = "";
  tbody = "";
  table = "";

  var defaults = {
    tipo   : "simple",
    data   : [],
    name   : "simple-table",
    right  : [4],
    center : [0],
    color  : null,
    grupo  : "bg-default",
    th     : "bg-default",
    mod    : "normal",
    folding: false,
  };

  var opts = $.fn.extend(defaults, options);
  th = opts.th;
  // Imprime las columnas de la tabla
  for (const k of opts.data.thead) {
    thead += `<th class="text-center ${th}">${k}</th>`;
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
      ico_group = `<i  class="ico${idRow} "></i>`;
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

  modo = opts.mod;

  switch (modo) {
    case "normal":
      class_table = "table table-bordered table-condensed table-sm";
      break;

    case "mod":
      class_table = "table table-sm";
      break;
  }

  // Imprime los resultados en una tabla
  table = `
      <table style="margin-top:15px; font-size:14px;"
      class="${class_table}" width="100%" id="${opts.name}">

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

  $(this).html(table);
};

$.fn.report_json_table = function (options) {
  //Variables para la creacion de una tabla
  thead = "";
  tbody = "";
  table = "";

  var defaults = {
    tipo: "simple",
    data: [],
    name: "simple-table",
    right: [4],
    color: null,
    head: "",
    grupo: "bg-default",
    id: ""
  };

  var opts = $.fn.extend(defaults, options);

  // Imprime las columnas de la tabla
  for (const k of opts.data.thead) {
    thead += `<th class="text-center">${k}</th>`;
  }

  var r = opts.right;
  var c = opts.color;
  var head = opts.head;

  // Imprime la informacion contenida en rows

  for (const x of opts.data.row) {
    const v = Object.values(x);
    let dimension = v.length;
    let last = dimension - 1;
    clase = "";

    if (v[last] == 1) {
      clase = opts.grupo;
    }

    tbody += `<tr class="${clase}">`;
    for (let col = 0; col < dimension - 1; col++) {
      right = "";
      color = "";

      for (let $i = 0; $i < r.length; $i++) {
        if (r[$i] == col) {
          right = "text-right ";
        }
      }

      if (c != null) {
        for (let $x = 0; $x < c.length; $x++) {
          if (c[$x] == col) {
            color = "bg-default-gv";
          }
        }
      }

      tbody += `<td class="${right} ${color}">  ${v[col]}  </td>`;
    }

    tbody += `</tr>`;
  } // end row

  // Imprime los resultados en una tabla
  table = ` ${opts.head} `;

  table += `
      <table style="margin-top:15px; "
      class="table table-bordered table-condensed" width="100%" id="${opts.name}">

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

  $(this).html(table);
};


$.fn.btn_json_table = function (options) {
// return new Promise((resolve, reject) => {
  thead = "";
  tbody = "";
  table = "";

  var defaults = {
    tipo: "simple",
    data: [],

    right: [3],
    center: [0],
    color: null,
    id: "simple-table",
    th: "bg-default",
    grupo: "bg-default",
  };

  // Carga opciones por defecto
  var opts = $.fn.extend(defaults, options);

  var r = opts.right;
  var ct = opts.center;
  var th = opts.th;

  // Imprime las columnas de la tabla
  for (const k of opts.data.thead) {
    thead += `<th class="text-center  ${th}">${k}</th>`;
  }

  for (const x of opts.data.row) {
    const columnas = Object.values(x);
    let dimension = columnas.length;
    let ultima_col = dimension - 1;

    btn = "";

    clase = "";
    if (columnas[ultima_col] == 1) {
      clase = opts.grupo;
    }

    tbody += `<tr class="${clase}">`;

    for (let col = 1; col < dimension - 1; col++) {
      color = "";
      right = "";
      center = "";

      for (let $i = 0; $i < r.length; $i++) {
        if (r[$i] == col) {
          right = "text-right text-end";
        }
      }

      for (let $c = 0; $c < ct.length; $c++) {
        if (ct[$c] == col) {
          center = "text-center ";
        }
      }

      tbody += `<td style="font-size:14px; " class="${right} ${center} " >  ${columnas[col]} </td>`;
    }

    if (x.btn != null) {
      for (const y of x.btn) {
        btn += `<a class="btn btn-outline-${y.color} btn-sm" onclick="${y.fn}(${x.id})"> <i class="${y.icon}"></i>  </a> `;
      }
    }

    if (x.btn_personalizado != null) {
      for (const p of x.btn_personalizado) {
        btn += `<a class="btn btn-outline-${p.color} btn-sm" onclick="${p.fn}" id="${p.id_btn}" estado="${p.estado}"> <i class="${p.icon}"></i>  </a> `;
      }
    }

    tbody += `<td class="text-center col-sm-2"> ${btn}  </td>`;
    tbody += `</tr>`;
  } // end row

  // Imprime los resultados en una tabla
  table = `
      <table style="margin-top:15px; "
      class="table table-bordered table-condensed table-sm" width="100%" id="${opts.id}">

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

  foot = "";

  data_foot = opts.data.foot;

  if (data_foot) foot = data_foot;

  table += ` ${foot} `;

  $(this).html(table);
//   resolve();
// });
};

$.fn.form_json_table = function (options) {
  //Variables para la creacion de una tabla

  thead = "";
  tbody = "";
  table = "";

  var defaults = {
    tipo: "simple",
    data: [],
    name: "simple-table",
    right: [4],
    color: null,
    grupo: "bg-default",
    select: [1],
    th: "bg-primaryzx",
  };

  // Carga opciones por defecto
  var opts = $.fn.extend(defaults, options);
  var th = opts.th;
  // Imprime las columnas de la tabla
  for (const k of opts.data.thead) {
    thead += `<th class="text-center ${th}">${k}</th>`;
  }

  // Imprime las filas
  var s = opts.select;

  for (const x of opts.data.row) {
    const columnas = Object.values(x);
    let dimension = columnas.length;
    let ultima_col = dimension - 1;

    btn = "";

    clase = "";
    if (columnas[ultima_col] == 1) {
      clase = `bg-default`;
    }

    tbody += `<tr class="${clase}">`;

    // Imprimir data
    for (let col = 0; col < dimension - 1; col++) {
      select = `${columnas[col]}`;

      if (s != null) {
        for (let z = 0; z < s.length; z++) {
          if (s[z] == col) {
            arreglito = columnas[col];

            for (const z of arreglito) {
              disabled = "";
              if (!z.valor) {
                disabled = "disabled";
              }

              select = `<input 
                      id     = "txt${z.name}${x.id}"
                      value  = "${z.valor}"  
                      onblur = "${z.fn}(${x.id})"
                      ${z.atrr}
                      ${disabled}
                      class=" form-control ui-autocomplete-input" />`;
            }
          }
        }
      }

      tbody += `<td >${select}   </td>`;
    }

    // Agregar botones
    for (const y of x.btn) {
      btn += `
      <a class="btn btn-outline-${y.color} btn-sm" onclick="${y.fn}(${x.id} )">
        <i class="${y.icon}"></i>
      </a> `;
    }

    tbody += `<td style="width:20%;" class="text-center"> ${btn}  </td>`;
    tbody += `</tr>`;
  } // end row

  // Imprime los resultados en una tabla
  table = ` ${opts.data.head} `;

  table += `
      <table style="margin-top:15px; "
      class="table table-bordered table-sm" width="100%" id="${opts.name}">

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

  table += ` ${opts.data.foot} `;
  $(this).html(table);
};

$.fn.item_json = function (options) {
  item = "";

  var defaults = {
    data: 0,
  };

  var opts = $.fn.extend(defaults, options);

  for (const x of opts.data.row) {
    funcion = "";
    color = "";
    disabled = "";
    img = "https://15-92.com/ERP3/src/img/default_flower.png";

    for (const y of x.atrr) {
      funcion = y.fn;
      color = y.color;
      disabled = y.disabled;
      if (y.url_image == null) {
        img = "https://15-92.com/ERP3/src/img/default_flower.png";
        //   img =
        //     "https://static.vecteezy.com/system/resources/thumbnails/000/350/131/small/4__2832_29.jpg";
      } else {
        img = y.url_image;
      }
      
    }
 
    item += `
    <div class="grid-item pointer ${disabled}" onclick="${funcion}(${x.id},${x.costo})" >
        <div class="col-12 d-flex div1">
            <img class="col-12"
            src="${img}"
            alt="">
        </div>
            <div class="col-12 ${color} d-flex flex-column pt-1 div2">
            <h6>${x.nombre}</h6>
            <sub class="fw-bold">${x.costo}</sub>
        </div>
        <div class="d-flex ${color} ms-auto justify-content-center align-items-center div3 pointer"
            title="cantidad items">
            <label class="fs-6 fw-bold pointer">${x.id}</label>
        </div>
    </div>
    `;
  }

  contedor = `
  <div class="grid-container">
  ${item}
  </div>
  `;

  $(this).html(contedor);
};

/* -------------------------------
        Complementos para tablas
----------------------------------*/
function datable_export_excel(table, size) {
  $(table).DataTable({
    destroy: true,
    dom: "Bfrtip",
    order: [],

    pageLength: size,

    buttons: ["copy","excel"],
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

function simple_data_table_no(table, no) {
  $(table).DataTable({
    pageLength: no,
    destroy: true,
    searching: true,
    bLengthChange: false,
    bFilter: false,
    order: [],
    bInfo: true,
    language: {
      url: "../../src/plugin/datatables/spanish.json",
    },
  });
}

function dataTable_responsive(id, prioridad) {
  $(id).DataTable({
    language: {
      url: "../src/plugin/datatables/spanish.json",
    },

    // info: false,
    // searching: false,
    // paging: false,
    ordering: false,
    responsive: true,
    columnDefs: prioridad,
  });
}

function fn_ajax(datos, url, div = '') {
  return new Promise(function (resolve, reject) {
    $.ajax({
      type: "POST",
      url: url,
      data: datos,
      dataType: "json",
      beforeSend: () => {
        $(div).Loading();
      },

      success: (data) => {
        resolve(data);
      },
      error: function (xhr, status, error) {
        // swal_error(xhr, status, error);
        console.error("url: ", url);
        console.error("status: ", status);
        console.error("error: ", error);

        if (xhr.responseText === "") console.error("No se obtuvo respuesta del servidor.");
        else console.error(xhr);
        // Comentado temporalmente...
        
        // alert({
        //     icon: "error",
        //     title: "Error en el sistema",
        //     text: "Llamar a soporte.",
        //     html: error,
        //     btn1: true,
        // });
      },
    });
  });
}






function _get_data_opc(multiple, name_opc) {
  url = "";

  if (multiple != null) {
    for (var i = 0; i < multiple.length; i++) {
      url = url + multiple[i] + "=" + $("#txt" + multiple[i]).val() + "&";
    }
  }

  url = url + "opc=" + name_opc;
  return url;
}

function _get_data(multiple, name_opc) {
  url = "";

  if (multiple != null) {
    for (var i = 0; i < multiple.length; i++) {
      url = url + multiple[i] + "=" + $("#txt" + multiple[i]).val() + "&";
    }
  }

  url = url + "opc=" + name_opc;
  return url;
}

function wsp(phone, body) {
    // let to = telefono.length === 10 ? "+52" + telefono : telefono;
    let to = '';
    
    if (typeof phone === 'string') {
        phone = phone.split(',');
    }
    
    phone = phone.flatMap(p => (typeof p === 'string') ? p.split(',') : p);
    
    if(Array.isArray(phone)){
        phone.forEach((p)=>{
            to += p.includes('+52') ? p+',' : '+52'+p+',';
        });
    }
    to = to.slice(0,-1);
    
    // console.log(to.slice(0,-1));
    var settings = {
        async: true,
        crossDomain: true,
        url: "https://api.ultramsg.com/instance50238/messages/chat",
        method: "POST",
        headers: {},
        data: {
            token: "pjsvyuxnqx2rj4ed",
            to,
            body,
        },
    };

    return new Promise((resolve) => {
        $.ajax(settings).done((response)=> {
            // if(Array.isArray(response))
                // console.log(response.some(item => item.sent === "true"));
            // else 
                console.error(response.sent);
            // if (response.sent == "true") resolve();
            // else console.error(response);
        });
    });
}


function clave_aleatoria() {
    const caracteres = "0123456789abcdefghijklmnñopqrstuvwxyzABCDEFGHIJKLMNÑOPQRSTUVWXYZ(-_+)/";
    const cadenaAleatoria = Array.from({ length: 6 }, () => caracteres.charAt(Math.floor(Math.random() * caracteres.length))).join("");
    return cadenaAleatoria;
}
function pop() {
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"], [data-bs-trigger="hover focus"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
}
function getCookies() {
    const cookies = document.cookie.split(";");
    let jsonObject = {};
    cookies.forEach(function (item) {
        const parts = item.split("=");
        const key = parts[0].trim();
        const value = parts[1].trim();
        jsonObject[key] = value;
    });
    return jsonObject;
}
function alert(options) {
    let defaults = {
        icon: "success",
        title: "",
        text: "",
        html: "",
        width: "",
        img: "",
        imgw: "",
        imgh: "",
        btn1: false,
        btn1Text: "Continuar",
        btn1Class: "btn btn-primary",
        btn2: false,
        btn2Text: "Cancelar",
        btn2Class: "btn btn-outline-danger",
        btn3: false,
        btn3Text: "Default",
        btn3Class: "",
        timer: 1000,
        question: false,
    };

    let opts = {};

    if (typeof options === "object" && options !== null) opts = $.extend(defaults, options);

    if (typeof options !== "object" || options === undefined || options === null) opts = defaults;

    if ((typeof options === "string" || typeof options === "number") && options !== "") {
        opts.title = options;
        opts.timer = 0;
        opts.btn1 = true;
        opts.icon = "info";
    }

    if (opts.title === "" && opts.text === "") opts.width = 200;

    if (opts.icon == "question") {
        opts.btn2 = true;
        opts.btn1 = true;
    }

    if (opts.btn1 || opts.btn2 || opts.btn3) opts.timer = false;

    let question = Swal.fire({
        icon: opts.icon,
        title: opts.title,
        imageUrl: opts.img,
        text: opts.text,
        html: opts.html,
        width: opts.width,
        imageWidth: opts.imgw,
        imageHeight: opts.imgh,
        timer: opts.timer,
        allowOutsideClick: false,
        showConfirmButton: opts.btn1,
        confirmButtonText: opts.btn1Text,
        showCancelButton: opts.btn2,
        cancelButtonText: opts.btn2Text,
        showDenyButton: opts.btn3,
        denyButtonText: opts.btn3Text,
        customClass: {
                popup: "bg-[#1F2A37] text-white rounded-lg shadow-lg",
                title: "text-2xl font-semibold",
                content: "text-gray-300",
                confirmButton:
                    "bg-[#1C64F2] hover:bg-[#0E9E6E] text-white py-2 px-4 rounded",
                cancelButton:
                    "bg-transparent text-white border border-gray-500 py-2 px-4 rounded hover:bg-[#111928]",
        },
    });

    if (opts.icon == "question" || opts.btn1 || opts.btn2 || opts.btn3) return question;
}
function swal_error(xhr, status, error) {
    let response = xhr.responseText;
    if (response === "") response = "Error de sistema: No se obtuvo una respuesta.";

    Swal.fire({
        icon: "error",
        title: "LLAMAR A SORPORTE TÉCNICO",
        html: status + " " + error + "<br>" + response,
        showConfirmButton: true,
        allowOutsideClick: false,
    });
}
function swal_success() {
    Swal.fire({
        width: 200,
        icon: "success",
        showConfirmButton: false,
        timer: 2000,
    });
}
function swal_warning(title) {
    Swal.fire({
        icon: "warning",
        title: title,
        showConfirmButton: false,
        timer: 2000,
    });
}
function swal_question(title, text) {
    return Swal.fire({
        icon: "question",
        title: title,
        text: text,
        allowOutsideClick: false,
        showCancelButton: true,
        confirmButtonText: "Continuar",
        cancelButtonText: "Cancelar",
        customClass: {
            confirmButton: "btn btn-primary",
            cancelButton: "btn btn-outline-danger",
        },
    });
}
function html_ajax(url) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "POST",
            url: url,
            success: function (data) {
                resolve(data);
            },
            error: function (xhr, status, error) {
                console.error("url: ", url);
                console.error("status: ", status);
                console.error("error: ", error);

                if (xhr.responseText === "") console.error("No se obtuvo respuesta del servidor.");
                else console.error(xhr);

                alert({
                    icon: "error",
                    title: "Error en el sistema",
                    text: "Llamar a soporte.",
                    html: error,
                    btn1: true,
                });
                reject();
            },
        });
    });
}
function simple_ajax(url) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "POST",
            url: url,
            dataType: "json",
            success: function (data) {
                resolve(data);
            },
            error: function (xhr, status, error) {
                console.error("url: ", url);
                console.error("status: ", status);
                console.error("error: ", error);

                if (xhr.responseText === "") console.error("No se obtuvo respuesta del servidor.");
                else console.error(xhr);

                alert({
                    icon: "error",
                    title: "Error en el sistema",
                    text: "Llamar a soporte.",
                    html: error,
                    btn1: true,
                });
            },
        });
    });
}
function text_ajax(datos, url) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "POST",
            url: url,
            data: datos,
            dataType: "json",
            success: function (data) {
                resolve(data);
            },
            error: function (xhr, status, error) {
                console.error("url: ", url);
                console.error("status: ", status);
                console.error("error: ", error);

                if (xhr.responseText === "") console.error("No se obtuvo respuesta del servidor.");
                else console.error(xhr);

                alert({
                    icon: "error",
                    title: "Error en el sistema",
                    text: "Llamar a soporte.",
                    html: error,
                    btn1: true,
                });
            },
        });
    });
}
function send_ajax(datos, url, before) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "POST",
            url: url,
            contentType: false,
            data: datos,
            processData: false,
            cache: false,
            dataType: "json",
            beforeSend: function () {
                if (before !== undefined) {
                    // Objeto para uso por defecto
                    defaults = {
                        elemento: null,
                        html: "<h3 class='text-primary'><i class='icon-spin6 animate-spin'></i> Espere un momento.</h3>",
                        class: "col-12 mb-5 mt-5 p-5 text-center",
                        icon: "info",
                        title: '<i class="icon-spin6 animate-spin"></i> Espere un momento...',
                        timer: 0,
                        btn1: false,
                    };

                    // Declaro variable options para despues mezclar 2 objetos de ser necesario.
                    let opts = defaults;

                    // Creo un elemento para mostrar.
                    let elemento2 = $("<div>", {
                        class: opts.class,
                        html: opts.html,
                    });
                    // Se comprueba si before es un elemento del DOM usando jquery
                    if (before instanceof jQuery) {
                        before.html(elemento2); //Se muestra elemento2 dentro del elemento del DOM
                    } else if (typeof before === "string") {
                        //Se comprueba si before es un string
                        if (/^[#\.]/.test(before)) {
                            //Si el string comienza con [".","#"] es un elemento del DOM
                            $(before).html(elemento2); //Se muestra elemento2 dentro del elemento del DOM
                        } else {
                            //Caso contrario, si no empieza con [".","#"] lo clasificamos como mensaje
                            //Hacemos un reset al atributo html y class
                            opts.html = null;
                            opts.class = null;
                            if (before != "") opts.title = before; // Modificamos el titulo con el mensaje "before"
                            alert(opts); //Mostramos el alert
                        }
                    } else if (typeof before === "object") {
                        //Si before es un objeto
                        opts = $.extend(defaults, before); //Mezclamos defaults y before
                        //Se comprueba si opts.elemento fue declarado o tiene información.
                        if (opts.elemento === null) {
                            alert(opts); //Muestra el alert
                        } else {
                            elemento2.html(opts.html); //Modificamos el valor del mensaje
                            //Determinamos la forma de imprimir comprobando si es un string ''#div'
                            // o un elemento del DOM $('#div')
                            if (typeof opts.elemento === "string") {
                                $(opts.elemento).html(elemento2);
                            } else if (opts.elemento instanceof jQuery) {
                                opts.elemento.html(elemento2);
                            }
                        }
                    } else {
                        //Caso contrario si no es nada de lo anterior mostrarmos el alert por defecto
                        alert(opts);
                    }
                }
            },
            success: function (data) {
                let delay = 0;
                if (before !== undefined) delay = 0;

                setTimeout(() => {
                    if (before !== undefined && ((typeof before !== "object" && typeof before !== "string") || (typeof before === "string" && !/^[#\.]/.test(before)) || (typeof before === "object" && before.elemento === undefined))) {
                        Swal.close();
                    }
                    resolve(data);
                }, delay);
            },
            error: function (xhr, status, error) {
                console.error("url: ", url);
                console.error("status: ", status);
                console.error("error: ", error);

                if (xhr.responseText === "") console.error("No se obtuvo respuesta del servidor.");
                else console.error(xhr);

                alert({
                    icon: "error",
                    title: "Error en el sistema",
                    text: "Llamar a soporte.",
                    html: error,
                    btn1: true,
                });
            },
        });
    });
}
async function asyn_ajax(datos, url, before) {
    try {
        const data = await new Promise((resolve, reject) => {
            $.ajax({
                type: "POST",
                url: url,
                contentType: false,
                data: datos,
                processData: false,
                cache: false,
                dataType: "json",
                beforeSend: function () {
                    if (before !== undefined) {
                        // Objeto para uso por defecto
                        defaults = {
                            elemento: null,
                            html: "<h3 class='text-primary'><i class='icon-spin6 animate-spin'></i> Espere un momento.</h3>",
                            class: "col-12 mb-5 mt-5 p-5 text-center",
                            icon: "info",
                            title: '<i class="icon-spin6 animate-spin"></i> Espere un momento...',
                            timer: 0,
                            btn1: false,
                        };

                        // Declaro variable options para despues mezclar 2 objetos de ser necesario.
                        let opts = defaults;

                        // Creo un elemento para mostrar.
                        let elemento2 = $("<div>", {
                            class: opts.class,
                            html: opts.html,
                        });
                        // Se comprueba si before es un elemento del DOM usando jquery
                        if (before instanceof jQuery) {
                            before.html(elemento2); //Se muestra elemento2 dentro del elemento del DOM
                        } else if (typeof before === "string") {
                            //Se comprueba si before es un string
                            if (/^[#\.]/.test(before)) {
                                //Si el string comienza con [".","#"] es un elemento del DOM
                                $(before).html(elemento2); //Se muestra elemento2 dentro del elemento del DOM
                            } else {
                                //Caso contrario, si no empieza con [".","#"] lo clasificamos como mensaje
                                //Hacemos un reset al atributo html y class
                                opts.html = null;
                                opts.class = null;
                                if (before != "") opts.title = before; // Modificamos el titulo con el mensaje "before"
                                alert(opts); //Mostramos el alert
                            }
                        } else if (typeof before === "object") {
                            //Si before es un objeto
                            opts = $.extend(defaults, before); //Mezclamos defaults y before
                            //Se comprueba si opts.elemento fue declarado o tiene información.
                            if (opts.elemento === null) {
                                alert(opts); //Muestra el alert
                            } else {
                                elemento2.html(opts.html); //Modificamos el valor del mensaje
                                //Determinamos la forma de imprimir comprobando si es un string ''#div'
                                // o un elemento del DOM $('#div')
                                if (typeof opts.elemento === "string") {
                                    $(opts.elemento).html(elemento2);
                                } else if (opts.elemento instanceof jQuery) {
                                    opts.elemento.html(elemento2);
                                }
                            }
                        } else {
                            //Caso contrario si no es nada de lo anterior mostrarmos el alert por defecto
                            alert(opts);
                        }
                    }
                },
                success: function (data) {
                    let delay = 0;
                    if (before !== undefined) delay = 0;

                    setTimeout(() => {
                        if (before !== undefined && ((typeof before !== "object" && typeof before !== "string") || (typeof before === "string" && !/^[#\.]/.test(before)) || (typeof before === "object" && before.elemento === undefined))) {
                            Swal.close();
                        }
                        resolve(data);
                    }, delay);
                },
                error: function (xhr, status, error) {
                    console.error("url: ", url);
                    console.error("status: ", status);
                    console.error("error: ", error);

                    if (xhr.responseText === "") console.error("No se obtuvo respuesta del servidor.");
                    else console.error(xhr);

                    alert({
                        icon: "error",
                        title: "Error en el sistema",
                        text: "Llamar a soporte.",
                        html: error,
                        btn1: true,
                    });
                },
            });
        });
    } catch (error) {
        // Manejo de errores generales aquí...
        console.error("Error en la función send_ajax:", error);
        throw error; // Lanza el error para que sea manejado externamente si es necesario
    }
}
function before_send_ajax(datos, url, id, before) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "POST",
            url: url,
            contentType: false,
            data: datos,
            processData: false,
            cache: false,
            dataType: "json",
            beforeSend: () => {
                $(id).html(before);
            },
            success: function (data) {
                resolve(data);
            },
            error: function (xhr, status, error) {
                console.error("url: ", url);
                console.error("status: ", status);
                console.error("error: ", error);

                if (xhr.responseText === "") console.error("No se obtuvo respuesta del servidor.");
                else console.error(xhr);

                alert({
                    icon: "error",
                    title: "Error en el sistema",
                    text: "Llamar a soporte.",
                    html: error,
                    btn1: true,
                });
            },
        });
    });
}
function tb_ajax(datos, url, div) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: "POST",
            url: url,
            contentType: false,
            data: datos,
            processData: false,
            cache: false,
            dataType: "json",
            beforeSend: () => {
                $(div).html(LOAD);
            },
            success: (data) => {
                resolve(data);
            },
            error: function (xhr, status, error) {
                console.error("url: ", url);
                console.error("status: ", status);
                console.error("error: ", error);

                if (xhr.responseText === "") console.error("No se obtuvo respuesta del servidor.");
                else console.error(xhr);

                alert({
                    icon: "error",
                    title: "Error en el sistema",
                    text: "Llamar a soporte.",
                    html: error,
                    btn1: true,
                });
            },
        });
    });
}
function intervalDate(fechaInicio, fechaFinal) {
    const recorrido = [];
    const mes = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const dia = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

    fechaInicio = new Date(fechaInicio + " 00:00:00");
    fechaFinal = new Date(fechaFinal + " 00:00:00");

    while (fechaInicio <= fechaFinal) {
        let date = new Date(fechaInicio);
        let d = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
        let m = date.getMonth() + 1 < 10 ? "0" + (date.getMonth() + 1) : date.getMonth() + 1;
        let y = date.getFullYear();
        let w = date.getDay();

        json = {
            date: `${y}-${m}-${d}`,
            fecha: `${d}-${m}-${y}`,
            day: `${d}-${mes[parseInt(m)]}`,
            week: dia[parseInt(w)],
        };

        recorrido.push(json);
        fechaInicio.setDate(fechaInicio.getDate() + 1);
    }

    return recorrido;
}
function dataTable_responsive(id, prioridad) {
    $(id).DataTable({
        language: {
            url: "../src/plugin/datatables/spanish.json",
        },
        ordering: false,
        responsive: true,
        columnDefs: prioridad,
    });
}
function validarLetras(id) {
    const REGEX = /^[A-Za-z\u00C0-\u017F\s]+$/;
    if (!REGEX.test($(id).val())) {
        $(id).val("");
        $(id).addClass("is-invalid");
        $(id).next("span").removeClass("hide");
        $(id).next("span").html(`
            <i class="icon-warning-1"></i>
            Solo se aceptan letras mayúsculas o minúculas.
        `);
    } else {
        $(id).removeClass("is-invalid");
        $(id).next("span").addClass("hide");
        $(id).next("span").html(`
            <i class="icon-warning-1"></i>
        `);
    }
}
function rangepicker(id, single, start, end, range, custom, callback) {
    $(id).daterangepicker(
        {
            singleDatePicker: single,
            showDropdowns: true,
            minYear: 2016,
            maxYear: parseInt(moment().format("YYYY"), 10),
            cancelClass: "btn-outline-danger",
            applyClass: "btn-primary",
            startDate: start,
            endDate: end,
            ranges: range,
            locale: {
                //   format: "DD/MM/YYYY",
                format: "YYYY-MM-DD",
                applyLabel: "Aplicar",
                cancelLabel: "Cancelar",
                prevText: "< Ant.",
                nextText: "Sig. >",
                currentText: "Hoy",
                monthNames: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
                monthNamesShort: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
                daysOfWeek: ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"],
                customRangeLabel: "Personalizado",
            },
        },
        function (start, end, label) {
            callback(start, end);
        }
    );
    if (custom === false) {
        $(id).on("show.daterangepicker", function (ev, picker) {
            picker.container.find(".ranges li:last-child").css("display", "none");
        });
    }
}
function diferenciaFechas(fechaPropuesta) {
    var fechaActual = new Date();
    var fechaNac = new Date(fechaPropuesta + " 00:00:00");
    var años = fechaActual.getFullYear() - fechaNac.getFullYear();
    var meses = fechaActual.getMonth() - fechaNac.getMonth();
    var dias = fechaActual.getDate() - fechaNac.getDate();

    if (fechaActual.getFullYear() === fechaNac.getFullYear()) {
        if (fechaActual.getMonth() === fechaNac.getMonth()) {
            if (fechaActual.getDate() <= fechaNac.getDate()) {
                años = 0;
                meses = 0;
                dias = 0;
            }
        }
    }

    // if (fechaActual.getMonth() < fechaNac.getMonth()) {
    //     años = 0;
    //     meses = 0;
    //     dias = 0;
    // }

    if (meses < 0 || (meses === 0 && dias < 0)) {
        años--;
        meses += 12;
    }

    if (dias < 0) {
        var ultimoDiaMesAnterior = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 0).getDate();
        dias += ultimoDiaMesAnterior;
        meses--;
    }

    let datos = {
        y: años, //year
        m: meses, //month
        d: dias, //days
        s: "", //string
    };

    if (isNaN(datos.d)) {
        datos.s = "Inválido";
    } else {
        if (datos.y == 1) datos.s += datos.y + " año ";
        if (datos.y >= 2) datos.s += datos.y + " años ";

        if (datos.m == 1) datos.s += datos.m + " mes ";
        if (datos.m >= 2) datos.s += datos.m + " meses ";

        if (datos.d == 1) datos.s += datos.d + " día";
        if (datos.d >= 2) datos.s += datos.d + " días";
    }

    return datos;
}
// YA NO LO USO
// $.fn.option_list = function (datos) {
//     list = this;
//     list.html("");
//     $.each(datos, function (index, item) {
//         list.append(
//             $("<option>", {
//                 value: item.valor,
//             })
//         );
//     });
// };
$.fn.table_responsive_json = function (datos) {
    return this.each(function () {
        let defaultJSON = {};
        if (datos === null || datos === undefined || datos === "" || isJsonEmpty(datos)) {
            defaultJSON = {
                info: true,
                searching: true,
                paging: true,
                ordering: false,
                columnDefs: [
                    {
                        responsivePriority: 1,
                        targets: 0,
                    },
                ],
            };
        } else {
            defaultJSON = datos;
        }
        $(this).DataTable({
            language: {
                url: "../src/plugin/datatables/spanish.json",
            },
            responsive: true,
            info: defaultJSON.info,
            searching: defaultJSON.searching,
            paging: defaultJSON.paging,
            ordering: defaultJSON.ordering,
            columnDefs: defaultJSON.columnDefs,
        });
    });
};
// Llenar un select
$.fn.option_select = function (options) {
    const SELECT = this;

    if (SELECT.hasClass("select2-hidden-accessible")) SELECT.select2("destroy");

    let defaults = {
        data: null,
        list: null,
        placeholder: "",
        select2: false,
        group: false,
        father: false,
        tags: false
    };

    // Carga opciones por defecto
    let opts = $.extend(defaults, options);
    
    if(opts.data == null) {
        let optionsArray = [];
        SELECT.find("option").each(function () {
            if($(this).val() == 0)
                opts.placeholder = $(this).text(); 
            else 
                optionsArray.push({ id: $(this).val(), valor: $(this).text() });
        });
        opts.data = optionsArray;
    }
    
    
    SELECT.html("");
    
    if (opts.placeholder !== "") {
        if (opts.select2) SELECT.html("<option></option>");

        if (!opts.select2) SELECT.html(`<option value="0" hidden selected>${opts.placeholder}</option>`);
    }
    

    $.each(opts.data, function (index, item) {
        SELECT.append(
            $("<option>", {
                value: item.id,
                html: item.valor,
            })
        );
    });

    if (opts.list !== null) {
        $.each(opts.list, function (index, item) {
            SELECT.append(
                $("<option>", {
                    value: item.valor,
                })
            );
        });
    }

    if (opts.select2) {
        if (!opts.group) {
            SELECT.css("width", "100%");
            $(window).on("resize", () => {
                SELECT.next("span.select2").css("width", "100%");
            });
        }

        if (!opts.father) {
            SELECT.select2({
                theme: "bootstrap-5",
                placeholder: opts.placeholder,
                tags: opts.tags,
            });
        } else {
            let modalParent = $(".bootbox");
            if (typeof opts.father === "string") modalParent = $(opts.father);

            SELECT.select2({
                theme: "bootstrap-5",
                placeholder: opts.placeholder,
                tags: opts.tags,
                dropdownParent: modalParent,
            });
        }
    }
};


// Validar inputs
$.fn.validar_entrada = function () {
    const opc = {
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

    //Valida si elemento es un input
    if (elemento.is("input")) {
        //Se activa el evento input para obtener el valor e imprimirlo en consola
        elemento.on("input", function () {
            const IPT = elemento;
            let iptval = IPT.val().trim();
            const icon_warning = '<i class="icon-warning-1"></i>';

            if (IPT.is('[tipo="texto"]')) {
                if (!opc.texto.test(iptval)) {
                    IPT.val(iptval.replace(opc.texto_replace, ""));
                    IPT.addClass("is-invalid");
                } else IPT.removeClass("is-invalid");
            }

            if (IPT.is('[tipo="numero"]')) {
                if (!opc.numero.test(iptval)) {
                    IPT.val(iptval.replace(opc.numero_replace, ""));
                    IPT.addClass("is-invalid");
                    if (IPT.parent().hasClass("input-group")) {
                        if (IPT.parent().next("span.text-danger").length > 0) IPT.parent().next("span.text-danger").removeClass("hide").html(`${icon_warning} Solo acepta números"`);
                        else {
                            let span = $("<span>", {
                                class: "text-danger form-text",
                                html: `${icon_warning} Solo acepta números`,
                            });
                            IPT.parent().parent().append(span);
                        }
                    } else {
                        if (IPT.next("span.text-danger").length > 0) IPT.next("span.text-danger").removeClass("hide").html(`${icon_warning} Solo acepta números"`);
                        else {
                            let span = $("<span>", {
                                class: "text-danger form-text",
                                html: `${icon_warning} Solo acepta números`,
                            });
                            IPT.parent().append(span);
                        }
                    }
                } else {
                    IPT.removeClass("is-invalid");
                    if (IPT.parent().hasClass("input-group")) {
                        IPT.parent().next("span.text-danger").addClass("hide");
                    } else {
                        IPT.next("span.text-danger").addClass("hide");
                    }
                }
            }

            if (IPT.is('[tipo="textoNum"],[tipo="alfanumerico"]')) if (!opc.txtnum.test(iptval)) IPT.val(iptval.replace(opc.txtnum_replace, ""));

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
                        IPT.parent().after('<span class="text-danger form-text"><i class="icon-attention"></i> Ingrese un correo válido.</span>');
                    } else {
                        IPT.next("span.text-danger").remove();
                        IPT.after('<span class="text-danger form-text"><i class="icon-attention"></i> Ingrese un correo válido.</span>');
                    }
                } else {
                    IPT.removeClass("form-control is-invalid");
                    if (IPT.parent().hasClass("input-group")) IPT.parent().next("span").remove();
                    else IPT.next("span").remove();
                }
            }

            if (IPT.is("[maxlength]")) {
                let limit = parseInt(IPT.attr("maxlength"));
                IPT.val(IPT.val().slice(0, limit));
            }

            if (IPT.hasClass("text-uppercase")) IPT.val(IPT.val().toUpperCase());
            if (IPT.hasClass("text-lowercase")) IPT.val(IPT.val().toLowerCase());

            if (typeof callback === "function") {
                callback(IPT.val());
            }
        });
    }
    //Si es un textarea
    else if (elemento.is("textarea")) {
        //Se activa el evento input para obtener el valor e imprimirlo en consola
        elemento.on("input", function () {
            const IPT = elemento;
            let iptval = IPT.val().trim();

            if (IPT.is('[tipo="texto"]')) if (!opc.texto.test(iptval)) IPT.val(iptval.replace(opc.texto_replace, ""));

            if (IPT.is('[tipo="numero"]')) if (!opc.numero.test(iptval)) IPT.val(iptval.replace(opc.numero_replace, ""));

            if (IPT.is('[tipo="textoNum"],[tipo="alfanumerico"]')) if (!opc.txtnum.test(iptval)) IPT.val(iptval.replace(opc.txtnum_replace, ""));

            if (IPT.hasClass("text-uppercase")) IPT.val(IPT.val().toUpperCase());
            if (IPT.hasClass("text-lowercase")) IPT.val(IPT.val().toLowerCase());

            if (typeof callback === "function") callback(IPT.val());
        });
    }
    // Contenedor
    else {
        $(this)
            .find("input, textarea")
            .on("input", function () {
                const IPT = $(this);
                let iptval = IPT.val().trim();

                if (IPT.is('[tipo="texto"]')) if (!opc.texto.test(iptval)) IPT.val(iptval.replace(opc.texto_replace, ""));

                if (IPT.is('[tipo="numero"]')) if (!opc.numero.test(iptval)) IPT.val(iptval.replace(opc.numero_replace, ""));

                if (IPT.is('[tipo="textoNum"],[tipo="alfanumerico"]')) if (!opc.txtnum.test(iptval)) IPT.val(iptval.replace(opc.txtnum_replace, ""));

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
                            IPT.parent().after('<span class="text-danger form-text"><i class="icon-attention"></i> Ingrese un correo válido.</span>');
                        } else {
                            IPT.next("span.text-danger").remove();
                            IPT.after('<span class="text-danger form-text"><i class="icon-attention"></i> Ingrese un correo válido.</span>');
                        }
                    } else {
                        IPT.removeClass("form-control is-invalid");
                        if (IPT.parent().hasClass("input-group")) IPT.parent().next("span").remove();
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
                    if (IPT.parent().hasClass("input-group")) IPT.parent().next("span").addClass("hide");
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
                    if (SELECT.parent().hasClass("input-group")) SELECT.parent().next("span").addClass("hide");
                }
            });
    }
};

// Validar todos los elementos de un contenedor
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

            if (IPT.is('[tipo="texto"]')) if (!opc.texto.test(iptval)) IPT.val(iptval.replace(opc.texto_replace, ""));

            if (IPT.is('[tipo="numero"]')) if (!opc.numero.test(iptval)) IPT.val(iptval.replace(opc.numero_replace, ""));

            if (IPT.is('[tipo="textoNum"],[tipo="alfanumerico"]')) if (!opc.txtnum.test(iptval)) IPT.val(iptval.replace(opc.txtnum_replace, ""));

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
                        IPT.parent().after('<span class="text-danger form-text"><i class="icon-attention"></i> Ingrese un correo válido.</span>');
                    } else {
                        IPT.next("span.text-danger").remove();
                        IPT.after('<span class="text-danger form-text"><i class="icon-attention"></i> Ingrese un correo válido.</span>');
                    }
                } else {
                    IPT.removeClass("form-control is-invalid");
                    if (IPT.parent().hasClass("input-group")) IPT.parent().next("span").remove();
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
                if (IPT.parent().hasClass("input-group")) IPT.parent().next("span").addClass("hide");
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
                if (SELECT.parent().hasClass("input-group")) SELECT.parent().next("span").addClass("hide");
            }
        });

    $(this)
        .find("[required]")
        .each(function () {
            if ($(this).val() === "" || $(this).val() == "0" || $(this).val().length == 0 || $(this).val() == null) {
                isValid = false;
                $(this).focus();
                $(this).addClass("is-invalid");
                $(this).siblings("span.text-danger").removeClass("hide").html('<i class="icon-attention"></i> El campo es requerido');
                if ($(this).parent().hasClass("input-group")) $(this).parent().next("span").removeClass("hide").html('<i class="icon-attention"></i> El campo es requerido');
            } else {
                $(this).removeClass("is-invalid");
                $(this).siblings("span.text-danger").addClass("hide");
                if ($(this).parent().hasClass("input-group")) $(this).parent().next("span").addClass("hide");
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

// Crear una tabla usando jquery
$.fn.create_table = function (options) {
    // Estructura completa de JSON para creacion de una tabla.
    defaults = {
        table: { class: "table table-bordered table-sm" },
        thead: [{ html: "Head1", colspan: 2 }, { html: "Head2" }, { html: "Head3" }, { html: "Head4" }],
        tbody: [
            [{ html: "row1" }, { html: "row1" }, { html: "row1" }, { html: "row1", class: "text-end" }, { html: "row1", class: "text-center" }],
            [
                {
                    html: "Subtítulo (row 2)",
                    class: "text-center text-uppercase text-primary fw-bold",
                    colspan: 5,
                },
            ],
            [
                { html: "row 3 y 4", class: "text-center", rowspan: 2 },
                {
                    html: {
                        elemento: "select",
                        atributos: {
                            class: "form-select",
                            id: "nombre",
                            name: "nombre",
                        },
                        opciones: [
                            { value: 1, text: "uno" },
                            { value: 2, text: "dos" },
                            { value: 3, text: "tres" },
                        ],
                    },
                    class: "text-center",
                },
                {
                    html: {
                        elemento: "input",
                        atributos: {
                            type: "text",
                            class: "form-control input-sm",
                            id: "nombre",
                            name: "nombre",
                            autocomplete: "off",
                        },
                    },
                    class: "text-center",
                },
                { html: "row 3", class: "text-center" },
                {
                    html: [
                        {
                            elemento: "button",
                            atributos: {
                                type: "button",
                                class: "btn btn-sm btn-outline-info",
                                html: '<i class="icon-pencil"></i>',
                            },
                        },
                        {
                            elemento: "button",
                            atributos: {
                                type: "button",
                                class: "btn btn-sm btn-outline-danger",
                                html: '<i class="icon-toggle-on"></i>',
                            },
                        },
                    ],
                    class: "text-center",
                },
            ],
            [
                {
                    html: "<i class='icon-ok'></i> row 4",
                    class: "text-center",
                    colspan: 2,
                },
                { html: "row 4", class: "text-center" },
                {
                    html: [
                        {
                            elemento: "button",
                            atributos: {
                                type: "button",
                                class: "btn btn-sm btn-outline-info",
                                html: '<i class="icon-pencil"></i>',
                            },
                        },
                        {
                            elemento: "button",
                            atributos: {
                                type: "button",
                                class: "btn btn-sm btn-outline-danger",
                                html: '<i class="icon-toggle-on"></i>',
                            },
                        },
                    ],
                    class: "text-center",
                },
            ],
            [
                {
                    html: "<i class='icon-dollar'></i> row 5",
                    class: "text-end",
                },
                {
                    html: "<i class='icon-dollar'></i> row 5",
                    class: "text-end",
                },
                {
                    html: "<i class='icon-dollar'></i> row 5",
                    class: "text-end",
                },
                { html: "row 5", class: "text-center" },
                {
                    html: [
                        {
                            elemento: "button",
                            atributos: {
                                type: "button",
                                class: "btn btn-sm btn-outline-info",
                                html: '<i class="icon-pencil"></i>',
                            },
                        },
                        {
                            elemento: "button",
                            atributos: {
                                type: "button",
                                class: "btn btn-sm btn-outline-danger",
                                html: '<i class="icon-toggle-on"></i>',
                                onclick: "alert()",
                            },
                        },
                    ],
                    class: "text-center",
                },
            ],
        ],
    };

    // Se crea la variable opts para un mejor control del JSON
    // Se define opts por defecto con el JSON de la variable "defaults"
    let opts = defaults;

    // En caso de que options este definido reasignamos el valor de opts.
    if (options !== undefined) opts = $.extend(defaults, options);
    // opts = options;

    // Se crea la tabla con todas los atributos declarados [id, clases, etc.].
    // Se guarda en una variable el elemento del DOM (<tabla>) para uso general.
    let table = $("<table>", opts.table);
    if (!table.hasClass("table")) table.addClass("table");
    if (!table.hasClass("table-sm")) table.addClass("table-sm");
    if (!table.hasClass("table-hover")) table.addClass("table-hover");
    if (!table.hasClass("table-bordered")) table.addClass("table-bordered");

    //Se crea el tr que ira dentro del <thead>
    let tr = $("<tr>");
    // Se crean los <th> con sus atributos,
    // haciendo un recorrido por la cantidad de columnas.
    thead_th = typeof opts.thead === "string" ? opts.thead.split(",") : opts.thead;

    thead_th.forEach((th) => {
        if (typeof th === "string") tr.append($("<th>", { html: th }));
        else tr.append($("<th>", th));
    });
    // Se crea el elemento del DOM (<thead>) y se rellena con el tr creado.
    // De ser necesario podrían agregarse atributos al thead en un futuro.
    // #let thead = $("<thead>",opc.thead.atributos);
    // #thead.append(tr);
    // Se rellena la tabla con el <thead>.
    table.append($("<thead>").append(tr));

    // Se crea la variable del elemento del DOM (<tbody>), para su uso general.
    let tbody = $("<tbody>");
    // Se hace el recorrido por filas (<tr>)
    opts.tbody.forEach((row) => {
        let tr = $("<tr>"); //Se crea el <tr>

        row.forEach((celda) => {
            //Se hace un recorrido por cada celda (<td>)
            let td = $("<td>"); //Se crea el <td>
            // Comprobamos si celda.html es un string
            if (typeof celda.html === "string" || typeof celda.html === "number") td.html(celda.html);

            // Comprobamos si celda.html es un objeto
            if (typeof celda.html === "object" && celda.html != null) {
                // Comprobamos si la celda.html contiene un arreglo de objetos
                if (Array.isArray(celda.html)) {
                    celda.html.forEach(function (elemento) {
                        let elementoHTML;
                        // Verificar si el elemento del arreglo es un objeto o un string
                        if (typeof elemento === "object") {
                            // Si es un objeto significa que es un elemento del DOM, crear el elemento según las propiedades
                            elementoHTML = $("<" + elemento.elemento + ">", elemento.atributos);
                        } else {
                            // Si es un string, agregar el contenido directamente
                            elementoHTML = $(elemento);
                        }
                        // Añadimos el contenido al td.
                        td.append(elementoHTML);
                    });
                } else {
                    //Caso contrario, si es un objeto único
                    let elemento = $("<" + celda.html.elemento + ">", celda.html.atributos);

                    if (celda.html.opciones !== undefined) {
                        celda.html.opciones.forEach((opt) => {
                            elemento.append($("<option>", opt));
                        });
                    }
                    td.append(elemento);
                }
            }

            if (celda.elemento !== undefined) {
                let clases = ["btn-outline-info", "btn-outline-danger"];
                let icon = ['<i class="icon-pencil"></i>', '<i class="icon-toggle-on"></i>'];
                let id = ["edit_", "status_"];
                let click = ["alert('row_edit')", "alert('row_status')"];

                if (celda.button !== undefined) {
                    let atr = celda.button;
                    delete celda.button;

                    clases = atr.class === undefined ? clases : typeof atr.class === "string" ? atr.class.split(",") : atr.class;

                    icon = atr.icon === undefined ? icon : typeof atr.icon === "string" ? atr.icon.split(",") : atr.icon;
                    id = atr.id === undefined ? id : typeof atr.id === "string" ? atr.id.split(",") : atr.id;
                    click = atr.click === undefined ? click : typeof atr.click === "string" ? atr.click.split(",") : atr.click;
                }

                switch (celda.elemento) {
                    case "button":
                        clases.forEach((btn, index) => {
                            let button = $("<button>", {
                                id: id[index],
                                class: "btn btn-sm " + btn,
                                html: icon[index],
                                onClick: click[index],
                            });

                            td.append(button);
                            td.addClass("text-center");
                        });
                        break;
                }

                delete celda.elemento;
            }

            // Si el <td> tiene atributos se agregan al final
            for (const atributo in celda) if (atributo !== "html") td.attr(atributo, celda[atributo]);

            if (celda.tr === undefined) tr.append(td);

            if (celda.tr != undefined) tr.attr(celda.tr);
        });

        tbody.append(tr);
    });

    table.append(tbody);
    
    if(opts.tfoot){
        //Se crea el tr que ira dentro del <tfoot>
        let tr = $("<tr>");
        let tfoot = typeof opts.tfoot === "string" ? opts.tfoot.split(",") : opts.tfoot;
    
        // Se crean los <th> con sus atributos,
        // haciendo un recorrido por la cantidad de columnas.
        tfoot.forEach((th) => {
            if (typeof th === "string") tr.append($("<th>", { html: th }));
            else tr.append($("<th>", th));
        });
        // Se crea el elemento del DOM (<thead>) y se rellena con el tr creado.
        // De ser necesario podrían agregarse atributos al thead en un futuro.
        // #let thead = $("<thead>",opc.thead.atributos);
        // #thead.append(tr);
        // Se rellena la tabla con el <thead>.
        table.append($("<tfoot>").append(tr));
    }

    this.append(table);
};
function fecha_actual() {
    // Crear un objeto Date con la fecha actual
    const DATE = new Date();

    // Obtener los componentes de la fecha
    let dia = DATE.getDate();
    let mes = DATE.getMonth() + 1;
    let anio = DATE.getFullYear();

    // formatear num < 10
    dia = (dia < 10 ? "0" : "") + dia;
    mes = (mes < 10 ? "0" : "") + mes;

    return anio + "-" + mes + "-" + dia;
}
// La fecha actual con js YYYY-MM-DD
$.fn.fecha_actual = function () {
    // Crear un objeto Date con la fecha actual
    const DATE = new Date();

    // Obtener los componentes de la fecha
    let dia = DATE.getDate();
    let mes = DATE.getMonth() + 1;
    let anio = DATE.getFullYear();

    // formatear num < 10
    dia = (dia < 10 ? "0" : "") + dia;
    mes = (mes < 10 ? "0" : "") + mes;

    $(this).val(anio + "-" + mes + "-" + dia);
};
// La hora actual con js
$.fn.hora_actual = function () {
    const HORA = new Date();

    let horas = HORA.getHours();
    let minutos = HORA.getMinutes();

    // Formatear numeros < 10
    horas = (horas < 10 ? "0" : "") + horas;
    minutos = (minutos < 10 ? "0" : "") + minutos;

    // mostrar tiempo
    $(this).val(horas + ":" + minutos);
};
// Obtener el valor de un input daterangepicker
$.fn.valueDates = function () {
    let dates = $(this).data("daterangepicker");
    let valores = null;

    if (dates) {
        valores = [dates.startDate.format("YYYY-MM-DD"), dates.endDate.format("YYYY-MM-DD")];
    }

    return valores;
};
// FORMATEAR CIFRAS NÚMERICAS
$.fn.number_format = function (num, decimales, puntoDecimal, miles) {
    num = Number(num || 0).toFixed(decimales);
    puntoDecimal = puntoDecimal || ".";
    miles = miles || ",";

    var partes = num.toString().split(".");
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, miles);

    $(this).val(partes.join(puntoDecimal));
};
function number_format(num, decimales, puntoDecimal, miles) {
    if (typeof num == "string") num = num.replace(",", "").replace("$", "").replace("%", "").replace(" ", "").trim();

    num = Number(num || 0).toFixed(decimales);

    puntoDecimal = puntoDecimal || ".";
    miles = miles || ",";

    var partes = num.toString().split(".");
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, miles);

    return partes.join(puntoDecimal);
}
function format_number(number, prefix = "$", decimals = 2) {
    // Validamos si number es numérico y quitamos posibles espacios en blanco
    if (typeof number == "string") number = number.replace(",", "").replace("$", "").replace("%", "").replace(" ", "").trim();

    const num = parseFloat(number);
    number = typeof num === "number" && !isNaN(num) ? number : 0;

    // convertimos a decimal
    // Verificamos si el número es muy pequeño y se muestra como 0.00
    // Si el número es muy pequeño, devolvemos el guion (-) sin el icono
    // Math.abs devuelve el valor absoluto de un numero convirtiendolo en positivo
    if (number >= 0 && Math.abs(number) < 0.01) return "-";

    // Le damos formato al número
    number = this.number_format(number, decimals, ".", ",");
    return prefix == "$" ? "$ " + number : number + " %";
}

function createForm(options) {
    const defaults = {
        class: "row",
        id: "dfForm",
        novalidate: true,
    };
    const attr = Object.assign(defaults, options);
    return $("<form>", attr);
}

// Crear elementos usando Bootstrap 5
$.fn.create_elements = function (options) {
    return new Promise((resolve, reject) => {
        let container = $(this);
        //json para crear un input por defecto
        let defaults = [{ lbl: "Input", type: "text" }];
        // Si options fue definido renombramos opts
        let opts = options === undefined ? defaults : options;
        // Hacemos un recorrido por todos los elementos que se van a crear
        opts.forEach((elem) => {
            let vacio = "&nbsp;";
            let text = elem.lbl !== undefined ? elem.lbl : ""; // Se obtiene el texto del label
            let iptLbl = text.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s]+/g, ""); //Texto del label
            let label,
                text2,
                parent,
                id = "";

            // Le damos tratamiento al label
            if (elem.lbl !== undefined) {
                delete elem.lbl;
                text2 = text
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-zA-Z0-9]+/g, "");
                id = text.length > 1 ? text2.replace(" ", "_") : text2;
                // Creamos el label
                label = $("<label>", {
                    html: text,
                    for: id,
                    class: "col-12 form-label fw-bold",
                });
                //Eliminamos el label del json
            } else {
                // Si no fue definido creamos un label por defecto para uso con botones
                label = $("<label>", {
                    class: "col-12 fw-bold d-none d-sm-block",
                    html: "&nbsp;",
                });
            }

            // Si es un button submit y no se difinio la clase del div por defecto lo pones al final con un ancho del 100% centrando el boton.
            if (elem.type === "submit" || elem.elemento === "submit")
                parent = $("<div>", {
                    class: "mb-3 col-12 d-flex justify-content-center",
                });
            else if (elem.div === undefined)
                //Si no es un submit y div no fue definido.
                parent = $("<div>", {
                    class: "mb-3 col-12 col-sm-6 col-md-4 col-lg-3",
                });
            else parent = $("<div>", elem.div); //Si se definio se agregan los atributos

            delete elem.div; //Eliminamos el elemento del json

            if (elem.elemento === undefined) {
                if (elem.lbl !== undefined) delete elem.lbl; //Eliminamos el label del json

                let text_align = "";
                if (elem.tipo !== undefined && (elem.tipo === "cifra" || elem.tipo === "numero")) {
                    text_align = "text-end";
                    iptLbl = "0.00";
                }

                // Se declaran atributos por defecto

                let clase_extra = elem.class !== undefined ? elem.class : "";

                let attr = {
                    type: "text",
                    name: id,
                    id: id,
                    class: "form-control " + text_align + " " + clase_extra,
                    placeholder: iptLbl,
                };

                delete elem.class;

                let iptAttr = $.extend(attr, elem); // Se convinan atributos con los que aun existen dentro del json
                let input = $("<input>", iptAttr); // Se crea el input
                parent.append(label, input); // Se agrega el label y el input al [div] padre
            }
            // Crear inputs
            if (elem.elemento === "input") {
                if (elem.elemento !== undefined) delete elem.elemento; //Eliminamos el elemento del json
                if (elem.lbl !== undefined) delete elem.lbl; //Eliminamos el label del json

                let text_align = "";
                if (elem.tipo !== undefined && (elem.tipo === "cifra" || elem.tipo === "numero")) {
                    text_align = "text-end";
                    iptLbl = "0.00";
                }

                let clase_extra = elem.class !== undefined ? elem.class : "";

                // Se declaran atributos por defecto
                let attr = {
                    type: "text",
                    name: id,
                    id: id,
                    class: "form-control  " + clase_extra,
                    placeholder: iptLbl,
                };

                delete elem.class;

                let iptAttr = $.extend(attr, elem); // Se convinan atributos con los que aun existen dentro del json
                let input = $("<input>", iptAttr); // Se crea el input

                let spanError = $("<span>", {
                    class: "text-danger form-text hide",
                    html: "Este campo es requerido *",
                });

                parent.append(label, input, spanError); // Se agrega el label y el input al [div] padre
            }
            // Crear inputs
            if (elem.elemento === "textarea") {
                if (elem.elemento !== undefined) delete elem.elemento; //Eliminamos el elemento del json
                if (elem.lbl !== undefined) delete elem.lbl; //Eliminamos el label del json

                let clase_extra = elem.class !== undefined ? elem.class : "";

                // Se declaran atributos por defecto
                let attr = {
                    name: id,
                    id: id,
                    row: "5",
                    class: "form-control resize " + clase_extra,
                    placeholder: iptLbl,
                };

                delete elem.class;

                let iptAttr = $.extend(attr, elem); // Se convinan atributos con los que aun existen dentro del json
                let input = $("<textarea>", iptAttr); // Se crea el input
                parent.append(label, input); // Se agrega el label y el input al [div] padre
            }
            // Crear SPAN
            if (elem.elemento === "span") {
                let attr = {
                    class: "col-12 mb-3 form-text",
                };

                attr = $.extend(attr, elem);

                let span = $("<span>", attr);
                parent.append(span);
            }
            // Crear select
            if (elem.elemento == "select") {
                if (elem.elemento !== undefined) delete elem.elemento; //Eliminamos el elemento del json

                // let opts_select = { placeholder: "- Seleccionar -" };
                let opts_select = elem.option;
                // opts_select = $.extend(opts_select, elem.option);
                delete elem.option;

                // Atributos por defecto
                let attr = {
                    name: id,
                    id: id,
                    class: "form-select",
                };

                let btnAttr = $.extend(attr, elem); // Se convinan los atributos restantes que no fueron eliminados
                let select = $("<select>", btnAttr); // Se crea el boton
                if (!select.hasClass("form-select")) select.addClass("form-select");
                parent.append(label, select); // Se agrega el label y el boton al (div) padre
                select.option_select(opts_select); // Se hace uso del plugin "option_select" despues de agregarlo al DOM
            }
            // Crear input-group
            if (elem.elemento === "input-group") {
                delete elem.elemento; //Eliminamos el elemento del json
                // Creamos el contenedor del input-group
                let div = $("<div>", { class: "input-group" });

                // Trabajamos con arreglos debido a que pueden existir 2 al mismo tiempo
                // Asignamos el icono del span
                let icon = [];
                if (elem.icon !== undefined) {
                    if (Array.isArray(elem.icon)) icon = elem.icon;
                    else icon = elem.icon.split(",");
                    delete elem.icon;
                } else icon = ['<i class="icon-dollar"></i>'];

                // Se hace un recorrido en caso que sean mas de 1 icono
                let span = [];
                icon.forEach((icon, index) => {
                    if (index < 2) {
                        let spanAttr = {
                            class: `input-group-text`,
                            html: icon,
                            id: `sgp_${id}${index}`,
                        };

                        if (elem.span != undefined) {
                            elem.span = Array.isArray(elem.span) ? elem.span : [elem.span];

                            // Se crean atributos por defecto del span
                            spanAttr = $.extend(spanAttr, elem.span[index]);
                        }
                        //Se crea el span
                        span.push($("<span>", spanAttr));
                    }
                });
                delete elem.span;

                let text_align = "";
                let type = "text";
                let clase = "form-control";
                let placeholder = elem.placeholder !== undefined ? elem.placeholder : text;
                if (elem.tipo === "cifra" || elem.tipo === "numero") {
                    text_align = "text-end";
                    placeholder = "0.00";
                    clase += ` ${text_align} ${elem.class === undefined ? "" : elem.class}`;
                }
                delete elem.class;
                delete elem.placeholder;

                // delete elem.tipo;

                let attr = $.extend(
                    {
                        type: type,
                        name: id,
                        id: id,
                        class: clase,
                        placeholder: placeholder,
                    },
                    elem
                );

                let input = $("<input>", attr).removeAttr("pos");
                if (span.length == 2) div.append(span[0], input, span[1]);
                else {
                    if (elem.pos !== undefined) {
                        if (["r", "right", "d", "der"].includes(elem.pos)) div.append(input, span);
                        else if (["l", "left", "i", "izq"].includes(elem.pos)) div.append(span, input);
                        else div.append(span, input);
                    } else {
                        div.append(span, input);
                    }
                }
                delete elem.pos;

                let spanError = $("<span>", {
                    class: "text-danger form-text hide",
                    html: "Este campo es requerido *",
                });

                parent.append(label, div, spanError);
            }
            // Crear input-group con un select
            if (elem.elemento === "select-group") {
                if (elem.elemento !== undefined) delete elem.elemento; //Eliminamos el elemento del json
                let div = $("<div>", { class: "input-group" });
                let icon = elem.icon !== undefined ? elem.icon : "?";
                delete elem.icon;
                let spanDef = { class: "input-group-text", html: icon };
                let spanAttr = $.extend(spanDef, elem.span);
                delete elem.span;

                let span = $("<span>", spanAttr);

                let cbDef = {
                    name: id,
                    id: id,
                    class: "form-select",
                };

                let opts_select = { placeholder: "- Seleccionar -" };
                opts_select = $.extend(opts_select, elem.option);
                delete elem.option;
                let select = null;

                if (elem.pos !== undefined) {
                    if (elem.pos === "r" || elem.pos === "right" || elem.pos === "d" || elem.pos === "der") {
                        delete elem.pos;
                        let cbAttr = $.extend(cbDef, elem); // Se convinan atributos con los que aun existen dentro del json
                        select = $("<select>", cbAttr); // Se crea el input
                        div.append(select, span);
                    } else if (elem.pos === "l" || elem.pos === "left" || elem.pos === "i" || elem.pos === "izq") {
                        delete elem.pos;
                        let cbAttr = $.extend(cbDef, elem); // Se convinan atributos con los que aun existen dentro del json
                        select = $("<select>", cbAttr); // Se crea el input
                        div.append(span, select);
                    }
                } else {
                    let cbAttr = $.extend(cbDef, elem); // Se convinan atributos con los que aun existen dentro del json
                    select = $("<select>", cbAttr); // Se crea el input
                    div.append(select, span);
                }

                parent.append(label, div);
                select.option_select(opts_select); // Se hace uso del plugin "option_select" despues de agregarlo al DOM
            }
            // Crear botones
            if (elem.elemento === "button" || elem.elemento === "boton" || elem.type === "button" || elem.type === "submit" || elem.elemento === "submit") {
                if (elem.elemento === "button" || elem.elemento === "boton" || elem.type === "button") {
                    label = $("<label>", {
                        class: "col-12 form-label d-none d-sm-block",
                        html: "&nbsp;",
                    });
                } else {
                    label = "";
                }
                // Atributos por defecto
                let attr = {
                    id: id,
                    html: text,
                };

                let btn_color = "btn-primary";
                if (elem.btncolor !== undefined) btn_color = elem.btncolor;
                delete elem.btncolor;

                let btnClass = "col-12 btn " + btn_color; //Clase por defecto
                if (elem.type === "submit" || elem.elemento === "submit") {
                    //Si es submit por defecto
                    btnClass = "col-12 col-sm-8 col-md-6 col-lg-4 btn " + btn_color;
                    if (elem.lbl === undefined) label = "";

                    attr.type = "submit";
                } else {
                    attr.type = "button";
                }

                attr.class = btnClass;

                if (elem.elemento !== undefined) delete elem.elemento; //Eliminamos el elemento del json
                if (elem.lbl !== undefined) delete elem.lbl; //Eliminamos el label del json

                let btnAttr = $.extend(attr, elem); // Se convinan los atributos restantes que no fueron eliminados
                let button = $("<button>", btnAttr); // Se crea el boton
                if (!button.hasClass("btn")) button.addClass("btn");
                parent.append(label, button); //Se agrega el label y el boton al (div) padre
            }
            // Crear botones de modal
            if (elem.elemento === "modal_button") {
                let labeles = ["Guardar", "Cancelar"];
                if (text !== "") labeles = Array.isArray(text) ? text : text.split(","); //Creamos un array con el texto que contiene el boton
                parent.attr("class", ""); //Limpiamos las clases del div
                parent.addClass("col-12 d-flex justify-content-between");

                let attrBtn1 = {
                    class: "btn btn-primary col-5",
                    text: labeles[0].trim(),
                    type: "submit",
                };

                let attrBtn2 = {
                    class: "btn btn-outline-danger bootbox-close-button col-5",
                    text: labeles[1].trim(),
                    type: "button",
                };

                let combinedAttrs = {
                    attrBtn1: $.extend({}, attrBtn1),
                    attrBtn2: $.extend({}, attrBtn2),
                };

                attrBtn1 = $.extend(attrBtn1, elem.Btn1);
                attrBtn2 = $.extend(attrBtn2, elem.Btn2);

                let btnConfirm = $("<button>", attrBtn1);
                let btnCancel = $("<button>", attrBtn2);

                parent.append(btnConfirm, btnCancel);
            }
            // Crear un menu de colores
            if(elem.elemento === "color_menu") {
                label = $("<label>", {
                        class: "col-12 form-label",
                        html: "&nbsp;",
                    });
                parent.append(label);
                parent.menu_colors(elem.colores);
            }
            if(elem.elemento === "H" || elem.elemento === "h" ){
                const element =  'H'+elem.tipo;
                delete elem.tipo;
                parent = $('<'+element+'>',elem);
            }
            // Agregamos el elemento al contenedor
            container.append(parent);
            resolve();
        });
    });
};
$.fn.menu_colors = function(options) {
        const defaults = { dfColor: "#DDDDDD", colors: ["#DDDDDD", "#D50000", "#E67C73", "#F4511E", "#F6BF26", "#33B679", "#0B8043", "#039BE5", "#3F51B5", "#7986CB", "#8E24AA"], col: 3 };

        let opts = defaults;
        if (Array.isArray(options)) opts.colors = options;
        else if (typeof options === "object") opts = Object.assign(defaults, options);
        let attrCircle = {
            css: {
                "border-radius": "50%",
                "box-sizing": "border-box",
                display: "inline-block",
                width: "20px",
                height: "20px",
                margin: "1px",
                padding: "2px",
                "-webkit-flex-shrink": "0",
                "flex-shrink": "0",
                position: "relative",
                margin: "auto",
                cursor: "pointer",
                "background-color": opts.dfColor,
            },
            "data-color": opts.dfColor,
        };

        const $attrIcon = {
            class: "icon-ok",
            css: {
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                "font-size": "12px",
                color: "white",
            },
        };

        const $dfCircle = $("<div>", { ...attrCircle, id: "circleBTN" });
        $dfCircle.append($('<i>',{...$attrIcon,class:'icon-down-dir d-block d-lg-none'}));
        
        const $dfIcon = $("<i>", { class: "icon-down-dir d-none d-lg-inline", css: { color: "#5F6368", position: "relative", top: "-5px" } });
        const $button = $("<button>", {
            type: "button",
            id:'btnCircleColors',
            class: "btn col-12",
            "data-bs-toggle": "dropdown",
            "aria-expanded": "false",
            css: {
                "background-color": "#F1F3F4",
            },
        }).append($dfCircle, $dfIcon);

        const $menuCircle = $("<div>", {
            id: "circleMenu",
            class: "dropdown-menu",
            css: {
                "--bs-dropdown-min-width": "4rem !important",
                "grid-template-columns": "repeat(" + opts.col + ", 1fr)",
                gap: "10px",
                padding: "10px",
                "justify-content": "start",
                "align-content": "center",
                display: "d-none",
            },
        });

        const colors = opts.colors;
        for (const c in colors) {
            attrCircle["data-color"] = colors[c];
            attrCircle.css["background-color"] = colors[c];
            attrCircle["aria-checked"] = c == 0 ? "true" : "false";
            $attrIcon.class = colors[c] == opts.dfColor ? "icon-ok" : "icon-ok hide";

            const $circle = $("<div>", attrCircle);
            const $icon = $("<i>", $attrIcon);

            $circle.append($icon);
            $menuCircle.append($circle);
        }

        const $dropdown = $("<div>", { class: "dropdown",css:{width:'100%'} }).append($button, $menuCircle);
        
        $(this).append($dropdown);
    }
$.fn.create_elements2 = function (options) {
    return new Promise((resolve, reject) => {
        let contenedor = $(this);

        let defaults = [{ lbl: "Input", type: "text" }];

        let opts = options === undefined ? defaults : options;

        // Hacemos un recorrido por todos los elementos que se van a crear
        opts.forEach((dom) => {
            let vacio = "&nbsp;"; //Creamos un elemento que asigna espacios en blanco

            // Creamos el div contenedor
            let div = $("<div>", { class: "col mb-3" });

            if (dom.div != undefined) {
                div.attr("class", dom.div);
            }

            // Obtenemos el texto del label "&nbsp;"
            let value = dom.lbl !== undefined ? dom.lbl : "#";
            delete dom.lbl;
            let texto = value
                .toLowerCase()
                .replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s]+/g, "")
                .replace(/ /g, "-");
            let id = dom.id === undefined ? texto : dom.id;
            delete dom.id;
            let forLbl = id;

            // Creamos una etiqueta label para casi todos los elementos del formulario
            let label = $("<label>", {
                for: forLbl,
                class: "fw-bold mb-1",
                html: value,
            });

            // Span de error
            let spanError = $("<span>", {
                class: "text-danger form-text hide",
                html: '<i class=""></i> Este campo es requerido *',
            });

            //Crearemos input por defecto
            if (dom.elemento === undefined || dom.elemento === "input") {
                let text_align = "";
                let placeholder = value;

                if (dom.type === "number" || dom.tipo === "numero" || dom.tipo === "cifra") {
                    text_align = "text-end";
                    placeholder = "0.00";
                }

                let control = "form-control";
                if (dom.type != undefined && dom.type.toLowerCase() == "submit") {
                    control = "btn btn-primary col-12";
                    label.html(vacio);
                }

                let attr = $.extend(
                    {
                        class: control + text_align,
                        id: id,
                        name: id,
                        placeholder: placeholder,
                        type: "text",
                    },
                    dom
                );

                let input = $("<input>", attr);
                if (dom.type !== "checkbox") {
                    div.append(label, input, spanError);
                } else {
                    div.append(input, label, spanError);
                }

                if (dom.type !== "submit" && dom.type !== "radio" && dom.type !== "checkbox") {
                    if (!input.hasClass("form-control")) input.addClass("form-control");
                } else if (dom.type === "submit") {
                    if (!input.hasClass("btn")) input.addClass("btn");
                    if (!input.hasClass("col-12")) input.addClass("col-12");
                }

                if (!input.hasClass(text_align)) input.addClass(text_align);
            } else {
                if (dom.elemento == "textarea") {
                    delete dom.elemento; //Eliminamos el elemento del json
                    attr = $.extend(
                        {
                            name: id,
                            id: id,
                            row: "5",
                            class: "form-control resize",
                            placeholder: value,
                        },
                        dom
                    ); // Se convinan atributos con los que aun existen dentro del json

                    let textarea = $("<textarea>", attr); // Se crea el input
                    if (!textarea.hasClass("form-control")) textarea.addClass("form-control");
                    if (!textarea.hasClass("resize")) textarea.addClass("resize");
                    div.append(label, textarea, spanError); // Se agrega el label y el input al [div] padre
                }
                if (dom.elemento == "select") {
                    delete dom.elemento; //Eliminamos el elemento del json

                    // Atributos para el plugin option_select
                    let option_select = {
                        data: {},
                        placeholder: "- Seleccionar -",
                    };

                    if (dom.option !== undefined) {
                        option_select = $.extend({}, option_select, dom.option);
                        delete dom.option;
                    } else if (dom.options !== undefined) {
                        option_select = $.extend({}, option_select, dom.options);
                        delete dom.options;
                    } else if (dom.option_select !== undefined) {
                        option_select = $.extend({}, option_select, dom.option_select);
                        delete dom.option_select;
                    }

                    // Atributos para el select
                    let attr = $.extend(
                        {
                            name: id,
                            id: id,
                            class: "form-select",
                        },
                        dom
                    ); // Se convinan los atributos restantes que no fueron eliminados

                    let select = $("<select>", attr); // Se crea el boton
                    if (!select.hasClass("form-select")) select.addClass("form-select");
                    div.append(label, select, spanError); // Se agrega el label y el boton al (div) padre
                    select.option_select(option_select); // Se hace uso del plugin "option_select" despues de agregarlo al DOM
                }
                if (dom.elemento == "input-group") {
                    delete dom.elemento; //Eliminamos el elemento del json
                    // Creamos el contenedor del input-group
                    let divgb = $("<div>", { class: "input-group" });

                    // Trabajamos con arreglos debido a que pueden existir 2 al mismo tiempo
                    // Asignamos el icono del span
                    let icon = [];
                    if (dom.icon !== undefined) {
                        if (Array.isArray(dom.icon)) icon = dom.icon;
                        else icon = dom.icon.split(",");
                        delete dom.icon;
                    } else icon = ['<i class="icon-dollar"></i>'];

                    // Se hace un recorrido en caso que sean mas de 1 icono
                    let span = [];
                    icon.forEach((icon, index) => {
                        if (index < 2) {
                            dom.span = Array.isArray(dom.span) ? dom.span : [dom.span];

                            // Asignamos clases adicionales a los atributos del span
                            let clase_extra = "";
                            if (dom.span[index] && dom.span[index].class) {
                                //comprobamos la existencia de clases adicionales
                                clase_extra = dom.span[index].class;
                                delete dom.span[index].class; //Eliminamos su existencia para evitar duplicidad
                            }

                            // Se creando atributos por defecto del span
                            let spanAttr = $.extend(
                                {
                                    class: `input-group-text ${clase_extra}`,
                                    html: icon,
                                    id: `sgp_${id}${index}`,
                                },
                                dom.span[index]
                            );

                            delete dom.span[index]; //Se eliminan los atributos del span para no afectar el input

                            //Se crea el span
                            span.push($("<span>", spanAttr));
                        }
                    });
                    delete dom.span;

                    let text_align = "";
                    let tipo = "";
                    let type = "text";
                    let clase = "form-control";
                    if (dom.tipo === "cifra" || dom.tipo === "numero") {
                        tipo = dom.tipo === undefined ? "cifra" : dom.tipo;
                        type = "number";
                        text_align = "text-end";
                        value = "0.00";
                        clase += ` ${text_align} ${dom.class === undefined ? "" : dom.class}`;
                    }

                    delete dom.tipo;
                    delete dom.class;

                    let attr = $.extend(
                        {
                            type: type,
                            name: id,
                            id: id,
                            class: clase,
                            placeholder: value,
                        },
                        dom
                    );

                    let input = $("<input>", attr).removeAttr("pos");
                    if (span.length == 2) divgb.append(span[0], input, span[1]);
                    else {
                        if (dom.pos !== undefined) {
                            if (["r", "right", "d", "der"].includes(dom.pos)) divgb.append(input, span);
                            else if (["l", "left", "i", "izq"].includes(dom.pos)) divgb.append(span, input);
                            else divgb.append(span, input);
                        } else {
                            divgb.append(span, input);
                        }
                    }
                    delete dom.pos;

                    div.append(label, divgb, spanError);
                }
                if (dom.elemento == "select-group") {
                    delete dom.elemento; //Eliminamos el elemento del json
                    // Creamos el contenedor del input-group
                    let divcb = $("<div>", { class: "input-group" });

                    // trabajamos con arreglos debido a que pueden existir 2 al mismo tiempo
                    //Asignamos el icono del span
                    let iconcb = [];
                    if (dom.icon !== undefined) {
                        if (Array.isArray(dom.icon)) iconcb = dom.icon;
                        else iconcb = dom.icon.split(",");
                        delete dom.icon;
                    } else iconcb = ['<i class="icon-plus"></i>'];

                    // Se hace un recorrido en caso que sean mas de 1 icono
                    let spancb = [];
                    iconcb.forEach((icon, index) => {
                        if (index < 2) {
                            dom.span = Array.isArray(dom.span) ? dom.span : [dom.span];

                            // Asignamos clases adicionales a los atributos del span
                            let clase_extra = "btn-success";
                            if (dom.span[index] && dom.span[index].class) {
                                //comprobamos la existencia de clases adicionales
                                clase_extra = dom.span[index].class;
                                delete dom.span[index].class; //Eliminamos su existencia para evitar duplicidad
                            }

                            // Se creando atributos por defecto del span
                            let spanAttr = $.extend(
                                {
                                    class: `input-group-text btn ${clase_extra}`,
                                    html: icon,
                                    id: `sgp_${id}${index}`,
                                },
                                dom.span[index]
                            );

                            delete dom.span[index]; //Se eliminan los atributos del span para no afectar el input

                            //Se crea el span
                            spancb.push($("<span>", spanAttr));
                        }
                    });
                    delete dom.span;

                    let cbclase = "form-select ";
                    cbclase += dom.class === undefined ? "" : dom.class;

                    delete dom.tipo;
                    delete dom.class;

                    let attr = $.extend(
                        {
                            name: id,
                            id: id,
                            class: cbclase,
                        },
                        dom
                    );

                    // Atributos para el plugin option_select
                    let option_selectgb = {
                        data: {},
                        placeholder: "- Seleccionar -",
                    };

                    if (dom.option !== undefined) {
                        option_selectgb = $.extend({}, option_selectgb, dom.option);
                    } else if (dom.options !== undefined) {
                        option_selectgb = $.extend({}, option_selectgb, dom.options);
                    } else if (dom.option_select !== undefined) {
                        option_selectgb = $.extend({}, option_selectgb, dom.option_select);
                    }
                    delete dom.option_select;

                    let selectgb = $("<select>", attr).removeAttr("pos");
                    if (!selectgb.hasClass("form-select")) selectgb.addClass("form-select");

                    if (spancb.length == 2) divcb.append(spancb[0], selectgb, spancb[1]);
                    else {
                        if (dom.pos !== undefined) {
                            if (["r", "right", "d", "der"].includes(dom.pos)) divcb.append(selectgb, spancb[0]);
                            else if (["l", "left", "i", "izq"].includes(dom.pos)) divcb.append(spancb[0], selectgb);
                            else divcb.append(spancb[0], selectgb);
                        } else {
                            divcb.append(spancb[0], selectgb);
                        }
                    }
                    delete dom.pos;
                    div.append(label, divcb);
                    selectgb.option_select(option_selectgb);
                }
                if (dom.elemento == "modal_button") {
                    let labeles = ["Guardar", "Cancelar"];
                    if (value !== "#") labeles = Array.isArray(value) ? value : value.split(","); //Creamos un array con el texto que contiene el boton

                    div.attr("class", ""); //Limpiamos las clases del div
                    div.addClass("col-12  d-flex flex-wrap justify-content-around");

                    let attrBtn1 = {
                        class: "btn btn-primary col-5",
                        text: labeles[0].trim(),
                        type: "submit",
                    };

                    let attrBtn2 = {
                        class: "btn btn-outline-danger bootbox-close-button col-5",
                        text: labeles[1].trim(),
                        type: "submit",
                    };

                    attrBtn1 = $.extend(attrBtn1, dom.btn1);
                    attrBtn2 = $.extend(attrBtn2, dom.btn2);

                    let btnConfirm = $("<button>", attrBtn1);
                    let btnCancel = $("<button>", attrBtn2);

                    div.append(btnConfirm, btnCancel);
                }
            }

            contenedor.append(div);
        });
    });
};
//Facilitar DateTable
$.fn.table_format = function (options) {
    // Configuración predeterminada
    let defaults = {
        language: {
            url: "../src/plugin/datatables/spanish.json",
        },
        responsive: true,
    };

    // Crear una copia de las opciones para no modificar el objeto original
    let json_data = $.extend({}, defaults, options);

    // Verificar si se proporciona la prioridad y crear columnDefs si es necesario
    if (json_data.priority !== undefined) {
        // Convertir a array en caso que sea string
        let columns = Array.isArray(options.priority) ? options.priority : options.priority.split(",");

        // Crear la variable columnDefs de DataTables
        json_data.columnDefs = columns.map((column, index) => ({
            responsivePriority: index + 1,
            targets: parseInt(column), // Asegurarse de que sea un número
        }));
        // Eliminar options.priority ya que se ha procesado
        delete json_data.priority;
    }
    // Inicializar DataTable con las opciones configuradas
    $(this).DataTable(json_data);
};
// Agregar un title con popper
$.fn.title = function (info) {
    let title = "Soy un título";
    if (typeof info === "string") title = info;

    let opts = {
        pos: "top",
        title,
    };

    if (typeof info === "object") opts = $.extend(opts, info);

    $(this).attr({
        "data-bs-trigger": "hover focus",
        "data-bs-placement": opts.pos,
        "data-bs-content": opts.title,
    });
    pop();
};
