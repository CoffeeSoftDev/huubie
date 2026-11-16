<?php
require_once __DIR__ . '/../../../core/helpers/_WhatsApp.php';

/*  Avisos de WhatsApp: pedido nuevo, cierre de turno y cierre del dia.

    Va aparte de mdl-order.php, que no se toca. Lo usan con `use WhatsAppNotices;`
    ctrl-whatsapp (la pagina) y los tres ctrl que disparan un aviso:
      ctrl-cobro   payOrder   el primer cobro de una cotizacion = pedido nuevo.
      ctrl-turno   closeTurn  el corte Z.
      ctrl-cierre  closeDay   el cierre del dia.

    Reglas que no se ven en el codigo de un vistazo:
      - El envio es el de alpha (core/helpers/_WhatsApp.php); el proveedor y su
        token viven en el .env. Sin proveedor sale «simulado»: no va a la red.
      - Un aviso nunca tumba lo que lo disparo: notify* atrapa todo, y se llama
        DESPUES de la transaccion y de rememberToken.
      - Sin fila en wa_notice = la plantilla de fabrica (waDefaults) y encendido.
      - Destinatarios: los de la empresa con branch_id NULL (todas) o de la
        sucursal, activos y con el aviso marcado.
      - El aviso de un pedido sale una sola vez por referencia («Pedido P123»).
        Los cierres salen cada vez: un turno reabierto y vuelto a cerrar avisa
        otra vez con las cifras nuevas.
      - Todo es protected: Permission::dispatch ejecuta cualquier metodo publico
        del ctrl que llegue en `opc`, y los de un trait cuentan como suyos. */
trait WhatsAppNotices {

    // -- Tipos y plantillas --

    // Lo que la pagina pinta de cada aviso: nombre, cuando sale y sus variables.
    protected function waTypes() {
        return [
            'order' => [
                'name' => 'Pedido nuevo',
                'when' => 'Sale con el primer cobro de una cotización (el anticipo que la vuelve pedido). Una sola vez por pedido.',
                'vars' => [
                    'folio' => 'Folio (P123)', 'sucursal' => 'Sucursal', 'capturo' => 'Quién lo capturó',
                    'fecha_larga' => 'Día de entrega', 'hora' => 'Hora de entrega', 'entrega' => 'Recoge o a domicilio',
                    'cliente' => 'Cliente', 'telefono' => 'Teléfono', 'productos' => 'Productos', 'descripcion' => 'Nota del pedido',
                    'total' => 'Total', 'descuento' => 'Descuento', 'anticipo' => 'Pagado', 'forma_pago' => 'Forma de pago',
                    'restante' => 'Lo que resta', 'estatus' => 'Estado'
                ]
            ],
            'turn' => [
                'name' => 'Cierre de turno',
                'when' => 'Sale al cerrar un turno (corte Z).',
                'vars' => [
                    'folio' => 'Folio del turno', 'sucursal' => 'Sucursal', 'fecha' => 'Día', 'cajero' => 'Quién abrió',
                    'cerro' => 'Quién cerró', 'apertura' => 'Hora de apertura', 'cierre' => 'Hora de cierre',
                    'fondo_inicial' => 'Fondo inicial', 'vendido' => 'Vendido', 'cobrado' => 'Cobrado',
                    'esperado' => 'Esperado en caja', 'contado' => 'Contado', 'diferencia' => 'Cuadra, sobra o falta',
                    'metodos' => 'Métodos de pago', 'pedidos' => 'Pedidos', 'ventas' => 'Ventas de mostrador',
                    'pagados' => 'Pagados', 'pendientes' => 'Pendientes', 'cotizaciones' => 'Cotizaciones', 'cancelados' => 'Cancelados'
                ]
            ],
            'day' => [
                'name' => 'Cierre del día',
                'when' => 'Sale al cerrar el día de la sucursal.',
                'vars' => [
                    'sucursal' => 'Sucursal', 'fecha' => 'Día', 'cajero' => 'Quién cerró', 'vendido' => 'Vendido',
                    'descuento' => 'Descuentos', 'propina' => 'Propinas', 'abonos' => 'Abonos de otros días',
                    'cobrado' => 'Cobrado', 'efectivo' => 'Efectivo', 'metodos' => 'Métodos de pago',
                    'pedidos' => 'Pedidos', 'ventas' => 'Ventas de mostrador', 'pagadas' => 'Pagadas',
                    'pendientes' => 'Pendientes', 'cotizaciones' => 'Cotizaciones', 'canceladas' => 'Canceladas',
                    'ticket_promedio' => 'Ticket promedio', 'turnos' => 'Turnos', 'nota' => 'Nota del cierre'
                ]
            ]
        ];
    }

