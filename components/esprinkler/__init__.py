"""ESPrinkler — ESPHome external component (irrigation brain).

The brain is intentionally *thin*: ESPHome's stock ``sprinkler`` component already nails
sequencing, per-zone enable/duration, pump/master coordination, repeat and multiplier. This
component layers on the two things ``sprinkler`` does not provide:

1. an **on-device scheduler** (time-of-day + day-of-week -> ``start_full_cycle``), so watering
   continues with or without Home Assistant; and
2. a **unified state model** (controller state, active zone, total time remaining, next run,
   and per-zone active/remaining) that the OLED, the LVGL touchscreen, and the Lovelace card
   all bind to -- see ``docs/entity-contract.md``.

You declare a normal ``sprinkler:`` controller (the "engine") and point ``esprinkler:`` at it
with ``sprinkler_id``. See ``examples/`` for full configs.
"""

import esphome.codegen as cg
from esphome.components import binary_sensor, number, sensor, switch, text_sensor
from esphome.components import time as time_
from esphome.components.sprinkler import Sprinkler
import esphome.config_validation as cv
from esphome.const import (
    CONF_ID,
    CONF_NAME,
    ENTITY_CATEGORY_CONFIG,
    UNIT_HOUR,
    UNIT_SECOND,
)

CODEOWNERS = ["@TheSmartWorkshop"]
AUTO_LOAD = ["text_sensor", "sensor", "binary_sensor", "number", "switch"]

esprinkler_ns = cg.esphome_ns.namespace("esprinkler")
ESPrinkler = esprinkler_ns.class_("ESPrinkler", cg.PollingComponent)
RainDelayNumber = esprinkler_ns.class_(
    "RainDelayNumber", number.Number, cg.Parented.template(ESPrinkler)
)
ScheduleEnabledSwitch = esprinkler_ns.class_(
    "ScheduleEnabledSwitch", switch.Switch, cg.Parented.template(ESPrinkler)
)

# --- Config keys -----------------------------------------------------------------
CONF_SPRINKLER_ID = "sprinkler_id"
CONF_TIME_ID = "time_id"
CONF_STATE = "state"
CONF_ACTIVE_ZONE = "active_zone"
CONF_NEXT_RUN = "next_run"
CONF_TOTAL_REMAINING = "total_remaining"
CONF_ZONES = "zones"
CONF_FLOW_TYPE = "flow_type"
CONF_ACTIVE = "active"
CONF_REMAINING = "remaining"
CONF_SCHEDULER = "scheduler"
CONF_PROGRAMS = "programs"
CONF_START_TIME = "start_time"
CONF_DAYS = "days"
CONF_ENABLED = "enabled"
CONF_RAIN_DELAY = "rain_delay"
CONF_SCHEDULE_ENABLED = "schedule_enabled"

RAIN_DELAY_MAX_HOURS = 168.0  # one week

FLOW_TYPES = ["sprinkler", "drip"]

# day_of_week in ESPHome's ESPTime is Sunday=1..Saturday=7; we store a bitmask where
# bit 0 = Sunday .. bit 6 = Saturday (i.e. bit (day_of_week - 1)).
_DAY_BITS = {
    "sun": 0, "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6,
}
_DAY_PRESETS = {
    "everyday": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
    "weekdays": ["mon", "tue", "wed", "thu", "fri"],
    "weekends": ["sat", "sun"],
}


def _validate_days(value):
    """Accept a preset string or a list of day names; return a 7-bit mask int."""
    if isinstance(value, str):
        key = value.lower()
        if key in _DAY_PRESETS:
            value = _DAY_PRESETS[key]
        else:
            value = [value]
    if not isinstance(value, list):
        raise cv.Invalid("days must be a list of day names or a preset")
    mask = 0
    for day in value:
        d = str(day).strip().lower()[:3]
        if d not in _DAY_BITS:
            raise cv.Invalid(
                f"invalid day '{day}'; use sun/mon/tue/wed/thu/fri/sat or a preset "
                f"({', '.join(_DAY_PRESETS)})"
            )
        mask |= 1 << _DAY_BITS[d]
    if mask == 0:
        raise cv.Invalid("at least one day must be selected")
    return mask


def _validate_time_of_day(value):
    """Parse 'HH:MM' or 'HH:MM:SS' into a (hour, minute) tuple."""
    value = cv.string_strict(value)
    parts = value.split(":")
    if len(parts) not in (2, 3):
        raise cv.Invalid("start_time must be 'HH:MM' or 'HH:MM:SS'")
    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except ValueError as err:
        raise cv.Invalid("start_time must be numeric 'HH:MM'") from err
    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        raise cv.Invalid("start_time out of range (00:00..23:59)")
    return (hour, minute)


ZONE_SCHEMA = cv.Schema(
    {
        cv.Optional(CONF_NAME): cv.string,  # informational; entity names come from sprinkler
        cv.Optional(CONF_FLOW_TYPE, default="sprinkler"): cv.one_of(*FLOW_TYPES, lower=True),
        cv.Optional(CONF_ACTIVE): binary_sensor.binary_sensor_schema(),
        cv.Optional(CONF_REMAINING): sensor.sensor_schema(
            unit_of_measurement=UNIT_SECOND,
            accuracy_decimals=0,
            icon="mdi:timer-sand",
        ),
    }
)

