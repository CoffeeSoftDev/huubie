<?php
if(isset($_COOKIE['IDU'])){
    echo '<script> 
        let ruta = localStorage.getItem("url");
        const MODELO = ruta.split("/").filter(Boolean)[0];
        const HREF = new URL(window.location.href);
        const ERP = HREF.pathname.split("/").filter(Boolean)[0];
        const RUTA = HREF.origin + "/" + ERP + "/" + ruta;
        window.location.href = HREF.origin + "/" + ERP + "/" + ruta;
    </script>';
}
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link rel="shortcut icon" href="src/img/logos/logo_icon.png" type="image/x-icon">
    <title>CoffeeInventory - Iniciar sesión</title>
    <link rel="stylesheet" href="src/plugin/fontello/css/fontello.css">
    <link rel="stylesheet" href="src/plugin/fontello/css/animation.css">
    <link rel="stylesheet" href="src/plugin/bootstrap-5/css/bootstrap.min.css">
    <link rel="stylesheet" href="src/plugin/sweetalert2/sweetalert2.min.css">
    <link rel="stylesheet" href="src/css/index.css">
    <script src="https://cdn.tailwindcss.com"></script>
</head>

<body>
    <div class="login-container">
        <div class="left-panel">
            <div class="brand">
                <img class='w-14 h-14' src='src/img/logos/coffee_icon.png' alt="CoffeeInventory Logo" />
                <span>CoffeeInventory</span>
            </div>
            <div class="left-content">
                <h1>Gestión de inventario</h1>
                <p>Controla tu inventario y mantén tu negocio siempre abastecido.</p>
            </div>
            <div class="footer-text">
                
            </div>
        </div>
        <div class="right-panel">
            <div class="login-form-wrapper">
                <div class="mobile-brand">
                    <div class="mobile-logo-circle border border-2">
                        <img class='mobile-logo-img' src='src/img/logos/20.png' alt="CoffeeInventory Logo" />
                    </div>
                    <span class="mobile-brand-text">Coffee <span class="">Inventory</span></span>
                </div>
                <form id="form_login" novalidate>
                    <h2>Bienvenido de nuevo</h2>
                    <p class="subtitle">Ingresa tus credenciales para acceder a tu cuenta</p>
                    
                    <div class="form-group">
                        <label for="usuario">Correo electrónico</label>
                        <input type="email" class="form-control" name="usuario" id="usuario" placeholder="nombre@empresa.com" required autocomplete="email">
                    </div>
                    
                    <div class="form-group">
                        <!-- <div class="label-row">
                            <label for="clave">Contraseña</label>
                            <a href="#" class="forgot-link">¿Olvidaste tu contraseña?</a>
                        </div> -->
                        <div class="password-wrapper">
                            <input type="password" class="form-control" name="clave" id="clave" placeholder="••••••••" required autocomplete="current-password">
                            <span class="eye-icon" id="btnEye"><i class="icon-eye"></i></span>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn-login">Iniciar sesión</button>
                </form>
              
            </div>
        </div>
    </div>


    <script src="src/plugin/jquery/jquery-3.7.0.min.js"></script>
    <script src="src/plugin/bootstrap-5/js/bootstrap.min.js"></script>
    <script src="src/plugin/bootbox.min.js"></script>
    <script src="src/plugin/sweetalert2/sweetalert2.all.min.js"></script>
    <script src="src/js/complementos.js"></script>
    <script src="src/js/plugin-forms.js"></script>

    <script src="acceso/src/js/index.js?t=<?php echo time(); ?>"></script>
</body>

</html>