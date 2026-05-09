<?php
if (empty($_POST['opc'])) exit(0);
require_once '../mdl/mdl-empresa.php';

class Company extends MCompany{
    
    function init(){
        return [
            'customers' => $this->lsCustomers()
        ];
    }

    function lsCompanies(){
        $__row = [];
        $ls = $this->listCompanies();


        foreach ($ls as $key) {
            $a = [];
            $a[] = [
                'class'   => 'btn btn-sm btn-secondary me-1',
                'html'    => '<i class="icon-picture"></i>',
                'onclick' => 'app.editCompany('.$key['id'].')'
            ];
            $a[] = [
                'class'   => 'btn btn-sm btn-primary me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'app.editCompany('.$key['id'].')'
            ];
            $a[] = [
                'class'   => 'btn btn-sm btn-danger',
                'html'    => '<i class="icon-trash-empty"></i>',
                'onclick' => 'app.deleteCompany('.$key['id'].')'
            ];
            $__row[] = [
                'id'          => $key['id'],
                'Nombre'      => $key['social_name'],
                'Dueño'     => $key['customer_name'],
                'a'           => $a,
            ];
        }
        return [
            "row" => $__row,
            'ls'  => $ls,
        ];
    }

    function getCompany(){
        $status = 500;
        $message = 'Error al obtener los datos';
        $company = $this->getCompanyByID($_POST['id']);
        
        if ($company) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }
        
        return [
            'status'  => $status,
            'message' => $message,
            'company' => $company[0]
        ];
    }

    function addCompany(){
        $status = 500;
        $message = 'Se encontro un error al crear data.';

        $__values = [
           'social_name'  => $_POST['social_name'],
           'customers_id' => $_POST['customers_id']
        ];

        $create = $this->createCompany($this->util->sql($__values));

         if ($create == true) {
          
            $status  = 200;
            $message = 'Se agrego correctamente.';
        }

        return [
            'status'   => $status,
            'message' => $message,
           
        ];
    }


    function editCompany(){
        $status = 500;
        $message = 'Error al editar';
        $edit = $this->updateCompany($this->util->sql($_POST, 1));
        if ($edit) {
            $status = 200;
            $message = 'Se ha editado correctamente';
        }
        return [
            'status'  => $status,
            'message' => $message,
            $edit,
        ];
    }

    function deleteCompany(){
        $status = 500;
        $message = 'Error al eliminar empresa';
        $delete = $this->removeCompany($this->util->sql($_POST, 1));
        if ($delete) {
            $status = 200;
            $message = 'Empresa eliminada correctamente.';
        }
        return [
            'status'  => $status,
            'message' => $message,
            $delete
        ];
    }
}

$obj    = new Company();
$fn     = $_POST['opc'];
$encode = [];
$encode = $obj->$fn();
echo json_encode($encode);
?>
