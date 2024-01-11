const { Bee, BeeDebug } = require('@ethersphere/bee-js')

const beeDebugUrl = 'http://localhost:1635'
const beeDebug = new BeeDebug(beeDebugUrl)

exports.getFirstPostageBatch =async function(){
    const stamps = await beeDebug.getAllPostageBatch();

    if (stamps.length>0){
        return stamps[stamps.length-1]
    }

    throw Error("no postage batch yet")
}

exports.sleep = function(delay) {
    const start = new Date().getTime();
    while (new Date().getTime() < start + delay);
}