const mongoose=require('mongoose');

const MessageSchema = new mongoose.Schema({
    conversation:{type:mongoose.Schema.Types.ObjectId,ref:'Conversation',required:true},
    sender:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
    content: {type: String,required: true},
    read: {type: Boolean,default: false}
    }, { timestamps: true }
);

const Message = mongoose.model('Message',MessageSchema);
module.exports=Message;