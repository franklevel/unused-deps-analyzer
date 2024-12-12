#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { analyze } from '../src/index.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import ora from 'ora';

const execAsync = promisify(exec);

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
    return false;
  }
}

async function promptForRemoval(unusedDeps, packageDetails) {
  if (unusedDeps.length === 0) return;

  const choices = unusedDeps.map(dep => ({
    name: `${dep} ${chalk.gray(`v${packageDetails.get(dep).version}`)} ${chalk.blue(`[${packageDetails.get(dep).size}]`)}`,
    value: dep,
    checked: false
  })).filter(dep => dep.value !== 'dependency-analyzer'); // Exclude itself

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

  console.log('\nSelected packages:');
  selectedPackages.forEach(pkg => {
    const details = packageDetails.get(pkg);
    console.log(chalk.gray(`  - ${pkg} [${details.size}]`));
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
      console.log(
        chalk.green('✓'),
        chalk.bold(dep),
        chalk.gray(`v${details.version}`),
        chalk.blue(`[${details.size}]`),
        chalk.yellow('⚡ active')
      );
    });
    
    if (result.unused.length > 0) {
      console.log('\n' + chalk.bold('Unused Dependencies:'));
      result.unused.forEach(dep => {
        const details = result.packageDetails.get(dep);
        console.log(
          chalk.red('✗'),
          chalk.bold(dep),
          chalk.gray(`v${details.version}`),
          chalk.blue(`[${details.size}]`),
          chalk.red('❌ unused')
        );
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

    // Prompt for package removal if there are unused dependencies
    if (result.unused.length > 0) {
      await promptForRemoval(result.unused, result.packageDetails);
    }
  })
  .catch(error => {
    console.error(chalk.red('Error analyzing dependencies:'), error);
    process.exit(1);
  });
