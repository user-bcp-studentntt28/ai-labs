# agent-supervisor

Servicio (FastAPI + CrewAI) que prepara un **briefing corto para el supervisor** de conciliación y así reducir su fatiga de revisión: en lugar de abrir el incidente y reconstruir el caso, lee en menos de 30 segundos qué pasó, con qué evidencia y qué conviene revisar.

## Cómo encaja en el flujo

1. El **analista** cambia el estado de un incidente en la web: *iniciar atención* (`STARTED`) o *enviar a revisión* con su respuesta escrita (`SUBMITTED`).
2. La web llama a `POST /briefings` de este servicio.
3. El servicio **lee solo los datos** del API mock (pagos, liquidaciones del proveedor, ledger e incidentes), arma una evidencia compacta del pago y se la entrega a un agente CrewAI cuyo modelo (Claude Sonnet 5.5) se consume a través del **GitHub Copilot SDK**, con tu cuenta de GitHub.
4. Devuelve el briefing; **la web lo guarda y lo muestra al supervisor**.

El servicio solo hace lecturas (`GET`) al mock. No ejecuta ninguna escritura ni `POST /control/reset`.

## Contrato HTTP

### `GET /health`

```json
{"status": "ok"}
```

### `POST /briefings`

Request (camelCase):

```json
{
  "incidentId": "incident_75b41a8728884604",
  "paymentId": "pay_8cf1b1da147d4b0b",
  "reason": "AMOUNT_MISMATCH",
  "walletId": "wallet-demo",
  "event": "STARTED",
  "analystNote": null,
  "workflowState": "IN_PROGRESS"
}
```

- `event`: `STARTED` | `SUBMITTED`. `analystNote` y `workflowState` son opcionales (`null`).

Respuesta `200`:

```json
{
  "incidentId": "incident_75b41a8728884604",
  "event": "STARTED",
  "priority": "MEDIUM",
  "headline": "Monto distinto entre billetera y proveedor (S/ 6.74)",
  "problem": "El pago pay_8cf1b1da147d4b0b figura por S/ 3.25 en la billetera, pero el proveedor lo liquidó por S/ 9.99. La diferencia es de S/ 6.74.",
  "evidence": ["Billetera: S/ 3.25 (SUCCEEDED)", "Proveedor: S/ 9.99 (SUCCEEDED)", "Ledger: 2 asientos, neto S/ 0.00"],
  "recommendation": "Sin acción inmediata: cuando el analista responda, confirme cuál monto es el correcto y que se corrija el registro erróneo.",
  "source": "fallback",
  "model": null,
  "generatedAt": "2026-10-30T20:49:11.507532Z"
}
```

| Campo | Detalle |
|---|---|
| `priority` | `HIGH` \| `MEDIUM` \| `LOW` |
| `headline` | máximo 100 caracteres |
| `problem` | 2–3 oraciones en lenguaje de negocio; montos como `S/ 15.00` |
| `evidence` | máximo 4 viñetas (billetera / proveedor / ledger) |
| `recommendation` | una oración; en `SUBMITTED` considera la nota del analista |
| `source` | `llm` \| `fallback` |
| `model` | modelo usado (`null` en `fallback`) |
| `generatedAt` | ISO-8601 UTC |

Errores: `422` si el body es inválido; `502` con `{"detail": "..."}` si el mock no responde o devuelve un formato inutilizable.

CORS: orígenes de `ALLOWED_ORIGINS`, métodos `GET`/`POST`/`OPTIONS`, cabecera `Content-Type`.

## Variables de entorno

Se cargan del entorno o de un archivo `.env` opcional (copiar de `.env.example`; `.env` está ignorado por Git).

