# `esprinkler` component

The irrigation brain, as an ESPHome `external_component`. Layered on top of the stock
[`sprinkler`](https://esphome.io/components/sprinkler.html) component.

> **Scaffolding.** The config schema (`__init__.py`) sketches the configuration points;
> the C++ (`esprinkler.h` / `.cpp`) is a shell. Not functional yet.

## Responsibilities

- Turn YAML config (zones, pump/master valve, scheduler) into wired-up sprinkler valves.
- Own the **on-device scheduler** (time-of-day + day-of-week → start a cycle) — the main
  net-new logic, since the stock `sprinkler` component sequences but doesn't do calendar.
- Coordinate the **pump/master valve** lead-lag.
- Publish the **state model** (controller state, active zone, remaining) that the OLED and
  LVGL displays bind to.
- Expose the entities defined in [`../../docs/entity-contract.md`](../../docs/entity-contract.md).

## Usage

ESPrinkler layers on a stock `sprinkler:` controller — declare that (the engine), then point
`esprinkler:` (the brain) at it with `sprinkler_id`:

```yaml
external_components:
  - source: github://TheSmartWorkshop/ESPrinkler@main
    components: [esprinkler]

time:
  - platform: sntp
    id: sntp_time

# Relay/valve switches come from a relay package; see packages/relays-gpio.yaml.
switch:
  - { platform: gpio, id: relay_1, pin: GPIO16, internal: true }
  - { platform: gpio, id: relay_2, pin: GPIO17, internal: true }

sprinkler:                      # the engine
  - id: yard
    main_switch: "Sprinklers"
    auto_advance_switch: "Auto Advance"
    valves:
      - { valve_switch: "Front Lawn", enable_switch: "Front Lawn Enabled", valve_switch_id: relay_1, run_duration_number: { name: "Front Lawn Duration", initial_value: 15, unit_of_measurement: min } }
      - { valve_switch: "Garden Drip", enable_switch: "Garden Drip Enabled", valve_switch_id: relay_2, run_duration_number: { name: "Garden Drip Duration", initial_value: 30, unit_of_measurement: min } }

esprinkler:                     # the brain
  sprinkler_id: yard
  time_id: sntp_time
  state: { name: "State", id: esp_state }
  active_zone: { name: "Active Zone", id: esp_active_zone }
  next_run: { name: "Next Run", id: esp_next_run }
  total_remaining: { name: "Total Time Remaining", id: esp_total_remaining }
  zones:
    - { name: "Front Lawn", flow_type: sprinkler, active: { name: "Front Lawn Active" }, remaining: { name: "Front Lawn Remaining" } }
    - { name: "Garden Drip", flow_type: drip, active: { name: "Garden Drip Active" }, remaining: { name: "Garden Drip Remaining" } }
  scheduler:
    programs:
      - start_time: "06:00"
        days: [mon, wed, fri]   # or a preset: everyday / weekdays / weekends
```

See [`examples/`](../../examples/) for complete, validated device configs (headless, OLED,
touchscreen). The brain's `zones:` must be listed in the same order as the engine's `valves:`.
