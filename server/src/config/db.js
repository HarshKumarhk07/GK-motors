const mongoose = require('mongoose');

/**
 * Connect to MongoDB.
 *
 * A connection string with no path segment — ".../?appName=Cluster0" rather
 * than ".../gkmotors?appName=Cluster0" — silently lands every collection in a
 * database literally called "test". Set MONGO_DB_NAME to pick the database
 * without editing the URI; it overrides whatever the URI says.
 *
 * The connected database name is logged on every boot, and falling through to
 * "test" raises a warning, so this cannot go unnoticed again.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('❌ MONGO_URI is not set. Create server/.env — see server/.env.example.');
    process.exit(1);
  }

  const dbName = process.env.MONGO_DB_NAME?.trim() || undefined;

  try {
    const conn = await mongoose.connect(uri, dbName ? { dbName } : {});
    const connected = conn.connection.name;

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`   Database: ${connected}${dbName ? ' (from MONGO_DB_NAME)' : ''}`);

    if (connected === 'test') {
      console.warn(
        '⚠️  Using the default "test" database — your connection string has no database name.\n' +
        '   Add MONGO_DB_NAME=gkmotors to server/.env, or put /gkmotors before the ? in MONGO_URI,\n' +
        '   then re-run the seeders. Data already written to "test" stays there.'
      );
    }
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    if (/bad auth|authentication failed/i.test(error.message)) {
      console.error('   The username or password in MONGO_URI was rejected. Check Atlas → Database Access.');
      console.error('   Percent-encode the password if it contains @ : / ? # [ ] % — @ becomes %40.');
    } else if (/ENOTFOUND|querySrv|ECONNREFUSED/i.test(error.message)) {
      console.error('   Could not reach the cluster. Check the hostname, your network, and Atlas → Network Access.');
    }
    process.exit(1);
  }
};

module.exports = connectDB;
