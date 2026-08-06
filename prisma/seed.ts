import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") {
  throw new Error("Development seed is disabled in production");
}

async function main() {
  const organisation = await prisma.organisation.upsert({
    where: { id: "org-demo-lab" },
    update: { name: "Demonstration Microbiology Laboratory" },
    create: {
      id: "org-demo-lab",
      name: "Demonstration Microbiology Laboratory",
    },
  });

  const passwordHash = await argon2.hash("ChangeMe-123!", {
    type: argon2.argon2id,
  });

  const users = [
    {
      id: "user-technician",
      email: "technician@example.test",
      displayName: "Demo Technologist",
      role: Role.TECHNICIAN,
    },
    {
      id: "user-microbiologist",
      email: "microbiologist@example.test",
      displayName: "Demo Microbiologist",
      role: Role.MICROBIOLOGIST,
    },
    {
      id: "user-supervisor",
      email: "supervisor@example.test",
      displayName: "Demo Laboratory Supervisor",
      role: Role.SUPERVISOR,
    },
    {
      id: "user-admin",
      email: "admin@example.test",
      displayName: "Demo Administrator",
      role: Role.ADMIN,
    },
  ];

  for (const item of users) {
    await prisma.user.upsert({
      where: { email: item.email },
      update: {
        displayName: item.displayName,
        passwordHash,
        disabledAt: null,
      },
      create: {
        id: item.id,
        email: item.email,
        displayName: item.displayName,
        passwordHash,
      },
    });

    await prisma.membership.upsert({
      where: {
        userId_organisationId: {
          userId: item.id,
          organisationId: organisation.id,
        },
      },
      update: { role: item.role },
      create: {
        userId: item.id,
        organisationId: organisation.id,
        role: item.role,
      },
    });
  }

  console.log("Development users created. Password for all accounts: ChangeMe-123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
