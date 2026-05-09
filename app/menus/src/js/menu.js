// Definir los datos de las tarjetas
const tarjetas = [
    {
      titulo: "Ventas",
      descripcion: "Lleva el control de todas tus ventas",
      imagen: "/alpha/src/img/ventas.svg",
      enlace: "/alpha/ventas/",
      padding:"p-2"
    },
    {
      titulo: "Configuración",
      descripcion: "Optimiza el sistema",
      imagen: "/alpha/src/img/configuracion.svg",
      enlace: "/alpha/configuracion/",
      padding:"p-2"
    },
  ];
  
  // Instanciar la clase y generar las tarjetas
  $(() => {
    const card = new Cards("#grid-card", tarjetas);
    card.render();
  });
  