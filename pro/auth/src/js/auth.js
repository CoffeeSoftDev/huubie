const CTRL_AUTH = 'auth/ctrl/ctrl-auth.php';

// Quien entro en ESTE navegador: correo, nombre y avatar para no volver a
// teclearlos. Nunca la contraseña.
const REMEMBER_KEY = 'huubie:pro:remember:v1';

$(() => {
    applyRemembered();

    $('#login-form').on('submit', (e) => {
        e.preventDefault();
        login();
    });

    $('#btn-eye').on('click', togglePassword);
    $('#btn-forget').on('click', forgetUser);
    $('#email, #password').on('input', hideError);
    $('#email').on('input', () => setLocked(false));
    $('#password').on('keydown keyup', toggleCaps);
});


// -- Acceso --

function login() {
    const email    = $('#email').val().trim();
    const password = $('#password').val();

    hideError();

    if (email === '' || password === '') {
        showError('Escribe tu correo y tu contraseña.');
        return;
    }

    setLoading(true);

    $.ajax({
        url: CTRL_AUTH,
        method: 'POST',
        dataType: 'json',
        data: {
            opc: 'login',
            email: email,
            password: password,
            remember: $('#remember').is(':checked') ? 1 : 0
        }
    })
    .done((res) => {
        if (res.status === 200) {
            onLogin(res.data);
            return;
        }

        setLoading(false);
        showError(res.message);
        $('#password').val('');

        // Bloqueada no tiene caso volver a escribir la contraseña: la salida es
        // "¿La olvidaste?", que la desbloquea.
        if (res.status === 423) setLocked(true);
        else $('#password').trigger('focus');
    })
    .fail(() => {
        setLoading(false);
        showError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    });
}

function onLogin(data) {
    if ($('#remember').is(':checked')) saveRemembered(data);
    else clearRemembered();

    // El menu que el rail guardo en esta pestaña es de quien estaba antes
    // (sidebar.js): se olvida para no pintarlo ni un instante.
    try {
        Object.keys(sessionStorage).filter((k) => k.startsWith('pro:sidebar:')).forEach((k) => sessionStorage.removeItem(k));
    } catch (e) {}

    window.location.href = data.redirect;
}


// -- Usuario recordado --

function loadRemembered() {
    try {
        const raw = localStorage.getItem(REMEMBER_KEY);
        const val = raw ? JSON.parse(raw) : null;
        return (val && val.email) ? val : null;
    } catch (e) { return null; }
}

function saveRemembered(data) {
    try {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({
            email: data.email,
            name:  data.user,
            photo: data.photo,
            color: data.color
        }));
    } catch (e) { /* modo privado o sin cuota: se entra igual, solo no se recuerda */ }
}

function clearRemembered() {
    try { localStorage.removeItem(REMEMBER_KEY); } catch (e) {}
}

// Con la tarjeta visible el campo de correo se oculta pero conserva su valor:
// login() lo sigue leyendo de ahi.
function applyRemembered() {
    const user = loadRemembered();

    if (!user) {
        $('#remembered').prop('hidden', true);
        $('#email-field').prop('hidden', false);
        return;
    }

    $('#email').val(user.email);
    $('#email-field').prop('hidden', true);
    renderAvatar($('#remembered-avatar'), user);
    $('#remembered-name').text(user.name || user.email);
    $('#remembered-email').text(user.email);
    $('#remembered').prop('hidden', false);
    $('#password').trigger('focus');
}

function forgetUser() {
    clearRemembered();
    $('#email, #password').val('');
    hideError();
    setLocked(false);
    applyRemembered();
    $('#email').trigger('focus');
}

function renderAvatar($avatar, user) {
    const color = /^#[0-9A-Fa-f]{6}$/.test(user.color || '') ? user.color : '';

    $avatar.empty().css('background', color);

    if (user.photo) $avatar.append($('<img>', { src: user.photo, alt: '' }));
    else $avatar.text(initialsOf(user.name || user.email));
}

function initialsOf(name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0] ? parts[0][0] : '';
    const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';

    return (first + last).toUpperCase();
}


// -- UI --

// Deshabilitado ademas de girando: un Enter de mas no manda el login dos veces.
function setLoading(estado) {
    $('#btn-login').toggleClass('loading', estado).prop('disabled', estado);
}

function setLocked(estado) {
    $('#password, #btn-login').prop('disabled', estado);
}

function showError(message) {
    $('#login-error-text').text(message);
    $('#login-error').addClass('show');
    $('#email, #password').addClass('is-invalid');
}

function hideError() {
    $('#login-error').removeClass('show');
    $('#email, #password').removeClass('is-invalid');
}

function togglePassword() {
    const $input = $('#password');
    const show   = $input.attr('type') === 'password';

    $input.attr('type', show ? 'text' : 'password');
    $('#btn-eye').attr('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña')
        .find('i').attr('class', show ? 'icon-eye-off' : 'icon-eye');
}

function toggleCaps(e) {
    const ev = e.originalEvent;
    $('#caps-hint').toggleClass('show', !!(ev && ev.getModifierState && ev.getModifierState('CapsLock')));
}
