window.link = "acceso/ctrl/ctrl-access.php";


$(() => {
    formulario();
    
    $('#form_login').validation_form({opc:"login"},(datos)=>{
        hideLoginError();
        send_ajax(datos,link).then(data=>storage(data));
    });

    $('#btnEye').on("click",()=>mostrar_key());

    $('#usuario, #clave').on("input", ()=>hideLoginError());

    if (typeof lucide !== 'undefined') lucide.createIcons();
});

function storage(data) {
    console.log(data);
    if(data != false){
        localStorage.clear();
        sessionStorage.clear();

        // Redirección relativa a la ubicación del login (inventory/), así funciona
        // sin importar en qué subcarpeta esté montado el proyecto (huubie/inventory/, raíz, etc.).
        window.location.href = "sucursales/";
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

function mostrar_key(){
        const KEY  = $('#clave');
        const ICON = $('#btnEye');
        if (KEY.attr("type") === "text") {
            KEY.attr("type", "password");
            KEY.attr("placeholder", "••••••••••");
            ICON.html('<i data-lucide="eye"></i>');
        } else {
            KEY.attr("type", "text");
            KEY.attr("placeholder", "Contraseña");
            ICON.html('<i data-lucide="eye-off"></i>');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
}

