# ESPrinkler Entity Contract

**Contract version: `0.1.0-draft`**

This is the single most important document in the project. It defines the **stable set of
entities and state** that the ESPrinkler `external_component` exposes — the interface that
*every* consumer binds to:

- **Home Assistant** (automations, the recorder, voice)
- the **Lovelace card** (`card/`, runs in the browser, talks to HA core)
- the on-device **OLED** UI (`packages/display-oled.yaml`)
- the on-device **LVGL touchscreen** UI (`packages/display-lvgl.yaml`)

Because four surfaces depend on it, the contract is **versioned and changed deliberately**.
Additive changes (new entities) bump the minor version; renames/removals/semantic changes
bump the major version and are called out in `CHANGELOG`.

---

## Conventions

- **`id`** — the ESPHome C++ id, used in lambdas and by the on-device displays. Stable,
  snake_case, prefixed `esp_`. This is the binding handle for OLED/LVGL.
- **Name** — the Home Assistant friendly name. Defaults are given below and are
  **user-overridable** in YAML. The HA `entity_id` derives from the name.
- **Zone index `i`** is **1-based** and matches the order zones are declared in config.
- Durations the *user* sets are in **minutes**; live countdowns are exposed in **seconds**
  (HA renders both fine, and seconds are friendlier for display math).
- Entities marked **(opt)** only exist when the corresponding feature is configured.
- "Backed by" notes whether the entity is provided by ESPHome's stock `sprinkler`
  component, by the ESPrinkler brain, or composed from both.

---

## 1. Controller-level entities (singletons)

| Logical entity | Domain | `id` | Default name | Semantics | Backed by |
| --- | --- | --- | --- | --- | --- |
| Controller state | `text_sensor` | `esp_state` | "State" | enum: `idle`, `running`, `paused`, `manual`, `rain_delay` | brain |
| Active zone | `text_sensor` | `esp_active_zone` | "Active Zone" | name of the running zone, or `—` | brain |
| Watering | `binary_sensor` | `esp_watering` | "Watering" | `on` whenever any valve is open | brain |
| Active-zone remaining | `sensor` (s) | `esp_active_remaining` | "Time Remaining" | countdown for the running zone | sprinkler |
| Total remaining | `sensor` (s) | `esp_total_remaining` | "Total Time Remaining" | sum across the queued run | brain |
| Schedule enabled | `switch` | `esp_schedule_enabled` | "Schedule Enabled" | master enable for automatic runs | brain |
| Start full cycle | `button` | `esp_start_cycle` | "Start Cycle" | run all enabled zones in sequence | sprinkler |
| Stop | `button` | `esp_stop` | "Stop" | stop everything, clear the queue | sprinkler |
| Paused | `switch` | `esp_paused` | "Paused" | pause/resume the active run | sprinkler |
| Repeat cycles | `number` | `esp_repeat` | "Repeat" | extra full-cycle repeats (0–N) | sprinkler |
| Seasonal adjust | `number` (%) | `esp_multiplier` | "Seasonal Adjust" | scales every zone duration, 0–200 % | sprinkler |
| Reverse order | `switch` | `esp_reverse` | "Reverse" | run the queue back-to-front | sprinkler |
| Rain delay | `number` (h) | `esp_rain_delay` | "Rain Delay" | suspend the schedule for N hours | brain |
| Next run | `text_sensor` (opt) | `esp_next_run` | "Next Run" | human string for the next scheduled start | scheduler |

---

## 2. Per-zone entities (×N)

For each zone `i` (1-based). Default names use the zone's configured `name` when set,
otherwise "Zone i".

