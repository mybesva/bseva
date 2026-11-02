import {
  CIN,
  COMPANY,
  DATA_PROTECTION_CONTACT,
  DELETE_ACCOUNT_URL,
  EFFECTIVE_DATE,
  GRIEVANCE_EMAIL,
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

const retention = (what: string) => toConfirm(`retention period for ${what}`);

export const privacyPolicy = withToConfirm({
  slug: "privacy-policy",
  title: "Privacy Policy",
  version: LEGAL_VERSION,
  effectiveDate: EFFECTIVE_DATE,
  intro: [
    `${COMPANY}, operating as B-Seva (“B-Seva,” “we,” “us,” or “our”). CIN: ${CIN}. Registered office: ${REGISTERED_OFFICE}. GSTIN: ${GSTIN}.`,
    "This Privacy Policy explains what personal data B-Seva collects when you use the B-Seva website, the B-Seva Customer app, the B-Seva Pujari / Partner app, and our support channels (together, the “Platform”), why we use it, who we share it with, how long we keep it, and the rights you have. It applies to Customers, Pujaris and other Service Providers, and visitors to our website.",
    "We process personal data in line with the Digital Personal Data Protection Act, 2023 (the “DPDP Act”), the Information Technology Act, 2000, and the rules under them. For the purposes of the DPDP Act, B-Seva is the Data Fiduciary for the personal data described in this policy.",
  ],
  sections: [
    {
      id: "data-we-collect",
      heading: "1. Personal data we collect",
      paragraphs: ["Depending on how you use the Platform, we collect the following categories of personal data:"],
      bullets: [
        "Account data: your name, email address, phone number, password (stored only as a one-way hash, never in readable form), account role (Customer or Pujari), and preferred language.",
        "Customer profile and addresses: saved addresses and their map coordinates, your profile photo if you add one, and a GSTIN if you provide one for invoices.",
        "Family Sankalp details: names, gotra, relationship, and date of birth of family members you choose to add for sankalp, and the names, gotra, sankalp text, and family details you give when you register for a seva.",
        "Pujari identity and verification data: full name, father’s name, gotra, pravara, date of birth, native place, current and permanent addresses, gender, languages, qualifications, sampradaya, licence number, profile photo, signature, and identity documents such as Aadhaar and other documents you upload for verification.",
        "Pujari bank and payout data: bank account number, IFSC, account holder name, and UPI ID, used to pay you.",
        "Tax data: GSTIN (for Customers and Pujaris where provided) and the tax details needed for invoices.",
        "Booking data: the Service booked, date and time, mode (in person or online), Service Location address and coordinates, special instructions, the meeting link for an online Service, the start and completion codes used to confirm that a puja has started and finished, your time zone and country for online Services, and the Booking history.",
        "Payment, wallet, invoice, and settlement data: wallet balance and transactions, the reference of any UPI or bank transfer you make to add wallet credit, refunds, cancellation charges, tax invoices and credit notes (including the billing name, address, and GSTIN on them), and Pujari settlements and payout records.",
        "Location data: the location you allow when adding an address or finding nearby Services (Customers), and, for Pujaris, location points recorded during the travel window for a confirmed in-person Booking (see Section 4).",
        "Photos, documents, and signature: profile photos, Pujari verification documents, and the Pujari signature.",
        "Ratings, support, and reports: ratings and review comments, support tickets and messages, and reports you make about a Pujari, Customer, or Booking, or that are made about you.",
        "Device data: the push notification token and device platform (Android, iOS, or web) used to send you notifications.",
        "Network and log data: IP address, request details, and error logs recorded by our servers. For online Services, your IP address is used to look up your approximate country and time zone.",
        "Consent records: the version of the terms and Privacy Policy you accepted, when you accepted them, and Booking-level acceptances.",
      ],
    },
    {
      id: "sources",
      heading: "2. How we collect personal data",
      bullets: [
        "From you, when you register, complete your profile or Pujari onboarding, add addresses or family members, make a Booking, contact support, rate a Service, or submit a report.",
        "From your device, when you allow location, camera, photo, or notification permissions, and automatically through our servers when you use the Platform.",
        "From other users, for example when a Customer gives the names of family members for sankalp, or when a Customer or Pujari makes a report that concerns you.",
        "From B-Seva staff, when they create or update a Booking, record a wallet credit, or verify Pujari documents.",
      ],
      paragraphs: [
        "If you give us personal data about another person, such as a family member, you confirm that you are entitled to share it with us for the Booking or seva. If you add details of a family member who is under 18, you confirm that you are their parent or lawful guardian.",
      ],
    },
    {
      id: "purposes",
      heading: "3. Why we use personal data",
      bullets: [
        "To create and secure your account, verify your email address, let you sign in, reset your password, and confirm sensitive actions such as account deletion.",
        "To show Services and nearby Pujaris, take and manage Bookings, assign and reassign Pujaris, and run the puja start and completion steps.",
        "To verify Pujari identity, qualifications, and eligibility, and to display approved Pujari profiles to Customers.",
        "To manage wallets, payments, refunds, cancellation charges, invoices, credit notes, and Pujari settlements.",
        "To share a Pujari’s travel progress and arrival with the Customer during the travel window.",
        "To send Booking confirmations, reminders, arrival updates, service emails, and push notifications.",
        "To provide support, handle complaints and reports, investigate safety incidents, no-shows, fraud, and misuse, and resolve disputes.",
        "To keep the Platform secure, prevent abuse, and maintain logs and audit records.",
        "To understand how the Platform is used and improve it.",
        "To meet legal obligations, including tax, accounting, and law-enforcement requirements, and to establish or defend legal claims.",
      ],
    },
    {
      id: "location",
      heading: "4. Location data and live tracking",
      paragraphs: [
        "Customers: when you allow it, the Customer app and website use your device’s location while you are using them, to find nearby Services and to fill in or confirm an address. The Customer app does not collect location in the background.",
        "Pujaris: for a confirmed in-person Booking, the Pujari app collects the Pujari’s location during the travel window, including while the app is in the background, and shares it with B-Seva and with the Customer of that Booking. The travel window currently begins 15 minutes before the scheduled start time and ends when the Pujari arrives or, at the latest, 120 minutes after the scheduled start time. While it is open, a location point is recorded about once every 60 seconds or about every 35 metres of movement. Location is not collected for this purpose outside the travel window or for online Bookings. The app explains this use and asks for permission before it collects background location, and the Pujari can withdraw the permission in device settings at any time.",
        `Location points recorded during the travel window are kept for ${toConfirm("location history retention")} and then deleted, unless they are needed for an open complaint, dispute, or safety investigation.`,
      ],
    },
    {
      id: "legal-basis",
      heading: "5. Consent and legal grounds",
      paragraphs: [
        "We process your personal data on the basis of your consent, which you give when you create an account, accept the terms and this Privacy Policy, make a Booking, or allow a device permission. We ask for separate permission before collecting device location, background location (Pujari app), camera and photos, and notifications.",
        "We may also process personal data without consent where the DPDP Act permits it as a legitimate use, for example where you have voluntarily provided the data for a specified purpose, to comply with a law or a court order, or to respond to a medical emergency or a threat to safety.",
        "You can withdraw your consent at any time through the Platform, by changing device permissions, or by contacting us (Section 12). Withdrawal does not affect processing that took place before it. If you withdraw consent for data that a Service needs, we may be unable to provide that Service, and we may continue to keep data we are legally required to keep.",
      ],
    },
    {
      id: "sharing",
      heading: "6. Who we share personal data with",
      paragraphs: ["We do not sell your personal data. We share it only as follows:"],
      bullets: [
        "With the other party to your Booking. A Customer sees the assigned Pujari’s name, photo, profile details, ratings, and, during the travel window, the Pujari’s live location on a map. The assigned Pujari sees the Booking details needed to perform the Service; the Customer’s full address, contact details, and, for online Services, the meeting link are made available closer to the Booking (currently from 20 hours before the scheduled start). A Pujari never sees the Customer’s invoice, and Customers never see a Pujari’s bank details or documents.",
        "With an email delivery provider, which sends account emails, one-time passwords, Booking emails, and invoices.",
        "With a push notification provider, which delivers app notifications. Notifications can include Booking details and the puja start and completion codes.",
        "With mapping and geocoding services, which display maps, search for addresses, and convert coordinates into addresses. They receive coordinates and the address text you search for.",
        "With IP-based location services, which receive your IP address to determine your country and time zone for online Services.",
        "With a cloud hosting provider: our database and file storage are hosted on Amazon Web Services (AWS) in the Mumbai (India) region.",
        "With an analytics provider, which helps us understand how the website is used.",
        "With B-Seva staff who need the data for their role, under access controls.",
        "With government authorities, regulators, courts, or law enforcement where the law requires it or to protect the safety of users, and with professional advisers under confidentiality.",
        "With a successor organization as part of a merger, acquisition, or business transfer, with notice to you.",
      ],
    },
    {
      id: "sharing-locations",
      heading: "Where data is processed",
      paragraphs: [
        `Our main database and file storage are in India (AWS, Mumbai region). Some service providers listed above may process data outside India. ${toConfirm("countries where email, push notification, mapping, IP lookup and analytics providers process data")}. Any transfer outside India is made only as permitted under the DPDP Act.`,
      ],
    },
    {
      id: "otp",
      heading: "7. One-time passwords and communications",
      paragraphs: [
        "We send one-time passwords (OTPs) by email to verify your email address when you sign up, to reset a forgotten password, and to confirm an account deletion request or its cancellation. OTPs are single use, expire after a short time, are stored only in hashed form, and are never shown in our logs. B-Seva staff will never ask you for an OTP or your password.",
        "Delivery of OTPs and notifications by SMS or WhatsApp is not active. It may be offered in future; we will update this Privacy Policy before we start.",
        "We send service messages about your account and Bookings by email and push notification. Where we send marketing messages, you can opt out, and they stop when you request account deletion.",
      ],
    },
    {
      id: "cookies",
      heading: "8. Browser storage and analytics on the website",
      paragraphs: [
        "The website uses your browser’s storage to keep you signed in and to remember preferences such as language. It also uses an analytics tool to measure page visits and improve the website.",
      ],
    },
    {
      id: "security",
      heading: "9. How we protect personal data",
      bullets: [
        "Data sent between your device and our servers is encrypted in transit (HTTPS).",
        `Bank account details are stored encrypted. ${toConfirm("encryption at rest of bank account numbers is deployed before this policy is published")}`,
        "Passwords and one-time passwords are stored only as one-way hashes.",
        "Access to personal data is limited to authorized staff by role-based permissions. Sensitive administrative actions, such as wallet credits and settlements, need additional verification and are recorded in audit logs.",
        "Uploaded documents are accessible only to authorized users.",
        "Changing or resetting your password, or requesting account deletion, signs you out on all devices.",
      ],
      paragraphs: [
        "No system is completely secure. If we become aware of a personal data breach that affects you, we will inform you and the authorities as the law requires.",
      ],
    },
    {
      id: "retention",
      heading: "10. How long we keep personal data",
      paragraphs: [
        "We keep personal data only for as long as we need it for the purposes in this policy, or as long as the law requires. The periods below apply after your account is deleted or the record is no longer needed, unless a longer period is required by law or the data is needed for an open complaint, dispute, refund, settlement, or safety investigation.",
      ],
      table: [
        ["Category", "Retention period"],
        ["Account and profile data, addresses, Family Sankalp details", `Until account deletion is completed, then deleted or anonymized. ${retention("account and profile data")}`],
        ["Pujari identity data, Aadhaar and other documents, photo, signature", `Until account deletion is completed. ${retention("Pujari identity documents")}`],
        ["Bank and UPI details", `Until account deletion is completed. ${retention("bank and UPI details")}`],
        ["Bookings and special instructions", retention("booking records")],
        ["Tax invoices, credit notes, payment, wallet, refund, and settlement records", `As required by tax and accounting law. ${retention("invoice, tax, payment and settlement records")}`],
        ["Pujari location points (travel window)", toConfirm("location history retention")],
        ["Ratings, support tickets and messages, reports", retention("ratings, support messages and reports")],
        ["One-time password records", retention("OTP records")],
        ["Notifications and push tokens", `Push tokens until account deletion is completed. ${retention("notifications")}`],
        ["Consent and acceptance records", retention("consent records")],
        ["Security and audit logs", retention("security and audit logs")],
        ["Server logs (including IP addresses)", "30 days"],
        ["Backups", "Backups are kept for a limited period. Deleted data disappears from them when they expire."],
      ],
    },
    {
      id: "deletion",
      heading: "11. Deleting your account",
      paragraphs: [
        `You can request deletion of your account in the app (Profile → Account → Delete Account), on our website at ${DELETE_ACCOUNT_URL}, or by contacting support. You confirm the request with an OTP sent to your registered email address, and your account is deactivated once you confirm.`,
        "Your account is then held for 14 days while B-Seva resolves Bookings and settles refunds and payouts. During this period you can cancel the request from the delete-account page or by signing in and choosing Cancel Deletion, confirmed with an email OTP. On completion of the 14-day period, we delete or anonymize your personal data, including profile data, addresses, family members, documents, photos, signature, push tokens, notifications, and location points. If a refund, settlement, complaint, or dispute is still open, final deletion waits until it is resolved, and we tell you. We confirm completion by email (and by SMS or WhatsApp where enabled).",
        "We keep the records the law requires us to keep, such as tax invoices, credit notes, payment, wallet, refund, and settlement records, and records needed for an open complaint, dispute, or safety investigation, for the periods in Section 10. Where we keep a Booking or financial record, your identity in other records is anonymized where possible. Ratings and support messages may be kept without your identity.",
      ],
    },
    {
      id: "rights",
      heading: "12. Your rights",
      paragraphs: ["Under the DPDP Act, you have the right to:"],
      bullets: [
        "access a summary of the personal data we process about you and the processing activities, and the identities of those we have shared it with;",
        "correct, complete, or update inaccurate or incomplete personal data;",
        "erase personal data that is no longer needed, subject to the retention we must apply by law;",
        "withdraw consent at any time;",
        "have your grievances about our processing of your personal data redressed; and",
        "nominate another person to exercise your rights if you die or become unable to do so.",
      ],
    },
    {
      id: "rights-how",
      heading: "How to exercise your rights",
      paragraphs: [
        `You can update much of your data yourself in the Platform. For any other request, contact our data protection contact, ${DATA_PROTECTION_CONTACT}, or the Grievance Officer at ${GRIEVANCE_EMAIL}. Customers can also write to ${SUPPORT_EMAIL} and Pujaris to ${PARTNER_EMAIL}. We may ask you to confirm your identity before acting on a request. If you are not satisfied with our response, you may approach the Data Protection Board of India.`,
      ],
    },
    {
      id: "children",
      heading: "13. Children",
      paragraphs: [
        "The Platform is only for people who are 18 or older, and we do not knowingly create accounts for children. Details of a family member under 18 may be included in a Booking or Family Sankalp only by their parent or lawful guardian, and only for that purpose. If you believe a child has created an account, please contact us and we will delete it.",
      ],
    },
    {
      id: "grievance",
      heading: "14. Grievance Officer and contact",
      paragraphs: [`For any question or complaint about this Privacy Policy or your personal data, contact our Grievance Officer. Phone: ${PHONE}.`],
      table: grievanceTable(),
    },
    {
      id: "grievance-response",
      heading: "Response times",
      paragraphs: [
        "We will acknowledge your complaint within 48 hours and aim to resolve it within one month of receipt, or sooner where the law requires.",
      ],
    },
    {
      id: "changes",
      heading: "15. Changes to this Privacy Policy",
      paragraphs: [
        "We may update this Privacy Policy to reflect changes in the law, our Services, or how we process personal data, including before we start any new kind of processing such as SMS or WhatsApp messages or online payment. Each version shows its effective date. For a material change, we will notify you through the Platform or by email (and by SMS or WhatsApp where enabled) before it takes effect and, where required, ask for your consent again.",
      ],
    },
  ],
});
