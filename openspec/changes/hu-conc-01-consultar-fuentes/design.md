# Design: HU-CONC-01 Consultar fuentes de conciliación (#33)

## Contexto técnico

- Proyecto objetivo: `web/`, aplicación Angular 21 (`@angular/*` 21.2.19, TypeScript 5.9.3, zone.js). Esta historia debe implementarse en Angular, no en HTML estático.
- Configuración de referencia en `web/`:
  - `angular.json`: `sourceRoot` `src`, `browser` `src/main.ts`, `index` `src/index.html`, `styles` `src/styles.css`, `tsConfig` `tsconfig.app.json`.
  - `package.json`: scripts `start` (`ng serve`), `build` (`ng build`), `test` (`vitest run`), `test:coverage`.
  - `vitest.config.ts`: `environment: 'node'`, `include: ['src/**/*.spec.ts']`, cobertura v8.
- Estado actual: `web/src/` **no existe**. Hay configuración, `node_modules` y `public/`, pero no código fuente. El scaffold de la aplicación es un prerrequisito del change.
- Referencia funcional: `conciliacion-demo.html` (raíz). No se modifica; solo muestra el comportamiento previo, por ejemplo `loadSources` con `Promise.all`, error único y marca de tiempo global.
- Contrato: `docs/ENDPOINTS.md`. El servidor `http://127.0.0.1:8787` del OpenAPI es solo un placeholder: no hay mock local. La demo usa el mock remoto `https://bcp-wallet-mock.yefri.workers.dev/groups/3`, verificado: responde 200 en las cuatro lecturas y permite CORS. Lecturas `GET /payments?walletId=`, `GET /settlements`, `GET /ledger` y `GET /reconciliations/incidents`.
- `compose.yaml` referencia `./api` y `./auth`, que no existen en este árbol. El mock está fuera del repositorio.
- Instrucciones de `web` en AI Labs: conservar `POST /auth/login` y `GET /api/tasks`. Este change no los toca, pero no deben romperse si existen más adelante.

## Goals

- Cargar las cuatro fuentes del wallet indicado desde Angular, mostrando el estado de carga de cada una.
- Mostrar la fecha y hora de la última carga exitosa de cada fuente.
- Bloquear la acción de conciliación hasta que las cuatro fuentes estén cargadas, e indicar cuáles faltan.
- Si una fuente falla, mostrar su error y no presentar el conjunto como cargado ni mostrar datos parciales.
- Interpretar importes como céntimos PEN y presentarlos como `S/ 15.00`.

## Non-goals

- No cambiar endpoints, parámetros ni formatos de respuesta.
- No implementar `POST /reconciliations` (HU-CONC-02), búsqueda ni filtros (HU-CONC-03), ni seguimiento local (HU-CONC-04).
- No implementar filtros diarios ni por canal: las fuentes no los exponen.
- No modificar `conciliacion-demo.html` ni el mock.
- No rediseñar la aplicación: solo se crea la base mínima necesaria para esta historia.

## Contratos protegidos

- `GET /payments?walletId=` con `wallet-demo` como predeterminado. Un `[]` es carga válida.
- `GET /settlements`, `GET /ledger` y `GET /reconciliations/incidents`, según `docs/ENDPOINTS.md`.
- Cada respuesta debe ser un arreglo JSON; de lo contrario se trata como error de formato.
- Importes enteros en céntimos. La conversión a PEN ocurre solo en presentación.
- Base URL por defecto `https://bcp-wallet-mock.yefri.workers.dev/groups/3`, definida en un único lugar.
- Instrucciones de `web` (`POST /auth/login`, `GET /api/tasks`): no se modifican.

## Componentes afectados

Todos son nuevos, bajo `web/src/` (la ruta exacta se confirma en el scaffold):

- Servicio HTTP de fuentes (por ejemplo `ReconciliationSourcesService`): única capa que llama a los cuatro endpoints y valida formato. Usa `HttpClient` de `@angular/common/http`.
- Modelo de estado de fuentes: estado por fuente (`idle`, `loading`, `loaded`, `error`), marca de tiempo por fuente y bandera de conjunto cargado.
- Componente de consulta de fuentes: solo presentación y acciones; no llama HTTP directamente.
- Constantes con nombre: base URL, nombres de endpoints y clave de wallet predeterminada (`wallet-demo`).
- Formateador de importes: convierte céntimos a `S/ x.xx`.
- Configuración de Angular (`main.ts`, `index.html`, `styles.css`, `app.config`), ya referenciada por `angular.json`.

## Decisiones técnicas y alternativas

