import { LEVELS, LEVEL_LABEL } from "@/lib/constants";

export function CourseFields({ course }: { course?: { title: string; description: string; proficiencyLevel: string } }) {
  return (
    <>
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input className="input" id="title" name="title" required defaultValue={course?.title} placeholder="e.g. Web Development Foundations" />
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea className="input min-h-24" id="description" name="description" defaultValue={course?.description} placeholder="What will students learn?" />
      </div>
      <div>
        <label className="label" htmlFor="proficiencyLevel">Target proficiency level</label>
        <select className="input" id="proficiencyLevel" name="proficiencyLevel" defaultValue={course?.proficiencyLevel ?? "BEGINNER"}>
          {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
        </select>
        <p className="mt-1 text-xs text-muted">Only students assigned to this level will see the course.</p>
      </div>
    </>
  );
}
