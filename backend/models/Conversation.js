const mongoose = require('mongoose');

const conversationSchema=new mongoose.Schema({
    participants:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    }],
    isGroup:{
        type:Boolean,
        default:false
    },
    name:{
        type:String,
        required:function(){
            return this.isGroup;
        }
    },
    lastMessage:{
        type:String,
        default:''
    },
    createdBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    }
},{timestamps:true});

const Conversation = mongoose.model('Conversation',conversationSchema);
module.exports=Conversation;
