window.ctrlDir = window.ctrlDir || "ctrl/ctrl-directorios.php";
window.lsDirectorios = window.lsDirectorios || [];
window.lsModulos = window.lsModulos || [];
window.lsSubmodulos = window.lsSubmodulos || [];

$(function () {
    // Obtener las listas de módulos y submódulos
    tableDirectory();
    listas().then(function () {
        llenarModulos();
    });

    // Buscar submodulos cuando cambia el valor del módulo
    $("#cbModulos").on("change", function () {
        // Obtener submodulos existentes
        let options = buscarSubmodulos();

        // Mostrar submodulos
        $("#cbSubModulo").option_select({
            data: options,
            placeholder: "- Seleccionar -",
        });

        // [disabled]  true o false
        if (options.length > 0) $("#cbSubModulo").removeAttr("disabled");
        else $("#cbSubModulo").attr("disabled", "disabled");
    });

    $("#newModulo")
        .on("click", () => nuevoModulo())
        .title("Crear nuevo módulo");

    $("#newSubmodulo")
        .on("click", () => nuevoSubModulo())
        .title("Crear nuevo submódulo");

    $("#form__directorios").validation_form({ opc: "newDirectory" }, (datos) => {
        const IPT = $("#iptDirectorio");
        let busqueda = buscarDirectorio($("#cbModulos").val(), $("#cbSubModulo").val());

        let encontrado = busqueda.find((obj) => obj.directorio.toUpperCase() === IPT.val().toUpperCase());

        if (encontrado === undefined) {
            send_ajax(datos, ctrlDir).then((data) => {
                if (data === true) {
                    alert({
                        title: "Se ha creado un nuevo directorio.",
                        text: "Se actualizara la página para mostrar los cambios",
                        btn1: true,
                    }).then((data) => {
                        location.reload();
                    });
                } else {
                    console.error(data);
                }
            });
        } else {
            IPT.focus().addClass("is-invalid");
            IPT.next("span").removeClass("hide").html('<i class="icon-attention"></i> Este directorio ya existe.');
        }
    });
});
// lista de de modulos y submodulos
function listas() {
    return new Promise(function (resolve) {
        let datos = new FormData();
        datos.append("opc", "listas");

        send_ajax(datos, ctrlDir).then((data) => {
            lsModulos = data.modulos;
            lsSubmodulos = data.submodulos;
            resolve();
        });
    });
}
// Llenar <select> de modulos y submodulos
function llenarModulos() {
    $("#cbModulos").option_select({
        data: lsModulos,
        placeholder: "- Seleccionar -",
    });

    let options = buscarSubmodulos();

    $("#cbSubModulo").option_select({
        data: options,
        placeholder: "- Seleccionar -",
    });

    if (options.length > 0) $("#cbSubModulo").removeAttr("disabled");
    else $("#cbSubModulo").attr("disabled", "disabled");
}
// Se busca que submodulos tienen pertenencia
function buscarSubmodulos(idM) {
    let options = lsSubmodulos.filter(function (obj) {
        if (idM === undefined) return obj.idM == $("#cbModulos").val();
        else return obj.idM == idM;
    });
    return options;
}
function buscarDirectorio(idM, idS) {
    let options = [];

    lsDirectorios.forEach(function (obj) {
        if (obj.id == idM) {
            if (idS !== undefined && idS !== "" && idS !== "0") {
                let submodulo = obj.submodulos.find(function (sub) {
                    return sub.id == idS;
                });

                if (submodulo) {
                    options = submodulo.directorios;
                }
            } else {
                options = obj.directorios;
            }
        }
    });

    return options;
}

