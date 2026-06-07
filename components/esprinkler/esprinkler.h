#pragma once

// ESPrinkler -- irrigation brain (ESPHome external component).
//
// Thin layer over ESPHome's stock `sprinkler` controller. It owns two things the stock
// component does not provide: an on-device scheduler (time-of-day + day-of-week) and a
// unified state model (controller state, active zone, total remaining, next run, and
// per-zone active/remaining) that the OLED, LVGL touchscreen, and Lovelace card bind to.
//
// See docs/entity-contract.md for the entity surface and docs/architecture.md (Decision 3).

#include <string>
#include <vector>

#include "esphome/core/component.h"
#include "esphome/components/sprinkler/sprinkler.h"
#include "esphome/components/time/real_time_clock.h"
#include "esphome/components/text_sensor/text_sensor.h"
#include "esphome/components/sensor/sensor.h"
#include "esphome/components/binary_sensor/binary_sensor.h"

namespace esphome {
namespace esprinkler {

// A single scheduler program: a start time + a day-of-week mask (bit 0 = Sunday ..
// bit 6 = Saturday, matching ESPTime::day_of_week - 1).
struct SchedulerProgram {
  uint8_t hour;
  uint8_t minute;
  uint8_t days_mask;
  bool enabled;
};

class ESPrinkler : public PollingComponent {
 public:
  void setup() override;
  void update() override;
  void dump_config() override;
  // Run late so the sprinkler controller and the time source are ready.
  float get_setup_priority() const override { return setup_priority::LATE; }

  void set_sprinkler(sprinkler::Sprinkler *sprinkler) { this->sprinkler_ = sprinkler; }
  void set_time(time::RealTimeClock *rtc) { this->time_ = rtc; }
  void set_state_text_sensor(text_sensor::TextSensor *s) { this->state_ts_ = s; }
  void set_active_zone_text_sensor(text_sensor::TextSensor *s) { this->active_zone_ts_ = s; }
  void set_next_run_text_sensor(text_sensor::TextSensor *s) { this->next_run_ts_ = s; }
  void set_total_remaining_sensor(sensor::Sensor *s) { this->total_remaining_sensor_ = s; }

  void add_zone_sensors(size_t index, binary_sensor::BinarySensor *active,
                        sensor::Sensor *remaining);
  void add_program(uint8_t hour, uint8_t minute, uint8_t days_mask, bool enabled) {
    this->programs_.push_back(SchedulerProgram{hour, minute, days_mask, enabled});
  }

 protected:
  void publish_state_();
  void run_scheduler_();
  std::string compute_next_run_();

  sprinkler::Sprinkler *sprinkler_{nullptr};
  time::RealTimeClock *time_{nullptr};

  text_sensor::TextSensor *state_ts_{nullptr};
  text_sensor::TextSensor *active_zone_ts_{nullptr};
  text_sensor::TextSensor *next_run_ts_{nullptr};
  sensor::Sensor *total_remaining_sensor_{nullptr};

  struct ZoneSensors {
    binary_sensor::BinarySensor *active;
    sensor::Sensor *remaining;
  };
  std::vector<ZoneSensors> zones_;
  std::vector<SchedulerProgram> programs_;

  // Cache last-published text so we don't republish unchanged strings every tick.
  std::string last_state_;
  std::string last_active_zone_;
  std::string last_next_run_;

  // Scheduler debounce: remember the wall-clock minute we last fired in so the per-second
  // poll doesn't retrigger the same program 60 times.
  int last_trigger_minute_{-1};
  int last_trigger_dow_{-1};
};

}  // namespace esprinkler
}  // namespace esphome
