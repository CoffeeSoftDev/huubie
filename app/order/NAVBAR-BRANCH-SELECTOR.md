# Integración del selector de sucursal del navbar en `app/pedidos`

Guía paso a paso para reemplazar el `<select>` "Filtrar por sucursal" del filterBar de pedidos por el **branch pill** que ya existe en el navbar global.

---

## Contexto previo (entender antes de tocar)

El navbar (`/app/src/js/navbar.js`) ya tiene un **branch pill** (selector visual de sucursal) que aparece arriba a la derecha cuando el usuario tiene `level ∈ [1, 5]`. Cuando el usuario hace clic en otra sucursal, el navbar:

1. Hace `POST` a `ctrl-access.php` con `opc: switchBranch` → el backend actualiza `$_SESSION` con la nueva sucursal.
2. Dispara un evento custom en `document`:
   ```js
   document.dispatchEvent(new CustomEvent('branchChanged', { detail: { id, name } }));
   ```

Eso significa que **cualquier módulo** puede escuchar ese evento y reaccionar. No hace falta tocar el navbar.

---

## Paso 1 — Quitar el `<select>` del filterBar

En `app/pedidos/src/js/app.js`, dentro del método `createFilterBar()`, hay este bloque:

```js
if (rol == 1) {
    filterBar.push({
        opc: "select",
        id: "subsidiaries_id",
        lbl: "Filtrar por sucursal:",
        class: "col-12 col-md-3 col-lg-2",
        onchange: "app.onSubsidiaryChange()",
        data: [
            { id: "0", valor: "Todas las sucursales" },
            ...subsidiaries
        ]
    });
}
```

**Bórralo completo.** Es el push del select que genera el filtro visible.

---

## Paso 2 — Quitar la inicialización del select

Más abajo en el mismo `createFilterBar()`:

```js
// Inicializar select con la sucursal activa del usuario
if (rol == 1 && dailyClosure.subsidiary_id) {
    $('#subsidiaries_id').val(dailyClosure.subsidiary_id);
}
```

**Bórralo.** Si ya no existe el select, no hay nada que inicializar.

---

## Paso 3 — Simplificar `getSubsidiaryLabel()`

Hoy lee el `<select>` para decidir entre "Todas las sucursales", "(Mi sucursal)", etc. Sin el select, `sub_name` (que el backend devuelve ya filtrado por la sesión) basta:

```js
getSubsidiaryLabel() {
    return sub_name;
}
```

---

## Paso 4 — Eliminar `onSubsidiaryChange()` y `checkAndUpdateDailyClosure()`

Ambos métodos sólo existían porque el `<select>` los disparaba. Sin select, son código muerto. **Elimínalos.**

---

## Paso 5 — Crear el listener del evento del navbar

En lugar de "el select cambió → recargar", ahora será "el navbar cambió de sucursal → recargar". Agrega este método nuevo dentro de la clase `App`:

```js
bindBranchChange() {
    if (this._branchBound) return;
    this._branchBound = true;

    document.addEventListener('branchChanged', async () => {
        const req    = await useFetch({ url: this._link, data: { opc: 'init' } });
        sub_name     = req.subsidiaries_name;
        subsidiaries = req.sucursales || subsidiaries;
        clients      = req.clients || clients;
        dailyClosure = req.daily_closure || { is_closed: false };
        udn          = dailyClosure.subsidiary_id;
        openShift    = req.open_shift || { has_open_shift: false };

        this.ls();
        this.updateDailyClosureStatus();
        this.actualizarFechaHora({ label: this.getSubsidiaryLabel() });
    });
}
```

**¿Por qué `_branchBound`?** Evita que si llamas `render()` varias veces se registren listeners duplicados (un solo `branchChanged` dispararía N veces).

**¿Por qué refetchear `init`?** Tras `switchBranch`, las globales `sub_name`, `dailyClosure`, `openShift`, `udn` reflejan la sucursal vieja. Reemplazarlas con los nuevos valores del backend mantiene a la UI coherente con la sesión.

---

## Paso 6 — Engancharlo en `render()`

Agrega la llamada al final de `render()`:

```js
render() {
    this.layout();
    this.createFilterBar();
    this.ls();
    this.actualizarFechaHora({ label: this.getSubsidiaryLabel() });
    this.updateDailyClosureStatus();
    this.bindBranchChange();   // <- nuevo
}
```

---

## Lo que NO se toca

- **`jsonOrder()`** tiene un `#subsidiaries_id` dentro del form de Nuevo Pedido — otro contexto, déjalo.
- **`#subsidiariesDailyClose`** dentro del modal de Cierre del Día — otro contexto, déjalo.
- **`navbar.js`** no se modifica; ya emite el evento.

---

## Caso borde a decidir antes

Hoy el select tiene la opción **"Todas las sucursales" (id=0)** que muestra agregado de todo. El branch pill del navbar **no** tiene esa opción — siempre selecciona una sucursal concreta. Si necesitas conservar la vista agregada para `rol == 1`, hay que armar un botón/toggle aparte; si no, el flujo nuevo simplemente la elimina.

---

## Resumen de checklist

- [ ] Borrar `push` del select `Filtrar por sucursal` en `createFilterBar()`.
- [ ] Borrar la inicialización `$('#subsidiaries_id').val(...)`.
- [ ] Simplificar `getSubsidiaryLabel()` a `return sub_name;`.
- [ ] Eliminar métodos `onSubsidiaryChange()` y `checkAndUpdateDailyClosure()`.
- [ ] Agregar método `bindBranchChange()`.
- [ ] Llamar `this.bindBranchChange()` al final de `render()`.
- [ ] Decidir si se conserva el modo "Todas las sucursales".
