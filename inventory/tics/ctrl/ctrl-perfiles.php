<?php
if(empty($_POST['opc'])){
    exit(0);
}

require_once('../mdl/mdl-perfiles.php');
$obj = new Perfiles;

$encode = [];

switch ($_POST['opc']) {
case 'profileList': 
        $encode = $obj->ProfileList();
    break;
case 'profileStatus': 
        $encode = $obj->statusProfile([$_POST['estado'],$_POST['id']]);
    break;
case 'profileNew': 
        $encode = $obj->newProfile([$_POST['perfil']]);
    break;
case 'profileEdit':
        $perfil = ucfirst(mb_strtolower($_POST['perfil'],'UTF-8'));
        $encode = $obj->editProfile([$perfil,$_POST['id']]);
    break;
case 'directoryList':
            $tempModulo    = '';
            $tempSubModulo = '';
            $modulos       = [];
            $submodulos    = [];

            $sql = $obj->allDirectory($_POST['perfil']);
            foreach ($sql as $row) {
                // Modulos
                if($tempModulo != $row['modulo']){
                    $tempModulo = $row['modulo'];
                    $modulos[]  = [
                        "id"          => $row['idM'],
                        "modulo"      => $tempModulo,
                        "submodulos"  => [],
                        "directorios" => [],
                    ];
                }
                
                // Modulos/Submodulos
                if ( $tempSubModulo != $row['idSubmodulo'] && isset($row['idSubmodulo']) ) {
                    $tempSubModulo = $row['idSubmodulo'];
                    foreach ($modulos as &$mod) {
                        if ( $tempModulo == $mod["modulo"]) {
                            $mod['submodulos'][] = [
                                "id"          => $row['idSubmodulo'],
                                "submodulo"   => $row['submodulo'],
                                "directorios" => []
                            ];
                        }
                    }
                }
                
                // Modulos/Submodulos/Directorios
                if ( isset($row['idSubmodulo']) ) {
                    foreach ($modulos as &$mod) {
                        if ( $tempModulo == $mod["modulo"]) {
                            foreach ($mod["submodulos"] as &$sub) {
                                if ( $sub["submodulo"] == $row["submodulo"]) {
                                    $sub['directorios'][] = [
                                        "id"         => $row['id'],
                                        "directorio" => $row['directorio'],
                                        "ver"        => $row['ver'],
                                        "escribir"   => $row['escribir'],
                                        "editar"     => $row['editar'],
                                        "imprimir"   => $row['imprimir']
                                    ];
                                }
                            }
                        }
                    }
                }
                // Modulos/Directorios
                if(!isset($row['idSubmodulo'])){
                    foreach ($modulos as &$mod) {
                        if ( $tempModulo == $mod["modulo"]) {
                            $mod['directorios'][] = [
                                "id"         => $row['id'],
                                "directorio" => $row['directorio'],
                                "ver"        => $row['ver'],
                                "escribir"   => $row['escribir'],
                                "editar"     => $row['editar'],
                                "imprimir"   => $row['imprimir']
                            ];
                        }
                    }
                }
            }

            $total = count($obj->allDirectories());
            $cuenta = $obj->existencePermissionAll([$_POST['perfil']]);

            $encode = [
                "modulos"=>$modulos,
                "total" => $total,
                "cuenta" => $cuenta, 
            ];
    break;
case 'permitPackage': 
        $idM = $_POST['idM'];
        $idS = $_POST['idS'];
        
        $sql = null;
        if ( $idM != '' ) {
            $sql = $obj->moduleDirectory([$idM]);
        } else if($idS != '') {
            $sql = $obj->submoduleDirectory([$idS]);
        }

        foreach ($sql as $value) {
            $array = [$_POST['perfil'],$value['idDirectorio']];
            if($_POST['check'] == 1) {                
            $encode = $obj->deletePermission($array);
            $encode = $obj->insertPermission($array);
            } else {
            $encode = $obj->deletePermission($array);
            }
        }
    break;
case 'permitDirectory': 
        $array = [$_POST['perfil'],$_POST['directorio']];
        
        if($_POST['check'] == 1) {
            $encode = $obj->deletePermission($array);
            $encode = $obj->insertPermission($array);
        } else {
            $encode = $obj->deletePermission($array);
        }
    break;
case 'permitOnexOne': 
        $directorio = $_POST['directorio'];
        $perfil     = $_POST['perfil'];
        $permiso    = $_POST['permiso'];
        $check      = $_POST['check'];
        switch ($permiso) {
            case 1: $permiso = 'ver';       break;
            case 2: $permiso = 'escribir';  break;
            case 3: $permiso = 'editar';    break;
            case 4: $permiso = 'imprimir';  break;
        }

        $existence = $obj->existencePermission([$perfil,$directorio]);

        if($check == 1) {
            if ( $existence === false ) $encode = $obj->insertPermissionOnexOne([$perfil,$directorio]);
            
            if ( $permiso != 'ver')  $encode = $obj->updatePermisssion($permiso,[$check,$perfil,$directorio]);
        } else {
            $encode = $obj->updatePermisssion($permiso,[null,$perfil,$directorio]);

            if($permiso === 'ver') $encode = $obj->deletePermission([$perfil,$directorio]);
        }
    break;
case 'permitAllModule':
        $encode = $obj->deleteAllModules([$_POST['id']]);

        if ( $_POST['check'] == 0 ) {
            $sql = $obj->allDirectories();
            foreach($sql as $row){
                $encode = $obj->insertPermission([$_POST['id'],$row['idDirectorio']]);
            }
        }

    break;
case 'listUDN':
        $encode = $obj->listUDN();
    break;
}

echo json_encode($encode);
?>