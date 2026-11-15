import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { API_URL, apiFetch } from "../lib/chatApi";
import WeeklySchedule, {
  WeeklyScheduleSummary,
  slotDate,
} from "../components/WeeklySchedule";
import "./BookingPayment.css";

const weekdays = [
  { value: 1, label: "Thứ 2" },
  { value: 2, label: "Thứ 3" },
  { value: 3, label: "Thứ 4" },
  { value: 4, label: "Thứ 5" },
  { value: 5, label: "Thứ 6" },
  { value: 6, label: "Thứ 7" },
  { value: 7, label: "Chủ nhật" },
];
const bookingLabels = {
  pending_tutor: "Chờ gia sư",
  confirmed: "Đã xác nhận",
  rejected: "Đã từ chối",
  expired: "Hết hạn",
  cancelled: "Đã hủy",
  completed: "Hoàn tất",
  held: "Đang giữ chỗ",
};
const paymentLabels = {
  pending: "Chưa thanh toán",
  failed: "Thanh toán thất bại",
  succeeded: "Đã thanh toán",
  cancelled: "Đã kết thúc yêu cầu",
  refund_required: "Cần hoàn tiền",
  refunded: "Đã hoàn tiền",
};
const roleLabels = {
  student: "Phụ huynh / học viên",
  tutor: "Gia sư",
  admin: "Admin",
};
const money = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value || 0,
  );
const time = (value) =>
  new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const calendarDate = (value) => {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};
const todayVietnam = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

function suggestedStartDate(schedule) {
  const now = new Date();
  const localNow = new Date(now.getTime() + 7 * 3600000);
  const [hour, minute] = schedule.startTime.split(":").map(Number);
  for (let offset = 0; offset <= 7; offset++) {
    const date = new Date(
      Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate() + offset,
      ),
    );
    const startsAt = date.getTime() + (hour * 60 + minute - 7 * 60) * 60000;
    if (
      schedule.weekdays.includes(date.getUTCDay() || 7) &&
      startsAt > now.getTime()
    )
      return date.toISOString().slice(0, 10);
  }
  return todayVietnam();
}

export function RecurringScheduleSummary({ booking }) {
  return (
    <div className="recurring-summary">
      <WeeklyScheduleSummary
        schedule={{
          weekdays: booking.recurrenceWeekdays,
          sessionsPerWeek: booking.recurrenceWeekdays.length,
          startTime: booking.startTime,
          endTime: booking.endTime,
        }}
      />
      <p>
        Từ ngày {calendarDate(booking.recurrenceStart)}
        {booking.recurrenceEnd &&
          ` đến ${calendarDate(booking.recurrenceEnd)}`}{" "}
        · Giờ Việt Nam
      </p>
    </div>
  );
}

