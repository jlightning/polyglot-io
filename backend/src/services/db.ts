import { PrismaClient } from '@prisma/client';

type BaseContext = {
  prisma: PrismaClient;
  transactionController?: TransactionController;
};

export type PrismaClientInTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
>;

export type TransactionController = {
  addBeforeCommitHook: (fn: () => Promise<void>) => void;
  addAfterCommitHook: (fn: () => Promise<void>) => void;
};

// wrap function inside transaction
export const wrapInTransaction = async <T extends BaseContext, G>(
  ctx: T,
  handleFn: (
    ctx: T & {
      prisma: PrismaClientInTransaction;
      transactionController: TransactionController;
    }
  ) => Promise<G>,
  options?: { maxWait: number; timeout: number }
): Promise<G> => {
  const inTransactionHooks = <(() => Promise<void>)[]>[];
  const outTransactionHooks = <(() => Promise<void>)[]>[];
  const transactionController = {
    addBeforeCommitHook: (fn: () => Promise<void>) => {
      inTransactionHooks.push(fn);
    },
    addAfterCommitHook: (fn: () => Promise<void>) => {
      outTransactionHooks.push(fn);
    },
  };

  // check if ctx.prisma has property $transaction and is it function
  if (
    !ctx.prisma.$transaction ||
    typeof ctx.prisma.$transaction !== 'function'
  ) {
    if (ctx.transactionController) {
      return handleFn({
        ...ctx,
        transactionController: ctx.transactionController,
      });
    }

    const result = await handleFn({ ...ctx, transactionController });

    for (const hook of inTransactionHooks) {
      await hook();
    }

    for (const hook of outTransactionHooks) {
      await hook();
    }

    return result;
  }

  if (!options) options = { maxWait: 5000, timeout: 30000 };

  const result = await ctx.prisma.$transaction(async newPrisma => {
    const _result = await handleFn({
      ...ctx,
      prisma: newPrisma,
      transactionController,
    });

    for (const hook of inTransactionHooks) {
      await hook();
    }

    return _result;
  }, options);

  for (const hook of outTransactionHooks) {
    await hook();
  }

  return result;
};
