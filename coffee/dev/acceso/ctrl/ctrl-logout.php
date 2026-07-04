<?php
session_start();
session_unset();
session_destroy();

setcookie("IDU", "", time() - 3600, "/");
setcookie("company_id", "", time() - 3600, "/");

echo "<script>
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/huubie/coffee/dev/';
</script>";
