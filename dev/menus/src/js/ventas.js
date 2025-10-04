// Definir los datos de las tarjetas
const tarjetas = [
//   {
//     titulo: "Evento",
//     descripcion: "Dar de alta un nuevo evento",
//     imagen: "/alpha/src/img/eventos.svg",
//     enlace: "/alpha/eventos/",
//     padding:""
//   },
  {
    titulo: "Pedido",
    descripcion: "Dar de alta un nuevo pedido",
    imagen: "/dev/src/img/pedidos.svg",
    enlace: "/dev/pedidos/",
    padding:"p-2"
  },
  {
    titulo: "Dashboard",
    descripcion: "Consulta los indicadores clave de rendimiento",
    imagen: "/alpha/src/img/calendario.svg",
    enlace: "/dev/dashboard/",
    padding:""
  },
//   {
//     titulo: "Administración",
//     descripcion: "Agrega, edita o elimina tus catálogos",
//     imagen: "/alpha/src/img/configuracion.svg",
//     enlace: "/alpha/catalogos/",
//     padding:""
//   }
];

// Instanciar la clase y generar las tarjetas
$(() => {
  const card = new Cards("#grid-card", tarjetas);

  card.render();
});
