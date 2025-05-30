import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const userSchema = new Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  token:    { type: String }
}, { timestamps: true });

const Users = model('Users', userSchema);
export default Users;
