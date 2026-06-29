=== FORMATO OBLIGATORIO PARA ESTRUCTURA DE TABLAS ===
Cuando describas, propongas o documentes la ESTRUCTURA de tablas o sus RELACIONES,
NO uses ```mermaid (erDiagram, classDiagram, etc.) NI `CREATE TABLE` NI el formato
`+--+` tipo DESCRIBE. Usa SIEMPRE el formato de CAJAS MONOESPACIADAS de db-rules.md
§3.1. (El modo grafica/Excalidraw es aparte; esto es la representacion en TEXTO.)

Entrega en este orden:

1) DIAGRAMA DE RELACIONES (cajas ASCII): caja externa punteada para el esquema externo
   (cross-schema) con las tablas maestras, y caja de doble borde para el esquema actual
   con sus tablas, cardinalidades (◄────, 1:N, N:1) y [NUEVO] en lo que se crea.

┌───────────────────────────────────────────────────────────────────┐
│  <esquema_externo>  (cross-schema)                                │
│  ┌──────────────────┐         ┌──────────────────┐                │
│  │ tabla_maestra_1  │         │ tabla_maestra_2  │                │
│  │ • id_pk          │         │ • id_pk          │                │
│  └─────────┬────────┘         └─────────┬────────┘                │
└────────────┼─────────────────────────────┼────────────────────────┘
             │ fk_id                       │ fk_id
             ▼                             ▼
╔═══════════════════════════════════════════════════════════════════╗
║  <esquema_actual>                                                 ║
║  ┌────────────────┐   1:N   ┌─────────────────────────┐           ║
║  │ catalogo_status│◄────────┤ transaccion_raiz        │           ║
║  └────────────────┘         │ • id        PK          │           ║
║                             │ • status_id      FK     │           ║
║                             │ • fk_id ─→ externo      │           ║
║                             └────────┬────────────────┘           ║
║                                      │ 1:N                        ║
║                                      ▼                            ║
║                             ┌─────────────────────────┐           ║
║                             │ detail_transaccion      │  [NUEVO]  ║
║                             │ • id       PK           │           ║
║                             │ • transaccion_raiz_id FK│           ║
║                             └─────────────────────────┘           ║
╚═══════════════════════════════════════════════════════════════════╝

2) UNA CAJA MONOESPACIADA POR TABLA (plantilla literal; solo secciones que apliquen,
   en este orden vertical exacto):

┌──────────────────────────────────────────────────────────────────────┐
│ <tabla>  (<clase> — <descripción breve>)                             │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK                                       │
│                                                                      │
│  ── Negocio ──                                                       │
│  <columna>              <TIPO>          <nota opcional>              │
│                                                                      │
│  ── Montos (<nota si aplica>) ──                                     │
│  <columna>              DOUBLE                                       │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME                                     │
│  updated_at             DATETIME                                     │
│                                                                      │
│  ── Status ──                                                        │
│  status_id              → <catalogo_status>                          │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  udn_id                 → <esquema_externo>.udn                      │
│                                                                      │
│  ── FK locales ──                                                    │
│  <columna>_id           → <tabla_local>     <RESTRICT|CASCADE|…>     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT                                      │
└──────────────────────────────────────────────────────────────────────┘

3) TABLA MARKDOWN DE CARDINALIDADES:

### Cardinalidades

| Origen           | → | Destino             | Cardinalidad |
|------------------|---|---------------------|--------------|
| transaccion_raiz | → | detail_transaccion  | 1 : N        |
| transaccion_raiz | → | catalogo_status     | N : 1        |

REGLAS:
- Una columna por linea. A la derecha: tipo, opciones, `→ tabla` (FK), politica
  (RESTRICT/CASCADE/SET NULL) o aclaracion de uso.
- Tipos permitidos: INT, DOUBLE, VARCHAR(N), TEXT, DATE, DATETIME, TINYINT.
- Montos/numerico calculado SIEMPRE DOUBLE.
- NO muestres KEY, CONSTRAINT, ENGINE, CHARSET ni AUTO_INCREMENT.
- Conserva el orden vertical de las secciones tal cual la plantilla.
- Omite las secciones que no apliquen (sin montos = sin ── Montos ──).
- Pivote N:M puro: la caja solo lleva las 2 FKs (sin Negocio, sin timestamps, sin active).
- Marca [NUEVO] las tablas que se proponen crear.
- Genera CREATE TABLE solo si el usuario lo pide explicitamente tras aprobar las cajas.
