import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
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

   /*  localId: {
      type: String,
      unique: true,
      sparse: true,
    },
 */
       localId: {
      type: String,
      index: true, // ❗ JAMAIS unique (offline-first)
    },

    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ syncStatus: 1 });
/* productSchema.index({ localId: 1 }); */

const Product = mongoose.model('Product', productSchema);

export default Product;
