const CTRL_AUTH    = 'auth/ctrl/ctrl-auth.php';
const REMEMBER_KEY = 'huubie:pro:remember:v1';
const PASSWORD_MIN = 6;   // el mismo de ctrl-auth.php

// Si el codigo ya no sirve (no hay, vencio, se agotaron los intentos o la
// cuenta no aparece) no tiene caso dejarlo tecleando: vuelve al paso 1.
const CODE_DEAD = [404, 409, 410, 429];

// La cuenta que pidio el codigo. Solo en memoria: no pasa por la URL ni por
// localStorage, y recargar la pagina es volver a empezar.
let account = '';

$(() => {
    prefillEmail();

    $('#form-email').on('submit', (e) => { e.preventDefault(); sendCode(); });
    $('#form-code').on('submit', (e) => { e.preventDefault(); checkCode(); });
    $('#form-password').on('submit', (e) => { e.preventDefault(); savePassword(); });

    $('#btn-resend').on('click', resendCode);
    $('#btn-eye').on('click', togglePassword);
    $('#email, #code, #password, #confirm').on('input', hideNotice);

    // Solo digitos y nunca mas de seis: quien pega el codigo con un espacio
    // delante no deberia gastar un intento por eso.
    $('#code').on('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 6);
    });
});


// -- Pasos --

function showStep(n) {
    $('#form-email').toggleClass('hide', n !== 1);
    $('#form-code').toggleClass('hide', n !== 2);
    $('#form-password').toggleClass('hide', n !== 3);
    $('#step-done').toggleClass('hide', n !== 4);

    $('#steps .step').each(function (i) {
        $(this).toggleClass('on', i < Math.min(n, 3));
    });

    if (n === 1) {
        $('#code').val('');
        $('#email').trigger('focus');
    }

    if (n === 2) $('#code').val('').trigger('focus');

    if (n === 3) {
        $('#password, #confirm').val('');
        $('#password').trigger('focus');
    }
}

// Quien entro en este equipo no tiene que volver a escribir su correo.
function prefillEmail() {
    try {
        const user = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null');
        if (user && user.email) $('#email').val(user.email);
    } catch (e) {}

    $('#email').trigger('focus');
}


// -- Paso 1 :: el codigo --

function sendCode() {
    const email = $('#email').val().trim();

    if (email === '') {
        showNotice('Escribe tu correo.', 'error');
        return;
    }

    request('#btn-send', { opc: 'forgotPassword', email: email }).done((res) => {
        if (res.status !== 200) {
            showNotice(res.message, 'error');
            return;
        }

        account = email;
        $('#email-echo').text(email);
        showNotice(res.message, 'ok');
        showStep(2);
    });
}

// Repite el paso 1 con la cuenta que ya se tecleo, sin sacarlo de la pantalla del codigo.
function resendCode() {
    request('#btn-resend', { opc: 'forgotPassword', email: account }).done((res) => {
        $('#code').val('').trigger('focus');
        showNotice(res.message, res.status === 200 ? 'ok' : 'error');
    });
}


// -- Paso 2 :: revisar el codigo --

function checkCode() {
    const code = $('#code').val().trim();

    if (code.length !== 6) {
        showNotice('El código son 6 dígitos.', 'error');
        return;
    }

    request('#btn-code', { opc: 'verifyCode', email: account, code: code }).done((res) => {
        if (res.status !== 200) {
            onFail(res);
            return;
        }

        hideNotice();
        showStep(3);
    });
}


// -- Paso 3 :: la contraseña nueva --

function savePassword() {
    const password = $('#password').val();
    const confirm  = $('#confirm').val();

    // Para no hacer un viaje que ya se sabe perdido; el controlador lo vuelve a revisar todo.
    if (password.length < PASSWORD_MIN) {
        showNotice(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`, 'error');
        return;
    }

    if (password !== confirm) {
        showNotice('Las dos contraseñas no coinciden.', 'error');
        return;
    }

    // El codigo viaja otra vez: el paso 2 no deja nada firmado, asi que es lo
    // unico que demuestra que quien escribe la contraseña recibio el correo.
    request('#btn-password', {
        opc: 'resetPassword',
        email: account,
        code: $('#code').val().trim(),
        password: password,
        confirm: confirm
    }).done((res) => {
        if (res.status !== 200) {
            onFail(res);
            return;
        }

        account = '';
        showNotice(res.message, 'ok');
        showStep(4);
    });
}


// -- Utilidades --

function request(button, data) {
    $(button).prop('disabled', true);

    return $.ajax({ url: CTRL_AUTH, method: 'POST', dataType: 'json', data: data })
        .fail(() => showNotice('No se pudo conectar con el servidor. Inténtalo de nuevo.', 'error'))
        .always(() => $(button).prop('disabled', false));
}

function onFail(res) {
    showNotice(res.message, 'error');

    if (CODE_DEAD.indexOf(res.status) !== -1) showStep(1);
}

function showNotice(message, tipo) {
    $('#notice')
        .removeClass('hide notice-ok notice-error')
        .addClass(tipo === 'ok' ? 'notice-ok' : 'notice-error')
        .text(message);
}

function hideNotice() {
    $('#notice').addClass('hide');
}

function togglePassword() {
    const show = $('#password').attr('type') === 'password';

    $('#password, #confirm').attr('type', show ? 'text' : 'password');
    $('#btn-eye').attr('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña')
        .find('i').attr('class', show ? 'icon-eye-off' : 'icon-eye');
}
