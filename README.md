# Dependency Analyzer

A Node.js tool to analyze which dependencies in your package.json are actually being used in your project.

## Installation

```bash
npm install -g dependency-analyzer
```

## Usage

Run in your project directory:

```bash
dependency-analyzer
```

Or specify a different project path:

```bash
dependency-analyzer --path /path/to/your/project
```

### Options

- `-p, --path <path>`: Specify the project path (defaults to current directory)
- `-d, --dev`: Include devDependencies in the analysis
- `-V, --version`: Output the version number
- `-h, --help`: Display help information

## Output

The tool will analyze your project and show:
- ✓ Used dependencies
- ✗ Unused dependencies
- Any errors encountered during analysis

## Features

- Analyzes JavaScript and TypeScript files
- Detects CommonJS (require) and ES Module (import) usage
- Ignores built-in Node.js modules
- Handles scoped packages (@organization/package)
- Excludes node_modules, dist, build, and coverage directories from analysis

## Development

### Using with yalc

This package supports local development using yalc. This allows you to test the package locally without publishing to npm.

1. Install yalc globally (if not already installed):
```bash
npm install -g yalc
```

2. Publish the package locally:
```bash
npm run publish:yalc
```

3. In your test project, add the package:
```bash
yalc add dependency-analyzer
```

4. When you make changes to the package, push updates to all yalc installations:
```bash
npm run push:yalc
```

5. To remove the package from your test project:
```bash
yalc remove dependency-analyzer
```

6. To remove all yalc links:
```bash
npm run remove:yalc
```

## How it works

1. Reads your project's package.json
2. Scans all JavaScript/TypeScript files in your project
3. Analyzes imports and requires in each file
4. Compares found dependencies with those listed in package.json
5. Reports which dependencies are used and which aren't

## License

MIT
