#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { filesize } from 'filesize';
import { analyze } from '../src/index.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import ora from 'ora';

const execAsync = promisify(exec);

// Configure filesize options
const filesizeOptions = {
  base: 2,
  standard: "jedec"
};

// ASCII Art Banner
console.log(chalk.cyan(`
 _    _                          _   ____                     
| |  | |                        | | |  _ \\                    
| |  | |_ __  _   _ ___  ___  __| | | | | | ___ _ __  ___    
| |  | | '_ \\| | | / __|/ _ \\/ _\` | | |_| |/ _ \\ '_ \\/ __|   
| |__| | | | | |_| \\__ \\  __/ (_| | |  _ <|  __/ |_) \\__ \\   
 \\____/|_| |_|\\__,_|___/\\___|\\__,_| |_| \\_\\\\___| .__/|___/   
    _                _                          | |          
   / \\   _ __   __ _| |_   _ _______ _ __     |_|          
  / _ \\ | '_ \\ / _\` | | | | |_  / _ \\ '__|              
 / ___ \\| | | | (_| | | |_| |/ /  __/ |                 
/_/   \\_\\_| |_|\\__,_|_|\\__, /___\\___|_|                 
                        |___/                            
`));

const program = new Command();

program
  .version('1.0.0')
  .description('Analyze package dependencies usage in a Node.js project')
  .option('-p, --path <path>', 'Path to the project root', process.cwd())
  .option('-d, --dev', 'Include devDependencies in analysis', false)
  .parse(process.argv);

const options = program.opts();

async function removePackages(packages, projectPath) {
  const spinner = ora('Removing packages...').start();
  const startTime = process.hrtime.bigint();
  
  try {
    const { stdout, stderr } = await execAsync(`npm uninstall ${packages.join(' ')}`, {
      cwd: projectPath
    });
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9; // Convert to seconds
    
    spinner.succeed(chalk.green('✓ Packages removed successfully'));
    
    console.log('\nRemoved packages:');
    packages.forEach(pkg => console.log(chalk.gray(`  - ${pkg}`)));
    console.log(chalk.blue(`\n⏱️  Time taken: ${duration.toFixed(2)} seconds`));
    
    return true;
  } catch (error) {
    spinner.fail(chalk.red('✗ Failed to remove packages'));
    console.error(chalk.red(error.message));
    
    // Ask user for options
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          'Force delete with --force',
          'Remove peer dependencies',
          'Retry removal',
          'Cancel'
        ],
      }
    ]);
    
    switch (action) {
      case 'Force delete with --force':
        spinner.start('Force removing packages...');
        await execAsync(`npm uninstall --force ${packages.join(' ')}`, { cwd: projectPath });
        spinner.succeed(chalk.green('✓ Packages removed with force')); 
        break;
      case 'Remove peer dependencies':
        spinner.start('Removing packages with peer dependencies...');
        await execAsync(`npm uninstall ${packages.join(' ')} --legacy-peer-deps`, { cwd: projectPath });
        spinner.succeed(chalk.green('✓ Packages removed, including peer dependencies')); 
        break;
      case 'Retry removal':
        return await removePackages(packages, projectPath);
      case 'Cancel':
        console.log(chalk.yellow('Package removal cancelled.'));
        break;
    }
    return false;
  }
}

async function promptForRemoval(unusedDeps, packageDetails) {
  if (unusedDeps.length === 0) return;

  const choices = unusedDeps.map(dep => ({
    name: `${dep} ${chalk.gray(`v${packageDetails.get(dep).version}`)} ${chalk.blue(`[${filesize(packageDetails.get(dep).size, filesizeOptions)}]`)}`,
    value: dep,
    checked: false
  })).filter(dep => dep.value !== '@franklevel/unused-deps-analyzer'); // Exclude itself

  const { selectedPackages } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedPackages',
      message: 'Select packages to remove:',
      choices,
      pageSize: 10
    }
  ]);

  if (selectedPackages.length === 0) {
    console.log(chalk.yellow('\nNo packages selected for removal.'));
    return;
  }

  // Calculate total size of selected packages
  const totalSize = selectedPackages.reduce((total, pkg) => {
    const details = packageDetails.get(pkg);
    return total + details.size;
  }, 0);

  console.log(`\nSelected packages (Total size: ${filesize(totalSize, filesizeOptions)}):`);
  selectedPackages.forEach(pkg => {
    const details = packageDetails.get(pkg);
    console.log(chalk.gray(`  - ${pkg} [${filesize(details.size, filesizeOptions)}]`));
  });

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `\nAre you sure you want to remove these packages?`,
      default: false
    }
  ]);

  if (confirm) {
    await removePackages(selectedPackages, options.path);
  } else {
    console.log(chalk.yellow('\nPackage removal cancelled.'));
  }
}

analyze(options.path, options.dev)
  .then(async result => {
    const startTime = process.hrtime.bigint();
    
    console.log('\n📦 Dependency Analysis Results:\n');
    
    console.log(chalk.bold('Used Dependencies:'));
    result.used.forEach(dep => {
      const details = result.packageDetails.get(dep);
      if (details) {
        const size = typeof details.size === 'number' && !isNaN(details.size) ? details.size : 0;
        console.log(
          chalk.green('✓'),
          chalk.bold(dep),
          chalk.gray(`v${details?.version}`),
          chalk.blue(`[${filesize(size, filesizeOptions)}]`),
          chalk.yellow('⚡ active')
        );
      } else {
        console.log(
          chalk.yellow('!'),
          chalk.bold(dep),
          chalk.gray('(details not available)'),
          chalk.yellow('⚡ active')
        );
      }
    });
    
    // Filter out @franklevel/unused-deps-analyzer from unused dependencies
    result.unused = result.unused.filter(dep => dep !== '@franklevel/unused-deps-analyzer');
    
    if (result.unused.length > 0) {
      console.log('\n' + chalk.bold('Unused Dependencies:'));
      result.unused.forEach(dep => {
        const details = result.packageDetails.get(dep);
        if (details) {
          const size = typeof details.size === 'number' && !isNaN(details.size) ? details.size : 0;
          console.log(
            chalk.red('✗'),
            chalk.bold(dep),
            chalk.gray(`v${details?.version}`),
            chalk.blue(`[${filesize(size, filesizeOptions)}]`),
            chalk.red('❌ unused')
          );
        } else {
          console.log(
            chalk.red('✗'),
            chalk.bold(dep),
            chalk.gray('(details not available)'),
            chalk.red('❌ unused')
          );
        }
      });
    }
    
    if (result.errors.length > 0) {
      console.log('\n' + chalk.bold('Errors encountered:'));
      result.errors.forEach(error => {
        console.log(chalk.red('! ') + error);
      });
    }

    const endTime = process.hrtime.bigint();
    const analysisDuration = Number(endTime - startTime) / 1e9;

    // Print summary
    const totalDeps = result.used.length + result.unused.length;
    console.log('\n' + chalk.bold('Summary:'));
    console.log(chalk.green(`✓ ${result.used.length} used dependencies`));
    console.log(chalk.red(`✗ ${result.unused.length} unused dependencies`));
    console.log(chalk.blue(`📊 Usage: ${Math.round((result.used.length / totalDeps) * 100)}%`));
    console.log(chalk.blue(`⏱️  Analysis time: ${analysisDuration.toFixed(2)} seconds`));

    // Add prompt for removal if there are unused dependencies
    if (result.unused.length > 0) {
      await promptForRemoval(result.unused, result.packageDetails);
    }
  })
  .catch(error => {
    console.error(chalk.red('Error analyzing dependencies:'), error);
    process.exit(1);
  });
