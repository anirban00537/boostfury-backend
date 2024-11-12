import { Injectable } from "@nestjs/common";
import { ChannelInterface } from "./channel.interface";
import { NotificationInterface } from "../notification.interface";
import { User } from "@prisma/client";
import { MailService } from "src/shared/mail/mail.service";
import { MessageInterface } from "src/shared/mail/messages/message.interface";


@Injectable()
export class MailChannel implements ChannelInterface{
    constructor(private readonly mailService: MailService) {}

    async send(
        notifiable: User,
        notification: NotificationInterface,
    ): Promise <any>{
        const mailMessage: MessageInterface = await this.getData(
            notifiable,
            notification,
        );
        return this.mailService.send(
            mailMessage.to({
                name: notifiable['first_name'] !== undefined
                    ? `${notifiable['first_name']} ${notifiable['last_name']}`
                    : notifiable['username'],
                address: notifiable.email
            }),
        );
    }
    
    private async getData(
        notifiable: User,
        notification: NotificationInterface,
    ): Promise<MessageInterface> {
        
        if(typeof notification['toMail'] === 'function') {
            return notification['toMail'](notifiable);
        }
        throw new Error('toMail method is missing into Notification class')
    }
}