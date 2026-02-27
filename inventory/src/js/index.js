$(window).resize(function () {
    formulario();
});

function formulario() {
    if ($(window).width() > 950) {
        setTimeout(() => {
            $("section").addClass("active");
        }, 500);

        setTimeout(() => {
            $("#logo").addClass("active");
            $("#form").addClass("active");
        }, 1500);

        setTimeout(() => {
            $("#logo").toggleClass("active active2");
            $("#form").toggleClass("active active2");
            $("section").toggleClass("active active2");
        }, 2500);

        setTimeout(() => {
            $("#logo img").addClass("active");
            $("#form form").addClass("active");
        }, 3000);

        setTimeout(() => {
            $("#logo img").css({
                opacity: 1,
            });
            $("#form form").css({
                opacity: 1,
            });
        }, 3300);
    }
}

$(() => {
    formulario();

    $("form").on("submit", (e) => {
        e.preventDefault();

        const ruta = "direccion/reportes/reportes-ingreso.php";

        const HREF = new URL(window.location.href);
        const HASH = HREF.pathname.split("/").filter(Boolean);
        const ERP = HASH[0];
        const RUTA = HREF.origin + "/" + ERP + "/" + ruta;

        localStorage.setItem("url", ruta);
        localStorage.setItem("modelo", "direccion");
        localStorage.setItem("submodelo", "reportes");
        window.location.href = HREF.origin + '/' + ERP + '/direccion';
    });

    $("u").on("click", () => {
        bootbox.dialog({
            title: `RECUPERAR CONTRASEÑA`,
            closeButton: false,
            message: `
                    <div class="col-12 mb-3">
                        <label for="iptText" class="form-label">Ingrese su número de teléfono a 10 dígitos.</label>
                        <input type="number" class="form-control" id="iptText" placeholder="Se enviará una clave temporal">
                        <span class="form-text text-danger hide">
                            <i class="icon-warning-1"></i>
                            Campo obligatorio
                        </span>
                    </div>
                    <div class="col-12 mb-3 d-flex justify-content-between">
                        <button  class="btn btn-primary col-5" onclick="forgot();">Continuar</button>
                        <button class="btn btn-outline-danger bootbox-close-button col-5" id="btnCerrarModal">Cancelar</button>
                    </div>
                `,
        });
    });

    $('#btnEye').on("click",function(){
        const KEY = $('#clave');
        if (KEY.attr("type") === "text") {
            KEY.attr("type", "password");
            KEY.attr("placeholder", "••••••••••");
            $(this).html('<i class="icon-eye"></i>');
        } else {
            KEY.attr("type", "text");
            KEY.attr("placeholder", "Contraseña");
            $(this).html('<i class="icon-eye-off"></i>');
        }
    });
});

function forgot() {
    const INPUT = $("#iptText");

    if (!INPUT.val()) {
        INPUT.focus();
        INPUT.next("span").removeClass("hide");
    } else {
        $.ajax({
            type: "POST",
            url: "acceso/ctrl-index.php",
            data: "opc=forgot&number=" + INPUT.val(),
            cache: false,
            dataType: "json",
            success: function (data) {
                if (data === true) {
                    swal.fire({
                        icon: "success",
                        title: "Se ha enviado una contraseña temporal.",
                        text: "Revisa tu teléfono o correo electrónico que proporcionaste al departamento de capital humano.",
                        customClass: {
                            confirmButton: "btn btn-primary",
                        },
                    }).then((result) => {
                        if (result.isConfirmed) {
                            $("#btnCerrarModal").click();
                        }
                    });
                } else {
                    swal.fire({
                        icon: "error",
                        title: "No se ha encontrado el número telefonico.",
                        text: "Acercate a capital humano, para actualizar tus datos.",
                        customClass: {
                            confirmButton: "btn btn-primary",
                        },
                    }).then((result) => {
                        if (result.isConfirmed) {
                            $("#btnCerrarModal").click();
                        }
                    });
                }
            },
            error: function (xhr, status, error) {
                swal.fire({
                    icon: "error",
                    title: error,
                    text: xhr,
                    customClass: {
                        confirmButton: "btn btn-primary",
                    },
                });
            },
        });
    }
}
