"use client";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/primitives";
import ModelSelect from "@/components/shell/ModelSelect";
import CustomModels from "@/components/settings/CustomModels";

export default function ModelCard() {
  const { t } = useI18n();
  return (
    <Card pad={22}>
      <div className="col gap-16">
        <h2 style={{ fontSize: 15 }}>{t("set_model")}</h2>
        <ModelSelect />
        <CustomModels />
      </div>
    </Card>
  );
}
