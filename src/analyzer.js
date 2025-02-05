import { readFile } from 'fs/promises';
import path from 'path';
import glob from 'fast-glob';
import { parse } from '@babel/parser';
import traversePkg from '@babel/traverse';
const traverse = traversePkg.default;

// Configure parser options based on file extension
function getParserOptions(filePath) {
  const ext = path.extname(filePath);
  const baseOptions = {
    sourceType: 'module',
    plugins: [
      'decorators',
      'classProperties',
      'objectRestSpread',
      'dynamicImport',
      'optionalChaining',
      'nullishCoalescing'
    ]
  };

  switch (ext) {
    case '.tsx':
      return {
        ...baseOptions,
        plugins: [...baseOptions.plugins, 'typescript', 'jsx']
      };
    case '.ts':
      return {
        ...baseOptions,
        plugins: [...baseOptions.plugins, 'typescript']
      };
    case '.jsx':
      return {
        ...baseOptions,
        plugins: [...baseOptions.plugins, 'jsx']
      };
    default:
      return baseOptions;
  }
}

export async function analyze(projectPath, includeDevDependencies = false) {
  try {
    // Read package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    
    // Get dependencies
    const dependencies = { ...packageJson.dependencies };
    if (includeDevDependencies) {
      Object.assign(dependencies, packageJson.devDependencies);
    }
    
    // Get all JS files and config files
    const files = await glob('**/*.{js,jsx,ts,tsx,mjs,cjs,vue,svelte,config.js,config.ts,config.mjs,config.cjs}', {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '.git/**']
    });
    
    // Track used dependencies
    const usedDependencies = new Set();
    const errors = [];
    
    // Create package details map
    const packageDetails = new Map();
    for (const [name, version] of Object.entries(dependencies)) {
      try {
        const pkgPath = path.join(projectPath, 'node_modules', name, 'package.json');
        const pkgJson = JSON.parse(await readFile(pkgPath, 'utf8'));
        const size = await getPackageSize(path.join(projectPath, 'node_modules', name));
        packageDetails.set(name, {
          version: pkgJson.version || version,
          size: size
        });
      } catch (error) {
        errors.push(`Failed to read package details for ${name}: ${error.message}`);
      }
    }
    
    // Analyze each file
    for (const file of files) {
      try {
        const filePath = path.join(projectPath, file);
        const content = await readFile(filePath, 'utf8');
        const parserOptions = getParserOptions(filePath);
        
        const ast = parse(content, parserOptions);
        
        traverse(ast, {
          ImportDeclaration(path) {
            const importPath = path.node.source.value;
            if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
              // Handle both direct package imports and submodule imports
              const pkgName = importPath.split('/')[0];
              if (dependencies[pkgName]) {
                usedDependencies.add(pkgName);
              }
            }
          },
          CallExpression(path) {
            // Handle require calls
            if (path.node.callee.name === 'require') {
              const arg = path.node.arguments[0];
              if (arg && arg.type === 'StringLiteral') {
                const importPath = arg.value;
                if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
                  const pkgName = importPath.split('/')[0];
                  if (dependencies[pkgName]) {
                    usedDependencies.add(pkgName);
                  }
                }
              }
            }
            // Handle dynamic imports
            if (path.node.callee.type === 'Import') {
              const arg = path.node.arguments[0];
              if (arg && arg.type === 'StringLiteral') {
                const importPath = arg.value;
                console.log('Found dynamic import:', importPath);
                if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
                  const pkgName = importPath.split('/')[0];
                  console.log('Package name extracted:', pkgName);
                  console.log('Is in dependencies?', !!dependencies[pkgName]);
                  if (dependencies[pkgName]) {
                    usedDependencies.add(pkgName);
                  }
                }
              }
            }
          },
          // Handle template literal imports
          TaggedTemplateExpression(path) {
            if (path.node.tag.name === 'require' || path.node.tag.name === 'import') {
              const quasi = path.node.quasi;
              if (quasi.quasis.length === 1) {
                const importPath = quasi.quasis[0].value.raw;
                if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
                  const pkgName = importPath.split('/')[0];
                  if (dependencies[pkgName]) {
                    usedDependencies.add(pkgName);
                  }
                }
              }
            }
          }
        });
      } catch (error) {
        errors.push(`Failed to analyze ${file}: ${error.message}`);
        console.error(`Error analyzing ${file}:`, error);
      }
    }
    
    // Get unused dependencies
    const unusedDependencies = Object.keys(dependencies).filter(dep => !usedDependencies.has(dep));
    
    return {
      used: Array.from(usedDependencies),
      unused: unusedDependencies,
      packageDetails,
      errors,
      includesDevDependencies: includeDevDependencies
    };
  } catch (error) {
    throw new Error(`Failed to analyze dependencies: ${error.message}`);
  }
}

async function getPackageSize(pkgPath) {
  try {
    const files = await glob('**/*', {
      cwd: pkgPath,
      onlyFiles: true,
      absolute: true
    });
    
    let totalSize = 0;
    for (const file of files) {
      try {
        const stats = await readFile(file);
        if (stats && typeof stats.length === 'number' && !isNaN(stats.length)) {
          totalSize += stats.length;
        }
      } catch (error) {
        // Ignore errors for individual files
      }
    }
    
    return totalSize || 0; // Ensure we always return a valid number
  } catch (error) {
    return 0; // Return 0 if there's any error in the size calculation
  }
}
