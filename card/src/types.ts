import { LovelaceCardConfig } from "custom-card-helpers";

/** Percent-based (0-100) position on the zone-map image. */
export interface MapPosition {
  x: number;
  y: number;
}

/** A single zone's entity bindings (entity contract: per-zone entities). */
export interface ZoneConfig {
  /** Static display name. If unset, falls back to `name_entity` (if any),
   *  then to the valve's friendly_name, then to "Zone". */
  name?: string;
  /** text.* — a user-editable zone label (template text entity on the
   *  firmware side). When set, this entity's value is shown in place of the
   *  static name and updates live as the user renames in HA or the
   *  ESPHome web UI. */
  name_entity?: string;
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
  /** Position on the zone-map image, in percent (0-100). When set and a
   *  zone_map is configured on the card, a pin is rendered at this spot. */
  map_position?: MapPosition;
}

/** Optional zone-map image overlay (card v2). */
export interface ZoneMapConfig {
  /** URL or local-path image. Usually a top-down photo or diagram of the yard. */
  image: string;
  /** Optional aspect ratio (e.g. "4/3", "16/9"); defaults to the image's natural ratio. */
  aspect_ratio?: string;
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
  /** Optional image-overlay layer. When set, zones with a `map_position` are
   *  pinned on the image and clickable. The list view is still rendered below. */
  zone_map?: ZoneMapConfig;
  zones: ZoneConfig[];
}
