<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-rrhh.php';

class ctrl extends mdl {

    function init() {
        $subsidiaries = $this->lsSubsidiaries();
        $puestos      = $this->lsPuestos();
        $turnos       = $this->lsTurnos();

        return [
            'status'        => 200,
            'subsidiaries'  => $subsidiaries,
            'puestos'       => $puestos,
            'turnos'        => $turnos,
            'usr'           => $_SESSION['USR'] ?? null,
            'sub'           => $_SESSION['SUB'] ?? null,
            'rol'           => $_SESSION['ROLID'] ?? null
        ];
    }

    // ===================== RESUMEN =====================

    function showResumen() {
        $subsidiariesId = $_POST['subsidiaries_id'];
        $counts  = $this->getResumenCounts(['subsidiaries_id' => $subsidiariesId]);
        $permisos = $this->getResumenPermisosPendientes(['subsidiaries_id' => $subsidiariesId]);

        $__permisos = [];
        foreach ($permisos as $row) {
            $__permisos[] = [
                'id'       => $row['id'],
                'codigo'   => $row['codigo'],
                'nombre'   => $row['nombre_completo'],
                'puesto'   => badgePuesto($row['puesto'], $row['color_badge']),
                'tipo'     => badgeTipoPermiso($row['tipo']),
                'fecha'    => $row['fecha_inicio'] . ' / ' . $row['fecha_fin'],
                'estatus'  => badgeEstatus($row['estatus'])
            ];
        }

        return [
            'status'   => 200,
            'counts'   => $counts,
            'permisos' => ['row' => $__permisos]
        ];
    }

    // ===================== PERSONAL =====================

    function lsPersonal() {
        $subsidiariesId = $_POST['subsidiaries_id'];
        $estado         = $_POST['estado'];
        $puestoId       = $_POST['puesto_id'];
        $turnoId        = $_POST['turno_id'];

        $ls = $this->listPersonal([
            'subsidiaries_id' => $subsidiariesId,
            'estado'          => $estado,
            'puesto_id'       => $puestoId,
            'turno_id'        => $turnoId
        ]);

        $__row = [];
        foreach ($ls as $row) {
            $actions = [];
            $actions[] = [
                'class'   => 'btn btn-sm btn-primary me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'app.editPersonal(' . $row['id'] . ')'
            ];
            $actions[] = [
                'class'   => 'btn btn-sm btn-danger',
                'html'    => '<i class="icon-trash"></i>',
                'onclick' => 'app.deletePersonal(' . $row['id'] . ')'
            ];

            $__row[] = [
                'id'        => $row['id'],
                'codigo'    => $row['codigo_empleado'],
                'nombre'    => $row['nombre'] . ' ' . $row['apellido_paterno'],
                'puesto'    => badgePuesto($row['puesto'], $row['color_badge']),
                'turno'     => $row['turno'],
                'sucursal'  => $row['sucursal'],
                'salario'   => '$' . number_format($row['salario_diario'], 2),
                'estado'    => badgeEstadoEmpleado($row['estado']),
                'ingreso'   => $row['fecha_ingreso'],
                'a'         => $actions
            ];
        }

        return ['row' => $__row];
    }

    function showPersonal() {
        $subsidiariesId = $_POST['subsidiaries_id'];
        $counts = $this->getPersonalCounts(['subsidiaries_id' => $subsidiariesId]);
        return ['status' => 200, 'counts' => $counts];
    }

    function getPersonal() {
        $id = $_POST['id'];
        $data = $this->getPersonalById([$id]);

        return [
            'status' => $data ? 200 : 404,
            'data'   => $data
        ];
    }

    function addPersonal() {
        $maxNum = $this->getMaxPersonalCodigo();
        $codigo = 'EMP-' . str_pad(($maxNum + 1), 4, '0', STR_PAD_LEFT);
        $_POST['codigo_empleado'] = $codigo;
        $_POST['created_by'] = $_SESSION['USR'];

        $result = $this->createPersonal($this->util->sql($_POST));

        return [
            'status'  => $result ? 200 : 500,
            'message' => $result ? 'Colaborador registrado correctamente' : 'Error al registrar colaborador'
        ];
    }

    function editPersonal() {
        $_POST['updated_by'] = $_SESSION['USR'];
        $result = $this->updatePersonal($this->util->sql($_POST, 1));

        return [
            'status'  => $result ? 200 : 500,
            'message' => $result ? 'Colaborador actualizado correctamente' : 'Error al actualizar colaborador'
        ];
    }

