let link = "access/ctrl/ctrl-access.php";

// Usuario recordado en ESTE navegador: usuario, nombre y foto para no volver a teclearlos.
// Nunca la contraseña — recordar al usuario es ahorrarle el usuario, no el acceso.
// Se recuerda siempre al entrar; la X de la tarjeta es la unica forma de olvidarlo.
const REMEMBER_KEY = "alpha:login:remember:v1";

// true tras "Usuario y/o contraseña incorrecta": marca ambos campos y se limpia al volver a escribir.
let loginRejected = false;

$(() => {
    applyRemembered();
    $("#formLogin").validation_form({ opc: "getUser" }, async (datos) => await startSession(datos));
    $("#togglePassword").on("click", () => togglePassword());
    $("#forgetUserBtn").on("click", () => forgetUser());
    $("#rememberedPhoto").on("error", () => showAvatarIcon());
    $("#user, #key").on("input", (e) => onFieldInput(e.currentTarget));
    $("#key").on("keydown keyup", (e) => capsLock(e)).on("blur", () => capsLock(null));
});


// -- Usuario recordado --

function loadRemembered() {
    try {
        const raw = localStorage.getItem(REMEMBER_KEY);
        const val = raw ? JSON.parse(raw) : null;
        return (val && val.user) ? val : null;
    } catch (e) { return null; }
}

function saveRemembered(data) {
    try {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({
            user:  data.user  || "",
            name:  data.name  || "",
            photo: data.photo || "",
            color: data.color || ""
        }));
    } catch (e) { /* modo privado o sin cuota: se entra igual, solo no se recuerda */ }
}

function clearRemembered() {
    try { localStorage.removeItem(REMEMBER_KEY); } catch (e) {}
}

// Sin foto (o si no carga) va el mismo avatar que pinta la navbar al entrar:
// circulo en el color del rol con el icono de usuario.
function showAvatarIcon() {
    $("#rememberedPhoto").addClass("hidden");
    $("#rememberedIcon").removeClass("hidden");
}

// Con tarjeta visible el campo de usuario se oculta pero el input conserva su valor:
// el POST del login sigue llevando el usuario.
function applyRemembered() {
    const user = loadRemembered();

    if (!user) {
        $("#rememberedUser").addClass("hidden");
        $("#userField").removeClass("hidden");
        $("#user").trigger("focus");
        return;
    }

    $("#user").val(user.user);
    $("#userField").addClass("hidden");
    $("#rememberedName").text(user.name || user.user);
    $("#rememberedUserName").text(user.user);
    $("#rememberedAvatar").addClass(`bg-${user.color || "gray"}-600`);

    if (user.photo) {
        $("#rememberedPhoto").attr("src", user.photo).removeClass("hidden");
        $("#rememberedIcon").addClass("hidden");
    } else {
        showAvatarIcon();
    }

    $("#rememberedUser").removeClass("hidden");
    $("#key").trigger("focus");
}

function forgetUser() {
    clearRemembered();
    clearErrors();
    $("#user, #key").val("");
    $("#rememberedPhoto").removeAttr("src");
    applyRemembered();
}


// -- Acceso --

// Los vacios se validan aqui (el form no lleva `required`). El error del servidor
// marca ambos campos y deja el mensaje fijo bajo la contraseña, no un alert de 1.2 s.
async function startSession(datos) {
    const data = formDataToJson(datos);
    clearErrors();

    let first = null;
    if (!data.user.trim()) { markInvalid("#groupUser", true, "Escribe tu usuario");    first = "#user"; }
    if (!data.key)         { markInvalid("#groupKey",  true, "Escribe tu contraseña"); first = first || "#key"; }
    if (first) return $(first).trigger("focus");

    setLoading(true);
    const result = await useFetch({ url: link, data: data });

    if (result && result.status === 200) {
        saveRemembered(result);
        window.location.href = result.message;
        return; // se queda en "Entrando…" hasta que carga el menu
    }

    setLoading(false);
    if (!result) return fieldMsg("#groupKey", "err", "No se pudo conectar. Intenta de nuevo.");

    loginRejected = true;
    markInvalid("#groupUser", true);
    markInvalid("#groupKey", true, result.message);
    $("#key").val("").trigger("focus");
}

function setLoading(on) {
    $("#user, #key").prop("readonly", on);
    $("#formLogin").toggleClass("is-loading", on);
    $("#btnLogin").prop("disabled", on).find("span").text(on ? "Entrando…" : "Iniciar sesión");
}

function togglePassword() {
    const show = $("#key").attr("type") === "password";
    $("#key").attr("type", show ? "text" : "password");
    $("#togglePassword")
        .attr("aria-pressed", show)
        .attr("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
}


// -- Errores y avisos de los campos --

// type: "err" (rojo) o "caps" (ambar). Sin type el mensaje se vacia.
function fieldMsg(group, type, text) {
    $(group).find(".login-msg")
        .removeClass("is-err is-caps")
        .addClass(type ? `is-${type}` : "")
        .find("span").text(text || "");
}

function markInvalid(group, on, text = "") {
    $(group).toggleClass("is-invalid", on)
        .find(".login-input").attr("aria-invalid", on ? "true" : "false");
    fieldMsg(group, on && text ? "err" : "", on ? text : "");
}

function clearErrors() {
    loginRejected = false;
    markInvalid("#groupUser", false);
    markInvalid("#groupKey", false);
}

function onFieldInput(input) {
    if (loginRejected) return clearErrors();
    markInvalid($(input).closest("#groupUser, #groupKey"), false);
}

// El aviso de Bloq Mayus no pisa un error; se quita al salir del campo.
function capsLock(e) {
    if ($("#groupKey").hasClass("is-invalid")) return;
    const ev = e && e.originalEvent;
    const on = !!(ev && ev.getModifierState && ev.getModifierState("CapsLock"));
    fieldMsg("#groupKey", on ? "caps" : "", on ? "Bloq Mayús está activado" : "");
}
