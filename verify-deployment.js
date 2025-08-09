#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying deployment structure...');

// Check if essential files exist
const requiredFiles = [
  'package.json',
  'server.js',
  'routes/projects.js',
  'routes/compile.js',
  'routes/deploy.js',
  'routes/templates.js',
  'services/compilationService.js',
  'services/deploymentService.js',
  'models/Project.js'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Check package.json
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`✅ package.json - name: ${packageJson.name}`);
  console.log(`✅ package.json - main: ${packageJson.main}`);
  console.log(`✅ package.json - start script: ${packageJson.scripts?.start || 'MISSING'}`);
} catch (error) {
  console.log(`❌ package.json - INVALID: ${error.message}`);
  allFilesExist = false;
}

// Check server.js
try {
  const serverContent = fs.readFileSync('server.js', 'utf8');
  if (serverContent.includes('express') && serverContent.includes('listen')) {
    console.log('✅ server.js - Valid Express server');
  } else {
    console.log('❌ server.js - Invalid Express server');
    allFilesExist = false;
  }
} catch (error) {
  console.log(`❌ server.js - ERROR: ${error.message}`);
  allFilesExist = false;
}

console.log('\n📊 Deployment Structure Summary:');
if (allFilesExist) {
  console.log('✅ All required files are present and valid');
  console.log('🚀 Ready for deployment!');
} else {
  console.log('❌ Some required files are missing or invalid');
  console.log('🔧 Please fix the issues above before deploying');
}

process.exit(allFilesExist ? 0 : 1); 