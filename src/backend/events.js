/*************************************************
 * EMERGITAG.ME — BACKEND EVENTS
 * Combines:
 *  - Paystack hourly/daily cron jobs
 *  - Member auto-profile creation
 *  - Login History tracking (fixed syntax)
 *************************************************/

import { checkPaymentsJob } from 'backend/fallback-cron.js';
import wixData from 'wix-data';
import { syncPaystackCustomerProfiles, syncPaystackSubscriptions } from 'backend/paystack-sync.jsw';

/*************************************************
 * 1️⃣ Hourly Cron Job (Existing)
 *************************************************/
export function wixCron_onHourlyEvent(event) {
  checkPaymentsJob();
}

/*************************************************
 * 2️⃣ Member Created Event — Auto-create Emergency Profile
 *************************************************/
export async function members_onMemberCreated(event) {
  try {
    const member = event.member;
    const userId = member._id;
    const email = member.loginEmail || '';
    const fullName = member.contact?.name || '';

    console.log(`👤 [Events] New member created: ${email}`);

    // ✅ Check if an Emergency_Profiles record already exists
    const existing = await wixData.query('Emergency_Profiles')
      .eq('_owner', userId)
      .limit(1)
      .find({ suppressAuth: true });

    if (existing.items.length > 0) {
      console.log('ℹ️ Profile already exists for this member, skipping.');
      return;
    }

    // ✅ Create a new Emergency_Profiles entry
    const newProfile = {
      _owner: userId,
      userId,
      emailAddress: email,
      fullName,
      signUpPaid: false,
      subscriptionActive: false,
      planStatus: 'none',
      createdAt: new Date()
    };

    await wixData.insert('Emergency_Profiles', newProfile, { suppressAuth: true });
    console.log(`✅ [Events] Emergency_Profiles record created for ${email}`);
  } catch (err) {
    console.error('❌ [Events] Failed to create Emergency_Profiles record:', err);
  }
}

/*************************************************
 * 3️⃣ Daily Cron Job — Paystack Sync
 *************************************************/
export async function wixCron_onDailyEvent(event) {
  console.log('🕒 Starting daily data sync...');
  await syncPaystackCustomerProfiles();
  await syncPaystackSubscriptions();
  console.log('✅ Daily sync finished.');
}

/*************************************************
 * 4️⃣ Login History Tracker — using the proper event handler
 *************************************************/
export async function wixUsers_onLogin(event) {
  try {
    const user = event.user;
    const loginRecord = {
      userId: user.id,
      loginDate: new Date(),
      deviceType: 'Unknown',  // can be filled from frontend later
      browser: 'Unknown',
      ipRegion: 'Unknown',
      loginMethod: 'Email Login'
    };

    await wixData.insert('Login_History', loginRecord, { suppressAuth: true });
    console.log(`✅ [Events] Login recorded for user ${user.id}`);
  } catch (err) {
    console.error('❌ [Events] Failed to record login:', err);
  }
}
