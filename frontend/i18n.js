// English / Hindi switch for the customer app.
//
// The app renders English. When Hindi is on, this translates the rendered page in place:
// every text node and the placeholder / aria-label / title attributes, including anything
// the app renders later (watched with a MutationObserver). Originals are remembered, so
// switching back to English restores them exactly. Station names, vehicle names, numbers,
// IDs and units are left as they are.
(function () {
  "use strict";

  const HI = {
    // Navigation and shell
    "Skip to content": "मुख्य सामग्री पर जाएँ",
    "Home": "होम", "Stations": "स्टेशन", "Sessions": "सेशन", "My garage": "मेरा गैराज", "Garage": "गैराज",
    "New Delhi": "नई दिल्ली", "PREVIEW": "प्रीव्यू", "Retry": "फिर से कोशिश करें",
    "Charging server unavailable. Start the backend or retry.": "चार्जिंग सर्वर उपलब्ध नहीं है। थोड़ी देर बाद फिर कोशिश करें।",
    "Connecting to the local charging server…": "चार्जिंग सर्वर से जुड़ रहे हैं…",
    "Connect to the charging server before continuing.": "आगे बढ़ने से पहले चार्जिंग सर्वर से जुड़ें।",
    "Main navigation": "मुख्य नेविगेशन", "Pluggo home": "Pluggo होम",

    // Home
    "Pick your vehicle": "अपना वाहन चुनें", "Vehicles": "वाहन",
    "Electric car": "इलेक्ट्रिक कार", "Electric scooter": "इलेक्ट्रिक स्कूटर", "Electric bike": "इलेक्ट्रिक बाइक",
    "Delivery three-wheeler": "डिलीवरी थ्री-व्हीलर",
    "Battery": "बैटरी", "BATTERY": "बैटरी", "Battery level": "बैटरी स्तर", "Charging power": "चार्जिंग पावर",
    "Charging now": "चार्ज हो रहा है",
    "Nearest station": "सबसे नज़दीकी स्टेशन", "Nearest available station": "सबसे नज़दीकी उपलब्ध स्टेशन",
    "View map ↗": "मैप देखें ↗", "Open nearby station map": "नज़दीकी स्टेशनों का मैप खोलें",
    "Your selected vehicle": "आपका चुना हुआ वाहन", "Selected vehicle information": "चुने गए वाहन की जानकारी",
    "Swipe to choose a vehicle": "वाहन चुनने के लिए स्वाइप करें", "Select your vehicle": "अपना वाहन चुनें",
    "Car": "कार", "Scooter": "स्कूटर", "Bike": "बाइक", "Cargo": "कार्गो",
    "Find a charger": "चार्जर खोजें",

    // Stations
    "Charging stations": "चार्जिंग स्टेशन", "Back to Home": "होम पर वापस",
    "Search a station or area": "स्टेशन या इलाका खोजें", "Search a station or locality": "स्टेशन या इलाका खोजें",
    "Use my location": "मेरी लोकेशन इस्तेमाल करें", "Station source": "स्टेशन स्रोत",
    "Pluggo": "Pluggo", "All chargers": "सभी चार्जर", "Available now": "अभी उपलब्ध",
    "Search here": "यहाँ खोजें", "Search nearby": "आस-पास खोजें", "Searching…": "खोज रहे हैं…",
    "Search every charger with Google Places": "Google Places से हर चार्जर खोजें",
    "Available": "उपलब्ध", "In use": "उपयोग में", "Map settings": "मैप सेटिंग्स",
    "Street tiles could not load. Station details are available below.": "मैप लोड नहीं हो सका। स्टेशन की जानकारी नीचे है।",
    "Retry map": "मैप फिर लोड करें",
    "Select a station pin. Select a numbered group to zoom in.": "स्टेशन पिन चुनें। ज़ूम करने के लिए नंबर वाला समूह चुनें।",
    "Pluggo network": "Pluggo नेटवर्क", "live availability": "लाइव उपलब्धता", "Pluggo station": "Pluggo स्टेशन",
    "Power": "पावर", "Plugs": "प्लग", "Tariff": "दर",
    "View chargers": "चार्जर देखें", "Directions ↗": "रास्ता ↗",
    "No matching stations.": "कोई मिलता-जुलता स्टेशन नहीं।",
    "Try another locality or clear your filters.": "कोई दूसरा इलाका आज़माएँ या फ़िल्टर हटाएँ।",
    "Clear filters": "फ़िल्टर हटाएँ", "Selected station": "चुना गया स्टेशन",
    "Compatible plugs in use": "संगत प्लग उपयोग में हैं",
    "Find a real charger.": "असली चार्जर खोजें।",
    "Google Places": "Google Places", "availability unknown": "उपलब्धता अज्ञात",
    "Finding your location…": "आपकी लोकेशन खोज रहे हैं…",
    "Location updated.": "लोकेशन अपडेट हो गई।",
    "Location updated. Search nearby to find chargers around you.": "लोकेशन अपडेट हो गई। अपने आस-पास के चार्जर खोजें।",
    "Location unavailable": "लोकेशन उपलब्ध नहीं", "showing Pluggo stations in New Delhi.": "नई दिल्ली के Pluggo स्टेशन दिखा रहे हैं।",
    "Location blocked or unavailable": "लोकेशन बंद है या उपलब्ध नहीं",
    "allow it in browser settings, or search a city.": "ब्राउज़र सेटिंग्स में अनुमति दें या कोई शहर खोजें।",
    "Using your device location": "आपके डिवाइस की लोकेशन इस्तेमाल हो रही है",
    "distances are straight-line.": "दूरी सीधी रेखा में है।",
    "Using your location": "आपकी लोकेशन इस्तेमाल हो रही है", "Google charger search.": "Google चार्जर खोज।",
    "Open Map settings ↗": "मैप सेटिंग्स खोलें ↗",

    // Station detail and charging flow
    "PLUGGO STATION": "PLUGGO स्टेशन", "NEW DELHI": "नई दिल्ली", "/ kWh": "/ kWh",
    "No booking or idle fees": "कोई बुकिंग या इंतज़ार शुल्क नहीं",
    "Incompatible with selected vehicle": "चुने गए वाहन के साथ संगत नहीं", "Occupied": "व्यस्त",
    "Open 24/7": "24/7 खुला", "Café": "कैफ़े", "Parking": "पार्किंग",
    "Scan or enter code": "स्कैन करें या कोड डालें", "Google Maps directions": "Google Maps रास्ता",
    "Select charger": "चार्जर चुनें", "YOUR NEXT CHARGE": "आपका अगला चार्ज",
    "Choose an available, compatible connector.": "कोई उपलब्ध और संगत कनेक्टर चुनें।",
    "SCAN / MANUAL VERIFICATION": "स्कैन / कोड से पुष्टि", "Meet your connector.": "अपना कनेक्टर पहचानें।",
    "Start camera": "कैमरा चालू करें", "CHARGER CODE": "चार्जर कोड", "Verify": "पुष्टि करें",
    "Camera frames stay on your device.": "कैमरा की तस्वीरें आपके डिवाइस पर ही रहती हैं।",
    "Unknown code for this station. Check the ID printed on the charger.": "इस स्टेशन के लिए अज्ञात कोड। चार्जर पर छपी ID जाँचें।",
    "This connector is occupied or incompatible with your vehicle.": "यह कनेक्टर व्यस्त है या आपके वाहन के साथ संगत नहीं है।",
    "QR camera scanning is unavailable in this browser. Enter the charger code below.": "इस ब्राउज़र में QR स्कैन उपलब्ध नहीं है। नीचे चार्जर कोड डालें।",
    "YOUR CHARGE, YOUR WAY": "आपका चार्ज, आपके तरीके से", "A little more ready.": "थोड़ा और तैयार।",
    "Charge target": "चार्ज लक्ष्य", "Budget cap": "बजट सीमा",
    "Stops at your target or budget, whichever comes first.": "लक्ष्य या बजट, जो पहले पूरा हो, वहीं रुक जाएगा।",
    "Energy to add": "जोड़ी जाने वाली ऊर्जा", "Estimated time": "अनुमानित समय", "Estimated bill": "अनुमानित बिल",
    "Start charging": "चार्जिंग शुरू करें", "LIVE SESSION": "लाइव सेशन",
    "Energy added": "जोड़ी गई ऊर्जा", "Charging time": "चार्जिंग समय", "Cost": "लागत",
    "min": "मिनट", "Less than 1 min": "1 मिनट से कम",
    "Charging continues if you leave this page.": "यह पेज छोड़ने पर भी चार्जिंग चलती रहेगी।",
    "Stop charging": "चार्जिंग रोकें", "CHARGE COMPLETE": "चार्ज पूरा", "Stopped by you": "आपने रोका",
    "Continue to payment": "भुगतान पर जाएँ", "There is already a session to finish.": "एक सेशन पहले से पूरा करना बाकी है।",
    "Your charge is complete. Continue to payment.": "आपका चार्ज पूरा हुआ। भुगतान पर जाएँ।",
    "CHECKOUT": "चेकआउट", "All charged.": "चार्ज पूरा।", "Energy delivered": "दी गई ऊर्जा", "Rate": "दर",
    "Amount due": "देय राशि", "Complete checkout": "चेकआउट पूरा करें",
    "Secure payment by Razorpay": "Razorpay से सुरक्षित भुगतान", "UPI, cards and netbanking.": "UPI, कार्ड और नेटबैंकिंग।",
    "Charges under ₹1 are on us.": "₹1 से कम का चार्ज हमारी तरफ़ से।",
    "Payment cancelled.": "भुगतान रद्द हुआ।", "Payment failed. No money was taken.": "भुगतान विफल रहा। कोई पैसा नहीं कटा।",
    "Could not load the payment window. Check your connection.": "भुगतान विंडो नहीं खुल सकी। अपना कनेक्शन जाँचें।",
    "RECEIPT": "रसीद", "Checkout complete": "चेकआउट पूरा", "Checkout complete.": "चेकआउट पूरा।",
    "Payment received": "भुगतान मिल गया", "AMOUNT PAID": "भुगतान की गई राशि", "Amount paid": "भुगतान की गई राशि",
    "No payment was needed for this charge.": "इस चार्ज के लिए भुगतान की ज़रूरत नहीं थी।",
    "Paid via Razorpay": "Razorpay से भुगतान", "Total": "कुल",
    "Session details": "सेशन विवरण", "Charging power used": "इस्तेमाल हुई चार्जिंग पावर", "Completed": "पूरा हुआ",
    "Pluggo charging receipt": "Pluggo चार्जिंग रसीद", "Back to sessions": "सेशन पर वापस",
    "Close dialog": "बंद करें",

    // Sessions
    "Your charging overview": "आपकी चार्जिंग का सारांश", "Charging summary": "चार्जिंग सारांश", "Summary period": "अवधि",
    "Week": "सप्ताह", "Month": "महीना", "All time": "अब तक",
    "Completed charges this week": "इस सप्ताह के पूरे चार्ज", "Completed charges this month": "इस महीने के पूरे चार्ज",
    "Completed charges across all time": "अब तक के सभी पूरे चार्ज", "India time": "भारतीय समय",
    "History": "इतिहास", "Estimated spend": "अनुमानित खर्च", "Across completed charges": "पूरे हुए चार्ज में",
    "Time on charger": "चार्जर पर समय", "Completed sessions": "पूरे सेशन", "Charges finished": "पूरे हुए चार्ज",
    "No sessions yet.": "अभी कोई सेशन नहीं।", "Your charges and receipts will appear here.": "आपके चार्ज और रसीदें यहाँ दिखेंगी।",
    "Find a station": "स्टेशन खोजें", "Charging sessions": "चार्जिंग सेशन",
    "COMPLETED": "पूरा", "PAYMENT DUE": "भुगतान बाकी", "CHARGING": "चार्ज हो रहा है",
    "Charging in progress": "चार्जिंग जारी है", "Bill": "बिल",
    "View receipt": "रसीद देखें", "Pay now": "अभी भुगतान करें", "View live session": "लाइव सेशन देखें",

    // Garage and settings
    "Loading 3D…": "3D लोड हो रहा है…",
    "Settings": "सेटिंग्स", "Account": "खाता",
    "Pluggo matches chargers to the vehicle you pick here.": "आप यहाँ जो वाहन चुनते हैं, Pluggo उसी के हिसाब से चार्जर दिखाता है।",
    "Your vehicle": "आपका वाहन", "Appearance": "रूप-रंग", "Style": "स्टाइल",
    "How Pluggo looks on this device": "इस डिवाइस पर Pluggo कैसा दिखे", "App style": "ऐप स्टाइल",
    "Dark": "डार्क", "Light": "लाइट", "Glass": "ग्लास",
    "Language": "भाषा", "App language": "ऐप की भाषा",
    "Animate vehicle preview": "वाहन प्रीव्यू एनिमेट करें", "Slow 360° rotation on Home": "होम पर धीमा 360° घुमाव",
    "Maps": "मैप", "Real charger search": "असली चार्जर खोज", "Connect real charger search": "असली चार्जर खोज जोड़ें",
    "Connected for this tab": "इस टैब के लिए जुड़ा", "Connecting…": "जुड़ रहे हैं…",
    "Connection needs attention": "कनेक्शन पर ध्यान दें", "Loading Google Maps…": "Google Maps लोड हो रहा है…",
    "Enable Maps": "मैप चालू करें", "Use OpenStreetMap instead": "इसके बजाय OpenStreetMap इस्तेमाल करें",
    "Google Maps setup steps": "Google Maps सेटअप के चरण", "Enter your Maps API key": "अपनी Maps API key डालें",
    "Enter a valid Google Maps browser API key.": "सही Google Maps browser API key डालें।",
    "About": "जानकारी", "About Pluggo": "Pluggo के बारे में",
    "Pilot release: Pluggo network stations and chargers are simulated while we onboard partner chargers, and charging runs faster than real time. Payments use Razorpay test mode, so no real money moves.":
      "पायलट रिलीज़: पार्टनर चार्जर जुड़ने तक Pluggo नेटवर्क के स्टेशन और चार्जर सिम्युलेटेड हैं, और चार्जिंग असली समय से तेज़ चलती है। भुगतान Razorpay टेस्ट मोड में होते हैं, इसलिए कोई असली पैसा नहीं कटता।",
    "3D model credits": "3D मॉडल श्रेय", "MODEL CREDITS": "मॉडल श्रेय", "Designed by talented people.": "प्रतिभाशाली लोगों द्वारा डिज़ाइन किया गया।",
    "Clear my history": "मेरा इतिहास मिटाएँ", "All cleared.": "सब मिट गया।", "Your history has been cleared.": "आपका इतिहास मिटा दिया गया है।",
    "Smart EV charging for India": "भारत के लिए स्मार्ट EV चार्जिंग",

    // Feature pass: Home, Sessions, Garage, Settings, Stations
    "Change location": "लोकेशन बदलें", "Estimated range": "अनुमानित रेंज",
    "View live charge": "लाइव चार्ज देखें", "Pay for your charge": "अपने चार्ज का भुगतान करें",
    "Payment due": "भुगतान बाकी", "Pay": "भुगतान करें", "Open": "खोलें",
    "Energy": "ऊर्जा", "Spend": "खर्च", "Charges": "चार्ज", "Paid": "भुगतान", "Average": "औसत",
    "last 7 days": "पिछले 7 दिन", "kWh per day": "kWh प्रति दिन",
    "Your vehicles": "आपके वाहन",
    "Charging & payment": "चार्जिंग और भुगतान",
    "Default charge target": "डिफ़ॉल्ट चार्ज लक्ष्य", "Where the slider starts when you charge": "चार्ज करते समय स्लाइडर यहीं से शुरू होगा",
    "Default budget per charge": "हर चार्ज का डिफ़ॉल्ट बजट", "Charging stops when this is reached": "यह राशि पूरी होने पर चार्जिंग रुक जाएगी",
    "Monthly budget": "मासिक बजट", "The orange spend ring in Sessions": "सेशन में नारंगी खर्च रिंग",
    "Monthly energy goal": "मासिक ऊर्जा लक्ष्य", "The blue energy ring in Sessions": "सेशन में नीली ऊर्जा रिंग",
    "Monthly charges goal": "मासिक चार्ज लक्ष्य", "The green charges ring in Sessions": "सेशन में हरी चार्ज रिंग",
    "Payment methods": "भुगतान के तरीके", "UPI, cards and netbanking, secured by Razorpay": "UPI, कार्ड और नेटबैंकिंग, Razorpay से सुरक्षित",
    "Receipts": "रसीदें", "Saved to your phone number when you are signed in": "साइन इन होने पर आपके फ़ोन नंबर पर सेव",
    "Advanced": "एडवांस्ड", "Google Maps search": "Google Maps खोज", "Saved.": "सेव हो गया।",
    "Help & support": "मदद और सहायता", "Privacy": "गोपनीयता", "Terms of use": "उपयोग की शर्तें",
    "Share receipt": "रसीद शेयर करें", "Receipt copied.": "रसीद कॉपी हो गई।", "Could not share the receipt.": "रसीद शेयर नहीं हो सकी।",
    "Show or hide station details": "स्टेशन की जानकारी दिखाएँ या छिपाएँ",
    "Location is off": "लोकेशन बंद है", "showing New Delhi": "नई दिल्ली दिखा रहे हैं",
    "HELP & SUPPORT": "मदद और सहायता", "How can we help?": "हम कैसे मदद करें?",
    "Start a charge": "चार्ज शुरू करें",
    "Tap Start charging on Home, or pick a station on the map. Choose a free charger that fits your vehicle, set a target and budget, then start.": "होम पर 'चार्जिंग शुरू करें' दबाएँ या मैप पर स्टेशन चुनें। अपने वाहन के लिए खाली चार्जर चुनें, लक्ष्य और बजट तय करें, फिर शुरू करें।",
    "Stop and pay": "रोकें और भुगतान करें",
    "Stop any time from the live session. Pay with UPI, card or netbanking through Razorpay. Charges under ₹1 are free.": "लाइव सेशन से कभी भी रोकें। Razorpay से UPI, कार्ड या नेटबैंकिंग द्वारा भुगतान करें। ₹1 से कम का चार्ज मुफ़्त है।",
    "Every finished charge is in Sessions. Open a receipt to share it.": "हर पूरा चार्ज सेशन में है। शेयर करने के लिए रसीद खोलें।",
    "Sign in with your mobile number to keep your charges and receipts on every device. We text a one-time code.": "हर डिवाइस पर अपने चार्ज और रसीदें रखने के लिए मोबाइल नंबर से साइन इन करें। हम एक बार का कोड SMS करते हैं।",
    "PRIVACY": "गोपनीयता", "Your data, simply.": "आपका डेटा, सीधी बात।", "What we keep": "हम क्या रखते हैं",
    "Your charging sessions and receipts, and your mobile number if you sign in, so your history follows you across devices.": "आपके चार्जिंग सेशन और रसीदें, और साइन इन करने पर आपका मोबाइल नंबर, ताकि आपका इतिहास हर डिवाइस पर साथ रहे।",
    "Location": "लोकेशन",
    "Your location is used on your phone to sort nearby stations. If you turn on Google Maps search, your search area is sent to Google.": "आपकी लोकेशन आपके फ़ोन पर ही नज़दीकी स्टेशन क्रम से दिखाने के लिए इस्तेमाल होती है। Google Maps खोज चालू करने पर आपका खोज क्षेत्र Google को भेजा जाता है।",
    "Payments": "भुगतान",
    "Razorpay processes payments. Pluggo never sees your card or UPI details; we keep only the payment ID for your receipt.": "भुगतान Razorpay करता है। Pluggo आपके कार्ड या UPI विवरण कभी नहीं देखता; हम रसीद के लिए सिर्फ़ भुगतान ID रखते हैं।",
    "On this device": "इस डिवाइस पर",
    "Your style, language and charging preferences are saved on this phone. Clear my history removes your sessions here.": "आपकी स्टाइल, भाषा और चार्जिंग पसंद इसी फ़ोन पर सेव रहती हैं। 'मेरा इतिहास मिटाएँ' यहाँ से आपके सेशन हटा देता है।",
    "TERMS OF USE": "उपयोग की शर्तें", "The short version.": "संक्षेप में।", "Pilot release": "पायलट रिलीज़",
    "Pluggo network stations and chargers are simulated while partner chargers are onboarded, and charging runs faster than real time.": "पार्टनर चार्जर जुड़ने तक Pluggo नेटवर्क के स्टेशन और चार्जर सिम्युलेटेड हैं, और चार्जिंग असली समय से तेज़ चलती है।",
    "Payments run in Razorpay test mode during the pilot, so no real money moves.": "पायलट के दौरान भुगतान Razorpay टेस्ट मोड में होते हैं, इसलिए कोई असली पैसा नहीं कटता।",
    "Estimates": "अनुमान", "Range, time and cost estimates are typical values, not guarantees.": "रेंज, समय और लागत के अनुमान सामान्य मान हैं, गारंटी नहीं।",
    // Account and sign-in
    "Sign in": "साइन इन", "SIGN IN": "साइन इन", "Signed in": "साइन इन है", "Sign out": "साइन आउट", "Signed out.": "साइन आउट हो गया।",
    "Sign in with phone": "फ़ोन से साइन इन करें",
    "Use your mobile number to start charging and keep your receipts on every device.": "चार्जिंग शुरू करने और हर डिवाइस पर अपनी रसीदें रखने के लिए अपना मोबाइल नंबर इस्तेमाल करें।",
    "your charges and receipts are saved to this number on every device.": "आपके चार्ज और रसीदें इस नंबर पर हर डिवाइस में सेव हैं।",
    "Your number,": "आपका नंबर,", "your receipts.": "आपकी रसीदें।",
    "We'll text a one-time code to verify your mobile number.": "आपका मोबाइल नंबर सत्यापित करने के लिए हम एक बार का कोड SMS करेंगे।",
    "Mobile number": "मोबाइल नंबर", "Send code": "कोड भेजें", "Verify and continue": "पुष्टि करें और आगे बढ़ें",
    "Use a different number": "दूसरा नंबर इस्तेमाल करें",
    "Phone sign-in is not available right now.": "फ़ोन साइन-इन अभी उपलब्ध नहीं है।",
    "Sign in with your phone number to start charging": "चार्जिंग शुरू करने के लिए अपने फ़ोन नंबर से साइन इन करें",
    "Enter a valid 10-digit Indian mobile number.": "सही 10 अंकों का भारतीय मोबाइल नंबर डालें।",
    "Enter the 6-digit code from the SMS.": "SMS में आया 6 अंकों का कोड डालें।",
    "That code is not right. Check the SMS and try again.": "यह कोड सही नहीं है। SMS जाँचें और फिर कोशिश करें।",
    "That code has expired. Send a new one.": "यह कोड समाप्त हो गया है। नया कोड भेजें।",
    "Too many attempts. Wait a few minutes and try again.": "बहुत ज़्यादा प्रयास। कुछ मिनट रुककर फिर कोशिश करें।",
    "Request a new code first.": "पहले नया कोड मँगाएँ।", "Sign-in failed. Please try again.": "साइन-इन विफल रहा। फिर कोशिश करें।",
    "Please enable JavaScript to use Pluggo.": "Pluggo इस्तेमाल करने के लिए JavaScript चालू करें।",
  };

  // Phrases that carry numbers or names. Each is tried on a whole string and on each " · " part.
  const PATTERNS = [
    [/^(\d+) compatible plugs? available$/, "$1 संगत प्लग उपलब्ध"],
    [/^(\d+) available$/, "$1 उपलब्ध"],
    [/^(\d+) compatible stations$/, "$1 संगत स्टेशन"],
    [/^([\d.]+) km straight-line distance$/, "$1 km सीधी दूरी"],
    [/^([\d.]+) of ([\d.]+) kWh$/, "$2 में से $1 kWh"],
    [/^Up to ([\d.]+) kW$/, "$1 kW तक"],
    [/^Target (\d+)%$/, "लक्ष्य $1%"],
    [/^Starting from (\d+)% battery\.$/, "$1% बैटरी से शुरुआत।"],
    [/^(₹[\d.,]+) paid$/, "$1 भुगतान हुआ"],
    [/^(₹[\d.,]+) PAID$/, "$1 भुगतान हुआ"],
    [/^(~?)(\d+) min$/, "$1$2 मिनट"],
    [/^Pay (₹[\d.,]+)$/, "$1 का भुगतान करें"],
    [/^Charger for your (.+)$/, "आपके $1 के लिए चार्जर"],
    [/^One charge finished$/, "एक चार्ज पूरा हुआ"],
    [/^(\d+) charges finished$/, "$1 चार्ज पूरे हुए"],
    [/^6-digit code sent to (.+)$/, "$1 पर 6 अंकों का कोड भेजा गया"],
    [/^Signed in as (.+)\.$/, "$1 के रूप में साइन इन।"],
    [/^(.+) selected\. Your kind of electric\.$/, "$1 चुना गया।"],
    [/^Charger IDs: (.+)$/, "चार्जर ID: $1"],
    [/^Charging at (.+)$/, "$1 पर चार्जिंग"],
    [/^Typical · charges up to ([\d.]+) kW$/, "सामान्य · $1 kW तक चार्ज"],
    [/^(\d+) charges$/, "$1 चार्ज"],
  ];

  const ATTRS = ["placeholder", "aria-label", "title"];
  // Brand marks, map attribution, licence credits and raw codes stay in English.
  const SKIP = "script,style,code,noscript,[translate='no'],.leaflet-control-attribution,.credits-list,.receipt-id,.brand,.footer-brand";

  function translateCore(text) {
    if (Object.prototype.hasOwnProperty.call(HI, text)) return HI[text];
    for (const [pattern, out] of PATTERNS) if (pattern.test(text)) return text.replace(pattern, out);
    return null;
  }
  function translate(text) {
    const whole = translateCore(text);
    if (whole !== null) return whole;
    if (!text.includes(" · ")) return null;
    let changed = false;
    const parts = text.split(" · ").map((part) => {
      const t = translateCore(part);
      if (t !== null) { changed = true; return t; }
      return part;
    });
    return changed ? parts.join(" · ") : null;
  }

  let lang = "en";
  try { lang = localStorage.getItem("pluggo.lang") === "hi" ? "hi" : "en"; } catch {}

  // node -> { orig, out }: the English we replaced and the Hindi we wrote.
  const textMemo = new WeakMap();
  const attrMemo = new WeakMap();

  function skipped(element) { return !element || element.closest(SKIP); }

  function handleText(node) {
    const memo = textMemo.get(node);
    const current = node.nodeValue;
    if (memo && current === memo.out) {
      if (lang === "en") { node.nodeValue = memo.orig; textMemo.delete(node); }
      return;
    }
    // The app wrote new English text (or we are restoring): start from what is there now.
    if (memo) textMemo.delete(node);
    if (lang !== "hi" || skipped(node.parentElement)) return;
    const trimmed = current.replace(/\s+/g, " ").trim();
    if (!trimmed || !/[A-Za-z]/.test(trimmed)) return;
    const hindi = translate(trimmed);
    if (hindi === null) return;
    const lead = current.match(/^\s*/)[0], tail = current.match(/\s*$/)[0];
    const out = lead + hindi + tail;
    textMemo.set(node, { orig: current, out });
    node.nodeValue = out;
  }

  function handleAttrs(element) {
    if (skipped(element)) return;
    let memo = attrMemo.get(element);
    for (const name of ATTRS) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name);
      const saved = memo && memo[name];
      if (saved && current === saved.out) {
        if (lang === "en") { element.setAttribute(name, saved.orig); delete memo[name]; }
        continue;
      }
      if (saved) delete memo[name];
      if (lang !== "hi") continue;
      const hindi = translate(current.trim());
      if (hindi === null) continue;
      if (!memo) { memo = {}; attrMemo.set(element, memo); }
      memo[name] = { orig: current, out: hindi };
      element.setAttribute(name, hindi);
    }
  }

  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) { handleText(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    handleAttrs(root);
    const texts = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = texts.nextNode())) handleText(node);
    root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(handleAttrs);
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") handleText(record.target);
      else if (record.type === "attributes") handleAttrs(record.target);
      else record.addedNodes.forEach(walk);
    }
  });

  function syncSwitch() {
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
    document.querySelectorAll("[data-app-lang]").forEach((option) =>
      option.setAttribute("aria-checked", String(option.dataset.appLang === lang)));
  }

  function setLanguage(next) {
    lang = next === "hi" ? "hi" : "en";
    try { localStorage.setItem("pluggo.lang", lang); } catch {}
    syncSwitch();
    walk(document.body);
  }

  document.addEventListener("click", (event) => {
    const option = event.target.closest("[data-app-lang]");
    if (option) setLanguage(option.dataset.appLang);
  });

  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  syncSwitch();
  if (lang === "hi") walk(document.body);

  window.pluggoI18n = { setLanguage, translate, get language() { return lang; } };
})();
