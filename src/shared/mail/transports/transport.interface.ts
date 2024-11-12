import { Options as MailOptions } from "nodemailer/lib/mailer";
import { SmtpConfig } from '../../configs//config.interface';

export interface TransportInterface {
  send(message: MailOptions, config: SmtpConfig);
}