    /*  Las de alpha (wa_plantillas) con lo que pro sabe de mas: folio del turno,
        esperado contra contado, propinas y la nota del cierre. Un renglon con
        todas sus variables vacias no sale (WhatsApp::fill). */
    protected function waDefaults() {
        return [
            'order' => "🎂 *PEDIDO {folio}*\n📍 {sucursal}\n🖊️ Capturó: {capturo}\n\n📅 *{fecha_larga}*\n⏰ *{hora}*\n{entrega}\n👤 {cliente}\n📱 {telefono}\n\n{productos}\n\n📝 *Descripción:* {descripcion}\n\n💰 Total: {total}\n🏷️ Descuento: {descuento}\n💵 Anticipo: {anticipo} ({forma_pago})\n🧾 *Resta: {restante}*\n{estatus}",

            'turn' => "*CIERRE DE TURNO {folio}*\n📍 {sucursal} · 📅 {fecha}\n👤 {cajero} · 🕒 {apertura} – {cierre}\n💼 Inicio de caja: \${fondo_inicial}\n\n*TOTALES*\n💰 Vendido: \${vendido}\n🛍️ Cobrado: \${cobrado}\n✅ *Esperado en caja: \${esperado}*\n💵 Contado: \${contado}\n⚖️ {diferencia}\n\n*MÉTODOS DE PAGO*\n{metodos}\n\n*PEDIDOS DEL TURNO*\n🧾 Pedidos: {pedidos}\n🛒 Ventas: {ventas}\n✔️ Pagados: {pagados}\n🕒 Pendientes: {pendientes}\n📝 Cotizaciones: {cotizaciones}\n❌ Cancelados: {cancelados}",

            'day' => "*CIERRE DEL DÍA*\n📍 {sucursal}\n📅 {fecha}\n👤 Cerró: {cajero}\n\n*TOTALES*\n💰 Vendido: \${vendido}\n🏷️ Descuentos: \${descuento}\n🤝 Propinas: \${propina}\n↩️ Abonos de otros días: \${abonos}\n✅ *Cobrado: \${cobrado}*\n💵 Efectivo: \${efectivo}\n\n*MÉTODOS DE PAGO*\n{metodos}\n\n*CUENTAS*\n🧾 Pedidos: {pedidos}\n🛒 Ventas: {ventas}\n✔️ Pagadas: {pagadas}\n🕒 Pendientes: {pendientes}\n📝 Cotizaciones: {cotizaciones}\n❌ Canceladas: {canceladas}\n🎟️ Ticket promedio: \${ticket_promedio}\n\n🔄 *Turnos:* {turnos}\n🗒️ {nota}"
        ];
    }

