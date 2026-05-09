$(() => {
  initSidebar();
  initUserMenu();
});

function initUserMenu() {
  const USER_MENU_DROPDOWN = $("#userMenuDropdown");
  const USER_MENU_BTN = $("#btnUserMenu");
  const CLOSE_MENU = $("#btnCloseMenu");
  const BTN_LOGOUT = $("#btnLogout");

  BTN_LOGOUT.on("click", () => logout());

  USER_MENU_BTN.on("click", () => {
    USER_MENU_DROPDOWN.toggleClass("opacity-0 scale-95 invisible");
  });

  CLOSE_MENU.on("click", () => {
    USER_MENU_DROPDOWN.addClass("opacity-0 scale-95 invisible");
  });

  // Cerrar menú si se hace clic fuera de él
  $(document).on("click", (event) => {
    if (
      !USER_MENU_DROPDOWN.is(event.target) &&
      !USER_MENU_BTN.is(event.target) &&
      !USER_MENU_BTN.has(event.target).length
    ) {
      USER_MENU_DROPDOWN.addClass("opacity-0 scale-95 invisible");
    }
  });
}

function initSidebar() {
  const BTN_TOGGLE_SIDEBAR = $("#toggleSidebar");
  const SIDEBAR = $("#sidebar");
  const SUBMENUS = $(".submenu");

  // Mostrar u ocultar el sidebar al hacer clic en el botón
  BTN_TOGGLE_SIDEBAR.on("click", function () {
    SIDEBAR.toggleClass("-translate-x-full"); // Alternar visibilidad
    if (SIDEBAR.hasClass("-translate-x-full"))
      $("#mainContainer").removeClass("md:ml-72 md:w-[calc(100%-18rem)]");
    else $("#mainContainer").addClass("md:ml-72 md:w-[calc(100%-18rem)]");
  });

  // Inicializar los submenús
  SUBMENUS.each(function () {
    const SUBMENU = $(this);
    const BUTTON = SUBMENU.find("button");
    const LIST = SUBMENU.find("ul");
    const ARROW = BUTTON.find("svg"); // Selecciona el ícono de la flecha

    // Establecer max-height en 0 para submenú cerrado y transición
    LIST.css("max-height", "0px").css(
      "transition",
      "max-height 0.3s ease-in-out",
    );

    BUTTON.on("click", function (event) {
      // Evitar que el clic en el botón cierre el submenú
      event.stopPropagation();

      // Cerrar todos los submenús excepto el actual
      SUBMENUS.each(function () {
        const OTHER_SUBMENU = $(this);
        const OTHER_LIST = OTHER_SUBMENU.find("ul");
        const OTHER_ARROW = OTHER_SUBMENU.find("button svg");
        if (OTHER_SUBMENU[0] !== SUBMENU[0]) {
          OTHER_LIST.css("max-height", "0"); // Cerrar otros submenús
          OTHER_ARROW.removeClass("rotate-180");
        }
      });

      // Abrir o cerrar el submenú actual
      const IS_OPEN = LIST.css("max-height") !== "0px"; // Verificar si ya está abierto

      if (IS_OPEN) {
        LIST.css("max-height", "0"); // Ocultar
        ARROW.removeClass("rotate-180"); // Quitar la rotación
      } else {
        LIST.css("max-height", LIST[0].scrollHeight + "px"); // Mostrar
        ARROW.addClass("rotate-180"); // Agregar la rotación
      }
    });
  });
}

function logout() {
  question({
    title: "¿Esta seguro?",
    text: "Estas a punto de cerrar tu sesión actual.",
    confirm: () => (window.location.href = ".././"),
  });
}

function question(options) {
  const defaults = {
    icon: "question",
    title: "¿Lorem Ipsum?",
    text: "Lorem ipsum alsdkjair",
    showCancelButton: true,
    cancelButtonText: "Cancelar",
    confirmButtonText: "Continuar",
    backdrop: "rgba(0, 0, 0, 0.8)",
    customClass: {
      popup: "bg-[#1F2A37] text-white rounded-lg shadow-lg", // Fondo oscuro y bordes redondeados
      title: "text-2xl font-semibold", // Estilo del título
      content: "text-gray-300", // Estilo del texto
      confirmButton:
        "bg-[#1C64F2] hover:bg-[#0E9E6E] text-white py-2 px-4 rounded", // Estilo del botón de confirmar
      cancelButton:
        "bg-transparent text-white border border-gray-500 py-2 px-4 rounded hover:bg-[#111928]", // Estilo del botón de cancelar
    },
    background: "#111928", // Fondo más oscuro
    allowOutsideClick: false, // Permitir que se cierre al hacer clic fuera
    allowEscapeKey: false, // Permitir que se cierre con la tecla Escape
  };

  const json = Object.assign(defaults, options);

  Swal.fire(json).then((result) => {
    if (result.isConfirmed) json.confirm();
  });
}

function redireccion(page) {
  window.location.href = page;
}
