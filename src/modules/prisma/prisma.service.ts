import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'stdout', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'info' },
      ],
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async onModuleInit() {
    await this.$connect();

    this.$use(async (params, next) => {
      const before = Date.now();
      const result = await next(params);
      const after = Date.now();
      const duration = after - before;

      if (process.env.QUERY_DEBUG === 'true') {
        this.logger.debug(`Query ${params.model}.${params.action} took ${duration}ms`);
        if (params.args) {
          this.logger.debug(`Args: ${JSON.stringify(params.args)}`);
        }
      }

      return result;
    });
  }

  async enableShutdownHooks(app: INestApplication) {
    this.logger.log('Enabling shutdown hooks');
    
    process.on('beforeExit', async () => {
      this.logger.log('beforeExit hook triggered');
      await app.close();
    });
  }
}
