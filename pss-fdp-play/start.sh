# The fdp-play script starts one queen node and four worker nodes.
# It also starts a blockchain node for blockchain_rpc_endpoint support.
# All worker nodes are in the same peers.
fdp-play stop
fdp-play start --fresh --detach

QUEEN_PORT=1633
QUEEN_DEBUG_PORT=1635
NODE_1_DEBUG_PORT=11635
NODE_2_DEBUG_PORT=21635
NODE_3_DEBUG_PORT=31635
NODE_4_DEBUG_PORT=41635

# Get node info
bee_node() {
    port="$1"
    echo "$port"
    curl -s "localhost:$port/addresses" | jq -c
    curl -s "localhost:$port/peers" | jq
    printf '%.0s-' {1..72}
    echo
}

bee_node "$QUEEN_DEBUG_PORT"
bee_node "$NODE_1_DEBUG_PORT"
bee_node "$NODE_2_DEBUG_PORT"
bee_node "$NODE_3_DEBUG_PORT"
bee_node "$NODE_4_DEBUG_PORT"

# Purchasing postage stamp
STAMP=$(swarm-cli stamp buy --yes --depth 24 --amount 100000000 | grep "Stamp ID:" | cut -d " " -f 3)

# Retrieve the peer address of node_1 and use the first 4 characters as the peer ids
PEER=$(curl -s "localhost:$NODE_1_DEBUG_PORT/peers" | jq -r '.peers[0].address' | cut -c 1-4)

# Retrieve the PSS public key of node_1
PSS_PUBLIC_KEY=$(curl -s "localhost:$NODE_1_DEBUG_PORT/addresses" | jq -r '.pssPublicKey')

echo "STAMP: $STAMP"
echo "PEER: $PEER"
echo "PSS_PUBLIC_KEY FOR NODE_1: $PSS_PUBLIC_KEY"

# Send a message to node_1 from queen node
set -x
curl -H "Swarm-Postage-Batch-Id: $STAMP" -XPOST "http://localhost:$QUEEN_PORT/pss/send/test/$PEER?recipient=$PSS_PUBLIC_KEY" --data "Hello Bee $(date +"%Y-%m-%d %H:%M:%S")"
