## ADDED Requirements

### Requirement: Agrupación de operaciones por referencia

El sistema SHALL agrupar pagos, settlements e incidencias por referencia de operación, usando `Payment.id` como referencia y comparándola con `ProviderPayment.id` y `LedgerEntry.operation`, conforme a [ENDPOINTS.md](../../../../../docs/ENDPOINTS.md).

#### Scenario: Operación con registros en todas las fuentes

- **WHEN** una referencia aparece en pagos, settlements y ledger
- **THEN** la lista muestra una sola operación con los datos de las tres fuentes

#### Scenario: Registro faltante en una fuente

- **WHEN** una referencia tiene pago pero no tiene settlement o asiento de ledger
- **THEN** la operación se marca indicando la fuente que falta

### Requirement: Incidencias de saldo a nivel de wallet

El sistema SHALL mostrar las incidencias `BALANCE_MISMATCH` en una sección "Saldo de wallet" dentro del panel de wallet, por encima de la lista de operaciones, sin asociarlas a un pago, porque su `payment_id` puede ser un ID de wallet.

#### Scenario: Incidencia de saldo

- **WHEN** una incidencia tiene motivo `BALANCE_MISMATCH`
- **THEN** el sistema la muestra a nivel de wallet
- **AND** no la asocia a una operación de pago

### Requirement: Búsqueda y filtros

El sistema SHALL permitir buscar por referencia, motivo o identificador de incidencia, y filtrar por estado o motivo.

#### Scenario: Búsqueda por identificador de incidencia

- **WHEN** el analista busca un identificador de incidencia
- **THEN** la lista muestra solo las operaciones asociadas a esa incidencia

#### Scenario: Filtro por motivo

- **WHEN** el analista filtra por un motivo del enum `Incident.reason`
- **THEN** la lista muestra solo las operaciones con incidencias de ese motivo

#### Scenario: Filtro por estado

- **WHEN** el analista filtra por estado `OPEN` o `RESOLVED`
- **THEN** la lista muestra solo las operaciones con incidencias en ese estado

### Requirement: Detalle de operación

El sistema SHALL mostrar en el detalle los estados y motivos informados por el API junto con los datos disponibles de wallet, proveedor y ledger.

#### Scenario: Detalle con estados del API

- **WHEN** el analista abre el detalle de una operación con incidencias
- **THEN** el detalle muestra los estados `OPEN` o `RESOLVED` y los motivos informados por el API
- **AND** muestra los datos de wallet, proveedor y ledger disponibles

### Requirement: Acciones desde el detalle

El sistema SHALL permitir volver a cargar las fuentes y ejecutar otra conciliación desde el detalle.

#### Scenario: Recarga desde el detalle

- **WHEN** el analista solicita recargar desde el detalle
- **THEN** el sistema vuelve a consultar las fuentes

#### Scenario: Nueva conciliación desde el detalle

- **WHEN** el analista solicita una nueva conciliación desde el detalle
- **THEN** el sistema ejecuta `POST /reconciliations`

### Requirement: Estados de presentación distintos del API

El sistema SHALL distinguir los estados de presentación "Conciliada" y "Sin ejecutar" de los estados `OPEN` y `RESOLVED` de las incidencias del API.

#### Scenario: Operación sin ejecución

- **WHEN** no existe una ejecución de conciliación en la sesión
- **THEN** la operación muestra el estado "Sin ejecutar"

#### Scenario: Operación conciliada

- **WHEN** existe una ejecución de conciliación y la operación no tiene incidencias `OPEN`
- **THEN** la operación muestra el estado "Conciliada"

#### Scenario: Estados separados

- **WHEN** una operación muestra "Conciliada" o "Sin ejecutar"
- **THEN** el sistema muestra por separado el estado de cada incidencia del API
