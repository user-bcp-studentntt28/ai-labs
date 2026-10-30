# Propuesta: Seguimiento local de una incidencia

## Issue

[#34 — [HU-CONC-04] Dar seguimiento local a una incidencia](https://github.com/user-bcp-studentntt28/ai-labs/issues/34)

## Por qué

La demo debe representar un flujo de atención sobre las incidencias, por ejemplo notas del analista y cierre supervisado. Ese flujo debe quedar separado del estado técnico del API para no confundir una atención local con una corrección real.

## Qué cambia

- Se agrega un flujo local de atención con transiciones: iniciar atención, enviar a revisión, aprobar cierre local y devolver con observaciones.
- Cada transición registra rol, acción, fecha y nota cuando corresponde.
- El estado y el historial se guardan en el navegador, por grupo y wallet.
- Se muestra con claridad que "Cerrada localmente" no cambia el estado del API.

## Capacidades

- Nueva: `conciliacion-seguimiento-local` (ver [spec.md](./specs/conciliacion-seguimiento-local/spec.md)).

## Alcance

- Transiciones locales de atención sobre una incidencia.
- Notas y registro de historial por transición.
- Persistencia en el navegador, limitada a grupo y wallet seleccionados.
- Aviso cuando `localStorage` no está disponible; en ese caso la transición no se confirma como guardada.
- Selector Analista/Supervisor de demostración.

## Fuera de alcance

- Autenticación y autorización reales.
- Persistencia en servidor o sincronización entre usuarios o dispositivos.
- Cambiar el estado `OPEN`/`RESOLVED` del API.

## Comportamiento que debe preservarse

- Los estados `OPEN` y `RESOLVED` del API no cambian por ninguna acción local.
- El estado local no reemplaza ni oculta el estado del API: ambos se muestran.

## Supuestos y preguntas abiertas

- **Decisión confirmada, transiciones:** el flujo es `Sin atender` → `En atención` → `En revisión` → `Cerrada localmente`, con `Devuelta` como estado al devolver. El spec no define una transición de salida desde `Devuelta`.
- **Decisión, notas obligatorias:** "Aprobar cierre local" y "Devolver" exigen observaciones no vacías. "Enviar a revisión" la permite opcional.
- **Decisión, salida de `Devuelta`:** el analista puede volver a iniciar la atención (`Devuelta` → `En atención`). El spec no lo definía; se añade como escenario.

- Se asume que el selector de rol solo cambia el rol registrado en el historial.
