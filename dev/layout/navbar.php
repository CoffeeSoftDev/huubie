<?php 
    $imgPerfil = "/dev/src/img/df-user.png";
    $logo      = "/dev/src/img/logo/logos.svg";
?>
<!-- Navbar -->
<nav
    class="bg-[#003360] fixed top-0 left-0 w-full text-white px-4 py-3 h-16 z-50 shadow flex items-center justify-between">
    <!-- Logo -->
    <div class="flex items-center space-x-2">
        <img src="/dev/src/img/logo/logo.svg" alt="Logo" class="w-10 h-10" />
        <button id="toggleSidebar" class="text-white text-2xl">☰</button>
        
    </div>

    <!-- Opciones del centro -->
    <ul class="hidden md:flex flex-1 justify-end space-x-6">
        <!-- <li><a href="#" class="hover:text-gray-400">Inicio</a></li>
        <li><a href="#" class="hover:text-gray-400">Servicios</a></li>
        <li><a href="#" class="hover:text-gray-400">Contacto</a></li> -->
    </ul>

    <!-- Imagen de usuario -->
    <button id="btnUserMenu" class="ml-2 flex items-center justify-center  border-l border-gray-500 pl-2">
        <img src="<?php echo $imgPerfil; ?>" alt="Usuario"
            class="w-10 h-10 rounded-full border-2 border-white" />
    </button>
</nav>

<!-- Contenedor de opciones de usuario -->
<div class="relative mt-16 z-50">
    <!-- Menú de perfil -->
    <div id="userMenuDropdown"
        class="absolute right-0 w-64 bg-[#] text-white rounded-2xl shadow-lg opacity-0 scale-95 invisible transition-all duration-500 ease-out">
        <!-- Imagen de perfil -->
        <div class="flex flex-col items-center bg-[#1F2A37] pb-2">
            <img src="<?php echo $imgPerfil; ?>" alt="Usuario"
                class="w-20 h-20 relative rounded-full border-4 border-gray-500 shadow-md" />
            <h2 class="text-white text-lg font-medium mt-2">Luis García Valera</h2>
        </div>

        <!-- Opciones del menú -->
        <div class="w-full text-center space-y-2 mt-4">
            <p class="text-gray-300 font-bold">Configuración</p>
            <p class="text-gray-400 hover:text-white cursor-pointer">Mi Perfil</p>
            <p class="text-gray-400 hover:text-white cursor-pointer">Ajustes</p>
            <p class="text-gray-400 hover:text-white cursor-pointer" id="btnLogout">Cerrar Sesión</p>
        </div>

        <!-- Botón de cerrar -->
        <button class="w-full bg-blue-600 hover:bg-green-600 text-white py-2 rounded-lg mt-4"
            id="btnCloseMenu">Cerrar</button>
    </div>
</div>