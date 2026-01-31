import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    /* unique: true */
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  avatar: String,   //pas obliger  donc optionnel (?)



  chatIDs: [{
    //Donc chaque user garde la liste des chats où il participe
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat'     //RELATION pour être recuperer par populate
  }],
/* 
  VOIR CONTROLLER addChat
nalogie:
* quand un chat est crée entre UserA et UserB
* Il faut aussi ajouter ce chat à la liste personnelle de chaque user (userA & userB)
* Comme ajouter un nouveau groupe whatsApp dans votre liste de conversations
Resultat:
* UserA.chartIDs = [..., nouveauChatId]
* UserB.chartIDs = [..., nouveauChatId]
* Chat.users = [UserA._id, UserB._id]
Sans ça : Un User ne saurait pas quels chats lui appartiennent !
*/


  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('User', userSchema);