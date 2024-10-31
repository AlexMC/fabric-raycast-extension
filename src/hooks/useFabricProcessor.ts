import { useState } from "react";
import { showToast, Toast, Clipboard, getPreferenceValues } from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fetchUrlContent } from '../utils/urlFetcher';

const execAsync = promisify(exec);

interface Pattern {
  name: string;
  path: string;
  description?: string;
}

interface Preferences {
  fabricPath: string;
  savePath: string;
  patternsPath: string;
  saveTargetPath?: string;
  model?: string;
}

function expandTilde(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(process.env.HOME || '', filePath.slice(2));
  }
  return filePath;
}

export const PATHS = (() => {
  const preferences = getPreferenceValues<Preferences>();
  return {
    FABRIC: expandTilde(preferences.fabricPath || path.join(process.env.HOME || "", "go/bin/fabric")),
    SAVE: expandTilde(preferences.savePath || path.join(process.env.HOME || "", ".local/bin/save")),
    PATTERNS: expandTilde(preferences.patternsPath || path.join(process.env.HOME || "", ".config/fabric/patterns")),
    SAVE_TARGET: preferences.saveTargetPath ? expandTilde(preferences.saveTargetPath) : undefined,
    MODEL: preferences.model || undefined
  } as const;
})();

const getPatternDescription = async (patternName: string): Promise<string> => {
  try {
    const systemPath = path.join(PATHS.PATTERNS, patternName, 'system.md');
    const content = await fs.promises.readFile(systemPath, 'utf-8');
    return content.trim();
  } catch (error) {
    return ''; // Return empty string if system.md doesn't exist
  }
};

export function useFabricProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);

  const createTempFile = async (content: string): Promise<string> => {
    const tempFile = path.join(process.env.TMPDIR || "/tmp", `raycast-fabric-${Date.now()}.txt`);
    await fs.promises.writeFile(tempFile, content);
    return tempFile;
  };

  const cleanupTempFile = async (tempFile: string) => {
    try {
      await fs.promises.unlink(tempFile);
    } catch (error) {
      console.error('Error cleaning up temp file:', error);
    }
  };

  const executeCommand = async (command: string) => {
    return execAsync(command, {
      env: {
        ...process.env,
        PATH: `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.HOME}/go/bin:${process.env.HOME}/.local/bin:${process.env.PATH || ""}`,
      },
      shell: '/bin/bash'
    });
  };

  const processContent = async (pattern: string, input: string, saveFileName?: string) => {
    setIsProcessing(true);
    try {
      const fabricCmd = `${PATHS.FABRIC} --pattern ${pattern}${PATHS.MODEL ? ` -m "${PATHS.MODEL}"` : ''}`;
      
      let command;
      if (input.startsWith('yt --transcript ')) {
        command = `${input} | ${fabricCmd}`;
      } else if (input.startsWith('-u ')) {
        const url = input.slice(3);
        const content = await fetchUrlContent(url);
        const tempFile = await createTempFile(content);
        
        try {
          command = `cat "${tempFile}" | ${fabricCmd}`;
          const { stdout } = await executeCommand(command);
          await cleanupTempFile(tempFile);
          return stdout;
        } catch (error) {
          await cleanupTempFile(tempFile);
          throw error;
        }
      } else {
        command = `cat "${await createTempFile(input)}" | ${fabricCmd}`;
      }

      console.log(`Executing command: ${command}`);
      const { stdout: output, stderr: error } = await executeCommand(command);
      console.log(`Output: ${output}`);
      console.log(`Error: ${error}`);
      
      if (error) {
        throw new Error(`Fabric error: ${error}`);
      }

      if (saveFileName) {
        await saveOutput(output, saveFileName);
      }

      return output;
    } finally {
      setIsProcessing(false);
    }
  };

  const saveOutput = async (content: string, fileName: string) => {
    const tempFile = await createTempFile(content);
    
    // Build save command conditionally
    const saveCommand = PATHS.SAVE_TARGET 
      ? `cat "${tempFile}" | ${PATHS.SAVE} -d "${PATHS.SAVE_TARGET}" "${fileName}"`
      : `cat "${tempFile}" | ${PATHS.SAVE} "${fileName}"`;
    
    await executeCommand(saveCommand);
    
    // Only attempt to verify the file if we know where it was saved
    if (PATHS.SAVE_TARGET) {
      const currentDate = new Date().toISOString().split('T')[0];
      const savedFile = path.join(PATHS.SAVE_TARGET, `${currentDate}-${fileName}.md`);
      
      const fileExists = await fs.promises.access(savedFile).then(() => true).catch(() => false);
      if (!fileExists) throw new Error(`File not saved at: ${savedFile}`);
    }

    await showToast({
      style: Toast.Style.Success,
      title: "Success",
      message: `File saved as: ${fileName}`
    });
  };

  const loadPatterns = async (): Promise<Pattern[]> => {
    const files = await fs.promises.readdir(PATHS.PATTERNS);
    const patterns = await Promise.all(
      files
        .filter(file => 
          file !== '.DS_Store' && 
          file !== 'raycast' && 
          !file.startsWith('.')
        )
        .map(async (file) => ({
          name: path.basename(file, path.extname(file)),
          path: path.join(PATHS.PATTERNS, file),
          description: await getPatternDescription(file)
        }))
    );
    return patterns;
  };

  return { processContent, isProcessing, loadPatterns };
}
