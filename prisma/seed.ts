import "dotenv/config";
import { createPrismaClient } from "../src/lib/prisma-client";
import bcrypt from "bcryptjs";

const db = createPrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "admin12345";

  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      name: "Site Admin",
      email,
      password: await bcrypt.hash(password, 10),
      role: "ADMIN",
      status: "APPROVED",
    },
  });
  console.log(`Admin ready: ${email} / ${password}`);

  if ((await db.course.count()) > 0) return;

  await db.course.create({
    data: {
      title: "Web Development Foundations",
      description: "Learn how the web works and build your first pages with HTML and CSS.",
      proficiencyLevel: "BEGINNER",
      published: true,
      modules: {
        create: [
          {
            title: "How the Web Works",
            order: 0,
            lessons: {
              create: [
                {
                  title: "Clients, servers and HTTP",
                  order: 0,
                  videoUrl: "https://www.youtube.com/watch?v=hJHvdBlSxug",
                  content:
                    "## What happens when you visit a page?\n\nYour **browser** (the client) sends an HTTP request to a **server**, which responds with HTML, CSS and JavaScript.\n\n- DNS turns a name into an IP address\n- The browser opens a connection\n- The server returns a response with a status code",
                },
                {
                  title: "URLs and domains",
                  order: 1,
                  content: "A URL has a **scheme**, a **host**, a **path** and optional **query** parameters.\n\n```\nhttps://example.com/courses?level=beginner\n```",
                },
              ],
            },
          },
          {
            title: "HTML & CSS Basics",
            order: 1,
            lessons: {
              create: [
                {
                  title: "Your first HTML page",
                  order: 0,
                  content: "HTML describes structure. Every page starts with a `<!doctype html>` declaration, then `<html>`, `<head>` and `<body>`.",
                },
                {
                  title: "Styling with CSS",
                  order: 1,
                  content: "CSS controls presentation. Selectors pick elements; declarations set properties like `color` and `margin`.",
                },
              ],
            },
          },
        ],
      },
    },
  });

  await db.course.create({
    data: {
      title: "Advanced TypeScript Patterns",
      description: "Generics, conditional types and type-safe APIs for experienced developers.",
      proficiencyLevel: "ADVANCED",
      published: true,
      modules: {
        create: [
          {
            title: "Type-level programming",
            order: 0,
            lessons: {
              create: [{ title: "Conditional and mapped types", order: 0, content: "Use `T extends U ? X : Y` to branch at the type level." }],
            },
          },
        ],
      },
    },
  });
  console.log("Sample courses created.");
}

main().finally(() => db.$disconnect());
