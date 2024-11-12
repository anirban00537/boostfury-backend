import { Type } from '@nestjs/common';
import { User } from '@prisma/client';
import { emailAppName } from 'src/shared/helpers/functions';
import { MessageInterface } from 'src/shared/mail/messages/message.interface';
import { ChannelInterface } from 'src/shared/notification/chanels/channel.interface';
import { MailChannel } from 'src/shared/notification/chanels/mail.channel';
import { NotificationInterface } from 'src/shared/notification/notification.interface';
import { NotificationTemplate } from 'src/shared/notification/notification.template';

export class SignupVerificationMailNotification
  implements NotificationInterface
{
  data: any;
  constructor(data) {
    this.data = data;
  }

  broadcastOn(): Type<ChannelInterface>[] {
    return [MailChannel];
  }

  async toMail(notifiable: User): Promise<MessageInterface> {
    return (
      await NotificationTemplate.toEmail('otp_email.html', {
        subject: (await emailAppName()) + ' ' + 'Email Verification',
        title: 'Email Verification',
        name: `${notifiable.user_name || notifiable.unique_code}`,
        email: notifiable.email,
        verification_code: this.data.verification_code,
      })
    ).to(notifiable.email);
  }

  queueable(): boolean {
    return false;
  }
}
