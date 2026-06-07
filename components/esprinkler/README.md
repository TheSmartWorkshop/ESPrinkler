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

## Intended usage

```yaml
external_components:
  - source: github://TheSmartWorkshop/ESPrinkler@main
    components: [esprinkler]

esprinkler:
  zones:
    - name: "Front Lawn"
      output: relay_1
      flow_type: sprinkler
      default_duration: 15min
    - name: "Garden Drip"
      output: relay_2
      flow_type: drip
      default_duration: 30min
  master_output: pump_relay
  pump_start_delay: 3s
  scheduler:
    programs:
      - start_time: "06:00:00"
        days: [mon, wed, fri]
```

(The `relay_*` / `pump_relay` outputs come from a relay package — see `packages/`.)
