<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-wa-config.php';

class WaConfig extends MWaConfig {

    // Las llaves del proveedor viajan a esta pantalla: igual que Permisos, solo el
    // administrador la abre.
    const ROL_ADMIN = 1;

    // Tope diario de mensajes del proveedor y porcentaje del tope en que el aviso pasa a ámbar.
    const DAILY_LIMIT  = 150;
    const WARN_PERCENT = 80;

    const PROVIDERS = ['ultramsg', 'greenapi'];
    const TYPES     = ['cierre', 'turno', 'personalizado', 'edicion'];

    private function accessDenial(){
        if (empty($_SESSION['USR']) || empty($_SESSION['COMPANY_ID'])) {
            return [
                'status'  => 401,
                'message' => 'Tu sesion no es de este modulo. Vuelve a iniciar sesion.'
            ];
        }

        if (($_SESSION['ROLID'] ?? 0) != self::ROL_ADMIN) {
            return [
                'status'  => 403,
                'message' => 'Solo un administrador puede configurar los avisos de WhatsApp.'
            ];
        }

        return null;
    }

    private function companyId(){
        return intval($_SESSION['COMPANY_ID']);
    }

    function lsWaConfig(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        $company   = $this->companyId();
        $providers = [];
        $active    = null;

        foreach (self::PROVIDERS as $provider) {
            $providers[$provider] = [
                'instancia'   => '',
                'token'       => '',
                'api_url'     => '',
                'estado'      => '',
                'verificado'  => '',
                'configurado' => false
            ];
        }

        foreach ($this->listConfig([$company]) ?: [] as $row) {
            if (!isset($providers[$row['provider']])) continue;

            $providers[$row['provider']] = [
                'instancia'   => $row['instance'] ?: '',
                'token'       => $row['token'] ?: '',
                'api_url'     => $row['api_url'] ?: '',
                'estado'      => $row['state'] ?: '',
                'verificado'  => $row['checked_at'] ? date('d/m/Y h:i A', strtotime($row['checked_at'])) : '',
                'configurado' => credentialError($row['provider'], $row['instance'], $row['token'], $row['api_url']) === ''
            ];

            if (intval($row['active']) === 1) $active = $row['provider'];
        }

        $defaults  = defaultTemplates();
        $templates = [];

        // Sin fila el aviso cuenta como encendido y con el texto de siempre.
        foreach (self::TYPES as $type) {
            $templates[$type] = [
                'cuerpo' => $defaults[$type],
                'activo' => 1
            ];
        }

        foreach ($this->listPlantillas([$company]) ?: [] as $row) {
            if (!isset($templates[$row['type']])) continue;

            $templates[$row['type']] = [
                'cuerpo' => $row['body'],
                'activo' => intval($row['active'])
            ];
        }

        return [
            'status'        => 200,
            'proveedor'     => $active,
            'proveedores'   => $providers,
            'destinatarios' => $this->recipientRows(''),
            'plantillas'    => $templates,
            'defaults'      => $defaults,
            'enviadosHoy'   => $this->getHistorialTodayCounts([$company])
        ];
    }

    function saveWaProvider(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        $company  = $this->companyId();
        $provider = $_POST['proveedor'];
        $instance = trim($_POST['instancia']);
        $token    = trim($_POST['token']);
        $apiUrl   = rtrim(trim($_POST['api_url']), '/');

        if (!in_array($provider, self::PROVIDERS, true)) {
            return ['status' => 400, 'message' => 'Proveedor no reconocido.'];
        }

        $error = credentialError($provider, $instance, $token, $apiUrl);
        if ($error !== '') {
            return ['status' => 400, 'message' => $error];
        }

        if ($provider === 'ultramsg') $apiUrl = null;

        $saved = $this->getConfigByProvider([$company, $provider]);

        if ($saved) {
            $ok = $this->updateConfig([$instance, $token, $apiUrl, 1, $saved['id'], $company]);

            // La ultima prueba ya no habla de estas llaves.
            $changed = $saved['instance'] !== $instance || $saved['token'] !== $token || ($saved['api_url'] ?: null) !== $apiUrl;
            if ($ok && $changed) $this->updateConfigState([null, null, $saved['id']]);
        } else {
            $ok = $this->createConfig([$provider, $instance, $token, $apiUrl, $company, 1]);
        }

        if (!$ok) {
            return ['status' => 500, 'message' => 'No se pudo guardar el proveedor.'];
        }

        $this->updateConfigActive([0, $company, $provider]);

        return [
            'status'    => 200,
            'message'   => 'Proveedor guardado: ' . providerName($provider),
            'proveedor' => $provider
        ];
    }

