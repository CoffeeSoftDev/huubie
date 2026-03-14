<?php
    $imgPerfil = "/alpha/src/img/df-user.png";
    $logo      = "/alpha/src/img/logo/logo.svg";
?>
<!-- Navbar -->
<nav class="navbar fixed top-0 left-0 w-full text-white px-4 py-0 h-16 z-50 shadow flex items-center justify-between">
    <!-- Logo + Hamburger -->
    <div class="flex items-center space-x-4">
        <span class="navbar-logo text-xl font-bold tracking-wide">hb<span class="dot">●</span></span>
        <button id="toggleSidebar" class="text-white text-2xl">☰</button>
    </div>

    <!-- Spacer -->
    <div class="flex-1"></div>

    <!-- Acciones derecha -->
    <div class="flex items-center space-x-4">
        <!-- Grid icon -->
        <button class="navbar-icon text-xl">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                <circle cx="3.5" cy="3.5" r="1.5"/>
                <circle cx="12.5" cy="3.5" r="1.5"/>
                <circle cx="3.5" cy="12.5" r="1.5"/>
                <circle cx="12.5" cy="12.5" r="1.5"/>
            </svg>
        </button>

        <!-- Usuario -->
        <button id="btnUserMenu" class="flex items-center space-x-3">
            <div class="navbar-avatar w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm">
                u
            </div>
            <div class="hidden md:flex flex-col items-start leading-tight">
                <span class="navbar-user-name text-sm font-medium">Admin Usuario</span>
                <span class="navbar-user-status text-xs">EN LÍNEA</span>
            </div>
        </button>
    </div>
</nav>

<!-- Contenedor de opciones de usuario -->
<div class="relative mt-16 z-50">
    <!-- Menú de perfil -->
    <div id="userMenuDropdown"
        class="navbar-dropdown absolute right-0 w-64 text-white rounded-2xl shadow-lg opacity-0 scale-95 invisible transition-all duration-500 ease-out">
        <!-- Imagen de perfil -->
        <div class="navbar-dropdown-header flex flex-col items-center pb-2">
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