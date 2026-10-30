## ADDED Requirements

### Requirement: Configuración de escenarios sobre un pago existente

El sistema SHALL permitir seleccionar un pago existente y un escenario permitido (`AMOUNT`, `MISSING`, `DUPLICATE`, `ORPHAN` o `CLEAR`) y enviarlo a `POST /control/settlements`, conforme a [ENDPOINTS.md](../../../../../docs/ENDPOINTS.md).

#### Scenario: Configurar monto distinto

- **WHEN** el usuario selecciona un pago, el modo `AMOUNT` y un `amountCents` válido
- **THEN** el sistema envía `POST /control/settlements` con esos valores

#### Scenario: Configurar faltante o duplicado

- **WHEN** el usuario selecciona un pago y el modo `MISSING` o `DUPLICATE`
- **THEN** el sistema envía la alteración sin `amountCents`

#### Scenario: Reemplazo de alteración previa

- **WHEN** el usuario configura una alteración para un pago que ya la tiene
- **THEN** la alteración anterior queda reemplazada

### Requirement: Escenario huérfano

El sistema SHALL permitir el modo `ORPHAN` con un identificador nuevo y un `amountCents` positivo.

#### Scenario: Crear huérfano válido

- **WHEN** el usuario configura `ORPHAN` con un ID nuevo y `amountCents` mayor que cero
- **THEN** el sistema envía la alteración con ese ID y ese monto

#### Scenario: ID ya existente en el proveedor

- **WHEN** el API responde `409 PROVIDER_ALREADY_EXISTS`
- **THEN** el sistema muestra ese error
- **AND** no lo presenta como éxito

### Requirement: Limpieza de alteración

El sistema SHALL permitir `CLEAR` aunque el pago no tenga alteración.

#### Scenario: Limpiar alteración existente

- **WHEN** el usuario selecciona `CLEAR` para un pago con alteración
- **THEN** la alteración se elimina

#### Scenario: Limpiar sin alteración

- **WHEN** el usuario selecciona `CLEAR` para un pago sin alteración
- **THEN** el sistema informa el resultado del API sin tratarlo como error

### Requirement: Validación de importes

El sistema SHALL aceptar `amountCents` solo entre 1 y 49999 en la interfaz, es decir, importes menores a S/ 500,00. El contrato del API acepta hasta 100000000, y el servidor sigue validando su propio rango.

#### Scenario: Monto fuera de rango

- **WHEN** el usuario ingresa un `amountCents` menor que 1 o mayor o igual que 50000
- **THEN** el sistema no envía la solicitud


### Requirement: Errores del contrato visibles

El sistema SHALL mostrar los errores `400 INVALID_MODE`, `404` para un pago inexistente y `409 PROVIDER_ALREADY_EXISTS`.

#### Scenario: Modo inválido

- **WHEN** el API responde `400 INVALID_MODE`
- **THEN** el sistema muestra el error

#### Scenario: Pago inexistente

- **WHEN** el API responde `404` para el `paymentId`
- **THEN** el sistema muestra que el pago no existe

### Requirement: Alcance del control

El sistema SHALL informar que el control modifica únicamente el reporte simulado del proveedor y que el analista debe volver a conciliar para ver el resultado.

#### Scenario: Mensaje tras configurar

- **WHEN** una alteración se configura correctamente
- **THEN** el sistema indica que solo cambió el reporte simulado del proveedor
- **AND** indica que debe volver a conciliar

#### Scenario: Sin cambios en proveedor, wallet o ledger

- **WHEN** se aplica cualquier escenario
- **THEN** el sistema no modifica proveedor, wallet ni ledger
