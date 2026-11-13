<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';

/*  Pedidos › Dashboard (Etapa 5): un mes contra otro, como el de alpha.

    Reglas que no se ven en el codigo de un vistazo:
      - La seccion es pos-dashboard (Dueño y Supervisor). Produccion no entra.
      - Un pedido cuenta en el mes en que se capturo (created_at), como alpha.
      - Vendido = pendientes + pagados (la cotizacion y el cancelado no venden).
        Cobrado = pagos que entraron a la caja de la sucursal en el mes, de
        cualquier pedido. Por cobrar = saldo de HOY de los pendientes del mes.
      - Comparacion justa: si uno de los dos meses es el actual, los dos se
        cortan en el dia de hoy (del 1 al 13 contra del 1 al 13). */
class ctrl extends core {

    const DASHBOARD  = 'pos-dashboard';
    const MONTHS_MAX = 36;

    const MONTHS   = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    // -- Arranque --

    public function init() {
        $scope = $this->scope();

        return [
            'status'  => 200,
            'scope'   => ['company' => $scope['company'], 'branch' => $scope['branch']],
            'actions' => Permission::actions(self::DASHBOARD),
            'today'   => date('Y-m-d'),
            'months'  => $scope['branch_id'] > 0 ? $this->monthList() : []
        ];
    }

    // -- Dashboard --

    public function apiDashboard() {
        $fail = $this->needDashboard() ?: $this->needBranch();
        if ($fail) return $fail;

        $a = $this->postMonth('month_a', date('Y-m'));
        $b = $this->postMonth('month_b', date('Y-m', strtotime(date('Y-m-01') . ' -1 month')));

        return $this->attempt(function () use ($a, $b) {
            $cut = in_array(date('Y-m'), [$a, $b], true) ? (int) date('j') : 0;

            return [
                'status' => 200,
                'branch' => $this->scope()['branch'],
                'cut'    => $cut,
                'a'      => $this->period($a, $cut),
                'b'      => $this->period($b, $cut)
            ];
        }, 'No se pudo armar el dashboard. Intenta de nuevo.');
    }

    // -- Complements --

    private function needDashboard() {
        if (Permission::can(self::DASHBOARD, 'show')) return null;

        return ['status' => 403, 'message' => 'Tu rol no tiene permiso para ver el dashboard en esta sucursal.', 'row' => []];
    }

    // 'AAAA-MM' valido, desde 2000 y sin pasar del mes actual; si no, $default.
    private function postMonth($key, $default) {
        $value = $this->post($key);

        if (!preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $value, $m)) return $default;
        if ((int) $m[1] < 2000 || $value > date('Y-m')) return $default;

