import React, { useState, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, DragOverEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, ArrowLeft, GripVertical, CheckCircle2, AlertTriangle, X, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';

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
  uploadId: string | null;
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
      case 'string': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'date': return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'decimal': return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
      case 'integer': return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      case 'enum': return 'bg-pink-500/10 text-pink-700 border-pink-500/20';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  return (
    <div className={`group relative inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
      mapped 
        ? 'bg-primary/10 text-primary border-primary shadow-sm' 
        : 'bg-background border-border hover:border-primary/50 hover:shadow-md'
    }`}>
      <GripVertical className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
      <span className="font-mono text-sm font-medium">{field.name}</span>
      <Badge className={`text-xs border ${getTypeColor(field.type)}`} variant="outline">
        {field.type}
      </Badge>
      {field.required && (
        <Badge variant="destructive" className="text-xs">Required</Badge>
      )}
      {mapped && onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 ml-1 opacity-0 group-hover:opacity-100 hover:bg-primary-foreground/20 transition-all"
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

// Droppable zone component
function DroppableZone({ 
  id, 
  children, 
  isOver 
}: { 
  id: string; 
  children: React.ReactNode; 
  isOver: boolean;
}) {
  return (
    <div 
      className={`min-h-[60px] border-2 border-dashed rounded-lg p-3 flex items-center justify-center transition-all ${
        isOver
          ? 'border-primary bg-primary/20 shadow-lg'
          : 'border-muted-foreground/30 hover:border-primary/50'
      }`}
    >
      {children}
    </div>
  );
}

export function MappingWizard({ uploadedFiles, uploadId, onComplete, onBack }: MappingWizardProps) {
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
  const [overId, setOverId] = useState<string | null>(null);
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

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

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
      
      toast({
        title: "Field mapped",
        description: `Mapped "${targetSourceField}" to "${activeField.name}"`,
      });
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

  const handleSubmit = async () => {
    if (!validationStatus.isValid) {
      toast({
        title: "Validation Failed",
        description: "Please fix all mapping errors before proceeding.",
        variant: "destructive"
      });
      return;
    }

    if (!uploadId) {
      toast({
        title: "Upload ID Missing",
        description: "No upload ID found. Please re-upload your files.",
        variant: "destructive"
      });
      return;
    }

    try {
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

      // Group mappings by file type for submission
      const groupedMappings = fieldMappings.reduce((acc, mapping) => {
        if (mapping.canonicalField) {
          if (!acc[mapping.fileType]) {
            acc[mapping.fileType] = {};
          }
          acc[mapping.fileType][mapping.sourceField] = {
            canonical_field: mapping.canonicalField,
            populated_pct: mapping.populated_pct,
            detected_type: mapping.detected_type,
            confidence: mapping.confidence
          };
        }
        return acc;
      }, {} as Record<string, Record<string, any>>);

      // Submit mappings for each file type
      const submissionPromises = Object.entries(groupedMappings).map(([fileType, mappings]) =>
        apiService.submitMapping({
          upload_id: uploadId,
          file_type: fileType,
          mappings
        })
      );

      await Promise.all(submissionPromises);

      toast({
        title: "Mappings submitted successfully",
        description: "Your field mappings have been processed and ETL job has been queued.",
      });

      onComplete(finalMappings);

    } catch (error) {
      console.error('Mapping submission error:', error);
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "An error occurred while submitting mappings.",
        variant: "destructive"
      });
    }
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
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Field Mapping</h2>
          <p className="text-muted-foreground">
            Drag canonical fields from the left panel to map your source fields
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Available Fields Panel */}
          <div className="lg:col-span-3">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Available Fields
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Drag these to map your data
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
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
          </div>

          {/* Mapping Panels */}
          <div className="lg:col-span-9 space-y-6">
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
                  <div className="space-y-4">
                    {mappings.map((mapping) => {
                      const mappedField = getMappedField(mapping.sourceField);
                      const isRequired = mapping.required;
                      const isMapped = mapping.canonicalField !== null;
                      const isOver = overId === mapping.sourceField;
                      
                      return (
                        <div 
                          key={mapping.sourceField}
                          className={`p-4 border-2 rounded-lg transition-all ${
                            isRequired && !isMapped 
                              ? 'border-destructive bg-destructive/5' 
                              : isMapped
                              ? 'border-success bg-success/5'
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            {/* Source field info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono text-sm font-medium">
                                  {mapping.sourceField}
                                </span>
                                {isRequired && (
                                  <Badge variant="destructive" className="text-xs">Required</Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {mapping.detected_type}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {mapping.populated_pct.toFixed(1)}% populated
                                </Badge>
                                <Badge 
                                  variant={mapping.confidence >= 0.8 ? "default" : mapping.confidence >= 0.6 ? "secondary" : "destructive"}
                                  className="text-xs"
                                >
                                  {Math.round(mapping.confidence * 100)}% confidence
                                </Badge>
                              </div>
                            </div>

                            <ArrowRight className="h-4 w-4 text-muted-foreground mt-2" />

                            {/* Drop zone */}
                            <div className="flex-1">
                              <DroppableZone id={mapping.sourceField} isOver={isOver}>
                                {mappedField ? (
                                  <CanonicalFieldPillComponent 
                                    field={mappedField} 
                                    mapped={true}
                                    onRemove={() => removeMapping(mapping.sourceField)}
                                  />
                                ) : (
                                  <span className="text-sm text-muted-foreground text-center">
                                    Drop canonical field here
                                  </span>
                                )}
                              </DroppableZone>
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

        {/* Action buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Upload
          </Button>
          
          <Button 
            onClick={handleSubmit}
            disabled={!validationStatus.isValid}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Submit Mapping
          </Button>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeId ? (
          <div className="opacity-80">
            <CanonicalFieldPillComponent 
              field={availableFields.find(f => f.id === activeId)!} 
              mapped={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}