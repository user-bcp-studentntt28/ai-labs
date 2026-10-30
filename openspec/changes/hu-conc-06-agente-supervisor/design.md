# Design: HU-CONC-06 Agente supervisor

## Contexto técnico

- Componentes: `web/` (Angular, seguimiento local) y `agent-supervisor/` (nuevo, Python FastAPI + CrewAI).
- El seguimiento vive en `localStorage`; un servicio no puede observarlo. Por eso la web notifica al agente en cada transición del analista.
- El mock del grupo 3 es de solo lectura para el agente.

## Goals

- Leer los pagos automáticamente cuando el analista inicia la atención o envía a revisión.
- Dejar al supervisor un mensaje breve y verificable que reduzca el trabajo de reconstruir el caso.
- Usar Claude Sonnet 5.5 mediante CrewAI, sin secretos en el repositorio.

## Non-goals

- No autenticar, no persistir en servidor, no notificar a otros dispositivos.
- No decidir por el supervisor ni cambiar el estado local o del API.

## Contrato

`POST /briefings` (camelCase): `incidentId`, `paymentId`, `reason`, `walletId`, `event` (`STARTED` | `SUBMITTED`), `analystNote`, `workflowState`.
Respuesta: `incidentId`, `event`, `priority` (`HIGH` | `MEDIUM` | `LOW`), `headline`, `problem`, `evidence[]`, `recommendation`, `source` (`llm` | `fallback`), `model`, `generatedAt`.
Errores: 422 cuerpo inválido, 502 mock no disponible. `GET /health`.

## Componentes

- `agent-supervisor/app/`: `mock_client` (lecturas), `evidence` (selección de registros del pago), `crew` (Agent, Task y Crew), `fallback` (mensaje determinista), `service` (orquestación), `main` (rutas, CORS).
- `web/src/app/supervisor-agent/`: `briefing.ts` (tipos y validación), `briefing.service.ts` (HTTP, guardado local, estado de carga/error, descarta respuestas viejas), `supervisor-briefing.component.ts` (panel).
- `web/src/app/tracking/`: la regla de nota de "Enviar a revisión" y la llamada al servicio tras una transición válida.

## Decisiones técnicas

| ID | Decisión | Alternativas | Motivo |
|----|----------|--------------|--------|
| D1 | La web llama al agente por HTTP en cada transición del analista | Agente que sondea el mock; CLI aparte | El estado vive en el navegador; así el agente reacciona al cambio de estado |
| D2 | La web guarda el mensaje en `localStorage` (`conciliacion:briefing:<grupo>:<wallet>`) | Guardarlo en el agente | Consistente con el seguimiento local; el agente no necesita persistencia |
| D3 | La lectura de datos se hace en código y al LLM solo se le pasa la evidencia del pago | Dar al agente una herramienta de lectura libre | Menos tokens, resultado verificable y sin riesgo de lecturas innecesarias |
| D4 | Resumen determinista de respaldo si no hay clave o falla el modelo | Responder error | El flujo y la demo no dependen del modelo; la UI indica `Resumen automático sin IA` |
| D5 | SDK de GitHub Copilot como backend del modelo (LLM propio de CrewAI), modelo `claude-sonnet-5.5` configurable con `AGENT_MODEL`; token de `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN` o `gh auth token` | API directa de Anthropic; fijar el modelo en el código | El usuario trabaja con su cuenta de GitHub; sin claves nuevas ni secretos en el repo. Sesión sin herramientas ni permisos |
| D6 | Nota obligatoria en "Enviar a revisión" | Dejarla opcional | La respuesta del analista es la entrada principal para que el agente valide la consistencia |
| D7 | Cada solicitud nueva para una incidencia invalida las anteriores | Aceptar todas | Evita que una respuesta lenta pise el mensaje más reciente |

## Pruebas de caracterización necesarias

- Web: evento y cuerpo enviados por acción; el supervisor no llama al agente; agente caído, HTTP 502 y formato inesperado informan sin bloquear; respuesta vieja ignorada; documento guardado dañado o de otra versión se ignora; nota vacía en "Enviar a revisión" se rechaza sin llamar al agente.
- Agente: selección de evidencia por motivo; mensaje de respaldo; análisis de la salida del modelo (válida e inválida); orquestación con lector y LLM falsos; rutas, validación y CORS.
- No se llama al modelo real en pruebas.

## Riesgos y trade-offs

- El mensaje de IA puede ser incorrecto: se indica su origen y el supervisor decide.
- El agente es un proceso aparte: si no corre, la web lo informa y sigue.
- El mensaje queda en el navegador del analista: el supervisor lo ve solo en el mismo navegador (límite heredado de HU-CONC-04).
- Los datos del pago salen hacia el proveedor del modelo: solo se envían datos sintéticos de la demo.

## Rollback

- Quitar la llamada del componente de seguimiento y el módulo `supervisor-agent`; `agent-supervisor/` es independiente. La nota obligatoria se revierte con un cambio en `workflow.ts`.