    function statusPersonal() {
        $id     = $_POST['id'];
        $estado = $_POST['estado'];

        $data = ['estado', $estado, $id];
        $result = $this->_Update([
            'table'  => "fayxzvov_rrhh.rrhh_empleados",
            'values' => 'estado = ?',
            'where'  => 'id = ?',
            'data'   => [$estado, $id]
        ]);

        return [
            'status'  => $result ? 200 : 500,
            'message' => $result ? 'Estado actualizado' : 'Error al actualizar estado'
        ];
    }

    // ===================== PERMISOS =====================

    function lsPermisos() {
        $subsidiariesId = $_POST['subsidiaries_id'];
        $estatus        = $_POST['estatus'];
        $tipo           = $_POST['tipo'];

        $ls = $this->listPermisos([
            'subsidiaries_id' => $subsidiariesId,
            'estatus'         => $estatus,
            'tipo'            => $tipo
        ]);

        $__row = [];
        foreach ($ls as $row) {
            $actions = [];
            if ($row['estatus'] === 'pendiente') {
                $actions[] = [
                    'class'   => 'btn btn-sm btn-success me-1',
                    'html'    => '<i class="icon-ok"></i>',
                    'onclick' => 'app.aprobarPermiso(' . $row['id'] . ')'
                ];
                $actions[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-cancel"></i>',
                    'onclick' => 'app.rechazarPermiso(' . $row['id'] . ')'
                ];
            }

            $__row[] = [
                'id'       => $row['id'],
                'codigo'   => $row['codigo'],
                'nombre'   => $row['nombre_completo'],
                'puesto'   => badgePuesto($row['puesto'], $row['color_badge']),
                'tipo'     => badgeTipoPermiso($row['tipo']),
                'inicio'   => $row['fecha_inicio'],
                'fin'      => $row['fecha_fin'],
                'dias'     => $row['dias'],
                'estatus'  => badgeEstatus($row['estatus']),
                'a'        => $actions
            ];
        }

        return ['row' => $__row];
    }

    function getPermiso() {
        $id = $_POST['id'];
        $data = $this->getPermisoById([$id]);
        return [
            'status' => $data ? 200 : 404,
            'data'   => $data
        ];
    }

    function addPermiso() {
        $maxNum = $this->getMaxPermisoCodigo();
        $codigo = 'PC-' . str_pad(($maxNum + 1), 4, '0', STR_PAD_LEFT);
        $_POST['codigo'] = $codigo;
        $_POST['solicitado_por'] = $_SESSION['USR'];

        $fechaInicio = $_POST['fecha_inicio'];
        $fechaFin    = $_POST['fecha_fin'];
        $dias = (strtotime($fechaFin) - strtotime($fechaInicio)) / 86400 + 1;
        $_POST['dias'] = $dias;

        $result = $this->createPermiso($this->util->sql($_POST));

        return [
            'status'  => $result ? 200 : 500,
            'message' => $result ? 'Permiso registrado correctamente' : 'Error al registrar permiso'
        ];
    }

    function editPermiso() {
        $result = $this->updatePermiso($this->util->sql($_POST, 1));
        return [
            'status'  => $result ? 200 : 500,
            'message' => $result ? 'Permiso actualizado' : 'Error al actualizar'
        ];
    }

    // ===================== INCIDENCIAS =====================

    function lsIncidenciaDiario() {
        $fecha          = $_POST['fecha'];
        $subsidiariesId = $_POST['subsidiaries_id'];
        $turnoId        = $_POST['turno_id'];
        $estatus        = $_POST['estatus'];

        $ls = $this->listIncidenciaDiario([
            'fecha'           => $fecha,
            'subsidiaries_id' => $subsidiariesId,
            'turno_id'        => $turnoId,
            'estatus'         => $estatus
        ]);

        $__row = [];
        foreach ($ls as $row) {
            $__row[] = [
                'id'            => $row['id'],
                'nombre'        => $row['nombre_completo'],
                'puesto'        => badgePuesto($row['puesto'], $row['color_badge']),
                'turno'         => $row['turno'],
                'tipo_ingreso'  => $row['tipo_ingreso'],
                'hora_entrada'  => $row['hora_entrada'] ?? '--:--',
                'estatus'       => badgeIncidencia($row['estatus']),
                'a'             => [[
                    'class'   => 'btn btn-sm btn-outline-secondary',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'app.editIncidencia(' . $row['id'] . ')'
                ]]
            ];
        }

        return ['row' => $__row];
    }