    // Prueba las llaves que estan en pantalla, guardadas o no. El resultado solo se
    // anota en la base cuando coinciden con las guardadas.
    function testWaConnection(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        $company  = $this->companyId();
        $provider = $_POST['proveedor'];
        $instance = trim($_POST['instancia']);
        $token    = trim($_POST['token']);
        $apiUrl   = rtrim(trim($_POST['api_url']), '/');

        if (!in_array($provider, self::PROVIDERS, true)) {
            return ['status' => 400, 'message' => 'Proveedor no reconocido.'];
        }

        $error = credentialError($provider, $instance, $token, $apiUrl);
        if ($error !== '') {
            return ['status' => 400, 'message' => $error];
        }

        $result = $provider === 'greenapi'
            ? $this->greenApiState($apiUrl, $instance, $token)
            : $this->ultraMsgState($instance, $token);

        $now   = date('Y-m-d H:i:s');
        $saved = $this->getConfigByProvider([$company, $provider]);

        if ($saved && $saved['instance'] === $instance && $saved['token'] === $token
            && ($provider === 'ultramsg' || $saved['api_url'] === $apiUrl)) {
            $this->updateConfigState([$result['estado'], $now, $saved['id']]);
        }

        return [
            'status'     => 200,
            'proveedor'  => $provider,
            'ok'         => $result['ok'],
            'estado'     => $result['estado'],
            'detalle'    => $result['detalle'],
            'verificado' => date('d/m/Y h:i A', strtotime($now))
        ];
    }

    function lsWaDestinatarios(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        return [
            'status' => 200,
            'row'    => $this->recipientRows($_POST['tipo'])
        ];
    }

    function addWaDestinatario(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        $company = $this->companyId();
        $name    = trim($_POST['nombre']);
        $phone   = normalizePhone($_POST['telefono']);
        $types   = expandTypes($_POST['tipo']);
        $active  = intval($_POST['activo']) === 1 ? 1 : 0;

        $error = recipientError($name, $phone, $types);
        if ($error !== '') {
            return ['status' => 400, 'message' => $error];
        }

        $ids     = [];
        $already = [];

        foreach ($types as $type) {
            if ($this->existsDestinatarioByPhone([$company, $type, $phone])) {
                $already[] = noticeName($type);
                continue;
            }

            $id = $this->createDestinatario([$name, $phone, $type, $company, $active]);
            if ($id) $ids[] = $id;
        }

        if (empty($ids)) {
            return !empty($already)
                ? ['status' => 409, 'message' => 'Ese número ya recibe el aviso de ' . implode(' y ', $already) . '.']
                : ['status' => 500, 'message' => 'No se pudo agregar el destinatario.'];
        }

        $message = count($ids) === 1
            ? 'Destinatario agregado'
            : 'Destinatario agregado a ' . count($ids) . ' avisos';

        if (!empty($already)) $message .= ' (ya recibía ' . implode(' y ', $already) . ')';

        return [
            'status'  => 200,
            'message' => $message,
            'id'      => $ids[0],
            'ids'     => $ids
        ];
    }

