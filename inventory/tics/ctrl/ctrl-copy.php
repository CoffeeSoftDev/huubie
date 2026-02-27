<?php
    class Copy{
        const PERMISSIONS = 0777;
        function copyRecursively($ruteSource,$ruteDestine) {
            try {
                //Comprobar si existe el directorio original
                if (!is_dir($ruteSource)) {
                    throw new Exception("El directorio original no existe.");
                }
                
                //Comprobar si existe el directorio de destino, si no crearlo.
                if (!file_exists($ruteDestine)) {
                    if (!mkdir($ruteDestine, self::PERMISSIONS, true)) {
                        throw new Exception("Error al crear el directorio de destino.");
                    }

                    //Hacer un array con los archivos y subdirectorios de la carpeta Original
                    $files = array_diff(scandir($ruteSource), ['.', '..']);
                    foreach ($files as $file) {
                        $origFilePath = "$ruteSource/$file";
                        $destFilePath = "$ruteDestine/$file";
            
                        if (is_dir($origFilePath)) {
                            //Recursividad
                            $this->copyRecursively($origFilePath, $destFilePath);
                        } else if (is_file($origFilePath)) {
                            //Realizar Copia de archivos y subdirectorios
                            if (!copy($origFilePath, $destFilePath)) {
                                throw new Exception("Error al copiar el archivo.");
                            }
                        }
                    }
    
                    return true;
                } else {
                    throw new Exception("El directorio ya éxiste.");
                }
            } catch (Exception $e) {
                return ["Error" => $e.getMessage()];
            }
        }

        function createFile($ruteDestine,$module,$submodule,$directory){
            try {
                $files = dirname($ruteDestine).'/';
                if (file_exists($files)) {
                    if(!file_exists($ruteDestine)){
                        touch($ruteDestine);
                        

                        $scriptSubmodule = '';
                        $module = str_replace('/','',$module);
                        $bcSubmodule = '';
                        if($submodule != ''){
                            $submodule = str_replace('/','',$submodule);
                            $bcSubmodule = "<li class='breadcrumb-item text-uppercase text-muted'>$submodule</li>";
                            $scriptSubmodule = $submodule.'/';
                        }
                        
                        $breadcrumbActive = ucfirst(str_replace('-',' ',$directory));
                        $breadcrumb = "
                        <?php 
    if( empty(\$_COOKIE[\"IDU\"]) )  require_once('../acceso/ctrl/ctrl-logout.php');

    require_once('layout/head.php');
    require_once('layout/script.php'); 
?>
<body>
    <?php require_once('../layout/navbar.php'); ?>
    <main>
        <section id=\"sidebar\"></section>
        <div id=\"main__content\">
                        <nav aria-label='breadcrumb'>
                            <ol class='breadcrumb'>
                                <li class='breadcrumb-item text-uppercase text-muted'>$module</li>
                                $bcSubmodule
                                <li class='breadcrumb-item fw-bold active'>$breadcrumbActive</li>
                            </ol>
                        </nav>
                        <div class=\"row mb-3 d-flex justify-content-end\">
                            <div class=\"col-12 col-sm-6 col-lg-3 mb-3\">
                                <label for=\"cbUDN\">Seleccionar UDN</label>
                                <select class=\"form-select\" id=\"cbUDN\"></select>
                            </div>
                            <div class=\"col-12 col-sm-6 col-lg-3 mb-3\">
                                <label for=\"iptDate\">Fecha</label>
                                <div class=\"input-group\">
                                    <input type=\"text\" class=\"form-control\" id=\"iptDate\">
                                    <span class=\"input-group-text\"><i class=\"icon-calendar\"></i></span>
                                </div>
                            </div>
                            <div class=\"col-12 col-sm-6 col-lg-3 mb-3\">
                                <label col=\"col-12\"> </label>
                                <button type=\"button\" class=\"btn btn-primary col-12\" id=\"btnOk\">Botón</button>
                            </div>
                        </div>
                        
                        <div class=\"row\" id=\"tbDatos\">
                            <table class=\"table table-sm table-hover no-wrap\" id=\"tb\">
                                <thead>
                                    <tr>
                                        <th>Titulo 1</th>
                                        <th>opciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Celda 1</td>
                                        <td class=\"text-center\">
                                            <button type=\"button\" class=\"btn btn-sm btn-outline-primary\" onClick=\"updateModal(1,'Celda 1');\">
                                                <i class=\"icon-pencil\"></i>
                                            </button>
                                            <button type=\"button\" class=\"btn btn-sm btn-outline-danger\" estado=\"1\" id=\"btnStatus1\" onClick=\"toggleStatus(1)\">
                                                <i class=\"icon-toggle-on\"></i>
                                            </button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Celda 2</td>
                                        <td class=\"text-center\">
                                            <button type=\"button\" class=\"btn btn-sm btn-outline-primary\" onClick=\"updateModal(2,'Celda 2');\">
                                                <i class=\"icon-pencil\"></i>
                                            </button>
                                            <button type=\"button\" class=\"btn btn-sm btn-outline-danger\" estado=\"1\" id=\"btnStatus2\" onClick=\"toggleStatus(2)\">
                                                <i class=\"icon-toggle-on\"></i>
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <script src='".$scriptSubmodule."src/js/$directory.js?t=<?php echo time(); ?>'></script>
        </div>
    </main>
</body>

</html>
                        ";
                        
                        file_put_contents($ruteDestine, $breadcrumb);
                    }
                } else {
                    throw new Exception("No existen las carpetas, no se puede crear el directorio principal");
                }

                //CREAR CONTROLADOR
                $files = dirname($ruteDestine).'/ctrl';
                if (!file_exists($files)) {
                    if (!mkdir($files, self::PERMISSIONS, true)) {
                        throw new Exception("Error al crear el directorio de controlador.");
                    }
                }
                $newRute = $files.'/ctrl-'.$directory.'.php';
                
                $clase = ucfirst(str_replace("-","",$directory));
                if ( !file_exists($newRute)){
                    touch($newRute);

                    $contenido = "<?php
                    if(empty(\$_POST['opc'])){
                        exit(0);
                    }
                    
                    require_once('../mdl/mdl-$directory.php');
                    \$obj = new $clase;

                    \$encode = [];
                    switch (\$_POST['opc']) {
                        case 'listUDN':
                                \$encode = \$obj->lsUDN();
                            break;
                    }
                    
                    echo json_encode(\$encode);
                    ?>";
                    
                    file_put_contents($newRute, $contenido);
                }

                //CREAR MODELO
                $files = dirname($ruteDestine).'/mdl';
                if (!file_exists($files)) {
                    if (!mkdir($files, self::PERMISSIONS, true)) {
                        throw new Exception("Error al crear el directorio principal.");
                    }
                }

                $newRute = $files.'/mdl-'.str_replace(" ","-",$directory).'.php';
                
                $clase = ucfirst(str_replace("-","",$directory));
                if($submodule != '') $slash = '../';
                
                if ( !file_exists($newRute)){
                    touch($newRute);

                    $contenido = "<?php
                    require_once('../../".$slash."conf/_CRUD.php');
                
                    class $clase extends CRUD{
                        function lsUDN(){
                            \$query =\"SELECT idUDN AS id, UDN AS valor FROM udn WHERE Stado = 1\";
                            return \$this->_Read(\$query, null);
                        }
                    }
                    ?>";
                    
                    file_put_contents($newRute, $contenido);
                }
                

                //CREAR JS
                $files = dirname($ruteDestine).'/src/js';
                if (!file_exists($files)) {
                    if (!mkdir($files, self::PERMISSIONS, true)) {
                        throw new Exception("Error al crear el directorio principal.");
                    }
                }
                
                $newRute = $files.'/'.str_replace(" ","-",$directory).'.js';
                $subJS = '';
                if($submodule != '') $subJS = $submodule.'/';
                
                if ( !file_exists($newRute)){
                    touch($newRute);

                    $contenido = "
                    window.ctrl = window.ctrl || '".$subJS."ctrl/ctrl-$directory.php';
                    window.modal = window.modal || '';
                    $(function(){
                        let datos = new FormData();
                        datos.append('opc', 'listUDN');
                        send_ajax(datos, ctrl).then((data) => {
                            let option = '';
                            data.forEach((p) => {
                              option += `<option value=\"\${p.id}\">\${p.valor}</option>`;
                            });
                            $(\"#cbUDN\").html(option);
                        });

                        if (typeof moment === 'function') {
                            rangepicker(
                                '#iptDate',
                                false,
                                moment().subtract(1, 'days'),
                                moment(),
                                {
                                    'Hoy': [moment(), moment()],
                                    'Ayer': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                                    'Última semana': [moment().subtract(6, 'days'), moment()],
                                    'Mes actual': [moment().startOf('month'), moment().endOf('month')],
                                    'Mes anterior': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')],
                                    'Año actual': [moment().startOf('year'), moment()],
                                    'Año anterior': [moment().subtract(1, 'year').startOf('year'), moment().subtract(1, 'year').endOf('year')]
                                },
                                true,
                                function (startDate, endDate) {
                                date1 = startDate.format(\"YYYY/MM/DD\");
                                date2 = endDate.format(\"YYYY/MM/DD\");
                                }
                            );
                            
                            $('#iptDate').next('span').on('click',()=>{
                                $('#iptDate').click();
                            });
                        } else {
                            Swal.fire({
                                title:'404 Not Found',
                                text:'Moment.js',
                                icon:'error',
                                width: 300,
                                showConfirmButton:false,
                                timer:1000
                            });
                        }

                        dataTable_responsive(\"#tb\", [{responsivePriority: 1,targets: 0}]);

                        $('#btnOk').on('click',()=>{
                            swal_question('¿Esta seguro de realizar esta acción?').then((result)=>{
                                if(result.isConfirmed){
                                    //let datos = new FormData();
                                    //datos.append('opc','');
                                    //send_ajax(datos,ctrl).then((data)=>{
                                        //console.log(data);
                                        swal_success();
                                    //});
                                }
                            });
                        });

                        
                    });
                    
                    function updateModal(id,title){
                        modal = bootbox.dialog({
                        title: ` EDITAR \"\${title.toUpperCase()}\" `,
                        message: `
                          <div class=\"col-12 mb-3\">
                              <label for=\"iptModalLabel\" class=\"form-label fw-bold\"> LABEL</label>
                              <input type=\"text\" class=\"form-control\" id=\"iptModalLabel\" value=\"\${title}\">
                              <span class=\"form-text text-danger hide\">
                                  <i class=\"icon-warning-1\"></i>
                                  El campo es requerido.
                              </span>
                          </div>
                          <div class=\"col-12 mb-3 d-flex justify-content-between\">
                              <button  class=\"btn btn-primary col-5\" onclick=\"update(\${id},'#iptModalLabel');\">Actualizar</button>
                              <button class=\"btn btn-outline-danger col-5 offset-2 bootbox-close-button col-5\" id=\"btnCerrarModal\">Cancelar</button>
                          </div>
                          `,
                          });
                        }
                        
                        function update(id,input){
                            let INPUT = $(input);
                            if (!INPUT.val()) {
                                INPUT.focus();
                                INPUT.addClass('is-invalid');
                                INPUT.next('span').removeClass('hide');
                            }
                            else {
                                INPUT.removeClass('is-invalid');
                                INPUT.next('span').addClass('hide');
                                //let datos = new FormData();
                                //datos.append('opc', 'edit');
                                //send_ajax(datos, ctrlUser).then((data) => {
                                //    console.log(data);
                                //    if (data === true) {
                                         $('#btnCerrarModal').click();
                                         swal_success();
                                 //   }
                                //});
                            }
                        }
                        
                        function toggleStatus(id){
                            const BTN = $('#btnStatus'+id);
                          const ESTADO = BTN.attr('estado');
                          
                          let estado = 0;
                          let iconToggle = '<i class=\"icon-toggle-off\"></i>';
                          let question = '¿DESEA DESACTIVARLO?';
                          if ( ESTADO == 0 ) {
                              estado = 1;
                              iconToggle = '<i class=\"icon-toggle-on\"></i>';
                            question = '¿DESEA ACTIVARLO?';
                          }
                          
                          swal_question(question).then((result)=>{
                                if(result.isConfirmed){
                              //let datos = new FormData();
                              //datos.append('opc','');
                              //send_ajax(datos,ctrl).then((data)=>{
                                  // console.log(data);
                                  BTN.html(iconToggle);
                                  BTN.attr('estado',estado);
                              //});
                            }
                          });  
                        }
                    ";
                    
                    file_put_contents($newRute, $contenido);
                }

                return true;
            } catch (Exception $e) {
                return $e->getMessage();
            }
        }

        function moveFile($beforeRute,$beforeDirectory,$afterRute,$afterDirectory){
            $movExit = null;
            try {
                // MOVER DIRECTORIO PRINCIPAL
                $files = dirname($afterRute).'/';
                if(file_exists($files)){
                    $movExit = rename($beforeRute.'.php', $afterRute.'.php');
                } else {
                    throw new Exception("No existen las carpetas, no se puede mover el directorio principal");
                }

                // MOVER CONTROLADOR
                $files = dirname($afterRute).'/ctrl';
                if(!file_exists($files)){
                    if (!mkdir($files, self::PERMISSIONS, true)) {
                        throw new Exception("Error al crear el directorio de controlador.");
                    }
                }
                if(file_exists($files) && $movExit == true ){
                    $fileBeforeRute = dirname($beforeRute).'/ctrl/ctrl-'.$beforeDirectory.'.php';
                    $fileAfterRute  = $files.'/ctrl-'.$afterDirectory.'.php';
                    $movExit        = rename($fileBeforeRute, $fileAfterRute);
                } else {
                    throw new Exception("No existe el controlador, y no se movio el directio principal");
                }

                // MOVER MODELO
                $files = dirname($afterRute).'/mdl';
                if(!file_exists($files)){
                    if (!mkdir($files, self::PERMISSIONS, true)) {
                        throw new Exception("Error al crear el directorio de controlador.");
                    }
                }
                if(file_exists($files) && $movExit == true ){
                    $fileBeforeRute = dirname($beforeRute).'/mdl/mdl-'.$beforeDirectory.'.php';
                    $fileAfterRute  = $files.'/mdl-'.$afterDirectory.'.php';
                    $movExit        = rename($fileBeforeRute, $fileAfterRute);
                } else {
                    throw new Exception("No existe el controlador, y no se movio el directio principal");
                }

                // MOVER JS
                $files = dirname($afterRute).'/src/js';
                if(!file_exists($files)){
                    if (!mkdir($files, self::PERMISSIONS, true)) {
                        throw new Exception("Error al crear el directorio de controlador.");
                    }
                }
                if(file_exists($files) && $movExit == true ){
                    $fileBeforeRute = dirname($beforeRute).'/src/js/'.$beforeDirectory.'.js';
                    $fileAfterRute  = $files.'/'.$afterDirectory.'.js';
                    $movExit        = rename($fileBeforeRute, $fileAfterRute);
                    return $movExit;
                } else {
                    throw new Exception("No existe el controlador, y no se movio el directio principal");
                }

            } catch (Exception $e) {
                return $e->getMessage();
            }
        }

        function deleteFile($ruta){
            try {
                // DIRECTORIO PRINCIPAL
                if (is_dir($directorio)) {
                    if (rmdir($directorio)) {
                        return true;
                    } else {
                        throw new Exception("No es posible eliminar el directorio principal.");
                    }
                } else {
                    throw new Exception("Este directorio principal no existe.");
                }

                // CONTROLADOR

                // MODELO

                // JAVASCRIPT

            } catch (Exception $e) {
                return $e->getMessage();
            }
        }
    }
?>