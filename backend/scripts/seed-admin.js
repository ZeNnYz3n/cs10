import '../dns-setup.js'; // DNS setup
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Import the User model (adjust path if running from a different folder)
import User from '../models/User.js'; 

dotenv.config();

// Replace with your other database URI if not using the .env file
const MONGODB_URI = process.env.MONGODB_URI || 'YOUR_OTHER_DATABASE_URI_HERE';

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB: ${MONGODB_URI}`);

    // Set your desired admin credentials here
    const adminEmail = 'admin@samagama.com';
    const adminPassword = 'adminpassword123';

    // 1. Check if this admin already exists
    let admin = await User.findOne({ email: adminEmail });
    if (admin) {
      console.log(`Admin with email ${adminEmail} already exists!`);
      return;
    }

    // 2. Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // 3. Create the admin user
    admin = new User({
      name: 'Super Admin',
      email: adminEmail,
      password_hash: hashedPassword, // Fixed from 'password' to match the User schema
      role: 'admin',
      xp: 0
    });

    await admin.save();
    
    console.log('✅ Admin user seeded successfully!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);

  } catch (err) {
    console.error('❌ Error seeding admin:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedAdmin();
