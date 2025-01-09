import { useState } from 'react';
import { ethers } from 'ethers';
import { deploymentAddresses, IApi3ServerV1__factory } from '@api3/contracts';
import './App.css';

function App() {
  const [chainId, setChainId] = useState('');
  const [startBlock, setStartBlock] = useState('');
  const [endBlock, setEndBlock] = useState('');
  const [blockStep, setBlockStep] = useState('1000');
  const [feedName, setFeedName] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const getRpcUrl = (chainId) => {
    const rpcUrls = {
      '56': 'https://rpc.ankr.com/bsc',
      '80001': 'https://rpc-mumbai.maticvigil.com',
      '421613': 'https://goerli-rollup.arbitrum.io/rpc'
    };
    return rpcUrls[chainId];
  };

  const queryBlockRange = async (contract, dataFeedId, provider, start, end, step) => {
    const results = [];
    for (let blockNumber = start; blockNumber <= end; blockNumber += Number(step)) {
      try {
        const data = await contract.readDataFeedWithId(dataFeedId, {
          blockTag: blockNumber
        });
        
        results.push({
          blockNumber,
          value: ethers.formatUnits(data.value, 18),
          timestamp: new Date(Number(data.timestamp) * 1000).toLocaleString()
        });
      } catch (err) {
        console.warn(`Failed to query block ${blockNumber}:`, err.message);
        // Continue with next block even if one fails
        continue;
      }
    }
    return results;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResults([]);
    setIsLoading(true);

    try {
      // Validate inputs
      if (!chainId || !startBlock || !endBlock || !feedName) {
        throw new Error('All fields are required');
      }

      const contractAddress = deploymentAddresses.Api3ServerV1[chainId];
      if (!contractAddress) {
        throw new Error('Contract not deployed on this chain');
      }

      const rpcUrl = getRpcUrl(chainId);
      if (!rpcUrl) {
        throw new Error('Unsupported chain ID');
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = IApi3ServerV1__factory.connect(contractAddress, provider);
      
      // Validate block range
      const latestBlock = await provider.getBlockNumber();
      const startNum = Number(startBlock);
      const endNum = Number(endBlock);
      
      if (startNum > endNum) {
        throw new Error('Start block must be less than end block');
      }
      if (endNum > latestBlock) {
        throw new Error(`End block too high. Latest block is ${latestBlock}`);
      }

      // Get data feed ID
      const dapiName = ethers.encodeBytes32String(feedName);
      const dataFeedId = await contract.dapiNameToDataFeedId(dapiName);

      // Query the block range
      const blockResults = await queryBlockRange(
        contract,
        dataFeedId,
        provider,
        startNum,
        endNum,
        blockStep
      );

      setResults(blockResults);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="container">
        <h1>Historical API3 Data Feed Reader</h1>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Chain ID:</label>
            <input
              type="text"
              value={chainId}
              onChange={(e) => setChainId(e.target.value)}
              required
              placeholder="Enter chain Id"
            />
          </div>

          <div className="form-group">
            <label>Start Block:</label>
            <input
              type="number"
              value={startBlock}
              onChange={(e) => setStartBlock(e.target.value)}
              required
              placeholder="Enter start block number"
            />
          </div>

          <div className="form-group">
            <label>End Block:</label>
            <input
              type="number"
              value={endBlock}
              onChange={(e) => setEndBlock(e.target.value)}
              required
              placeholder="Enter end block number"
            />
          </div>

          <div className="form-group">
            <label>Block Step:</label>
            <input
              type="number"
              value={blockStep}
              onChange={(e) => setBlockStep(e.target.value)}
              required
              placeholder="Number of blocks to skip between queries"
            />
          </div>

          <div className="form-group">
            <label>Feed Name:</label>
            <input
              type="text"
              value={feedName}
              onChange={(e) => setFeedName(e.target.value)}
              required
              placeholder="e.g., ETH/USD"
            />
          </div>

          <button 
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Querying...' : 'Query Historical Data'}
          </button>
        </form>

        {error && (
          <div className="error">
            Error: {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="result">
            <h2>Results:</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Value</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index}>
                      <td>{result.blockNumber}</td>
                      <td>{result.value}</td>
                      <td>{result.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;