    // El registro conserva su aviso si sigue en la seleccion; los avisos extra que
    // traiga la opcion elegida (todos, cierres) se dan de alta aparte.
    function editWaDestinatario(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        $company = $this->companyId();
        $id      = intval($_POST['id']);
        $name    = trim($_POST['nombre']);
        $phone   = normalizePhone($_POST['telefono']);
        $types   = expandTypes($_POST['tipo']);
        $active  = intval($_POST['activo']) === 1 ? 1 : 0;

        $current = $this->getDestinatarioById([$id, $company]);
        if (!$current) {
            return ['status' => 404, 'message' => 'El destinatario ya no existe.'];
        }

        $error = recipientError($name, $phone, $types);
        if ($error !== '') {
            return ['status' => 400, 'message' => $error];
        }

        $mainType  = in_array($current['type'], $types, true) ? $current['type'] : $types[0];
        $duplicate = $this->existsDestinatarioByPhone([$company, $mainType, $phone]);

        if ($duplicate && $duplicate !== $id) {
            return ['status' => 409, 'message' => 'Ese número ya recibe el aviso de ' . noticeName($mainType) . '.'];
        }

        $ok = $this->updateDestinatario([$name, $phone, $mainType, $active, $id, $company]);
        if (!$ok) {
            return ['status' => 500, 'message' => 'No se pudo actualizar el destinatario.'];
        }

        foreach ($types as $type) {
            if ($type === $mainType) continue;
            if ($this->existsDestinatarioByPhone([$company, $type, $phone])) continue;

            $this->createDestinatario([$name, $phone, $type, $company, $active]);
        }

        return [
            'status'  => 200,
            'message' => 'Destinatario actualizado'
        ];
    }

    // Interruptor de la fila: pausa o reactiva un número en ese aviso sin abrir el formulario.
    function statusWaDestinatario(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        $company = $this->companyId();
        $id      = intval($_POST['id']);
        $active  = intval($_POST['activo']) === 1 ? 1 : 0;

        $current = $this->getDestinatarioById([$id, $company]);
        if (!$current) {
            return ['status' => 404, 'message' => 'El destinatario ya no existe.'];
        }

        $ok = $this->updateDestinatarioActive([$active, $id, $company]);
        if (!$ok) {
            return ['status' => 500, 'message' => 'No se pudo cambiar el destinatario.'];
        }

        return [
            'status'  => 200,
            'message' => $current['name'] . ($active ? ' vuelve a recibir' : ' deja de recibir') . ' el aviso de ' . noticeName($current['type']),
            'activo'  => $active
        ];
    }

    function delWaDestinatario(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        $company = $this->companyId();
        $id      = intval($_POST['id']);

        if (!$this->getDestinatarioById([$id, $company])) {
            return ['status' => 404, 'message' => 'El destinatario ya no existe.'];
        }

        $ok = $this->deleteDestinatarioById([$id, $company]);

        return $ok
            ? ['status' => 200, 'message' => 'Destinatario eliminado']
            : ['status' => 500, 'message' => 'No se pudo eliminar el destinatario.'];
    }

    function saveWaPlantilla(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        $company = $this->companyId();
        $type    = $_POST['tipo'];
        $body    = trim($_POST['cuerpo']);
        $active  = intval($_POST['activo']) === 1 ? 1 : 0;

        if (!in_array($type, self::TYPES, true)) {
            return ['status' => 400, 'message' => 'Aviso no reconocido.'];
        }

        if ($body === '') {
            return ['status' => 400, 'message' => 'La plantilla no puede quedar vacía.'];
        }

        $saved = $this->getPlantillaByType([$company, $type]);
        $ok    = $saved
            ? $this->updatePlantilla([$body, $active, $saved['id']])
            : $this->createPlantilla([$type, $body, $company, $active]);

        return $ok
            ? ['status' => 200, 'message' => 'Plantilla de ' . noticeName($type) . ' guardada']
            : ['status' => 500, 'message' => 'No se pudo guardar la plantilla.'];
    }

