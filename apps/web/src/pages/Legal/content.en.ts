// English text of the public legal pages: /privacy, /terms, /copyright and /health-data.
// Written from what the code does today (Google-only sign-in, Wompi payments in COP, USD prices outside
// Colombia, PostHog analytics, AI providers, device identifier, trial record, creator codes). Any change to
// those flows must be reflected here and in the Spanish version (./content.ts). Not legal advice: review
// with counsel before relying on it.
import { CONTACT_EMAIL, LEGAL_ENTITY, type LegalSection } from './content';

export const LEGAL_UPDATED_EN = 'October 26, 2026';

const CONTACT = `For legal notices, privacy requests, support and copyright complaints, write to ${CONTACT_EMAIL}. You can also reach us from Help → Send feedback inside the app.`;

export const PRIVACY_EN: LegalSection[] = [
  { h: 'Who we are', p: [
    `NoutLife (the website noutlife.site and the NoutLife web app) is operated by ${LEGAL_ENTITY} (“SIDPESAJE”, “NoutLife”, “we”), a company organized under the laws of Colombia. This policy explains what personal information we collect, how we use it and the choices you have.`,
    'We don’t sell your personal information, we don’t share it for targeted advertising, and we don’t show ads.',
  ] },
  { h: 'Information we collect', p: [
    'Account. When you sign in with Google, Google gives us your account identifier, email address and name. You can add a username, avatar and bio.',
    'Sign-in. NoutLife only uses Google sign-in. We never ask for, receive or store passwords. After you sign in we keep our own session identifier, stored only as a hash.',
    'What you add to the app. Habits, goals, agenda, notebook, journal, finances, food, sleep, workouts, weight, progress photos, relationships, menstrual cycle and the other areas you choose to use.',
    'Social features. Your public profile, friends, groups and the letters you send, with their photos, videos and stickers.',
    'Payments. If you add a payment method, the card or Nequi details go straight to Wompi, our payment processor. We never receive your full card number. We store the Wompi reference for your payment method, its type, a label such as “VISA •••• 4242”, and a keyed fingerprint (a one-way hash) used only to prevent repeated free trials. For each charge we store the amount, currency, status, dates, plan and any creator code or discount, and for prices in US dollars both the dollar price and the amount in Colombian pesos that was charged.',
    'Device and technical data. A device identifier stored in your browser and in a cookie, the push notification subscription of each device, your time zone and language, the date of your last activity, and a log of notifications sent, opened or turned off by category.',
    'Product analytics. Which screens you open and general actions in the app, as described below.',
  ] },
  { h: 'Devices, trials and analytics', p: [
    'To prevent repeated free trials and to validate invitation rewards, we record a device identifier each time you sign in or renew your session, linked to your account. We use it only to detect accounts that share a device for the same trial or reward and to audit invitations. A shared device on its own never blocks your account or your trial.',
    'We use PostHog for product analytics. It records the screens you open (their path, never their content), general actions such as opening an area or checking off a habit, your language and pricing region, and where you came from (campaign parameters and invitation or creator code). If you’re signed in, it’s linked to your account identifier and plan; if not, to a random identifier created in your browser. PostHog never receives private content (your journal, cycle, notebook or finances) and never receives the device identifier.',
  ] },
  { h: 'How we use information', p: [
    'To provide NoutLife: save your progress, calculate streaks and statistics, show your history and send the reminders you turn on.',
    'To run trials, subscriptions and payments, including charges, cancellations, creator codes and the prevention of repeated trials.',
    'To improve the product with aggregated analytics. We don’t use it for advertising.',
    'For AI features you choose to use, such as the Sage: we send our AI providers the minimum context needed to generate each response.',
    'To keep NoutLife safe, prevent abuse and comply with the law.',
  ] },
  { h: 'Sensitive information', p: [
    'Some areas hold health and wellbeing information (sleep, weight, food, workouts, mood, menstrual cycle) and financial information you choose to enter. We use it only to show you your own progress and to provide the features you request. See our Consumer Health Data Privacy Policy at /health-data.',
  ] },
  { h: 'AI processing', p: [
    'NoutLife’s AI features use the APIs of Groq, Google Gemini, OpenRouter and OpenAI to process your request and the context needed from your account. We send only what each response needs and don’t authorize its use to train third-party models. Each provider handles that data under its own API and privacy terms.',
  ] },
  { h: 'Google Calendar and Google API disclosure', p: [
    'If you connect Google Calendar, we receive an access token from Google, store it securely and use it only to sync your habits and events with your calendar. You can disconnect it in Settings and revoke access in your Google Account at any time.',
    'NoutLife’s use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We use Google data only to provide visible NoutLife features, we don’t transfer it except as needed to provide those features, comply with the law or keep the service secure, we don’t use it for advertising, and no person reads it except with your consent, for security or as required by law.',
  ] },
  { h: 'Who we share information with', p: [
    'Other people see only what you make public or share with them, according to your privacy settings. Letters are visible only to their participants.',
    'Service providers that process data on our behalf: Vercel (hosting of the app and the API), Supabase (database), PostHog (product analytics), Wompi (payments), Google (sign-in, Calendar and Gemini), Groq, OpenRouter and OpenAI (AI features) and your browser’s push service (notifications).',
    'Creator codes. If you apply a creator’s code, your payments are attributed to that creator so we can calculate their commission. Creators don’t receive your name, email or anything you do in the app.',
    'We may disclose information if the law requires it, to protect people’s safety or our rights, or as part of a merger or acquisition, in which case this policy will continue to apply.',
  ] },
  { h: 'Where your data is processed', p: [
    'Our API, database and analytics run on servers in the United States, and the app is delivered through a global content network. Payments are processed by Wompi in Colombia. By using NoutLife you understand that your information is processed in those countries, which may have data protection laws different from yours. We protect it as this policy describes wherever it is processed.',
  ] },
  { h: 'Cookies and browser storage', p: [
    'We use your browser’s local storage (localStorage and IndexedDB) to remember that you’re signed in, your theme, language and motion preferences, the notices you’ve seen, the device identifier and the anonymous analytics identifier with its campaign parameters.',
    'We also use a technical cookie needed to renew your session and a cookie with the device identifier. We don’t use advertising cookies or cross-site tracking. You can clear this data in your browser settings; you’ll need to sign in again.',
    'We don’t sell or share personal information for targeted advertising, so there is nothing to opt out of; where the law requires it, we treat a Global Privacy Control signal as a valid opt-out request.',
  ] },
  { h: 'How long we keep information', p: [
    'We keep your information while you have an account. When you delete your account, we permanently delete your data at that moment, except for:',
    'The trial record (your email in lowercase, the payment method fingerprint and the device identifier), kept for up to 3 years after your deletion request to prevent repeated free trials, then anonymized or deleted.',
    'Records of payments made with a creator code (amount, date and an internal identifier, without your name or email), kept for the creator’s commission accounting.',
    'Information we must keep to comply with legal, tax or accounting obligations. Provider backups are overwritten in their normal cycle.',
  ] },
  { h: 'Your rights and choices', p: [
    'You can access, correct, export and delete your information, object to its processing and withdraw your consent.',
    'Export: Settings → Data lets you download a copy of your data.',
    'Deletion: Settings → Data lets you reset your account or delete it permanently.',
    `For any other request, email ${CONTACT_EMAIL}. We’ll verify your request and respond as soon as possible and within the time required by applicable law. You won’t be treated differently for exercising your rights.`,
  ] },
  { h: 'Your US state privacy rights', p: [
    'If you live in California, Colorado, Connecticut, Virginia, Utah, Texas, Oregon or another US state with a consumer privacy law, you may have the right to know what personal information we collect and how we use and disclose it; to access, correct and delete it; to receive a portable copy; to opt out of its sale, sharing for targeted advertising or profiling; to limit the use of sensitive personal information; and to appeal a decision about your request. We honor these rights for every user, wherever they live.',
    'In the past 12 months we have collected: identifiers (name, email, account and device identifiers); customer and commercial information (payment method label, plan and payment history); internet activity (product analytics); approximate location (time zone only, never precise location); and sensitive personal information you choose to enter (health and financial information). The sources are you, your device, Google and Wompi. We use these categories for the purposes in “How we use information” and disclose them only to the service providers listed above.',
    'We don’t sell or share personal information, and we haven’t in the past 12 months. We use sensitive personal information only to provide the features you request. We don’t disclose personal information to third parties for their own direct marketing.',
    `To make a request or appeal, email ${CONTACT_EMAIL}. An authorized agent may submit a request on your behalf with your signed permission. If we deny an appeal, you can contact your state attorney general.`,
  ] },
  { h: 'Children', p: [
    'NoutLife is not directed to children under 13 (16 in the European Union), and we don’t knowingly collect their personal information. If we learn that we have, we delete it. Users under 18 need a parent or guardian’s permission.',
  ] },
  { h: 'Security', p: [
    'We use encryption in transit, store session identifiers and payment fingerprints only as hashes, never store card numbers, and limit access to personal information. No system is completely secure, so please let us know right away if you suspect unauthorized use of your account.',
  ] },
  { h: 'Changes to this policy', p: [
    'If we make a material change, we’ll let you know in the app before it takes effect. The date at the top shows the latest update.',
  ] },
  { h: 'Contact', p: [
    `Data controller: ${LEGAL_ENTITY} (SIDPESAJE), Colombia.`,
    CONTACT,
  ] },
];

