# Propuesta: Ejecutar conciliación de fuentes

## Issue

[#31 — [HU-CONC-02] Ejecutar conciliación de fuentes](https://github.com/user-bcp-studentntt28/ai-labs/issues/31)

## Por qué

El analista necesita comparar pagos, settlements, ledger y saldos para identificar diferencias. El resultado debe distinguir una conciliación sin diferencias de una con diferencias, y debe informar con claridad si falló la ejecución o solo la actualización posterior.

## Qué cambia

- Se agrega la acción que ejecuta `POST /reconciliations` cuando las fuentes están cargadas.
- Se muestra el estado `MATCHED` o `DIFFERENCES` y la cantidad de diferencias.
- Tras una ejecución exitosa se actualizan fuentes e incidencias.
- Se distinguen dos fallos: la ejecución que falla y la ejecución exitosa seguida de una actualización fallida.

## Capacidades

- Nueva: `conciliacion-ejecucion` (ver [spec.md](./specs/conciliacion-ejecucion/spec.md)).

## Alcance

- Acción de conciliación con `POST /reconciliations` sin cuerpo.
- Presentación del resultado y del conteo de diferencias.
- Actualización de fuentes e incidencias tras una ejecución exitosa.
- Mensajes diferenciados para ambos tipos de fallo.

## Fuera de alcance

- Corregir fuentes, saldos o registros, y mover fondos.
- Llamar a endpoints de control (`/control/*`) o de reinicio (`/control/reset`).
- Filtros, búsqueda o detalle de operaciones (HU-CONC-03).
- Cambios en el contrato del mock.

## Comportamiento que debe preservarse

Según [docs/ENDPOINTS.md](../../../docs/ENDPOINTS.md), `POST /reconciliations`:

- Devuelve `MATCHED` con `differences: []`, o `DIFFERENCES` con incidencias `OPEN`.
- Detecta faltantes, duplicados, montos, estados, asientos y balances.
- Repetir la ejecución no duplica incidencias: conserva los mismos IDs.
- Una incidencia se marca `RESOLVED` solo cuando su causa se corrige y se vuelve a ejecutar. La pantalla no corrige nada.
- No mueve dinero ni corrige saldos.

## Supuestos y preguntas abiertas

- Se asume que el conteo de diferencias es la longitud de `differences` devuelta.
- Se asume que la actualización posterior consiste en volver a consultar fuentes e incidencias (HU-CONC-01).
