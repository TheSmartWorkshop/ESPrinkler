# ESPrinkler Architecture

The decisions below were made during project planning and are the foundation the build rests
on. They're captured here so the repo is self-contained.

## What it is

An ESPHome-based, multi-zone irrigation controller (ESP32) that integrates natively with
Home Assistant and runs its schedule on-device. The name is reused (with credit) from
Kevin Uhlir's (n0bel) abandoned ESP8266-era projects; **no code is forked**.

## Decision 1 — Build fresh; don't fork the old repos

`n0bel/ESPrinkler` (bare Espressif) and `n0bel/ESPrinkler2` (Arduino) are standalone sketches
with their own embedded web server, scheduler, NTP client, and a jQuery/Foundation5 UI served
from SPIFFS. Latest release is the June 2017 "First Beta"; deps are ancient. Nothing ports
cleanly to an ESPHome design — scheduling, UI, time handling, and relay logic are all replaced
by ESPHome + HA primitives. **Salvaged as ideas only:** the zone-map image-overlay UI, the
schedule data model, and the independent-operation goal. (Both old repos are MIT, so credit +
any future snippet reuse is legally fine.)

## Decision 2 — Build on ESPHome, not native firmware

- ESPHome **generates C++** against the same Arduino/ESP-IDF frameworks; `lambda`, custom
  components, and `external_components` are escape hatches, so there's no real loss of power.
- ESPHome **owns the incidental ~85%** that isn't irrigation logic — WiFi/reconnect, OTA, NTP,
  provisioning, web server, HA integration — and maintains it (incl. security patches). That's
  exactly the part that rotted in ESPrinkler2.
- ESPHome's **native API** gives encrypted, auto-discovered HA entities with zero glue. Native
  firmware would mean a hand-rolled MQTT discovery schema or a custom HA integration.
- **Myth killed:** ESPHome does *not* need HA to run. Automations execute on-device and the
  `sprinkler` component sequences locally — so "must keep watering if the network is down" is
  **not** a reason to go native.

## Decision 3 — Irrigation brain as an `external_component`

The irrigation logic is a version-controlled C++ `external_component` in this repo, layered on
top of / alongside ESPHome's stock `sprinkler` component (which already nails arbitrary zones,
sequencing, durations, pump/master-valve coordination, and enable/disable switches). Users pull
it via an `external_components:` block plus a short YAML snippet. The brain's main net-new job
is the **on-device scheduler** (calendar/day-of-week → `start_cycle`), which `sprinkler` does
not provide.

## Decision 4 — Home Assistant dashboard card (separate artifact)

The Lovelace card is a **separate layer from firmware** — a Lit custom element that runs in the
browser and talks to HA core, not the device. The firmware's only job is exposing clean,
well-named entities (the [entity contract](entity-contract.md)); the card binds to whatever HA
has.

- **Two artifacts, two release tracks, one git repo:** (a) firmware + `external_component` via
  `external_components:`; (b) the card as a compiled `.js` Lovelace resource via HACS — a
  separate install step to document.
- This is the one spot ESPHome is *worse* than a native Python integration (which can serve and
  auto-register its own card). ESPHome can't bundle a frontend resource.
- Precedent worth studying: `EvotecIT/lovelace-lawn-mower-card` (purpose-built, domain-native).
  Start from `boilerplate-card` + the official custom-card devcontainer.
- **Scoping:** a bespoke Lit card is justified if the **zone-map image overlay** is central.
  If the need is mostly scheduling + zone toggles, stock cards + `button-card` + `card-mod` get
  far — ship the custom Lit card as v2.

## Decision 5 — Flexibility is the product (not a single yard)

Everything physical is a **configuration point**, not a hardcoded assumption: zone count drives
the pin→relay mapping; drip and sprinkler are both supported (per-zone flow type); pump/master
valve is optional; and no specific ESP32 board is baked in. The deliverable is a **generic,
distributable kit**, not a build for one installation.

## Decision 6 — On-device displays are first-class

ESPrinkler ships **ready-made display UIs**: a monochrome OLED page set and a full-color **LVGL**
touchscreen UI, both optional and both binding to the entity contract. This adds a third and
fourth UI surface (alongside HA and the card). The contract is what keeps them in sync — every
surface reads the same state rather than re-deriving it.

See [hardware.md](hardware.md) for the board tiers this implies (OLED runs anywhere; LVGL color
touch wants an ESP32-S3 with PSRAM).

## Layered view

```
                         ┌─────────────────────────────────────────┐
   Home Assistant  ◄────►│  ESPHome native API (encrypted, discovery)│
   + Lovelace card       └─────────────────────────────────────────┘
   (HACS, browser)                         ▲
                                           │  entity contract
                          ┌────────────────┴─────────────────┐
                          │  ESPrinkler external_component     │
                          │  • scheduler (net-new)             │
                          │  • zone/pump orchestration         │
                          │  • state model for displays        │
                          └────────────────┬─────────────────┘
                                           │ layered on
                          ┌────────────────┴─────────────────┐
                          │  ESPHome stock `sprinkler` + core  │
                          │  (sequencing, OTA, WiFi, NTP, web) │
                          └────────────────┬─────────────────┘
                  ┌────────────────────────┼────────────────────────┐
              GPIO / I/O expander       OLED display            LVGL touchscreen
              relays (valves)        (packages/display-oled)   (packages/display-lvgl)
```
