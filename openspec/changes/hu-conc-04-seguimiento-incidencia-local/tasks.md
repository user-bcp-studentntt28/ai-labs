# Tareas: HU-CONC-04 Seguimiento local de incidencias

Issue: [#34](https://github.com/user-bcp-studentntt28/ai-labs/issues/34). Componente: `web/`. Día 1: trabajo local, sin push, PR, remotos ni tags.

Dependencias: HU-CONC-03 (detalle donde aparecen las acciones) y HU-CONC-01 (identificador de grupo desde la base URL).

## 1. Transiciones puras (TDD)

- [x] 1.1 Test: transiciones válidas por rol: "Iniciar atención" desde `Sin atender` o `Devuelta`; "Enviar a revisión" desde `En atención`; "Aprobar cierre local" y "Devolver" desde `En revisión`, solo Supervisor.
- [x] 1.2 Test: transiciones inválidas se rechazan y el estado no cambia.
- [x] 1.3 Implementar `applyTransition` (`workflow.ts`) con los nombres de estado del spec como valores internos.
- [x] 1.4 Test: "Aprobar cierre local" y "Devolver" rechazan nota vacía o solo espacios; "Enviar a revisión" también la exige (respuesta del analista, ajustado en HU-CONC-06).
- [x] 1.5 Implementar la regla de nota obligatoria en la función pura.

## 2. Almacenamiento (TDD)

- [x] 2.1 Test con fake de `Storage`: `localStorage` no disponible produce error y no confirma la transición.
- [x] 2.2 Test: si la escritura falla, el estado vuelve al valor anterior.
- [x] 2.3 Implementar el servicio de almacenamiento detrás de un token de inyección, con clave `conciliacion:workflow:<grupo>:<wallet>` y versión de esquema.
- [x] 2.4 Test: un registro corrupto se descarta solo para esa incidencia y muestra aviso (D5 según diseño).
- [x] 2.5 Implementar el descarte de registros corruptos.

## 3. Servicio de seguimiento

- [x] 3.1 Test: cada transición agrega una entrada al historial con rol, acción, fecha y nota si corresponde.
- [x] 3.2 Implementar el servicio de seguimiento sobre transición y almacenamiento.
- [x] 3.3 Test: al recargar (nueva instancia con el mismo fake) se recuperan estado e historial con la misma clave.
- [x] 3.4 Test: cambiar de wallet carga solo el seguimiento de ese wallet.
- [x] 3.5 Test: el selector Analista/Supervisor solo cambia el rol registrado; no hay credenciales.
- [x] 3.6 Implementar el rol como señal y el cambio de wallet.

## 4. Componente

- [x] 4.1 Test (jsdom): botones según rol y estado; campo de nota; estado local y estado del API visibles a la vez.
- [x] 4.2 Test (jsdom): "Cerrada localmente" con API `OPEN` muestra el aviso de que el API no cambió.
- [x] 4.3 Implementar el componente; llama al servicio, no al almacenamiento.

## 5. Validación

- [x] 5.1 Test: ninguna transición produce una petición HTTP de escritura (`HttpTestingController`).
- [x] 5.2 Ejecutar `npm run test:coverage` desde `web/` y confirmar 85% o más en el código modificado.
- [x] 5.3 Ejecutar `python tools/lab.py test web` desde la raíz.
- [x] 5.4 Ejecutar `openspec validate hu-conc-04-seguimiento-incidencia-local` desde la raíz.
- [x] 5.5 Registrar la evidencia con ID `H-WEB-NN` en la sección general de evidencias de la raíz. (`docs/TESTING.md` y `HALLAZGOS.md`.)