export function RecurringRequestForm({
  match,
  config,
  request,
  onAction,
  busy,
  onSent,
}) {
  const offered = match.tutor.weeklySchedule;
  const [selectedDays, setSelectedDays] = useState(
    () => offered?.weekdays || [],
  );
  const [startTime, setStartTime] = useState(offered?.startTime || "19:00");
  const [endTime, setEndTime] = useState(offered?.endTime || "20:00");
  const [startDate, setStartDate] = useState(() =>
    offered ? suggestedStartDate(offered) : todayVietnam(),
  );
  const [endDate, setEndDate] = useState("");
  const [validationError, setValidationError] = useState("");

  function toggleDay(day) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b),
    );
    setValidationError("");
  }
  function submit(event) {
    event.preventDefault();
    if (selectedDays.length === 0) {
      setValidationError("Chọn ít nhất một thứ trong lịch rảnh của gia sư.");
      return;
    }
    if (
      startTime < offered.startTime ||
      endTime > offered.endTime ||
      endTime <= startTime
    ) {
      setValidationError(
        "Chọn khoảng giờ nằm trong lịch rảnh của gia sư, với giờ kết thúc sau giờ bắt đầu.",
      );
      return;
    }
    setValidationError("");
    onAction(async () => {
      const result = await request("/requests", "POST", {
        matchId: match.id,
        weekdays: selectedDays,
        startTime,
        endTime,
        startDate,
        ...(endDate ? { endDate } : {}),
      });
      onSent(result);
    });
  }

  if (!offered)
    return (
      <div className="request-form-empty">
        <p>Gia sư cần lưu lịch rảnh hằng tuần để nhận yêu cầu lớp định kỳ.</p>
      </div>
    );
  return (
    <form className="recurring-request-form" onSubmit={submit}>
      <h3>Lịch học định kỳ với {match.tutor.name}</h3>
      <p className="schedule-hint">
        Chọn thứ và giờ từ lịch rảnh của gia sư. Lịch sẽ lặp lại hằng tuần từ
        ngày bắt đầu.
      </p>
      <fieldset disabled={busy}>
        <legend>Thứ học hằng tuần</legend>
        <div className="weekly-days">
          {weekdays.map((day) => (
            <label
              key={day.value}
              className={`day-choice ${selectedDays.includes(day.value) ? "selected" : ""} ${!offered.weekdays.includes(day.value) ? "unavailable" : ""}`}
            >
              <input
                type="checkbox"
                disabled={!offered.weekdays.includes(day.value)}
                checked={selectedDays.includes(day.value)}
                onChange={() => toggleDay(day.value)}
              />
              <span>{day.label}</span>
            </label>
          ))}
        </div>
        <div className="weekly-fields">
          <label>
            Giờ bắt đầu
            <input
              required
              type="time"
              min={offered.startTime}
              max={offered.endTime}
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </label>
          <label>
            Giờ kết thúc
            <input
              required
              type="time"
              min={offered.startTime}
              max={offered.endTime}
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </label>
          <label>
            Bắt đầu từ ngày
            <input
              required
              type="date"
              min={todayVietnam()}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
        </div>
        <label className="optional-end-date">
          Kết thúc vào ngày (tùy chọn)
          <input
            type="date"
            min={startDate}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
        <p className="recurrence-preview">
          {selectedDays.length} buổi/tuần · {startTime}–{endTime}
        </p>
        <div className="acceptance-fee-note">
          <strong>
            Gia sư đóng {money(config.acceptanceFeeVnd)} phí nhận lớp một lần
          </strong>
          <p>
            Phụ huynh gửi yêu cầu để gia sư xem xét và thanh toán nhận lớp. Học
            phí định kỳ do hai bên thỏa thuận và thanh toán ngoài MindMatch.
          </p>
        </div>
        {validationError && (
          <p className="booking-error" role="alert">
            {validationError}
          </p>
        )}
        <button disabled={busy || config.paymentMode !== "local"}>
          Gửi yêu cầu đặt chỗ
        </button>
      </fieldset>
    </form>
  );
}

function TutorDecision({ booking, request, onAction, busy }) {
  const [showPayment, setShowPayment] = useState(false);
  const [showRejection, setShowRejection] = useState(false);
  const [reason, setReason] = useState("");
  const attemptRef = useRef(null);

  function pay(outcome) {
    if (!attemptRef.current || attemptRef.current.outcome !== outcome)
      attemptRef.current = { id: crypto.randomUUID(), outcome };
    const attempt = attemptRef.current;
    onAction(async () => {
      const result = await request(`/${booking.id}/pay-acceptance`, "POST", {
        outcome,
        attemptId: attempt.id,
      });
      // A received failure ends this attempt. A transport error retains the key for a safe retry.
      attemptRef.current = null;
      if (result.status === "confirmed") setShowPayment(false);
    });
  }
  return (
    <div className="tutor-decision">
      {booking.transaction.status === "failed" && (
        <p className="payment-failure" role="status">
          Thanh toán thất bại. Yêu cầu đang chờ để gia sư thử lại.
        </p>
      )}
      <div className="decision-buttons">
        <button
          disabled={busy}
          onClick={() => {
            setShowPayment(true);
            setShowRejection(false);
          }}
        >
          Thanh toán để nhận lớp
        </button>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            setShowRejection(true);
            setShowPayment(false);
          }}
        >
          Từ chối yêu cầu
        </button>
      </div>
      {showPayment && (
        <div className="payment-simulation">
          <h4>Thanh toán giả lập phí nhận lớp</h4>
          <p>
            Người đóng phí là gia sư. Tổng tiền một lần cho lớp này là{" "}
            <strong>{money(booking.transaction.amount)}</strong>.
          </p>
          <button disabled={busy} onClick={() => pay("success")}>
            Mô phỏng thanh toán thành công
          </button>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => pay("failure")}
          >
            Mô phỏng thanh toán thất bại
          </button>
          <p className="schedule-hint">
            Khi kết nối gián đoạn, bấm lại cùng kết quả để gửi lại lần thanh
            toán đang chờ.
          </p>
        </div>
      )}
      {showRejection && (
        <form
          className="rejection-form"
          onSubmit={(event) => {
            event.preventDefault();
            onAction(() =>
              request(`/${booking.id}/reject`, "POST", {
                reason: reason.trim(),
              }),
            );
          }}
        >
          <label>
            Lý do từ chối (tùy chọn)
            <textarea
              maxLength="500"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
          </label>
          <button className="danger-button" disabled={busy}>
            Từ chối
          </button>
        </form>
      )}
    </div>
  );
}

