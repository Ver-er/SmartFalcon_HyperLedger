const express = require('express');
const app = express();
const port = 8080;
const { getContract } = require('./connection/gateway');
app.use(express.json());

// Create Asset endpoint
app.post('/assets', async (req, res) => {
    try {
        const {
            assetID, dealerID, msisdn, mpin, balance, status, transAmount, transType, remarks
        } = req.body;

        const contract = await getContract();
        await contract.submitTransaction('CreateAsset', assetID, dealerID, msisdn, mpin, balance.toString(), status, transAmount.toString(), transType, remarks);

        res.json({ message: 'Asset created successfully', assetID });
    } catch (error) {
        console.error(`Failed to create asset: ${error}`);
        res.status(500).json({ error: error.message });
    }
});

// Read Asset endpoint
app.get('/assets/:assetID', async (req, res) => {
    try {
        const contract = await getContract();
        const result = await contract.evaluateTransaction('ReadAsset', req.params.assetID);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        console.error(`Failed to read asset: ${error}`);
        res.status(500).json({ error: error.message });
    }
});

// Update Asset endpoint
app.put('/assets/:assetID', async (req, res) => {
    try {
        const { balance, status, transType, remarks, transAmount } = req.body;
        const contract = await getContract();
        await contract.submitTransaction('UpdateAsset', req.params.assetID, balance.toString(), status, transType, remarks, transAmount.toString());

        res.json({ message: 'Asset updated successfully', assetID: req.params.assetID });
    } catch (error) {
        console.error(`Failed to update asset: ${error}`);
        res.status(500).json({ error: error.message });
    }
});

// Get All Assets endpoint
app.get('/assets', async (req, res) => {
    try {
        const contract = await getContract();
        const result = await contract.evaluateTransaction('GetAllAssets');
        const text = result.toString().trim();
        // Fabric can return empty buffer or "null" when no keys exist; guard JSON.parse and normalize to []
        let payload = [];
        if (text.length > 0) {
            try {
                const parsed = JSON.parse(text);
                payload = parsed || [];
            } catch (_) {
                payload = [];
            }
        }
        res.json(payload);
    } catch (error) {
        console.error(`Failed to get all assets: ${error}`);
        res.status(500).json({ error: error.message });
    }
});

// Get Asset History endpoint
app.get('/assets/:assetID/history', async (req, res) => {
    try {
        const contract = await getContract();
        const result = await contract.evaluateTransaction('GetAssetHistory', req.params.assetID);
        res.json(JSON.parse(result.toString()));
    } catch (error) {
        console.error(`Failed to get asset history: ${error}`);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
