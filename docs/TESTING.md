# Pruebas de `web/`

Componente Angular de conciliación de operaciones (Issues #30 a #34). Resultados obtenidos en esta rama
(`day5/reto`) con Node 26.9.0, npm 11.19.1 y Python 3.13.15.

## Comandos

Desde la raíz:

```bash
python tools/lab.py test web
```

Ejecuta, dentro de `web/`, `npm test`, `npm run test:coverage` y `npm run build`. También puedes correrlos
por separado desde `web/`: `npm test`, `npm run test:coverage`, `npm run build`. Para una sola carpeta:
`npx vitest run src/app/operations`.

## Resultado

| Control | Resultado |
|---|---|
| Archivos de prueba | 15 de 15 pasan |
| Pruebas | 122 de 122 pasan |
| `npm run build` | Correcto; bundle inicial de 246,12 kB (limite de aviso 500 kB) |
| `openspec validate` de los cinco changes | Válido |

## Cobertura

Método: `@vitest/coverage-v8`, sobre `src/app/**/*.ts` sin los `*.spec.ts`. Es cobertura de todo el código de
`web/src/app`, que es código nuevo de esta rama, por lo que equivale a la cobertura del código modificado.
Fuente: `web/coverage/coverage-summary.json` (la carpeta está ignorada por Git).

| Métrica | Cubierto / total | Porcentaje |
|---|---|---|
| Sentencias | 907 / 925 | 98,05 % |
| Ramas | 321 / 341 | 94,13 % |
| Funciones | 89 / 92 | 96,73 % |
| Líneas | 907 / 925 | 98,05 % |

La meta del laboratorio es 85 %. Sin cubrir: `app.config.ts` y `models.ts` (0 %, solo configuración y tipos),
`main.ts` (no está en `src/app`; lo cubre el build) y ramas de error poco frecuentes en `api-errors.ts`,
`labels.ts` y `workflow-storage.service.ts`. No se cambió ningún umbral.

## Casos por historia

Cada caso nombra el escenario del spec que cubre.

| Historia | Archivo | Pruebas | Casos válidos, borde y error |
|---|---|---|---|
| #33 Fuentes | `sources/sources.service.spec.ts` | 10 | Cuatro lecturas con `walletId` por defecto; wallet indicada; `[]` válido; una fuente falla (sin datos parciales); respuesta que no es lista; error de red (CORS); bloqueo sin cargar; actualización con fecha solo de las exitosas; segunda carga ignorada. |
| | `sources/sources-panel.component.spec.ts` | 4 | Wallet por defecto; estado y fecha por fuente; error por fuente; wallet escrita. |
| | `core/money.spec.ts` | 2 | `1500` → `S/ 15.00`; `0` y `1`. |
| #31 Ejecución | `execution/execution.service.spec.ts` | 8 | POST sin cuerpo; sin fuentes no envía; `MATCHED` y `DIFFERENCES`; forma inválida; POST falla; ejecución exitosa con refresco fallido; repetir conserva IDs; sin otras escrituras. |
| | `execution/execution-panel.component.spec.ts` | 5 | Botón deshabilitado y explicación; métricas; resultado con cantidad; fallos separados; "no se ejecutó". |
| #32 Revisión | `operations/operations.view-model.spec.ts` | 18 | Agrupación por referencia; fuente faltante; `BALANCE_MISMATCH` a nivel de wallet; "Sin ejecutar" y "Conciliada"; búsqueda por referencia, motivo e ID de incidencia; filtros por estado y motivo; alcance por wallet. |
| | `operations/operations-list.component.spec.ts` | 10 | Lista y sección "Saldo de wallet"; aviso e interruptor del grupo; wallet sin pagos; filtros; detalle con estados y motivos; recargar y nueva conciliación desde el detalle. |
| #34 Seguimiento | `tracking/workflow.spec.ts` | 12 | Cuatro transiciones válidas; rechazos por estado, rol y nota vacía o solo espacios; historial; acciones por rol. |
| | `tracking/tracking.service.spec.ts` | 10 | Persistencia y recarga; clave `conciliacion:workflow:<grupo>:<wallet>`; separación por wallet; rol sin credenciales; almacenamiento no disponible; escritura fallida; registro y documento dañados; sin HTTP. |
| | `tracking/workflow-storage.service.spec.ts` | 4 | Sin storage; storage que lanza excepciones; guardar y recuperar; versión o forma inválida. |
| | `tracking/incident-tracking.component.spec.ts` | 6 | Estado local y del API a la vez; recorrido del analista; aprobar sin nota; cierre local con aviso de API sin cambios; devolver y reiniciar; sin almacenamiento. |
| #30 Escenarios | `provider-control/validation.spec.ts` | 15 | `amountCents` 1 y 49999 válidos; `0`, `-5`, `50000`, `100000000`, `12.5`, `abc` y vacío rechazados; `ORPHAN` con ID nuevo. |
| | `provider-control/provider-control.service.spec.ts` | 10 | Cuerpo por modo; `400 INVALID_MODE`, `404`, `409 PROVIDER_ALREADY_EXISTS`, red; `CLEAR` neutral; respuesta sin `configured`; solo `/control/settlements`. |
| | `provider-control/scenario-panel.component.spec.ts` | 5 | Lista de pagos; monto fuera de rango no se envía; mensaje de alcance; `MISSING` sin monto; `ORPHAN` y 409. |
| Integración | `app.component.spec.ts` | 3 | Paneles del shell sin consulta inicial; selector de rol; flujo cargar → conciliar → detalle. |

## Mocks y datos

- **HTTP:** `HttpTestingController`. Cada prueba verifica URL, método, cuerpo y parámetros, y entrega la
  respuesta (200, 404, 409, 500 o error de red). Ninguna prueba sale a la red.
- **`localStorage`:** un `Storage` falso en memoria detrás del token `WORKFLOW_STORAGE`, con variantes que
  fallan al escribir, no están disponibles o lanzan excepciones.
- **Datos:** fixtures manuales en `web/src/app/testing/fixtures.ts` y ayudas en `testing/http-helpers.ts`.
  Sus formas coinciden con las respuestas reales del mock (campos `amount`, `wallet_id`, `payment_id`).
- **Entorno:** `jsdom` global en `web/vitest.config.ts`; el setup (`src/test-setup.ts`) importa
  `@angular/compiler` e inicializa TestBed, que es *zoneless* por defecto en Angular 21.

## Verificación contra el mock real

No forma parte de la suite. Se hizo aparte y de forma manual:

- Lectura de las cuatro fuentes con el `SourcesService` real: 21 pagos, 22 settlements, 44 asientos y 4
  incidencias en ese momento (prueba temporal, eliminada).
- Escrituras con PowerShell sobre `wallet-demo`: ver [docs/DEMO.md](DEMO.md).

## Limitaciones

- No hay pruebas end-to-end ni la interfaz se vio en un navegador (H-WEB-09 en [HALLAZGOS.md](../HALLAZGOS.md)).
- Vitest no comprueba tipos; los errores de tipos los detecta `npm run build` porque `web/tsconfig.json`
  tiene `strict: false` (H-WEB-06).
- La cobertura es de líneas y ramas; no mide la calidad de las aserciones.