    // Datos de ejemplo para la vista previa de la pagina.
    protected function waSample($type) {
        $branch = $this->scope()['branch'];
        $today  = date('Y-m-d');

        if ($type === 'order') {
            return [
                'folio' => 'P1024', 'sucursal' => $branch, 'capturo' => 'Ana López',
                'fecha_larga' => $this->waLongDate(date('Y-m-d', strtotime('+2 days'))), 'hora' => '4:00 PM',
                'entrega' => '🏠 Recoge en sucursal', 'cliente' => 'María Pérez', 'telefono' => '9621234567',
                'productos' => "🍰 *1 Pastel personalizado «Cumple Sofi»*\n- Porciones: 20\n- Pan: vainilla\n- Relleno: fresa\n> ✍️ *Feliz cumpleaños Sofi*\n\n🍰 *12 Cupcake de chocolate*",
                'descripcion' => 'Decoración en tonos rosa.', 'total' => '$1,350.00', 'descuento' => '',
                'anticipo' => '$500.00', 'forma_pago' => 'Efectivo', 'restante' => '$850.00', 'estatus' => '🟡 PENDIENTE'
            ];
        }

        if ($type === 'turn') {
            return [
                'folio' => '993', 'sucursal' => $branch, 'fecha' => dmy($today), 'cajero' => 'Ana López', 'cerro' => 'Ana López',
                'apertura' => '8:02 AM', 'cierre' => '4:15 PM', 'fondo_inicial' => '500.00', 'vendido' => '8,420.00',
                'cobrado' => '7,180.00', 'esperado' => '4,750.00', 'contado' => '4,750.00', 'diferencia' => 'La caja cuadra.',
                'metodos' => "💵 Efectivo (12): $4,250.00\n💳 Tarjeta (5): $2,130.00\n🏦 Transferencia (2): $800.00",
                'pedidos' => '9', 'ventas' => '14', 'pagados' => '18', 'pendientes' => '5', 'cotizaciones' => '2', 'cancelados' => '0'
            ];
        }

        return [
            'sucursal' => $branch, 'fecha' => dmy($today), 'cajero' => 'Ana López', 'vendido' => '15,980.00',
            'descuento' => '320.00', 'propina' => '', 'abonos' => '1,200.00', 'cobrado' => '14,560.00', 'efectivo' => '8,110.00',
            'metodos' => "💵 Efectivo (21): $8,110.00\n💳 Tarjeta (9): $4,650.00\n🏦 Transferencia (4): $1,800.00",
            'pedidos' => '16', 'ventas' => '27', 'pagadas' => '35', 'pendientes' => '8', 'cotizaciones' => '3', 'canceladas' => '1',
            'ticket_promedio' => '371.63', 'turnos' => '2 (993, 994)', 'nota' => ''
        ];
    }

    // La plantilla vigente: la guardada o la de fabrica. active 0 = pausado.
    protected function waNotice($companyId, $type) {
        $row      = $this->qWaNotice($companyId, $type);
        $defaults = $this->waDefaults();

        return [
            'type'       => $type,
            'body'       => $row ? (string) $row['body'] : $defaults[$type],
            'active'     => $row ? (int) $row['active'] : 1,
            'custom'     => $row ? (string) $row['body'] !== $defaults[$type] : false,
            'updated_at' => $row ? $row['updated_at'] : null
        ];
    }

    // -- Envio --

