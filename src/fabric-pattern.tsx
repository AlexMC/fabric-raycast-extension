import { List, ActionPanel, Action, Form, Icon, showToast, Toast, Clipboard, Detail } from "@raycast/api";
import { useState, useEffect } from "react";
import { useNavigation } from "@raycast/api";
import fs from "fs";
import path from "path";
import { useFabricProcessor, PATHS } from "./hooks/useFabricProcessor";

interface Pattern {
  name: string;
  path: string;
  description?: string;
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
  const { processContent, isProcessing, loadPatterns } = useFabricProcessor();
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [inputMode, setInputMode] = useState<"clipboard" | "url" | "youtube">("clipboard");

  useEffect(() => {
    const fetchPatterns = async () => {
      try {
        const patternsData = await loadPatterns();
        setPatterns(patternsData);
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

    fetchPatterns();
  }, []);

  const handleDropdownChange = (value: string) => {
    setInputMode(value as "clipboard" | "url" | "youtube");
  };

  const handleSubmit = async (pattern: Pattern, values: { 
    saveFileName?: string; 
    url?: string; 
    youtubeUrl?: string 
  }) => {
    try {
      let input = "";
      
      if (inputMode === "url") {
        if (!values.url) {
          await showToast({ 
            style: Toast.Style.Failure, 
            title: "Error", 
            message: "URL is required" 
          });
          return;
        }
        input = `-u ${values.url}`;
      } else if (inputMode === "youtube") {
        if (!values.youtubeUrl) {
          await showToast({ 
            style: Toast.Style.Failure, 
            title: "Error", 
            message: "YouTube URL is required" 
          });
          return;
        }
        input = `yt --transcript ${values.youtubeUrl}`;
      } else {
        input = await Clipboard.readText() || "";
      }

      navigation.pop();
      navigation.push(<ResultView content="Processing..." isLoading={true} fileName={values.saveFileName} />);
      
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
        <List.Dropdown 
          tooltip="Input Source" 
          storeValue={true} 
          onChange={handleDropdownChange}
        >
          <List.Dropdown.Item title="From Clipboard" value="clipboard" />
          <List.Dropdown.Item title="From URL" value="url" />
          <List.Dropdown.Item title="From YouTube" value="youtube" />
        </List.Dropdown>
      }
      isShowingDetail
    >
      {patterns.map((pattern) => (
        <List.Item
          key={pattern.name}
          title={pattern.name}
          detail={
            <List.Item.Detail 
              markdown={pattern.description || '*No description available*'} 
            />
          }
          actions={
            <ActionPanel>
              <Action.Push
                title="Process with Pattern"
                target={
                  <Form actions={
                    <ActionPanel>
                      <Action.SubmitForm 
                        title="Process" 
                        icon={Icon.Terminal} 
                        onSubmit={(values) => handleSubmit(pattern, values)} 
                      />
                    </ActionPanel>
                  } isLoading={isProcessing}>
                    {inputMode === "url" && (
                      <Form.TextField 
                        id="url" 
                        title="URL" 
                        placeholder="Enter URL to process"
                      />
                    )}
                    {inputMode === "youtube" && (
                      <Form.TextField 
                        id="youtubeUrl" 
                        title="YouTube URL" 
                        placeholder="Enter YouTube URL"
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
