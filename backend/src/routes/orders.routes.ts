
import { Router } from "express";
import { Prisma, OrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth.middleware";
const ordersRouter = Router();
ordersRouter.use(requireAuth);
const validStatuses = Object.values(OrderStatus);
const validSortFields = ["createdAt", "totalAmount"] as const;

const createOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  items: z
    .array(
      z.object({
        productName: z.string().trim().min(1).max(120),
        quantity: z.number().int().min(1).max(1000),
        // Prices are strings to preserve decimal precision.
        unitPrice: z.number().finite().nonnegative(),
      }),
    )
    .min(1)
    .max(5),
});

function priceToCents(value: number | string): number {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid price");
  }

  return Math.round((amount + Number.EPSILON) * 100);
}

function normalizeItems(
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number | string;
  }>,
) {
  return items
    .map((item) => ({
      productName: item.productName.trim(),
      quantity: item.quantity,
      unitPriceCents: priceToCents(item.unitPrice),
    }))
    .sort((a, b) =>
      a.productName.localeCompare(b.productName),
    );
}

function sameRequest(
  existing: {
    customerName: string;
    email: string;
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
    }>;
  },
  incoming: z.infer<typeof createOrderSchema>,
) {
  const existingItems = normalizeItems(
    existing.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
    })),
  );

  const incomingItems = normalizeItems(incoming.items);

  return (
    existing.customerName === incoming.customerName &&
    existing.email.toLowerCase() === incoming.email.toLowerCase() &&
    JSON.stringify(existingItems) === JSON.stringify(incomingItems)
  );
}

// GET /api/orders
ordersRouter.get("/", async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const status =
      typeof req.query.status === "string"
        ? req.query.status
        : undefined;

    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);

    const sortBy =
      typeof req.query.sortBy === "string"
        ? req.query.sortBy
        : "createdAt";

    const sortOrder =
      typeof req.query.sortOrder === "string"
        ? req.query.sortOrder
        : "desc";

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      res.status(400).json({
        message: "page must be >= 1 and pageSize must be between 1 and 100",
      });
      return;
    }

    if (status && !validStatuses.includes(status as OrderStatus)) {
      res.status(400).json({ message: "Invalid order status" });
      return;
    }

    if (
      !validSortFields.includes(
        sortBy as (typeof validSortFields)[number],
      ) ||
      !["asc", "desc"].includes(sortOrder)
    ) {
      res.status(400).json({ message: "Invalid sorting options" });
      return;
    }

    const where: Prisma.OrderWhereInput = {
      ...(status ? { status: status as OrderStatus } : {}),
      ...(search
        ? {
            OR: [
              {
                customerName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * pageSize;

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { [sortBy]: sortOrder },
          { id: "desc" },
        ],
        select: {
          id: true,
          customerName: true,
          email: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      data: orders.map((order) => ({
        ...order,
        totalAmount: order.totalAmount.toString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// POST /api/orders
ordersRouter.post("/", async (req, res) => {
  const idempotencyKey = req.get("Idempotency-Key")?.trim();

  if (
    !idempotencyKey ||
    idempotencyKey.length > 200
  ) {
    res.status(400).json({
      message: "A valid Idempotency-Key header is required",
    });
    return;
  }

  const parsed = createOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid order data",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const input = parsed.data;

  const totalCents = input.items.reduce(
    (sum: number, item: { unitPrice: number; quantity: number }) =>
      sum + Math.round(item.unitPrice * 100) * item.quantity,
    0,
  );

  const totalAmount = (totalCents / 100).toFixed(2);
  const createdById = req.authUser!.id;
  try {
     
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey },
      include: { items: true },
    });

    if (existing) {
      if (!sameRequest(existing, input)) {
        res.status(409).json({
          message: "Idempotency key was already used with different data",
        });
        return;
      }

      res.status(200).json({
        message: "Order already created",
        order: {
          ...existing,
          totalAmount: existing.totalAmount.toString(),
          items: existing.items.map((item) => ({
            ...item,
            unitPrice: item.unitPrice.toString(),
          })),
        },
      });
      return;
    }

    const order = await prisma.order.create({
        data: {
          idempotencyKey,
          customerName: input.customerName,
          email: input.email,
          totalAmount,
          createdById,
          items: {
            create: input.items.map((item) => ({
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: {
          items: true,
        },
      });

    res.status(201).json({
      message: "Order created successfully",
      order: {
        ...order,
        totalAmount: order.totalAmount.toString(),
        items: order.items.map((item) => ({
          ...item,
          unitPrice: item.unitPrice.toString(),
        })),
      },
    });
  } catch (error) {
    // The database UNIQUE constraint is the final concurrency safeguard.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      try {
        const existing = await prisma.order.findUnique({
          where: { idempotencyKey },
          include: { items: true },
        });

        if (existing && sameRequest(existing, input)) {
          res.status(200).json({
            message: "Order already created",
            order: {
              ...existing,
              totalAmount: existing.totalAmount.toString(),
              items: existing.items.map((item) => ({
                ...item,
                unitPrice: item.unitPrice.toString(),
              })),
            },
          });
          return;
        }

        res.status(409).json({
          message: "Idempotency key was already used with different data",
        });
        return;
      } catch (lookupError) {
        console.error("Failed to resolve duplicate request:", lookupError);
      }
    }

    console.error("Failed to create order:", error);
    res.status(500).json({ message: "Failed to create order" });
  }
});

export default ordersRouter;
