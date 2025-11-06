import { backendApi } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export enum DownloadFormat {
  PDF = 'pdf',
  PPTX = 'pptx',
  GOOGLE_SLIDES = 'google-slides',
}

export function sanitizePresentationSlug(name: string): string {
  if (!name) {
    return 'presentation';
  }

  const normalized = name.normalize('NFKD');
  const stripped = normalized.replace(/[\u0300-\u036f]/g, '');
  const lower = stripped.toLowerCase();
  const ascii = lower.replace(/[^a-z0-9\s-]/g, '');
  const collapsed = ascii.trim().replace(/[\s-]+/g, '_');
  const trimmed = collapsed.replace(/^_+|_+$/g, '');
  return trimmed.slice(0, 64) || 'presentation';
}

/**
 * Utility functions for handling presentation slide file paths
 */

/**
 * Validates and extracts presentation info from a file path in a single operation
 * @param filePath - The file path to validate and extract information from
 * @returns Object containing validation result and extracted data
 */
export function parsePresentationSlidePath(filePath: string | null): {
  isValid: boolean;
  presentationName: string | null;
  slideNumber: number | null;
} {
  if (!filePath) {
    return { isValid: false, presentationName: null, slideNumber: null };
  }
  
  const match = filePath.match(/^presentations\/([^\/]+)\/slide_(\d+)\.html$/i);
  if (match) {
    return {
      isValid: true,
      presentationName: match[1],
      slideNumber: parseInt(match[2], 10)
    };
  }
  
  return { isValid: false, presentationName: null, slideNumber: null };
}

/**
 * Creates modified tool content for PresentationViewer from presentation slide data
 * @param presentationName - Name of the presentation
 * @param filePath - Path to the slide file
 * @param slideNumber - Slide number
 * @returns JSON stringified tool content that matches expected structure
 */
export function createPresentationViewerToolContent(
  presentationName: string,
  filePath: string,
  slideNumber: number
): string {
  const mockToolOutput = {
    presentation_name: presentationName,
    presentation_path: filePath,
    slide_number: slideNumber,
    presentation_title: `Slide ${slideNumber}`
  };

  return JSON.stringify({
    result: {
      output: JSON.stringify(mockToolOutput),
      success: true
    },
    tool_name: 'presentation-viewer'
  });
}

/**
 * Downloads a presentation as PDF or PPTX
 * @param sandboxUrl - The sandbox URL for the API endpoint
 * @param presentationPath - The path to the presentation in the workspace
 * @param presentationName - The name of the presentation for the downloaded file
 * @param format - The format to download the presentation as
 * @returns Promise that resolves when download is complete
 */
export async function downloadPresentation(
  format: DownloadFormat,
  sandboxUrl: string, 
  presentationPath: string, 
  presentationName: string
): Promise<void> {
  try {
    if (!sandboxUrl) {
      throw new Error('Sandbox URL is missing');
    }
    
    if (!presentationPath) {
      throw new Error('Presentation path is missing');
    }

    // Ensure sandboxUrl doesn't have trailing slash
    const cleanSandboxUrl = sandboxUrl.replace(/\/$/, '');
    const endpoint = `${cleanSandboxUrl}/presentation/convert-to-${format}`;
    
    console.log(`[Export] Requesting export to ${format.toUpperCase()}:`, {
      endpoint,
      presentationPath,
      presentationName
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Daytona-Skip-Preview-Warning': 'true',
      },
      body: JSON.stringify({
        presentation_path: presentationPath,
        download: true
      })
    });
    
    console.log(`[Export] Response status: ${response.status} ${response.statusText}`);
    console.log(`[Export] Response headers:`, Object.fromEntries(response.headers.entries()));
    
    // Check content type first to determine how to handle the response
    const contentType = response.headers.get('content-type') || '';
    
    if (!response.ok) {
      // Try to extract error message from response
      let errorMessage = `Failed to export to ${format.toUpperCase()} (${response.status})`;
      
      try {
        // Try to read as text first (works for both JSON and plain text)
        const errorText = await response.text();
        if (errorText) {
          try {
            // Try to parse as JSON
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } catch {
            // Not JSON, use text as-is if it's meaningful
            if (errorText.trim().length > 0 && errorText.length < 500) {
              errorMessage = errorText;
            }
          }
        }
      } catch (parseError) {
        console.error('[Export] Failed to parse error response:', parseError);
        // Use default error message
      }
      
      throw new Error(errorMessage);
    }
    
    // Verify we're getting the expected content type for successful responses
    const isPDF = contentType.includes('application/pdf');
    const isPPTX = contentType.includes('application/vnd.openxmlformats');
    
    // Read the response as blob
    const blob = await response.blob();
    
    // Check if blob is empty
    if (blob.size === 0) {
      throw new Error(`Empty response from server when exporting to ${format.toUpperCase()}`);
    }
    
    // Verify blob type matches expected format
    const isValidBlobType = 
      blob.type.includes('pdf') || 
      blob.type.includes('openxmlformats') || 
      blob.type.includes('octet-stream') ||
      blob.type === ''; // Some servers don't set blob type correctly
    
    // If content type header was wrong OR blob type is wrong, check if it's an error
    if ((!isPDF && !isPPTX) || !isValidBlobType) {
      // Clone blob before reading as text (so we can still use original if it's valid)
      const blobClone = blob.slice();
      const responseText = await blobClone.text();
      
      // Check if it's a JSON error response
      try {
        const jsonData = JSON.parse(responseText);
        if (jsonData.detail || jsonData.message) {
          throw new Error(jsonData.detail || jsonData.message);
        }
      } catch (parseError) {
        // Not JSON, check if it's an HTML error page
        if (responseText.includes('error') || responseText.includes('Error') || responseText.includes('failed')) {
          throw new Error(`Server returned error: ${responseText.substring(0, 200)}`);
        }
        // If we got here and content type/blob type is wrong, it's an error
        if (!isPDF && !isPPTX && !isValidBlobType) {
          throw new Error(`Unexpected response type: ${contentType}, blob type: ${blob.type}. Expected PDF or PPTX.`);
        }
      }
    }
    
    // Create download link and trigger download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${presentationName}.${format}`;
    a.style.display = 'none';
    
    // Append to body, click, then remove
    document.body.appendChild(a);
    
    // Use setTimeout to ensure the element is in the DOM before clicking
    setTimeout(() => {
      a.click();
      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    }, 0);
    
    toast.success(`Downloaded ${presentationName} as ${format.toUpperCase()}`, {
      duration: 8000,
    });
  } catch (error) {
    console.error(`[Export] Error downloading ${format}:`, error);
    const errorMessage = error instanceof Error ? error.message : `Failed to export to ${format.toUpperCase()}`;
    toast.error(errorMessage, {
      duration: 8000,
    });
    throw error; // Re-throw to allow calling code to handle
  }
}

