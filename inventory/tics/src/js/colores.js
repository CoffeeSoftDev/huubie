window.modal = window.modal || "";
$(function () {
    let datos = new FormData();
    datos.append("opc", "listUDN");
    send_ajax(datos, "ctrl/ctrl-colores.php").then((data) => {
        let option = "";
        data.forEach((p) => {
            option += `<option value="${p.id}">${p.valor}</option>`;
        });
        $("#cbUDN").html(option);
    });

    if (typeof moment === "function") {
        rangepicker(
            "#iptDate",
            false,
            moment().subtract(1, "days"),
            moment(),
            {
                Hoy: [moment(), moment()],
                Ayer: [
                    moment().subtract(1, "days"),
                    moment().subtract(1, "days"),
                ],
                "Última semana": [moment().subtract(6, "days"), moment()],
                "Mes actual": [
                    moment().startOf("month"),
                    moment().endOf("month"),
                ],
                "MEs anterior": [
                    moment().subtract(1, "month").startOf("month"),
                    moment().subtract(1, "month").endOf("month"),
                ],
            },
            true,
            function (startDate, endDate) {
                date1 = startDate.format("YYYY/MM/DD");
                date2 = endDate.format("YYYY/MM/DD");
            }
        );

        $("#iptDate")
            .next("span")
            .on("click", () => {
                $("#iptDate").click();
            });
    } else {
        Swal.fire({
            title:"404 Not Found", 
            text:"Moment.js",
            icon:"error",
            width: 300,
            showConfirmButton:false,
            timer:1500
        });
    }

    $("#btnOk").on("click", () => {
        swal_question("¿Esta seguro de realizar esta acción?").then(
            (result) => {
                if (result.isConfirmed) {
                    //let datos = new FormData();
                    //datos.append('opc','');
                    //send_ajax(datos,ctrl).then((data)=>{
                    //console.log(data);
                    swal_success();
                    //});
                }
            }
        );
    });
});

function updateModal(id, title) {
    modal = bootbox.dialog({
        title: ` EDITAR "${title.toUpperCase()}" `,
        message: `
                          <div class="col-12 mb-3">
                              <label for="iptModalLabel" class="form-label fw-bold"> LABEL</label>
                              <input type="text" class="form-control" id="iptModalLabel" value="${title}">
                              <span class="form-text text-danger hide">
                                  <i class="icon-warning-1"></i>
                                  El campo es requerido.
                              </span>
                          </div>
                          <div class="col-12 mb-3 d-flex justify-content-between">
                              <button  class="btn btn-primary col-5" onclick="update(${id},'#iptModalLabel');">Actualizar</button>
                              <button class="btn btn-outline-danger col-5 offset-2 bootbox-close-button col-5" id="btnCerrarModal">Cancelar</button>
                          </div>
                          `,
    });
}

function update(id, input) {
    let INPUT = $(input);
    if (!INPUT.val()) {
        INPUT.focus();
        INPUT.addClass("is-invalid");
        INPUT.next("span").removeClass("hide");
    } else {
        INPUT.removeClass("is-invalid");
        INPUT.next("span").addClass("hide");
        //let datos = new FormData();
        //datos.append('opc', 'edit');
        //send_ajax(datos, ctrlUser).then((data) => {
        //    console.log(data);
        //    if (data === true) {
        $("#btnCerrarModal").click();
        swal_success();
        //   }
        //});
    }
}

function toggleStatus(id) {
    const BTN = $("#btnStatus" + id);
    const ESTADO = BTN.attr("estado");

    let estado = 0;
    let iconToggle = '<i class="icon-toggle-off"></i>';
    let question = "¿DESEA DESACTIVARLO?";
    if (ESTADO == 0) {
        estado = 1;
        iconToggle = '<i class="icon-toggle-on"></i>';
        question = "¿DESEA ACTIVARLO?";
    }

    swal_question(question).then((result) => {
        if (result.isConfirmed) {
            //let datos = new FormData();
            //datos.append('opc','');
            //send_ajax(datos,ctrl).then((data)=>{
            // console.log(data);
            BTN.html(iconToggle);
            BTN.attr("estado", estado);
            //});
        }
    });
}
