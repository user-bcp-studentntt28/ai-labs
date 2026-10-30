# Arquitectura de `web/`

Aplicación Angular 21 (componentes *standalone*, signals, `HttpClient`, sin router) que implementa el flujo de
conciliación de operaciones de los Issues #30 a #34. No tiene backend propio: consume el mock del grupo 3
definido en [ENDPOINTS.md](ENDPOINTS.md).

## Vista general

```
+------------------------------------------------------------------+
| Navegador (http://localhost:4200, ng serve)                      |
|                                                                  |
|  AppComponent  (shell: barra lateral, rol de demo, avisos)       |
|    |                                                             |
|    +-- SourcesPanel -----> SourcesService ------+                |
|    +-- ExecutionPanel ---> ExecutionService ----+---> HttpClient ---> mock grupo 3
|    +-- OperationsList ---> (view-model puro)    |                |    (GET/POST)
|    |     +-- WalletBalance                      |                |
|    |     +-- OperationDetail                    |                |
|    |           +-- IncidentTracking --> TrackingService          |
|    |                                      |                      |
|    |                                      v                      |
|    |                            WorkflowStorageService           |
|    |                                      |                      |
|    |                                      v                      |
|    |                               localStorage (solo local)     |
|    +-- ScenarioPanel ----> ProviderControlService --> HttpClient  |
+------------------------------------------------------------------+
```

## Capas y carpetas (`web/src/app/`)

| Carpeta | Responsabilidad | Contenido |
|---|---|---|
| `core/` | Constantes y utilidades compartidas | `config.ts` (URL base, rutas, límites, clave de almacenamiento), `models.ts`, `labels.ts`, `money.ts`, `api-errors.ts` |
| `sources/` | #33: las cuatro lecturas | `SourcesService` (estado por fuente), `SourcesPanelComponent` |
| `execution/` | #31: conciliación | `ExecutionService`, `ExecutionPanelComponent` (con métricas) |
| `operations/` | #32: revisión | `operations.view-model.ts` (funciones puras), lista, detalle y saldo de wallet |
| `tracking/` | #34: seguimiento local | `workflow.ts` (transiciones puras), `WorkflowStorageService`, `TrackingService`, `IncidentTrackingComponent` |
| `provider-control/` | #30: escenarios del proveedor | `validation.ts` (pura), `ProviderControlService`, `ScenarioPanelComponent` |
| `testing/` | Fixtures y ayudas de prueba | `fixtures.ts`, `http-helpers.ts` |

Reglas de código aplicadas (de `AGENTS.md`, sección web): los componentes no llaman a HTTP ni a
`localStorage`; lo hacen los servicios. La lógica de decisión está en funciones puras sin DOM. Las URL, los
límites y la clave de almacenamiento están en un solo lugar (`core/config.ts`).

## Flujo de datos

1. **Cargar** (`SourcesService.load`): consulta en paralelo `GET /payments?walletId=`, `/settlements`,
   `/ledger` y `/reconciliations/incidents`. Guarda estado y fecha por fuente. Los datos se confirman solo si
   las cuatro responden; si una falla, ninguna queda visible y `canRunReconciliation` es falso.
2. **Conciliar** (`ExecutionService.run`): `POST /reconciliations` sin cuerpo, solo con fuentes cargadas. Valida
   la forma de la respuesta (`MATCHED` o `DIFFERENCES` y `differences` como lista), conserva el resultado y
   recarga las fuentes. Un fallo del refresco se informa por separado y bloquea hasta volver a cargar.
3. **Revisar** (`operations.view-model.ts`): `scopeToWallet` deja lo que pertenece a la wallet consultada,
   `buildOperationRows` agrupa por referencia (`Payment.id` = `ProviderPayment.id` = `LedgerEntry.operation`) y
   `filterRows` aplica búsqueda y filtros. `BALANCE_MISMATCH` va a la sección "Saldo de wallet".
