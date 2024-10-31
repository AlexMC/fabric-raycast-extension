import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function fetchUrlContent(url: string): Promise<string> {
  // First, check the content type
  const headCommand = `curl -I -L -s "${url}"`;
  try {
    const { stdout: headers } = await execAsync(headCommand);
    const contentType = headers.toLowerCase();
    
    if (headers.toLowerCase().includes('content-type: application/pdf')) {
      try {
        const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
        const { stdout } = await execAsync(`curl -L -s "${jinaUrl}"`);
        return stdout;
      } catch (pdfError) {
        throw new Error(`Failed to process PDF: ${pdfError}. The r.jina.ai service might be unavailable.`);
      }
    }
    
    // For regular web pages
    const { stdout } = await execAsync(`curl -L -s -A "Mozilla/5.0" "${url}"`);
    if (!stdout) {
      throw new Error('No content available from URL');
    }
    return stdout;
  } catch (error) {
    throw new Error(`Failed to fetch URL: ${error}`);
  }
}

// Optional: Add timeout for both regular and PDF requests
export async function fetchUrlContentWithTimeout(url: string, timeoutSeconds: number = 30): Promise<string> {
  const command = `curl -L -s --max-time ${timeoutSeconds} "${url}"`;
  try {
    const { stdout } = await execAsync(command);
    return stdout;
  } catch (error) {
    throw new Error(`Request timed out or failed: ${error}`);
  }
} 