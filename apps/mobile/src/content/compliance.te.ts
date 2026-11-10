/**
 * Telugu copy for the compliance screens. Same keys as the English copy in compliance.ts; any key missing
 * here falls back to English. Needs review by a native speaker before the store release.
 */
const EXPLANATION_MIN = 10;
const EXPLANATION_MAX = 500;
const REPORT_DETAILS_MIN = 10;
const REPORT_DETAILS_MAX = 1000;
const PASSWORD_MIN = 8;

export const DELETION_REASON_LABELS_TE: Record<string, string> = {
  no_longer_using: "నేను ఇకపై B-Seva ఉపయోగించడం లేదు",
  not_satisfied: "సేవతో సంతృప్తిగా లేను",
  privacy: "గోప్యత సమస్యలు",
  payment_settlement: "చెల్లింపు లేదా సెటిల్‌మెంట్ సమస్య",
  app_issues: "యాప్‌లో సమస్యలు",
  duplicate_account: "నాకు మరో ఖాతా ఉంది",
  other: "ఇతర కారణం",
};

export const REPORT_REASON_LABELS_TE: Record<string, string> = {
  misconduct: "దురుసు ప్రవర్తన",
  no_show: "రాలేదు",
  unsafe: "భద్రతా సమస్య",
  fraud: "మోసం",
  payment: "చెల్లింపు సమస్య",
  inappropriate_content: "అనుచిత కంటెంట్",
  other: "ఇతర కారణం",
};

export const REPORT_TARGET_LABELS_TE: Record<string, string> = {
  booking: "బుకింగ్",
  pujari: "పూజారి",
  customer: "కస్టమర్",
};

export const REPORT_STATUS_LABELS_TE: Record<string, string> = {
  open: "తెరిచి ఉంది",
  in_review: "పరిశీలనలో ఉంది",
  escalated: "ఉన్నత స్థాయికి పంపబడింది",
  resolved: "పరిష్కరించబడింది",
  dismissed: "తిరస్కరించబడింది",
};

