import { readFile } from 'fs/promises';
import path from 'path';
import { filesize } from 'filesize';
import glob from 'fast-glob';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

const filesizeOptions = {
  base: 2,
  standard: "jedec"
};

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
    
    // Get all JS files
    const files = await glob('**/*.{js,jsx,ts,tsx}', {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**']
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
        const content = await readFile(path.join(projectPath, file), 'utf8');
        const ast = parse(content, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript']
        });
        
        traverse(ast, {
          ImportDeclaration(path) {
            const importPath = path.node.source.value;
            if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
              const pkgName = importPath.split('/')[0];
              if (dependencies[pkgName]) {
                usedDependencies.add(pkgName);
              }
            }
          },
          CallExpression(path) {
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
          }
        });
      } catch (error) {
        errors.push(`Failed to analyze ${file}: ${error.message}`);
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
  const files = await glob('**/*', {
    cwd: pkgPath,
    onlyFiles: true,
    absolute: true
  });
  
  let totalSize = 0;
  for (const file of files) {
    try {
      const stats = await readFile(file);
      totalSize += stats.length;
    } catch (error) {
      // Ignore errors for individual files
    }
  }
  
  return totalSize;
}
