$(() => generarTarjetas());

const tarjetas = [
  {
    titulo: "Eventos",
    descripcion: "Administrar eventos",
    imagen: "src/img/evento2.png",
    enlace: "/alpha/eventos",
  },
  {
    titulo: "Pedidos",
    descripcion: "Administrar pedidos",
    imagen: "src/img/pedido.png",
    enlace: "/alpha/pedidos",
  },
  {
    titulo: "Reservación",
    descripcion: "Realizar una reservación",
    imagen: "src/img/reserved2.png",
    enlace: "/alpha/reservaciones",
  },
  {
    titulo: "Calendario",
    descripcion: "",
    imagen: "src/img/calendar.png",
    enlace: "/alpha/calendario",
  },
];

// Función para generar las tarjetas dinámicamente
function generarTarjetas() {
  let contenedor = $("#grid-card"); // Selecciona el contenedor
  contenedor.empty(); // Limpia el contenido previo

  tarjetas.forEach((item) => {
    let card = `
              <div class="w-64 h-64 bg-[#333D4C] rounded-lg shadow-lg overflow-hidden p-4 flex flex-col justify-between cursor-pointer"
                  onclick="window.location.href='${item.enlace}'">
                  <img class="w-24 h-24 p-2 bg-[#233876] object-cover rounded-lg mx-auto" src="${item.imagen}" alt="${item.titulo}">
                  <div class="flex-grow flex flex-col justify-center text-center">
                      <h2 class="text-lg font-semibold text-white">${item.titulo}</h2>
                      ${item.descripcion ? `<p class="mt-2 text-gray-200">${item.descripcion}</p>` : ""}
                  </div>
              </div>
          `;
    contenedor.append(card);
  });
}
