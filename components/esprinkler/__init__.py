"""ESPrinkler — ESPHome external component (irrigation brain).

STATUS: scaffolding. The CONFIG_SCHEMA below sketches the configuration points the
component will accept; `to_code` is a stub. This is the file that turns YAML config
(zones, pump/master valve, scheduler) into generated C++. It is layered on top of
ESPHome's stock `sprinkler` component rather than replacing it.

See docs/entity-contract.md for the entities this component is responsible for exposing,
and docs/architecture.md (Decision 3) for why the brain lives here.
"""

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.const import CONF_ID, CONF_NAME

CODEOWNERS = ["@TheSmartWorkshop"]

# The brain leans on the stock sprinkler component for sequencing/durations.
AUTO_LOAD = ["sprinkler", "switch", "number", "binary_sensor", "sensor", "text_sensor"]

esprinkler_ns = cg.esphome_ns.namespace("esprinkler")
ESPrinkler = esprinkler_ns.class_("ESPrinkler", cg.Component)

# --- Config keys -----------------------------------------------------------------
CONF_ZONES = "zones"
CONF_OUTPUT = "output"
CONF_FLOW_TYPE = "flow_type"
CONF_DEFAULT_DURATION = "default_duration"

CONF_MASTER_OUTPUT = "master_output"
CONF_PUMP_START_DELAY = "pump_start_delay"
CONF_PUMP_STOP_DELAY = "pump_stop_delay"

CONF_SCHEDULER = "scheduler"
CONF_PROGRAMS = "programs"
CONF_START_TIME = "start_time"
CONF_DAYS = "days"

FLOW_TYPES = ["sprinkler", "drip"]

# Per-zone schema. `output` is the GPIO/expander/output id the valve is wired to, so the
# pin -> relay mapping is pure config and the brain stays board-agnostic.
ZONE_SCHEMA = cv.Schema(
    {
        cv.Optional(CONF_NAME): cv.string,
        cv.Required(CONF_OUTPUT): cv.use_id(cg.global_ns.class_("output::BinaryOutput")),
        cv.Optional(CONF_FLOW_TYPE, default="sprinkler"): cv.one_of(*FLOW_TYPES, lower=True),
        cv.Optional(CONF_DEFAULT_DURATION, default="10min"): cv.positive_time_period_minutes,
    }
)

# Optional on-device scheduler (the net-new logic; stock sprinkler doesn't do calendar).
PROGRAM_SCHEMA = cv.Schema(
    {
        cv.Optional(CONF_START_TIME): cv.time_of_day,
        # Day-of-week representation is still an open question (see entity-contract.md).
        cv.Optional(CONF_DAYS): cv.ensure_list(cv.string),
    }
)

SCHEDULER_SCHEMA = cv.Schema(
    {
        cv.Optional(CONF_PROGRAMS, default=[]): cv.ensure_list(PROGRAM_SCHEMA),
    }
)

CONFIG_SCHEMA = cv.Schema(
    {
        cv.GenerateID(): cv.declare_id(ESPrinkler),
        cv.Required(CONF_ZONES): cv.All(
            cv.ensure_list(ZONE_SCHEMA), cv.Length(min=1)
        ),
        cv.Optional(CONF_MASTER_OUTPUT): cv.use_id(
            cg.global_ns.class_("output::BinaryOutput")
        ),
        cv.Optional(CONF_PUMP_START_DELAY, default="0s"): cv.positive_time_period_seconds,
        cv.Optional(CONF_PUMP_STOP_DELAY, default="0s"): cv.positive_time_period_seconds,
        cv.Optional(CONF_SCHEDULER): SCHEDULER_SCHEMA,
    }
).extend(cv.COMPONENT_SCHEMA)


async def to_code(config):
    # TODO(scaffolding): instantiate ESPrinkler, register zones against the stock
    # sprinkler component, wire master output + pump delays, and build the scheduler.
    # For now we only construct the component so the schema can be exercised.
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)
