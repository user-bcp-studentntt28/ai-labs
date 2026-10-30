# Tareas: HU-CONC-01 Consultar fuentes de conciliación

Issue: [#33](https://github.com/user-bcp-studentntt28/ai-labs/issues/33). Componente: `web/`. Día 1: trabajo local en la rama actual, sin push, PR, remotos ni tags.

Base para HU-CONC-02, 03 y 05 (servicio de fuentes, estado por fuente y base URL).

## 1. Preparación y caracterización

- [ ] 1.1 Crear fixtures de las cuatro respuestas (`/payments`, `/settlements`, `/ledger`, `/reconciliations/incidents`) tomadas de [ENDPOINTS.md](../../../docs/ENDPOINTS.md), incluyendo `[]` como carga válida.
- [ ] 1.2 Caracterizar la demo (`conciliacion-demo.html`) contra el mock: carga correcta, wallet vacía y fallo de una fuente. Registrar lo observado como referencia; no se modifica la demo.
- [ ] 1.3 Crear `web/src/` con Angular CLI respetando `web/angular.json` (`src/main.ts`, `src/index.html`, `src/styles.css`). Verificar con `npm run build` desde `web/`.
- [ ] 1.4 Añadir `jsdom` como devDependency (aprobado) sin cambiar el entorno `node` por defecto de `vitest.config.ts`; activarlo por archivo de componente. Verificar con `npm test`.

## 2. Servicio de fuentes (TDD)

- [ ] 2.1 Test: el servicio hace las cuatro consultas con las rutas del contrato y `walletId=wallet-demo` por defecto.
- [ ] 2.2 Implementar el servicio HTTP con `HttpClient` y la base URL `http://127.0.0.1:8787` en una sola constante.
- [ ] 2.3 Test: `[]` se trata como carga válida sin error.
- [ ] 2.4 Test: un fallo HTTP o de formato en una fuente deja esa fuente en error y el conjunto sin cargar.
- [ ] 2.5 Implementar estado por fuente (`loading`, `loaded`, `error`) con fecha de última carga exitosa tomada en el cliente.
- [ ] 2.6 Test: el conjunto queda cargado solo si las cuatro fuentes responden bien.
- [ ] 2.7 Test: actualizar vuelve a consultar las cuatro fuentes y solo cambia la fecha de las exitosas.
- [ ] 2.8 Implementar la actualización.

## 3. Bloqueo de conciliación y presentación

- [ ] 3.1 Test: la acción de conciliación queda deshabilitada y lista las fuentes que faltan.
- [ ] 3.2 Implementar la señal `canRunReconciliation` derivada del estado.
- [ ] 3.3 Test: `formatCents(1500)` devuelve `S/ 15.00`; cubrir `0` y `1`.
- [ ] 3.4 Implementar el formateador de céntimos PEN.

## 4. Componente de carga

- [ ] 4.1 Test (jsdom): campo de wallet con valor por defecto, estado por fuente y mensaje de error por fuente.
- [ ] 4.2 Implementar el componente de carga; llama al servicio, no a HTTP directo.

## 5. Validación

- [ ] 5.1 Ejecutar `npm run test:coverage` desde `web/` y confirmar 85% o más en el código modificado.
- [ ] 5.2 Ejecutar `python tools/lab.py test web` desde la raíz.
- [ ] 5.3 Ejecutar `openspec validate hu-conc-01-consultar-fuentes` desde la raíz.
- [ ] 5.4 Registrar la evidencia con ID `H-WEB-NN` en la sección general de evidencias de la raíz, sin borrar secciones de otros componentes.
