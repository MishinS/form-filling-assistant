"use client";
import { useRouter, usePathname } from "next/navigation";
import { createContext, useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { WizardModal } from "@/components/wizard/WizardModal";
import { DEFAULT_MODEL } from "@/lib/extract/llm/catalog";
import { PT_FIELDS, type ExtractField } from "@/lib/extract/fields";

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

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [wizardStart, setWizardStart] = useState<number | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [fields, setFields] = useState<ExtractField[]>(PT_FIELDS);
  const route = pathname.split("/")[1] || "fills";
  return (
    <TemplateMappingContext.Provider value={{ fields, setFields, resetFields: () => setFields(PT_FIELDS) }}>
    <ModelContext.Provider value={{ model, setModel }}>
    <WizardTrigger.Provider value={{ openNew: () => setWizardStart(0), openReview: () => setWizardStart(2) }}>
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        <Sidebar route={route} onNavigate={(id) => router.push(`/${id}`)} onNewFill={() => setWizardStart(0)} />
        <div className="col" style={{ flex: 1, minWidth: 0 }}>
          <Topbar />
          <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
        </div>
        {wizardStart !== null && <WizardModal start={wizardStart} onClose={() => setWizardStart(null)} />}
      </div>
    </WizardTrigger.Provider>
    </ModelContext.Provider>
    </TemplateMappingContext.Provider>
  );
}
