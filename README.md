# ESPrinkler

A flexible, **ESPHome-based multi-zone irrigation controller** for the ESP32, built to
integrate natively with **Home Assistant** — and to run your watering schedule entirely
on-device, with or without HA online.

> **Status:** early scaffolding. The repository layout, the [entity contract](docs/entity-contract.md),
> and the architecture are defined; the C++ component and YAML packages are stubs under
> active development. Nothing here flashes a working controller *yet*.

## What it is

ESPrinkler is **not a single firmware image** — it's a kit you compose with ESPHome:

- a version-controlled C++ **`external_component`** (the irrigation "brain"), layered on
  top of ESPHome's stock [`sprinkler`](https://esphome.io/components/sprinkler.html) component;
- a set of composable **YAML packages** (relays, displays, board profiles) you mix into
  your device config;
- ready-made **on-device display UIs** — a monochrome **OLED** page set and a full-color
  **LVGL touchscreen** UI — that bind to the entity contract out of the box;
- a separate **Home Assistant Lovelace card** (Lit, distributed via HACS) for the browser.

Everything physical is a **configuration point**, not a hardcoded assumption:

| Aspect | How it's handled |
| --- | --- |
| Zone count | A config list that drives the pin → relay mapping. Any N. |
| Relay wiring | Direct GPIO **or** I/O expanders (MCP23017 / PCF857x) for high zone counts. |
| Drip vs. sprinkler | Per-zone flow type — affects defaults & UI, not the core logic. Both supported. |
| Pump / master valve | Optional master output with configurable lead/lag. |
| Target board | No board is hardcoded; pins/board live in your YAML. Profiles ship per board class. |
| Display | Optional. None / OLED / color touchscreen, all driven from the same state. |

## Three UI surfaces, one contract

The HA card, the OLED, and the touchscreen are all **consumers of the same entity/state
contract**. That contract is the keystone of the whole project — get it right once and all
three surfaces (plus HA automations) fall out cleanly. See
**[`docs/entity-contract.md`](docs/entity-contract.md)**.

## Repository layout

```
components/esprinkler/   The C++ external_component (irrigation brain) + ESPHome config schema
packages/                Composable YAML: core, relays, displays, board profiles
examples/                Ready-to-adapt device configs (headless / OLED / touchscreen)
card/                    The Home Assistant Lovelace card (separate release track, HACS)
docs/                    Architecture, the entity contract, and hardware guidance
```

## Getting started

> Not usable yet — this section describes the intended flow once the component lands.

1. Add ESPrinkler as an external component and pull in the core package:
   ```yaml
   external_components:
     - source: github://TheSmartWorkshop/ESPrinkler@main
       components: [esprinkler]

   packages:
     esprinkler_core: github://TheSmartWorkshop/ESPrinkler/packages/core.yaml@main
   ```
2. Declare your zones, relay wiring, and (optionally) a display. Start from a file in
   [`examples/`](examples/).
3. Install the Lovelace card separately via HACS (see [`card/`](card/README.md)).

## Hardware

See [`docs/hardware.md`](docs/hardware.md) for board tiers (a $3 ESP32-C3 happily drives the
headless/OLED core; a color LVGL touchscreen wants an ESP32-S3 with PSRAM), relay options,
and I/O expander wiring.

## Credit

ESPrinkler reuses the name from **Kevin Uhlir's (n0bel)** original
[`ESPrinkler`](https://github.com/n0bel/ESPrinkler) and
[`ESPrinkler2`](https://github.com/n0bel/ESPrinkler2) (MIT-licensed, ESP8266-era). Those
projects are this one's spiritual predecessors. None of their code is forked — the design
here is ESPHome-native from the ground up — but the zone-map UI idea and the
independent-operation goal are inherited in spirit. Thanks, n0bel.

## License

[MIT](LICENSE).
