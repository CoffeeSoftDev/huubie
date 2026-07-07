---
name: ERS
description: 
date: 2026-07-07
---

ERS - SISTEMA DE FACTURACIÓN 

  

## DESCRIPCIÓN BREVE DEL PROYECTO

Es un sistema que se encarga del control de tickets y sus diferentes medios de pago asociados a cada transacción. 

Su objetivo principal es generar un concentrado ordenado de tickets, diferenciando claramente entre tickets facturados y no facturados.

El sistema deberá permitir la selección de una  fecha para consultar los tickets emitidos, estos tickets son los tickets que se facturaron y los tickets de tarjeta de crédito.

  

## OBJETIVO DEL PROYECTO

Permitir controlar mediante un sistema un monto correcto de venta aplicando técnicas de cálculo de porcentaje de venta donde un 70 % es la idea de venta facturado y el otro restante 30 %.

El sistema debe poder imprimir los tickets que no tienen iva ( el otro 30 % ) pero estos deben generar productos aleatorios que den la suma del ticket en caso de que no pueden tener a lo mejor un descuento.

  

## SECCIONES DEL PROYECTO

Módulo para subir los tickets generado por el pos \[ Pestaña detallado \]

 Este apartado permite subir los tickets seleccionado el mes y año , debe tener los campos que tiene el archivo de excel, en caso de no tener datos en la columna dejar la celda en null

Los campos son los siguientes:

  

Día

Fecha de operación

Hora de cierre

Semana

Movimiento PDV

Orden

Tipo de orden

Subtipo de orden

No. Mesa

No. Personas

Mesero

Terminal

Acción

Subtotal

Iva

IEPS

Total

Descuento

Cantidad

Precio unitario

Costo real

Costo con modificadores

Costo ideal

Tipo de grupo

Grupo

Descripción

Platillo / Artículo

Modificador

Clave platillo

Es modificado

Hora de captura

Terminal de captura

Subtotal

IVA

IEPS

Total

  

Módulo para subir las facturas \[ pestaña facturados \]

Este apartado permite subir la lista de facturas realizadas durante el mes y cuenta con los siguientes campos:

  

ID

RFC

Nombre

Folio

Referencia

Estatus

Fecha

Subtotal

IVA

IEPS

Total

Propina

UUID

Forma de pago

Método

No Orden

Fecha operación

Tipo de orden

Subtipo de orden

Tipo

Observaciones

  

Módulo para subir las ventas por pago \[ pestaña venta por pago \]

  
  

Este apartado permite subir las ventas por total de pago incluye los siguientes campos:

  

ID

Facturados

Forma de pago

Dia

Orden

Monto

Total

Propina

Participación del dia

Fecha

Orden

Movimiento

Estatus

Mesero

Cajero

Forma de pago

Fecha de pago

Referencia

Transacción

Terminal

Código de validación

Total

Propina

Total cobrado

  

Módulo de consulta 

-   Acomulado total real
    
-   No facturados que voy a facturar
    
-   Órden facturado
    

  

Apartado de impresión y control de fecha

  
  
  
  
  

## USUARIOS QUE UTILIZARÁN EL PROYECTO

ADMINISTRADOR DEL POS

  
  

## ¿EL ÉXITO DEL PROYECTO SE DA CUÁNDO?

Consultar tickets por fecha: Selecciona una fecha específica para visualizar todos los tickets generados ese día, ordenados cronológicamente. Podrás identificar cuáles están bloqueados (facturados) y cuáles están pendientes de facturación.

Calcular porcentaje de venta al 16%: El sistema permite calcular, mediante una fórmula, el porcentaje de ventas gravadas al 16% de IVA. Por ejemplo: si el monto total de ventas del día 10 es de $31,843.90, el monto a facturar al 16% es de $19,312.43 y el monto ya facturado es de $2,978.30.

  

Meta de facturación: Este análisis se aplica únicamente a los tickets generados en el día, con el objetivo de alcanzar al menos el 70% de ventas facturadas al 16%. Si no se alcanza el objetivo, el sistema mostrará la cifra aproximada lograda.

  

Gestión de tickets con IVA 0%: Al hacer clic en un ticket con IVA 0%, el sistema analizará la lista de productos incluidos y calculará el monto total. Si el monto excede el límite permitido, se aplicará automáticamente una estrategia de descuento al producto o se ajustará el precio del ticket.

  

Impresión de tickets virtuales: El sistema permite generar y visualizar un ticket virtual listo para impresión.

  
  

## ACCIONES A REALIZAR

  

FASE 1: ANÁLISIS.

  

-   Crear una base de datos con los campos requeridos del sistema de facturación , diseñar un diagrama ER que muestre las conexiones que tendrá el sistema.
    
-   Definir las tablas principales y que no tendrá que modificar
    
-   Definir los productos que servirán como puente al momento de mostrar un ticket.
    
-   Desarrollar templates para entender la idea de cómo debería funcionar el sistema.
    

  
  

FASE 2: ADMINISTRADOR

-   Diseñar modulo para subir el archivo de ventas diarias ( venta por pago ) a, mediante un excel poder subir la información acorde al mes.
    

  

-   Diseñar un módulo para poder subir la lista de facturas acorde al mes y año seleccionado.
    
-   Subir archivo de ventas detallado para poder gestionar las ventas
    
-   Diseñar un módulo de administración de métodos de pago
    

  
  
  
  

FASE 3: RESUMEN DE VENTAS

  

-   Crear un apartado de consulta para ver el acomulado total real 
    
-   Crear un apartado de no facturado donde se muestran sólo formas de pago de bancos ( Tarjeta de crédito ) no facturados.
    
-   Crear un apartado de orden facturado que muestre todas las facturas realizadas en un rango de fecha.
    

  

-   Módulo generador de folios
    

-   Debe mostrar todos los tickets creados ese día 
    
-   No muestra los tickets en efectivo
    
-   Genera tickets de al seleccionarlos en caso de tener  0 %
    

  
  

## EXCEPCIONES

  
  

## OBSERVACIONES

-   Las notas del día tienen un número consecutivo y se reinician al siguiente día. 
    
-   Del total de tickets creados ese día no debes mostrar los que son efectivos.
    
-
