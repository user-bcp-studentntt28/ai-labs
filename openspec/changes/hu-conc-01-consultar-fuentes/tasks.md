# Tareas: HU-CONC-01 Consultar fuentes de conciliación

Issue: [#33](https://github.com/user-bcp-studentntt28/ai-labs/issues/33). Componente: `web/`. Día 1: trabajo local en la rama actual, sin push, PR, remotos ni tags.

Base para HU-CONC-02, 03 y 05 (servicio de fuentes, estado por fuente y base URL).

## 1. Preparación y caracterización

- [x] 1.1 Crear fixtures de las cuatro respuestas (`/payments`, `/settlements`, `/ledger`, `/reconciliations/incidents`) tomadas de [ENDPOINTS.md](../../../docs/ENDPOINTS.md), incluyendo `[]` como carga válida. (`web/src/app/testing/fixtures.ts` y `http-helpers.ts`.)
- [ ] 1.2 Caracterizar la demo (`conciliacion-demo.html`) contra el mock: carga correcta, wallet vacía y fallo de una fuente. Registrar lo observado como referencia; no se modifica la demo. (No ejecutado como tal; se verificó en su lugar que el servicio real carga las cuatro fuentes del mock con una prueba de solo lectura, ya eliminada.)
- [x] 1.3 Crear a mano `web/src/` (`main.ts`, `index.html`, `styles.css`, configuración de la aplicación con `provideHttpClient`) respetando `web/angular.json`; no ejecutar `ng new`. Hoy `npm run build` falla solo porque falta `src/`. Verificar con `npm run build` desde `web/`.
- [x] 1.4 Añadir `jsdom` como devDependency (`jsdom@26`). Desviación: `vitest.config.ts` usa `environment: 'jsdom'` global, porque TestBed también lo necesita en las pruebas de servicios.
- [x] 1.5 Añadir un archivo de setup de Vitest (`src/test-setup.ts`: `@angular/compiler` y `TestBed.initTestEnvironment`) y registrarlo en `vitest.config.ts`; plantillas inline. Desviación: sin `zone.js/testing`, porque TestBed de Angular 21 es zoneless por defecto.

## 2. Servicio de fuentes (TDD)

- [x] 2.1 Test: el servicio hace las cuatro consultas con las rutas del contrato y `walletId=wallet-demo` por defecto.
- [x] 2.2 Implementar el servicio HTTP con `HttpClient` y la base URL `https://bcp-wallet-mock.yefri.workers.dev/groups/3` en una sola constante.
- [x] 2.3 Test: `[]` se trata como carga válida sin error.
- [x] 2.4 Test: un fallo HTTP o de formato en una fuente deja esa fuente en error y el conjunto sin cargar.
- [x] 2.5 Implementar estado por fuente (`loading`, `loaded`, `error`) con fecha de última carga exitosa tomada en el cliente.
- [x] 2.6 Test: el conjunto queda cargado solo si las cuatro fuentes responden bien.
- [x] 2.7 Test: actualizar vuelve a consultar las cuatro fuentes y solo cambia la fecha de las exitosas.
- [x] 2.8 Implementar la actualización.

## 3. Bloqueo de conciliación y presentación

- [x] 3.1 Test: la acción de conciliación queda deshabilitada y lista las fuentes que faltan.
- [x] 3.2 Implementar la señal `canRunReconciliation` derivada del estado.
- [x] 3.3 Test: `formatCents(1500)` devuelve `S/ 15.00`; cubrir `0` y `1`.
- [x] 3.4 Implementar el formateador de céntimos PEN.

## 4. Componente de carga

- [x] 4.1 Test (jsdom): campo de wallet con valor por defecto, estado por fuente y mensaje de error por fuente.
- [x] 4.2 Implementar el componente de carga; llama al servicio, no a HTTP directo.

## 5. Validación

- [x] 5.1 Ejecutar `npm run test:coverage` desde `web/` y confirmar 85% o más en el código modificado. (98% global.)
- [x] 5.2 Ejecutar `python tools/lab.py test web` desde la raíz. (117 pruebas, build correcto.)
- [x] 5.3 Ejecutar `openspec validate hu-conc-01-consultar-fuentes` desde la raíz.
- [x] 5.4 Registrar la evidencia con ID `H-WEB-NN` en la sección general de evidencias de la raíz, sin borrar secciones de otros componentes. (`HALLAZGOS.md`, H-WEB-01 a H-WEB-12; `docs/TESTING.md`.)