    function lsIncidenciaPersonalizado() {
        $fechaInicio    = $_POST['fecha_inicio'];
        $fechaFin       = $_POST['fecha_fin'];
        $subsidiariesId = $_POST['subsidiaries_id'];

        $ls = $this->listIncidenciaPersonalizado([
            'fecha_inicio'    => $fechaInicio,
            'fecha_fin'       => $fechaFin,
            'subsidiaries_id' => $subsidiariesId
        ]);

        return ['status' => 200, 'data' => $ls];
    }

    function editIncidencia() {
        $result = $this->updateIncidencia($this->util->sql($_POST, 1));
        return [
            'status'  => $result ? 200 : 500,
            'message' => $result ? 'Incidencia actualizada' : 'Error al actualizar'
        ];
    }

    // ===================== NOMINA =====================

    function lsNomina() {
        $subsidiariesId = $_POST['subsidiaries_id'];
        $ls = $this->listNominaPeriodos(['subsidiaries_id' => $subsidiariesId]);

        $__row = [];
        foreach ($ls as $row) {
            $actions = [];
            if ($row['estatus'] === 'calculada') {
                $actions[] = [
                    'class'   => 'btn btn-sm btn-success me-1',
                    'html'    => '<i class="icon-ok"></i> Aprobar',
                    'onclick' => 'app.aprobarNomina(' . $row['id'] . ')'
                ];
            }
            $actions[] = [
                'class'   => 'btn btn-sm btn-primary',
                'html'    => '<i class="icon-eye"></i>',
                'onclick' => 'app.verNominaDetalle(' . $row['id'] . ')'
            ];

            $__row[] = [
                'id'          => $row['id'],
                'codigo'      => $row['codigo'],
                'sucursal'    => $row['sucursal'],
                'periodo'     => $row['fecha_inicio'] . ' / ' . $row['fecha_fin'],
                'frecuencia'  => $row['frecuencia'],
                'total'       => '$' . number_format($row['total_general'], 2),
                'colaboradores' => $row['total_colaboradores'],
                'estatus'     => badgeEstatusNomina($row['estatus']),
                'a'           => $actions
            ];
        }

        return ['row' => $__row];
    }

    function showNomina() {
        $periodoId = $_POST['periodo_id'];
        $detalle = $this->listNominaDetalle(['periodo_id' => $periodoId]);
        $totals  = $this->getNominaCounts(['periodo_id' => $periodoId]);

        $__row = [];
        foreach ($detalle as $row) {
            $__row[] = [
                'id'              => $row['id'],
                'codigo'          => $row['codigo_empleado'],
                'nombre'          => $row['nombre_completo'],
                'puesto'          => $row['puesto'],
                'dias_laborados'  => $row['dias_laborados'],
                'dias_faltas'     => $row['dias_faltas'],
                'sueldo_diario'   => '$' . number_format($row['sueldo_diario'], 2),
                'salario_total'   => '$' . number_format($row['salario_total'], 2),
                'bonos'           => '$' . number_format($row['bonos'], 2),
                'descuentos'      => '$' . number_format($row['descuentos'], 2),
                'total_nomina'    => '$' . number_format($row['total_nomina'], 2)
            ];
        }

        return [
            'status' => 200,
            'row'    => $__row,
            'totals' => $totals
        ];
    }

