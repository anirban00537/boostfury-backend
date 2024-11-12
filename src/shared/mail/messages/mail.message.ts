import { Address, Options } from "nodemailer/lib/mailer";
import { MessageInterface } from "./message.interface";

export class MailMessage implements MessageInterface {
  private tTo: string | Address | Array<string | Address> | undefined;
  private tBcc: string | Address | Array<string | Address> | undefined;
  private tCc: string | Address | Array<string | Address> | undefined;
  private tFrom: string | Address | undefined;
  private tPriority: 'high' | 'normal' | 'low' | undefined;
  private tReplyTo: string | Address | undefined;
  private tSender: string | Address | undefined;
  private tSubject: string | undefined;

  constructor(private message: string) {}

  bcc(address: string | Address | Array<string | Address>): MessageInterface {
    this.tBcc = address;
    return this;
  }

  cc(address: string | Address | Array<string | Address>): MessageInterface {
    this.tCc = address;
    return this;
  }

  from(address: string | Address): MessageInterface {
    this.tFrom = address;
    return this;
  }

  priority(level: 'high' | 'normal' | 'low'): MessageInterface {
    this.tPriority = level;
    return this;
  }

  replyTo(address: string | Address): MessageInterface {
    this.tReplyTo = address;
    return this;
  }

  sender(address: string | Address): MessageInterface {
    this.tSender = address;
    return this;
  }

  subject(subject: string): MessageInterface {
    this.tSubject = subject;
    return this;
  }

  to(address: string | Address | Array<string | Address>): MessageInterface {
    this.tTo = address;
    return this;
  }
    async toTransporter(): Promise<Options> {
        return {
          from: this.tFrom,
          sender: this.tSender,
          to: this.tTo,
          cc: this.tCc,
          bcc: this.tBcc,
          replyTo: this.tReplyTo,
          subject: this.tSubject || 'Test Mail',
          priority: this.tPriority,
          html: this.message,
        };
    }
}