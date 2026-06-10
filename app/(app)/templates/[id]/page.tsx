import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTemplate } from "@/lib/db/templates";
import { getMapping } from "@/lib/db/mappings";
import { TEMPLATES } from "@/lib/seed/pt";
import MappingEditor, { type EditorTpl } from "@/components/templates/MappingEditor";

export default async function TemplateEditorPage({ params }: { params: { id: string } }) {
  if (params.id === "pt") {
    const seed = TEMPLATES[0];
    const tpl: EditorTpl = {
      id: "pt", code: seed.code, name_ru: seed.name_ru, name_en: seed.name_en,
      desc_ru: seed.desc_ru, desc_en: seed.desc_en, format: seed.format, sheets: seed.sheets, own: false,
    };
    return <MappingEditor tpl={tpl} initialFields={null} defaultFields={null} />;
  }

  const session = await auth();
  const email = (session?.user?.email ?? "").toLowerCase();
  let row = null;
  try { row = await getTemplate(params.id); } catch { /* treat as missing */ }
  if (!row || row.deletedAt || row.userId !== email || !email) notFound();

  let saved = null;
  try { saved = await getMapping(email, params.id); } catch { /* defaults below */ }
  const def = row.defaultFields ?? [];
  const tpl: EditorTpl = {
    id: row.id, code: row.code, name_ru: row.nameRu, name_en: row.nameEn,
    desc_ru: row.descRu, desc_en: row.descEn, format: row.format.toUpperCase(), sheets: row.sheets, own: true,
  };
  return <MappingEditor tpl={tpl} initialFields={saved ?? def} defaultFields={def} />;
}
