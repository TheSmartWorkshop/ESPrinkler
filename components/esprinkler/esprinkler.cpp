#include "esprinkler.h"
#include "esphome/core/log.h"

namespace esphome {
namespace esprinkler {

static const char *const TAG = "esprinkler";
static const char *const DAY_NAMES[7] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};

// Stable per-instance preference id for the rain-delay end timestamp.
static const uint32_t RAIN_DELAY_PREF_TAG = 0xE5'A7'1D'A1;

void RainDelayNumber::control(float value) {
  this->publish_state(value);
  this->parent_->on_rain_delay_set(value);
}

void ScheduleEnabledSwitch::write_state(bool state) {
  this->publish_state(state);
  this->parent_->on_schedule_enabled_set(state);
}

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

  // Restore rain-delay end-time across reboots.
  if (this->rain_delay_number_ != nullptr) {
    this->rain_delay_pref_ =
        global_preferences->make_preference<uint32_t>(RAIN_DELAY_PREF_TAG, true);
    uint32_t until = 0;
    if (this->rain_delay_pref_.load(&until))
      this->rain_delay_until_ = until;
    this->rain_delay_number_->publish_state(this->remaining_rain_delay_hours_());
    this->last_rain_delay_published_ = this->rain_delay_number_->state;
  }

  // Restore schedule-enabled (uses the switch's own restore-mode preference).
  if (this->schedule_enabled_switch_ != nullptr) {
    auto restored = this->schedule_enabled_switch_->get_initial_state_with_restore_mode();
    this->schedule_enabled_ = restored.value_or(true);
    this->schedule_enabled_switch_->publish_state(this->schedule_enabled_);
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

  // Controller state. Watering states win over rain_delay so the user always
  // sees what the valves are doing right now.
  std::string state;
  if (this->sprinkler_->paused_valve().has_value()) {
    state = "paused";
  } else if (active.has_value()) {
    state = this->sprinkler_->manual_valve().has_value() ? "manual" : "running";
  } else if (this->is_rain_delayed_()) {
    state = "rain_delay";
  } else {
    state = "idle";
  }
  if (this->state_ts_ != nullptr && state != this->last_state_) {
    this->state_ts_->publish_state(state);
    this->last_state_ = state;
  }

  // Decrementing rain-delay countdown. Republish only when the displayed integer
  // hour rolls over so we don't spam the bus every second.
  if (this->rain_delay_number_ != nullptr) {
    float h = this->remaining_rain_delay_hours_();
    if (h != this->last_rain_delay_published_) {
      this->rain_delay_number_->publish_state(h);
      this->last_rain_delay_published_ = h;
    }
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

  // Total remaining = current valve + everything still queued. Compute once and
  // de-dup both the numeric sensor and the human "M:SS" text sensor (the latter
  // is what HA and the ESPHome web UI display; numeric stays available for math).
  uint32_t total_remaining = active_remaining;
  if (active.has_value())
    total_remaining += this->sprinkler_->total_queue_time();
  if (this->total_remaining_sensor_ != nullptr &&
      (int32_t) total_remaining != this->last_total_remaining_) {
    this->total_remaining_sensor_->publish_state(total_remaining);
    this->last_total_remaining_ = (int32_t) total_remaining;
  }
  if (this->total_remaining_text_sensor_ != nullptr) {
    char tbuf[10];
    snprintf(tbuf, sizeof(tbuf), "%u:%02u", total_remaining / 60u, total_remaining % 60u);
    std::string txt(tbuf);
    if (txt != this->last_total_remaining_text_) {
      this->total_remaining_text_sensor_->publish_state(txt);
      this->last_total_remaining_text_ = txt;
    }
  }

  // Per-zone active + remaining, with the same de-dup. Grow the last_* vectors
  // lazily so they always match zones_.
  if (this->last_zone_active_.size() != this->zones_.size())
    this->last_zone_active_.resize(this->zones_.size(), -1);
  if (this->last_zone_remaining_.size() != this->zones_.size())
    this->last_zone_remaining_.resize(this->zones_.size(), -1);
  for (size_t i = 0; i < this->zones_.size(); i++) {
    const bool is_active = active.has_value() && *active == i;
    const int32_t rem = is_active ? (int32_t) active_remaining : 0;
    if (this->zones_[i].active != nullptr &&
        (int8_t) is_active != this->last_zone_active_[i]) {
      this->zones_[i].active->publish_state(is_active);
      this->last_zone_active_[i] = (int8_t) is_active;
    }
    if (this->zones_[i].remaining != nullptr &&
        rem != this->last_zone_remaining_[i]) {
      this->zones_[i].remaining->publish_state(rem);
      this->last_zone_remaining_[i] = rem;
    }
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

  // Master gates. These do NOT affect manual runs (HA / on-device buttons /
  // sprinkler.start_full_cycle action) — only on-device scheduled fires.
  if (!this->schedule_enabled_)
    return;
  if (this->is_rain_delayed_())
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

void ESPrinkler::on_rain_delay_set(float hours) {
  if (hours <= 0.0f || this->time_ == nullptr) {
    this->rain_delay_until_ = 0;
  } else {
    ESPTime now = this->time_->now();
    if (!now.is_valid()) {
      ESP_LOGW(TAG, "Rain delay set but clock is not valid yet; ignored");
      return;
    }
    this->rain_delay_until_ = now.timestamp + (uint32_t)(hours * 3600.0f);
    ESP_LOGI(TAG, "Rain delay set: %.1fh (until epoch %u)", hours,
             (unsigned) this->rain_delay_until_);
  }
  this->rain_delay_pref_.save(&this->rain_delay_until_);
}

void ESPrinkler::on_schedule_enabled_set(bool enabled) {
  this->schedule_enabled_ = enabled;
  ESP_LOGI(TAG, "Schedule %s", enabled ? "enabled" : "disabled");
}

float ESPrinkler::remaining_rain_delay_hours_() {
  if (this->rain_delay_until_ == 0)
    return 0.0f;
  if (this->time_ == nullptr)
    return 0.0f;
  ESPTime now = this->time_->now();
  if (!now.is_valid())
    return 0.0f;
  if (now.timestamp >= this->rain_delay_until_) {
    // Auto-clear once we've caught up.
    this->rain_delay_until_ = 0;
    this->rain_delay_pref_.save(&this->rain_delay_until_);
    ESP_LOGI(TAG, "Rain delay expired; scheduler resumes");
    return 0.0f;
  }
  // Round up so a "12h" delay shows 12 → 11 → ... rather than disappearing 0.99 in.
  const uint32_t secs = this->rain_delay_until_ - now.timestamp;
  return (float) ((secs + 3599) / 3600);
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
