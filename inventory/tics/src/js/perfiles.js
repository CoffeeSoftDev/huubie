window.ctrlPerfil = window.ctrlPerfil || "ctrl/ctrl-perfiles.php";
window.listPerfiles = window.listPerfiles || {};
window.jsonUDN = window.jsonUDN || {};

$(function () {
    listUDN();
    tablePerfiles();

    $("#form__permisos").on("submit", (e) => {
        e.preventDefault();

        const IPT = $("#iptPerfil");
        if (!IPT.val()) {
            IPT.focus();
            IPT.addClass("is-invalid");
            IPT.next("span").removeClass("hide");
            IPT.next("span").html(
                '<i class="icon-warning-1"></i> Campo requerido.'
            );
            return;
        }

        if (
            listPerfiles.some(
                (p) => p.perfil.toUpperCase() === IPT.val().toUpperCase()
            )
        ) {
            IPT.focus();
            IPT.addClass("is-invalid");
            IPT.next("span").removeClass("hide");
            IPT.next("span").html(`
                <i class="icon-warning-1"></i>
                Este perfil ya existe, intentar con otro nombre.
            `);
            return;
        }

        swal_question('¿Los datos son correctos?').then((result) => {
            if (result.isConfirmed) {
                const VALOR =
                    IPT.val().charAt(0).toUpperCase() + IPT.val().slice(1);
                let datos = new FormData();
                datos.append("opc", "profileNew");
                datos.append("perfil", VALOR);
                send_ajax(datos, ctrlPerfil).then((data) => {
                    if (data === true) {
                        swal_success();
                        tablePerfiles();
                    }
                });
            }
        });
    });
});

function listUDN() {
    let datos = new FormData();
    datos.append("opc", "listUDN");
    send_ajax(datos, ctrlPerfil).then((data) => {
        $("#cbUDN").option_select({data:data});
        jsonUDN = data;
    });
}

