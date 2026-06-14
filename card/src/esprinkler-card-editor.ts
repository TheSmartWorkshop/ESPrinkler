import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCardEditor } from "custom-card-helpers";
import { fireEvent } from "custom-card-helpers";
import type { ESPrinklerCardConfig, ZoneConfig } from "./types";

// ha-form selectors are typed deep inside HA core; for a card editor we just
// pass the schema as data and let ha-form interpret it at runtime.
type HaFormSchema = readonly Record<string, unknown>[];

const LABELS: Record<string, string> = {
  title: "Card title",
  // Controller state
  state_entity: "Controller state",
  active_zone_entity: "Active zone",
  active_remaining_entity: "Active zone remaining",
  watering_entity: "Watering (binary)",
  next_run_entity: "Next scheduled run",
  // Controls
  start_button: "Start (button or switch)",
  stop_button: "Stop (button or switch)",
  pause_switch: "Pause / Resume switch",
  schedule_switch: "Schedule enabled switch",
  // Adjustments
  rain_delay_entity: "Rain delay (hours)",
  seasonal_adjust_entity: "Seasonal adjust (%)",
  // Zone map
  image: "Image URL or /local/ path",
  aspect_ratio: "Aspect ratio (e.g. 16/9)",
  // Zone
  name: "Display name",
  name_entity: "Live name entity (text.*)",
  valve: "Valve switch",
  enable: "Include in cycle switch",
  run: "Run button / switch",
  duration: "Duration entity (number)",
  active: "Active binary sensor",
  remaining: "Remaining seconds",
  map_position: "Zone-map pin position",
  x: "X (%)",
  y: "Y (%)",
};

const CONFIG_SCHEMA: HaFormSchema = [
  { name: "title", selector: { text: {} } },
  {
    name: "_controller",
    type: "expandable",
    flatten: true,
    title: "Controller state",
    icon: "mdi:sprinkler",
    schema: [
      { name: "state_entity",            selector: { entity: { domain: ["sensor"] } } },
      { name: "active_zone_entity",      selector: { entity: { domain: ["sensor"] } } },
      { name: "active_remaining_entity", selector: { entity: { domain: ["sensor"] } } },
      { name: "watering_entity",         selector: { entity: { domain: ["binary_sensor"] } } },
      { name: "next_run_entity",         selector: { entity: { domain: ["sensor"] } } },
    ],
  },
  {
    name: "_controls",
    type: "expandable",
    flatten: true,
    title: "Controls",
    icon: "mdi:gesture-tap-button",
    schema: [
      { name: "start_button",    selector: { entity: { domain: ["button", "switch"] } } },
      { name: "stop_button",     selector: { entity: { domain: ["button", "switch"] } } },
      { name: "pause_switch",    selector: { entity: { domain: ["switch"] } } },
      { name: "schedule_switch", selector: { entity: { domain: ["switch"] } } },
    ],
  },
  {
    name: "_adjustments",
    type: "expandable",
    flatten: true,
    title: "Adjustments",
    icon: "mdi:weather-cloudy-clock",
    schema: [
      { name: "rain_delay_entity",       selector: { entity: { domain: ["number"] } } },
      { name: "seasonal_adjust_entity",  selector: { entity: { domain: ["number"] } } },
    ],
  },
  {
    name: "zone_map",
    type: "expandable",
    title: "Zone-map overlay (optional)",
    icon: "mdi:map",
    schema: [
      { name: "image",        selector: { text: {} } },
      { name: "aspect_ratio", selector: { text: {} } },
    ],
  },
];

const ZONE_SCHEMA: HaFormSchema = [
  {
    type: "grid",
    schema: [
      { name: "name",        selector: { text: {} } },
      { name: "name_entity", selector: { entity: { domain: ["text", "sensor"] } } },
    ],
  },
  {
    type: "grid",
    schema: [
      { name: "valve",  selector: { entity: { domain: ["switch"] } } },
      { name: "enable", selector: { entity: { domain: ["switch"] } } },
    ],
  },
  {
    type: "grid",
    schema: [
      { name: "run",      selector: { entity: { domain: ["button", "switch"] } } },
      { name: "duration", selector: { entity: { domain: ["number"] } } },
    ],
  },
  {
    type: "grid",
    schema: [
      { name: "active",    selector: { entity: { domain: ["binary_sensor"] } } },
      { name: "remaining", selector: { entity: { domain: ["sensor"] } } },
    ],
  },
  {
    name: "map_position",
    type: "expandable",
    title: "Zone-map pin position (percent)",
    icon: "mdi:map-marker",
    schema: [
      {
        type: "grid",
        schema: [
          { name: "x", selector: { number: { min: 0, max: 100, step: 1, mode: "slider", unit_of_measurement: "%" } } },
          { name: "y", selector: { number: { min: 0, max: 100, step: 1, mode: "slider", unit_of_measurement: "%" } } },
        ],
      },
    ],
  },
];