// Mostrar u ocultar submódulos y directorios.
function toggleTr(IDM, IDS) {
    if (IDM != "") {
        $(".trM" + IDM).toggleClass("hide");
        $(".trDir" + IDM).addClass("hide");
    }

    if (IDS != "") $(".trS" + IDS).toggleClass("hide");
}
// Mostramos los directorios existentes
function tableDirectory() {
    let datos = new FormData();
    datos.append("opc", "directoryTable");
    send_ajax(datos, ctrlDir, "#tbDatos").then((data) => {
        lsDirectorios = data;
        let tbody = "";
        data.forEach((m) => {
            const IDM = m.id;
            const MODULO = m.modulo;
            tbody += `
            <tr class="pointer" onClick="toggleTr(${IDM})">
                <th colspan="3" class="text-center">${MODULO} <i class="icon-down-dir"></i></th>
            </tr>
            `;

            if (m.submodulos.length > 0) {
                m.submodulos.forEach((s) => {
                    const IDS = s.id;
                    const SUBMODULO = s.submodulo;

                    tbody += `
                    <tr class="trSub trM${IDM} hide pointer" onClick="toggleTr('',${IDS})">
                        <td colspan="3" class="text-center text-capitalize">${SUBMODULO} <i class="icon-down-dir"></i></td>
                    </tr>
                    `;

                    s.directorios.forEach((d) => {
                        const ID = d.id;
                        const ESTADO = d.estado;
                        const BLOCK = d.validacion;
                        const EYE = d.oculto;
                        const ORDEN = d.orden;
                        const DIRECTORIO = d.directorio;

                        let iconBlock = '<i class="icon-lock-open"></i>';
                        let blockClick = `onClick="blockDirectory(${ID},${BLOCK})"`;
                        let btnEdit = `<button type="button" class="btn btn-outline-primary" id="btnEdit${ID}" onClick="modalEditarDirectorio(${ID}, ${IDM}, ${IDS}, '${DIRECTORIO}')">
                                            <i class="icon-pencil"></i>
                                        </button>`;
                        let btnDelete = `
                                    <button type="button" title="Eliminar Directorio" class="btn btn-outline-danger" id="btnDel${ID}" onClick="delDirectory(${ID})">
                                        <i class="icon-trash"></i>
                                    </button>`;

                        if (BLOCK == 1) {
                            iconBlock = '<i class="icon-lock"></i>';
                            btnEdit = "";
                            btnDelete = "";
                        }

                        let iconEye = '<i class="icon-eye"></i>';
                        if (EYE == 0) {
                            iconEye = '<i class="icon-eye-off"></i>';
                        }

                        let iconToggle = '<i class="icon-toggle-on"></i>';
                        if (ESTADO == 0) iconToggle = '<i class="icon-toggle-off"></i>';

                        tbody += `
                        <tr class="trDir trDir${IDM} trS${IDS} hide pointer" id="dir${ID}">
                            <td class="tb_input">
                                <input type="text" id="order${ID}" value="${ORDEN}" onBlur="changeOrder(${ID})"/>
                            </td>
                            <td>${DIRECTORIO}</td>
                            <td class="text-end">
                                <button type="button" title="Ver directorio" class="btn btn-outline-info" onClick="redireccion('${d.ruta}')">
                                    <i class="icon-link-3"></i>
                                </button>
                                <button type="button" title="Mostrar en sidebar" class="btn btn-outline-success" visible="${EYE}" id="btnEye${ID}" onClick="visibleSidebar(${ID},'${DIRECTORIO}');">
                                ${iconEye}
                                </button>
                                ${btnEdit}
                                <button type="button" class="btn btn-outline-danger" estado="${ESTADO}" id="btnToggle${ID}" onClick="statusDirectorio(${ID},'${DIRECTORIO}')">
                                    ${iconToggle}
                                </button>
                                <button type="button" class="btn btn-outline-disabled" id="btnBlock${ID}" ${blockClick}>
                                    ${iconBlock}
                                </button>
                                ${btnDelete}
                            </td>
                        </tr>
                        `;
                    });
                });
            }

            if (m.directorios.length > 0) {
                m.directorios.forEach((d) => {
                    const ID = d.id;
                    const ESTADO = d.estado;
                    const BLOCK = d.validacion;
                    const EYE = d.oculto;
                    const DIRECTORIO = d.directorio;
                    const ORDEN = d.orden;

                    let iconBlock = '<i class="icon-lock-open"></i>';
                    let blockClick = `onClick="blockDirectory(${ID},${BLOCK})"`;
                    let btnEdit = `<button type="button" class="btn btn-outline-primary" id="btnEdit${ID}" onClick="modalEditarDirectorio(${ID}, ${IDM}, '', '${DIRECTORIO}')">
                                            <i class="icon-pencil"></i>
                                        </button>`;
                    let btnDelete = `
                    <button type="button" title="Eliminar Directorio" class="btn btn-outline-danger" id="btnDel${ID}" onClick="delDirectory(${ID})">
                        <i class="icon-trash"></i>
                    </button>`;

                    if (BLOCK == 1) {
                        iconBlock = '<i class="icon-lock"></i>';
                        btnEdit = "";
                        btnDelete = "";
                    }

                    let iconEye = '<i class="icon-eye"></i>';
                    if (EYE == 0) {
                        iconEye = '<i class="icon-eye-off"></i>';
                    }

                    let iconToggle = '<i class="icon-toggle-on"></i>';
                    if (ESTADO == 0) iconToggle = '<i class="icon-toggle-off"></i>';

                    tbody += `
                    <tr class="trDir trM${IDM} hide pointer" id="dir${ID}">
                        <td class="tb_input">
                            <input type="text" id="order${ID}" value="${ORDEN}" onBlur="changeOrder(${ID})"/>
                        </td>
                        <td>${DIRECTORIO}</td>
                        <td class="text-end">
                            <button type="button" title="Ver directorio" class="btn btn-outline-info" onClick="redireccion('${d.ruta}')">
                                <i class="icon-link-3"></i>
                            </button>
                            <button type="button" title="Mostrar en sidebar" class="btn btn-outline-success" visible="${EYE}" id="btnEye${ID}" onClick="visibleSidebar(${ID},'${DIRECTORIO}');">
                            ${iconEye}
                            </button>
                            ${btnEdit}
                            <button type="button" title="Desactivar" class="btn btn-outline-warning" estado="${ESTADO}" id="btnToggle${ID}" onClick="statusDirectorio(${ID},'${DIRECTORIO}')">
                                ${iconToggle}
                            </button>
                            <button type="button" title="Validar" class="btn btn-outline-disabled" id="btnBlock${ID}" ${blockClick}>
                                ${iconBlock}
                            </button>
                            ${btnDelete}
                        </td>
                    </tr>
                    `;
                });
            }
        });

        $("#tbDatos").html(`
        <table class="table" id="tbDirectory">
            <tbody>
                ${tbody}
            </tbody>
        </table>
        `);
    });
}
// Mostrar u ocultar en el sidebar
function visibleSidebar(id, directorio) {
    const BTN = $("#btnEye" + id);
    const HIDDEN = parseInt(BTN.attr("visible"));
    let visible = 1;
    let icon = '<i class="icon-eye"></i>';
    let question = `¿DESEA MOSTRAR "${directorio.toUpperCase()}"?`;

    if (HIDDEN === 1) {
        question = `¿DESEA OCULTAR "${directorio.toUpperCase()}"?`;
        visible = 0;
        icon = '<i class="icon-eye-off"></i>';
    }

    alert({
        icon: "question",
        title: question,
        text: "Esto afectara el menú y la forma de acceder al directorio.",
    }).then((result) => {
        if (result.isConfirmed) {
            let datos = new FormData();
            datos.append("opc", "visibleDirectory");
            datos.append("id", id);
            datos.append("visible", visible);
            send_ajax(datos, ctrlDir).then((data) => {
                if (data === true) {
                    // BTN.attr("visible", visible);
                    // BTN.html(icon);
                    location.reload();
                }
            });
        }
    });
}
// Creación de módulos, submódulos y directorios
function nuevoModulo() {
    bootbox
        .dialog({
            title: `NUEVO MÓDULO`,
            message: `
            <form id="modalForm" novalidate>
                <div class="col-12 mb-3">
                    <label for="iptModulo" class="fw-bold">Módulo</label>
                    <input type="text" class="form-control text-uppercase" autocomplete="off" name="modulo" id="iptModulo" tipo="texto" required>
                    <span class="form-text text-danger hide">
                        <i class="icon-warning-1"></i>
                        El campo es requido.
                    </span>
                </div>
                <div class="col-12 mb-3 d-flex justify-content-between">
                    <button type="submit" class="btn btn-primary col-5">Guardar</button>
                    <button type="button" class="btn btn-outline-danger bootbox-close-button col-5">Cancelar</button>
                </div>
            </form>
        `,
        })
        .on("shown.bs.modal", function () {
            // Validamos el formulario
            $("#modalForm").validation_form({ opc: "newModule" }, (datos) => {
                if (datos !== undefined) {
                    const IPT = $("#iptModulo");
                    // Existe el modulo
                    let encontrado = lsModulos.find((obj) => obj.valor === IPT.val().toUpperCase());

                    if (encontrado === undefined) {
                        send_ajax(datos, ctrlDir).then((data) => {
                            if (data === true) {
                                listas().then(function () {
                                    llenarModulos();
                                });
                                $(".bootbox-close-button").click();
                                alert();
                            }
                        });
                    } else {
                        //Ya existe
                        IPT.addClass("is-invalid");
                        IPT.next("span").removeClass("hide");
                        IPT.next("span").html('<i class="icon-attention"></i> Este módulo ya existe');
                    }
                }
            });
        });
}
function nuevoSubModulo() {
    bootbox
        .dialog({
            title: `NUEVO SUBMÓDULO`,
            message: `
            <form id="modalForm" novalidate>
                <div class="col-12 mb-3">
                    <label for="cbModalModulo" class="fw-bold">Módulo</label>
                    <select class="form-select" name="modulo" id="cbModalModulo"></select>
                </div>
                <div class="col-12 mb-3">
                    <label for="iptSubmodulo" class="fw-bold">Submódulo</label>
                    <input type="text" class="form-control text-uppercase" autocomplete="off" name="submodulo" id="iptSubmodulo" tipo="texto" required>
                    <span class="form-text text-danger hide">
                        <i class="icon-warning-1"></i>  
                        El campo es requido.
                    </span>
                </div>
                <div class="col-12 mb-3 d-flex justify-content-between">
                    <button type="submit" class="btn btn-primary col-5">Guardar</button>
                    <button type="button" class="btn btn-outline-danger bootbox-close-button col-5">Cancelar</button>
                </div>
            </form>`,
        })
        .on("shown.bs.modal", function () {
            $("#cbModalModulo").option_select({ data: lsModulos });

            let optSubmodulo = [];
            $("#cbModalModulo").on("change", function () {
                optSubmodulo = buscarSubmodulos($(this).val());
            });

            // Validamos el formulario
            $("#modalForm").validation_form({ opc: "newSubmodule" }, (datos) => {
                if (datos !== undefined) {
                    const IPT = $("#iptSubmodulo");
                    // Existe el submodulo
                    let encontrado = optSubmodulo.find((obj) => obj.valor === IPT.val().toUpperCase());

                    if (encontrado === undefined) {
                        send_ajax(datos, ctrlDir).then((data) => {
                            if (data === true) {
                                listas().then(function () {
                                    llenarModulos();
                                });
                                $(".bootbox-close-button").click();
                                alert();
                            }
                        });
                    } else {
                        //Ya existe
                        IPT.addClass("is-invalid");
                        IPT.next("span").removeClass("hide");
                        IPT.next("span").html('<i class="icon-attention"></i> Este submódulo ya existe');
                    }
                }
            });
        });
}
// Editar Directorio
function modalEditarDirectorio(id, idM, idS, directorio) {
    alert({
        icon: "question",
        title: "¿Realmente desea modificar este directorio?",
        text: "Esto puede afectar el funcionamiento correcto del ERP.",
    }).then((result) => {
        if (result.isConfirmed) {
            bootbox
                .dialog({
                    title: `EDITAR DIRECTORIO`,
                    message: `
                    <form id="modalForm" novalidate>
                        <div class="col-12 mb-3">
                            <label for="cbModalModulo" class="fw-bold">Módulo</label>
                            <select class="form-select text-uppercase" name="modulo" id="cbModalModulo"></select>
                        </div>
                        <div class="col-12 mb-3">
                            <label for="cbModalSubModulo" class="fw-bold">Submódulo</label>
                            <select class="form-select text-uppercase" name="submodulo" id="cbModalSubModulo" disabled></select>
                        </div>
                        <div class="col-12 mb-3">
                            <label for="iptModalDirectorio" class="fw-bold">Directorio</label>
                            <input type="text" class="form-control" name="directorio" id="iptModalDirectorio" autocomplete="off" value="${directorio}">
                            <span class="form-text text-danger hide">
                                <i class="icon-warning-1"></i>
                                Campo requerido.
                            </span>
                        </div>
                        <div class="col-12 mb-3 d-flex justify-content-between">
                            <button type="submit" class="btn btn-primary col-5">Actualizar</button>
                            <button type="button" class="btn btn-outline-danger bootbox-close-button col-5">Cancelar</button>
                        </div>
                    </form>
                `,
                })
                .on("shown.bs.modal", function () {
                    // RELLENAR MODULOS Y SELECCIONAR
                    const MODULO = $("#cbModalModulo");
                    MODULO.option_select({ data: lsModulos });
                    $('#cbModalModulo option[value="' + idM + '"]').prop("selected", true);

                    // RELLENAR SUBMODULOS Y SELECCIONAR
                    const SUBMODULO = $("#cbModalSubModulo");
                    let optSubmodulos = buscarSubmodulos(idM);
                    SUBMODULO.option_select({
                        data: optSubmodulos,
                        placeholder: " - Seleccionar -",
                    });
                    $('#cbModalSubModulo option[value="' + idS + '"]').prop("selected", true);
                    if (optSubmodulos.length > 0) SUBMODULO.prop("disabled", false);
                    else SUBMODULO.prop("disabled", true);

                    // BUSCAR SUBMODULOS
                    MODULO.on("change", function () {
                        let optSubmodulos = buscarSubmodulos(idM);

                        optSubmodulos = buscarSubmodulos($(this).val());
                        SUBMODULO.option_select({
                            data: optSubmodulos,
                            placeholder: " - Seleccionar -",
                        });

                        if (optSubmodulos.length > 0) SUBMODULO.prop("disabled", false);
                        else SUBMODULO.prop("disabled", true);
                    });

                    $("#modalForm").validation_form({ opc: "editDirectory", id: id }, (datos) => {
                        const IPT = $("#iptModalDirectorio");

                        let busqueda = buscarDirectorio(MODULO.val(), SUBMODULO.val());

                        let encontrado = busqueda.find((obj) => obj.directorio.toUpperCase() === IPT.val().toUpperCase());

                        if (encontrado === undefined) {
                            send_ajax(datos, ctrlDir).then((data) => {
                                if (data === true) {
                                    $(".bootbox-close-button").click();
                                    tableDirectory();
                                    alert({
                                        icon: "success",
                                        title: "El directorio se modificó con éxito.",
                                        text: "Recuerda revisar los archivos, las rutas podrían haber cambiado y el sistema podría no funcionar correctamente.",
                                        btn1: true,
                                    });
                                } else {
                                    console.error(data);
                                }
                            });
                        } else {
                            IPT.focus().addClass("is-invalid");
                            IPT.next("span").removeClass("hide").html('<i class="icon-attention"></i> Este directorio ya existe.');
                        }
                    });
                });
        }
    });
}
// Activar o desactivar el directorio
function statusDirectorio(id, directorio) {
    const BTN = $("#btnToggle" + id);
    const STATUS = parseInt(BTN.attr("estado"));
    let estado = 1;
    let icon = '<i class="icon-toggle-on"></i>';
    let question = `¿DESEA ACTIVAR EL DIRECTORIO "${directorio.toUpperCase()}"?`;

    if (STATUS === 1) {
        question = `¿REALMENTE DESEA DESACTIVAR EL DIRECTORIO "${directorio.toUpperCase()}"?`;
        estado = 0;
        icon = '<i class="icon-toggle-off"></i>';
    }

    swal_question(question).then((result) => {
        if (result.isConfirmed) {
            let datos = new FormData();
            datos.append("opc", "statusDirectory");
            datos.append("id", id);
            datos.append("status", estado);
            send_ajax(datos, ctrlDir).then((data) => {
                if (data) {
                    BTN.attr("estado", estado);
                    BTN.html(icon);
                }
            });
        }
    });
}
// Bloquear el directorio
function blockDirectory(id, block) {
    let question = "bloquear";
    let infor = "Al bloquear este directorio evitará que se pueda editar.";

    if (block == 1) {
        question = "desbloquear";
        infor = "";
    }

    alert({
        icon: "question",
        title: `¿Realmente deseas ${question} este directorio?`,
        text: infor,
        btn1: true,
    }).then((result) => {
        if (result.isConfirmed) {
            let datos = new FormData();
            datos.append("opc", "blockDirectory");
            datos.append("id", id);
            datos.append("block", block);
            send_ajax(datos, ctrlDir).then((data) => {
                if (data === true) {
                    $("#btnEdit" + id).remove();
                    $("#btnDel" + id).remove();
                    $("#btnBlock" + id).removeAttr("onClick");
                    $("#btnBlock" + id).attr("onClick", "blockDirectory(" + id + ",1)");
                    $("#btnBlock" + id).html('<i class="icon-lock"></i>');
                    if (block == 1) tableDirectory();
                }
            });
        }
    });
}
// Eliminar el directorio de la BD y las rutas fisicas
function delDirectory(id) {
    alert({
        icon: "question",
        title: "¿ELIMINAR EL DIRECTORIO PERMANENTEMENTE?",
        text: "No se podrá recuperar, afectará el funcionamiento del módulo.",
    }).then((result) => {
        if (result.isConfirmed) {
            let datos = new FormData();
            datos.append("opc", "delDirectory");
            datos.append("id", id);
            send_ajax(datos, ctrlDir).then((data) => {
                if (data == true) {
                    $("#dir" + id).remove();
                    alert();
                }
            });
        }
    });
}
// Cambiar el orden de los directorios
function changeOrder(id) {
    let datos = new FormData();
    datos.append("opc", "orderDirectory");
    datos.append("id", id);
    datos.append("order", $("#order" + id).val());

    send_ajax(datos, ctrlDir);
}
