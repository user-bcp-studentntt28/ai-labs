# Propuesta: Preparar escenarios de prueba del proveedor

## Issue

[#30 — [HU-CONC-05] Preparar escenarios de prueba del proveedor](https://github.com/user-bcp-studentntt28/ai-labs/issues/30)

## Por qué

Para verificar la conciliación hace falta provocar diferencias de forma controlada. Hoy no hay una forma de la demo para alterar el reporte simulado del proveedor sin editar datos a mano, y eso impide probar cómo aparecen las diferencias al volver a conciliar.

## Qué cambia

- Se agrega un control para configurar una alteración sobre el reporte simulado del proveedor, usando `POST /control/settlements`.
- Se permiten los modos `AMOUNT`, `MISSING`, `DUPLICATE`, `ORPHAN` y `CLEAR`.
- Se informa que el control solo cambia el reporte y que hay que volver a conciliar.

## Capacidades

- Nueva: `conciliacion-escenarios-proveedor` (ver [spec.md](./specs/conciliacion-escenarios-proveedor/spec.md)).

## Alcance

- Selección de un pago existente y de un modo permitido.
- `ORPHAN` con un identificador nuevo y un monto positivo en céntimos.
- Mensaje que indica el alcance del control y la necesidad de volver a conciliar.
- Visualización de los errores del contrato.

## Fuera de alcance

- Cualquier cambio en proveedor, wallet o ledger reales.
- Corrección de datos financieros.
- Operaciones de reinicio (`/control/reset`).

## Comportamiento que debe preservarse

Según [docs/ENDPOINTS.md](../../../docs/ENDPOINTS.md), `POST /control/settlements`:

- Configura una sola alteración por `paymentId`, reemplazando la anterior.
- `AMOUNT` exige `amountCents`; `MISSING`, `DUPLICATE` y `CLEAR` no lo usan.
- `ORPHAN` exige un ID nuevo y `amountCents`. Si el ID ya existe en el proveedor, responde `409 PROVIDER_ALREADY_EXISTS`.
- `CLEAR` elimina la alteración aunque el pago no tenga ninguna.
- Modo inválido responde `400 INVALID_MODE`.
- `amountCents` en la interfaz va de 1 a 49999 (menor a S/ 500,00). El contrato acepta hasta 100000000; el servidor valida.
- Un `paymentId` inexistente responde `404`.
- No modifica proveedor, wallet ni ledger.

**Nota sobre el issue:** el issue no menciona los errores `INVALID_MODE` y `PROVIDER_ALREADY_EXISTS`. Se incluyen aquí porque el contrato los define y la pantalla debe mostrarlos.

## Supuestos y preguntas abiertas

- Se asume que el selector de pago lista los pagos de `GET /payments`.