export const textTe = {
  deactivationMessage:
    "మీ ఖాతా నిష్క్రియం చేయబడింది. చట్టపరంగా భద్రపరచాల్సిన రికార్డులు లేదా పరిష్కారం కాని బాధ్యతలకు లోబడి, మీ ఖాతా తొలగింపు అభ్యర్థన 14 రోజుల్లో పూర్తవుతుంది. ధృవీకరణ ఇమెయిల్ ద్వారా వస్తుంది.",
  forgotPasswordLink: "పాస్‌వర్డ్ మర్చిపోయారా?",
  forgotTitle: "పాస్‌వర్డ్ రీసెట్ చేయండి",
  forgotIntro: "మీ B-Seva ఖాతా ఇమెయిల్ చిరునామా నమోదు చేయండి. ఖాతా ఉంటే, మేము 6 అంకెల కోడ్ ఇమెయిల్ చేస్తాం.",
  forgotGeneric: "ఈ ఇమెయిల్‌కు ఖాతా ఉంటే, మేము కోడ్ పంపాము.",
  email: "ఇమెయిల్",
  enterEmail: "సరైన ఇమెయిల్ చిరునామా నమోదు చేయండి.",
  sendCode: "కోడ్ పంపండి",
  sending: "పంపుతోంది…",
  code: "6 అంకెల కోడ్",
  enterCode: "ఇమెయిల్‌లో వచ్చిన 6 అంకెల కోడ్ నమోదు చేయండి.",
  resendIn: (s: number) => `${s} సెకన్లలో కోడ్ మళ్లీ పంపవచ్చు`,
  resendCode: "కోడ్ మళ్లీ పంపండి",
  newPassword: "కొత్త పాస్‌వర్డ్",
  confirmPassword: "కొత్త పాస్‌వర్డ్ నిర్ధారించండి",
  passwordTooShort: `కనీసం ${PASSWORD_MIN} అక్షరాలు ఉపయోగించండి.`,
  passwordsDontMatch: "పాస్‌వర్డ్‌లు సరిపోలడం లేదు.",
  resetPassword: "పాస్‌వర్డ్ రీసెట్ చేయండి",
  resetting: "రీసెట్ చేస్తోంది…",
  invalidCode: "కోడ్ తప్పు లేదా గడువు ముగిసింది. కొత్త కోడ్ అభ్యర్థించి మళ్లీ ప్రయత్నించండి.",
  resetDone: "మీ పాస్‌వర్డ్ రీసెట్ అయింది. కొత్త పాస్‌వర్డ్‌తో సైన్ ఇన్ చేయండి. ఇతర అన్ని పరికరాల నుంచి మీరు సైన్ అవుట్ అయ్యారు.",
  backToSignIn: "సైన్ ఇన్‌కు తిరిగి వెళ్లండి",
  changeEmail: "వేరే ఇమెయిల్ ఉపయోగించండి",
  somethingWrong: "ఏదో తప్పు జరిగింది. దయచేసి మళ్లీ ప్రయత్నించండి.",

  deletionPendingTitle: "ఖాతా తొలగింపుకు షెడ్యూల్ అయింది",
  cancelDeletion: "తొలగింపును రద్దు చేయండి",
  cancelTitle: "ఖాతా తొలగింపును రద్దు చేయండి",
  cancelIntro: "ఖాతా ఇమెయిల్ చిరునామా నమోదు చేయండి. తొలగింపు అభ్యర్థన ఉంటే, మేము 6 అంకెల కోడ్ ఇమెయిల్ చేస్తాం.",
  cancelGeneric: "ఈ ఇమెయిల్‌కు తొలగింపు అభ్యర్థన ఉంటే, మేము కోడ్ పంపాము.",
  cancelNote: "తొలగింపు అభ్యర్థించినప్పుడు రద్దు అయిన బుకింగ్‌లు తిరిగి రావు.",
  confirmCancel: "నా తొలగింపు అభ్యర్థనను రద్దు చేయండి",
  cancelling: "రద్దు చేస్తోంది…",
  cancelDone: "మీ తొలగింపు అభ్యర్థన రద్దు అయింది. మీరు మళ్లీ సైన్ ఇన్ చేయవచ్చు.",

  legalSection: "చట్టపరమైన పత్రాలు",
  accountSection: "ఖాతా",
  privacyPolicy: "గోప్యతా విధానం",
  customerTerms: "కస్టమర్ నిబంధనలు",
  pujariTerms: "పూజారి నిబంధనలు",
  appTerms: "యాప్ వినియోగ నిబంధనలు",
  refundPolicy: "రద్దు & వాపసు విధానం",
  deleteAccountWeb: "ఖాతా తొలగించండి (వెబ్)",
  terms: "నిబంధనలు",
  loginLegalPrefix: "సైన్ ఇన్ చేయడం ద్వారా మీరు మా వీటికి అంగీకరిస్తున్నారు:",
  and: "మరియు",

  changePassword: "పాస్‌వర్డ్ మార్చండి",
  deleteAccount: "ఖాతా తొలగించండి",
  deleteTitle: "ఖాతా తొలగించండి",
  deleteWarning:
    "ఖాతా తొలగిస్తే, అది ఇప్పుడే నిష్క్రియం అయి 14 రోజుల తర్వాత శాశ్వతంగా తొలగించబడుతుంది. ఆ 14 రోజుల్లో మీరు రద్దు చేయవచ్చు. ఆ తర్వాత దీన్ని వెనక్కి తీసుకోలేరు.",
  obligationsTitle: "కొనసాగించే ముందు",
  noObligations: "మీకు తెరిచి ఉన్న బుకింగ్‌లు లేదా బకాయిలు లేవు.",
  upcomingBookings: "రాబోయే బుకింగ్‌లు",
  upcomingCustomerNote: "ఈ బుకింగ్‌లు సాధారణ రద్దు విధానం ప్రకారం రద్దు అవుతాయి. సాధారణ రుసుములు వర్తిస్తాయి.",
  upcomingPujariNote: "మీరు అంగీకరించిన ఈ బుకింగ్‌లు మరో పూజారికి కేటాయించడానికి విడుదల చేయబడతాయి.",
  ongoingBookings: "జరుగుతున్న బుకింగ్‌లు",
  ongoingNote: "జరుగుతున్న పూజలు పూర్తయ్యే వరకు కొనసాగుతాయి.",
  unpaidBookings: "చెల్లించని ఆన్‌లైన్ బుకింగ్‌లు",
  unpaidNote: "వీటికి చెల్లింపు పూర్తి కాలేదు, కాబట్టి ఏమీ వసూలు చేయలేదు. ఇవి మూసివేయబడతాయి.",
  refund: "వాపసు",
  fee: "రుసుము",
  cancellationNotAllowed: "ఇప్పుడు రద్దు చేయలేరు",
  reassign: "మరో పూజారికి కేటాయిస్తారు",
  walletBalance: "వాలెట్ బ్యాలెన్స్",
  pendingRefunds: "పెండింగ్ వాపసులు",
  pendingSettlement: "పెండింగ్ సెటిల్‌మెంట్",
  blockingTitle: "తుది తొలగింపుకు ముందు పరిష్కరించాలి",
  retentionTitle: "మేము ఏమి భద్రపరుస్తాం",
  existingRequest: "తొలగింపు అభ్యర్థన",
  reason: "కారణం",
  chooseReason: "కారణం ఎంచుకోండి",
  explanation: "మరింత వివరించండి",
  explanationHint: `${EXPLANATION_MIN}–${EXPLANATION_MAX} అక్షరాలు`,
  explanationTooShort: `కనీసం ${EXPLANATION_MIN} అక్షరాలు రాయండి.`,
  confirmToggle:
    "నా ఖాతా ఇప్పుడే నిష్క్రియం అయి 14 రోజుల తర్వాత తొలగించబడుతుందని, రాబోయే బుకింగ్‌లు పైన చూపిన విధంగా నిర్వహించబడతాయని నేను అర్థం చేసుకున్నాను.",
  confirmRequired: "దయచేసి మీరు అర్థం చేసుకున్నట్లు నిర్ధారించండి.",
  reasonRequired: "దయచేసి ఒక కారణం ఎంచుకోండి.",
  continue: "కొనసాగించండి",
  codeSentTo: (hint?: string) =>
    hint ? `మేము ${hint} కు 6 అంకెల కోడ్ పంపాము.` : "మేము మీ ఇమెయిల్‌కు 6 అంకెల కోడ్ పంపాము.",
  confirmDelete: "నా ఖాతా తొలగించండి",
  deleting: "తొలగిస్తోంది…",
  done: "సరే",

  report: "ఫిర్యాదు",
  reportBooking: "ఈ బుకింగ్‌పై ఫిర్యాదు",
  reportPujari: "పూజారిపై ఫిర్యాదు",
  reportCustomer: "కస్టమర్‌పై ఫిర్యాదు",
  reportTitle: "ఫిర్యాదు",
  reportIntro: "ఏమి జరిగిందో చెప్పండి. ప్రతి ఫిర్యాదును మా బృందం పరిశీలిస్తుంది. అత్యవసర పరిస్థితిలో ముందుగా స్థానిక అధికారులను సంప్రదించండి.",
  details: "వివరాలు",
  detailsHint: `${REPORT_DETAILS_MIN}–${REPORT_DETAILS_MAX} అక్షరాలు`,
  detailsTooShort: `కనీసం ${REPORT_DETAILS_MIN} అక్షరాలు రాయండి.`,
  submitReport: "ఫిర్యాదు పంపండి",
  submitting: "పంపుతోంది…",
  reportSent: "ఫిర్యాదు పంపబడింది. మా బృందం దీన్ని పరిశీలిస్తుంది.",
  myReports: "నా ఫిర్యాదులు",
  noReports: "మీరు ఇంకా ఫిర్యాదులు చేయలేదు.",
  howToReport: "సమస్యను నివేదించడానికి, బుకింగ్స్‌లో ఆ బుకింగ్‌ను తెరిచి Report నొక్కండి.",
  resolution: "పరిష్కారం",

  walletHelp: "ప్రస్తుతం వాలెట్‌లో క్రెడిట్ B-Seva సపోర్ట్ ద్వారా జోడించబడుతుంది. క్రెడిట్ జోడించడానికి సపోర్ట్‌ను సంప్రదించండి.",
};
