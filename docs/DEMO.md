# Demostración: conciliación de operaciones

Guía para ejecutar la demo, los datos sintéticos que contiene el mock, qué es real y qué es simulado, las
herramientas usadas y un guion de 6 minutos.

## Ejecutar

```bash
cd web
npm install        # solo la primera vez
npm start          # http://localhost:4200
```

### Agente supervisor (opcional)

En otra terminal, para que el supervisor reciba un mensaje del problema cuando el analista cambia de estado:

```powershell
cd agent-supervisor
.\.venv\Scripts\python -m uvicorn app.main:app --port 8100
# Usa tu sesión de GitHub (gh auth login) o COPILOT_GITHUB_TOKEN; sin token el mensaje es un resumen automático sin IA
```

La instalación y las variables están en [../agent-supervisor/README.md](../agent-supervisor/README.md). Con la
sesión de GitHub, el agente usa `claude-sonnet-5.5` mediante el SDK de GitHub Copilot (`AGENT_MODEL`). Sin el agente, la web sigue funcionando y avisa que no
hubo mensaje.

Desde la raíz: `python tools/lab.py test web` ejecuta pruebas, cobertura y build (ver [TESTING.md](TESTING.md)).
La web consume el mock `https://bcp-wallet-mock.yefri.workers.dev/groups/3`; necesita conexión a Internet.
`docker compose` no sirve en esta rama (H-WEB-11 en [../HALLAZGOS.md](../HALLAZGOS.md)).

## Datos sintéticos en el grupo 3

Se crearon con la API (ninguno es un dato real) sobre `wallet-demo`, la única wallet con fondos. Los pagos
anteriores de otras pruebas (21 pagos y 4 incidencias) ya existían.

| Tipo | Pago | Importe (céntimos) | Cómo se creó | Resultado esperado |
|---|---|---|---|---|
| Bueno | `pay_6714a947eb30467c` | 1200 | `POST /payments` + `/resolve` | `SUCCEEDED`, sin incidencia |
| Bueno | `pay_26ff86ed50944d72` | 2200 | ídem | ídem |
| Bueno | `pay_db2a4b1f8e9b4e00` | 3200 | ídem | ídem |
| Diferencia | `pay_b9fb70e4602a41c9` | 1500 | + `AMOUNT` 1600 | `AMOUNT_MISMATCH` |
| Diferencia | `pay_b31dcfd743c74299` | 2000 | + `AMOUNT` 1000 | `AMOUNT_MISMATCH` |
| Diferencia | `pay_de3d1536928b4b04` | 1800 | + `MISSING` | `MISSING_PROVIDER` |
| Diferencia | `pay_3a44d1c6243c4c80` | 900 | + `DUPLICATE` | `DUPLICATE_PROVIDER` |
| Diferencia | `pay_web_orphan_20261030_1501` | 1234 | `ORPHAN` (solo en el proveedor) | `MISSING_WALLET` |
| Otro | `pay_14cadeb954084d0d` | 700 | escenario `REJECTED` + `/resolve` | `REJECTED`, sin incidencia |
| Otro | `pay_5e402790ab0e4184` | 600 | escenario `PENDING` | `PENDING` (sin resolver) |
| Otro | `pay_2df8db1952fd465a` | 650 | escenario `DELAYED_APPROVAL` | `PENDING` (sin resolver) |

Tras ejecutar `POST /reconciliations`: `DIFFERENCES` con 9 incidencias `OPEN` (cinco de estos datos y cuatro
anteriores). `wallet-demo` quedó con 31 pagos, balance 76300 y 1250 reservados por los dos pendientes. La
wallet `wallet_cc099a49c2ce4148` (creada con `POST /kyc/verifications`) está `ACTIVE` con saldo 0 y no admite
pagos (H-WEB-07).

### Reproducir un pago con diferencia

