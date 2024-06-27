const mongoose = require('mongoose');
const axios = require('axios');
const cron = require('node-cron');

// MongoDB connection
const mongoUrl = "mongodb+srv://surbhit:1234@cluster0.tas80.mongodb.net/AVSData?retryWrites=true&w=majority&appName=Cluster0";
// const dbName = 'AVSData';
mongoose.connect(mongoUrl);

const OperatorSchema = new mongoose.Schema({
    operatorAddress: String,
    avsName: String,
    optedForMonitoring: Boolean,
    createdAt: { type: Date, default: Date.now }
});

const TimeSeriesSchema = new mongoose.Schema({
    operatorAddress: String,
    dispersal_response_time: String,
    retrieval_response_time: String,
    timestamp: { type: Date, default: Date.now }
});

const Operator = mongoose.model('Operator', OperatorSchema);
const TimeSeries = mongoose.model('TimeSeries', TimeSeriesSchema);

const fetchOperators = async () => {
    try {
        const response = await axios.get('https://api.dune.com/api/v1/eigenlayer/operator-to-avs-mapping?limit=99', {
            headers: { 'X-DUNE-API-KEY': '9twHTOAjtbl9jLGhJAGtDPNTGMY9CyKz' }
        });
        // console.log(response.data.result.rows);
        const operators = response.data.result.rows;
        for (const operator of operators) {
            console.log(operator)
            console.log(operator.operator_contract_address)
            await Operator.updateOne(
                { operatorAddress: operator.operator_contract_address },
                { operatorAddress: operator.operator_contract_address, avsName: operator.avsName, optedForMonitoring: true },
                { upsert: true }
            );
        }
        console.log('Operators fetched and stored successfully');
    } catch (error) {
        console.error('Error fetching operators:', error);
    }
};

const checkPorts = async (operatorAddress) => {
    console.log("Operator Address: ",operatorAddress);
    try {
        const response = await axios.get(`http://localhost:3000/api/check-ports`, {
            params: { operatorAddress}
        });
        console.log(response.data);
        const { dispersal_online,dispersal_socket,dispersal_response_time,retrieval_online,retrieval_socket,retrieval_response_time } = response.data;
        await TimeSeries.create({
            operatorAddress,
            dispersal_online,
            dispersal_socket,
            dispersal_response_time,
            retrieval_online,
            retrieval_socket,
            retrieval_response_time
        });
        console.log(`Stored response times for ${operatorAddress}`);
    } catch (error) {
        console.error(`Error checking ports for ${operatorAddress}:`, error.message);
    }
};

// Fetch operators once at the start
// fetchOperators();

// Schedule cron job to run every 5 minutes
cron.schedule('*/1 * * * *', async () => {
    const operators = await Operator.find({ optedForMonitoring: true });
    console.log("Registered Operators: ");
    // console.log(operators);
    for (const operator of operators) {
        await checkPorts(operator.operatorAddress);
    }
    console.log('Cron job executed successfully');
});
