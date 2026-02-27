<?php
if(empty($_POST['opc'])) exit(0);


require_once('../mdl/mdl-directorios.php');
$obj = new Directorios;

$encode = null;
switch ($_POST['opc']) {
    case 'listas':
            $encode['modulos'] = $obj->listModules();
            $encode['submodulos'] = $obj->listSubmodules();
        break;
    case 'listModules': 
            $encode = $obj->listModules();
        break;
    case 'listSubmodules': 
            $encode = $obj->listSubmodules();
        break;
    case 'directoryTable': 
            $tempModulo    = '';
            $tempSubModulo = '';
            $modulos       = [];
            $submodulos    = [];

            $sql = $obj->allDirectory();
            foreach ($sql as $row) {
                // Modulos
                if($tempModulo != $row['idM']){
                    $tempModulo = $row['idM'];
                    $modulos[]  = [
                        "id"          => $row['idM'],
                        "modulo"      => $row['modulo'],
                        "submodulos"  => [],
                        "directorios" => [],
                    ];
                }
                
                // Modulos/Submodulos
                if ( $tempSubModulo != $row['idS'] && isset($row['idS']) ) {
                    $tempSubModulo = $row['idS'];
                    foreach ($modulos as &$mod) {
                        if ( $tempModulo == $mod["id"]) {
                            $mod['submodulos'][] = [
                                "id"          => $row['idS'],
                                "submodulo"   => $row['submodulo'],
                                "directorios" => []
                            ];
                        }
                    }
                }
                
                // Modulos/Submodulos/Directorios
                if ( isset($row['idS']) ) {
                    foreach ($modulos as &$mod) {
                        if ( $tempModulo == $mod["id"]) {
                            foreach ($mod["submodulos"] as &$sub) {
                                if ( $sub["id"] == $row["idS"]) {
                                    $sub['directorios'][] = [
                                        "id"         => $row['id'],
                                        "directorio" => $row['directorio'],
                                        "estado"     => $row['estado'],
                                        "validacion" => $row['validacion'],
                                        "ruta"       => $row['ruta'],
                                        "orden"      => $row['orden'],
                                        "oculto"     => $row['oculto']
                                    ];
                                }
                            }
                        }
                    }
                }
                
                // Modulos/Directorios
                if(!isset($row['idS'])){
                    foreach ($modulos as &$mod) {
                        if ( $tempModulo == $mod["id"]) {
                            $mod['directorios'][] = [
                                "id"         => $row['id'],
                                "directorio" => $row['directorio'],
                                "estado"     => $row['estado'],
                                "validacion" => $row['validacion'],
                                "ruta"       => $row['ruta'],
                                "orden"      => $row['orden'],
                                "oculto"     => $row['oculto']
                            ];
                        }
                    }
                }
            }

            $encode = $modulos;
        break;        
    case 'newModule': 
            $module = str_replace("'","",trim($_POST['modulo']));
            $module = mb_strtoupper($module,'UTF-8');
            $rute   = ruteConversion($module);

            require_once('ctrl-copy.php');
            $copy     = new Copy;
            $complete = $copy->copyRecursively('../../plantilla','../../'.$rute);
            if($complete === true){
                $sql = $obj->selectModuloExist([$module,$rute]);
                if ( !isset($sql[0]) ) {
                    $encode = $obj->insertModule([$module,$rute]);
                }
            }
        break;
    case 'newSubmodule': 
            $idM        = $_POST['modulo'];
            $ruteModule = $obj->ruteModule([$idM]);
            $submodule  = str_replace("'","",trim($_POST['submodulo']));
            $submodule  = mb_strtoupper($submodule,'UTF-8');
            $rute       = ruteConversion($submodule);
            $encode     = ["idM"=>$idM,"ruteModule"=>$ruteModule,"submodule"=>$submodule,"rute"=>$rute];

            require_once('ctrl-copy.php');
            $copy     = new Copy;
            $complete = $copy->copyRecursively('../../plantilla','../../'.$ruteModule.'/'.$rute);
            if ( $complete === true ) {
                $sql = $obj->selectSubmoduloExist([$idM,$submodule,$rute]);
                if ( !isset($sql[0]) ) {
                    $encode = $obj->insertSubmodule([$idM,$submodule,$rute]);
                }
            }
        break;
    case 'newDirectory': 
            $directory     = ucfirst($_POST['directorio']);
            $file          = ruteConversion($directory);
            $idModule      = $_POST['modulo'];
            $ruteModule    = $obj->ruteModule([$idModule]).'/';
            $idSubModule   = null;
            $ruteSubModule = '';
            
            if ( !empty($_POST['submodulo']) || $_POST['submodulo'] != 0 ) {
                $idSubModule   = $_POST['submodulo'];
                $ruteSubModule = $obj->ruteSubmodule([$idSubModule]).'/';
            }
            
            $ruteDir = $ruteModule.$ruteSubModule.$file.'.php';

            $encode    = [
                "directory"     => $directory,
                "file"          => $file,
                "idModule"      => $idModule,
                "ruteModule"    => $ruteModule,
                "idSubModule"   => $idSubModule,
                "ruteSubModule" => $ruteSubModule,
                "ruteDir"       => $ruteDir,
            ];
            
            require_once('ctrl-copy.php');
            $copy     = new Copy;
            $complete = $copy->createFile('../../'.$ruteDir,$ruteModule,$ruteSubModule,$file);
            if ( $complete === true) {
                $idDirectorio = $obj->insertDirectory([$idModule,$idSubModule,$directory,$ruteDir]);
                $encode = $obj->tics([$idDirectorio]);
            } else {
                $encode[] = $complete;
            }
        break;
    case 'statusDirectory': 
            $encode = $obj->statusDirectory([$_POST['status'],$_POST['id']]);
        break;
    case 'blockDirectory':
            $block = 1;
            if($_POST['block'] == 1)  $block = 0;
            $encode = $obj->blockDirectory([$block,$_POST['id']]);
        break;
    case 'visibleDirectory': 
        $encode = $obj->visibleDirectory([$_POST['visible'],$_POST['id']]);
        break;
    case 'editDirectory': 
            $id           = $_POST['id'];
            $newIdM       = $_POST['modulo'];
            $newIdS       = $_POST['submodulo'];
            $newDirectory = ucfirst(trim($_POST['directorio']));//Primera letra mayuscula
     
            // Lo convertimos array y obtemos modulo y submodulo
            // Obtener la ruta actual del directorio
            $sqlDirectory = $obj->ruteDirectory([$id]);
            $before = explode('/',$sqlDirectory);

            // Asignamos los valores a las variables actuales.
            $nowRuteModule    = $before[0].'/';
            $nowRuteSubmodule = (count($before) > 2) ? $before[1].'/' : "";
            $nowRuteDirectory = (count($before) > 2) ? $before[2] : $before[1];
            
            // Quitamos la extenciиоn al directorio
            $nowRuteDirectory = pathinfo($nowRuteDirectory, PATHINFO_FILENAME);
            // La ruta actual de modulo y submodulo
            $nowRute          = $nowRuteModule.$nowRuteSubmodule;

            // Obtener las nuevas rutas Modulo, Submodulo
            $newRuteModule    = $obj->ruteModule([$newIdM]).'/';
            $newRuteSubmodule = ( $newIdS != 0 ) ? $obj->ruteSubmodule([$newIdS]).'/' : "";
            $newRuteDirectory = ruteConversion($newDirectory);
            $newRute          = $newRuteModule.$newRuteSubmodule;

            $encode = [
                "nowRute" => $nowRute.$nowRuteDirectory,
                "newRute" => $newRute.$newRuteDirectory,
            ];

            require_once('ctrl-copy.php');
            $copy  = new Copy;
            // Mover archivo principal
            $exito = $copy->moveFile('../../'.$nowRute,$nowRuteDirectory,'../../'.$newRute,$newRuteDirectory);
            if($exito === true){
                if($newIdS == 0 ) $newIdS  = null;

                $newRute .= $newRuteDirectory.'.php';
                $encode   = $obj->updateDirectory([$newDirectory,$newRute,$newIdM,$newIdS,$id]);
            } else{
                $encode[] = $exito;
            }
        break;
    case 'delDirectory':
            $id = $_POST['id']; // ID del directorio
            $sqlDirectory = $obj->ruteDirectory([$id]); //Se busca la ruta del directorio
            $array_ruta = explode('/',$sqlDirectory); // La ruta se convierte en array separando por slash

            // Eliminamos el nombre del archivo de la ruta completa y le quitamos la extension
            $directorio = pathinfo(array_pop($array_ruta), PATHINFO_FILENAME);
            $directorio = str_replace('-',' ',$directorio);

            // Volvemos a convertir el array ruta en string
            $modelo = $array_ruta[0];
            $submodelo = '';
            if(count($array_ruta) > 1 )$submodelo = '/'.$array_ruta[1];


            require_once('ctrl-copy.php');
            $copy  = new Copy;
            $exito = $copy->deleteFile($modelo,$submodelo,$directorio);

            if($exito) $encode = $obj->deleteDirectory([$id]);
            else $encode[] = $exito;
        break;
    case 'orderDirectory':
            $encode = $obj->changeOrder([$_POST['order'],$_POST['id']]);
        break;
    
}

function ruteConversion($text){
    $accents = Normalizer::normalize($text, Normalizer::FORM_D);
    $accents = preg_replace('/\p{Mn}/u', '', $accents);
    $normal  = str_replace(" ","-",mb_strtolower($accents, 'UTF-8'));
    return $normal;
}

echo json_encode($encode);
?>