4. **Seguimiento** (`TrackingService`): `applyTransition` valida estado, rol y nota; si es válida, se guarda en
   `localStorage` (`conciliacion:workflow:<grupo>:<wallet>`). Si el almacenamiento falla, la transición no se
   confirma. Nunca se envía al API.
5. **Escenarios** (`ProviderControlService`): `validateControlInput` (importes 1 a 49999 céntimos) y
   `POST /control/settlements`; tras un éxito recarga las fuentes y avisa que hay que volver a conciliar.

## Decisiones principales

| Decisión | Motivo | Dónde |
|---|---|---|
| Estado con signals en servicios `providedIn: 'root'` | Sin librería de estado; los paneles solo leen señales | `openspec/changes/*/design.md` |
| Carga atómica de las cuatro fuentes | Spec #33: sin datos parciales | `sources.service.ts:88` |
| El seguimiento humano es solo local | Spec #34: no cambia el estado `OPEN`/`RESOLVED` del API | `tracking.service.ts` |
| "Devolver" pasa a `Devuelta` y exige nota | Spec #34, aprobada por el usuario | `workflow.ts:58` |
| Importes de UI entre 1 y 49999 céntimos | Interpretación de "menores a 500" como S/ 500,00; el contrato acepta hasta 100000000 | `core/config.ts`, `provider-control/validation.ts` |
| Lista acotada a la wallet consultada | Solo `/payments` depende de la wallet (H-WEB-03) | `operations.view-model.ts:64` |
| `jsdom` global y TestBed *zoneless* | TestBed necesita DOM también en las pruebas de servicios | `web/vitest.config.ts`, `src/test-setup.ts` |

El detalle de alternativas está en `openspec/changes/hu-conc-0N-*/design.md`.

## Contratos protegidos

- `GET /payments?walletId=`, `/settlements`, `/ledger`, `/reconciliations/incidents` (solo lectura).
- `POST /reconciliations` sin cuerpo; idempotente en el contrato.
- `POST /control/settlements` con `{paymentId, mode, amountCents?}` y respuesta `{configured}`.
- Importes enteros en céntimos de PEN; la conversión a `S/` ocurre solo al mostrar.
- No se usan `POST /control/reset`, `POST /payments` ni `POST /kyc/verifications` desde la aplicación.

## Real y simulado

| Real | Simulado |
|---|---|
| Código Angular, specs OpenSpec, pruebas | El API: `https://bcp-wallet-mock.yefri.workers.dev/groups/3` |
| Llamadas HTTP al mock | Proveedor, KYC y wallets |
| `localStorage` del navegador | Roles Analista/Supervisor (sin autenticación ni permisos) |

## Trazabilidad

| Issue | Change OpenSpec | Spec | Código |
|---|---|---|---|
| #33 | `hu-conc-01-consultar-fuentes` | `conciliacion-consulta-fuentes` | `sources/`, `core/money.ts` |
| #31 | `hu-conc-02-ejecutar-conciliacion` | `conciliacion-ejecucion` | `execution/` |
| #32 | `hu-conc-03-revisar-operaciones` | `conciliacion-revision-operaciones` | `operations/` |
| #34 | `hu-conc-04-seguimiento-incidencia-local` | `conciliacion-seguimiento-local` | `tracking/` |
| #30 | `hu-conc-05-escenarios-proveedor` | `conciliacion-escenarios-proveedor` | `provider-control/` |

Cada change tiene `proposal.md`, `specs/`, `design.md` y `tasks.md` en `openspec/changes/`. La demo
`conciliacion-demo.html` (raíz) se conserva como referencia de comportamiento y no se modificó.

## Límites conocidos

- Sin verificación en navegador ni end-to-end (H-WEB-09 en [../HALLAZGOS.md](../HALLAZGOS.md)).
- El grupo 3 es compartido; las escrituras lo modifican para todos (H-WEB-10).
- `docker compose` no arranca el conjunto: referencia `./auth` y `./api`, que no existen (H-WEB-11).
