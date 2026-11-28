<?php
/*  Plantilla de los catálogos de Inventarios.

    Las filas con company_id NULL son la PLANTILLA de Huubie: nunca se listan.
    La primera vez que una empresa entra al módulo (o vende algo con
    inventario) se le copian y desde ahí cada empresa edita los suyos sin tocar
    a las demás (la regla de inventory/, 18/10/2026). Los flujos buscan por
    code dentro de la empresa.

    Vive aparte porque la usan dos clases que no se pueden cargar juntas: el
    modelo de Inventarios y el de Pedidos (las dos se llaman mdl). */
final class InvPlantilla {

    const COLUMNS = [
        'unit'               => 'code, name, allows_decimals, sort_order',
        'department'         => 'name, icon, color_hex, sort_order',
        'inflow_origin'      => 'code, name, description, icon, color_hex, requires_supplier, updates_cost, starts_pending, is_system, sort_order',
        'outflow_reason'     => 'code, name, description, icon, color_hex, is_loss, requires_evidence, requires_department, is_system, sort_order',
        'adjustment_reason'  => 'code, name, icon, color_hex, affects_cost, is_system, sort_order',
        'transfer_status'    => 'code, name, name_out, name_in, order_index, is_terminal, icon, color_hex',
        'requisition_status' => 'code, name, order_index, is_terminal, icon, color_hex'
    ];

    // Copia la plantilla a la empresa en cada catálogo donde todavía no tenga nada.
    static function seed(CRUD $db, $inv, $companyId) {
        foreach (self::COLUMNS as $table => $columns) {
            $has = $db->_Read("SELECT COUNT(*) AS n FROM {$inv}{$table} WHERE company_id = ?", [$companyId]);

            if (!is_array($has) || (int) ($has[0]['n'] ?? 0) > 0) continue;

            $db->_CUD("
                INSERT INTO {$inv}{$table} ({$columns}, company_id, active)
                SELECT {$columns}, ?, active
                FROM {$inv}{$table}
                WHERE company_id IS NULL
                ORDER BY id
            ", [$companyId]);
        }
    }
}
