#include "esprinkler.h"
#include "esphome/core/log.h"

namespace esphome {
namespace esprinkler {

static const char *const TAG = "esprinkler";

void ESPrinkler::setup() {
  // TODO(scaffolding): bind zones to the stock sprinkler component, wire the
  // master output, and arm the scheduler.
  ESP_LOGCONFIG(TAG, "Setting up ESPrinkler (scaffolding)...");
}

void ESPrinkler::loop() {
  // TODO(scaffolding): evaluate scheduler programs against the current time and
  // publish the state model the displays read.
}

void ESPrinkler::dump_config() {
  ESP_LOGCONFIG(TAG, "ESPrinkler:");
  ESP_LOGCONFIG(TAG, "  status: scaffolding (no zones wired yet)");
}

}  // namespace esprinkler
}  // namespace esphome
