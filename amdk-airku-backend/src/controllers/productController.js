const Product = require('../models/productModel');

const getProducts = async (req, res) => {
    try {
        const products = await Product.getAll();
        res.json(products);
    } catch (error) {
        console.error('Error getting products:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const getProductById = async (req, res) => {
    try {
        const product = await Product.getById(req.params.id);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Produk tidak ditemukan.' });
        }
    } catch (error) {
        console.error(`Error getting product ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const createProduct = async (req, res) => {
    const { sku, name, price, stock, capacityUnit } = req.body;
    if (!sku || !name || price === undefined || stock === undefined || capacityUnit === undefined) {
        return res.status(400).json({ message: 'Harap isi semua kolom yang diperlukan.' });
    }
    try {
        const newProduct = await Product.create({ sku, name, price, stock, capacityUnit });
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const updateProduct = async (req, res) => {
    try {
        const product = await Product.getById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Produk tidak ditemukan.' });
        }
        
        const updatedProductData = { ...product, ...req.body };
        const result = await Product.update(req.params.id, updatedProductData);
        res.json(result);
    } catch (error) {
        console.error(`Error updating product ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product = await Product.getById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Produk tidak ditemukan.' });
        }
        
        // TODO: Tambahkan pengecekan dependensi sebelum menghapus (misal: apakah produk ada di pesanan?)

        const success = await Product.delete(req.params.id);
        if(success) {
            res.json({ message: 'Produk berhasil dihapus.' });
        } else {
            res.status(500).json({ message: 'Gagal menghapus produk.' });
        }
    } catch (error) {
        console.error(`Error deleting product ${req.params.id}:`, error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
};

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
};
