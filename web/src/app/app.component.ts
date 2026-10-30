import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GROUP_ID } from './core/config';
import { ROLE_LABELS } from './core/labels';
import { Role } from './core/models';
import { ExecutionPanelComponent } from './execution/execution-panel.component';
import { OperationsListComponent } from './operations/operations-list.component';
import { ScenarioPanelComponent } from './provider-control/scenario-panel.component';
import { SourcesPanelComponent } from './sources/sources-panel.component';
import { SourcesService } from './sources/sources.service';
import { TrackingService } from './tracking/tracking.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SourcesPanelComponent, ExecutionPanelComponent, OperationsListComponent, ScenarioPanelComponent],
  template: `
    <div class="app">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">C</span> claro<span class="brand-dot">.</span></div>
        <div class="workspace-label">Operaciones</div>
        <nav aria-label="Navegación principal">
          <div class="nav-item active">
            <span class="nav-icon">⇄</span>Conciliación
          </div>
        </nav>
        <div class="sidebar-note">
          <b>Flujo W6</b><br />
          La conciliación compara wallet, reporte del proveedor, ledger y saldos. Detecta diferencias; no mueve dinero ni repara registros.
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div class="crumb">Operaciones <span class="crumb-sep">/</span> <strong>Conciliación</strong></div>
          <div class="topbar-tools">
            <label class="role-switch">Rol de demo
              <select id="active-role" aria-label="Cambiar rol de demo" (change)="onRole($event)">
                @for (role of roles; track role) {
                  <option [value]="role" [selected]="role === tracking.role()">{{ roleLabels[role] }}</option>
                }
              </select>
            </label>
            <span class="env-pill">API · GRUPO {{ groupId }}</span>
          </div>
        </header>

        <div class="content">
          <section class="heading">
            <div>
              <h1>Conciliación de operaciones</h1>
              <p class="subtitle">Consulta los datos del grupo y ejecuta la comparación definida por W6.</p>
            </div>
            <span class="badge">API + flujo humano local</span>
          </section>

          <div class="notice">
            <b>Fuentes de operación desde API; seguimiento humano en este navegador:</b> los estados y notas de analista y
            supervisor se guardan en localStorage y no modifican el API ni se comparten con otros usuarios o dispositivos.
          </div>

          @if (tracking.discardNotice(); as notice) {
            <div class="scenario-warning" id="discard-notice" role="alert">{{ notice }}</div>
          }

          <app-sources-panel />
          <div class="section-block"><app-execution-panel /></div>
          <div class="section-block"><app-operations-list /></div>
          <div class="section-block"><app-scenario-panel /></div>

          <section class="panel section-block" aria-labelledby="roles-title">
            <div class="panel-head">
              <div>
                <h2 id="roles-title">Roles del flujo de atención</h2>
                <div class="panel-caption">El analista investiga; el supervisor valida la resolución.</div>
              </div>
            </div>
            <div class="role-grid">
              <article class="role-card">
                <span class="badge">ANALISTA</span>
                <p>Inicia la atención, revisa las fuentes, registra qué encontró y envía el caso a revisión del supervisor.</p>
              </article>
              <article class="role-card">
                <span class="badge">SUPERVISOR</span>
                <p>Revisa notas y fuentes; aprueba el cierre local o devuelve el caso al analista con observaciones.</p>
              </article>
            </div>
            <p class="local-warning">
              <b>Demo sin autenticación:</b> el selector de rol permite probar el flujo, pero no verifica identidad ni permisos.
              Los cambios se guardan en localStorage de este navegador, no se envían al API y no son una aprobación operativa real.
            </p>
          </section>
        </div>
      </main>
    </div>
  `
})
export class AppComponent {
  protected readonly tracking = inject(TrackingService);
  protected readonly sources = inject(SourcesService);

  protected readonly roles: Role[] = ['ANALYST', 'SUPERVISOR'];
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly groupId = GROUP_ID;

  protected onRole(event: Event): void {
    this.tracking.role.set((event.target as HTMLSelectElement).value as Role);
  }
}
