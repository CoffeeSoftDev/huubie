// Definir los datos de las tarjetas
const tarjetas = [
    {
      titulo: "Empresas",
      descripcion: "",
      imagen: "/alpha/src/img/empresas.svg",
      enlace: "/alpha/empresas/",
      padding:"p-2"
    },
    {
      titulo: "Usuarios",
      descripcion: "Dar de alta un nuevo usuario",
      imagen: "/alpha/src/img/usuarios.svg",
      enlace: "/alpha/usuarios/",
      padding:"p-2"
    },
  ];
  
  // Instanciar la clase y generar las tarjetas
  $(() => {
    const card = new Cards("#grid-card", tarjetas);
    card.render();
  });
  