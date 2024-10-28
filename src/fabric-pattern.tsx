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

// Constants for paths
const SAVE_TARGET_DIR = "/Users/alexandrecarvalho/Library/Mobile Documents/iCloud~md~obsidian/Documents/AlexNotesObsVault/Inbox/Fabric";

export default function Command() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveFileName, setSaveFileName] = useState("");
  const [inputUrl, setInputUrl] = useState("");

  // Verify commands exist
  useEffect(() => {
    const verifyCommands = async () => {
      const fabricPath = path.join(process.env.HOME || "", "go/bin/fabric");
      const savePath = path.join(process.env.HOME || "", ".local/bin/save");

      const fabricExists = await fs.promises.access(fabricPath)
        .then(() => true)
        .catch(() => false);
      
      const saveExists = await fs.promises.access(savePath)
        .then(() => true)
        .catch(() => false);

      if (!fabricExists) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message: "fabric command not found in ~/go/bin/"
        });
      }

      if (!saveExists) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message: "save command not found in ~/.local/bin/"
        });
      }
    };

    verifyCommands();
  }, []);

  // Load patterns from directory
  useEffect(() => {
    const loadPatterns = async () => {
      const patternsDir = path.join(process.env.HOME || "", ".config/fabric/patterns");
      
      try {
        const dirExists = await fs.promises.access(patternsDir)
          .then(() => true)
          .catch(() => false);

        if (!dirExists) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Error",
            message: "Patterns directory does not exist!"
          });
          setPatterns([]);
          setIsLoading(false);
          return;
        }

        const files = await fs.promises.readdir(patternsDir);
        const patternsList = files.map(file => ({
          name: path.basename(file, path.extname(file)),
          path: path.join(patternsDir, file)
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
      }
      setIsLoading(false);
    };

    loadPatterns();
  }, []);

  const processWithPattern = async (pattern: Pattern, formValues: FormValues) => {
    try {
      // Debug form values
      console.log("Form Values:", formValues);
      console.log("Save File Name:", formValues.saveFileName);

      await showToast({
        style: Toast.Style.Animated,
        title: "Debug Form Values",
        message: `Save File Name: ${formValues.saveFileName || "not set"}`
      });

      const fabricPath = path.join(process.env.HOME || "", "go/bin/fabric");
      const savePath = path.join(process.env.HOME || "", ".local/bin/save");
      const catPath = "/bin/cat";
      let command = "";
      
      // Build command based on input type
      if (inputUrl) {
        command = `curl -s "${inputUrl}" | ${fabricPath} --pattern ${pattern.name}`;
      } else {
        // Get clipboard content using Raycast's API
        const clipboardText = await Clipboard.readText();
        if (!clipboardText) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Error",
            message: "No text in clipboard"
          });
          return;
        }
        
        // Create a temporary file for the clipboard content
        const tempFile = path.join(process.env.TMPDIR || "/tmp", `raycast-fabric-${Date.now()}.txt`);
        await fs.promises.writeFile(tempFile, clipboardText);
        
        command = `${catPath} "${tempFile}" | ${fabricPath} --pattern ${pattern.name}`;
        
        // Debug: Show clipboard content saved
        console.log("Clipboard content saved to temp file:", tempFile);

        // Clean up temp file after command execution
        setTimeout(() => fs.unlink(tempFile, () => {}), 1000);
      }

      // Debug: Show fabric command
      console.log("Executing fabric command:", command);

      // Execute fabric command
      const { stdout: fabricOutput, stderr: fabricError } = await execAsync(command, {
        env: {
          ...process.env,
          PATH: `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.HOME}/go/bin:${process.env.HOME}/.local/bin:${process.env.PATH || ""}`,
        },
        shell: '/bin/bash'
      });

      console.log("Fabric Output:", fabricOutput);
      console.log("Fabric Error:", fabricError);

      // If saving is requested
      if (formValues.saveFileName) {
        console.log("Save requested with filename:", formValues.saveFileName);

        // Create temporary file with fabric output
        const tempOutputFile = path.join(process.env.TMPDIR || "/tmp", `raycast-output-${Date.now()}.txt`);
        await fs.promises.writeFile(tempOutputFile, fabricOutput);
        console.log("Fabric output saved to temp file:", tempOutputFile);

        // Build and execute save command
        const saveCommand = `${catPath} "${tempOutputFile}" | ${savePath} "${formValues.saveFileName}"`;
        console.log("Executing save command:", saveCommand);

        const { stdout: saveOutput, stderr: saveError } = await execAsync(saveCommand, {
          env: {
            ...process.env,
            PATH: `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.HOME}/go/bin:${process.env.HOME}/.local/bin:${process.env.PATH || ""}`,
          },
          shell: '/bin/bash'
        });

        console.log("Save Output:", saveOutput);
        console.log("Save Error:", saveError);

        // Clean up temporary output file
        setTimeout(() => fs.unlink(tempOutputFile, () => {}), 1000);

        if (saveError) {
          throw new Error(`Save error: ${saveError}`);
        }

        // Verify the file was saved
        const currentDate = new Date().toISOString().split('T')[0];
        const expectedFile = path.join(SAVE_TARGET_DIR, `${currentDate}-${formValues.saveFileName}.md`);
        console.log("Looking for saved file at:", expectedFile);

        const fileExists = await fs.promises.access(expectedFile)
          .then(() => true)
          .catch(() => false);

        if (fileExists) {
          const fileContent = await fs.promises.readFile(expectedFile, 'utf8');
          console.log('Saved File Contents:', fileContent);
          
          await showToast({
            style: Toast.Style.Success,
            title: "Success",
            message: `File saved to: ${expectedFile}`
          });
        } else {
          throw new Error(`File not saved at: ${expectedFile}`);
        }
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