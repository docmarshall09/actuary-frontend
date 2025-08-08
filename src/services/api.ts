const API_BASE_URL = 'http://localhost:8000';

export interface UploadResponse {
  upload_id: string;
}

export interface DetectionResponse {
  source_field: string;
  suggested_canonical: string;
  populated_pct: number;
  detected_type: string;
  confidence: number;
}

export interface MappingRequest {
  upload_id: string;
  file_type: string;
  mappings: Record<string, any>;
}

export interface MappingResponse {
  status: string;
  message: string;
}

export interface JobStatus {
  file_type: string;
  status: 'done' | 'running' | 'queued' | 'failed';
  progress: number;
  message: string;
  updated_at: string;
}

export interface StatusResponse {
  upload_id: string;
  jobs: JobStatus[];
  overall: 'done' | 'running' | 'failed' | 'pending' | 'unknown';
}

export const apiService = {
  async uploadFiles(files: { policy?: File; claim?: File; cancel?: File }): Promise<UploadResponse> {
    const formData = new FormData();
    
    if (files.policy) formData.append('policy', files.policy);
    if (files.claim) formData.append('claim', files.claim);
    if (files.cancel) formData.append('cancel', files.cancel);

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  },

  async detectFields(uploadId: string, fileType: string): Promise<DetectionResponse[]> {
    const response = await fetch(`${API_BASE_URL}/api/detect/${uploadId}/${fileType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Field detection failed: ${response.statusText}`);
    }

    return response.json();
  },

  async submitMapping(request: MappingRequest): Promise<MappingResponse> {
    const response = await fetch(`${API_BASE_URL}/api/mapping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Mapping submission failed: ${response.statusText}`);
    }

    return response.json();
  },

  async getStatus(uploadId: string): Promise<StatusResponse> {
    const response = await fetch(`${API_BASE_URL}/api/status/${uploadId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }

    return response.json();
  },

  async pollStatus(uploadId: string, onUpdate?: (status: StatusResponse) => void): Promise<StatusResponse> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getStatus(uploadId);
          onUpdate?.(status);
          
          if (status.overall === 'done' || status.overall === 'failed') {
            resolve(status);
          } else {
            setTimeout(poll, 2000); // Poll every 2 seconds
          }
        } catch (error) {
          reject(error);
        }
      };
      
      poll();
    });
  },
};