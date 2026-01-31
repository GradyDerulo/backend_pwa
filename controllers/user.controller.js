import bcrypt from "bcrypt";
import User from '../models/User.js';
import Post from '../models/Post.js';
import SavedPost from '../models/SavedPost.js';
import Chat from '../models/Chat.js';

export const getUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get users!" });
  }
};

//====================================================================================

export const getUser = async (req, res) => {
  const id = req.params.id;
  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get user!" });
  }
};
//====================================================================================

export const updateUser = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;
  const { password, avatar, ...inputs } = req.body;

  if (id !== tokenUserId) {
    return res.status(403).json({ message: "Not Authorized!" });
  }

  try {
    const updateData = { ...inputs };
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    if (avatar) {
      updateData.avatar = avatar;
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    const { password: userPassword, ...rest } = updatedUser.toObject();

    res.status(200).json(rest);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to update users!" });
  }
};

export const deleteUser = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  if (id !== tokenUserId) {
    return res.status(403).json({ message: "Not Authorized!" });
  }

  try {
    // Supprimer les posts de l'utilisateur
    await Post.deleteMany({ user: id });
    
    // Supprimer les saved posts de l'utilisateur
    await SavedPost.deleteMany({ user: id });
    
    // Supprimer l'utilisateur
    await User.findByIdAndDelete(id);

    res.status(200).json({ message: "User deleted" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to delete users!" });
  }
};

//====================================================================================


// router.post("/save", verifyToken, savePost);

//dan le controller getPost on verifie si le post est sauvegarder à partie de l'utilisateur connecté
//   router.get("/:id", getPost);  


/* TEST 1 */
//getPost :  GET : http://localhost:8800/api/posts/696bb772e89d23d6dc68ce54  
// Par defaut  isSaved renverra false          ( "isSaved": false )

/* TEST 2 */
//  http://localhost:8800/api/users/save  (L'utilisateur doit être connecté )
//  POST: { "post": "696bb772e89d23d6dc68ce54" }


export const savePost = async (req, res) => {
  const postId = req.body.postId;
  const tokenUserId = req.userId;

  try {
    const savedPost = await SavedPost.findOne({
      user: tokenUserId,
      post: postId
    });

    if (savedPost) {
      await SavedPost.findByIdAndDelete(savedPost._id);
      res.status(200).json({ message: "Post removed from saved list" });
    } else {
      const newSavedPost = new SavedPost({
        user: tokenUserId,
        post: postId
      });
      await newSavedPost.save();
      res.status(200).json({ message: "Post saved" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to save/unsave post!" });
  }
};

//====================================================================================
  
//   router.get("/profilePosts", verifyToken, profilePosts);
//   GET : http://localhost:8800/api/users/profilePosts  
export const profilePosts = async (req, res) => {
  const tokenUserId = req.userId;
  try {
    //ca fait 2 choses: 
    //1. recupere les posts d'un user connecté
    //2. recuperer la liste de favoris cet user connecté
    const userPosts = await Post.find({ user: tokenUserId });
    const savedPostsData = await SavedPost.find({ user: tokenUserId })
      .populate('post'); 

    const savedPosts = savedPostsData.map(item => item.post);

    res.status(200).json({ userPosts, savedPosts });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get profile posts!" });
  }
};

//====================================================================================

export const getNotificationNumber = async (req, res) => {
  const tokenUserId = req.userId;
  try {
    const number = await Chat.countDocuments({
      users: tokenUserId,
      seenBy: { $ne: tokenUserId }
    });
    res.status(200).json(number);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get notification number!" });
  }
};