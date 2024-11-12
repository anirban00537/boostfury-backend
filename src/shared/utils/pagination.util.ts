import { PrismaService } from '../../modules/prisma/prisma.service';

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  orderBy?: { [key: string]: 'asc' | 'desc' };
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

type PrismaModel = keyof Omit<
  PrismaService,
  | '$on'
  | '$connect'
  | '$disconnect'
  | '$use'
  | '$executeRaw'
  | '$executeRawUnsafe'
  | '$queryRaw'
  | '$queryRawUnsafe'
  | '$transaction'
>;

export async function paginatedQuery<T>(
  prisma: PrismaService,
  model: PrismaModel,
  where: any,
  options: PaginationOptions = {},
  include: any = {}
): Promise<PaginatedResult<T>> {
  const { page = 1, pageSize = 10, orderBy = {} } = options;
  const skip = (page - 1) * pageSize;

  const take = Number(pageSize);

  const finalOrderBy = Object.keys(orderBy).length === 0 ? { id: 'desc' } : orderBy;

  const [items, totalCount] = await Promise.all([
    (prisma[model] as any).findMany({
      where,
      skip,
      take,
      orderBy: finalOrderBy,
      include, // Use the include parameter directly
    }),
    (prisma[model] as any).count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    items,
    pagination: {
      currentPage: page,
      pageSize,
      totalCount,
      totalPages,
    },
  };
}
