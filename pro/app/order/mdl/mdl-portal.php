<?php
/*  Portal del cliente con comprobantes.

    Va aparte de mdl-order.php, que es compartido y no se toca. Lo usan con
    `use CustomerPortal;`:
      ctrl-portal        el enlace publico (portal.php), SIN sesion.
      ctrl-comprobantes  la revision en Clientes › Comprobantes, con sesion.
      comprobante.php    entrega el archivo, con sesion.

    Reglas que no se ven en el codigo de un vistazo:
      - customer_portal es UN enlace por cliente y sucursal. El cliente es de
        toda la empresa, pero cada sucursal cobra lo suyo: el enlace solo
        muestra los folios de su sucursal y el abono entra al turno de ella.
      - Lo que ve el cliente (portalDebts):
          items   pedidos (sale_type_id 1) con anticipo que siguen debiendo y
                  ventas a credito (sale_type_id 3, Pendiente, con su cargo vivo).
          quotes  cotizaciones vigentes: sin pagos, con total y con entrega de
                  hoy en adelante. No deben nada todavia; el cliente puede
                  mandar su anticipo.
        Los pedidos de la tienda en linea sin aceptar (sale_type_id 4) no salen.
      - Lo que resta: pedido = total - pagado; credito = total + propina -
        pagado (la misma cuenta de ctrl-clientes).
      - customer_receipt.status: pending (en revision), applied (abonado),
        rejected (rechazado; reject_reason lo ve el cliente).
      - El archivo vive en pro/storage/receipts/<branch_id>/<32 hex>.<ext>,
        fuera de la web. receiptPath() es la unica forma de armar su ruta.
      - Todo es protected: Permission::dispatch ejecuta cualquier metodo publico
        del ctrl que llegue en `opc`, y los de un trait cuentan como suyos. */
trait CustomerPortal {

    // -- Enlace --

