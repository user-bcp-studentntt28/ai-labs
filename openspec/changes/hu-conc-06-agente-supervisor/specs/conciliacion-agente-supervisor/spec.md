## ADDED Requirements

### Requirement: Mensaje del agente al cambiar de estado el analista

El sistema SHALL solicitar al agente supervisor un mensaje sobre la incidencia cuando el analista inicia la atención o la envía a revisión, y SHALL guardarlo por grupo, wallet e incidencia para mostrarlo al supervisor.

#### Scenario: Iniciar atención

- **WHEN** el analista inicia la atención de una incidencia
- **THEN** la web envía al agente la incidencia, el pago, el motivo, la wallet y el evento `STARTED`
- **AND** al recibir el mensaje lo muestra con prioridad, titular, problema, evidencia y recomendación

#### Scenario: Enviar a revisión con la respuesta del analista

- **WHEN** el analista envía a revisión con su respuesta
- **THEN** la web envía al agente el evento `SUBMITTED` con la respuesta del analista
- **AND** el mensaje nuevo reemplaza al anterior y el supervisor lo ve al abrir la incidencia

#### Scenario: Acciones del supervisor

- **WHEN** el supervisor aprueba o devuelve una incidencia
- **THEN** la web no llama al agente

### Requirement: Respuesta obligatoria del analista

El sistema SHALL NOT permitir enviar a revisión sin una nota no vacía, que es la respuesta del analista.

#### Scenario: Enviar a revisión sin respuesta

- **WHEN** el analista intenta enviar a revisión con la nota vacía o de solo espacios
- **THEN** el sistema rechaza la transición, mantiene `En atención` y no llama al agente

### Requirement: El agente lee los pagos automáticamente

El agente SHALL leer del mock los pagos, el reporte del proveedor, el ledger y las incidencias relacionados con el pago de la incidencia en cada solicitud, sin intervención del usuario, y SHALL NOT escribir en el mock.

#### Scenario: Lectura por solicitud

- **WHEN** el agente recibe `POST /briefings`
- **THEN** lee las fuentes del grupo y selecciona los registros del pago
- **AND** no llama a ningún endpoint de escritura

#### Scenario: Mock no disponible

- **WHEN** el mock no responde
- **THEN** el agente responde 502 y la web informa sin bloquear el flujo

### Requirement: Mensaje breve para reducir la fatiga del supervisor

El agente SHALL producir un mensaje de lectura rápida con prioridad, titular, problema en lenguaje de negocio, hasta cuatro líneas de evidencia y una recomendación de qué decidir, y en `SUBMITTED` SHALL indicar si la respuesta del analista es consistente con los datos.

#### Scenario: Mensaje con IA

- **WHEN** hay modelo configurado y responde con el formato esperado
- **THEN** el mensaje se marca como generado con IA e indica el modelo

#### Scenario: Resumen automático sin IA

- **WHEN** no hay token de GitHub o la respuesta del modelo no es válida
- **THEN** el agente devuelve un mensaje determinista construido con los mismos datos
- **AND** lo marca como resumen sin IA

### Requirement: El flujo no depende del agente

El sistema SHALL conservar la transición del analista aunque el agente no responda, SHALL informar el motivo y SHALL ignorar respuestas de solicitudes anteriores cuando exista una más reciente para la misma incidencia.

#### Scenario: Agente caído

- **WHEN** el agente no responde tras una transición válida
- **THEN** el estado local queda guardado
- **AND** la web muestra que no se pudo generar el mensaje

#### Scenario: Respuesta con formato inesperado

- **WHEN** el agente responde con un formato distinto del contrato o de otra incidencia
- **THEN** la web no guarda el mensaje y lo informa

### Requirement: Credenciales fuera del repositorio

El sistema SHALL obtener la credencial del modelo del token de GitHub del usuario (variables `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN` o `gh auth token`) y SHALL NOT incluirla en el código, en la web, en registros ni en el repositorio.

#### Scenario: Configuración del modelo

- **WHEN** se configura `AGENT_MODEL`
- **THEN** el agente usa ese modelo; por defecto usa `claude-sonnet-5.5` mediante el SDK de GitHub Copilot, con una sesión sin herramientas ni permisos