    /*  Llena la plantilla y la manda a cada destinatario; cada intento queda en
        wa_log. Nunca lanza: devuelve cuantos salieron y, si no salio nada, por que
        (skipped: repeated | paused | nobody | error). */
    protected function waSend($type, array $vars, $reference, $once = false) {
        $result = ['sent' => 0, 'failed' => 0, 'simulated' => 0, 'skipped' => ''];

        try {
            $companyId = $this->companyId();
            $branchId  = $this->branchId();

            if ($companyId === 0) return array_merge($result, ['skipped' => 'nobody']);

            if ($once && $this->qWaSentRef($companyId, $type, $reference) > 0) return array_merge($result, ['skipped' => 'repeated']);

            $notice = $this->waNotice($companyId, $type);
            if ($notice['active'] !== 1) return array_merge($result, ['skipped' => 'paused']);

            $recipients = $this->qWaRecipients($companyId, $branchId, $type);
            if (!$recipients) return array_merge($result, ['skipped' => 'nobody']);

            $text = WhatsApp::fill($notice['body'], $vars);
            $wa   = new WhatsApp();

            foreach ($recipients as $recipient) {
                $sent = $wa->send($recipient['phone'], $text);

                $result[$sent['status']] = ($result[$sent['status']] ?? 0) + 1;

                $this->waLog([
                    'branch_id'    => $branchId ?: null,
                    'type'         => $type,
                    'reference'    => $reference,
                    'recipient_id' => (int) $recipient['id'],
                    'phone'        => (string) $recipient['phone'],
                    'provider'     => $sent['provider'],
                    'status'       => $sent['status'],
                    'error'        => $sent['detail'] !== '' ? $sent['detail'] : null,
                    'body'         => $text
                ]);
            }
        } catch (Throwable $e) {
            $this->writeToLog('[ WHATSAPP ] :: ' . $type . ' ' . $reference . ' :: ' . $e->getMessage());

            return array_merge($result, ['skipped' => 'error']);
        }

        return $result;
    }

    // Un renglon del historial. Si la base falla, el envio ya salio: solo se anota.
    protected function waLog(array $row) {
        $saved = $this->qInsertInto('wa_log', [
            'values' => ['company_id', 'branch_id', 'type', 'reference', 'recipient_id', 'phone', 'provider', 'status', 'error', 'body', 'user_id', 'created_at'],
            'data'   => [
                $this->companyId(), $row['branch_id'], $row['type'], mb_substr($row['reference'], 0, 80, 'UTF-8'),
                $row['recipient_id'], mb_substr($row['phone'], 0, 60, 'UTF-8'), $row['provider'], $row['status'],
                $row['error'] !== null ? mb_substr($row['error'], 0, 255, 'UTF-8') : null, $row['body'],
                $this->userId() ?: null, date('Y-m-d H:i:s')
            ]
        ]);

        if ($saved !== true) $this->writeToLog('[ WHATSAPP wa_log ] :: ' . (is_string($saved) ? $saved : 'sin respuesta de la base'));
    }

    // -- Disparadores --

    // Pedido nuevo: el primer cobro de una cotizacion. Sale una vez por pedido.
    protected function notifyOrder($saleId) {
        try {
            $order = $this->qGetOrder($saleId, $this->branchId());
            if (!$order) return null;

            $lines  = $this->qOrderLines($saleId);
            $custom = [];

            foreach ($lines as $line) {
                if ((int) $line['is_custom'] === 1 && (int) $line['product_id'] > 0) $custom[] = (int) $line['product_id'];
            }

            $modifiers = $this->groupBy($this->qProductModifiers(array_values(array_unique($custom))), 'product_id');
            $payments  = $this->qPayments($saleId);

            $total    = round((float) $order['total'], 2);
            $paid     = round((float) $order['paid'], 2);
            $discount = round((float) $order['discount_amount'], 2);
            $place    = $this->waOneLine($order['location']);
            $delivery = (int) $order['delivery_method'] === 1
                ? '🛵 A domicilio' . ($place !== '' ? ': ' . $place : '')
                : '🏠 Recoge en sucursal';

            $vars = [
                'folio'       => 'P' . (int) $order['id'],
                'sucursal'    => $this->scope()['branch'],
                'capturo'     => $this->waOneLine($order['created_by']),
                'fecha_larga' => $this->waLongDate($order['delivery_date']),
                'hora'        => $order['delivery_time'] ? hour12($order['delivery_time']) : '',
                'entrega'     => $delivery,
                'cliente'     => $this->waOneLine($order['customer']),
                'telefono'    => $this->waOneLine($order['phone']),
                'productos'   => $this->waProducts($lines, $modifiers),
                'descripcion' => $this->waOneLine($order['note']),
                'total'       => money($total),
                'descuento'   => $discount > 0 ? money($discount) : '',
                'anticipo'    => $paid > 0 ? money($paid) : '',
                'forma_pago'  => $this->waPaidWith($payments),
                'restante'    => money(max(0, $total - $paid)),
                'estatus'     => $this->waStatusText((int) $order['sale_status_id'])
            ];

            return $this->waSend('order', $vars, 'Pedido P' . (int) $order['id'], true);
        } catch (Throwable $e) {
            $this->writeToLog('[ WHATSAPP notifyOrder ] :: ' . $e->getMessage());
            return null;
        }
    }

