import { connect } from 'mongoose';
const uri = 'mongodb+srv://mdaminjilani313:ZX8uJPmnnev2ucvn@chating.e1ddk.mongodb.net/?retryWrites=true&w=majority&appName=chating';
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
export default connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
