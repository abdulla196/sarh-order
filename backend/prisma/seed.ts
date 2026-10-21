import "dotenv/config";
import { PrismaClient, OrderStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TOTAL_ORDERS = 50_000;
const BATCH_SIZE = 500;

const statuses: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
];

const products = [
  { name: "Laptop", price: 25000 },
  { name: "Keyboard", price: 1200 },
  { name: "Mouse", price: 650 },
  { name: "Monitor", price: 8500 },
  { name: "Headphones", price: 1800 },
  { name: "USB Cable", price: 150 },
  { name: "Webcam", price: 2200 },
  { name: "Office Chair", price: 4500 },
];

const firstNames = [
  "Ahmed", "Mohamed", "Ali", "Omar", "Youssef",
  "Mahmoud", "Amr", "Khaled", "Mostafa", "Hassan",
];

const lastNames = [
  "Amr", "Hassan", "Ibrahim", "Mahmoud", "Sayed",
  "Ali", "Mostafa", "Adel", "Fathy", "Samir",
];

async function main() {
  console.log("Starting database seed...");

  const adminPassword = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD ?? "Admin123!ChangeMe",
    12,
  );

  const agentPassword = await bcrypt.hash(
    process.env.SEED_AGENT_PASSWORD ?? "Agent123!ChangeMe",
    12,
  );

  const admin = await prisma.user.upsert({
    where: { email: "admin@sarh.local" },
    update: {},
    create: {
      name: "SARH Administrator",
      email: "admin@sarh.local",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "agent@sarh.local" },
    update: {},
    create: {
      name: "SARH Agent",
      email: "agent@sarh.local",
      passwordHash: agentPassword,
      role: UserRole.AGENT,
    },
  });

  console.log(`Admin ready: ${admin.email}`);

  for (
    let batchStart = 1;
    batchStart <= TOTAL_ORDERS;
    batchStart += BATCH_SIZE
  ) {
    const batchEnd = Math.min(
      batchStart + BATCH_SIZE - 1,
      TOTAL_ORDERS,
    );

    const orders = [];
    const items = [];

    for (let i = batchStart; i <= batchEnd; i++) {
      const orderId = `seed-order-${String(i).padStart(6, "0")}`;
      const idempotencyKey = `seed-key-${String(i).padStart(6, "0")}`;

      const customerFirst =
        firstNames[i % firstNames.length];

      const customerLast =
        lastNames[Math.floor(i / firstNames.length) % lastNames.length];

      const itemCount = 1 + (i % 5);
      let totalAmount = 0;

      const orderItems = [];

      for (let j = 0; j < itemCount; j++) {
        const product = products[(i + j) % products.length];
        const quantity = 1 + ((i + j) % 3);

        totalAmount += product.price * quantity;

        orderItems.push({
          id: `seed-item-${String(i).padStart(6, "0")}-${j + 1}`,
          orderId,
          productName: product.name,
          quantity,
          unitPrice: product.price,
        });
      }

      // Spread orders across the previous 365 days.
      const createdAt = new Date(
        Date.now() - (i % 365) * 24 * 60 * 60 * 1000,
      );

      orders.push({
        id: orderId,
        idempotencyKey,
        customerName: `${customerFirst} ${customerLast}`,
        email: `customer${i}@example.com`,
        status: statuses[i % statuses.length],
        totalAmount,
        createdAt,
        createdById: admin.id,
      });

      items.push(...orderItems);
    }

    // Allow the seed script to be safely rerun.
    const keys = orders.map((order) => order.idempotencyKey);

    const existingOrders = await prisma.order.findMany({
      where: { idempotencyKey: { in: keys } },
      select: { idempotencyKey: true },
    });

    const existingKeys = new Set(
      existingOrders.map((order) => order.idempotencyKey),
    );

    const newOrders = orders.filter(
      (order) => !existingKeys.has(order.idempotencyKey),
    );

    const newOrderIds = new Set(newOrders.map((order) => order.id));

    const newItems = items.filter((item) =>
      newOrderIds.has(item.orderId),
    );

    if (newOrders.length > 0) {
      await prisma.$transaction([
        prisma.order.createMany({ data: newOrders }),
        prisma.orderItem.createMany({ data: newItems }),
      ]);
    }

    console.log(
      `Processed ${batchEnd}/${TOTAL_ORDERS} orders`,
    );
  }

  const finalCount = await prisma.order.count();

  console.log(`Seed completed. Total orders in DB: ${finalCount}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });