import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";
import { AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";

interface MappingSuggestion {
  source_field: string;
  suggested_canonical: string;
  populated_pct: number;
  detected_type: string;
  confidence: number;
}

interface UploadedFile {
  id: string;
  name: string;
  type: "policy" | "claim" | "cancel";
  file: File;
  status: "pending" | "processing" | "completed" | "error";
  mappingSuggestions?: MappingSuggestion[];
}

interface MappingWizardProps {
  uploadedFiles: UploadedFile[];
  uploadId: string | null;
  onComplete: (mappings: Record<string, any>) => void;
  onBack: () => void;
}

const REQUIRED_FIELDS: Record<"policy" | "claim" | "cancel", string[]> = {
  policy: ["policy_number", "effective_date", "expiration_date", "premium_written", "product_type"],
  claim: ["claim_number", "policy_number", "paid_date", "report_date", "paid_amount"],
  cancel: ["policy_number", "cancel_date", "refund_premium"],
};

export function SimpleMappingWizard({ uploadedFiles, uploadId, onComplete, onBack }: MappingWizardProps) {
  const { toast } = useToast();

  const filesByType = useMemo(() => ({
    policy: uploadedFiles.find(f => f.type === "policy"),
    claim: uploadedFiles.find(f => f.type === "claim"),
    cancel: uploadedFiles.find(f => f.type === "cancel"),
  }), [uploadedFiles]);

  // Build initial selections from suggestions (preselect when suggested_canonical matches)
  const initialSelections = useMemo(() => {
    const init: Record<string, Record<string, string>> = {};
    (Object.keys(filesByType) as Array<keyof typeof filesByType>).forEach(ft => {
      const file = filesByType[ft];
      if (!file) return;
      init[ft] = {};
      const req = REQUIRED_FIELDS[ft];
      req.forEach(canonical => {
        const suggestion = file.mappingSuggestions?.find(s => s.suggested_canonical === canonical);
        if (suggestion) init[ft][canonical] = suggestion.source_field;
      });
    });
    return init;
  }, [filesByType]);

  const [selections, setSelections] = useState<Record<string, Record<string, string>>>(initialSelections);

  const getSourceOptions = (ft: "policy" | "claim" | "cancel"): string[] => {
    const file = filesByType[ft];
    const opts = file?.mappingSuggestions?.map(s => s.source_field) ?? [];
    // Unique, preserving order
    return Array.from(new Set(opts));
  };

  const getSuggestionMeta = (ft: "policy" | "claim" | "cancel", sourceField: string | undefined) => {
    if (!sourceField) return undefined;
    const file = filesByType[ft];
    return file?.mappingSuggestions?.find(s => s.source_field === sourceField);
  };

  const validate = () => {
    const errors: string[] = [];

    (Object.keys(filesByType) as Array<keyof typeof filesByType>).forEach(ft => {
      const file = filesByType[ft];
      if (!file) return;
      const req = REQUIRED_FIELDS[ft];
      const picked = selections[ft] || {};

      // Required present
      req.forEach(c => {
        if (!picked[c]) errors.push(`${ft}: map required field "${c}"`);
      });

      // No duplicate source fields within same file
      const values = Object.values(picked).filter(Boolean);
      const dupes = values.filter((v, i) => values.indexOf(v) !== i);
      if (dupes.length) errors.push(`${ft}: duplicate source fields selected (${Array.from(new Set(dupes)).join(", ")})`);
    });

    return errors;
  };

  const handleSubmit = async () => {
    const errors = validate();
    if (errors.length) {
      toast({ title: "Fix required mappings", description: errors.join("; "), variant: "destructive" });
      return;
    }
    if (!uploadId) {
      toast({ title: "Upload missing", description: "Re-upload files to get an upload id.", variant: "destructive" });
      return;
    }

    try {
      // Build grouped mappings like the previous implementation (keys by source_field)
      const grouped: Record<string, Record<string, any>> = {};

      (Object.keys(filesByType) as Array<keyof typeof filesByType>).forEach(ft => {
        const file = filesByType[ft];
        if (!file) return;
        const picked = selections[ft] || {};
        const mappingForType: Record<string, any> = {};

        Object.entries(picked).forEach(([canonical, source]) => {
          const meta = getSuggestionMeta(ft, source);
          if (!source) return;
          mappingForType[source] = {
            canonical_field: canonical,
            populated_pct: meta?.populated_pct ?? null,
            detected_type: meta?.detected_type ?? null,
            confidence: meta?.confidence ?? null,
          };
        });

        grouped[ft] = mappingForType;
      });

      // Submit each present file type
      const promises = (Object.keys(grouped) as Array<keyof typeof grouped>)
        .filter(ft => Object.keys(grouped[ft]).length > 0)
        .map(ft => apiService.submitMapping({ upload_id: uploadId, file_type: ft, mappings: grouped[ft] }));

      await Promise.all(promises);

      // Flatten for onComplete (same shape as before)
      const finalMappings: Record<string, any> = {};
      (Object.keys(grouped) as Array<keyof typeof grouped>).forEach(ft => {
        Object.entries(grouped[ft]).forEach(([source, details]) => {
          finalMappings[source] = { ...details, file_type: ft };
        });
      });

      toast({ title: "Mappings submitted", description: "Your selections have been saved." });
      onComplete(finalMappings);
    } catch (err: any) {
      toast({ title: "Submission failed", description: err?.message || "An error occurred.", variant: "destructive" });
    }
  };

  const renderFileSection = (ft: "policy" | "claim" | "cancel") => {
    const file = filesByType[ft];
    if (!file) return null;

    const required = REQUIRED_FIELDS[ft];
    const options = getSourceOptions(ft);
    const picked = selections[ft] || {};

    return (
      <section aria-labelledby={`${ft}-mapping`} className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 id={`${ft}-mapping`} className="text-lg font-semibold capitalize">{ft} required fields</h3>
          <Badge variant={ft === "policy" ? "default" : ft === "claim" ? "secondary" : "outline"}>{ft}</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {required.map((canonical) => {
            const selectedSource = picked[canonical];
            const meta = getSuggestionMeta(ft, selectedSource);

            // Disable options already selected for another canonical in this file
            const disabledSet = new Set(Object.entries(picked)
              .filter(([c]) => c !== canonical)
              .map(([, v]) => v)
              .filter(Boolean) as string[]);

            return (
              <div key={`${ft}-${canonical}`} className="flex flex-col gap-2">
                <label className="text-sm font-medium">{canonical} <span className="text-muted-foreground">(required)</span></label>
                <Select
                  value={selectedSource || undefined}
                  onValueChange={(val) => {
                    setSelections(prev => ({
                      ...prev,
                      [ft]: { ...(prev[ft] || {}), [canonical]: val }
                    }));
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select source field" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {options.length === 0 && (
                      <SelectItem disabled value="__none__">No detected fields</SelectItem>
                    )}
                    {options.map(opt => (
                      <SelectItem key={opt} value={opt} disabled={disabledSet.has(opt)}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {meta && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> conf {Math.round((meta.confidence ?? 0) * 100)}%</span>
                    <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> filled {Math.round(meta.populated_pct ?? 0)}%</span>
                    <span className="uppercase">{meta.detected_type}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <main className="space-y-6">
      <header className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Field Mapping</h2>
        <p className="text-muted-foreground">Select the source column for each required canonical field.</p>
      </header>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Mappings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {renderFileSection("policy")}
          {renderFileSection("claim")}
          {renderFileSection("cancel")}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button variant="professional" onClick={handleSubmit} className="gap-2">
              Submit <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default SimpleMappingWizard;
