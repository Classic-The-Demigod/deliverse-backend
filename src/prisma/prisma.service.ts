import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const rawConnectionString =
      configService.getOrThrow<string>('DATABASE_URL');
    try {
      require('fs').writeFileSync('db-connection-debug.log', `DATABASE_URL resolved by NestJS: ${rawConnectionString}\nTimestamp: ${new Date().toISOString()}`);
    } catch (e) {}
    const { connectionString, schema } =
      normalizeConnectionString(rawConnectionString);
    const adapter = schema
      ? new PrismaPg({ connectionString }, { schema })
      : new PrismaPg({ connectionString });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

function normalizeConnectionString(
  connectionString: string,
): { connectionString: string; schema?: string } {
  try {
    const url = new URL(connectionString);
    const schema = url.searchParams.get('schema') ?? undefined;

    if (schema) {
      url.searchParams.delete('schema');
    }

    return { connectionString: url.toString(), schema };
  } catch {
    return { connectionString };
  }
}