    function lsWaHistorial(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        $company = $this->companyId();
        $type    = in_array($_POST['tipo'], self::TYPES, true) ? $_POST['tipo'] : '';
        $start   = $_POST['fi'];
        $end     = $_POST['ff'];

        if (!validDate($start) || !validDate($end) || $start > $end) {
            return [
                'status'  => 400,
                'message' => 'El periodo de consulta no es válido.'
            ];
        }

        $params = [$company, $type, $type, $start, $end];
        $counts = $this->getHistorialCounts($params);
        $rows   = [];
        $logs   = [];

        foreach ($this->listHistorial($params) ?: [] as $item) {
            $date = date('d/m/Y h:i A', strtotime($item['sent_at']));

            $rows[] = [
                'id'            => $item['id'],
                'fecha'         => $date,
                'aviso'         => ['html' => renderNotice($item['type']), 'class' => 'text-center px-[10px] py-[5px]'],
                'sucursal'      => ['html' => renderOrigin($item['sucursal'], $item['reference']), 'class' => 'px-[10px] py-[5px]'],
                'destinatarios' => ['html' => $item['recipients'], 'class' => 'px-[10px] py-[5px] whitespace-normal break-words max-w-[260px]'],
                'proveedor'     => ['html' => renderProvider($item['provider']), 'class' => 'text-center px-[10px] py-[5px]'],
                'estado'        => ['html' => renderSendStatus($item['status'], $item['error']), 'class' => 'text-center px-[10px] py-[5px]']
            ];

            $logs[] = [
                'fecha'         => $date,
                'aviso'         => noticeName($item['type']),
                'sucursal'      => $item['sucursal'] ?: '',
                'referencia'    => $item['reference'] ?: '',
                'destinatarios' => $item['recipients'],
                'proveedor'     => providerName($item['provider']),
                'estado'        => $item['status'],
                'error'         => $item['error'] ?: ''
            ];
        }

        $total    = intval($counts['total']);
        $exitosos = intval($counts['exitosos']);

        return [
            'status' => 200,
            'thead'  => ['Fecha', 'Aviso', 'Sucursal', 'Destinatarios', 'Proveedor', 'Estado'],
            'row'    => $rows,
            'logs'   => $logs,
            'kpis'   => [
                'total'    => $total,
                'exitosos' => $exitosos,
                'fallidos' => intval($counts['fallidos']),
                'tasa'     => $total ? round($exitosos * 100 / $total) : 0
            ],
            'limite' => [
                'max'   => self::DAILY_LIMIT,
                'aviso' => intval(ceil(self::DAILY_LIMIT * self::WARN_PERCENT / 100)),
                'hoy'   => $this->getHistorialTodayCounts([$company])
            ]
        ];
    }

    // Envía un WhatsApp real con las llaves que están en pantalla (guardadas o no) y
    // lo deja en el historial como 'prueba', igual que un aviso.
    function sendWaTest(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        $company  = $this->companyId();
        $provider = $_POST['proveedor'];
        $instance = trim($_POST['instancia']);
        $token    = trim($_POST['token']);
        $apiUrl   = rtrim(trim($_POST['api_url']), '/');
        $phone    = normalizePhone($_POST['telefono']);
        $message  = trim($_POST['mensaje']);

        if (!in_array($provider, self::PROVIDERS, true)) {
            return ['status' => 400, 'message' => 'Proveedor no reconocido.'];
        }

        $error = credentialError($provider, $instance, $token, $apiUrl);
        if ($error !== '') {
            return ['status' => 400, 'message' => $error];
        }

        if ($phone === '') {
            return ['status' => 400, 'message' => 'El teléfono va a 10 dígitos (ej. 9621501886) o como id de grupo …@g.us.'];
        }

        if ($message === '') {
            return ['status' => 400, 'message' => 'Escribe el mensaje de prueba.'];
        }

        $to     = providerRecipient($provider, $phone);
        $result = $provider === 'greenapi'
            ? $this->greenApiSend($apiUrl, $instance, $token, $to, $message)
            : $this->ultraMsgSend($instance, $token, $to, $message);

        $this->createHistorial([
            'prueba',
            'Mensaje de prueba',
            $to,
            $provider,
            $result['ok'] ? null : $result['detalle'],
            $result['ok'] ? 'enviado' : 'fallido',
            $company
        ]);

        return $result['ok']
            ? ['status' => 200, 'message' => 'Mensaje de prueba enviado a ' . $to]
            : ['status' => 502, 'message' => 'No se envió: ' . $result['detalle']];
    }

