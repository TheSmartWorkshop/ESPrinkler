# ESPrinkler Hardware Guide

ESPrinkler doesn't hardcode a board — pins and board selection live in your YAML. But the
**display tier you choose sets a realistic floor on the board**, and the **zone count sets
how you wire the relays**. This guide covers both.

## Board tiers

| Tier | Board class | Drives | Notes |
| --- | --- | --- | --- |
| Headless / status | Any ESP32 (incl. **ESP32-C3**, S2) | relays + HA + scheduler | Cheapest. No screen, or a tiny OLED. |
| OLED | Any ESP32 with 2 free I²C pins | relays + mono OLED | SSD1306/SH1106 128×64 is the sweet spot. |
| Color touchscreen | **ESP32-S3 with PSRAM** (recommended) | relays + LVGL color touch | LVGL framebuffers want PSRAM and ample flash. A bare C3 will struggle. |

> The wiki has board/variant gotcha notes for the **Seeed XIAO ESP32-C3** and **ESP32-S2**
> (ESPHome needs the right `board:` + `variant:` for each) — consult those when targeting them.

## Relays / valve outputs

Irrigation valves are typically **24 VAC** solenoids, so the ESP32 never switches them
directly — it drives a relay or a triac/solid-state board.

- **Direct GPIO** — fine for a handful of zones. Each zone = one `output` → `switch`.
  → use `packages/relays-gpio.yaml`.
- **I/O expander** — once you pass the comfortable GPIO count (especially on pin-starved
  boards like the C3), use an **MCP23017** (16 ch, I²C) or **PCF8574/PCF8575**. ESPHome has
  native components for these; zones bind to expander pins exactly like GPIO.
  → use `packages/relays-mcp23017.yaml`.
- **Shift registers** (74HC595) are an option for very high channel counts; not packaged yet.

### Active-high vs active-low

Many relay boards are **active-low** (a LOW input energizes the relay). Set `inverted: true`
on the `output`/`switch` accordingly. This is a per-board wiring fact, exposed as config.

## Pump / master valve

If your system has a pump or a normally-closed master valve, wire it to one more output and
declare it as the `master_output`. ESPrinkler energizes it alongside any active zone, with
configurable lead/lag (`pump_start_delay` / `pump_stop_delay`) so the line pressurizes before
a zone valve opens and relieves after it closes.

## Displays

| Type | Bus | Example controllers | Package |
| --- | --- | --- | --- |
| Mono OLED | I²C | SSD1306, SH1106 | `packages/display-oled.yaml` |
| Color TFT touch | SPI (+ touch) | ILI9341, ST7789, GC9A01; XPT2046/FT6x36 touch | `packages/display-lvgl.yaml` |

The OLED package renders status + a simple zone/menu view. The LVGL package provides a full
touch UI (zone tiles, run/stop, schedule editing). Both bind to the [entity
contract](entity-contract.md) — they read controller/zone state, they don't compute it.

> **Power note for outdoor installs:** 24 VAC irrigation transformers are common; a small
> AC→5 V buck (or a separate 5 V supply) powers the ESP32 + relay board. Enclosure and power
> are installer concerns, not firmware — ESPrinkler stays indifferent to indoor vs. outdoor.