| Variable | Por defecto | Descripción |
|---|---|---|
| `MOCK_BASE_URL` | `https://bcp-wallet-mock.yefri.workers.dev/groups/3` | Base del API mock (solo lectura). |
| `AGENT_MODEL` | `claude-sonnet-5.5` | Id del modelo en GitHub Copilot (el que reporta el SDK: `claude-sonnet-5.5`, `claude-sonnet-5`, `claude-haiku-5.5`, …). Es el valor que se devuelve en `model`. |
| `COPILOT_GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_TOKEN` | *(vacías)* | Token de GitHub con acceso a Copilot. Se usa el primero definido, en ese orden. Opcionales: ver [Autenticación](#autenticación-con-github). |
| `ALLOWED_ORIGINS` | `http://localhost:4200` | Orígenes CORS, separados por comas. |
| `MOCK_TIMEOUT_SECONDS` | `10` | Timeout de lectura al mock. |
| `LLM_TIMEOUT_SECONDS` | `60` | Tiempo máximo por briefing con LLM (arranque del runtime de Copilot + respuesta). Al excederlo se responde con el fallback. |

La telemetría de CrewAI y la de Copilot se desactivan (`OTEL_SDK_DISABLED`, `CREWAI_DISABLE_TELEMETRY`, `COPILOT_GITHUB_TELEMETRY_DISABLED`).

## Autenticación con GitHub

El servicio usa el [GitHub Copilot SDK para Python](https://github.com/github/copilot-sdk) (`github-copilot-sdk`, import `copilot`), que lanza el runtime de Copilot CLI (el SDK lo descarga la primera vez) y habla con él por JSON-RPC. El token se busca **en cada llamada** en este orden:

1. `COPILOT_GITHUB_TOKEN`
2. `GH_TOKEN`
3. `GITHUB_TOKEN`
4. `gh auth token` (GitHub CLI), ejecutado como subproceso.

Camino recomendado, sin escribir nada en archivos:

```powershell
gh auth login          # una sola vez; requiere una cuenta con Copilot habilitado
gh auth status         # confirma la sesión activa
```

El token solo vive en memoria: no se guarda en archivos, no se registra en logs ni aparece en respuestas, y el SDK lo recibe únicamente para esa llamada. Un `GITHUB_TOKEN` de CI normalmente **no** tiene permiso de Copilot; usa un token de usuario (p. ej. el de `gh auth login`).

Cada briefing abre un cliente y una sesión de Copilot nuevos con el modelo configurado, sin herramientas (`available_tools=[]`), con todas las solicitudes de permiso rechazadas, sin instrucciones personalizadas del directorio y con un mensaje de sistema propio; el agente solo devuelve JSON. El modelo se consulta una vez por briefing (≈5–10 s con Sonnet 5.5). La temperatura no es configurable en el SDK de Copilot.

### Troubleshooting

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `source: "fallback"` siempre | No hay token (ni variables ni `gh`), cuenta sin Copilot, modelo no disponible, timeout o salida no JSON | Revisa el log del servicio (`El agente no produjo un briefing…` / `LLM no configurado…`); ejecuta `gh auth status`. |
| Log `Falló la llamada a Copilot: …` | Error del SDK o del runtime (auth 401/403, red, modelo inexistente) | El mensaje trae el tipo de error; verifica `AGENT_MODEL` contra el listado del SDK (`client.list_models()`). |
| Primera llamada lenta o falla por tiempo | El SDK descarga el runtime en el primer uso | Ejecuta una vez `python -m copilot download-runtime` o sube `LLM_TIMEOUT_SECONDS`. |
| `gh` no se encuentra | GitHub CLI no instalado o fuera del `PATH` | Instala `gh` o define `COPILOT_GITHUB_TOKEN` en el entorno del proceso. |
| 502 en `/briefings` | El API mock no responde | Revisa `MOCK_BASE_URL` y la conectividad. |

## Ejecutar

Requiere Python 3.13 (probado con 3.13.15, crewai 1.15.33 y github-copilot-sdk 1.0.28).

```powershell
cd agent-supervisor
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m copilot download-runtime   # opcional: precarga el runtime
.\.venv\Scripts\python -m uvicorn app.main:app --port 8100
```

### Prueba manual (smoke test)

Con el servidor en marcha, toma un id real de `GET <MOCK_BASE_URL>/reconciliations/incidents` y:

```powershell
curl.exe http://127.0.0.1:8100/health
curl.exe -X POST http://127.0.0.1:8100/briefings -H "Content-Type: application/json" `
  -d '{\"incidentId\":\"incident_75b41a8728884604\",\"paymentId\":\"pay_8cf1b1da147d4b0b\",\"reason\":\"AMOUNT_MISMATCH\",\"walletId\":\"wallet-demo\",\"event\":\"STARTED\"}'
```

Con sesión de GitHub activa la respuesta trae `"source": "llm"` y `"model": "claude-sonnet-5.5"`; sin credencial, `"source": "fallback"`.

## Pruebas

Sin red, sin token y sin LLM real (mock HTTP simulado, SDK de Copilot y LLM falsos):

```powershell
cd agent-supervisor
.\.venv\Scripts\python -m pytest --cov
```

## Comportamiento de fallback

Si no hay token de GitHub, o el SDK/modelo falla, excede el timeout o devuelve una salida que no es el JSON esperado, el servicio **no falla**: responde `200` con un briefing determinista construido en código con los mismos datos (`source: "fallback"`, `model: null`). La prioridad depende del motivo y de la diferencia de monto; en `SUBMITTED` la coherencia de la nota se estima por palabras clave del motivo (heurística, no un análisis semántico).

## Estructura

```
app/
  main.py             rutas FastAPI y CORS
  config.py           settings desde entorno y constantes
  schemas.py          contrato pydantic
  mock_client.py      lecturas httpx al mock
  evidence.py         selección de registros del pago y formato de dinero
  fallback.py         briefing determinista
  crew.py             agente/tarea/crew de CrewAI y parseo de su salida
  copilot_llm.py      LLM personalizado de CrewAI (BaseLLM) sobre el Copilot SDK
  copilot_session.py  cliente/sesión del Copilot SDK: sin herramientas, permisos denegados
  copilot_auth.py     resolución del token de GitHub
  service.py          orquestación
tests/
```

## Límites

- Sin persistencia: la web guarda el mensaje recibido; este servicio no almacena nada.
- Sin autenticación ni autorización propias (se asume uso interno en entorno de laboratorio); el servicio usa la identidad de GitHub de quien lo ejecuta, y las llamadas consumen su cuota de Copilot.
- Cada briefing inicia un proceso/sesión de Copilot nuevo (simple y aislado, pero con latencia de varios segundos); no hay caché ni cola.
- Datos sintéticos del mock; el LLM solo ve los registros del pago y conteos globales, nunca el listado completo.
- El briefing es una ayuda: no aprueba ni rechaza incidentes.
