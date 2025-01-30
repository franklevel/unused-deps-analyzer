# Unused Dependencies Analyzer

## Overview
The Unused Dependencies Analyzer is an NPM package designed to identify and remove unused dependencies in Node.js projects.

**🚀 Motivation**  

In the fast-paced world of software development, maintaining a clean and efficient project can be challenging. Over time, dependencies accumulate, and unused or outdated packages 📦 can creep into your codebase, leading to unnecessary complexity, larger build sizes 📏, and potential security vulnerabilities 🔒.  

This project was created to empower developers 👨‍💻👩‍💻 by simplifying dependency management. It aims to streamline your Node.js projects by identifying unused packages, outdated dependencies, and potential redundancies. By keeping your dependencies lean and up-to-date, this tool not only enhances your project's performance ⚡ but also ensures better maintainability 🛠️, security 🛡️, and developer productivity.  

With this solution, developers can focus on building great software 🎯 while the tool takes care of keeping the dependency ecosystem healthy and optimized. 🚀

## Key Features
- **Dependency Analysis**: Scans project files for used and unused dependencies, supporting both production and dev dependencies.
- **Detailed Package Information**: Provides information such as version, size, and usage statistics.
- **Interactive CLI**: Offers a user-friendly command-line interface with colorized output and interactive package selection for removal.
- **Timing Information**: Displays the time taken for both analysis and package removal processes.
- **Exclusion of Itself**: Automatically excludes the `unused-deps-analyzer` package from being listed as unused or selected for removal.

## Installation (Recommended)
To install the Unused Dependency Analyzer, run the following command to install it globally:
```bash
npm install -g @franklevel/unused-deps-analyzer
```

## Usage
To analyze dependencies in your project, run:
```bash
npx @franklevel/unused-deps-analyzer
```

## Contribution
If you would like to contribute to this project, please create a new feature branch and submit a pull request.

## License
This project is licensed under the MIT License.
