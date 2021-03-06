
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

const Blockchain = require('../blockchain/blockchain');
const PubSub = require('../app/pubsub');
const Wallet = require('../wallet');
const TransactionPool = require('../wallet/transaction-pool');
const TransactionMiner = require('../app/transaction-miner');

const blockchain = new Blockchain();
const transactionPool = new TransactionPool();
const pubsub = new PubSub({ blockchain, transactionPool });
const wallet = new Wallet();
const transactionMiner = new TransactionMiner({ blockchain, transactionPool, wallet, pubsub });

const app = express();
app.use(bodyParser.json());

// @route  GET /api/blocks
// @desc   Allows requester to get all blocks in the blockchain instance
// @access Public
router.get('/api/blocks', (req, res) => {
  res.json(blockchain.chain);
});

// @route  POST /api/mine
// @desc   Allows requester to mine a block and add it to the chain
// @access Public
router.post('/api/mine', (req, res) => {
  const { data } = req.body;

  blockchain.addBlock({ data });
  pubsub.broadcastChain();
  res.redirect('/api/blocks');
});

// @route  POST /api/transaction
// @desc   Allows requester to generate a transaction
// @access Public
router.post('/api/transaction', (req, res) => {
  const { amount, recipient } = req.body;
  let transaction = transactionPool.existingTransaction({ inputAddress: wallet.publicKey });

  try {
    if (transaction) {
      transaction.update({ senderWallet: wallet, recipient, amount });
    } else {
      transaction = wallet.createTransaction({ recipient, amount, chain: blockchain.chain });
    }
  } catch(error) {
    //will make sure we don't run the next
    return res.json({ type: 'error', message: error.message });
  }
  transactionPool.setTransaction(transaction);

  pubsub.broadcastTransaction(transaction);
  res.json({ type: 'success', transaction });
});

// @route  GET /api/transaction-pool-map
// @desc   Allows requester to get data in transaction pool map
// @access Public
router.get('/api/transaction-pool-map', (req, res) => {
  res.json(transactionPool.transactionMap);
});

// @route  GET /api/mine-transactions
// @desc   Allows requester to call mineTransactions method in order...
// contd: to add a block of transactions to the blockchain
// @access Public
router.get('/api/mine-transactions', (req, res) => {
  transactionMiner.mineTransactions();

  res.redirect('/api/blocks');
});

// @route  GET api/wallet-info'
// @desc   Allows requester to retrieve address and balance
// @access Public
router.get('/api/wallet-info', (req, res) => {
  const address = wallet.publicKey;

  res.json({
    address: address,
    balance: Wallet.calculateBalance({ chain: blockchain.chain, address: address })
   });
});

// @route  GET /api/known-addresses
// @desc   When users goes to conduct a transaction, this route is called to display known wallet addresses on that page
// @access Public
router.get('/api/known-addresses', (req, res) => {
  const addressMap = {};

  for (let block of blockchain.chain) {
    for (let transaction of block.data) {
      const recipient = Object.keys(transaction.outputMap);

      recipient.forEach(recipient => addressMap[recipient] = recipient);
    }
  }

  res.json(Object.keys(addressMap));
});



module.exports = router;











