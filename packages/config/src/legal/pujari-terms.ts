import type { LegalDoc } from "./types";
import {
  COMPANY,
  DELETE_ACCOUNT_URL,
  EFFECTIVE_DATE,
  GSTIN,
  LEGAL_VERSION,
  PARTNER_EMAIL,
  PHONE,
  REGISTERED_OFFICE,
  grievanceTable,
} from "./shared";

export const pujariTerms: LegalDoc = {
  slug: "pujari-terms",
  title: "Pujari / Service Provider Terms & Conditions",
  version: LEGAL_VERSION,
  effectiveDate: EFFECTIVE_DATE,
  intro: [
    `Operated by: ${COMPANY}. Registered office: ${REGISTERED_OFFICE}. GSTIN: ${GSTIN}. Partner support: ${PHONE} | ${PARTNER_EMAIL}`,
    "Please read these Provider Terms carefully before you register as a Pujari or Service Provider on B-Seva. By submitting your onboarding form or accepting a Booking, you agree to these terms.",
  ],
  sections: [
    {
      id: "agreement",
      heading: "1. Agreement and scope",
      paragraphs: [
        "These Pujari / Service Provider Terms & Conditions (the “Provider Terms”) govern the relationship between B-SEVA PRIVATE LIMITED, operating as B-Seva (“B-Seva,” “we,” “us,” or “our”), and the individual or entity approved to provide services through the B-Seva Platform (“Service Provider,” “Pujari,” “you,” or “your”). They apply to every application, profile, lead, Booking, Service, payment, communication, trip, and incident connected with the Platform or a B-Seva Booking.",
        "The following documents together form the “Provider Agreement”:",
      ],
      bullets: [
        "these Provider Terms;",
        "your onboarding form and verification records;",
        "each Booking and its Booking-specific terms;",
        "the safety, activity, and transportation rules in Section 9;",
        "any B-Seva insurance or welfare option you choose, together with the insurer’s actual policy or certificate;",
        "the B-Seva Privacy Policy;",
        "the B-Seva payment, cancellation, conduct, and incident-reporting policies published in the Partner app; and",
        "any written addendum signed by both parties.",
      ],
    },
    {
      id: "agreement-order",
      heading: "Order of precedence",
      paragraphs: [
        "If these documents conflict, the following order applies: mandatory law; the insurer’s policy (for insurance matters only); a signed written addendum; the Booking-specific terms (for that Booking only); these Provider Terms; and then other policies. A policy cannot reduce your rights under law or impose a financial charge that was not disclosed to you before you accepted it.",
      ],
    },
    {
      id: "definitions",
      heading: "2. Definitions",
      paragraphs: [
        "“Booking” means a confirmed request for a Service placed through the Platform, including a Booking created by an authorized B-Seva representative.",
        "“B-Seva Work” means any activity undertaken for a Booking or B-Seva assignment, including travel for the assignment; entering, leaving, or moving within a Service Location; buying, collecting, carrying, or delivering materials; communicating with a Customer for the assignment; preparing for and performing the Service; using fire, lamps, havan or homam materials, electrical equipment, tools, gas, or other potentially hazardous items; and approved onboarding, training, or support activity.",
        "“Circumvention” means knowingly using a B-Seva introduction, Customer relationship, Platform Information, or Booking opportunity to solicit, accept, arrange, renew, refer, or facilitate a substantially similar Service or payment outside B-Seva, where the opportunity arose through B-Seva.",
        "“Customer” means a person or organization that registers, enquires, books, pays for, receives, or is introduced to a Service through B-Seva.",
        "“Platform” means B-Seva’s website, Customer and Partner mobile applications, booking system, approved telephone and messaging channels, and related services.",
        "“Platform Information” means non-public information obtained through B-Seva, including Customer contact details, addresses, Booking details, religious or service preferences, pricing, commissions, transaction information, leads, and operational information.",
        "“Protected Customer” means a Customer whose identity, contact details, address, requirements, Booking, or service opportunity became known to you through B-Seva. It does not include a person with whom you had a genuine, independent relationship before B-Seva introduced them to you, provided you declare that relationship as described in Section 14.",
        "“Service” means a pooja, homam, havan, archana, priest or purohit service, religious ceremony, consultation, pooja materials (samagri) service, transport or related service, or other service listed on or arranged through B-Seva.",
        "“Service Location” means the Customer’s home, venue, temple, office, event location, or other place identified for a Booking.",
      ],
    },
    {
      id: "acceptance",
      heading: "3. Electronic acceptance and records",
      paragraphs: [
        "You accept these Provider Terms when you tick an acceptance box, click “I Agree,” complete an OTP-verified sign-up or e-signature, submit your onboarding form, or accept a Booking. Each acceptance is an electronic record of your agreement to the version shown at that time, valid under the Information Technology Act, 2000.",
        "You create your account with your email address and a password. We verify your email address with a one-time password (OTP) sent by email, and we also use email OTPs to reset a forgotten password and to confirm an account deletion request. Keep your password and OTPs confidential. Sign-in with a mobile number and an OTP sent by SMS or WhatsApp may be offered in future; we will update this document first.",
        "B-Seva records your account and Provider ID, device information where lawfully collected, date and time, the version accepted, the acceptance text, and the Booking ID where relevant. You must not accept these terms on behalf of another person unless you are authorized to do so.",
        "Some important matters need a separate acceptance, including insurance choices, any deduction from your payout, non-circumvention, vehicle use, and Booking-specific safety or cancellation terms.",
      ],
    },
    {
      id: "eligibility",
      heading: "4. Eligibility, onboarding, and verification",
      paragraphs: ["You may provide Services only after B-Seva approves your profile for the relevant category and location. You must:"],
      bullets: [
        "be at least 18 years old and legally able to enter into a contract;",
        "provide accurate and complete identity, address, contact, bank, tax (PAN and GSTIN where applicable), licence, vehicle, qualification, language, service-area, availability, and emergency-contact details;",
        "provide documents reasonably needed for identity verification, payment, fraud prevention, safety, legal compliance, or insurance enrollment;",
        "disclose any criminal conviction, pending criminal case, or restriction that B-Seva lawfully asks about for your Service category;",
        "keep your information updated and tell us promptly about any change that affects your eligibility or safe performance; and",
        "complete any orientation, safety acknowledgement, or assessment B-Seva requires for your category.",
      ],
    },
    {
      id: "eligibility-verification",
      heading: "Verification and review",
      paragraphs: [
        "B-Seva may verify your information directly or through a lawful third-party verification provider. Verification is not a guarantee by B-Seva of your identity, qualifications, or conduct, and you remain responsible for what you tell us and for your conduct.",
        "B-Seva may decline an application, limit your categories, ask for more information, or pause your access while information is reviewed. If your application is declined or your access is paused, you may ask for a review through the Grievance Officer in Section 26.",
      ],
    },
    {
      id: "profile",
      heading: "5. Profile, listings, and representations",
      paragraphs: [
        "You authorize B-Seva to display your profile, service description, photograph, availability, service area, languages, qualifications, ratings, and reviews on the Platform. Your listing must be accurate, current, lawful, and not misleading.",
        "You must not:",
      ],
      bullets: [
        "claim to be an employee, partner, owner, director, or authorized spokesperson of B-Seva;",
        "use B-Seva’s name, logo, photographs, Customer reviews, Booking history, or reputation to promote a private business;",
        "upload content that infringes another person’s rights, is defamatory or discriminatory, or misrepresents your lineage, qualifications, availability, pricing, or the outcome of a ritual; or",
        "let anyone else operate your account or perform a Booking in your name without B-Seva’s prior approval.",
      ],
    },
    {
      id: "profile-licence",
      heading: "Profile licence",
      paragraphs: [
        "You grant B-Seva a non-exclusive, royalty-free licence, for as long as you are listed on the Platform, to host, display, format, translate, and use your profile content to operate and promote the Platform, in line with the Privacy Policy.",
      ],
    },
    {
      id: "bookings",
      heading: "6. Bookings, availability, and performance",
      paragraphs: [
        "A Booking is accepted only when the Platform or an authorized B-Seva representative records your acceptance. Keep your availability accurate and accept a Booking only if you can perform it at the stated time, place, scope, and standard.",
        "After accepting a Booking, you must:",
      ],
      bullets: [
        "review the Booking details and tell B-Seva promptly about any error, conflict, access issue, religious requirement, safety risk, or inability to perform;",
        "arrive or connect on time, prepared, with the materials or equipment assigned to you;",
        "perform only the agreed Service, unless a change is approved by the Customer and B-Seva through the Platform;",
        "perform with reasonable skill, care, and diligence;",
        "keep the Customer informed through the Platform about arrival, delay, or completion;",
        "complete the Service record or proof of completion in the Partner app; and",
        "return or protect any Customer or B-Seva property and close the Booking honestly.",
      ],
    },
    {
      id: "bookings-substitutes",
      heading: "Substitutes and allocation",
      paragraphs: [
        "You must not accept a Booking and then pass it to another platform, person, temple, or agency. Using a substitute or helper requires B-Seva’s prior approval and, where required, the Customer’s consent. You are responsible for an approved helper or substitute you bring.",
        "B-Seva may allocate, reassign, reschedule, or cancel Bookings. B-Seva does not guarantee a minimum number of Bookings or earnings.",
      ],
    },
    {
      id: "standards",
      heading: "7. Service standards, religious requirements, and professional conduct",
      paragraphs: [
        "You must perform each Service according to the Booking, lawful Customer instructions, the applicable religious requirements, and the tradition or expertise you have represented. B-Seva does not decide the religious validity or spiritual outcome of a ritual. You must describe your role honestly and must never guarantee supernatural, medical, financial, legal, or other outcomes.",
        "You must:",
      ],
      bullets: [
        "treat Customers, family members, children, elderly persons, persons with disabilities, visitors, and B-Seva staff with dignity and respect;",
        "comply with applicable laws, including those on safety, fire, traffic, tax, privacy, and anti-discrimination;",
        "never engage in harassment, intimidation, abuse, threats, discrimination, sexual misconduct, unwanted contact, or exploitation;",
        "not consume alcohol or intoxicants, or work while impaired or unsafely fatigued, during B-Seva Work;",
        "ask only for payments, dakshina, gifts, or expenses that B-Seva and the Booking authorize;",
        "use only lawful and reasonably safe materials, equipment, and methods;",
        "respect the Customer’s beliefs, household rules, privacy, property, and dietary or access requirements; and",
        "stop or modify an activity if conditions become unsafe, and inform B-Seva and the Customer.",
      ],
    },
    {
      id: "communication",
      heading: "8. Customer communication and contact information",
      paragraphs: [
        "Use B-Seva’s communication and payment channels for B-Seva Bookings. You may use Customer contact details only to arrange, perform, and support the relevant Booking.",
        "You must not use a Customer’s phone number, WhatsApp, email, social-media account, UPI ID, bank details, address, photographs, family details, or other personal information for private marketing, solicitation, broadcast lists, contact lists, or direct bookings.",
        "If a Customer asks you to book directly, pay you directly, or continue outside the Platform, you must politely decline, direct the Customer to B-Seva, and report the request within 48 hours by reporting the Customer or the Booking in the Partner app, or through partner support. This does not prevent emergency communication or contact needed to complete a current Booking.",
      ],
    },
    {
      id: "activities",
      heading: "9. Activities, transportation, premises, and property",
      paragraphs: [
        "When travelling to or from a Booking, carrying people, materials, or tools, or using a vehicle for B-Seva Work, you must hold a valid driving licence, registration certificate, pollution certificate, motor insurance, and any other legally required documents. Never drive while impaired or excessively tired. Report any accident, injury, traffic offence, police complaint, vehicle damage, or insurance event promptly.",
        "At a Service Location, take reasonable care of the premises, furniture, electrical systems, religious articles, valuables, devices, and other property. Do not enter rooms, cupboards, safes, devices, or property unrelated to the Service, and never remove, borrow, keep, sell, or pledge Customer property without permission.",
        "When using fire, lamps, havan, homam, smoke, electrical equipment, gas, or other hazardous items: assess obvious risks; keep flammable materials away; take care around children, elderly persons, and pets; never leave an active flame or hazardous equipment unattended; and report any burn, injury, fire, or damage immediately.",
      ],
    },
    {
      id: "location-sharing",
      heading: "9A. Location sharing while travelling to a Booking",
      paragraphs: [
        "For a confirmed in-person Booking, the Partner app shares your device’s location with B-Seva and with the Customer of that Booking during the travel window, so that the Customer can see that you are on the way and when you arrive. This includes while the Partner app is in the background or your screen is off. The app asks for your permission, and explains this use, before it collects background location.",
        "The travel window currently begins 15 minutes before the scheduled start time and ends when you arrive at the Service Location or, at the latest, 120 minutes after the scheduled start time. While the window is open, the app records your location about once every 60 seconds, or when you have moved about 35 metres. Location is not shared for this purpose outside the travel window, and it is not shared for virtual Bookings. If B-Seva changes these settings, the Partner app will show the current travel window.",
        "The Customer sees your position on a map provided by a mapping service, which receives the coordinates needed to display it. B-Seva uses the recorded locations to show your arrival, to support the Customer, and to investigate complaints, disputes, no-shows, and safety incidents.",
        `Location points recorded during the travel window are kept for 30 days and are then deleted, unless they are needed for an open complaint, dispute, or safety investigation, as explained in the Privacy Policy.`,
        "You can withdraw location permission at any time in your device settings. If you do, the Customer will not see your travel progress, and you must still keep the Customer and B-Seva informed about your arrival through the Platform as required by Section 6.",
      ],
    },
    {
      id: "materials",
      heading: "10. Materials, additional work, and expenses",
      paragraphs: [
        "You may buy, collect, carry, or deliver materials only when the Booking or B-Seva authorizes it. Keep receipts and follow the approved budget, supplier, and reimbursement process. You must not mark up materials, substitute inferior or unsafe items, charge unauthorized amounts, or keep Customer money.",
        "Any additional Service, priest, helper, travel, waiting time, material, or expense must be approved through B-Seva before it is charged or performed, except for an immediate safety measure. You must never pressure a Customer to buy an unapproved add-on.",
      ],
    },
    {
      id: "payments",
      heading: "11. Pricing, commissions, settlements, taxes, and deductions",
      paragraphs: [
        "Before you accept a Booking, the Partner app will show you the Customer price, your fee, B-Seva’s platform or coordination fee, applicable taxes, approved expenses, cancellation treatment, and the amount you will receive. You must not quote, collect, or change a price outside the Platform.",
        "B-Seva collects Customer payments and settles the amount due to you to your registered bank account or approved payout method, on the payout cycle shown in the Partner app. Settlement depends on completion records and may be adjusted for refunds, cancellations, chargebacks, fraud review, taxes, and lawful withholding (including TDS where applicable), and to correct an overpayment. You will receive a settlement statement for every payout and may question any item within 30 days through partner support.",
        "B-Seva will not make a deduction from your payout unless it is shown to you in advance and authorized by you, permitted by these Provider Terms, or required by law.",
        "You are responsible for your own tax registrations, invoices, filings, and expenses as applicable to you. Nothing in these Provider Terms decides your tax status.",
        "You must not ask for or accept cash, UPI, bank transfer, card, gift, or other direct payment for a B-Seva Booking unless B-Seva expressly allows that method in writing or in the Booking. Customary dakshina offered voluntarily by a Customer at the ceremony may be accepted only where the Booking permits it.",
      ],
    },
    {
      id: "cancellation",
      heading: "12. Cancellation, delay, non-performance, and no-shows",
      paragraphs: [
        "Accept a Booking only if you can perform it. If you cannot perform, will be late, or notice a material risk, inform B-Seva immediately through the Partner app or partner support. Do not privately cancel, replace, under-report, or renegotiate a Booking with the Customer.",
        "Under the provider cancellation policy shown in the Partner app, B-Seva may reassign or cancel the Booking, adjust or withhold the fee for that Booking, refund the Customer, or recover reasonable, documented costs caused by your breach. Genuine emergencies, illness, and force majeure are treated fairly when supported by reasonable evidence.",
        "Serious or repeated no-shows, late arrival, refusal to perform, unauthorized substitution, unsafe performance, or material deviation from the Booking may be treated as a material breach. You must cooperate with any fair investigation and provide truthful records.",
      ],
    },
    {
      id: "confidentiality",
      heading: "13. Confidentiality, Customer data, and privacy",
      paragraphs: [
        "Keep Platform Information confidential and use it only for authorized B-Seva Work. Do not copy, export, photograph, screenshot, sell, publish, or share it except as needed for the relevant Booking or as required by law.",
        "You must follow the B-Seva Privacy Policy and data-protection instructions, consistent with the Digital Personal Data Protection Act, 2023. Protect any device, paper, or account containing Customer or B-Seva information. Tell B-Seva immediately, and within 24 hours at the latest, if you become aware of any loss, theft, unauthorized access, or disclosure of such information.",
        "After a Booking, or when B-Seva asks, delete or return Platform Information from your personal devices and records unless the law requires you to keep it. Any information you keep remains confidential and must not be used for marketing or direct dealings.",
      ],
    },
    {
      id: "non-circumvention",
      heading: "14. Non-circumvention and Customer non-solicitation",
      paragraphs: [
        "B-Seva invests in advertising, technology, verification, booking coordination, payment processing, and support to bring Customers to you. You must not use a B-Seva introduction or Protected Customer relationship to deprive B-Seva of a Booking or fee that would otherwise be payable through the Platform.",
        "While you are registered with B-Seva and for 6 (six) months after your last B-Seva Booking with a particular Protected Customer, you must not:",
      ],
      bullets: [
        "solicit, accept, perform, renew, or arrange a substantially similar Service for that Protected Customer outside B-Seva where the opportunity arose through B-Seva;",
        "ask or encourage a Protected Customer to cancel or under-report a Booking so that you can deal privately;",
        "share or use personal contact details, payment details, QR codes, visiting cards, social-media contacts, or intermediaries to bypass B-Seva;",
        "refer a Protected Customer to a family member, colleague, temple, agency, or another provider to avoid B-Seva; or",
        "use B-Seva Customer data, ratings, reviews, Booking history, brand, or reputation to build a competing relationship.",
      ],
    },
    {
      id: "non-circumvention-limits",
      heading: "Limits and remedies",
      paragraphs: [
        "This clause does not stop you from practising your profession, serving your own independent customers, serving genuine pre-existing family, community, or temple relationships, or working with other platforms, as long as you do not use B-Seva’s confidential information or deliberately bypass a relationship B-Seva created. Before your first Booking, you may declare your existing customers through the Partner app so they are excluded from this clause.",
        "These Provider Terms do not contain any restriction on working after you leave B-Seva, other than the Customer-specific protection above.",
        "If B-Seva reasonably establishes Circumvention after giving you notice and an opportunity to respond, it may pause new Bookings, deactivate your account, recover the platform fee or other amounts that would have been payable through B-Seva for the circumvented Service, and pursue other lawful remedies.",
      ],
    },
    {
      id: "ip",
      heading: "15. Intellectual property and Platform use",
      paragraphs: [
        "B-Seva or its licensors own the Platform, software, design, text, graphics, logos, trademarks, workflows, and data compilations. B-Seva grants you a limited, revocable, non-exclusive, non-transferable licence to use the Partner app and Platform only to perform authorized B-Seva Work.",
        "You must not reverse engineer, scrape, copy, resell, interfere with, overload, introduce malware into, or access non-public areas of the Platform, or use B-Seva’s brand outside the permission given to you.",
        "You keep ownership of original material you lawfully own, subject to the licence in Section 5. Do not upload Customer content or third-party material without the necessary consent and rights.",
      ],
    },
    {
      id: "records",
      heading: "16. Records, incidents, and cooperation",
      paragraphs: [
        "B-Seva keeps Booking, communication, payment, verification, complaint, safety, and acceptance records for operations, compliance, fraud prevention, and dispute resolution, as described in the Privacy Policy.",
        "Report immediately, by reporting the Customer or the Booking in the Partner app or through partner support, any death, serious injury, hospitalization, fire, burn, road accident, theft, missing property, assault, harassment, sexual misconduct, police complaint, material property damage, arrest, or data incident connected with B-Seva Work. Call emergency services (112) or the police first where there is immediate danger.",
        "Preserve relevant evidence and cooperate reasonably with B-Seva, insurers, police, and other authorities. Do not admit liability on behalf of B-Seva or settle a matter that imposes obligations on B-Seva without our written approval. Where B-Seva has a documented reason to investigate a material breach, you must provide relevant information you hold, subject to law.",
      ],
    },
    {
      id: "insurance",
      heading: "17. Insurance and welfare options",
      paragraphs: [
        "B-Seva may offer optional life, health, personal accident, disability, or other insurance or welfare options through a licensed insurer or insurance intermediary. Any such option is governed by the insurer’s actual policy, certificate, and terms. Registering on B-Seva does not by itself give you insurance cover.",
        "For each option offered, B-Seva will tell you whether it is voluntary, free, subsidized, or contributory, and you will be asked to opt in or decline separately for each one. Cover starts only when the insurer confirms it. The insurer alone decides underwriting, exclusions, waiting periods, renewals, and claims.",
        "B-Seva may help you with enrollment and claims paperwork but does not guarantee that a claim will be accepted or paid. Any premium contribution will be deducted from your payout only if you have separately authorized the exact amount in advance. If you decline an option, you are responsible for arranging your own cover.",
        "Insurance does not excuse unsafe conduct, negligence, fraud, theft, or misconduct. You must maintain any insurance required by law, such as motor insurance for a vehicle you use.",
      ],
    },
    {
      id: "warranties",
      heading: "18. Representations and warranties",
      paragraphs: ["You confirm that:"],
      bullets: [
        "the information and documents you provide are accurate, current, and not misleading;",
        "you are legally permitted to enter into the Provider Agreement and perform the Services you offer;",
        "you hold any licences, permissions, qualifications, and insurance required for your activities;",
        "you will comply with applicable law, religious requirements, safety rules, and B-Seva policies;",
        "you will protect Customer and B-Seva information and use it only for authorized purposes;",
        "you will not use an unapproved substitute or engage in fraud, harassment, discrimination, theft, or other unlawful conduct; and",
        "you will promptly correct or report anything that makes any of these statements untrue.",
      ],
    },
    {
      id: "indemnity",
      heading: "19. Indemnity and responsibility for Provider conduct",
      paragraphs: [
        "To the extent permitted by law, you will indemnify B-Seva and its directors, officers, employees, and contractors against third-party claims, losses, damages, fines, and reasonable legal costs arising directly from:",
      ],
      bullets: [
        "your breach of the Provider Agreement;",
        "your negligence, fraud, wilful misconduct, or unlawful act or omission;",
        "personal injury, illness, or death caused by your acts or omissions;",
        "loss of or damage to Customer, third-party, or B-Seva property caused by you;",
        "theft, dishonesty, harassment, assault, sexual misconduct, discrimination, or other unlawful conduct by you;",
        "your unsafe handling of fire, havan, homam, lamps, electrical equipment, tools, gas, or other hazardous materials;",
        "transport incidents, unsafe driving, traffic violations, or missing vehicle documents attributable to you;",
        "your misuse or disclosure of Customer or B-Seva information, or unauthorized photography or publication;",
        "an unapproved substitute, helper, or other person you bring to B-Seva Work; or",
        "Circumvention, unauthorized direct payment, or misuse of the Platform.",
      ],
    },
    {
      id: "indemnity-limits",
      heading: "Claims and exclusions",
      paragraphs: [
        "B-Seva will notify you of a claim promptly where practicable. You must preserve evidence and cooperate.",
        "This indemnity covers only losses caused by you. It does not cover B-Seva’s own fraud, wilful misconduct, gross negligence, or any liability that cannot lawfully be transferred to you.",
      ],
    },
    {
      id: "liability",
      heading: "20. B-Seva’s role and limitation of liability",
      paragraphs: [
        "B-Seva operates a technology and service-coordination platform. It provides discovery, verification, communication, booking, payment collection, support, and payout services. B-Seva does not itself perform the religious or other Service and does not control your ritual practice, technique, or professional judgment.",
        "To the extent permitted by law, B-Seva is not responsible for your independent acts or omissions, the religious or spiritual outcome of a Service, your tax obligations, or decisions made by an insurer. B-Seva is not liable to you for indirect or consequential loss, including loss of expected future Bookings.",
        "Subject to the paragraph below, B-Seva’s total liability to you for any claim relating to a Booking will not exceed the amount payable to you for that Booking.",
        "Nothing in these Provider Terms excludes or limits liability for death or personal injury caused by B-Seva’s negligence, for fraud, for amounts properly due to you, or for any liability that cannot be excluded or limited by law, and nothing in them takes away any right you have under applicable labour or social-security law.",
      ],
    },
    {
      id: "termination",
      heading: "21. Suspension, deactivation, and termination",
      paragraphs: [
        "B-Seva may temporarily restrict access, pause new Bookings, remove a listing, hold a disputed payout, or ask for more information where reasonably necessary for safety, fraud prevention, data protection, legal compliance, an investigation, or the protection of Customers or the Platform.",
        "B-Seva may deactivate your account for material breach, repeated cancellations or no-shows, fraud, theft, harassment, unsafe conduct, unauthorized substitution, data misuse, Circumvention, false information, or loss of eligibility. We will normally give you notice and an opportunity to respond before deactivation, but we may act immediately for urgent safety, fraud, legal, or data-protection reasons. You may appeal any suspension or deactivation through the Grievance Officer in Section 26.",
        `You may stop accepting Bookings and request deletion of your account at any time through the Partner app (Profile → Account → Delete Account), on our website at ${DELETE_ACCOUNT_URL}, or through partner support. Account deletion works as follows:`,
      ],
      bullets: [
        "Confirmation and deactivation. You confirm your request with a one-time password (OTP) sent to your registered email address. Your account is deactivated once you confirm the request: you are signed out on all devices, you will not receive or be able to accept new Bookings, and your profile is removed from customer view. Before you confirm, the Partner app shows any upcoming Bookings you have accepted. B-Seva reassigns these Bookings to another Service Provider or, where no replacement is available, resolves them with the Customer. A puja that is already in progress is completed first.",
        "Settlement and review (14 days). During this period B-Seva reviews the account and settles all pending amounts. Any payout due to you for completed Bookings is paid to your registered bank account, and any refunds, chargebacks, or amounts owed to B-Seva are reconciled.",
        "Final deletion (on completion of the 14-day period). Your account and personal data are permanently deleted or anonymized, subject to the retention described below, and we confirm completion by email (and by SMS or WhatsApp where enabled). If a refund, settlement, complaint, or dispute is still open at that time, final deletion waits until it is resolved, and we will tell you.",
      ],
    },
    {
      id: "termination-cancel",
      heading: "Cancelling deletion and retained records",
      paragraphs: [
        `You may cancel your deletion request before final deletion, either on ${DELETE_ACCOUNT_URL} or by signing in and choosing Cancel Deletion. You confirm the cancellation with an OTP sent to your registered email address. Bookings that were reassigned as part of your deletion request are not returned to you.`,
        "B-Seva keeps only the records it must retain by law (for example, GST invoices, payment and tax records, and records needed for an open complaint, dispute, or safety investigation), for the period required, after which they are deleted, as explained in the Privacy Policy. Deletion does not remove obligations that arose before your request, including your obligations under Sections 13, 14, 19, and 22.",
      ],
    },
    {
      id: "post-termination",
      heading: "22. Post-termination obligations",
      paragraphs: [
        "When your account is deactivated, you must stop presenting yourself as an active B-Seva provider, stop using B-Seva systems and marks, complete or hand over accepted Bookings as agreed with B-Seva, return or delete B-Seva and Customer information, settle any amounts owed, report unresolved incidents, and cooperate with any claim or investigation.",
        "The provisions on payment reconciliation, confidentiality, data protection, intellectual property, non-circumvention (for the period stated in Section 14), indemnity, records, and dispute resolution continue after deactivation. None of them prevents you from lawfully practising your profession.",
      ],
    },
    {
      id: "updates",
      heading: "23. Updates and material changes",
      paragraphs: [
        "B-Seva may update these Provider Terms and policies to reflect changes in law, technology, security, Services, or business operations. Each version shows its effective date. For a material change, we will notify you through the Partner app or by email (and by SMS or WhatsApp where enabled) at least 15 (fifteen) days before it takes effect, unless a shorter period is required for legal, safety, fraud, or security reasons.",
        "A change will not apply to a Booking already completed. We will ask you to accept the updated terms before you accept new Bookings. If you do not agree, you may stop accepting Bookings and request deactivation.",
      ],
    },
    {
      id: "disputes",
      heading: "24. Complaints and dispute resolution",
      paragraphs: [
        "Raise any operational issue through partner support or the Grievance Officer in Section 26. Both parties will first try to resolve a dispute in good faith.",
        "The Provider Agreement is governed by the laws of India. If a dispute is not resolved within 30 days, either party may refer it to arbitration under the Arbitration and Conciliation Act, 1996, before a sole arbitrator appointed by mutual agreement or, failing agreement, in accordance with that Act. The seat and venue of arbitration will be Hyderabad, Telangana, and the proceedings will be in English.",
        "Either party may seek urgent interim relief from a competent court. Nothing in this Section prevents you from approaching any authority or forum available to you by law. Subject to the above, the courts at Hyderabad, Telangana have jurisdiction.",
      ],
    },
    {
      id: "general",
      heading: "25. General terms",
      paragraphs: [
        "If any provision is found invalid or unenforceable, it will be applied to the maximum extent permitted and the remaining provisions will continue. A delay in enforcing a right is not a waiver. You may not transfer the Provider Agreement without B-Seva’s written consent. B-Seva may transfer it to a successor or group company as part of a reorganization or business transfer, with notice to you.",
        "These Provider Terms, your onboarding information, Booking-specific terms, and the incorporated policies form the complete agreement on their subject matter. No marketing statement or informal message changes it except through an authorized B-Seva update.",
        "These Provider Terms may be provided in English, Telugu, Hindi, or other languages, and B-Seva staff can help you understand them before you accept. If there is any inconsistency, the English version prevails to the extent permitted by law.",
      ],
    },
    {
      id: "grievance",
      heading: "26. Grievance Redressal and contact",
      paragraphs: ["B-Seva has appointed a Grievance Officer for Customers and Service Providers:"],
      table: grievanceTable(),
    },
    {
      id: "grievance-response",
      heading: "Response times",
      paragraphs: [
        "We will acknowledge your complaint within 48 hours and aim to resolve it within one month of receipt. Please include your Provider ID, Booking ID (if any), and a description of the issue.",
      ],
    },
  ],
};
