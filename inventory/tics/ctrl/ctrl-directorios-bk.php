<?php
if(empty($_POST['opc'])){
    exit(0);
}

require_once('../mdl/mdl-directorios.php');
$obj = new Directorios;

$encode = null;
switch ($_POST['opc']) {
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
                                "oculto"     => $row['oculto']
                            ];
                        }
                    }
                }
            }

            $encode = $modulos;
        break;        
    case 'newModule': 
            $module = str_replace("'","",trim($_POST['module']));
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
            $directory     = mb_strtolower(trim($_POST['directorio']),'UTF-8');
            $directory     = ucfirst($directory);
            $file          = ruteConversion($directory);
            $idModule      = $_POST['modulo'];
            $ruteModule    = $obj->ruteModule([$idModule]).'/';
            $idSubModule   = null;
            $ruteSubModule = '';
            
            if ( $_POST['submodulo'] != 0 ) {
                $idSubModule   = $_POST['submodulo'];
                $ruteSubModule = $obj->ruteSubmodule([$idSubModule]).'/';
            }

            $ruteDir = $ruteModule.$ruteSubModule.$file.'.php';
            
            require_once('ctrl-copy.php');
            $copy     = new Copy;
            $complete = $copy->createFile('../../'.$ruteDir,$ruteModule,$ruteSubModule,$file);
            if ( $complete === true) {
                $encode = $obj->insertDirectory([$idModule,$idSubModule,$directory,$ruteDir]);
            }
        break;
    case 'statusDirectory': 
            $encode = $obj->statusDirectory([$_POST['status'],$_POST['id']]);
        break;
    case 'blockDirectory': 
            $encode = $obj->blockDirectory([$_POST['id']]);
        break;
    case 'visibleDirectory': 
        $encode = $obj->visibleDirectory([$_POST['visible'],$_POST['id']]);
        break;
    case 'editDirectory': 
            $id           = $_POST['id'];
            $newIdM       = $_POST['modulo'];
            $newIdS       = $_POST['submodulo'];
            $newDirectory = ucfirst(trim($_POST['directorio']));
            
              // Obtener la información completa del directorio Actual
            $sqlDirectory = $obj->ruteDirectory([$id]);

            $before           = explode('/',$sqlDirectory);
            $nowRuteModule    = $before[0].'/';
            $nowRuteSubmodule = "";
            $nowRuteDirectory = $before[1];
            if ( count($before) > 2 ) {
                $nowRuteSubmodule = $before[1].'/';
                $nowRuteDirectory = $before[2];
            }
            $nowRuteDirectory = pathinfo($nowRuteDirectory, PATHINFO_FILENAME);
            $nowRute          = $nowRuteModule.$nowRuteSubmodule;

              // Obtener las nuevas rutas Modulo, Submodulo
               $newRuteModule                      = $obj->ruteModule([$newIdM]).'/';
               $newRuteSubmodule                   = "";
            if ( $newIdS != 0 )  $newRuteSubmodule = $obj->ruteSubmodule([$newIdS]).'/';
               $newRuteDirectory                   = ruteConversion($newDirectory);
               $newRute                            = $newRuteModule.$newRuteSubmodule;

            require_once('ctrl-copy.php');
            $copy  = new Copy;
            $exito = $copy->moveFile('../../'.$nowRute.$nowRuteDirectory,$nowRuteDirectory,'../../'.$newRute.$newRuteDirectory,$newRuteDirectory);

            if($exito === true){
                if($newIdS == 0 ) $newIdS  = null;
                   $newRute               .= $newRuteDirectory.'.php';
                   $encode                 = $obj->updateDirectory([$newDirectory,$newRute,$newIdM,$newIdS,$id]);
            }
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