import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import {
  requireAdmin,
  requireAuth,
} from "../../middleware/requireAuth.js";

export const usageRouter = Router();

usageRouter.use(requireAuth);

const paging = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function dateWhere(
  userId: string,
  from?: string,
  to?: string,
) {
  return {
    userId,
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };
}

function isInvalidDateRange(from?: string, to?: string) {
  return Boolean(
    from &&
      to &&
      new Date(from).getTime() > new Date(to).getTime(),
  );
}

function serializeUsage<T extends { estimatedCost: unknown }>(
  usage: T,
) {
  const { estimatedCost, ...rest } = usage;

  return {
    ...rest,
    // Keep the API field name expected by the frontend.
    estimatedCostUsd: Number(estimatedCost ?? 0),
  };
}

// GET /api/usage/me
// Current user's usage summary and latest requests.
usageRouter.get("/me", async (req, res, next) => {
  try {
    const userId = req.userId!;

    const [aggregate, successfulRequests, failedRequests, recent] =
      await Promise.all([
        prisma.aIUsage.aggregate({
          where: { userId },
          _count: { _all: true },
          _sum: {
            inputTokens: true,
            outputTokens: true,
            totalTokens: true,
            estimatedCost: true,
          },
          _avg: { latencyMs: true },
        }),

        prisma.aIUsage.count({
          where: { userId, status: "SUCCESS" },
        }),

        prisma.aIUsage.count({
          where: { userId, status: "FAILED" },
        }),

        prisma.aIUsage.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            requestId: true,
            provider: true,
            model: true,
            inputTokens: true,
            outputTokens: true,
            totalTokens: true,
            estimatedCost: true,
            latencyMs: true,
            status: true,
            errorMessage: true,
            createdAt: true,
            conversationId: true,
          },
        }),
      ]);

    res.json({
      summary: {
        totalRequests: aggregate._count._all,
        successfulRequests,
        failedRequests,
        inputTokens: aggregate._sum.inputTokens ?? 0,
        outputTokens: aggregate._sum.outputTokens ?? 0,
        totalTokens: aggregate._sum.totalTokens ?? 0,
        estimatedCostUsd: Number(
          aggregate._sum.estimatedCost ?? 0,
        ),
        averageLatencyMs:
          aggregate._avg.latencyMs == null
            ? null
            : Math.round(aggregate._avg.latencyMs),
      },
      recentRequests: recent.map(serializeUsage),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/usage/me/requests
// Paginated request history with optional date filters.
usageRouter.get("/me/requests", async (req, res, next) => {
  const parsed = paging.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid date range or pagination",
    });
    return;
  }

  const { from, to, page, pageSize } = parsed.data;

  if (isInvalidDateRange(from, to)) {
    res.status(400).json({
      error: "from must be earlier than or equal to to",
    });
    return;
  }

  try {
    const where = dateWhere(req.userId!, from, to);

    const [total, rows] = await Promise.all([
      prisma.aIUsage.count({ where }),

      prisma.aIUsage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          requestId: true,
          provider: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          estimatedCost: true,
          latencyMs: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          conversationId: true,
        },
      }),
    ]);

    res.json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      requests: rows.map(serializeUsage),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/usage/me/summary
// Usage summary grouped by status, model, and day.
usageRouter.get("/me/summary", async (req, res, next) => {
  const parsed = dateRangeSchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid date range",
    });
    return;
  }

  const { from, to } = parsed.data;

  if (isInvalidDateRange(from, to)) {
    res.status(400).json({
      error: "from must be earlier than or equal to to",
    });
    return;
  }

  try {
    const where = dateWhere(req.userId!, from, to);

    const [aggregate, statuses, models, rows] =
      await Promise.all([
        prisma.aIUsage.aggregate({
          where,
          _count: { _all: true },
          _sum: {
            inputTokens: true,
            outputTokens: true,
            totalTokens: true,
            estimatedCost: true,
          },
          _avg: { latencyMs: true },
        }),

        prisma.aIUsage.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
        }),

        prisma.aIUsage.groupBy({
          by: ["provider", "model"],
          where,
          _count: { _all: true },
          _sum: {
            inputTokens: true,
            outputTokens: true,
            totalTokens: true,
            estimatedCost: true,
          },
        }),

        prisma.aIUsage.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 1000,
          select: {
            createdAt: true,
            inputTokens: true,
            outputTokens: true,
            estimatedCost: true,
            status: true,
          },
        }),
      ]);

    const days = new Map<
      string,
      {
        requests: number;
        inputTokens: number;
        outputTokens: number;
        estimatedCostUsd: number;
        failed: number;
      }
    >();

    for (const row of rows) {
      const date = row.createdAt.toISOString().slice(0, 10);

      const values = days.get(date) ?? {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        failed: 0,
      };

      values.requests += 1;
      values.inputTokens += row.inputTokens;
      values.outputTokens += row.outputTokens;
      values.estimatedCostUsd += Number(row.estimatedCost ?? 0);

      if (row.status === "FAILED") {
        values.failed += 1;
      }

      days.set(date, values);
    }

    res.json({
      summary: {
        totalRequests: aggregate._count._all,
        inputTokens: aggregate._sum.inputTokens ?? 0,
        outputTokens: aggregate._sum.outputTokens ?? 0,
        totalTokens: aggregate._sum.totalTokens ?? 0,
        estimatedCostUsd: Number(
          aggregate._sum.estimatedCost ?? 0,
        ),
        averageLatencyMs:
          aggregate._avg.latencyMs == null
            ? null
            : Math.round(aggregate._avg.latencyMs),
      },

      byStatus: statuses.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),

      byModel: models.map((item) => ({
        provider: item.provider,
        model: item.model,
        count: item._count._all,
        inputTokens: item._sum.inputTokens ?? 0,
        outputTokens: item._sum.outputTokens ?? 0,
        totalTokens: item._sum.totalTokens ?? 0,
        estimatedCostUsd: Number(
          item._sum.estimatedCost ?? 0,
        ),
      })),

      daily: [...days.entries()]
        .sort(([dateA], [dateB]) =>
          dateA.localeCompare(dateB),
        )
        .map(([date, values]) => ({
          date,
          ...values,
        })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/usage/admin
// Global usage statistics. Admin access required.
usageRouter.get("/admin", requireAdmin, async (_req, res, next) => {
  try {
    const [aggregate, users, models] = await Promise.all([
      prisma.aIUsage.aggregate({
        _count: { _all: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          estimatedCost: true,
        },
        _avg: { latencyMs: true },
      }),

      prisma.user.count(),

      prisma.aIUsage.groupBy({
        by: ["provider", "model", "status"],
        _count: { _all: true },
        _sum: {
          estimatedCost: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
      }),
    ]);

    res.json({
      users,
      totalRequests: aggregate._count._all,
      inputTokens: aggregate._sum.inputTokens ?? 0,
      outputTokens: aggregate._sum.outputTokens ?? 0,
      totalTokens: aggregate._sum.totalTokens ?? 0,
      estimatedCostUsd: Number(
        aggregate._sum.estimatedCost ?? 0,
      ),
      averageLatencyMs:
        aggregate._avg.latencyMs == null
          ? null
          : Math.round(aggregate._avg.latencyMs),

      byModel: models.map((item) => ({
        provider: item.provider,
        model: item.model,
        status: item.status,
        count: item._count._all,
        estimatedCostUsd: Number(
          item._sum.estimatedCost ?? 0,
        ),
        inputTokens: item._sum.inputTokens ?? 0,
        outputTokens: item._sum.outputTokens ?? 0,
        totalTokens: item._sum.totalTokens ?? 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});
