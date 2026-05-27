# HOLA INGEEE!!!

# Inventarios — documentación

> Carpeta de documentación viva del módulo `app/inventarios` (Huubie POS-2).
> Generado por **Coffee Intelligence 🧠☕** — 2026-05-19.

## Índice

| Documento | Cubre |
|---|---|
| [flujo-operacion.md](flujo-operacion.md) | **Fase 1 · Inspección.** Flujo de operación del módulo en lenguaje de negocio: actores, conceptos clave, 6 submódulos (Stock, Entradas, Movimientos, Mermas, Traspasos, Configuración), reglas de negocio, integraciones cross-módulo. |
| [propuesta-bd.md](propuesta-bd.md) | **Fases 2 + 3 + 4 · Modelado, DDL y Auto-revisión.** Propuesta completa de base de datos `fayxzvov_inventario`: tablas clasificadas, diagrama de relaciones en texto plano, DDL `CREATE TABLE` para 15 tablas + 1 vista, seeds básicos, queries tipo, checklist db-rules. |

## Documentos relacionados (en este módulo)

| Ubicación | Cubre |
|---|---|
| [../plan/propuesta-salida-insumos.md](../plan/propuesta-salida-insumos.md) | Plan canónico de arquitectura **dual-tracking POS / Insumos** (entry-point gate, toggle, catálogos paralelos, DDL del lado supply). |
| [../plan/templates/](../plan/templates/) | Wireframes HTML para el selector de ámbito, menú extendido, formulario de salidas de insumos y admin-insumos. |
| [../templates/](../templates/) | Templates HTML del módulo en producción (admin-inventarios, inventario-menu, admin-productos, admin-almacenes, admin-nivel-stock). |
| [../example/](../example/) | Variantes de referencia (inventarios-ajustes, pos-main). |
| [../src/js/](../src/js/) | JS frontend del módulo (modo FAKE) — clases `App`, `Productos`, `Almacenes` y samples `SAMPLE_*`. |

## Convenciones

- **Modo FAKE.** Todo el código opera con datasets `SAMPLE_*` en JS. No hay backend conectado. Cada punto de integración está marcado con `// MODO FAKE — cuando exista el backend usar: fn_ajax({ opc: 'X' }, api).then(...)`.
- **Layout canónico.** Cada submódulo extiende `Templates` y aplica el `primaryLayout` con `heightPreset: 'full'` (ver `CLAUDE.md` raíz).
- **DB convenciones.** Singular inglés snake_case, DOUBLE para montos, FKs al final, `detail_` solo en renglones de raíz. Detalles en [grimorios/db-rules.md](../../../../Users/CoffeSoft/.claude/agents/grimorios/db-rules.md).

## Estado de implementación

| Capa | Estado |
|---|---|
| Wireframes HTML (templates/) | ✅ Completo (5 templates + menu) |
| Wireframes plan dual-tracking (plan/templates/) | ✅ Completo (5 templates) |
| Frontend JS modo FAKE | ✅ Completo (6 submódulos) |
| Backend PHP (ctrl + mdl) | 🔶 Parcial (solo `pos-historial-ventas`) |
| Base de datos | ⏳ Propuesta entregada — pendiente migración |
| Dimensión Insumos | ⏳ Solo planeada (Fase 2) |