export const TERMS_EN: LegalSection[] = [
  { h: 'Agreement', p: [
    `These Terms of Service govern your use of NoutLife, the website noutlife.site and the NoutLife web app, operated by ${LEGAL_ENTITY} (“SIDPESAJE”, “NoutLife”, “we”), a company organized under the laws of Colombia. By creating an account or using NoutLife, you agree to these Terms and to our Privacy Policy.`,
  ] },
  { h: 'Eligibility and your account', p: [
    'You must be at least 13 years old (16 in the European Union) and able to accept these Terms. If you’re under 18 or under the age of majority where you live, you need a parent or guardian’s permission, and they must approve any purchase.',
    'You sign in with Google and are responsible for what happens in your account. Tell us right away if you suspect unauthorized use.',
  ] },
  { h: 'The service', p: [
    'NoutLife is a personal space for routines, notes, wellbeing and goals. NoutLife Lite is free with limits; NoutLife Pro is a paid subscription that removes them and adds AI features. We may improve, change or discontinue features; if a change materially reduces what a paid plan includes, we’ll tell you in advance.',
  ] },
  { h: 'Free trial', p: [
    'New accounts get 7 days of NoutLife Pro without a payment method. When the trial ends, the account moves to NoutLife Lite automatically and nothing is charged.',
    'If you add a payment method during a trial, your Pro subscription starts automatically when the trial ends and the first period of the plan you chose is charged that day, unless you cancel before. We show you the date and amount before you confirm and remind you in the app before the charge. One trial per person.',
  ] },
  { h: 'Subscriptions and automatic renewal', p: [
    'NoutLife Pro is billed monthly or annually, as you choose at checkout. Your subscription renews automatically at the end of each billing period, and the price of your plan is charged to your saved payment method on the renewal date, until you cancel.',
    'Price lock: while your subscription stays active, the price of your plan does not increase. If we ever change prices for new subscriptions, your current price stays the same until your subscription ends.',
    'You can switch between monthly and annual billing in Plan; the change applies from your next renewal. We don’t prorate.',
  ] },
  { h: 'Prices, currency and payments', p: [
    'The price is shown before you pay. In Colombia prices are in Colombian pesos (COP); elsewhere they’re in US dollars (USD). Your pricing region is set when you create your account.',
    'Payments are processed by Wompi, a payment processor in Colombia, which charges in Colombian pesos. For prices in US dollars, each charge is converted to pesos at the official exchange rate (TRM) of the charge date. Your bank converts it back to your currency at its own rate and may add a foreign transaction fee, so the amount on your statement may differ slightly from the price in dollars. We don’t control those bank charges.',
    'You authorize us and Wompi to charge your payment method for your subscription. If a charge fails, your account moves to NoutLife Lite and nothing is deleted; you can reactivate Pro at any time.',
  ] },
  { h: 'Creator codes', p: [
    'A creator code can be applied once per account, before your first payment. Its discount, if any, applies only to that first payment, monthly or annual. Codes have no cash value, can’t be combined or transferred, and may be deactivated. We may cancel the benefit of a code obtained or used in breach of these Terms.',
  ] },
  { h: 'Cancellation and refunds', p: [
    'You can cancel anytime in Plan with one click, or by writing to us. Cancellation stops future charges; you keep Pro until the end of your trial or the period you’ve already paid for, and then your account moves to NoutLife Lite.',
    'Except where the law requires otherwise, payments are non-refundable and we don’t give refunds or credits for partial periods. If you believe you were charged by mistake, contact us within 30 days and we’ll review it promptly. If the law where you live gives you a right to withdraw from or cancel a purchase, you keep that right.',
  ] },
  { h: 'Virtual items', p: [
    'Gold, experience points, achievements and items in the in-app shop are virtual, have no monetary value and can’t be exchanged for money.',
  ] },
  { h: 'Your content', p: [
    'You keep all rights to the content you create in NoutLife: notes, journals, photos, videos, letters and everything else.',
    'You give us a limited, non-exclusive, revocable license to host, process and display that content in your account and to the people you choose, only to operate NoutLife. We don’t use it for anything else and we don’t sell it. The license ends when you delete the content or your account, except for backups deleted in their normal cycle.',
    'You confirm you have the right to upload what you upload.',
  ] },
  { h: 'Acceptable use', p: [
    'Don’t post, upload or send illegal content, including child sexual abuse material, hate, harassment, threats, violence, scams, spam or malware, or content that infringes other people’s rights.',
    'Don’t access other people’s accounts, try to break NoutLife’s security, scrape the service, or use NoutLife for illegal purposes.',
    'You can block and report anyone. We may remove content and suspend or delete accounts that break these rules, without prior notice in serious cases.',
  ] },
  { h: 'Health, wellbeing and finances', p: [
    'NoutLife and the Sage provide general information and motivation. They are not medical, psychological, nutritional or financial advice. Cycle tracking is not a method of contraception or a diagnostic tool. Talk to a qualified professional about your situation, and contact local emergency services in an emergency.',
  ] },
  { h: 'AI features', p: [
    'AI responses are generated automatically and may be inaccurate or incomplete. Don’t rely on them for important decisions. They’re provided by third-party AI services under the conditions described in our Privacy Policy.',
  ] },
  { h: 'Third-party services', p: [
    'NoutLife relies on third-party services such as Google, Wompi, Groq, OpenRouter, OpenAI, Supabase and Vercel. Their own terms apply to your use of them, and we aren’t responsible for their availability or failures.',
  ] },
  { h: 'Intellectual property', p: [
    'NoutLife, its design, brand and code belong to their creators. See /copyright for details, restrictions and how to report copyright infringement. If you send us feedback, we may use it without obligation to you.',
  ] },
  { h: 'Ending your use', p: [
    'You can delete your account anytime in Settings → Data. Deleting your account cancels your subscription; no further charges are made. We may suspend or end your access if you seriously or repeatedly break these Terms.',
  ] },
  { h: 'Disclaimers', p: [
    'To the extent permitted by law, NoutLife is provided “as is” and “as available”, without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose and non-infringement. We don’t guarantee that the service will be uninterrupted or error-free.',
  ] },
  { h: 'Limitation of liability', p: [
    'To the extent permitted by law, we aren’t liable for indirect, incidental, special, consequential or punitive damages, or for lost data, profits or opportunities. Our total liability for any claim related to NoutLife is limited to the greater of the amount you paid us in the 12 months before the claim or USD 50. Nothing in these Terms limits liability that the law doesn’t allow us to limit, or your rights as a consumer under mandatory law.',
  ] },
  { h: 'Governing law and disputes', p: [
    'These Terms are governed by the laws of Colombia, without depriving you of the protection of the mandatory consumer laws of the country or state where you live. Before filing a claim, please contact us so we can try to resolve it informally within 30 days. If we can’t, you may bring your claim before the competent courts of Colombia or of your place of residence where the law allows it.',
  ] },
  { h: 'Changes to these Terms', p: [
    'If we change these Terms in a material way, we’ll let you know in the app before the change takes effect. If you don’t agree, you can cancel and delete your account; continuing to use NoutLife means you accept the new Terms.',
  ] },
  { h: 'Language', p: [
    'These Terms are available in English and Spanish. If they differ, the Spanish version prevails for users in Colombia and the English version for everyone else.',
  ] },
  { h: 'Contact', p: [
    `${LEGAL_ENTITY} (SIDPESAJE), Colombia, acts as the commercial entity behind NoutLife for tax and legal purposes.`,
    CONTACT,
  ] },
];

