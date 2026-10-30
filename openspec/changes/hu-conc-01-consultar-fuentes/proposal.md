# Propuesta: Consultar fuentes de conciliación

## Issue

[#33 — [HU-CONC-01] Consultar fuentes de conciliación](https://github.com/user-bcp-studentntt28/ai-labs/issues/33)

## Por qué

El analista de operaciones necesita ver los datos de wallet, proveedor, ledger e incidencias antes de conciliar y después de hacerlo. Sin una carga explícita y verificable, la conciliación podría ejecutarse sobre datos incompletos o presentar una carga parcial como completa.

## Qué cambia

- Se agrega la consulta de las cuatro fuentes del flujo de conciliación: pagos del wallet seleccionado, settlements, asientos de ledger e incidencias.
- Se muestra cuándo se cargaron las fuentes y se permite actualizarlas.
- La conciliación queda bloqueada hasta que las fuentes estén cargadas.
- Los errores de consulta o de formato se informan sin mostrar datos parciales como completos.

## Capacidades

- Nueva: `conciliacion-consulta-fuentes` (ver [spec.md](./specs/conciliacion-consulta-fuentes/spec.md)).

## Alcance

- Consulta de `GET /payments?walletId=...`, `GET /settlements`, `GET /ledger` y `GET /reconciliations/incidents`.
- Estado de carga por fuente y marca de fecha/hora de la última carga exitosa.
- Acción para actualizar las fuentes.
- Bloqueo de la acción de conciliación mientras no estén cargadas.
- Interpretación de importes como céntimos de PEN.

## Fuera de alcance

- Filtros diarios o por canal: las fuentes no exponen fecha ni canal.
- Ejecutar `POST /reconciliations` (HU-CONC-02).
- Búsqueda, filtros y detalle de operaciones (HU-CONC-03).
- Cualquier escritura: esta historia solo lee datos.

## Comportamiento que debe preservarse

Según [docs/ENDPOINTS.md](../../../docs/ENDPOINTS.md):

- `GET /payments` usa `wallet-demo` como `walletId` predeterminado y devuelve `[]` cuando el wallet no tiene pagos. Un `[]` es una carga válida, no un error.
- `GET /settlements` devuelve el reporte completo, sin corte diario.
- `GET /ledger` no modifica saldos.
- `GET /reconciliations/incidents` devuelve incidencias `OPEN` y `RESOLVED` del último proceso de conciliación.
- Los importes son enteros en céntimos PEN (`1500` = S/ 15.00).

## Supuestos y preguntas abiertas

- Se asume que "fecha de carga" es la hora de la última consulta exitosa de cada fuente.
- Se asume que las cuatro fuentes se consultan como un conjunto: si una falla, el conjunto no queda cargado.
- **Pregunta resuelta (#33):** el grupo es el identificador de la URL base. El contrato devuelve incidencias por wallet del último proceso; no se agrega filtro en pantalla.
