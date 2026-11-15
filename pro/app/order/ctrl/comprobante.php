<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
require_once __DIR__ . '/core-order.php';
require_once __DIR__ . '/../mdl/mdl-portal.php';

/*  GET ?id=<comprobante>: la foto o el PDF que mando el cliente, para la
    bandeja de Clientes › Comprobantes.

    Los archivos viven fuera de la web (pro/storage/receipts) y solo salen por
    aqui: con sesion, permiso de ver Clientes y de la sucursal de la sesion.
    Una foto se sirve en caja de arena (sandbox): si alguien sube un archivo
    disfrazado, el navegador no ejecuta nada. El PDF va sin sandbox porque el
    visor del navegador no abre con el. */
class ReceiptFile extends core {
    use CustomerPortal;

    public function serve($id) {
        if (Session::user() === null)              return $this->stop(401, 'Tu sesión terminó. Vuelve a entrar.');
        if (!Permission::can('pos-clientes', 'show')) return $this->stop(403, 'Tu rol no tiene permiso para ver clientes.');
        if ($id <= 0 || $this->branchId() === 0)   return $this->stop(404, 'Ese comprobante no existe.');

        $row  = $this->qReceipt($id, $this->branchId());
        $path = $row ? $this->receiptPath($row['file']) : null;

        if ($path === null || !is_file($path)) return $this->stop(404, 'Ese comprobante no existe en esta sucursal.');

        $ext   = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $types = $this->receiptTypes();

        if (!isset($types[$ext])) return $this->stop(404, 'Ese comprobante no existe en esta sucursal.');

        // La sesion ya no hace falta: soltarla deja trabajar a las otras pestañas mientras baja el archivo.
        session_write_close();

        while (ob_get_level() > 0) ob_end_clean();

        header('Content-Type: ' . $types[$ext]);
        header('Content-Length: ' . filesize($path));
        header('Content-Disposition: inline; filename="' . $this->receiptFolio($id) . '.' . $ext . '"');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, no-store');
        header('X-Frame-Options: SAMEORIGIN');

        if ($ext !== 'pdf') {
            header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
        }

        readfile($path);
    }

    private function stop($status, $message) {
        http_response_code($status);
        header('Content-Type: text/plain; charset=utf-8');
        header('Cache-Control: no-store');

        echo $message;
    }
}

(new ReceiptFile())->serve(isset($_GET['id']) ? (int) $_GET['id'] : 0);
