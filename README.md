# Historical API3 Data Feed Reader

A React-based web application that allows users to query historical data from API3 data feeds across various blockchain networks.

## Usage

To query historical data:

- Select a blockchain network from the dropdown
- Enter the start and end block numbers
- Specify the block step (interval between queries)
- Enter the feed name (e.g., "ETH/USD")
- Click "Query Historical Data"

## Installation

1. Clone the repository:

```bash
git clone https://github.com/alikonuk1/history-api3.git
cd history-api3
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Dependencies

- [@api3/chains](https://github.com/api3dao/chains): Chain configurations and RPC endpoints
- [@api3/contracts](https://github.com/api3dao/contracts): API3 smart contract interfaces and addresses
- [ethers.js](https://docs.ethers.org/): Ethereum library for interacting with the blockchain

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For support, please open an issue in the GitHub repository.
