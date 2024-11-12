import { Injectable } from "@nestjs/common";
import { MailConfig } from '../configs/config.interface';
import { ModuleRef } from "@nestjs/core";
import { ConfigService } from '@nestjs/config';
import { MessageInterface } from "./messages/message.interface";
import { TransportInterface } from "./transports/transport.interface";
import { transports } from "./transports";


@Injectable()
export class MailService { 
  private mailConfig: MailConfig;
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly configService: ConfigService,
  ) {
    this.mailConfig = this.configService.get<MailConfig>('mail');
  }

  async send(message: MessageInterface) {
    // const mailSettings = await getSettingsGroup([SETTINGS_GROUP.EMAIL]);
    const defaultMailer = this.mailConfig.defaultMailer;
    const mailConfig = {
      host: this.mailConfig.mailers[defaultMailer].host,
      port: Number(this.mailConfig.mailers[defaultMailer].port),
      username: this.mailConfig.mailers[defaultMailer].username,
      password: this.mailConfig.mailers[defaultMailer].password,
      encryption: this.mailConfig.mailers[defaultMailer].encryption,
    };
    const transport: TransportInterface = await this.resolveTransport(defaultMailer);
    const data = await message.toTransporter();
    if (!data.from) {
      data.from = this.mailConfig.from;
    }
    return await transport.send(data, mailConfig);
  }

  resolveTransport(defaultMailer) {
    return this.moduleRef.create(transports[defaultMailer]);
  }

    // async sendMail(mailData: mailMessageFormat) {
    //     try {
    //       // Generate test SMTP service account from ethereal.email
    //       // Only needed if you don't have a real mail account for testing
    //       //   let testAccount = await nodemailer.createTestAccount();

    //       // create reusable transporter object using the default SMTP transport
    //       const transporter = nodemailer.createTransport({
    //         host: mailConfig.host,
    //         port: mailConfig.port,
    //         secure: false, // true for 465, false for other ports
    //         auth: {
    //           user: mailConfig.user, // generated ethereal user
    //           pass: mailConfig.password, // generated ethereal password
    //         },
    //       });

    //       // send mail with defined transport object
    //       const send = await transporter.sendMail({
    //         from: mailConfig.from_name + '<' + mailConfig.from_address + '>', // sender address
    //         to: mailData.to, // list of receivers
    //         subject: mailData.subject, // Subject line
    //         // text: mailData.text, // plain text body
    //         html: '<b>Hello world?</b>', // html body
    //       });
    //         if (send) {
    //           console.log('Message sent info : %s', send);
    //           console.log('Message sent: %s', send.messageId);
    //           // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

    //           // Preview only available when sending through an Ethereal account
    //           console.log(
    //             'Preview URL: %s',
    //             nodemailer.getTestMessageUrl(send),
    //           );
    //           // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
    //         }

    //     } catch (err) {
    //         console.log(err)
    //     }
    // }
}