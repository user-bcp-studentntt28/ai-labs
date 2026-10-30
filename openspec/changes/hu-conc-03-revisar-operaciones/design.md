# Design: HU-CONC-03 Revisar operaciones conciliadas y con incidencias (#32)

## Contexto técnico

- Proyecto objetivo: `web/` (Angular 21, Vitest `node`). Base común con HU-CONC-01 y HU-CONC-02 (ver [design de HU-CONC-01](../hu-conc-01-consultar-fuentes/design.md)).
- Fuentes: `GET /payments`, `GET /settlements`, `GET /ledger`, `GET /reconciliations/incidents`, según `docs/ENDPOINTS.md`.
- Claves de unión:
  - `Payment.id` = `ProviderPayment.id` = `LedgerEntry.operation`, usada como referencia de operación.
  - `Incident.payment_id` puede ser un ID de wallet en `BALANCE_MISMATCH`.
- Motivos (`Incident.reason`): `DUPLICATE_PROVIDER`, `MISSING_WALLET`, `MISSING_PROVIDER`, `AMOUNT_MISMATCH`, `STATUS_MISMATCH`, `LEDGER_MISMATCH`, `LEDGER_UNBALANCED`, `BALANCE_MISMATCH`.
- Estados de incidencia del API: solo `OPEN` y `RESOLVED`.
- Referencia de comportamiento: `conciliacion-demo.html`, función `operationRows`. La demo no une el ledger a las filas y trata `BALANCE_MISMATCH` como una operación. Esos dos puntos cambian aquí.

## Goals

- Agrupar pagos, settlements, ledger e incidencias por referencia de operación, con una fila por referencia.
- Marcar cuando falta un registro en una fuente y cuál.
- Mostrar `BALANCE_MISMATCH` a nivel de wallet, fuera de la lista de operaciones.
- Buscar por referencia, motivo o identificador de incidencia, y filtrar por estado y motivo.
- Mostrar en el detalle los estados y motivos del API junto con los datos de wallet, proveedor y ledger.
- Presentar "Conciliada" y "Sin ejecutar" separados de `OPEN` y `RESOLVED`.
- Ofrecer recargar fuentes y ejecutar una nueva conciliación desde el detalle.

## Non-goals

- No cambiar estados de incidencia del API.
- No implementar seguimiento humano (HU-CONC-04) ni filtros diarios o por canal.
- No inventar campos que el contrato no entrega.

## Contratos protegidos

- Lecturas de pagos, settlements, ledger e incidencias, sin cambios de forma.
- Referencia de agrupación: `Payment.id` contra `ProviderPayment.id` y `LedgerEntry.operation`.
- Estados `OPEN` y `RESOLVED`, y motivos del enum.
- La presentación no escribe en el API.

## Componentes afectados

Bajo `web/src/`, todos nuevos:

- Funciones puras de modelo de vista (por ejemplo `buildOperationRows`, `buildWalletIncidents`, `matchesFilters`): reciben los datos de las fuentes y devuelven filas, faltantes, incidencias de saldo y filtros resultantes. No dependen del DOM.
- Mapa de etiquetas de presentación: "Conciliada", "Sin ejecutar", y etiquetas de motivo.
- Componente de lista: búsqueda, filtros y tabla. Consume el estado de HU-CONC-01 y HU-CONC-02.
- Componente de detalle: muestra datos de cada fuente y acciones de recarga y nueva conciliación. Llama a los servicios existentes, no HTTP directo.

## Decisiones técnicas y alternativas

