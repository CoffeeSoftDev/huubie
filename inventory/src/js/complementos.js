var containerLoad = `<div class="d-flex align-items-center justify-content-center" 
style="min-height:300px;">
                    <h3 class="text-primary">
                        <i class="icon-spin4 animate-spin"></i>
                        ANALIZANDO
                    </h3>
                </div>`;

function load_sm() {
  const Load = `
   <div class="d-flex align-items-center justify-content-center" style="min-height:300px;">
                    <h3 class="text-primary">
                        <i class="icon-spin4 animate-spin"></i>
                        ANALIZANDO
                    </h3>
                </div>
   `;

  return Load;

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

  if (typeof options === "object" && options !== null)
    opts = $.extend(defaults, options);

  if (typeof options === "string" || options === undefined || options === null)
    opts = defaults;

  if (typeof options === "string" && options !== "") {
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
      confirmButton: opts.btn1Class,
      cancelButton: opts.btn2Class,
      denyButton: opts.btn3Class,
    },
  });

  if (opts.icon == "question" || opts.btn1 || opts.btn2 || opts.btn3)
    return question;
}

function swal_msj(txt) {
  Swal.fire({
    icon: "error",
    // title: "Oops...",
    text: txt,
    // footer: '<a href="">Why do I have this issue?</a>',
  });
}

function swal_error(xhr, status, error) {
  let response = xhr.responseText;
  if (response === "")
    response = "Error de sistema: No se obtuvo una respuesta.";

  Swal.fire({
    icon: "error",
    title: "LLAMAR A SORPORTE TÉCNICO",
    html: status + " " + error + "<br>" + response,
    showConfirmButton: true,
  });
}

