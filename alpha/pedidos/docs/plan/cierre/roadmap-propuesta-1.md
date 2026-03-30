# Roadmap Propuesta 1: Cierre Diario Simple (MVP)

## Filosofia

Implementacion minima viable. Un boton que ejecute el cierre diario con las validaciones basicas, reutilizando al maximo las funciones existentes del modelo.

---

## Alcance

- Boton "Cerrar Dia" en el modal existente
- Validacion de turnos abiertos
- Consolidacion de metricas de turnos cerrados
- Registro en `daily_closure` + tablas relacionadas
- Bloqueo de creacion de pedidos post-cierre

---

## Fases

### Fase 1: Backend - Endpoint `closeDailyShift`

**Archivo**: `ctrl/ctrl-pedidos.php`

```
Flujo:
1. Recibir: date, subsidiaries_id
2. Validar: no exista cierre previo (getDailyClosureByDate)
3. Validar: no haya turnos abiertos
4. Calcular metricas consolidadas (SUM de cash_shift del dia)
5. INSERT daily_closure
6. INSERT closure_payment (x3 metodos)
7. INSERT closure_status_proccess (xN estados)
8. UPDATE order SET daily_closure_id
9. UPDATE cash_shift SET daily_closure_id
10. Retornar: { status: 200, closure_id, message }
```

**Queries nuevas en modelo**:
- `getDailyConsolidatedMetrics($date, $subsidiary_id)` - Suma de turnos cerrados
- `getOpenShiftsByDate($date, $subsidiary_id)` - Validar turnos abiertos
- `linkShiftsToClosure($closure_id, $date, $subsidiary_id)` - Vincular turnos

**Queries existentes reutilizadas**:
- `getDailyClosureByDate()` - Verificar cierre existente
- `createDailyClosure()` - Crear registro
- `updateOrdersDailyClosure()` - Vincular ordenes

### Fase 2: Frontend - Boton y Logica

**Archivo**: `src/js/app.js`

1. Agregar boton en `printDailyClose()` despues de "Imprimir Ticket"
2. Crear metodo `executeDailyClose()`:
   - Obtener fecha y sucursal seleccionada
   - Llamar API `closeDailyShift`
   - Manejar respuesta (exito/error)
   - Actualizar `dailyClosure` global
   - Llamar `updateDailyClosureStatus()`

### Fase 3: Integracion

- Probar flujo completo: abrir turno -> crear pedidos -> cerrar turno -> cierre diario
- Verificar bloqueo de "Nuevo Pedido" despues del cierre
- Verificar que `init()` detecta el cierre al recargar

---

## Diagrama de Flujo

```
[Btn "Cerrar Dia"] --> executeDailyClose()
    |
    v
API: closeDailyShift
    |
    ├── Turnos abiertos? --> Error: "Cierra los turnos primero"
    ├── Ya cerrado? --> Error: "El dia ya fue cerrado"
    |
    └── OK:
        ├── INSERT daily_closure
        ├── INSERT closure_payment
        ├── INSERT closure_status_proccess
        ├── UPDATE order
        ├── UPDATE cash_shift
        └── Return { status: 200 }
            |
            v
        Alert: "Cierre completado"
        dailyClosure = { is_closed: true }
        updateDailyClosureStatus()
```

---

## Estimacion de Complejidad

| Componente | Complejidad | Archivos |
|------------|-------------|----------|
| Backend endpoint | Baja | ctrl-pedidos.php |
| Queries modelo | Baja | mdl-pedidos.php |
| Boton + logica JS | Baja | app.js |
| **Total** | **Baja** | **3 archivos** |

---

## Ventajas

- Rapido de implementar
- Reutiliza infraestructura existente (tablas, modelo, validaciones)
- Minimo riesgo de regresion

## Desventajas

- Sin preview antes de confirmar
- Sin ticket de cierre diario (solo el de turno)
- Sin opcion de reabrir cierre
- Sin manejo de pedidos huerfanos (sin turno)
