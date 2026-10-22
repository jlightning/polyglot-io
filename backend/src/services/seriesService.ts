import { Prisma } from '@prisma/client';
import type { Context } from './index';
import { wrapInTransaction } from './db';

export class SeriesService {
  async createSeries(
    ctx: Context,
    userId: number,
    data: { title: string; languageCode: string }
  ) {
    try {
      const series = await wrapInTransaction(ctx, async txCtx => {
        const created = await txCtx.prisma.series.create({
          data: {
            created_by: userId,
            title: data.title,
            language_code: data.languageCode,
          },
        });
        await txCtx.prisma.seriesUser.create({
          data: {
            series_id: created.id,
            user_id: userId,
          },
        });
        return created;
      });

      return {
        success: true,
        message: 'Series created successfully',
        series: {
          id: series.id,
          title: series.title,
          languageCode: series.language_code,
          lessonCount: 0,
          createdAt: series.created_at,
        },
      };
    } catch (error) {
      console.error('Create series error:', error);
      return {
        success: false,
        message: 'Failed to create series',
      };
    }
  }

  async getSeriesByLanguage(
    ctx: Context,
    userId: number,
    languageCode: string,
    lessonId?: number,
    search?: string
  ) {
    try {
      const where: Prisma.SeriesWhereInput = {
        language_code: languageCode,
        seriesUsers: { some: { user_id: userId } },
      };

      if (search) {
        const escaped = search.replace(/[\\%_]/g, char => `\\${char}`);
        const matched = await ctx.prisma.$queryRaw<{ id: number }[]>`
          SELECT series.id FROM series
          INNER JOIN series_user ON series_user.series_id = series.id
          WHERE series_user.user_id = ${userId}
            AND series.language_code = ${languageCode}
            AND LOWER(series.title) LIKE CONCAT('%', LOWER(${escaped}), '%')
        `;
        const ids = matched.map(row => Number(row.id));
        if (ids.length === 0) {
          return {
            success: true,
            message: 'Series retrieved successfully',
            series: [],
          };
        }
        where.id = { in: ids };
      }

      const rows = await ctx.prisma.series.findMany({
        where,
        orderBy: { id: 'desc' },
        include: {
          _count: { select: { seriesLessons: true } },
        },
      });

      const containedSeriesIds = new Set<number>();
      if (lessonId !== undefined && rows.length > 0) {
        const memberships = await ctx.prisma.seriesLesson.findMany({
          where: {
            lesson_id: lessonId,
            series_id: { in: rows.map(row => row.id) },
          },
          select: { series_id: true },
        });
        for (const membership of memberships) {
          containedSeriesIds.add(membership.series_id);
        }
      }

      return {
        success: true,
        message: 'Series retrieved successfully',
        series: rows.map(row => ({
          id: row.id,
          title: row.title,
          languageCode: row.language_code,
          lessonCount: row._count.seriesLessons,
          createdAt: row.created_at,
          ...(lessonId !== undefined
            ? { containsLesson: containedSeriesIds.has(row.id) }
            : {}),
        })),
      };
    } catch (error) {
      console.error('Get series by language error:', error);
      return {
        success: false,
        message: 'Failed to retrieve series',
      };
    }
  }

  async getSeriesById(ctx: Context, userId: number, seriesId: number) {
    try {
      const series = await ctx.prisma.series.findFirst({
        where: {
          id: seriesId,
          seriesUsers: { some: { user_id: userId } },
        },
        include: {
          seriesLessons: {
            orderBy: { position: 'asc' },
            include: {
              lesson: {
                select: {
                  id: true,
                  title: true,
                  lesson_type: true,
                  processing_status: true,
                },
              },
            },
          },
        },
      });

      if (!series) {
        return {
          success: false,
          message: 'Series not found or access denied',
        };
      }

      return {
        success: true,
        message: 'Series retrieved successfully',
        series: {
          id: series.id,
          title: series.title,
          languageCode: series.language_code,
          createdAt: series.created_at,
          lessons: series.seriesLessons.map(row => ({
            id: row.lesson.id,
            title: row.lesson.title,
            lessonType: row.lesson.lesson_type,
            processingStatus: row.lesson.processing_status,
            position: row.position,
          })),
        },
      };
    } catch (error) {
      console.error('Get series by id error:', error);
      return {
        success: false,
        message: 'Failed to retrieve series',
      };
    }
  }

  async updateSeries(
    ctx: Context,
    userId: number,
    seriesId: number,
    data: { title: string }
  ) {
    try {
      const updated = await ctx.prisma.series.updateMany({
        where: { id: seriesId, created_by: userId },
        data: { title: data.title },
      });
      if (updated.count === 0) {
        return {
          success: false,
          message: 'Series not found or access denied',
        };
      }

      return {
        success: true,
        message: 'Series updated successfully',
        series: {
          id: seriesId,
          title: data.title,
        },
      };
    } catch (error) {
      console.error('Update series error:', error);
      return {
        success: false,
        message: 'Failed to update series',
      };
    }
  }

  async deleteSeries(ctx: Context, userId: number, seriesId: number) {
    try {
      const series = await ctx.prisma.series.findFirst({
        where: { id: seriesId, created_by: userId },
        select: { id: true },
      });
      if (!series) {
        return {
          success: false,
          message: 'Series not found or access denied',
        };
      }

      await wrapInTransaction(ctx, async txCtx => {
        await txCtx.prisma.seriesLesson.deleteMany({
          where: { series_id: seriesId },
        });
        await txCtx.prisma.seriesUser.deleteMany({
          where: { series_id: seriesId },
        });
        await txCtx.prisma.series.delete({
          where: { id: seriesId },
        });
      });

      return {
        success: true,
        message: 'Series deleted successfully',
      };
    } catch (error) {
      console.error('Delete series error:', error);
      return {
        success: false,
        message: 'Failed to delete series',
      };
    }
  }

  async addLesson(
    ctx: Context,
    userId: number,
    seriesId: number,
    lessonId: number
  ) {
    try {
      const series = await ctx.prisma.series.findFirst({
        where: { id: seriesId, created_by: userId },
        select: { id: true, language_code: true },
      });
      if (!series) {
        return {
          success: false,
          message: 'Series not found or access denied',
        };
      }

      const lesson = await ctx.prisma.lesson.findFirst({
        where: {
          id: lessonId,
          created_by: userId,
          language_code: series.language_code,
        },
        select: { id: true },
      });
      if (!lesson) {
        return {
          success: false,
          message: 'Lesson not found or access denied',
        };
      }

      let alreadyInSeries = false;
      await wrapInTransaction(ctx, async txCtx => {
        const existing = await txCtx.prisma.seriesLesson.findFirst({
          where: { series_id: seriesId, lesson_id: lessonId },
          select: { id: true },
        });
        if (existing) {
          alreadyInSeries = true;
          return;
        }

        const last = await txCtx.prisma.seriesLesson.findFirst({
          where: { series_id: seriesId },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        await txCtx.prisma.seriesLesson.create({
          data: {
            series_id: seriesId,
            lesson_id: lessonId,
            position: last ? last.position + 1 : 1,
          },
        });
      });

      if (alreadyInSeries) {
        return {
          success: false,
          message: 'Lesson is already in this series',
        };
      }

      return {
        success: true,
        message: 'Lesson added to series',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return {
          success: false,
          message: 'Lesson is already in this series',
        };
      }
      console.error('Add lesson to series error:', error);
      return {
        success: false,
        message: 'Failed to add lesson to series',
      };
    }
  }

  async removeLesson(
    ctx: Context,
    userId: number,
    seriesId: number,
    lessonId: number
  ) {
    try {
      const series = await ctx.prisma.series.findFirst({
        where: { id: seriesId, created_by: userId },
        select: { id: true },
      });
      if (!series) {
        return {
          success: false,
          message: 'Series not found or access denied',
        };
      }

      const removed = await ctx.prisma.seriesLesson.deleteMany({
        where: { series_id: seriesId, lesson_id: lessonId },
      });
      if (removed.count === 0) {
        return {
          success: false,
          message: 'Lesson is not in this series',
        };
      }

      return {
        success: true,
        message: 'Lesson removed from series',
      };
    } catch (error) {
      console.error('Remove lesson from series error:', error);
      return {
        success: false,
        message: 'Failed to remove lesson from series',
      };
    }
  }

  async moveLesson(
    ctx: Context,
    userId: number,
    seriesId: number,
    lessonId: number,
    direction: 'up' | 'down'
  ) {
    try {
      const series = await ctx.prisma.series.findFirst({
        where: { id: seriesId, created_by: userId },
        select: { id: true },
      });
      if (!series) {
        return {
          success: false,
          message: 'Series not found or access denied',
        };
      }

      const current = await ctx.prisma.seriesLesson.findFirst({
        where: { series_id: seriesId, lesson_id: lessonId },
      });
      if (!current) {
        return {
          success: false,
          message: 'Lesson is not in this series',
        };
      }

      const neighbor = await ctx.prisma.seriesLesson.findFirst({
        where: {
          series_id: seriesId,
          position:
            direction === 'up'
              ? { lt: current.position }
              : { gt: current.position },
        },
        orderBy: { position: direction === 'up' ? 'desc' : 'asc' },
      });
      if (!neighbor) {
        return {
          success: true,
          message: 'Lesson order is unchanged',
        };
      }

      await wrapInTransaction(ctx, async txCtx => {
        await txCtx.prisma.seriesLesson.update({
          where: { id: current.id },
          data: { position: neighbor.position },
        });
        await txCtx.prisma.seriesLesson.update({
          where: { id: neighbor.id },
          data: { position: current.position },
        });
      });

      return {
        success: true,
        message: 'Lesson moved',
      };
    } catch (error) {
      console.error('Move lesson in series error:', error);
      return {
        success: false,
        message: 'Failed to move lesson',
      };
    }
  }
}
