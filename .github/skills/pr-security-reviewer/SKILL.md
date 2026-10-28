---
name: pr-security-reviewer
description: Revisa Pull Requests exclusivamente desde seguridad usando github-official, fija los SHAs revisados y entrega evidencia local para una revision y aprobacion humanas.
---

# Skill: Revisor de PR - Seguridad

## Objetivo y criterio

Revisar exclusivamente si los cambios del PR introducen defectos de seguridad demostrables o riesgos de seguridad que requieren confirmacion. Considera, cuando sean relevantes para el diff, autenticacion y autorizacion, exposicion de secretos o datos sensibles, inyeccion, validacion de entradas, traversal, criptografia y deserializacion inseguras.

No evalua estilo, rendimiento, compatibilidad ni funcionalidad general. No publiques una review, comentario, aprobacion ni otra accion en GitHub. El resultado es evidencia local para una persona revisora; no es una aprobacion del PR.

## Entradas

- Propietario y repositorio.
- Numero o enlace del PR.

Si falta algun dato o no identifica inequívocamente un PR, solicita aclaracion antes de consultar. No adivines el repositorio ni el PR.

## Herramientas permitidas

- Usa exclusivamente las herramientas MCP de `github-official`.
- Consulta los metadatos con `pull_request_read` y su metodo `get`.
- Consulta el diff con `pull_request_read` y su metodo `get_diff`; usa `get_files` si necesitas confirmar la lista de archivos.
- Para contexto adicional, usa `get_file_contents` en el mismo repositorio y fija `sha` al SHA completo de base o cabeza que corresponda.
- No uses terminal, GitHub CLI, busquedas del workspace ni archivos locales como fuente de informacion del PR; tampoco uses otro servidor MCP ni herramientas que publiquen cambios. Guarda unicamente el informe final en `docs/`.

## Procedimiento

1. Obtén los metadatos del PR y registra el enlace, titulo, numero, SHA completo de base y SHA completo de cabeza.
2. Obtén el diff del mismo PR y determina el alcance de seguridad a partir de los cambios concretos. Examina solo el aspecto de seguridad elegido.
3. Si el diff no basta para evaluar un flujo, consulta el contexto indispensable mediante `get_file_contents`, fijando el SHA exacto. Usa cabeza para el estado nuevo y base para contrastar el estado anterior. No consultes ramas moviles ni infieras comportamiento que el codigo consultado no demuestre.
4. Sustenta cada observacion con el archivo y la linea del diff, o un fragmento breve que permita localizarla. Distingue:
   - **Defecto demostrado:** el diff y el contexto fijado prueban el comportamiento vulnerable.
   - **Riesgo por confirmar:** el impacto depende de una condicion o configuracion no verificada; declara el supuesto y que evidencia lo confirmaria.
5. Para cada observacion, explica el impacto y una prueba o comprobacion concreta que permitiria confirmarla. No afirmes que una prueba se ejecuto o paso si no se ejecuto. Si solo se puede proponer una prueba por la restriccion de herramientas, indicarlo expresamente como no ejecutada.
6. Al terminar, vuelve a consultar los metadatos del PR. Si el SHA de base o cabeza cambio, reinicia la revision sobre una version estable. Informa unicamente los SHAs que efectivamente revisaste.
7. Resume que cambios y categorias de seguridad se examinaron, incluso si no hay hallazgos. Declara las limitaciones y cualquier comprobacion no realizada.
8. Deja la revision humana como **pendiente**. La persona responsable debe revisar el diff y la evidencia, y registrar su propia decision y motivos en la seccion de revision humana de la entrega o del proceso del PR. Solo esa persona puede decidir si aprueba. No declares que el PR esta aprobado, listo para merge o aceptado.

## Formato de entrega local

Guarda el informe Markdown en `docs/SECURITY-REVIEW-PR-<numero>.md`, sustituyendo `<numero>` por el numero del PR. Si el directorio `docs/` no existe o no se puede escribir, informa el bloqueo y no guardes el informe en otra ubicacion. Usa estas secciones:

```markdown
# Revision de seguridad del PR

- PR: [numero y enlace]
- Titulo: [titulo]
- Base revisada: [SHA completo]
- Cabeza revisada: [SHA completo]
- Alcance: [archivos y cambios de seguridad examinados]

## Observaciones

### [Hallazgo o "Sin hallazgos"]

- Tipo: defecto demostrado | riesgo por confirmar
- Severidad: critica | alta | media | baja, con justificacion breve
- Evidencia: archivo y linea(s) del diff o fragmento localizable
- Impacto: consecuencia concreta
- Confirmacion: prueba/comprobacion concreta y si fue ejecutada; nunca inventar resultados

## Comprobaciones y limites

- Revisado: [cambios y categorias de seguridad examinados]
- Contexto consultado: [archivos, SHA fijado y motivo, o ninguno]
- No comprobado: [configuracion, pruebas, despliegues u otros limites]

## Revision humana - obligatoria

- Estado: pendiente
- Persona revisora: [completar]
- Decision: [completar por la persona revisora]
- Motivos: [completar por la persona revisora]
```

Si no encuentras observaciones, escribe que no se encontraron defectos demostrables en el diff revisado; no lo presentes como garantia de seguridad. Mantén la revision humana pendiente hasta que una persona registre una decision y sus motivos. La salida del Skill, incluso sin hallazgos, no es aprobacion ni sustituye controles humanos requeridos por el repositorio.
