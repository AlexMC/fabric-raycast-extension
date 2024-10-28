import { List, ActionPanel, Action, Form, Icon, showToast, Toast, Clipboard, Detail } from "@raycast/api";
import { useState, useEffect } from "react";
import { useNavigation } from "@raycast/api";
import fs from "fs";
import path from "path";
import { useFabricProcessor, PATHS } from "./hooks/useFabricProcessor";

interface Pattern {
  name: string;
  path: string;
}

function ResultView({ content, fileName, isLoading }: { content?: string; fileName?: string; isLoading: boolean }) {
  return (
    <Detail
      isLoading={isLoading}
      markdown={content || "No content available"}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard content={content || ""} />
          <Action.Push title="Back to Patterns" target={<Command />} />
        </ActionPanel>
      }
      metadata={fileName ? <Detail.Metadata><Detail.Metadata.Label title="Saved As" text={fileName} /></Detail.Metadata> : null}
    />
  );
}

export default function Command() {
  const navigation = useNavigation();
  const { processContent, isProcessing } = useFabricProcessor();
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputUrl, setInputUrl] = useState("");

  useEffect(() => {
    const loadPatterns = async () => {
      try {
        const files = await fs.promises.readdir(PATHS.PATTERNS);
        setPatterns(files.map(file => ({
          name: path.basename(file, path.extname(file)),
          path: path.join(PATHS.PATTERNS, file)
        })));
      } catch (error) {
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

  const handleSubmit = async (pattern: Pattern, values: { saveFileName?: string; url?: string }) => {
    try {
      navigation.pop();
      navigation.push(<ResultView content="Processing..." isLoading={true} fileName={values.saveFileName} />);
      
      const input = values.url || await Clipboard.readText() || "";
      const output = await processContent(pattern.name, input, values.saveFileName);
      
      navigation.pop();
      navigation.push(<ResultView content={output} fileName={values.saveFileName} isLoading={false} />);
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: "Error", message: String(error) });
      navigation.pop();
      navigation.push(<ResultView isLoading={false} fileName={values.saveFileName} />);
    }
  };

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search patterns..."
      searchBarAccessory={
        <List.Dropdown tooltip="Input Source" storeValue={true} onChange={(v) => setInputUrl(v === "clipboard" ? "" : v)}>
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
                  <Form actions={<ActionPanel><Action.SubmitForm title="Process" icon={Icon.Terminal} onSubmit={(values) => handleSubmit(pattern, values)} /></ActionPanel>} isLoading={isProcessing}>
                    {inputUrl && <Form.TextField id="url" title="URL" placeholder="Enter URL" value={inputUrl} onChange={setInputUrl} />}
                    <Form.TextField id="saveFileName" title="Save As (Optional)" placeholder="Enter filename to save" />
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
