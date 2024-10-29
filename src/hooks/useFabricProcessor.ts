import { useState } from "react";
import { showToast, Toast, Clipboard, getPreferenceValues } from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

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
    SAVE_TARGET: preferences.saveTargetPath ? expandTilde(preferences.saveTargetPath) : undefined
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
    setTimeout(() => fs.unlink(tempFile, () => {}), 1000);
    return tempFile;
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
      // Process input
      const isUrl = !input.includes('\n');
      const command = isUrl
        ? `curl -sL "https://r.jina.ai/${input}" | ${PATHS.FABRIC} --pattern ${pattern}`
        : `cat "${await createTempFile(input)}" | ${PATHS.FABRIC} --pattern ${pattern}`;

      const { stdout: output, stderr: error } = await executeCommand(command);
      if (error) throw new Error(`Fabric error: ${error}`);

      // Save if filename provided
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
