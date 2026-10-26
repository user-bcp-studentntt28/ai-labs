# Plan de correccion

## auth

El plan comprende `H-AUTH-01` a `H-AUTH-07`. La aprobación humana registrada
al final de este documento autoriza H-AUTH-01, H-AUTH-02 y H-AUTH-07 bajo las
condiciones ahí indicadas; H-AUTH-03 a H-AUTH-05 están diferidos hasta resolver
riesgos de compatibilidad y H-AUTH-06 se limita a investigación SCA.

No existe `docs/ENDPOINTS.md`. Hasta que se acuerde otro contrato, conservar el
comportamiento HTTP observado: `POST /auth/login`, JSON, respuestas `400` para
request/campos requeridos ausentes, `401` para credenciales no válidas y `200`
con `token`, `expiresIn` y `user`. Los cambios de seguridad que alteren campos
de respuesta, política CORS o formato interno del token se deben revisar como
compatibilidad explícita antes de implementar.

### H-AUTH-01 — Credenciales concatenadas en SQL

- **Hallazgo:** `H-AUTH-01`, Vulnerabilidad, alta, Resuelto
  ([`HALLAZGOS.md`](./HALLAZGOS.md)).
- **Problema:** `LegacyDatabase.findByCredentials` interpola username y
  password en el SQL y ejecuta la cadena con `Statement`.
- **Cambio propuesto:** usar una sentencia fija con dos placeholders y enlazar
  ambos valores mediante `PreparedStatement.setString`. Mantener la búsqueda
  por las mismas columnas y traducir ausencia de fila al mismo resultado
  observado para el login no válido.
- **Archivos previstos:** `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java`
  (renombrado desde `LegacyDatabase.java`);
  `auth/src/test/java/com/bcp/workshop/auth/UserRepositoryTest.java`
  (nuevo) y/o `auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java`.
- **Caracterización antes de tocar código:** cubrir login válido e inválido y
  un username ficticio que contenga una comilla; esperar que no autentique y
  que el endpoint mantenga el `401` observado. Añadir una prueba de interacción
  JDBC que compruebe el SQL estable, los dos valores enlazados y la ejecución
  de la sentencia parametrizada. La prueba de interacción debe fallar con la
  implementación actual y pasar tras el cambio; no usar una entrada destinada
  a evadir autenticación.

### H-AUTH-02 — Contraseñas almacenadas en texto plano

- **Hallazgo:** `H-AUTH-02`, Vulnerabilidad, alta, Resuelto
  ([`HALLAZGOS.md`](./HALLAZGOS.md)).
- **Problema:** la columna `password`, los usuarios semilla y la comparación de
  credenciales usan contraseñas legibles.
- **Cambio propuesto:** guardar hashes lentos con salt aleatorio por usuario,
  verificar las contraseñas en el servicio/repositorio sin registrarlas y
  dejar de insertar valores de contraseña en claro. Preferir una primitiva
  disponible en el JDK (por ejemplo PBKDF2) para evitar una dependencia nueva;
  si se elige otra implementación, justificar y revisar su dependencia. Diseñar
  una migración idempotente para la base SQLite ya existente antes de cambiar
  el esquema o las filas; no dejar cuentas existentes inaccesibles.
- **Archivos previstos:** `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java`;
  nueva clase de hash en `auth/src/main/java/com/bcp/workshop/auth/`; pruebas
  unitarias para el hash y de integración para SQLite bajo
  `auth/src/test/java/com/bcp/workshop/auth/`.
- **Caracterización antes de tocar código:** con una base de prueba aislada,
  verificar que las cuentas ficticias existentes inician sesión correctamente,
  una contraseña incorrecta da `401`, y reinicializar la base no cambia
  credenciales. Registrar el estado anterior de la base de prueba para definir
  una prueba de migración que conserve el acceso tras convertir los hashes.
- **Riesgo/compatibilidad:** mantener la misma ruta, estados HTTP y forma de
  respuesta. No migrar ni probar contra una base de usuario real.

### H-AUTH-03 — Token Base64 con secreto embebido, sin firma

- **Hallazgo:** `H-AUTH-03`, Vulnerabilidad, alta, Aprobado
  ([`HALLAZGOS.md`](./HALLAZGOS.md)).
- **Problema:** el token actual codifica datos y secreto en Base64, sin
  autenticidad criptográfica verificable.
- **Cambio propuesto:** sustituirlo por un token firmado con expiración y claims
  explícitos, usando una implementación estándar mantenida. La adición de una
  dependencia de tokens se justifica por interoperabilidad y verificación
  criptográfica; elegirla solo después de revisar advisories y coordinar el
  formato con quienes consumen el token. Mantener el campo HTTP `token`, el
  campo `expiresIn` y el TTL observado de 3600 segundos, representando ese TTL
  mediante una constante con nombre.
