import React, { useState, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, ArrowLeft, GripVertical, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface UploadedFile {
  id: string;
  name: string;
  type: 'policy' | 'claim' | 'cancel';
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  mappingSuggestions?: MappingSuggestion[];
}

interface MappingSuggestion {
  source_field: string;
  suggested_canonical: string;
  populated_pct: number;
  detected_type: string;
  confidence: number;
}

interface MappingWizardProps {
  uploadedFiles: UploadedFile[];
  onComplete: (mappings: Record<string, any>) => void;
  onBack: () => void;
}

interface FieldMapping {
  sourceField: string;
  canonicalField: string | null;
  fileType: string;
  populated_pct: number;
  detected_type: string;
  confidence: number;
  required: boolean;
}

interface CanonicalFieldPill {
  id: string;
  name: string;
  type: string;
  required: boolean;
  fileType: string;
}

const requiredFields = {
  policy: ['policy_number', 'effective_date', 'expiration_date', 'premium_written', 'product_type'],
  claim: ['claim_number', 'policy_number', 'paid_date', 'report_date', 'paid_amount'],
  cancel: ['policy_number', 'cancel_date', 'refund_premium']
};

const allCanonicalFields: CanonicalFieldPill[] = [
  // Policy fields
  { id: 'policy_number_p', name: 'policy_number', type: 'string', required: true, fileType: 'policy' },
  { id: 'effective_date', name: 'effective_date', type: 'date', required: true, fileType: 'policy' },
  { id: 'expiration_date', name: 'expiration_date', type: 'date', required: true, fileType: 'policy' },
  { id: 'premium_written', name: 'premium_written', type: 'decimal', required: true, fileType: 'policy' },
  { id: 'product_type', name: 'product_type', type: 'string', required: true, fileType: 'policy' },
  { id: 'coverage_code', name: 'coverage_code', type: 'string', required: false, fileType: 'policy' },
  { id: 'coverage_term_months', name: 'coverage_term_months', type: 'integer', required: false, fileType: 'policy' },
  { id: 'status', name: 'status', type: 'enum', required: false, fileType: 'policy' },
  
  // Claim fields
  { id: 'claim_number', name: 'claim_number', type: 'string', required: true, fileType: 'claim' },
  { id: 'policy_number_c', name: 'policy_number', type: 'string', required: true, fileType: 'claim' },
  { id: 'paid_date', name: 'paid_date', type: 'date', required: true, fileType: 'claim' },
  { id: 'report_date', name: 'report_date', type: 'date', required: true, fileType: 'claim' },
  { id: 'paid_amount', name: 'paid_amount', type: 'decimal', required: true, fileType: 'claim' },
  { id: 'claim_resolution', name: 'claim_resolution', type: 'string', required: false, fileType: 'claim' },
  
  // Cancel fields
  { id: 'policy_number_cancel', name: 'policy_number', type: 'string', required: true, fileType: 'cancel' },
  { id: 'cancel_date', name: 'cancel_date', type: 'date', required: true, fileType: 'cancel' },
  { id: 'refund_premium', name: 'refund_premium', type: 'decimal', required: true, fileType: 'cancel' }
];

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function CanonicalFieldPillComponent({ 
  field, 
  mapped, 
  onRemove 
}: { 
  field: CanonicalFieldPill; 
  mapped: boolean;
  onRemove?: () => void;
}) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return 'bg-blue-100 text-blue-800';
      case 'date': return 'bg-green-100 text-green-800';
      case 'decimal': return 'bg-purple-100 text-purple-800';
      case 'integer': return 'bg-orange-100 text-orange-800';
      case 'enum': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-move transition-all ${
      mapped 
        ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
        : 'bg-background border-border hover:border-primary/50'
    }`}>
      <GripVertical className="h-3 w-3" />
      <span className="font-mono text-sm">{field.name}</span>
      <Badge className={`text-xs ${getTypeColor(field.type)}`}>
        {field.type}
      </Badge>
      {field.required && (
        <Badge variant="destructive" className="text-xs">Required</Badge>
      )}
      {mapped && onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 hover:bg-primary-foreground/20"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function MappingWizard({ uploadedFiles, onComplete, onBack }: MappingWizardProps) {
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(() => {
    // Initialize field mappings from uploaded files
    const mappings: FieldMapping[] = [];
    
    uploadedFiles.forEach(file => {
      if (file.mappingSuggestions) {
        file.mappingSuggestions.forEach(suggestion => {
          mappings.push({
            sourceField: suggestion.source_field,
            canonicalField: suggestion.suggested_canonical,
            fileType: file.type,
            populated_pct: suggestion.populated_pct,
            detected_type: suggestion.detected_type,
            confidence: suggestion.confidence,
            required: requiredFields[file.type as keyof typeof requiredFields]?.includes(suggestion.suggested_canonical) || false
          });
        });
      }
    });
    
    return mappings;
  });

  const [availableFields, setAvailableFields] = useState<CanonicalFieldPill[]>(() => {
    // Filter available fields based on uploaded file types
    const fileTypes = uploadedFiles.map(f => f.type);
    return allCanonicalFields.filter(field => 
      fileTypes.includes(field.fileType as 'policy' | 'claim' | 'cancel')
    );
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeField = availableFields.find(f => f.id === active.id);
    const targetSourceField = over.id as string;

    if (activeField && targetSourceField) {
      // Update field mapping
      setFieldMappings(prev => 
        prev.map(mapping => 
          mapping.sourceField === targetSourceField
            ? { ...mapping, canonicalField: activeField.name }
            : mapping
        )
      );
    }
  };

  const removeMapping = (sourceField: string) => {
    setFieldMappings(prev => 
      prev.map(mapping => 
        mapping.sourceField === sourceField
          ? { ...mapping, canonicalField: null }
          : mapping
      )
    );
  };

  const getMappedField = (sourceField: string) => {
    const mapping = fieldMappings.find(m => m.sourceField === sourceField);
    if (!mapping?.canonicalField) return null;
    
    return availableFields.find(f => f.name === mapping.canonicalField);
  };

  const getValidationStatus = () => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields
    uploadedFiles.forEach(file => {
      const fileRequiredFields = requiredFields[file.type as keyof typeof requiredFields] || [];
      
      fileRequiredFields.forEach(requiredField => {
        const isMapped = fieldMappings.some(m => 
          m.fileType === file.type && 
          m.canonicalField === requiredField
        );
        
        if (!isMapped) {
          errors.push(`Required field "${requiredField}" not mapped in ${file.type} file`);
        }
      });
    });

    // Check for duplicate mappings
    const mappedFields = fieldMappings
      .filter(m => m.canonicalField)
      .map(m => `${m.fileType}_${m.canonicalField}`);
    const duplicates = mappedFields.filter((field, index) => mappedFields.indexOf(field) !== index);
    
    duplicates.forEach(duplicate => {
      errors.push(`Duplicate mapping detected: ${duplicate}`);
    });

    // Check confidence levels
    fieldMappings.forEach(mapping => {
      if (mapping.canonicalField && mapping.confidence < 0.7) {
        warnings.push(`Low confidence mapping for "${mapping.sourceField}" -> "${mapping.canonicalField}"`);
      }
    });

    return { errors, warnings, isValid: errors.length === 0 };
  };

  const validationStatus = getValidationStatus();
  const completionPercentage = Math.round(
    (fieldMappings.filter(m => m.canonicalField).length / fieldMappings.length) * 100
  );

  const handleSubmit = () => {
    if (!validationStatus.isValid) {
      toast({
        title: "Validation Failed",
        description: "Please fix all mapping errors before proceeding.",
        variant: "destructive"
      });
      return;
    }

    const finalMappings = fieldMappings.reduce((acc, mapping) => {
      if (mapping.canonicalField) {
        acc[mapping.sourceField] = {
          canonical_field: mapping.canonicalField,
          file_type: mapping.fileType,
          populated_pct: mapping.populated_pct,
          detected_type: mapping.detected_type,
          confidence: mapping.confidence
        };
      }
      return acc;
    }, {} as Record<string, any>);

    onComplete(finalMappings);
  };

  const groupedMappings = fieldMappings.reduce((acc, mapping) => {
    if (!acc[mapping.fileType]) {
      acc[mapping.fileType] = [];
    }
    acc[mapping.fileType].push(mapping);
    return acc;
  }, {} as Record<string, FieldMapping[]>);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Field Mapping</h2>
          <p className="text-muted-foreground">
            Drag canonical field pills to map your source fields
          </p>
          <div className="max-w-md mx-auto space-y-2">
            <Progress value={completionPercentage} className="w-full" />
            <p className="text-sm text-muted-foreground">
              {completionPercentage}% complete
            </p>
          </div>
        </div>

        {/* Validation Status */}
        {(validationStatus.errors.length > 0 || validationStatus.warnings.length > 0) && (
          <Card className={validationStatus.errors.length > 0 ? 'border-destructive' : 'border-warning'}>
            <CardContent className="pt-6">
              {validationStatus.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="font-medium text-destructive">Validation Errors</span>
                  </div>
                  <ul className="text-sm text-destructive space-y-1 ml-6">
                    {validationStatus.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {validationStatus.warnings.length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="font-medium text-warning">Warnings</span>
                  </div>
                  <ul className="text-sm text-warning space-y-1 ml-6">
                    {validationStatus.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mapping Interface */}
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Available Fields Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm">Available Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <SortableContext items={availableFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                {availableFields.map(field => (
                  <SortableItem key={field.id} id={field.id}>
                    <CanonicalFieldPillComponent 
                      field={field} 
                      mapped={false}
                    />
                  </SortableItem>
                ))}
              </SortableContext>
            </CardContent>
          </Card>

          {/* Mapping Panels */}
          <div className="lg:col-span-3 space-y-6">
            {Object.entries(groupedMappings).map(([fileType, mappings]) => (
              <Card key={fileType}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {fileType.charAt(0).toUpperCase() + fileType.slice(1)} File Mapping
                    <Badge variant={fileType === 'policy' ? 'default' : fileType === 'claim' ? 'secondary' : 'outline'}>
                      {mappings.length} fields
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mappings.map((mapping) => {
                      const mappedField = getMappedField(mapping.sourceField);
                      const isRequired = mapping.required;
                      const isMapped = mapping.canonicalField !== null;
                      
                      return (
                        <div 
                          key={mapping.sourceField}
                          className={`p-4 border rounded-lg transition-all ${
                            isRequired && !isMapped ? 'border-destructive bg-destructive/5' : 'border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium">
                                  {mapping.sourceField}
                                </span>
                                {isRequired && (
                                  <Badge variant="destructive" className="text-xs">Required</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                <span>{mapping.populated_pct.toFixed(1)}% populated</span>
                                <span>{mapping.detected_type}</span>
                                <span>Confidence: {(mapping.confidence * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                            
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            
                            <div 
                              className="flex-1 min-h-[60px] border-2 border-dashed border-border rounded-lg p-2 flex items-center justify-center transition-all hover:border-primary/50"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                // Handle drop logic if needed
                              }}
                            >
                              {mappedField ? (
                                <CanonicalFieldPillComponent 
                                  field={mappedField} 
                                  mapped={true}
                                  onRemove={() => removeMapping(mapping.sourceField)}
                                />
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  Drop canonical field here
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Upload
          </Button>
          
          <Button 
            variant="professional" 
            onClick={handleSubmit}
            disabled={!validationStatus.isValid}
            className="gap-2"
          >
            {validationStatus.isValid ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Submit Mapping
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                Fix Errors to Continue
              </>
            )}
          </Button>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <CanonicalFieldPillComponent 
            field={availableFields.find(f => f.id === activeId)!} 
            mapped={false}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}