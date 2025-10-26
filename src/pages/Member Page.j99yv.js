import wixUsers from 'wix-users';
import wixData from 'wix-data';
import wixCRM from 'wix-crm'; // For Marketing Emails integration (if needed)

// ========== Helper: Generate a unique publicViewId ==========
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 10);
}

$w.onReady(async () => {
  const user = wixUsers.currentUser;
  const userId = user.id;

  // Ensure the user is logged in
  if (!user.loggedIn) {
    console.warn("User not logged in.");
    return;
  }

  const email = await user.getEmail();
  let result = await wixData.query("Emergency_Profiles")
    .eq("loginEmail", userId)
    .find();

  let profile;
  if (result.items.length === 0) {
    const newProfile = {
      loginEmail: userId,
      publicViewId: generateUniqueId(),
      membershipTier: "Bronze",
      email: email
    };
    const insertResult = await wixData.insert("Emergency_Profiles", newProfile);
    profile = insertResult;
    console.log("Emergency profile created.");
  } else {
    profile = result.items[0];
    console.log("Emergency profile already exists.");
  }

  // Initialize Notifications Tab
  setupNotificationsTab(profile);
});

// ============================================================
// ========== NOTIFICATIONS TAB LOGIC ==========================
// ============================================================

async function setupNotificationsTab(profile) {
  // ========== 1. MARKETING EMAILS ==========
  $w('#switchMarketingEmails').onChange(async () => {
    const isOn = $w('#switchMarketingEmails').checked;
    await updateMarketingEmailPreference(isOn, profile.email);
  });

  // Initialize marketing info on load
  $w('#switchMarketingEmails').checked = false;
  $w('#MarkertingEmailinfo').text = `You have not opted to receive Marketing and Information Emails from Emergitag.me. You can opt in at any time!`;

  // ========== 2. PROFILE REMINDERS ==========
  $w('#ProfileRemindersSwitch').checked = !!profile.profileRemindersSwitch;
  updateProfileRemindersInfo($w('#ProfileRemindersSwitch').checked);

  $w('#ProfileRemindersSwitch').onChange(async () => {
    const checked = $w('#ProfileRemindersSwitch').checked;
    await updateField(profile._id, 'profileRemindersSwitch', checked);
    updateProfileRemindersInfo(checked);
  });

  // ========== 3. WHATSAPP GENERAL MESSAGES ==========
  $w('#switchNewMessages').checked = !!profile.waConsent;
  updateWhatsAppGeneralInfo(profile, $w('#switchNewMessages').checked);

  $w('#switchNewMessages').onChange(async () => {
    const checked = $w('#switchNewMessages').checked;
    await updateField(profile._id, 'waConsent', checked);
    updateWhatsAppGeneralInfo(profile, checked);
  });

  // ========== 4. PROFILE VIEW NOTIFICATIONS ==========
  $w('#profileViewNotifications').checked = !!profile.receiveNotifications;
  updateProfileViewInfo(profile, $w('#profileViewNotifications').checked);

  $w('#profileViewNotifications').onChange(async () => {
    const checked = $w('#profileViewNotifications').checked;
    await updateField(profile._id, 'receiveNotifications', checked);
    updateProfileViewInfo(profile, checked);
  });

  // ========== 5. SMS NOTIFICATIONS ==========
  $w('#SMSProfileView').checked = !!profile.smsConsent;
  updateSMSInfo(profile, $w('#SMSProfileView').checked);

  $w('#SMSProfileView').onChange(async () => {
    const checked = $w('#SMSProfileView').checked;
    await updateField(profile._id, 'smsConsent', checked);
    updateSMSInfo(profile, checked);
  });

  // ========== 6. TERMS AND CONDITIONS ==========
  $w('#TsandCs').checked = !!profile.termsAccepted;
  updateTsAndCsText(profile, $w('#TsandCs').checked);

  $w('#TsandCs').onChange(async () => {
    const checked = $w('#TsandCs').checked;
    if (checked) {
      const now = new Date();
      await wixData.update('Emergency_Profiles', {
        _id: profile._id,
        termsAccepted: true,
        termsAcceptedDate: now
      });
      profile.termsAcceptedDate = now;
    } else {
      await updateField(profile._id, 'termsAccepted', false);
    }
    updateTsAndCsText(profile, checked);
  });

  // Add T&C link
  $w('#TsandCsNote').html = `You agree to the Terms and Conditions of Use. 
  <a href="https://www.emergitag.me/userpolicydocuments" target="_blank">View Terms and Conditions</a>`;
}

