# إدارة الأدمنات والتحقق الرسمي

## المتطلبات
- المدير الأصلي الدائم: ali_alsaffar@uomosul.edu.iq. لا يمكن للواجهة أو API حذفه أو تعطيله.
- كل مدير مفعّل يستطيع إضافة دعوات وحذف أدمنات آخرين. الحذف يسحب صلاحية الإدارة فقط، ولا يحذف حساب Google أو الإعلانات.
- لا توجد صلاحيات من البريد أو الرقم بمجرد إدخالهما.
- الدخول عبر Google ببريد موثّق، ثم إثبات الرقم الدولي نفسه عبر حساب WhatsApp وحساب Telegram.
- لا يوجد تأكيد يدوي أو مسار لتجاوز التحقق. المدير الأصلي استثناء تأسيسي محفوظ كما طلب المالك.

## المسار
1. مدير مفعّل يفتح «إدارة الأدمنات» ويدخل بريد Google ورقماً دولياً مثل +9647701234567.
2. الخادم يحفظ دعوة pending، active=false، ولا يرسل بريد دعوة تلقائياً.
3. المدعو يدخل قيراط بالبريد المدعو، ويفتح «دعوة الإدارة».
4. «بدء التحقق» يصدر معرّف ربط عشوائياً صالحاً 30 دقيقة، مرتبطاً بالبريد وUID والرقم وإصدار الدعوة. ليس رمز تسجيل دخول لأي خدمة.
5. رابط Telegram يفتح البوت الرسمي. يضغط المستخدم Start ثم زر request_contact لمشاركة رقمه. نرفض contact لا يطابق contact.user_id المرسل أو الرسائل المحولة أو الرقم المختلف.
6. رابط WhatsApp يجهّز نص QIRAT ومعرّف الربط لإرساله بواسطة المستخدم إلى رقم Cloud API الخاص بقيراط. لا نقرأ جهات الاتصال ولا نستخدم WhatsApp Web.
7. Webhook واتساب الموقّع بـ X-Hub-Signature-256 يثبت وصول الرسالة من الرقم المدعو إلى phone_number_id المهيّأ.
8. بعد الإثباتين، يتفعّل الدور. يمكن تحديث الحالة في النافذة، وتتابع الواجهة تغيير الدور عبر Firestore.
9. البدء من جديد يلغي صلاحية معرّف الربط السابق. إلغاء الدعوة أو انتهاء المدة يمنع التفعيل وإعادة التشغيل.

## نشر مطلوب قبل إظهار الميزة للعامة
التغييرات مجهزة للمراجعة؛ مجرد رفعها إلى GitHub لا ينشر Worker أو Firestore Rules.
1. انشر مشروع telegram-bot كاملاً، بما فيه administrators.mjs وchannels.mjs، إلى Worker الحالي qirat-telegram-bot.
2. احتفظ بالأسرار الحالية دون نسخها للمحادثة أو المستودع: FIREBASE_SERVICE_ACCOUNT_JSON وTELEGRAM_BOT_TOKEN وTELEGRAM_WEBHOOK_SECRET.
3. أضف المتغير TELEGRAM_BOT_USERNAME=QiratMosulAlertsBot.
4. هيّئ رقماً رسمياً على WhatsApp Cloud API لاستقبال تحقق 1:1. ذلك لا يفعّل إرسال مجموعات WhatsApp ولا يتجاوز قيودها.
5. أضف WHATSAPP_PHONE_NUMBER_ID وWHATSAPP_BUSINESS_PHONE بالصيغة الدولية. أضف WHATSAPP_APP_SECRET وWHATSAPP_VERIFY_TOKEN كأسرار في Cloudflare. لا تدخلها في الواجهة أو GitHub أو المحادثة.
6. في تطبيق Meta، هيّئ Webhook إلى https://qirat-telegram-bot.anaqatal-rafidain.workers.dev/whatsapp-verification وفعّل استقبال messages لحساب الأعمال الصحيح.
7. تحقق من بقاء Telegram webhook الحالي إلى /telegram مع secret_token. لا حاجة لاستبدال الربط أو توسيع allowed_updates لأن message مفعّل بالفعل.
8. اختبر Worker ثم انشر firestore.rules من المشروع qirat-6f86e. سجل الأدوار محمي من كل كتابات العملاء. لا تنشر قواعد تسمح لهم بتعيين active أو حقول التحقق.
9. انشر الواجهة وملفات cache الجديدة بعد جاهزية الخادم والقواعد.
10. نفّذ قبولاً حقيقياً بدعوة شخص بموافقته وبإثبات الرقم عبر الخدمتين، ثم تحقق من الإضافة والحذف وتراجع الصلاحيات. لا تمنح دوراً تجريبياً دون موافقة صاحبه.

## الحماية والحدود
- الخادم يتحقق من Firebase ID token باستخدام accounts:lookup ومن provider Google والبريد الموثق.
- كل طلب إدارة أو قناة Telegram يعيد فحص الدور الحالي؛ صلاحيات المتصفح ليست مصدر التفويض.
- الكتابات ذرية ولها preconditions. تفويض مدير مفوّض يخضع لشرط إصدار سجلّه لمنع استمرار العملية عند سحب صلاحياته بالتزامن.
- الأدوار مربوطة بـ UID والبريد، ولا تكفي مطابقة البريد وحدها.
- سجلات الأدوار والدعوات والهواتف لا تُعرض للعامة. المديرون يرونها عبر الخادم؛ المدعو يقرأ سجلّه فقط.
- سجلات _qiratAdminChallenges و_qiratAdminTelegramLinks و_qiratAdminAudit خاصة بالخادم.
- التحقق يثبت ارتباط الحسابين بالرقم وقت التفعيل؛ تغيير مالك الرقم أو حذف حساب خارجي لاحقاً لا يُكتشف آلياً. يلزم سحب الصلاحية عند العلم بالتغيير.
- الحماية تمنع حذف المالك من تطبيق قيراط وواجهاته، ولا تمنع مالك مشروع Firebase من تعديل بيانات المشروع من لوحة المزود.
- سجلات الربط منتهية الصلاحية مرفوضة منطقياً، لكنها لا تُحذف تلقائياً. يلزم سياسة احتفاظ وتنظيف للسجلات الخاصة.
- التسجيل على واتساب أو تليكرام وحده لا يثبت هوية الشخص القانونية.
- النشر الخاص من Telegram إلى قيراط يبقى محصوراً بـ TELEGRAM_ADMIN_ID الحالي. إدارة قنوات Telegram عبر الويب متاحة للأدمنات المفعّلين.
- لا رسوم أو خدمات مدفوعة أو حسابات إدارة جديدة فُعّلت أثناء التطوير.

## التحقق المنفذ
node --test telegram-bot/administrators.test.mjs telegram-bot/channels.test.mjs telegram-bot/test.mjs telegram-bot/visitors.test.mjs
node tests/admin-auth.cjs
node tests/whatsapp-sharing.cjs
node tests/messenger-sharing.cjs

اختبارات معزولة؛ لم تُرسل رسائل حقيقية ولم يتم إنشاء أدمن فعلي. لم يُشغّل Firestore Emulator ولم تُختبر قواعده على المشروع الحي. يجب اختبار قواعد القراءة/الحذف باستخدام المحاكي أو Rules Playground قبل نشرها.

## مراجع
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://core.telegram.org/bots/api#keyboardbutton
- https://core.telegram.org/bots/api#contact
- https://core.telegram.org/bots/features#deep-linking
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks


