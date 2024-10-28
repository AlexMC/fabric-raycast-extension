import { List, ActionPanel, Action, Form, Icon, showToast, Toast, Clipboard } from "@raycast/api";
import { useState, useEffect } from "react";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

interface Pattern {
  name: string;
  path: string;
}

interface FormValues {
  saveFileName?: string;
  url?: string;
}

// Define base paths as constants for better maintainability
const PATHS = {
  FABRIC: path.join(process.env.HOME || "", "go/bin/fabric"),
  SAVE: path.join(process.env.HOME || "", ".local/bin/save"),
  PATTERNS: path.join(process.env.HOME || "", ".config/fabric/patterns"),
  SAVE_TARGET: "/Users/alexandrecarvalho/Library/Mobile Documents/iCloud~md~obsidian/Documents/AlexNotesObsVault/Inbox/Fabric"
} as const;

export default function Command() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveFileName, setSaveFileName] = useState("");
  const [inputUrl, setInputUrl] = useState("");

  // Verify required CLI tools exist
  useEffect(() => {
    const verifyCommands = async () => {
      const checks = [
        { path: PATHS.FABRIC, name: 'fabric', location: '~/go/bin/' },
        { path: PATHS.SAVE, name: 'save', location: '~/.local/bin/' }
      ];

      for (const check of checks) {
        const exists = await fs.promises.access(check.path).then(() => true).catch(() => false);
        if (!exists) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Error",
            message: `${check.name} command not found in ${check.location}`
          });
        }
      }
    };

    verifyCommands();
  }, []);

  // Load patterns from directory
  useEffect(() => {
    const loadPatterns = async () => {
      try {
        const dirExists = await fs.promises.access(PATHS.PATTERNS).then(() => true).catch(() => false);
        if (!dirExists) {
          throw new Error("Patterns directory does not exist!");
        }

        const files = await fs.promises.readdir(PATHS.PATTERNS);
        const patternsList = files.map(file => ({
          name: path.basename(file, path.extname(file)),
          path: path.join(PATHS.PATTERNS, file)
        }));
        
        setPatterns(patternsList);
        await showToast({
          style: Toast.Style.Success,
          title: "Patterns Loaded",
          message: `Found ${files.length} patterns`
        });
      } catch (error) {
        console.error("Error loading patterns:", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message: `Failed to load patterns: ${error}`
        });
        setPatterns([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPatterns();
  }, []);

  // Helper function to create temporary files
  const createTempFile = async (content: string): Promise<string> => {
    const tempFile = path.join(process.env.TMPDIR || "/tmp", `raycast-fabric-${Date.now()}.txt`);
    await fs.promises.writeFile(tempFile, content);
    // Cleanup after 1 second
    setTimeout(() => fs.unlink(tempFile, () => {}), 1000);
    return tempFile;
  };

  // Helper function to execute shell commands
  const executeCommand = async (command: string) => {
    return execAsync(command, {
      env: {
        ...process.env,
        PATH: `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.HOME}/go/bin:${process.env.HOME}/.local/bin:${process.env.PATH || ""}`,
      },
      shell: '/bin/bash'
    });
  };

  const processWithPattern = async (pattern: Pattern, formValues: FormValues) => {
    try {
      // Handle input source (URL or clipboard)
      let command = "";
      if (inputUrl) {
        command = `curl -s "${inputUrl}" | ${PATHS.FABRIC} --pattern ${pattern.name}`;
      } else {
        const clipboardText = await Clipboard.readText();
        if (!clipboardText) throw new Error("No text in clipboard");
        const tempFile = await createTempFile(clipboardText);
        command = `cat "${tempFile}" | ${PATHS.FABRIC} --pattern ${pattern.name}`;
      }

      // Process with fabric
      const { stdout: fabricOutput, stderr: fabricError } = await executeCommand(command);
      if (fabricError) throw new Error(`Fabric error: ${fabricError}`);

      // Handle saving if filename provided
      if (formValues.saveFileName) {
        const tempOutputFile = await createTempFile(fabricOutput);
        const saveCommand = `cat "${tempOutputFile}" | ${PATHS.SAVE} "${formValues.saveFileName}"`;
        
        await executeCommand(saveCommand);

        // Verify save was successful
        const currentDate = new Date().toISOString().split('T')[0];
        const savedFile = path.join(PATHS.SAVE_TARGET, `${currentDate}-${formValues.saveFileName}.md`);
        
        const fileExists = await fs.promises.access(savedFile).then(() => true).catch(() => false);
        if (!fileExists) throw new Error(`File not saved at: ${savedFile}`);

        await showToast({
          style: Toast.Style.Success,
          title: "Success",
          message: `File saved to: ${savedFile}`
        });
      }

      return fabricOutput;
    } catch (error) {
      console.error("Error processing:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: `Failed to process: ${error}`
      });
      throw error;
    }
  };

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search patterns..."
      searchBarAccessory={
        <List.Dropdown
          tooltip="Input Source"
          storeValue={true}
          onChange={(newValue) => {
            setInputUrl(newValue === "clipboard" ? "" : newValue);
          }}
        >
          <List.Dropdown.Item title="From Clipboard" value="clipboard" />
          <List.Dropdown.Item title="From URL" value="" />
        </List.Dropdown>
      }
    >
      {patterns.map((pattern) => (
        <List.Item
          key={pattern.name}
          title={pattern.name}
          actions={
            <ActionPanel>
              <Action.Push
                title="Process with Pattern"
                target={
                  <Form
                    actions={
                      <ActionPanel>
                        <Action.SubmitForm
                          title="Process"
                          onSubmit={async (values: FormValues) => {
                            console.log("Form submitted with values:", values);
                            await processWithPattern(pattern, values);
                          }}
                        />
                      </ActionPanel>
                    }
                  >
                    {inputUrl === "" ? null : (
                      <Form.TextField
                        id="url"
                        title="URL"
                        placeholder="Enter URL"
                        value={inputUrl}
                        onChange={setInputUrl}
                      />
                    )}
                    <Form.TextField
                      id="saveFileName"
                      title="Save As (Optional)"
                      placeholder="Enter filename to save"
                    />
                  </Form>
                }
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
