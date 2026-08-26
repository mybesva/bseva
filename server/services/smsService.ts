/**
 * SMS Service for B-Seva
 * Supports multiple SMS providers: Twilio, MSG91
 * Falls back to console logging in development mode
 */

interface SMSConfig {
  provider: 'twilio' | 'msg91' | 'console';
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  msg91AuthKey?: string;
  msg91SenderId?: string;
  msg91TemplateId?: string;
}

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

// Get SMS configuration from environment
function getSMSConfig(): SMSConfig {
  const provider = process.env.SMS_PROVIDER as SMSConfig['provider'] || 'console';
  
  return {
    provider,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
    msg91AuthKey: process.env.MSG91_AUTH_KEY,
    msg91SenderId: process.env.MSG91_SENDER_ID,
    msg91TemplateId: process.env.MSG91_TEMPLATE_ID,
  };
}

// Send SMS via Twilio
async function sendViaTwilio(
  to: string,
  message: string,
  config: SMSConfig
): Promise<SMSResult> {
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioFromNumber) {
    return {
      success: false,
      error: 'Twilio configuration incomplete',
      provider: 'twilio',
    };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: config.twilioFromNumber,
          Body: message,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        messageId: data.sid,
        provider: 'twilio',
      };
    } else {
      return {
        success: false,
        error: data.message || 'Twilio API error',
        provider: 'twilio',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'twilio',
    };
  }
}

// Send SMS via MSG91
async function sendViaMSG91(
  to: string,
  message: string,
  config: SMSConfig,
  variables?: Record<string, string>
): Promise<SMSResult> {
  if (!config.msg91AuthKey || !config.msg91SenderId) {
    return {
      success: false,
      error: 'MSG91 configuration incomplete',
      provider: 'msg91',
    };
  }

  try {
    // Format phone number for MSG91 (remove + and leading zeros)
    const formattedPhone = to.replace(/^\+/, '').replace(/^0+/, '');
    
    const payload = {
      flow_id: config.msg91TemplateId,
      sender: config.msg91SenderId,
      mobiles: formattedPhone,
      ...variables,
    };

    const response = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'authkey': config.msg91AuthKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.type === 'success') {
      return {
        success: true,
        messageId: data.request_id,
        provider: 'msg91',
      };
    } else {
      return {
        success: false,
        error: data.message || 'MSG91 API error',
        provider: 'msg91',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'msg91',
    };
  }
}

// Console fallback for development
function sendViaConsole(to: string, message: string): SMSResult {
  console.log('='.repeat(50));
  console.log('[SMS Service - Console Mode]');
  console.log(`To: ${to}`);
  console.log(`Message: ${message}`);
  console.log('='.repeat(50));
  
  return {
    success: true,
    messageId: `console-${Date.now()}`,
    provider: 'console',
  };
}

/**
 * Send SMS message
 */
export async function sendSMS(
  to: string,
  message: string,
  variables?: Record<string, string>
): Promise<SMSResult> {
  const config = getSMSConfig();

  switch (config.provider) {
    case 'twilio':
      return sendViaTwilio(to, message, config);
    case 'msg91':
      return sendViaMSG91(to, message, config, variables);
    case 'console':
    default:
      return sendViaConsole(to, message);
  }
}

/**
 * Send OTP SMS
 */
export async function sendOTPSMS(
  to: string,
  otp: string,
  bookingNumber?: string
): Promise<SMSResult> {
  const message = bookingNumber
    ? `Your B-Seva booking verification OTP is ${otp} for booking ${bookingNumber}. Valid for 10 minutes. Do not share this code.`
    : `Your B-Seva verification OTP is ${otp}. Valid for 10 minutes. Do not share this code.`;

  return sendSMS(to, message, { otp, booking_number: bookingNumber || '' });
}

/**
 * Send Booking Confirmation SMS
 */
export async function sendBookingConfirmationSMS(
  to: string,
  bookingDetails: {
    bookingNumber: string;
    pujaName: string;
    date: string;
    time: string;
    priestName?: string;
  }
): Promise<SMSResult> {
  const message = `B-Seva Booking Confirmed! 
Booking: ${bookingDetails.bookingNumber}
Puja: ${bookingDetails.pujaName}
Date: ${bookingDetails.date} at ${bookingDetails.time}
${bookingDetails.priestName ? `Pujari: ${bookingDetails.priestName}` : ''}
Thank you for choosing B-Seva!`;

  return sendSMS(to, message, {
    booking_number: bookingDetails.bookingNumber,
    puja_name: bookingDetails.pujaName,
    date: bookingDetails.date,
    time: bookingDetails.time,
    priest_name: bookingDetails.priestName || '',
  });
}

/**
 * Send Booking Reminder SMS
 */
export async function sendBookingReminderSMS(
  to: string,
  bookingDetails: {
    bookingNumber: string;
    pujaName: string;
    date: string;
    time: string;
  }
): Promise<SMSResult> {
  const message = `Reminder: Your ${bookingDetails.pujaName} is scheduled for tomorrow (${bookingDetails.date}) at ${bookingDetails.time}. Booking: ${bookingDetails.bookingNumber}. - B-Seva`;

  return sendSMS(to, message, {
    booking_number: bookingDetails.bookingNumber,
    puja_name: bookingDetails.pujaName,
    date: bookingDetails.date,
    time: bookingDetails.time,
  });
}

/**
 * Send Booking Cancellation SMS
 */
export async function sendBookingCancellationSMS(
  to: string,
  bookingDetails: {
    bookingNumber: string;
    pujaName: string;
    refundAmount?: number;
  }
): Promise<SMSResult> {
  const refundText = bookingDetails.refundAmount
    ? ` Refund of ₹${(bookingDetails.refundAmount / 100).toFixed(2)} will be processed within 5-7 business days.`
    : '';

  const message = `Your B-Seva booking ${bookingDetails.bookingNumber} for ${bookingDetails.pujaName} has been cancelled.${refundText} For queries, contact support.`;

  return sendSMS(to, message, {
    booking_number: bookingDetails.bookingNumber,
    puja_name: bookingDetails.pujaName,
    refund_amount: bookingDetails.refundAmount?.toString() || '',
  });
}
