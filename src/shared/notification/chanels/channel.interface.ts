import { User } from "@prisma/client";
import { NotificationInterface } from "../notification.interface";

export interface ChannelInterface {
    send(
        notifiable: User,
        notification: NotificationInterface,
    ): Promise<void>;
}