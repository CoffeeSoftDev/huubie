window.link = "acceso/ctrl/ctrl-index.php";


$(() => {
    formulario();
    
    $('#form_login').validation_form({opc:"login"},(datos)=>{
        send_ajax(datos,link).then(data=>storage(data));
    });

    $('#btnEye').on("click",()=>mostrar_key());
});

function storage(data) {
    console.log(data);
    if(data != false){
        localStorage.clear();
        sessionStorage.clear();
        const HREF = new URL(window.location.href);
        const HASH = HREF.pathname.split("/").filter(Boolean);
        const ERP = HASH[0];
    
        // window.location.href = HREF.origin + "/" + ERP + "/"+data.ruta;
        window.location.href = HREF.origin + "/" + ERP + "/operacion/almacen/";
    } else {
        alert({icon:'error',title:'Usuario y/o clave incorrectos.',btn1:true});
    }
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
        const KEY = $('#clave');
        if (KEY.attr("type") === "text") {
            KEY.attr("type", "password");
            KEY.attr("placeholder", "••••••••••");
            $(this).html('<i class="icon-eye"></i>');
        } else {
            KEY.attr("type", "text");
            KEY.attr("placeholder", "Contraseña");
            $(this).html('<i class="icon-eye-off"></i>');
        }
}

