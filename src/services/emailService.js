const nodemailer = require('nodemailer');

// Create reusable transporter
// Uses port 465 (SSL) by default — port 587 (STARTTLS) is blocked on many cloud hosts (Render, Railway, etc.)
const createTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT) || 465;
  const secure = port === 465;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Short timeouts — email is fire-and-forget, fail fast
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });
};

// Email templates
const getVerificationEmailTemplate = (userName, verificationLink) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - BMS Engage</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" style="width: 100%; max-width: 600px; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 48px 48px 32px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 24px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" opacity="0.9"/>
                  <path d="M2 17L12 22L22 17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
                  <path d="M2 12L12 17L22 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
                </svg>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">BMS Engage</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500;">Social Media Management Platform</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 48px;">
              <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 28px; font-weight: 700; line-height: 1.3;">Welcome to BMS Engage! 🎉</h2>
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 1.6;">Hi <strong style="color: #2d3748;">${userName}</strong>,</p>
              <p style="margin: 0 0 32px; color: #4a5568; font-size: 16px; line-height: 1.6;">Thank you for joining BMS Engage! We're excited to help you manage your social media presence across all platforms. To get started, please verify your email address by clicking the button below.</p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 0 0 32px;">
                <tr>
                  <td align="center">
                    <a href="${verificationLink}" style="display: inline-block; padding: 18px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 16px; font-weight: 700; box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 20px; border-radius: 12px; margin: 0 0 32px;">
                <p style="margin: 0 0 8px; color: #92400e; font-size: 14px; font-weight: 700; display: flex; align-items: center;">
                  <span style="display: inline-block; width: 20px; height: 20px; margin-right: 8px;">⏰</span>
                  Important Security Notice
                </p>
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">This verification link will expire in <strong>3 minutes</strong> for your security. Please verify your email promptly.</p>
              </div>

              <!-- Alternative Link -->
              <div style="background: #f7fafc; border-radius: 12px; padding: 24px; margin: 0 0 32px;">
                <p style="margin: 0 0 12px; color: #4a5568; font-size: 13px; font-weight: 600;">If the button doesn't work, copy and paste this link:</p>
                <p style="margin: 0; color: #667eea; font-size: 12px; word-break: break-all; font-family: 'Courier New', monospace;">${verificationLink}</p>
              </div>

              <!-- Help Text -->
              <p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">If you didn't create an account with BMS Engage, you can safely ignore this email.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 48px; background: #f7fafc; border-top: 1px solid #e2e8f0;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="text-align: center; padding-bottom: 16px;">
                    <p style="margin: 0 0 8px; color: #2d3748; font-size: 16px; font-weight: 700;">BMS Engage</p>
                    <p style="margin: 0 0 16px; color: #718096; font-size: 13px;">Your complete social media management platform</p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #a0aec0; font-size: 12px;">© ${new Date().getFullYear()} BMS Engage. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const getPasswordResetEmailTemplate = (userName, resetLink) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - BMS Engage</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); min-height: 100vh;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 60px 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" style="width: 100%; max-width: 600px; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
          
          <!-- Header with Icon -->
          <tr>
            <td style="padding: 48px 48px 32px; text-align: center; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 24px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zm3 8H9V7c0-1.654 1.346-3 3-3s3 1.346 3 3v3z" fill="white" opacity="0.9"/>
                </svg>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">Password Reset</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500;">Secure your account</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 48px;">
              <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 28px; font-weight: 700; line-height: 1.3;">Reset Your Password 🔑</h2>
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 1.6;">Hi <strong style="color: #2d3748;">${userName}</strong>,</p>
              <p style="margin: 0 0 32px; color: #4a5568; font-size: 16px; line-height: 1.6;">We received a request to reset your password for your BMS Engage account. Click the button below to create a new password and regain access to your account.</p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 0 0 32px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; padding: 18px 48px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 16px; font-weight: 700; box-shadow: 0 8px 24px rgba(240, 147, 251, 0.4); transition: transform 0.2s;">
                      Reset Password Now
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 20px; border-radius: 12px; margin: 0 0 32px;">
                <p style="margin: 0 0 8px; color: #92400e; font-size: 14px; font-weight: 700; display: flex; align-items: center;">
                  <span style="display: inline-block; width: 20px; height: 20px; margin-right: 8px;">⏰</span>
                  Security Notice
                </p>
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">This password reset link will expire in <strong>1 hour</strong> for your security. If you need a new link, you can request another reset from the login page.</p>
              </div>

              <!-- Alternative Link -->
              <div style="background: #f7fafc; border-radius: 12px; padding: 24px; margin: 0 0 32px;">
                <p style="margin: 0 0 12px; color: #4a5568; font-size: 13px; font-weight: 600;">If the button doesn't work, copy and paste this link:</p>
                <p style="margin: 0; color: #f093fb; font-size: 12px; word-break: break-all; font-family: 'Courier New', monospace;">${resetLink}</p>
              </div>

              <!-- Help Text -->
              <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-left: 4px solid #ef4444; padding: 20px; border-radius: 12px; margin: 0 0 24px;">
                <p style="margin: 0 0 8px; color: #991b1b; font-size: 14px; font-weight: 700;">Didn't request this?</p>
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.5;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged and your account is secure.</p>
              </div>

              <p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">For security reasons, we recommend using a strong password that includes uppercase and lowercase letters, numbers, and special characters.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 48px; background: #f7fafc; border-top: 1px solid #e2e8f0;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="text-align: center; padding-bottom: 16px;">
                    <p style="margin: 0 0 8px; color: #2d3748; font-size: 16px; font-weight: 700;">BMS Engage</p>
                    <p style="margin: 0 0 16px; color: #718096; font-size: 13px;">Your complete social media management platform</p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #a0aec0; font-size: 12px;">© ${new Date().getFullYear()} BMS Engage. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const getWelcomeEmailTemplate = (userName) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BMS Engage!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" style="width: 100%; max-width: 600px; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
          
          <tr>
            <td style="padding: 48px 48px 32px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 24px; margin: 0 auto 24px;">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" opacity="0.9"/>
                  <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
                </svg>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 800;">Welcome to BMS Engage! 🎉</h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 48px;">
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 18px; line-height: 1.6;">Hi <strong style="color: #2d3748;">${userName}</strong>,</p>
              <p style="margin: 0 0 32px; color: #4a5568; font-size: 16px; line-height: 1.6;">Your email has been verified successfully! You're all set to start managing your social media presence like a pro. Here's what you can do now:</p>
              
              <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 16px; padding: 32px; margin: 0 0 32px;">
                <h3 style="margin: 0 0 24px; color: #1a1a1a; font-size: 20px; font-weight: 700;">🚀 Get Started</h3>
                
                <div style="margin-bottom: 20px;">
                  <p style="margin: 0 0 8px; color: #2d3748; font-size: 15px; font-weight: 600;">1. Connect Your Social Accounts</p>
                  <p style="margin: 0; color: #64748b; font-size: 14px;">Link Instagram, Facebook, Twitter, LinkedIn, and more.</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                  <p style="margin: 0 0 8px; color: #2d3748; font-size: 15px; font-weight: 600;">2. Upload Your Media</p>
                  <p style="margin: 0; color: #64748b; font-size: 14px;">Build your media library with images, videos, and graphics.</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                  <p style="margin: 0 0 8px; color: #2d3748; font-size: 15px; font-weight: 600;">3. Create Your First Post</p>
                  <p style="margin: 0; color: #64748b; font-size: 14px;">Use our composer to craft engaging content for all platforms.</p>
                </div>
                
                <div>
                  <p style="margin: 0 0 8px; color: #2d3748; font-size: 15px; font-weight: 600;">4. Schedule & Publish</p>
                  <p style="margin: 0; color: #64748b; font-size: 14px;">Plan your content calendar and let us handle the rest.</p>
                </div>
              </div>

              <table role="presentation" style="width: 100%; margin: 0 0 32px;">
                <tr>
                  <td align="center">
                    <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 18px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 16px; font-weight: 700; box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background: #f7fafc; border-radius: 12px; padding: 24px; margin: 0 0 24px;">
                <p style="margin: 0 0 12px; color: #2d3748; font-size: 15px; font-weight: 600;">💡 Pro Tip</p>
                <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">Take our interactive onboarding tour to learn all the features and get the most out of BMS Engage!</p>
              </div>

              <p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">Need help? Our support team is here for you 24/7. Just reply to this email or visit our help center.</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px 48px; background: #f7fafc; border-top: 1px solid #e2e8f0;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; color: #2d3748; font-size: 16px; font-weight: 700;">BMS Engage</p>
                    <p style="margin: 0; color: #a0aec0; font-size: 12px;">© ${new Date().getFullYear()} BMS Engage. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const getNotificationEmailTemplate = (userName, notificationType, notificationData) => {
  const templates = {
    login: {
      icon: '🔐',
      title: 'New Login Detected',
      message: `We detected a new login to your BMS Engage account.`,
      details: `
        <p style="margin: 0 0 8px; color: #2d3748; font-size: 14px;"><strong>Device:</strong> ${notificationData.device || 'Unknown'}</p>
        <p style="margin: 0 0 8px; color: #2d3748; font-size: 14px;"><strong>Location:</strong> ${notificationData.location || 'Unknown'}</p>
        <p style="margin: 0; color: #2d3748; font-size: 14px;"><strong>Time:</strong> ${notificationData.time || new Date().toLocaleString()}</p>
      `,
      action: 'If this wasn\'t you, please secure your account immediately by changing your password.'
    },
    post_published: {
      icon: '📱',
      title: 'Post Published Successfully',
      message: `Your post "${notificationData.postTitle}" has been published successfully!`,
      details: `
        <p style="margin: 0 0 8px; color: #2d3748; font-size: 14px;"><strong>Platforms:</strong> ${notificationData.platforms || 'N/A'}</p>
        <p style="margin: 0; color: #2d3748; font-size: 14px;"><strong>Published:</strong> ${notificationData.time || new Date().toLocaleString()}</p>
      `,
      action: 'View your post performance in the Analytics dashboard.'
    },
    post_scheduled: {
      icon: '📅',
      title: 'Post Scheduled',
      message: `Your post "${notificationData.postTitle}" has been scheduled.`,
      details: `
        <p style="margin: 0 0 8px; color: #2d3748; font-size: 14px;"><strong>Platforms:</strong> ${notificationData.platforms || 'N/A'}</p>
        <p style="margin: 0; color: #2d3748; font-size: 14px;"><strong>Scheduled for:</strong> ${notificationData.scheduledTime || 'N/A'}</p>
      `,
      action: 'You can edit or cancel this post anytime from the Scheduler.'
    }
  };

  const template = templates[notificationType] || templates.post_published;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.title} - BMS Engage</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f7fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background: #f7fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" style="width: 100%; max-width: 600px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <tr>
            <td style="padding: 32px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <div style="font-size: 48px; margin-bottom: 12px;">${template.icon}</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${template.title}</h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #4a5568; font-size: 16px;">Hi <strong>${userName}</strong>,</p>
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 15px; line-height: 1.6;">${template.message}</p>
              
              <div style="background: #f7fafc; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
                ${template.details}
              </div>

              <p style="margin: 0 0 24px; color: #64748b; font-size: 14px; line-height: 1.6;">${template.action}</p>

              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
                      View Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 32px; background: #f7fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px;">© ${new Date().getFullYear()} BMS Engage. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Send verification email
