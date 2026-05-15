# Create all files at once
mkdir -p bin agents docs

# Download from a temporary gist or use these commands:
cat > package.json << 'EOF'
{"name":"tembo-agent-studio","version":"0.1.0","description":"Tembo Agent Studio","main":"bin/tembo-agent-studio.js","bin":{"tembo-agent-studio":"./bin/tembo-agent-studio.js"},"scripts":{"onboard":"node bin/tembo-agent-studio.js onboard"},"license":"MIT","dependencies":{"commander":"^12.0.0","inquirer":"^9.0.0","chalk":"^5.0.0","fs-extra":"^11.0.0"}}
EOF

cat > bin/tembo-agent-studio.js << 'EOF'
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
EOF

cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  tas:
    build: .
    ports: ["3000:3000"]
    volumes: [".:/app", "/app/node_modules"]
    environment:
      - NODE_ENV=production
      - TEMBO_API_KEY=${TEMBO_API_KEY}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    restart: unless-stopped
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes: ["redis_data:/data"]
volumes: {redis_data: {}}
EOF

cat > Dockerfile << 'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
EOF

cat > .env.example << 'EOF'
TEMBO_API_KEY=your_key
GITHUB_TOKEN=your_token
DATABASE_URL=sqlite:./tas.db
PORT=3000
EOF

cat > agents/hello-world.json << 'EOF'
{"name":"hello-world","description":"Sample agent","instructions":"You are a friendly agent.","triggers":{"schedule":"0 9 * * *"}}
EOF

cat > agents/README.md << 'EOF'
# Agents
Place your agent JSON files here.
EOF

cat > .gitignore << 'EOF'
node_modules/
.env
*.db
*.log
.DS_Store
EOF

# Now push
git add .
git commit -m "feat: bootstrap Tembo Agent Studio"
git push