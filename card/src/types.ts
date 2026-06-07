import { LovelaceCardConfig } from "custom-card-helpers";

/** A single zone's entity bindings (entity contract: per-zone entities). */
export interface ZoneConfig {
  name?: string;
  /** switch.* — the valve (raw on/off). */
  valve?: string;
  /** switch.* — include this zone in automatic cycles. */
  enable?: string;
  /** button.* — manually run this zone for its duration. */
  run?: string;
  /** number.* — per-zone run length (minutes). */
  duration?: string;
  /** binary_sensor.* — this zone is currently watering. */
  active?: string;
  /** sensor.* — seconds remaining when active. */
  remaining?: string;
}

/** Card config. Mirrors the controller-level + per-zone entity contract. */
export interface ESPrinklerCardConfig extends LovelaceCardConfig {
  title?: string;
  /** text_sensor.* — controller state (idle/running/paused/manual/rain_delay). */
  state_entity?: string;
  /** text_sensor.* — name of the running zone. */
  active_zone_entity?: string;
  /** sensor.* — seconds remaining for the active zone. */
  active_remaining_entity?: string;
  /** binary_sensor.* — any valve open. */
  watering_entity?: string;
  /** text_sensor.* — human string for the next scheduled start. */
  next_run_entity?: string;
  /** button.* — start a full cycle. */
  start_button?: string;
  /** button.* — stop everything. */
  stop_button?: string;
  /** switch.* — pause/resume. */
  pause_switch?: string;
  /** switch.* — master schedule enable. */
  schedule_switch?: string;
  /** number.* — rain delay in hours. */
  rain_delay_entity?: string;
  /** number.* — seasonal adjust percentage. */
  seasonal_adjust_entity?: string;
  zones: ZoneConfig[];
}
