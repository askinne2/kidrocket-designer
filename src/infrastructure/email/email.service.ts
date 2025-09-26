/**
 * Email Service
 * Simple email service implementation
 */

export class EmailService {
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    // Mock email service - in production integrate with SendGrid, AWS SES, etc.
    console.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
    console.log(`[EMAIL] Body: ${body}`);
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const subject = 'Verify your email address';
    const body = `Click here to verify: http://localhost:3000/verify?token=${token}`;
    await this.sendEmail(email, subject, body);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const subject = 'Reset your password';
    const body = `Click here to reset: http://localhost:3000/reset?token=${token}`;
    await this.sendEmail(email, subject, body);
  }
}