    // Corte Z. Se lee el turno ya cerrado: cifras congeladas y quien cerro.
    protected function notifyTurn($turnId) {
        try {
            $turn = $this->qGetTurn($turnId, $this->branchId());
            if (!$turn) return null;

            $methods   = $this->qTurnMethods($turnId);
            $counts    = $this->waStatusCounts($this->qTurnStatuses($turnId));
            $collected = 0;

            foreach ($methods as $method) $collected += (float) $method['amount'];

            $difference = round((float) $turn['counted_cash'] - (float) $turn['expected_cash'], 2);
            $folio      = (string) $turn['folio'] !== '' ? (string) $turn['folio'] : (string) $turnId;

            $vars = [
                'folio'         => $folio,
                'sucursal'      => $this->scope()['branch'],
                'fecha'         => dmy($turn['opened_at']),
                'cajero'        => $this->waOneLine($turn['opened_by']),
                'cerro'         => $this->waOneLine($turn['closed_by']),
                'apertura'      => $this->waClock($turn['opened_at']),
                'cierre'        => $this->waClock($turn['closed_at']),
                'fondo_inicial' => $this->waAmount($turn['opening_cash']),
                'vendido'       => $this->waAmount($turn['total_sales']),
                'cobrado'       => $this->waAmount($collected),
                'esperado'      => $this->waAmount($turn['expected_cash']),
                'contado'       => $this->waAmount($turn['counted_cash']),
                'diferencia'    => $this->waDifference($difference),
                'metodos'       => $this->waMethodLines($methods),
                'pedidos'       => (string) (int) $turn['orders_count'],
                'ventas'        => (int) $turn['sales_count'] > 0 ? (string) (int) $turn['sales_count'] : '',
                'pagados'       => (string) $counts[3],
                'pendientes'    => (string) $counts[2],
                'cotizaciones'  => (string) $counts[1],
                'cancelados'    => (string) $counts[4]
            ];

            return $this->waSend('turn', $vars, 'Turno ' . $folio);
        } catch (Throwable $e) {
            $this->writeToLog('[ WHATSAPP notifyTurn ] :: ' . $e->getMessage());
            return null;
        }
    }

