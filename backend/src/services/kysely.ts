import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import {
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  sql,
} from 'kysely';
import kyselyExtension from 'prisma-extension-kysely';
import type { DB } from '../db/types';

export const kysely = { sql };

export const inTransactionAls = new AsyncLocalStorage<{
  inTransaction?: boolean;
  kysely?: Kysely<DB>;
}>();

export const prismaKyselyExtension = kyselyExtension({
  kysely: driver =>
    new Kysely<DB>({
      dialect: {
        createDriver: () => driver,
        createAdapter: () => new MysqlAdapter(),
        createIntrospector: db => new MysqlIntrospector(db),
        createQueryCompiler: () => new MysqlQueryCompiler(),
      },
    }),
});

/** Returns a Kysely client bound to this PrismaClient's connection. */
export function withKysely(ctx: { prisma: PrismaClient }): Kysely<DB> {
  const kyselyFromStore = inTransactionAls.getStore()?.kysely;
  if (kyselyFromStore) return kyselyFromStore;
  return ctx.prisma.$extends(prismaKyselyExtension).$kysely;
}
