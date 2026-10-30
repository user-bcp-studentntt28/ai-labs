# Tareas: HU-CONC-05 Escenarios de proveedor para el demo

Issue: [#30](https://github.com/user-bcp-studentntt28/ai-labs/issues/30). Componente: `web/`. Día 1: trabajo local, sin push, PR, remotos ni tags.

Dependencia: HU-CONC-01 (servicio de fuentes para el selector de pagos y la recarga tras aplicar un control).

## 1. Caracterización

- [x] 1.1 Crear fixtures de respuesta de `POST /control/settlements` (éxito, `400 INVALID_MODE`, `404`, `409 PROVIDER_ALREADY_EXISTS`) desde [ENDPOINTS.md](../../../docs/ENDPOINTS.md). (En las pruebas del servicio; el contrato responde `{configured}`.)
- [ ] 1.2 Caracterizar en la demo (`conciliacion-demo.html`, `applySettlementControl`) el cuerpo enviado por cada modo, como referencia. (No ejecutado; el cuerpo `{paymentId, mode, amountCents?}` se tomó del código de la demo.)

## 2. Validación de entrada (TDD)

- [x] 2.1 Test: `validateControlInput` acepta `amountCents` de 1 a 49999 para `AMOUNT` y `ORPHAN`, y rechaza `0`, `50000` o más, decimales y no numéricos sin enviar la petición.
- [x] 2.2 Implementar la validación con constantes con nombre (mínimo 1, máximo de UI 49999); el contrato sigue en 100000000.
- [x] 2.3 Test: `ORPHAN` sin ID nuevo se rechaza en validación.
- [x] 2.4 Implementar la regla de ID nuevo.

## 3. Servicio de control (TDD)

- [x] 3.1 Test: cada modo envía el cuerpo esperado: `AMOUNT` y `ORPHAN` con `amountCents`; `MISSING`, `DUPLICATE` y `CLEAR` sin él.
- [x] 3.2 Implementar `ProviderControlService`, único lugar que llama `POST /control/settlements`.
- [x] 3.3 Test: `describeControlError` distingue `400 INVALID_MODE`, `404`, `409` y error de red, con mensajes distintos.
- [x] 3.4 Implementar el mapeo de errores.

## 4. Resultado y recarga

- [x] 4.1 Test: éxito muestra el aviso "volver a conciliar" y recarga las fuentes con HU-CONC-01.
- [x] 4.2 Test: `CLEAR` sobre un pago sin alteración muestra resultado neutral, no error.
- [x] 4.3 Implementar el aviso y la recarga.
- [x] 4.4 Test: ninguna llamada a `/control/reset` ni otros endpoints de escritura.

## 5. Componente

- [x] 5.1 Test (jsdom): selector de pago desde `GET /payments`, selector de modo, campo de importe o ID nuevo según modo, y mensaje de resultado.
- [x] 5.2 Implementar el componente; llama al servicio, no a HTTP directo.

## 6. Validación

- [x] 6.1 Ejecutar `npm run test:coverage` desde `web/` y confirmar 85% o más en el código modificado.
- [x] 6.2 Ejecutar `python tools/lab.py test web` desde la raíz.
- [x] 6.3 Ejecutar `openspec validate hu-conc-05-escenarios-proveedor` desde la raíz.
- [x] 6.4 Registrar la evidencia con ID `H-WEB-NN` en la sección general de evidencias de la raíz. (`HALLAZGOS.md`: H-WEB-07, H-WEB-10; datos en `docs/DEMO.md`.)
