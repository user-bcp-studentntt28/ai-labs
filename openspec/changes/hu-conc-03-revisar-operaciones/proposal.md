# Propuesta: Revisar operaciones e incidencias

## Issue

[#32 — [HU-CONC-03] Revisar operaciones e incidencias](https://github.com/user-bcp-studentntt28/ai-labs/issues/32)

## Por qué

Los datos de conciliación están dispersos en cuatro fuentes. El analista necesita ver cada operación agrupada por referencia, identificar qué fuente falta y entender el motivo de cada diferencia sin cruzar datos a mano.

## Qué cambia

- Se agrupan pagos, settlements e incidencias por referencia de operación.
- Se marca cuando falta un registro en alguna fuente.
- Se agrega búsqueda por referencia, motivo o identificador de incidencia, y filtros por estado y motivo.
- El detalle muestra estados y motivos del API junto con los datos de wallet, proveedor y ledger.
- Se distinguen los estados de presentación "Conciliada" y "Sin ejecutar" de los estados `OPEN` y `RESOLVED`.

## Capacidades

- Nueva: `conciliacion-revision-operaciones` (ver [spec.md](./specs/conciliacion-revision-operaciones/spec.md)).

## Alcance

- Agrupación por referencia y detección de registros faltantes.
- Búsqueda y filtros por estado y motivo.
- Detalle de operación con datos de las fuentes.
- Acciones de recarga de fuentes y de nueva conciliación desde el detalle.

## Fuera de alcance

- Filtros diarios o por canal (las fuentes no los exponen).
- Cambiar estados de incidencia del API.
- Seguimiento humano de incidencias (HU-CONC-04).

## Comportamiento que debe preservarse

- `Payment.id` coincide con `ProviderPayment.id` y con `LedgerEntry.operation`; esa es la referencia de agrupación.
- `Incident.payment_id` puede ser un ID de wallet en `BALANCE_MISMATCH`; esas incidencias se muestran a nivel de saldo y no se asocian a un pago.
- Los motivos son los del enum de `Incident.reason`: `DUPLICATE_PROVIDER`, `MISSING_WALLET`, `MISSING_PROVIDER`, `AMOUNT_MISMATCH`, `STATUS_MISMATCH`, `LEDGER_MISMATCH`, `LEDGER_UNBALANCED`, `BALANCE_MISMATCH`.
- Los estados de incidencia son solo `OPEN` y `RESOLVED`.

## Supuestos y preguntas abiertas

- **Decisión confirmada:** "Sin ejecutar" aplica cuando no existe una ejecución de conciliación en la sesión. "Conciliada" aplica cuando existe una ejecución y la operación no tiene incidencias `OPEN` (incluye las `RESOLVED`).
- Se asume que "falta un registro" significa ausencia de pago, settlement o asiento de ledger para la referencia.
