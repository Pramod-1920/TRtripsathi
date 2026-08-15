import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type {
  AuthChallengeChannel,
  AuthChallengePurpose,
} from './schemas/auth-challenge.schema';

@Injectable()
export class AuthCodeDeliveryService {
  private smtpTransport?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {}

  async send(
    channel: AuthChallengeChannel,
    destination: string,
    code: string,
    purpose: AuthChallengePurpose,
  ) {
    if (this.isTestMode()) return;
    if (channel === 'email') {
      await this.sendEmail(destination, code, purpose);
      return;
    }
    await this.sendSms(destination, code, purpose);
  }

  isTestMode() {
    return (
      process.env.NODE_ENV !== 'production' &&
      this.config.get<string>('AUTH_OTP_TEST_MODE') === 'true'
    );
  }

  private label(purpose: AuthChallengePurpose) {
    return purpose === 'reset_password'
      ? 'reset your TripSathi password'
      : 'verify your TripSathi account';
  }

  private async sendEmail(
    destination: string,
    code: string,
    purpose: AuthChallengePurpose,
  ) {
    const smtpUser = (
      this.config.get<string>('email') ||
      this.config.get<string>('EMAIL') ||
      this.config.get<string>('EMAIL_USER')
    )?.trim();
    const smtpPassword = (
      this.config.get<string>('email_app_password') ||
      this.config.get<string>('EMAIL_APP_PASSWORD')
    )?.replace(/\s+/g, '');

    if (smtpUser && smtpPassword) {
      this.smtpTransport ??= nodemailer.createTransport({
        host:
          this.config.get<string>('EMAIL_SMTP_HOST')?.trim() ||
          'smtp.gmail.com',
        port: Number(this.config.get<string>('EMAIL_SMTP_PORT') || 465),
        secure:
          Number(this.config.get<string>('EMAIL_SMTP_PORT') || 465) === 465,
        auth: { user: smtpUser, pass: smtpPassword },
        connectionTimeout: 8_000,
        greetingTimeout: 8_000,
        socketTimeout: 10_000,
      });
      await this.smtpTransport.sendMail({
        from: `"TripSathi" <${smtpUser}>`,
        to: destination,
        subject: 'Your 6-digit TripSathi security code',
        text: `Your TripSathi code is ${code}. Use it to ${this.label(purpose)}. It expires in 3 minutes. Never share this code.`,
        html: `<p>Your TripSathi security code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>Use it to ${this.label(purpose)}. It expires in <strong>3 minutes</strong>. Never share this code.</p>`,
      });
      return;
    }

    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    const from = this.config.get<string>('AUTH_EMAIL_FROM')?.trim();
    if (!apiKey || !from) {
      throw new ServiceUnavailableException(
        'Email verification is temporarily unavailable',
      );
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [destination],
        subject: 'Your TripSathi security code',
        text: `Use ${code} to ${this.label(purpose)}. It expires in 3 minutes. TripSathi will never ask you to share this code.`,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Email verification is temporarily unavailable',
      );
    }
  }

  private async sendSms(
    destination: string,
    code: string,
    purpose: AuthChallengePurpose,
  ) {
    const accountSid = this.config
      .get<string>('TWILIO_ACCOUNT_SID')
      ?.trim();
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN')?.trim();
    const from = this.config.get<string>('TWILIO_FROM_PHONE')?.trim();
    if (!accountSid || !authToken || !from) {
      throw new ServiceUnavailableException(
        'SMS verification is temporarily unavailable',
      );
    }

    const body = new URLSearchParams({
      From: from,
      To: destination,
      Body: `TripSathi code: ${code}. Use it to ${this.label(purpose)}. Expires in 3 minutes. Do not share it.`,
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'SMS verification is temporarily unavailable',
      );
    }
  }
}
