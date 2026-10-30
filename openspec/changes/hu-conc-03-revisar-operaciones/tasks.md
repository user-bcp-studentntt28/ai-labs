# Tareas: HU-CONC-03 Revisar operaciones y diferencias

Issue: [#32](https://github.com/user-bcp-studentntt28/ai-labs/issues/32). Componente: `web/`. Día 1: trabajo local, sin push, PR, remotos ni tags.

Dependencias: HU-CONC-01 (fuentes) y HU-CONC-02 (acciones "Recargar" y "Nueva conciliación" desde el detalle).

## 1. Caracterización

- [ ] 1.1 Crear fixtures de tres casos: operación en todas las fuentes, operación sin settlement o asiento, e incidencia `BALANCE_MISMATCH` cuyo `payment_id` es un ID de wallet.
- [ ] 1.2 Caracterizar en la demo (`conciliacion-demo.html`) la agrupación actual, el manejo de `BALANCE_MISMATCH` y los filtros, como referencia.

## 2. Agrupación por referencia (TDD)

- [ ] 2.1 Test: `buildOperationRows` une pagos, settlements y ledger por `Payment.id` = `ProviderPayment.id` = `LedgerEntry.operation`, en una sola fila.
- [ ] 2.2 Implementar `buildOperationRows` como función pura.
- [ ] 2.3 Test: una referencia sin settlement o asiento se marca con la fuente faltante.
- [ ] 2.4 Implementar la marca de fuente faltante.

## 3. Incidencias de saldo a nivel de wallet

- [ ] 3.1 Test: `BALANCE_MISMATCH` se separa en `buildWalletIncidents` y no se asocia a una operación.
- [ ] 3.2 Implementar `buildWalletIncidents`.

## 4. Búsqueda y filtros

- [ ] 4.1 Test: búsqueda por referencia, motivo o ID de incidencia; filtro por motivo del enum y por estado `OPEN`/`RESOLVED`.
- [ ] 4.2 Implementar los filtros como funciones puras.

## 5. Estados de presentación

- [ ] 5.1 Test: "Sin ejecutar" si no hay ejecución en la sesión; "Conciliada" si hay ejecución y ninguna incidencia `OPEN` en la operación; los estados de incidencia del API se muestran aparte.
- [ ] 5.2 Implementar el cálculo de estado de presentación.

## 6. Componentes

- [ ] 6.1 Test (jsdom): lista de operaciones con filtros y búsqueda; muestra las incidencias de wallet en su sección.
- [ ] 6.2 Implementar el componente de lista.
- [ ] 6.3 Test (jsdom): detalle con estados y motivos del API, datos de wallet, proveedor y ledger; acciones "Recargar" (HU-CONC-01) y "Nueva conciliación" (HU-CONC-02).
- [ ] 6.4 Implementar el componente de detalle; llama a servicios, no a HTTP directo.

## 7. Validación

- [ ] 7.1 Verificar que la sección "Saldo de wallet" aparece sobre la lista de operaciones y no dentro de ninguna fila (D4 aprobado).
- [ ] 7.2 Ejecutar `npm run test:coverage` desde `web/` y confirmar 85% o más en el código modificado.
- [ ] 7.3 Ejecutar `python tools/lab.py test web` desde la raíz.
- [ ] 7.4 Ejecutar `openspec validate hu-conc-03-revisar-operaciones` desde la raíz.
- [ ] 7.5 Registrar la evidencia con ID `H-WEB-NN` en la sección general de evidencias de la raíz.
