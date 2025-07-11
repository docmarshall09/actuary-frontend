import React from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CanonicalField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  fileType: string;
}

const canonicalFields: CanonicalField[] = [
  // Policy File Fields
  {
    name: 'policy_number',
    type: 'string',
    required: true,
    description: 'Unique contract identifier',
    fileType: 'Policy'
  },
  {
    name: 'effective_date',
    type: 'date',
    required: true,
    description: 'Start of coverage period',
    fileType: 'Policy'
  },
  {
    name: 'expiration_date',
    type: 'date',
    required: true,
    description: 'End of coverage period',
    fileType: 'Policy'
  },
  {
    name: 'premium_written',
    type: 'decimal',
    required: true,
    description: 'Gross written premium amount',
    fileType: 'Policy'
  },
  {
    name: 'product_type',
    type: 'string',
    required: true,
    description: 'Product category (e.g., TV, appliance, auto)',
    fileType: 'Policy'
  },
  {
    name: 'coverage_code',
    type: 'string',
    required: false,
    description: 'SKU or plan code for reporting',
    fileType: 'Policy'
  },
  {
    name: 'coverage_term_months',
    type: 'integer',
    required: false,
    description: 'Coverage period in months (auto-derived if missing)',
    fileType: 'Policy'
  },
  {
    name: 'status',
    type: 'enum',
    required: false,
    description: 'Policy status (Open/Cancelled) - derived from cancel file',
    fileType: 'Policy'
  },

  // Claim File Fields
  {
    name: 'claim_number',
    type: 'string',
    required: true,
    description: 'Unique claim identifier',
    fileType: 'Claim'
  },
  {
    name: 'policy_number',
    type: 'string',
    required: true,
    description: 'Foreign key to Policy file',
    fileType: 'Claim'
  },
  {
    name: 'paid_date',
    type: 'date',
    required: true,
    description: 'Date claim was fully settled and paid',
    fileType: 'Claim'
  },
  {
    name: 'report_date',
    type: 'date',
    required: true,
    description: 'First Notice of Loss (FNOL) date',
    fileType: 'Claim'
  },
  {
    name: 'paid_amount',
    type: 'decimal',
    required: true,
    description: 'Cumulative amount paid to date',
    fileType: 'Claim'
  },
  {
    name: 'claim_resolution',
    type: 'string',
    required: false,
    description: 'Resolution type (repair, replace, settlement)',
    fileType: 'Claim'
  },

  // Cancel File Fields (Optional)
  {
    name: 'policy_number',
    type: 'string',
    required: true,
    description: 'Contract to cancel',
    fileType: 'Cancel'
  },
  {
    name: 'cancel_date',
    type: 'date',
    required: true,
    description: 'Effective date of cancellation',
    fileType: 'Cancel'
  },
  {
    name: 'refund_premium',
    type: 'decimal',
    required: true,
    description: 'Unearned premium returned (negative)',
    fileType: 'Cancel'
  }
];

export function PreUploadChecklist() {
  const fileTypes = ['Policy', 'Claim', 'Cancel'];

  const getFieldsByFileType = (fileType: string) => {
    return canonicalFields.filter(field => field.fileType === fileType);
  };

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
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Required Data Fields</h2>
        <p className="text-muted-foreground">
          Review the canonical field requirements before uploading your files
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {fileTypes.map((fileType) => (
          <Card key={fileType} className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                {fileType} File
              </CardTitle>
              <CardDescription>
                {fileType === 'Policy' && 'Required - Contract and coverage information'}
                {fileType === 'Claim' && 'Required - Loss and settlement data'}
                {fileType === 'Cancel' && 'Optional - Cancellation and refund data'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {getFieldsByFileType(fileType).map((field) => (
                <div 
                  key={`${fileType}-${field.name}`} 
                  className="p-3 border rounded-lg bg-muted/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">
                      {field.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getTypeColor(field.type)}`}
                      >
                        {field.type}
                      </Badge>
                      {field.required && (
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {field.description}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-900">Important Notes</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Policy and Claim files are required</strong> - Cancel file is optional</li>
                <li>• All dates must be valid and within reasonable ranges</li>
                <li>• Premium and claim amounts must be positive values</li>
                <li>• <strong>No formulas allowed</strong> - cells starting with =, +, or - will cause validation errors</li>
                <li>• Supported formats: CSV, Excel (.xlsx, .xls)</li>
                <li>• Maximum file size: 50MB per file</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}