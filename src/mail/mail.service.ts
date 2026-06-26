import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import * as React from 'react';
import VerificationEmail from './templates/verification-email';
import PasswordResetEmail from './templates/password-reset-email';
import DriverInvitationEmail from './templates/driver-invitation-email';
import DriverAssignedEmail from './templates/driver-assigned-email';
import CounterOfferEmail from './templates/counter-offer-email';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY || 're_A7ajz8ch_Mv5tANQbg7C9QyYAduSix2k9');
  }

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    // Helpful for testing when Resend is unavailable or restricted
    this.logger.debug(`\n🔑 [OTP LOG] Verification code for ${email} is: ${code}\n`);

    try {
      const html = await render(React.createElement(VerificationEmail, { code }));
      
      const data = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Verify Your Email - Deliverse',
        html,
      });

      this.logger.log(`Verification email sent to ${email}, id: ${data.data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}`, error);
    }
  }

  async sendPasswordResetEmail(email: string, code: string): Promise<void> {
    // Helpful for testing when Resend is unavailable or restricted
    this.logger.debug(`\n🔑 [OTP LOG] Password reset code for ${email} is: ${code}\n`);

    try {
      const html = await render(React.createElement(PasswordResetEmail, { code }));
      
      const data = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: 'Reset Your Password - Deliverse',
        html,
      });

      this.logger.log(`Password reset email sent to ${email}, id: ${data.data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}`, error);
    }
  }

  async sendDriverInvitationEmail(email: string, operatorName: string, inviteToken: string): Promise<void> {
    // Helpful for testing when Resend is unavailable or restricted
    this.logger.debug(`\n💌 [INVITE LOG] Driver invite token for ${email} from ${operatorName} is: ${inviteToken}\n`);

    try {
      const html = await render(React.createElement(DriverInvitationEmail, { operatorName, inviteToken }));
      
      const data = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: `You've been invited by ${operatorName} to drive on Deliverse`,
        html,
      });

      this.logger.log(`Driver invitation email sent to ${email}, id: ${data.data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send driver invitation email to ${email}`, error);
    }
  }

  async sendDriverAssignedEmail(email: string, driverName: string, orderNumber: string, pickupAddress: string, dropoffAddress: string): Promise<void> {
    try {
      const html = await render(React.createElement(DriverAssignedEmail, { driverName, orderNumber, pickupAddress, dropoffAddress }));
      
      const data = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: `New Delivery Assigned: #${orderNumber.substring(0,8)}`,
        html,
      });

      this.logger.log(`Driver assigned email sent to ${email}, id: ${data.data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send driver assigned email to ${email}`, error);
    }
  }

  async sendCounterOfferEmail(email: string, userName: string, orderNumber: string, price: number, operatorName: string, note?: string): Promise<void> {
    try {
      const html = await render(React.createElement(CounterOfferEmail, { userName, orderNumber, price, note, operatorName }));
      
      const data = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: `New Price Offer for Order #${orderNumber.substring(0,8)}`,
        html,
      });

      this.logger.log(`Counter offer email sent to ${email}, id: ${data.data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send counter offer email to ${email}`, error);
    }
  }
}

