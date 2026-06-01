import MappingEditor from "@/components/templates/MappingEditor";
export default function TemplateEditorPage({ params }: { params: { id: string } }) {
  return <MappingEditor templateId={params.id} />;
}
