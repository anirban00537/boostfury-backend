import { BadRequestException, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { coreConstant } from '../helpers/coreConstant';

export class ApiSecretCheckMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const appUrl = req.originalUrl;
    const arr = appUrl.split('/');
    if (
      (arr[1] && arr[1] === `${coreConstant.FILE_DESTINATION}`) ||
      appUrl.startsWith('/api/subscription/webhook')
    ) {
      next();
    } else {
      // if (req.headers['apisecretkeycheck'] !== process.env.API_SECRET) {
      //   throw new BadRequestException('invalid secret key');
      // }
      next();
    }
  }
}
