// vibe coding
let app;
const api = "/alpha/admin/ctrl/ctrl-perfil.php";

$(() => {
    app = new Perfil(api, "root");
    app.render();
});

class Perfil extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Perfil";
        this.dataUser = [];
    }

    render() {
        this.layout();
    }

    layout() {
        this.primaryLayout({
            parent: `root`,
            id: this.PROJECT_NAME,
            class: 'd-flex mx-2 my-2 h-100 mt-5 p-2',
            card: {
                filterBar: { class: 'w-full my-3', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full my-3 bg-[#1F2A37] rounded-lg p-3', id: 'container' + this.PROJECT_NAME }
            }
        });
        this.layoutPerfil();
    }

    layoutPerfil() {
        let container = $('#container' + this.PROJECT_NAME);

        container.html(`
            <div class="p-4 border-b border-slate-700/50">
                <p class="text-white text-2xl font-bold">Información Personal</p>
                <p class="text-slate-400 text-sm">Tu información básica y datos de contacto</p>
            </div>

            <div class="p-4 space-y-8">
                <div class="grid md:grid-cols-[250px_1fr] gap-8">
                    <div class="flex flex-col items-center gap-4">
                        <div class="relative">
                            <div class="w-48 h-48 rounded-full bg-slate-700 border-4 border-slate-600 flex items-center justify-center overflow-hidden">
                                <img
                                    src="https://huubie.com.mx/alpha/src/img/df-user.png"
                                    alt="Foto de perfil"
                                    class="w-full h-full object-cover"
                                    id="photo"
                                />
                            </div>
                            <button class="absolute bottom-2 right-2 rounded-full w-10 h-10 p-0 bg-blue-700 hover:bg-blue-800 flex items-center justify-center" id="btnEditPhoto">
                                <i class="icon-pencil text-white text-sm"></i>
                            </button>
                            <input type="file" accept="image/*" id="inputPhotoUpload" class="hidden" />
                        </div>

                        <div class="flex gap-2">
                            <span class="bg-[#52B8FB] hover:bg-[#AFDEFD] text-gray-900 text-xs px-3 py-1 rounded" id="rol">Rol</span>
                        </div>
                    </div>

                    <div class="space-y-6">
                        <div class="grid md:grid-cols-2 gap-6">
                            <label class="flex flex-col gap-1.5">
                                <span class="flex items-center gap-2 text-slate-300">
                                    <i class="icon-building"></i> Empresa y sucursal
                                </span>
                                <input class="bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded" placeholder="Empresa" disabled id="business" />
                            </label>
                            <label class="flex flex-col gap-1.5">
                                <span class="flex items-center gap-2 text-slate-300">
                                    <i class="icon-location"></i> Ubicación sucursal
                                </span>
                                <input class="bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded" placeholder="Ciudad, País" disabled id="location"/>
                            </label>
                            <label class="flex flex-col gap-1.5">
                                <span class="flex items-center gap-2 text-slate-300">
                                    <i class="icon-user"></i> Nombre completo
                                </span>
                                <input class="bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded" placeholder="Nombre completo" id="fullname"/>
                            </label>
                            <label class="flex flex-col gap-1.5">
                                <span class="flex items-center gap-2 text-slate-300">
                                    <i class="icon-user"></i> Usuario
                                </span>
                                <input class="bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded" placeholder="Nombre usuario" id="user"/>
                            </label>
                        

                            <label class="flex flex-col gap-1.5">
                                <span class="flex items-center gap-2 text-slate-300">
                                    <i class="icon-phone"></i> Teléfono
                                </span>
                                <input type="tel" class="bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded" placeholder="+52 900 000 000" id="phone"/>
                            </label>

                            <label class="flex flex-col gap-1.5 relative">
                                <span class="flex items-center gap-2 text-slate-300">
                                    <i class="icon-calendar"></i> Fecha de nacimiento
                                </span>
                                <input type="date" class="bg-slate-700/50 border border-slate-600 text-white px-3 py-2 rounded w-full" id="birthday"/>
                            </label>
                        </div>

                        <div class="pt-4 flex justify-end">
                            <button class="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded" id="btnEnviarForm" onclick="app.editUser()">Guardar cambios</button>
                        </div>
                    </div>
                </div>
            </div>
            `
        );

        // Activar input file al hacer clic en el botón
        $('#btnEditPhoto').on('click', function () {
            $('#inputPhotoUpload').click();
        });

        // Mostrar imagen seleccionada
        $('#inputPhotoUpload').on('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const url = URL.createObjectURL(file);
            $('#photo').attr('src', url);
        });

        this.renderPerfil();
    }

    async renderPerfil() {
        let dataUsuario = await useFetch({ url: this._link, data: { opc: 'getUser' } });
        this.dataUser = dataUsuario;
        if (this.dataUser.status == 200) {
            // Rellenar los campos del perfil
            $('#rol').text(dataUsuario.data.rol);
            $('#photo').attr('src', dataUsuario.data.photo || "https://huubie.com.mx/alpha/src/img/df-user.png");
            $('#business').val(dataUsuario.data.company + '/ ' + dataUsuario.data.subsidiary || "No disponible");
            $('#location').val(dataUsuario.data.ubication || "No disponible");
            $('#fullname').val(dataUsuario.data.fullname || "No disponible");
            $('#user').val(dataUsuario.data.user || "No disponible");
            $('#phone').val(dataUsuario.data.phone || "");
            $('#birthday').val(dataUsuario.data.birthday || "");

        } else {
            alert({ icon: "error", title: "Oops!...", text: this.dataUser.message, btn1: true, btn1Text: "Ok" });
        }
    }

    editUser() {
        $('#btnEnviarForm').prop('disabled', true); // Deshabilitar el botón para evitar múltiples envíos
        // Validar campos requeridos
        if (!$('#fullname').val().trim() || !$('#user').val().trim() ) {
            alert({ icon: "warning", title: "Campos incompletos", text: "Por favor, completa todos los campos requeridos.", btn1: true, btn1Text: "Ok" });
            return;
        }
        // Validar formato de teléfono
        if ($('#phone').val().trim()) {
            const phonePattern = /^\+?\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/;
            if (!phonePattern.test($('#phone').val().trim())) {
                alert({ icon: "warning", title: "Teléfono inválido", text: "Por favor, ingresa un número de teléfono válido.", btn1: true, btn1Text: "Ok" });
                return;
            }
        }
        // Validar formato de fecha
        if ($('#birthday').val().trim()) {
            const birthdayPattern = /^\d{4}-\d{2}-\d{2}$/;
            if (!birthdayPattern.test($('#birthday').val().trim())) {
                alert({ icon: "warning", title: "Fecha inválida", text: "Por favor, ingresa una fecha de nacimiento válida.", btn1: true, btn1Text: "Ok" });
                return;
            }
        }
        // Validar que el nombre de usuario solo contenga letras, números y guiones bajos
        const userPattern = /^[a-zA-Z0-9_]+$/;
        if (!userPattern.test($('#user').val().trim())) {
            alert({ icon: "warning", title: "Usuario inválido", text: "El nombre de usuario solo puede contener letras, números y guiones bajos.", btn1: true, btn1Text: "Ok" });
            return;
        }

        Swal.fire({
            title: 'Procesando...',
            text: 'Por favor, espera un momento. 😊',
            background: '#1f2937', // slate-800
            color: '#f9fafb',       // gray-50
            allowOutsideClick: false,
            customClass: {
                popup: 'rounded-lg shadow-lg',
                title: 'text-white text-lg',
                htmlContainer: 'text-gray-300',
                confirmButton: 'bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded mt-4',
            },
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const formData = new FormData();
        formData.append('opc', 'editUser');
        formData.append('fullname', $('#fullname').val().trim());
        formData.append('user', $('#user').val().trim());
        formData.append('phone', $('#phone').val().trim());
        formData.append('birthday', $('#birthday').val().trim());

        const file = $('#inputPhotoUpload')[0].files[0];
        if (file) {
            formData.append('photo', file); // ✅ Asegura que sea con el mismo nombre usado en PHP ($_FILES['photo'])
        }

        // Enviar con fetch directamente (ya que useFetch no soporta archivos por defecto)
        fetch(this._link, {
            method: 'POST',
            body: formData
        })
            .then(res => res.json())
            .then(response => {
                Swal.close();
                if (response.status == 200) {
                    alert({ icon: "success", title: "Éxito", text: response.message, btn1: true, btn1Text: "Ok" });
                    $("#btnEnviarForm").prop('disabled', false);
                } else {
                    alert({ icon: "error", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                    $("#btnEnviarForm").prop('disabled', false);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert({ icon: "error", title: "Error", text: "No se pudo completar la solicitud." });
            });
    }

}