```powershell
$b = 'https://bcp-wallet-mock.yefri.workers.dev/groups/3'
$h = @{ 'Content-Type' = 'application/json'; 'Idempotency-Key' = 'demo-<clave-unica>' }
$body = '{"walletId":"wallet-demo","recipient":"contact-demo","amountCents":1500,"currency":"PEN","scenario":"APPROVED"}'
$p = Invoke-RestMethod -Method Post -Uri "$b/payments" -Headers $h -Body $body
Invoke-RestMethod -Method Post -Uri "$b/payments/$($p.id)/resolve" -ContentType 'application/json' -Body '{}'
Invoke-RestMethod -Method Post -Uri "$b/control/settlements" -ContentType 'application/json' `
  -Body ('{"paymentId":"' + $p.id + '","mode":"AMOUNT","amountCents":1600}')
```

La clave `Idempotency-Key` debe ser distinta en cada pago. Estas llamadas modifican el grupo 3, que es
compartido (H-WEB-10). `POST /control/reset` restablece el grupo y borra todos los datos; no usarlo sin acuerdo.

## Real y simulado

| Real | Simulado |
|---|---|
| Código Angular de `web/`, specs OpenSpec, pruebas | El API del grupo 3 (`bcp-wallet-mock.yefri.workers.dev`) |
| Llamadas HTTP de la web al mock | Proveedor de pagos, KYC y wallets |
| Seguimiento en `localStorage` del navegador | Roles Analista/Supervisor: no hay autenticación |
| Contrato [ENDPOINTS.md](ENDPOINTS.md) | Datos: todos ficticios |

## Herramientas y agentes

| Herramienta | Uso | Por qué |
|---|---|---|
| GitHub Issues (#30 a #34), consultados con el MCP `github-official` | Fuente del alcance | Un change OpenSpec por Issue |
| OpenSpec (`openspec`, esquema `spec-driven`) y la skill `openspec-explore` | `proposal.md`, specs, `design.md` y `tasks.md` por change | Alcance verificable antes de programar |
| Agente de Copilot en VS Code, con las reglas de `AGENTS.md` | Diseño, código y pruebas | Cambios pequeños, con trazabilidad |
| CrewAI + SDK de GitHub Copilot, Claude Sonnet 5.5 (`agent-supervisor/`) | Mensaje al supervisor sobre el problema de cada incidencia | Menos fatiga: el supervisor lee un resumen en lugar de reconstruir el caso |
| Vitest + TestBed + `jsdom` | Pruebas | Regresión rápida y sin red |
| `python tools/lab.py test web`, `ng build` | Validación | Mismo comando que usa el laboratorio |

El repositorio define además los agentes Architect, Developer, Discovery, OpenSpec y PM-PO en
`.github/agents/` y skills en `.github/skills/` y `.agents/skills/`. Una revisión de IA no sustituye la revisión
humana del PR.

## Guion de 6 minutos

| Tiempo | Qué mostrar |
|---|---|
| 0:00 a 0:45 | El problema: las operaciones pueden diferir entre wallet, proveedor y ledger. Los cinco Issues (#30 a #34). |
| 0:45 a 1:45 | El método: Issue → OpenSpec (proposal, specs, design, tasks) → pruebas primero. Abrir un `tasks.md` marcado. |
| 1:45 a 4:30 | La demo en http://localhost:4200: 1) "Cargar fuentes" de `wallet-demo`; 2) "Ejecutar conciliación" (`DIFFERENCES`, 9); 3) abrir un `AMOUNT_MISMATCH` y su detalle (wallet, proveedor, ledger); 4) seguimiento: Analista inicia la atención (el agente lee los pagos y deja el mensaje), escribe su respuesta (obligatoria) y envía a revisión; el Supervisor lee el mensaje del agente, aprueba con nota y se ve que el API sigue `OPEN`; 5) un escenario del proveedor (por ejemplo `MISSING`) y volver a conciliar. |
| 4:30 a 5:15 | Decisiones: seguimiento solo local; lista acotada a la wallet; importes menores a S/ 500,00; fallos de ejecución y de refresco separados. |
| 5:15 a 6:00 | Valor y límites: 122 pruebas y 98 % de cobertura; qué es mock; siguientes pasos (crear wallets y pagos desde la web, ensayo en navegador). |

Antes de la demo: ejecutar `npm start`, abrir la página y comprobar que "Cargar fuentes" responde. Si otra
persona modificó el grupo 3, los conteos pueden diferir de esta guía.
