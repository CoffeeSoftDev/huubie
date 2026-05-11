let link = "access/ctrl/ctrl-access.php";

$(() => {
    $("#user").focus();
    $("#formLogin").validation_form({ opc: "getUser" }, async (datos) => await startSession(datos));
    $("#togglePassword").on("click", () => togglePassword());
    $("#user, #key").on("input", () => hideLoginError());
});


async function startSession(datos) {
    hideLoginError();
    let result = await useFetch({ url: link, data: formDataToJson(datos) });
    if (result.status === 200) window.location.href = result.message;
    else showLoginError(result.message);
}

function showLoginError(message) {
    const $wrapper = $("#loginErrorWrapper");
    $("#user, #key").addClass("ring-1 ring-[#EF4444]/70");
    $("#loginErrorSub").text(message || "Verifica tu correo y contraseña.");
    $wrapper.removeClass("hidden");
    lucide.createIcons();
}

function hideLoginError() {
    $("#user, #key").removeClass("ring-1 ring-[#EF4444]/70");
    $("#loginErrorWrapper").addClass("hidden");
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
