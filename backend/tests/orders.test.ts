import "dotenv/config";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { UserRole } from "@prisma/client";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";

const testKeys: string[] = [];

const payload = {
  customerName: "Concurrent Test Customer",
  email: "concurrent-test@example.com",
  items: [
    {
      productName: "Keyboard",
      quantity: 2,
      unitPrice: 1200.00,
    },
    {
      productName: "Mouse",
      quantity: 1,
      unitPrice: 650.00,
    },
  ],
};

async function ensureTestAgent() {
  return prisma.user.upsert({
    where: { email: "agent@sarh.local" },
    update: {},
    create: {
      name: "SARH Test Agent",
      email: "agent@sarh.local",
      passwordHash: "test-only-not-a-real-password-hash",
      role: UserRole.AGENT,
    },
  });
}

function createTestToken(userId: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be configured with at least 32 characters",
    );
  }

  return jwt.sign({}, secret, {
    algorithm: "HS256",
    subject: userId,
    expiresIn: "5m",
    issuer: "sarh-orders-api",
    audience: "sarh-orders-client",
  });
}

function authenticatedRequest(token: string) {
  return request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${token}`);
}

describe("POST /api/orders", () => {
  it("creates exactly one order for two concurrent identical requests", async () => {
    const agent = await ensureTestAgent();
    const token = createTestToken(agent.id);
    const key = `concurrent-${randomUUID()}`;

    testKeys.push(key);

    const sendRequest = () =>
      authenticatedRequest(token)
        .set("Idempotency-Key", key)
        .send(payload);

    const [first, second] = await Promise.all([
      sendRequest(),
      sendRequest(),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.order.id).toBe(second.body.order.id);

    const matchingOrders = await prisma.order.findMany({
      where: { idempotencyKey: key },
      include: { items: true },
    });

    expect(matchingOrders).toHaveLength(1);
    expect(matchingOrders[0].items).toHaveLength(2);
    expect(matchingOrders[0].totalAmount.toFixed(2)).toBe("3050.00");
  });

  it("rejects reusing an idempotency key with different data", async () => {
    const agent = await ensureTestAgent();
    const token = createTestToken(agent.id);
    const key = `different-payload-${randomUUID()}`;

    testKeys.push(key);

    const first = await authenticatedRequest(token)
      .set("Idempotency-Key", key)
      .send(payload);

    expect(first.status).toBe(201);

    const second = await authenticatedRequest(token)
      .set("Idempotency-Key", key)
      .send({
        ...payload,
        customerName: "Different Customer",
      });

    expect(second.status).toBe(409);

    const count = await prisma.order.count({
      where: { idempotencyKey: key },
    });

    expect(count).toBe(1);
  });

  it("rejects invalid order data", async () => {
    const agent = await ensureTestAgent();
    const token = createTestToken(agent.id);

    const response = await authenticatedRequest(token)
      .set("Idempotency-Key", `invalid-${randomUUID()}`)
      .send({
        customerName: "",
        email: "not-an-email",
        items: [],
      });

    expect(response.status).toBe(400);
  });

  it("rejects requests without an access token", async () => {
    const response = await request(app)
      .post("/api/orders")
      .set("Idempotency-Key", `unauthorized-${randomUUID()}`)
      .send(payload);

    expect(response.status).toBe(401);
  });
});

afterAll(async () => {
  for (const key of testKeys) {
    await prisma.order.deleteMany({
      where: { idempotencyKey: key },
    });
  }

  await prisma.$disconnect();
});