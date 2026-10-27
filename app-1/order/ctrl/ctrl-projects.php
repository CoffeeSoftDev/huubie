<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-projects.php';

class ctrl extends mdl {

    function init() {
        return [
            'status' => 200,
            'sizes' => $this->getSizes(),
            'statuses' => $this->getStatuses()
        ];
    }

    function getSizes() {
        return [
            ['id' => '📏 Pequeño', 'valor' => '📏 Pequeño'],
            ['id' => '📦 Mediano', 'valor' => '📦 Mediano'],
            ['id' => '🏢 Grande', 'valor' => '🏢 Grande']
        ];
    }

    function getStatuses() {
        return [
            ['id' => 1, 'valor' => 'Activo'],
            ['id' => 0, 'valor' => 'Inactivo'],
            ['id' => 2, 'valor' => 'En Progreso'],
            ['id' => 3, 'valor' => 'Completado'],
            ['id' => 4, 'valor' => 'Cancelado']
        ];
    }

    function listProjects() {
        $status = $_POST['status'] ?? 1;
        $__row = [];

        $ls = $this->listProjects([$status]);

        foreach ($ls as $key) {
            $a = [];

            if ($key['status'] == 1 || $key['status'] == 2) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'app.editProject(' . $key['id'] . ')'
                ];

                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-trash"></i>',
                    'onclick' => 'app.deleteProject(' . $key['id'] . ')'
                ];
            }

            $__row[] = [
                'id'            => $key['id'],
                'Nombre'        => $key['name'],
                'Tamaño'        => $key['size'],
                'Estado'        => renderStatus($key['status']),
                'Fecha Creación' => $key['date_creation'],
                'a'             => $a
            ];
        }

        return [
            'row' => $__row,
            'ls'  => $ls
        ];
    }

    function getProject() {
        $id = $_POST['id'];
        $project = $this->getProjectById([$id]);

        return [
            'status' => $project ? 200 : 404,
            'message' => $project ? 'Proyecto encontrado' : 'Proyecto no encontrado',
            'data' => $project
        ];
    }

    function addProject() {
        $status = 500;
        $message = 'Error al crear el proyecto';

        $_POST['date_creation'] = date('Y-m-d H:i:s');
        $_POST['subsidiaries_id'] = $_SESSION['SUB'] ?? 1;

        $create = $this->createProject($this->util->sql($_POST));

        if ($create) {
            $status = 200;
            $message = 'Proyecto creado correctamente';
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }

    function editProject() {
        $status = 500;
        $message = 'Error al actualizar el proyecto';

        $_POST['date_updated'] = date('Y-m-d H:i:s');

        $update = $this->updateProject($this->util->sql($_POST, 1));

        if ($update) {
            $status = 200;
            $message = 'Proyecto actualizado correctamente';
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }

    function deleteProject() {
        $status = 500;
        $message = 'Error al eliminar el proyecto';

        $delete = $this->deleteProject([$_POST['id']]);

        if ($delete) {
            $status = 200;
            $message = 'Proyecto eliminado correctamente';
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }

    function changeStatus() {
        $status = 500;
        $message = 'Error al cambiar el estado';

        $update = $this->updateProject($this->util->sql($_POST, 1));

        if ($update) {
            $status = 200;
            $message = 'Estado actualizado correctamente';
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }
}

// Complements
function renderStatus($status) {
    $statuses = [
        1 => ['bg' => '#014737', 'text' => '#3FC189', 'label' => '✅ Activo'],
        0 => ['bg' => '#721c24', 'text' => '#ba464d', 'label' => '❌ Inactivo'],
        2 => ['bg' => '#004085', 'text' => '#4da3ff', 'label' => '🔄 En Progreso'],
        3 => ['bg' => '#155724', 'text' => '#28a745', 'label' => '✔️ Completado'],
        4 => ['bg' => '#8a4600', 'text' => '#f0ad28', 'label' => '🚫 Cancelado']
    ];

    if (isset($statuses[$status])) {
        $s = $statuses[$status];
        return "<span class='px-2 py-1 rounded-md text-sm font-semibold' style='background-color:{$s['bg']}; color:{$s['text']}'>{$s['label']}</span>";
    }

    return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-gray-500 text-white">Desconocido</span>';
}

$obj = new ctrl();
$fn = $_POST['opc'];
$encode = $obj->$fn();
echo json_encode($encode);
?>
