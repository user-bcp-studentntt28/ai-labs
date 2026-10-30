# Historias de usuario del flujo de conciliación

## Fuente y alcance

Derivadas de `conciliacion-demo.html` y del contrato de `docs/ENDPOINTS.md`.
Complementan, pero no reemplazan, `operations-transaction-reconciliation.sp.md`.

El flujo cubre la consulta de fuentes, la ejecución de la conciliación, la revisión
de resultados, el seguimiento humano local de incidencias y la preparación de
escenarios en el mock. No define tareas técnicas.

## HU-CONC-01 — Consultar las fuentes

Como analista de operaciones,
quiero cargar y actualizar los datos de wallet, proveedor, ledger e incidencias,
para revisar la información disponible antes y después de una conciliación.

### Criterios de aceptación

1. La consulta obtiene pagos para el wallet seleccionado, settlements, asientos
   de ledger e incidencias del grupo.
2. La pantalla indica cuándo se cargaron las fuentes y permite actualizarlas.
3. Mientras las fuentes no estén cargadas, no se puede ejecutar la conciliación.
4. Si una consulta falla o su respuesta no tiene el formato esperado, se informa
   el error y no se presenta la carga parcial como si estuviera completa.
5. Los importes se interpretan como céntimos de PEN.

### Endpoints relacionados

`GET /payments?walletId=...`, `GET /settlements`, `GET /ledger`,
`GET /reconciliations/incidents`.

## HU-CONC-02 — Ejecutar la conciliación

Como analista de operaciones,
quiero ejecutar la comparación de las fuentes disponibles,
para identificar diferencias entre pagos, settlements, ledger y saldos.

### Criterios de aceptación

1. La acción ejecuta `POST /reconciliations` después de cargar las fuentes.
2. El resultado muestra el estado `MATCHED` o `DIFFERENCES` y la cantidad de
   diferencias devueltas.
3. Después de una ejecución exitosa se actualizan las fuentes y las incidencias.
4. Si falla la ejecución, se informa el error. Si la ejecución tuvo éxito pero
   falla la actualización posterior, ambas situaciones se distinguen.
5. La conciliación detecta diferencias; la pantalla no mueve fondos ni corrige
   registros o saldos.

### Endpoint relacionado

`POST /reconciliations`.

## HU-CONC-03 — Revisar operaciones e incidencias

Como analista de operaciones,
quiero buscar, filtrar y consultar el detalle de las operaciones,
para entender qué fuentes y diferencias corresponden a cada caso.

### Criterios de aceptación

1. La lista agrupa pagos, settlements e incidencias por referencia de operación,
   e identifica cuando falta un registro en alguna fuente.
2. Puedo buscar por referencia, motivo o identificador de incidencia y filtrar
   por estado o motivo.
3. La lista y el detalle muestran los estados y motivos informados por el API,
   además de los datos de wallet, proveedor y ledger disponibles.
4. El detalle permite volver a cargar las fuentes y ejecutar otra conciliación.
5. Los estados de presentación “Conciliada” y “Sin ejecutar” se distinguen de los
   estados de incidencia `OPEN` y `RESOLVED` del API.

### Endpoints relacionados

`GET /payments`, `GET /settlements`, `GET /ledger`,
`GET /reconciliations/incidents`.

## HU-CONC-04 — Dar seguimiento local a una incidencia

Como analista y supervisor de la demo,
quiero registrar notas y revisar el avance local de una incidencia,
para representar un flujo de atención sin confundirlo con su estado técnico.

### Criterios de aceptación

1. El flujo local permite iniciar la atención, enviar una nota del analista a
   revisión, aprobar el cierre local o devolver el caso con observaciones.
2. Las notas requeridas no pueden quedar vacías; cada transición registra rol,
   acción, fecha y nota cuando corresponda.
3. El estado y el historial local se conservan en este navegador para el grupo y
   wallet seleccionados.
4. Si el almacenamiento local no está disponible, se informa y no se confirma
   una transición como guardada.
5. El selector Analista/Supervisor es solo de demostración: no autentica ni
   autoriza personas.
6. “Cerrada localmente” no cambia el estado de incidencia del API; la pantalla
   deja visible la diferencia entre ambos estados.

### Persistencia

`localStorage`, limitada al navegador, grupo y wallet actuales. No se sincroniza
con otros usuarios o dispositivos.

## HU-CONC-05 — Preparar escenarios de prueba del proveedor

Como persona que prueba la demo,
quiero configurar diferencias en el settlement simulado,
para verificar cómo aparecen al volver a ejecutar la conciliación.

### Criterios de aceptación

1. Puedo seleccionar un pago existente y elegir un escenario permitido por el
   contrato: `AMOUNT`, `MISSING`, `DUPLICATE` o `CLEAR`.
2. También puedo usar `ORPHAN` con un identificador nuevo y un monto positivo
   expresado en céntimos.
3. La pantalla informa que el control modifica únicamente el reporte simulado
   del proveedor y que debo volver a conciliar para actualizar el resultado.
4. Estos controles son de prueba del mock; no representan una corrección real
   del proveedor, de la wallet ni del ledger.

### Endpoint relacionado

`POST /control/settlements`.

## Contratos y límites

- `GET /settlements` devuelve el reporte completo y no ofrece corte diario.
- Los registros del contrato no exponen fecha ni canal de proveedor; esta
  historia no promete filtros diarios ni por canal.
- El estado de atención humana local es independiente del estado de incidencia
  del API.
- Se preservan las fuentes y estados del API; no se inventan transiciones ni
  acciones de corrección fuera de los endpoints documentados.

## Fuera de alcance

Autenticación real, permisos operativos, flujo humano multiusuario o persistido
en servidor, corrección de fuentes, movimiento de dinero, conciliación diaria
con corte temporal, filtros por canal y funcionalidades de onboarding, pagos,
QR, soporte o reversos.

## Preguntas abiertas

- ¿Cuál es la fecha de corte y zona horaria requeridas para la conciliación
  diaria de la historia existente?
- ¿Qué identificador de canal debe usarse cuando el contrato no lo expone?
- ¿Cuál es la tasa máxima diaria de descalce aceptable para el lanzamiento?
- ¿El cierre humano debe seguir siendo local a la demo o será una necesidad
  multiusuario con contrato propio?