export const handleGoogleAuth = async (presentationPath: string, sandboxUrl: string) => {
  try {
    // Store intent to upload to Google Slides after OAuth
    sessionStorage.setItem('google_slides_upload_intent', JSON.stringify({
      presentation_path: presentationPath,
      sandbox_url: sandboxUrl
    }));
    
    // Pass the current URL to the backend so it can be included in the OAuth state
    const currentUrl = encodeURIComponent(window.location.href);
    const response = await backendApi.get(`/google/auth-url?return_url=${currentUrl}`);
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to get auth URL');
    }
    
    const { auth_url } = response.data;
    
    if (auth_url) {
      window.location.href = auth_url;
      return;
    }
  } catch (error) {
    console.error('Error initiating Google auth:', error);
    toast.error('Failed to initiate Google authentication');
  }
};


export const handleGoogleSlidesUpload = async (sandboxUrl: string, presentationPath: string) => {
  if (!sandboxUrl || !presentationPath) {
    throw new Error('Missing required parameters');
  }
  
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    // Use proper backend API client with authentication and extended timeout for PPTX generation
    const response = await backendApi.post('/presentation-tools/convert-and-upload-to-slides', {
      presentation_path: presentationPath,
      sandbox_url: sandboxUrl,
    }, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      timeout: 180000, // 3 minutes timeout for PPTX generation (longer than backend's 2 minute timeout)
    });

    if (!response.success) {
      throw new Error('Failed to upload to Google Slides');
    }

    const result = response.data;
    
    if (!result.success && !result.is_api_enabled) {
      toast.info('Redirecting to Google authentication...', {
        duration: 3000,
      });
      handleGoogleAuth(presentationPath, sandboxUrl);
      return {
        success: false,
        redirected_to_auth: true,
        message: 'Redirecting to Google authentication'
      };
    }
    
    if (result.google_slides_url) {
      // Always show rich success toast - this is universal
      toast.success('🎉 Presentation uploaded successfully!', {
        action: {
          label: 'Open in Google Slides',
          onClick: () => window.open(result.google_slides_url, '_blank'),
        },
        duration: 20000,
      });
      
      // Extract presentation name from path for display
      const presentationName = presentationPath.split('/').pop() || 'presentation';
      
      return {
        success: true,
        google_slides_url: result.google_slides_url,
        message: `"${presentationName}" uploaded successfully`
      };
    } 
    
    // Only throw error if no Google Slides URL was returned
    throw new Error(result.message || 'No Google Slides URL returned');
    
  } catch (error) {
    console.error('Error uploading to Google Slides:', error);
    
    // Show error toasts - this is also universal
    if (error instanceof Error && error.message.includes('not authenticated')) {
      toast.error('Please authenticate with Google first');
    } else {
      toast.error('Failed to upload to Google Slides');
    }
    
    // Re-throw for any calling code that needs to handle it
    throw error;
  }
};
