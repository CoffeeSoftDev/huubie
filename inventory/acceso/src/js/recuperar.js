window.link = "acceso/ctrl/ctrl-access.php";

// La cuenta que pidió el código. Vive solo en memoria: no pasa por la URL ni por
// localStorage. Recargar la página es volver a empezar, y así debe ser.
let cuenta = '';


$(() => {
    $('#form-correo').validation_form({opc:"forgotPassword"},(datos)=>enviarCodigo(datos));
    $('#form-codigo').validation_form({opc:"verifyCode"},(datos)=>revisarCodigo(datos));
    $('#form-clave').validation_form({opc:"resetPassword"},(datos)=>guardarClave(datos));

    $('#btn-reenviar').on("click",()=>reenviar());
    $('#btnEye').on("click",()=>mostrar_key());

    $('#correo, #codigo, #nueva, #confirmar').on("input", ()=>ocultarAviso());

    if (typeof lucide !== 'undefined') lucide.createIcons();
});


// -- Pasos --

function paso(n) {
    $('#form-correo').toggleClass('hide', n !== 1);
    $('#form-codigo').toggleClass('hide', n !== 2);
    $('#form-clave').toggleClass('hide', n !== 3);
    $('#paso-listo').toggleClass('hide', n !== 4);

    $('#pasos .paso').each(function (i) {
        $(this).toggleClass('on', n === 4 || i < n);
    });
}


// -- Paso 1 :: el código --

function enviarCodigo(datos) {
    bloquear('#btn-enviar', true);

    send_ajax(datos, link).then(data => {
        bloquear('#btn-enviar', false);

        if (data.status !== 200) return mostrarAviso(data.message, 'error');

        cuenta = $('#correo').val().trim();
        $('#correo-eco').text(cuenta);
        mostrarAviso(data.message, 'ok');
        paso(2);
        $('#codigo').trigger('focus');
    });
}

// El reenvío repite el paso 1 con la cuenta que ya se tecleó, sin sacar al
// usuario de la pantalla del código.
function reenviar() {
    const datos = new FormData();
    datos.append('opc', 'forgotPassword');
    datos.append('correo', cuenta);

    bloquear('#btn-reenviar', true);

    send_ajax(datos, link).then(data => {
        bloquear('#btn-reenviar', false);
        $('#codigo').val('');
        mostrarAviso(data.message, data.status === 200 ? 'ok' : 'error');
    });
}


// -- Paso 2 :: revisar el código --

function revisarCodigo(datos) {
    datos.append('correo', cuenta);
    bloquear('#btn-codigo', true);

    send_ajax(datos, link).then(data => {
        bloquear('#btn-codigo', false);

        if (data.status !== 200) return mostrarAviso(data.message, 'error');

        ocultarAviso();
        paso(3);
        $('#nueva').trigger('focus');
    });
}


// -- Paso 3 :: la contraseña nueva --

function guardarClave(datos) {
    // El código viaja otra vez: el paso 2 no deja nada firmado, así que es lo
    // único que demuestra que quien escribe la contraseña recibió el correo.
    datos.append('correo', cuenta);
    datos.append('codigo', $('#codigo').val().trim());
    bloquear('#btn-clave', true);

    send_ajax(datos, link).then(data => {
        bloquear('#btn-clave', false);

        if (data.status !== 200) return mostrarAviso(data.message, 'error');

        mostrarAviso(data.message, 'ok');
        paso(4);
    });
}


// -- Avisos y utilidades --

function mostrarAviso(mensaje, tipo) {
    $('#aviso')
        .removeClass('hide aviso-ok aviso-error')
        .addClass(tipo === 'ok' ? 'aviso-ok' : 'aviso-error')
        .text(mensaje);
}

function ocultarAviso() {
    $('#aviso').addClass('hide');
}

function bloquear(boton, estado) {
    $(boton).prop('disabled', estado);
}

function mostrar_key(){
        const KEY  = $('#nueva');
        const ICON = $('#btnEye');
        if (KEY.attr("type") === "text") {
            KEY.attr("type", "password");
            ICON.html('<i data-lucide="eye"></i>');
        } else {
            KEY.attr("type", "text");
            ICON.html('<i data-lucide="eye-off"></i>');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
}
