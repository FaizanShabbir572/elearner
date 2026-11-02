"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { isLevel } from "@/lib/constants";
import { toEmbedUrl } from "@/lib/video";
import { removeUnusedVideos } from "@/lib/video-storage";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(courseId: string) {
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/dashboard");
  revalidatePath(`/courses/${courseId}`);
}

/* ----------------------------- Courses ----------------------------- */

export async function createCourse(form: FormData) {
  await requireAdmin();
  const title = str(form, "title");
  const level = form.get("proficiencyLevel");
  if (!title) throw new Error("Title is required");
  const course = await db.course.create({
    data: {
      title,
      description: str(form, "description"),
      proficiencyLevel: isLevel(level) ? level : "BEGINNER",
    },
  });
  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${course.id}`);
}

export async function updateCourse(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const title = str(form, "title");
  const level = form.get("proficiencyLevel");
  if (!title) throw new Error("Title is required");
  await db.course.update({
    where: { id },
    data: {
      title,
      description: str(form, "description"),
      proficiencyLevel: isLevel(level) ? level : undefined,
      published: form.get("published") === "on",
    },
  });
  refresh(id);
}

export async function deleteCourse(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const videos = await db.lesson.findMany({ where: { module: { courseId: id } }, select: { videoUrl: true } });
  await db.course.delete({ where: { id } });
  await removeUnusedVideos(videos.map((l) => l.videoUrl));
  revalidatePath("/admin/courses");
  revalidatePath("/dashboard");
  redirect("/admin/courses");
}

/* ----------------------------- Modules ----------------------------- */

export async function createModule(form: FormData) {
  await requireAdmin();
  const courseId = str(form, "courseId");
  const title = str(form, "title");
  if (!title) return;
  const last = await db.module.findFirst({ where: { courseId }, orderBy: { order: "desc" } });
  await db.module.create({ data: { courseId, title, order: (last?.order ?? -1) + 1 } });
  refresh(courseId);
}

export async function renameModule(form: FormData) {
  await requireAdmin();
  const title = str(form, "title");
  if (!title) return;
  const mod = await db.module.update({ where: { id: str(form, "id") }, data: { title } });
  refresh(mod.courseId);
}

export async function deleteModule(form: FormData) {
  await requireAdmin();
  const mod = await db.module.delete({ where: { id: str(form, "id") }, include: { lessons: { select: { videoUrl: true } } } });
  await removeUnusedVideos(mod.lessons.map((l) => l.videoUrl));
  refresh(mod.courseId);
}

/** Swap an item with its neighbour, then renumber 0..n so orders never drift. */
async function reorder<T extends { id: string }>(
  items: T[],
  id: string,
  dir: "up" | "down",
  save: (id: string, order: number) => Prisma.PrismaPromise<unknown>
) {
  const i = items.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  await db.$transaction(items.map((x, k) => save(x.id, k)));
}

export async function moveModule(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const mod = await db.module.findUniqueOrThrow({ where: { id } });
  const siblings = await db.module.findMany({ where: { courseId: mod.courseId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
  await reorder(siblings, id, str(form, "dir") === "up" ? "up" : "down", (mid, order) =>
    db.module.update({ where: { id: mid }, data: { order } })
  );
  refresh(mod.courseId);
}

/* ----------------------------- Lessons ----------------------------- */

export async function createLesson(form: FormData) {
  await requireAdmin();
  const moduleId = str(form, "moduleId");
  const title = str(form, "title");
  if (!title) return;
  const mod = await db.module.findUniqueOrThrow({ where: { id: moduleId } });
  const last = await db.lesson.findFirst({ where: { moduleId }, orderBy: { order: "desc" } });
  const lesson = await db.lesson.create({ data: { moduleId, title, order: (last?.order ?? -1) + 1 } });
  refresh(mod.courseId);
  redirect(`/admin/courses/${mod.courseId}/lessons/${lesson.id}`);
}

export async function updateLesson(_: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const id = str(form, "id");
  const title = str(form, "title");
  const videoUrl = str(form, "videoUrl") || null;
  if (!title) return { error: "Title is required." };
  if (videoUrl && !toEmbedUrl(videoUrl)) {
    return { error: "Video must be an uploaded file or a YouTube or Vimeo URL (e.g. https://www.youtube.com/watch?v=… or https://vimeo.com/123456)." };
  }
  const before = await db.lesson.findUnique({ where: { id }, select: { videoUrl: true } });
  const lesson = await db.lesson.update({
    where: { id },
    data: { title, content: String(form.get("content") ?? ""), videoUrl, transcript: String(form.get("transcript") ?? "") },
    include: { module: true },
  });
  if (before?.videoUrl !== videoUrl) await removeUnusedVideos([before?.videoUrl]);
  refresh(lesson.module.courseId);
  redirect(`/admin/courses/${lesson.module.courseId}?saved=${lesson.id}`);
}

export async function deleteLesson(form: FormData) {
  await requireAdmin();
  const lesson = await db.lesson.delete({ where: { id: str(form, "id") }, include: { module: true } });
  await removeUnusedVideos([lesson.videoUrl]);
  refresh(lesson.module.courseId);
  redirect(`/admin/courses/${lesson.module.courseId}`);
}

export async function moveLesson(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id }, include: { module: true } });
  const siblings = await db.lesson.findMany({ where: { moduleId: lesson.moduleId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
  await reorder(siblings, id, str(form, "dir") === "up" ? "up" : "down", (lid, order) =>
    db.lesson.update({ where: { id: lid }, data: { order } })
  );
  refresh(lesson.module.courseId);
}
