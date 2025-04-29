import { connect } from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
export default connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