    private function recipientRows($type){
        $rows = [];

        foreach ($this->listDestinatarios([$this->companyId()]) ?: [] as $item) {
            if ($type !== '' && $item['type'] !== $type) continue;

            $rows[] = [
                'id'       => intval($item['id']),
                'nombre'   => $item['name'],
                'telefono' => $item['phone'],
                'tipo'     => $item['type'],
                'activo'   => intval($item['active'])
            ];
        }

        return $rows;
    }

    // Estados de getStateInstance (green-api.com/docs): authorized, notAuthorized,
    // blocked, sleepMode, starting, suspended. yellowCard es el nombre viejo de suspended.
    private function greenApiState($apiUrl, $instance, $token){
        $res = httpGetJson("{$apiUrl}/waInstance{$instance}/getStateInstance/{$token}");

        if ($res['error'] !== '') {
            return ['ok' => false, 'estado' => 'sinRespuesta', 'detalle' => 'No hubo respuesta de la API URL.'];
        }

        if ($res['code'] === 401 || $res['code'] === 403 || $res['code'] === 404) {
            return ['ok' => false, 'estado' => 'credencialesInvalidas', 'detalle' => 'Green API rechazó la instancia o el token.'];
        }

        $state = $res['body']['stateInstance'] ?? '';
        if ($state === 'yellowCard') $state = 'suspended';

        if ($state === '') {
            return ['ok' => false, 'estado' => 'sinRespuesta', 'detalle' => 'Respuesta inesperada (HTTP ' . $res['code'] . ').'];
        }

        return ['ok' => $state === 'authorized', 'estado' => $state, 'detalle' => ''];
    }

    // UltraMsg: /instance/status. Estados: authenticated, qr, loading, initialize,
    // retrying, disconnected, standby.
    private function ultraMsgState($instance, $token){
        $res = httpGetJson('https://api.ultramsg.com/' . rawurlencode($instance) . '/instance/status?token=' . rawurlencode($token));

        if ($res['error'] !== '') {
            return ['ok' => false, 'estado' => 'sinRespuesta', 'detalle' => 'No hubo respuesta de api.ultramsg.com.'];
        }

        $body = $res['body'] ?: [];

        if (!empty($body['error'])) {
            $detail = is_string($body['error']) ? $body['error'] : 'UltraMsg rechazó la instancia o el token.';
            return ['ok' => false, 'estado' => 'credencialesInvalidas', 'detalle' => $detail];
        }

        $state = $body['status']['accountStatus']['status'] ?? ($body['accountStatus']['status'] ?? '');

        if ($state === '' || !is_string($state)) {
            return ['ok' => false, 'estado' => 'sinRespuesta', 'detalle' => 'Respuesta inesperada (HTTP ' . $res['code'] . ').'];
        }

        return ['ok' => $state === 'authenticated', 'estado' => $state, 'detalle' => ''];
    }

    // Green API: sendMessage responde {idMessage} cuando el mensaje entra a la cola.
    private function greenApiSend($apiUrl, $instance, $token, $to, $message){
        $res = httpPost("{$apiUrl}/waInstance{$instance}/sendMessage/{$token}", json_encode([
            'chatId'  => $to,
            'message' => $message
        ]), true);

        if ($res['error'] !== '') {
            return ['ok' => false, 'detalle' => 'No hubo respuesta de la API URL.'];
        }

        if (!empty($res['body']['idMessage'])) {
            return ['ok' => true, 'detalle' => ''];
        }

        if ($res['code'] === 401 || $res['code'] === 403) {
            return ['ok' => false, 'detalle' => 'Green API rechazó la instancia o el token.'];
        }

        $detail = $res['body']['message'] ?? ('respuesta inesperada (HTTP ' . $res['code'] . ')');
        return ['ok' => false, 'detalle' => is_string($detail) ? $detail : json_encode($detail)];
    }