export function RecurringBookingCard({
  booking,
  user,
  request,
  onAction,
  busy,
  now,
}) {
  const expired =
    booking.status === "pending_tutor" &&
    new Date(booking.expiresAt).getTime() <= now;
  const status = expired ? "expired" : booking.status;
  const assignedTutor =
    user.role === "tutor" && user.id === booking.match.tutorId;
  return (
    <article className="recurring-booking-card">
      <div className="booking-card-heading">
        <h3>
          {booking.match.student.name} · {booking.match.tutor.name}
        </h3>
        <span className={`booking-status status-${status}`}>
          {bookingLabels[status] || status}
        </span>
      </div>
      <RecurringScheduleSummary booking={booking} />
      <div className="booking-fee-row">
        <span>Phí nhận lớp một lần · Gia sư đóng</span>
        <strong>{money(booking.transaction.amount)}</strong>
      </div>
      <p className="transaction-status">
        {paymentLabels[booking.transaction.status] ||
          booking.transaction.status}
      </p>
      {status === "pending_tutor" && (
        <p className="schedule-hint">
          Giữ lịch chờ gia sư đến {time(booking.expiresAt)}.
        </p>
      )}
      {status === "confirmed" && (
        <p className="schedule-success">
          Lịch học định kỳ đã được xác nhận cho hai bên.
        </p>
      )}
      {status === "rejected" && (
        <p>
          Gia sư đã từ chối yêu cầu.
          {booking.rejectionReason && ` Lý do: ${booking.rejectionReason}`}
        </p>
      )}
      {status === "expired" && (
        <p className="schedule-hint">
          Yêu cầu đã hết hạn. Phụ huynh có thể chọn lịch và gửi yêu cầu mới.
        </p>
      )}
      <p className="schedule-hint">
        Học phí định kỳ được hai bên thanh toán ngoài MindMatch.
      </p>
      {assignedTutor && status === "pending_tutor" && (
        <TutorDecision
          booking={booking}
          request={request}
          onAction={onAction}
          busy={busy}
        />
      )}
      {!!booking.transaction.events?.length && (
        <details className="payment-events">
          <summary>Lịch sử thanh toán phí nhận lớp</summary>
          {booking.transaction.events.map((event) => (
            <p key={event.id}>
              {time(event.createdAt)} ·{" "}
              {event.outcome === "paid" || event.outcome === "succeeded"
                ? "Thành công"
                : "Thất bại"}
            </p>
          ))}
        </details>
      )}
      <p className="booking-reference">Mã yêu cầu {booking.id}</p>
    </article>
  );
}

function AdminAcceptanceFees({ admin, request, onAction, busy }) {
  const [fee, setFee] = useState(admin.config.acceptanceFeeVnd);
  const [savedMessage, setSavedMessage] = useState("");
  const fees = admin.transactions.filter(
    (transaction) => transaction.purpose === "class_acceptance",
  );
  const collected = fees
    .filter((transaction) => transaction.status === "succeeded")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return (
    <section>
      <h2>Quản lý phí nhận lớp</h2>
      <p>
        Tổng phí nhận lớp đã thanh toán <strong>{money(collected)}</strong>.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onAction(async () => {
            await request("/finance/config", "PATCH", {
              acceptanceFeeVnd: Number(fee),
            });
            setSavedMessage("Đã lưu mức phí cho các yêu cầu tạo mới.");
          });
        }}
      >
        <label>
          Phí nhận lớp một lần (VND)
          <input
            required
            type="number"
            min="1000"
            max="100000000"
            step="1"
            value={fee}
            onChange={(event) => {
              setFee(event.target.value);
              setSavedMessage("");
            }}
            disabled={busy}
          />
        </label>
        <button disabled={busy}>Lưu mức phí</button>
      </form>
      {savedMessage && (
        <p role="status" className="schedule-success">
          {savedMessage}
        </p>
      )}
      <p className="schedule-hint">
        Gia sư là người đóng phí. Mỗi yêu cầu lưu mức phí tại thời điểm được
        tạo.
      </p>
      {fees.length === 0 && <p>Chưa có giao dịch phí nhận lớp.</p>}
      {fees.map((transaction) => (
        <article key={transaction.id} className="fee-history-card">
          <p>
            <strong>{money(transaction.amount)}</strong> ·{" "}
            {paymentLabels[transaction.status] || transaction.status}
          </p>
          <p>
            Gia sư đóng phí ·{" "}
            {transaction.payer?.name || `User ${transaction.payerId}`}
          </p>
          <p className="booking-reference">
            Giao dịch {transaction.id} · Yêu cầu {transaction.bookingId}
          </p>
        </article>
      ))}
    </section>
  );
}

