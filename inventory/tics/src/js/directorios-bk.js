window.ctrlDir= window.ctrlDir || "ctrl/ctrl-directorios.php";
window.submodulos = window.submodulos || "";
window.modulos = window.modulos || "";
window.perfiles = window.perfiles || [];
window.modal = window.modal || "";

$(document).ready(function () {
    tableDirectory();
    listModulos();
    listSubmodulos();
    const CBMODULO = $("#cbModulos");
    const CBSUBMODULO = $("#cbSubModulo");
    const IPTDIRECTORIO = $("#iptDirectorio");
    // BOTÓN AGREGAR MODULOS

    CBMODULO.siblings("button").on("click", function () {
        modalModulo();
    });

    // BUSCAR SUBMODULOS A PARTIR DEL MODULO
    CBMODULO.on("change", function () {
        CBMODULO.removeClass("is-invalid");
        CBMODULO.parent().next("span").addClass("hide");
        let option =
            '<option value="0" hidden selected>SELECCIONAR SUBMÓDULO</option>';
        CBSUBMODULO.attr("disabled", "disabled");
        CBSUBMODULO.addClass("disabled");

        submodulos.forEach((s) => {
            if (s.idM === CBMODULO.val()) {
                option += `<option value="${s.idS}">${s.sub}</option>`;
                CBSUBMODULO.removeAttr("disabled");
                CBSUBMODULO.removeClass("disabled");
            }
        });

        CBSUBMODULO.html(option);
    });

    //BOTÓN AGREGAR SUBMODULOS
    CBSUBMODULO.siblings("button").on("click", function () {
        modalSubmodulo();
    });

    IPTDIRECTORIO.on("keyup", function () {
        validarLetras("#iptDirectorio");
    });

    $("#form__directorios").on("submit", function (e) {
        e.preventDefault();
        if (CBMODULO.val() == 0) {
            CBMODULO.addClass("is-invalid");
            CBMODULO.parent().next("span").removeClass("hide");
            CBMODULO.parent().next("span").html(`
                <i class="icon-warning-1"></i>
                Campo requerido.
            `);
        } else if (!IPTDIRECTORIO.val()) {
            IPTDIRECTORIO.addClass("is-invalid");
            IPTDIRECTORIO.next("span").removeClass("hide");
            IPTDIRECTORIO.next("span").html(`
                <i class="icon-warning-1"></i>
                Campo requerido.
            `);
        } else if (perfiles.some((e) => e.toUpperCase() === IPTDIRECTORIO.val().toUpperCase())) {
            IPTDIRECTORIO.addClass("is-invalid");
            IPTDIRECTORIO.next("span").removeClass("hide");
            IPTDIRECTORIO.next("span").html(`
                <i class="icon-warning-1"></i>
                El perfil ya existe, intentar con otro nombre.
            `);
        } else {
            swal_question("¿Todos los campos son correctos?").then((result) => {
                if (result.isConfirmed) {
                    let datos = new FormData();
                    datos.append("opc", "newDirectory");
                    datos.append("directorio", IPTDIRECTORIO.val());
                    datos.append("modulo", CBMODULO.val());
                    datos.append("submodulo", CBSUBMODULO.val());
                    send_ajax(datos, ctrlDir).then((data) => {
                        if (data === true) {
                            swal_success();
                            tableDirectory();
                            listModulos();
                            listSubmodulos();
                            IPTDIRECTORIO.val("");
                        }
                    });
                }
            });
        }
    });
});
// FUNCIONES DE CARGA INICIAL
function listModulos() {
    const CBMODULO = $("#cbModulos");
    const CBSUBMODULO = $("#cbSubModulo");
    let datos = new FormData();
    datos.append("opc", "listModules");
    send_ajax(datos, ctrlDir).then((data) => {
        modulos = data;
        let option =
            '<option value="0" hidden selected>SELECCIONAR MÓDULO</option>';
        data.forEach((m) => {
            option += `<option value="${m.idM}">${m.modulo}</option>`;
        });
        CBMODULO.html(option);
        CBSUBMODULO.html(
            '<option value="0" hidden selected>SELECCIONAR SUBMÓDULO</option>'
        );
    });
}
function listSubmodulos() {
    datos = new FormData();
    datos.append("opc", "listSubmodules");
    send_ajax(datos, ctrlDir).then((data) => {
        submodulos = data;
    });
}
function tableDirectory() {
    let datos = new FormData();
    datos.append("opc", "directoryTable");
    tb_ajax(datos, ctrlDir, "#tbDatos").then((data) => {
        console.log(data);
        let listDirectorios = "";
        let tbody = "";
        data.forEach((m) => {
            const IDM = m.id;
            const MODULO = m.modulo;
            tbody += `
            <tr class="pointer" onClick="toggleTr(${IDM})">
                <th colspan="2" class="text-center">${MODULO} <i class="icon-down-dir"></i></th>
            </tr>
            `;

            if (m.submodulos.length > 0) {
                m.submodulos.forEach((s) => {
                    const IDS = s.id;
                    const SUBMODULO = s.submodulo;

                    tbody += `
                    <tr class="trSub trM${IDM} hide pointer" onClick="toggleTr('',${IDS})">
                        <td colspan="2" class="text-center text-capitalize">${SUBMODULO} <i class="icon-down-dir"></i></td>
                    </tr>
                    `;

                    s.directorios.forEach((d) => {
                        const ID = d.id;
                        const ESTADO = d.estado;
                        const BLOCK = d.validacion;
                        const EYE = d.oculto;
                        const DIRECTORIO = d.directorio;
                        perfiles.push(DIRECTORIO);
                        listDirectorios += `<option value="${DIRECTORIO}"></option>`;

                        let iconBlock = '<i class="icon-lock-open"></i>';
                        let blockClick = `onClick="blockDirectory(${ID})"`;
                        let btnEdit = `<button type="button" class="btn btn-outline-primary" id="btnEdit${ID}" onClick="modalEditarDirectorio(${ID}, '${MODULO}', '${SUBMODULO}', '${DIRECTORIO}')">
                                            <i class="icon-pencil"></i>
                                        </button>`;
                        if (BLOCK == 1) {
                            blockClick = "";
                            iconBlock = '<i class="icon-lock"></i>';
                            btnEdit = "";
                        }
                        
                        let iconEye = '<i class="icon-eye"></i>';
                        if (EYE == 0) {
                            iconEye = '<i class="icon-eye-off"></i>';
                        }

                        let iconToggle = '<i class="icon-toggle-on"></i>';
                        if (ESTADO == 0)
                            iconToggle = '<i class="icon-toggle-off"></i>';

                        tbody += `
                        <tr class="trDir trDir${IDM} trS${IDS} hide pointer">
                            <td>${DIRECTORIO}</td>
                            <td class="text-center">
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
                    perfiles.push(DIRECTORIO);
                    listDirectorios += `<option value="${DIRECTORIO}"></option>`;

                    let iconBlock = '<i class="icon-lock-open"></i>';
                    let blockClick = `onClick="blockDirectory(${ID})"`;
                    let btnEdit = `<button type="button" class="btn btn-outline-primary" id="btnEdit${ID}" onClick="modalEditarDirectorio(${ID}, '${MODULO}', '', '${DIRECTORIO}')">
                                            <i class="icon-pencil"></i>
                                        </button>`;
                    if (BLOCK == 1) {
                        blockClick = "";
                        iconBlock = '<i class="icon-lock"></i>';
                        btnEdit = "";
                    }

                    let iconEye = '<i class="icon-eye"></i>';
                    if (EYE == 0) {
                        iconEye = '<i class="icon-eye-off"></i>';
                    }

                    let iconToggle = '<i class="icon-toggle-on"></i>';
                    if (ESTADO == 0)
                        iconToggle = '<i class="icon-toggle-off"></i>';

                    tbody += `
                    <tr class="trDir trM${IDM} hide pointer">
                        <td>${DIRECTORIO}</td>
                        <td class="text-center">
                            <button type="button" title="Ver directorio" class="btn btn-outline-info" onClick="redireccion('${d.ruta}')">
                                <i class="icon-link-3"></i>
                            </button>
                            <button type="button" title="Mostrar en sidebar" class="btn btn-outline-success" visible="${EYE}" id="btnEye${ID}" onClick="visibleSidebar(${ID},'${DIRECTORIO}');">
                            ${iconEye}
                            </button>
                            ${btnEdit}
                            <button type="button" title="Desactivar" class="btn btn-outline-danger" estado="${ESTADO}" id="btnToggle${ID}" onClick="statusDirectorio(${ID},'${DIRECTORIO}')">
                                ${iconToggle}
                            </button>
                            <button type="button" title="Validar" class="btn btn-outline-disabled" id="btnBlock${ID}" ${blockClick}>
                            ${iconBlock}
                            </button>
                        </td>
                    </tr>
                    `;
                });
            }
        });

        $("#listDirectorios").html(listDirectorios);
        $("#tbDatos").html(`
        <table class="table" id="tbDirectory">
            <tbody>
                ${tbody}
            </tbody>
        </table>
        `);
    });
}
function toggleTr(IDM, IDS) {
    if (IDM != "") {
        $(".trM" + IDM).toggleClass("hide");
        $(".trDir" + IDM).addClass("hide");
    }

    if (IDS != "") $(".trS" + IDS).toggleClass("hide");
}
// FUNCIONES DE MODULOS
function modalModulo() {
    let listModulos = "";
    modulos.forEach((x) => {
        listModulos += `<option value="${x.modulo}"></option>`;
    });
    modal = bootbox.dialog({
        title: `NUEVO MÓDULO`,
        message: `
                <div class="col-12 mb-3">
                    <label for="iptText" class="fw-bold">Módulo</label>
                    <input list="modulos" class="form-control" id="iptText" onKeyUp="validarLetras('#iptText')" autocomplete="off" placeholder="Escríbe el nombre del nuevo módulo">
                    <span class="form-text text-danger hide">
                        <i class="icon-warning-1"></i>
                        El área ya existe, intentar con otro nombre.
                    </span>
                    <datalist id="modulos">
                        ${listModulos}
                    </datalist>
                </div>
                <div class="col-12 mb-3 d-flex justify-content-between">
                    <button  class="btn btn-primary col-5" onclick="nuevoModulo();">Guardar</button>
                    <button class="btn btn-outline-danger bootbox-close-button col-5" id="btnCerrarModal">Cancelar</button>
                </div>
            `,
    });
}
function nuevoModulo() {
    const IPT = $("#iptText");
    const MODULO = IPT.val().toUpperCase().trim();
    if (!MODULO) {
        IPT.focus();
        IPT.addClass("is-invalid");
        IPT.next("span").removeClass("hide");
        IPT.next("span").html(`
            <i class="icon-warning-1"></i>
            El campo es requerido
        `);
    } else if (
        modulos.some((x) => x.modulo.toUpperCase() === MODULO.toUpperCase())
    ) {
        IPT.focus();
        IPT.addClass("is-invalid");
        IPT.next("span").removeClass("hide");
        IPT.next("span").html(`
            <i class="icon-warning-1"></i>
            El área ya existe, intentar con otro nombre.
        `);
    } else {
        let datos = new FormData();
        datos.append("opc", "newModule");
        datos.append("module", MODULO);
        send_ajax(datos, ctrlDir).then((data) => {
            if (data === true) {
                listModulos();
                swal_success();
                $('#btnCerrarModal').click();
            }
        });
    }
}
// FUNCIONES DE SUBMODULOS
function modalSubmodulo() {
    let listSubModulos = "";
    let option = "";
    modulos.forEach((m) => {
        option += `<option value="${m.idM}">${m.modulo}</option>`;
    });
    submodulos.forEach((s) => {
        listSubModulos += `<option value="${s.sub}"></option>`;
    });

    modal = bootbox.dialog({
        title: `NUEVO SUBMÓDULO`,
        message: `
                <div class="col-12 mb-3">
                    <label for="cbModalModulo" class="fw-bold">Módulo</label>
                    <select class="form-select" id="cbModalModulo">
                        <option value="0" hidden selected>Seleccionar el módulo</option>
                        ${option}
                    </select>
                    <span class="form-text text-danger hide">
                        <i class="icon-warning-1"></i>
                        Campo requerido.
                    </span>
                </div>
                <div class="col-12 mb-3">
                    <label for="iptText" class="fw-bold">Submódulo</label>
                    <input list="submodulos" class="form-control" id="iptText" onKeyUp="validarLetras('#iptText')" autocomplete="off" placeholder="Escríbe el nombre del nuevo submódulo">
                    <span class="form-text text-danger hide">
                        <i class="icon-warning-1"></i>
                        Campo requerido.
                    </span>
                    <datalist id="submodulos">
                        ${listSubModulos}
                    </datalist>
                </div>
                <div class="col-12 mb-3 d-flex justify-content-between">
                    <button  class="btn btn-primary col-5" onclick="nuevoSubmodulo();">Actualizar</button>
                    <button class="btn btn-outline-danger bootbox-close-button col-5" id="btnCerrarModal">Cancelar</button>
                </div>
            `,
    });
}
function nuevoSubmodulo() {
    const CB = $("#cbModalModulo");
    const MODULO = $("#cbModalModulo").val();
    const IPT = $("#iptText");
    const SUBMODULO = $("#iptText").val();

    if (MODULO == 0) {
        CB.focus();
        CB.addClass("is-invalid");
        CB.next("span").removeClass("hide");
        CB.next("span").html(`
            <i class="icon-warning-1"></i>
            El campo es requerido
        `);
    } else if (!SUBMODULO) {
        IPT.focus();
        IPT.addClass("is-invalid");
        IPT.next("span").removeClass("hide");
        IPT.next("span").html(`
            <i class="icon-warning-1"></i>
            El campo es requerido
        `);
    } else if (submodulos.some((s) => s.sub === SUBMODULO && s.idM === MODULO)) {
    // } else if (
    //     submodulos.some((s) => s.sub.toUpperCase() === SUBMODULO.toUpperCase())
    // ) {
        IPT.focus();
        IPT.addClass("is-invalid");
        IPT.next("span").removeClass("hide");
        IPT.next("span").html(`
            <i class="icon-warning-1"></i>
            Este submodulo ya existe, intentar con otro nombre.
        `);
    } else {
        let datos = new FormData();
        datos.append("opc", "newSubmodule");
        datos.append("modulo", MODULO);
        datos.append("submodulo", SUBMODULO.toUpperCase().trim());
        send_ajax(datos, ctrlDir).then((data) => {
            if (data === true) {
                listSubmodulos();
                swal_success();
                $('#btnCerrarModal').click();
            }
        });
    }
}
// FUNCIONES DE DIRECTORIOS
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
function blockDirectory(id) {
    swal_question(
        "¿Realmente deseas validar este directorio?",
        "Al validar este directorio no se podrá editar nuevamente."
    ).then((result) => {
        if (result.isConfirmed) {
            let datos = new FormData();
            datos.append("opc", "blockDirectory");
            datos.append("id", id);
            send_ajax(datos, ctrlDir).then((data) => {
                if (data === true) {
                    $("#btnEdit" + id).remove();
                    $("#btnBlock" + id).removeAttr("onClick");
                    $("#btnBlock" + id).html('<i class="icon-lock"></i>');
                }
            });
        }
    });
}
function visibleSidebar(id,directorio){
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

    swal_question(question,"Esto afectara el menú y la forma de acceder al directorio.").then((result) => {
        if (result.isConfirmed) {
            let datos = new FormData();
            datos.append("opc", "visibleDirectory");
            datos.append("id", id);
            datos.append("visible", visible);
            send_ajax(datos, ctrlDir).then((data) => {
                if (data === true) {
                    BTN.attr("visible", visible);
                    BTN.html(icon);
                }
            });
        }
    });
}
function modalEditarDirectorio(id, modulo, submodulo, directorio) {
    swal_question('¿Realmente desea modificar este directorio?','Esto puede afectar el funcionamiento correcto del ERP.').then((result) => {
        if (result.isConfirmed) {
            let disabled = "";
            if (submodulo == "") disabled = "disabled";

            let optionModulos = "";
            let optionSubmodulos = "<option value='0'>Seleccionar el submódulo</option>";

            modulos.forEach((m) => {
                let selected = "";
                if (m.modulo === modulo) {
                    selected = "selected";
                }

                optionModulos += `<option value="${m.idM}" ${selected}>${m.modulo}</option>`;

                if (
                    selected === "selected" &&
                    submodulos.some((s) => s.idM === m.idM)
                ) {
                    disabled = "";
                    submodulos.forEach((s) => {
                        selected = "";
                        if (s.sub === submodulo) selected = "selected";
                        if (s.idM == m.idM) optionSubmodulos += `<option value="${s.idS}" ${selected}>${s.sub}</option>`;
                    });
                }
            });

            modal = bootbox.dialog({
                title: `EDITAR DIRECTORIO`,
                message: `
                    <div class="col-12 mb-3">
                        <label for="cbModalModulo" class="fw-bold">Módulo</label>
                        <select class="form-select" id="cbModalModulo" onChange="optionsModalSubModulos()">
                            ${optionModulos}
                        </select>
                    </div>
                    <div class="col-12 mb-3">
                        <label for="cbModalSubmodulo" class="fw-bold">Submódulo</label>
                        <select class="form-select" id="cbModalSubmodulo" ${disabled}>
                            ${optionSubmodulos}
                        </select>
                    </div>
                    <div class="col-12 mb-3">
                        <label for="iptText" class="fw-bold">Directorio</label>
                        <input type="text" class="form-control" id="iptText" autocomplete="off" value="${directorio}">
                        <span class="form-text text-danger hide">
                            <i class="icon-warning-1"></i>
                            Campo requerido.
                        </span>
                    </div>
                    <div class="col-12 mb-3 d-flex justify-content-between">
                        <button  class="btn btn-primary col-5" onclick="editarDirectorio(${id});">Actualizar</button>
                        <button class="btn btn-outline-danger bootbox-close-button col-5">Cancelar</button>
                    </div>
                `,
            });
        }
    });
}
function optionsModalSubModulos() {
    const IDM = $("#cbModalModulo").val();
    $("#cbModalSubmodulo").html("");

    submodulos.forEach((s) => {
        if (s.idM == IDM)
            $("#cbModalSubmodulo").append(
                `<option value="${s.idS}">${s.sub}</option>`
            );
    });
}
function editarDirectorio(id) {
    let datos = new FormData();
    datos.append("opc", "editDirectory");
    datos.append("id", id);
    datos.append("modulo", $("#cbModalModulo").val());
    datos.append("submodulo", $("#cbModalSubmodulo").val());
    datos.append("directorio", $("#iptText").val());

    send_ajax(datos, ctrlDir).then((data) => {
        if(data === true) {
            cerrarModal(modal);
            swal_success();
            tableDirectory();
        } else {
            console.error(data);
        }
    });
}
