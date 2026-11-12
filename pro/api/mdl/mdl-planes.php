<?php
require_once __DIR__ . '/../../core/database/_CRUD.php';
require_once __DIR__ . '/../../core/helpers/_Utileria.php';

// Lo que leen las páginas de precios: solo clasificaciones, planes y módulos activos.
class mdl extends CRUD {
    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        // Sin prefijo: las tablas viven en la base del .env (DB_NAME).
        $this->bd   = '';
    }

    function getClassificationByCode($array) {
        // [code]
        $query = "
            SELECT id, name, code, description
            FROM {$this->bd}plans_classification
            WHERE code = ? AND active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // Del más barato al más caro; el Personalizado (sin precio fijo) al final.
    // module_ids: el kit de los planes de módulos fijos, en el orden del menú.
    function listPlansByClassification($array) {
        // [classification_id]
        $query = "
            SELECT
                p.id, p.code, p.name, p.description, p.price, p.price_before, p.currency,
                p.billing_cycle, p.max_users, p.max_branches, p.trial_days, p.features,
                p.modules_mode, p.modules_pick, p.featured,
                (
                    SELECT GROUP_CONCAT(pm.module_id ORDER BY m.orden, m.name)
                    FROM {$this->bd}plan_module pm
                    INNER JOIN {$this->bd}modules m ON m.id = pm.module_id
                    WHERE pm.plan_id = p.id
                ) AS module_ids
            FROM {$this->bd}plans p
            INNER JOIN {$this->bd}classification_plan cp ON cp.plan_id = p.id AND cp.classification_id = ?
            WHERE p.is_active = 1
            ORDER BY p.price IS NULL, p.price ASC, p.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Los que se venden: encendidos y sin Developer, que es la administración de la plataforma.
    function listModules() {
        $query = "
            SELECT id, name, icon, description, price
            FROM {$this->bd}modules
            WHERE is_active = 1 AND (code IS NULL OR code <> 'developer')
            ORDER BY orden ASC, name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }
}