const sendVerificationEmail = async (email, userName, verificationToken) => {
  try {
    const transporter = createTransporter();
    
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Verify Your Email - BMS Engage',
      html: getVerificationEmailTemplate(userName, verificationLink),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✓ Verification email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, userName, resetToken) => {
  try {
    const transporter = createTransporter();
    
    const resetLink = `${process.env.FRONTEND_URL}/forgot-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Reset Your Password - BMS Engage',
      html: getPasswordResetEmailTemplate(userName, resetLink),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✓ Password reset email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✓ Email service is ready');
    return true;
  } catch (error) {
    console.error('✗ Email service configuration error:', error.message);
    return false;
  }
};

// Send welcome email
const sendWelcomeEmail = async (email, userName) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Welcome to BMS Engage! 🎉',
      html: getWelcomeEmailTemplate(userName),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✓ Welcome email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    // Never throw — welcome email failure must not break account verification
    console.error('Error sending welcome email:', error.message);
    return { success: false };
  }
};

// Send notification email
const sendNotificationEmail = async (email, userName, notificationType, notificationData) => {
  try {
    const transporter = createTransporter();
    const subjects = {
      login: 'New Login Detected - BMS Engage',
      post_published: 'Post Published Successfully - BMS Engage',
      post_scheduled: 'Post Scheduled - BMS Engage',
    };
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: subjects[notificationType] || 'Notification - BMS Engage',
      html: getNotificationEmailTemplate(userName, notificationType, notificationData),
    };
    const info = await transporter.sendMail(mailOptions);
    console.log(`✓ Notification email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    // Never throw — email failure must not break the calling flow
    console.error('Error sending notification email:', error.message);
    return { success: false };
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendNotificationEmail,
  testEmailConfig,
};

const sendMediaShareEmail = async (toEmail, senderName, assetTitle, assetUrl, shareUrl, message) => {
  try {
    const transporter = createTransporter();
    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Shared Media - BMS Engage</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7fafc;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background:#f7fafc;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" style="width:100%;max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);">
        <tr>
          <td style="padding:40px 48px 32px;text-align:center;background:linear-gradient(135deg,#410179 0%,#6d28d9 100%);">
            <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;">BMS Engage</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Media Shared With You</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px;">
            <p style="margin:0 0 8px;color:#4a5568;font-size:16px;"><strong style="color:#2d3748;">${senderName}</strong> shared a media asset with you:</p>
            <h2 style="margin:0 0 24px;color:#1a1a1a;font-size:22px;font-weight:700;">${assetTitle}</h2>
            ${message ? `<div style="background:#f0f4ff;border-left:4px solid #410179;padding:16px 20px;border-radius:8px;margin:0 0 28px;"><p style="margin:0;color:#4a5568;font-size:14px;font-style:italic;">"${message}"</p></div>` : ''}
            <div style="text-align:center;margin:0 0 28px;">
              <img src="${assetUrl}" alt="${assetTitle}" style="max-width:100%;border-radius:16px;border:1px solid #e2e8f0;" />
            </div>
            <table role="presentation" style="width:100%;margin:0 0 28px;">
              <tr><td align="center">
                <a href="${shareUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#410179 0%,#6d28d9 100%);color:#fff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:700;">View Asset</a>
              </td></tr>
            </table>
            <div style="background:#f7fafc;border-radius:12px;padding:16px 20px;">
              <p style="margin:0 0 8px;color:#718096;font-size:12px;font-weight:600;">Or copy this link:</p>
              <p style="margin:0;color:#410179;font-size:12px;word-break:break-all;font-family:'Courier New',monospace;">${shareUrl}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 48px;background:#f7fafc;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;color:#a0aec0;font-size:12px;">© ${new Date().getFullYear()} BMS Engage. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: toEmail,
      subject: `${senderName} shared "${assetTitle}" with you - BMS Engage`,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending share email:', error);
    throw new Error('Failed to send share email');
  }
};

// Send media activity email (comment / correction / variant)
const sendMediaActivityEmail = async (toEmail, toName, activityType, data) => {
  const configs = {
    media_comment: {
      subject: `New comment on "${data.assetTitle}" — BMS Engage`,
      icon: '💬',
      heading: 'New Comment',
      body: `<strong>${data.authorName}</strong> commented on <strong>${data.assetTitle}</strong>:`,
      quote: data.text,
    },
    media_correction: {
      subject: `Revision request on "${data.assetTitle}" — BMS Engage`,
      icon: '✏️',
      heading: 'Revision Requested',
      body: `<strong>${data.authorName}</strong> requested a correction on <strong>${data.assetTitle}</strong>:`,
      quote: data.text,
    },
    media_variant: {
      subject: `New version uploaded for "${data.assetTitle}" — BMS Engage`,
      icon: '🔄',
      heading: 'New Version Available',
      body: `<strong>${data.authorName}</strong> uploaded a new version of <strong>${data.assetTitle}</strong>.`,
      quote: null,
    },
  };

  const cfg = configs[activityType] || configs.media_comment;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${cfg.heading} - BMS Engage</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7fafc;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background:#f7fafc;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" style="width:100%;max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);">
        <tr>
          <td style="padding:40px 48px 32px;text-align:center;background:linear-gradient(135deg,#410179 0%,#6d28d9 100%);">
            <div style="font-size:48px;margin-bottom:12px;">${cfg.icon}</div>
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">${cfg.heading}</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">BMS Engage</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px;">
            <p style="margin:0 0 8px;color:#4a5568;font-size:15px;">Hi <strong>${toName}</strong>,</p>
            <p style="margin:0 0 24px;color:#4a5568;font-size:15px;line-height:1.6;">${cfg.body}</p>
            ${cfg.quote ? `<div style="background:#f0f4ff;border-left:4px solid #410179;padding:16px 20px;border-radius:8px;margin:0 0 28px;"><p style="margin:0;color:#2d3748;font-size:14px;font-style:italic;">"${cfg.quote}"</p></div>` : ''}
            <table role="presentation" style="width:100%;margin:0 0 28px;">
              <tr><td align="center">
                <a href="${process.env.FRONTEND_URL}/gallery" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#410179 0%,#6d28d9 100%);color:#fff;text-decoration:none;border-radius:12px;font-size:14px;font-weight:700;">View Asset</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 48px;background:#f7fafc;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;color:#a0aec0;font-size:12px;">© ${new Date().getFullYear()} BMS Engage. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: toEmail,
      subject: cfg.subject,
      html,
    });
    console.log(`✓ Media activity email (${activityType}) sent to ${toEmail}: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending media activity email:', error);
  }
};

module.exports.sendMediaShareEmail = sendMediaShareEmail;
module.exports.sendMediaActivityEmail = sendMediaActivityEmail;

// Send team invite email
const sendTeamInviteEmail = async (toEmail, toName, inviterName, agencyName) => {
  try {
    const transporter = createTransporter();
    const settingsUrl = `${process.env.FRONTEND_URL}/settings?tab=invitations`;
    const html = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Team Invitation - BMS Engage</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7fafc;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background:#f7fafc;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" style="width:100%;max-width:600px;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);">
        <tr>
          <td style="padding:40px 48px 32px;text-align:center;background:linear-gradient(135deg,#410179 0%,#6d28d9 100%);">
            <div style="font-size:48px;margin-bottom:12px;">🏢</div>
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;">Team Invitation</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">BMS Engage</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 48px;">
            <p style="margin:0 0 16px;color:#4a5568;font-size:16px;">Hi <strong>${toName}</strong>,</p>
            <p style="margin:0 0 24px;color:#4a5568;font-size:15px;line-height:1.6;">
              <strong>${inviterName}</strong> has invited you to join <strong>"${agencyName}"</strong> as a team member on BMS Engage.
            </p>
            <div style="background:#f0f4ff;border-left:4px solid #410179;padding:16px 20px;border-radius:8px;margin:0 0 28px;">
              <p style="margin:0;color:#2d3748;font-size:14px;">As a team member, you'll collaborate on media assets, posts, and campaigns together.</p>
            </div>
            <table role="presentation" style="width:100%;margin:0 0 20px;">
              <tr><td align="center">
                <a href="${settingsUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#410179 0%,#6d28d9 100%);color:#fff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:700;">View Invitation</a>
              </td></tr>
            </table>
            <p style="margin:0;color:#718096;font-size:13px;text-align:center;">You can accept or decline from your Settings → Invitations page.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 48px;background:#f7fafc;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;color:#a0aec0;font-size:12px;">© ${new Date().getFullYear()} BMS Engage. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: toEmail,
      subject: `${inviterName} invited you to join "${agencyName}" on BMS Engage`,
      html,
    });
    console.log(`✓ Team invite email sent to ${toEmail}: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending team invite email:', error);
  }
};

module.exports.sendTeamInviteEmail = sendTeamInviteEmail;
