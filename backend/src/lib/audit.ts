import { prisma } from "./prisma.js";

type AuditEventInput = {
  userId?: string | null;
  eventType: string;
  success: boolean;
  metadata?: Record<string, unknown>;
};

export async function writeAuditEvent(input: AuditEventInput) {
  try {
    await prisma.auditEvent.create({
      data: {
        userId: input.userId ?? null,
        action: input.eventType,
        details: {
          success: input.success,
          ...(input.metadata ? { metadata: input.metadata } : {}),
        },
      },
    });
  } catch (error) {
    // Audit failures should not crash the API.
    console.error("audit_event_write_failed", error);
  }
}
