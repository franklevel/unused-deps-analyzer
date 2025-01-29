import { promises as fs } from 'fs';
import { join } from 'path';
import fastGlob from 'fast-glob';
import { builtinModules } from 'module';
import { filesize } from 'filesize';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

async function getPackageSize(packageName, projectPath) {
  try {
    const packagePath = join(projectPath, 'node_modules', packageName);
    const files = await fastGlob(['**/*'], {
      cwd: packagePath,
      ignore: ['.*'],
      dot: false,
      stats: true
    });
    
    return files.reduce((acc, file) => acc + file.stats.size, 0);
  } catch (error) {
    return 0;
  }
}

async function readPackageJson(projectPath) {
  const packageJsonPath = join(projectPath, 'package.json');
  try {
    const content = await fs.readFile(packageJsonPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read package.json: ${error.message}`);
  }
}

async function findJsFiles(projectPath) {
  try {
    const files = await fastGlob(['**/*.{js,jsx,ts,tsx}'], {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'],
      dot: true,
      absolute: false
    });
    return files;
  } catch (error) {
    throw new Error(`Failed to find JS files: ${error.message}`);
  }
}

async function analyzeFile(filePath, projectPath) {
  try {
    const content = await fs.readFile(join(projectPath, filePath), 'utf8');
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    const imports = new Set();

    traverse.default(ast, {
      ImportDeclaration(path) {
        imports.add(path.node.source.value);
      },
      CallExpression(path) {
        if (path.node.callee.name === 'require') {
          const arg = path.node.arguments[0];
          if (arg.type === 'StringLiteral') {
            imports.add(arg.value);
          }
        }
      }
    });

    return Array.from(imports).filter(imp => {
      // Filter out relative imports and built-in modules
      return !imp.startsWith('.') && !imp.startsWith('/') && !isBuiltInModule(imp);
    });
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error);
    return [];
  }
}

function isBuiltInModule(moduleName) {
  return builtinModules.includes(moduleName);
}

function getPackageName(importPath) {
  // Handle scoped packages and submodules
  const parts = importPath.split('/');
  if (parts[0].startsWith('@')) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

async function analyze(projectPath, includeDev = false) {
  const result = {
    used: new Set(),
    unused: [],
    errors: [],
    packageDetails: new Map()
  };

  try {
    const packageJson = await readPackageJson(projectPath);
    const dependencies = {
      ...packageJson.dependencies,
      ...(includeDev ? packageJson.devDependencies : {})
    };

    const jsFiles = await findJsFiles(projectPath);
    
    // Analyze each file for imports
    for (const file of jsFiles) {
      const imports = await analyzeFile(file, projectPath);
      imports.forEach(imp => {
        const packageName = getPackageName(imp);
        if (dependencies[packageName]) {
          result.used.add(packageName);
        }
      });
    }

    // Find unused dependencies and gather package details
    result.unused = Object.keys(dependencies).filter(dep => !result.used.has(dep) && dep !== 'dependency-analyzer'); 
    result.used = Array.from(result.used);

    // Get package sizes
    const allPackages = [...result.used, ...result.unused];
    for (const pkg of allPackages) {
      result.packageDetails.set(pkg, {
        size: await getPackageSize(pkg, projectPath),
        version: dependencies[pkg],
        isUsed: result.used.includes(pkg)
      });
    }

  } catch (error) {
    result.errors.push(error.message);
  }

  return result;
}

export { analyze };
