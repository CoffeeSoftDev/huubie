<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class mdl extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = "fayxzvov_rrhh.";
    }

    // ===================== CATALOGOS =====================

    function lsSubsidiaries() {
        $query = "SELECT id, name AS valor FROM {$this->bd}subsidiaries WHERE active = 1 ORDER BY name";
        return $this->_Read($query);
    }

    function lsPuestos() {
        $query = "SELECT id, nombre AS valor FROM {$this->bd}rrhh_puestos WHERE active = 1 ORDER BY nombre";
        return $this->_Read($query);
    }

    function lsTurnos() {
        $query = "SELECT id, nombre AS valor FROM {$this->bd}rrhh_turnos WHERE active = 1 ORDER BY nombre";
        return $this->_Read($query);
    }

    // ===================== PERSONAL =====================

    function listPersonal($array) {
        $where = "1=1";
        $data  = [];

        if (!empty($array['subsidiaries_id']) && $array['subsidiaries_id'] != '0') {
            $where .= " AND e.subsidiaries_id = ?";
            $data[] = $array['subsidiaries_id'];
        }
        if (!empty($array['estado']) && $array['estado'] != '') {
            $where .= " AND e.estado = ?";
            $data[] = $array['estado'];
        }
        if (!empty($array['puesto_id']) && $array['puesto_id'] != '0') {
            $where .= " AND e.puesto_id = ?";
            $data[] = $array['puesto_id'];
        }
        if (!empty($array['turno_id']) && $array['turno_id'] != '0') {
            $where .= " AND e.turno_id = ?";
            $data[] = $array['turno_id'];
        }

        $query = "SELECT e.id, e.codigo_empleado, e.nombre, e.apellido_paterno, e.apellido_materno,
                    e.email, e.telefono, e.salario_diario, e.estado, e.fecha_ingreso, e.foto_url,
                    p.nombre AS puesto, p.color_badge,
                    t.nombre AS turno,
                    s.name AS sucursal
                  FROM {$this->bd}rrhh_empleados e
                  INNER JOIN {$this->bd}rrhh_puestos p ON p.id = e.puesto_id
                  INNER JOIN {$this->bd}rrhh_turnos t ON t.id = e.turno_id
                  INNER JOIN {$this->bd}subsidiaries s ON s.id = e.subsidiaries_id
                  WHERE {$where}
                  ORDER BY e.nombre ASC";

        return $this->_Read($query, empty($data) ? null : $data);
    }

    function getPersonalById($array) {
        $query = "SELECT e.*, p.nombre AS puesto, t.nombre AS turno, s.name AS sucursal
                  FROM {$this->bd}rrhh_empleados e
                  INNER JOIN {$this->bd}rrhh_puestos p ON p.id = e.puesto_id
                  INNER JOIN {$this->bd}rrhh_turnos t ON t.id = e.turno_id
                  INNER JOIN {$this->bd}subsidiaries s ON s.id = e.subsidiaries_id
                  WHERE e.id = ?";
        $result = $this->_Read($query, $array);
        return !empty($result) ? $result[0] : null;
    }

    function createPersonal($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}rrhh_empleados",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updatePersonal($array) {
        return $this->_Update([
            'table'  => "{$this->bd}rrhh_empleados",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    function getPersonalCounts($array) {
        $where = "1=1";
        $data  = [];

        if (!empty($array['subsidiaries_id']) && $array['subsidiaries_id'] != '0') {
            $where .= " AND subsidiaries_id = ?";
            $data[] = $array['subsidiaries_id'];
        }

        $query = "SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN estado = 'activo' THEN 1 ELSE 0 END) AS activos,
                    SUM(CASE WHEN estado = 'baja' THEN 1 ELSE 0 END) AS bajas,
                    SUM(CASE WHEN estado = 'suspendido' THEN 1 ELSE 0 END) AS suspendidos
                  FROM {$this->bd}rrhh_empleados
                  WHERE {$where}";

        $result = $this->_Read($query, empty($data) ? null : $data);
        return !empty($result) ? $result[0] : null;
    }

    function getMaxPersonalCodigo() {
        $query = "SELECT MAX(CAST(SUBSTRING(codigo_empleado, 5) AS UNSIGNED)) AS max_num FROM {$this->bd}rrhh_empleados";
        $result = $this->_Read($query);
        return !empty($result) ? $result[0]['max_num'] : 0;
    }

    // ===================== PERMISOS =====================

    function listPermisos($array) {
        $where = "1=1";
        $data  = [];

        if (!empty($array['subsidiaries_id']) && $array['subsidiaries_id'] != '0') {
            $where .= " AND e.subsidiaries_id = ?";
            $data[] = $array['subsidiaries_id'];
        }
        if (!empty($array['estatus']) && $array['estatus'] != '') {
            $where .= " AND p.estatus = ?";
            $data[] = $array['estatus'];
        }
        if (!empty($array['tipo']) && $array['tipo'] != '') {
            $where .= " AND p.tipo = ?";
            $data[] = $array['tipo'];
        }

        $query = "SELECT p.id, p.codigo, p.tipo, p.fecha_inicio, p.fecha_fin, p.dias, p.razon,
                    p.estatus, p.solicitud_file, p.comprobante_file, p.created_at,
                    e.codigo_empleado,
                    CONCAT(e.nombre, ' ', e.apellido_paterno) AS nombre_completo,
                    e.foto_url,
                    pu.nombre AS puesto, pu.color_badge,
                    t.nombre AS turno
                  FROM {$this->bd}rrhh_permisos p
                  INNER JOIN {$this->bd}rrhh_empleados e ON e.id = p.empleado_id
                  INNER JOIN {$this->bd}rrhh_puestos pu ON pu.id = e.puesto_id
                  INNER JOIN {$this->bd}rrhh_turnos t ON t.id = e.turno_id
                  WHERE {$where}
                  ORDER BY p.created_at DESC";

        return $this->_Read($query, empty($data) ? null : $data);
    }

    function getPermisoById($array) {
        $query = "SELECT p.*, CONCAT(e.nombre, ' ', e.apellido_paterno) AS nombre_completo, e.foto_url
                  FROM {$this->bd}rrhh_permisos p
                  INNER JOIN {$this->bd}rrhh_empleados e ON e.id = p.empleado_id
                  WHERE p.id = ?";
        $result = $this->_Read($query, $array);
        return !empty($result) ? $result[0] : null;
    }

    function createPermiso($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}rrhh_permisos",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updatePermiso($array) {
        return $this->_Update([
            'table'  => "{$this->bd}rrhh_permisos",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    function getMaxPermisoCodigo() {
        $query = "SELECT MAX(CAST(SUBSTRING(codigo, 4) AS UNSIGNED)) AS max_num FROM {$this->bd}rrhh_permisos";
        $result = $this->_Read($query);
        return !empty($result) ? $result[0]['max_num'] : 0;
    }

    // ===================== INCIDENCIAS =====================

    function listIncidenciaDiario($array) {
        $where = "i.fecha = ?";
        $data  = [$array['fecha']];

        if (!empty($array['subsidiaries_id']) && $array['subsidiaries_id'] != '0') {
            $where .= " AND i.subsidiaries_id = ?";
            $data[] = $array['subsidiaries_id'];
        }
        if (!empty($array['turno_id']) && $array['turno_id'] != '0') {
            $where .= " AND e.turno_id = ?";
            $data[] = $array['turno_id'];
        }
        if (!empty($array['estatus']) && $array['estatus'] != '') {
            $where .= " AND i.estatus = ?";
            $data[] = $array['estatus'];
        }

        $query = "SELECT i.id, i.fecha, i.tipo_ingreso, i.hora_entrada, i.hora_salida,
                    i.estatus, i.minutos_tarde, i.observaciones,
                    e.id AS empleado_id, CONCAT(e.nombre, ' ', e.apellido_paterno) AS nombre_completo,
                    e.foto_url,
                    p.nombre AS puesto, p.color_badge,
                    t.nombre AS turno
                  FROM {$this->bd}rrhh_incidencias i
                  INNER JOIN {$this->bd}rrhh_empleados e ON e.id = i.empleado_id
                  INNER JOIN {$this->bd}rrhh_puestos p ON p.id = e.puesto_id
                  INNER JOIN {$this->bd}rrhh_turnos t ON t.id = e.turno_id
                  WHERE {$where}
                  ORDER BY e.nombre ASC";

        return $this->_Read($query, $data);
    }

    function listIncidenciaPersonalizado($array) {
        $where = "i.fecha BETWEEN ? AND ?";
        $data  = [$array['fecha_inicio'], $array['fecha_fin']];

        if (!empty($array['subsidiaries_id']) && $array['subsidiaries_id'] != '0') {
            $where .= " AND i.subsidiaries_id = ?";
            $data[] = $array['subsidiaries_id'];
        }

        $query = "SELECT i.id, i.empleado_id, i.fecha, i.estatus,
                    CONCAT(e.nombre, ' ', e.apellido_paterno) AS nombre_completo,
                    e.foto_url,
                    p.nombre AS puesto, p.color_badge,
                    t.nombre AS turno
                  FROM {$this->bd}rrhh_incidencias i
                  INNER JOIN {$this->bd}rrhh_empleados e ON e.id = i.empleado_id
                  INNER JOIN {$this->bd}rrhh_puestos p ON p.id = e.puesto_id
                  INNER JOIN {$this->bd}rrhh_turnos t ON t.id = e.turno_id
                  WHERE {$where}
                  ORDER BY e.nombre ASC, i.fecha ASC";

        return $this->_Read($query, $data);
    }

    function createIncidencia($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}rrhh_incidencias",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateIncidencia($array) {
        return $this->_Update([
            'table'  => "{$this->bd}rrhh_incidencias",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    // ===================== NOMINA =====================

    function listNominaPeriodos($array) {
        $where = "1=1";
        $data  = [];

        if (!empty($array['subsidiaries_id']) && $array['subsidiaries_id'] != '0') {
            $where .= " AND np.subsidiaries_id = ?";
            $data[] = $array['subsidiaries_id'];
        }

        $query = "SELECT np.*, s.name AS sucursal
                  FROM {$this->bd}rrhh_nomina_periodos np
                  INNER JOIN {$this->bd}subsidiaries s ON s.id = np.subsidiaries_id
                  WHERE {$where}
                  ORDER BY np.fecha_inicio DESC";

        return $this->_Read($query, empty($data) ? null : $data);
    }

    function listNominaDetalle($array) {
        $query = "SELECT nd.*, e.codigo_empleado,
                    CONCAT(e.nombre, ' ', e.apellido_paterno) AS nombre_completo,
                    p.nombre AS puesto, t.nombre AS turno
                  FROM {$this->bd}rrhh_nomina_detalle nd
                  INNER JOIN {$this->bd}rrhh_empleados e ON e.id = nd.empleado_id
                  INNER JOIN {$this->bd}rrhh_puestos p ON p.id = e.puesto_id
                  INNER JOIN {$this->bd}rrhh_turnos t ON t.id = e.turno_id
                  WHERE nd.periodo_id = ?
                  ORDER BY e.nombre ASC";

        return $this->_Read($query, [$array['periodo_id']]);
    }

    function getNominaCounts($array) {
        $query = "SELECT
                    SUM(total_nomina) AS total_general,
                    SUM(a_pagar_efectivo) AS total_efectivo,
                    SUM(a_pagar_bancos) AS total_bancos,
                    COUNT(*) AS total_colaboradores
                  FROM {$this->bd}rrhh_nomina_detalle
                  WHERE periodo_id = ?";

        $result = $this->_Read($query, [$array['periodo_id']]);
        return !empty($result) ? $result[0] : null;
    }

    function createNominaPeriodo($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}rrhh_nomina_periodos",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateNominaPeriodo($array) {
        return $this->_Update([
            'table'  => "{$this->bd}rrhh_nomina_periodos",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    function createNominaDetalle($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}rrhh_nomina_detalle",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateNominaDetalle($array) {
        return $this->_Update([
            'table'  => "{$this->bd}rrhh_nomina_detalle",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    function getIncidenciasPeriodo($array) {
        $query = "SELECT empleado_id,
                    SUM(CASE WHEN estatus IN ('atiempo','retardo') THEN 1 ELSE 0 END) AS dias_laborados,
                    SUM(CASE WHEN estatus = 'falta' THEN 1 ELSE 0 END) AS dias_faltas,
                    SUM(CASE WHEN estatus = 'vacaciones' THEN 1 ELSE 0 END) AS dias_vacaciones,
                    SUM(CASE WHEN estatus = 'incapacidad' THEN 1 ELSE 0 END) AS dias_incapacidad
                  FROM {$this->bd}rrhh_incidencias
                  WHERE subsidiaries_id = ? AND fecha BETWEEN ? AND ?
                  GROUP BY empleado_id";

        return $this->_Read($query, [$array['subsidiaries_id'], $array['fecha_inicio'], $array['fecha_fin']]);
    }

    function getEmpleadosActivosBySucursal($array) {
        $query = "SELECT id, codigo_empleado, nombre, apellido_paterno, salario_diario
                  FROM {$this->bd}rrhh_empleados
                  WHERE subsidiaries_id = ? AND estado = 'activo'
                  ORDER BY nombre ASC";

        return $this->_Read($query, [$array['subsidiaries_id']]);
    }

    // ===================== RESUMEN =====================

    function getResumenCounts($array) {
        $where = "1=1";
        $data  = [];

        if (!empty($array['subsidiaries_id']) && $array['subsidiaries_id'] != '0') {
            $where .= " AND subsidiaries_id = ?";
            $data[] = $array['subsidiaries_id'];
        }

        $query = "SELECT
                    COUNT(*) AS total_empleados,
                    SUM(CASE WHEN estado = 'activo' THEN 1 ELSE 0 END) AS activos,
                    SUM(CASE WHEN estado = 'baja' THEN 1 ELSE 0 END) AS bajas,
                    SUM(CASE WHEN fecha_ingreso >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS altas_periodo,
                    SUM(CASE WHEN fecha_baja >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS bajas_periodo
                  FROM {$this->bd}rrhh_empleados
                  WHERE {$where}";

        $result = $this->_Read($query, empty($data) ? null : $data);
        return !empty($result) ? $result[0] : null;
    }

    function getResumenPermisosPendientes($array) {
        $where = "p.estatus = 'pendiente'";
        $data  = [];

        if (!empty($array['subsidiaries_id']) && $array['subsidiaries_id'] != '0') {
            $where .= " AND e.subsidiaries_id = ?";
            $data[] = $array['subsidiaries_id'];
        }

        $query = "SELECT p.id, p.codigo, p.tipo, p.fecha_inicio, p.fecha_fin, p.estatus,
                    CONCAT(e.nombre, ' ', e.apellido_paterno) AS nombre_completo,
                    pu.nombre AS puesto, pu.color_badge
                  FROM {$this->bd}rrhh_permisos p
                  INNER JOIN {$this->bd}rrhh_empleados e ON e.id = p.empleado_id
                  INNER JOIN {$this->bd}rrhh_puestos pu ON pu.id = e.puesto_id
                  WHERE {$where}
                  ORDER BY p.created_at DESC
                  LIMIT 10";

        return $this->_Read($query, empty($data) ? null : $data);
    }

    // ===================== AUTORIZACION =====================

    function createAutorizacion($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}rrhh_autorizaciones_log",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function getUserPassword($array) {
        $query = "SELECT id, `key` AS password FROM fayxzvov_alpha.usr_users WHERE id = ?";
        return $this->_Read($query, $array);
    }
}
?>
