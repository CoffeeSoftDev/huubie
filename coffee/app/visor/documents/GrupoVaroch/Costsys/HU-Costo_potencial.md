---
name: HU-Costo_potencial
description: 
date: 2026-06-29
---

**HU-CP-03: Precio propuesto**

**Qué:**  Capturar los precios propuestos para realizar una simulacion de costeo

**Para qué:** 

Poder capturar los precios propuestos sin cambiar el precio en el catalogo de recetas.

Poder observar inmediatamente el impacto que tendra un precio propuesto en el margen y las ventas estimadas.

Comparar escenario actual vs escenario propuesto en la misma fila.

**Criterios de aceptación:**

\- El usuario puede capturar / editar el precio propuesto directamente en la celda P.propuesto del tablero de costo potencial.

\- Al ejecutar el ejercicio mensual, el sistema debe copiar el precio\_propuesto del mes anterior al nuevo snapshot.

\- Comparar `costopotencial.precio_propuesto` entre el mes origen y el mes destino de una receta sin ventas.

***Como funciona:***

Cuando el usuario introduce un precio propuesto ej 19 antes 18 , 

el modelo recalcula los indicadores aplicando

las formulas pero sustituyendo el precio manteniendo el costo y desplazamiento

, esos no se tocan.

las formulas serian: 

pventaSinIvaPropuesto = precio\_propuesto / ( 1 + (iva + ieps) /100;
