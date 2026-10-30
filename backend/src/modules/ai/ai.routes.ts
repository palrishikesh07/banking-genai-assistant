import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { env } from "../../config/env.js";
import { answerQuestion } from "./ai.service.js";

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.post("/ask", async (req, res, next) => {
  const parsed = z
    .object({
      question: z.string().trim().min(1).max(8000),
      conversationId: z.string().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Question must be 1-8000 characters",
    });
    return;
  }

  const userId = req.userId!;
  const requestId = randomUUID();
  const started = Date.now();

  let conversationId = parsed.data.conversationId;
  let usageRecordCreated = false;

  try {
    // Verify conversation ownership or create a new conversation.
    if (conversationId) {
      const ownedConversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
        select: {
          id: true,
        },
      });

      if (!ownedConversation) {
        res.status(404).json({
          error: "Conversation not found",
        });
        return;
      }
    } else {
      const conversation = await prisma.conversation.create({
        data: {
          userId,
          title: parsed.data.question.slice(0, 80),
        },
      });

      conversationId = conversation.id;
    }

    // Save the user's question.
    await prisma.message.create({
      data: {
        conversationId: conversationId!,
        role: "USER",
        content: parsed.data.question,
      },
    });

    // Create a usage record before processing the AI request.
    await prisma.aIUsage.create({
      data: {
        userId,
        conversationId,
        requestId,
        provider: env.OPENAI_API_KEY ? "openai" : "offline",
        model: env.OPENAI_API_KEY
          ? env.OPENAI_MODEL
          : "offline-demo",
        status: "PENDING",
      },
    });

    usageRecordCreated = true;

    // Generate the answer.
    const result = await answerQuestion(parsed.data.question);

    const latencyMs = Date.now() - started;

    const cost =
      (result.inputTokens / 1_000_000) *
        env.OPENAI_INPUT_USD_PER_1M +
      (result.outputTokens / 1_000_000) *
        env.OPENAI_OUTPUT_USD_PER_1M;

    const totalTokens =
      result.inputTokens + result.outputTokens;

    // Save the assistant response and update usage atomically.
    const message = await prisma.$transaction(async (tx) => {
      const assistantMessage = await tx.message.create({
        data: {
          conversationId: conversationId!,
          role: "ASSISTANT",
          content: result.answer,
          citations: result.citations.length
            ? JSON.parse(JSON.stringify(result.citations))
            : undefined,
        },
      });

      await tx.aIUsage.update({
        where: {
          requestId,
        },
        data: {
          provider: result.provider,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          totalTokens,
          estimatedCost: cost,
          latencyMs,
          status: "SUCCESS",
          completedAt: new Date(),
          errorMessage: null,
        },
      });

      await tx.conversation.update({
        where: {
          id: conversationId!,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      return assistantMessage;
    });

    res.json({
      requestId,
      conversationId,
      message,
      usage: {
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens,
        estimatedCostUsd: cost,
        latencyMs,
      },
    });
  } catch (error) {
    // Mark a previously created usage record as failed.
    if (usageRecordCreated) {
      await prisma.aIUsage
        .updateMany({
          where: {
            requestId,
          },
          data: {
            status: "FAILED",
            latencyMs: Date.now() - started,
            errorMessage: "AI_REQUEST_FAILED",
            completedAt: new Date(),
          },
        })
        .catch((updateError) => {
          console.error(
            "Failed to update AI usage record:",
            updateError,
          );
        });
    }

    next(error);
  }
});