import { compile } from 'handlebars';
import { MessageInterface } from '../mail/messages/message.interface';
import { createWriteStream, readFileSync } from 'fs';
import { resolve } from 'path';
import { MailMessage } from '../mail/messages/mail.message';
import { base_url, envAppName, exchange_app_url } from '../helpers/functions';

export class NotificationTemplate {
  static async toEmail(
    template: string,
    variables: any,
    fromUser: 'user' | 'staff' = 'user',
  ): Promise<MessageInterface> {
    try {
      variables['userFrom'] = fromUser;
      variables = await NotificationTemplate.getOtherVariables(variables);

      const { subject, content } = NotificationTemplate.resolve(
        'email',
        template,
        variables,
      );
      return new MailMessage(content).subject(subject);
    } catch (e) {
      console.log(e.stack);
    }
  }

  static async getOtherVariables(variables: any) {
    const settings = {};
    let settingObj = {};

    variables.settings = settingObj;

    variables.settings.logo = 'https://Buildsocialpost.com/logo.svg';
    variables.anti_phishing_code = 1;
    variables.exchange_app_url = exchange_app_url();
    variables.app_url = base_url();
    variables.app_name = envAppName();
    variables.date_time = new Date()
      .toString()
      .replace(/T/, ':')
      .replace(/\.\w*/, '');

    console.log('date');
    console.log(variables.date_time);
    variables.header_layout = compile(
      readFileSync(
        resolve(
          `src/notifications/${variables.userFrom}/templates/email/layouts/header.html`,
        ),
      ).toString(),
    )({
      settings: settingObj,

      exchange_app_url: variables.exchange_app_url,
    });

    variables.footer_layout = compile(
      readFileSync(
        resolve(
          `src/notifications/${variables.userFrom}/templates/email/layouts/footer.html`,
        ),
      ).toString(),
    )({
      settings: settingObj,
      app_url: variables.app_url,
      exchange_app_url: variables.exchange_app_url,
      app_name: variables.app_name,
      date_time: variables.date_time,
      anti_phising_code: variables.anti_phishing_code,
    });

    return variables;
  }

  static update(channel: string, template: string, payload: any) {
    createWriteStream(
      resolve(`src/notifications/templates/${channel}/${template}.json`),
    ).write(JSON.stringify(payload));
  }

  static get(channel: string, template: string) {
    try {
      const templatePayload = readFileSync(
        resolve(`src/notifications/templates/${channel}/${template}.json`),
      ).toString();
      return JSON.parse(templatePayload) ?? null;
    } catch (e) {
      console.error(e.stack);
      return null;
    }
  }

  static resolve(channel: string, template: string, variables: any) {
    const subject = variables.subject;
    let content = '';
    content += readFileSync(
      `src/notifications/${variables.userFrom}/templates/email/${template}`,
    ).toString();

    content = compile(content)(variables);
    content = NotificationTemplate.processDynamicHtml(content);
    return { subject, content };
  }

  static processDynamicHtml(content: string): string {
    content = content.replace(/&lt;/g, '<');
    content = content.replace(/&gt;/g, '>');
    content = content.replace(/&#x3D;/g, '=');
    content = content.replace(/&#x27;/g, "'");
    content = content.replace(/&quot;/g, '"');
    content = content.replace(/&amp;/g, '&');
    return content;
  }
}
