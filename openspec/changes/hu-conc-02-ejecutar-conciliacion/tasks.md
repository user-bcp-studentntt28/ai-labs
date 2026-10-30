# Tareas: HU-CONC-02 Ejecutar conciliación

Issue: [#31](https://github.com/user-bcp-studentntt28/ai-labs/issues/31). Componente: `web/`. Día 1: trabajo local, sin push, PR, remotos ni tags.

Dependencia: HU-CONC-01 (servicio de fuentes, estado por fuente y canRunReconciliation).

## 1. Caracterización

- [ ] 1.1 Crear fixtures de `POST /reconciliations` para `MATCHED` (`differences: []`) y `DIFFERENCES` con incidencias `OPEN`, tomadas de [ENDPOINTS.md](../../../docs/ENDPOINTS.md).
- [ ] 1.2 Caracterizar en la demo (`conciliacion-demo.html`) el refresco posterior y el toast ante fallo, como referencia de comportamiento actual.

## 2. Servicio de ejecución (TDD)

- [ ] 2.1 Test: el servicio envía `POST /reconciliations` sin cuerpo.
- [ ] 2.2 Implementar `ReconciliationExecutionService`, único lugar que llama al endpoint.
- [ ] 2.3 Test: una respuesta sin la forma esperada (`status` fuera de `MATCHED`/`DIFFERENCES` o `differences` no arreglo) produce error y no refresca.
- [ ] 2.4 Implementar la validación de forma de la respuesta (D5 aprobado).

## 3. Guard y estado de ejecución

- [ ] 3.1 Test: sin fuentes cargadas no se envía ningún POST.
- [ ] 3.2 Implementar el bloqueo usando `canRunReconciliation` de HU-CONC-01.
- [ ] 3.3 Test: estados `idle`, `running`, `succeeded`, `failed` y conteo de diferencias.
- [ ] 3.4 Implementar el estado de ejecución, separado del estado de fuentes.

## 4. Actualización posterior y fallos separados

- [ ] 4.1 Test: POST exitoso vuelve a consultar fuentes e incidencias; el resultado se conserva.
- [ ] 4.2 Test: POST exitoso con refresco fallido deja resultado `succeeded` con `refreshFailed`, bloquea la conciliación y muestra "Actualizar" (D2 aprobado).
- [ ] 4.3 Implementar el refresco y el estado `refreshed` / `refreshFailed`.
- [ ] 4.4 Test: POST fallido informa que la conciliación no se ejecutó y no refresca.
- [ ] 4.5 Test: repetir la ejecución reemplaza la lista de incidencias y conserva los IDs; no duplica.
- [ ] 4.6 Implementar el reemplazo de la lista y el mensaje de cada resultado.

## 5. Componente de ejecución

- [ ] 5.1 Test (jsdom): botón deshabilitado sin fuentes, resultado `MATCHED` con cero diferencias y `DIFFERENCES` con su cantidad, y mensajes separados de ejecución y actualización.
- [ ] 5.2 Implementar el componente; no llama HTTP directo.

## 6. Validación

- [ ] 6.1 Ejecutar `npm run test:coverage` desde `web/` y confirmar 85% o más en el código modificado.
- [ ] 6.2 Ejecutar `python tools/lab.py test web` desde la raíz.
- [ ] 6.3 Ejecutar `openspec validate hu-conc-02-ejecutar-conciliacion` desde la raíz.
- [ ] 6.4 Registrar la evidencia con ID `H-WEB-NN` en la sección general de evidencias de la raíz.
