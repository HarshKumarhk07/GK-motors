require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function updateDb() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  const ServiceType = mongoose.connection.collection('servicetypes');
  const types = await ServiceType.find({}).toArray();
  let count = 0;
  console.log(`Found ${types.length} ServiceType records`);
  for (const t of types) {
    const expectedImg = `/service-packages/${t.value}.jpg`;
    if (t.image !== expectedImg) {
      console.log(`Updating ${t.value}: current "${t.image}" -> "${expectedImg}"`);
      await ServiceType.updateOne({ _id: t._id }, { $set: { image: expectedImg } });
      count++;
    }
  }
  console.log(`Updated ${count} ServiceType documents to use .jpg`);

  const ServiceCategory = mongoose.connection.collection('servicecategories');
  const cats = await ServiceCategory.find({}).toArray();
  let catCount = 0;
  for (const c of cats) {
    if (c.image && c.image.endsWith('.svg')) {
      const newImg = c.image.replace(/\.svg$/, '.jpg');
      await ServiceCategory.updateOne({ _id: c._id }, { $set: { image: newImg } });
      catCount++;
    }
  }
  console.log(`Updated ${catCount} ServiceCategory documents to use .jpg`);

  await mongoose.disconnect();
  console.log('Done.');
}

updateDb().catch((err) => {
  console.error(err);
  process.exit(1);
});