    // Cierre del dia $day ('AAAA-MM-DD'), en vivo: el cierre se acaba de guardar con estas mismas cifras.
    protected function notifyDay($day, $note = null) {
        try {
            $branchId    = $this->branchId();
            [$from, $to] = $this->dayRange($day);

            $totals = $this->qDayTotals($branchId, $from, $to) ?: [];
            $turns  = $this->qDayTurns($branchId, $from, $to);
            $counts = $this->waStatusCounts($this->qDayStatuses($branchId, $from, $to));

            // qDayMethods trae un renglon por metodo y origen: aqui van juntos.
            $methods = [];
            $abonos  = 0;
            $cash    = 0;
            $collect = 0;

            foreach ($this->qDayMethods($branchId, $from, $to) as $row) {
                $key    = (string) $row['id'];
                $amount = (float) $row['amount'];

                if (!isset($methods[$key])) $methods[$key] = ['name' => $row['name'], 'is_cash' => $row['is_cash'], 'payments' => 0, 'amount' => 0];

                $methods[$key]['payments'] += (int) $row['payments'];
                $methods[$key]['amount']   += $amount;
                $collect += $amount;

                if ($row['source'] === 'abono')     $abonos += $amount;
                if ((int) $row['is_cash'] === 1)    $cash   += $amount;
            }

            $total    = (float) ($totals['total'] ?? 0);
            $tickets  = (int) ($totals['orders_count'] ?? 0) + (int) ($totals['sales_count'] ?? 0);
            $discount = (float) ($totals['discount'] ?? 0);
            $tip      = (float) ($totals['tip'] ?? 0);
            $folios   = array_map(function ($turn) { return (string) $turn['folio'] !== '' ? (string) $turn['folio'] : (string) $turn['id']; }, $turns);

            $vars = [
                'sucursal'        => $this->scope()['branch'],
                'fecha'           => dmy($day),
                'cajero'          => $this->waOneLine($this->qWaUserName($this->userId())),
                'vendido'         => $this->waAmount($total),
                'descuento'       => $discount >= 0.005 ? number_format($discount, 2) : '',
                'propina'         => $tip >= 0.005 ? number_format($tip, 2) : '',
                'abonos'          => $abonos >= 0.005 ? number_format($abonos, 2) : '',
                'cobrado'         => $this->waAmount($collect),
                'efectivo'        => $this->waAmount($cash),
                'metodos'         => $this->waMethodLines(array_values($methods)),
                'pedidos'         => (string) (int) ($totals['orders_count'] ?? 0),
                'ventas'          => (int) ($totals['sales_count'] ?? 0) > 0 ? (string) (int) $totals['sales_count'] : '',
                'pagadas'         => (string) $counts[3],
                'pendientes'      => (string) $counts[2],
                'cotizaciones'    => (string) $counts[1],
                'canceladas'      => (string) $counts[4],
                'ticket_promedio' => $tickets > 0 ? number_format($total / $tickets, 2) : '',
                'turnos'          => $folios ? count($folios) . ' (' . implode(', ', $folios) . ')' : '',
                'nota'            => $this->waOneLine($note)
            ];

            return $this->waSend('day', $vars, 'Día ' . dmy($day));
        } catch (Throwable $e) {
            $this->writeToLog('[ WHATSAPP notifyDay ] :: ' . $e->getMessage());
            return null;
        }
    }

    // -- Formato --

    private function waOneLine($value) {
        return trim((string) preg_replace('/\s*(?:\r\n|\r|\n)\s*/', ' ', (string) $value));
    }

    // Para ${variable}: la plantilla pone el "$". Cero = "-", como alpha.
    private function waAmount($value) {
        $value = round((float) $value, 2);

        return abs($value) < 0.005 ? '-' : number_format($value, 2);
    }

    private function waClock($datetime) {
        $time = $datetime ? strtotime((string) $datetime) : false;

        return $time ? date('g:i A', $time) : '';
    }

    private function waDifference($difference) {
        if (abs($difference) < 0.005) return 'La caja cuadra.';

        return ($difference > 0 ? 'Sobran ' : 'Faltan ') . money(abs($difference)) . '.';
    }

    // 'AAAA-MM-DD' -> «Domingo 15 de noviembre» (con el año si no es el actual).
    private function waLongDate($date) {
        $day = $date ? DateTime::createFromFormat('!Y-m-d', substr((string) $date, 0, 10)) : false;
        if (!$day) return '';

        $days   = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        $months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        $text   = $days[(int) $day->format('w')] . ' ' . $day->format('j') . ' de ' . $months[(int) $day->format('n') - 1];

        return $day->format('Y') === date('Y') ? $text : $text . ' de ' . $day->format('Y');
    }

    private function waStatusText($status) {
        $names = [1 => '📝 COTIZACIÓN', 2 => '🟡 PENDIENTE', 3 => '🟢 PAGADO', 4 => '🔴 CANCELADO'];

        return $names[$status] ?? '';
    }

    // Conteo por estado: [1 cotizacion, 2 pendiente, 3 pagado, 4 cancelado].
    private function waStatusCounts(array $rows) {
        $counts = [1 => 0, 2 => 0, 3 => 0, 4 => 0];

        foreach ($rows as $row) {
            $id = (int) $row['id'];
            if (isset($counts[$id])) $counts[$id] += (int) $row['orders'];
        }

        return $counts;
    }

