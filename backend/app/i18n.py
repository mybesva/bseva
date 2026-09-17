"""Customer/Pujari locale helpers. Admin/super_admin stay English."""
from __future__ import annotations

import re
from typing import Any, Mapping

from fastapi import HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

SUPPORTED_LANGS = ("en", "hi", "te", "mr", "ta", "kn")
FALLBACK_LANG = "en"
ADMIN_ROLES = frozenset({"admin", "super_admin"})

_VAR = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def normalize_lang(code: str | None) -> str:
    raw = (code or FALLBACK_LANG).strip().lower().replace("_", "-")
    short = raw.split("-")[0][:2]
    return short if short in SUPPORTED_LANGS else FALLBACK_LANG


def interpolate(template: str, vars: Mapping[str, Any] | None = None) -> str:
    if not vars:
        return template
    return _VAR.sub(lambda m: "" if vars.get(m.group(1)) is None else str(vars[m.group(1)]), template)


def coded_http(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


CUSTOMER_ERRORS: dict[str, dict[str, str]] = {
    "SERVICE_AREA_UNAVAILABLE": {
        "en": "BSeva service is not available at this location yet. Please try another address.",
        "hi": "इस स्थान पर BSeva सेवा अभी उपलब्ध नहीं है। कृपया दूसरा पता आज़माएँ।",
        "te": "ఈ ప్రదేశంలో BSeva సేవ ఇంకా అందుబాటులో లేదు. దయచేసి మరో చిరునామాను ప్రయత్నించండి.",
        "mr": "या ठिकाणी BSeva सेवा अद्याप उपलब्ध नाही. कृपया दुसरा पत्ता वापरून पहा.",
        "kn": "ಈ ಸ್ಥಳದಲ್ಲಿ BSeva ಸೇವೆ ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಬೇರೆ ವಿಳಾಸವನ್ನು ಪ್ರಯತ್ನಿಸಿ.",
        "ta": "இந்த இடத்தில் BSeva சேவை இன்னும் கிடைக்கவில்லை. வேறு முகவரியை முயற்சிக்கவும்.",
    },
}


def customer_error_message(code: str, lang: str | None = None) -> str:
    pack = CUSTOMER_ERRORS.get(code) or {}
    loc = normalize_lang(lang)
    return pack.get(loc) or pack.get(FALLBACK_LANG) or code


def resolve_request_lang(explicit: str | None = None, request: Request | None = None) -> str:
    if explicit:
        return normalize_lang(explicit)
    if request is not None:
        q = request.query_params.get("lang")
        if q:
            return normalize_lang(q)
        header = request.headers.get("accept-language") or ""
        if header:
            first = header.split(",")[0].strip()
            return normalize_lang(first)
    return FALLBACK_LANG


def user_preferred_lang(db: Session, user_id: str | None) -> str:
    if not user_id:
        return FALLBACK_LANG
    row = db.execute(
        text(
            """
            SELECT u.role, u.preferred_language, cp.preferred_language AS customer_lang
            FROM users u
            LEFT JOIN customer_profiles cp ON cp.user_id = u.id
            WHERE u.id = CAST(:id AS uuid)
            """
        ),
        {"id": user_id},
    ).mappings().first()
    if not row:
        return FALLBACK_LANG
    if str(row.get("role") or "") in ADMIN_ROLES:
        return FALLBACK_LANG
    return normalize_lang(row.get("customer_lang") or row.get("preferred_language"))


def user_role(db: Session, user_id: str) -> str:
    row = db.execute(text("SELECT role FROM users WHERE id = CAST(:id AS uuid)"), {"id": user_id}).first()
    return str(row[0]) if row else ""


def pick_text(translations: Mapping[str, str] | None, lang: str, fallback: str = "") -> str:
    if not translations:
        return fallback
    code = normalize_lang(lang)
    return (
        (translations.get(code) or "").strip()
        or (translations.get(FALLBACK_LANG) or "").strip()
        or fallback
    )


NOTIFY: dict[str, dict[str, dict[str, str]]] = {
    "bookingCreated": {
        "en": {"title": "Booking created", "body": "Your booking {{number}} is confirmed. We will update you as it progresses."},
        "hi": {"title": "बुकिंग बन गई", "body": "आपकी बुकिंग {{number}} पुष्टि हो गई है। आगे की जानकारी हम भेजते रहेंगे।"},
        "te": {"title": "బుకింగ్ సృష్టించబడింది", "body": "మీ బుకింగ్ {{number}} నిర్ధారించబడింది. పురోగతిని మేము తెలియజేస్తాము."},
        "mr": {"title": "बुकिंग तयार झाली", "body": "तुमची बुकिंग {{number}} निश्चित झाली आहे. पुढील अपडेट आम्ही देऊ."},
        "kn": {"title": "ಬುಕಿಂಗ್ ರಚನೆಯಾಯಿತು", "body": "ನಿಮ್ಮ ಬುಕಿಂಗ್ {{number}} ದೃಢಪಟ್ಟಿದೆ. ಮುಂದಿನ ಮಾಹಿತಿ ನಾವು ತಿಳಿಸುತ್ತೇವೆ."},
        "ta": {"title": "முன்பதிவு உருவாக்கப்பட்டது", "body": "உங்கள் முன்பதிவு {{number}} உறுதி. முன்னேற்றத்தை அறிவிப்போம்."},
    },
    "newRequest": {
        "en": {"title": "New booking request", "body": "New {{service}} request ({{number}}) near you — accept or decline in Bookings."},
        "hi": {"title": "नई बुकिंग अनुरोध", "body": "आपके पास नई {{service}} अनुरोध ({{number}}) — बुकिंग में स्वीकार या अस्वीकार करें।"},
        "te": {"title": "కొత్త బుకింగ్ అభ్యర్థన", "body": "మీ దగ్గర కొత్త {{service}} అభ్యర్థన ({{number}}) — బుకింగ్స్‌లో స్వీకరించండి లేదా తిరస్కరించండి."},
        "mr": {"title": "नवीन बुकिंग विनंती", "body": "तुमच्या जवळ नवीन {{service}} विनंती ({{number}}) — बुकिंगमध्ये स्वीकारा किंवा नाकारा."},
        "kn": {"title": "ಹೊಸ ಬುಕಿಂಗ್ ವಿನಂತಿ", "body": "ನಿಮ್ಮ ಹತ್ತಿರ ಹೊಸ {{service}} ವಿನಂತಿ ({{number}}) — ಬುಕಿಂಗ್‌ನಲ್ಲಿ ಸ್ವೀಕರಿಸಿ ಅಥವಾ ನಿರಾಕರಿಸಿ."},
        "ta": {"title": "புதிய முன்பதிவு கோரிக்கை", "body": "உங்களுக்கு அருகில் புதிய {{service}} கோரிக்கை ({{number}}) — முன்பதிவுகளில் ஏற்கவும் அல்லது நிராகரிக்கவும்."},
    },
    "awaiting": {
        "en": {"title": "New booking request", "body": "New booking {{number}} awaiting your acceptance."},
        "hi": {"title": "नई बुकिंग अनुरोध", "body": "नई बुकिंग {{number}} आपकी स्वीकृति की प्रतीक्षा में है।"},
        "te": {"title": "కొత్త బుకింగ్ అభ్యర్థన", "body": "కొత్త బుకింగ్ {{number}} మీ స్వీకారం కోసం వేచి ఉంది."},
        "mr": {"title": "नवीन बुकिंग विनंती", "body": "नवीन बुकिंग {{number}} तुमच्या स्वीकृतीची वाट पाहते."},
        "kn": {"title": "ಹೊಸ ಬುಕಿಂಗ್ ವಿನಂತಿ", "body": "ಹೊಸ ಬುಕಿಂಗ್ {{number}} ನಿಮ್ಮ ಸ್ವೀಕಾರಕ್ಕಾಗಿ ಕಾಯುತ್ತಿದೆ."},
        "ta": {"title": "புதிய முன்பதிவு கோரிக்கை", "body": "புதிய முன்பதிவு {{number}} உங்கள் ஏற்புக்காக காத்திருக்கிறது."},
    },
    "reminder": {
        "en": {"title": "Upcoming booking reminder", "body": "Reminder: {{service}} ({{number}}) is within {{hours}} hours."},
        "hi": {"title": "आगामी बुकिंग अनुस्मारक", "body": "अनुस्मारक: {{service}} ({{number}}) {{hours}} घंटे में है।"},
        "te": {"title": "రాబోయే బుకింగ్ రిమైండర్", "body": "రిమైండర్: {{service}} ({{number}}) {{hours}} గంటల్లో ఉంది."},
        "mr": {"title": "आगामी बुकिंग स्मरण", "body": "स्मरण: {{service}} ({{number}}) {{hours}} तासांत आहे."},
        "kn": {"title": "ಮುಂಬರುವ ಬುಕಿಂಗ್ ಜ್ಞಾಪನೆ", "body": "ಜ್ಞಾಪನೆ: {{service}} ({{number}}) {{hours}} ಗಂಟೆಗಳಲ್ಲಿ."},
        "ta": {"title": "வரவிருக்கும் முன்பதிவு நினைவூட்டல்", "body": "நினைவூட்டல்: {{service}} ({{number}}) {{hours}} மணிநேரத்தில்."},
    },
    "samagriReminder": {
        "en": {"title": "Samagri reminder — upcoming puja", "body": "Booking {{number}} ({{service}}): the customer selected Samagri. Please review the Samagri list and arrange materials before the puja."},
        "hi": {"title": "सामग्री अनुस्मारक — आगामी पूजा", "body": "बुकिंग {{number}} ({{service}}): ग्राहक ने सामग्री चुनी है। पूजा से पहले सूची देखकर सामग्री तैयार करें।"},
        "te": {"title": "సామగ్రి రిమైండర్ — రాబోయే పూజ", "body": "బుకింగ్ {{number}} ({{service}}): కస్టమర్ సామగ్రి ఎంచుకున్నారు. పూజకు ముందు జాబితా చూసి సామగ్రి సిద్ధం చేయండి."},
        "mr": {"title": "सामग्री स्मरण — आगामी पूजा", "body": "बुकिंग {{number}} ({{service}}): ग्राहकाने सामग्री निवडली आहे. पूजेपूर्वी यादी पाहून साहित्य तयार करा."},
        "kn": {"title": "ಸಾಮಗ್ರಿ ಜ್ಞಾಪನೆ — ಮುಂಬರುವ ಪೂಜೆ", "body": "ಬುಕಿಂಗ್ {{number}} ({{service}}): ಗ್ರಾಹಕರು ಸಾಮಗ್ರಿ ಆಯ್ಕೆ ಮಾಡಿದ್ದಾರೆ. ಪೂಜೆಗೆ ಮುನ್ನ ಪಟ್ಟಿ ನೋಡಿ ಸಾಮಗ್ರಿ ಸಿದ್ಧಪಡಿಸಿ."},
        "ta": {"title": "சாமக்ரி நினைவூட்டல் — வரவிருக்கும் பூஜை", "body": "முன்பதிவு {{number}} ({{service}}): வாடிக்கையாளர் சாமக்ரி தேர்ந்தெடுத்தார். பூஜைக்கு முன் பட்டியலைப் பார்த்து பொருட்கள் தயார் செய்யவும்."},
    },
    "assigned": {
        "en": {"title": "Pujari assigned", "body": "A pujari has been assigned to booking {{number}}."},
        "hi": {"title": "पुजारी नियुक्त", "body": "बुकिंग {{number}} के लिए पुजारी नियुक्त किए गए हैं।"},
        "te": {"title": "పూజారి కేటాయించబడ్డారు", "body": "బుకింగ్ {{number}}కి పూజారి కేటాయించబడ్డారు."},
        "mr": {"title": "पुजारी नेमले", "body": "बुकिंग {{number}} साठी पुजारी नेमले आहेत."},
        "kn": {"title": "ಪೂಜಾರಿ ನಿಯೋಜಿಸಲಾಗಿದೆ", "body": "ಬುಕಿಂಗ್ {{number}} ಗೆ ಪೂಜಾರಿ ನಿಯೋಜಿಸಲಾಗಿದೆ."},
        "ta": {"title": "பூசாரி நியமிக்கப்பட்டார்", "body": "முன்பதிவு {{number}}க்கு பூசாரி நியமிக்கப்பட்டார்."},
    },
    "accepted": {
        "en": {"title": "Booking accepted", "body": "Your booking {{number}} has been accepted."},
        "hi": {"title": "बुकिंग स्वीकार", "body": "आपकी बुकिंग {{number}} स्वीकार कर ली गई है।"},
        "te": {"title": "బుకింగ్ స్వీకరించబడింది", "body": "మీ బుకింగ్ {{number}} స్వీకరించబడింది."},
        "mr": {"title": "बुकिंग स्वीकारली", "body": "तुमची बुकिंग {{number}} स्वीकारली आहे."},
        "kn": {"title": "ಬುಕಿಂಗ್ ಸ್ವೀಕರಿಸಲಾಗಿದೆ", "body": "ನಿಮ್ಮ ಬುಕಿಂಗ್ {{number}} ಸ್ವೀಕರಿಸಲಾಗಿದೆ."},
        "ta": {"title": "முன்பதிவு ஏற்கப்பட்டது", "body": "உங்கள் முன்பதிவு {{number}} ஏற்கப்பட்டது."},
    },
    "cancelled": {
        "en": {"title": "Booking cancelled", "body": "Booking {{number}} has been cancelled."},
        "hi": {"title": "बुकिंग रद्द", "body": "बुकिंग {{number}} रद्द कर दी गई है।"},
        "te": {"title": "బుకింగ్ రద్దు", "body": "బుకింగ్ {{number}} రద్దు చేయబడింది."},
        "mr": {"title": "बुकिंग रद्द", "body": "बुकिंग {{number}} रद्द केली आहे."},
        "kn": {"title": "ಬುಕಿಂಗ್ ರದ್ದು", "body": "ಬುಕಿಂಗ್ {{number}} ರದ್ದುಗೊಂಡಿದೆ."},
        "ta": {"title": "முன்பதிவு ரத்து", "body": "முன்பதிவு {{number}} ரத்து செய்யப்பட்டது."},
    },
    "paymentOk": {
        "en": {"title": "Payment successful", "body": "Payment for booking {{number}} was successful."},
        "hi": {"title": "भुगतान सफल", "body": "बुकिंग {{number}} का भुगतान सफल रहा।"},
        "te": {"title": "చెల్లింపు విజయవంతం", "body": "బుకింగ్ {{number}} చెల్లింపు విజయవంతమైంది."},
        "mr": {"title": "पेमेंट यशस्वी", "body": "बुकिंग {{number}} चे पेमेंट यशस्वी झाले."},
        "kn": {"title": "ಪಾವತಿ ಯಶಸ್ವಿ", "body": "ಬುಕಿಂಗ್ {{number}} ಪಾವತಿ ಯಶಸ್ವಿಯಾಗಿದೆ."},
        "ta": {"title": "பணம் வெற்றி", "body": "முன்பதிவு {{number}}க்கான பணம் வெற்றி."},
    },
    "paymentFail": {
        "en": {"title": "Payment failed", "body": "Payment for booking {{number}} failed. Please try again."},
        "hi": {"title": "भुगतान असफल", "body": "बुकिंग {{number}} का भुगतान असफल रहा। कृपया फिर कोशिश करें।"},
        "te": {"title": "చెల్లింపు విఫలం", "body": "బుకింగ్ {{number}} చెల్లింపు విఫలమైంది. మళ్లీ ప్రయత్నించండి."},
        "mr": {"title": "पेमेंट अयशस्वी", "body": "बुकिंग {{number}} चे पेमेंट अयशस्वी. पुन्हा प्रयत्न करा."},
        "kn": {"title": "ಪಾವತಿ ವಿಫಲ", "body": "ಬುಕಿಂಗ್ {{number}} ಪಾವತಿ ವಿಫಲವಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."},
        "ta": {"title": "பணம் தோல்வி", "body": "முன்பதிவு {{number}} பணம் தோல்வி. மீண்டும் முயலவும்."},
    },
    "refund": {
        "en": {"title": "Refund processed", "body": "Refund for booking {{number}} has been processed."},
        "hi": {"title": "रिफंड संसाधित", "body": "बुकिंग {{number}} का रिफंड संसाधित हो गया है।"},
        "te": {"title": "రీఫండ్ ప్రాసెస్ అయింది", "body": "బుకింగ్ {{number}} రీఫండ్ ప్రాసెస్ అయింది."},
        "mr": {"title": "रिफंड पूर्ण", "body": "बुकिंग {{number}} चा रिफंड पूर्ण झाला आहे."},
        "kn": {"title": "ಮರುಪಾವತಿ ಪ್ರಕ್ರಿಯೆ", "body": "ಬುಕಿಂಗ್ {{number}} ಮರುಪಾವತಿ ಪ್ರಕ್ರಿಯೆಯಾಗಿದೆ."},
        "ta": {"title": "பணத்திருப்பம்", "body": "முன்பதிவு {{number}}க்கான பணத்திருப்பம் முடிந்தது."},
    },
    "startSoon": {
        "en": {"title": "Puja starting soon", "body": "{{service}} ({{number}}) starts soon. Please be ready."},
        "hi": {"title": "पूजा जल्द शुरू", "body": "{{service}} ({{number}}) जल्द शुरू होगी। कृपया तैयार रहें।"},
        "te": {"title": "పూజ త్వరలో ప్రారంభం", "body": "{{service}} ({{number}}) త్వరలో ప్రారంభమవుతుంది. సిద్ధంగా ఉండండి."},
        "mr": {"title": "पूजा लवकरच सुरू", "body": "{{service}} ({{number}}) लवकरच सुरू होईल. तयार राहा."},
        "kn": {"title": "ಪೂಜೆ ಶೀಘ್ರದಲ್ಲೇ", "body": "{{service}} ({{number}}) ಶೀಘ್ರದಲ್ಲೇ ಪ್ರಾರಂಭ. ಸಿದ್ಧರಾಗಿರಿ."},
        "ta": {"title": "பூஜை விரைவில்", "body": "{{service}} ({{number}}) விரைவில் தொடங்கும். தயாராக இருங்கள்."},
    },
    "arriving": {
        "en": {"title": "Pujari arriving", "body": "Your pujari is on the way for booking {{number}}."},
        "hi": {"title": "पुजारी आ रहे हैं", "body": "बुकिंग {{number}} के लिए आपके पुजारी रास्ते में हैं।"},
        "te": {"title": "పూజారి వస్తున్నారు", "body": "బుకింగ్ {{number}} కోసం మీ పూజారి వస్తున్నారు."},
        "mr": {"title": "पुजारी येत आहेत", "body": "बुकिंग {{number}} साठी तुमचे पुजारी मार्गावर आहेत."},
        "kn": {"title": "ಪೂಜಾರಿ ಬರುತ್ತಿದ್ದಾರೆ", "body": "ಬುಕಿಂಗ್ {{number}} ಗಾಗಿ ನಿಮ್ಮ ಪೂಜಾರಿ ಬರುತ್ತಿದ್ದಾರೆ."},
        "ta": {"title": "பூசாரி வருகிறார்", "body": "முன்பதிவு {{number}}க்கு உங்கள் பூசாரி வருகிறார்."},
    },
    "completed": {
        "en": {"title": "Booking completed", "body": "Booking {{number}} has been marked completed."},
        "hi": {"title": "बुकिंग पूर्ण", "body": "बुकिंग {{number}} पूर्ण चिह्नित की गई है।"},
        "te": {"title": "బుకింగ్ పూర్తి", "body": "బుకింగ్ {{number}} పూర్తి అయింది."},
        "mr": {"title": "बुकिंग पूर्ण", "body": "बुकिंग {{number}} पूर्ण झाली आहे."},
        "kn": {"title": "ಬುಕಿಂಗ್ ಪೂರ್ಣ", "body": "ಬುಕಿಂಗ್ {{number}} ಪೂರ್ಣಗೊಂಡಿದೆ."},
        "ta": {"title": "முன்பதிவு முடிந்தது", "body": "முன்பதிவு {{number}} முடிந்ததாக குறிக்கப்பட்டது."},
    },
    "declined": {
        "en": {"title": "Booking declined", "body": "Booking {{number}} was declined. We will reassign a pujari."},
        "hi": {"title": "बुकिंग अस्वीकृत", "body": "बुकिंग {{number}} अस्वीकृत हुई। हम दूसरे पुजारी नियुक्त करेंगे।"},
        "te": {"title": "బుకింగ్ తిరస్కరణ", "body": "బుకింగ్ {{number}} తిరస్కరించబడింది. మరో పూజారిని కేటాయిస్తాము."},
        "mr": {"title": "बुकिंग नाकारली", "body": "बुकिंग {{number}} नाकारली. आम्ही दुसरे पुजारी नेमू."},
        "kn": {"title": "ಬುಕಿಂಗ್ ನಿರಾಕರಣೆ", "body": "ಬುಕಿಂಗ್ {{number}} ನಿರಾಕರಿಸಲಾಗಿದೆ. ಬೇರೆ ಪೂಜಾರಿ ನಿಯೋಜಿಸುತ್ತೇವೆ."},
        "ta": {"title": "முன்பதிவு நிராகரிப்பு", "body": "முன்பதிவு {{number}} நிராகரிக்கப்பட்டது. வேறு பூசாரியை நியமிப்போம்."},
    },
    "startOtp": {
        "en": {"title": "Start Puja OTP ready", "body": "Your Start Puja OTP for {{service}} ({{number}}) is {{code}}. Share it with your Pujari when they arrive to begin the Puja."},
        "hi": {"title": "पूजा प्रारंभ OTP तैयार", "body": "{{service}} ({{number}}) का प्रारंभ OTP {{code}} है। पूजा शुरू करने पर इसे पुजारी से साझा करें।"},
        "te": {"title": "పూజ ప్రారంభ OTP సిద్ధం", "body": "{{service}} ({{number}}) ప్రారంభ OTP {{code}}. పూజ ప్రారంభించేటప్పుడు పూజారికి చెప్పండి."},
        "mr": {"title": "पूजा सुरू OTP तयार", "body": "{{service}} ({{number}}) साठी प्रारंभ OTP {{code}} आहे. पूजा सुरू करताना पुजार्‍यांना सांगा."},
        "kn": {"title": "ಪೂಜೆ ಪ್ರಾರಂಭ OTP ಸಿದ್ಧ", "body": "{{service}} ({{number}}) ಪ್ರಾರಂಭ OTP {{code}}. ಪೂಜೆ ಪ್ರಾರಂಭಿಸುವಾಗ ಪೂಜಾರಿಗೆ ಹಂಚಿಕೊಳ್ಳಿ."},
        "ta": {"title": "பூஜை தொடக்க OTP தயார்", "body": "{{service}} ({{number}}) தொடக்க OTP {{code}}. பூஜை தொடங்கும் போது பூசாரியிடம் பகிரவும்."},
    },
    "startOtpResend": {
        "en": {"title": "New Start Puja OTP", "body": "Your new Start Puja OTP for {{service}} ({{number}}) is {{code}}."},
        "hi": {"title": "नया पूजा प्रारंभ OTP", "body": "{{service}} ({{number}}) का नया प्रारंभ OTP {{code}} है।"},
        "te": {"title": "కొత్త పూజ ప్రారంభ OTP", "body": "{{service}} ({{number}}) కొత్త ప్రారంభ OTP {{code}}."},
        "mr": {"title": "नवीन पूजा सुरू OTP", "body": "{{service}} ({{number}}) साठी नवीन प्रारंभ OTP {{code}} आहे."},
        "kn": {"title": "ಹೊಸ ಪೂಜೆ ಪ್ರಾರಂಭ OTP", "body": "{{service}} ({{number}}) ಹೊಸ ಪ್ರಾರಂಭ OTP {{code}}."},
        "ta": {"title": "புதிய பூஜை தொடக்க OTP", "body": "{{service}} ({{number}}) புதிய தொடக்க OTP {{code}}."},
    },
    "completeOtp": {
        "en": {"title": "Completion OTP ready", "body": "Your Completion OTP for {{service}} ({{number}}) is {{code}}. Share it with the customer when the Puja is complete."},
        "hi": {"title": "पूर्णता OTP तैयार", "body": "{{service}} ({{number}}) का पूर्णता OTP {{code}} है। पूजा पूरी होने पर ग्राहक से साझा करें।"},
        "te": {"title": "పూర్తి OTP సిద్ధం", "body": "{{service}} ({{number}}) పూర్తి OTP {{code}}. పూజ పూర్తయిన తర్వాత కస్టమర్‌కి చెప్పండి."},
        "mr": {"title": "पूर्णता OTP तयार", "body": "{{service}} ({{number}}) चा पूर्णता OTP {{code}} आहे. पूजा पूर्ण झाल्यावर ग्राहकाला सांगा."},
        "kn": {"title": "ಪೂರ್ಣಗೊಳಿಸುವ OTP ಸಿದ್ಧ", "body": "{{service}} ({{number}}) ಪೂರ್ಣಗೊಳಿಸುವ OTP {{code}}. ಪೂಜೆ ಮುಗಿದಾಗ ಗ್ರಾಹಕರೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಿ."},
        "ta": {"title": "முடிவு OTP தயார்", "body": "{{service}} ({{number}}) முடிவு OTP {{code}}. பூஜை முடிந்ததும் வாடிக்கையாளரிடம் பகிரவும்."},
    },
    "completeOtpResend": {
        "en": {"title": "New Completion OTP", "body": "Your new Completion OTP for {{service}} ({{number}}) is {{code}}."},
        "hi": {"title": "नया पूर्णता OTP", "body": "{{service}} ({{number}}) का नया पूर्णता OTP {{code}} है।"},
        "te": {"title": "కొత్త పూర్తి OTP", "body": "{{service}} ({{number}}) కొత్త పూర్తి OTP {{code}}."},
        "mr": {"title": "नवीन पूर्णता OTP", "body": "{{service}} ({{number}}) साठी नवीन पूर्णता OTP {{code}} आहे."},
        "kn": {"title": "ಹೊಸ ಪೂರ್ಣಗೊಳಿಸುವ OTP", "body": "{{service}} ({{number}}) ಹೊಸ ಪೂರ್ಣಗೊಳಿಸುವ OTP {{code}}."},
        "ta": {"title": "புதிய முடிவு OTP", "body": "{{service}} ({{number}}) புதிய முடிவு OTP {{code}}."},
    },
    "locationUnlocked": {
        "en": {"title": "Service location is now available", "body": "The customer service location for {{service}} ({{number}}) is now available. Open Bookings for maps and directions."},
        "hi": {"title": "सेवा स्थान अब उपलब्ध है", "body": "{{service}} ({{number}}) का ग्राहक स्थान अब उपलब्ध है। मानचित्र के लिए बुकिंग खोलें।"},
        "te": {"title": "సేవా స్థానం ఇప్పుడు అందుబాటులో ఉంది", "body": "{{service}} ({{number}}) కస్టమర్ స్థానం ఇప్పుడు అందుబాటులో ఉంది."},
        "mr": {"title": "सेवा स्थान आता उपलब्ध आहे", "body": "{{service}} ({{number}}) चे ग्राहक स्थान आता उपलब्ध आहे."},
        "kn": {"title": "ಸೇವಾ ಸ್ಥಳ ಈಗ ಲಭ್ಯವಿದೆ", "body": "{{service}} ({{number}}) ಗ್ರಾಹಕರ ಸ್ಥಳ ಈಗ ಲಭ್ಯವಿದೆ."},
        "ta": {"title": "சேவை இடம் இப்போது கிடைக்கிறது", "body": "{{service}} ({{number}}) வாடிக்கையாளர் இடம் இப்போது கிடைக்கிறது."},
    },
    "arrived": {
        "en": {"title": "Pujari has arrived", "body": "Your pujari has reached the puja location for booking {{number}}."},
        "hi": {"title": "पुजारी पहुँच गए हैं", "body": "बुकिंग {{number}} के लिए आपके पुजारी पूजा स्थान पर पहुँच गए हैं।"},
        "te": {"title": "పూజారి చేరుకున్నారు", "body": "బుకింగ్ {{number}} కోసం మీ పూజారి పూజ స్థానానికి చేరుకున్నారు."},
        "mr": {"title": "पुजारी पोहोचले", "body": "बुकिंग {{number}} साठी तुमचे पुजारी पूजा स्थानी पोहोचले आहेत."},
        "kn": {"title": "ಪೂಜಾರಿ ತಲುಪಿದ್ದಾರೆ", "body": "ಬುಕಿಂಗ್ {{number}} ಗಾಗಿ ನಿಮ್ಮ ಪೂಜಾರಿ ಪೂಜಾ ಸ್ಥಳಕ್ಕೆ ತಲುಪಿದ್ದಾರೆ."},
        "ta": {"title": "பூசாரி வந்துவிட்டார்", "body": "முன்பதிவு {{number}}க்கு உங்கள் பூசாரி பூஜை இடத்தை அடைந்துவிட்டார்."},
    },
    "pujaStarted": {
        "en": {"title": "Puja started", "body": "Puja {{number}} has started."},
        "hi": {"title": "पूजा शुरू हुई", "body": "पूजा {{number}} शुरू हो गई है।"},
        "te": {"title": "పూజ ప్రారంభమైంది", "body": "పూజ {{number}} ప్రారంభమైంది."},
        "mr": {"title": "पूजा सुरू झाली", "body": "पूजा {{number}} सुरू झाली आहे."},
        "kn": {"title": "ಪೂಜೆ ಪ್ರಾರಂಭವಾಯಿತು", "body": "ಪೂಜೆ {{number}} ಪ್ರಾರಂಭವಾಗಿದೆ."},
        "ta": {"title": "பூஜை தொடங்கியது", "body": "பூஜை {{number}} தொடங்கியது."},
    },
}


EMAIL_GREET = {
    "en": "Namaste {name},",
    "hi": "नमस्ते {name},",
    "te": "నమస్తే {name},",
    "mr": "नमस्कार {name},",
    "kn": "ನಮಸ್ತೆ {name},",
    "ta": "வணக்கம் {name},",
}

EMAIL_CLOSING = {
    "en": "Om Shanti,\nBSeva",
    "hi": "ॐ शांति,\nBSeva",
    "te": "ఓం శాంతి,\nBSeva",
    "mr": "ॐ शांती,\nBSeva",
    "kn": "ಓಂ ಶಾಂತಿ,\nBSeva",
    "ta": "ஓம் சாந்தி,\nBSeva",
}

EMAIL_LABELS = {
    "en": {
        "customer": "Customer",
        "bookingId": "Booking ID",
        "service": "Service",
        "date": "Date",
        "timeMuhurtham": "Time / Muhurtham",
        "location": "Location",
        "package": "Package",
        "mainPuja": "Main puja",
        "samagri": "Samagri",
        "alankaram": "Alankaram",
        "food": "Food / Prasadam",
        "total": "Total amount",
        "paymentStatus": "Payment status",
        "bookingStatus": "Booking status",
    },
    "hi": {
        "customer": "ग्राहक",
        "bookingId": "बुकिंग आईडी",
        "service": "सेवा",
        "date": "तिथि",
        "timeMuhurtham": "समय / मुहूर्त",
        "location": "स्थान",
        "package": "पैकेज",
        "mainPuja": "मुख्य पूजा",
        "samagri": "सामग्री",
        "alankaram": "अलंकारम्",
        "food": "भोजन / प्रसाद",
        "total": "कुल राशि",
        "paymentStatus": "भुगतान स्थिति",
        "bookingStatus": "बुकिंग स्थिति",
    },
    "te": {
        "customer": "కస్టమర్",
        "bookingId": "బుకింగ్ ID",
        "service": "సేవ",
        "date": "తేదీ",
        "timeMuhurtham": "సమయం / ముహూర్తం",
        "location": "స్థానం",
        "package": "ప్యాకేజ్",
        "mainPuja": "ప్రధాన పూజ",
        "samagri": "సామగ్రి",
        "alankaram": "అలంకారం",
        "food": "ఆహారం / ప్రసాదం",
        "total": "మొత్తం",
        "paymentStatus": "చెల్లింపు స్థితి",
        "bookingStatus": "బుకింగ్ స్థితి",
    },
    "mr": {
        "customer": "ग्राहक",
        "bookingId": "बुकिंग आयडी",
        "service": "सेवा",
        "date": "तारीख",
        "timeMuhurtham": "वेळ / मुहूर्त",
        "location": "स्थान",
        "package": "पॅकेज",
        "mainPuja": "मुख्य पूजा",
        "samagri": "सामग्री",
        "alankaram": "अलंकारम",
        "food": "अन्न / प्रसाद",
        "total": "एकूण रक्कम",
        "paymentStatus": "पेमेंट स्थिती",
        "bookingStatus": "बुकिंग स्थिती",
    },
    "kn": {
        "customer": "ಗ್ರಾಹಕ",
        "bookingId": "ಬುಕಿಂಗ್ ID",
        "service": "ಸೇವೆ",
        "date": "ದಿನಾಂಕ",
        "timeMuhurtham": "ಸಮಯ / ಮುಹೂರ್ತ",
        "location": "ಸ್ಥಳ",
        "package": "ಪ್ಯಾಕೇಜ್",
        "mainPuja": "ಮುಖ್ಯ ಪೂಜೆ",
        "samagri": "ಸಾಮಗ್ರಿ",
        "alankaram": "ಅಲಂಕಾರಂ",
        "food": "ಆಹಾರ / ಪ್ರಸಾದ",
        "total": "ಒಟ್ಟು ಮೊತ್ತ",
        "paymentStatus": "ಪಾವತಿ ಸ್ಥಿತಿ",
        "bookingStatus": "ಬುಕಿಂಗ್ ಸ್ಥಿತಿ",
    },
    "ta": {
        "customer": "வாடிக்கையாளர்",
        "bookingId": "முன்பதிவு ID",
        "service": "சேவை",
        "date": "தேதி",
        "timeMuhurtham": "நேரம் / முகூர்த்தம்",
        "location": "இடம்",
        "package": "தொகுப்பு",
        "mainPuja": "முதன்மை பூஜை",
        "samagri": "சாமக்ரி",
        "alankaram": "அலங்காரம்",
        "food": "உணவு / பிரசாதம்",
        "total": "மொத்த தொகை",
        "paymentStatus": "கட்டண நிலை",
        "bookingStatus": "முன்பதிவு நிலை",
    },
}


def notify_copy(key: str, lang: str, vars: Mapping[str, Any] | None = None) -> tuple[str, str]:
    pack = NOTIFY.get(key) or {}
    loc = normalize_lang(lang)
    row = pack.get(loc) or pack.get(FALLBACK_LANG) or {"title": key, "body": ""}
    return interpolate(row.get("title") or key, vars), interpolate(row.get("body") or "", vars)


def email_greet(name: str, language: str) -> str:
    n = (name or "").strip() or "Ji"
    tmpl = EMAIL_GREET.get(normalize_lang(language)) or EMAIL_GREET[FALLBACK_LANG]
    return tmpl.format(name=n)


def email_closing(language: str) -> str:
    return EMAIL_CLOSING.get(normalize_lang(language)) or EMAIL_CLOSING[FALLBACK_LANG]


def email_label(key: str, language: str) -> str:
    loc = normalize_lang(language)
    labels = EMAIL_LABELS.get(loc) or EMAIL_LABELS[FALLBACK_LANG]
    return labels.get(key) or EMAIL_LABELS[FALLBACK_LANG].get(key) or key
