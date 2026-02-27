<?php
    /**
     * CONTROLADOR QUE MANEJA LA URL DEL PROYECTO
     * SE UTILAZARÁ PARA HACER REDIRECCIONES.
     */

    /**
     * 1.- VALIDAR SI EL DOMINIO TIENE HTTP O HTTPS USANDO $_SERVER['HTTPS']
     * 2.- OBTENER EL HOST O DOMINIO USANDO $_SERVER['HTTP_HOST']
     * 3.- COMO DIRECTORIO FINAL SE AGREGA EL NOMBRE DE LA CARPETA DEL PROYECTO
     */
     $url = 'http://'.$_SERVER['HTTP_HOST']."/ERP2";
    if ( isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] == 'on' ) {
        $url = 'https://'.$_SERVER['HTTP_HOST']."/ERP2";
    }
    
    // 1.- OBTENER LOS DIRECTORIOS USADOS EN EL MOMENTO POR EL DOMINIO
    $hash = trim($_SERVER['REQUEST_URI'],'/');

    // 2.- CONVERTIR EN ARRAY LOS DIRECTORIOS USANDO COMO SEPARADOR EL "/"
    $folders = explode('/', $hash);

    // 3.- ELIMINAR POR DEFECTO LA PRIMERA POSICIÓN DEL ARRAY, QUE AGREGAMOS MANUALMENTE.
    array_shift($folders);

    // 4.- BUSCAR UN "." USANDO "strpos() [string position]" EN LA ULTIMA POSICIÓN DEL ARRAY "end()".
    $file = '';
    if (strpos(end($folders), '.') !== false) {
        // 4.1.- SI ES UN ARCHIVO, ELIMINAR LA ÚLTIMA POSICIÓN USANDO "array_pop()".
        $file = array_pop($folders);
    }

    // 5.- SUSTITUIR LOS NOMBRES DE LOS ELEMENTOS RESTANTES EN EL ARRAY POR ".."
    $directory = str_repeat("../", count($folders));
    
    return [
        "url"=>$url,
        "directory" => $directory,
        "folders" => $folders,
        "file" =>  substr($file, 0, strrpos($file, '.'))
    ];
?>