        return $value;
    }

    // Del mes actual hacia atras hasta el primer pedido (tope MONTHS_MAX). Sin pedidos: 12.
    private function monthList() {
        $first = $this->qDashFirstOrder($this->branchId());
        $stop  = $first ? substr((string) $first, 0, 7) : date('Y-m', strtotime(date('Y-m-01') . ' -11 months'));
        $month = date('Y-m');
        $list  = [];

        while (count($list) < self::MONTHS_MAX) {
            $list[] = ['id' => $month, 'valor' => $this->monthName($month)];

            if ($month <= $stop) break;

            $month = date('Y-m', strtotime($month . '-01 -1 month'));
        }

        return $list;
    }

    private function monthName($month) {
        return self::MONTHS[(int) substr($month, 5, 2) - 1] . ' ' . substr($month, 0, 4);
    }

    // Todo lo de un mes, ya cortado. Las listas por dia van del dia 1 al ultimo.
    private function period($month, $cut) {
        $from  = $month . '-01';
        $total = (int) date('t', strtotime($from));
        $days  = $cut > 0 ? min($cut, $total) : $total;
        $to    = date('Y-m-d', strtotime($from . " +{$days} days"));

        $branch = $this->branchId();
        $sales  = $this->groupBy($this->qDashSales($branch, $from, $to), 'day');
        $paid   = $this->groupBy($this->qDashPaid($branch, $from, $to), 'day');
        $due    = $this->qDashDue($branch, $from, $to) ?: ['orders' => 0, 'due' => 0];

        $kpi    = ['sold' => 0.0, 'paid' => 0.0, 'payments' => 0, 'orders' => 0, 'customers' => 0, 'quotes' => 0, 'quotes_total' => 0.0, 'cancelled' => 0];
        $status = ['quotes' => [0, 0.0], 'pending' => [0, 0.0], 'paid' => [0, 0.0], 'cancelled' => [0, 0.0]];
        $daily  = ['sold' => [], 'orders' => [], 'paid' => []];
        $week   = [];

        foreach (self::WEEKDAYS as $i => $name) $week[$i] = ['day' => $name, 'count' => 0, 'sold' => 0.0, 'orders' => 0, 'customers' => 0];

        for ($d = 1; $d <= $days; $d++) {
            $date = sprintf('%s-%02d', $month, $d);
            $row  = $sales[$date][0] ?? null;
            $cash = $paid[$date][0] ?? null;

            $sold   = $row ? (float) $row['pending_total'] + (float) $row['paid_total'] : 0.0;
            $orders = $row ? (int) $row['pending'] + (int) $row['paid'] : 0;
            $amount = $cash ? (float) $cash['amount'] : 0.0;

            $daily['sold'][]   = round($sold, 2);
            $daily['orders'][] = $orders;
            $daily['paid'][]   = round($amount, 2);

            $kpi['sold']     += $sold;
            $kpi['orders']   += $orders;
            $kpi['paid']     += $amount;
            $kpi['payments'] += $cash ? (int) $cash['payments'] : 0;

            // date('N'): 1 = lunes … 7 = domingo.
            $w = (int) date('N', strtotime($date)) - 1;

            $week[$w]['count']++;
            $week[$w]['sold']   += $sold;
            $week[$w]['orders'] += $orders;

            if (!$row) continue;

            $kpi['customers']    += (int) $row['customers'];
            $kpi['quotes']       += (int) $row['quotes'];
            $kpi['quotes_total'] += (float) $row['quotes_total'];
            $kpi['cancelled']    += (int) $row['cancelled'];

            $week[$w]['customers'] += (int) $row['customers'];

            foreach ($status as $key => $pair) {
                $status[$key] = [$pair[0] + (int) $row[$key], $pair[1] + (float) $row[$key . '_total']];
            }
        }

        $kpi['sold']         = round($kpi['sold'], 2);
        $kpi['paid']         = round($kpi['paid'], 2);
        $kpi['quotes_total'] = round($kpi['quotes_total'], 2);
        $kpi['ticket']       = $kpi['orders'] > 0 ? round($kpi['sold'] / $kpi['orders'], 2) : 0.0;
        $kpi['due']          = round((float) $due['due'], 2);
        $kpi['due_orders']   = (int) $due['orders'];

        foreach ($week as $i => $w) {
            $week[$i]['sold']          = round($w['sold'], 2);
            $week[$i]['avg_sold']      = $w['count'] ? round($w['sold'] / $w['count'], 2) : 0.0;
            $week[$i]['avg_orders']    = $w['count'] ? round($w['orders'] / $w['count'], 1) : 0.0;
            $week[$i]['avg_customers'] = $w['count'] ? round($w['customers'] / $w['count'], 1) : 0.0;
        }

        return [
            'month'  => $month,
            'label'  => $this->monthName($month),
            'from'   => $from,
            'to'     => date('Y-m-d', strtotime($to . ' -1 day')),
            'days'   => $days,
            'whole'  => $days === $total,
            'kpi'    => $kpi,
            'status' => array_map(function ($pair) {
                return ['orders' => $pair[0], 'total' => round($pair[1], 2)];
            }, $status),
            'daily'  => $daily,
            'week'   => array_values($week)
        ];
    }
}

Permission::dispatch(new ctrl(), ctrl::DASHBOARD);
