// Email Service for B-Seva
// In production, integrate with SendGrid, AWS SES, or similar service

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface BookingEmailData {
  customerName: string;
  customerEmail: string;
  bookingNumber: string;
  pujaName: string;
  packageTier: string;
  bookingDate: string;
  bookingTime: string;
  location: string;
  city: string;
  totalAmount: number;
  tithi?: string;
  nakshatra?: string;
}

// Email templates
const getBookingConfirmationTemplate = (data: BookingEmailData): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation - B-Seva</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2d5a8f 100%); padding: 30px; text-align: center;">
      <h1 style="color: #F7931E; margin: 0; font-size: 28px;">B-Seva</h1>
      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px;">Traditional Indian Spiritual Services</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <h2 style="color: #1E3A5F; margin-top: 0;">🙏 Booking Confirmed!</h2>
      
      <p style="color: #333; font-size: 16px;">Dear ${data.customerName},</p>
      
      <p style="color: #666; font-size: 14px;">
        Thank you for booking with B-Seva. Your puja has been successfully scheduled.
      </p>
      
      <!-- Booking Details Card -->
      <div style="background-color: #FFF8F0; border: 1px solid #F7931E; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1E3A5F; margin-top: 0; border-bottom: 1px solid #F7931E; padding-bottom: 10px;">
          Booking Details
        </h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 40%;">Booking Number:</td>
            <td style="padding: 8px 0; color: #1E3A5F; font-weight: bold;">${data.bookingNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Puja:</td>
            <td style="padding: 8px 0; color: #333; font-weight: bold;">${data.pujaName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Package:</td>
            <td style="padding: 8px 0; color: #333;">${data.packageTier}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Date:</td>
            <td style="padding: 8px 0; color: #333;">${data.bookingDate}</td>
          </tr>
          ${data.tithi ? `
          <tr>
            <td style="padding: 8px 0; color: #666;">Tithi:</td>
            <td style="padding: 8px 0; color: #F7931E; font-weight: bold;">${data.tithi}</td>
          </tr>
          ` : ''}
          ${data.nakshatra ? `
          <tr>
            <td style="padding: 8px 0; color: #666;">Nakshatra:</td>
            <td style="padding: 8px 0; color: #9333EA;">${data.nakshatra}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0; color: #666;">Time:</td>
            <td style="padding: 8px 0; color: #333;">${data.bookingTime || 'To be confirmed'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Location:</td>
            <td style="padding: 8px 0; color: #333;">${data.location}, ${data.city}</td>
          </tr>
        </table>
        
        <div style="border-top: 2px solid #F7931E; margin-top: 15px; padding-top: 15px;">
          <table style="width: 100%;">
            <tr>
              <td style="color: #1E3A5F; font-size: 18px; font-weight: bold;">Total Amount:</td>
              <td style="color: #F7931E; font-size: 24px; font-weight: bold; text-align: right;">
                ₹${(data.totalAmount / 100).toLocaleString()}
              </td>
            </tr>
          </table>
        </div>
      </div>
      
      <!-- Next Steps -->
      <div style="background-color: #E8F4FD; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h4 style="color: #1E3A5F; margin-top: 0;">📋 What's Next?</h4>
        <ol style="color: #666; font-size: 14px; padding-left: 20px;">
          <li style="margin-bottom: 8px;">A Pujari will be assigned to your booking shortly</li>
          <li style="margin-bottom: 8px;">You will receive the Samagri (puja materials) list</li>
          <li style="margin-bottom: 8px;">The Pujari will contact you before the scheduled date</li>
          <li style="margin-bottom: 8px;">Please ensure the puja space is prepared</li>
        </ol>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        If you have any questions, please contact our support team.
      </p>
      
      <p style="color: #333; font-size: 14px;">
        Om Shanti 🙏<br>
        <strong>Team B-Seva</strong>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #1E3A5F; padding: 20px; text-align: center;">
      <p style="color: #ffffff; font-size: 12px; margin: 0;">
        © 2024 B-Seva. All rights reserved.
      </p>
      <p style="color: #999; font-size: 11px; margin: 10px 0 0 0;">
        This is an automated email. Please do not reply directly.
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

const getOTPEmailTemplate = (customerName: string, otp: string): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OTP Verification - B-Seva</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2d5a8f 100%); padding: 30px; text-align: center;">
      <h1 style="color: #F7931E; margin: 0; font-size: 28px;">B-Seva</h1>
    </div>
    
    <div style="padding: 30px; text-align: center;">
      <h2 style="color: #1E3A5F;">Verify Your Booking</h2>
      
      <p style="color: #666; font-size: 16px;">Dear ${customerName},</p>
      
      <p style="color: #666; font-size: 14px;">
        Please use the following OTP to confirm your booking:
      </p>
      
      <div style="background-color: #FFF8F0; border: 2px solid #F7931E; border-radius: 8px; padding: 20px; margin: 30px auto; max-width: 200px;">
        <span style="font-size: 36px; font-weight: bold; color: #1E3A5F; letter-spacing: 8px;">${otp}</span>
      </div>
      
      <p style="color: #999; font-size: 12px;">
        This OTP is valid for 10 minutes. Do not share it with anyone.
      </p>
    </div>
    
    <div style="background-color: #1E3A5F; padding: 20px; text-align: center;">
      <p style="color: #ffffff; font-size: 12px; margin: 0;">
        © 2024 B-Seva. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

// Email sending function (mock implementation - replace with actual email service)
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // In production, integrate with email service like SendGrid, AWS SES, etc.
    // For now, log the email details
    console.log('📧 Email Service - Sending email:');
    console.log('  To:', options.to);
    console.log('  Subject:', options.subject);
    console.log('  [Email content logged for development]');
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
}

export async function sendBookingConfirmationEmail(data: BookingEmailData): Promise<boolean> {
  const html = getBookingConfirmationTemplate(data);
  
  return sendEmail({
    to: data.customerEmail,
    subject: `🙏 Booking Confirmed - ${data.pujaName} | B-Seva`,
    html,
    text: `Your booking for ${data.pujaName} has been confirmed. Booking Number: ${data.bookingNumber}. Date: ${data.bookingDate}. Total: ₹${(data.totalAmount / 100).toLocaleString()}`
  });
}

export async function sendOTPEmail(customerName: string, customerEmail: string, otp: string): Promise<boolean> {
  const html = getOTPEmailTemplate(customerName, otp);
  
  return sendEmail({
    to: customerEmail,
    subject: `🔐 OTP for Booking Verification - B-Seva`,
    html,
    text: `Your OTP for B-Seva booking verification is: ${otp}. Valid for 10 minutes.`
  });
}

export { BookingEmailData };