    // UltraMsg: messages/chat responde {sent: "true"} o {error: …}.
    private function ultraMsgSend($instance, $token, $to, $message){
        $res = httpPost('https://api.ultramsg.com/' . rawurlencode($instance) . '/messages/chat', http_build_query([
            'token'    => $token,
            'to'       => $to,
            'body'     => $message,
            'priority' => '10'
        ]), false);

        if ($res['error'] !== '') {
            return ['ok' => false, 'detalle' => 'No hubo respuesta de api.ultramsg.com.'];
        }

        $body = $res['body'] ?: [];
        $sent = $body['sent'] ?? '';

        if ($sent === true || $sent === 'true') {
            return ['ok' => true, 'detalle' => ''];
        }

        $detail = $body['error'] ?? ($body['message'] ?? ('respuesta inesperada (HTTP ' . $res['code'] . ')'));
        return ['ok' => false, 'detalle' => is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_UNICODE)];
    }
}

// Complements.

function defaultTemplates(){
    return [
        // Lo mas importante del "Resumen del dia" del Corte Z. Tambien hay {fondo_inicial},
        // {cuentas} (total), {con_descuento}, {ventas}, {descuentos} y {pedidos}.
        'cierre' => implode("\n", [
            '*CIERRE DEL DÍA*',
            '📍 {sucursal} · 📅 {fecha}',
            '👤 Cerró: {cajero}',
            '',
            '*TOTALES*',
            '💰 Venta bruta: ${venta_bruta}',
            '⏳ Pendiente: ${pendiente}',
            '🛍️ Pedidos del día: ${pedidos_dia}',
            '↩️ Abonos ant.: ${abonos_ant}',
            '✅ *En caja: ${en_caja}*',
            '',
            '*MÉTODOS DE PAGO*',
            '💵 Efectivo ({efectivo_n}): ${efectivo}',
            '💳 Tarjeta ({tarjeta_n}): ${tarjeta}',
            '🏦 Transferencia ({transferencia_n}): ${transferencia}',
            '',
            '*CUENTAS*',
            '✔️ Pagadas: {pagadas}',
            '🕒 Pendientes: {pendientes}',
            '📝 Cotizaciones: {cotizaciones}',
            '❌ Canceladas: {canceladas}',
            '🎟️ Ticket promedio: ${ticket_promedio}',
            '',
            '🔄 *Turnos:* {turnos}'
        ]),
        // Lo mas importante del ticket "Cierre x Turno".
        'turno' => implode("\n", [
            '*CIERRE DE TURNO*',
            '📍 {sucursal} · 📅 {fecha}',
            '👤 {cajero} · 🕒 {apertura} – {cierre}',
            '💼 Inicio de caja: ${fondo_inicial}',
            '',
            '*TOTALES*',
            '💰 Venta del turno: ${ventas}',
            '🛍️ Cobrado de pedidos: ${cobrado_turno}',
            '↩️ Abonos ant. ({abonos_n}): ${abonos_ant}',
            '✅ *Total caja: ${total_caja}*',
            '',
            '*MÉTODOS DE PAGO*',
            '💵 Efectivo: ${efectivo}',
            '💳 Tarjeta: ${tarjeta}',
            '🏦 Transferencia: ${transferencia}',
            '',
            '*PEDIDOS DEL TURNO*',
            '🧾 Pedidos: {pedidos}',
            '✔️ Pagados: {pagados}',
            '🕒 Pendientes: {pendientes}',
            '📝 Cotizaciones: {cotizaciones}',
            '❌ Cancelados: {cancelados}'
        ]),
        // {descripcion} = "Notas adicionales" del pedido (order.note).
        'personalizado' => implode("\n", [
            '🎂 *PEDIDO {folio}*',
            '📍 {sucursal}',
            '',
            '📅 *{fecha_larga}*',
            '⏰ *{hora}*',
            '{entrega}',
            '👤 {cliente}',
            '📱 {telefono}',
            '',
            '{productos}',
            '',
            '📝 *Descripción:* {descripcion}',
            '',
            '💰 Total: {total}',
            '💵 Anticipo: {anticipo} ({forma_pago})',
            '🧾 *Resta: {restante}*',
            '{estatus}'
        ]),
        'edicion' => implode("\n", [
            '✏️ *CAMBIO EN PEDIDO {folio}*',
            '📍 {sucursal}',
            '',
            '*Qué cambió:*',
            '{cambios}',
            '',
            '*Así queda:*',
            '📅 *{fecha_larga}*',
            '⏰ *{hora}*',
            '{entrega}',
            '👤 {cliente}',
            '📱 {telefono}',
            '',
            '{productos}',
            '',
            '📝 *Descripción:* {descripcion}',
            '',
            '🧾 *Resta: {restante}*',
            '{estatus}'
        ])
    ];
}

