import { useState } from 'react';
import { ethers } from 'ethers';
import { deploymentAddresses, IApi3ServerV1__factory } from '@api3/contracts';
import { CHAINS } from '@api3/chains';
import EthDater from 'ethereum-block-by-date';
import './App.css';

function App() {
  const [queryMode, setQueryMode] = useState('block'); // 'block' or 'date'
  const [chainId, setChainId] = useState('');
  const [chainSearch, setChainSearch] = useState('');
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [startBlock, setStartBlock] = useState('');
  const [endBlock, setEndBlock] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [blockStep, setBlockStep] = useState('1000');
  const [feedName, setFeedName] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const getChainDetails = (chainId) => {
    return CHAINS.find(chain => chain.id === chainId);
  };

  const searchChains = (searchTerm) => {
    searchTerm = searchTerm.toLowerCase();
    return CHAINS.filter(chain => 
      chain.name.toLowerCase().includes(searchTerm) || 
      chain.id.includes(searchTerm)
    ).slice(0, 5); // Limit to 5 results
  };

  const handleChainSelect = (chain) => {
    setChainId(chain.id);
    setChainSearch(chain.name);
    setShowChainDropdown(false);
  };

  const handleChainSearchChange = (e) => {
    const value = e.target.value;
    setChainSearch(value);
    setShowChainDropdown(!!value);
    
    // If input is a valid chain ID, set it directly
    const chain = CHAINS.find(c => c.id === value);
    if (chain) {
      setChainId(chain.id);
    } else {
      setChainId('');
    }
  };

  const getRpcUrl = (chainId) => {
    const chain = getChainDetails(chainId);
    return chain?.providers?.[0]?.rpcUrl;
  };

  const queryBlockRange = async (contract, dataFeedId, provider, start, end, step) => {
    const results = [];
    console.log('Starting query with dataFeedId:', dataFeedId);
    
    for (let blockNumber = start; blockNumber <= end; blockNumber += Number(step)) {
      try {
        const data = await contract.readDataFeedWithId(dataFeedId, {
          blockTag: blockNumber
        });
        console.log('Block', blockNumber, 'data:', data);
        
        results.push({
          blockNumber,
          value: ethers.formatUnits(data.value, 18),
          timestamp: new Date(Number(data.timestamp) * 1000).toLocaleString()
        });
      } catch (err) {
        console.error(`Error at block ${blockNumber}:`, err);
        // Continue with next block even if one fails
        continue;
      }
    }
    return results;
  };

  const getBlockFromDate = async (dateStr, provider) => {
    try {
      const dater = new EthDater(provider);
      const block = await dater.getDate(dateStr);
      return block.block;
    } catch (error) {
      console.error('Error converting date to block:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResults([]);
    setIsLoading(true);

    try {
      // Validate inputs
      if (!chainId || !feedName) {
        throw new Error('Chain and feed name are required');
      }

      if (queryMode === 'block' && (!startBlock || !endBlock)) {
        throw new Error('Start and end blocks are required');
      }

      if (queryMode === 'date' && (!startDate || !endDate)) {
        throw new Error('Start and end dates are required');
      }

      const chain = getChainDetails(chainId);
      if (!chain) {
        throw new Error('Unsupported chain ID');
      }

      const rpcUrl = getRpcUrl(chainId);
      if (!rpcUrl) {
        throw new Error('No RPC URL available for this chain');
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Convert dates to blocks if in date mode
      let finalStartBlock = startBlock;
      let finalEndBlock = endBlock;

      if (queryMode === 'date') {
        try {
          finalStartBlock = await getBlockFromDate(startDate, provider);
          finalEndBlock = await getBlockFromDate(endDate, provider);
          console.log(`Date conversion: ${startDate} -> block ${finalStartBlock}, ${endDate} -> block ${finalEndBlock}`);
        } catch (error) {
          throw new Error(`Error converting dates to blocks: ${error.message}`);
        }
      }

      const contractAddress = deploymentAddresses.Api3ServerV1[chainId];
      if (!contractAddress) {
        throw new Error('Contract not deployed on this chain');
      }

      const contract = IApi3ServerV1__factory.connect(contractAddress, provider);
      
      // Validate block range
      const latestBlock = await provider.getBlockNumber();
      const startNum = Number(finalStartBlock);
      const endNum = Number(finalEndBlock);
      
      if (startNum > endNum) {
        throw new Error('Start block must be less than end block');
      }
      if (endNum > latestBlock) {
        throw new Error(`End block too high. Latest block is ${latestBlock}`);
      }

      // Get data feed ID
      const dapiName = ethers.encodeBytes32String(feedName);
      console.log('Encoded dAPI name:', dapiName);
      
      const dataFeedId = await contract.dapiNameToDataFeedId(dapiName);
      console.log('Data feed ID:', dataFeedId);
      
      if (dataFeedId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        throw new Error(`Feed name "${feedName}" not found on this chain`);
      }

      // Query the block range
      const blockResults = await queryBlockRange(
        contract,
        dataFeedId,
        provider,
        startNum,
        endNum,
        blockStep
      );

      console.log('Query results:', blockResults);

      if (blockResults.length === 0) {
        throw new Error('No data found for the specified block range');
      }

      setResults(blockResults);
    } catch (err) {
      console.error('Detailed error:', err);
      setError(err.message || 'An unknown error occurred');
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
            <label>Chain:</label>
            <input
              type="text"
              value={chainSearch}
              onChange={handleChainSearchChange}
              required
              placeholder="Search by chain name or ID"
              autoComplete="off"
            />
            {showChainDropdown && chainSearch && (
              <div className="chain-dropdown">
                {searchChains(chainSearch).map(chain => (
                  <div
                    key={chain.id}
                    className="chain-option"
                    onClick={() => handleChainSelect(chain)}
                  >
                    {chain.name} ({chain.id})
                  </div>
                ))}
              </div>
            )}
            {chainId && getChainDetails(chainId) && (
              <div className="chain-name">
                Selected: {getChainDetails(chainId).name} ({chainId})
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Query Mode:</label>
            <div className="query-mode-selector">
              <label>
                <input
                  type="radio"
                  value="block"
                  checked={queryMode === 'block'}
                  onChange={(e) => setQueryMode(e.target.value)}
                />
                Block Range
              </label>
              <label>
                <input
                  type="radio"
                  value="date"
                  checked={queryMode === 'date'}
                  onChange={(e) => setQueryMode(e.target.value)}
                />
                Date Range
              </label>
            </div>
          </div>

          {queryMode === 'block' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Start Date:</label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>End Date:</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </>
          )}

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
