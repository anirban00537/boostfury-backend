import { TransportInterface } from './transport.interface';
import { createTransport, Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { SmtpConfig } from '../../configs/config.interface';
import { Options as MailOptions } from 'nodemailer/lib/mailer';

export class SmtpTransport implements TransportInterface {
  private smtpTransporter: Transporter<SMTPTransport.SentMessageInfo>;
  async send(payload: MailOptions, smtpConfig: SmtpConfig) {
    this.initMailer(smtpConfig);
    return await this.smtpTransporter.sendMail(payload);
  }

  initMailer(smtpConfig: SmtpConfig) {
    if (!this.smtpTransporter) {
      this.smtpTransporter = createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.port === 465,
        auth: {
          user: smtpConfig.username,
          pass: smtpConfig.password,
        },
      });
    }
  }
}
