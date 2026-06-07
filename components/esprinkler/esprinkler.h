#pragma once

// ESPrinkler — irrigation brain (ESPHome external component).
//
// STATUS: scaffolding. This header declares the component shell. The real
// responsibilities (zone orchestration on top of the stock sprinkler component,
// pump/master-valve lead-lag, the on-device scheduler, and the state model the
// OLED/LVGL displays read) are not implemented yet.
//
// See docs/entity-contract.md for the entity surface this component owns and
// docs/architecture.md (Decision 3) for where it sits in the stack.

#include "esphome/core/component.h"

namespace esphome {
namespace esprinkler {

// High-level controller state. Mirrors the `esp_state` text_sensor enum in the
// entity contract; the displays key their top-level mode off this.
enum class ControllerState {
  IDLE,
  RUNNING,
  PAUSED,
  MANUAL,
  RAIN_DELAY,
};

class ESPrinkler : public Component {
 public:
  void setup() override;
  void loop() override;
  void dump_config() override;

  // The scheduler runs late so time/NTP is ready.
  float get_setup_priority() const override { return setup_priority::LATE; }

 protected:
  ControllerState state_{ControllerState::IDLE};
};

}  // namespace esprinkler
}  // namespace esphome
