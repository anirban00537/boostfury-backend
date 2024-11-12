import { Injectable, Type } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { NotificationInterface } from "./notification.interface";
import { User } from "@prisma/client";
import { ChannelInterface } from "./chanels/channel.interface";

@Injectable()
export class NotificationService {
  constructor(private moduleRef: ModuleRef) {}

  send(notification: NotificationInterface, notifiable: User): Promise<any> {
    const channels = notification.broadcastOn();
    return Promise.all(
      channels.map(async (channel: Type<ChannelInterface>) => {
        const channelObj: ChannelInterface = await this.resolveChannel(channel);
        await channelObj.send(notifiable, notification);
      }),
    );
  }

  /**
   * Resolve the channel needed to send the Notification
   * @param channel
   * @return Promise<ChannelInterface>
   */
  private async resolveChannel(channel: Type<ChannelInterface>) {
    return this.moduleRef.create(channel);
  }
}