import type { CurrentUser } from "./auth";

/** Students see published courses that match their assigned level. Admins can preview everything. */
export function canAccessCourse(
  user: Pick<CurrentUser, "role" | "status" | "proficiencyLevel">,
  course: { published: boolean; proficiencyLevel: string }
) {
  if (user.role === "ADMIN") return true;
  return user.status === "APPROVED" && course.published && course.proficiencyLevel === user.proficiencyLevel;
}

export function visibleCoursesWhere(user: Pick<CurrentUser, "role" | "proficiencyLevel">) {
  if (user.role === "ADMIN") return {};
  return { published: true, proficiencyLevel: user.proficiencyLevel ?? "__none__" };
}
