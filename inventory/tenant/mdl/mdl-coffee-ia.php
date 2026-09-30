<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

// CoffeeIA: el lado de quien lo configura. El lado de quien lo usa vive en
// operacion/almacen/mdl/mdl-almacen.php (getAssistantIA / getAssistantAccessIA).
class mdl extends CRUD {

    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_erp.';
    }

    // -- Asistentes --

    // Las empresas apagadas se cuentan; las encendidas son el resto (sin renglón = encendido).
    function listAssistants($array) {
        $query = "
            SELECT
                a.id, a.code, a.name, a.description, a.module, a.prompt_file,
                a.text_model, a.vision_model, a.think, a.is_active,
                (a.prompt IS NOT NULL AND a.prompt <> '') AS custom_prompt,
                DATE_FORMAT(a.updated_at, '%d/%m/%Y %H:%i') AS updated,
                (
                    SELECT COUNT(*)
                    FROM {$this->bd}ia_company_access ca
                    JOIN {$this->bd}companies c ON c.id = ca.companies_id AND c.status = 'active'
                    WHERE ca.assistants_id = a.id AND ca.is_active = 0
                ) AS companies_off
            FROM {$this->bd}ia_assistants a
            WHERE a.is_active = ?
            ORDER BY a.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function lsAssistantsForSelect() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}ia_assistants
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function getAssistantById($array) {
        $query = "
            SELECT id, code, name, description, module, prompt_file, text_model, vision_model, think, prompt, is_active
            FROM {$this->bd}ia_assistants
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function updateAssistant($array) {
        return $this->_Update([
            'table'  => "{$this->bd}ia_assistants",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // -- Empresas --

    function listCompanyAccess($array) {
        $query = "
            SELECT
                c.id, c.name, c.status,
                COALESCE(ca.is_active, 1) AS is_active,
                DATE_FORMAT(ca.updated_at, '%d/%m/%Y %H:%i') AS updated,
                TRIM(CONCAT(IFNULL(u.name, ''), ' ', IFNULL(u.last_name, ''))) AS updated_by
            FROM {$this->bd}companies c
            LEFT JOIN {$this->bd}ia_company_access ca ON ca.companies_id = c.id AND ca.assistants_id = ?
            LEFT JOIN {$this->bd}users u ON u.id = ca.updated_by
            WHERE c.status = 'active'
            ORDER BY c.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function existsCompanyById($array) {
        $query = "SELECT id FROM {$this->bd}companies WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r);
    }

    // [companies_id, assistants_id, is_active, updated_at, updated_by]
    function upsertCompanyAccess($array) {
        $query = "
            INSERT INTO {$this->bd}ia_company_access (companies_id, assistants_id, is_active, updated_at, updated_by)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                is_active  = VALUES(is_active),
                updated_at = VALUES(updated_at),
                updated_by = VALUES(updated_by)
        ";
        return $this->_CUD($query, $array);
    }
}
