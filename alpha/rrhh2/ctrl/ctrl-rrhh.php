<?php
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-rrhh.php';

class ctrl extends mdl {

    function init() {
        $subsidiaries = $this->lsSubsidiaries();
        $puestos      = $this->lsPuestos();
        $turnos       = $this->lsTurnos();

        return [
            'status'       => 200,
            'subsidiaries' => $subsidiaries,
            'puestos'      => $puestos,
            'turnos'       => $turnos,
            'usr'          => $_SESSION['USR'],
            'sub'          => $_SESSION['SUB'],
            'rol'          => $_SESSION['ROLID']
        ];
    }

    function getEmpleadosSelect() {
        $subsidiariesId = $_POST['subsidiaries_id'];
        return $this->lsEmpleados(['subsidiaries_id' => $subsidiariesId]);
    }

    // Resumen:

    function showResumen() {
        $subsidiariesId = $_POST['subsidiaries_id'];

        $counts   = $this->getResumenCounts(['subsidiaries_id' => $subsidiariesId]);
        $permisos = $this->getResumenPermisosPendientes(['subsidiaries_id' => $subsidiariesId]);

        $__permisos = [];
        foreach ($permisos as $permiso) {
            $__permisos[] = [
                'id'      => $permiso['id'],
                'codigo'  => $permiso['codigo'],
                'nombre'  => $permiso['nombre_completo'],
                'puesto'  => badgePuesto($permiso['puesto'], $permiso['color_badge']),
                'tipo'    => badgeTipoPermiso($permiso['tipo']),
                'fecha'   => $permiso['fecha_inicio'] . ' / ' . $permiso['fecha_fin'],
                'estatus' => badgeEstatus($permiso['estatus']),
                'opc'     => 0
            ];
        }

        return [
            'status'   => 200,
            'counts'   => $counts,
            'permisos' => ['row' => $__permisos]
        ];
    }