    function addNomina() {
        $subsidiariesId = $_POST['subsidiaries_id'];
        $companiesId    = $_POST['companies_id'];
        $fechaInicio    = $_POST['fecha_inicio'];
        $fechaFin       = $_POST['fecha_fin'];
        $frecuencia     = $_POST['frecuencia'];

        $codigo = 'NOM-' . date('Ymd') . '-' . $subsidiariesId;

        $periodoResult = $this->createNominaPeriodo($this->util->sql([
            'codigo'          => $codigo,
            'subsidiaries_id' => $subsidiariesId,
            'companies_id'    => $companiesId,
            'fecha_inicio'    => $fechaInicio,
            'fecha_fin'       => $fechaFin,
            'frecuencia'      => $frecuencia,
            'estatus'         => 'calculada',
            'calculado_por'   => $_SESSION['USR'],
            'calculado_at'    => date('Y-m-d H:i:s')
        ]));

        if (!$periodoResult) {
            return ['status' => 500, 'message' => 'Error al crear periodo'];
        }

        $periodoId = $this->_Read("SELECT MAX(id) AS id FROM fayxzvov_rrhh.rrhh_nomina_periodos")[0]['id'];

        $empleados   = $this->getEmpleadosActivosBySucursal(['subsidiaries_id' => $subsidiariesId]);
        $incidencias = $this->getIncidenciasPeriodo([
            'subsidiaries_id' => $subsidiariesId,
            'fecha_inicio'    => $fechaInicio,
            'fecha_fin'       => $fechaFin
        ]);

        $incMap = [];
        foreach ($incidencias as $inc) {
            $incMap[$inc['empleado_id']] = $inc;
        }

        $totalEfectivo = 0;
        $totalBancos   = 0;
        $totalGeneral  = 0;

        foreach ($empleados as $emp) {
            $empInc = $incMap[$emp['id']] ?? [
                'dias_laborados'  => 0,
                'dias_faltas'     => 0,
                'dias_vacaciones' => 0,
                'dias_incapacidad'=> 0
            ];

            $diasLab  = $empInc['dias_laborados'];
            $diasFalt = $empInc['dias_faltas'];
            $diasVac  = $empInc['dias_vacaciones'];
            $diasInc  = $empInc['dias_incapacidad'];
            $sueldo   = $emp['salario_diario'];

            $salarioTotal = $diasLab * $sueldo;
            $descFaltas   = $diasFalt * $sueldo;
            $totalNomina  = $salarioTotal - $descFaltas;
            $pagarBancos  = $totalNomina;

            $totalBancos  += $pagarBancos;
            $totalGeneral += $totalNomina;

            $this->createNominaDetalle($this->util->sql([
                'periodo_id'              => $periodoId,
                'empleado_id'             => $emp['id'],
                'dias_laborados'          => $diasLab,
                'dias_faltas'             => $diasFalt,
                'dias_vacaciones'         => $diasVac,
                'dias_incapacidad'        => $diasInc,
                'sueldo_diario'           => $sueldo,
                'salario_total'           => $salarioTotal,
                'faltas_retardos_descuento' => $descFaltas,
                'a_pagar_bancos'          => $pagarBancos,
                'total_nomina'            => $totalNomina
            ]));
        }

        $this->_Update([
            'table'  => 'fayxzvov_rrhh.rrhh_nomina_periodos',
            'values' => 'total_efectivo = ?, total_bancos = ?, total_general = ?, total_colaboradores = ?',
            'where'  => 'id = ?',
            'data'   => [$totalEfectivo, $totalBancos, $totalGeneral, count($empleados), $periodoId]
        ]);

        return ['status' => 200, 'message' => 'Nomina calculada correctamente', 'periodo_id' => $periodoId];
    }

    function editNomina() {
        $result = $this->updateNominaPeriodo($this->util->sql($_POST, 1));
        return [
            'status'  => $result ? 200 : 500,
            'message' => $result ? 'Nomina actualizada' : 'Error al actualizar'
        ];
    }

    // ===================== AUTORIZACION =====================

    function addAutorizacion() {
        $password = $_POST['password'];
        $userId   = $_SESSION['USR'];

        $user = $this->getUserPassword([$userId]);
        if (empty($user)) {
            return ['status' => 401, 'message' => 'Usuario no encontrado'];
        }

        $storedPass = $user[0]['password'];
        $valid = (md5($password) === $storedPass || password_verify($password, $storedPass) || $password === $storedPass);

        if (!$valid) {
            return ['status' => 401, 'message' => 'Contraseña incorrecta'];
        }

        $accion     = $_POST['accion'];
        $tabla      = $_POST['tabla_afectada'];
        $registroId = $_POST['registro_id'];

        $this->createAutorizacion($this->util->sql([
            'usr_users_id'  => $userId,
            'accion'        => $accion,
            'tabla_afectada' => $tabla,
            'registro_id'   => $registroId,
            'valor_anterior' => $_POST['valor_anterior'] ?? '',
            'valor_nuevo'   => $_POST['valor_nuevo'] ?? '',
            'ip'            => $_SERVER['REMOTE_ADDR'],
            'user_agent'    => $_SERVER['HTTP_USER_AGENT']
        ]));

        return ['status' => 200, 'message' => 'Autorizado correctamente'];
    }
}

// ===================== COMPLEMENTS =====================

function badgePuesto($puesto, $color) {
    $colors = [
        'purple' => ['bg' => '#2d1b69', 'text' => '#c4b5fd'],
        'blue'   => ['bg' => '#1e3a5f', 'text' => '#93c5fd'],
        'gray'   => ['bg' => '#374151', 'text' => '#9ca3af'],
        'orange' => ['bg' => '#5c3d1a', 'text' => '#fb923c']
    ];
    $c = $colors[$color] ?? $colors['gray'];
    return "<span class='px-2 py-1 rounded-md text-xs font-semibold' style='background-color:{$c['bg']}; color:{$c['text']}'>{$puesto}</span>";
}

