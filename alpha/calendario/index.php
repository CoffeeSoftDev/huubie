<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="../src/img/logo/logo.ico" />
    <title>Alpha</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <!-- icons -->
    <link rel="stylesheet" href="../src/plugins/fontello/css/fontello.css" />
    <link rel="stylesheet" href="src/css/style.css" />
    <link rel="stylesheet" href="src/css/buttons.css" />
    <link rel="stylesheet" href="src/css/colors.css" />
    <link rel="stylesheet" href="src/plugins/sweetalert2/sweetalert2.min.css" />
    <script src="src/plugins/sweetalert2/sweetalert2.all.min.js"></script>

    <!--BOOTBOX-->
    <script src="src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="src/plugins/moment.js"></script>
    
    <script src="src/plugins/bootbox.min.js"></script>
    <script src="src/js/complementos.js"></script>
    <script src="src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/coffeSoft.js?t=<?php echo time(); ?>"></script>

    <!-- datables -->
    <link rel="stylesheet" href="https://15-92.com/ERP3/src/plugin/datatables/1.13.6/css/dataTables.bootstrap5.min.css">
    <link rel="stylesheet" href="src/plugin/datatables/1.13.6/css/dataTables.bootstrap5.min.css">

    <!-- datatables -->
    <script src="src/plugins/datatables/datatables.min.js"></script>
    <script src="src/plugins/datatables/dataTables.responsive.min.js"></script>
    <script src="src/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script> 

    <!-- datarange picker -->
    <!-- <link rel="stylesheet" href="../src/css/app.css" /> -->

    <!-- datarange picker -->
    <link rel="stylesheet" href="src/plugins/daterangepicker/daterangepicker.css" />

    <link rel="stylesheet" href="src/plugins/bootstrap-5/css/bootstrap.min.css" />
    <script src="src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>


        <!--ANIMATE-->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.0.0/animate.compat.css"/>
    <!-- rrule lib -->
    <script src='https://cdn.jsdelivr.net/npm/rrule@2.6.4/dist/es5/rrule.min.js'></script>
    <!-- FULL CALENDAR -->
    <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.14/index.global.min.js'></script>
    <!-- FULL CALENDAR LOCALE -->
    <script src='https://cdn.jsdelivr.net/npm/@fullcalendar/moment@6.1.14/index.global.min.js'></script>
    <!-- the rrule-to-fullcalendar connector. must go AFTER the rrule lib -->
    <script src='https://cdn.jsdelivr.net/npm/@fullcalendar/rrule@6.1.14/index.global.min.js'></script>
  

    <!-- <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"> -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/js/all.min.js"></script>

</head>

<body data-bs-theme="dark">
    <?php
            require_once("../layout/navbar.php");
            require_once("../layout/sidebar.php");
        ?>
    <div id="mainContainer2"
        class="w-full h-[calc(100vh)] transition-all duration-500 bg-[#111928] text-white ">
        <div style="background-color:#111827;" id="root2">

        </div>
    </div>

    <!-- Data range picker -->
    <script src="src/plugins/daterangepicker/moment.min.js"></script>
    <script src="src/plugins/daterangepicker/daterangepicker.js"></script>


    <!-- Init -->
    <script src="eventos/src/js/app.js?t=<?php echo time(); ?>"></script>
    <script src="eventos/src/js/eventos.js?t=<?php echo time(); ?>"></script>
    <script src="eventos/src/js/payment.js?t=<?php echo time(); ?>"></script>
  
    <script src="eventos/src/js/calendario.js?t=<?php echo time(); ?>"></script>


    <script>
        
  
       
       

    </script>
</body>

</html>