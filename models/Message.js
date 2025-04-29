import { default as mongoose } from 'mongoose';
import { Schema } from 'mongoose';

const MessageSchema = new Schema({
  conversationId: {
    type: String,
  },
  senderId: {
    type: String,
  },
  message: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically sets the current date and time when the message is created
  },
});

const Message = mongoose.model('Message', MessageSchema);
export default Message;
