window.ctrl = 'ctrl/ctrl-usuarios.php';
window.lsPerfiles = []; 

$(()=>{
    initComponent();
    $('#btnUsuario').on('click',()=>crear_usuario());
});

function initComponent(){
    let datos = new FormData();
    datos.append('opc','initComponent');
    send_ajax(datos,ctrl).then(data=>{
        lsPerfiles = data.perfiles;
        tbUser(data.usuarios);
    });
}

function tbUser(json){
    tbody = [];
    
    for(const x of json) {
        tbody.push([
                {html:x.perfil},
                {html:x.usser},
                {html:"<button class='btn btn-sm btn-outline-danger'><i class='icon-toggle-on'></i></button>",class:'text-center'},
            ]);
    };
    
    let table = {
            table:{id:'tbUsuarios'},
            thead:'Perfil,Usuario,Opciones',
            tbody
        };
    
    $('#tbDatos').html('').create_table(table);
    $('#tbUsuarios').table_format();
}

function crear_usuario(){
    let form = $('<form>',{id:'usr_form',novalidate:true});
    
    formulario = [
        {
            lbl: "Perfil",
            elemento: "select",
            class: "text-uppercase",
            div:{class:'col-12 mb-3'},
            name:'usr_perfil',
            required: true,
            option: { data: {}, placeholder: "- Seleccionar -" },
        },
        {
            lbl: "Usuario",
            elemento: "input-group",
            name:'usser',
            required: true,
            div:{class:'col-12 mb-3'},
            icon: "<i class='icon-user'></i>",
        },
        {
            lbl: "Contraseña",
            elemento: "input-group",
            required: true,
            id:'clave',
            name:'keey',
            div:{class:'col-12 mb-3'},
            icon: "<i class='icon-key'></i>,<i class='icon-eye'></i>",
            span:[{onClick:'generarKey()'},{id:'eye',onClick:'mostrarKey()'}],
        },
        {
            elemento:'modal_button'
        }
    ];
    
    form.html('').create_elements(formulario);
    
    bootbox
        .dialog({
            title: "TITULO",
            message: form,
            closeButton:true
        })
        .on("shown.bs.modal", function () {
            $('#usr_form').validation_form({opc:"create"},(datos)=>{
                send_ajax(datos,ctrl).then(data=>{
                    if(data === true) {
                        alert();
                        initComponent();
                        $('.bootbox-close-button').click();
                    }
                    else console.log(data);
                });
            });
        });
        
    $('#perfil').option_select({data:lsPerfiles,placeholder:'- SELECCIONAR -'});
}


function generarKey() {
    const caracteres = "0123456789";

    const cadenaAleatoria = Array.from({ length: 6 }, () =>
        caracteres.charAt(Math.floor(Math.random() * caracteres.length))
    ).join("");

    $("#clave").val(cadenaAleatoria);
    $("#clave").prop("type", "text");
    $("#eye").html('<i class="icon-eye-off"></i>');
}

function mostrarKey() {
    const INPUT = $("#clave");

    INPUT.prop("type", INPUT.prop("type") === "text" ? "password" : "text");

    iconEye = INPUT.prop("type") === "text" ? "icon-eye-off" : "icon-eye";
    $("#eye").html(`<i class="${iconEye}"></i>`);
}
