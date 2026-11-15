import Stripe from "stripe";
import { check, settlePayment } from "./bookingService.js";

function stripeClient() {
  check(
    process.env.PAYMENT_MODE === "stripe" &&
      process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"),
    "Cần cấu hình Stripe test key",
    503,
  );
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function stripeWebhook(req, res, next) {
  let event;
  try {
    const stripe = stripeClient();
    check(process.env.STRIPE_WEBHOOK_SECRET, "Thiếu webhook secret", 503);
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    return res
      .status(error.status || 400)
      .json({ error: "Chữ ký webhook hoặc cấu hình không hợp lệ" });
  }
  try {
    const supported = [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
    ];
    if (!supported.includes(event.type)) return res.json({ received: true });
    const session = event.data.object;
    if (
      event.type === "checkout.session.completed" &&
      session.payment_status !== "paid"
    )
      return res.json({ received: true });
    await settlePayment({
      eventId: event.id,
      transactionId: session.metadata.transactionId,
      success: [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type),
      amount: session.amount_total,
      currency: session.currency,
      sessionId: session.id,
      provider: "stripe",
    });
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
}
