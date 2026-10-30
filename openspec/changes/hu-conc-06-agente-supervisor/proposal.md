# Propuesta: Agente supervisor que prepara el mensaje de revisión

## Por qué

El supervisor revisa cada incidencia que el analista envía a revisión, y para decidir tiene que reconstruir el caso: abrir pagos, proveedor y ledger y entender qué falló. Con muchas incidencias eso produce fatiga y decisiones lentas. Un agente puede leer los pagos automáticamente cuando el analista cambia de estado y dejar un mensaje breve con el problema, la evidencia y qué decidir.

## Qué cambia

- Se agrega `agent-supervisor/`: un servicio Python (FastAPI + CrewAI) con un agente que usa Claude Sonnet 5.5 a través del SDK de GitHub Copilot. Lee pagos, proveedor, ledger e incidencias del mock y devuelve un mensaje para el supervisor.
- La web llama al agente cuando el analista **inicia la atención** y cuando **envía a revisión**, y guarda el mensaje por incidencia y wallet para mostrarlo al supervisor.
- **Respuesta del analista:** "Enviar a revisión" exige una nota (la respuesta con su diagnóstico). Antes era opcional (ajuste a HU-CONC-04).
- Si el agente no está disponible o no hay modelo configurado, el flujo no se bloquea: se informa, o el servicio devuelve un resumen automático sin IA.

## Alcance

- Dentro: componente `agent-supervisor/`, cliente y panel en `web/`, regla de nota en el flujo del analista, documentación.
- Fuera: autenticación, persistencia en servidor, notificaciones a otros dispositivos, cambios en el API del mock (solo lectura), cambiar el estado del API.

## Decisiones

- **Integración:** la web avisa al agente por HTTP (`POST /briefings`); el seguimiento sigue local en el navegador, por lo que el agente no lo lee, lo recibe.
- **Modelo:** `claude-sonnet-5.5` mediante el SDK de GitHub Copilot, configurable con `AGENT_MODEL`. La credencial es el token de GitHub del usuario (`COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN` o `gh auth token`), nunca guardado en el repositorio.
- **Reducción de fatiga:** mensaje de lectura rápida: prioridad, titular, problema en lenguaje de negocio, evidencia comparada y qué decidir; al enviar a revisión, el agente contrasta la respuesta del analista con los datos.
- **Resumen sin IA:** sin clave o ante un fallo del modelo, el servicio genera un mensaje determinista y lo marca como tal.

## Impacto

- HU-CONC-04: la nota de "Enviar a revisión" pasa de opcional a obligatoria (spec y pruebas actualizadas).
- Nuevo servicio que hay que arrancar aparte: `uvicorn app.main:app --port 8100` desde `agent-supervisor/`.
- Riesgo: el mensaje de IA puede equivocarse; el supervisor sigue decidiendo y la UI indica si fue generado con IA.