| ID | Decisión | Alternativas consideradas | Motivo |
|----|----------|---------------------------|--------|
| D1 | Consultar las cuatro fuentes con observables independientes que actualizan el estado por fuente. El conjunto solo queda `cargado` si las cuatro terminan bien | (a) `forkJoin` todo-o-nada con un solo error, como en la demo HTML | Cumple el spec: estado y fecha por fuente, sin datos parciales. `forkJoin` no daría estado por fuente sin más lógica. Esto revisa la D1 anterior. |
| D2 | Usar `HttpClient` de Angular | (b) `axios`, que ya está en `web/package.json` | `HttpClient` es el estándar de Angular, integra interceptores y pruebas. Evita usar dos clientes HTTP. |
| D3 | Ocultar los datos de todas las fuentes mientras el conjunto no esté completo | (c) Mostrar las fuentes que sí cargaron | El spec prohíbe presentar carga parcial como completa. Se muestran los errores por fuente y se bloquea la conciliación. |
| D4 | Marca de tiempo por fuente, tomada de la respuesta exitosa en el cliente | (d) Una sola marca global | El spec pide fecha por fuente. El contrato no entrega fecha, así que la marca es del cliente. Esto debe quedar explícito en la UI. |
| D5 | Tests de servicio y de lógica de estado en Vitest con `environment: 'node'`, sin dependencias nuevas | (e) Tests de componente con TestBed y DOM | No requieren dependencias nuevas. Los tests de componente necesitan `jsdom` o `happy-dom`, que serían nuevas dependencias. |

**Aprobado:** D1 y D4 (estado por fuente y marca por fuente; el conjunto se carga solo si las cuatro fuentes responden).

**Decidido:**
- Test de componente: `jsdom` aprobado como devDependency.
- Base URL: `https://bcp-wallet-mock.yefri.workers.dev/groups/3` (mock remoto de la demo) en una sola constante de configuración, con llamada directa. CORS verificado, así que no se necesita proxy de `ng serve`. Las rutas del contrato se añaden a esa base. No se usa `http://127.0.0.1:8787`, que es solo el placeholder del OpenAPI.
- Scaffold de `web/src/`: creado a mano (`src/main.ts`, `src/index.html`, `src/styles.css`, configuración de la aplicación), respetando `angular.json`, que ya existe y usa `@angular-devkit/build-angular:application`. No se ejecuta `ng new` para no sobrescribir la configuración.
- Pruebas de componente: además de `jsdom`, requieren un archivo de setup (`zone.js/testing`, `TestBed.initTestEnvironment`) y plantillas inline, porque Vitest no compila `templateUrl`. Se verifica con una prueba de humo antes de escribir las demás.
- Grupo (#33): el grupo es el identificador de la URL base (`/groups/3`). La pantalla muestra las incidencias que el contrato devuelve para el último proceso de conciliación del grupo y wallet; no se agrega filtro.

**Resuelto:** "incidencias del grupo" significa las incidencias que devuelve el contrato para el último proceso de conciliación del grupo (identificado en la URL base) y el wallet. Se mantiene ese comportamiento, sin filtro adicional.


## Estrategia incremental

1. Scaffold mínimo de `web/src/` con Angular CLI, usando la configuración existente de `angular.json`, sin tocar `package.json` salvo que se apruebe una dependencia.
2. Crear el modelo de estado y el formateador de importes, con sus tests unitarios (Vitest, node).
3. Crear el servicio HTTP con los cuatro endpoints y la validación de formato, con tests usando un mock de `HttpClient` o `HttpTestingController`.
4. Crear el componente de consulta, que solo consume el servicio y muestra estado, fechas y bloqueo.
5. Verificar con `ng build` y `npm test` desde `web/`.

Cada paso debe ser un commit o PR independiente para revertirlo por separado.

## Pruebas de caracterización necesarias

Como el código no existe todavía, estas pruebas son de comportamiento esperado y se escriben antes de la implementación del paso correspondiente:

- Carga exitosa: las cuatro fuentes quedan `loaded`, con fecha por fuente y el conjunto cargado.
- Falla de una fuente (HTTP 500 o error de red): esa fuente queda en `error`, el conjunto no queda cargado y no se muestran datos de las demás.
- Respuesta válida pero no arreglo: se trata como error de formato de esa fuente.
- `GET /payments` con `[]`: carga válida, sin error.
- Wallet vacío: no se hace petición y se muestra validación; el predeterminado es `wallet-demo`.
- Acción de conciliación deshabilitada mientras falte una fuente, y habilitada con las cuatro cargadas.
- `amountCents` = `1500` se presenta como `S/ 15.00`.
- Actualizar vuelve a consultar las cuatro fuentes y actualiza fechas solo de las exitosas.

Los tests de servicio, estado y formateador usan Vitest con `environment: 'node'` y no requieren dependencias nuevas. Los tests de componente requieren aprobar D5.

## Riesgos y trade-offs

- Mostrar ocultando datos cuando una fuente falla puede parecer restrictivo, pero es lo que el spec pide.
- Fecha por fuente del cliente no es fecha del servidor; puede diferir si la respuesta se cachea.
- Sin tests de componente, la vista solo se valida con `ng build` y revisión manual, salvo que se apruebe D5.
- Crear `web/src/` desde cero es trabajo de scaffold que puede romper `vitest` si `include` no coincide con la ruta de los specs; mitigar con los tests del paso 2.
- Los endpoints del mock están fuera del repositorio: los tests de integración dependen de que el mock esté levantado.

## Rollback

- Revertir los commits o PRs de cada paso. Como todo el código es nuevo, revertir deja `web/` como estaba, sin afectar `conciliacion-demo.html`.
- Si se agrega `jsdom` o `happy-dom` (D5), revertir también `package.json` y `package-lock.json`.

