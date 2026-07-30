# Plan de Despliegue: Menú Digital (Proyecto GV-ERP/menu)

## 1. Objetivo
Implementar el menú de videos digital en un servidor local dentro del establecimiento, garantizando:
- **Acceso público** para los clientes mediante un código QR a través de la red WiFi del local.
- **Administración remota** segura para el equipo de TI mediante una red VPN virtual (Hamachi) y MKT.

## 2. Alcance
**Dentro del alcance:**
- Despliegue del código existente (`GV-ERP/DEV/menu/`) en un servidor local (XAMPP/WAMP).
- Configuración de red local (LAN/WiFi) para acceso de clientes móviles.
- Configuración de QR estático apuntando a la IP local del servidor.
- Instalación y configuración de túnel VPN (Hamachi) para acceso administrativo remoto.
- Hardening básico (firewall, bloqueo de rutas administrativas en LAN pública).

**Fuera del alcance (por ahora):**
- Desarrollo de nuevas funcionalidades para el menú.
- Acceso al menú desde fuera del local (Internet público) para clientes.
- Integración con pasarelas de pago o sistemas externos.

## 3. Recursos Necesarios

| Categoría | Detalle / Recurso |
|---|---|
| **Hardware** | 1 PC/Servidor físico (queda en el local, conectado por cable). 1 Router/WiFi para clientes. |
| **Software** | XAMPP/WAMP/Laragon (PHP + MySQL). Hamachi (gratis hasta 5 equipos). MKConnect. |
| **Red** | IP local estática (reserva DHCP en router). Puerto 80/443 abierto en firewall local. |
| **Datos** | Archivos del proyecto `GV-ERP/DEV/menu/` y backup de la Base de Datos (`.sql`). |

## 4. Arquitectura del Sistema

```text
              ┌───────────────────────────────────────────────┐
              │   RED LOCAL DEL BAÑO / NEGOCIO (LAN/WiFi)      │
              │                                                │
              │   ┌──────────┐        ┌──────────────────┐    │
              │   │ Cliente  │  QR ──▶│  Servidor Local  │    │
              │   │ (celular)│  HTTP  │  (XAMPP/WAMP o   │    │
              │   └──────────┘        │   PHP nativo)    │    │
              │                       │  GV-ERP/DEV/menu │    │
              │                       └────────┬─────────┘    │
              │                                │              │
              │                       ┌────────▼─────────┐    │
              │                       │  BD MySQL/MariaDB│    │
              │                       └──────────────────┘    │
              └───────────────────────┬───────────────────────┘
                                      │ Hamachi (VPN virtual)
                                      │ IP 25.x.x.x
              ┌───────────────────────▼───────────────────────┐
              │   RED HAMACHI (acceso remoto admin)            │
              │                                                │
              │   ┌──────────────┐                             │
              │   │ Tu laptop /  │  Hamachi ──▶ administra     │
              │   │ MKConnect    │            portal (backoffice)│
              │   └──────────────┘                             │
              └────────────────────────────────────────────────┘
5. Fases y Cronograma Estimado
Fase 1: Acondicionamiento del Servidor Local (Día 1)
Instalación de XAMPP/WAMP.
Copia del proyecto a htdocs (o directorio equivalente).
Restauración de la Base de Datos.
Pruebas locales (localhost).
Fase 2: Configuración de Red y WiFi (Día 2)
Asignación de IP fija al servidor.
Apertura de puertos en el Firewall de Windows.
Desactivación de "Aislamiento de clientes" (AP Isolation) en el router.
Prueba de acceso desde un celular conectado a la WiFi local usando la IP.
Fase 3: Generación y Despliegue de QR (Día 2 - 3)
Generación del código QR apuntando a http://<IP-LOCAL>/menu/.
Impresión y colocación física en los puntos de acceso (baños).
Prueba integral: Escanear QR y verificar carga de videos.
Fase 4: Acceso Remoto Administrativo (Día 4)
Instalación de Hamachi en servidor local y PC de administrador.
Creación de red privada virtual y emparejamiento de equipos.
Configuración de MKConnect para alcanzar la IP de Hamachi (25.x.x.x).
Restricción del panel /admin para que solo sea visible por la red Hamachi (bloqueo por .htaccess o Apache config).
Fase 5: Entrega y Operación (Día 5)
Verificación de encendido automático del servidor tras corte de luz (BIOS).
Configuración de backup automático programado de la BD.
Entrega de documentación/credenciales al cliente.
6. Consideraciones Críticas y Seguridad
Hamachi free: Máx 5 equipos por red. Suficiente para admin, pero limita si crece.
Estabilidad del servidor local: Debe quedar siempre encendido y con reinicio automático tras cortes de luz (configurar BIOS Restore on AC Power Loss: Power On).
IP local fija: Reservar MAC en el router para que el QR nunca cambie.
AP Isolation: Algunos routers bloquean tráfico entre clientes; desactívalo para que el celular llegue al servidor.
Ancho de banda: Los videos pesan; si son muchos clientes simultáneos, comprimirlos (H.264, 720p) y servir desde caché.
Restringir phpMyAdmin: No exponerlo en la LAN de clientes, solo permitir acceso desde la red Hamachi (25.0.0.0/8).
7. Checklist de Arranque
 XAMPP/WAMP instalado y proyecto cargado.
 BD importada y conexión configurada.
 Apache escuchando en 0.0.0.0:80.
 Firewall abierto en puerto 80.
 IP local reservada en router.
 AP isolation desactivado.
 QR generado e impreso.
 Hamachi instalado en servidor y laptop admin.
 Acceso a /menu/admin validado por Hamachi.
 Backups programados.