// Cadena vacia = llaves completas. Valida el formato porque instancia y token
// terminan dentro de la URL del proveedor.
function credentialError($provider, $instance, $token, $apiUrl){
    $name = providerName($provider);

    if (trim((string) $instance) === '' || trim((string) $token) === '') {
        return "Captura la instancia y el token de {$name}.";
    }

    if ($provider === 'greenapi' && !preg_match('/^\d+$/', $instance)) {
        return 'El ID de instancia de Green API solo lleva números.';
    }

    if ($provider === 'ultramsg' && !preg_match('/^[A-Za-z0-9_-]+$/', $instance)) {
        return 'El Instance ID de UltraMsg solo lleva letras y números (ej. instance12345).';
    }

    if (!preg_match('/^[A-Za-z0-9_-]+$/', $token)) {
        return 'El token solo lleva letras y números, sin espacios.';
    }

    if ($provider === 'greenapi' && !preg_match('#^https?://[A-Za-z0-9.-]+(:\d+)?$#', (string) $apiUrl)) {
        return 'La API URL de Green API va completa, ej. https://7103.api.greenapi.com';
    }

    return '';
}

// Lo que se guarda: 10 digitos (sin lada) o el id del grupo tal cual.
function normalizePhone($raw){
    $raw = trim((string) $raw);

    if (preg_match('/@g\.us$/i', $raw)) {
        $group = strtolower(preg_replace('/\s+/', '', $raw));
        return preg_match('/^[0-9-]+@g\.us$/', $group) ? $group : '';
    }

    $digits = preg_replace('/\D/', '', $raw);
    if (strlen($digits) === 13 && substr($digits, 0, 3) === '521') $digits = substr($digits, 3);
    if (strlen($digits) === 12 && substr($digits, 0, 2) === '52')  $digits = substr($digits, 2);

    return strlen($digits) === 10 ? $digits : '';
}

// Las opciones del modal se guardan como una fila por aviso.
function expandTypes($value){
    $map = [
        'todos'         => ['cierre', 'turno', 'personalizado', 'edicion'],
        'cierres'       => ['cierre', 'turno'],
        'pedidos'       => ['personalizado', 'edicion'],
        'cierre'        => ['cierre'],
        'turno'         => ['turno'],
        'personalizado' => ['personalizado'],
        'edicion'       => ['edicion']
    ];

    return $map[$value] ?? [];
}

function recipientError($name, $phone, $types){
    if ($name === '') return 'Escribe un nombre o etiqueta para el destinatario.';
    if ($phone === '') return 'El teléfono va a 10 dígitos (ej. 9621501886) o como id de grupo …@g.us.';
    if (empty($types)) return 'Elige qué aviso recibe.';
    return '';
}

function validDate($value){
    $date = DateTime::createFromFormat('Y-m-d', (string) $value);
    return $date && $date->format('Y-m-d') === $value;
}

function providerName($provider){
    return $provider === 'greenapi' ? 'Green API' : 'UltraMsg';
}