function LegacyBookingHistory({ bookings }) {
  if (bookings.length === 0) return null;
  return (
    <details className="legacy-history">
      <summary>Lịch sử đặt lịch trước đây ({bookings.length})</summary>
      {bookings.map((booking) => (
        <article key={booking.id}>
          <h3>
            {booking.match.student.name} · {booking.match.tutor.name}
          </h3>
          {booking.slot && (
            <p>
              {slotDate(booking.slot.startsAt)} · {time(booking.slot.startsAt)}
            </p>
          )}
          <p>{bookingLabels[booking.status] || booking.status}</p>
          {booking.transaction && (
            <p>
              Giao dịch lịch sử · {money(booking.transaction.amount)} ·{" "}
              {paymentLabels[booking.transaction.status] ||
                booking.transaction.status}
            </p>
          )}
        </article>
      ))}
    </details>
  );
}

export default function BookingPayment() {
  const { currentUser } = useAuth();
  const demoUI = import.meta.env.VITE_BOOKING_DEMO === "true";
  const demoId = new URLSearchParams(window.location.search).get("as") || "";
  const [demoDraft, setDemoDraft] = useState(demoId);
  const [me, setMe] = useState(null);
  const [config, setConfig] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchId, setMatchId] = useState("");
  const [bookings, setBookings] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [requestFilter, setRequestFilter] = useState("all");
  const actionRef = useRef(false);
  const loadVersion = useRef(0);
  const getAuth = useCallback(
    async () =>
      demoUI && demoId
        ? { userId: demoId }
        : { token: await currentUser?.getIdToken() },
    [currentUser, demoUI, demoId],
  );
  const request = useCallback(
    async (path, method = "GET", body) =>
      apiFetch(`/api/bookings${path}`, {
        auth: await getAuth(),
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    [getAuth],
  );

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const [identity, list, settings] = await Promise.all([
      request("/me"),
      request("/"),
      request("/config"),
    ]);
    const participant = ["student", "tutor"].includes(identity.user.role);
    const [connections, finance] = await Promise.all([
      participant ? request("/matches") : [],
      identity.user.role === "admin" ? request("/finance/admin") : null,
    ]);
    if (version !== loadVersion.current) return;
    setMe(identity);
    setBookings(list);
    setConfig(settings);
    setMatches(connections);
    setAdmin(finance);
  }, [request]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const poll = setInterval(
      () =>
        load().catch((error) => {
          if (active) setError(error.message);
        }),
      10000,
    );
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      loadVersion.current++;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);
  useEffect(() => {
    let active = true;
    let socket;
    getAuth()
      .then((auth) => {
        if (!active || (!auth.userId && !auth.token)) return;
        socket = io(API_URL, { auth });
        socket.on("booking_updated", () =>
          load().catch((error) => {
            if (active) setError(error.message);
          }),
        );
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
      socket?.disconnect();
    };
  }, [getAuth, load]);

  async function act(task) {
    if (actionRef.current) return null;
    actionRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await task();
      await load();
      return result;
    } catch (error) {
      setError(error.message);
      return null;
    } finally {
      actionRef.current = false;
      setBusy(false);
    }
  }

  const selectedMatch = matches.find((match) => String(match.id) === matchId);
  const recurring = bookings.filter(
    (booking) => booking.kind === "recurring_class",
  );
  const legacy = bookings.filter(
    (booking) => booking.kind !== "recurring_class",
  );
  const visibleRequests = recurring.filter(
    (booking) => requestFilter === "all" || booking.status === requestFilter,
  );
  const demoSearch =
    demoUI && demoId ? `?as=${encodeURIComponent(demoId)}` : "";

  return (
    <main className="booking-page">
      <header>
        <Link to="/dashboard">MindMatch</Link>
        <nav>
          <Link to={`/matcher${demoSearch}`}>Match</Link>
          <Link to={`/bookings${demoSearch}`}>Lớp định kỳ</Link>
          <Link to={`/messages${demoSearch}`}>Tin nhắn</Link>
        </nav>
      </header>
      <h1>Đặt lịch học định kỳ</h1>
      <p className="page-introduction">
        Phụ huynh gửi yêu cầu lịch học. Gia sư thanh toán phí nhận lớp một lần
        để xác nhận.
      </p>
      {demoUI && (
        <details className="demo-note">
          <summary>DEMO LOCAL · Đổi tài khoản</summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              window.location.assign(
                `/bookings?as=${encodeURIComponent(demoDraft)}`,
              );
            }}
          >
            <label>
              User ID
              <input
                required
                type="number"
                min="1"
                value={demoDraft}
                onChange={(event) => setDemoDraft(event.target.value)}
              />
            </label>
            <button>Chuyển tài khoản demo</button>
          </form>
        </details>
      )}
      {loading && <p role="status">Đang tải dữ liệu…</p>}
      {error && (
        <p role="alert" className="booking-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="schedule-success">
          {notice}
        </p>
      )}
      {me && config && (
        <>
          <div className="identity-row">
            <p>
              {me.user.name} · {roleLabels[me.user.role] || me.user.role}
            </p>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => act(load)}
            >
              Làm mới
            </button>
          </div>
          <div className="tuition-note">
            Học phí định kỳ do phụ huynh và gia sư tự thỏa thuận, thanh toán
            ngoài MindMatch.
          </div>
          {["student", "tutor"].includes(me.user.role) && (
            <details className="availability-editor">
              <summary>
                {me.user.role === "tutor"
                  ? "Cập nhật lịch rảnh hằng tuần"
                  : "Lịch học mong muốn của gia đình"}
              </summary>
              <WeeklySchedule
                key={me.user.id}
                user={me.user}
                request={request}
                onAction={act}
                busy={busy}
                showPublishing={false}
              />
            </details>
          )}
          {me.user.role === "student" && (
            <section>
              <h2>Chọn gia sư đã Match</h2>
              <div className="booking-grid match-grid">
                {matches.map((match) => (
                  <article
                    key={match.id}
                    className={`match-card ${String(match.id) === matchId ? "is-selected" : ""}`}
                  >
                    <h3>{match.tutor.name}</h3>
                    <WeeklyScheduleSummary
                      schedule={match.tutor.weeklySchedule}
                    />
                    <button
                      disabled={busy || !match.tutor.weeklySchedule}
                      aria-pressed={String(match.id) === matchId}
                      onClick={() => {
                        setMatchId(String(match.id));
                        setNotice("");
                      }}
                    >
                      {String(match.id) === matchId
                        ? "Đang chọn"
                        : "Chọn lịch định kỳ"}
                    </button>
                  </article>
                ))}
              </div>
              {matches.length === 0 && (
                <p>
                  Gia đình cần Match với gia sư trước khi gửi yêu cầu đặt chỗ.
                </p>
              )}
              {selectedMatch && (
                <RecurringRequestForm
                  key={`${selectedMatch.id}-${selectedMatch.tutor.weeklySchedule?.updatedAt || "none"}`}
                  match={selectedMatch}
                  config={config}
                  request={request}
                  onAction={act}
                  busy={busy}
                  onSent={() =>
                    setNotice(
                      "Đã gửi yêu cầu. Gia sư sẽ xem lịch và thanh toán phí nhận lớp để xác nhận.",
                    )
                  }
                />
              )}
            </section>
          )}
          <section className="booking-requests">
            <h2>
              {me.user.role === "tutor"
                ? "Yêu cầu nhận lớp"
                : "Yêu cầu và lịch học định kỳ"}
            </h2>
            <div
              className="request-filters"
              role="group"
              aria-label="Lọc yêu cầu"
            >
              {[
                ["all", "Tất cả"],
                ["pending_tutor", "Chờ gia sư"],
                ["confirmed", "Đã xác nhận"],
                ["rejected", "Đã từ chối"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={
                    requestFilter === value
                      ? "filter-selected"
                      : "secondary-button"
                  }
                  aria-pressed={requestFilter === value}
                  onClick={() => setRequestFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {visibleRequests.length === 0 && (
              <p>Chưa có yêu cầu trong mục này.</p>
            )}
            {visibleRequests.map((booking) => (
              <RecurringBookingCard
                key={booking.id}
                booking={booking}
                user={me.user}
                request={request}
                onAction={act}
                busy={busy}
                now={now}
              />
            ))}
          </section>
          {me.user.role === "admin" && admin && (
            <AdminAcceptanceFees
              key={me.user.id}
              admin={admin}
              request={request}
              onAction={act}
              busy={busy}
            />
          )}
          <LegacyBookingHistory bookings={legacy} />
        </>
      )}
    </main>
  );
}