    // Personal:

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
        foreach ($ls as $empleado) {
            $__row[] = [
                'id'       => $empleado['id'],
                'codigo'   => $empleado['codigo_empleado'],
                'nombre'   => $empleado['nombre'] . ' ' . $empleado['apellido_paterno'],
                'puesto'   => badgePuesto($empleado['puesto'], $empleado['color_badge']),
                'turno'    => $empleado['turno'],
                'sucursal' => $empleado['sucursal'],
                'salario'  => evaluar($empleado['salario_diario']),
                'estado'   => badgeEstadoEmpleado($empleado['estado']),
                'ingreso'  => formatSpanishDate($empleado['fecha_ingreso']),
                'a'        => actionButtonsPersonal($empleado['id'])
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function showPersonal() {
        $subsidiariesId = $_POST['subsidiaries_id'];
        $counts = $this->getPersonalCounts(['subsidiaries_id' => $subsidiariesId]);

        return [
            'status' => 200,
            'counts' => $counts
        ];
    }

    function getPersonal() {
        $id   = $_POST['id'];
        $data = $this->getPersonalById([$id]);

        return [
            'status' => $data ? 200 : 404,
            'data'   => $data
        ];
    }

    function addPersonal() {
        $status  = 500;
        $message = 'Error al registrar colaborador';

        $maxNum = $this->getMaxPersonalCodigo();
        $codigo = 'EMP-' . str_pad(($maxNum + 1), 4, '0', STR_PAD_LEFT);
        $_POST['codigo_empleado'] = $codigo;
        $_POST['created_by']     = $_SESSION['USR'];

        $result = $this->createPersonal($this->util->sql($_POST));

        if ($result) {
            $status  = 200;
            $message = 'Colaborador registrado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editPersonal() {
        $status  = 500;
        $message = 'Error al actualizar colaborador';

        $_POST['updated_by'] = $_SESSION['USR'];
        $result = $this->updatePersonal($this->util->sql($_POST, 1));

        if ($result) {
            $status  = 200;
            $message = 'Colaborador actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function statusPersonal() {
        $status  = 500;
        $message = 'Error al actualizar estado';

        $result = $this->updatePersonal($this->util->sql($_POST, 1));

        if ($result) {
            $status  = 200;
            $message = 'Estado actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Permisos:

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
        foreach ($ls as $permiso) {
            $__row[] = [
                'id'      => $permiso['id'],
                'codigo'  => $permiso['codigo'],
                'nombre'  => $permiso['nombre_completo'],
                'puesto'  => badgePuesto($permiso['puesto'], $permiso['color_badge']),
                'tipo'    => badgeTipoPermiso($permiso['tipo']),
                'inicio'  => $permiso['fecha_inicio'],
                'fin'     => $permiso['fecha_fin'],
                'dias'    => $permiso['dias'],
                'estatus' => badgeEstatus($permiso['estatus']),
                'a'       => actionButtonsPermiso($permiso['id'], $permiso['estatus'])
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function getPermiso() {
        $id   = $_POST['id'];
        $data = $this->getPermisoById([$id]);

        return [
            'status' => $data ? 200 : 404,
            'data'   => $data
        ];
    }

    function addPermiso() {
        $status  = 500;
        $message = 'Error al registrar permiso';

        $maxNum = $this->getMaxPermisoCodigo();
        $codigo = 'PC-' . str_pad(($maxNum + 1), 4, '0', STR_PAD_LEFT);
        $_POST['codigo']        = $codigo;
        $_POST['solicitado_por'] = $_SESSION['USR'];

        $fechaInicio = $_POST['fecha_inicio'];
        $fechaFin    = $_POST['fecha_fin'];
        $dias = (strtotime($fechaFin) - strtotime($fechaInicio)) / 86400 + 1;
        $_POST['dias'] = $dias;

        $result = $this->createPermiso($this->util->sql($_POST));

        if ($result) {
            $status  = 200;
            $message = 'Permiso registrado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editPermiso() {
        $status  = 500;
        $message = 'Error al actualizar permiso';

        $result = $this->updatePermiso($this->util->sql($_POST, 1));

        if ($result) {
            $status  = 200;
            $message = 'Permiso actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Incidencias:

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
        foreach ($ls as $incidencia) {
            $__row[] = [
                'id'           => $incidencia['id'],
                'nombre'       => $incidencia['nombre_completo'],
                'puesto'       => badgePuesto($incidencia['puesto'], $incidencia['color_badge']),
                'turno'        => $incidencia['turno'],
                'tipo_ingreso' => $incidencia['tipo_ingreso'],
                'hora_entrada' => $incidencia['hora_entrada'],
                'estatus'      => badgeIncidencia($incidencia['estatus']),
                'a'            => actionButtonsIncidencia($incidencia['id'])
            ];
        }

        return ['row' => $__row, 'thead' => ''];
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
        $status  = 500;
        $message = 'Error al actualizar incidencia';

        $result = $this->updateIncidencia($this->util->sql($_POST, 1));

        if ($result) {
            $status  = 200;
            $message = 'Incidencia actualizada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Nomina:

    function lsNomina() {
        $subsidiariesId = $_POST['subsidiaries_id'];
        $ls = $this->listNominaPeriodos(['subsidiaries_id' => $subsidiariesId]);

        $__row = [];
        foreach ($ls as $periodo) {
            $__row[] = [
                'id'            => $periodo['id'],
                'codigo'        => $periodo['codigo'],
                'sucursal'      => $periodo['sucursal'],
                'periodo'       => $periodo['fecha_inicio'] . ' / ' . $periodo['fecha_fin'],
                'frecuencia'    => $periodo['frecuencia'],
                'total'         => evaluar($periodo['total_general']),
                'colaboradores' => $periodo['total_colaboradores'],
                'estatus'       => badgeEstatusNomina($periodo['estatus']),
                'a'             => actionButtonsNomina($periodo['id'], $periodo['estatus'])
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function showNomina() {
        $periodoId = $_POST['periodo_id'];
        $detalle   = $this->listNominaDetalle(['periodo_id' => $periodoId]);
        $totals    = $this->getNominaCounts(['periodo_id' => $periodoId]);

        $__row = [];
        foreach ($detalle as $registro) {
            $__row[] = [
                'id'             => $registro['id'],
                'codigo'         => $registro['codigo_empleado'],
                'nombre'         => $registro['nombre_completo'],
                'puesto'         => $registro['puesto'],
                'dias_laborados' => $registro['dias_laborados'],
                'dias_faltas'    => $registro['dias_faltas'],
                'sueldo_diario'  => evaluar($registro['sueldo_diario']),
                'salario_total'  => evaluar($registro['salario_total']),
                'bonos'          => evaluar($registro['bonos']),
                'descuentos'     => evaluar($registro['descuentos']),
                'total_nomina'   => evaluar($registro['total_nomina']),
                'opc'            => 0
            ];
        }

        return [
            'status' => 200,
            'row'    => $__row,
            'totals' => $totals
        ];
    }

    function addNomina() {
        $status  = 500;
        $message = 'Error al crear periodo de nomina';

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
            return ['status' => $status, 'message' => $message];
        }

        $periodoId   = $this->getMaxNominaPeriodoId();
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
            $empInc = isset($incMap[$emp['id']]) ? $incMap[$emp['id']] : [
                'dias_laborados'   => 0,
                'dias_faltas'      => 0,
                'dias_vacaciones'  => 0,
                'dias_incapacidad' => 0
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
                'periodo_id'                => $periodoId,
                'empleado_id'               => $emp['id'],
                'dias_laborados'            => $diasLab,
                'dias_faltas'               => $diasFalt,
                'dias_vacaciones'           => $diasVac,
                'dias_incapacidad'          => $diasInc,
                'sueldo_diario'             => $sueldo,
                'salario_total'             => $salarioTotal,
                'faltas_retardos_descuento' => $descFaltas,
                'a_pagar_bancos'            => $pagarBancos,
                'total_nomina'              => $totalNomina
            ]));
        }

        $this->updateNominaPeriodo($this->util->sql([
            'id'                  => $periodoId,
            'total_efectivo'      => $totalEfectivo,
            'total_bancos'        => $totalBancos,
            'total_general'       => $totalGeneral,
            'total_colaboradores' => count($empleados)
        ], 1));

        return [
            'status'     => 200,
            'message'    => 'Nomina calculada correctamente',
            'periodo_id' => $periodoId
        ];
    }

    function editNomina() {
        $status  = 500;
        $message = 'Error al actualizar nomina';

        $result = $this->updateNominaPeriodo($this->util->sql($_POST, 1));

        if ($result) {
            $status  = 200;
            $message = 'Nomina actualizada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Autorizacion:

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
            return ['status' => 401, 'message' => 'Contrasena incorrecta'];
        }

        $accion     = $_POST['accion'];
        $tabla      = $_POST['tabla_afectada'];
        $registroId = $_POST['registro_id'];

        $this->createAutorizacion($this->util->sql([
            'usr_users_id'   => $userId,
            'accion'         => $accion,
            'tabla_afectada' => $tabla,
            'registro_id'    => $registroId,
            'valor_anterior' => $_POST['valor_anterior'],
            'valor_nuevo'    => $_POST['valor_nuevo'],
            'ip'             => $_SERVER['REMOTE_ADDR'],
            'user_agent'     => $_SERVER['HTTP_USER_AGENT']
        ]));

        return ['status' => 200, 'message' => 'Autorizado correctamente'];
    }
}

// Complements

function actionButtonsPersonal($id) {
    return [
        [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 me-1',
            'html'    => '<i class="icon-pencil"></i>',
            'onclick' => "personal.editPersonal($id)"
        ],
        [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/20 hover:bg-red-500/30 text-red-400',
            'html'    => '<i class="icon-trash"></i>',
            'onclick' => "personal.deletePersonal($id)"
        ]
    ];
}

function actionButtonsPermiso($id, $estatus) {
    $actions = [];

    if ($estatus === 'pendiente') {
        $actions[] = [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-green-500/20 hover:bg-green-500/30 text-green-400 me-1',
            'html'    => '<i class="icon-ok"></i>',
            'onclick' => "permisos.aprobarPermiso($id)"
        ];
        $actions[] = [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/20 hover:bg-red-500/30 text-red-400',
            'html'    => '<i class="icon-cancel"></i>',
            'onclick' => "permisos.rechazarPermiso($id)"
        ];
    }

    return $actions;
}

function actionButtonsIncidencia($id) {
    return [
        [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-gray-500/20 hover:bg-gray-500/30 text-gray-400',
            'html'    => '<i class="icon-pencil"></i>',
            'onclick' => "incidencias.editIncidencia($id)"
        ]
    ];
}

function actionButtonsNomina($id, $estatus) {
    $actions = [];

    if ($estatus === 'calculada') {
        $actions[] = [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-green-500/20 hover:bg-green-500/30 text-green-400 me-1',
            'html'    => '<i class="icon-ok"></i>',
            'onclick' => "nomina.aprobarNomina($id)"
        ];
    }

    $actions[] = [
        'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400',
        'html'    => '<i class="icon-eye"></i>',
        'onclick' => "nomina.verNominaDetalle($id)"
    ];

    return $actions;
}

function badgePuesto($puesto, $color) {
    $colors = [
        'purple' => 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        'blue'   => 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        'gray'   => 'bg-gray-500/15 text-gray-400 border-gray-500/30',
        'orange' => 'bg-orange-500/15 text-orange-400 border-orange-500/30'
    ];
    $c = $colors[$color] ?? $colors['gray'];
    return "<span class='inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border {$c}'>{$puesto}</span>";
}

function badgeEstatus($estatus) {
    $map = [
        'aprobado'  => 'bg-green-500/15 text-green-400 border-green-500/30',
        'rechazado' => 'bg-red-500/15 text-red-400 border-red-500/30',
        'pendiente' => 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    ];
    $labels = [
        'aprobado'  => 'Aprobado',
        'rechazado' => 'Rechazado',
        'pendiente' => 'Pendiente'
    ];
    $c = $map[$estatus] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30';
    $l = $labels[$estatus] ?? 'Sin Estatus';
    return "<span class='inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border {$c}'>{$l}</span>";
}

function badgeEstadoEmpleado($estado) {
    $map = [
        'activo'     => 'bg-green-500/15 text-green-400 border-green-500/30',
        'baja'       => 'bg-red-500/15 text-red-400 border-red-500/30',
        'suspendido' => 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    ];
    $labels = [
        'activo'     => 'Activo',
        'baja'       => 'Baja',
        'suspendido' => 'Suspendido'
    ];
    $c = $map[$estado] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30';
    $l = $labels[$estado] ?? 'Activo';
    return "<span class='inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border {$c}'>{$l}</span>";
}

function badgeTipoPermiso($tipo) {
    $map = [
        'incapacidad' => 'bg-pink-500/15 text-pink-400 border-pink-500/30',
        'vacaciones'  => 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        'permiso'     => 'bg-orange-500/15 text-orange-400 border-orange-500/30'
    ];
    $labels = [
        'incapacidad' => 'Incapacidad',
        'vacaciones'  => 'Vacaciones',
        'permiso'     => 'Permiso'
    ];
    $c = $map[$tipo] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30';
    $l = $labels[$tipo] ?? $tipo;
    return "<span class='inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border {$c}'>{$l}</span>";
}

function badgeIncidencia($estatus) {
    $map = [
        'atiempo'        => 'bg-green-500/15 text-green-400 border-green-500/30',
        'retardo'        => 'bg-red-500/15 text-red-400 border-red-500/30',
        'falta'          => 'bg-red-500/15 text-red-400 border-red-500/30',
        'vacaciones'     => 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        'incapacidad'    => 'bg-pink-500/15 text-pink-400 border-pink-500/30',
        'reconocimiento' => 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        'sin_estatus'    => 'bg-gray-500/15 text-gray-400 border-gray-500/30'
    ];
    $labels = [
        'atiempo'        => 'A Tiempo',
        'retardo'        => 'Retardo',
        'falta'          => 'Falta',
        'vacaciones'     => 'Vacaciones',
        'incapacidad'    => 'Incapacidad',
        'reconocimiento' => 'Reconocimiento',
        'sin_estatus'    => 'Sin Estatus'
    ];
    $c = $map[$estatus] ?? $map['sin_estatus'];
    $l = $labels[$estatus] ?? 'Sin Estatus';
    return "<span class='inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border {$c}'>{$l}</span>";
}

function badgeEstatusNomina($estatus) {
    $map = [
        'abierta'   => 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        'calculada' => 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
        'aprobada'  => 'bg-green-500/15 text-green-400 border-green-500/30',
        'pagada'    => 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        'cancelada' => 'bg-red-500/15 text-red-400 border-red-500/30'
    ];
    $labels = [
        'abierta'   => 'Abierta',
        'calculada' => 'Calculada',
        'aprobada'  => 'Aprobada',
        'pagada'    => 'Pagada',
        'cancelada' => 'Cancelada'
    ];
    $c = $map[$estatus] ?? $map['abierta'];
    $l = $labels[$estatus] ?? 'Abierta';
    return "<span class='inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border {$c}'>{$l}</span>";
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