function swal_success() {
  Swal.fire({
    width: 200,
    icon: "success",
    showConfirmButton: false,
    timer: 1500,
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

function send_ajax(datos, url, before, elemento) {
  return new Promise(function (resolve, reject) {
    $.ajax({
      type: "POST",
      url: url,
      data: datos,
      dataType: "json",
      contentType: false,
      processData: false,
      cache: false,
      beforeSend: function () {
        if (elemento === undefined) {
          defaults = {
            icon: "info",
            fontello: '<i class="icon-spin6 animate-spin"></i>',
            title: "Espere un momento...",
            timer: 0,
            btn1: false,
          };

          let opts = defaults;

          if (typeof before === "object" && typeof before !== "string") {
            opts = $.extend(defaults, before);
            opts.title = opts.fontello + " " + opts.title;
          }

          if (typeof before === "string") opts.title = before;

          if (before !== undefined && elemento === undefined) {
            alert(opts);
          }
        } else {
          defaults = {
            class: "col-12 mb-3 mt-5 text-center p-5 text-center",
            html: "<h3><i class='icon-spin6 animate-spin'></i> Espere un momento</h3>",
          };

          opts = defaults;

          if (
            typeof before === "string" &&
            before === "" &&
            before !== undefined
          )
            opts.html = before;

          let nuevoElemento = $("<div>", opts);
          elemento.html(nuevoElemento);
        }
      },
      success: function (data) {
        // setTimeout(() => {
          Swal.close();
          resolve(data);
        // }, 1000);
      },
      error: function (xhr, status, error) {
        swal_error(xhr, status, error);
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
        $(div).Loading();
      },
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


function initComponents(url) {
  return new Promise(function (resolve, reject) {
     dtx = { opc: "initComponents" };
    //  console.log('IM HERE ');

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
        swal_error(xhr, status, error);
      },
    });
  });
}

/* -------------------------------
        Complementos para tablas
----------------------------------*/
function datable_export_excel(table, size = 10) {
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

function validarLetras(id) {
  const REGEX = /^[A-Za-z\u00C0-\u017F\s]+$/;

  if (!REGEX.test($(id).val())) {
    $(id).val("");
    $(id).addClass("is-invalid");
    $(id).next("span").removeClass("hide");
    $(id).next("span").html(`
            <i class="icon-warning-1"></i>
            Solo se aceptan letras mayúsculas o minúsculas.
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
        format: "YYYY-MM-DD",
        applyLabel: "Aplicar",
        cancelLabel: "Cancelar",
        prevText: "< Ant.",
        nextText: "Sig. >",
        currentText: "Hoy",
        monthNames: [
          "Enero",
          "Febrero",
          "Marzo",
          "Abril",
          "Mayo",
          "Junio",
          "Julio",
          "Agosto",
          "Septiembre",
          "Octubre",
          "Noviembre",
          "Diciembre",
        ],
        monthNamesShort: [
          "Ene",
          "Feb",
          "Mar",
          "Abr",
          "May",
          "Jun",
          "Jul",
          "Ago",
          "Sep",
          "Oct",
          "Nov",
          "Dic",
        ],
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
/* ----------------------------------
  Obtener data de los formularios
-------------------------------------*/
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

$.fn.item_card = function (options) {
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
    <div class="grid-item-card3 pointer ${disabled}" onclick="${funcion}(${x.id},${x.costo})" >
    
    <div class=" ${color} col-12  d-flex pt-1 justify-content-center align-items-center info_title">
    <h6 class="fw-bold text-uppercase">${x.nombre}</h6>
    </div>
    
    <div class="col-12 d-flex p-3 pt-2 flex-column info_footer">

        <div class="d-flex justify-content-between">
        <label class="">Productos:</label>
        <small class="fw-bold">${x.value_1}</small>
        </div>

        <div class="d-flex justify-content-between">
            <label class="">Homologados:</label>
            <small class="fw-bold">/${x.value_2}</small>
        </div>

    </div>
    
    </div>
    `;
  }

  contedor = `
  <div class="grid-container mb-3">
  ${item}
  </div>
  `;

  $(this).html(contedor);
};

$.fn.simple_tab = function (options) {
  ul = "";
  tab = "";

  var defaults = {
    data: ["tab1", "tab2"],
  };

  // Carga opciones por defecto
  var opts = $.fn.extend(defaults, options);

  for (const x of opts.data) {
    active = "nav-link";
    tab_active = "tab-pane container fade";
    bs_toggle = `data-bs-toggle="tab"`;

    if (x.id == 0) {
      active = `nav-link active`;
      tab_active = `tab-pane container active`;
    }

    ul += `
    <li class="nav-item" >
      <a class="${active}"  ${bs_toggle} onclick="${x.fn}(${x.id})" href="#panel_${x.id}"> ${x.name}</a> 
    </li>`;

    tab += `
    
     <div class="${tab_active}" id="panel_${x.id}"  >

        <div id="content-head-tab${x.id}"></div>
        <div class="mt-3 mb-3" id="content-tab${x.id}"> </div>
    
    </div>
 
 
 
    `;
  }

  frm = `
  <ul class="nav nav-tabs" >${ul}</ul>
  <div class="tab-content" id="myTabContentx">${tab}</div>
`;

  $(this).html(frm);
};

$.fn.default = function (options) {
  txt = "";

  var defaults = {
    data: [],
  };

  // Carga opciones por defecto
  var opts = $.fn.extend(defaults, options);

  for (const k of opts.data.row) {
    txt += `
    <div class="col">

        <label class="fw-bold">${k}</label>

        <div class="input-group">
            <span class="input-group-text">
            <i class="icon-dollar"></i></span>
            <input type="number" 
            class="form-control text-end" 
            id="txt${k}" placeholder="0.00">
        </div>
    </div>
    `;
  }

  frm = `

  `;

  $(this).html(frm);
};

// const json_x = {
//   row: [
//     {
//       form: "96",
//       inputs: [
//         {
//           label: "input",
//           tipo: "text",
//           default: "",
//           name: "",
//         },
//       ],
//       opc: 0,
//     },
//     {
//       form: "95",
//       inputs: [
//         {
//           label: "input",
//           tipo: "text",
//           default: "",
//           name: "",
//         },
//       ],
//       opc: 0,
//     },
//   ],
// };

// let jsonx = {
//   thead: ["col1", "col2", "col3", "col4", "col5", "col6"],
//   row: [
//     {
//       id: "78",
//       nombre: "xx-xx-xx",
//       fecha: "2023-09-24",
//       hora: "18:29:43",
//       stado: "2",
//       opc: "xx-xx-xx",
//     },
//   ],
//   head: [""],
// };

// Complementos

function range_date(id) {
  var startDate = $("#" + id)
    .data("daterangepicker")
    .startDate.format("YYYY-MM-DD");
  var endDate = $("#" + id)
    .data("daterangepicker")
    .endDate.format("YYYY-MM-DD");

  fi = startDate;
  ff = endDate;

  array = [fi, ff];

  return array;
}

// Llenar un select
$.fn.option_select = function (options) {
    const SELECT = this;

    let defaults = {
        data: null,
        list: null,
        placeholder: "",
        select2: false,
        group: false,
        father: false,
    };

    // Carga opciones por defecto
    let opts = $.extend(defaults, options);

    if (opts.data !== null) {
        SELECT.html("");

        if (opts.placeholder !== "") {
            if (opts.select2) SELECT.html("<option></option>");

            if (!opts.select2)
                SELECT.html(
                    `<option value="0" hidden selected>${opts.placeholder}</option>`
                );
        }

        $.each(opts.data, function (index, item) {
            SELECT.append(
                $("<option>", {
                    value: item.id,
                    text: item.valor,
                })
            );
        });
    }

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
            });
        } else {
            let modalParent = $(".bootbox");
            if (typeof opts.father === "string") modalParent = $(opts.father);

            SELECT.select2({
                theme: "bootstrap-5",
                placeholder: opts.placeholder,
                dropdownParent: modalParent,
            });
        }
    }
};

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
  if (fechaActual.getMonth() < fechaNac.getMonth()) {
    años = 0;
    meses = 0;
    dias = 0;
  }

  if (meses < 0 || (meses === 0 && dias < 0)) {
    años--;
    meses += 12;
  }

  if (dias < 0) {
    var ultimoDiaMesAnterior = new Date(
      fechaActual.getFullYear(),
      fechaActual.getMonth(),
      0
    ).getDate();
    dias += ultimoDiaMesAnterior;
    meses--;
  }

  let datos = {
    y: años,
    m: meses,
    d: dias,
    s: "",
  };

  if (!isNaN(datos.d)) {
    if (datos.y == 1) datos.s += datos.y + " año ";
    if (datos.y >= 2) datos.s += datos.y + " años ";

    if (datos.m == 1) datos.s += datos.m + " mes ";
    if (datos.m >= 2) datos.s += datos.m + " meses ";

    if (datos.d == 1) datos.s += datos.d + " día";
    if (datos.d >= 2) datos.s += datos.d + " días";
  } else {
    datos.s = "Inválido";
  }

  return datos;
}

$.fn.validar_entrada = function () {
  let opc = {
    texto: /^[a-zA-ZÀ-ÖØ-öø-ÿ\s]+$/,
    texto_replace: /[^a-zA-ZÀ-ÖØ-öø-ÿ\s]+/g,
    numero: /^\d+$/,
    numero_replace: /[^0-9]/g,
    txtnum: /^[a-zA-Z0-9 ]*$/,
    txtnum_replace: /[^a-zA-Z0-9 ]+/g,
    cifra: /^-?\d+(\.\d+)?$/,
    email: /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/,
  };

  $(this).on("input", function () {
    let IPT = $(this);
    let iptval = IPT.val().trim();

    if (IPT.is('[tipo="texto"]')) {
      if (!opc.texto.test(iptval))
        IPT.val(iptval.replace(opc.texto_replace, ""));
    }

    if (IPT.is('[tipo="numero"]'))
      if (!opc.numero.test(iptval))
        IPT.val(iptval.replace(opc.numero_replace, ""));

    if (IPT.is('[tipo="textoNum"]'))
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

    if (IPT.is('[tipo="correo"],[type="email"]')) {
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
  });
};



$.fn.validation_form = function (options, callback) {
  // MANIPULAR LA CLASE IS-INVALID SI EL CAMPO ESTA VACIO
  $(this)
    .find("[required]")
    .on("change, input", function () {
      // Validacion de campos requeridos
      if ($(this).val().trim() === "") {
        isValid = false;
        $(this)
          .addClass("is-invalid")
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
        $(this)
          .removeClass("is-invalid")
          .siblings("span.text-danger")
          .addClass("hide");

        if ($(this).parent().hasClass("input-group"))
          $(this).parent().next("span").addClass("hide");
      }

      if ($(this).is("[maxlength]")) {
        let limit = parseInt($(this).attr("maxlength"));
        $(this).val($(this).val().slice(0, limit));
      }
    });

  //Permitido "texto", si existe validar máximo de caracteres
  $(this)
    .find('[tipo="texto"]')
    .on("input", function () {
      isValid = false;
      if ($(this).val().charAt(0) === " ") $(this).val($(this).val().trim());

      if (!/^[a-zA-ZÀ-ÖØ-öø-ÿ\s]+$/.test($(this).val()))
        $(this).val(
          $(this)
            .val()
            .replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s]+/g, "")
        );

      if ($(this).is("[maxlength]")) {
        let limit = parseInt($(this).attr("maxlength"));
        $(this).val($(this).val().slice(0, limit));
      }
    });

  //Permitido "texto y números", si existe validar máximo de caracteres
  $(this)
    .find('[tipo="textoNum"],[tipo="alfanumerico"]')
    .on("input", function () {
      isValid = false;
      if ($(this).val().charAt(0) === " ") $(this).val($(this).val().trim());

      if (!/^[a-zA-Z0-9 ]*$/.test($(this).val()))
        $(this).val(
          $(this)
            .val()
            .replace(/[^a-zA-Z0-9 ]+/g, "")
        );
      if ($(this).is("[maxlength]")) {
        let limit = parseInt($(this).attr("maxlength"));
        $(this).val($(this).val().slice(0, limit));
      }
    });

  // Permitido "solo números enteros", si existe validar máximo de caracteres.
  $(this)
    .find('[tipo="numero"]')
    .on("input", function () {
      if (!/^\d+$/.test($(this).val()))
        $(this).val(
          $(this)
            .val()
            .replace(/[^0-9]/g, "")
        );
      if ($(this).is("[maxlength]")) {
        let limit = parseInt($(this).attr("maxlength"));
        $(this).val($(this).val().slice(0, limit));
      }
    });

  // Permitido "números enteros, decimales y negativos" con keyup, si existe, validar máximo de caracteres.
  $(this)
    .find('[tipo="cifra"]')
    .on("input", function () {
      if (!/^-?\d+(\.\d+)?$/.test($(this).val())) {
        $(this).val($(this).val().replace("--", "-"));
        $(this).val($(this).val().replace("..", "."));
        $(this).val($(this).val().replace(".-", "."));
        $(this).val($(this).val().replace("-.", "-0."));
        $(this).val($(this).val().replace(/^\./, "0."));
        $(this).val(
          $(this)
            .val()
            .replace(/[^0-9\.\-]/g, "")
        );
        $(this).val(
          $(this)
            .val()
            .replace(/(\.[^.]+)\./g, "$1")
        );
        $(this).val(
          $(this)
            .val()
            .replace(/(\d)\-/g, "$1")
        );
      }
    });

  // Validar estructura de email
  $(this)
    .find('[type="email"], [tipo="correo"], [tipo="email"]')
    .on("input", function () {
      let expReg = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
      $(this).removeClass("is-invalid");
      if (!expReg.test($(this).val()) && $(this).val().trim() != "")
        $(this)
          .addClass("is-invalid")
          .next("span")
          .removeClass("hide")
          .html('<i class="icon-attention"></i> Ingrese un correo válido');
      else $(this).removeClass("is-invalid").next("span").addClass("hide");

      $(this).val().toLowerCase();
    });

  // Validar con trim que no haya espacios al principio o al final
  $(this)
    .find("input,textarea")
    .on("blur", function () {
      $(this).val($(this).val().trim());

      if ($(this).hasClass("text-uppercase"))
        $(this).val($(this).val().toUpperCase());

      if ($(this).hasClass("text-lowercase"))
        $(this).val($(this).val().toLowerCase());
    });

  // SUBMIT
  let form = this;
  form.on("submit", function (e) {
    e.preventDefault();
    let isValid = true;
    $(this)
      .find("[required]")
      .each(function () {
        if (
          $(this).val() === "" ||
          $(this).val() == "0" ||
          $(this).val().length === 0 ||
          $(this).val() == null
        ) {
          isValid = false;
          let span = $("<span>", {
            class: "col-12 text-danger form-text hide",
            html: '<i class="icon-attention"></i> El campo es requerido',
          });

          if ($(this).parent().hasClass("input-group") === true) {
            if ($(this).parent().next("span.text-danger").length === 0) {
              $(this).parent().parent().append(span);
            }
          } else if (
            $(this).parent().hasClass("input-group") === false &&
            $(this).siblings("span.text-danger").length === 0
          ) {
            $(this).parent().append(span);
          }

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
      let defaults = { tipo: "json" };
      // Comvina opciones y defaults
      let opts = $.extend(defaults, options);

      let formData = new FormData(form[0]);

      for (const key in opts) {
        if (key !== "tipo") {
          formData.append(key, opts[key]);
        }
      }

      if (opts.tipo === "text") {
        let valores = "";
        formData.forEach(function (valor, clave) {
          valores += clave + "=" + valor + "&";
        });
        if (typeof callback === "function") {
          // form.find(':submit').prop('disabled', true);
          callback(valores.slice(0, -1));
        }
      } else if (opts.tipo === "json") {
        if (typeof callback === "function") {
          // form.find(':submit').prop('disabled', true);
          callback(formData);
        }
      }
    }
  });
};

// Validar formularios
// $.fn.validation_form = function (options, callback) {
//     // MANIPULAR LA CLASE IS-INVALID SI EL CAMPO ESTA VACIO
//     $(this)
//         .find("[required]")
//         .on("change, input", function () {
//             // Validacion de campos requeridos
//             if ($(this).val().trim() === "") {
//                 isValid = false;
//                 $(this).addClass("is-invalid").siblings("span.text-danger").removeClass("hide").html('<i class="icon-attention"></i> El campo es requerido');

//                 if ($(this).parent().hasClass("input-group")) $(this).parent().next("span").removeClass("hide").html('<i class="icon-attention"></i> El campo es requerido');
//             } else {
//                 $(this).removeClass("is-invalid").siblings("span.text-danger").addClass("hide");

//                 if ($(this).parent().hasClass("input-group")) $(this).parent().next("span").addClass("hide");
//             }

//             if ($(this).is("[maxlength]")) {
//                 let limit = parseInt($(this).attr("maxlength"));
//                 $(this).val($(this).val().slice(0, limit));
//             }
//         });

//     //Permitido "texto", si existe validar máximo de caracteres
//     $(this)
//         .find('[tipo="texto"]')
//         .on("input", function () {
//             isValid = false;
//             if ($(this).val().charAt(0) === " ") $(this).val($(this).val().trim());

//             if (!/^[a-zA-ZÀ-ÖØ-öø-ÿ\s]+$/.test($(this).val()))
//                 $(this).val(
//                     $(this)
//                         .val()
//                         .replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s]+/g, "")
//                 );

//             if ($(this).is("[maxlength]")) {
//                 let limit = parseInt($(this).attr("maxlength"));
//                 $(this).val($(this).val().slice(0, limit));
//             }
//         });

//     //Permitido "texto y números", si existe validar máximo de caracteres
//     $(this)
//         .find('[tipo="textoNum"],[tipo="alfanumerico"]')
//         .on("input", function () {
//             isValid = false;
//             if ($(this).val().charAt(0) === " ") $(this).val($(this).val().trim());

//             if (!/^[a-zA-Z0-9 ]*$/.test($(this).val()))
//                 $(this).val(
//                     $(this)
//                         .val()
//                         .replace(/[^a-zA-Z0-9 ]+/g, "")
//                 );
//             if ($(this).is("[maxlength]")) {
//                 let limit = parseInt($(this).attr("maxlength"));
//                 $(this).val($(this).val().slice(0, limit));
//             }
//         });

//     // Permitido "solo números enteros", si existe validar máximo de caracteres.
//     $(this)
//         .find('[tipo="numero"]')
//         .on("input", function () {
//             if (!/^\d+$/.test($(this).val()))
//                 $(this).val(
//                     $(this)
//                         .val()
//                         .replace(/[^0-9]/g, "")
//                 );
//             if ($(this).is("[maxlength]")) {
//                 let limit = parseInt($(this).attr("maxlength"));
//                 $(this).val($(this).val().slice(0, limit));
//             }
//         });

//     // Permitido "números enteros, decimales y negativos" con keyup, si existe, validar máximo de caracteres.
//     $(this)
//         .find('[tipo="cifra"]')
//         .on("input", function () {
//             if (!/^-?\d+(\.\d+)?$/.test($(this).val())) {
//                 $(this).val($(this).val().replace("--", "-"));
//                 $(this).val($(this).val().replace("..", "."));
//                 $(this).val($(this).val().replace(".-", "."));
//                 $(this).val($(this).val().replace("-.", "-0."));
//                 $(this).val($(this).val().replace(/^\./, "0."));
//                 $(this).val(
//                     $(this)
//                         .val()
//                         .replace(/[^0-9\.\-]/g, "")
//                 );
//                 $(this).val(
//                     $(this)
//                         .val()
//                         .replace(/(\.[^.]+)\./g, "$1")
//                 );
//                 $(this).val(
//                     $(this)
//                         .val()
//                         .replace(/(\d)\-/g, "$1")
//                 );
//             }
//         });

//     // Validar estructura de email
//     $(this)
//         .find('[type="email"], [tipo="correo"], [tipo="email"]')
//         .on("input", function () {
//             let expReg = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
//             $(this).removeClass("is-invalid");
//             if (!expReg.test($(this).val()) && $(this).val().trim() != "")
//                 $(this).addClass("is-invalid").next("span").removeClass("hide").html('<i class="icon-attention"></i> Ingrese un correo válido');
//             else $(this).removeClass("is-invalid").next("span").addClass("hide");

//             $(this).val().toLowerCase();
//         });

//     // Validar con trim que no haya espacios al principio o al final
//     $(this)
//         .find("input,textarea")
//         .on("blur", function () {
//             $(this).val($(this).val().trim());

//             if ($(this).hasClass("text-uppercase")) $(this).val($(this).val().toUpperCase());

//             if ($(this).hasClass("text-lowercase")) $(this).val($(this).val().toLowerCase());
//         });

//     // SUBMIT
//     let form = this;
//     form.on("submit", function (e) {
//         e.preventDefault();
//         let isValid = true;
//         $(this)
//             .find("[required]")
//             .each(function () {
//                 if ($(this).val() === "" || $(this).val() == "0" || $(this).val().length === 0 || $(this).val() == null) {
//                     isValid = false;
//                     let span = $("<span>", {
//                         class: "col-12 text-danger form-text hide",
//                         html: '<i class="icon-attention"></i> El campo es requerido',
//                     });

//                     if ($(this).parent().hasClass("input-group") === true) {
//                         if ($(this).parent().next("span.text-danger").length === 0) {
//                             $(this).parent().parent().append(span);
//                         }
//                     } else if ($(this).parent().hasClass("input-group") === false && $(this).siblings("span.text-danger").length === 0) {
//                         $(this).parent().append(span);
//                     }

//                     $(this).focus();
//                     $(this).addClass("is-invalid");

//                     $(this).siblings("span.text-danger").removeClass("hide").html('<i class="icon-attention"></i> El campo es requerido');
//                     if ($(this).parent().hasClass("input-group")) $(this).parent().next("span").removeClass("hide").html('<i class="icon-attention"></i> El campo es requerido');
//                 } else {
//                     $(this).removeClass("is-invalid");
//                     $(this).siblings("span.text-danger").addClass("hide");
//                     if ($(this).parent().hasClass("input-group")) $(this).parent().next("span").addClass("hide");
//                 }
//             });

//         if (isValid) {
//             let defaults = { tipo: "json" };
//             // Comvina opciones y defaults
//             let opts = $.extend(defaults, options);

//             let formData = new FormData(form[0]);

//             for (const key in opts) {
//                 if (key !== "tipo") {
//                     formData.append(key, opts[key]);
//                 }
//             }

//             if (opts.tipo === "text") {
//                 let valores = "";
//                 formData.forEach(function (valor, clave) {
//                     valores += clave + "=" + valor + "&";
//                 });
//                 if (typeof callback === "function") {
//                     // form.find(':submit').prop('disabled', true);
//                     callback(valores.slice(0, -1));
//                 }
//             } else if (opts.tipo === "json") {
//                 if (typeof callback === "function") {
//                     // form.find(':submit').prop('disabled', true);
//                     callback(formData);
//                 }
//             }
//         }
//     });
// };

function intervalDate(fechaInicio, fechaFinal) {
  const recorrido = [];
  const mes = [
    "",
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const dia = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

  fechaInicio = new Date(fechaInicio + " 00:00:00");
  fechaFinal = new Date(fechaFinal + " 00:00:00");

  while (fechaInicio <= fechaFinal) {
    let date = new Date(fechaInicio);
    let d = date.getDate();
    let m = date.getMonth() + 1;
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

function valueDateRange(elemento) {
  var picker = $(elemento).data("daterangepicker");

  if (picker) {
    return [
      picker.startDate.format("YYYY-MM-DD"),
      picker.endDate.format("YYYY-MM-DD"),
    ];
  } else {
    alert({
      icon: "error",
      title: "No se ha detectado un daterangepicker",
    });
    return null;
  }
}

// Simple form --
$.fn.simple_json_form = function (options) {
  return new Promise((resolve, reject) => {
    var prefijo = "txt";

    var defaults = {
      data    : [],
      clase   : "",
      type_btn: "btn",
      bs3     : false,
      name_fn : "EnviarDatos",
      icon    : "icon-dollar",
      type    : "text",
      color   : "primary",
      name_btn: "Aceptar",
      id_btn  : "btnAceptar",
    };

    var opts = $.fn.extend(defaults, options);

    // Creamos el formulario
    var div = $(this);

    // Recorremos el arreglo json
    for (const x of opts.data) {
      //Propiedades de los elementos
      var required = true;
      if (x.required == false) {
        required = false;
      }

      opt_class = opts.clase;

      add_class = x.class;

      var div_hijo = $("<div>", {
        class: `col mb-3 ${opt_class} ${add_class}`,
      });

      // Etiqueta del componente
      div_hijo.append(
        $(`<label>`, {
          class: "fw-bold ",
          html: x.lbl,
        })
      );

      // ¿Que tipo de componente vas a crear ?

      switch (x.opc) {
        case "input":
        case "Input":
          var align = "";
          if (x.tipo == "cifra" || x.tipo == "numero") {
            align = "text-end";
          }

          div_hijo.append(
            $(`<input>`, {
              class: `form-control input-sm ${align}   `,

              id: prefijo + x.id,
              tipo: x.tipo,
              name: x.id,
              required: required,
              value: x.value,
              atrr: x.atrr,
              placeholder: x.placeholder,
              type: x.type,
            })
          );

          break;

        case "input-file":
          div_hijo.append(
            $(`<input>`, {
              class: `form-control input-sm  `,
              id: prefijo + x.id,
              tipo: x.tipo,
              name: x.id,
              required: required,
              type: "file",
            })
          );
          break;

        case "btn-input-group":
          var inputGroup = $("<div>", {
            class: "input-group",
          });

          color_btn = "primary";

          if (x.btn_color) {
            color_btn = x.btn_color;
          }

          var btn_group = $("<a>", {
            class: "input-group-text btn-" + color_btn,
            onclick: x.fn + "",
          }).append(
            $("<i>", {
              class: "icon-plus pointer",
            })
          );

          inputGroup.append(btn_group);

          var select = $(`<select>`, {
            class: "form-control input-sm text-uppercase",
            id: prefijo + x.id,
            name: x.name,
            tipo: x.tipo,
            required: required,
          });

          select.html(
            '<option value="0" hidden selected > - Seleccionar - </option>'
          );

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

          inputGroup.append(select);

          div_hijo.append(inputGroup);

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
          let aux_name = x.id;
          if(x.name)
          aux_name = x.name;

          inputGroup.append(
            $(`<input >`, {
              class: `form-control input-sm ${align}`,
              id: prefijo + x.id,
              tipo: x.tipo,
              name: aux_name,
              required: required,
              value: x.value,
              type: val_type,
              placeholder: x.placeholder,
              disabled: x.disabled,
              disabled: x.disabled,
              cat: x.cat,
              readonly: x.readonly,

              onkeyup: x.onkeyup,
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

        case "input-calendar":
          var inputGroup = $("<div>", {
            class: "input-group date calendariopicker",
          });
          // Crear objeto input calendar

          inputGroup.append(
            $("<input>", {
              class: `select_input form-control input-sm text-end`,
              id: prefijo + x.id,
              tipo: x.tipo,
              name: x.id,
              required: required,
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

        case "select_input":
          var align = "";
          if (x.tipo == "Cifra") {
            align = "text-end";
          }

          var inputGroup = $("<div>", {
            class: "input-group date calendariopicker",
          });

          inputGroup.append(
            $("<input>", {
              class: `select_input form-control input-sm ${align}`,
              id: prefijo + x.id,
              tipo: x.tipo,
              name: x.id,
              required: required,
            })
          );

          var iconSpan = $("<span>", {
            class: "input-group-addon ",
            id: "basic-addon2",
          }).append(
            $("<label>", {
              class: "icon-calendar",
            })
          );

          inputGroup.append(iconSpan);

          div_hijo.append(inputGroup);

          break;

        case "Select":
        case "select":
          var select = $(`<select>`, {
            class: "form-control input-sm",
            id: prefijo + x.id,
            name: x.id,
            required: required,
            onchange: x.onchange,
          });

          //   select.html(
          //     '<option value="0" hidden  > - Seleccionar - </option>'
          //   );

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

        case "textarea":
          div_hijo.append(
            $("<textarea>", {
              class: `form-control resize`,
              id: prefijo + x.id,
              tipo: x.tipo,
              name: x.id,
              text: x.value,
              placeholder: x.placeholder,
              cols: x.col,
              rows: x.row,
            })
          );

          break;

        case "select2-input":
          var select = $("<select>", {
            class: "form-control input-sm ",
            id: prefijo + x.id,
            name: x.id,
          });

          $.each(x.data, function (index, item) {
            option = item.id;

            select.append(
              $("<option>", {
                value: option,
                text: item.valor,
                selected: bandera,
              })
            );
          });

          select.css("width", "100%");

          $(window).on("resize", () => {
            select.next("span.select2").css("width", "100%");
          });

          div_hijo.append(select);

          break;

        case "btn":
          if (x.color_btn) {
            
            color = x.color_btn;

          } else {
            color = opts.color_default;
          }
           
          class_btn = `btn btn-outline-${color} col-12 mt-4`;
          if(x.btn_class){
            class_btn = x.btn_class;
          }

          var _btn = $("<button>", {
            class: class_btn,
            text: x.text,
            type: "button",
            id: x.id,
            onclick: x.fn,
          });
          div_hijo.append(_btn);

        break;




        case "bd-callout":
          // Eliminar el contenido del div_hijo para este case
          div_hijo.html(
            $(`<label>`, {
              html: "",
            })
          );

          var div_callout = $("<div>", {
            class: `bd-callout bd-callout-${x.color} d-flex p-2 bd-highlight align-items-center m-0`,
          });

          div_callout.append(
            $(`<label>`, {
              class: "fw-bold",
              html: x.lbl,
            })
          );

          div_callout.append(
            $(`<span>`, {
              class: `fw-bold fs-2 ps-2 pe-2`,
              id: prefijo + x.id,
              html: x.value,
            })
          );

          //AGREGA EL ÚLTIMO ELEMENTO (%) A LA ETIQUETA LABEL
          div_callout.append(
            $(`<label>`, {
              class: "fw-bold",
              html: "%",
            })
          );

          div_hijo.append(div_callout);

          break;
      }
      
      div.append(div_hijo);
    }

    if (opts.type_btn == "btn") {
      if (opts.bs3 == false) {
        //   col-12 d-flex justify-content-center
        // Configuracion de bootstrap 5

        var div_btn = $("<div>", {
          class: `col mb-3`,
        });

        var btn_submit = $("<button>", {
          class: "btn btn-primary mb-3 bt-sm col-12 mt-4",
          text: opts.name_btn,
          id: opts.id_btn,
          type: "submit",
        });

        div_btn.append(btn_submit);
        div.append(div_btn);
      } else {
        // Configuracion bootstrap 3
        var div_btn = $("<div>", {
          class: `text-center`,
        });

        var btn_submit = $("<button>", {
          class: "btn btn-primary bt-sm col-12",
          text: "Aceptar",
          id: "btnAceptar",
          type: "submit",
        });

        div_btn.append(btn_submit);
        div.append(div_btn);
      }
    } else if (opts.type_btn == "simple_btn") {
      // // Configuracion de bootstrap 5
      // // var div_btn = $("<div>", {
      // //   class: `col-12 d-flex justify-content-center`,
      // // });

      // var div_btn = $("<div>", {
      //   class: `col-12 d-flex justify-content-center mb-3 flex-wrap`,
      // });

      // var btn_submit = $("<a>", {
      //   class: "btn btn-primary mb-3 bt-sm col-12 mt-4",
      //   text: opts.name_btn,
      //   id: opts.id_btn,
      //   onclick: opts.name_fn + "()",
      // });

      // div_btn.append(btn_submit);
      // div.append(div_btn);

      var div_btn = $("<div>", {
        class: `col mb-3`,
      });

      var btn_submit = $("<button>", {
        class: "btn btn-primary mb-3 bt-sm col-12 mt-4",
        text: opts.name_btn,
        id: "btnAceptar",
        type: "button",
        onclick: opts.name_fn + "()",
      });

      div_btn.append(btn_submit);
      div.append(div_btn);
    } else if (opts.type_btn == "two_btn") {
      var div_btn = $("<div>", {
        class: `col-12 col-md-12 d-sm-flex justify-content-between`,
      });

      var btn_submit = $("<button>", {
        class: "btn btn-primary mb-3 bt-sm col-12 col-sm-5 col-md-5",
        text: "Aceptar",
        id: "btnAceptar",
        type: "submit",
      });

      var btn_cancel = $("<button>", {
        class:
          "btn btn-outline-danger mb-3 bt-sm col-12 col-sm-5 col-md-5 bootbox-close-button",
        text: "Cancelar",
        id: "btnCancelar",
        type: "button",
      });

      div_btn.append(btn_submit);
      div_btn.append(btn_cancel);

      div.append(div_btn);


      


    } else {
    }
    resolve();
  });
};


function unfold(id) {
  $(".unfold" + id).toggleClass("d-none");
  $(".ico" + id).toggleClass("icon-right-open");
  $(".ico" + id).toggleClass("icon-down-open");
}

$.fn.get_form = function (options) {
  
  var defaults = {
    tipo: "",
    name_opc: "content-data",
  };

  // Carga opciones por defecto
  var opts = $.fn.extend(defaults, options);

  url = "";

  var formulario = this[0];
  var formData = new FormData(formulario);
  var arregloValores = {};

  formData.forEach(function (valor, clave) {
    url = url + clave + "=" + valor + "&";
  });

  url = url + "opc=" + opts.name_opc;
  return url;
};


// FORMATEAR CIFRAS NÚMERICAS
$.fn.number_format = function (decimales, puntoDecimal, miles) {
    let num = parseFloat($(this).val());

    num = Number(num || 0).toFixed(decimales);
    puntoDecimal = puntoDecimal || ".";
    miles = miles || ",";

    var partes = num.toString().split(".");
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, miles);

    $(this).val(partes.join(puntoDecimal));
};

function range_picker_now(id) {
  rangepicker(
    "#" + id,
    true,
    moment(),
    moment(),
    "",
    "",
    function (startDate, endDate) {
      date1 = startDate.format("YYYY/MM/DD");
      date2 = endDate.format("YYYY/MM/DD");
    }
  );
}