    // «💵 Efectivo (3): $1,250.00», un renglon por metodo con dinero.
    private function waMethodLines(array $methods) {
        $lines = [];

        foreach ($methods as $method) {
            $amount = round((float) $method['amount'], 2);
            if (abs($amount) < 0.005) continue;

            $name = $this->waOneLine($method['name']);
            $low  = mb_strtolower($name, 'UTF-8');
            $icon = (int) $method['is_cash'] === 1 ? '💵' : (strpos($low, 'tarjeta') !== false ? '💳' : (strpos($low, 'transfer') !== false ? '🏦' : '🔹'));

            $lines[] = $icon . ' ' . $name . ' (' . (int) $method['payments'] . '): ' . money($amount);
        }

        return implode("\n", $lines);
    }

    // Un metodo = su nombre. Varios = «Efectivo $500.00 · Tarjeta $300.00».
    private function waPaidWith(array $payments) {
        $byMethod = [];

        foreach ($payments as $payment) {
            $name = $this->waOneLine($payment['method']) ?: 'Sin método';
            $byMethod[$name] = ($byMethod[$name] ?? 0) + (float) $payment['amount'];
        }

        if (count($byMethod) <= 1) return (string) key($byMethod);

        $parts = [];
        foreach ($byMethod as $name => $amount) $parts[] = $name . ' ' . money($amount);

        return implode(' · ', $parts);
    }

    /*  {productos}: un bloque por linea, como alpha. Los detalles van como lista
        de WhatsApp ("- ") y la dedicatoria en una cita. */
    private function waProducts(array $lines, array $modifiers) {
        $blocks = [];

        foreach ($lines as $line) {
            $qty  = rtrim(rtrim(number_format((float) $line['quantity'], 2, '.', ''), '0'), '.');
            $name = $this->waOneLine($line['name'] !== '' ? $line['name'] : $line['product_name']);
            $rows = [];

            if ((int) $line['is_custom'] === 1) {
                $title = "🍰 *{$qty} Pastel personalizado" . ($name !== '' ? " «{$name}»" : '') . '*';
                $rows  = $this->waCustomRows($line, $modifiers[$line['product_id']] ?? []);
            } else {
                $title = "🍰 *{$qty} {$name}*";
            }

            $notes = $this->waOneLine($line['details']);
            if ($notes !== '') $rows[] = 'Notas: ' . $notes;

            $block = $title . ($rows ? "\n- " . implode("\n- ", $rows) : '');

            $dedication = $this->waOneLine($line['dedication']);
            if ($dedication !== '') $block .= "\n> ✍️ *" . $dedication . '*';

            $blocks[] = $block;
        }

        return implode("\n\n", $blocks);
    }

    // Porciones y modificadores agrupados («Relleno: fresa, nuez x2»), en minusculas parejas.
    private function waCustomRows(array $line, array $modifiers) {
        $rows     = [];
        $portions = (int) $line['portion_qty'];

        if ($portions > 0) $rows[] = 'Porciones: ' . $portions;

        $groups = [];

        foreach ($modifiers as $item) {
            $group = mb_strtolower(trim((string) $item['group_name']), 'UTF-8');
            $label = mb_strtoupper(mb_substr($group, 0, 1, 'UTF-8'), 'UTF-8') . mb_substr($group, 1, null, 'UTF-8');
            $count = (int) $item['quantity'];

            $groups[$label][] = mb_strtolower(trim((string) $item['name']), 'UTF-8') . ($count > 1 ? " x{$count}" : '');
        }

        foreach ($groups as $label => $names) $rows[] = $label . ': ' . implode(', ', $names);

        return $rows;
    }

    // -- Consultas (fayxzvov_pos) --