PROGRAM_SCHEMA = cv.Schema(
    {
        cv.Required(CONF_START_TIME): _validate_time_of_day,
        cv.Optional(CONF_DAYS, default="everyday"): _validate_days,
        cv.Optional(CONF_ENABLED, default=True): cv.boolean,
    }
)

SCHEDULER_SCHEMA = cv.Schema(
    {
        cv.Optional(CONF_PROGRAMS, default=[]): cv.ensure_list(PROGRAM_SCHEMA),
    }
)


def _validate_scheduler_needs_time(config):
    if CONF_SCHEDULER in config and config[CONF_SCHEDULER][CONF_PROGRAMS]:
        if CONF_TIME_ID not in config:
            raise cv.Invalid(
                "a time_id is required when the scheduler has programs (the on-device "
                "scheduler needs a real clock)"
            )
    if CONF_RAIN_DELAY in config and CONF_TIME_ID not in config:
        raise cv.Invalid(
            "a time_id is required when rain_delay is set (the delay is anchored to "
            "wall-clock time)"
        )
    return config


CONFIG_SCHEMA = cv.All(
    cv.Schema(
        {
            cv.GenerateID(): cv.declare_id(ESPrinkler),
            cv.Required(CONF_SPRINKLER_ID): cv.use_id(Sprinkler),
            cv.Optional(CONF_TIME_ID): cv.use_id(time_.RealTimeClock),
            cv.Optional(CONF_STATE): text_sensor.text_sensor_schema(
                icon="mdi:water-pump"
            ),
            cv.Optional(CONF_ACTIVE_ZONE): text_sensor.text_sensor_schema(
                icon="mdi:sprinkler-variant"
            ),
            cv.Optional(CONF_NEXT_RUN): text_sensor.text_sensor_schema(
                icon="mdi:calendar-clock"
            ),
            cv.Optional(CONF_TOTAL_REMAINING): sensor.sensor_schema(
                unit_of_measurement=UNIT_SECOND,
                accuracy_decimals=0,
                icon="mdi:timer-sand",
            ),
            cv.Optional(CONF_RAIN_DELAY): number.number_schema(
                RainDelayNumber,
                unit_of_measurement=UNIT_HOUR,
                icon="mdi:weather-rainy",
                entity_category=ENTITY_CATEGORY_CONFIG,
            ),
            cv.Optional(CONF_SCHEDULE_ENABLED): switch.switch_schema(
                ScheduleEnabledSwitch,
                icon="mdi:calendar-check",
                default_restore_mode="RESTORE_DEFAULT_ON",
                entity_category=ENTITY_CATEGORY_CONFIG,
            ),
            cv.Optional(CONF_ZONES): cv.ensure_list(ZONE_SCHEMA),
            cv.Optional(CONF_SCHEDULER): SCHEDULER_SCHEMA,
        }
    ).extend(cv.polling_component_schema("1s")),
    _validate_scheduler_needs_time,
)


async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)

    sprink = await cg.get_variable(config[CONF_SPRINKLER_ID])
    cg.add(var.set_sprinkler(sprink))

    if CONF_TIME_ID in config:
        rtc = await cg.get_variable(config[CONF_TIME_ID])
        cg.add(var.set_time(rtc))

    if CONF_STATE in config:
        cg.add(var.set_state_text_sensor(await text_sensor.new_text_sensor(config[CONF_STATE])))
    if CONF_ACTIVE_ZONE in config:
        cg.add(
            var.set_active_zone_text_sensor(
                await text_sensor.new_text_sensor(config[CONF_ACTIVE_ZONE])
            )
        )
    if CONF_NEXT_RUN in config:
        cg.add(
            var.set_next_run_text_sensor(
                await text_sensor.new_text_sensor(config[CONF_NEXT_RUN])
            )
        )
    if CONF_TOTAL_REMAINING in config:
        cg.add(
            var.set_total_remaining_sensor(
                await sensor.new_sensor(config[CONF_TOTAL_REMAINING])
            )
        )

    if CONF_RAIN_DELAY in config:
        rd = await number.new_number(
            config[CONF_RAIN_DELAY],
            min_value=0.0,
            max_value=RAIN_DELAY_MAX_HOURS,
            step=1.0,
        )
        await cg.register_parented(rd, var)
        cg.add(var.set_rain_delay_number(rd))

    if CONF_SCHEDULE_ENABLED in config:
        se = await switch.new_switch(config[CONF_SCHEDULE_ENABLED])
        await cg.register_parented(se, var)
        cg.add(var.set_schedule_enabled_switch(se))

    for i, zone in enumerate(config.get(CONF_ZONES, [])):
        active = cg.nullptr
        remaining = cg.nullptr
        if CONF_ACTIVE in zone:
            active = await binary_sensor.new_binary_sensor(zone[CONF_ACTIVE])
        if CONF_REMAINING in zone:
            remaining = await sensor.new_sensor(zone[CONF_REMAINING])
        cg.add(var.add_zone_sensors(i, active, remaining))

    if CONF_SCHEDULER in config:
        for prog in config[CONF_SCHEDULER][CONF_PROGRAMS]:
            hour, minute = prog[CONF_START_TIME]
            cg.add(var.add_program(hour, minute, prog[CONF_DAYS], prog[CONF_ENABLED]))