- **Archivos previstos:** `auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java`
  (o reemplazo con nombre de propósito), `auth/pom.xml`,
  `auth/src/main/resources/application.properties`,
  `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java` y pruebas de
  token/login bajo `auth/src/test/java/com/bcp/workshop/auth/`.
- **Caracterización antes de tocar código:** comprobar que login válido
  responde `200`, incluye los campos `token`, `expiresIn` y `user`, y conserva
  el valor observado de expiración. Registrar que el token actual es Base64 sin
  firma para separar ese comportamiento interno del contrato HTTP. Después del
  cambio, probar firma válida, rechazo de token alterado y expiración.
- **Riesgo/compatibilidad:** no se encontró documentación de contrato ni se
  inspeccionaron consumidores externos a `auth/`. La migración de formato no
  debe implementarse hasta confirmar que los consumidores aceptan el token
  firmado; no conservar un mecanismo de aceptación inseguro como fallback.

### H-AUTH-04 — Exposición de detalles de excepción al cliente

- **Hallazgo:** `H-AUTH-04`, Vulnerabilidad, media, Aprobado
  ([`HALLAZGOS.md`](./HALLAZGOS.md)).
- **Problema:** el `500` contiene el mensaje de excepción y su clase.
- **Cambio propuesto:** responder con un mensaje genérico y estado `500`; enviar
  los detalles solo al logger del servidor, sin incluir contraseñas ni tokens.
- **Archivos previstos:** `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java`;
  `auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java`.
- **Caracterización antes de tocar código:** invocar el recurso con un stub
  local de `AuthenticationService` que lance una excepción ficticia y comprobar el
  estado `500` y el cuerpo actual (`message` y `exception`). Tras el cambio,
  conservar el estado y verificar que el mensaje es genérico y que no aparecen
  mensaje/clase internos. La prueba puede construir el recurso directamente
  dentro del paquete de test y asignar el campo package-private, evitando una
  dependencia de mocking.
- **Riesgo/compatibilidad:** la forma de la respuesta de error cambiaría
  intencionalmente al retirar `exception` y ocultar el detalle; acordar ese
  cambio si algún consumidor depende de dichos campos.

### H-AUTH-05 — Secreto hardcodeado y CORS permisivo

- **Hallazgo:** `H-AUTH-05`, Vulnerabilidad, media, Aprobado
  ([`HALLAZGOS.md`](./HALLAZGOS.md)).
- **Problema:** el secreto del token está en código y CORS permite cualquier
  origen.
- **Cambio propuesto:** cargar el secreto desde configuración externa, fallar
  de forma explícita si falta en producción y usar valores ficticios aislados
  en pruebas. Restringir CORS a los orígenes necesarios, manteniendo los
  métodos/headers que requiera el contrato. No introducir secretos reales.
- **Archivos previstos:** `auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java`
  (o reemplazo), `auth/src/main/resources/application.properties`,
  `auth/src/test/java/com/bcp/workshop/auth/` y, solo si hace falta documentar
  la configuración local del componente, `auth/README.md` (si existe).
- **Caracterización antes de tocar código:** comprobar con un secreto ficticio
  aislado el contenido del token legacy actual, sin publicar su valor; probar
  que la respuesta CORS actual admite el origen local `http://localhost:4200`
  y registrar que también refleja un origen no incluido en una allowlist.
  Después, probar que el secreto configurado se usa y que falta de configuración
  en producción falla explícitamente; verificar que el origen permitido sigue
  recibiendo CORS y uno no permitido no recibe autorización CORS.
- **Riesgo/compatibilidad:** no existe `docs/ENDPOINTS.md` ni una lista acordada
  de orígenes. Confirmar los orígenes permitidos antes de cerrar CORS; el origen
  local indicado se deriva del README general.

### H-AUTH-06 — Versiones de dependencias pendientes de análisis SCA

- **Hallazgo:** `H-AUTH-06`, Sugerencia, baja, Aprobado
  ([`HALLAZGOS.md`](./HALLAZGOS.md)).
- **Problema:** `pom.xml` fija Quarkus `3.27.4` y Commons Text `1.9`; las
  versiones están comprobadas, pero aún no se verificó si hay advisories
  aplicables.
- **Cambio propuesto:** primero revisar dependencias directas y transitivas,
  advisories y uso de Commons Text. Actualizar o quitar solo una dependencia
  cuando la evidencia lo justifique; no silenciar CodeQL ni Dependency Review.
  No agregar dependencias por anticipado.