    // El enlace con su cliente, su sucursal, su empresa y los datos de la tienda. Null si no existe o el cliente o la sucursal ya no operan.
    protected function qPortalByToken($token) {
        return $this->qRow("
            SELECT
                cp.id                          AS portal_id,
                cp.customer_id,
                cp.branch_id,
                cp.token,
                IFNULL(c.name, '')             AS customer,
                IFNULL(b.name, '')             AS branch,
                IFNULL(b.ubication, '')        AS address,
                IFNULL(b.logo, '')             AS branch_logo,
                b.company_id,
                IFNULL(co.name, '')            AS company,
                IFNULL(co.logo, '')            AS company_logo,
                IFNULL(os.title, '')           AS title,
                IFNULL(os.whatsapp, '')        AS whatsapp,
                IFNULL(os.accent, '')          AS accent,
                IFNULL(os.bank_info, '')       AS bank_info
            FROM {$this->pos}customer_portal cp
            INNER JOIN {$this->pos}customer c ON c.id = cp.customer_id AND IFNULL(c.active, 1) = 1
            INNER JOIN {$this->bd}branches b ON b.id = cp.branch_id AND IFNULL(b.is_active, 1) = 1
            INNER JOIN {$this->bd}branches cb ON cb.id = c.branch_id AND cb.company_id = b.company_id
            INNER JOIN {$this->bd}companies co ON co.id = b.company_id
            LEFT JOIN {$this->pos}online_store os ON os.branch_id = cp.branch_id
            WHERE cp.token = ?
            LIMIT 1
        ", [$token]);
    }

    protected function qPortal($customerId, $branchId) {
        return $this->qRow("
            SELECT id, customer_id, branch_id, token, created_at, updated_at
            FROM {$this->pos}customer_portal
            WHERE customer_id = ?
                AND branch_id = ?
            LIMIT 1
        ", [$customerId, $branchId]);
    }

    protected function qPortalTokenTaken($token) {
        return $this->qCount("SELECT COUNT(*) FROM {$this->pos}customer_portal WHERE token = ?", [$token]) > 0;
    }

    protected function qCreatePortal($array) {
        return $this->qInsertInto('customer_portal', $array);
    }

    protected function qUpdatePortal($array) {
        return $this->qUpdateIn('customer_portal', $array);
    }

    // -- Lo que debe --

    // Pedidos del cliente en la sucursal que pueden deber algo: Cotizacion y Pendiente.
    protected function qPortalOrders($customerId, $branchId) {
        return $this->qRows("
            SELECT
                s.id,
                s.sale_status_id,
                IFNULL(s.total, 0)       AS total,
                s.delivery_date,
                s.delivery_time,
                s.created_at,
                {$this->qPaidSql('s')}   AS paid
            FROM {$this->pos}sale s
            WHERE s.customer_id = ?
                AND s.branch_id = ?
                AND s.sale_type_id = 1
                AND s.sale_status_id IN (1, 2)
                AND IFNULL(s.active, 1) = 1
            ORDER BY s.id
        ", [$customerId, $branchId]);
    }

    // qCreditSales (mdl-credito) con la sucursal: el portal solo cobra lo de la suya.
    protected function qPortalCredit($customerId, $branchId) {
        return $this->qRows("
            SELECT
                s.id,
                IFNULL(s.total, 0)       AS total,
                IFNULL(s.tip_amount, 0)  AS tip_amount,
                s.created_at,
                {$this->qPaidSql('s')}   AS paid
            FROM {$this->pos}sale s
            WHERE s.customer_id = ?
                AND s.branch_id = ?
                AND s.sale_type_id = 3
                AND s.sale_status_id = 2
                AND IFNULL(s.active, 1) = 1
                AND EXISTS (
                    SELECT 1
                    FROM {$this->pos}receivable r
                    WHERE r.sale_id = s.id
                        AND r.kind = 'cargo'
                        AND IFNULL(r.active, 1) = 1
                        AND r.deleted_at IS NULL
                )
            ORDER BY s.id
        ", [$customerId, $branchId]);
    }

    /*  Lo que debe el cliente en la sucursal, el folio mas viejo primero.
        items   lo que ya debe (pedidos con anticipo y ventas a credito).
        quotes  cotizaciones vigentes al $today ('Y-m-d').
        debt    suma de lo que resta de items. Las cotizaciones no cuentan. */
    protected function portalDebts($customerId, $branchId, $today) {
        $items  = [];
        $quotes = [];

        foreach ($this->qPortalOrders($customerId, $branchId) as $row) {
            $total = round((float) $row['total'], 2);
            $paid  = round((float) $row['paid'], 2);
            $left  = round($total - $paid, 2);

            if ($left <= 0.005) continue;

            $sale = [
                'id'         => (int) $row['id'],
                'kind'       => 'order',
                'folio'      => 'P' . (int) $row['id'],
                'status'     => (int) $row['sale_status_id'],
                'total'      => $total,
                'paid'       => $paid,
                'left'       => $left,
                'date'       => (string) ($row['delivery_date'] ?? ''),
                'time'       => (string) ($row['delivery_time'] ?? ''),
                'created_at' => (string) $row['created_at']
            ];

            if ((int) $row['sale_status_id'] === 2 || $paid > 0.005) {
                $items[] = $sale;
                continue;
            }

            if ($sale['date'] !== '' && $sale['date'] < $today) continue;

            $quotes[] = $sale;
        }

        foreach ($this->qPortalCredit($customerId, $branchId) as $row) {
            $total = round((float) $row['total'] + (float) $row['tip_amount'], 2);
            $paid  = round((float) $row['paid'], 2);
            $left  = round($total - $paid, 2);

            if ($left <= 0.005) continue;

            $items[] = [
                'id'         => (int) $row['id'],
                'kind'       => 'credit',
                'folio'      => 'V' . (int) $row['id'],
                'status'     => 2,
                'total'      => $total,
                'paid'       => $paid,
                'left'       => $left,
                'date'       => substr((string) $row['created_at'], 0, 10),
                'time'       => '',
                'created_at' => (string) $row['created_at']
            ];
        }

        usort($items, fn ($a, $b) => $a['id'] <=> $b['id']);

        $debt = 0;
        foreach ($items as $item) $debt += $item['left'];

        return ['items' => $items, 'quotes' => $quotes, 'debt' => round($debt, 2)];
    }

    // -- Comprobantes: lado del cliente --

    protected function qPortalReceipts($customerId, $branchId, $limit) {
        $limit = max(1, (int) $limit);

        return $this->qRows("
            SELECT
                r.id,
                r.sale_id,
                IFNULL(s.sale_type_id, 0)     AS sale_type_id,
                r.amount,
                IFNULL(r.note, '')            AS note,
                r.mime,
                r.status,
                IFNULL(r.reject_reason, '')   AS reject_reason,
                r.applied_amount,
                r.reviewed_at,
                r.created_at
            FROM {$this->pos}customer_receipt r
            LEFT JOIN {$this->pos}sale s ON s.id = r.sale_id
            WHERE r.customer_id = ?
                AND r.branch_id = ?
            ORDER BY r.id DESC
            LIMIT {$limit}
        ", [$customerId, $branchId]);
    }

    // Comprobantes que subio una conexion desde $since: freno del enlace publico.
    protected function qReceiptsFromIp($ip, $since) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}customer_receipt
            WHERE ip = ?
                AND created_at >= ?
        ", [$ip, $since]);
    }

    protected function qPendingReceipts($customerId, $branchId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}customer_receipt
            WHERE customer_id = ?
                AND branch_id = ?
                AND status = 'pending'
        ", [$customerId, $branchId]);
    }

    protected function qCreateReceipt($array) {
        return $this->qInsertInto('customer_receipt', $array);
    }

    protected function qUpdateReceipt($array) {
        return $this->qUpdateIn('customer_receipt', $array);
    }

    // -- Comprobantes: revision --

    protected function receiptSelect() {
        return "
            SELECT
                r.id,
                r.customer_id,
                IFNULL(c.name, '')               AS customer,
                IFNULL(c.phone, '')              AS phone,
                r.branch_id,
                r.sale_id,
                IFNULL(s.sale_type_id, 0)        AS sale_type_id,
                r.amount,
                IFNULL(r.note, '')               AS note,
                r.file,
                r.file_name,
                r.mime,
                r.size,
                r.status,
                IFNULL(r.reject_reason, '')      AS reject_reason,
                r.applied_amount,
                r.payment_method_id,
                IFNULL(pm.name, '')              AS method,
                r.turn_id,
                IFNULL(t.folio, '')              AS turn_folio,
                r.reviewed_user_id,
                IFNULL(CONCAT_WS(' ', u.name, u.last_name), '') AS reviewer,
                r.reviewed_at,
                r.created_at
            FROM {$this->pos}customer_receipt r
            LEFT JOIN {$this->pos}customer c ON c.id = r.customer_id
            LEFT JOIN {$this->pos}sale s ON s.id = r.sale_id
            LEFT JOIN {$this->pos}payment_method pm ON pm.id = r.payment_method_id
            LEFT JOIN {$this->pos}turn t ON t.id = r.turn_id
            LEFT JOIN {$this->bd}users u ON u.id = r.reviewed_user_id";
    }

    protected function qReceipt($id, $branchId) {
        return $this->qRow("
            {$this->receiptSelect()}
            WHERE r.id = ?
                AND r.branch_id = ?
            LIMIT 1
        ", [$id, $branchId]);
    }

    // Bloqueado hasta el commit (solo dentro de transaction()). Sin subconsultas, como qLockSales.
    protected function qLockReceipt($id, $branchId) {
        return $this->qRow("
            SELECT id, customer_id, sale_id, amount, status
            FROM {$this->pos}customer_receipt
            WHERE id = ?
                AND branch_id = ?
            LIMIT 1
            FOR UPDATE
        ", [$id, $branchId]);
    }

    /*  La bandeja de Clientes › Comprobantes.
        pending   en revision, el mas viejo primero: se atienden en orden.
        reviewed  abonados y rechazados, el ultimo revisado primero. */
    protected function qReceiptList($branchId, $status, $limit) {
        $pending = $status === 'pending';
        $where   = $pending ? "r.status = 'pending'" : "r.status IN ('applied', 'rejected')";
        $order   = $pending ? 'r.id' : 'IFNULL(r.reviewed_at, r.updated_at) DESC, r.id DESC';
        $limit   = max(1, (int) $limit);

        return $this->qRows("
            {$this->receiptSelect()}
            WHERE r.branch_id = ?
                AND {$where}
            ORDER BY {$order}
            LIMIT {$limit}
        ", [$branchId]);
    }

    protected function qReceiptCounts($branchId) {
        $row = $this->qRow("
            SELECT
                IFNULL(SUM(status = 'pending'), 0)   AS pending,
                IFNULL(SUM(status = 'applied'), 0)   AS applied,
                IFNULL(SUM(status = 'rejected'), 0)  AS rejected
            FROM {$this->pos}customer_receipt
            WHERE branch_id = ?
        ", [$branchId]);

        return [
            'pending'  => $row ? (int) $row['pending'] : 0,
            'applied'  => $row ? (int) $row['applied'] : 0,
            'rejected' => $row ? (int) $row['rejected'] : 0
        ];
    }

    // -- Archivo --

    // Extensiones y tipos que se aceptan. El tipo se decide por el contenido, nunca por el nombre.
    protected function receiptTypes() {
        return ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'pdf' => 'application/pdf'];
    }

    // Carpeta de los comprobantes de una sucursal (pro/storage/receipts/<id>).
    protected function receiptDir($branchId) {
        return dirname(__DIR__, 3) . '/storage/receipts/' . (int) $branchId;
    }

    // Ruta en disco de customer_receipt.file. Null si el valor no tiene la forma que guarda ctrl-portal.
    protected function receiptPath($file) {
        $file = (string) $file;

        if (!preg_match('~^\d+/[a-f0-9]{32}\.(jpg|png|webp|pdf)$~', $file)) return null;

        return dirname(__DIR__, 3) . '/storage/receipts/' . $file;
    }

    // -- Formato --

    protected function receiptFolio($id) {
        return 'C' . (int) $id;
    }

    // P de pedido, V de venta a credito. Sin folio: «a lo que debo».
    protected function receiptTarget($saleId, $saleType) {
        if (empty($saleId)) return '';

        return ((int) $saleType === 3 ? 'V' : 'P') . (int) $saleId;
    }
}
