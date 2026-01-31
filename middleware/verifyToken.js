import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) return res.status(401).json({ message: "Not Authenticated!" });

  jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, payload) => {
    if (err) return res.status(403).json({ message: "Token is not Valid!" });
    req.userId = payload.id;

    next();
  });
};

//Penser aux routes pour admin aussi, d'où coté react il faut aussi envoyer
//isAdmin  pour proteger certaines routes

//_________________________________________________________________________________________


export const verifyToken_DEBUG = (req, res, next) => {
  const token = req.cookies.token;
  
  console.log("Cookies reçus:", req.cookies); // Debug
  console.log("Token:", token); // Debug
  
  if (!token) {
    console.log("No token found!"); // Debug
    return res.status(401).json({ message: "Not Authenticated!" });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, payload) => {
    if (err) {
      console.log("Token verification error:", err); // Debug
      return res.status(403).json({ message: "Token is not Valid!" });
    }
    
    console.log("Payload:", payload); // Debug
    req.userId = payload.id;
    
    next();
  });
};



/* 
            Externe 
----------------------------------------------------------------------------

import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) return res.status(401).json({ message: "Not Authenticated!" });

  jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, payload) => {
    if (err) return res.status(403).json({ message: "Token is not Valid!" });
    req.userId = payload.id;

    next();
  });
}; */