| Logical entity | Domain | `id` | Default name | Semantics | Backed by |
| --- | --- | --- | --- | --- | --- |
| Valve | `switch` | `esp_zone_{i}_valve` | "Zone i" | the physical output (raw on/off) | sprinkler→output |
| Enabled | `switch` | `esp_zone_{i}_enabled` | "Zone i Enabled" | include this zone in automatic cycles | sprinkler |
| Run | `button` | `esp_zone_{i}_run` | "Zone i Run" | manually run this zone for its duration | sprinkler |
| Duration | `number` (min) | `esp_zone_{i}_duration` | "Zone i Duration" | per-zone run length | sprinkler |
| Active | `binary_sensor` | `esp_zone_{i}_active` | "Zone i Active" | this zone is currently watering | brain |
| Remaining | `sensor` (s) | `esp_zone_{i}_remaining` | "Zone i Remaining" | countdown when active, else 0 | brain |

**Zone configuration metadata** (set in YAML, not separate entities):

- `name` — display name (drives default entity names).
- `flow_type` — `sprinkler` \| `drip`. Affects default duration, UI iconography, and
  grouping; it does **not** branch the core relay logic.
- `output` — the GPIO/expander pin (or `output` id) the valve is wired to.

---

## 3. Pump / master valve (opt)

Enabled when a master output is configured.

| Logical entity | Domain | `id` | Default name | Semantics | Backed by |
| --- | --- | --- | --- | --- | --- |
| Master active | `binary_sensor` | `esp_master_active` | "Master / Pump" | energized while any zone runs | sprinkler |

Config: `master_output`, plus `pump_start_delay` / `pump_stop_delay` (lead/lag in seconds)
so the pump or master valve can settle before/after a zone valve actuates.

---

## 4. Scheduler entities (on-device, opt)

The schedule lives **on the device** so watering continues if HA is offline. The schedule
is editable at runtime through HA-native entities (no recompile to change times). v1 models
one or more **programs**; each program is a start time + day mask, and runs the currently
*enabled* zones for their configured durations.

For each program `p`:

| Logical entity | Domain | `id` | Default name | Semantics |
| --- | --- | --- | --- | --- |
| Start time | `datetime`/`time` | `esp_prog_{p}_time` | "Program p Time" | time-of-day the cycle starts |
| Enabled | `switch` | `esp_prog_{p}_enabled` | "Program p Enabled" | arm/disarm this program |
| Days | `select` or 7× `switch` | `esp_prog_{p}_days` | "Program p Days" | day-of-week mask |

> **Design note.** ESPHome's stock `sprinkler` handles *sequencing* but not calendar
> scheduling. The ESPrinkler brain owns the scheduler: it watches `time:` + the `datetime`
> entities above and triggers `start_cycle` when a program matches. This is the main piece
> of native logic the project adds on top of `sprinkler`. The exact entity shape for "days"
> (a multi-select vs. seven switches) is **still open** — see open questions.

---

## 5. State model (what the displays read)

The OLED and LVGL UIs should never re-derive state — they read these directly:

- **Controller state** (`esp_state`) → top-level screen/mode.
- **Active zone + remaining** (`esp_active_zone`, `esp_active_remaining`) → the "now watering"
  banner / progress ring.
- **Per-zone enabled + duration** → the zone list / schedule editor screens.
- **Next run** (`esp_next_run`) → idle screen.
- **Watering** (`esp_watering`) → backlight / status LED behavior.

Anything a display needs that isn't here is a signal the contract is incomplete — extend the
contract first, then bind the UI.

---

## Open questions

- **Programs in v1:** how many, and is a per-program *zone subset* needed, or is the global
  per-zone "enabled" switch enough? (Leaning: global enable for v1, per-program subsets v2.)
- **Day-of-week representation:** `select` (presets like "Everyday / Even / Odd / Mon-Wed-Fri")
  vs. seven `switch` entities (fully flexible, noisier entity list).
- **Flow sensor / rain sensor input:** expose as a gating `binary_sensor` (`esp_flow_ok`)?
  Deferred until a concrete sensor is in scope.
- **Per-zone flow metering** (gallons) — out of scope for v1, but reserve the naming
  `esp_zone_{i}_flow` so we don't paint ourselves into a corner.
