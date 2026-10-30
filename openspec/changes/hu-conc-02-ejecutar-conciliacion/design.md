# Design: HU-CONC-02 Ejecutar conciliación (#31)

## Contexto técnico

- Proyecto objetivo: `web/` (Angular 21, Vitest en `environment: 'node'`, `include: src/**/*.spec.ts`). Base común con HU-CONC-01: servicio HTTP, estado de fuentes, base URL del mock remoto `https://bcp-wallet-mock.yefri.workers.dev/groups/3` y decisión D5 de tests (ver [design de HU-CONC-01](../hu-conc-01-consultar-fuentes/design.md)).
- Contrato: `docs/ENDPOINTS.md`, `POST /reconciliations` sin cuerpo. Responde `MATCHED` con `differences: []` o `DIFFERENCES` con incidencias `OPEN`.
- Depende de HU-CONC-01: solo se ejecuta si el conjunto de fuentes está cargado.
- Referencia de comportamiento: `conciliacion-demo.html` (`runReconciliation`, `loadSources({ preserveResult: true })`, toast ante fallo del refresco). No se modifica.
- Hallazgo: `web/src/` todavía no existe; el scaffold lo crea HU-CONC-01.

## Goals

- Ejecutar `POST /reconciliations` desde Angular cuando las fuentes están cargadas.
- Mostrar `MATCHED` o `DIFFERENCES` y la cantidad de elementos de `differences`.
- Tras una ejecución exitosa, volver a consultar fuentes e incidencias.
- Distinguir en la UI dos resultados: la ejecución falló, o la ejecución se completó pero la actualización posterior falló.

## Non-goals

- No cambiar el contrato ni enviar cuerpo en `POST /reconciliations`.
- No corregir fuentes, saldos ni registros, ni llamar a `/control/*` ni `/control/reset`.
- No implementar reintentos automáticos ni conciliación en el navegador.
- No implementar búsqueda ni detalle (HU-CONC-03).

## Contratos protegidos

- `POST /reconciliations` sin cuerpo, y forma de respuesta: `status` `MATCHED` o `DIFFERENCES`, `differences` como arreglo.
- Idempotencia del contrato: repetir la ejecución no duplica incidencias y conserva sus IDs.
- No hay mutación de dinero, saldos ni registros.
- Lecturas de HU-CONC-01 usadas en la actualización posterior.

## Componentes afectados

Bajo `web/src/`, todos nuevos:

- Servicio de ejecución (por ejemplo `ReconciliationExecutionService`): único lugar que llama `POST /reconciliations` y valida la forma de la respuesta.
- Estado de ejecución separado del estado de fuentes: resultado (`idle`, `running`, `succeeded`, `failed`), conteo de diferencias y resultado de la actualización posterior (`refreshed` o `refreshFailed`).
- Componente de ejecución: botón, resultado y mensajes. No llama HTTP directamente.
- Reutiliza el servicio de fuentes y su estado de HU-CONC-01.

## Decisiones técnicas y alternativas

| ID | Decisión | Alternativas consideradas | Motivo |
|----|----------|---------------------------|--------|
| D1 | Dos resultados separados: ejecución y actualización posterior, con estados distintos | (a) Un solo mensaje de error, como la demo | El spec exige distinguir ambos fallos. Un mensaje único confunde al analista. |
| D2 | Si el refresco falla, el conjunto de fuentes queda no cargado y la conciliación queda bloqueada hasta reintentar con "Actualizar" | (b) Mantener fuentes anteriores marcadas como desactualizadas | (b) mezcla datos previos con un resultado nuevo, y HU-CONC-01 prohíbe presentar datos parciales como completos. |
| D3 | Deshabilitar el botón mientras la ejecución está en curso | (c) Permitir varios clics | Evita POST duplicados. El contrato es idempotente, pero no hay razón para enviar dos. |
| D4 | Tomar el `walletId` del estado de HU-CONC-01 en el momento de iniciar la ejecución | (d) Leer el campo de entrada en cada llamada | Evita que un cambio de wallet a mitad de la petición muestre resultados de otro wallet. |
| D5 | Validar la forma de la respuesta (`status` y `differences` arreglo) en el servicio | (e) Confiar en el tipo de TypeScript | Los tipos no validan la respuesta en tiempo de ejecución. Un contrato roto debe fallar explícitamente. |

**Aprobado:** D2 (un fallo de refresco tras un POST exitoso bloquea la conciliación hasta pulsar "Actualizar") y D5 (validación de la forma de la respuesta en el servicio).

## Estrategia incremental

1. Caracterizar primero el flujo actual: éxito, fallo de POST, fallo de refresco y respuesta mal formada, con respuestas simuladas.
2. Implementar el servicio de ejecución y su validación, con tests de servicio.
3. Implementar el estado de ejecución y los dos resultados (D1), con tests del estado.
4. Conectar el componente de ejecución y el bloqueo (D2, D3, D4).
5. Verificar con `ng build` y `npm test` desde `web/`.

## Pruebas de caracterización necesarias

- Éxito con `MATCHED` y `differences: []`: muestra `MATCHED` y cero diferencias; luego se consultan fuentes e incidencias.
- Éxito con `DIFFERENCES`: muestra la cantidad igual a `differences.length`.
- Fallo del POST: informa que la conciliación no se ejecutó y no consulta fuentes ni incidencias.
- Éxito del POST y fallo del refresco: informa que la conciliación se ejecutó y, por separado, que la actualización falló; la conciliación queda bloqueada.
- Respuesta sin la forma esperada: se trata como fallo de ejecución.
- Sin fuentes cargadas: no se envía `POST /reconciliations`.
- Doble clic durante la ejecución: solo una petición.
- Repetir la ejecución con el mismo contrato: los IDs de incidencia se conservan.
- Ninguna llamada a `/control/*`.

Los tests de servicio y estado usan Vitest en `node`. Los tests de componente dependen de la decisión D5 de HU-CONC-01.

## Riesgos y trade-offs

- Con D2, un fallo de refresco obliga al analista a reintentar, aunque la ejecución sí ocurrió. Es más seguro que mostrar datos viejos como actuales.
- Deshabilitar el botón durante la ejecución añade estado; sin tests de componente, solo se valida con revisión manual.
- Si el usuario cambia de wallet después de ejecutar, el resultado mostrado debe identificar el wallet al que pertenece.

## Rollback

- Revertir los commits o PRs de cada paso. Como el código es nuevo, no quedan datos persistidos ni cambios en `conciliacion-demo.html`.
