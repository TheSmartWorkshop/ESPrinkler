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
# Controls (from the sprinkler: engine)
start_button: switch.esprinkler_sprinklers     # main switch acts as start
stop_button: switch.esprinkler_sprinklers
schedule_switch: switch.esprinkler_auto_advance
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

## Roadmap

- **v1 (now):** zone control + scheduling status, all entity-driven.
- **v2:** the **zone-map image overlay** — a satellite/sketch with draggable per-zone buttons
  (inherited in spirit from n0bel's original). A graphical config editor.

Precedent worth studying: [`EvotecIT/lovelace-lawn-mower-card`](https://github.com/EvotecIT/lovelace-lawn-mower-card).