- **Archivos previstos:** `auth/pom.xml` solo si el análisis confirma una
  actualización/remoción; pruebas de regresión pertinentes en
  `auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java`.
- **Caracterización antes de tocar código/configuración:** extender el login
  válido para comprobar el estado, los campos de usuario y el escape del
  `displayName` que actualmente realiza Commons Text. Conservar esta prueba
  antes de una actualización/remoción y volver a ejecutarla después. La consulta
  SCA es una verificación aparte y todavía está pendiente.
- **Riesgo/compatibilidad:** no declarar vulnerabilidad ni cambiar versiones
  hasta disponer del resultado de advisories y de una revisión del impacto en
  build y runtime.

### H-AUTH-07 — Responsabilidades mezcladas en `AuthResource.login`

- **Hallazgo:** `H-AUTH-07`, Refactor, baja, Resuelto
  ([`HALLAZGOS.md`](./HALLAZGOS.md)).
- **Problema:** el recurso valida, consulta persistencia, decide autenticación,
  genera el token y arma la respuesta dentro de un método con condicionales
  anidados.
- **Cambio propuesto:** separar la frontera HTTP, un servicio de autenticación,
  repositorio de usuarios y componente de seguridad/token. Mantener métodos con
  una responsabilidad, nombres de propósito, retornos anticipados y constantes
  nombradas. Mapear `UserRecord` a un DTO de respuesta propio, sin exponer el
  modelo de persistencia.
- **Archivos previstos:** `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java`,
  `auth/src/main/java/com/bcp/workshop/auth/AuthenticationService.java`,
  `auth/src/main/java/com/bcp/workshop/auth/UserRepository.java` (renombrado
  desde `LegacyDatabase.java`), `auth/src/main/java/com/bcp/workshop/auth/UserRecord.java`,
  `auth/src/main/java/com/bcp/workshop/auth/LoginResponse.java` y pruebas en
  `auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java`,
  `AuthenticationServiceTest.java` y `UserRepositoryTest.java`.
- **Caracterización antes de tocar código:** cubrir request nulo/campos vacíos
  (`400`), credenciales inválidas (`401`) y válidas (`200`, campos y valores
  observados), además del manejo `500` caracterizado para `H-AUTH-04`.
  Comparar cuerpo y códigos HTTP antes/después, exceptuando cambios de seguridad
  acordados expresamente en H-AUTH-03/04/05.
- **Riesgo/compatibilidad:** hacer el trabajo en pasos revisables y en
  coordinación con H-AUTH-01 a H-AUTH-05 para evitar duplicar acceso a datos,
  validación o generación de tokens. No ampliar cambios a otros componentes.

## Orden y validación propuestos

1. Escribir y ejecutar primero pruebas de caracterización con una base SQLite
   aislada bajo `auth/target/`; registrar sus resultados reales.
2. Corregir persistencia y credenciales (H-AUTH-01/02) en cambios revisables.
3. Acordar configuración/allowlist (H-AUTH-05) y formato/consumidores del token
   firmado (H-AUTH-03) antes de implementar esos cambios.
4. Corregir errores expuestos (H-AUTH-04), luego separar capas (H-AUTH-07)
   apoyándose en las pruebas de regresión.
5. Investigar SCA (H-AUTH-06); cambiar dependencias solo con evidencia.
6. Ejecutar pruebas y cobertura desde `auth/`, buscando al menos 85% del código
   modificado según `AGENTS.md`. H-AUTH-01, H-AUTH-02 y H-AUTH-07 se probaron;
   sus resultados están en «Ejecuciones de implementación (auth)».

Comando de regresión documentado desde la raíz: `python tools/lab.py test auth`.
Para Maven desde `auth/`, el README documenta el wrapper del laboratorio; `mvn
test` es la ejecución local estándar si JDK y Maven indicados están disponibles.


### Aprobación humana para implementar 26/10/2026 
- Aprobado por: [EFRAIN ALVAREZ]
- Fecha: 2026-10-26
- IDs aprobados: H-AUTH-01, H-AUTH-02, H-AUTH-03, H-AUTH-04, H-AUTH-05, H-AUTH-06, H-AUTH-07
- Alcance: seguir los cambios y pruebas de caracterización descritos en cada apartado del plan.
- Condiciones: usar una base SQLite ficticia aislada y conservar las respuestas HTTP observadas.
- Diferidos: H-AUTH-03, H-AUTH-04 y H-AUTH-05 hasta resolver sus riesgos de compatibilidad; H-AUTH-06 limitado a investigar SCA.


