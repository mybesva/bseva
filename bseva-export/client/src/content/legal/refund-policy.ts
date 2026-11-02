import {
  CIN,
  COMPANY,
  EFFECTIVE_DATE,
  GSTIN,
  LEGAL_VERSION,
  PARTNER_EMAIL,
  PHONE,
  REGISTERED_OFFICE,
  SUPPORT_EMAIL,
  grievanceTable,
  toConfirm,
  withToConfirm,
} from "./shared";

/**
 * Figures in this policy match the code defaults (backend/app/domain.py cancel_policy,
 * backend/app/platform_config.py, backend/app/booking_reschedule.py, backend/app/no_show.py).
 * They are admin-configurable, so the live values must be checked in Admin → Settings before publishing.
 */
export const refundPolicy = withToConfirm({
  slug: "refund-policy",
  title: "Cancellation & Refund Policy",
  version: LEGAL_VERSION,
  effectiveDate: EFFECTIVE_DATE,
  intro: [
    `Operated by: ${COMPANY}. CIN: ${CIN}. Registered office: ${REGISTERED_OFFICE}. GSTIN: ${GSTIN}. Customer support: ${PHONE} | ${SUPPORT_EMAIL}. Partner support: ${PARTNER_EMAIL}`,
    "This Cancellation & Refund Policy forms part of the B-Seva Customer Terms & Conditions and the Pujari / Service Provider Terms & Conditions. It explains what happens when a Booking is cancelled, rescheduled, or not performed, and how refunds are made. Capitalised terms have the meaning given in those terms.",
  ],
  sections: [
    {
      id: "payments",
      heading: "1. How Bookings are paid",
      paragraphs: [
        "Bookings are paid from your B-Seva wallet. At present, credit is added to your wallet through B-Seva support: you pay B-Seva by UPI or bank transfer, and we credit your wallet once we have confirmed the payment. Online payment through a payment gateway may be added later; we will update this policy first.",
        "Payments and refunds are handled by B-Seva. They are not processed through Google Play billing or Apple In-App Purchase, and Google and Apple do not handle refunds for Bookings.",
      ],
    },
    {
      id: "customer-cancellation",
      heading: "2. Cancellation by the Customer",
      paragraphs: [
        "You can cancel a Booking in the app or on the website until the puja starts, while the Booking is waiting for a Pujari or confirmed. Before you confirm the cancellation, the Platform shows the cancellation charge and the refund for that Booking, and asks you for a reason. A cancellation is effective only when B-Seva records it.",
        "The cancellation charge is a percentage of the Booking total and depends on how long before the scheduled start time you cancel. Timing is calculated from the scheduled Booking date and time against the current date and time.",
      ],
      table: [
        ["When you cancel", "Cancellation charge", "Refund to your B-Seva wallet"],
        ["More than 48 hours before the scheduled start", "10% of the Booking total", "90% of the Booking total"],
        ["Between 24 and 48 hours before the scheduled start", "50% of the Booking total", "50% of the Booking total"],
        ["Less than 24 hours before the scheduled start", "100% of the Booking total", "No refund"],
      ],
    },
    {
      id: "customer-cancellation-notes",
      heading: "Unpaid Bookings and Booking-specific terms",
      paragraphs: [
        "If a Booking has not been paid, no cancellation charge applies. If a different cancellation policy is shown for a particular Service or Booking before you confirm it, that policy applies to that Booking.",
      ],
    },
    {
      id: "rescheduling",
      heading: "3. Rescheduling by the Customer",
      paragraphs: [
        "You can reschedule a paid Booking that is waiting for a Pujari or confirmed, to a new date and time, up to 48 hours before the scheduled start. Rescheduling closes 48 hours before the puja starts; after that, you can cancel under Section 2 or contact support.",
        `A rescheduling fee may apply. Any fee is shown to you before you confirm the new date and time. ${toConfirm("rescheduling fee amounts (first and subsequent reschedule) currently configured in Admin settings")}`,
        "When you reschedule, the Booking may be offered again to available Pujaris for the new date and time.",
      ],
    },
    {
      id: "pujari-cancellation",
      heading: "4. Cancellation by the Pujari",
      paragraphs: [
        "If the assigned Pujari cancels an accepted Booking, your Booking stays active. B-Seva removes that Pujari from the Booking and offers it to other eligible Pujaris, or assigns a replacement. You are not charged for a Pujari’s cancellation.",
        "If B-Seva cannot find a replacement Pujari, B-Seva will offer you a new date, a credit, or a full refund of the amount paid for the affected Booking to your B-Seva wallet, as you choose where practicable, as set out in Section 9 of the Customer Terms.",
        "A Pujari who cancels an accepted Booking is charged a percentage of the Booking total, deducted from the Pujari’s B-Seva wallet:",
      ],
      table: [
        ["When the Pujari cancels", "Charge to the Pujari"],
        ["More than 48 hours before the scheduled start", "10% of the Booking total"],
        ["Between 24 and 48 hours before the scheduled start", "50% of the Booking total"],
        ["Less than 24 hours before the scheduled start", "Treated as a no-show: 100% of that puja’s cost"],
      ],
    },
    {
      id: "pujari-cancellation-notes",
      heading: "Pujari wallet rules",
      paragraphs: [
        "The Partner app shows the charge before the Pujari confirms a cancellation. A Pujari whose wallet balance is too low may be unable to cancel in the app and must contact partner support. Genuine emergencies, illness, and force majeure are treated fairly when supported by reasonable evidence, as set out in the Pujari Terms.",
      ],
    },
    {
      id: "no-show",
      heading: "5. Pujari no-show",
      paragraphs: [
        "If the assigned Pujari does not arrive or connect for a confirmed Booking, please report it promptly in the app or to support. A Pujari no-show may be marked by B-Seva or, after a grace period of 2 hours from the scheduled start, automatically. B-Seva may review and waive a no-show where the Pujari shows a genuine reason.",
        "For a no-show, 100% of that puja’s cost is deducted from the Pujari’s wallet, and the Pujari’s settlement for that Booking is held.",
        `For the Customer, B-Seva will offer a substitute Pujari, a new date, a credit, or a full refund of the amount paid for the affected Booking to your B-Seva wallet. ${toConfirm("Customer remedy and refund process for a Pujari no-show")}`,
      ],
    },
    {
      id: "customer-no-show",
      heading: "6. Customer not available or Service Location unsuitable",
      paragraphs: [
        `If you are not present, deny access, provide an unsafe Service Location, or do not provide required information or facilities, a cancellation or no-show charge may apply. ${toConfirm("Customer no-show charge")}`,
      ],
    },
    {
      id: "bseva-cancellation",
      heading: "7. Cancellation or rescheduling by B-Seva",
      paragraphs: [
        "B-Seva may cancel or reschedule a Booking because of Service Provider unavailability, safety, fraud, legal requirements, technical failure, weather, travel disruption, or force majeure. In that case B-Seva will offer you a substitute Service Provider, a new date, a credit, or a full refund of the amount paid for the affected Booking, as you choose where practicable.",
        "If an obvious pricing error is discovered after you confirm a Booking, we will contact you and offer you the choice to proceed at the correct price or cancel for a full refund.",
      ],
    },
    {
      id: "refunds",
      heading: "8. How and when refunds are made",
      bullets: [
        "Refunds are credited to your B-Seva wallet. A refund for a cancellation you make in the Platform is credited when the cancellation is recorded, and you receive a notification and a refund email.",
        "Where a tax invoice was issued for the Booking, B-Seva issues a credit note for the refunded amount.",
        "You can use your wallet balance for future Bookings.",
        `You can ask support to return an unused wallet balance to your bank account. ${toConfirm("process and timing for returning unused wallet balance to a bank account")} Your bank may take additional time to credit the amount.`,
        "Refunds that B-Seva approves after a complaint, a B-Seva cancellation, or a no-show are credited to your wallet once approved.",
      ],
    },
    {
      id: "account-deletion",
      heading: "9. Bookings when you delete your account",
      paragraphs: [
        "If you request deletion of your account, your upcoming Bookings are cancelled under this policy, so the charges in Section 2 apply. The refund for each Booking is shown before you confirm the deletion request. A puja that is already in progress is completed first. Bookings cancelled as part of a deletion request are not restored if you later cancel the deletion request.",
        "If you are a Pujari, Bookings you have accepted are reassigned to another Pujari or resolved by B-Seva, and payouts for completed Bookings are settled before final deletion.",
      ],
    },
    {
      id: "disputes",
      heading: "10. Questions and disputes",
      paragraphs: [
        `If you think a charge or refund is wrong, contact customer support at ${SUPPORT_EMAIL} or ${PHONE} (Pujaris: ${PARTNER_EMAIL}), with your Booking ID. If we cannot resolve it, you can contact the Grievance Officer. Nothing in this policy limits your rights under the Consumer Protection Act, 2019.`,
      ],
      table: grievanceTable(),
    },
    {
      id: "changes",
      heading: "11. Changes to this policy",
      paragraphs: [
        "B-Seva may update this policy, including the percentages and time windows above. Each version shows its effective date. A change will not apply to a Booking already completed. For a material change, we will notify you through the Platform or by email (and by SMS or WhatsApp where enabled) at least 15 (fifteen) days before it takes effect, unless a shorter period is required for legal, safety, fraud, or security reasons.",
      ],
    },
  ],
});
