#!/usr/bin/env node
const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs-extra');

program.name('tembo-agent-studio').description('Tembo Agent Studio').version('0.1.0');

program.command('onboard').description('Bootstrap').option('--yes').action(async (o) => {
  console.log(chalk.blue.bold('\n🚀 Tembo Agent Studio Onboarding\n'));
  if (!o.yes) {
    const {p} = await inquirer.prompt([{type:'confirm',name:'p',message:'Bootstrap now?',default:true}]);
    if (!p) process.exit(0);
  }
  await fs.ensureDir('agents');
  await fs.ensureDir('docs');
  await fs.writeFile('docker-compose.yml', 'version: \'3.8\'\nservices:\n  tas:\n    image: node:20-alpine\n    working_dir: /app\n    volumes:\n      - .:/app\n    ports:\n      - "3000:3000"\n    command: npm start\n    environment:\n      - NODE_ENV=production\n');
  await fs.writeFile('.env.example', '# Tembo Agent Studio\nTEMBO_API_KEY=your_key\nGITHUB_TOKEN=your_token\nDATABASE_URL=sqlite:./tas.db\nPORT=3000\n');
  await fs.writeJson('agents/hello-world.json', {name:"hello-world",description:"Sample",instructions:"You are a friendly agent.",triggers:{schedule:"0 9 * * *"}}, {spaces:2});
  await fs.writeFile('agents/README.md', '# Agents\n\nPlace your agent JSON files here.\n');
  console.log(chalk.green('✅ Done!'));
  console.log('Next: cp .env.example .env && docker compose up -d');
});

program.parse(process.argv);
