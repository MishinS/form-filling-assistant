"use client";
import { useRouter, usePathname } from "next/navigation";
import { createContext, useMemo, useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { WizardModal } from "@/components/wizard/WizardModal";
import { DEFAULT_MODEL } from "@/lib/extract/llm/catalog";
import { PT_FIELDS, type ExtractField } from "@/lib/extract/fields";
import { TEMPLATES, type UiTemplate } from "@/lib/seed/pt";

export const WizardTrigger = createContext<{ openNew: () => void; openReview: () => void }>({
  openNew: () => {},
  openReview: () => {},
});

export const ModelContext = createContext<{ model: string; setModel: (id: string) => void }>({
  model: DEFAULT_MODEL,
  setModel: () => {},
});

export const TemplateMappingContext = createContext<{
  fields: ExtractField[];
  setFields: (f: ExtractField[]) => void;
  resetFields: () => void;
}>({
  fields: PT_FIELDS,
  setFields: () => {},
  resetFields: () => {},
});

export interface TemplatesCtx {
  templates: UiTemplate[];
  nameOf: (id: string) => { ru: string; en: string } | undefined;
}
export const TemplatesContext = createContext<TemplatesCtx>({ templates: TEMPLATES, nameOf: () => undefined });

export type SessionUser = { name: string; email: string; image: string | null };

export default function AppShell({ children, user, initialFields, templates, templateNames }: {
  children: ReactNode; user: SessionUser; initialFields?: ExtractField[];
  templates?: UiTemplate[]; templateNames?: Record<string, { ru: string; en: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [wizardStart, setWizardStart] = useState<number | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [fields, setFields] = useState<ExtractField[]>(initialFields ?? PT_FIELDS);
  const route = pathname.split("/")[1] || "fills";
  const tplCtx: TemplatesCtx = useMemo(() => ({
    templates: templates ?? TEMPLATES,
    nameOf: (id) => templateNames?.[id],
  }), [templates, templateNames]);
  return (
    <TemplatesContext.Provider value={tplCtx}>
    <TemplateMappingContext.Provider value={{ fields, setFields, resetFields: () => setFields(PT_FIELDS) }}>
    <ModelContext.Provider value={{ model, setModel }}>
    <WizardTrigger.Provider value={{ openNew: () => setWizardStart(0), openReview: () => setWizardStart(2) }}>
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        <Sidebar route={route} user={user} onNavigate={(id) => router.push(`/${id}`)} onNewFill={() => setWizardStart(0)} />
        <div className="col" style={{ flex: 1, minWidth: 0 }}>
          <Topbar />
          <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", minWidth: 0 }}>{children}</div>
        </div>
        {wizardStart !== null && <WizardModal start={wizardStart} onClose={() => setWizardStart(null)} />}
      </div>
    </WizardTrigger.Provider>
    </ModelContext.Provider>
    </TemplateMappingContext.Provider>
    </TemplatesContext.Provider>
  );
}
