# Design: HU-CONC-04 Seguimiento local de incidencias (#34)

## Contexto técnico

- Proyecto objetivo: `web/` (Angular 21, Vitest `node`). Base común con HU-CONC-01 (ver [design de HU-CONC-01](../hu-conc-01-consultar-fuentes/design.md)).
- El seguimiento es solo local: se guarda en `localStorage` del navegador y no cambia el API.
- La transición de estado y las reglas de nota deben ser funciones puras, para probarlas sin DOM.
- Referencia de comportamiento: `conciliacion-demo.html` (`workflowStorageKey`, `persistWorkflow`, `handleWorkflowAction`). Esa demo usa nombres internos `NEW`, `IN_PROGRESS`, `PENDING_SUPERVISOR`, `RETURNED`, `CLOSED`, y exige nota en tres transiciones. No se toma como contrato: en Angular no hay datos previos que migrar.
- "Devolver" pasa el estado a `Devuelta`, según el spec (decisión aprobada). El proposal se alineó con el spec.

## Goals

- Registrar el seguimiento de cada incidencia en `localStorage`, por grupo y wallet.
- Aplicar las transiciones del spec por rol, con registro de rol, acción, fecha y nota en el historial.
- Mostrar el estado local y el estado `OPEN`/`RESOLVED` del API a la vez, indicando que "Cerrada localmente" no cambia el API.
- Informar cuando `localStorage` no está disponible y no confirmar la transición como guardada.

## Non-goals

- No persistir en servidor ni sincronizar entre usuarios o dispositivos.
- No implementar autenticación ni autorización: el selector de rol solo define el rol registrado.
- No cambiar el estado `OPEN`/`RESOLVED` del API.

## Contratos protegidos

- Lectura de incidencias del API: su estado se muestra, nunca se escribe.
- Las acciones locales no llaman a ningún endpoint de escritura.
- Forma del registro guardado (estado, nota, historial): versionada, para que cambios futuros no rompan datos existentes.

## Componentes afectados

Bajo `web/src/`, todos nuevos:

- Función pura de transición (por ejemplo `nextWorkflowState`): recibe estado actual, acción, rol y nota; devuelve el nuevo estado o un error. Contiene la regla de nota obligatoria.
- Servicio de almacenamiento: envuelve `localStorage` detrás de un token de inyección, para usar un fake en tests. Detecta si el almacenamiento no está disponible y si una escritura falla.
- Servicio de seguimiento: combina transición, historial y almacenamiento. Expone el estado por incidencia y el rol actual (señal).
- Componente de incidencia: muestra estado local, estado del API, historial y botones según rol. Llama al servicio, no al almacenamiento.

## Decisiones técnicas y alternativas

| ID | Decisión | Alternativas consideradas | Motivo |
|----|----------|---------------------------|--------|
| D1 | Clave de almacenamiento con prefijo propio, grupo y wallet (`conciliacion:workflow:<grupo>:<wallet>`) | (a) Reutilizar la clave de la demo, que incluye origen y ruta | El origen cambia entre `ng serve` y otros despliegues, y la clave de la demo no incluye grupo. |
| D2 | Usar los nombres de estado del spec como valores internos (`Sin atender`, `En atención`, `En revisión`, `Devuelta`, `Cerrada localmente`) | (b) Nombres internos de la demo con etiquetas traducidas | En Angular no hay datos heredados que migrar, así que no hay costo de compatibilidad. |
| D3 | "Enviar a revisión" (respuesta del analista), "Aprobar cierre local" y "Devolver" exigen nota no vacía; "Iniciar atención" no | (c) Dejar "Enviar a revisión" con nota opcional (decisión inicial, revertida en HU-CONC-06) | Sigue el issue ("devolver con observaciones") y el spec. La demo exige tres; es un cambio de comportamiento documentado. |

| D4 | Si `localStorage` no está disponible o la escritura falla, la transición no se confirma y el estado no cambia | (d) Permitir la acción solo en memoria | Evita mostrar como guardado algo que se perderá al recargar. |
| D5 | Un registro corrupto se descarta solo para esa incidencia, con aviso | (e) Deshabilitar todo el seguimiento, como la demo | Un dato dañado no debe bloquear las demás incidencias. |

**Aprobado (gate de arquitectura):** D3, D4 y D5.
- **Destino de "Devolver": aprobado, `Devuelta`**. Salida de `Devuelta`: "Iniciar atención" la regresa a `En atención` (criterio de demo, añadido al spec).
- **Observaciones al devolver:** resuelto con criterio de demo: obligatorias, igual que "Aprobar cierre local".
- **Grupo:** resuelto. El grupo es el identificador de la URL base (`/groups/3` en el demo). La clave de almacenamiento lo incluye, sin fuente adicional.
- D3 y D5 cambian el comportamiento actual de la demo; esos cambios quedan documentados y aprobados.

## Estrategia incremental

1. Caracterizar las reglas del spec: cada transición válida, cada transición inválida y la regla de nota, con la función pura.
2. Implementar la función pura de transición y sus tests.
3. Implementar el servicio de almacenamiento con fake, y tests de disponibilidad y fallo de escritura.
4. Implementar el servicio de seguimiento, con historial y rol.
5. Implementar el componente de incidencia y el selector de rol.
6. Verificar con `ng build` y `npm test` desde `web/`.

## Pruebas de caracterización necesarias

- Transiciones válidas por rol: "Iniciar atención" desde `Sin atender`; "Enviar a revisión" desde `En atención`; "Aprobar cierre local" desde `En revisión` solo para Supervisor; "Devolver" solo para Supervisor.
- Transiciones inválidas se rechazan y el estado no cambia.
- "Aprobar cierre local" sin nota, o con solo espacios, se rechaza.
- "Enviar a revisión" y "Devolver" aceptan nota vacía, según D3.
- Cada transición agrega una entrada al historial con rol, acción, fecha y nota si corresponde.
- Tras recargar (nueva instancia del servicio con el mismo fake), el estado e historial se recuperan con la misma clave.
- `localStorage` no disponible: la transición se rechaza y se informa.
- Escritura que falla: el estado vuelve al valor anterior y no se confirma.
- Cambiar de wallet carga solo el seguimiento de ese wallet.
- "Cerrada localmente" con API `OPEN`: se muestran ambos estados y el aviso de que el API no cambió.
- Ninguna llamada HTTP de escritura.

Las pruebas de función pura, servicio y almacenamiento usan Vitest `node` con fake de `Storage`. Las de componente dependen de D5 en HU-CONC-01.

## Riesgos y trade-offs

- Cambiar el destino de "Devolver" o la regla de nota modifica lo que el analista ve; deben cerrarse antes de implementar.
- Un fake de `Storage` no reproduce todos los comportamientos del navegador, como cuota llena. La cuota se prueba manualmente.
- El seguimiento queda en el navegador: se pierde al limpiar datos del sitio y no es auditable desde el API.
- Descartar registros corruptos (D5) puede ocultar una pérdida de datos; el aviso debe ser visible.

## Rollback

- Revertir los commits o PRs de cada paso. Los datos ya guardados en `localStorage` quedan huérfanos, pero no afectan al API ni a otras historias.
- Si D3 o D5 se revierten, basta con revertir ese commit, porque están aislados en la función de transición y en el servicio de almacenamiento.

