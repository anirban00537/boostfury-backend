import { Injectable } from '@nestjs/common';
import {
  Environment,
  LogLevel,
  Paddle,
  PaddleOptions,
} from '@paddle/paddle-node-sdk';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaddleUtil {
  private paddle: Paddle;

  constructor(private configService: ConfigService) {
    const paddleOptions: PaddleOptions = {
      environment:
        this.configService.get('NODE_ENV') === 'production'
          ? Environment.production
          : Environment.sandbox,
      logLevel: LogLevel.error,
    };

    const apiKey = this.configService.get('PADDLE_API_KEY');
    if (!apiKey) {
      console.error('Paddle API key is missing');
    }

    this.paddle = new Paddle(apiKey, paddleOptions);
  }

  getInstance(): Paddle {
    return this.paddle;
  }
}
