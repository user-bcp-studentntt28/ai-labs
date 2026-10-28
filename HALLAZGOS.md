# Hallazgos

Discovery de `auth/` basado en lectura estática. H-AUTH-01, H-AUTH-02 y
H-AUTH-07 se actualizaron después de su implementación local y pruebas;
H-AUTH-03 a H-AUTH-06 siguen pendientes. No se realizó una revisión de
advisories.

## auth

| id | componente | hallazgo | tipo | explicacion | evidencia (archivo:linea) | severidad | estado |
|---|---|---|---|---|---|---|---|
| H-AUTH-01 | auth | Credenciales concatenadas en SQL | Vulnerabilidad | `username` y `password` se insertaban directamente en la sentencia, permitiendo alterar la consulta de autenticación. | `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:31`; `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:28,50-55` | alta | Resuelto — la búsqueda usa SQL fijo y enlaza el username con `PreparedStatement`; la contraseña se verifica fuera de SQL. |
| H-AUTH-02 | auth | Contraseñas almacenadas y comparadas en texto plano | Vulnerabilidad | El esquema guardaba contraseñas legibles; una exposición de la base podía revelar las credenciales. | `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:21-47,77-129`; `auth/src/main/java/com/bcp/workshop/auth/PasswordHasher.java:11-86` | alta | Resuelto — se almacenan hashes PBKDF2-HMAC-SHA256 con salt aleatorio y se migran filas legacy de forma idempotente. |
| H-AUTH-03 | auth | Token codificado en Base64 con secreto embebido, sin firma criptográfica | Vulnerabilidad | El contenido, incluido el secreto fijo, solo se codifica con Base64; el formato no autentica su integridad y la expiración incluida es un dato, no una verificación demostrada. | `auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:8,13-15`; `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:40-42` | alta | Pendiente |
| H-AUTH-04 | auth | Respuesta de error expone detalles de excepción | Vulnerabilidad | En errores internos, la respuesta HTTP 500 incluye el mensaje y la clase de excepción, lo que puede revelar información de implementación o persistencia al cliente. | `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:54-58` | media | Pendiente |
| H-AUTH-05 | auth | Secreto codificado en clase y CORS con origen permisivo | Vulnerabilidad | El secreto está fijado en código y CORS está habilitado con una expresión de origen que admite cualquier origen; esto deja la configuración sensible sin externalizar y permite solicitudes cross-origin desde sitios no restringidos por origen. | `auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:8`; `auth/src/main/resources/application.properties:4-7` | media | Aprobado |
| H-AUTH-06 | auth | Versiones de dependencias requieren revisión SCA | Sugerencia | El proyecto fija Quarkus `3.27.4` y Commons Text `1.9`. La presencia de esas versiones está comprobada, pero sin consultar advisories no se confirma si hay vulnerabilidades aplicables ni su impacto. | `auth/pom.xml:13,48-50` | baja | Pendiente |
| H-AUTH-07 | auth | El recurso concentra validación, persistencia, token y respuesta HTTP | Refactor | `login` validaba entradas, invocaba directamente la base, decidía la autenticación, generaba el token y construía la respuesta; esto acoplaba responsabilidades y dificultaba probarlas o cambiarlas de forma aislada. | `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:23-68`; `auth/src/main/java/com/bcp/workshop/auth/AuthenticationService.java:10-35`; `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:19-67`; `auth/src/main/java/com/bcp/workshop/auth/LoginResponse.java:3-4` | baja | Resuelto — la frontera HTTP delega la autenticación al servicio; el repositorio persiste y la respuesta usa DTOs separados del modelo `UserRecord`. |
| H-AUTH-08 | auth | Cuentas de taller se crean automáticamente al inicializar la base | Vulnerabilidad | La inicialización crea cuentas con credenciales fijas si no existen; si se ejecuta en un despliegue no aislado sin reemplazarlas, podrían permitir acceso no autorizado. | `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:30-32,45-52,112-116` | media | CANDIDATO — confirmar si el componente se despliega fuera del entorno de taller y cómo se controlan esas cuentas. |
| H-AUTH-09 | auth | Fallos SQL durante el login se convierten en credenciales inválidas | Estabilidad | El repositorio imprime la excepción SQL y devuelve `null`; el servicio y el recurso convierten ese resultado en `401`, confundiendo una falla de persistencia con credenciales inválidas y dificultando el diagnóstico. | `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:59-76`; `auth/src/main/java/com/bcp/workshop/auth/AuthenticationService.java:17-20`; `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:30-33` | media | CANDIDATO |
| H-AUTH-10 | auth | El flujo de login no limita intentos repetidos dentro del componente | Seguridad | Cada solicitud válida estructuralmente llega a la consulta y verificación de contraseña sin control local de frecuencia; protecciones externas al componente no fueron verificadas. | `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:22-36`; `auth/src/main/java/com/bcp/workshop/auth/AuthenticationService.java:17-20`; `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:59-65` | media | CANDIDATO — confirmar si existe limitación en la capa de despliegue. |
| H-AUTH-11 | auth | La readiness de producción no comprueba la base de autenticación | Operación | No se encontró un readiness check de producción ligado a la base; una falla de base después del arranque podría dejar el servicio reportándose saludable mientras el login falla. | `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:59-76`; `auth/src/test/java/com/bcp/workshop/auth/HealthEndpointTest.java:14-22,35-46`; `auth/src/test/java/com/bcp/workshop/auth/TestReadinessCheck.java:9-20` | baja | CANDIDATO — comprobar el comportamiento en ejecución y las comprobaciones del despliegue. |

## Contrato observado de `POST /auth/login`

No se encontró `docs/ENDPOINTS.md`; por eso, lo siguiente se deriva del código y
es un contrato **observado**, no un contrato acordado:

- Ruta `POST /auth/login`, con request y response JSON.
- El request contiene los campos `username` y `password`; `client` también está
  declarado en el DTO. El recurso responde `400` cuando el cuerpo es nulo o
  falta username o password.
- La base usa `AUTH_DB_URL` si está definida y, de lo contrario,
  `jdbc:sqlite:./data/workshop.db`. Al inicializar crea la tabla `legacy_users`,
  migra contraseñas legadas y agrega cuentas ficticias `student` y `trainer`
  con hashes si no existen. `UserRepository` enlaza username como parámetro y
  verifica la contraseña contra el hash almacenado.
- Si no encuentra usuario, responde `401` con un mensaje que incluye el
  username recibido.
- Si autentica, responde `200` con `token`, `expiresIn` y `user` (`username`,
  `displayName`, `role`), además del campo `debug`.
- El token codifica en Base64 username, rol, expiración y el secreto fijo; el
  código leído no lo firma.
- Si ocurre una excepción en el recurso, responde `500` con `message` y
  `exception`.

Evidencia: `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:14-68`;
campos del request en `auth/src/main/java/com/bcp/workshop/auth/LoginRequest.java:3-6`;
servicio y DTOs en `auth/src/main/java/com/bcp/workshop/auth/AuthenticationService.java:10-35`
y `auth/src/main/java/com/bcp/workshop/auth/LoginResponse.java:3-4`;
inicialización y consulta en `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:19-129`;
hash y verificación de contraseña en `auth/src/main/java/com/bcp/workshop/auth/PasswordHasher.java:11-86`;
creación de token en `auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:8-15`.

## Pruebas

La suite de auth cubre login válido/inválido, campos requeridos, el manejo 500
observado, usuario con comilla, SQL parametrizado, hashing, migración idempotente
y servicio de autenticación.
`auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java:15`;
`auth/src/test/java/com/bcp/workshop/auth/UserRepositoryTest.java:29`;
`auth/src/test/java/com/bcp/workshop/auth/AuthenticationServiceTest.java:12`;
`auth/src/test/java/com/bcp/workshop/auth/PasswordHasherTest.java:10`.
Resultado final: `mvn verify` desde `auth/`, con DB SQLite aislada,
16 pruebas aprobadas; cobertura de líneas `AuthResource` 26/26 (100%),
`AuthenticationService` 11/11 (100%), `UserRepository` 61/65 (93,8%) y
`PasswordHasher` 37/39 (94,9%). Ejecuciones por ID: `PLAN.md`, sección
«Ejecuciones de implementación (auth)».

## Candidatos nuevos de auth — requieren revisión humana

### H-AUTH-08 — Cuentas de taller creadas durante la inicialización
- Estado: CANDIDATO
- Evidencia: `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:30-32,45-52,112-116`.
- Impacto: si el servicio se despliega en un entorno no aislado, las cuentas creadas con credenciales fijas podrían permitir acceso no autorizado si no se sustituyen o deshabilitan. El uso de producción no está confirmado.
- Prioridad propuesta: media.
- Contrato potencialmente afectado: `POST /auth/login` y la inicialización de la base de autenticación.
- Cómo validarlo: iniciar el perfil de despliegue previsto contra una base aislada vacía y verificar si las cuentas de taller se crean y pueden autenticarse; confirmar con el responsable del despliegue si ese comportamiento está permitido.

### H-AUTH-09 — Fallos de persistencia reportados como credenciales inválidas
- Estado: CANDIDATO
- Evidencia: `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:59-76`; `auth/src/main/java/com/bcp/workshop/auth/AuthenticationService.java:17-20`; `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:30-33`.
- Impacto: una falla SQL durante la consulta se representa como `401` en lugar de distinguir un error de servicio; el stack trace también se escribe directamente con `printStackTrace`.
- Prioridad propuesta: media.
- Contrato potencialmente afectado: estados y respuesta de error de `POST /auth/login`.
- Cómo validarlo: con una base o controlador JDBC de prueba que provoque `SQLException`, comprobar el estado y cuerpo HTTP resultantes y dónde queda registrada la falla.

### H-AUTH-10 — Sin limitación local de intentos de login
- Estado: CANDIDATO
- Evidencia: `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:22-36`; `auth/src/main/java/com/bcp/workshop/auth/AuthenticationService.java:17-20`; `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:59-65`.
- Impacto: el flujo de auth no controla la frecuencia de intentos, lo que podría facilitar intentos repetidos y elevar el costo de procesamiento. No se verificaron protecciones externas.
- Prioridad propuesta: media.
- Contrato potencialmente afectado: disponibilidad y comportamiento ante solicitudes repetidas de `POST /auth/login`.
- Cómo validarlo: ejecutar pruebas de solicitudes repetidas en un entorno aislado y verificar si el servicio o la infraestructura limita la frecuencia; revisar la configuración de despliegue con el equipo responsable.

### H-AUTH-11 — Readiness no vinculada a la disponibilidad de la base
- Estado: CANDIDATO
- Evidencia: `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java:59-76`; `auth/src/test/java/com/bcp/workshop/auth/HealthEndpointTest.java:14-22,35-46`; `auth/src/test/java/com/bcp/workshop/auth/TestReadinessCheck.java:9-20`.
- Impacto: una falla de base después del arranque podría no reflejarse en la readiness, aunque las solicitudes de login ya no puedan consultar usuarios. La prueba de readiness disponible usa un check de test.
- Prioridad propuesta: baja.
- Contrato potencialmente afectado: `GET /q/health` y la disponibilidad operativa de `POST /auth/login`.
- Cómo validarlo: en una ejecución de producción aislada, simular que la base deja de estar disponible después del arranque y comparar la respuesta de health con el resultado del login.
