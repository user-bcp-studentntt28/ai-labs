## ADDED Requirements

### Requirement: Transiciones locales de atención

El sistema SHALL permitir iniciar la atención, enviar a revisión, aprobar el cierre local o devolver con observaciones una incidencia, sin modificar su estado en el API.

#### Scenario: Iniciar atención

- **WHEN** el analista inicia la atención de una incidencia `Sin atender` o `Devuelta`
- **THEN** el estado local pasa a `En atención`

#### Scenario: Enviar a revisión

- **WHEN** el analista envía a revisión una incidencia `En atención`
- **THEN** el estado local pasa a `En revisión`
- **AND** la respuesta del analista (nota) es obligatoria

#### Scenario: Aprobar cierre local

- **WHEN** el supervisor aprueba el cierre de una incidencia `En revisión`
- **THEN** el estado local pasa a `Cerrada localmente`

#### Scenario: Devolver con observaciones

- **WHEN** el supervisor devuelve una incidencia con observaciones
- **THEN** el estado local pasa a `Devuelta`
- **AND** la transición queda registrada en el historial

### Requirement: Notas requeridas

El sistema SHALL NOT aceptar una nota vacía en las transiciones "Enviar a revisión" (respuesta del analista), "Aprobar cierre local" y "Devolver", y SHALL registrar la nota en el historial cuando se ingrese.

#### Scenario: Nota vacía al aprobar el cierre

- **WHEN** el supervisor intenta aprobar el cierre local sin nota
- **THEN** el sistema rechaza la transición y mantiene el estado anterior

#### Scenario: Enviar a revisión sin respuesta

- **WHEN** el analista intenta enviar a revisión sin escribir su respuesta
- **THEN** el sistema rechaza la transición y mantiene el estado `En atención`

#### Scenario: Devolver sin observaciones

- **WHEN** el supervisor intenta devolver una incidencia sin observaciones
- **THEN** el sistema rechaza la transición y mantiene el estado anterior

### Requirement: Historial por transición

El sistema SHALL registrar para cada transición el rol, la acción, la fecha y la nota cuando corresponda.

#### Scenario: Registro de transición

- **WHEN** se completa una transición
- **THEN** el historial registra rol, acción, fecha y nota si corresponde

### Requirement: Persistencia local acotada

El sistema SHALL conservar el estado y el historial en `localStorage`, limitados al navegador, grupo y wallet seleccionados, y SHALL NOT sincronizarlos entre usuarios o dispositivos.

#### Scenario: Persistencia por grupo y wallet

- **WHEN** el analista vuelve a abrir la misma incidencia en el mismo navegador
- **THEN** el sistema muestra el estado y el historial guardados

#### Scenario: Almacenamiento no disponible

- **WHEN** `localStorage` no está disponible
- **THEN** el sistema informa que el almacenamiento no está disponible
- **AND** no confirma la transición como guardada

### Requirement: Selector de rol de demostración

El sistema SHALL ofrecer un selector Analista/Supervisor que solo define el rol registrado en el historial, sin autenticar ni autorizar.

#### Scenario: Cambio de rol

- **WHEN** el usuario cambia el selector a Supervisor
- **THEN** las transiciones siguientes registran el rol Supervisor
- **AND** el sistema no solicita credenciales

### Requirement: Separación del estado del API

El sistema SHALL mostrar el estado local y el estado `OPEN` o `RESOLVED` del API a la vez, y SHALL indicar que `Cerrada localmente` no cambia el estado del API.

#### Scenario: Cierre local no cambia el API

- **WHEN** una incidencia queda `Cerrada localmente` mientras el API la reporta `OPEN`
- **THEN** el sistema muestra ambos estados
- **AND** indica que el estado del API no cambió