function badgeEstatus($estatus) {
    $map = [
        'aprobado'    => ['bg' => '#014737', 'text' => '#3fc189', 'label' => 'Aprobado'],
        'rechazado'   => ['bg' => '#721c24', 'text' => '#ea0234', 'label' => 'Rechazado'],
        'pendiente'   => ['bg' => '#78350f', 'text' => '#fbbf24', 'label' => 'Pendiente'],
        'sin_estatus' => ['bg' => '#374151', 'text' => '#9ca3af', 'label' => 'Sin Estatus']
    ];
    $s = $map[$estatus] ?? $map['sin_estatus'];
    return "<span class='px-2 py-1 rounded-md text-xs font-semibold' style='background-color:{$s['bg']}; color:{$s['text']}'>{$s['label']}</span>";
}

function badgeEstadoEmpleado($estado) {
    $map = [
        'activo'     => ['bg' => '#014737', 'text' => '#3fc189', 'label' => 'Activo'],
        'baja'       => ['bg' => '#721c24', 'text' => '#ea0234', 'label' => 'Baja'],
        'suspendido' => ['bg' => '#78350f', 'text' => '#fbbf24', 'label' => 'Suspendido']
    ];
    $s = $map[$estado] ?? $map['activo'];
    return "<span class='px-2 py-1 rounded-md text-xs font-semibold' style='background-color:{$s['bg']}; color:{$s['text']}'>{$s['label']}</span>";
}

function badgeTipoPermiso($tipo) {
    $map = [
        'incapacidad' => ['bg' => '#831843', 'text' => '#f472b6', 'label' => 'Incapacidad'],
        'vacaciones'  => ['bg' => '#2d1b69', 'text' => '#c4b5fd', 'label' => 'Vacaciones'],
        'permiso'     => ['bg' => '#5c3d1a', 'text' => '#fb923c', 'label' => 'Permiso']
    ];
    $s = $map[$tipo] ?? ['bg' => '#374151', 'text' => '#9ca3af', 'label' => $tipo];
    return "<span class='px-2 py-1 rounded-md text-xs font-semibold' style='background-color:{$s['bg']}; color:{$s['text']}'>{$s['label']}</span>";
}

function badgeIncidencia($estatus) {
    $map = [
        'atiempo'        => ['bg' => '#014737', 'text' => '#3fc189', 'label' => 'A Tiempo'],
        'retardo'        => ['bg' => '#721c24', 'text' => '#ea0234', 'label' => 'Retardo'],
        'falta'          => ['bg' => '#721c24', 'text' => '#ea0234', 'label' => 'Falta'],
        'sin_estatus'    => ['bg' => '#374151', 'text' => '#9ca3af', 'label' => 'Sin Estatus'],
        'vacaciones'     => ['bg' => '#2d1b69', 'text' => '#c4b5fd', 'label' => 'Vacaciones'],
        'incapacidad'    => ['bg' => '#831843', 'text' => '#f472b6', 'label' => 'Incapacidad'],
        'reconocimiento' => ['bg' => '#14532d', 'text' => '#86efac', 'label' => 'Reconocimiento']
    ];
    $s = $map[$estatus] ?? $map['sin_estatus'];
    return "<span class='px-2 py-1 rounded-md text-xs font-semibold' style='background-color:{$s['bg']}; color:{$s['text']}'>{$s['label']}</span>";
}

function badgeEstatusNomina($estatus) {
    $map = [
        'abierta'    => ['bg' => '#1e3a5f', 'text' => '#93c5fd', 'label' => 'Abierta'],
        'calculada'  => ['bg' => '#78350f', 'text' => '#fbbf24', 'label' => 'Calculada'],
        'aprobada'   => ['bg' => '#014737', 'text' => '#3fc189', 'label' => 'Aprobada'],
        'pagada'     => ['bg' => '#14532d', 'text' => '#86efac', 'label' => 'Pagada'],
        'cancelada'  => ['bg' => '#721c24', 'text' => '#ea0234', 'label' => 'Cancelada']
    ];
    $s = $map[$estatus] ?? $map['abierta'];
    return "<span class='px-2 py-1 rounded-md text-xs font-semibold' style='background-color:{$s['bg']}; color:{$s['text']}'>{$s['label']}</span>";
}

$obj = new ctrl();
if (ob_get_length()) ob_clean();
header('Content-Type: application/json');
echo json_encode($obj->{$_POST['opc']}());
