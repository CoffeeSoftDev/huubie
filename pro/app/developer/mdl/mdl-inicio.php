<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../home/mdl/mdl-home-layout.php';

/*  Developer › Accesos › Inicio: el catalogo de tarjetas que un dueño puede
    poner en su inicio (home_widgets), visto por modulo, con lo que pasa con
    cada una: en cuantos inicios esta y cuantas empresas tienen su modulo.

    El lado del dueño (que tarjetas tiene y como las acomodo) vive en
    app/home/mdl/mdl-home-layout.php (HomeLayout); de ahi salen tambien las
    funciones que se pueden usar (HomeLayout::FUNCTIONS) y las zonas. */
class mdl extends CRUD {
    public $bd;

    public function __construct() {
        // Sin prefijo: la base del .env (DB_NAME).
        $this->bd = '';
    }

    // La migracion 2026-11-19_inicio-personalizable ya corrio.
    function qHomeReady() {
        $r = $this->_Read("SHOW TABLES LIKE 'home_widgets'");
        return is_array($r) && !empty($r);
    }

    /*  Los modulos que pueden tener tarjetas (todos menos Developer, que no se
        vende), con cuantas empresas ACTIVAS lo tienen hoy: la misma regla que
        Plan::modules() sobre la ultima suscripcion de cada una. */
    function qHomeModules() {
        $query = "
            SELECT
                m.id, m.name, m.code, m.icon, m.description, m.is_active, m.orden,
                (SELECT COUNT(*)
                   FROM {$this->bd}companies c
                   INNER JOIN {$this->bd}subscriptions s ON s.id = (SELECT MAX(s2.id) FROM {$this->bd}subscriptions s2 WHERE s2.company_id = c.id)
                   INNER JOIN {$this->bd}plans p ON p.id = s.plan_id
                  WHERE c.status = 'active'
                    AND m.is_active = 1
                    AND (p.modules_mode = 'all'
                         OR (p.modules_mode = 'included' AND EXISTS (SELECT 1 FROM {$this->bd}plan_module pm WHERE pm.plan_id = p.id AND pm.module_id = m.id))
                         OR (p.modules_mode IN ('custom', 'pick') AND EXISTS (SELECT 1 FROM {$this->bd}subscription_module sm WHERE sm.subscription_id = s.id AND sm.module_id = m.id)))
                ) AS companies
            FROM {$this->bd}modules m
            WHERE COALESCE(m.code, '') <> 'developer'
            ORDER BY m.orden IS NULL, m.orden, m.name
        ";

        $r = $this->_Read($query);
        return is_array($r) ? $r : [];
    }

    // Empresas activas: las que ven las tarjetas generales.
    function qActiveCompanies() {
        $r = $this->_Read("SELECT COUNT(*) AS total FROM {$this->bd}companies WHERE status = 'active'");
        return empty($r) ? 0 : (int) $r[0]['total'];
    }

    // Cuantos dueños ya personalizaron su inicio (en alguna empresa).
    function qCustomHomes() {
        $r = $this->_Read("SELECT COUNT(*) AS total FROM (SELECT DISTINCT user_id, company_id FROM {$this->bd}user_home_widgets) x");
        return empty($r) ? 0 : (int) $r[0]['total'];
    }

    // Todo el catalogo, encendidas y apagadas, con en cuantos inicios esta cada una.
    function qHomeWidgets() {
        $query = "
            SELECT
                w.id, w.code, w.name, w.description, w.icon, w.module_id, w.fn, w.zone, w.zones,
                w.route, w.orden, w.is_default, w.is_active,
                (SELECT COUNT(*) FROM {$this->bd}user_home_widgets u WHERE u.widget_id = w.id) AS homes
            FROM {$this->bd}home_widgets w
            ORDER BY w.orden IS NULL, w.orden, w.id
        ";

        $r = $this->_Read($query);
        return is_array($r) ? $r : [];
    }

    function qHomeWidget($array) {
        // [id]
        $query = "
            SELECT w.*, (SELECT COUNT(*) FROM {$this->bd}user_home_widgets u WHERE u.widget_id = w.id) AS homes
            FROM {$this->bd}home_widgets w
            WHERE w.id = ?
            LIMIT 1
        ";

        $r = $this->_Read($query, $array);
        return empty($r) ? null : $r[0];
    }

    function qHomeWidgetCodeTaken($array) {
        // [code, id que se edita (0 al crear)]
        $r = $this->_Read("SELECT id FROM {$this->bd}home_widgets WHERE code = ? AND id <> ? LIMIT 1", $array);
        return !empty($r);
    }

    // Un modulo al que se le puede colgar una tarjeta (no Developer).
    function qHomeModule($array) {
        // [id]
        $r = $this->_Read("SELECT id, name, code FROM {$this->bd}modules WHERE id = ? AND COALESCE(code, '') <> 'developer' LIMIT 1", $array);
        return empty($r) ? null : $r[0];
    }

    // La nueva va al final del orden de fabrica.
    function qNextHomeOrder() {
        $r = $this->_Read("SELECT COALESCE(MAX(orden), 0) + 10 AS next FROM {$this->bd}home_widgets");
        return empty($r) ? 10 : (int) $r[0]['next'];
    }

    function qInsertHomeWidget($array) {
        // [code, name, description, icon, module_id, fn, zone, zones, route, orden, is_default]
        return $this->_CUD("
            INSERT INTO {$this->bd}home_widgets
                (code, name, description, icon, module_id, fn, zone, zones, route, orden, is_default, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
        ", $array);
    }

    function qUpdateHomeWidget($array) {
        // [name, description, icon, module_id, fn, zone, zones, route, is_default, id] (el code no cambia)
        return $this->_CUD("
            UPDATE {$this->bd}home_widgets
               SET name = ?, description = ?, icon = ?, module_id = ?, fn = ?, zone = ?, zones = ?, route = ?, is_default = ?
             WHERE id = ?
        ", $array);
    }

    function qSetHomeWidgetActive($array) {
        // [is_active, id]
        return $this->_CUD("UPDATE {$this->bd}home_widgets SET is_active = ? WHERE id = ?", $array);
    }

    // Se lleva consigo los acomodos que la tenian (FK ON DELETE CASCADE).
    function qDeleteHomeWidget($array) {
        // [id]
        return $this->_CUD("DELETE FROM {$this->bd}home_widgets WHERE id = ?", $array);
    }

    // El inicio de fabrica: donde cae, si sale de fabrica y en que orden.
    function qSetHomeWidgetFactory($array) {
        // [zone, is_default, orden, id]
        return $this->_CUD("UPDATE {$this->bd}home_widgets SET zone = ?, is_default = ?, orden = ? WHERE id = ?", $array);
    }
}
?>
