import { Type } from "@nestjs/common";
import { ChannelInterface } from "./chanels/channel.interface";

export interface NotificationInterface {
    broadcastOn(): Type<ChannelInterface>[];
    queueable(): boolean;
}