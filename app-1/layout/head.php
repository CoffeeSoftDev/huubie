<!-- TAILWIND CDN (debe cargarse antes que Bootstrap CSS para mantener cascada correcta) -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Evita el salto de layout al abrir modales (bootbox/Bootstrap). El gutter reserva
     el ancho de la scrollbar de forma permanente y se anula la compensacion que
     Bootstrap inyecta en el <body>, que era lo que desplazaba el contenido de fondo. -->
<style>
    html { scrollbar-gutter: stable; }
    body.modal-open { padding-right: 0 !important; }
</style>

<!-- FONTELLO -->
<link rel="stylesheet" href="/app/src/plugins/fontello/css/fontello.css" />

<!-- SWEETALERT -->
<link rel="stylesheet" href="/app/src/plugins/sweetalert2/sweetalert2.min.css" />

<!-- SWEETALERT - tono oscuro Huubie (aplica a todos los swalQuestion / Swal.fire) -->
<style>
    .swal2-popup { background-color: #1F2A37 !important; color: #fff !important; }
    .swal2-title { color: #fff !important; }
    .swal2-html-container { color: #D1D5DB !important; }
    .swal2-close { color: #9CA3AF !important; }
    .swal2-popup .swal2-input,
    .swal2-popup .swal2-textarea,
    .swal2-popup .swal2-select {
        background-color: #111928 !important;
        color: #fff !important;
        border: 1px solid #374151 !important;
    }
</style>

<!-- DATATABLES -->
<link rel="stylesheet" href="/app/src/plugins/datatables/1.13.6/css/dataTables.bootstrap5.min.css" />

<!-- DATERANGEPICKER -->
<link rel="stylesheet" href="/app/src/plugins/daterangepicker/daterangepicker.css" />

<!-- BOOTSTRAP CSS (al final para que pise reglas residuales de Tailwind cuando aplique) -->
<link rel="stylesheet" href="/app/src/plugins/bootstrap-5/css/bootstrap.min.css" />

<!-- COFFEESOFT THEME (despues de Bootstrap para sobreescribir variables y hovers) -->
<link rel="stylesheet" href="/app/src/css/colors.css" />
<link rel="stylesheet" href="/app/src/css/buttons.css" />
