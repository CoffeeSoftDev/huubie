# Spec: Módulo de Compras

## Estado del Proyecto
✅ **Spec Completo** - Listo para iniciar implementación

## Resumen Ejecutivo

El módulo de Compras es un sistema integral de gestión financiera para el ERP CoffeeSoft que permite registrar, consultar y administrar tres tipos de compras:
- **Fondo fijo**: Compras con presupuesto limitado y control de saldo
- **Corporativo**: Compras con métodos de pago corporativos
- **Crédito**: Compras con proveedores que otorgan crédito

## Características Principales

### Funcionalidades Core
- ✅ Registro de compras con validaciones dinámicas
- ✅ Edición y eliminación con restricciones de seguridad
- ✅ Filtros dinámicos por tipo de compra y método de pago
- ✅ Reporte concentrado con exportación a Excel
- ✅ Control de accesos por perfil (Captura, Gerencia, Dirección, Contabilidad)
- ✅ Sistema de auditoría completo
- ✅ Bloqueo mensual de módulo por Contabilidad
- ✅ Gestión de archivos adjuntos
- ✅ Totales en tiempo real

### Tecnologías
- **Frontend**: JavaScript (jQuery), CoffeeSoft Framework, TailwindCSS
- **Backend**: PHP 7.4+, Arquitectura MVC
- **Base de datos**: MySQL (9 tablas principales)

## Estructura de Archivos

```
finanzas/
├── captura/
│   ├── compras.js                    # Frontend principal (extiende Templates)
│   ├── ctrl/
│   │   └── ctrl-compras.php          # Controlador (extiende mdl)
│   └── mdl/
│       └── mdl-compras.php           # Modelo (extiende CRUD)
└── index.php                         # Punto de entrada
```

## Documentos del Spec

1. **requirements.md** - 6 historias de usuario con criterios de aceptación EARS
2. **design.md** - Arquitectura completa, componentes, modelos de datos, decisiones de diseño
3. **tasks.md** - 16 tareas principales con 60+ subtareas de implementación

## Próximos Pasos

Para comenzar la implementación:

1. Abre el archivo `tasks.md` en `.kiro/specs/compras/`
2. Haz clic en "Start task" junto a la primera tarea
3. Kiro te guiará paso a paso en la implementación

## Estimación de Desarrollo

- **MVP (tareas core)**: 40-50 horas
- **Implementación completa**: 60-80 horas

## Dependencias

- Framework CoffeeSoft (coffeSoft.js, plugins.js)
- Base de datos MySQL configurada
- Tablas base del ERP (udn, usuarios, module)

## Contacto

Para dudas sobre este spec, consulta los documentos de diseño o contacta al equipo de desarrollo.
