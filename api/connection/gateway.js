const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

let gateway = null;
let contract = null;

async function getContract() {
    try {
        if (contract) {
            return contract;
        }

        // Resolve configuration from environment variables (with sensible defaults)
        const CCP_PATH = process.env.CCP_PATH
            ? path.resolve(process.env.CCP_PATH)
            : path.resolve(__dirname, '..', 'connection', 'connection-org1.json');
        const CHANNEL_NAME = process.env.CHANNEL_NAME || 'mychannel';
        const CHAINCODE_NAME = process.env.CHAINCODE_NAME || 'assettrack';
        const DISCOVERY_ENABLED = (process.env.DISCOVERY_ENABLED || 'true').toLowerCase() === 'true';
        const AS_LOCALHOST = (process.env.AS_LOCALHOST || 'true').toLowerCase() === 'true';
        const APP_IDENTITY = process.env.APP_IDENTITY || 'appUser';
        const WALLET_PATH = process.env.WALLET_PATH
            ? path.resolve(process.env.WALLET_PATH)
            : path.join(__dirname, 'wallet');
        const FABRIC_HOST = process.env.FABRIC_HOST || 'localhost';

        // Load the network configuration
        if (!fs.existsSync(CCP_PATH)) {
            throw new Error(`Connection profile not found at ${CCP_PATH}`);
        }
        const ccpRaw = fs.readFileSync(CCP_PATH, 'utf8');
        const ccp = JSON.parse(ccpRaw);

        // Optional hostname rewrite: replace 'localhost' with an overridable host
        const rewriteUrlHost = (url) => {
            try {
                if (!url || FABRIC_HOST === 'localhost') return url;
                return url.replace('localhost', FABRIC_HOST);
            } catch (_) {
                return url;
            }
        };
        if (ccp.peers) {
            for (const peerName of Object.keys(ccp.peers)) {
                ccp.peers[peerName].url = rewriteUrlHost(ccp.peers[peerName].url);
            }
        }
        if (ccp.certificateAuthorities) {
            for (const caName of Object.keys(ccp.certificateAuthorities)) {
                ccp.certificateAuthorities[caName].url = rewriteUrlHost(
                    ccp.certificateAuthorities[caName].url
                );
            }
        }
        if (ccp.orderers) {
            for (const ordName of Object.keys(ccp.orderers)) {
                ccp.orderers[ordName].url = rewriteUrlHost(ccp.orderers[ordName].url);
            }
        }

        // Create a new file system based wallet for managing identities
        const wallet = await Wallets.newFileSystemWallet(WALLET_PATH);

        // Check to see if we've already enrolled the user
        const identity = await wallet.get(APP_IDENTITY);
        if (!identity) {
            console.log(`An identity for the user "${APP_IDENTITY}" does not exist in the wallet`);
            console.log('Run the enrollUser.js application before retrying');
            throw new Error('User identity not found in wallet. Please run: npm run enroll');
        }

        // Create a new gateway for connecting to our peer node
        gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: APP_IDENTITY,
            discovery: { enabled: DISCOVERY_ENABLED, asLocalhost: AS_LOCALHOST }
        });

        // Get the network (channel) our contract is deployed to
        const network = await gateway.getNetwork(CHANNEL_NAME);

        // Get the contract from the network
        contract = network.getContract(CHAINCODE_NAME);

        console.log('Successfully connected to Fabric network');
        console.log(`Using channel=${CHANNEL_NAME}, chaincode=${CHAINCODE_NAME}, identity=${APP_IDENTITY}`);
        return contract;

    } catch (error) {
        console.error(`Failed to connect to Fabric network: ${error.message}`);
        throw error;
    }
}

async function disconnect() {
    if (gateway) {
        gateway.disconnect();
        gateway = null;
        contract = null;
        console.log('Disconnected from Fabric network');
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('Received SIGINT, disconnecting from Fabric network...');
    await disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, disconnecting from Fabric network...');
    await disconnect();
    process.exit(0);
});

module.exports = { getContract, disconnect };