// ============================================================
// ========== SUPPORTING FUNCTIONS =============================
// ============================================================

async function updateField(profileId, fieldName, value) {
  const toUpdate = { _id: profileId };
  toUpdate[fieldName] = value;
  await wixData.update('Emergency_Profiles', toUpdate);
}

// ---------- MARKETING EMAILS ----------
async function updateMarketingEmailPreference(isOn, email) {
  if (isOn) {
    $w('#MarkertingEmailinfo').text = `You have opted in to receive Marketing and Information Emails from Emergitag.me. Emails will be sent to: ${email}`;
  } else {
    $w('#MarkertingEmailinfo').text = `You have not opted to receive Marketing and Information Emails from Emergitag.me. You can opt in at any time!`;
  }

  // Optional: Sync with Wix CRM contact marketing preferences
  try {
    const contact = await wixCRM.getContactByEmail(email);
    if (contact) {
      await wixCRM.updateContact(contact._id, { subscribed: isOn });
    }
  } catch (err) {
    console.warn('CRM sync skipped or failed', err);
  }
}

// ---------- PROFILE REMINDERS ----------
function updateProfileRemindersInfo(isOn) {
  if (isOn) {
    $w('#ProfileRemindersInfo').text = `Life happens and circumstances change. We’ll send you monthly reminders to check and update your Emergency Contact details.`;
  } else {
    $w('#ProfileRemindersInfo').text = `Life happens and circumstances change. We recommend that you opt-in to receive reminders. EmergiTag.me Emergency Profiles must stay accurate so emergency providers can access up-to-date, reliable information.`;
  }
}

// ---------- WHATSAPP GENERAL ----------
function updateWhatsAppGeneralInfo(profile, isOn) {
  if (isOn) {
    const number = profile.whatsappNumber || profile.phoneInput || 'No number found';
    $w('#WhatAppGeneralInfo').text = `We will send you WhatsApp notifications.`;
    $w('#WhatsAppNumber').text = `WhatsApp Number: ${number}`;
  } else {
    $w('#WhatAppGeneralInfo').text = `You have chosen not to receive WhatsApp messages from EmergiTag.me.`;
    $w('#WhatsAppNumber').text = ``;
  }
}

// ---------- PROFILE VIEW ----------
function updateProfileViewInfo(profile, isOn) {
  if (isOn) {
    $w('#ProfileViewInfo').text = `We will send WhatsApp notifications to ${profile.whatsappPhoneInputPrimary || 'Primary number not set'} and ${profile.whatsappPhoneInputAdditional || 'Secondary number not set'}.`;
  } else {
    $w('#ProfileViewInfo').text = `We will not notify you when your Emergency Profile is accessed. Activate Profile Notifications on your Dashboard to receive WhatsApp notifications. You can add two numbers.`;
  }

  $w('#WhatsAppProfileViewPrimaryNumber').text = profile.whatsappPhoneInputPrimary || '';
  $w('#WhatsAppProfileViewSecondNumber').text = profile.whatsappPhoneInputAdditional || '';
}

// ---------- SMS ----------
function updateSMSInfo(profile, isOn) {
  if (isOn) {
    $w('#GeneralSMS').text = `We will send an SMS notification to ${profile.phoneInput || 'your registered number'}.`;
  } else {
    $w('#GeneralSMS').text = `We will not send an SMS when your Emergency Profile is accessed. Activate Profile Notifications to receive SMS alerts.`;
  }
}

// ---------- TERMS & CONDITIONS ----------
function updateTsAndCsText(profile, isOn) {
  if (isOn && profile.termsAcceptedDate) {
    $w('#TsandCs').text = `You accepted the Terms and Conditions on: ${profile.termsAcceptedDate.toLocaleDateString()}`;
  } else if (isOn) {
    $w('#TsandCs').text = `You accepted the Terms and Conditions.`;
  } else {
    $w('#TsandCs').text = `You have not yet accepted the Terms and Conditions.`;
  }
}
