-- Dynamic customer-content localization and safe backfill.
-- Canonical/admin-authored English remains on the source tables.

CREATE TABLE IF NOT EXISTS recommendation_translations (
  recommendation_id UUID NOT NULL REFERENCES service_recommendations(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('hi', 'te', 'mr', 'ta', 'kn')),
  title TEXT NOT NULL,
  description TEXT,
  recurrence_hint TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (recommendation_id, language_code)
);

CREATE TABLE IF NOT EXISTS legal_policy_translations (
  policy_id UUID NOT NULL REFERENCES legal_policies(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL CHECK (language_code IN ('hi', 'te', 'mr', 'ta', 'kn')),
  title TEXT NOT NULL,
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (policy_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_service_translations_language_name
  ON service_translations (language_code, name);
CREATE INDEX IF NOT EXISTS idx_recommendation_translations_language
  ON recommendation_translations (language_code);
CREATE INDEX IF NOT EXISTS idx_legal_policy_translations_language
  ON legal_policy_translations (language_code);

-- Ensure canonical rows exist for records created before translation support.
INSERT INTO service_translations (service_id, language_code, name, short_description, full_description)
SELECT id, 'en', name, short_description, COALESCE(full_description, description)
FROM services
ON CONFLICT (service_id, language_code) DO UPDATE SET
  name = COALESCE(service_translations.name, EXCLUDED.name),
  short_description = COALESCE(service_translations.short_description, EXCLUDED.short_description),
  full_description = COALESCE(service_translations.full_description, EXCLUDED.full_description);

INSERT INTO category_translations (category_id, language_code, name)
SELECT id, 'en', name FROM service_categories
ON CONFLICT (category_id, language_code) DO NOTHING;

INSERT INTO samagri_item_translations (samagri_item_id, language_code, item_name)
SELECT id, 'en', name FROM samagri_items
ON CONFLICT (samagri_item_id, language_code) DO NOTHING;

-- Backfill the two deterministic recommendations created by backend/seed.py.
INSERT INTO recommendation_translations (
  recommendation_id, language_code, title, description, recurrence_hint
)
SELECT r.id, v.language_code, v.title, v.description, v.recurrence_hint
FROM service_recommendations r
JOIN (
  VALUES
    ('Office Puja — Monthly','hi','कार्यालय पूजा — मासिक','कार्यालय की सुख-समृद्धि के लिए अनुशंसित पूजा','मासिक'),
    ('Office Puja — Monthly','te','కార్యాలయ పూజ — నెలవారీ','కార్యాలయ శ్రేయస్సు కోసం సిఫారసు చేసిన పూజ','నెలవారీ'),
    ('Office Puja — Monthly','mr','कार्यालय पूजा — मासिक','कार्यालयाच्या कल्याणासाठी शिफारस केलेली पूजा','मासिक'),
    ('Office Puja — Monthly','ta','அலுவலக பூஜை — மாதாந்திரம்','அலுவலக நலனுக்குப் பரிந்துரைக்கப்படும் பூஜை','மாதாந்திரம்'),
    ('Office Puja — Monthly','kn','ಕಚೇರಿ ಪೂಜೆ — ಮಾಸಿಕ','ಕಚೇರಿಯ ಶ್ರೇಯಸ್ಸಿಗಾಗಿ ಶಿಫಾರಸು ಮಾಡಿದ ಪೂಜೆ','ಮಾಸಿಕ'),
    ('Shop Puja','hi','दुकान पूजा','दुकान के लिए नियमित पूजा की अनुशंसा','नियमित'),
    ('Shop Puja','te','దుకాణ పూజ','దుకాణం కోసం క్రమమైన పూజ సిఫారసు','క్రమం తప్పకుండా'),
    ('Shop Puja','mr','दुकान पूजा','दुकानासाठी नियमित पूजेची शिफारस','नियमित'),
    ('Shop Puja','ta','கடை பூஜை','கடைக்கான வழக்கமான பூஜைப் பரிந்துரை','வழக்கமாக'),
    ('Shop Puja','kn','ಅಂಗಡಿ ಪೂಜೆ','ಅಂಗಡಿಗಾಗಿ ನಿಯಮಿತ ಪೂಜೆಯ ಶಿಫಾರಸು','ನಿಯಮಿತ')
) AS v(source_title, language_code, title, description, recurrence_hint)
  ON v.source_title = r.title
ON CONFLICT (recommendation_id, language_code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  recurrence_hint = EXCLUDED.recurrence_hint,
  updated_at = NOW();

-- Seed every existing built-in legal policy in all customer locales. These
-- rows are keyed by the existing policy UUID selected by slug; no IDs are invented.
INSERT INTO legal_policy_translations (policy_id, language_code, title, points)
SELECT p.id, v.language_code, v.title, v.points::jsonb
FROM legal_policies p
JOIN (
  VALUES
    ('platform_terms','hi','प्लेटफ़ॉर्म नियम और शर्तें','[{"title":"BSeva के बारे में","body":"BSeva ग्राहकों को धार्मिक और संस्कार सेवाओं के लिए पुजारियों से जोड़ता है। प्लेटफ़ॉर्म का उपयोग इन शर्तों के अधीन है।"},{"title":"खाते और स्वीकार्य उपयोग","body":"सही जानकारी दें, अपने लॉगिन को सुरक्षित रखें और प्लेटफ़ॉर्म, उपयोगकर्ताओं या डेटा का दुरुपयोग न करें। उल्लंघन पर खाता निलंबित हो सकता है।"},{"title":"पुजारी सत्यापन और बदलाव","body":"बुकिंग पाने से पहले पुजारी सत्यापन आवश्यक है। BSeva शर्तें बदल सकता है और नई संस्करण तिथि प्रकाशित करेगा।"}]'),
    ('platform_terms','te','ప్లాట్‌ఫారమ్ నిబంధనలు మరియు షరతులు','[{"title":"BSeva గురించి","body":"BSeva మతపరమైన మరియు ఆచార సేవల కోసం కస్టమర్లను పూజారులతో కలుపుతుంది. ప్లాట్‌ఫారమ్ వినియోగం ఈ నిబంధనలకు లోబడి ఉంటుంది."},{"title":"ఖాతాలు మరియు ఆమోదయోగ్య వినియోగం","body":"సరైన సమాచారం ఇవ్వండి, లాగిన్‌ను భద్రంగా ఉంచండి, ప్లాట్‌ఫారమ్ లేదా డేటాను దుర్వినియోగం చేయవద్దు. ఉల్లంఘనకు ఖాతా నిలిపివేయవచ్చు."},{"title":"పూజారి ధృవీకరణ మరియు మార్పులు","body":"బుకింగ్‌లకు ముందు పూజారి ధృవీకరణ అవసరం. BSeva నిబంధనలను మార్చి కొత్త వెర్షన్ తేదీని ప్రచురించవచ్చు."}]'),
    ('platform_terms','mr','प्लॅटफॉर्म अटी व शर्ती','[{"title":"BSeva विषयी","body":"BSeva धार्मिक व संस्कार सेवांसाठी ग्राहकांना पुजाऱ्यांशी जोडते. प्लॅटफॉर्मचा वापर या अटींनुसार होतो."},{"title":"खाती आणि योग्य वापर","body":"अचूक माहिती द्या, लॉगिन सुरक्षित ठेवा आणि प्लॅटफॉर्म, वापरकर्ते किंवा डेटाचा गैरवापर करू नका. उल्लंघन झाल्यास खाते निलंबित होऊ शकते."},{"title":"पुजारी पडताळणी आणि बदल","body":"बुकिंग मिळण्यापूर्वी पुजारी पडताळणी आवश्यक आहे. BSeva अटी बदलून नवीन आवृत्ती दिनांक प्रसिद्ध करू शकते."}]'),
    ('platform_terms','ta','தள விதிமுறைகள் மற்றும் நிபந்தனைகள்','[{"title":"BSeva பற்றி","body":"மத மற்றும் சடங்கு சேவைகளுக்காக வாடிக்கையாளர்களை பூசாரிகளுடன் BSeva இணைக்கிறது. தளப் பயன்பாடு இவ்விதிமுறைகளுக்கு உட்பட்டது."},{"title":"கணக்குகள் மற்றும் ஏற்றுக்கொள்ளத்தக்க பயன்பாடு","body":"சரியான தகவலை வழங்கி உள்நுழைவைப் பாதுகாக்கவும்; தளம், பயனர்கள் அல்லது தரவைத் தவறாகப் பயன்படுத்த வேண்டாம். மீறினால் கணக்கு இடைநிறுத்தப்படலாம்."},{"title":"பூசாரி சரிபார்ப்பு மற்றும் மாற்றங்கள்","body":"முன்பதிவுக்கு முன் பூசாரி சரிபார்ப்பு அவசியம். BSeva விதிகளை மாற்றி புதிய பதிப்பு தேதியை வெளியிடலாம்."}]'),
    ('platform_terms','kn','ವೇದಿಕೆ ನಿಯಮಗಳು ಮತ್ತು ಷರತ್ತುಗಳು','[{"title":"BSeva ಕುರಿತು","body":"ಧಾರ್ಮಿಕ ಮತ್ತು ಸಂಸ್ಕಾರ ಸೇವೆಗಳಿಗಾಗಿ BSeva ಗ್ರಾಹಕರನ್ನು ಪೂಜಾರಿಗಳೊಂದಿಗೆ ಸಂಪರ್ಕಿಸುತ್ತದೆ. ವೇದಿಕೆಯ ಬಳಕೆ ಈ ಷರತ್ತುಗಳಿಗೆ ಒಳಪಟ್ಟಿದೆ."},{"title":"ಖಾತೆಗಳು ಮತ್ತು ಸಮ್ಮತ ಬಳಕೆ","body":"ಸರಿಯಾದ ಮಾಹಿತಿ ನೀಡಿ, ಲಾಗಿನ್ ಸುರಕ್ಷಿತವಾಗಿರಿಸಿ ಮತ್ತು ವೇದಿಕೆ, ಬಳಕೆದಾರರು ಅಥವಾ ಡೇಟಾವನ್ನು ದುರುಪಯೋಗಪಡಿಸಬೇಡಿ. ಉಲ್ಲಂಘನೆಗೆ ಖಾತೆ ಅಮಾನತಾಗಬಹುದು."},{"title":"ಪೂಜಾರಿ ಪರಿಶೀಲನೆ ಮತ್ತು ಬದಲಾವಣೆಗಳು","body":"ಬುಕಿಂಗ್‌ಗೂ ಮೊದಲು ಪೂಜಾರಿ ಪರಿಶೀಲನೆ ಅಗತ್ಯ. BSeva ಷರತ್ತುಗಳನ್ನು ಬದಲಿಸಿ ಹೊಸ ಆವೃತ್ತಿ ದಿನಾಂಕ ಪ್ರಕಟಿಸಬಹುದು."}]'),
    ('booking_terms','hi','बुकिंग नियम और शर्तें','[{"title":"बुकिंग की पुष्टि","body":"बुकिंग की पुष्टि से आप चुनी हुई सेवा, पुजारी, तारीख, समय, पैकेज और माध्यम स्वीकार करते हैं।"},{"title":"उपलब्धता और पात्रता","body":"बुकिंग उपलब्धता, पुजारी सत्यापन और सेवा-स्तर पात्रता पर निर्भर है।"},{"title":"मूल्य","body":"चेकआउट राशि में GST, सेवा शुल्क और पीक-दिवस शुल्क हो सकते हैं; दिखाई गई राशि वॉलेट से ली जाती है।"},{"title":"डेमो सूचना","body":"यह एक प्रदर्शन एप्लिकेशन है; भुगतान, OTP, मानचित्र, वॉलेट और दस्तावेज़ समीक्षा नकली हो सकते हैं।"}]'),
    ('booking_terms','te','బుకింగ్ నిబంధనలు మరియు షరతులు','[{"title":"బుకింగ్ నిర్ధారణ","body":"బుకింగ్‌ను నిర్ధారించడం ద్వారా ఎంచుకున్న సేవ, పూజారి, తేదీ, సమయం, ప్యాకేజీ మరియు విధానాన్ని అంగీకరిస్తారు."},{"title":"లభ్యత మరియు అర్హత","body":"బుకింగ్ లభ్యత, పూజారి ధృవీకరణ మరియు సేవా స్థాయి అర్హతపై ఆధారపడి ఉంటుంది."},{"title":"ధర","body":"చెకౌట్ మొత్తంలో GST, సేవా మరియు పీక్-డే రుసుములు ఉండవచ్చు; చూపిన మొత్తం వాలెట్ నుంచి వసూలవుతుంది."},{"title":"డెమో గమనిక","body":"ఇది ప్రదర్శన యాప్; చెల్లింపులు, OTP, మ్యాప్స్, వాలెట్లు మరియు పత్రాల సమీక్ష అనుకరణ కావచ్చు."}]'),
    ('booking_terms','mr','बुकिंग अटी व शर्ती','[{"title":"बुकिंग पुष्टी","body":"बुकिंग निश्चित केल्याने निवडलेली सेवा, पुजारी, तारीख, वेळ, पॅकेज आणि माध्यम तुम्ही स्वीकारता."},{"title":"उपलब्धता आणि पात्रता","body":"बुकिंग उपलब्धता, पुजारी पडताळणी आणि सेवा-स्तर पात्रतेवर अवलंबून आहे."},{"title":"किंमत","body":"चेकआउट रकमेत GST, सेवा व पीक-दिवस शुल्क असू शकते; दर्शवलेली रक्कम वॉलेटमधून घेतली जाते."},{"title":"डेमो सूचना","body":"हे प्रात्यक्षिक अॅप आहे; पेमेंट, OTP, नकाशे, वॉलेट आणि कागदपत्र तपासणी अनुकरणात्मक असू शकते."}]'),
    ('booking_terms','ta','முன்பதிவு விதிமுறைகள் மற்றும் நிபந்தனைகள்','[{"title":"முன்பதிவு உறுதி","body":"முன்பதிவை உறுதிப்படுத்துவதன் மூலம் தேர்ந்த சேவை, பூசாரி, தேதி, நேரம், தொகுப்பு மற்றும் முறையை ஏற்கிறீர்கள்."},{"title":"கிடைப்பும் தகுதியும்","body":"முன்பதிவு கிடைப்பு, பூசாரி சரிபார்ப்பு மற்றும் சேவை நிலைத் தகுதிக்கு உட்பட்டது."},{"title":"விலை","body":"செலுத்தும் தொகையில் GST, சேவை மற்றும் உச்சநாள் கட்டணங்கள் இருக்கலாம்; காட்டப்பட்ட தொகை பணப்பையிலிருந்து வசூலிக்கப்படும்."},{"title":"செயல்விளக்க அறிவிப்பு","body":"இது செயல்விளக்கப் பயன்பாடு; பணம், OTP, வரைபடம், பணப்பை மற்றும் ஆவண ஆய்வு மாதிரியாக இருக்கலாம்."}]'),
    ('booking_terms','kn','ಬುಕಿಂಗ್ ನಿಯಮಗಳು ಮತ್ತು ಷರತ್ತುಗಳು','[{"title":"ಬುಕಿಂಗ್ ದೃಢೀಕರಣ","body":"ಬುಕಿಂಗ್ ದೃಢಪಡಿಸುವ ಮೂಲಕ ಆಯ್ದ ಸೇವೆ, ಪೂಜಾರಿ, ದಿನಾಂಕ, ಸಮಯ, ಪ್ಯಾಕೇಜ್ ಮತ್ತು ವಿಧಾನವನ್ನು ಒಪ್ಪುತ್ತೀರಿ."},{"title":"ಲಭ್ಯತೆ ಮತ್ತು ಅರ್ಹತೆ","body":"ಬುಕಿಂಗ್ ಲಭ್ಯತೆ, ಪೂಜಾರಿ ಪರಿಶೀಲನೆ ಮತ್ತು ಸೇವಾ-ಮಟ್ಟದ ಅರ್ಹತೆಗೆ ಒಳಪಟ್ಟಿದೆ."},{"title":"ಬೆಲೆ","body":"ಚೆಕ್‌ಔಟ್ ಮೊತ್ತದಲ್ಲಿ GST, ಸೇವಾ ಮತ್ತು ಪೀಕ್-ಡೇ ಶುಲ್ಕ ಇರಬಹುದು; ತೋರಿಸಿದ ಮೊತ್ತವನ್ನು ವಾಲೆಟ್‌ನಿಂದ ಪಡೆಯಲಾಗುತ್ತದೆ."},{"title":"ಡೆಮೊ ಸೂಚನೆ","body":"ಇದು ಪ್ರದರ್ಶನ ಆಪ್; ಪಾವತಿ, OTP, ನಕ್ಷೆ, ವಾಲೆಟ್ ಮತ್ತು ದಾಖಲೆ ಪರಿಶೀಲನೆ ಅನುಕರಣೆಯಾಗಿರಬಹುದು."}]'),
    ('cancellation_policy','hi','रद्दीकरण नीति','[{"title":"बुकिंग से 48 घंटे से अधिक पहले","body":"10% रद्दीकरण शुल्क और ग्राहक वॉलेट में 90% वापसी।"},{"title":"बुकिंग से 24 से 48 घंटे पहले","body":"50% रद्दीकरण शुल्क और ग्राहक वॉलेट में 50% वापसी।"},{"title":"बुकिंग से 24 घंटे से कम पहले","body":"100% रद्दीकरण शुल्क, कोई वापसी नहीं। इस अवधि में पुजारी रद्द करे तो पूजा लागत उनके वॉलेट से कटेगी और ग्राहक को पूरी वापसी मिलेगी।"},{"title":"समय की गणना","body":"रद्दीकरण समय वर्तमान समय और निर्धारित बुकिंग तारीख व समय के अंतर से तय होता है।"}]'),
    ('cancellation_policy','te','రద్దు విధానం','[{"title":"బుకింగ్‌కు 48 గంటల కంటే ముందు","body":"10% రద్దు రుసుము; కస్టమర్ వాలెట్‌కు 90% వాపసు."},{"title":"బుకింగ్‌కు 24 నుంచి 48 గంటల ముందు","body":"50% రద్దు రుసుము; కస్టమర్ వాలెట్‌కు 50% వాపసు."},{"title":"బుకింగ్‌కు 24 గంటల లోపు","body":"100% రద్దు రుసుము, వాపసు లేదు. ఈ సమయంలో పూజారి రద్దు చేస్తే పూజ ఖర్చు వారి వాలెట్ నుంచి తీసి కస్టమర్‌కు పూర్తిగా వాపసు చేస్తారు."},{"title":"సమయ గణన","body":"ప్రస్తుత సమయం మరియు నిర్ణీత బుకింగ్ తేదీ, సమయం మధ్య తేడాతో రద్దు సమయం లెక్కిస్తారు."}]'),
    ('cancellation_policy','mr','रद्द करण्याचे धोरण','[{"title":"बुकिंगपूर्वी 48 तासांपेक्षा अधिक","body":"10% रद्द शुल्क आणि ग्राहक वॉलेटमध्ये 90% परतावा."},{"title":"बुकिंगपूर्वी 24 ते 48 तास","body":"50% रद्द शुल्क आणि ग्राहक वॉलेटमध्ये 50% परतावा."},{"title":"बुकिंगपूर्वी 24 तासांपेक्षा कमी","body":"100% रद्द शुल्क, परतावा नाही. या काळात पुजारी रद्द केल्यास पूजा खर्च त्यांच्या वॉलेटमधून वजा होऊन ग्राहकाला पूर्ण परतावा मिळेल."},{"title":"वेळेची गणना","body":"सध्याची वेळ आणि नियोजित बुकिंग तारीख व वेळ यांतील फरकावर रद्द वेळ ठरते."}]'),
    ('cancellation_policy','ta','ரத்துக் கொள்கை','[{"title":"முன்பதிவுக்கு 48 மணி நேரத்திற்கு முன்","body":"10% ரத்துக் கட்டணம்; வாடிக்கையாளர் பணப்பைக்கு 90% திருப்பம்."},{"title":"முன்பதிவுக்கு 24 முதல் 48 மணி நேரத்திற்கு முன்","body":"50% ரத்துக் கட்டணம்; வாடிக்கையாளர் பணப்பைக்கு 50% திருப்பம்."},{"title":"முன்பதிவுக்கு 24 மணி நேரத்திற்குள்","body":"100% ரத்துக் கட்டணம்; திருப்பம் இல்லை. இக்காலத்தில் பூசாரி ரத்து செய்தால் பூஜைச் செலவு அவரது பணப்பையிலிருந்து பிடிக்கப்பட்டு வாடிக்கையாளருக்கு முழுத் திருப்பம் வழங்கப்படும்."},{"title":"நேரக் கணக்கீடு","body":"தற்போதைய நேரத்திற்கும் திட்டமிட்ட முன்பதிவு தேதி மற்றும் நேரத்திற்கும் உள்ள வேறுபாட்டால் ரத்து நேரம் கணக்கிடப்படுகிறது."}]'),
    ('cancellation_policy','kn','ರದ್ದತಿ ನೀತಿ','[{"title":"ಬುಕಿಂಗ್‌ಗೆ 48 ಗಂಟೆಗಳಿಗಿಂತ ಮೊದಲು","body":"10% ರದ್ದತಿ ಶುಲ್ಕ; ಗ್ರಾಹಕರ ವಾಲೆಟ್‌ಗೆ 90% ಮರುಪಾವತಿ."},{"title":"ಬುಕಿಂಗ್‌ಗೆ 24 ರಿಂದ 48 ಗಂಟೆಗಳ ಮೊದಲು","body":"50% ರದ್ದತಿ ಶುಲ್ಕ; ಗ್ರಾಹಕರ ವಾಲೆಟ್‌ಗೆ 50% ಮರುಪಾವತಿ."},{"title":"ಬುಕಿಂಗ್‌ಗೆ 24 ಗಂಟೆಗಳೊಳಗೆ","body":"100% ರದ್ದತಿ ಶುಲ್ಕ, ಮರುಪಾವತಿ ಇಲ್ಲ. ಈ ಅವಧಿಯಲ್ಲಿ ಪೂಜಾರಿ ರದ್ದುಗೊಳಿಸಿದರೆ ಪೂಜೆಯ ವೆಚ್ಚ ಅವರ ವಾಲೆಟ್‌ನಿಂದ ಕಡಿತವಾಗಿ ಗ್ರಾಹಕರಿಗೆ ಪೂರ್ಣ ಮರುಪಾವತಿ ಸಿಗುತ್ತದೆ."},{"title":"ಸಮಯದ ಲೆಕ್ಕ","body":"ಪ್ರಸ್ತುತ ಸಮಯ ಮತ್ತು ನಿಗದಿತ ಬುಕಿಂಗ್ ದಿನಾಂಕ ಹಾಗೂ ಸಮಯದ ವ್ಯತ್ಯಾಸದಿಂದ ರದ್ದತಿ ಸಮಯ ಲೆಕ್ಕಿಸಲಾಗುತ್ತದೆ."}]'),
    ('privacy','hi','गोपनीयता नीति','[{"title":"हम कौन-सी जानकारी लेते हैं","body":"खाता, संपर्क, प्रोफ़ाइल, पता, स्थान, बुकिंग इतिहास, पुजारी दस्तावेज़ और सेवा चलाने के लिए तकनीकी उपयोग डेटा लिया जाता है।"},{"title":"उपयोग और साझाकरण","body":"डेटा खाते, बुकिंग, मिलान, सत्यापन, सहायता और सुधार के लिए उपयोग होता है। आवश्यक जानकारी ग्राहक और नियुक्त पुजारी के बीच साझा होती है; निजी जानकारी बेची नहीं जाती।"},{"title":"सुरक्षा और आपके विकल्प","body":"डेटा अभिगम नियंत्रण के साथ सुरक्षित प्रणालियों में रखा जाता है। आप प्रोफ़ाइल बदल सकते हैं और सहायता मांग सकते हैं। नीति समय-समय पर बदल सकती है।"}]'),
    ('privacy','te','గోప్యతా విధానం','[{"title":"మేము సేకరించే సమాచారం","body":"ఖాతా, సంప్రదింపు, ప్రొఫైల్, చిరునామా, స్థానం, బుకింగ్ చరిత్ర, పూజారి పత్రాలు మరియు సేవకు అవసరమైన సాంకేతిక వినియోగ డేటాను సేకరిస్తాము."},{"title":"వినియోగం మరియు పంచుకోవడం","body":"ఖాతాలు, బుకింగ్‌లు, జతచేయడం, ధృవీకరణ, సహాయం మరియు మెరుగుదలకు డేటా ఉపయోగిస్తాము. అవసరమైన వివరాలు కస్టమర్ మరియు నియమిత పూజారి మధ్య పంచుతాము; వ్యక్తిగత సమాచారాన్ని అమ్మము."},{"title":"భద్రత మరియు మీ ఎంపికలు","body":"డేటా యాక్సెస్ నియంత్రణలతో భద్రమైన వ్యవస్థల్లో ఉంటుంది. మీరు ప్రొఫైల్ మార్చి సహాయం కోరవచ్చు. విధానం కాలానుగుణంగా మారవచ్చు."}]'),
    ('privacy','mr','गोपनीयता धोरण','[{"title":"आम्ही गोळा करणारी माहिती","body":"खाते, संपर्क, प्रोफाइल, पत्ता, स्थान, बुकिंग इतिहास, पुजारी कागदपत्रे आणि सेवा चालवण्यासाठी आवश्यक तांत्रिक वापर डेटा गोळा केला जातो."},{"title":"वापर आणि सामायिकरण","body":"डेटा खाती, बुकिंग, जुळणी, पडताळणी, सहाय्य आणि सुधारण्यासाठी वापरला जातो. आवश्यक तपशील ग्राहक व नियुक्त पुजारी यांच्यात दिले जातात; वैयक्तिक माहिती विकली जात नाही."},{"title":"सुरक्षा आणि तुमचे पर्याय","body":"डेटा प्रवेश नियंत्रणासह सुरक्षित प्रणालीत ठेवला जातो. तुम्ही प्रोफाइल बदलू व सहाय्य मागू शकता. धोरण वेळोवेळी बदलू शकते."}]'),
    ('privacy','ta','தனியுரிமைக் கொள்கை','[{"title":"நாங்கள் சேகரிக்கும் தகவல்","body":"கணக்கு, தொடர்பு, சுயவிவரம், முகவரி, இடம், முன்பதிவு வரலாறு, பூசாரி ஆவணங்கள் மற்றும் சேவைக்குத் தேவையான தொழில்நுட்பப் பயன்பாட்டுத் தரவு சேகரிக்கப்படுகிறது."},{"title":"பயன்பாடும் பகிர்வும்","body":"கணக்கு, முன்பதிவு, பொருத்தம், சரிபார்ப்பு, ஆதரவு மற்றும் மேம்பாட்டுக்கு தரவு பயன்படும். தேவையான விவரங்கள் வாடிக்கையாளர் மற்றும் நியமிக்கப்பட்ட பூசாரியிடையே பகிரப்படும்; தனிப்பட்ட தகவல் விற்கப்படாது."},{"title":"பாதுகாப்பும் உங்கள் தேர்வுகளும்","body":"அணுகல் கட்டுப்பாடுள்ள பாதுகாப்பான அமைப்புகளில் தரவு வைக்கப்படுகிறது. சுயவிவரத்தை மாற்றி உதவி கோரலாம். கொள்கை அவ்வப்போது மாறலாம்."}]'),
    ('privacy','kn','ಗೌಪ್ಯತಾ ನೀತಿ','[{"title":"ನಾವು ಸಂಗ್ರಹಿಸುವ ಮಾಹಿತಿ","body":"ಖಾತೆ, ಸಂಪರ್ಕ, ಪ್ರೊಫೈಲ್, ವಿಳಾಸ, ಸ್ಥಳ, ಬುಕಿಂಗ್ ಇತಿಹಾಸ, ಪೂಜಾರಿ ದಾಖಲೆಗಳು ಮತ್ತು ಸೇವೆಗೆ ಅಗತ್ಯ ತಾಂತ್ರಿಕ ಬಳಕೆ ಡೇಟಾವನ್ನು ಸಂಗ್ರಹಿಸಲಾಗುತ್ತದೆ."},{"title":"ಬಳಕೆ ಮತ್ತು ಹಂಚಿಕೆ","body":"ಖಾತೆ, ಬುಕಿಂಗ್, ಹೊಂದಾಣಿಕೆ, ಪರಿಶೀಲನೆ, ನೆರವು ಮತ್ತು ಸುಧಾರಣೆಗೆ ಡೇಟಾ ಬಳಸಲಾಗುತ್ತದೆ. ಅಗತ್ಯ ವಿವರಗಳನ್ನು ಗ್ರಾಹಕ ಮತ್ತು ನಿಯೋಜಿತ ಪೂಜಾರಿ ನಡುವೆ ಹಂಚಲಾಗುತ್ತದೆ; ವೈಯಕ್ತಿಕ ಮಾಹಿತಿಯನ್ನು ಮಾರುವುದಿಲ್ಲ."},{"title":"ಭದ್ರತೆ ಮತ್ತು ನಿಮ್ಮ ಆಯ್ಕೆಗಳು","body":"ಪ್ರವೇಶ ನಿಯಂತ್ರಣದ ಸುರಕ್ಷಿತ ವ್ಯವಸ್ಥೆಗಳಲ್ಲಿ ಡೇಟಾ ಇಡಲಾಗುತ್ತದೆ. ಪ್ರೊಫೈಲ್ ಬದಲಿಸಿ ನೆರವು ಕೇಳಬಹುದು. ನೀತಿ ಕಾಲಕಾಲಕ್ಕೆ ಬದಲಾಗಬಹುದು."}]'),
    ('pujari_booking_terms','hi','पुजारी बुकिंग स्वीकृति शर्तें','[{"title":"प्रत्यक्ष लेन-देन निषिद्ध","body":"पुजारी BSeva द्वारा परिचित ग्राहक को छह महीने तक BSeva को दरकिनार कर सीधे सेवा देने पर सहमत नहीं होंगे; यह अंतिम कानूनी अनुमोदन के अधीन है।"},{"title":"प्लेटफ़ॉर्म नियम","body":"बुकिंग स्वीकार करके पुजारी समय, सेवा विवरण और BSeva के संचालन नियमों का पालन स्वीकार करते हैं।"}]'),
    ('pujari_booking_terms','te','పూజారి బుకింగ్ అంగీకార నిబంధనలు','[{"title":"ప్రత్యక్ష లావాదేవీ నిషేధం","body":"BSeva పరిచయం చేసిన కస్టమర్‌కు ఆరు నెలల పాటు BSevaను దాటవేసి నేరుగా సేవ చేయకూడదని పూజారి అంగీకరిస్తారు; ఇది తుది న్యాయ అనుమతికి లోబడి ఉంటుంది."},{"title":"ప్లాట్‌ఫారమ్ నియమాలు","body":"బుకింగ్ అంగీకరించడం ద్వారా సమయం, సేవా వివరాలు మరియు BSeva నిర్వహణ నియమాలను పాటించేందుకు పూజారి అంగీకరిస్తారు."}]'),
    ('pujari_booking_terms','mr','पुजारी बुकिंग स्वीकृती अटी','[{"title":"थेट व्यवहारास मनाई","body":"BSeva ने परिचित केलेल्या ग्राहकाला सहा महिने BSeva टाळून थेट सेवा न देण्यास पुजारी सहमत आहेत; हे अंतिम कायदेशीर मंजुरीच्या अधीन आहे."},{"title":"प्लॅटफॉर्म नियम","body":"बुकिंग स्वीकारून पुजारी वेळ, सेवा तपशील आणि BSeva चे संचालन नियम पाळण्यास सहमत होतात."}]'),
    ('pujari_booking_terms','ta','பூசாரி முன்பதிவு ஏற்பு விதிமுறைகள்','[{"title":"நேரடி பரிவர்த்தனைத் தடை","body":"BSeva அறிமுகப்படுத்திய வாடிக்கையாளருக்கு ஆறு மாதங்கள் BSevaவைத் தவிர்த்து நேரடியாக சேவை செய்யமாட்டேன் என பூசாரி ஒப்புக்கொள்கிறார்; இது இறுதி சட்ட ஒப்புதலுக்கு உட்பட்டது."},{"title":"தள விதிகள்","body":"முன்பதிவை ஏற்பதன் மூலம் நேரம், சேவை விவரங்கள் மற்றும் BSeva செயல்பாட்டு விதிகளைப் பின்பற்ற பூசாரி ஒப்புக்கொள்கிறார்."}]'),
    ('pujari_booking_terms','kn','ಪೂಜಾರಿ ಬುಕಿಂಗ್ ಸ್ವೀಕಾರ ಷರತ್ತುಗಳು','[{"title":"ನೇರ ವ್ಯವಹಾರ ನಿಷೇಧ","body":"BSeva ಪರಿಚಯಿಸಿದ ಗ್ರಾಹಕರಿಗೆ ಆರು ತಿಂಗಳು BSeva ಬಿಟ್ಟು ನೇರವಾಗಿ ಸೇವೆ ನೀಡುವುದಿಲ್ಲ ಎಂದು ಪೂಜಾರಿ ಒಪ್ಪುತ್ತಾರೆ; ಇದು ಅಂತಿಮ ಕಾನೂನು ಅನುಮೋದನೆಗೆ ಒಳಪಟ್ಟಿದೆ."},{"title":"ವೇದಿಕೆ ನಿಯಮಗಳು","body":"ಬುಕಿಂಗ್ ಸ್ವೀಕರಿಸುವ ಮೂಲಕ ಸಮಯ, ಸೇವಾ ವಿವರಗಳು ಮತ್ತು BSeva ಕಾರ್ಯಾಚರಣೆ ನಿಯಮಗಳನ್ನು ಪಾಲಿಸಲು ಪೂಜಾರಿ ಒಪ್ಪುತ್ತಾರೆ."}]')
) AS v(slug, language_code, title, points)
  ON v.slug = p.slug
ON CONFLICT (policy_id, language_code) DO UPDATE SET
  title = EXCLUDED.title, points = EXCLUDED.points, updated_at = NOW();

-- Existing frozen snapshots can be safely overlaid from stored translations.
UPDATE booking_preparation_snapshot bps
SET service_name = COALESCE(
      (SELECT NULLIF(spc.display_name, '') FROM service_preparation_content spc
       WHERE spc.service_id = b.service_id AND spc.language_code = bps.language_code),
      (SELECT NULLIF(st.name, '') FROM service_translations st
       WHERE st.service_id = b.service_id AND st.language_code = bps.language_code),
      bps.service_name
    ),
    preparation_notes = COALESCE(
      (SELECT spc.preparation_notes FROM service_preparation_content spc
       WHERE spc.service_id = b.service_id AND spc.language_code = bps.language_code),
      bps.preparation_notes
    ),
    special_instructions = COALESCE(
      (SELECT spc.special_instructions FROM service_preparation_content spc
       WHERE spc.service_id = b.service_id AND spc.language_code = bps.language_code),
      bps.special_instructions
    ),
    prasadam_notes = COALESCE(
      (SELECT spc.prasadam_notes FROM service_preparation_content spc
       WHERE spc.service_id = b.service_id AND spc.language_code = bps.language_code),
      bps.prasadam_notes
    ),
    venue_notes = COALESCE(
      (SELECT spc.venue_notes FROM service_preparation_content spc
       WHERE spc.service_id = b.service_id AND spc.language_code = bps.language_code),
      bps.venue_notes
    ),
    disclaimer = COALESCE(
      (SELECT spc.disclaimer FROM service_preparation_content spc
       WHERE spc.service_id = b.service_id AND spc.language_code = bps.language_code),
      bps.disclaimer
    )
FROM bookings b
WHERE b.id = bps.booking_id;

UPDATE booking_samagri_snapshot bss
SET name = sit.item_name,
    instructions = COALESCE(sit.notes, bss.instructions)
FROM bookings b
JOIN service_samagri ss ON ss.service_id = b.service_id
JOIN samagri_items si
  ON si.id = ss.samagri_item_id
JOIN samagri_item_translations sit
  ON sit.samagri_item_id = si.id
WHERE b.id = bss.booking_id
  AND si.item_key = bss.item_key
  AND sit.language_code = bss.language_code;

-- Force the read path to reconstruct old localized payloads from the newly
-- overlaid header/item rows; new bookings continue to store a complete payload.
UPDATE booking_preparation_snapshot
SET payload = '{}'::jsonb
WHERE language_code <> 'en';
