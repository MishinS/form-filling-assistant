import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTemplate } from "@/lib/db/templates";
import { getMapping } from "@/lib/db/mappings";
import { TEMPLATES } from "@/lib/seed/pt";
import MappingEditor, { type EditorTpl } from "@/components/templates/MappingEditor";
import HtmlTemplateEditor from "@/components/templates/HtmlTemplateEditor";
import { isGuest } from "@/lib/auth/guard";
import { getTemplateLayers } from "@/lib/db/mappings";
import { ED_TEMPLATE_ID } from "@/lib/render/ed";
import { edDefaults } from "@/lib/templates/ed-server";
import { EMPTY_DRAFT } from "@/components/templates/html-editor-core";

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

  // «Паспорт» правит только зарегистрированный пользователь — свою версию.
  if (params.id === ED_TEMPLATE_ID) {
    if (!email || isGuest(session)) notFound();
    const defaults = await edDefaults();
    let layers = null;
    try { layers = await getTemplateLayers(email, ED_TEMPLATE_ID); } catch { /* defaults below */ }
    return <HtmlTemplateEditor defaults={defaults} initial={layers ?? EMPTY_DRAFT} />;
  }
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
