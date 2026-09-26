let link = "access/ctrl/ctrl-access.php";

// Usuario recordado en ESTE navegador: usuario, nombre y foto para no volver a teclearlos.
// Nunca la contraseña — recordar al usuario es ahorrarle el usuario, no el acceso.
// Se recuerda siempre al entrar; la X de la tarjeta es la unica forma de olvidarlo.
const REMEMBER_KEY = "alpha:login:remember:v1";

$(() => {
    applyRemembered();
    $("#formLogin").validation_form({ opc: "getUser" }, async (datos) => await startSession(datos));
    $("#togglePassword").on("click", () => togglePassword());
    $("#forgetUserBtn").on("click", () => forgetUser());
    $("#rememberedPhoto").on("error", () => showAvatarIcon());
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

// Con tarjeta visible el input de usuario se oculta pero conserva su valor:
// el POST del login sigue llevando el usuario.
function applyRemembered() {
    const user = loadRemembered();

    if (!user) {
        $("#rememberedUser").addClass("hidden");
        $("#user").removeClass("hidden").trigger("focus");
        return;
    }

    $("#user").val(user.user).addClass("hidden");
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
    $("#user, #key").val("");
    $("#rememberedPhoto").removeAttr("src");
    applyRemembered();
}


// -- Acceso --

async function startSession(datos) {
    let result = await useFetch({ url: link, data: formDataToJson(datos) });

    if (result.status === 200) {
        saveRemembered(result);
        window.location.href = result.message;
    }
    else alert({ icon: "error", title: result.message, timer:1200 });
}

function togglePassword() {
    const inputKey = $("#key");
    const toggleBtn = $("#togglePassword");

    // Alternar tipo de input
    const isPassword = inputKey.attr("type") === "password";
    inputKey.attr("type", isPassword ? "text" : "password");

    // Cambiar icono
    toggleBtn.find("i").toggleClass("icon-eye icon-eye-off");
}
