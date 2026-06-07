# ESPrinkler Lovelace Card

The Home Assistant dashboard card for ESPrinkler — a **separate artifact** from the firmware,
on its **own release track**, distributed via **HACS**.

It's a [Lit](https://lit.dev) custom element that runs in the browser and talks to HA core
(not the device). It binds to the [entity contract](../docs/entity-contract.md): give it the
controller's state entities and a list of zones, and it renders status, start/stop/pause,
the schedule toggle, and per-zone enable/run with live countdowns.

## Build

```bash
cd card
npm install
npm run build      # -> dist/esprinkler-card.js
npm run lint       # tsc --noEmit
```

`dist/esprinkler-card.js` is the single Lovelace resource. It's a build artifact (gitignored);
CI builds it and it ships as a GitHub release asset for HACS.

## Install (manual)

1. Copy `dist/esprinkler-card.js` to `config/www/esprinkler-card.js` in Home Assistant.
2. Add the resource (Settings → Dashboards → Resources):
   `/local/esprinkler-card.js` as a **JavaScript Module**.
3. Add the card to a dashboard (see config below).

## Card configuration

```yaml
type: custom:esprinkler-card
title: Sprinklers
# Controller-level (from the esprinkler: brain)
state_entity: sensor.esprinkler_state          # text_sensor -> sensor in HA
active_zone_entity: sensor.esprinkler_active_zone
active_remaining_entity: sensor.esprinkler_total_time_remaining
next_run_entity: sensor.esprinkler_next_run
schedule_switch: switch.esprinkler_schedule_enabled  # master arm/disarm
rain_delay_entity: number.esprinkler_rain_delay      # hours; write to delay
# Controls (from the sprinkler: engine)
start_button: switch.esprinkler_sprinklers     # main switch acts as start
stop_button: switch.esprinkler_sprinklers
zones:
  - name: Front Lawn
    valve: switch.esprinkler_front_lawn
    enable: switch.esprinkler_front_lawn_enabled
    run: button.esprinkler_front_lawn_run       # optional
    duration: number.esprinkler_front_lawn_duration
    active: binary_sensor.esprinkler_front_lawn_active
    remaining: sensor.esprinkler_front_lawn_remaining
  - name: Back Lawn
    valve: switch.esprinkler_back_lawn
    enable: switch.esprinkler_back_lawn_enabled
    duration: number.esprinkler_back_lawn_duration
    active: binary_sensor.esprinkler_back_lawn_active
    remaining: sensor.esprinkler_back_lawn_remaining
```

> Entity ids depend on your device's `friendly_name` and entity names. The examples above
> assume a device named `esprinkler`; adjust to match your HA entities.

### Zone-map overlay (v2)

Drop in a top-down photo or sketch of the yard, then position a clickable pin per zone with
percent coordinates. Pins highlight while their zone is watering and show the live countdown;
tapping one starts the zone.

```yaml
type: custom:esprinkler-card
# ...controller bindings as above...
zone_map:
  image: /local/yard.jpg     # any URL or local-path
  aspect_ratio: "16/9"       # optional; defaults to the image's natural ratio
zones:
  - name: Front Lawn
    valve: switch.esprinkler_front_lawn
    active: binary_sensor.esprinkler_front_lawn_active
    remaining: sensor.esprinkler_front_lawn_remaining
    map_position: { x: 25, y: 30 }
  - name: Back Lawn
    valve: switch.esprinkler_back_lawn
    active: binary_sensor.esprinkler_back_lawn_active
    remaining: sensor.esprinkler_back_lawn_remaining
    map_position: { x: 70, y: 65 }
```

Positions are in percent (0-100) so the layout scales with the card width. Zones without a
`map_position` are omitted from the overlay but still appear in the list view below it.

## Roadmap

- **v2 (now):** zone-map image overlay with positioned pins.
- **Next:** interactive position editor (drag pins, emit YAML); graphical config editor.

Precedent worth studying: [`EvotecIT/lovelace-lawn-mower-card`](https://github.com/EvotecIT/lovelace-lawn-mower-card).
