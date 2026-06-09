# 2-Zone Enclosure (snap-fit lid, top-mount controls)

A 3D-printable enclosure for a minimum-viable ESPrinkler build: **ESP32-C3**,
**OLED 128x64**, **rotary encoder + push button**, **2-channel relay**.
Mounts plaque-style: the bottom sits flat against the drywall and the lid —
display, knob, and engraved branding — faces the room. Hang it rotated so the
**OLED sits upper-right and the knob upper-left**; the engraving is oriented
for exactly that position (it reads upside-down in the model's plan view on
purpose), and the cable slot ends up facing down for a clean wire drop. The
lid snaps closed — no fasteners.

![closed](img/closed.png)

![exploded](img/exploded.png)

## Files

- [`skp/enclosure-2zone-closed.skp`](skp/enclosure-2zone-closed.skp) — assembled view
- [`skp/enclosure-2zone-exploded.skp`](skp/enclosure-2zone-exploded.skp) — lid raised, components visible

Open in SketchUp (desktop or Web). To produce STLs for printing, select the
**Chassis** and **Lid** groups and use `File → Export → 3D Model → STL`.

## External envelope

| Dimension | Inches | mm |
| --- | --- | --- |
| Width (X), body | 4.50 | 114 |
| Width including screw tabs | 5.70 | 145 |
| Depth (Y) | 3.00 | 76 |
| Height (Z), body | 1.45 | 37 |
| Wall / lid thickness | 0.10 | 2.5 |

The rotary knob adds ~0.65" above the lid.

## Two printable parts — no lid fasteners

### Chassis

Open-top tray, walls 0.10" thick.

| Face | Feature | Dimensions | Location |
| --- | --- | --- | --- |
| Right | USB-C access | 0.55w x 0.35h | Y 2.025–2.575, Z 0.40–0.75 |
| Back | Wire entry slot | 1.50w x 0.20h | X 1.50–3.00, Z 0.20–0.40 |
| Front + Back | Snap windows (2 each) | 0.34w x 0.07h | X 1.13–1.47 & 3.03–3.37, Z 1.13–1.20 |
| Left | — (smooth) | — | — |

**Exterior wall-mount screw tabs:** one per side, lying flat in the plane of
the bottom plate (0.60 x 0.70 x 0.16", hole dia 0.18" / 4.6 mm). With the
bottom against the drywall, a common **#6 drywall screw** drives straight
through each tab into the wall — no need to open the case to mount it.

Interior standoffs (cylindrical posts, 0.18" tall):

- **4 relay-module standoffs** for a generic 2-channel relay module
  (~50 x 39 mm PCB).
- **2 ESP32-C3 standoffs** at the non-USB end of the XIAO board, aligned so
  the USB-C jack faces the right-wall cutout.

### Lid

Flat plate, 0.10" thick, with a snap lip frame underneath.

| Feature | Dimensions | Location on lid |
| --- | --- | --- |
| OLED window | **25 x 17 mm** (0.984 x 0.669) | centered (X 1.15, Y 0.75) |
| Rotary shaft hole | **dia 7 mm** (0.276) | (X 3.40, Y 0.75) |
| Encoder body recess (underside) | **13 x 13 mm, 1 mm deep** | centered on shaft hole |
| Engraved text + logo (top) | 0.6 mm deep | back half of the lid |

- The **encoder recess** captures the square EC11 body so the encoder can't
  rotate or wander — the bushing nut just snugs it, it doesn't position it.
- **4 OLED bosses** (4 mm OD, 2.5 mm long) with **1.4 mm dia pegs** (2.5 mm
  long) hang from the underside on the standard 23 x 23 mm hole pattern of a
  0.96" SSD1306 module. The PCB seats on the boss shoulders with the pegs
  through its corner holes; melt the peg tips with a soldering iron to stake,
  or leave as a friction fit.
- **Snap-fit:** a perimeter lip frame (0.12" wide, 0.25" deep) drops inside
  the walls; four wedge bumps on the lip's front/back faces click into the
  matching wall windows. Press the lid straight down to close. To open, press
  the bumps inward through the windows (visible as two small slots on the
  front and back) with a fingernail or small screwdriver while lifting.
- **Engraving:** "ESPrinkler" in a stencil typeface (6.6 mm caps) plus a
  spray-arc logo — a nozzle square with three fanning arcs — recessed 0.6 mm
  into the top surface. Oriented for the mounted position (OLED upper-right),
  so it appears rotated 180° in the model's plan view. Prints crisply with
  the lid face-down on the bed.

## Layout

Model plan view (SketchUp coordinates):

```
   +-----------------------------------+   <- back wall (cable slot)
[T]|                                   |[T] <- screw tabs, flat on bottom plane
   |       [ Relay ][ Relay ]          |
   |       term     term               |
   |       ɹǝʃʞuıɹdSƎ  (((             |   <- engraving (rotated 180°)
   |                       [ESP32]     |   <- XIAO, USB-C facing right wall
   |       [OLED]    (knob)            |   <- window + 7mm shaft hole in lid
   +--[=]----------------[=]-----------+   <- front wall snap slots
       0                            4.5  (X, inches)
```

As mounted on the wall (rotate the above 180°): OLED upper-right, knob
upper-left, "ESPrinkler" + logo reading correctly below them, cable slot at
the bottom edge, USB-C access on the left edge.

## Print notes

- **Material:** PETG recommended for the lid (snap lip flexes); PLA is fine
  for the chassis. 0.20 mm layers OK; 0.15 mm sharpens the engraving and pegs.
- **Orientation:** chassis open-top up, no supports. Lid **top-face down** on
  the bed — engraving prints into the first layers, lip/bosses/pegs build up
  as small towers. No supports needed on either part.
- **Infill:** 20–25 %.
- **Hardware:** two #6 drywall screws (wall mounting) and the encoder's own
  bushing nut. That's the entire fastener list — the lid and OLED need none.

## Compatibility notes

This is a **representative** model, not a verified hardware fit-check. The
internal layout and mounting positions assume:

- **ESP32-C3:** Seeed XIAO ESP32-C3 (21 x 17.8 mm, USB-C on the short edge).
- **OLED:** generic SSD1306 0.96" 128x64 module, 27 x 27 mm PCB, 23 x 23 mm
  mounting-hole pattern. Measure your module's hole diameter — pegs are
  1.4 mm; drill or scale if your PCB holes differ.
- **Rotary encoder:** EC11-style with 7 mm threaded bushing and ~12.4 mm
  square body (KY-040 wiring). Body noses 1 mm into the lid recess; nut +
  washer go on top of the lid.
- **Relay module:** generic 2-channel 5 V relay board, ~50 x 39 mm PCB,
  screw-terminal NO/COM/NC outputs on one long edge.

Adjust dimensions in the SketchUp file if your modules differ. The geometry
helpers in the source script are parameterized on width, depth, height and
cutout positions — small edits regenerate cleanly.