export const COPYRIGHT_EN: LegalSection[] = [
  { h: 'Ownership', p: [
    '“NoutLife”, its logo, its user interface and experience design (UI/UX), its source code and its database architecture are the exclusive property of its creators. All rights reserved.',
    'None of it is licensed, assigned or made available to the public, except for normal use of the app as a user.',
  ] },
  { h: 'Method and terminology', p: [
    'NoutLife’s terminology and gamified system, including the organization of life into “Zones”, “Glowup”, “Rituals” and “Learning”, and the way they combine with experience points (XP), streaks, quests and the Sage, are part of NoutLife’s intellectual property.',
    'You may not use those names, or their combined structure and mechanics, to identify or describe a competing product or one that could be confused with NoutLife.',
  ] },
  { h: 'No copying or cloning', p: [
    'Without our prior written permission, you may not:',
    'Reverse engineer, decompile or attempt to obtain the source code or the database structure.',
    'Copy or clone NoutLife’s visual design and look and feel, in whole or in part.',
    'Extract data or content through automated means (scraping, bots, crawlers) or in bulk.',
    'Create, publish or distribute derivative, mirror or copycat apps or services that reproduce NoutLife.',
  ] },
  { h: 'Third-party services and marks', p: [
    'Google (including Calendar and Gemini), Groq, OpenRouter, OpenAI, Wompi and the other services integrated into NoutLife are trademarks and property of their respective owners, and NoutLife claims no rights over them. The architecture of the unified ecosystem that brings them together in a single experience is exclusive to NoutLife.',
  ] },
  { h: 'Backing entity', p: [
    `${LEGAL_ENTITY} (SIDPESAJE) acts as the corporate and commercial entity behind NoutLife for tax and legal purposes. This doesn’t transfer any rights: NoutLife’s intellectual property, brand, visual design and code belong entirely to its original creators.`,
  ] },
  { h: 'Your content', p: [
    'What you create in the app is yours (see the Terms of Service). These reservations apply to NoutLife as a product, not to your personal content.',
  ] },
  { h: 'Reporting copyright infringement (DMCA)', p: [
    `If you believe content hosted on NoutLife infringes your copyright, send a written notice to our designated copyright agent at ${CONTACT_EMAIL} (subject: “DMCA notice”) that includes:`,
    '1. Your physical or electronic signature, as the copyright owner or a person authorized to act on their behalf.',
    '2. Identification of the copyrighted work you claim is infringed.',
    '3. Identification of the material you claim is infringing and enough information for us to locate it, such as a link or a description of where it appears.',
    '4. Your contact information: name, address, phone number and email address.',
    '5. A statement that you have a good-faith belief that the use is not authorized by the copyright owner, its agent or the law.',
    '6. A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on their behalf.',
    'We’ll review the notice, remove or disable access to the material when appropriate and notify the person who posted it.',
  ] },
  { h: 'Counter-notification', p: [
    'If your content was removed and you believe it was a mistake or misidentification, you can send a counter-notice to the same address with: your physical or electronic signature; identification of the removed material and where it appeared before removal; a statement, under penalty of perjury, that you have a good-faith belief the material was removed by mistake or misidentification; and your name, address and phone number, with a statement that you consent to the jurisdiction of the federal district court for your address (or, if you’re outside the United States, any judicial district in which NoutLife may be found) and that you’ll accept service of process from the person who sent the original notice.',
    'Under US law, anyone who knowingly makes a material misrepresentation in a notice or counter-notice may be liable for damages.',
  ] },
  { h: 'Repeat infringers', p: [
    'We may suspend or delete the accounts of users who repeatedly infringe other people’s copyrights.',
  ] },
  { h: 'Contact', p: [CONTACT] },
];

