# Framework CoffeeSoft — copia para el sandbox del Visor

Copia de trabajo del framework que cargan los previews del Playground / Coffee Studio
(`pgAssembleModule` la inyecta vía `PG_FRAMEWORK_FILES` en `src/js/studio.js`).

| archivo | origen |
|---|---|
| `coffeeSoft.js` | `inventory/src/js/coffeeSoft.js` |
| `complementos.js` | `inventory/src/js/complementos.js` |
| `plugins.js` | `inventory/src/js/plugins.js` |

Copiado el **2026-07-16**.

## Por que existe

El sandbox cargaba `alpha/src/js/coffeSoft.js`, que NO es el framework del destino de
la transmutacion: tiene 46 metodos frente a los 56 de inventory. Le faltan, entre
otros, `createCoffeeTable3`, `infoCard`, `summaryCard`, `detailCard`, `sideBar`,
`loader`, `createExcel` y `createNavbar`. El preview renderizaba contra una API mas
pobre que la real, y los modulos que usaban esos componentes reventaban con
TypeError sin motivo aparente.

## Riesgo conocido: esta copia envejece

Es una copia, no un enlace. Si `inventory/src/js/` cambia, esto NO se entera y el
agente empieza a generar contra una API que ya no existe — el mismo fallo que vino a
resolver, solo que mas dificil de ver. Al tocar el framework de inventory, resincroniza:

```sh
cp inventory/src/js/{coffeeSoft.js,complementos.js,plugins.js} coffee/app/src/coffee/
```

Ojo tambien con el destino: el pivote por defecto de `transmute`
(`app/inventarios/pos-entradas.php`) carga `app/src/js/coffeeSoft.js`, que es un
framework distinto — inventory es superset suyo salvo `alertBox` y `kpisRow`. Un
modulo que use esos dos funcionara en el preview y fallara al aterrizar en
`app/inventarios/`.

## Nombres que se confunden

`createCoffeTable3` (una "e") NO existe aqui: es de `app/src/js/coffeesoft-varoch.js`.
El de este framework es `createCoffeeTable3` (doble "e"). La guia de CoffeeMagic
documenta la variante varoch, asi que los agentes tienden a escribir la incorrecta.
