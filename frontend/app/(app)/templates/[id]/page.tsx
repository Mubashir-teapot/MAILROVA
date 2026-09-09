import { TemplateEditorView } from "@/templates/TemplateEditorView";

export default function EditTemplatePage({ params }: { params: { id: string } }) {
  return <TemplateEditorView id={params.id} />;
}
