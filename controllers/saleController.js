import Sale from '../models/Sale.js';
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
//======================================================================================


// Créer une vente
export const createSale = async (req, res) => {
  try {
    const { items, customerName, customerPhone, paymentMethod, localId } = req.body;
    
    // Calculer le total
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Vérifier et mettre à jour les stocks
    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Produit ${item.productId} non trouvé`,
        });
      }
      
      if (product.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Stock insuffisant pour ${product.name}`,
        });
      }
      
      // Réduire le stock
      product.quantity -= item.quantity;
      await product.save();
    }
    
    const saleData = {
      items,
      totalAmount,
      customerName,
      customerPhone,
      paymentMethod,
      lastModified: new Date(),
    };
    
    if (localId) {
      saleData.localId = localId;
    }
    
    const sale = new Sale(saleData);
    await sale.save();
    
    res.status(201).json({
      success: true,
      data: sale,
    });
  } catch (error) {
    handleError(error, res);
  }
};

//==================================================================================


// Récupérer toutes les ventes
export const getSales = async (req, res) => {
  try {
    const sales = await Sale.find()
      .sort({ createdAt: -1 })
      .populate('items.productId', 'name sku');
    
    res.json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    handleError(error, res);
  }
};



//---------------------------------------------------- DeepSeek--------------
export const syncSales_GARDER = async (req, res) => {
  try {
    const { sales = [], lastSync } = req.body;

    // ===============================
    // 1️⃣ CHANGEMENTS SERVEUR → CLIENT
    // ===============================
    const serverChanges = await Sale.find({
      lastModified: { $gt: new Date(lastSync) },
      syncStatus: 'synced',
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
    for (const clientSale of sales) {
      // ===============================
      // NETTOYAGE DES DONNÉES (comme syncProducts)
      // ===============================
      const {
        _id,
        id,            // Dexie id → ignoré
        syncStatus,    // frontend only
        __v,
        ...cleanData
      } = clientSale;

      // Sécurité minimale
      if (!cleanData.localId) continue;

      // ===============================
      // 🔍 CHERCHER PAR localId (OFFLINE-FIRST)
      // ===============================
      const existing = await Sale.findOne({
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
      // VÉRIFICATION STOCK (AMÉLIORÉE)
      // ===============================
      let canCreate = true;
      const stockUpdates = [];

      for (const item of cleanData.items) {
        // 1. Chercher produit par localId d'abord (offline)
        let product = await Product.findOne({ 
          localId: item.productLocalId 
        });

        // 2. Si pas trouvé, chercher par _id (online existant)
        if (!product && item.productId) {
          product = await Product.findById(item.productId);
        }

        // 3. Vérification stock
        if (!product) {
          canCreate = false;
          results.conflicts.push({
            localId: cleanData.localId,
            message: `Produit ${item.productLocalId || item.productId} non trouvé`,
            item: item
          });
          break;
        }

        if (product.quantity < item.quantity) {
          canCreate = false;
          results.conflicts.push({
            localId: cleanData.localId,
            message: `Stock insuffisant pour ${item.name}`,
            item: item,
            available: product.quantity,
            requested: item.quantity
          });
          break;
        }

        // Stocker pour mise à jour plus tard
        stockUpdates.push({
          productId: product._id,
          quantity: item.quantity
        });
      }

      if (!canCreate) {
        continue; // Passer à la vente suivante
      }

      // ===============================
      // UPSERT SALE (CREATE OU UPDATE)
      // ===============================
      const saved = await Sale.findOneAndUpdate(
        { localId: cleanData.localId },
        {
          $set: {
            items: cleanData.items,
            totalAmount: cleanData.totalAmount,
            customerName: cleanData.customerName || '',
            customerPhone: cleanData.customerPhone || '',
            paymentMethod: cleanData.paymentMethod || 'cash',
            isPaid: cleanData.isPaid ?? true,
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
      // MISE À JOUR STOCKS (si nouvelle vente)
      // ===============================
      if (!existing) {
        for (const update of stockUpdates) {
          await Product.findByIdAndUpdate(
            update.productId,
            { $inc: { quantity: -update.quantity } }
          );
        }
      }

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
    handleError(error, res);
  }
};

//----------------------------------------------------------------------

// 🔹 Fonction pour générer un saleNumber unique
async function getNextSaleNumber() {
  const lastSale = await Sale.findOne({}).sort({ saleNumber: -1 }).lean();
  return lastSale ? lastSale.saleNumber + 1 : 1;
}
//------------------------------------------------------------------------


  // ✅ VERSION CORRIGÉE DE syncSales (clé : renvoyer saved complet)
  // MA VERSION
export const syncSales = async (req, res) => {
  try {
    const { sales = [], lastSync } = req.body;

    // 1️⃣ CHANGEMENTS SERVEUR → CLIENT
    const serverChanges = await Sale.find({
      lastModified: { $gt: new Date(lastSync) },
      syncStatus: 'synced',
    });

    // 2️⃣ RÉSULTATS
    const results = {
      created: [],
      updated: [],
      conflicts: [],
    };

    // 3️⃣ TRAITEMENT CLIENT → SERVEUR
    for (const clientSale of sales) {
      const {
        _id,
        id,
        syncStatus,
        __v,
        ...cleanData
      } = clientSale;

      if (!cleanData.localId) continue;

      const existing = await Sale.findOne({ localId: cleanData.localId });

      // ⚠️ Conflit de version
      if (existing && existing.version !== cleanData.version) {
        results.conflicts.push({
          localId: cleanData.localId,
          client: cleanData,
          server: existing,
        });
        continue;
      }

      // ✅ Vérification stock
      let canCreate = true;
      const stockUpdates = [];

      for (const item of cleanData.items) {
        let product = await Product.findOne({ localId: item.productLocalId });

        if (!product && item.productId) {
          product = await Product.findById(item.productId);
        }

        if (!product || product.quantity < item.quantity) {
          canCreate = false;
          results.conflicts.push({
            localId: cleanData.localId,
            message: `Stock insuffisant ou produit introuvable`,
            item,
          });
          break;
        }

        stockUpdates.push({
          productId: product._id,
          quantity: item.quantity,
        });
      }

      if (!canCreate) continue;

        // 🔹 GÉNÉRATION saleNumber
      const saleNumber = existing?.saleNumber || await getNextSaleNumber();


      // ✅ UPSERT VENTE
      const saved = await Sale.findOneAndUpdate(
        { localId: cleanData.localId },
        {
          $set: {
            items: cleanData.items,
            totalAmount: cleanData.totalAmount,
            customerName: cleanData.customerName || '',
            customerPhone: cleanData.customerPhone || '',
            paymentMethod: cleanData.paymentMethod || 'cash',
            isPaid: cleanData.isPaid ?? true,
            localId: cleanData.localId,
            version: (existing?.version || 0) + 1,
            syncStatus: 'synced',
            lastModified: new Date(),
             saleNumber, // ✅ OBLIGATOIRE pour éviter duplicate key
          },
        },
        { upsert: true, new: true }
      );

      // 🔻 Mise à jour stock (uniquement nouvelle vente)
      if (!existing) {
        for (const update of stockUpdates) {
          await Product.findByIdAndUpdate(
            update.productId,
            { $inc: { quantity: -update.quantity } }
          );
        }
      }

      // ✅ ICI LA CORRECTION MAJEURE
      if (existing) {
        results.updated.push(saved);   // 🔥 vente complète
      } else {
        results.created.push(saved);   // 🔥 vente complète
      }
    }

    // 4️⃣ RÉPONSE
    res.json({
      success: true,
      serverChanges,
      clientResults: results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    handleError(error, res);
  }
};


//------------------------------------------------------------------------



//--------------------------------------------------- ChatGPT
export const syncSales_chatGPT = async (req, res) => {
  try {
    const { sales = [], lastSync } = req.body;

    // 1️⃣ CHANGEMENTS SERVEUR → CLIENT
    const serverChanges = await Sale.find({
      lastModified: { $gt: new Date(lastSync) },
    });

    const results = {
      created: [],
      updated: [],
      conflicts: [],
    };

    // 2️⃣ CLIENT → SERVEUR
    for (const clientSale of sales) {
      const {
        _id,
        id,          // Dexie id → ignoré
        syncStatus,
        __v,
        ...cleanData
      } = clientSale;

      if (!cleanData.localId) continue;

      const existing = await Sale.findOne({
        localId: cleanData.localId,
      });

      // ⚠️ CONFLIT DE VERSION
      if (existing && existing.version !== cleanData.version) {
        results.conflicts.push({
          localId: cleanData.localId,
          client: cleanData,
          server: existing,
        });
        continue;
      }

      // 🔒 VALIDATION STOCK (CRÉATION SEULEMENT)
      if (!existing) {
        for (const item of cleanData.items) {
          const product = await Product.findById(item.productId);
          if (!product || product.quantity < item.quantity) {
            results.conflicts.push({
              localId: cleanData.localId,
              message: `Stock insuffisant pour ${item.name}`,
            });
            continue;
          }
        }

        // ➖ Décrémenter stock
        for (const item of cleanData.items) {
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { quantity: -item.quantity } }
          );
        }
      }

      // 3️⃣ UPSERT
      const saved = await Sale.findOneAndUpdate(
        { localId: cleanData.localId },
        {
          $set: {
            ...cleanData,
            version: (existing?.version || 0) + 1,
            syncStatus: 'synced',
            lastModified: new Date(),
          },
        },
        { upsert: true, new: true }
      );

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

    // 4️⃣ RÉPONSE
    res.json({
      success: true,
      serverChanges,
      clientResults: results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    handleError(error, res);
  }
};



/*      propos de chatGPT
Différence essentielle   

Ma version :
➜ Simple, minimale, suppose que productId MongoDB existe déjà
➜ Vérification stock basique
➜ Moins robuste en offline pur

Ta version (celle que tu montres) :
✅ Vraiment offline-first
✅ Cherche le produit par productLocalId puis _id
✅ Vérifie le stock avant toute écriture
✅ Met à jour les stocks uniquement après succès
✅ Plus sûre, plus réaliste, plus future-proof

Conclusion

👉 Ta version est meilleure pour un vrai système de vente offline/online.
👉 Elle est alignée avec syncProducts et évite les bugs plus tard.


Si plus tard tu veux aller encore plus loin 
(journaux de mouvements de stock, audit, rollback), ta base est déjà propre. 💪

*/