## Ejecuciones de implementación (auth)

Todas las pruebas se ejecutaron desde `auth/` con `AUTH_DB_URL` apuntando a un
archivo SQLite aislado bajo `auth/target/`. La primera invocación no cargó el
driver SQLite en la prueba unitaria; se corrigió el harness con carga explícita
del driver y se repitió la caracterización antes de modificar la persistencia.

| IDs | Momento | Comando / base aislada | Resultado |
|---|---|---|---|
| H-AUTH-01, H-AUTH-02 | Antes de cambios | `mvn '-Dtest=AuthResourceTest,LegacyDatabaseTest' test`; `AUTH_DB_URL=jdbc:sqlite:./target/auth-characterization.db` | 6 pruebas: 4 aprobadas y 2 fallidas como se esperaba: no se observó `PreparedStatement` y la fila legacy permanecía en texto plano. Las 3 pruebas HTTP pasaron. |
| H-AUTH-01 | Después del cambio SQL | `mvn '-Dtest=AuthResourceTest,LegacyDatabaseTest#credentialsLookupUsesBoundParameters+initializationPreservesExistingCredentialBehavior' test`; misma DB aislada | 5 pruebas aprobadas, 0 fallidas. |
| H-AUTH-02 | Antes del cambio de hash | `mvn '-Dtest=AuthResourceTest,LegacyDatabaseTest' test`; `AUTH_DB_URL=jdbc:sqlite:./target/auth-h02-before-20261026.db` | 7 pruebas: 4 aprobadas y 3 fallidas como se esperaba: lookup aún filtraba por password en SQL, y la migración/semillas conservaban texto plano. Las 3 pruebas HTTP pasaron. |
| H-AUTH-01, H-AUTH-02 | Después de ambos cambios | `mvn '-Dtest=AuthResourceTest,LegacyDatabaseTest,PasswordHasherTest' test`; base `auth-h02-before-20261026.db`, que contenía usuarios legacy previos | 9 pruebas aprobadas, 0 fallidas; cubrió migración de filas plaintext existentes, login válido/inválido, comilla como dato y parámetros JDBC. |
| H-AUTH-01, H-AUTH-02 | Verificación final | `mvn verify`; `AUTH_DB_URL=jdbc:sqlite:./target/auth-final-20261026.db` (base aislada nueva) | BUILD SUCCESS; 9 pruebas aprobadas, 0 fallidas. JaCoCo: `UserRepository` 61/65 líneas (93,8%) y `PasswordHasher` 37/39 (94,9%), ambas sobre 85%. |
| H-AUTH-07 | Caracterización antes del refactor | `mvn '-Dtest=AuthResourceTest' test`; `AUTH_DB_URL=jdbc:sqlite:./target/auth-h07-characterization.db` | BUILD SUCCESS; 6 pruebas aprobadas, 0 fallidas. Cubrió login `200`, credenciales `401`, username con comilla, campos requeridos `400` y respuesta `500` observada mediante fallo ficticio del servicio. |
| H-AUTH-07 | Después del refactor | `mvn '-Dtest=AuthResourceTest,AuthenticationServiceTest,UserRepositoryTest' test`; misma DB aislada | BUILD SUCCESS; 14 pruebas aprobadas, 0 fallidas. Se mantuvieron los resultados HTTP caracterizados y se probaron la delegación de servicio y mapeo de usuario al DTO. |
| H-AUTH-07, H-AUTH-01, H-AUTH-02 | Verificación final | `mvn verify`; `AUTH_DB_URL=jdbc:sqlite:./target/auth-h07-final-20261026.db` (base aislada nueva) | BUILD SUCCESS; 16 pruebas aprobadas, 0 fallidas. JaCoCo: `AuthResource` 26/26 (100%), `AuthenticationService` 11/11 (100%), `UserRepository` 61/65 (93,8%) y `PasswordHasher` 37/39 (94,9%). |

CodeQL y Dependency Review remotos: no ejecutados en este recorrido local.
H-AUTH-03 a H-AUTH-05 no se implementaron por estar diferidos por riesgo de
compatibilidad. H-AUTH-06 sigue limitado a investigación SCA, no ejecutada.
H-AUTH-07 se implementó preservando el contrato observado; los cambios de error,
token y configuración permanecen sin modificar.
La caracterización previa cubrió login válido/inválido, username con comilla,
campos requeridos ausentes y respuesta 500. Las pruebas de request JSON nulo y
campos en blanco se añadieron después del refactor para cerrar ese borde de
cobertura; no se afirma un resultado pre-refactor para esos dos casos.