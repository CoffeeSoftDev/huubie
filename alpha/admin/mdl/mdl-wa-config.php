<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MWaConfig extends CRUD {
    protected $util;

    public function __construct(){
        $this->util = new Utileria;
    }

    // Las plantillas llevan emojis (4 bytes) y la conexión común abre en utf8 (3 bytes),
    // así que MySQL los rechaza. Solo este modelo abre en utf8mb4.
    public function connect(){
        parent::connect();
        if ($this->connected) $this->mysql->exec('SET NAMES utf8mb4');
    }

    // Proveedores
    function listConfig($array){
        $query = "
            SELECT
                id,
                provider,
                instance,
                token,
                api_url,
                state,
                checked_at,
                active
            FROM wa_config
            WHERE companies_id = ?";

        return $this->_Read($query, $array);
    }

    function getConfigByProvider($array){
        $query = "
            SELECT id, provider, instance, token, api_url, active
            FROM wa_config
            WHERE companies_id = ? AND provider = ?";

        $rows = $this->_Read($query, $array);
        return $rows ? $rows[0] : null;
    }

    function createConfig($array){
        return $this->_Insert([
            'table'  => 'wa_config',
            'values' => ['provider', 'instance', 'token', 'api_url', 'companies_id', 'active'],
            'data'   => $array
        ]);
    }

    function updateConfig($array){
        return $this->_Update([
            'table'  => 'wa_config',
            'values' => ['instance', 'token', 'api_url', 'active'],
            'where'  => ['id', 'companies_id'],
            'data'   => $array
        ]);
    }

    // Solo uno envía: al activar un proveedor se apagan los demás de la empresa.
    function updateConfigActive($array){
        return $this->_Update([
            'table'  => 'wa_config',
            'values' => ['active'],
            'where'  => ['companies_id', 'provider != ?'],
            'data'   => $array
        ]);
    }

    function updateConfigState($array){
        return $this->_Update([
            'table'  => 'wa_config',
            'values' => ['state', 'checked_at'],
            'where'  => ['id'],
            'data'   => $array
        ]);
    }

    // Destinatarios
    function listDestinatarios($array){
        $query = "
            SELECT id, name, phone, type, active
            FROM wa_destinatarios
            WHERE companies_id = ?
            ORDER BY FIELD(type, 'cierre', 'turno', 'personalizado', 'edicion'), name, id";

        return $this->_Read($query, $array);
    }

    function getDestinatarioById($array){
        $query = "
            SELECT id, name, phone, type, active
            FROM wa_destinatarios
            WHERE id = ? AND companies_id = ?";

        $rows = $this->_Read($query, $array);
        return $rows ? $rows[0] : null;
    }

    // Devuelve el id del registro que ya tiene ese número en ese aviso (0 si no hay).
    function existsDestinatarioByPhone($array){
        $query = "
            SELECT id
            FROM wa_destinatarios
            WHERE companies_id = ? AND type = ? AND phone = ?";

        $rows = $this->_Read($query, $array);
        return $rows ? intval($rows[0]['id']) : 0;
    }

    function createDestinatario($array){
        $ok = $this->_Insert([
            'table'  => 'wa_destinatarios',
            'values' => ['name', 'phone', 'type', 'companies_id', 'active'],
            'data'   => $array
        ]);

        return $ok ? $this->lastId : 0;
    }

    function updateDestinatario($array){
        return $this->_Update([
            'table'  => 'wa_destinatarios',
            'values' => ['name', 'phone', 'type', 'active'],
            'where'  => ['id', 'companies_id'],
            'data'   => $array
        ]);
    }

    function updateDestinatarioActive($array){
        return $this->_Update([
            'table'  => 'wa_destinatarios',
            'values' => ['active'],
            'where'  => ['id', 'companies_id'],
            'data'   => $array
        ]);
    }

    function deleteDestinatarioById($array){
        return $this->_Delete([
            'table' => 'wa_destinatarios',
            'where' => ['id', 'companies_id'],
            'data'  => $array
        ]);
    }

    // Plantillas
    function listPlantillas($array){
        $query = "
            SELECT id, type, body, active
            FROM wa_plantillas
            WHERE companies_id = ?";

        return $this->_Read($query, $array);
    }

    function getPlantillaByType($array){
        $query = "
            SELECT id, type, body, active
            FROM wa_plantillas
            WHERE companies_id = ? AND type = ?";

        $rows = $this->_Read($query, $array);
        return $rows ? $rows[0] : null;
    }

    function createPlantilla($array){
        return $this->_Insert([
            'table'  => 'wa_plantillas',
            'values' => ['type', 'body', 'companies_id', 'active'],
            'data'   => $array
        ]);
    }

    function updatePlantilla($array){
        return $this->_Update([
            'table'  => 'wa_plantillas',
            'values' => ['body', 'active'],
            'where'  => ['id'],
            'data'   => $array
        ]);
    }

    // Historial
    // Params: [empresa, tipo, tipo, fecha inicial, fecha final] (Y-m-d, ambas inclusivas);
    // '' en tipo trae todos los avisos.
    function listHistorial($array){
        $query = "
            SELECT
                h.id,
                h.type,
                h.reference,
                h.recipients,
                h.provider,
                h.status,
                h.error,
                h.sent_at,
                s.name AS sucursal
            FROM wa_historial h
            LEFT JOIN subsidiaries s ON s.id = h.subsidiaries_id
            WHERE h.companies_id = ?
              AND (? = '' OR h.type = ?)
              AND h.sent_at >= ?
              AND h.sent_at < DATE_ADD(?, INTERVAL 1 DAY)
            ORDER BY h.sent_at DESC, h.id DESC";

        return $this->_Read($query, $array);
    }

    function createHistorial($array){
        return $this->_Insert([
            'table'  => 'wa_historial',
            'values' => ['type', 'reference', 'recipients', 'provider', 'error', 'status', 'companies_id'],
            'data'   => $array
        ]);
    }

    function getHistorialCounts($array){
        $query = "
            SELECT
                COUNT(*) AS total,
                SUM(status = 'enviado') AS exitosos,
                SUM(status = 'fallido') AS fallidos
            FROM wa_historial
            WHERE companies_id = ?
              AND (? = '' OR type = ?)
              AND sent_at >= ?
              AND sent_at < DATE_ADD(?, INTERVAL 1 DAY)";

        $rows = $this->_Read($query, $array);
        return $rows ? $rows[0] : ['total' => 0, 'exitosos' => 0, 'fallidos' => 0];
    }

    function getHistorialTodayCounts($array){
        $query = "
            SELECT COUNT(*) AS enviados
            FROM wa_historial
            WHERE companies_id = ? AND status = 'enviado' AND DATE(sent_at) = CURDATE()";

        $rows = $this->_Read($query, $array);
        return $rows ? intval($rows[0]['enviados']) : 0;
    }
}
?>
