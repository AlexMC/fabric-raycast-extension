# Raycast Fabric Extension

A Raycast extension for processing text through [Fabric](https://github.com/danielmiessler/fabric/tree/main/patterns)

## Features

- Process text through Fabric patterns using multiple input sources:
  - Clipboard text
  - Web URLs (HTML content)
  - PDF URLs (via r.jina.ai)
  - YouTube video transcripts
- Save processed text to your notes directory
- Quick access to your Fabric patterns
- Preview processed text before saving

## Prerequisites

- [Fabric](https://github.com/alcarney/fabric) installed and available in your PATH
- The `save` script installed (available at [AlexMC/save-script](https://github.com/AlexMC/save-script)) for saving processed text

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start development mode

## Configuration

Configure the extension through Raycast preferences:

### Required Paths
- **Fabric Binary Path**: Path to the Fabric executable
  - Default: `~/go/bin/fabric`
- **Save Binary Path**: Path to the save script
  - Default: `~/.local/bin/save`
- **Patterns Directory**: Path to your Fabric patterns
  - Default: `~/.config/fabric/patterns`

### Optional Settings
- **Save Target Directory**: Where processed files will be saved
  - If not set, will use the default from your save script configuration
  - Can be configured in `~/.config/fabric/.env` with `FABRIC_OUTPUT_PATH`
- **Model Name**: Specify which model to use with Fabric
  - If not set, will use Fabric's default model
  - Example: "gpt-4" or "claude-3-opus-20240229"

## Usage

1. Open Raycast and search for "Process with Fabric"
2. Choose your input source:
   - **From Clipboard**: Processes text from your clipboard
   - **From URL**: Processes content from a webpage or PDF
   - **From YouTube**: Extracts and processes the transcript from a YouTube video
3. Choose a pattern to process your text
4. Preview the result
5. Optionally save the processed text to your notes directory

## Examples

### Processing Web Content
1. Select "From URL" in the input source dropdown
2. Enter the URL of the webpage or PDF you want to process
3. Choose your desired Fabric pattern
4. The content will be fetched and processed according to your pattern

### Processing YouTube Transcripts
1. Select "From YouTube" in the input source dropdown
2. Enter the YouTube video URL
3. Choose your desired Fabric pattern
4. The video's transcript will be extracted and processed according to your pattern

## Demo

![Demo](https://raw.githubusercontent.com/AlexMC/fabric-raycast-extension/master/.github/assets/demo.gif)

## Development

```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Build the extension
npm run build
```

## Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Commit your changes
5. Push to the branch
6. Create a pull request