    protected function qWaNotice($companyId, $type) {
        return $this->qRow("
            SELECT id, type, body, active, updated_at
            FROM {$this->pos}wa_notice
            WHERE company_id = ? AND type = ?
            LIMIT 1
        ", [$companyId, $type]);
    }

    protected function qWaRecipients($companyId, $branchId, $type) {
        $column = ['order' => 'notify_order', 'turn' => 'notify_turn', 'day' => 'notify_day'][$type] ?? '';
        if ($column === '') return [];

        return $this->qRows("
            SELECT id, name, phone
            FROM {$this->pos}wa_recipient
            WHERE company_id = ?
                AND (branch_id IS NULL OR branch_id = ?)
                AND active = 1
                AND {$column} = 1
            ORDER BY id
        ", [$companyId, $branchId]);
    }

    protected function qWaRecipientList($companyId) {
        return $this->qRows("
            SELECT r.id, r.name, r.phone, r.branch_id, IFNULL(b.name, '') AS branch,
                   r.notify_order, r.notify_turn, r.notify_day, r.active, r.updated_at
            FROM {$this->pos}wa_recipient r
            LEFT JOIN {$this->bd}branches b ON b.id = r.branch_id
            WHERE r.company_id = ?
            ORDER BY r.active DESC, r.name, r.id
        ", [$companyId]);
    }

    protected function qWaRecipient($id, $companyId) {
        return $this->qRow("
            SELECT id, name, phone, branch_id, notify_order, notify_turn, notify_day, active
            FROM {$this->pos}wa_recipient
            WHERE id = ? AND company_id = ?
            LIMIT 1
        ", [$id, $companyId]);
    }

    // Envios que si salieron (o se simularon) con esa referencia.
    protected function qWaSentRef($companyId, $type, $reference) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}wa_log
            WHERE company_id = ? AND type = ? AND reference = ?
                AND status IN ('sent', 'simulated')
        ", [$companyId, $type, $reference]);
    }

    // El historial en [$from, $to). $type '' = todos.
    protected function qWaLog($companyId, $from, $to, $type = '') {
        $where = $type !== '' ? ' AND l.type = ?' : '';
        $data  = $type !== '' ? [$companyId, $from, $to, $type] : [$companyId, $from, $to];

        return $this->qRows("
            SELECT l.id, l.type, l.reference, l.phone, l.provider, l.status, IFNULL(l.error, '') AS error, l.created_at,
                   IFNULL(r.name, '') AS recipient, IFNULL(b.name, '') AS branch,
                   CONCAT_WS(' ', u.name, u.last_name) AS user
            FROM {$this->pos}wa_log l
            LEFT JOIN {$this->pos}wa_recipient r ON r.id = l.recipient_id
            LEFT JOIN {$this->bd}branches b      ON b.id = l.branch_id
            LEFT JOIN {$this->bd}users u         ON u.id = l.user_id
            WHERE l.company_id = ?
                AND l.created_at >= ? AND l.created_at < ?{$where}
            ORDER BY l.id DESC
            LIMIT 500
        ", $data);
    }

    protected function qWaLogRow($id, $companyId) {
        return $this->qRow("
            SELECT l.id, l.type, l.reference, l.phone, l.provider, l.status, IFNULL(l.error, '') AS error,
                   IFNULL(l.body, '') AS body, l.created_at, IFNULL(r.name, '') AS recipient
            FROM {$this->pos}wa_log l
            LEFT JOIN {$this->pos}wa_recipient r ON r.id = l.recipient_id
            WHERE l.id = ? AND l.company_id = ?
            LIMIT 1
        ", [$id, $companyId]);
    }

    protected function qWaUserName($userId) {
        if ((int) $userId <= 0) return '';

        $row = $this->qRow("SELECT CONCAT_WS(' ', name, last_name) AS name FROM {$this->bd}users WHERE id = ? LIMIT 1", [$userId]);

        return $row ? (string) $row['name'] : '';
    }
}
