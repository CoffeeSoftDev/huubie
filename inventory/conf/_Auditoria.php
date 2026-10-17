<?php
/*  BITÁCORA DE ACCESOS (fayxzvov_erp.audit_log): quién hizo qué en usuarios,
    roles y sucursales, y cuándo entró o salió.

    Vive en conf/ y no en un mdl/: la escriben varios ctrl (acceso, empresas,
    admin/accesos) y cada uno extiende SU `class mdl`; dos de esos archivos en la
    misma petición declararían la misma clase. Mismo diseño que la bitácora del
    facturador (app/wansoft/conf/_Auditoria.php).

    SOLO INSERT: ningún ctrl edita ni borra la bitácora. Se escribe DESPUÉS de que
    la acción salió bien, y si esta escritura falla no tumba la acción que ya pasó:
    _CUD deja el motivo en error.log y devuelve false.

      Auditoria::registrar($action, $entity, $entityId, $label, $detail)
          quién, empresa, sucursal e IP salen de la sesión y de la petición.
*/
require_once __DIR__ . '/_CRUD.php';

class Auditoria extends CRUD {

    public $bd;

    public function __construct() {
        $this->bd = 'fayxzvov_erp.';
    }

    public static function registrar($action, $entity, $entityId, $label, $detail = null) {
        return (new self())->createAuditLog([
            'action'     => $action,
            'entity'     => $entity,
            'entity_id'  => $entityId,
            'label'      => $label,
            'detail'     => $detail,
            'user_id'    => (int) ($_SESSION['user_id'] ?? $_SESSION['IDU'] ?? 0) ?: null,
            'company_id' => (int) ($_SESSION['company_id'] ?? 0) ?: null,
            'branch_id'  => (int) ($_SESSION['branch_id'] ?? 0) ?: null,
            'ip'         => $_SERVER['REMOTE_ADDR'] ?? null
        ]);
    }

    // El nombre de quien lo hizo se copia en el mismo INSERT desde users: la
    // bitácora se tiene que poder leer aunque el usuario cambie de nombre o se dé
    // de baja. El `label` se corta a lo que cabe en la columna y el `detail` viaja
    // como arreglo: el JSON se codifica en un solo lugar.
    function createAuditLog($array) {
        $label  = mb_strimwidth((string) $array['label'], 0, 120, '…', 'UTF-8');
        $detail = empty($array['detail'])
            ? null
            : json_encode($array['detail'], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

        $query = "
            INSERT INTO {$this->bd}audit_log
                   (action, entity, entity_id, label, detail, user_id, user_name, company_id, branch_id, ip)
            VALUES (?, ?, ?, ?, ?, ?,
                    (SELECT TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, '')))
                       FROM {$this->bd}users u WHERE u.id = ? LIMIT 1),
                    ?, ?, ?)
        ";

        return $this->_CUD($query, [
            $array['action'],
            $array['entity'],
            $array['entity_id'],
            $label,
            $detail ?: null,
            $array['user_id'],
            $array['user_id'],
            $array['company_id'],
            $array['branch_id'],
            $array['ip']
        ]);
    }
}
