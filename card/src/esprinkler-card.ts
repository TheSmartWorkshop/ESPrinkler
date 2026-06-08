import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant } from "custom-card-helpers";
import type { ESPrinklerCardConfig, ZoneConfig, ZoneMapConfig } from "./types";

const CARD_VERSION = "0.3.0";

const STATE_ICON: Record<string, string> = {
  idle: "mdi:water-off",
  running: "mdi:sprinkler-variant",
  manual: "mdi:hand-water",
  paused: "mdi:pause-circle",
  rain_delay: "mdi:weather-rainy",
};

@customElement("esprinkler-card")
export class ESPrinklerCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private config!: ESPrinklerCardConfig;

  public setConfig(config: ESPrinklerCardConfig): void {
    if (!config || !Array.isArray(config.zones) || config.zones.length === 0) {
      throw new Error("esprinkler-card: you must define at least one zone");
    }
    if (config.zone_map && !config.zone_map.image) {
      throw new Error("esprinkler-card: zone_map.image is required when zone_map is set");
    }
    this.config = config;
  }

  public getCardSize(): number {
    const map = this.config?.zone_map ? 4 : 0;
    return 2 + map + (this.config?.zones.length ?? 0);
  }

  private zoneName(zone: ZoneConfig): string {
    // Priority: static name -> name_entity state -> valve's friendly_name -> "Zone".
    if (zone.name) return zone.name;
    if (zone.name_entity) {
      const s = this.stateOf(zone.name_entity);
      if (s && s !== "unavailable" && s !== "unknown") return s;
    }
    if (zone.valve) {
      const friendly = this.hass.states[zone.valve]?.attributes.friendly_name;
      if (friendly) return String(friendly);
    }
    return "Zone";
  }

  private runZone(zone: ZoneConfig): void {
    if (zone.run) this.pressButton(zone.run);
    else if (zone.valve) this.toggleSwitch(zone.valve);
  }

  // --- helpers ---------------------------------------------------------------
  private stateOf(entityId?: string): string | undefined {
    if (!entityId || !this.hass) return undefined;
    return this.hass.states[entityId]?.state;
  }

  private isOn(entityId?: string): boolean {
    return this.stateOf(entityId) === "on";
  }

  private pressButton(entityId?: string): void {
    if (entityId) this.hass.callService("button", "press", { entity_id: entityId });
  }

  private toggleSwitch(entityId?: string): void {
    if (entityId) this.hass.callService("switch", "toggle", { entity_id: entityId });
  }

  private fmtRemaining(entityId?: string): string {
    const raw = this.stateOf(entityId);
    if (raw === undefined || raw === "unavailable" || raw === "unknown") return "";
    const secs = Number(raw);
    if (!Number.isFinite(secs) || secs <= 0) return "";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // --- render ----------------------------------------------------------------
  protected render(): TemplateResult | typeof nothing {
    if (!this.config || !this.hass) return nothing;

    const ctrlState = this.stateOf(this.config.state_entity) ?? "idle";
    const watering =
      this.isOn(this.config.watering_entity) ||
      ctrlState === "running" ||
      ctrlState === "manual";
    const activeZone = this.stateOf(this.config.active_zone_entity);
    const totalRemaining = this.fmtRemaining(this.config.active_remaining_entity);
    const nextRun = this.stateOf(this.config.next_run_entity);

    return html`
      <ha-card .header=${this.config.title ?? "ESPrinkler"}>
        <div class="content">
          <div class="status ${watering ? "active" : ""}">
            <ha-icon .icon=${STATE_ICON[ctrlState] ?? "mdi:sprinkler"}></ha-icon>
            <div class="status-text">
              <div class="status-line">${this.prettyState(ctrlState)}</div>
              ${watering && activeZone
                ? html`<div class="sub">${activeZone}${totalRemaining ? ` · ${totalRemaining}` : ""}</div>`
                : nextRun
                  ? html`<div class="sub">Next: ${nextRun}</div>`
                  : nothing}
            </div>
            ${this.config.schedule_switch
              ? html`<ha-switch
                  .checked=${this.isOn(this.config.schedule_switch)}
                  @change=${() => this.toggleSwitch(this.config.schedule_switch)}
                  title="Schedule enabled"
                ></ha-switch>`
              : nothing}
          </div>

          <div class="controls">
            ${this.config.start_button
              ? html`<mwc-button raised @click=${() => this.pressButton(this.config.start_button)}>
                  Start
                </mwc-button>`
              : nothing}
            ${this.config.pause_switch
              ? html`<mwc-button
                  @click=${() => this.toggleSwitch(this.config.pause_switch)}
                >
                  ${this.isOn(this.config.pause_switch) ? "Resume" : "Pause"}
                </mwc-button>`
              : nothing}
            ${this.config.stop_button
              ? html`<mwc-button @click=${() => this.pressButton(this.config.stop_button)}>
                  Stop
                </mwc-button>`
              : nothing}
          </div>

          ${this.config.zone_map ? this.renderZoneMap(this.config.zone_map) : nothing}

          <div class="zones">
            ${this.config.zones.map((z) => this.renderZone(z))}
          </div>
        </div>
      </ha-card>
    `;
  }

  private renderZoneMap(map: ZoneMapConfig): TemplateResult {
    const ratioStyle = map.aspect_ratio ? `aspect-ratio: ${map.aspect_ratio};` : "";
    return html`
      <div class="zone-map" style=${ratioStyle}>
        <img src=${map.image} alt="Yard layout" draggable="false" />
        ${this.config.zones.map((z) => {
          const pos = z.map_position;
          if (!pos) return nothing;
          const active = this.isOn(z.active) || this.isOn(z.valve);
          const remaining = this.fmtRemaining(z.remaining);
          const label = this.zoneName(z);
          return html`
            <button
              class="map-pin ${active ? "active" : ""}"
              style="left: ${pos.x}%; top: ${pos.y}%"
              @click=${() => this.runZone(z)}
              title=${label}
            >
              <ha-icon icon=${active ? "mdi:sprinkler-variant" : "mdi:sprinkler"}></ha-icon>
              <span class="map-pin-label">${label}${active && remaining ? ` · ${remaining}` : ""}</span>
            </button>
          `;
        })}
      </div>
    `;
  }

  private renderZone(zone: ZoneConfig): TemplateResult {
    const active = this.isOn(zone.active) || this.isOn(zone.valve);
    const remaining = this.fmtRemaining(zone.remaining);
    const enabled = zone.enable ? this.isOn(zone.enable) : true;
    const duration = zone.duration ? this.stateOf(zone.duration) : undefined;
    const name = this.zoneName(zone);

    return html`
      <div class="zone ${active ? "active" : ""} ${enabled ? "" : "disabled"}">
        <div class="zone-main">
          <span class="zone-name">${name}</span>
          <span class="zone-meta">
            ${active && remaining ? html`<span class="badge">${remaining}</span>` : nothing}
            ${duration ? html`<span class="dur">${duration} min</span>` : nothing}
          </span>
        </div>
        <div class="zone-actions">
          ${zone.enable
            ? html`<ha-switch
                .checked=${enabled}
                @change=${() => this.toggleSwitch(zone.enable)}
                title="Include in cycle"
              ></ha-switch>`
            : nothing}
          ${zone.run
            ? html`<mwc-button dense @click=${() => this.pressButton(zone.run)}>
                ${active ? "Running" : "Run"}
              </mwc-button>`
            : nothing}
        </div>
      </div>
    `;
  }

  private prettyState(s: string): string {
    switch (s) {
      case "running":
        return "Watering";
      case "manual":
        return "Manual run";
      case "paused":
        return "Paused";
      case "rain_delay":
        return "Rain delay";
      default:
        return "Idle";
    }
  }

  static styles = css`
    .content {
      padding: 0 16px 16px;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0 12px;
    }
    .status ha-icon {
      --mdc-icon-size: 32px;
      color: var(--secondary-text-color);
    }
    .status.active ha-icon {
      color: var(--primary-color);
    }
    .status-text {
      flex: 1;
    }
    .status-line {
      font-size: 1.1rem;
      font-weight: 500;
    }
    .sub {
      color: var(--secondary-text-color);
      font-size: 0.85rem;
    }
    .controls {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }
    .zones {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .zone {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      border-radius: 8px;
      background: var(--secondary-background-color);
    }
    .zone.active {
      box-shadow: inset 0 0 0 2px var(--primary-color);
    }
    .zone.disabled .zone-name {
      color: var(--disabled-text-color);
    }
    .zone-main {
      display: flex;
      flex-direction: column;
    }
    .zone-name {
      font-weight: 500;
    }
    .zone-meta {
      display: flex;
      gap: 8px;
      font-size: 0.8rem;
      color: var(--secondary-text-color);
    }
    .badge {
      color: var(--primary-color);
      font-variant-numeric: tabular-nums;
    }
    .zone-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .zone-map {
      position: relative;
      width: 100%;
      margin: 8px 0 12px;
      border-radius: 8px;
      overflow: hidden;
      background: var(--secondary-background-color);
    }
    .zone-map img {
      display: block;
      width: 100%;
      height: auto;
      user-select: none;
    }
    .map-pin {
      position: absolute;
      transform: translate(-50%, -50%);
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border: none;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 120ms ease, box-shadow 120ms ease;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    }
    .map-pin:hover {
      background: rgba(0, 0, 0, 0.75);
    }
    .map-pin.active {
      background: var(--primary-color);
      color: var(--text-primary-color, #fff);
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.4),
        0 0 12px 2px var(--primary-color);
    }
    .map-pin ha-icon {
      --mdc-icon-size: 18px;
    }
    .map-pin-label {
      white-space: nowrap;
    }
  `;
}

// Surface the card in HA's "add card" picker.
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "esprinkler-card",
  name: "ESPrinkler Card",
  description: "Zone control and scheduling for an ESPrinkler irrigation controller.",
});

console.info(
  `%c ESPRINKLER-CARD %c ${CARD_VERSION} `,
  "background:#0277bd;color:#fff",
  "color:#0277bd",
);