| ID | Decisión | Alternativas consideradas | Motivo |
|----|----------|---------------------------|--------|
| D1 | Construir las filas con funciones puras, sin lógica en el componente | (a) Lógica de unión dentro del componente, como la demo | Las funciones puras se prueban en Vitest `node` sin DOM. Evita repetir la lógica en dos componentes. |
| D2 | Unir el ledger por `operation` como campo de la fila | (b) Solo contar asientos por fila, como la demo | El spec pide datos de ledger en el detalle y marcar faltantes. El conteo no los muestra. |
| D3 | Separar estado de conciliación (fila) y estado de atención del API (`OPEN`/`RESOLVED`) en columnas distintas | (c) Columna combinada, como la demo | El spec exige mostrarlos por separado. |
| D4 | `BALANCE_MISMATCH` en una lista aparte a nivel de wallet | (d) Fila con el ID de wallet como operación | Una fila con ID de wallet sugiere una operación que no existe. |
| D5 | "Sin ejecutar" si no hay ejecución en la sesión; "Conciliada" si hay ejecución y no hay `OPEN` | (e) Derivar el estado solo de las incidencias, como la demo | Decisión confirmada en el proposal: distingue operaciones que nunca se conciliaron. El estado de sesión viene de HU-CONC-02. |
| D6 | `RESOLVED` se presenta como "Conciliada" solo en la columna de conciliación, y se muestra el valor del API en su columna | (f) Mostrar `RESOLVED` en crudo | Confirmado en el proposal. Evita que la presentación oculte el valor del API. |

**Aprobado:** lista de BALANCE_MISMATCH a nivel de wallet, separada de las operaciones.

**Aprobado (D4):** las incidencias de saldo se muestran en una sección propia "Saldo de wallet" dentro del panel de wallet, por encima de la lista de operaciones. No se usa el encabezado porque el contrato no entrega un valor de saldo; un encabezado con número implicaría un dato que no mostramos. La demo no tiene un saldo de wallet visible, así que esta ubicación es una decisión nueva.

**Aprobado:** "falta en fuente" significa que la referencia no tiene pago, settlement o asiento en la fuente correspondiente.

**Resuelto:** las incidencias del grupo quedan como el contrato las devuelve, por wallet (HU-CONC-01).

**Aprobado (alcance por wallet, ajuste posterior a la implementación):** solo `GET /payments` depende de la wallet; settlements, ledger e incidencias son del grupo. La lista muestra únicamente las operaciones de la wallet consultada (sus pagos con sus settlements, asientos e incidencias) y las incidencias `BALANCE_MISMATCH` cuyo `payment_id` es esa wallet. Las referencias del grupo sin pago en la wallet (por ejemplo huérfanos `MISSING_WALLET`) se cuentan en un aviso y se muestran solo si el analista marca «Incluir referencias del grupo». Implementado en `scopeToWallet` (`operations.view-model.ts`).

## Estrategia incremental

1. Caracterizar la agrupación actual de la demo con datos de cada escenario (AMOUNT, MISSING, DUPLICATE, CLEAR, ORPHAN) antes de implementarla en Angular.
2. Implementar las funciones puras de unión, faltantes y `BALANCE_MISMATCH`, con tests.
3. Implementar búsqueda y filtros como funciones puras, con tests.
4. Implementar la lista y el detalle en componentes que consumen esas funciones.
5. Verificar con `ng build` y `npm test` desde `web/`.

## Pruebas de caracterización necesarias

- Una referencia en pagos, settlements y ledger produce una sola fila con los datos de las tres fuentes.
- Falta de settlement o de asiento marca la fila con la fuente faltante.
- `BALANCE_MISMATCH` aparece en la lista de wallet y no como fila de operación.
- Búsqueda por identificador de incidencia devuelve solo sus operaciones.
- Filtro por motivo y por estado devuelven el subconjunto correcto.
- "Sin ejecutar" sin ejecución en sesión; "Conciliada" con ejecución y sin `OPEN`; `RESOLVED` no se muestra como "Conciliada" en la columna del API.
- Ninguna operación aparece duplicada al unir las cuatro fuentes.
- Acciones del detalle llaman al servicio de fuentes o al de ejecución, nunca directamente a HTTP.

Las funciones puras usan Vitest en `node`. Los tests de componente dependen de D5 en HU-CONC-01.

## Riesgos y trade-offs

- Cambiar la clave de fila respecto a la demo puede alterar búsqueda y filtros; las funciones puras deben fijarse con tests antes de cambiar la UI.
- Mostrar "Conciliada" puede ocultar que una incidencia fue resuelta manualmente; mitigado por la columna del API.
- Unir el ledger en cada fila puede hacer la lista pesada con muchos registros.

## Rollback

- Revertir los commits o PRs de cada paso. El código es nuevo y no persiste datos, así que la reversión deja `web/` como estaba tras HU-CONC-02.

