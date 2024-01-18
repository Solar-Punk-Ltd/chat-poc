# chat-poc

Links:

- [Graffiti Feed](https://github.com/fairDataSociety/FIPs/blob/master/text/0062-graffiti-feed.md)
- [Zero Dash - library facilitates to use Graffiti Feeds on Ethereum Swarm](https://github.com/anythread/zerodash)
- [PSS Messaging](https://docs.ethswarm.org/docs/develop/dapps-on-swarm/pss/)
- [SOC and Feeds](https://bee-js.ethswarm.org/docs/soc-and-feeds/)

## direct feed chat based on graffiti feed

Don't need to manually set up batchID, the script will look for it
Works with bee 1.16.1 dev version at the moment

### enter directory
```cmd
cd chat-feed-v1
```
### install dependencies
```js
npm install
```

### run direct.js script
```js
npm run direct
```

## PSS with fdp-play

To try out this project, you'll need a running Docker instance.

### Prerequisites

- [Docker](https://www.docker.com/get-started) or [Docker - OrbStack for Mac](https://orbstack.dev)
- [fdp-play](https://github.com/fairDataSociety/fdp-play)
- [websocat](https://github.com/vi/websocat)

### Running the Application

Follow these steps to run the application.

### Clone this repository to your local machine

```bash
git clone https://github.com/Solar-Punk-Ltd/chat-poc.git
```

### Enter the project directory

```bash
cd pss-fdp-play
```

### Running the Test Network and Sending a Message

> __Important Note:__ The message sending process might take some time, and it may not always succeed immediately. Please be patient and allow several minutes for the message to be processed. If the message delivery fails, consider retrying after a brief period.

In a terminal, run start.sh. While the script is running, it will display progress updates, including a notification when it is in the process of _"buying postage stamp"_. At this point, you can proceed to start monitoring the WebSocket.

```bash
./start.sh
```

This script simplifies the process of starting the test network and sending a message. It performs the following operations:

1. Stops any existing `fdp-play` instances.
2. Starts one Queen node and four worker nodes using `fdp-play`. It also launches a blockchain node for blockchain_rpc_endpoint support. All worker nodes are in the same peers.
3. Retrieves information about each node, including addresses and peer details.
4. Purchases a postage stamp with a depth of `24` and an amount of `100,000,000`.
5. Retrieves the __peer address__ and __PSS public key__ of `node_1`.
6. Sends a message from the Queen node to node_1 using the purchased postage stamp. Please be aware that due to the nature of the network, the message sending process may take several minutes. If the message delivery is not successful, consider reattempting after a brief interval.

### websocat

Start monitoring the WebSocket on `node_1` for incoming messages; `test1` is the message group. You can run this command in another terminal while the postage stamp purchase is in progress, as the worker nodes are already running.

```bash
websocat ws://localhost:11633/pss/subscribe/test1
```
