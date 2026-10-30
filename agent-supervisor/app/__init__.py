"""Servicio de briefing para el supervisor de conciliacion."""

from app.config import configure_environment

# Debe ejecutarse antes de importar crewai para que respete la telemetria desactivada.
configure_environment()