/**
 * Consumer Health Data Privacy Policy (Washington My Health My Data Act and similar US state laws).
 * Must stay limited to what those laws require and be linked on its own from the homepage (footer).
 */
export const HEALTH_DATA_EN: LegalSection[] = [
  { h: 'Scope', p: [
    'This policy explains how NoutLife collects, uses and shares consumer health data, as defined by Washington’s My Health My Data Act and similar US state laws. It supplements our Privacy Policy.',
  ] },
  { h: 'Consumer health data we collect', p: [
    'Only what you choose to enter in NoutLife’s wellbeing areas: menstrual cycle (period dates and cycle and period length), sleep (hours and how you rested), food (meals and macronutrients), workouts, weight and progress photos, mood in your journal, and self-care routines.',
    'From that information NoutLife calculates statistics and estimates shown only to you, such as averages, trends and the estimated date of your next period.',
    'We collect it from you, directly in the app. We don’t collect precise location and don’t use geofencing.',
  ] },
  { h: 'Why we collect and use it', p: [
    'To provide the features you request: saving your entries, showing your history, statistics and estimates, and, only when you use them, generating AI insights. We don’t use it for advertising or to infer anything about you beyond what the app shows you.',
  ] },
  { h: 'Who we share it with', p: [
    'Only with service providers that process it on our behalf to provide the service: Vercel and Supabase (hosting and database) and, when you use AI features, Groq, Google Gemini, OpenRouter and OpenAI. Our analytics provider never receives health content.',
    'We don’t sell consumer health data and we don’t share it with advertisers or data brokers.',
  ] },
  { h: 'Your rights', p: [
    'You have the right to confirm whether we collect, share or sell your consumer health data; to access it, including a list of the third parties and affiliates with which it has been shared; to delete it; and to withdraw your consent by deleting the entries or your account.',
    'You can delete individual entries in each area and your whole account in Settings → Data.',
    `To exercise your rights, email ${CONTACT_EMAIL} with the subject “Health data request”. We’ll respond within 45 days, or tell you if we need up to 45 more days. If we deny your request, you can appeal by replying to our answer; if we deny your appeal, you can contact the Washington State Attorney General.`,
  ] },
  { h: 'Contact', p: [CONTACT] },
];
