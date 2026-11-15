import React, { useState } from "react";

const weekdays = [
  { value: 1, label: "Thứ 2" },
  { value: 2, label: "Thứ 3" },
  { value: 3, label: "Thứ 4" },
  { value: 4, label: "Thứ 5" },
  { value: 5, label: "Thứ 6" },
  { value: 6, label: "Thứ 7" },
  { value: 7, label: "Chủ nhật" },
];
const vietnamTimeZone = "Asia/Ho_Chi_Minh";
export const slotWeekday = (value) =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    timeZone: vietnamTimeZone,
  }).format(new Date(value));
export const slotTime = (value) =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: vietnamTimeZone,
  }).format(new Date(value));
export const slotDate = (value) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: vietnamTimeZone,
  }).format(new Date(value));

export function WeeklyScheduleSummary({ schedule }) {
  if (!schedule)
    return <p className="schedule-empty">Chưa thiết lập lịch tuần</p>;
  return (
    <div className="schedule-chips">
      <span>{schedule.sessionsPerWeek} buổi/tuần</span>
      <span>
        {weekdays
          .filter((day) => schedule.weekdays.includes(day.value))
          .map((day) => day.label)
          .join(", ")}
      </span>
      <span>
        {schedule.startTime}–{schedule.endTime}
      </span>
    </div>
  );
}

function scheduleFields(schedule) {
  if (!schedule) return null;
  return {
    weekdays: schedule.weekdays,
    sessionsPerWeek: schedule.sessionsPerWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
  };
}

export default function WeeklySchedule({
  user,
  request,
  onAction,
  busy,
  showPublishing = true,
}) {
  const tutor = user.role === "tutor";
  const [saved, setSaved] = useState(() => scheduleFields(user.weeklySchedule));
  const [draft, setDraft] = useState(
    () =>
      scheduleFields(user.weeklySchedule) || {
        weekdays: [],
        sessionsPerWeek: 2,
        startTime: "19:00",
        endTime: "20:00",
      },
  );
  const [price, setPrice] = useState(200000);
  const [message, setMessage] = useState("");
  const [dayError, setDayError] = useState("");
  const dirty = !saved || JSON.stringify(saved) !== JSON.stringify(draft);

  function toggleDay(value) {
    const selected = draft.weekdays.includes(value)
      ? draft.weekdays.filter((day) => day !== value)
      : [...draft.weekdays, value].sort((a, b) => a - b);
    setDraft({ ...draft, weekdays: selected });
    setDayError("");
    setMessage("");
  }
  function save(event) {
    event.preventDefault();
    setMessage("");
    if (draft.weekdays.length === 0) {
      setDayError("Chọn ít nhất một thứ có thể học hoặc dạy.");
      return;
    }
    onAction(async () => {
      const result = await request("/schedule", "PUT", {
        ...draft,
        sessionsPerWeek: Number(draft.sessionsPerWeek),
      });
      const next = scheduleFields(result);
      setSaved(next);
      setDraft(next);
      setMessage("Đã lưu lịch tuần.");
    });
  }
  function publish(event) {
    event.preventDefault();
    setMessage("");
    onAction(async () => {
      const result = await request("/slots/weekly", "POST", {
        price: Number(price),
      });
      setMessage(
        `Đã mở ${result.createdCount} khung giờ trong 4 tuần tới. ${result.skippedCount} khung trùng lịch đã có.`,
      );
    });
  }

  return (
    <section className="weekly-schedule">
      <h2>{tutor ? "Lịch dạy hằng tuần" : "Lịch học mong muốn"}</h2>
      <p className="schedule-hint">
        {tutor
          ? "Chọn thứ có thể dạy và số buổi đề xuất cho một học viên."
          : "Chọn các thứ có thể học và số buổi muốn học mỗi tuần."}{" "}
        Giờ Việt Nam (UTC+7).
      </p>
      <WeeklyScheduleSummary schedule={saved} />
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <legend>Thứ rảnh trong tuần</legend>
          <div className="weekly-days">
            {weekdays.map((day) => (
              <label
                key={day.value}
                className={
                  draft.weekdays.includes(day.value)
                    ? "day-choice selected"
                    : "day-choice"
                }
              >
                <input
                  type="checkbox"
                  checked={draft.weekdays.includes(day.value)}
                  onChange={() => toggleDay(day.value)}
                />
                <span>{day.label}</span>
              </label>
            ))}
          </div>
          {dayError && (
            <p className="booking-error" role="alert">
              {dayError}
            </p>
          )}
          <div className="weekly-fields">
            <label>
              {tutor ? "Số buổi đề xuất/tuần" : "Số buổi muốn học/tuần"}
              <input
                required
                type="number"
                min="1"
                max="7"
                step="1"
                value={draft.sessionsPerWeek}
                onChange={(event) =>
                  setDraft({ ...draft, sessionsPerWeek: event.target.value })
                }
              />
            </label>
            <label>
              Giờ bắt đầu
              <input
                required
                type="time"
                value={draft.startTime}
                onChange={(event) =>
                  setDraft({ ...draft, startTime: event.target.value })
                }
              />
            </label>
            <label>
              Giờ kết thúc
              <input
                required
                type="time"
                value={draft.endTime}
                onChange={(event) =>
                  setDraft({ ...draft, endTime: event.target.value })
                }
              />
            </label>
          </div>
          <button disabled={busy || !dirty}>Lưu lịch tuần</button>
        </fieldset>
      </form>
      {tutor && showPublishing && (
        <form className="publish-weekly" onSubmit={publish}>
          <label>
            Học phí mỗi buổi (VND)
            <input
              required
              type="number"
              min="50000"
              max="10000000"
              step="1"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              disabled={busy}
            />
          </label>
          <p className="schedule-hint">
            Mở các khung giờ nhận đặt theo lịch đã lưu trong 4 tuần tới.
          </p>
          <button disabled={busy || dirty}>Mở lịch 4 tuần tới</button>
        </form>
      )}
      {message && (
        <p role="status" className="schedule-success">
          {message}
        </p>
      )}
    </section>
  );
}
