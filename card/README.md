# ESPrinkler Lovelace Card

The Home Assistant dashboard card for ESPrinkler — a **separate artifact** from the firmware,
on its **own release track**, distributed via **HACS**.

> **Status:** placeholder. No card code yet. This directory is reserved so the card lives in
> the same repo as the firmware (one project, two artifacts).

## What it is (and isn't)

- It's a **Lit** custom element that runs in the **browser** and talks to **HA core** — not to
  the device. It binds to the [entity contract](../docs/entity-contract.md); the firmware's
  only job is exposing clean entities.
- It is **not** bundled by the ESPHome build. ESPHome can't ship a frontend resource — so the
  card installs as a separate HACS step (this is the one spot a native Python integration would
  have an edge; see [architecture Decision 4](../docs/architecture.md)).

## Plan

- **v1:** scheduling controls + zone toggles. Likely achievable with stock cards +
  `button-card` + `card-mod`; ship a bespoke Lit card only if the **zone-map image overlay**
  (a satellite/sketch with draggable per-zone buttons — inherited in spirit from n0bel's
  original) proves central.
- **v2:** the bespoke Lit card with the zone-map overlay.

## Starting points

- Scaffold from `boilerplate-card` + the official custom-card devcontainer.
- Domain precedent: [`EvotecIT/lovelace-lawn-mower-card`](https://github.com/EvotecIT/lovelace-lawn-mower-card)
  — a purpose-built, domain-native card rather than a repurposed one.
