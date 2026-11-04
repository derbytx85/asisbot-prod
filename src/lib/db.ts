import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function buildPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
    errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
  });
}

export const db =
  globalForPrisma.prisma ??
  buildPrismaClient();

db.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      try {
        return await query(args);
      } catch (err) {
        // Log error de conexión (sin filtrar credenciales)
        if (err instanceof Prisma.PrismaClientInitializationError ||
            err instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(`[Prisma][${model}.${operation}] Error:`, (err as Error).message?.slice(0, 200));
        }
        throw err;
      }
    },
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
