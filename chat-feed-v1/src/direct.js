const { Bee } = require('@ethersphere/bee-js')
const {getConsensualPrivateKey, serializeGraffitiRecord, getGraffitiWallet } = require('zerodash/dist/graffiti-feed')
const { hexToBytes,bytesToHex , keccak256Hash,numberToFeedIndex  } = require('zerodash/dist/utils')
const {getFirstPostageBatch,sleep}  = require('./utils')
const {LocalStorage} = require('node-localstorage')

if (typeof localStorage === "undefined" || localStorage === null) {
  localStorage = new LocalStorage('./temp');
}

const beeUrl = 'http://localhost:1633'
const bee = new Bee(beeUrl)
const consensusId = 'MyChatApp:v1'
const resourceId = 'demo'

const graffitiSignerPk = getConsensualPrivateKey(resourceId)
const graffitiFeedWallet = getGraffitiWallet(graffitiSignerPk);
const graffitiFeedWalletHex = graffitiFeedWallet.address.slice(2)

const graffitiSigner = { 
  address: hexToBytes(graffitiFeedWalletHex), // convert hex string to Uint8Array
  sign: async (data) => { 
    return await graffitiFeedWallet.signMessage(data)
  },
}

const consensusHash = keccak256Hash(consensusId)
const graffitiWriter = bee.makeFeedWriter('sequence', consensusHash, graffitiSigner)
const graffitiReader = bee.makeFeedReader('sequence', consensusHash, graffitiSigner.address)

let postageBatchId = '' // replace this with the postage batch id
let jsonItems = []
let feedLastReadRecordIndex = 0

async function getPostageBatchID(){
  if(postageBatchId === '') {
    const postageBatch = await getFirstPostageBatch()
    postageBatchId = postageBatch.batchID

    console.log("postage batch ID",postageBatchId)
  }

  return postageBatchId
}

function saveProgress(){
  localStorage.setItem('items',JSON.stringify(jsonItems))
  localStorage.setItem('feedLastReadRecordIndex',JSON.stringify(feedLastReadRecordIndex))
}

async function writeTestMessage(sampleMsg, additionalData){
    let data = Object.assign({text: sampleMsg, timestamp: Date.now()}, additionalData)
    const stamp = await getPostageBatchID()
    const {reference: gfrReference} = await bee.uploadData(stamp, serializeGraffitiRecord(data))

    await graffitiWriter.upload(stamp, gfrReference)
}

async function writeTestMessages(count, milliseconds){
  for(let i = 1; i<=count; i++){
    await writeTestMessage("Hello there! - " + i,{})
    //sleep(Math.ceil(Math.random() * 4500)+500)
  }
}

async function readFeedMessages(){
  console.log("trying to read messages from feed index",feedLastReadRecordIndex+1)
  while (true) {
    try {
      let message = await readFeedMessage()
      displayMessage(message,"FEED MESSAGE RECEIVED")
      jsonItems.push(Object.assign(message,{"feedSequenceIndex":feedLastReadRecordIndex+1}))
      feedLastReadRecordIndex++
      saveProgress()
    } catch (error) {
      console.log("couldn't find message on record index ",feedLastReadRecordIndex+1, "...")
      setTimeout(readFeedMessages,3000)
      break
    }
  }
}

function readMessagesFromStorage(){
  console.log("storage messages length",jsonItems.length)
  for (let i = 0; i<jsonItems.length; i++){
    displayMessage(jsonItems[i],"STORAGE: message restored")
  }
}

function displayMessage(message, prefix){
  console.log(prefix,JSON.stringify(message))
}

async function readFeedMessage(){
  const recordPointer = await graffitiReader.download({ index: numberToFeedIndex(feedLastReadRecordIndex+1) })
  const record = await bee.downloadData(recordPointer.reference)

  return JSON.parse(new TextDecoder().decode(record))
}

async function main() {
  const currentPostageBatchID = await getPostageBatchID()
  const oldPostageBatchID = localStorage.getItem("lastPostageBatchID") || ''
  if (oldPostageBatchID !== currentPostageBatchID){
    console.log("different stamp, clear local storage")
    localStorage.clear() // because on bee restart we need to purge local storage data
    localStorage.setItem("lastPostageBatchID",postageBatchId)
  }

  jsonItems = JSON.parse(localStorage.getItem('items') || '[]');
  feedLastReadRecordIndex = parseInt(localStorage.getItem('lastReadIndex') || '0');

  console.log("last read index is: ",feedLastReadRecordIndex)

  writeTestMessages(20,5000);
  readMessagesFromStorage();
  readFeedMessages()
}

main()