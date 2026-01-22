/**
 * Migration script to convert existing projects to user-based system
 * 
 * This script:
 * 1. Creates a default user for existing projects
 * 2. Assigns all existing projects to that user
 * 3. Sets default free plan
 * 
 * Usage: node scripts/migrate-to-auth.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Project = require('../models/Project');
const Job = require('../models/Job');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soroban-ide';

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all projects without userId
    const orphanProjects = await Project.find({ userId: { $exists: false } });
    console.log(`Found ${orphanProjects.length} projects without userId`);

    if (orphanProjects.length === 0) {
      console.log('No projects to migrate. Exiting.');
      await mongoose.connection.close();
      return;
    }

    // Create a default migration user
    let migrationUser = await User.findOne({ email: 'migration@websoroban.local' });
    
    if (!migrationUser) {
      console.log('Creating migration user...');
      migrationUser = new User({
        email: 'migration@websoroban.local',
        authMethod: 'wallet',
        subscription: {
          plan: 'free',
          status: 'active'
        }
      });
      // Update limits without saving (we'll save once at the end)
      migrationUser.updateUsageLimits('free', false);
      await migrationUser.save();
      console.log(`Created migration user: ${migrationUser._id}`);
    } else {
      console.log(`Using existing migration user: ${migrationUser._id}`);
    }

    // Update all orphan projects with userId
    console.log('Updating projects...');
    let updated = 0;
    for (const project of orphanProjects) {
      project.userId = migrationUser._id;
      await project.save();
      updated++;
    }
    console.log(`Updated ${updated} projects`);

    // Update jobs without userId
    const orphanJobs = await Job.find({ userId: { $exists: false } });
    console.log(`Found ${orphanJobs.length} jobs without userId`);

    if (orphanJobs.length > 0) {
      console.log('Updating jobs...');
      let jobsUpdated = 0;
      for (const job of orphanJobs) {
        // Try to get userId from project
        const project = await Project.findById(job.project);
        if (project && project.userId) {
          job.userId = project.userId;
          await job.save();
          jobsUpdated++;
        } else {
          // Assign to migration user if project doesn't have userId
          job.userId = migrationUser._id;
          await job.save();
          jobsUpdated++;
        }
      }
      console.log(`Updated ${jobsUpdated} jobs`);
    }

    console.log('Migration completed successfully!');
    console.log('\n⚠️  IMPORTANT:');
    console.log('1. Users should log in and claim their projects');
    console.log('2. Migration user email: migration@websoroban.local');
    console.log('3. Consider creating a script to help users claim their projects');

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run migration
migrate();
