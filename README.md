# Dependency Analyzer

## Overview
The Dependency Analyzer is an NPM package designed to analyze and manage unused dependencies in Node.js projects.

## Key Features
- **Dependency Analysis**: Scans project files for used and unused dependencies, supporting both production and dev dependencies.
- **Detailed Package Information**: Provides information such as version, size, and usage statistics.
- **Interactive CLI**: Offers a user-friendly command-line interface with colorized output and interactive package selection for removal.
- **Timing Information**: Displays the time taken for both analysis and package removal processes.
- **Exclusion of Itself**: Automatically excludes the `dependency-analyzer` package from being listed as unused or selected for removal.

## Installation
To install the Dependency Analyzer, run the following command:
```bash
npm install dependency-analyzer
```

## Usage
To analyze dependencies in your project, run:
```bash
npx dependency-analyzer
```

## Contribution
If you would like to contribute to this project, please create a new feature branch and submit a pull request.

## License
This project is licensed under the MIT License.
