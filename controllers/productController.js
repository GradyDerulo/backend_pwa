import Product from '../models/Product.js';

// Helper pour gérer les erreurs
const handleError = (error, res) => {
  console.error('Erreur:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Erreur serveur', 
    error: error.message 
  });
};

//==================================================================================

const handleErrorFOR = (error, res) => {
  console.error('SYNC PRODUCTS ERROR:', error);
  res.status(500).json({
    success: false,
    message: 'Erreur serveur',
    error: error.message,
  });
};
//==================================================================================



// Créer un produit *
// router.post('/', createProduct);
export const createProduct = async (req, res) => {
  try {
   /*  const { name, price, quantity, sku, localId } = req.body; */
    const { name, price, quantity, localId } = req.body;
    
    const productData = {
      name,
      price,
      quantity,
     /*  sku, */
      lastModified: new Date(),
    };
    
    // Si localId est fourni, on l'utilise pour la synchronisation
    if (localId) {
      productData.localId = localId;
    }
    
    const product = new Product(productData);
    await product.save();
    
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    handleError(error, res);
  }
};


//======================================================================================


// Récupérer tous les produits
// router.get('/', getProducts);
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .sort({ name: 1 });
    
    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    handleError(error, res);
  }
};

//======================================================================================


// Récupérer un produit par ID
// router.get('/:id', getProductById);
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé',
      });
    }
    
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    handleError(error, res);
  }
};

//======================================================================================

// Mettre à jour un produit
// dans la logique elle n'est pas necessaire
export const updateProduct = async (req, res) => {
  try {
    const { version } = req.body;
    
    // Vérifier la version pour détecter les conflits
    const existingProduct = await Product.findById(req.params.id);
    
    if (existingProduct && version && existingProduct.version !== version) {
      return res.status(409).json({
        success: false,
        message: 'Conflit de version',
        data: existingProduct,
      });
    }
    
    const updates = {
      ...req.body,
      lastModified: new Date(),
      version: (existingProduct?.version || 0) + 1,
      syncStatus: 'synced',
    };
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé',
      });
    }
    
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    handleError(error, res);
  }
};

//======================================================================================

//router.post('/sync', syncProducts);
export const syncProducts = async (req, res) => {
  try {
    const { products = [], lastSync } = req.body;
 /*    console.log('SYNC PRODUCTS PAYLOAD:', JSON.stringify(req.body, null, 2)); */

    // ===============================
    // 1️⃣ CHANGEMENTS SERVEUR → CLIENT   lastSync
    // ===============================
    const serverChanges = await Product.find({
        lastModified: { $gt: new Date(lastSync) },
      /*   updatedAt: { $gt: new Date(lastSync) },  */   // date de la derniere synchro (A comprendre)
    });

    // ===============================
    // 2️⃣ RÉSULTATS
    // ===============================
    const results = {
      created: [],
      updated: [],
      conflicts: [],
    };

    // ===============================
    // 3️⃣ TRAITEMENT CLIENT → SERVEUR
    // ===============================
    // Nettoie avant envoi
    for (const clientProduct of products) {
      const {
        _id,
        id,            // Dexie id → ignoré
        syncStatus,    // frontend only
        __v,
        ...cleanData
      } = clientProduct;

      /* console.log("TOUT ENVOYER : ", clientProduct);
      console.log("N'envoyer que : ", cleanData); */

      
      // sécurité minimale
      if (!cleanData.localId) continue;

      // 🔍 chercher par localId (clé offline-first)
      const existing = await Product.findOne({
        localId: cleanData.localId,
      });

      // ===============================
      // ⚠️ CONFLIT DE VERSION
      // ===============================
      if (existing && existing.version !== cleanData.version) {
        results.conflicts.push({
          localId: cleanData.localId,
          client: cleanData,
          server: existing,
        });
        continue;
      }

      // ===============================
      // UPSERT (CREATE OU UPDATE)
      // ===============================
      const saved = await Product.findOneAndUpdate(
        { localId: cleanData.localId },
        {
          $set: {
            name: cleanData.name,
            price: cleanData.price,
            quantity: cleanData.quantity,
            isActive: cleanData.isActive ?? true,
            localId: cleanData.localId,
            version: (existing?.version || 0) + 1,
            syncStatus: 'synced',
            lastModified: new Date(),
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      // ===============================
      // RÉSULTAT
      // ===============================
      if (existing) {
        results.updated.push({
          localId: saved.localId,
          _id: saved._id,
          version: saved.version,
        });
      } else {
        results.created.push({
          localId: saved.localId,
          _id: saved._id,
          version: saved.version,
        });
      }
    }

    // ===============================
    // 4️⃣ RÉPONSE
    // ===============================
    res.json({
      success: true,
      serverChanges,
      clientResults: results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    handleErrorFOR(error, res);
  }
};
