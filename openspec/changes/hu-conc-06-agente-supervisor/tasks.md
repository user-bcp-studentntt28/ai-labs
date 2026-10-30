# Tareas: HU-CONC-06 Agente supervisor

Componentes: `agent-supervisor/` (nuevo) y `web/`. Sin Issue asociado. Sin push, PR, remotos ni tags.

Dependencias: HU-CONC-04 (flujo del analista y del supervisor) y HU-CONC-01 (wallet activa).

## 1. Flujo del analista (TDD)

- [x] 1.1 Test: "Enviar a revisión" rechaza nota vacía o de solo espacios; con respuesta, pasa a `En revisión`.
- [x] 1.2 Cambiar `noteRequired` de `submit` a `true` en `workflow.ts` y actualizar las pruebas de seguimiento y del componente.
- [x] 1.3 Actualizar la spec, el design y las tareas de HU-CONC-04 con la regla nueva.

## 2. Servicio `agent-supervisor/`

- [x] 2.1 Esquemas del contrato (`POST /briefings`, `GET /health`) con validación (422).
- [x] 2.2 Cliente de solo lectura del mock (pagos, proveedor, ledger, incidencias), tolerante a listas o envoltorios; 502 si falla.
- [x] 2.3 Selección de evidencia del pago por motivo y formato de importes (`S/ 15.00`).
- [x] 2.4 Resumen determinista de respaldo (prioridad, titular, problema, evidencia, recomendación).
- [x] 2.5 Agente CrewAI (1 Agent, 1 Task, sin delegación) con un LLM propio (`CopilotLLM`) sobre el SDK de GitHub Copilot y el modelo `claude-sonnet-5.5`, configurable con `AGENT_MODEL`; el token de GitHub se toma del entorno o de `gh auth token`, sin guardarse.
- [x] 2.6 Análisis defensivo de la salida del modelo; ante salida inválida, fallo o tiempo agotado, usar el respaldo.
- [x] 2.7 Orquestación fuera del event loop, rutas FastAPI y CORS (`ALLOWED_ORIGINS`).
- [x] 2.8 Pruebas sin red ni modelo real (122 pruebas, 99 % de cobertura) y README con variables, comandos y límites.
- [x] 2.9 Prueba manual contra el mock real en modo de respaldo, con origen `http://localhost:4200` (CORS correcto) y un incidente real.

## 3. Integración en `web/`

- [x] 3.1 Tipos, validación `isBriefing` y constantes (`AGENT_BASE_URL`, clave de almacenamiento) centralizadas en `core/config.ts`.
- [x] 3.2 `SupervisorBriefingService`: envía `STARTED` y `SUBMITTED`, ignora acciones del supervisor, guarda el mensaje por grupo y wallet, informa errores sin bloquear y descarta respuestas viejas.
- [x] 3.3 `SupervisorBriefingComponent`: estado de carga, error, prioridad, evidencia, recomendación y origen (IA o respaldo).
- [x] 3.4 Llamada al servicio desde `IncidentTrackingComponent` tras una transición válida.
- [x] 3.5 Pruebas del servicio (18) y del flujo en el componente (4 nuevas); 145 pruebas pasan, 98,35 % de cobertura; `ng build` correcto.

## 4. Documentación y validación

- [x] 4.1 Actualizar `docs/ARQUITECTURA.md` y `docs/TESTING.md`.
- [x] 4.2 `openspec validate --all`: los seis changes son válidos.
- [x] 4.3 Llamada real a Claude Sonnet 5.5 mediante el SDK de GitHub Copilot con el token de `gh`: `STARTED` y `SUBMITTED` devolvieron `source: "llm"` y `model: "claude-sonnet-5.5"` en unos 6 s.
- [ ] 4.4 Recorrido completo en el navegador (analista → agente → supervisor). (No ejecutado.)
