window.link = "acceso/ctrl/ctrl-access.php";

// Usuario recordado en ESTE navegador: correo y nombre para no volver a teclearlos.
// Nunca la contraseña — recordar al usuario es ahorrarle el correo, no el acceso.
const REMEMBER_KEY = 'inventory:login:remember:v1';


$(() => {
    applyRemembered();

    $('#form_login').validation_form({opc:"login"},(datos)=>{
        hideLoginError();
        send_ajax(datos,link).then(data=>storage(data));
    });

    $('#btnEye').on("click",()=>mostrar_key());
    $('#forgetUserBtn').on("click",()=>forgetUser());

    $('#usuario, #clave').on("input", ()=>hideLoginError());

    if (typeof lucide !== 'undefined') lucide.createIcons();
});


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
            email: data.email || '',
            name:  data.user  || '',
            color: data.color || '',
            photo: data.photo || ''
        }));
    } catch (e) { /* modo privado o sin cuota: se entra igual, solo no se recuerda */ }
}

function clearRemembered() {
    try { localStorage.removeItem(REMEMBER_KEY); } catch (e) {}
}

/* El color del usuario (users.color) pintando su avatar, el mismo que enseña la
   navbar. Sin color elegido manda el gris del CSS. */
function avatarStyle(color) {
    const hex = /^#[0-9A-Fa-f]{6}$/.test(color || '') ? color : '';

    return hex === '' ? '' : `background:${hex};`;
}

/* Qué va dentro del avatar: su foto si tiene, y si no el ícono blanco sobre su
   color. Mismo criterio que la navbar. */
function avatarHtml(user) {
    return (user.photo || '') !== ''
         ? `<img src="${user.photo}" alt="">`
         : '<i data-lucide="user"></i>';
}

// Con tarjeta visible el campo de correo se oculta pero conserva su valor:
// el POST del login sigue llevando el correo.
function applyRemembered() {
    const user = loadRemembered();

    if (!user) {
        $('#rememberedUser').prop('hidden', true);
        $('#emailField').prop('hidden', false);
        return;
    }

    $('#usuario').val(user.email);
    $('#emailField').prop('hidden', true);
    $('#rememberedAvatar').attr('style', avatarStyle(user.color)).html(avatarHtml(user));
    $('#rememberedName').text(user.name || user.email);
    $('#rememberedEmail').text(user.email);
    $('#rememberedUser').prop('hidden', false);
    $('#clave').trigger('focus');
}

function forgetUser() {
    clearRemembered();
    $('#usuario, #clave').val('');
    applyRemembered();
    $('#usuario').trigger('focus');
}


// -- Acceso --

function storage(data) {
    if(data != false){
        localStorage.clear();
        sessionStorage.clear();

        // Se guarda DESPUES del clear: si no, el propio login borraría lo que acaba de recordar.
        if ($('#rememberMe').is(':checked')) saveRemembered(data);

        // Administrador o superadmin: directo a módulos, sin pasar por sucursal.
        // Resto: selector de sucursales (apartado de Rosy); app.js de sucursales
        // redirige a operacion/almacen/.
        window.location.href = (parseInt(data.is_admin, 10) === 1) ? "modulos/" : "sucursales/";
    } else {
        showLoginError('Usuario y/o clave incorrectos.');
    }
}

function showLoginError(message) {
    $('#login-error-text').text(message);
    $('#login-error').addClass('show');
    $('#usuario, #clave').addClass('is-invalid');
}

function hideLoginError() {
    $('#login-error').removeClass('show');
    $('#usuario, #clave').removeClass('is-invalid');
}

function mostrar_key(){
        const KEY  = $('#clave');
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