// FUNCIONES DE PERFIL
function tablePerfiles() {
    let datos = new FormData();
    datos.append("opc", "profileList");
    tb_ajax(datos, ctrlPerfil, "#tbDatosPerfiles").then((data) => {
        console.log(data);
        listPerfiles = data;
        let tbody = "";
        data.forEach((p) => {
            const ID = p.id;
            const PERFIL = p.perfil;
            $("#listPerfiles").append(`<option value="${PERFIL}"></option>`);
            const ESTADO = p.estado;
            let iconToggle = '<i class="icon-toggle-on"></i>';
            if (ESTADO == 0) iconToggle = '<i class="icon-toggle-off"></i>';

            tbody += `
            <tr>
                <td>
                ${PERFIL}
                </td>
                <td class="text-center">
                    <button type="button" title="Editar" class="btn btn-outline-primary" onClick="modalEditPerfil(${ID}, '${PERFIL}',${p.idE}) "><i class="icon-pencil"></i></button>
                    <button type="button" title="Desactivar" class="btn btn-outline-danger" id="btnToggle${ID}" estado="${ESTADO}" onClick="estadoPerfil(${ID},'${PERFIL}');">${iconToggle}</button>
                    <button type="button" title="Ver permisos" class="btn btn-outline-success" onClick="tbModulos(${ID},'${PERFIL}');"><i class="icon-key"></i></button>
                </td>
            </tr>`;
        });

        $("#tbDatosPerfiles").html(`
        <table class="table " id="tbPerfiles">
            <thead>
                <tr>
                    <th>perfil</th>
                    <th>opciones</th>
                </tr>
            </thead>
            <tbody>
                ${tbody}
            </tbody>
        </table>
        `);
    });
}
function estadoPerfil(id, perfil) {
    swal_question(
        `REALMENTE DESEA DESACTIVAR EL PERFIL "${perfil.toUpperCase()}"?`
    ).then((result) => {
        if (result.isConfirmed) {
            const BTNTOGGLE = $("#btnToggle" + id);
            const ESTADO = $("#btnToggle" + id).attr("estado");
            let status = 1;
            let icon = '<i class="icon-toggle-on"></i>';

            if (ESTADO == 1) {
                status = 0;
                icon = '<i class="icon-toggle-off"></i>';
            }

            let datos = new FormData();
            datos.append("opc", "profileStatus");
            datos.append("id", id);
            datos.append("estado", status);
            send_ajax(datos, ctrlPerfil).then((data) => {
                if (data === true) {
                    BTNTOGGLE.attr("estado", status);
                    BTNTOGGLE.html(icon);
                }
            });
        }
    });
}
function modalEditPerfil(id, perfil, udn) {
    perfilesList = "";
    listPerfiles.forEach((p) => {
        perfilesList += `<option value="${p.perfil}"></option>`;
    });

    bootbox
        .dialog({
            title: `EDITAR PERFIL "${perfil.toUpperCase()}"`,
            message: `
                <div class="col-12 mb-3">
                    <label for="iptText" class="fw-bold">Perfil</label>
                    <input list="perfiles" class="form-control" id="iptText" onKeyUp="validarLetras('#iptText')" value="${perfil}">
                    <span class="form-text text-danger hide">
                        <i class="icon-warning-1"></i> Campo requerido.
                    </span>
                    <datalist id="perfiles">
                        ${perfilesList}
                    </datalist>
                </div>
                <div class="col-12 mb-3 d-flex justify-content-between">
                    <button  class="btn btn-primary col-5" onclick="editarPerfil(${id},'${perfil}');">Actualizar</button>
                    <button class="btn btn-outline-danger col-5 bootbox-close-button" id="btnCerrarModal">Cancelar</button>
                </div>
            `,
        })
        .on("shown.bs.modal", () => {
            $("#cbModalUDN").option_select(jsonUDN);
            if (udn == null || udn == undefined) udn = 0;
            $('#cbModalUDN option[value="' + udn + '"]').prop("selected", true);
        });
}
function editarPerfil(id,perfil) {
    let IPT = $("#iptText");
    if (!IPT.val()) {
        IPT.focus();
        IPT.addClass("is-invalid");
        IPT.next("span").removeClass("hide");
        IPT.next("span").html(
            '<i class="icon-warning-1"></i> Campo requerido.'
        );
        return;
    }

    if (
        IPT.val().toUpperCase() !== perfil.toUpperCase() &&
        listPerfiles.some(
            (p) => p.perfil.toUpperCase() === IPT.val().toUpperCase()
        )
    ) {
        IPT.focus();
        IPT.addClass("is-invalid");
        IPT.next("span").removeClass("hide");
        IPT.next("span").html(
            '<i class="icon-warning-1"></i> Este perfil ya existe, intente con otro nombre.'
        );
        return;
    } 
    
    swal_question("¿Los datos son correctos?").then((result)=>{
        if(result.isConfirmed){
        let datos = new FormData();
        datos.append("opc", "profileEdit");
        datos.append("id", id);
        datos.append("perfil", IPT.val());
        send_ajax(datos, ctrlPerfil).then((data) => {
            if (data === true) {
                $("#btnCerrarModal").click();
                tablePerfiles();
                swal_success();
            }
        });
    }
    });
}
// FUNCIONES DE PERMISOS
function tbModulos(id, perfil) {
    const DIVTB = "#tbDatosDirectorios";
    let datos = new FormData();
    datos.append("opc", "directoryList");
    datos.append("perfil", id);
    tb_ajax(datos, ctrlPerfil, DIVTB).then((data) => {
        console.log(data);
        let tbody = "";
        data.modulos.forEach((m) => {
            const IDM = m.id;
            const MODULO = m.modulo;
            tbody += `
            <tr class="pointer" onClick="toggleTr(${IDM})">
                <th colspan="5" class="text-center">${MODULO} <i class="icon-down-dir"></i></th>
            </tr>
            `;

            if (m.submodulos.length > 0) {
                m.submodulos.forEach((s) => {
                    const IDS = s.id;
                    const SUBMODULO = s.submodulo;

                    tbody += `
                    <tr class="trSub trM${IDM} hide pointer" onClick="toggleTr('',${IDS})">
                        <td colspan="5" class="text-center text-capitalize">${SUBMODULO} <i class="icon-down-dir"></i></td>
                    </tr>
                    <tr class="trDir trDir${IDM} trS${IDS} hide">
                        <td class="text-center fw-bold text-primary">
                            <button class="btn btn-sm btn-primary" check="0" id="checkS${IDS}" onClick="checkAllDirectory(${IDS},'',${id});"><i class="icon-cancel-circle"></i> DIRECTORIOS</button>
                        </td>
                        <td class="text-center">
                            <span title="VER" class="text-primary"><i class="icon-eye"></i></span>
                        </td>
                        <td class="text-center">
                            <span title="AGREGAR" class="text-primary"><i class="icon-doc-new"></i></span>
                        </td>
                        <td class="text-center">
                            <span title="ACTUALIZAR" class="text-primary"><i class="icon-edit-2"></i></span>
                        </td>
                        <td class="text-center">
                            <span title="IMPRIMIR" class="text-primary"><i class="icon-print"></i></span>
                        </td>
                    </tr>
                    `;

                    s.directorios.forEach((d) => {
                        const ID = d.id;
                        const DIRECTORIO = d.directorio;
                        const VER = d.ver;
                        const ESCRIBIR = d.escribir;
                        const EDITAR = d.editar;
                        const IMPRIMIR = d.imprimir;

                        let checkVer = 0;
                        let iconVer = '<i class="icon-cancel"></i>';
                        if (VER == 1) {
                            iconVer = '<i class="icon-ok"></i>';
                            checkVer = 1;
                        }

                        let checkEscribir = 0;
                        let iconEscribir = '<i class="icon-cancel"></i>';
                        if (ESCRIBIR == 1) {
                            iconEscribir = '<i class="icon-ok"></i>';
                            checkEscribir = 1;
                        }

                        let checkEditar = 0;
                        let iconEditar = '<i class="icon-cancel"></i>';
                        if (EDITAR == 1) {
                            iconEditar = '<i class="icon-ok"></i>';
                            checkEditar = 1;
                        }

                        let checkImprimir = 0;
                        let iconImprimir = '<i class="icon-cancel"></i>';
                        if (IMPRIMIR == 1) {
                            iconImprimir = '<i class="icon-ok"></i>';
                            checkImprimir = 1;
                        }

                        tbody += `
                        <tr class="trDir trDir${IDM} trS${IDS} hide">
                            <td id="row${ID}" check="0" class="pointer" onClick="checkRowDirectory(${ID},${id})">${DIRECTORIO}</td>
                            <td class="text-center">
                                <button type="button" check="${checkVer}" id="btnCheck1${ID}" class="btn btn-sm btn-outline-info" onClick="checkDirectory('#btnCheck1',${ID},${id},1)">
                                    ${iconVer}
                                </button>
                            </td>
                            <td class="text-center">
                                <button type="button" check="${checkEscribir}" id="btnCheck2${ID}" class="btn btn-sm btn-outline-info" onClick="checkDirectory('#btnCheck2',${ID},${id},2)">
                                    ${iconEscribir}
                                </button>
                            </td>
                            <td class="text-center">
                                <button type="button" check="${checkEditar}" id="btnCheck3${ID}" class="btn btn-sm btn-outline-info" onClick="checkDirectory('#btnCheck3',${ID},${id},3)">
                                    ${iconEditar}
                                </button>
                            </td>
                            <td class="text-center">
                                <button type="button" check="${checkImprimir}" id="btnCheck4${ID}" class="btn btn-sm btn-outline-info" onClick="checkDirectory('#btnCheck4',${ID},${id},4)">
                                    ${iconImprimir}
                                </button>
                            </td>
                        </tr>
                        `;
                    });
                });
            }

            if (m.directorios.length > 0) {
                tbody += `
                <tr class="trDir trM${IDM} hide">
                    <td class="text-center fw-bold text-primary">
                        <button type="button" check="0" id="checkM${IDM}" class="btn btn-sm btn-primary" onClick="checkAllDirectory('',${IDM},${id});"><i class="icon-cancel-circle"></i> DIRECTORIOS</button>
                    </td>
                    <td class="text-center">
                        <span title="VER" class="text-primary"><i class="icon-eye"></i></span>
                    </td>
                    <td class="text-center">
                        <span title="AGREGAR" class="text-primary"><i class="icon-doc-new"></i></span>
                    </td>
                    <td class="text-center">
                        <span title="ACTUALIZAR" class="text-primary"><i class="icon-edit-2"></i></span>
                    </td>
                    <td class="text-center">
                        <span title="IMPRIMIR" class="text-primary"><i class="icon-print"></i></span>
                    </td>
                </tr>
                `;

                m.directorios.forEach((d) => {
                    const ID = d.id;
                    const DIRECTORIO = d.directorio;
                    const VER = d.ver;
                    const ESCRIBIR = d.escribir;
                    const EDITAR = d.editar;
                    const IMPRIMIR = d.imprimir;

                    let checkVer = 0;
                    let iconVer = '<i class="icon-cancel"></i>';
                    if (VER == 1) {
                        iconVer = '<i class="icon-ok"></i>';
                        checkVer = 1;
                    }

                    let checkEscribir = 0;
                    let iconEscribir = '<i class="icon-cancel"></i>';
                    if (ESCRIBIR == 1) {
                        iconEscribir = '<i class="icon-ok"></i>';
                        checkEscribir = 1;
                    }

                    let checkEditar = 0;
                    let iconEditar = '<i class="icon-cancel"></i>';
                    if (EDITAR == 1) {
                        iconEditar = '<i class="icon-ok"></i>';
                        checkEditar = 1;
                    }

                    let checkImprimir = 0;
                    let iconImprimir = '<i class="icon-cancel"></i>';
                    if (IMPRIMIR == 1) {
                        iconImprimir = '<i class="icon-ok"></i>';
                        checkImprimir = 1;
                    }

                    tbody += `
                    <tr class="trDir trM${IDM} hide">
                        <td id="row${ID}" check="${checkVer}" class="pointer" onClick="checkRowDirectory(${ID},${id})">${DIRECTORIO}</td>
                        <td class="text-center">
                            <button type="button" check="${checkVer}" id="btnCheck1${ID}" class="btn btn-sm btn-outline-info" onClick="checkDirectory('#btnCheck1',${ID},${id},1)">
                                ${iconVer}
                            </button>
                        </td>
                        <td class="text-center">
                            <button type="button" check="${checkEscribir}" id="btnCheck2${ID}" class="btn btn-sm btn-outline-info" onClick="checkDirectory('#btnCheck2',${ID},${id},2)">
                                ${iconEscribir}
                            </button>
                        </td>
                        <td class="text-center">
                            <button type="button" check="${checkEditar}" id="btnCheck3${ID}" class="btn btn-sm btn-outline-info" onClick="checkDirectory('#btnCheck3',${ID},${id},3)">
                                ${iconEditar}
                            </button>
                        </td>
                        <td class="text-center">
                            <button type="button" check="${checkImprimir}" id="btnCheck4${ID}" class="btn btn-sm btn-outline-info" onClick="checkDirectory('#btnCheck4',${ID},${id},4)">
                                ${iconImprimir}
                            </button>
                        </td>
                    </tr>
                    `;
                });
            }
        });

        let checkAll = 0;
        let iconCheckAll = '<i class="icon-cancel"></i>';
        if(data.total == data.cuenta) {
            checkAll = 1;
            iconCheckAll = '<i class="icon-ok"></i>';
        }


        $(DIVTB).html(`
        <table class="table rounded-4 overflow-hidden" id="tbDirectory">
            <thead>
                <tr>
                    <th class="bg-primary" colspan="5">
                    <button type="button" check="${checkAll}" class="btn btn-sm btn-outline-light" onClick="AllModules(${id},${checkAll},'${perfil}');">${iconCheckAll}</button>
                    ${perfil}
                    </th>
                </tr>
            </thead>
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
// OTORGAR O QUITAR PERMISOS
function AllModules(id,checkAll,perfil){
    swal_question('¿Estas seguro de otorgar el acceso total a todos los módulos?').then((result)=>{
        if(result.isConfirmed){
            let datos = new FormData();
            datos.append('opc','permitAllModule');
            datos.append('id',id);
            datos.append('check',checkAll);
            send_ajax(datos,ctrlPerfil).then((data)=>{
                if(data === true){
                    swal_success();
                    tbModulos(id, perfil);
                }
            });
        }
    });
}
function checkAllDirectory(idS, idM, perfil) {
    let id = null;
    let tr = null;
    let td = null;

    if (idS != "") {
        id = idS;
        tr = ".trS" + idS;
        td = "#checkS" + idS;
    } else if (idM != "") {
        id = idM;
        tr = ".trM" + idM;
        td = "#checkM" + idM;
    }

    swal_question(
        "¿Esta seguro de continuar?",
        "Esto afectara todos los directorios."
    ).then((result) => {
        if (result.isConfirmed) {
            const CHECK = $(td).attr("check");
            let check = 1;
            let iconCheck = '<i class="icon-ok"></i>';
            let iconDir = '<i class="icon-ok-circle"></i> DIRECTORIOS';
            if (CHECK == 1) {
                check = 0;
                iconCheck = '<i class="icon-cancel"></i>';
                iconDir = '<i class="icon-cancel-circle"></i> DIRECTORIOS';
            }

            let datos = new FormData();
            datos.append("opc", "permitPackage");
            datos.append("idM", idM);
            datos.append("idS", idS);
            datos.append("check", check);
            datos.append("perfil", perfil);
            send_ajax(datos, ctrlPerfil).then((data) => {
                if (data === true) {
                    $(tr + " td[check]").attr("check", check);
                    $(tr + " button").attr("check", check);
                    $(tr + " button").html(iconCheck);
                    $(td).html(iconDir);
                    swal_success();
                }
            });
        }
    });
}
function checkRowDirectory(id, perfil) {
    swal_question("¿Desea modificar todos los permisos?").then((result) => {
        if (result.isConfirmed) {
            const ROW = $("#row" + id);
            const CHECK = ROW.attr("check");
            let check = 1;
            let iconCheck = '<i class="icon-ok"></i>';

            if (CHECK == 1) {
                check = 0;
                iconCheck = '<i class="icon-cancel"></i>';
            }

            let datos = new FormData();
            datos.append("opc", "permitDirectory");
            datos.append("check", check);
            datos.append("perfil", perfil);
            datos.append("directorio", id);
            send_ajax(datos, ctrlPerfil).then((data) => {
                if (data === true) {
                    swal_success();
                    ROW.attr("check", check);
                    $("#btnCheck1" + id).attr("check", check);
                    $("#btnCheck2" + id).attr("check", check);
                    $("#btnCheck3" + id).attr("check", check);
                    $("#btnCheck4" + id).attr("check", check);
                    $("#btnCheck1" + id).html(iconCheck);
                    $("#btnCheck2" + id).html(iconCheck);
                    $("#btnCheck3" + id).html(iconCheck);
                    $("#btnCheck4" + id).html(iconCheck);
                }
            });
        }
    });
}
function checkDirectory(btn, id, perfil, permiso) {
    const BTN = $(btn + id);
    const CHECK = BTN.attr("check");
    let check = 1;
    let iconCheck = '<i class="icon-ok"></i>';

    if (CHECK == 1) {
        check = 0;
        iconCheck = '<i class="icon-cancel"></i>';
    }

    let datos = new FormData();
    datos.append("opc", "permitOnexOne");
    datos.append("directorio", id);
    datos.append("perfil", perfil);
    datos.append("permiso", permiso);
    datos.append("check", check);
    send_ajax(datos, ctrlPerfil).then((data) => {
        if (data === true) {
            BTN.attr("check", check);
            BTN.html(iconCheck);

            if (permiso != 1) {
                $("#btnCheck1" + id).attr("check", 1);
                $("#btnCheck1" + id).html('<i class="icon-ok"></i>');
            } else {
                check = 0;
                iconCheck = '<i class="icon-cancel"></i>';
                $("#btnCheck2" + id).attr("check", check);
                $("#btnCheck2" + id).html(iconCheck);
                $("#btnCheck3" + id).attr("check", check);
                $("#btnCheck3" + id).html(iconCheck);
                $("#btnCheck4" + id).attr("check", check);
                $("#btnCheck4" + id).html(iconCheck);
            }
        }
    });
}
