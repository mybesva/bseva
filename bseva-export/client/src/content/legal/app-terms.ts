import {
  CIN,
  COMPANY,
  DELETE_ACCOUNT_URL,
  EFFECTIVE_DATE,
  GSTIN,
  LEGAL_VERSION,
  PHONE,
  REGISTERED_OFFICE,
  SUPPORT_EMAIL,
  grievanceTable,
  withToConfirm,
} from "./shared";

export const appTerms = withToConfirm({
  slug: "app-terms",
  title: "Mobile App Terms of Use & End-User Licence Agreement",
  version: LEGAL_VERSION,
  effectiveDate: EFFECTIVE_DATE,
  intro: [
    `Applies to: B-Seva apps on Google Play (Android) and the Apple App Store (iOS). Developer: ${COMPANY}. CIN: ${CIN}. Address: ${REGISTERED_OFFICE}. GSTIN: ${GSTIN}. Support: ${PHONE} | ${SUPPORT_EMAIL}. Web version of these terms: https://www.b-seva.com/app-terms`,
    "These Terms of Use apply to the B-Seva mobile applications downloaded from Google Play or the Apple App Store. By installing, opening, or using the app, you agree to these terms. If you do not agree, please uninstall the app.",
  ],
  sections: [
    {
      id: "about",
      heading: "1. About these terms",
      paragraphs: [
        "These Mobile App Terms of Use and End-User Licence Agreement (the “App Terms”) are an agreement between you and B-SEVA PRIVATE LIMITED (“B-Seva,” “we,” “us,” or “our”). They cover your download, installation, and use of the B-Seva mobile applications on Android and iOS, including the B-Seva customer app and the B-Seva Pujari / Partner app (each, the “App”).",
        "Your use of B-Seva services through the App is also governed by:",
      ],
      bullets: [
        "the B-Seva Customer Terms & Conditions, if you use the App to book Services;",
        "the B-Seva Pujari / Service Provider Terms & Conditions, if you use the App as a Pujari or Service Provider;",
        "the B-Seva Privacy Policy; and",
        "the B-Seva Cancellation and Refund Policy.",
      ],
    },
    {
      id: "about-precedence",
      heading: "Where to find these documents and order of precedence",
      paragraphs: [
        "These documents are available in the App under Profile → Legal and on our website. If these App Terms conflict with the Customer Terms or Provider Terms on any matter about Bookings, Services, payments, or Service Providers, the Customer Terms or Provider Terms prevail. These App Terms prevail on matters about the App software itself, and Sections 18 and 19 prevail over the rest of these App Terms for users of the relevant app store.",
      ],
    },
    {
      id: "stores-not-parties",
      heading: "2. Google and Apple are not parties",
      paragraphs: [
        "These App Terms are between you and B-Seva only. Google LLC and its affiliates (“Google”) and Apple Inc. and its subsidiaries (“Apple”) are not parties to these App Terms. B-Seva, not Google or Apple, is solely responsible for the App, its content, its services, and its support.",
      ],
    },
    {
      id: "eligibility",
      heading: "3. Eligibility",
      paragraphs: [
        "You must be at least 18 years old and able to enter into a binding contract under Indian law to create an account. The App is intended for use in India.",
      ],
    },
    {
      id: "licence",
      heading: "4. Licence to use the App",
      paragraphs: [
        "B-Seva grants you a limited, personal, revocable, non-exclusive, non-transferable licence to download, install, and use the App on devices you own or control, solely to use B-Seva services in accordance with these App Terms and the documents listed in Section 1. If you downloaded the App from the Apple App Store, this licence is also subject to Section 19.",
        "You must not:",
      ],
      bullets: [
        "copy, modify, translate, or create derivative works of the App;",
        "reverse engineer, decompile, or disassemble the App, except to the extent the law expressly permits;",
        "rent, lease, sell, sublicense, or distribute the App;",
        "remove or alter any copyright, trademark, or other notice;",
        "use bots, scrapers, or automated tools to access the App or collect data from it;",
        "interfere with the App’s security, servers, or networks, or introduce malware; or",
        "use the App for any unlawful, fraudulent, or harmful purpose.",
      ],
    },
    {
      id: "licence-ownership",
      heading: "Ownership",
      paragraphs: [
        "B-Seva and its licensors own all rights in the App, including software, design, text, graphics, logos, and trademarks. No rights are granted other than those expressly stated.",
      ],
    },
    {
      id: "account",
      heading: "5. Your account",
      paragraphs: [
        "You register using your email address and a password. We verify your email address with a one-time password (OTP) sent by email, and we also send email OTPs when you reset a forgotten password or confirm an account deletion request. Sign-in with a mobile number and an OTP sent by SMS or WhatsApp may be offered in future; we will update this document first.",
        "You must provide accurate information and keep your account secure. Do not share your password or OTP with anyone, including a Service Provider or a person claiming to be from B-Seva. You are responsible for activity under your account.",
      ],
    },
    {
      id: "payments",
      heading: "6. Bookings and payments",
      paragraphs: [
        "The App lets you discover, book, and pay for in-person and online religious Services, such as poojas, homams, and consultations, performed by independent Pujaris and Service Providers. These Services are provided in the real world or live by a person, and are not digital content sold through Google Play or the App Store. Online Services take place live through an external meeting link that opens in a separate meeting app.",
        "Bookings are paid from your B-Seva wallet. At present, credit is added to your wallet through B-Seva support: you pay B-Seva by UPI or bank transfer, and we credit your wallet once we have confirmed the payment. Online payment through a payment gateway may be added later; we will update this document first. Payments are not processed through Google Play billing or Apple In-App Purchase. Refunds for Bookings are handled by B-Seva under the Cancellation and Refund Policy, not by Google or Apple. The App itself is free to download.",
      ],
    },
    {
      id: "permissions",
      heading: "7. Device permissions",
      paragraphs: [
        "The App may ask for the following permissions. You can manage them at any time in your device settings, but some features may not work without them.",
      ],
      table: [
        ["Permission", "Why we ask for it"],
        ["Location (while using the App)", "To show nearby Pujaris and Services, and to find and confirm the Service Location for an address"],
        [
          "Background location (Pujari / Partner app only)",
          "For a confirmed in-person Booking, to share the Pujari’s travel progress and arrival with the Customer of that Booking, only during the travel window (currently from 15 minutes before the scheduled start until arrival, or at the latest 120 minutes after the scheduled start). The app explains this use and asks for permission before collecting background location.",
        ],
        ["Camera and photos", "To upload a profile photo and, in the Partner app, verification documents"],
        ["Notifications", "To send Booking confirmations, reminders, arrival updates, and support messages"],
      ],
    },
    {
      id: "permissions-notes",
      heading: "Online Services and data use",
      paragraphs: [
        "The App does not use your microphone. For online poojas and consultations, the meeting link opens in a separate meeting app, which asks for its own camera and microphone permissions under its own terms and privacy policy.",
        "We collect and use data only as described in the Privacy Policy, the Data Safety section on Google Play, and the App Privacy details on the App Store.",
      ],
    },
    {
      id: "content",
      heading: "8. User content and reporting",
      paragraphs: [
        "You may post ratings and reviews in the App. You must not post content that is false, defamatory, obscene, hateful, discriminatory, threatening, infringing, or that discloses another person’s private information. We do not tolerate objectionable content or abusive users.",
        "Customers can report a Pujari or a Booking, and Pujaris can report a Customer or a Booking, from within the App. The App does not offer chat or messaging between users. B-Seva reviews reports promptly and may remove content, restrict features, or suspend accounts that breach these App Terms. You grant B-Seva the licence over your content described in the Customer Terms or Provider Terms.",
      ],
    },
    {
      id: "delete-account",
      heading: "9. Deleting your account",
      paragraphs: ["You can request deletion of your account at any time:"],
      bullets: [
        "In the App: Profile → Account → Delete Account; or",
        `On the web: ${DELETE_ACCOUNT_URL}, or by emailing ${SUPPORT_EMAIL} from your registered email address.`,
      ],
    },
    {
      id: "delete-account-process",
      heading: "How account deletion works",
      bullets: [
        "Confirmation and deactivation. You confirm your request with a one-time password (OTP) sent to your registered email address. Your account is deactivated once you confirm the request: you are signed out on all devices, you cannot place or accept new Bookings, Pujari profiles are removed from customer view, and marketing messages stop. Before you confirm, the App shows any upcoming Bookings. Customer Bookings are cancelled under the Cancellation Policy, so cancellation charges may apply, and the refund for each Booking is shown before you confirm. Bookings accepted by a Pujari are reassigned to another Pujari or resolved by B-Seva. A puja that is already in progress is completed first.",
        "Settlement and review (14 days). B-Seva reviews the account and settles all pending amounts, including refunds due to Customers and payouts due to Pujaris for completed Bookings, and reconciles any amounts owed to B-Seva.",
        "Final deletion (on completion of the 14-day period). Your account and personal data are permanently deleted or anonymized, subject to the retention described below, and we confirm completion by email (and by SMS or WhatsApp where enabled). If a refund, settlement, complaint, or dispute is still open at that time, final deletion waits until it is resolved, and we will tell you.",
      ],
    },
    {
      id: "delete-account-cancel",
      heading: "Cancelling deletion and retained records",
      paragraphs: [
        `You may cancel your deletion request before final deletion, either on ${DELETE_ACCOUNT_URL} or by signing in and choosing Cancel Deletion. You confirm the cancellation with an OTP sent to your registered email address. Bookings that were cancelled or reassigned as part of the request are not restored.`,
        "B-Seva keeps only the records it must retain by law (for example, GST invoices, payment and tax records, and records needed for an open complaint, dispute, or safety investigation), for the period required, after which they are deleted, as explained in the Privacy Policy. Uninstalling the App does not delete your account.",
      ],
    },
    {
      id: "updates",
      heading: "10. Updates and availability",
      paragraphs: [
        "We may release updates to improve the App, fix issues, or meet legal requirements. Some updates may be required to keep using the App. The App may sometimes be unavailable for maintenance, security, or reasons beyond our control. We do not guarantee that the App will be uninterrupted or error-free.",
      ],
    },
    {
      id: "third-party",
      heading: "11. Third-party services",
      paragraphs: [
        "The App uses third-party services, including maps and location search, email delivery, push notifications, cloud hosting, and analytics, and online Services take place in a third-party meeting app. Their terms and privacy policies also apply when you use those features. B-Seva is not responsible for third-party services beyond its control. Your mobile network operator’s data charges apply.",
      ],
    },
    {
      id: "disclaimer",
      heading: "12. Disclaimer",
      paragraphs: [
        "The App is provided on an “as is” and “as available” basis. To the extent permitted by law, B-Seva disclaims all implied warranties about the App, including fitness for a particular purpose. B-Seva does not promise any spiritual, astrological, medical, or other outcome from a Service. Nothing in this Section limits your rights under the Consumer Protection Act, 2019.",
      ],
    },
    {
      id: "liability",
      heading: "13. Limitation of liability",
      paragraphs: [
        "To the extent permitted by law, B-Seva is not liable for indirect or consequential loss arising from use of the App. B-Seva’s liability for Bookings and Services is set out in the Customer Terms or Provider Terms. Nothing in these App Terms excludes liability that cannot be excluded by law.",
      ],
    },
    {
      id: "termination",
      heading: "14. Suspension and termination",
      paragraphs: [
        "We may suspend or terminate your access to the App if you breach these App Terms, misuse the App, or create a risk to other users or to B-Seva, as described in the Customer Terms or Provider Terms. You may stop using the App and uninstall it at any time, or delete your account as described in Section 9.",
      ],
    },
    {
      id: "changes",
      heading: "15. Changes to these terms",
      paragraphs: [
        "We may update these App Terms. For a material change, we will notify you in the App or by email (and by SMS or WhatsApp where enabled) at least 15 (fifteen) days before it takes effect, unless a shorter period is required for legal, safety, or security reasons.",
      ],
    },
    {
      id: "law",
      heading: "16. Governing law and disputes",
      paragraphs: [
        "These App Terms are governed by the laws of India. Disputes are resolved as set out in the dispute resolution section of the Customer Terms or Provider Terms, with the seat of arbitration and courts at Hyderabad, Telangana. Nothing prevents you from approaching a consumer commission or the National Consumer Helpline (1915).",
      ],
    },
    {
      id: "grievance",
      heading: "17. Grievance Officer and contact",
      table: grievanceTable({ nameLabel: "Grievance Officer" }),
      paragraphs: ["We acknowledge complaints within 48 hours and aim to resolve them within one month."],
    },
    {
      id: "google",
      heading: "18. Additional terms for Google Play users",
      paragraphs: [
        "If you downloaded the App from Google Play, your use of Google Play is governed by the Google Play Terms of Service, which also apply when you download and update the App. Google is not responsible for providing maintenance, support, warranties, or any other obligation relating to the App.",
      ],
    },
    {
      id: "apple",
      heading: "19. Additional terms for Apple App Store users",
      paragraphs: [
        "The following terms apply if you obtained the App from the Apple App Store. If they conflict with any other part of these App Terms, this Section prevails.",
      ],
      bullets: [
        "Acknowledgement. These App Terms are concluded between you and B-Seva only, and not with Apple. B-Seva, not Apple, is solely responsible for the App and its content. These App Terms do not provide for usage rules that conflict with the Apple Media Services Terms and Conditions as of the effective date.",
        "Scope of licence. The licence granted to you is a non-transferable licence to use the App on Apple-branded products that you own or control, as permitted by the Usage Rules in the Apple Media Services Terms and Conditions, except that the App may be accessed by other accounts associated with you through Family Sharing or volume purchasing.",
        "Maintenance and support. B-Seva is solely responsible for providing maintenance and support for the App, as described in these App Terms and as required by applicable law. Apple has no obligation to provide any maintenance or support services for the App.",
        "Warranty. B-Seva is solely responsible for any product warranties, whether express or implied by law, to the extent not effectively disclaimed. If the App fails to conform to an applicable warranty, you may notify Apple, and Apple will refund the purchase price, if any, paid for the App. To the maximum extent permitted by law, Apple has no other warranty obligation with respect to the App, and any other claims, losses, liabilities, damages, costs, or expenses attributable to a failure to conform to a warranty are B-Seva’s sole responsibility.",
        "Product claims. B-Seva, not Apple, is responsible for addressing any claims by you or a third party relating to the App or your possession or use of it, including: (a) product liability claims; (b) any claim that the App fails to conform to any applicable legal or regulatory requirement; and (c) claims arising under consumer protection, privacy, or similar legislation. These App Terms do not limit B-Seva’s liability to you beyond what is permitted by applicable law.",
        "Intellectual property rights. If a third party claims that the App or your possession and use of it infringes that third party’s intellectual property rights, B-Seva, not Apple, is solely responsible for the investigation, defence, settlement, and discharge of that claim.",
        "Legal compliance. You represent and warrant that (a) you are not located in a country that is subject to a U.S. Government embargo, or that has been designated by the U.S. Government as a “terrorist supporting” country; and (b) you are not listed on any U.S. Government list of prohibited or restricted parties.",
        `Developer name and address. Questions, complaints, or claims about the App should be directed to: ${COMPANY}, ${REGISTERED_OFFICE}; phone ${PHONE}; email ${SUPPORT_EMAIL}.`,
        "Third-party terms. You must comply with applicable third-party terms when using the App, for example your wireless data service agreement.",
        "Third-party beneficiary. Apple and Apple’s subsidiaries are third-party beneficiaries of these App Terms. Once you accept these App Terms, Apple will have the right (and will be deemed to have accepted the right) to enforce them against you as a third-party beneficiary.",
      ],
    },
  ],
});
