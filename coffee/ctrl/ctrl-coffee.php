<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-coffee.php';
require_once '../../conf/coffeSoft.php';

class ctrl extends mdl {

    function init() {
        return [];
    }

    function lsCoffee() {
        $__row = [];
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];

        $ls = $this->listCoffee([$fi, $ff]);

        foreach ($ls as $registro) {
            $__row[] = [
                'id'          => $registro['id'],
                'Nombre'      => $registro['name'],
                'Descripcion' => $registro['description'],
                'Fecha'       => formatSpanishDate($registro['created_at']),
                'a'           => actionButtons($registro['id'])
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function getCoffee() {
        $status = 500;
        $message = 'Error al obtener los datos';
        $getData = $this->getCoffeeById([$_POST['id']]);

        if ($getData) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $getData
        ];
    }

    function addCoffee() {
        $status = 500;
        $message = 'No se pudo agregar el registro';
        $_POST['created_at'] = date('Y-m-d H:i:s');

        $create = $this->createCoffee($this->util->sql($_POST));

        if ($create) {
            $status = 200;
            $message = 'Registro agregado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editCoffee() {
        $id      = $_POST['id'];
        $status  = 500;
        $message = 'Error al editar registro';
        $edit    = $this->updateCoffee($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Registro editado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function deleteCoffee() {
        $status  = 500;
        $message = 'Error al eliminar registro';

        $values = $this->util->sql(['id' => $_POST['id']], 1);
        $delete = $this->deleteCoffeeById($values);

        if ($delete) {
            $status  = 200;
            $message = 'Registro eliminado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }
}

// Complements
function actionButtons($id) {
    return [
        [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-100 hover:bg-blue-200 text-blue-700 me-1',
            'html'    => '<i class="icon-pencil"></i>',
            'onclick' => "coffee.editCoffee($id)"
        ],
        [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-100 hover:bg-red-200 text-red-700',
            'html'    => '<i class="icon-trash"></i>',
            'onclick' => "coffee.deleteCoffee($id)"
        ]
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());