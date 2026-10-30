## ADDED Requirements

### Requirement: Carga de las cuatro fuentes de conciliación

El sistema SHALL consultar las cuatro fuentes de conciliación: `GET /payments?walletId=...`, `GET /settlements`, `GET /ledger` y `GET /reconciliations/incidents`, conforme a [ENDPOINTS.md](../../../../../docs/ENDPOINTS.md).

#### Scenario: Carga completa de fuentes

- **WHEN** el analista solicita cargar las fuentes para una wallet
- **THEN** el sistema muestra el estado de carga de cada una de las cuatro fuentes
- **AND** muestra la fecha y hora de la última carga exitosa de cada fuente

#### Scenario: Wallet predeterminada

- **WHEN** el analista no indica `walletId`
- **THEN** el sistema consulta los pagos de `wallet-demo`

#### Scenario: Wallet sin pagos

- **WHEN** la wallet consultada no tiene pagos
- **THEN** el sistema trata la respuesta `[]` como una carga válida
- **AND** no muestra un error

### Requirement: Bloqueo de la conciliación hasta cargar fuentes

El sistema SHALL impedir ejecutar la conciliación mientras las cuatro fuentes no estén cargadas.

#### Scenario: Conciliación bloqueada sin fuentes

- **WHEN** alguna fuente no está cargada
- **THEN** la acción de conciliación aparece deshabilitada
- **AND** el sistema indica qué fuentes faltan

#### Scenario: Conciliación habilitada con fuentes cargadas

- **WHEN** las cuatro fuentes están cargadas
- **THEN** la acción de conciliación queda habilitada

### Requirement: Errores de carga sin datos parciales

El sistema SHALL informar los errores de consulta o de formato de cada fuente y SHALL NOT presentar como completa una carga parcial.

#### Scenario: Falla una fuente

- **WHEN** una de las cuatro consultas falla
- **THEN** el sistema muestra el error de esa fuente
- **AND** el conjunto de fuentes no queda marcado como cargado

#### Scenario: Actualización de fuentes

- **WHEN** el analista solicita actualizar las fuentes
- **THEN** el sistema vuelve a consultar las cuatro fuentes
- **AND** actualiza las fechas de carga de las consultas exitosas

### Requirement: Importes en céntimos

El sistema SHALL interpretar los importes como enteros en céntimos de PEN.

#### Scenario: Presentación de importe

- **WHEN** una fuente devuelve `amountCents` igual a `1500`
- **THEN** el sistema muestra `S/ 15.00`
