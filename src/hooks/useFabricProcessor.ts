import { useState } from "react";
import { showToast, Toast, Clipboard } from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export const PATHS = {
  FABRIC: path.join(process.env.HOME || "", "go/bin/fabric"),
  SAVE: path.join(process.env.HOME || "", ".local/bin/save"),
  PATTERNS: path.join(process.env.HOME || "", ".config/fabric/patterns"),
  SAVE_TARGET: "/Users/alexandrecarvalho/Library/Mobile Documents/iCloud~md~obsidian/Documents/AlexNotesObsVault/Inbox/Fabric"
} as const;

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
      const isUrl = input.startsWith('http');
      const command = isUrl
        ? `curl -s "${input}" | ${PATHS.FABRIC} --pattern ${pattern}`
        : `cat "${await createTempFile(input)}" | ${PATHS.FABRIC} --pattern ${pattern}`;

      // Run fabric
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
    await executeCommand(`cat "${tempFile}" | ${PATHS.SAVE} "${fileName}"`);
    
    const currentDate = new Date().toISOString().split('T')[0];
    const savedFile = path.join(PATHS.SAVE_TARGET, `${currentDate}-${fileName}.md`);
    
    const fileExists = await fs.promises.access(savedFile).then(() => true).catch(() => false);
    if (!fileExists) throw new Error(`File not saved at: ${savedFile}`);

    await showToast({
      style: Toast.Style.Success,
      title: "Success",
      message: `File saved as: ${fileName}`
    });
  };

  return { processContent, isProcessing };
}