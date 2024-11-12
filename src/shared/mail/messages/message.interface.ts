import { Address, Options as MailOptions } from 'nodemailer/lib/mailer';

export interface MessageInterface {
  from(address: string | Address): MessageInterface;
  sender(address: string | Address): MessageInterface;
  to(address: string | Address | Array<string | Address>): MessageInterface;
  cc(address: string | Address | Array<string | Address>): MessageInterface;
  bcc(address: string | Address | Array<string | Address>): MessageInterface;
  replyTo(address: string | Address): MessageInterface;
  subject(subject: string): MessageInterface;
  priority(level: 'high' | 'normal' | 'low'): MessageInterface;
  toTransporter(): Promise<MailOptions>;
}
