#include "esprinkler.h"
#include "esphome/core/log.h"

namespace esphome {
namespace esprinkler {

static const char *const TAG = "esprinkler";
static const char *const DAY_NAMES[7] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};

void ESPrinkler::add_zone_sensors(size_t index, binary_sensor::BinarySensor *active,
                                  sensor::Sensor *remaining) {
  if (this->zones_.size() <= index)
    this->zones_.resize(index + 1, ZoneSensors{nullptr, nullptr});
  this->zones_[index] = ZoneSensors{active, remaining};
}

void ESPrinkler::setup() {
  if (this->sprinkler_ == nullptr) {
    ESP_LOGE(TAG, "No sprinkler controller configured; ESPrinkler is inert");
    this->mark_failed();
    return;
  }
  ESP_LOGCONFIG(TAG, "ESPrinkler ready: %u zone sensor slot(s), %u scheduler program(s)",
                (unsigned) this->zones_.size(), (unsigned) this->programs_.size());
}

void ESPrinkler::update() {
  if (this->sprinkler_ == nullptr)
    return;
  this->publish_state_();
  this->run_scheduler_();
}

void ESPrinkler::publish_state_() {
  const optional<size_t> active = this->sprinkler_->active_valve();

  // Controller state.
  std::string state;
  if (this->sprinkler_->paused_valve().has_value()) {
    state = "paused";
  } else if (active.has_value()) {
    state = this->sprinkler_->manual_valve().has_value() ? "manual" : "running";
  } else {
    state = "idle";
  }
  if (this->state_ts_ != nullptr && state != this->last_state_) {
    this->state_ts_->publish_state(state);
    this->last_state_ = state;
  }

  // Active zone name.
  std::string active_zone = "—";
  if (active.has_value()) {
    const char *name = this->sprinkler_->valve_name(*active);
    if (name != nullptr && name[0] != '\0')
      active_zone = name;
  }
  if (this->active_zone_ts_ != nullptr && active_zone != this->last_active_zone_) {
    this->active_zone_ts_->publish_state(active_zone);
    this->last_active_zone_ = active_zone;
  }

  // Active-zone seconds remaining (used both for the total and per-zone sensors).
  uint32_t active_remaining = 0;
  if (active.has_value()) {
    const optional<uint32_t> tr = this->sprinkler_->time_remaining_active_valve();
    if (tr.has_value())
      active_remaining = *tr;
  }

  // Total remaining = current valve + everything still queued.
  if (this->total_remaining_sensor_ != nullptr) {
    uint32_t total = active_remaining;
    if (active.has_value())
      total += this->sprinkler_->total_queue_time();
    this->total_remaining_sensor_->publish_state(total);
  }

  // Per-zone active + remaining.
  for (size_t i = 0; i < this->zones_.size(); i++) {
    const bool is_active = active.has_value() && *active == i;
    if (this->zones_[i].active != nullptr)
      this->zones_[i].active->publish_state(is_active);
    if (this->zones_[i].remaining != nullptr)
      this->zones_[i].remaining->publish_state(is_active ? active_remaining : 0);
  }

  // Next scheduled run (human string).
  if (this->next_run_ts_ != nullptr) {
    std::string next_run = this->compute_next_run_();
    if (next_run != this->last_next_run_) {
      this->next_run_ts_->publish_state(next_run);
      this->last_next_run_ = next_run;
    }
  }
}

void ESPrinkler::run_scheduler_() {
  if (this->time_ == nullptr || this->programs_.empty())
    return;
  ESPTime now = this->time_->now();
  if (!now.is_valid())
    return;

  const int dow = now.day_of_week;  // 1 (Sun) .. 7 (Sat)
  // Already handled this wall-clock minute? Don't refire on the per-second poll.
  if (now.minute == this->last_trigger_minute_ && dow == this->last_trigger_dow_)
    return;

  const uint8_t day_bit = 1 << (dow - 1);
  for (const auto &program : this->programs_) {
    if (!program.enabled)
      continue;
    if (now.hour != program.hour || now.minute != program.minute)
      continue;
    if ((program.days_mask & day_bit) == 0)
      continue;

    this->last_trigger_minute_ = now.minute;
    this->last_trigger_dow_ = dow;
    // Don't stomp a run that's already going.
    if (this->sprinkler_->active_valve().has_value()) {
      ESP_LOGW(TAG, "Scheduled start at %02u:%02u skipped: a cycle is already running",
               program.hour, program.minute);
      return;
    }
    ESP_LOGI(TAG, "Scheduled start: %02u:%02u -> start_full_cycle()", program.hour,
             program.minute);
    this->sprinkler_->start_full_cycle();
    return;
  }
}

std::string ESPrinkler::compute_next_run_() {
  if (this->time_ == nullptr || this->programs_.empty())
    return "—";
  ESPTime now = this->time_->now();
  if (!now.is_valid())
    return "—";

  const int now_minutes = now.hour * 60 + now.minute;
  const int today = now.day_of_week - 1;  // 0 (Sun) .. 6 (Sat)

  int best_delta = -1;
  int best_dow = -1;
  int best_hour = 0;
  int best_minute = 0;

  // Scan forward up to a full week to find the soonest enabled program.
  for (int offset = 0; offset < 7; offset++) {
    const int target_dow = (today + offset) % 7;
    const uint8_t day_bit = 1 << target_dow;
    for (const auto &program : this->programs_) {
      if (!program.enabled || (program.days_mask & day_bit) == 0)
        continue;
      const int prog_minutes = program.hour * 60 + program.minute;
      const int delta = offset * 1440 + prog_minutes - now_minutes;
      if (delta <= 0)
        continue;  // already passed (only possible at offset 0)
      if (best_delta < 0 || delta < best_delta) {
        best_delta = delta;
        best_dow = target_dow;
        best_hour = program.hour;
        best_minute = program.minute;
      }
    }
  }

  if (best_delta < 0)
    return "—";

  char buf[24];
  const char *prefix = DAY_NAMES[best_dow];
  if (best_delta < 1440 && best_dow == today)
    prefix = "Today";
  else if (best_delta < 2 * 1440 && best_dow == (today + 1) % 7)
    prefix = "Tomorrow";
  snprintf(buf, sizeof(buf), "%s %02d:%02d", prefix, best_hour, best_minute);
  return std::string(buf);
}

void ESPrinkler::dump_config() {
  ESP_LOGCONFIG(TAG, "ESPrinkler:");
  ESP_LOGCONFIG(TAG, "  zone sensor slots: %u", (unsigned) this->zones_.size());
  ESP_LOGCONFIG(TAG, "  scheduler programs: %u", (unsigned) this->programs_.size());
  for (const auto &program : this->programs_) {
    ESP_LOGCONFIG(TAG, "    - %02u:%02u  days_mask=0x%02X  %s", program.hour, program.minute,
                  program.days_mask, program.enabled ? "enabled" : "disabled");
  }
  if (this->time_ == nullptr && !this->programs_.empty())
    ESP_LOGW(TAG, "  scheduler has programs but no time source!");
}

}  // namespace esprinkler
}  // namespace esphome
