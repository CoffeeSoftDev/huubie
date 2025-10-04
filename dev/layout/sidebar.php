<!-- Sidebar -->
<style>
/* Aseguramos que los submenús estén colapsados al inicio */
.submenu ul {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-in-out;
}

#sidebar {
    scrollbar-width: none;
}
</style>
<script src="https://cdn.tailwindcss.com"></script>
<div id="sidebar"
    class="mt-14 fixed top-0 left-0 h-[calc(100vh-3.5rem)] bg-[#1F2A37] w-full md:w-72 transform -translate-x-full transition-transform duration-500 ease-in-out z-40 overflow-y-auto [&::-webkit-scrollbar]:hide">
    <!-- Contenido del sidebar -->
    <ul class="space-y-4 p-6" id="menuSidebar">
        <li><a href="#" class="text-white hover:text-gray-400">Resumen</a></li>
        <li class="text-gray-400 submenu">
            <button class="w-full text-left flex justify-between hover:text-white ">Suceso
                <span class="text-sm">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </span>
            </button>
            <ul class="mt-2 pl-4 space-y-2 max-h-0 overflow-hidden transition-all duration-300 ease-in-out">
                <li><a href="/dev/eventos" class="hover:text-white block w-full">Eventos</a></li>
                <li><a href="/dev/pedidos" class="hover:text-white block w-full">Pedido</a></li>
                <li><a href="/dev/reservaciones" class="hover:text-white block w-full">Reservaciones</a></li>
                <li><a href="/dev/calendario" class="hover:text-white block w-full">Calendario</a></li>
            </ul>
        </li>
    </ul>
</div>