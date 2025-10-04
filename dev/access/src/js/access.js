let link = "access/ctrl/ctrl-access.php";

$(() => {
    $("#user").focus();
    $("#formLogin").validation_form({ opc: "getUser" }, async (datos) => await startSession(datos));
    $("#togglePassword").on("click", () => togglePassword());
});


async function startSession(datos) {
    let result = await useFetch({ url: link, data: formDataToJson(datos) });
    if (result.status === 200) window.location.href = result.message;
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