@customElement("esprinkler-card-editor")
export class ESPrinklerCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: ESPrinklerCardConfig;

  public setConfig(config: ESPrinklerCardConfig): void {
    this._config = { ...config, zones: Array.isArray(config?.zones) ? config.zones : [] };
  }

  private _computeLabel = (schema: { name?: string; title?: string }): string => {
    if (schema.title) return schema.title;
    if (schema.name && LABELS[schema.name]) return LABELS[schema.name];
    return schema.name ?? "";
  };

  protected render(): TemplateResult | typeof nothing {
    if (!this._config || !this.hass) return nothing;
    const zones = this._config.zones ?? [];

    return html`
      <div class="root">
        <ha-form
          .hass=${this.hass}
          .data=${this._config}
          .schema=${CONFIG_SCHEMA}
          .computeLabel=${this._computeLabel}
          @value-changed=${this._configValueChanged}
        ></ha-form>

        <div class="section">
          <div class="section-header">
            <ha-icon icon="mdi:format-list-numbered"></ha-icon>
            <span class="section-title">Zones (${zones.length})</span>
            <ha-button @click=${this._addZone}>
              <ha-icon icon="mdi:plus" slot="icon"></ha-icon>
              Add zone
            </ha-button>
          </div>

          ${zones.length === 0
            ? html`<div class="empty">No zones configured. Click <strong>Add zone</strong> to start.</div>`
            : zones.map((zone, idx) => this._renderZone(zone, idx, zones.length))}
        </div>
      </div>
    `;
  }

  private _renderZone(zone: ZoneConfig, idx: number, total: number): TemplateResult {
    const label = this._zoneLabel(zone, idx);
    return html`
      <ha-expansion-panel outlined .header=${label} leftChevron>
        <div class="zone-toolbar" slot="header-action">
          <ha-icon-button
            label="Move up"
            ?disabled=${idx === 0}
            @click=${(ev: Event) => { ev.stopPropagation(); this._moveZone(idx, -1); }}
          >
            <ha-icon icon="mdi:arrow-up"></ha-icon>
          </ha-icon-button>
          <ha-icon-button
            label="Move down"
            ?disabled=${idx === total - 1}
            @click=${(ev: Event) => { ev.stopPropagation(); this._moveZone(idx, 1); }}
          >
            <ha-icon icon="mdi:arrow-down"></ha-icon>
          </ha-icon-button>
          <ha-icon-button
            label="Remove"
            @click=${(ev: Event) => { ev.stopPropagation(); this._removeZone(idx); }}
          >
            <ha-icon icon="mdi:delete-outline"></ha-icon>
          </ha-icon-button>
        </div>
        <ha-form
          .hass=${this.hass}
          .data=${zone}
          .schema=${ZONE_SCHEMA}
          .computeLabel=${this._computeLabel}
          @value-changed=${(ev: CustomEvent) => this._zoneValueChanged(idx, ev)}
        ></ha-form>
      </ha-expansion-panel>
    `;
  }

  private _zoneLabel(zone: ZoneConfig, idx: number): string {
    if (zone.name) return zone.name;
    if (zone.name_entity) {
      const live = this.hass?.states[zone.name_entity]?.state;
      if (live && live !== "unavailable" && live !== "unknown") return live;
    }
    if (zone.valve) {
      const friendly = this.hass?.states[zone.valve]?.attributes.friendly_name;
      if (friendly) return String(friendly);
    }
    return `Zone ${idx + 1}`;
  }

  private _configValueChanged(ev: CustomEvent): void {
    const data = ev.detail.value as Partial<ESPrinklerCardConfig>;
    // Strip empty zone_map so the card doesn't render an empty overlay.
    if (data.zone_map && !data.zone_map.image && !data.zone_map.aspect_ratio) {
      delete (data as { zone_map?: unknown }).zone_map;
    }
    this._fire({ ...this._config!, ...data, zones: this._config?.zones ?? [] });
  }

  private _zoneValueChanged(idx: number, ev: CustomEvent): void {
    const zones = [...(this._config?.zones ?? [])];
    const merged = { ...zones[idx], ...(ev.detail.value as ZoneConfig) };
    // Drop an empty map_position so card layout isn't confused by NaN pins.
    if (merged.map_position
        && (merged.map_position.x === undefined || merged.map_position.x === null)
        && (merged.map_position.y === undefined || merged.map_position.y === null)) {
      delete merged.map_position;
    }
    zones[idx] = merged;
    this._fire({ ...this._config!, zones });
  }

  private _addZone(): void {
    const zones = [...(this._config?.zones ?? []), {} as ZoneConfig];
    this._fire({ ...this._config!, zones });
  }

  private _removeZone(idx: number): void {
    const zones = [...(this._config?.zones ?? [])];
    zones.splice(idx, 1);
    this._fire({ ...this._config!, zones });
  }

  private _moveZone(idx: number, delta: number): void {
    const zones = [...(this._config?.zones ?? [])];
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= zones.length) return;
    [zones[idx], zones[newIdx]] = [zones[newIdx]!, zones[idx]!];
    this._fire({ ...this._config!, zones });
  }

  private _fire(config: ESPrinklerCardConfig): void {
    fireEvent(this, "config-changed", { config });
  }

  static styles = css`
    .root {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-top: 4px;
    }
    .section-title {
      flex: 1;
      font-weight: 500;
      color: var(--primary-text-color);
    }
    .section-header ha-icon {
      color: var(--secondary-text-color);
    }
    .empty {
      color: var(--secondary-text-color);
      font-size: 0.9rem;
      padding: 8px 4px;
    }
    ha-expansion-panel {
      --expansion-panel-summary-padding: 0 12px;
      --expansion-panel-content-padding: 12px;
    }
    .zone-toolbar {
      display: flex;
      align-items: center;
      gap: 0;
    }
    .zone-toolbar ha-icon-button {
      --mdc-icon-button-size: 36px;
      --mdc-icon-size: 18px;
    }
  `;
}
