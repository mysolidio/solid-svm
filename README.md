# Solid SVM

## Introduction
Solid is a global standard for Digital Identity and Data Self-Sovereignty in Web3, implemented on the Solana blockchain.
This repository contains the main smart contract program built using the Anchor framework.

## Prerequisites
- Rust and Cargo
- Solana CLI tools
- Anchor Framework
- Node.js and npm

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/solidlabsinc/solid-svm
   cd solid-svm
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

## Building and Deployment

### Build the program
```bash
anchor build
```

### Deploy to the network
```bash
anchor deploy
```

### Run tests
```bash
anchor test
```

## Local Development
To set up a local development environment:
1. Start a local Solana validator
2. Build and deploy the program
3. Run the test suite to verify functionality

## Testing
The test suite includes:
- Unit tests
- Integration tests
- End-to-end testing scenarios

Run the complete test suite with:
```bash
anchor run test
```

## Contributing
Contributions are welcome!

## Contact
hi@solidlabsinc.io