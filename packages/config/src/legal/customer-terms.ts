import type { LegalDoc } from "./types";
import {
  COMPANY,
  DELETE_ACCOUNT_URL,
  EFFECTIVE_DATE,
  GSTIN,
  LEGAL_VERSION,
  PHONE,
  REGISTERED_OFFICE,
  SUPPORT_EMAIL,
  grievanceTable,
} from "./shared";

export const customerTerms: LegalDoc = {
  slug: "customer-terms",
  title: "Customer Terms & Conditions",
  version: LEGAL_VERSION,
  effectiveDate: EFFECTIVE_DATE,
  intro: [
    `Operated by: ${COMPANY}. Registered office: ${REGISTERED_OFFICE}. GSTIN: ${GSTIN}. Customer support: ${PHONE} | ${SUPPORT_EMAIL}`,
    "Please read these Customer Terms carefully before you create an account or place a Booking. By using B-Seva you agree to these terms. If you do not agree, please do not use the Platform.",
  ],
  sections: [
    {
      id: "agreement",
      heading: "1. Agreement and documents that apply",
      paragraphs: [
        "These Customer Terms & Conditions (the “Customer Terms”) govern your access to and use of the B-Seva website, mobile applications, booking system, approved telephone and messaging channels, and related services (together, the “Platform”). They form a binding contract between you (“Customer,” “you,” or “your”) and B-SEVA PRIVATE LIMITED, a company incorporated in India, operating as B-Seva (“B-Seva,” “we,” “us,” or “our”).",
        "The following documents together form the “Customer Agreement”:",
      ],
      bullets: [
        "these Customer Terms;",
        "the Booking page, Service description, price, taxes, fees, and Booking-specific conditions shown before you confirm a Booking;",
        "the B-Seva Cancellation and Refund Policy;",
        "the B-Seva Privacy Policy;",
        "the B-Seva safety, conduct, content, and payment policies published on the Platform; and",
        "any written terms expressly agreed for a corporate, temple, institutional, or bulk Booking.",
      ],
    },
    {
      id: "agreement-order",
      heading: "Order of precedence",
      paragraphs: [
        "If these documents conflict, the following order applies: mandatory law; a signed written addendum; the Booking-specific terms for that Booking; these Customer Terms; and then other Platform policies. The Privacy Policy governs how we handle personal data.",
      ],
    },
    {
      id: "definitions",
      heading: "2. Definitions",
      paragraphs: [
        "“Booking” means a confirmed request for a Service placed through the Platform after the required confirmation and payment steps are completed.",
        "“Cancellation Policy” means the B-Seva Cancellation and Refund Policy and any cancellation, rescheduling, refund, no-show, or credit terms shown for a particular Service or Booking.",
        "“Circumvention” means knowingly using a B-Seva introduction or Protected Relationship to arrange, pay for, renew, repeat, refer, or facilitate a substantially similar Service directly, or through someone else, outside B-Seva, where the opportunity arose through B-Seva.",
        "“Customer Content” means information, text, photographs, instructions, reviews, ratings, or other material you submit.",
        "“Introduced Service Provider” means a Pujari or other Service Provider whose identity, availability, contact details, or service opportunity became known to you through B-Seva, including through an enquiry, recommendation, communication, assignment, or Booking.",
        "“Platform Information” means non-public information obtained through B-Seva, including another person’s contact details, Booking records, internal communications, pricing, and operational information.",
        "“Protected Relationship” means the relationship between you and a Service Provider that was created or materially facilitated by a B-Seva introduction or Booking.",
        "“Service” means a pooja, puja, homam, havan, archana, priest or purohit service, religious ceremony, astrological or related consultation, pooja materials (samagri) service, transport or related service, or any other service listed on or arranged through the Platform.",
        "“Service Location” means the home, venue, temple, office, event location, or other place you specify for a Booking.",
        "“Service Provider” means an independent Pujari, pandit, purohit, astrologer, ritual assistant, helper, vendor, driver, or other provider listed on or connected through the Platform.",
      ],
    },
    {
      id: "eligibility",
      heading: "3. Eligibility, account, and electronic acceptance",
      paragraphs: [
        "You must be at least 18 years old and legally capable of entering into a contract under Indian law. If you use the Platform on behalf of a family, organization, temple, or another person, you confirm that you have authority to bind them.",
        "You create your account with your email address and a password. We verify your email address with a one-time password (OTP) sent by email, and we also use email OTPs to reset a forgotten password and to confirm an account deletion request. Sign-in with a mobile number and an OTP sent by SMS or WhatsApp may be offered in future; we will update this document first.",
        "You must provide accurate, current, and complete information and keep it updated. You are responsible for keeping your login credentials and OTPs confidential and for activity under your account. Do not create false or duplicate accounts or use another person’s account without permission.",
        "You accept the Customer Agreement when you tick an acceptance box, click “I Agree,” complete an OTP-verified sign-up, create an account, confirm a Booking, or make a payment. We keep a record of your acceptance, including your account identifier, date and time, the version accepted, and the Booking ID where relevant, in line with our Privacy Policy.",
      ],
    },
    {
      id: "role",
      heading: "4. B-Seva’s role and Service Provider relationship",
      paragraphs: [
        "B-Seva operates a technology-enabled marketplace and service-coordination Platform. We provide listings, search, matching, Booking notifications and support communication, payment collection, scheduling support, Customer support, and safety and dispute coordination.",
        "Service Providers are independent third parties. They are not employees, agents, partners, or representatives of B-Seva unless we state otherwise in writing. B-Seva does not itself perform religious Services and does not decide a Service Provider’s ritual tradition, religious interpretation, or professional judgment.",
        "We carry out onboarding and verification checks on Service Providers as described on the Platform. These checks depend on the information and records available and are not a guarantee of a Service Provider’s identity, qualifications, character, conduct, or performance. Please review the listing and ask any questions before you confirm a Booking.",
        "B-Seva does not promise any spiritual, astrological, medical, financial, legal, or other outcome from a Service. A Service is not a substitute for advice from a qualified professional where such advice is needed.",
      ],
    },
    {
      id: "booking",
      heading: "5. Booking and service selection",
      paragraphs: [
        "You are responsible for choosing a Service that meets your needs, including date, time, location, duration, language, tradition, materials, number of participants, and access needs. A Booking is confirmed only when B-Seva shows or sends you a confirmation through the Platform or by email (and by SMS or WhatsApp where enabled).",
        "Availability, pricing, materials, travel radius, additional priests, helpers, waiting time, and cancellation terms may vary by Service and location. The Booking page shows what is included. If anything is unclear, contact us before you confirm.",
        "B-Seva may assign or substitute a suitable Service Provider where the Booking allows it, or where reasonably necessary because of illness, unavailability, travel disruption, safety, legal requirements, or force majeure. If a substitution materially changes your Booking, we will tell you and offer you the choice to accept the substitute, reschedule, or cancel for a refund under the Cancellation Policy.",
        "Do not ask a Service Provider to perform a different, unsafe, unlawful, or undisclosed activity. Any additional Service, materials, priest, travel, or expense must be approved and paid through B-Seva, except for an immediate safety measure in an emergency.",
      ],
    },
    {
      id: "customer-information",
      heading: "6. Customer information, access, and facilities",
      paragraphs: [
        "You must give us accurate information needed to perform the Service, including the Service Location, access instructions, contact details, preferred language or tradition, participant details, material requirements, and any known hazards or restrictions. Please update us promptly if anything changes.",
        "You must provide a lawful, safe, accessible, and suitable Service Location, including any facilities, seating, water, electrical access, or ventilation stated in the Booking. Tell us and the Service Provider in advance about open-flame restrictions, access limitations, pets, children, elderly or vulnerable persons, allergies, smoke sensitivities, or other material risks.",
        "You are responsible for the conduct and safety of family members, guests, children, pets, and property at the Service Location. You must not permit harassment, threats, discrimination, abuse, or unsafe or unlawful conduct, and you must ensure the Service Provider can leave safely if conditions become unsafe.",
        "Do not give access to rooms, devices, safes, documents, or property unrelated to the Service. Please secure valuables and personal information before the Service begins.",
      ],
    },
    {
      id: "conduct",
      heading: "7. Customer conduct and prohibited activities",
      paragraphs: ["You must use the Platform and deal with Service Providers honestly, respectfully, and lawfully. You must not:"],
      bullets: [
        "threaten, intimidate, harass, discriminate against, abuse, exploit, or retaliate against a Service Provider or any other person;",
        "ask or pressure a Service Provider to perform an unlawful, unsafe, deceptive, or materially different activity;",
        "provide false information, misuse another account, manipulate reviews, or create accounts to avoid a fee or restriction;",
        "record, photograph, publish, or share a Service Provider’s image, voice, or personal information without their consent and lawful authority;",
        "bring a weapon, unlawful substance, or hazardous item to a Service Location;",
        "use the Platform to solicit unrelated business or personal services from a Service Provider or another Customer; or",
        "interfere with, reverse engineer, scrape, overload, damage, or introduce malware into the Platform.",
      ],
    },
    {
      id: "conduct-enforcement",
      heading: "Enforcement",
      paragraphs: [
        "B-Seva may remove content, restrict features, cancel a Booking, or suspend an account where reasonably necessary for safety, fraud prevention, legal compliance, or the protection of other users or the Platform, in line with Section 20.",
      ],
    },
    {
      id: "payments",
      heading: "8. Pricing, taxes, payments, and authorization",
      paragraphs: [
        "The amount you pay is the total shown before you confirm the Booking. It includes the Service fee, any B-Seva platform or convenience fee, applicable taxes (including GST), materials, travel, additional providers, and other charges, each shown separately where applicable. No charge that was not shown before confirmation will be added unless you separately approve it.",
        "Bookings are paid from your B-Seva wallet. At present, credit is added to your wallet through B-Seva support: you pay B-Seva by UPI or bank transfer, and we credit your wallet once we have confirmed the payment. Online payment through a payment gateway may be added later; we will update this document first. You authorize B-Seva to debit your wallet for the Booking, any additional charges you approve, and any cancellation or no-show amount clearly disclosed in the Cancellation Policy. Use only a payment method you are authorized to use.",
        "Unless the Booking expressly allows another method, do not pay a Service Provider directly by cash, UPI, bank transfer, card, gift, or any other method for a B-Seva Booking, and never share your payment credentials or OTPs with a Service Provider. If a Service Provider asks for an unauthorized payment, please report it to us.",
        "B-Seva will issue a GST-compliant tax invoice for amounts it collects, as required by law. If an obvious pricing error appears before you confirm, we may correct it; if it is discovered after confirmation, we will contact you and offer you the choice to proceed at the correct price or cancel for a full refund.",
      ],
    },
    {
      id: "cancellation",
      heading: "9. Cancellation, rescheduling, refunds, and no-shows",
      paragraphs: [
        "The Cancellation Policy shown for the Service or Booking applies. It sets out the free-cancellation window, cancellation charges, rescheduling rules, no-show rules, refund method, and refund timing. If no Booking-specific policy is shown, the default B-Seva Cancellation and Refund Policy published on the Platform applies.",
        "You may cancel or reschedule through the Platform or our support channels. A cancellation is effective only when B-Seva records it. Please do not cancel privately with a Service Provider or arrange a replacement outside the Platform.",
        "If you are not present, deny access, provide an unsafe Service Location, or fail to provide required information or facilities, a cancellation or no-show charge may apply as stated in the Cancellation Policy. If a Service Provider does not arrive, is materially late, behaves unsafely, or fails to perform, please report it promptly so we can investigate and provide the applicable remedy.",
        "B-Seva may cancel or reschedule a Booking because of Service Provider unavailability, safety, fraud, legal requirements, technical failure, weather, travel disruption, or force majeure. In that case we will offer you a substitute Service Provider, a new date, a credit, or a full refund of the amount paid for the affected Booking, as you choose where practicable.",
        `Approved refunds are credited to your B-Seva wallet. A refund for a cancellation you make in the Platform is credited when the cancellation is recorded. You can ask support to return an unused wallet balance to your bank account (processed within 7 working days of verifying your bank details); your bank may take additional time to credit the amount.`,
      ],
    },
    {
      id: "interactions",
      heading: "10. Pujari and Service Provider interactions",
      paragraphs: [
        "Please use B-Seva’s communication and payment channels for B-Seva Bookings and share only the information needed for the Booking. You must not request or use a Service Provider’s personal phone number, WhatsApp, UPI ID, bank details, visiting card, social-media account, or other contact or payment details to move a B-Seva Booking or opportunity off the Platform.",
        "You must not ask or encourage a Service Provider to cancel, under-report, or avoid a Booking so that you can deal directly, and you must not use a family member, friend, company, temple, society, intermediary, or separate account to bypass B-Seva.",
        "If you had a genuine, independent relationship with a Service Provider before your first B-Seva Booking with them, that relationship is not restricted by these Customer Terms. Simply having heard of or seen a Service Provider is not, by itself, a pre-existing relationship.",
        "If a Service Provider offers to deal with you directly, please decline and report it by reporting the Pujari or the Booking in the app, or by contacting support. Nothing in these Customer Terms prevents you from obtaining religious services generally from other priests, temples, institutions, platforms, or providers.",
      ],
    },
    {
      id: "non-circumvention",
      heading: "11. Customer non-circumvention",
      paragraphs: [
        "B-Seva invests in advertising, technology, verification, booking coordination, payment processing, and support to connect you with Service Providers. Where B-Seva introduces or assigns a Service Provider to you, you agree not to use that Protected Relationship to deprive B-Seva of a Booking or fee that would otherwise be payable through the Platform.",
        "While you use B-Seva and for 6 (six) months after your last B-Seva Booking with a particular Introduced Service Provider, you must not:",
      ],
      bullets: [
        "arrange, request, accept, pay for, renew, or repeat a substantially similar Service directly with that Introduced Service Provider where the opportunity arose through B-Seva;",
        "offer or accept a discount, gift, or private arrangement designed to avoid B-Seva’s booking or platform charges;",
        "use contact or payment details obtained through B-Seva to bypass the Platform;",
        "refer that Introduced Service Provider to a relative, friend, business, temple, society, or other person as an off-Platform substitute for a B-Seva Booking; or",
        "cancel a B-Seva Booking and then arrange the same or a substantially similar Service directly with that Introduced Service Provider to avoid B-Seva.",
      ],
    },
    {
      id: "non-circumvention-limits",
      heading: "Limits and remedies",
      paragraphs: [
        "Cancelling for a genuine reason and then independently choosing a different provider is not Circumvention. B-Seva may approve a direct arrangement in writing.",
        "This clause protects only a specific relationship that B-Seva created. It does not prevent you from choosing any priest you wish and does not restrict a Service Provider’s lawful profession.",
        "If B-Seva reasonably establishes Circumvention after giving you notice and an opportunity to respond, it may suspend or restrict your account, decline future Bookings, and recover the platform fee or other amounts that would have been payable through B-Seva for the circumvented Service. Nothing in this clause limits your rights under the Consumer Protection Act, 2019 or other applicable law.",
      ],
    },
    {
      id: "safety",
      heading: "12. Safety, premises, property, and Service risks",
      paragraphs: [
        "Religious Services may involve fire, lamps, smoke, incense, havan or homam materials, electrical equipment, liquids, heat, or crowds. You must disclose known hazards, follow reasonable safety directions, supervise children and pets, and keep people and property at a safe distance.",
        "You are responsible for the safety of your household, guests, pets, and property at the Service Location. Do not leave children, vulnerable persons, animals, or active flames unattended, and do not require a Service Provider to continue when conditions are unsafe.",
        "Please secure valuable or sensitive property before the Service. Report any injury, fire, burn, property damage, theft, harassment, or other incident promptly through B-Seva, and contact emergency services (112) or the police first where there is immediate danger.",
        "B-Seva is not responsible for an allergy, sensitivity, reaction, or property condition that you did not disclose and that could not reasonably have been identified, except where the law provides otherwise.",
      ],
    },
    {
      id: "complaints",
      heading: "13. Complaints, incidents, and cooperation",
      paragraphs: [
        "Report a safety concern, misconduct, property damage, payment issue, data concern, or Service failure by reporting the Pujari or the Booking in the app, through customer support, or to the Grievance Officer in Section 24. Please report incidents within 48 hours where possible so we can investigate effectively; a later report does not take away any right you have by law.",
        "We may ask for photographs, messages, receipts, witness details, or police or medical records reasonably needed to investigate. We may contact the Service Provider, our payment or insurance partners, or authorities; preserve records; reassign a Booking; or suspend an account. Investigating a complaint or providing assistance is not an admission of liability.",
      ],
    },
    {
      id: "privacy",
      heading: "14. Privacy and confidentiality",
      paragraphs: [
        "Our Privacy Policy explains how we collect, use, store, share, and protect your personal data in line with the Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000, and the rules under them. To fulfil a Booking, we share only the information needed with the assigned Service Provider, payment partners, and other authorized service partners.",
        "Provide only accurate and necessary information. Do not upload another person’s personal, medical, financial, identity, or religious information unless you are authorized to do so. You must not use, publish, sell, or disclose another user’s Platform Information.",
        "We keep Booking, payment, complaint, acceptance, and safety records for operations, legal compliance, fraud prevention, and dispute resolution, for the periods stated in the Privacy Policy. You can exercise your rights to access, correct, or erase your personal data, and to withdraw consent, as described in the Privacy Policy.",
      ],
    },
    {
      id: "reviews",
      heading: "15. Reviews, ratings, and Customer Content",
      paragraphs: [
        "You may post honest, relevant, and lawful ratings and reviews. You must not post fabricated, defamatory, discriminatory, obscene, threatening, confidential, or infringing content, disclose another person’s personal data, or use a review to pressure or retaliate against a Service Provider.",
        "You grant B-Seva a non-exclusive, royalty-free licence to host, display, format, translate, moderate, and use your Customer Content to operate, improve, and promote the Platform, in line with the Privacy Policy. This licence may be shared with our service vendors only as needed to operate the Platform.",
        "You remain responsible for your Customer Content. B-Seva may remove or restrict content that breaches these Customer Terms or the law. You can report a Pujari or a Booking through the Platform, or contact support about objectionable content, and we will review reports promptly.",
      ],
    },
    {
      id: "ip",
      heading: "16. Intellectual property and Platform rules",
      paragraphs: [
        "B-Seva or its licensors own the Platform, software, design, text, graphics, logos, trademarks, listings, and data compilations. B-Seva grants you a limited, revocable, non-exclusive, non-transferable licence to use the Platform for your personal or authorized organizational use.",
        "You must not copy, modify, sell, frame, scrape, reverse engineer, decompile, or create a competing product or database from the Platform, or use B-Seva marks, screens, listings, reviews, or data without our written permission.",
      ],
    },
    {
      id: "force-majeure",
      heading: "17. Force majeure and Platform availability",
      paragraphs: [
        "B-Seva is not responsible for delay or failure caused by events beyond its reasonable control, including natural disasters, epidemics, government action, strikes, civil unrest, power or telecommunications failure, payment-network failure, or severe weather. Where a Booking cannot go ahead for these reasons, Section 9 applies.",
        "The Platform may sometimes be unavailable for maintenance, security, upgrades, or legal reasons. We will make reasonable efforts to restore it quickly, but we do not guarantee uninterrupted or error-free availability.",
      ],
    },
    {
      id: "indemnification",
      heading: "18. Indemnification by Customer",
      paragraphs: [
        "To the extent permitted by law, you will indemnify B-Seva and its directors, officers, employees, and contractors against third-party claims, reasonable losses, and legal costs arising directly from:",
      ],
      bullets: [
        "your material breach of the Customer Agreement;",
        "your misuse of the Platform or another person’s account;",
        "your unlawful, fraudulent, harassing, threatening, or discriminatory conduct;",
        "your request that a Service Provider perform an unlawful, unsafe, or unauthorized activity;",
        "damage to property or injury caused by your acts or omissions at the Service Location;",
        "your infringement or misuse of another person’s rights or information; or",
        "deliberate Circumvention or unauthorized direct payment.",
      ],
    },
    {
      id: "indemnification-limits",
      heading: "Exclusions",
      paragraphs: [
        "This indemnity does not apply to losses caused by B-Seva’s own fraud, wilful misconduct, gross negligence, or any liability that cannot lawfully be transferred to you.",
      ],
    },
    {
      id: "liability",
      heading: "19. Limitation of liability",
      paragraphs: ["To the extent permitted by law, B-Seva is not liable for:"],
      bullets: [
        "the independent acts, omissions, negligence, or misconduct of a Service Provider, except to the extent caused by B-Seva’s own failure;",
        "the religious, spiritual, astrological, or procedural outcome of a Service;",
        "a Service Provider’s tradition, language, or professional judgment;",
        "injury, illness, allergic reaction, fire incident, or property damage caused by a Service Provider or by conditions at the Service Location, except to the extent caused by B-Seva’s own conduct;",
        "interactions or transactions arranged outside the Platform; or",
        "indirect, incidental, special, or consequential loss.",
      ],
    },
    {
      id: "liability-cap",
      heading: "Cap and exceptions",
      paragraphs: [
        "Subject to the paragraph below, B-Seva’s total liability to you for any claim relating to a Booking will not exceed the total amount you paid through B-Seva for that Booking.",
        "Nothing in these Customer Terms excludes or limits liability for death or personal injury caused by B-Seva’s negligence, for fraud, or for any liability that cannot be excluded or limited under the Consumer Protection Act, 2019 or other applicable law.",
      ],
    },
    {
      id: "termination",
      heading: "20. Suspension and termination",
      paragraphs: [
        `You may stop using the Platform at any time and request deletion of your account from within the app (Profile → Account → Delete Account), on our website at ${DELETE_ACCOUNT_URL}, or by contacting support. Account deletion works as follows:`,
      ],
      bullets: [
        "Confirmation and deactivation. You confirm your request with a one-time password (OTP) sent to your registered email address. Your account is deactivated once you confirm the request: you are signed out on all devices, you will not be able to place new Bookings, and we will stop sending you marketing messages. Before you confirm, the Platform shows any upcoming Bookings. Upcoming Bookings are cancelled under the Cancellation Policy, so cancellation charges may apply; the refund for each Booking is shown to you before you confirm. A puja that is already in progress is completed first.",
        `Settlement and review (14 days). During this period B-Seva reviews the account and settles all pending amounts. Any refund due to you is credited to your B-Seva wallet, any refundable wallet balance is returned to your verified bank account, and any amount you owe for Services already received is reconciled.`,
        "Final deletion (on completion of the 14-day period). Your account and personal data are permanently deleted or anonymized, subject to the retention described below, and we confirm completion by email (and by SMS or WhatsApp where enabled). If a refund, settlement, complaint, or dispute is still open at that time, final deletion waits until it is resolved, and we will tell you.",
      ],
    },
    {
      id: "termination-cancel",
      heading: "Cancelling deletion, retention, and suspension",
      paragraphs: [
        `You may cancel your deletion request before final deletion, either on ${DELETE_ACCOUNT_URL} or by signing in and choosing Cancel Deletion. You confirm the cancellation with an OTP sent to your registered email address. Bookings that were cancelled as part of your deletion request are not restored.`,
        "B-Seva keeps only the records it must retain by law (for example, GST invoices, payment and tax records, and records needed for an open complaint, dispute, or safety investigation), for the period required, after which they are deleted, as explained in the Privacy Policy. Deletion does not remove obligations or claims that arose before your request.",
        "B-Seva may suspend, restrict, or terminate an account or Booking for false information, fraud, abuse, harassment, unsafe conduct, non-payment, chargeback misuse, data misuse, Circumvention, breach of the Customer Agreement, a legal requirement, or a material risk to users or the Platform. We will normally give you notice and an opportunity to respond before acting, but we may act immediately for urgent safety, fraud, security, or legal reasons. You may appeal a suspension through the Grievance Officer in Section 24.",
      ],
    },
    {
      id: "updates",
      heading: "21. Updates and material changes",
      paragraphs: [
        "B-Seva may update these Customer Terms and Platform policies to reflect changes in law, technology, security, Services, or business operations. Each version shows its effective date. For a material change, we will notify you through the Platform or by email (and by SMS or WhatsApp where enabled) at least 15 (fifteen) days before it takes effect, unless a shorter period is required for legal, safety, fraud, or security reasons.",
        "A change will not apply to a Booking already completed. Where required, we will ask you to accept the updated terms before your next Booking. If you do not agree, you may stop using the Platform and delete your account.",
      ],
    },
    {
      id: "disputes",
      heading: "22. Dispute resolution and governing law",
      paragraphs: [
        "The Customer Agreement is governed by the laws of India. Please first raise any dispute with customer support or the Grievance Officer in Section 24, and we will try to resolve it in good faith.",
        "If a dispute is not resolved within 30 days, either party may refer it to arbitration under the Arbitration and Conciliation Act, 1996, before a sole arbitrator appointed by mutual agreement or, failing agreement, in accordance with that Act. The seat and venue of arbitration will be Hyderabad, Telangana, and the proceedings will be in English.",
        "Nothing in this Section prevents you from approaching a Consumer Disputes Redressal Commission, the National Consumer Helpline (1915), or any other forum available to you by law. Either party may seek urgent interim relief from a competent court. Subject to the above, the courts at Hyderabad, Telangana have jurisdiction.",
      ],
    },
    {
      id: "general",
      heading: "23. General terms",
      paragraphs: [
        "If any provision is found invalid or unenforceable, it will be applied to the maximum extent permitted and the remaining provisions will continue in force. A delay in enforcing a right is not a waiver. You may not transfer the Customer Agreement without B-Seva’s written consent. B-Seva may transfer it to a successor or group company as part of a reorganization or business transfer, with notice to you.",
        "The Customer Agreement is the complete agreement on its subject matter. No Service Provider, support agent, or marketing material may change it except through an authorized B-Seva update.",
        "These Customer Terms may be provided in English, Telugu, Hindi, or other languages. If there is any inconsistency, the English version prevails to the extent permitted by law.",
      ],
    },
    {
      id: "grievance",
      heading: "24. Grievance Redressal and contact",
      paragraphs: [
        "In accordance with the Consumer Protection (E-Commerce) Rules, 2020, the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and the Digital Personal Data Protection Act, 2023, B-Seva has appointed a Grievance Officer:",
      ],
      table: grievanceTable(),
    },
    {
      id: "grievance-response",
      heading: "Response times",
      paragraphs: [
        "We will acknowledge your complaint within 48 hours and aim to resolve it within one month of receipt, or sooner where the law requires. Please include your registered email address or phone number, Booking ID (if any), and a description of the issue.",
      ],
    },
  ],
};
