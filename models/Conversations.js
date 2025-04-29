import { default as mongoose } from 'mongoose';
import { Schema } from 'mongoose';

const ConversationScema = Schema({
    members:{
        type:Array
    }
  
});

const Conversations = mongoose.model('Conversation',ConversationScema);
export default Conversations;