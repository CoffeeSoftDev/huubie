# Roadmap Propuesta 2: Cierre con Validaciones Estrictas

## Filosofia

Cierre diario robusto con validaciones exhaustivas antes de permitir el cierre. El sistema guia al usuario para resolver todas las inconsistencias antes de proceder.

---

## Alcance

- Todo lo del MVP (Propuesta 1)
- Validacion de pedidos huerfanos (sin turno)
- Validacion de pedidos con saldo pendiente
- Preview consolidado antes de confirmar
- Checklist de pre-cierre
- Mensajes detallados de error/advertencia

---

## Fases

### Fase 1: Backend - Endpoint de Pre-validacion

**Nuevo endpoint**: `getDailyClosePreview`

```
Recibe: date, subsidiaries_id
Retorna:
{
    can_close: true/false,
    issues: [
        { type: "open_shifts", count: 2, shifts: [...] },
        { type: "orphan_orders", count: 3, orders: [...] },
        { type: "pending_balance", count: 5, orders: [...] },
        { type: "already_closed", closure: {...} }
    ],
    preview: {
        total_shifts: 3,
        total_sales: 15000.00,
        total_orders: 25,
        by_payment: { cash: 8000, card: 5000, transfer: 2000 },
        by_status: { quotation: 2, pending: 3, delivered: 18, cancelled: 2 },
        shifts_detail: [
            { id: 1, name: "Matutino", total: 8000, orders: 12 },
            { id: 2, name: "Vespertino", total: 7000, orders: 13 }
        ]
    }
}
```

**Queries adicionales**:

```sql
-- Pedidos con saldo pendiente del dia
SELECT o.id, o.folio, o.total_pay, o.total_paid,
       (o.total_pay - COALESCE(o.discount, 0) - o.total_paid) as balance
FROM `order` o
WHERE DATE(o.date_creation) = :date
AND o.subsidiaries_id = :subsidiary_id
AND o.status != 4
AND (o.total_pay - COALESCE(o.discount, 0) - o.total_paid) > 0
AND o.active = 1

-- Resumen por turno del dia
SELECT cs.id, cs.shift_name, cs.opened_at, cs.closed_at,
       cs.total_sales, cs.total_orders, cs.total_cash,
       cs.total_card, cs.total_transfer
FROM cash_shift cs
WHERE DATE(cs.opened_at) = :date
AND cs.subsidiary_id = :subsidiary_id
AND cs.status = 'closed'
AND cs.active = 1
ORDER BY cs.opened_at ASC
```

### Fase 2: Frontend - Checklist de Pre-cierre

**Nuevo metodo**: `showDailyCloseChecklist()`

```
UI del checklist:
+-----------------------------------------------+
|  CHECKLIST DE CIERRE DIARIO                    |
+-----------------------------------------------+
|                                                |
|  [x] Todos los turnos cerrados         (2/2)  |
|  [x] Sin pedidos huerfanos              (0)   |
|  [!] Pedidos con saldo pendiente         (3)  |
|      -> Ver detalle                            |
|  [x] Sin cierre previo                        |
|                                                |
|  RESUMEN CONSOLIDADO                           |
|  +-----------+---------+-------+--------+     |
|  | Turno     | Ventas  | Pedidos| Metodo |     |
|  +-----------+---------+-------+--------+     |
|  | Matutino  | $8,000  |   12  | Eff/Tar|     |
|  | Vespertino| $7,000  |   13  | Eff/Tra|     |
|  +-----------+---------+-------+--------+     |
|  | TOTAL     | $15,000 |   25  |        |     |
|  +-----------+---------+-------+--------+     |
|                                                |
|  Desglose de pagos:                            |
|  Efectivo:      $8,000.00                      |
|  Tarjeta:       $5,000.00                      |
|  Transferencia: $2,000.00                      |
|                                                |
|  [Confirmar Cierre del Dia]   [Cancelar]       |
+-----------------------------------------------+
```

**Reglas del checklist**:
- Items con [x] = OK (verde)
- Items con [!] = Advertencia (amarillo) - permite continuar
- Items con [X] = Bloqueante (rojo) - NO permite continuar

| Validacion | Tipo | Accion si falla |
|------------|------|-----------------|
| Turnos abiertos | Bloqueante | "Cierra los turnos: [Lista con botones]" |
| Cierre previo | Bloqueante | "Ya cerrado por [nombre]" |
| Pedidos huerfanos | Advertencia | "Se incluiran sin turno asignado" |
| Saldo pendiente | Advertencia | "Hay pedidos sin pagar completamente" |

### Fase 3: Backend - Endpoint de Cierre Mejorado

Misma logica que Propuesta 1 pero con:
- Doble validacion (el backend re-valida todo)
- Incluir pedidos huerfanos en la consolidacion
- Log de actividad: quien cerro, cuando, con que datos

### Fase 4: Integracion y Pruebas

- Probar con turnos abiertos (debe bloquear)
- Probar con pedidos huerfanos (debe advertir)
- Probar con saldos pendientes (debe advertir)
- Probar cierre exitoso
- Probar deteccion en recarga de pagina

---

## Diagrama de Flujo

```
[Btn "Cerrar Dia"]
    |
    v
getDailyClosePreview()
    |
    v
+--can_close?--+
|              |
NO             SI
|              |
v              v
Mostrar       showDailyCloseChecklist()
issues            |
bloqueantes       v
              [Confirmar]
                  |
                  v
              closeDailyShift()
                  |
                  v
              +--status 200?--+
              |               |
              SI              NO
              |               |
              v               v
          Alert exito     Alert error
          Update UI
```

---

## Estimacion de Complejidad

| Componente | Complejidad |
|------------|-------------|
| Backend preview | Media |
| Backend cierre | Baja |
| Queries modelo | Media |
| Checklist UI | Media |
| Integracion | Media |
| **Total** | **Media** |

---

## Ventajas

- Usuario informado antes de cerrar
- Detecta inconsistencias automaticamente
- Reduce errores operativos
- Auditable (se sabe exactamente que se cerro)

## Desventajas

- Mas complejo de implementar que el MVP
- Mas llamadas al backend (preview + cierre)
- UI mas compleja de mantener
