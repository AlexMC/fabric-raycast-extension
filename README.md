# Raycast Fabric Extension

A Raycast extension that integrates with Fabric to process content through customizable patterns. This extension allows you to transform text and URLs using predefined patterns and save the results to your Obsidian vault.

## Prerequisites

- [Raycast](https://raycast.com/) installed on your macOS system
- [Go](https://golang.org/) installed (for Fabric binary)
- Fabric CLI tool installed in `~/go/bin/fabric`
- Save script in `~/.local/bin/save`
- Obsidian (optional, for saving processed content)

## Installation

1. Ensure your directory structure is set up correctly:
   ```
   ~/go/bin/fabric              # Fabric binary
   ~/.local/bin/save           # Save script
   ~/.config/fabric/patterns   # Pattern definitions
   ```

2. Install the extension through Raycast's store or manually clone this repository.

## Features

- Process both direct text input and URLs through Fabric patterns
- Save processed output directly to your Obsidian vault
- Support for custom pattern descriptions via `system.md` files
- Automatic cleanup of temporary files
- Integration with iCloud-synced Obsidian vault

## Configuration

The extension uses the following default paths:
- Fabric binary: `~/go/bin/fabric`
- Save script: `~/.local/bin/save`
- Patterns directory: `~/.config/fabric/patterns`
- Default save location: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/AlexNotesObsVault/Inbox/Fabric`

## Usage

1. Open Raycast
2. Select the Fabric extension
3. Choose a pattern from the available list
4. Enter your text or URL
5. Optionally provide a filename to save the output
6. Process and view/save the results

## Pattern System

Patterns are stored in `~/.config/fabric/patterns` and can include an optional `system.md` file for pattern descriptions. The extension will automatically load all valid patterns while filtering out system files and hidden directories.

## Development

This extension is built using:
- React
- TypeScript
- Raycast API
- Node.js file system operations

## License

[Add your chosen license here]

## Contributing

[Add contribution guidelines if applicable]

## Support

[Add support information if applicable]