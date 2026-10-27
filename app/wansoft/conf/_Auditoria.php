<?php
require_once __DIR__ . '/../../conf/_CRUD.php';

// Escritura de la bitacora de auditoria (punto 35).
//
// Esta clase vive en conf/ y NO en mdl/ por una razon de herencia. La escriben cinco
// controladores —tickets, pos, cargas, catalogos y emisor— y cada uno extiende SU
// `class mdl`: dos de esos archivos en la misma peticion declaran la misma clase y
// PHP se detiene, asi que ningun controlador puede incluir el modelo de otro modulo.
// Tampoco se les puede dar un metodo comun por herencia sin cambiarles el
// `extends CRUD` a los cinco, ni por trait: en app/ no hay y no se introducen.
//
// Una clase con otro nombre, en un archivo que no es mdl-*.php, cabe en los cinco sin
// tocar a ninguno. Cada controlador la usa desde su ayudante `registrar()`, que es
// quien le pone el usuario y la sucursal.
//
// SOLO INSERT: ningun controlador edita ni borra la bitacora. Lo que se escribe aqui
// se escribe DESPUES de que la accion salio bien, y si esta escritura falla no
// tumba la accion que ya paso: _CUD deja el motivo en error.log y devuelve null.
class Auditoria extends CRUD {

    public $bd;

    public function __construct() {
        $this->bd = 'fayxzvov_facturacion.';
    }

    // El nombre del usuario se copia en el mismo INSERT, desde la tabla user: asi
    // los cinco controladores solo pasan el id que tienen en sesion y ninguno tiene
    // que saber leer un nombre. La copia es la que se lee despues: la bitacora no
    // puede depender de que ese usuario siga existiendo.
    //
    // El `label` se corta a lo que cabe en la columna y el `detail` viaja como arreglo,
    // no como texto: un titulo largo —un archivo con nombre de ruta— no debe costarle
    // el renglon a la accion, y el JSON se codifica en un solo lugar.
    //
    // La hora la pone la base (DEFAULT CURRENT_TIMESTAMP), la misma que usa
    // generation_run al abrir y anular una corrida: todos los renglones de la
    // auditoria cuentan el tiempo con el mismo reloj.
    function createAuditLog($array) {
        $label  = mb_strimwidth((string) $array['label'], 0, 120, '…', 'UTF-8');
        $detail = empty($array['detail'])
            ? null
            : json_encode($array['detail'], JSON_INVALID_UTF8_SUBSTITUTE);

        $query = "
            INSERT INTO {$this->bd}audit_log
                   (action, entity, entity_id, label, detail, user_id, user_name, branch_id)
            VALUES (?, ?, ?, ?, ?, ?,
                    (SELECT u.name FROM {$this->bd}user u WHERE u.id = ? LIMIT 1),
                    ?)
        ";

        return $this->_CUD($query, [
            $array['action'],
            $array['entity'],
            $array['entity_id'],
            $label,
            $detail ?: null,
            $array['user_id'],
            $array['user_id'],
            $array['branch_id']
        ]);
    }
}
