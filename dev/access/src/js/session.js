let url_session = "/dev/access/ctrl/ctrl-access.php";

$(() => {
    updateSession();
    setInterval(checkSession, 600000); // cada 10 minutos
    $(document).on('click', () => updateSession());
});

async function checkSession() {
    let data = await useFetch({ url: url_session, data: { opc: 'checkSession' } });
    if (data.status === "expired") logout();
    else if (data.status === "warning") alertSession();
}

function logout() {
    window.location.href = "/dev/salir/";
}

function updateSession() {
    // lo comente por ruido visual en consola.
    useFetch({ url: url_session, data: { opc: 'updateSession' } });
}

function alertSession() {
    let timeLeft = 5; // Cuenta regresiva
    let interval;

    Swal.fire({
        title: "¡Atención!",
        text: `La sesión se cerrará en ${timeLeft} minutos. ¿Desea continuar?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Seguir conectado",
        cancelButtonText: "Cerrar sesión",
        customClass: {
            popup: "bg-[#1F2A37] text-white rounded-lg shadow-lg",
            title: "text-2xl font-semibold",
            content: "text-gray-300",
            confirmButton: "bg-[#1C64F2] hover:bg-[#0E9E6E] text-white py-2 px-4 rounded",
            cancelButton: "bg-transparent text-white border border-gray-500 py-2 px-4 rounded hover:bg-[#111928]",
        },
        background: "#111928",
        allowOutsideClick: false,
        allowEscapeKey: false,
        willOpen: () => {
            let interval = setInterval(() => {
                if (!Swal.isVisible()) return; // Evita ejecutar si la alerta está cerrada
                
                // Reducir el tiempo
                timeLeft--;

                // Mostrar en minutos
                let newText = `La sesión se cerrará en ${timeLeft} minuto${timeLeft !== 1 ? "s" : ""}. ¿Desea continuar?`;
                Swal.update({ text: newText });
                

                // Si el tiempo se acaba, cerramos el intervalo y realizamos las acciones necesarias
                if (timeLeft <= 0) {
                    timeLeft = 5;
                    clearInterval(interval);
                    Swal.close(); // Opcional: Cierra la alerta cuando el tiempo se acaba
                    logout(); // Opcional: Redirige a la página de cierre de sesión
                }
            }, 60000); // Ejecutar cada minuto (60000 ms)
        }

    }).then((result) => {
        clearInterval(interval); // Detener el contador cuando el usuario haga clic en una opción
        timeLeft = 5;
        if (result.isConfirmed) updateSession(); // Actualizar la sesión
        else logout(); // Redirigir si el usuario cancela
    });
}