# ESPrinkler Entity Contract

**Contract version: `0.2.0`** — reconciled with the shipping implementation.

This is the single most important document in the project. It defines the **entities and
state** that an ESPrinkler device exposes — the interface that *every* consumer binds to:

- **Home Assistant** (automations, recorder, voice)
- the **Lovelace card** (`card/`, runs in the browser, talks to HA core)
- the on-device **OLED** UI (`packages/display-oled.yaml`)
- the on-device **LVGL touchscreen** UI (`packages/display-lvgl.yaml`)

An ESPrinkler device is built from **two cooperating blocks** (see `examples/`):

- a stock **`sprinkler:`** controller — the *engine* (sequencing, durations, pump); it
  auto-creates most of the user-facing control entities.
- the **`esprinkler:`** brain — the *scheduler* + a *unified state model* the displays and
  card read.

So the contract has two halves: entities the **engine** creates, and entities the **brain**
adds. Because four surfaces depend on this surface, it is versioned and changed deliberately.

---

## Conventions

- **`id`** — the ESPHome C++ id, used in display lambdas. The brain's state entities use a
  documented id convention (below) so the display packages can bind to them.
- **Name** — the Home Assistant friendly name; set in YAML, drives the HA `entity_id`.
- **Zone index `i`** is the order valves are declared in the `sprinkler:` block; the brain's
  `zones:` list must be given in the same order.
- Durations are entered in **minutes** (the run-duration number uses `unit_of_measurement:
  min`, which `sprinkler` converts internally); live countdowns are exposed in **seconds**.

---

## 1. Engine entities (created by `sprinkler:`)

Named by the user in the `sprinkler:` block. These already satisfy most of the control
surface, so the brain does not duplicate them.

| Logical entity | Domain | sprinkler key | Notes |
| --- | --- | --- | --- |
| Main switch | `switch` | `main_switch` | start/stop the whole controller |
| Auto-advance | `switch` | `auto_advance_switch` | run zones as a sequence |
| Reverse | `switch` | `reverse_switch` | run the queue back-to-front |
| Seasonal adjust | `number` | `multiplier_number` | scales every zone duration |
| Repeat | `number` | `repeat_number` | extra full-cycle repeats |
| Zone valve | `switch` | per-valve `valve_switch` | logical on/off for zone *i* |
| Zone enable | `switch` | per-valve `enable_switch` | include zone *i* in auto cycles |
| Zone duration | `number` | per-valve `run_duration_number` | per-zone run length (min) |

Manual single-zone runs, pause/resume, and "start full cycle" are available as
**`sprinkler.*` actions** (used by the displays' buttons and exposable as HA `button`s).

---

## 2. Brain entities (created by `esprinkler:`)

The net-new state model. The recommended `id`s (used by the display packages) are shown;
override the names freely.

| Logical entity | Domain | recommended `id` | esprinkler key | Semantics |
| --- | --- | --- | --- | --- |
| Controller state | `text_sensor` | `esp_state` | `state` | `idle` / `running` / `manual` / `paused` |
| Active zone | `text_sensor` | `esp_active_zone` | `active_zone` | name of the running zone, or `—` |
| Next run | `text_sensor` | `esp_next_run` | `next_run` | e.g. `Today 06:00`, `Tomorrow 05:30` |
| Total remaining | `sensor` (s) | `esp_total_remaining` | `total_remaining` | active valve + queued time |

### Per-zone (brain), for each `zones:` entry

| Logical entity | Domain | esprinkler key | Semantics |
| --- | --- | --- | --- |
| Active | `binary_sensor` | `zones[i].active` | this zone is currently watering |
| Remaining | `sensor` (s) | `zones[i].remaining` | seconds left when active, else 0 |

Each zone also carries a `flow_type` (`sprinkler` \| `drip`) — currently metadata for the UI
(grouping/iconography); it does not branch the core logic.

---

## 3. Scheduler (brain, on-device)

The schedule lives on the device so watering continues if HA is offline. Configured under
`esprinkler: scheduler: programs:`. Each program is a **start time** + a **day-of-week mask**
and triggers `start_full_cycle()` on the engine (which runs every *enabled* zone for its
configured duration).

```yaml
scheduler:
  programs:
    - start_time: "06:00"      # "HH:MM" or "HH:MM:SS"
      days: [mon, wed, fri]    # day names, or a preset: everyday / weekdays / weekends
      enabled: true
```

A `time:` source is required when programs are present (the example configs include both
`homeassistant` and `sntp` so the schedule survives an HA outage).

---

## 4. State model (what the displays read)

The OLED and LVGL UIs never re-derive state — they read the brain's entities directly via the
`esp_*` ids:

- `esp_state` → top-level mode (idle vs. watering).
- `esp_active_zone` + `esp_total_remaining` → the "now watering" line / progress.
- `esp_next_run` → the idle screen.

Anything a display needs that isn't here means the contract is incomplete — extend the brain
first, then bind the UI.

---

## Not yet implemented (reserved)

These appear in the long-term design but are **not** in `0.2.0`; they're listed so names stay
stable when added:

- **Rain delay** (`number`, hours) — suspend the schedule. Planned brain entity `esp_rain_delay`.
- **Schedule-enabled** master switch — a global arm/disarm above per-program `enabled`.
  (For now, toggle programs individually, or gate via an HA automation.) Planned `esp_schedule_enabled`.
- **Per-zone flow metering** (`esp_zone_{i}_flow`, gallons) — out of scope for v1.
- **Flow / rain sensor gating** input (`esp_flow_ok`).

## Open questions

- **Day-of-week UX on-device:** presets (everyday/weekdays/weekends) are supported in YAML; a
  runtime-editable day picker on the touchscreen is a v2 LVGL task.
- **Multiple programs & per-program zone subsets:** v1 runs the globally-enabled zones for
  every program; per-program zone selection is deferred.
