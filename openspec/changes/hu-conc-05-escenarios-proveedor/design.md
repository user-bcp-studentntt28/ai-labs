# Design: HU-CONC-05 Escenarios de proveedor para el demo (#30)

## Contexto técnico

- Proyecto objetivo: `web/` (Angular 21, Vitest `node`). Base común con HU-CONC-01 (ver [design de HU-CONC-01](../hu-conc-01-consultar-fuentes/design.md)).
- Contrato: `POST /control/settlements` en `docs/ENDPOINTS.md`. Body: `paymentId`, `mode` (`AMOUNT`, `MISSING`, `DUPLICATE`, `ORPHAN`, `CLEAR`), `amountCents` (1 a 100000000; obligatorio solo para `AMOUNT` y `ORPHAN`).
- Respuestas de error: `400 INVALID_MODE`, `404` para `paymentId` inexistente, `409 PROVIDER_ALREADY_EXISTS` para `ORPHAN` con ID existente.
- Respuesta `Configured` con `configured` booleano.
- `X-Mock-Latency-Ms` existe en el contrato, pero no está en el alcance del spec: queda fuera.
- Referencia: `conciliacion-demo.html`, función `applySettlementControl`. Valida `amountCents` como entero ≥ 1 sin tope, y no mapea errores específicos. Ambos puntos se corrigen aquí.
- Después de aplicar un control, las fuentes de HU-CONC-01 deben recargarse para reflejar el reporte.

## Goals

- Seleccionar un pago existente y un modo permitido, y enviarlo a `POST /control/settlements`.
- Validar `amountCents` entre 1 y 49999 en la interfaz (menor a S/ 500,00), antes de enviar. El contrato acepta hasta 100000000 y el servidor sigue validando.
- Mostrar `INVALID_MODE`, `404` y `PROVIDER_ALREADY_EXISTS` con mensajes distintos.
- Informar que el control solo cambió el reporte simulado y que hay que volver a conciliar.

## Non-goals

- No cambiar proveedor, wallet ni ledger.
- No implementar `/control/reset` ni operaciones de limpieza global.
- No implementar `X-Mock-Latency-Ms`.
- No conciliar automáticamente tras aplicar un control.

## Contratos protegidos

- Forma del body de `POST /control/settlements` y sus reglas por modo.
- `amountCents` en la interfaz: 1 a 49999 (criterio de demo, S/ 500,00 exclusivo). Contrato: 1 a 100000000, validado por el servidor.
- Códigos de error `400 INVALID_MODE`, `404`, `409 PROVIDER_ALREADY_EXISTS`.
- Una sola alteración por `paymentId`: aplicar un nuevo modo reemplaza la anterior.
- `CLEAR` no es error aunque el pago no tenga alteración.

## Componentes afectados

Bajo `web/src/`, todos nuevos:

- Funciones puras de validación (por ejemplo `validateControlInput`): reglas por modo, rango de `amountCents`, ID nuevo para `ORPHAN`. Devuelven errores de validación sin enviar la petición.
- Función pura de mapeo de errores (por ejemplo `describeControlError`): traduce código y estado HTTP a mensaje.
- Servicio de control (por ejemplo `ProviderControlService`): único lugar que llama `POST /control/settlements`.
- Componente de escenarios: selector de pago (desde `GET /payments`, de HU-CONC-01), selector de modo, campos de importe o ID nuevo, mensaje de resultado. Llama al servicio, no HTTP directo.

## Decisiones técnicas y alternativas

| ID | Decisión | Alternativas consideradas | Motivo |
|----|----------|---------------------------|--------|
| D1 | Validar en cliente las reglas del contrato antes de enviar (modo, rango y ID de `ORPHAN`) | (a) Enviar y confiar en el 400 del servidor | El spec exige no enviar fuera de rango. El servidor sigue siendo la fuente de verdad. |
| D2 | Constantes con nombre para el mínimo y máximo de `amountCents` y para la lista de modos | (b) Números y textos sueltos en el componente | Regla de clean code de AI Labs y evita divergencia con el contrato. |
| D3 | Mensajes distintos para `INVALID_MODE`, `404` y `PROVIDER_ALREADY_EXISTS` | (c) Mensaje genérico de error | El analista necesita saber si falló el modo, el pago o el ID nuevo. |
| D4 | Tras éxito, recargar fuentes con el servicio de HU-CONC-01 y mostrar el aviso de volver a conciliar | (d) Recargar solo tras `CLEAR` | Cualquier modo cambia el reporte de liquidaciones. |
| D5 | `CLEAR` sin alteración previa se muestra como resultado exitoso, sin error | (e) Consultar antes si hay alteración | El contrato dice que `CLEAR` funciona aunque no exista. Consultar antes agrega una lectura sin valor. |

**Pendiente de aprobación (gate de arquitectura):**
- D1 resuelto con criterio de demo: UI 1 a 49999 (menor a S/ 500,00). Se asume que "500" son unidades monetarias (50000 centavos, formato `S/` del demo). El contrato y el servidor no cambian.
- Mensaje de `CLEAR` sin alteración previa: el contrato no devuelve esa información. Confirmar que el mensaje será neutro.
- Selector de pago: el `ORPHAN` usa un ID nuevo, no uno de la lista. Confirmar que el ID se escribe a mano y que se valida solo su formato.
- `X-Mock-Latency-Ms` queda fuera del alcance. Confirmar.

## Estrategia incremental

1. Caracterizar las reglas del contrato con las funciones puras de validación y de mapeo de errores, antes de la UI.
2. Implementar validación con sus constantes y tests.
3. Implementar el mapeo de errores y tests para `400`, `404`, `409` y error de red.
4. Implementar el servicio de control, con tests de cuerpo enviado por modo.
5. Implementar el componente, la recarga de fuentes y el mensaje de alcance.
6. Verificar con `ng build` y `npm test` desde `web/`.

## Pruebas de caracterización necesarias

- Cada modo envía el body esperado: `AMOUNT` y `ORPHAN` con `amountCents`; `MISSING`, `DUPLICATE` y `CLEAR` sin él.
- `amountCents` menor que 1, mayor o igual que 50000, decimal o no numérico: no se envía la petición.
- `ORPHAN` sin ID nuevo: no se envía la petición.
- `400 INVALID_MODE`, `404` y `409 PROVIDER_ALREADY_EXISTS` muestran mensajes distintos y no se presentan como éxito.
- Éxito: se muestra el aviso de alcance y se recargan las fuentes.
- `CLEAR` sobre pago sin alteración: resultado exitoso sin error.
- Reemplazo: aplicar un nuevo modo al mismo pago deja una sola alteración (verificable con respuestas simuladas).
- Ninguna llamada a `/control/reset` ni escritura en proveedor, wallet o ledger.

Las funciones puras y el servicio usan Vitest `node`. Las pruebas de componente dependen de D5 en HU-CONC-01.

## Riesgos y trade-offs

- Si el máximo de la UI diverge del contrato, el usuario verá errores inesperados. Mitigación: una sola constante, con prueba que la compara con el contrato.
- Mapear errores agrega ramas; cada una necesita su prueba.
- Recargar siempre tras éxito genera una lectura extra; aceptable para la demo.
- Un ID de `ORPHAN` escrito a mano puede coincidir con uno existente; el `409` lo cubre, pero el analista debe ver el mensaje.

## Rollback

- Revertir los commits o PRs de cada paso. El código es nuevo; los cambios en el mock viven fuera de este repositorio y no se tocan.
- Como no hay persistencia local, no hay datos que limpiar.

