## ADDED Requirements

### Requirement: Ejecución de la conciliación tras cargar fuentes

El sistema SHALL ejecutar `POST /reconciliations` sin cuerpo solo después de que las fuentes estén cargadas, conforme a [ENDPOINTS.md](../../../../../docs/ENDPOINTS.md).

#### Scenario: Ejecución con fuentes cargadas

- **WHEN** el analista ejecuta la conciliación con las fuentes cargadas
- **THEN** el sistema envía `POST /reconciliations`
- **AND** muestra el resultado de la ejecución

#### Scenario: Ejecución sin fuentes cargadas

- **WHEN** las fuentes no están cargadas
- **THEN** el sistema no envía `POST /reconciliations`

### Requirement: Presentación del resultado

El sistema SHALL mostrar el estado `MATCHED` o `DIFFERENCES` y la cantidad de elementos de `differences` devueltos.

#### Scenario: Resultado sin diferencias

- **WHEN** el API responde `MATCHED` con `differences: []`
- **THEN** el sistema muestra `MATCHED`
- **AND** muestra cero diferencias

#### Scenario: Resultado con diferencias

- **WHEN** el API responde `DIFFERENCES` con incidencias `OPEN`
- **THEN** el sistema muestra `DIFFERENCES`
- **AND** muestra la cantidad de diferencias devueltas

### Requirement: Actualización posterior a una ejecución exitosa

El sistema SHALL actualizar fuentes e incidencias después de una ejecución exitosa.

#### Scenario: Actualización tras ejecución exitosa

- **WHEN** `POST /reconciliations` responde con éxito
- **THEN** el sistema vuelve a consultar fuentes e incidencias

### Requirement: Diferenciación de fallos

El sistema SHALL distinguir un fallo de la ejecución de un fallo de la actualización posterior.

#### Scenario: Falla la ejecución

- **WHEN** `POST /reconciliations` falla
- **THEN** el sistema informa que la conciliación no se ejecutó
- **AND** no actualiza fuentes ni incidencias como resultado de esa ejecución

#### Scenario: Ejecución exitosa con actualización fallida

- **WHEN** `POST /reconciliations` responde con éxito
- **AND** la actualización posterior de fuentes o incidencias falla
- **THEN** el sistema informa que la conciliación se ejecutó
- **AND** informa por separado que la actualización falló

### Requirement: Idempotencia de incidencias

El sistema SHALL NOT duplicar incidencias al repetir la ejecución; las incidencias conservan sus IDs.

#### Scenario: Repetir la ejecución

- **WHEN** el analista ejecuta la conciliación dos veces sin cambios en los datos
- **THEN** las incidencias mostradas conservan los mismos IDs

### Requirement: Sin corrección de datos

El sistema SHALL NOT mover fondos, corregir saldos ni modificar registros de fuentes como efecto de la conciliación.

#### Scenario: La conciliación no corrige nada

- **WHEN** la conciliación devuelve diferencias
- **THEN** el sistema no modifica fuentes, saldos ni registros