function noticeName($type){
    $names = [
        'cierre'        => 'Cierre Diario',
        'turno'         => 'Cierre de Turno',
        'personalizado' => 'Pedidos',
        'edicion'       => 'Pedido editado',
        'prueba'        => 'Mensaje de prueba'
    ];

    return $names[$type] ?? $type;
}

// El token va en la URL de Green API: la URL nunca se escribe en el log.
function httpGetJson($url){
    $curl = curl_init();

    curl_setopt_array($curl, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_SSL_VERIFYPEER => 0,
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    ]);

    $raw   = curl_exec($curl);
    $error = curl_error($curl);
    $code  = intval(curl_getinfo($curl, CURLINFO_HTTP_CODE));
    curl_close($curl);

    return [
        'code'  => $code,
        'error' => $error,
        'body'  => $raw ? json_decode($raw, true) : null
    ];
}

// Mismo cuidado que httpGetJson: la URL lleva el token, no se escribe en el log.
function httpPost($url, $payload, $asJson){
    $curl = curl_init();

    curl_setopt_array($curl, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_SSL_VERIFYPEER => 0,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            $asJson ? 'Content-Type: application/json' : 'Content-Type: application/x-www-form-urlencoded'
        ],
    ]);

    $raw   = curl_exec($curl);
    $error = curl_error($curl);
    $code  = intval(curl_getinfo($curl, CURLINFO_HTTP_CODE));
    curl_close($curl);

    return [
        'code'  => $code,
        'error' => $error,
        'body'  => $raw ? json_decode($raw, true) : null
    ];
}

// Formato de cada proveedor (plano, lámina 04): UltraMsg +52…, Green API 521…@c.us.
// Los grupos (…@g.us) pasan igual en los dos.
function providerRecipient($provider, $phone){
    if (substr($phone, -5) === '@g.us') return $phone;

    return $provider === 'greenapi' ? '521' . $phone . '@c.us' : '+52' . $phone;
}

function renderNotice($type){
    $styles = [
        'cierre'        => 'bg-[#7C3AED]/15 text-[#A78BFA]',
        'turno'         => 'bg-[#F59E0B]/15 text-[#FBBF24]',
        'personalizado' => 'bg-[#C4B5FD]/15 text-[#C4B5FD]',
        'edicion'       => 'bg-[#38BDF8]/15 text-[#7DD3FC]',
        'prueba'        => 'bg-[#25D366]/15 text-[#4ADE80]'
    ];

    $style = $styles[$type] ?? 'bg-gray-600 text-white';
    return '<span class="px-[6px] py-[1px] rounded-full text-[10px] font-semibold whitespace-nowrap ' . $style . '">' . noticeName($type) . '</span>';
}

function renderOrigin($sucursal, $reference){
    $sub = $reference ? '<span class="block text-[11px] text-gray-400">' . $reference . '</span>' : '';
    return '<span class="text-xs text-white">' . ($sucursal ?: '—') . '</span>' . $sub;
}

function renderProvider($provider){
    $style = $provider === 'greenapi'
        ? 'bg-[#4CAF50]/15 text-[#4ADE80]'
        : 'bg-[#8B5CF6]/15 text-[#A78BFA]';

    return '<span class="px-[6px] py-[1px] rounded-full text-[10px] font-semibold whitespace-nowrap ' . $style . '">' . providerName($provider) . '</span>';
}

function renderSendStatus($status, $error){
    if ($status === 'enviado') {
        return '<span class="px-[6px] py-[1px] rounded text-[10px] font-semibold bg-[#014737] text-[#3FC189]">Enviado</span>';
    }

    $detail = $error ? '<span class="block text-[10px] text-[#F87171] mt-[2px]">' . $error . '</span>' : '';
    return '<span class="px-[6px] py-[1px] rounded text-[10px] font-semibold bg-[#721c24] text-[#F87171]">Fallido</span>' . $detail;
}

    $obj    = new WaConfig();
    $fn     = $_POST['opc'];
    $encode = [];
    $encode = $obj->$fn();
    echo json_encode($encode);
?>
