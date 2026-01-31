import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./lib/db.js";

/* import authRoute from "./routes/auth.route.js";
import userRoute from "./routes/user.route.js"; */

import productRoutes from './routes/productRoutes.js';
import saleRoutes from './routes/saleRoutes.js';
/* import syncRoutes from './routes/syncRoutes.js'; */



import  dotenv from 'dotenv';

const app = express();
dotenv.config();

const PORT = process.env.PORT || 5000;
/* app.use(cors({ origin: process.env.CLIENT_URL, credentials: true })); */



// Configuration CORS avec credentials


// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser()); //Obligatoire pour lire req.cookies


/* 
___________________________________________________________________
app.use(cors({
  origin: "http://localhost:5173", // ou 3000 selon votre port React
  credentials: true, // IMPORTANT: autoriser les cookies
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// IMPORTANT: aussi configurer les options pre-flight
app.options('*', cors({
  origin: "http://localhost:5173",
  credentials: true
}));
___________________________________________________________________

 */





// Routes
app.use('/api/products', productRoutes);  // ✅ Inclus /api/products/sync
app.use('/api/sales', saleRoutes);        // ✅ Inclus /api/sales/sync

/* Les routes /sync sont déjà incluses dans productRoutes et saleRoutes ! */

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
}); //  NOTRE TEST FONCTIONNE SUR CET ENDPOINT : http://localhost:5000/api/health 

app.get("/api/derulo", (req,res)=>{
  res.send("Bienvenu monsieur derulo")
})



// Demarrer Serveur
app.listen(PORT, () => {

  connectDB();
  console.log(`Serveur démarré sur le port ${PORT}`);
});
