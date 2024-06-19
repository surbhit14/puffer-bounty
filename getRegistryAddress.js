const Web3 = require('web3');

// Connect to Ethereum node
const infuraUrl = 'https://mainnet.infura.io/v3/2bf4df7e147a4b4990678da24ad867c1';
const web3 = new Web3(new Web3.providers.HttpProvider(infuraUrl));

// Proxy contract address
const proxyContractAddress = '0x870679e138bcdf293b7ff14dd44b70fc97e12fc0';

// Proxy contract ABI (simplified, you may need to add more functions based on your needs)
const proxyContractAbi = [
    {
        "constant": true,
        "inputs": [],
        "name": "implementation",
        "outputs": [
            {
                "name": "",
                "type": "address"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
];

// RegistryCoordinator contract ABI
const registryCoordinatorAbi = [
    {
        "constant": true,
        "inputs": [],
        "name": "someMethod",
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
    // Add other methods and events as required
];

// Create contract instance for the proxy contract
const proxyContract = new web3.eth.Contract(proxyContractAbi, proxyContractAddress);

// Function to fetch the implementation address
async function getImplementationAddress() {
    try {
        const implementationAddress = await proxyContract.methods.implementation().call();
        console.log(`Implementation address: ${implementationAddress}`);
        return implementationAddress;
    } catch (error) {
        console.error(`Error fetching implementation address: ${error.message}`);
        return null;
    }
}

// Function to call a method on the registryCoordinator contract
async function callRegistryCoordinatorMethod(implementationAddress) {
    const registryCoordinatorContract = new web3.eth.Contract(registryCoordinatorAbi, implementationAddress);
    try {
        const result = await registryCoordinatorContract.methods.someMethod().call();
        console.log(`Result from someMethod: ${result}`);
    } catch (error) {
        console.error(`Error calling someMethod: ${error.message}`);
    }
}

// Main function to execute the above steps
async function main() {
    const implementationAddress = await getImplementationAddress();
    if (implementationAddress) {
        await callRegistryCoordinatorMethod(implementationAddress);
    }
}

// Execute main function
main();
