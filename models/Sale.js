import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },

  productLocalId: {
    type: String,
  },

  name: {
    type: String,
    required: true,
  },

  price: {
    type: Number,
    required: true,
  },

  quantity: {
    type: Number,
    required: true,
    min: 1,
  },

  total: {
    type: Number,
    required: true,
  },
});

//---------------------------------------

const saleSchema = new mongoose.Schema(
  {
    saleNumber: {
      type: String,
      unique: true,
    },

    items: [saleItemSchema],

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    customerName: {
      type: String,
      trim: true,
    },

    customerPhone: {
      type: String,
      trim: true,
    },

    syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'conflict'],
      default: 'synced',
    },

    lastModified: {
      type: Date,
      default: Date.now,
    },

    
    localId: {
      type: String,
      unique: true,
      sparse: true,
    },

    version: {
      type: Number,
      default: 1,
    },

    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'mobile'],
      default: 'cash',
    },

    isPaid: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/* saleSchema.pre('save', async function (next) {
  if (!this.saleNumber) {
    const count = await this.constructor.countDocuments();
    this.saleNumber = `SALE-${Date.now()}-${count + 1}`;
  }
  next();
}); */



// Pour éviter erreurs futures :
// S'assurer que :
saleSchema.pre('save', async function(next) {
  // Générer saleNumber seulement si nouveau
  if (this.isNew && !this.saleNumber) {
    const count = await this.constructor.countDocuments();
    this.saleNumber = `SALE-${Date.now()}-${count + 1}`;
  }
  next();
});





const Sale = mongoose.model('Sale', saleSchema);

export default Sale;
