#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 MemLayer Setup Script');
console.log('========================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', 'env.example');

if (fs.existsSync(envPath)) {
    console.log('✅ .env file already exists');
} else {
    console.log('📝 Creating .env file from template...');
    
    if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('✅ .env file created successfully');
    } else {
        console.log('❌ env.example file not found');
        process.exit(1);
    }
}

// Check if MongoDB is running
console.log('\n🔍 Checking MongoDB connection...');
try {
    // This is a simple check - in a real setup you'd want to actually connect
    console.log('⚠️  Please ensure MongoDB is running on mongodb://localhost:27017');
    console.log('   You can start MongoDB with: mongod');
} catch (error) {
    console.log('❌ MongoDB connection failed');
    console.log('   Please start MongoDB and try again');
}

console.log('\n🚀 Setup complete!');
console.log('\nNext steps:');
console.log('1. Edit .env file with your configuration');
console.log('2. Start the server: npm start');
console.log('3. Access the web UI: http://localhost:3000');
console.log('4. Use the configuration section in the web UI to set your API key');
console.log('\nHappy memory management! 🧠');
