<?php
    setcookie("IDU", "", time() - 3600, "/");
    setcookie("IDP", "", time() - 3600, "/");

    echo "<script>
            const HREF = new URL(window.location.href);
            const HASH = HREF.pathname.split('/').filter(Boolean);
            const ERP = HASH[0];

            localStorage.clear();
            sessionStorage.clear();
            
            window.location.href = HREF.origin + '/inventory/' ;
    </script>";
?>